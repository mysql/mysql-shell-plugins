# Copyright (c) 2025, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is designed to work with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms, as
# designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have either included with
# the program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA


import os
import queue
import threading
import time
from typing import Optional

from ..util import sanitize_connection_dict
from ..gtid import gtid_contains, gtid_count, gtid_subtract
from .. import logging, oci_utils
from . import model
from .model import MigrationMessage, SubStepId, MigrationError, MigrationType, CloudConnectivity, ServerType
from .stage import Stage, WorkStatusEvent, ThreadedStage, OrchestratorInterface
from .remote_helper import RemoteHelperClient
from ..ssh_utils import RemoteSSHTunnel


# TODO add a stage to check direct connectivity from jump host to source DB

class CreateSSHTunnel(Stage):
    """
    Start a SSH tunnel at the local host, from the jump host, accepting
    connections from the DBSystem to the source database, for cases that:
    - direct connectivity from DBSystem to source DB is not possible
    - manually creating a ssh tunnel directly at the source DB host is not
    possible or not worth the effort because amount of data to replicate
    is small enough.
    """

    _helper: Optional[RemoteHelperClient] = None

    def __init__(self, owner: OrchestratorInterface) -> None:
        super().__init__(SubStepId.CREATE_SSH_TUNNEL, owner)

    @property
    def _enabled(self) -> bool:
        options = self._owner.project.options
        return (options.migrationType == model.MigrationType.HOT and
                options.cloudConnectivity in (model.CloudConnectivity.LOCAL_SSH_TUNNEL, model.CloudConnectivity.SSH_TUNNEL))

    def setup_tunnel(self):
        helper_host = self._owner.cloud_resources.computePublicIP
        source = self._owner.source_connection_options

        # TODO maybe run this as a separate process
        self._tunnel = RemoteSSHTunnel(
            user="opc",
            from_host=helper_host, from_port=3306,
            to_host=source["host"], to_port=source["port"],
            key_filename=self._owner.ssh_key_path,
            passphrase=None,
            allow_agent=False,
            look_for_keys=False,
            bind_address="0.0.0.0",
            keepalive=24*3600)

    def start(self, parents) -> bool:
        super().start(parents)

        if not self._enabled:
            logging.info(f"Skipping disabled stage {self._name}")
            return True

        if self._owner.project.options.cloudConnectivity == model.CloudConnectivity.LOCAL_SSH_TUNNEL:
            self.push_status(WorkStatusEvent.BEGIN,
                             message="Starting built-in ssh tunnel")
            try:
                self.start_local_tunnel()

                self.push_progress("Waiting for ssh tunnel")
            except Exception as e:
                logging.exception("tunnel start error")
                self.push_status(WorkStatusEvent.ERROR, message="Could not start built-in SSH tunnel",
                                 data={"error": MigrationError._from_exception(e)._json(noclass=False)})
                raise
        else:
            source_host = self._owner.project.source_connection_options["host"]
            source_port = self._owner.project.source_connection_options.get(
                "port", 3306)
            cmd = f"ssh -i{self._owner.project.ssh_key_private} -oIdentityAgent=none opc@{self._owner.cloud_resources.computePublicIP} -N -R 3306:{source_host}:{source_port}"

            self.push_status(WorkStatusEvent.BEGIN,
                             message="Waiting for ssh tunnel to be manually started",
                             data={
                                 "command": cmd
                             })

        return True

    def start_local_tunnel(self):
        self.setup_tunnel()

        self._tunnel.start()
        self.push_progress("Built-in ssh tunnel is running")

    def check_tunnel(self) -> bool:
        if not self._helper:
            try:
                self._helper = self._owner.connect_remote_helper()
            except Exception as e:
                self._helper = None
                logging.info(f"Could not connect to remote helper: {e}")
                return False

        try:
            if self._helper.test_tunnel(
                    user=self._owner.source_connection_options["user"],
                    password=self._owner.source_connection_options["password"]):
                logging.info(f"{self._name}: tunnel seems to work")
                return True
        # TODO dont close the helper if the error is not related to ssh
        except Exception as e:
            self._helper.close()
            self._helper = None
            logging.info(f"Error checking SSH tunnel remotely: {e}")
            return False

        return False

    def update(self) -> bool:
        if not self._enabled or self.check_tunnel():
            return True

        return False

    def finish(self):
        self._helper = None

        self.push_status(WorkStatusEvent.END,
                         message=f"SSH tunnel is ready and connectable")

        return super().finish()


