# Copyright (c) 2025, 2026, Oracle and/or its affiliates.
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
from . import model, stage
from ..oci_utils import MIGRATION_RETRY_STRATEGY
from .. import logging, errors, util
from .model import SubStepId, WorkStatusEvent
from .model_utils import build_dump_exclude_list
from .submysqlsh import dump_instance
from .remote_helper import RemoteHelperClient
import json
import urllib.request
import urllib.error
from enum import IntEnum
import time
import os
from oci.retry import ExponentialBackOffWithDecorrelatedJitterRetryStrategy
from oci.retry.retry_checkers import LimitBasedRetryChecker, RetryCheckerContainer


class DumpStatus(IntEnum):
    READY = 1
    STARTING = 3
    SYNCHRONIZING = 4
    DUMPING_SCHEMA = 5
    DUMPING_DATA = 6
    DONE = 7
    ERROR = 10


class LoadStatus(IntEnum):
    READY = 1
    STARTING = 2
    DDL_SCHEMAS = 3
    DDL_TABLES = 4
    DDL_VIEWS = 5
    LOADING_DATA = 6
    DDL_INDEXES = 7
    POST_WORK = 8
    DONE = 9
    ERROR = 10


def fetch_par(par_url: str) -> str | None:
    try:
        with urllib.request.urlopen(par_url, context=util.g_ssl_context) as response:
            return response.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        logging.devdebug(f"Error fetching {par_url}: {e}")
        raise


