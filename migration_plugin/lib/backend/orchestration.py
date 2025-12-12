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
from threading import Thread
from typing import Optional

from . import model
from .. import logging, dbsession, ssh_utils, errors
from ..project import Project
from ..oci_utils import Compartment
from .model import MigrationOptions, MigrationType, SubStepId, CloudResources
from .stage import Stage, OrchestratorInterface, WorkStatusEvent
from .oci_stages import (LaunchDBSystem, ProvisionVCN, ProvisionCompartment, ProvisionBucket,
                         ProvisionCompute, ProvisionJumpHost, AddHeatWaveCluster, EnableCrashRecovery, EnableHA)
from .dbmigration_stages import DumpStage, RemoteLoadStage
from .db_stages import MySQLTargetReadiness
from .sync_stages import CheckDirectConnectivity, CreateChannel, CreateSSHTunnel, MonitorChannel
from .remote_helper import RemoteHelperClient


class MigrationFrontend:
    _backend: "Orchestrator"

    def on_progress(self, source: SubStepId, message: str, data: dict = {}):
        pass

    def on_status(self, source: SubStepId, status: WorkStatusEvent, data: dict = {}, message: str = ""):
        pass

    def on_message(self, source: SubStepId, data: dict):
        pass

    def on_output(self, source: SubStepId, message: str):
        pass


class Root(Stage):
    def __init__(self, owner: OrchestratorInterface) -> None:
        super().__init__(SubStepId.ORCHESTRATION, owner)


class Congratulations(Stage):
    def __init__(self, owner: OrchestratorInterface) -> None:
        super().__init__(model.SubStepId.CONGRATS, owner)

    def start(self, parents) -> bool:
        flag = super().start(parents)
        self.push_status(WorkStatusEvent.BEGIN)

        if self._owner.project.options.migrationType == MigrationType.COLD:
            # work done, we dont need cached passwords anymore (unless we're monitoring inbound replication)
            self._owner.project.clear_passwords()

        return flag


class Orchestrator(OrchestratorInterface):
    _target_connection_options: dict = {}
    _storage_path: str = ""
    _thread = None

    def __init__(self, frontend: MigrationFrontend, project: Project) -> None:
        assert project.options.targetMySQLOptions

        self._frontend = frontend
        self._frontend._backend = self

        self._project = project

        self._compartment = None

        def make(klass, *args):
            stage = klass(*args)
            return stage

        # General order:
        #
        # - DBSystem -> Add Crash Recovery -> Add HA -> Add HW
        #
        # NOTE: operations that update DB System cannot be executed concurrently
        # eg. can't add channel or enable crash recovery while waiting for
        # HW cluster to finish creating

        self._root = make(Root, self)
        self._provision_compartment = make(ProvisionCompartment, self)
        self._provision_bucket = make(ProvisionBucket, self)
        self._provision_vcn = make(ProvisionVCN, self)
        self._provision_compute = make(ProvisionCompute, self)
        self._provision_jumphost = make(ProvisionJumpHost,
                                        self, self._provision_compute)
        self._wait_target = make(MySQLTargetReadiness, self)
        self._launch_dbsystem = make(LaunchDBSystem, self)
        self._add_heatwave = make(AddHeatWaveCluster, self)
        self._enable_crash_recovery = make(EnableCrashRecovery, self)
        self._enable_ha = make(EnableHA, self)

        self._dump = make(DumpStage, self)
        self._load = make(RemoteLoadStage, self, self._dump)

        self._create_tunnel = make(CreateSSHTunnel, self)

        self._create_channel = make(CreateChannel, self)
        self._watch_channel = make(MonitorChannel, self, self._create_channel)
        self._check_connectivity = make(CheckDirectConnectivity, self)
        self._done = make(Congratulations, self)

        logging.info(
            f"Scheduling tasks, migration_type={project.options.migrationType}")

        # Provisioning
        self._provision_bucket.add_dependency(self._provision_compartment)

        self._provision_compute.add_dependency(self._provision_compartment)
        self._provision_compute.add_dependency(self._provision_vcn)

        self._provision_jumphost.add_dependency(self._provision_compute)

        self._launch_dbsystem.add_dependency(self._provision_compartment)
        self._launch_dbsystem.add_dependency(self._provision_vcn)

        self._wait_target.add_dependency(self._launch_dbsystem)
        self._wait_target.add_dependency(self._provision_jumphost)
        # Migration

        self._dump.add_dependency(self._provision_bucket)

        self._load.add_dependency(self._wait_target)
        # load waits for dump internally, because we dont need dump to be finished, just started
        # self._load.add_dependency(self._dump)

        # Post-migration
        self._enable_crash_recovery.add_dependency(self._dump)
        self._enable_crash_recovery.add_dependency(self._load)

        # TODO should always add HA to the plan, but currently its not waiting for child tasks to complete when disabled
        if project.options.targetMySQLOptions.enableHA:
            self._enable_ha.add_dependency(self._enable_crash_recovery)

            self._add_heatwave.add_dependency(self._enable_ha)
        else:
            self._add_heatwave.add_dependency(self._enable_crash_recovery)

        # Replication
        self._check_connectivity.add_dependency(self._launch_dbsystem)

        # Tunnel will be skipped by the stage if not needed
        self._create_tunnel.add_dependency(self._add_heatwave)

        self._create_channel.add_dependency(self._create_tunnel)
        self._create_channel.add_dependency(self._check_connectivity)

        self._watch_channel.add_dependency(self._create_channel)

        #
        self._done.add_dependency(self._create_channel)

        self._root.add_dependency(self._watch_channel)
        self._root.add_dependency(self._done)

    @property
    def migrator_instance_id(self) -> str:
        return self._project.id

    @property
    def oci_config(self):
        import mds_plugin.configuration

        return mds_plugin.configuration.get_current_config()

    @property
    def target_version(self):
        assert self.options.targetMySQLOptions
        return self.options.targetMySQLOptions.mysqlVersion

    @property
    def target_connection_options(self):
        assert self._target_connection_options

        return self._target_connection_options

    @target_connection_options.setter
    def target_connection_options(self, connection_options: dict):
        self._target_connection_options = connection_options

    @property
    def source_connection_options(self) -> dict:
        assert self._project.source_connection_options

        return self._project.source_connection_options

    @property
    def bucket_par(self) -> dict:
        assert self.cloud_resources.bucketPar
        return self.cloud_resources.bucketPar

    @property
    def ssh_key_path(self) -> str:
        return self._project.ssh_key_private

    @property
    def source_info(self) -> model.ServerInfo:
        assert self._project.source_info
        return self._project.source_info

    @property
    def full_storage_path(self) -> str:
        return f"{self.bucket_par["par"]}{self.project.dump_prefix}"

    @property
    def project(self) -> Project:
        return self._project

    @property
    def options(self) -> MigrationOptions:
        return self._project.options

    @property
    def cloud_resources(self) -> CloudResources:
        return self._project.resources

    def connect_remote_helper(self, wait_ready: bool = False) -> RemoteHelperClient:
        # Most of the time, we need to use the public IP of the compute to ssh,
        # but with site-to-site VPN, we need to use whatever IP is reachable
        # from the customer network.
        # A direct hot migration can mean site-to-site VPN or that the source DB
        # is in OCI too, although the migration tool is on-prem.
        if self._project.options.migrationType == model.MigrationType.HOT and self._project.options.cloudConnectivity == model.CloudConnectivity.SITE_TO_SITE:
            assert self.cloud_resources.computePrivateIP
            compute_ip = self.cloud_resources.computePrivateIP
        else:
            assert self.cloud_resources.computePublicIP
            compute_ip = self.cloud_resources.computePublicIP

        logging.info(
            f"Opening ssh connection to opc@{compute_ip}")
        ssh = None
        try:
            i = 0
            while True:
                if self.stopped:
                    logging.info(f"Aborting connect to helper instance")
                    raise errors.Aborted()
                try:
                    ssh = ssh_utils.connect_ssh(
                        user="opc",
                        host=compute_ip,
                        private_key_file_path=self.ssh_key_path)
                    break
                except (TimeoutError, errors.SSHError):
                    if i < 30 and wait_ready:
                        i += 1
                        import time
                        logging.info(
                            f"Connect to helper instance {compute_ip} has timed out, retrying after 10s...")
                        time.sleep(10)
                    else:
                        raise
            logging.debug(f"ssh connected to {compute_ip}")
            return RemoteHelperClient(ssh, token=self.migrator_instance_id)
        except:
            if ssh:
                ssh.close()
            logging.exception(f"Error connecting ssh to {compute_ip}")
            raise

    def connect_source(self) -> dbsession.Session:
        return dbsession.Session(self.source_connection_options)

    def get_compartment(self) -> Compartment:
        assert self.cloud_resources.compartmentId

        if self._compartment and self._compartment.id == self.cloud_resources.compartmentId:
            return self._compartment

        self._compartment = Compartment(config=self.oci_config,
                                        ocid_or_compartment=self.cloud_resources.compartmentId)
        return self._compartment

    def push_progress(self, source: SubStepId, message: str, data: dict = {}):
        self._frontend.on_progress(source, message, data)

    def push_status(self, source: SubStepId, status: WorkStatusEvent, data: dict = {}, message=""):
        self._frontend.on_status(source, status, data, message)

    def push_message(self, source: SubStepId, data: dict):
        self._frontend.on_message(source, data)

    def push_output(self, source: SubStepId, message: str):
        self._frontend.on_output(source, message)

    def _mark_enabled_stages(self):
        seen = set()

        def traverse(stage: Stage):
            if stage in seen:
                return
            seen.add(stage)

            if stage._id != SubStepId.ORCHESTRATION:
                self._project.work_status._stage(
                    stage._id).enabled = stage._enabled

            for s in stage._dependencies:
                traverse(s)

        traverse(self._root)

    def prepare(self):
        logging.info(f"Prepare orchestrator")
        self._mark_enabled_stages()
        self._root._dump()

    def _reset_stages(self):
        seen = set()

        def traverse(stage: Stage):
            if stage in seen:
                return
            seen.add(stage)

            stage.reset()
            if stage._id != SubStepId.ORCHESTRATION:
                stage_info = self._project.work_status._stage(stage._id)
                if stage_info.status != model.WorkStatus.FINISHED:
                    stage_info.status = model.WorkStatus.NOT_STARTED
                stage_info.message = ""
                stage_info.errors.clear()

            for s in stage._dependencies:
                traverse(s)

        traverse(self._root)

    def reset(self):
        logging.info(f"Reset orchestrator")
        self.project.reset_work_status()
        self._reset_stages()
        self._root._dump()

    def start(self):
        assert not self._thread

        self.stopped = False

        def do_work():
            self.push_status(SubStepId.ORCHESTRATION, WorkStatusEvent.BEGIN)
            try:
                self._root.run()
                self.push_status(SubStepId.ORCHESTRATION, WorkStatusEvent.END)
            except Exception as e:
                logging.exception("orchestrator run")
                self.push_status(SubStepId.ORCHESTRATION, WorkStatusEvent.ERROR,
                                 {"error": model.MigrationError._from_exception(e)._json(noclass=False)})

        self._thread = Thread(target=do_work)
        self._thread.start()

    def wait(self):
        assert self._thread
        self._thread.join()

    def stop(self):
        logging.info("🛑 orchestrator stop requested")
        self.stopped = True
        self._root.stop()

    def abort(self):
        self.stop()
        logging.info("Joining orchestrator thread...")
        self.wait()
        self._thread = None
        logging.info("Orchestrator thread joined")

        self._root._dump()

    def cleanup(self):
        pass

    def skip_gtids(self, gtids: str):
        self._watch_channel.skip_gtids(gtids)
