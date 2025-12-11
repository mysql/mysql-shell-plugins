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


from typing import Optional

from .lib.project import Project
from .lib.backend.stage import WorkStatusEvent
from .lib.backend import orchestration
from . import plan_step
from .lib import logging
from .lib.backend.model import SubStepId, WorkStatusInfo, WorkStatus, LogInfo
from .lib.backend.orchestration import Orchestrator
from .lib.logging import plugin_log
from mysqlsh.plugin_manager import plugin_function  # type: ignore

k_stage_info = {
    SubStepId.PROVISION_COMPARTMENT: {
        "caption": "Compartment",
        "type": "",
        "help": "Provision or verify the OCI compartment where the MySQL DB System and other resources will be placed.",
    },
    SubStepId.PROVISION_BUCKET: {
        "caption": "Object Storage",
        "type": "",
        "help": "Create a bucket in OCI Object Storage for temporary storage of exported data used for migration.",
    },
    SubStepId.PROVISION_VCN: {

        "caption": "Virtual Cloud Network",
        "type": "",
        "help": "Provision or verify virtual cloud network (VCN) with a private and public subnets.",
    },
    SubStepId.PROVISION_COMPUTE: {
        "caption": "Compute",
        "type": "progress",
        "help": "Provision a compute instance to be used as a jump host and execute remote operations from within OCI.",
    },
    SubStepId.PROVISION_HELPER: {
        "caption": "Prepare Jump Host",
        "type": "",
        "help": "Install MySQL Shell and other components for importing your database and other remote operations in OCI.",
    },
    SubStepId.PROVISION_DBSYSTEM: {
        "caption": "MySQL DB System",
        "type": "progress",
        "help": "Launch your new MySQL HeatWave DB System in OCI. This may take about 15 minutes to complete.",
    },
    SubStepId.DUMP: {
        "caption": "Export",
        "type": "progress-precise",
        "help": "Export a snapshot of the schema and data from the source database to the Object Storage bucket.",
    },
    SubStepId.CONNECT_DBSYSTEM: {  # TODO merge this with LOAD
        "caption": "Connect to DB System",
        "type": "",
        "help": "Check whether the DB System can accept connections from the jump host.",
    },
    SubStepId.LOAD: {
        "caption": "Import",
        "type": "progress-precise",
        "help": "Import the database snapshot into the target DB System.",
    },
    SubStepId.ENABLE_CRASH_RECOVERY: {
        "caption": "Enable Crash Recovery",
        "type": "",  # apparently there's a bug in work request tracking for these
        "help": "Re-enable temporarily disabled crash recovery.",
    },
    SubStepId.ENABLE_HA: {
        "caption": "Enable High Availability",
        "type": "progress",
        "help": "Enable High Availability of the target DB System. This may take 10 to 30 minutes to complete.",
    },
    SubStepId.CHECK_DIRECT_NETWORK: {
        "caption": "Check Connectivity",
        "type": "",
        "help": "Check network connectivity from OCI to your on-premises source database, necessary to keep the target DB System updated using inbound replication.",
    },
    SubStepId.CREATE_SSH_TUNNEL: {
        "caption": "Setup SSH Tunnel",
        "type": "ssh-tunnel",
        "help": "Launch a SSH tunnel to enable MySQL replication connections from the target DB System to your source database.",
    },
    SubStepId.CREATE_CHANNEL: {
        "caption": "Start Replication",
        "type": "",
        "help": "Create a MySQL replication channel from the target DB System to your source MySQL instance, replicating new transactions applied to your source database at the target.",
    },
    SubStepId.PROVISION_HEATWAVE_CLUSTER: {
        "caption": "HeatWave Cluster",
        "type": "progress",
        "help": "Add a HeatWave Cluster to the MySQL DB System and wait for it to become active.",
    },
    SubStepId.CONGRATS: {
        "caption": "Database Ready",
        "type": "congrats",
        "help": "",
    },
    SubStepId.MONITOR_CHANNEL: {
        "caption": "Monitor Replication Progress",
        "type": "monitor_channel",
        "help": "Monitor the MySQL replication channel until your applications are switched over.",
    },
    SubStepId.CLEANUP: {
        "caption": "Cleanup",
        "type": "",
        "help": "Delete temporary OCI resources.",
    },
    # SubStepId.FINAL_SUMMARY: {
    #     "caption": "Summary Report",
    #     "type": "",
    #     "help": "Review summary of migration process and final notes.",
    # }
}

k_provision_tasks = [
    SubStepId.PROVISION_COMPARTMENT,
    SubStepId.PROVISION_BUCKET,
    SubStepId.PROVISION_VCN,
    SubStepId.PROVISION_COMPUTE,
    SubStepId.PROVISION_HELPER,
    SubStepId.PROVISION_DBSYSTEM,
    SubStepId.PROVISION_HEATWAVE_CLUSTER,
]

k_migrate_tasks = [
    SubStepId.DUMP,
    SubStepId.CONNECT_DBSYSTEM,
    SubStepId.LOAD,
    SubStepId.ENABLE_CRASH_RECOVERY,
    SubStepId.ENABLE_HA,
]

k_sync_tasks = [
    SubStepId.CREATE_SSH_TUNNEL,
    SubStepId.CHECK_DIRECT_NETWORK,
    SubStepId.CREATE_CHANNEL,
]

k_final_tasks = [
    SubStepId.MONITOR_CHANNEL,
    SubStepId.CONGRATS,
    # SubStepId.CLEANUP,
    # SubStepId.FINAL_SUMMARY
]

# assert len(k_provision_tasks+k_migrate_tasks +
#            k_sync_tasks+k_final_tasks) == len(k_stage_info)


class MigrationWorkStep(orchestration.MigrationFrontend):
    migrator: Optional[Orchestrator] = None

    def __init__(self, project: Project) -> None:
        self.project = project

        self._init_work_status(project._work_status)

    @classmethod
    def get_sub_steps(cls, step_id: int) -> list[dict]:
        if step_id == 2000:
            tasks = k_provision_tasks
        elif step_id == 3000:
            tasks = k_migrate_tasks
        elif step_id == 4000:
            tasks = k_sync_tasks
        elif step_id == 5000:
            tasks = k_final_tasks
        else:
            raise ValueError("bad step_id")

        steps = []
        for task in tasks:
            steps.append(k_stage_info[task] | {"id": task.value})

        return steps

    def _init_work_status(self, info: WorkStatusInfo):
        info._stage(SubStepId.DUMP).current = 0
        info._stage(SubStepId.DUMP).total = 0
        info._stage(SubStepId.DUMP).eta = 0
        info._stage(SubStepId.DUMP).message = "Waiting..."

        info._stage(SubStepId.LOAD).current = 0
        info._stage(SubStepId.LOAD).total = 0
        info._stage(SubStepId.LOAD).eta = 0
        info._stage(SubStepId.LOAD).message = "Waiting..."

        info.status = WorkStatus.NOT_STARTED

    def prepare(self):
        if not self.migrator:
            self.migrator = Orchestrator(frontend=self, project=self.project)
            self.migrator.prepare()
        else:
            self.migrator.reset()

    def status(self) -> WorkStatus:
        return self.project.work_status.status

    def start(self):
        assert self.migrator

        # TODO add support for resume/restart on error
        # status = self.project.work_status.status
        # if status in [WorkStatus.ERROR, WorkStatus.IN_PROGRESS]:
        #     logging.info(f"{self}: resetting from status={status}")
        #     status = WorkStatus.NOT_STARTED

        # if status != WorkStatus.NOT_STARTED:
        #     logging.info(
        #         f"{self}: ignoring start() while status={status}")
        #     return

        logging.info(
            f"🟢 starting work from state {self.status()}. options={self.project.options}")

        self.migrator.start()

    def abort(self):
        status = self.project.work_status.status
        if status != WorkStatus.IN_PROGRESS:
            logging.info(
                f"{self}: ignoring abort() while status={status}")
            return
        logging.info(f"✋ aborting work")
        if self.migrator:
            self.migrator.abort()

    def on_progress(self, source: SubStepId, message: str, data: dict = {}):
        logging.debug(f"⚙️ progress {source.name} {message} {data}")
        self.project.log_work_progress(source, message, data)

    def on_status(self, source: SubStepId, status: WorkStatusEvent, data: dict = {}, message: str = ""):
        logging.debug(f"🚦 status {source.name} {status} {message} {data}")
        self.project.log_work(source, status, data=data, message=message)

    def on_message(self, source: SubStepId, data: dict):
        logging.debug(f"✉️ message {source.name} {data}")

    def on_output(self, source: SubStepId, message: str):
        self.project.log_work_output(source, message=message)

    def fetch_status(self) -> WorkStatusInfo:
        return self.project.snapshot_status()

    def fetch_logs(self, source: SubStepId, offset: int) -> tuple[str, int]:
        return self.project.fetch_logs(source, offset)

    @property
    def done(self) -> bool:
        status = self.project.work_status.status
        return status in (WorkStatus.FINISHED, WorkStatus.ABORTED, WorkStatus.ERROR)

    def skip_gtids(self, gtids: str):
        assert self.migrator
        self.migrator.skip_gtids(gtids)

    def cleanup(self, delete_bucket: bool, delete_jump_host: bool):
        assert self.migrator

        logging.info(
            f"Clean up: bucket={delete_bucket}, jump-host={delete_jump_host}")
        compartment = self.migrator.get_compartment()
        if delete_bucket and self.project.resources.bucketCreated:
            logging.info(
                f"Deleting bucket {self.project.resources.bucketName} and all its contents")
            compartment.wipe_bucket(
                bucket_name=self.project.resources.bucketName)
            logging.info(
                f"Bucket {self.project.resources.bucketName} deleted")
            self.project.resources.bucketCreated = False
            self.project.resources.bucketName = ""
            self.project.resources.bucketNamespace = ""
            self.project.resources.bucketPar = None

        if delete_jump_host and self.project.resources.computeCreated:
            logging.info(
                f"Deleting compute instance {self.project.resources.computeId} ({self.project.resources.computeName})")
            compartment.delete_instance(self.project.resources.computeId)
            logging.info(
                f"Deleted instance {self.project.resources.computeId}")
            self.project.delete_ssh_key_pair()

            self.project.resources.computeCreated = False
            self.project.resources.computeId = ""
            self.project.resources.computeName = ""
            self.project.resources.computePrivateIP = ""
            self.project.resources.computePublicIP = ""