class DumpStage(stage.ThreadedStage):
    def __init__(self, owner) -> None:
        super().__init__(SubStepId.DUMP, owner, work_fn=self._work_thread)

        self._process = None
        self._status = DumpStatus.READY
        self.returncode = None
        self._last_progress = None
        self._last_error = None
        self._start_time = None

    def stop(self):
        if self._process:
            self._process.terminate()
        super().stop()

    @property
    def done(self):
        return self._status in [DumpStatus.DONE, DumpStatus.ERROR]

    @property
    def time_elapsed(self):
        return int(time.time() - (self._start_time or 0))

    def _on_stdout(self, data: dict):
        if "throughputProgressUpdate" in data:
            progress = data["throughputProgressUpdate"]

            status = model.DumpStatus()
            status.stageCurrent = progress["current"]
            status.stageTotal = progress["total"]
            status.stageEta = progress["etaSeconds"]
            status.stage = self._status.name

            self.push_progress(data=status._json())
            return
        elif "numericProgressUpdate" in data:
            progress = data["numericProgressUpdate"]
            progress["current"]
            if progress["totalKnown"]:
                progress["total"]
            progress["description"]
            return

        for t in ["status", "info", "note", "warning", "error"]:
            if t in data:
                if t not in ("info", "status"):
                    self.push_output(f"{t.upper()}: {data[t]}")
                else:
                    self.push_output(data[t])
                break

        if "exceptionInfo" in data:
            exception = data["exceptionInfo"]["exception"]
            # 52006 code is a generic error reported when an exception in
            # a worker is thrown, don't overwrite it
            if not self._last_error or 52006 != exception["code"]:
                self._last_error = {"error": exception}
        elif "info" in data:
            self.push_progress(data["info"])
            if "Acquiring global read lock" in data["info"]:
                self._status = DumpStatus.SYNCHRONIZING
                logging.info(f"dumper: {self._status}")
            elif "Global read lock has been released" in data["info"]:
                self._status = DumpStatus.DUMPING_SCHEMA
                logging.info(f"dumper: {self._status}")
            # else:
            #    print(">>", data)
        elif "status" in data:
            if "Starting data dump" in data["status"]:
                self._status = DumpStatus.DUMPING_DATA
        else:
            # TODO handle errors
            pass
            #    self._messages.append(data["error"].rstrip())

    def _set_done_status(self, message, data={}):
        self._status = DumpStatus.DONE
        self.push_status(WorkStatusEvent.END, message=message, data=data)

    def _set_error_status(self, message):
        self._status = DumpStatus.ERROR
        self.push_status(WorkStatusEvent.ERROR, message=message)

    def _on_shell_exited(self, rc):
        if rc == 0:
            # TODO include info about how long it took, total bytes dumped and total tables
            self._set_done_status("Source database was exported")
        else:
            if rc < 0:  # exited because of signal: -6 = SIGABORT, -11 = SIGSEGV
                message = f"mysqlsh dump process has exited unexpectedly (exit code={rc})"
            else:
                message = self._last_error or {}
            self._set_error_status(message)
            raise errors.DumpError("Dump operation failed")

    def _should_retry(self) -> bool:
        if not isinstance(self._last_error, dict) or "error" not in self._last_error:
            # we don't have information about dumper's error
            return False

        error = self._last_error["error"]
        error_code = error.get("code", 0)
        error_message = error.get("message", "")

        if not error_code or not error_message:
            # we don't have information about dumper's error
            return False

        if 54 != error_code // 1000:
            # network error codes are 54XYZ where XYZ is an HTTP status code
            return False

        if not MIGRATION_RETRY_STRATEGY.should_retry(error_code % 1000, error_message):
            # global retry strategy does not retry on this error
            return False

        return True

    def _check_usable_dump(self) -> bool | None:
        """
        TODO Check if a dump already exists, it's complete and is recent enough
        to be recoverable through inbound replication.
        Ideally, also check if it's lagging too much behind and whether it's
        OK to just use an old dump from the user, if doing a cold migration.

        If an incomplete dump is detected, it means the dump failed or the
        migration tool was closed before it finished. In that case, we delete
        the dump and have to restart from scratch.

        However, if the load already started it would have to be restarted from
        scratch too.
        We can try cleaning it up and reusing the same DBSystem, but that
        is not perfect because the old data will still be wasting binlog space
        (is it possible to purge binlogs manually?) and GTID_EXECUTED will be
        bloated with garbage GTIDs (is it possible to clear that?)
        The other alternative is to delete the DBSystem (assuming we
        created it) and create a new one.

        Returns:
            - None, no dump was found
            - True, dump was found and is usable/complete
            - False, dump was found but was not usable and was deleted
        """
        assert self._owner.options.targetHostingOptions

        # TODO make it so that if dump is compelte and cold migration, then its reusable

        return False

        data = fetch_par(self._owner.full_storage_path + "/@.json")
        if data:
            bucket = self._owner.options.targetHostingOptions.bucketName

            dump_status = json.loads(data)
            logging.info(
                f"Existing dump found in bucket={bucket} path={self._owner.project.dump_prefix}: server={dump_status.get("server")} gtidExecuted={dump_status.get("gtidExecuted")}")

            # TODO
            # compare GTID_EXECUTED of the dump with the current
            # check if trxs not in the dump are in GTID_PURGED

            data = fetch_par(self._owner.full_storage_path + "/@.done.json")
            if data:
                dump_status = json.loads(data)
                logging.info(
                    f"Existing dump is complete: {dump_status['end']}")
                return True
            else:
                logging.warning(
                    f"Existing dump in bucket={bucket} at {self._owner.project.dump_prefix} is incomplete and thus unusable")
                return False

        return None

    def _delete_partial_dump(self):
        assert self._owner.options.targetHostingOptions

        comp = self._owner.get_compartment()
        bucket = self._owner.options.targetHostingOptions.bucketName

        logging.info(
            f"Deleting existing dump in bucket={bucket} at {self._owner.project.dump_prefix}")

        comp.delete_from_bucket(
            bucket_name=bucket, prefix=self._owner.project.dump_prefix)

        logging.info(
            f"Existing dump at {self._owner.project.dump_prefix} was deleted")

    def _work_thread(self):
        self._start_time = time.time()

        try:
            if not self._initialize_dump():
                return
        except Exception as e:
            logging.exception(
                f"In {self._name} worker thread, during initialization"
            )
            self._set_error_status(f"Failed to initialize dump: {e}")
            raise errors.DumpError("Dump initialization failed")

        checkers = RetryCheckerContainer(
            checkers=[LimitBasedRetryChecker(max_attempts=10)]
        )

        retry_strategy = ExponentialBackOffWithDecorrelatedJitterRetryStrategy(
            base_sleep_time_seconds=1,
            exponent_growth_factor=2,
            max_wait_between_calls_seconds=60,
            checker_container=checkers,
        )

        attempt = 0

        while True:
            self.returncode = -1
            self._process = None
            self._launch()
            assert self._process

            self.returncode = self._process.process()

            if 0 != self.returncode and checkers.should_retry(current_attempt=attempt) and self._should_retry():
                logging.warning("Preparing to retry a failed dump")

                self._status = DumpStatus.STARTING
                self._last_error = None
                self._delete_partial_dump()

                attempt += 1

                retry_strategy.do_sleep(attempt, None)

                logging.debug(f"Retrying a failed dump, retry={attempt}")
            else:
                break

        self._on_shell_exited(self.returncode)

    def _initialize_dump(self) -> bool:
        if self._check_usable_dump():
            self._set_done_status("Short-circuiting completed dump which is usable", {
                "detail": "Found already completed dump"
            })
            return False

        # If load hasn't started already (in a previous run of the tool),
        # we can recover by deleting the partial dump and dumping again
        # If the load has started previously, then we need to clean up the
        # DBSystem.
        stage = self._owner.project.work_status._stage(
            model.SubStepId.LOAD)
        if stage.status == model.WorkStatus.NOT_STARTED:  # load not started
            logging.info(
                f"Load was not yet started, so the DBSystem is presumed to be clean")
        else:  # load already started
            logging.info(
                f"Load had already started on a failed dump, so the DBSystem may have incomplete data. Will continue anyway...")
            # The other alternative would be to re-create the DBSystem or tell the user to restart from scratch
            self._delete_partial_dump()

        return True

    def _launch(self) -> None:
        assert self._owner.options

        extra_args = build_dump_exclude_list(
            self._owner.options.schemaSelection
        )

        ncpu = os.cpu_count()
        if ncpu:
            # TODO pick a better number of threads (from user?)
            # TODO if doing a hot migration, pick lower number of threads
            threads = ncpu
        else:
            threads = 1

        compatibility_flags = [
            flag.value for flag in self._owner.options.compatibilityFlags]

        logging.devdebug(
            f"Dumping to {self._owner.full_storage_path}, compat_flags={compatibility_flags} filter={extra_args}")

        # TODO retry if it fails with 404 on bucket

        self._process = dump_instance(
            self._on_stdout,
            self._owner.source_connection_options,
            storage_prefix=self._owner.full_storage_path,
            storage_args=[],
            compatibility_args=compatibility_flags,
            extra_args=extra_args,
            target_version=self._owner.target_version,
            threads=threads
        )
        self.push_output(" ".join(util.sanitize_par_uri_in_list(self._process.argv)))

    def start(self, parents):
        if self._is_started:
            return False

        super().start(parents)
        if self._is_finished:
            return True
        if not self._enabled:
            logging.info(f"Skipping disabled stage {self._name}")
            return True

        self._start_time = time.time()
        self._status = DumpStatus.STARTING
        self.push_status(WorkStatusEvent.BEGIN,
                         message="Exporting source database")

        return True

    def reset(self):
        if self._is_started and not self._is_finished:
            logging.info(f"{self._name}: deleting unfinished dump")
            self._delete_partial_dump()

            stage_info = self._owner.project._work_status._stage(self._id)
            stage_info.current = 0
            stage_info.total = 0

            self._status = DumpStatus.READY
            self._process = None
        super().reset()

    def update(self) -> bool:
        return self.done


class RemoteLoadStage(stage.ThreadedStage):
    def __init__(self, owner, dump: DumpStage) -> None:
        super().__init__(SubStepId.LOAD, owner, work_fn=self._work_thread)
        self._status = LoadStatus.READY
        self._dumper = dump
        self.returncode = None
        self._last_error: Optional[dict] = None

        # stage and its corresponding weight in the total progress
        self._progress_weights = {
            LoadStatus.DDL_SCHEMAS: 5,
            LoadStatus.DDL_TABLES: 5,
            LoadStatus.DDL_VIEWS: 5,
            LoadStatus.LOADING_DATA: 65,
            LoadStatus.DDL_INDEXES: 20,
        }
        self._current_progress = 0
        self._total_progress = sum(self._progress_weights.values())

    @property
    def done(self):
        return self._status in [LoadStatus.DONE, LoadStatus.ERROR]

    def on_output(self, data: dict):
        logging.devdebug(f"loader message: {data}")

        status = data.get("status")
        if status == "DONE":
            if data["returncode"] == 0:
                self._status = LoadStatus.DONE
                self.push_status(WorkStatusEvent.END,
                                 message="Data load to target DB System completed")
            else:
                logging.error(f"Remote load failed with an error {data}")
                self._status = LoadStatus.ERROR
                self.push_status(WorkStatusEvent.ERROR, self._last_error or {})
                raise errors.LoadError("Load operation failed")
            return
        if "Dump_metadata" in data:
            metadata = data["Dump_metadata"]
            self._owner.project.replication_coordinates = metadata
            return

        if "progress" in data:
            progress = data["progress"]
            # ignore status change if we're already done
            if self._status not in [LoadStatus.DONE, LoadStatus.ERROR]:
                load_stage = progress["stage"]
                if load_stage == "Executing schema DDL":
                    self._status = LoadStatus.DDL_SCHEMAS
                elif load_stage == "Executing table DDL":
                    self._status = LoadStatus.DDL_TABLES
                elif load_stage == "Executing view DDL":
                    self._status = LoadStatus.DDL_VIEWS
                elif load_stage == "Data Import":
                    self._status = LoadStatus.LOADING_DATA
                    progress["totalKnown"] = (
                        self._dumper._status == DumpStatus.DONE)
                elif load_stage == "Building indexes":
                    self._status = LoadStatus.DDL_INDEXES

            current_progress = 0

            for status, weight in self._progress_weights.items():
                if status < self._status:
                    current_progress += weight

            if progress["total"] > 0:
                current_progress += self._progress_weights.get(self._status, 0) * \
                    progress["current"] / progress["total"]

            if current_progress > self._current_progress:
                self._current_progress = current_progress

            status = model.LoadStatus()
            status.stage = progress["stage"]
            status.stageCurrent = self._current_progress
            status.stageTotal = self._total_progress
            # status.stageTotalExact = progress["totalKnown"]
            status.stageEta = progress["eta"]

            self.push_progress(message=status.stage, data=status._json())
            return

        for t in ["status", "info", "note", "warning", "error"]:
            if t in data:
                if t not in ("info", "status"):
                    self.push_output(f"{t.upper()}: {data[t]}")
                else:
                    self.push_output(data[t])
                break

        if "exceptionInfo" in data:
            self._last_error = {"error": data["exceptionInfo"]["exception"]}
        else:
            for level in ["note", "warning", "error"]:
                if level in data:
                    self.push_progress(data[level])
                    break
            # if level == "info":
            #    self.push_progress(data["info"])

    def _work_thread(self):
        assert self._owner.options

        self.push_progress(f"waiting for {self._dumper._name}")
        while self._dumper._status < DumpStatus.DUMPING_DATA:
            # TODO CHECK for error states, abort
            time.sleep(5)
            self.check_stop()
        self.push_progress(f"is now {self._dumper._status.name}")

        if self._dumper._status == DumpStatus.ERROR:
            raise Exception("Dumper has failed")

        self.push_status(WorkStatusEvent.BEGIN,
                         message="Starting data load to DB System")

        # check if load was already performed before
        if self._owner.project.work_status._stage(SubStepId.LOAD).status == model.WorkStatus.FINISHED:
            self._status = LoadStatus.DONE
            self.push_status(WorkStatusEvent.END,
                             message="Data load has already finished before")
            return

        extra_args = []
        extra_args.append("--createInvisiblePKs=1")
        extra_args.append("--dropExistingObjects=1")
        extra_args.append("--ignoreVersion=1")
        extra_args.append("--handleGrantErrors=ignore")

        if self._owner.options.targetMySQLOptions:
            shape = self._owner.options.targetMySQLOptions.shapeName
            ecpu_count = shape.split(".")[-1]
            try:
                max_threads = int(ecpu_count)
            except:
                max_threads = 2  # .Free is 2 ECPU
            logging.info(
                f"{self}: DB shape={shape}, setting max_threads={max_threads}")
        else:
            max_threads = None

        options = {
            "connection_params": self._owner.target_connection_options,
            "storage_prefix": self._owner.full_storage_path,
            "storage_args": [],
            "extra_args": extra_args,
            "max_threads": max_threads
        }

        with self._owner.connect_remote_helper() as helper:
            logging.info(f"{self}: starting remote load...")
            result = helper.load_dump(options)
            logging.info(
                f"remote load started: {result['status']}, tracking status...")
            helper.load_status(self.on_output)
            logging.info(f"{self}: remote load ended")

            self.update_gtid_purged(helper)
            logging.info(f"{self}: updated gtid_purged")

    def update_gtid_purged(self, helper: RemoteHelperClient):
        coords = self._owner.project.replication_coordinates
        assert coords

        gtid_executed = coords["Executed_GTID_set"]
        logging.info(
            f"gtidExecuted in load is {gtid_executed}, updating target...")
        try:
            helper.target_run_sql(
                "call sys.set_gtid_purged(concat('+', gtid_subtract(?, @@gtid_purged)))", [
                    gtid_executed],
                connect_options=self._owner.target_connection_options)
        except:
            logging.exception(f"Error calling set_gtid_purged")
            raise
        logging.info(f"GTID_PURGED updated in target")

    def start(self, parents):
        if self._is_started:
            return False

        if not super().start(parents):
            return False

        if not self._enabled:
            logging.info(f"Skipping disabled stage {self._name}")
            return False
        self._status = LoadStatus.STARTING

        return True

    #
    # def reset(self):
    #     if self._is_started and not self._is_finished:
    #         logging.info(f"{self._name}: deleting load progress file")
    #     super().reset()

    def cleanup(self):
        super().cleanup()
        # TODO delete progress?