class CheckDirectConnectivity(Stage):
    def __init__(self, owner: OrchestratorInterface) -> None:
        super().__init__(SubStepId.CHECK_DIRECT_NETWORK, owner)

    @property
    def _enabled(self) -> bool:
        options = self._owner.project.options
        return options.migrationType == model.MigrationType.HOT and options.cloudConnectivity == model.CloudConnectivity.SITE_TO_SITE


class CreateChannel(ThreadedStage):
    def __init__(self, owner) -> None:
        super().__init__(SubStepId.CREATE_CHANNEL, owner, work_fn=self._do_work)

    @property
    def _enabled(self) -> bool:
        return self._owner.project.options.migrationType == model.MigrationType.HOT

    def _do_work(self):
        assert self._owner.options.targetMySQLOptions

        self.push_status(WorkStatusEvent.BEGIN)
        try:
            self.ensure_channel()
        except Exception as e:
            logging.exception("create channel")
            self.push_status(WorkStatusEvent.ERROR,
                             {"error": MigrationError._from_exception(e)._json(noclass=False)})
            raise

        # try:
        #     helper = self._owner.connect_remote_helper()

        #     # helper.ensure_running()
        # except Exception as e:
        #     self.push_status(WorkStatusEvent.ERROR,
        #                      {"error": MigrationError._from_exception(e)._json(noclass=False)})
        #     raise

        self.push_status(WorkStatusEvent.END)

    def ensure_channel(self):
        assert self._owner.options.targetMySQLOptions

        self.db_system = oci_utils.DBSystem(
            config=self._owner.oci_config,
            ocid_or_db_system=self._owner.cloud_resources.dbSystemId)

        # check if channel exists
        self.channel = self.db_system.try_get_channel()
        if self.channel:
            logging.info(
                f"Channel for DBSystem {self.db_system.id} already exists: {self.channel}"
            )
            self._owner.cloud_resources.channelId = self.channel.id

            # delete channel and recreate if channel is FAILED or NEEDS_ATTENTION
            # once we're running, we can resume NEEDS_ATTENTION channels, but
            # right here we're not sure if the channel is usable
            if self.channel.lifecycle_state in ("FAILED", "NEEDS_ATTENTION"):
                logging.info(
                    f"Channel {self.channel.display_name} id={self.channel.id} state={self.channel.lifecycle_state} will be deleted and recreated")
                self.db_system.delete_channel(self.channel.id)
                # wait for channel to be gone
                while self.channel.lifecycle_state not in ("DELETING", "DELETED"):
                    logging.info(
                        f"Waiting for channel {self.channel.display_name} to be deleted state={self.channel.lifecycle_state}")
                    time.sleep(5)
                    self.channel.refresh()
                # now wait for dbsystem to get out of UPDATING
                self.db_system.refresh()
                while self.db_system.lifecycle_state == "UPDATING":
                    logging.info(
                        f"Waiting for DBSystem {self.db_system.display_name} to finish updating state={self.db_system.lifecycle_state}")
                    time.sleep(5)
                    self.db_system.refresh()
            else:
                return

        assert self._owner.options.migrationType == MigrationType.HOT
        source = self._owner.source_connection_options.copy()
        if self._owner.options.cloudConnectivity == CloudConnectivity.SITE_TO_SITE:
            pass
        elif self._owner.options.cloudConnectivity in (CloudConnectivity.LOCAL_SSH_TUNNEL, CloudConnectivity.SSH_TUNNEL):
            # tunnel endpoint is jumphost:3306
            source["port"] = 3306
            source["host"] = self._owner.cloud_resources.computePrivateIP

        logging.info(
            f"Creating new Channel type={self._owner.options.migrationType} connectivity={self._owner.options.cloudConnectivity} for DBSystem={self.db_system.id} to {sanitize_connection_dict(source)}")

        # if source doesn't do GTID, the channel has to be configured to use
        # binlog_file and position based replication. we assign the UUID that
        # will be assigned to replicated transactions to the server_uuid of the
        # source
        gtid_off_handling = None

        if self._owner.source_info.gtidMode != "ON":
            coords = self._owner.project.replication_coordinates
            assert coords
            gtid_off_handling = {
                "binlog_file": coords["Binlog_file"],
                "binlog_pos": coords["Binlog_position"],
                "uuid": self._owner.source_info.serverUuid
            }
            logging.info(
                f"Source has gtid_mode={self._owner.source_info.gtidMode}, channel will use file/pos: {gtid_off_handling}")

        replicate_wild_ignore_table = []

        if ServerType.RDS == self._owner.source_info.serverType:
            replicate_wild_ignore_table.append("mysql.rds%")

        self.channel = self.db_system.create_channel(
            source_host=source["host"],
            source_port=source["port"],
            source_user=source["user"],
            source_password=source["password"],
            gtid_off_handling=gtid_off_handling,
            freeform_tags=oci_utils.make_freeform_tags(
                self._owner.migrator_instance_id),
            replicate_wild_ignore_table=replicate_wild_ignore_table,
        )

        self._owner.cloud_resources.channelId = self.channel.id