def get_step() -> MigrationWorkStep:
    from migration_plugin.lib.migration import get_project
    return get_project().work_step


@plugin_function("migration.workStart", shell=True, cli=False, web=True)
@plugin_log
def work_start() -> WorkStatusInfo:
    """
    Starts the work step
    """

    work = get_step()
    match work.status():
        case [WorkStatus.IN_PROGRESS, WorkStatus.FINISHED]:
            logging.info(
                f"work_start: ignoring call while in {work.status()} status")
            return

        case [WorkStatus.ERROR, WorkStatus.ABORTED]:
            logging.info(f"work_start: retrying from {work.status()} status")

        case [WorkStatus.NOT_STARTED]:
            # check if the migration plan is finished
            plan = plan_step.get_plan()
            plan.check_ready()

    work.prepare()

    initial_status = work.fetch_status()
    work.start()

    # TODO: fix wrapper
    return initial_status._json()  # type: ignore


@plugin_function("migration.workAbort", shell=True, cli=False, web=True)
@plugin_log
def work_abort() -> None:
    """
    Aborts the work step
    """
    work = get_step()

    work.abort()


@plugin_function("migration.workClean", shell=True, cli=False, web=True)
@plugin_log
def work_cleanup(options: dict) -> None:
    """
    Deletes OCI resources created for the migration.

    Args:
        options (dict): specifies the resources to be deleted
    """
    work = get_step()

    work.cleanup(delete_bucket=options.get("delete_bucket", False),
                 delete_jump_host=options.get("delete_jump_host", False))


@plugin_function("migration.workStatus", shell=True, cli=False, web=True)
# Note: too spammy to log all calls @plugin_log
# @plugin_log
def work_status() -> WorkStatusInfo:
    """
    Retrieves the status of the work step
    """
    work = get_step()

    # TODO: fix wrapper
    return work.fetch_status()._json(noclass=True)  # type: ignore


@plugin_function("migration.workRetry", shell=True, cli=False, web=True)
@plugin_log
def work_retry() -> None:
    """
    Retries the work step
    """
    work = get_step()


@plugin_function("migration.skipTransactions", shell=True, cli=False, web=True)
@plugin_log
def skip_transactions(gtids: str) -> None:
    """
    Skips transactions on the work step

    Args:
        gtids (str): the GTID to skip
    """
    work = get_step()

    work.skip_gtids(gtids)


@plugin_function("migration.fetchLogs", shell=True, cli=False, web=True)
def fetch_logs(sub_step_id: Optional[int] = None, offset: int = 0) -> LogInfo:
    """
    Fetch logs for the given step or the log file.

    Args:
        sub_step_id (int): the step for which to fetch logs or None to fetch mysqlsh.log
        offset (int): offset for the 1st entry to fetch

    Returns: LogInfo object with the log data and offset to use to fetch later entries
    """
    work = get_step()

    import mysqlsh

    def read_logs(offset: int) -> tuple[str, int]:
        with open(mysqlsh.globals.shell.options.logFile) as f:
            f.seek(offset)
            data = f.read()
            return data, f.tell()

    if sub_step_id is None:
        try:
            data, last_offset = read_logs(offset)
        except:
            logging.exception(
                f"Could not read log file {mysqlsh.globals.shell.options.logFile}")
            data, last_offset = "", 0
    else:
        data, last_offset = work.fetch_logs(SubStepId(sub_step_id), offset)

    return LogInfo(data, last_offset)._json(noclass=True)  # type: ignore


def analyze_network_paths() -> None:
    # TODO
    """
    Run network path analyzer between:
        - dbsystem -> source
        - dbsystem -> internet/OCI services (object storage via PAR)
        - jump host -> dbsystem
        - tool -> jump host
        - tool -> source
        - tool -> dbsystem
    """
    pass