class ChannelStatus(MigrationMessage):
    status: model.ReplicationStatus = model.ReplicationStatus.STOPPED
    details: str = ""
    errors: list[str] = []
    gtidBacklog: str = ""
    gtidBacklogSize: Optional[int] = None


class MonitorChannel(ThreadedStage):
    _update_interval = 10
    _error_update_interval = 60

    def __init__(self, owner, create_stage: CreateChannel):
        super().__init__(SubStepId.MONITOR_CHANNEL, owner, work_fn=self._do_work)
        self._create_stage = create_stage

        self._source_check_time = None
        self._source_gtid_executed = None
        self._source_gtid_purged = None

        self._target_check_time = None
        self._target_gtid_executed = None
        self._target_gtid_received = None

        self._receiver_state = None
        self._receiver_error = None
        self._applier_errors = []

        self._failed = False

        self._skip_gtid_queue = queue.Queue()

        self._sleep_cancel_event = threading.Event()

    @property
    def _enabled(self) -> bool:
        return self._owner.project.options.migrationType == model.MigrationType.HOT

    def _analyze_channel_status(self, status: dict) -> dict:
        self._target_gtid_executed = status.get("gtid_executed")
        self._target_gtid_received = status.get("gtid_received")
        self._receiver_state = None
        self._receiver_error = None
        self._applier_errors = []

        for connection_status in status.get("connection_status", []):
            if connection_status.get("LAST_ERROR_NUMBER"):
                self._receiver_state = connection_status.get("SERVICE_STATE")
                self._target_gtid_received = connection_status.get(
                    "RECEIVED_TRANSACTION_SET")
                self._receiver_error = {
                    "errno": connection_status.get("LAST_ERROR_NUMBER"),
                    "error": connection_status.get("LAST_ERROR_MESSAGE"),
                    "error_time": connection_status.get("LAST_ERROR_TIMESTAMP")
                }
                # only one channel per dbsystem expected
                break

        for applier_status in status.get("applier_status_by_worker", []):
            if applier_status.get("LAST_ERROR_NUMBER"):
                info = {
                    "errno": applier_status.get("LAST_ERROR_NUMBER"),
                    "error": applier_status.get("LAST_ERROR_MESSAGE"),
                    "error_time": applier_status.get("LAST_ERROR_TIMESTAMP"),
                    "transaction": applier_status.get("APPLYING_TRANSACTION")
                }
                self._applier_errors.append(info)

        return {
            "time": self._target_check_time,
            "gtid_executed": self._target_gtid_executed,
            "gtid_received": self._target_gtid_received,
            "receiver_error": self._receiver_error,
            "applier_errors": self._applier_errors,
        }

    def _is_resolved(self, status: dict):
        broken_gtids = [s["transaction"] for s in status["applier_errors"]]

        for gtid in broken_gtids:
            if not gtid_contains(status["gtid_executed"], gtid):
                return False

        logging.info(
            f"All transactions breaking applier appear to have been applied. gtid_executed={status["gtid_executed"]} transactions={','.join(broken_gtids)}")
        return True

    def _check_source_status(self) -> dict:
        if self._owner.source_info.gtidMode != "ON":
            return {}

        with self._owner.connect_source() as session:
            gtid_executed, gtid_purged = session.run_sql(
                "select @@gtid_executed, @@gtid_purged").fetch_one()

            return {"gtid_executed": gtid_executed, "gtid_purged": gtid_purged}

    def _analyze_replication_progress(self, channel_status: dict, source_status: dict) -> dict:
        # check if things are converging:
        # - purged missing transactions
        # - backlog growth rate
        # - backlog size
        # - calc replication lag
        return {}

    def _report_status(self, channel: Optional[oci_utils.Channel], channel_status: dict, source_status: dict):
        if source_status:
            progress = self._analyze_replication_progress(
                channel_status, source_status)
            # TODO log/report progress
        else:
            progress = None

        status = ChannelStatus()

        status.status = model.ReplicationStatus.ACTIVE

        if channel_status and source_status:
            status.gtidBacklog = gtid_subtract(
                source_status["gtid_executed"], channel_status["gtid_executed"])
            status.gtidBacklogSize = gtid_count(status.gtidBacklog)

        status.details = ""
        if channel_status:
            applier_status = channel_status["applier_errors"]
            if applier_status:
                status.status = model.ReplicationStatus.APPLIER_ERROR
                status.details = "There are replication applier errors in the target DBSystem. Remaining transactions from the source cannot be applied until resolved."
                errs = []
                for e in applier_status:
                    errs.append(f"{e['error']} (error={e['errno']})")
                status.errors = errs

            receiver_status = channel_status["receiver_error"]
            if receiver_status:
                status.status = model.ReplicationStatus.RECEIVER_ERROR
                status.details = "Target DBSystem is unable to connect to the source database."
                errs = []
                errs.append(
                    f"{receiver_status['error']} (error={receiver_status['errno']})")
                status.errors = errs

        self.push_progress(status.details, status._json())

    def _do_work(self):
        self.push_status(WorkStatusEvent.BEGIN)

        self._failed = False
        # TODO add a retry loop to this with exponential backup (max 10mins)
        # TODO catch EOFError and bubble up a more meaningful error (e.g. can happen when getting on vpn)
        try:
            helper = self._owner.connect_remote_helper()

            self._monitor_loop(helper)
        except Exception as e:
            self._failed = True
            self.push_status(WorkStatusEvent.ERROR,
                             {"error": model.MigrationError._from_exception(e)._json(noclass=False)})
            raise

    def _do_skip_gtids(self, helper):
        all = []
        while True:
            try:
                gtids = self._skip_gtid_queue.get_nowait()
                all.append(gtids)
            except:
                break

        if all:
            helper.skip_gtids(",".join(all))

    def _monitor_loop(self, helper):
        assert self._create_stage.channel
        channel = self._create_stage.channel

        old_channel_status = {}
        # TODO decide what to do with API server errors - retry until timeout?
        while not self._owner.stopped:
            channel.refresh()

            # note: the control plane will notice replication problems with a
            # delay compared to directly querying the server
            logging.info(
                f"channel lifecycle_state={channel.lifecycle_state} details={channel.lifecycle_details}")

            self._do_skip_gtids(helper)

            self._target_check_time = time.time()
            status = helper.channel_status(
                self._owner.target_connection_options)
            logging.devdebug(
                f"{self._name}: raw channel status={status}", iftag="sync")

            channel_changed = False
            channel_status = self._analyze_channel_status(status)
            if (channel_status | {"time": None}) != (old_channel_status | {"time": None}):
                old_channel_status = channel_status
                channel_changed = True
                logging.info(f"channel status={channel_status}")

            if channel.lifecycle_state == "NEEDS_ATTENTION" and channel_status["applier_errors"]:
                if self._is_resolved(channel_status):
                    # if the GTID from an applier error is in GTID_EXECUTED, then it
                    # was probably resolved somehow, so we can try resuming the
                    # channel
                    logging.info(
                        f"Resuming auto-resolved broken channel...")
                    self.resume()
                    continue

            if channel_changed:
                self._source_check_time = time.time()
                source_status = self._check_source_status()

                self._report_status(channel, channel_status, source_status)

            if channel.lifecycle_state == "ACTIVE":
                self._sleep_cancel_event.wait(timeout=self._update_interval)
            else:
                self._sleep_cancel_event.wait(
                    timeout=self._error_update_interval)

        logging.info(f"{self._name}: stopped")

    def stop(self):
        self._sleep_cancel_event.set()
        super().stop()

    def update(self) -> bool:
        return self._failed

    def resume(self):
        channel = self._create_stage.db_system.try_get_channel()
        if not channel:
            # TODO do some locking to prevent channel being changed from here
            # and the work thread at the same time
            logging.error(f"Could not get Channel for DBSystem")
            return

        if channel.lifecycle_state == "ACTIVE":
            # A channel can be still in state ACTIVE despite replication being
            # broken. In that case, we restart the channel by making it inactive
            # first.
            logging.info(f"Disabling channel...")
            channel.update(is_enabled=False)
            logging.info(f"Re-enabling channel...")
            channel.update(is_enabled=True)
        elif channel.lifecycle_state == "NEEDS_ATTENTION":
            logging.info(
                f"Channel is in state {channel.lifecycle_state} and will be resumed")
            channel.resume()

    def skip_gtids(self, gtids: str):
        self._skip_gtid_queue.put(gtids)

# TODO - scenario:
#   - create user admin@% executed at source
#   - DBSystem created with admin user=admin
#   - ibr will fail when replicating the create user:
#       - Operation CREATE USER failed for 'admin'@'%' as it is referenced as a definer account in a view.
#   - solution:
