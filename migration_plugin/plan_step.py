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


import copy
import enum
import json
import re
import os
import webbrowser
import threading
from typing import Optional, TypeAlias, cast

from .lib.project import Project
from .lib import errors, logging, oci_utils
from .lib.logging import plugin_log
from .lib.backend import target_config, model
from .lib.dbsession import MigrationSession
from .lib.backend.source_check import MySQLSourceCheck
from .lib.backend.string_utils import unquote_db_object, quote_db_object
from mds_plugin import compartment as mds_compartment
import mysqlsh  # type: ignore
from mysqlsh import mysql  # type: ignore
from mysqlsh.plugin_manager import plugin_function  # type: ignore
from .lib.backend.model import (
    MigrationError,
    MessageLevel,
    MigrationMessage,
    MigrationOptions,
    SubStepId,
    parse,
)

k_oci_signup_url = "https://signup.cloud.oracle.com"

# TODO - check that all changes are only pushed to project.options after commit


def apply_object_changes(base, changes: dict, prefix: str = "") -> list:
    changed_keys = []

    for key, value in changes.items():
        assert hasattr(base, key), key

        current_value = getattr(base, key)
        if isinstance(current_value, dict):
            if current_value != value:
                setattr(base, key, value)
                changed_keys.append(prefix+key)
        elif isinstance(current_value, list):
            if len(current_value) != len(value):
                setattr(base, key, value)
                changed_keys.append(prefix+key)
        elif hasattr(current_value, '__dict__'):  # Object
            changed_keys += apply_object_changes(current_value, value,
                                                 prefix=key+".")
        else:
            if current_value != value:
                setattr(base, key, value)
                changed_keys.append(prefix+key)

    return changed_keys


def format_uri(options: dict) -> str:
    opts = options.copy()
    if "password" in opts:
        del opts["password"]
    return mysqlsh.globals.shell.unparse_uri(opts)


class MigrationStepStatus(enum.StrEnum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    READY_TO_COMMIT = "READY_TO_COMMIT"
    FINISHED = "FINISHED"
    ERROR = "ERROR"


class PlanEvent(enum.StrEnum):
    OCI_PROFILE_CHANGED = "OCI_PROFILE_CHANGED"


class SourceSelectionData(MigrationMessage):
    serverInfo: Optional[model.ServerInfo] = None


class MigrationTypeData(MigrationMessage):
    allowedTypes: list[str]
    allowedConnectivity: list[str]


class MigrationChecksData(MigrationMessage):
    issues: list[model.CheckResult] = []


class PreviewPlanData(MigrationMessage):
    options: model.MigrationOptions
    computeResolutionNotice: str = ""


class TargetOptionsData(MigrationMessage):
    compartmentPath: str = ""
    networkCompartmentPath: str = ""
    allowCreateNewVcn: bool = True


class OCIProfileOptions(MigrationMessage):
    configFile: str = ""
    profile: str = "DEFAULT"


class SourceSelectionOptions(MigrationMessage):
    sourceUri: str = ""
    password: str = ""


class MigrationTypeOptions(MigrationMessage):
    type: model.MigrationType = model.MigrationType.COLD
    connectivity: model.CloudConnectivity = model.CloudConnectivity.NOT_SET


class MigrationChecksOptions(MigrationMessage):
    issueResolution: dict[str, model.CompatibilityFlags]


class TargetOptionsOptions(MigrationMessage):
    hosting: Optional[model.OCIHostingOptions] = None
    database: Optional[model.DBSystemOptions] = None


SubStepData: TypeAlias = SourceSelectionData | MigrationTypeData | MigrationChecksData | TargetOptionsData | PreviewPlanData
SubStepValues: TypeAlias = OCIProfileOptions | SourceSelectionOptions | MigrationTypeOptions | MigrationChecksOptions | TargetOptionsOptions


class MigrationPlanState(MigrationMessage):
    id: SubStepId
    status: MigrationStepStatus
    errors: list[MigrationError]
    data: Optional[SubStepData] = None
    values: Optional[SubStepValues] = None

    def __init__(
        self,
        id: SubStepId,
        status: MigrationStepStatus,
        errors: list[MigrationError],
        data: Optional[SubStepData] = None,
        values: Optional[SubStepValues] = None,
    ) -> None:
        super().__init__()

        self.id = id
        self.status = status
        self.errors = errors
        self.data = data
        self.values = values


class PlanSubStep:
    id: SubStepId
    caption = ""

    _errors: list[MigrationError]
    _started = False
    _done = False

    def __init__(self, owner: "MigrationPlanStep"):
        self._owner = owner
        self._project = owner.project
        self._errors = []

    def __str__(self) -> str:
        return f"<{self.id}:{self.caption}>"

    def on_event(self, event: PlanEvent):
        pass

    def start(self, blocking=True):
        logging.info(f"{self}.start")
        self._started = True

    def apply(self, config: dict) -> bool:
        raise NotImplementedError()

    def is_ready(self) -> bool:
        "True if ready to commit (all required params filled)"
        return True

    def update(self, config: dict) -> MigrationPlanState:
        logging.debug(f"{self}: update")
        self._errors = []
        try:
            if self._started:
                if not self.apply(config):
                    logging.debug(f"{self}: no changes")
                    return self.info()
            else:
                logging.debug(f"{self}: starting")
                self.start()
                logging.debug(f"{self}: started={self._started}")
                if self._started:
                    self.apply(config)
        except Exception as e:
            logging.exception(f"{self}: update")
            self._errors.append(MigrationError._from_exception(e))

        return self.info()

    def will_commit(self) -> bool:
        return self.is_ready()

    def commit(self) -> MigrationPlanState:
        raise NotImplementedError()

    @property
    def current_status(self) -> MigrationStepStatus:
        if self._done:
            return MigrationStepStatus.FINISHED
        if self._started or self._errors:
            if self._errors:
                return MigrationStepStatus.ERROR
            else:
                if self.is_ready():
                    return MigrationStepStatus.READY_TO_COMMIT

                return MigrationStepStatus.IN_PROGRESS
        else:
            return MigrationStepStatus.NOT_STARTED

    def errors(self) -> list[MigrationError]:
        return self._errors

    @property
    def _has_fatal_errors(self) -> bool:
        return len([e for e in self._errors if e.level == MessageLevel.ERROR]) > 0

    def info_values(self) -> Optional[SubStepValues]:
        return None

    def info_data(self) -> Optional[SubStepData]:
        return None

    def info(self) -> MigrationPlanState:
        values = self.info_values()
        data = self.info_data()

        return MigrationPlanState(
            self.id,
            status=self.current_status,
            errors=self.errors(),
            values=values,
            data=data,
        )

    def parse_values(self, config: dict, options_class):
        if "values" not in config:
            raise errors.BadRequest("values field missing")

        try:
            return parse(config["values"], [options_class])
        except Exception as e:
            logging.exception(f"parse error for {config['values']}")
            raise errors.BadRequest(
                f"Invalid value in request: {config['values']}")


class OCIProfileSubStep(PlanSubStep):
    # Must come before OCISetupSubStep
    id = SubStepId.OCI_PROFILE
    caption = "Target Selection"
    _config_exists = False

    def __init__(self, owner: "MigrationPlanStep"):
        super().__init__(owner)
        self._start_mutex = threading.Lock()

        self._compartments = []

    def refresh_oci_config(self):
        if self._project.open_oci_profile():
            try:
                self._config_exists = True
                self._project.check_oci_config()
                logging.info(
                    f"OCI config profile {self._project.oci_profile} at {self._project._oci_config_file} works")
                return True
            except Exception as e:
                logging.exception(
                    f"Error checking OCI configuration/profile")
                self._errors.append(model.MigrationError._from_exception(e))
        else:
            self._config_exists = False
            logging.info(
                f"There's no valid OCI config file at expected locations")

        return False

    def start(self, blocking=True):
        logging.info(f"{self}.start")
        if not self._start_mutex.acquire(blocking=blocking):
            logging.info(f"{self}.start (busy)")
            return
        try:
            # check if there's a profile already
            self.refresh_oci_config()

            self._started = True
        finally:
            self._start_mutex.release()

    def apply(self, config: dict) -> bool:
        # always force an update because external changes (oci profile creation)
        # can affect it
        if "values" not in config:
            return True

        options = self.parse_values(config, OCIProfileOptions)

        changed = False
        if self._config_exists:
            if self._project.oci_config_file != options.configFile and options.configFile:
                raise errors.BadRequest(
                    "changing configFile path not yet supported")

            if self._project.oci_profile != options.profile and options.profile:
                logging.debug(f"{self}: profile changed to {options.profile}")

                self._project.oci_profile = options.profile
                changed = True

        if changed:
            self.refresh_oci_config()
            self._owner.notify(PlanEvent.OCI_PROFILE_CHANGED)

        return changed

    def is_ready(self) -> bool:
        if self._started and not self._has_fatal_errors:
            if self._config_exists:
                return True
            else:
                if self._project.region:
                    return True
        return False

    def commit(self) -> MigrationPlanState:
        self._errors = []
        self._done = True

        return self.info()

    def info_values(self) -> OCIProfileOptions:
        options = OCIProfileOptions()
        options.configFile = self._project.oci_config_file
        options.profile = self._project.oci_profile
        return options


class SourceSelectionSubStep(PlanSubStep):
    "Used internally only by the frontend"
    id = SubStepId.SOURCE_SELECTION
    caption = "Source Database"

    def __init__(self, owner: "MigrationPlanStep"):
        super().__init__(owner)
        self._source_check = MySQLSourceCheck(self._owner.options)
        self._server_info: Optional[model.ServerInfo] = None
        self._replication_issue: Optional[MigrationError] = None

    def check_source(self) -> list[MigrationError]:
        # TODO make check_conn return an Error obj directly or throw one
        res = self._source_check.check_connection()
        if self._source_check.session:
            self._owner.source_session = self._source_check.session

        assert self._owner.options.sourceConnectionOptions
        if res.connectError:
            if res.connectErrno == mysql.ErrorCode.ER_ACCESS_DENIED_ERROR:
                return [MigrationError._from_exception(
                    errors.BadUserInput(res.connectError, input="password"),
                    f"Please enter the password for user '{self._owner.options.sourceConnectionOptions['user']}' at the source database.",
                )]
            else:
                e = MigrationError()
                e.level = MessageLevel.ERROR
                e.message = f"{res.connectError} ({res.connectErrno})"
                e.title = "Could not connect to source MySQL server"
                return [e]

        err, result = self._source_check.check_source()
        self._server_info = result.serverInfo
        self._replication_issue = self._source_check.check_replication(
            self._server_info)
        # TODO include binlog purge period
        if self._replication_issue and self._replication_issue.level == MessageLevel.ERROR:
            self._server_info.replicationStatus = f"Replication Not Possible"
        else:
            self._server_info.replicationStatus = f"Replication Possible (gtid_mode={self._server_info.gtidMode})"
        if self._replication_issue:
            self._replication_issue.info = {"input": "type"}
            self._replication_issue.type = "InvalidParameter"

        return err

    @property
    def replication_issue(self) -> Optional[MigrationError]:
        return self._replication_issue

    def apply(self, config: dict) -> bool:
        if "values" not in config:
            return False

        options = self.parse_values(config, SourceSelectionOptions)
        coptions = {}
        if options.sourceUri:
            try:
                coptions = mysqlsh.globals.shell.parse_uri(options.sourceUri)
            except:
                pass
        else:
            raise errors.BadUserInput(
                "Source database URI is required",
                input="sourceUri",
            )

        if "user" not in coptions or "host" not in coptions:
            raise errors.BadUserInput(
                "Invalid URI format for source database: must be <user>@<host>[:<port>]",
                input="sourceUri",
            )

        # a cold or hot-local-tunnel migration wouldn't need this check
        # if coptions["host"] in ("localhost", "127.0.0.1", "0"):
        #    raise errors.BadUserInput(
        #        "Source database URI must be a real address and not localhost or a loopback.",
        #        input="sourceUri")

        coptions["password"] = options.password
        if coptions != self._owner.options.sourceConnectionOptions:
            logging.devdebug(
                f"{self}: sourceConnectionOptions changed={coptions}",
                f"{self}: sourceConnectionOptions changed",
            )
            self._owner.options.sourceConnectionOptions = coptions
            return True

        return False

    def is_ready(self) -> bool:
        if (
            self._started
            and self._owner.options.sourceConnectionOptions
            and "password" in self._owner.options.sourceConnectionOptions
        ):
            return True
        return False

    def update(self, config: dict) -> MigrationPlanState:
        # TODO notify others when source changes
        return super().update(config)

    def commit(self) -> MigrationPlanState:
        try:
            err = self.check_source()
            if err:
                self._errors.extend(err)
                self._done = False
            else:
                self._done = True
                assert self._server_info
                self._owner.source_info = self._server_info
        except Exception as e:
            logging.exception(f"{self}")
            self._errors.append(MigrationError._from_exception(e))

        return self.info()

    def info_values(self) -> SourceSelectionOptions:
        options = SourceSelectionOptions()
        if self._owner.options.sourceConnectionOptions:
            options.sourceUri = format_uri(
                self._owner.options.sourceConnectionOptions)
        return options

    def info_data(self) -> Optional[SourceSelectionData]:
        data = SourceSelectionData()
        data.serverInfo = self._server_info
        return data


class MigrationTypeSubStep(PlanSubStep):
    id = SubStepId.MIGRATION_TYPE
    caption = "Migration Type"

    def __init__(self, owner: "MigrationPlanStep"):
        super().__init__(owner)
        self._source_check = cast(SourceSelectionSubStep,
                                  owner.steps[SourceSelectionSubStep.id])._source_check
        self._start_mutex = threading.Lock()
        self._checked = False

    @property
    def replication_issue(self) -> Optional[MigrationError]:
        source_step = cast(SourceSelectionSubStep, self._owner.get_step(
            SubStepId.SOURCE_SELECTION))
        return source_step.replication_issue

    @property
    def has_replication(self) -> bool:
        return not self.replication_issue or self.replication_issue.level != model.MessageLevel.ERROR

    def start(self, blocking=True):
        logging.info(f"{self}.start")
        if not self._owner.source_session_ready:
            logging.info(f"{self}.start: session to source DB is not ready")
            return

        if not self._start_mutex.acquire(blocking=blocking):
            logging.info(f"{self}.start (busy)")
            return

        try:
            if self.has_replication:
                self._owner.options.migrationType = model.MigrationType.HOT
                self._owner.options.cloudConnectivity = model.CloudConnectivity.LOCAL_SSH_TUNNEL
            else:
                self._owner.options.migrationType = model.MigrationType.COLD
            self._started = True
        finally:
            self._start_mutex.release()

    def check_selection(self) -> bool:
        self._errors = []
        if self._owner.options.migrationType != model.MigrationType.COLD and self.replication_issue:
            logging.info(
                f"{self}: migrationType {self._owner.options.migrationType} is not possible from this source")

            self._errors.append(self.replication_issue)

            if self.replication_issue.level == model.MessageLevel.ERROR:
                return False

        assert self._owner.options.sourceConnectionOptions
        assert self._owner.options.targetMySQLOptions

        # handle You cannot create a Channel with anonymous source on a high availability DB System.
        if (self._owner.options.migrationType == model.MigrationType.HOT
            and self._owner.source_info.gtidMode != "ON"
                and self._owner.options.targetMySQLOptions.enableHA):
            logging.info(
                f"GTID_MODE of source is {self._owner.source_info.gtidMode} and MDS does not support creating a channel with HA in this case")
            self._errors.append(model.MigrationError._from_exception(
                errors.InvalidParameter(f"""GTID_MODE is disabled or not supported at the source MySQL server.
                                        Replication channels from such MySQL servers to an HA system are not supported
                                        by the service. You must either:
                                        <ul>
                                        <li>enable GTID_MODE at the source and start over;
                                        <li>disable the High Availability option and enable it after migration is over;
                                        or perform a cold migration
                                        </ul>""",
                                        input="type")
            ))
            return False

        # check that the source password complies with the
        # the channel API will refuse to create the channel with status 400
        pwd_issues = target_config.validate_password(
            self._owner.project.source_password, username=self._owner.options.sourceConnectionOptions["user"])
        if self._owner.options.migrationType == model.MigrationType.HOT and pwd_issues:
            sourceUri = format_uri(self._owner.options.sourceConnectionOptions)
            logging.info(
                f"Password for {sourceUri} does not comply with strength requirements")

            # input=type so that the error is displayed next to the migrationType section
            self._errors.append(model.MigrationError._from_exception(
                errors.InvalidParameter(
                    f"""The given password for the source database {sourceUri} does not meet strength requirements for
                    a hot migration: {pwd_issues}
Please change the password for that account or start over using an account with a suitable password.""",
                    input="type")))
            return False

        # DB System can't do inbound replication from localhost
        if (self._owner.options.migrationType == model.MigrationType.HOT
                and self._owner.options.cloudConnectivity == model.CloudConnectivity.SITE_TO_SITE
                and self._owner.options.sourceConnectionOptions.get("host") in ("localhost", "127.0.0.1")):
            self._errors.append(model.MigrationError._from_exception(
                errors.InvalidParameter(f"""The address {self._owner.options.sourceConnectionOptions.get("host")} cannot
                                         be used to perform a hot migration using Site-to-Site VPN. Please start over
                                        using an address that can be reached through the VPN.""",
                                        input="type")))
            return False

        return True

    def apply(self, config: dict) -> bool:
        if "values" not in config:
            return False

        options = self.parse_values(config, MigrationTypeOptions)

        changed = False
        if options.type and self._owner.options.migrationType != options.type:
            self._done = False
            logging.debug(f"{self}: migrationType changed to {options.type}")
            self._owner.options.migrationType = options.type
            changed = True

        if options.connectivity and self._owner.options.cloudConnectivity != options.connectivity:
            self._done = False
            logging.debug(
                f"{self}: cloudConnectivity changed to {options.connectivity}")
            self._owner.options.cloudConnectivity = options.connectivity
            changed = True

        if changed or not self._checked:
            self._checked = True
            if self.check_selection():
                return True

        return False

    def is_ready(self) -> bool:
        options = self._owner.options
        if (
            self._started
            and options.migrationType
            and (options.migrationType == model.MigrationType.COLD or options.cloudConnectivity != model.CloudConnectivity.NOT_SET)
            and self.check_selection()
            and self._owner.steps[SourceSelectionSubStep.id]._done
        ):
            return True
        return False

    def commit(self) -> MigrationPlanState:
        if not self._owner.steps[SourceSelectionSubStep.id]._done:
            logging.error(f"{self}: SourceSelectionSubStep not done yet")
            return self.info()
        try:
            if self.check_selection():
                self._done = True
            else:
                self._done = False
        except Exception as e:
            self._errors.append(MigrationError._from_exception(e))

        return self.info()

    def info_values(self) -> MigrationTypeOptions:
        options = MigrationTypeOptions()
        options.type = self._owner.options.migrationType
        options.connectivity = self._owner.options.cloudConnectivity
        return options

    def info_data(self) -> Optional[MigrationTypeData]:
        data = MigrationTypeData()
        allowed_connectivity = []
        if self.has_replication:
            allowed_types = []
            for t in model.MigrationType:
                allowed_types.append(t.value)
            allowed_connectivity = []
            for t in model.CloudConnectivity:
                allowed_connectivity.append(t.value)
        else:
            allowed_types = [model.MigrationType.COLD.value]

        data.allowedTypes = allowed_types
        data.allowedConnectivity = allowed_connectivity
        return data


class MigrationChecksSubStep(PlanSubStep):
    id = SubStepId.MIGRATION_CHECKS
    caption = "Schema Compatibility Checks"

    class CheckSummary:
        def __init__(self) -> None:
            self.issues: dict[str, model.CheckResult] = {}
            self.status: model.CheckStatus = model.CheckStatus.OK

        def _merge_results(self, results: model.MigrationCheckResults) -> None:
            updated_issues = {
                result.checkId: result for result in results.checks if result.checkId
            }

            for check_id, current_issue in self.issues.items():
                if check_id in updated_issues:
                    updated_issue = updated_issues[check_id]

                    # overwrite these values
                    current_issue.level = updated_issue.level
                    current_issue.status = updated_issue.status

                    # overwrite these, but only if new ones are set
                    if updated_issue.result:
                        current_issue.result = updated_issue.result

                    if updated_issue.objects:
                        current_issue.objects = updated_issue.objects

                    # merge the choices, make sure choices are unique, keep the order
                    current_issue.choices.extend(updated_issue.choices)
                    current_issue.choices = list(
                        dict.fromkeys(current_issue.choices)
                    )

                    # remove updated issue
                    updated_issues.pop(check_id)
                else:
                    # issue is no longer there, object was excluded, mark it as fixed
                    current_issue.level = model.MessageLevel.NOTICE
                    current_issue.status = model.CheckStatus.OK

            # add any new issues
            if updated_issues:
                self.issues.update(updated_issues)

        def _update_status(self) -> None:
            self.status = model.CheckStatus.OK

            for issue in self.issues.values():
                if issue.status > self.status:
                    self.status = issue.status

        def ignore_issues(self, issue_resolution: dict[str, model.CompatibilityFlags]) -> None:
            ignored_checks: list[str] = [
                check_id for check_id, flag in issue_resolution.items() if model.CompatibilityFlags.IGNORE == flag
            ]

            for check_id in ignored_checks:
                issue = self.issues.get(check_id)
                if issue:
                    issue.status = model.CheckStatus.OK

            self._update_status()

        def update(self, results: model.MigrationCheckResults, issue_resolution: dict[str, model.CompatibilityFlags]) -> list[model.CheckResult]:
            self._merge_results(results)
            self.ignore_issues(issue_resolution)

            return [i for i in results.checks if i.level == model.MessageLevel.ERROR]

    def __init__(self, owner: "MigrationPlanStep"):
        super().__init__(owner)
        self._source_check: MySQLSourceCheck = cast(SourceSelectionSubStep,
                                                    owner.steps[SourceSelectionSubStep.id])._source_check
        self._compatibility_check_summary: MigrationChecksSubStep.CheckSummary = MigrationChecksSubStep.CheckSummary()
        self._upgrade_check_summary: MigrationChecksSubStep.CheckSummary = MigrationChecksSubStep.CheckSummary()
        self._start_mutex = threading.Lock()

        data = self._project.plan_step_data(self.id)
        self._issue_resolution: dict[str, model.CompatibilityFlags] = data.get(
            "issueResolution", {})

        self.__execution_errors: list[MigrationError] = []

    def _get_compatibility_flags(self) -> list[model.CompatibilityFlags]:
        result: list[model.CompatibilityFlags] = []

        for flag in self._issue_resolution.values():
            if flag not in (model.CompatibilityFlags.IGNORE, model.CompatibilityFlags.EXCLUDE_OBJECT) \
                    and flag not in result:
                result.append(flag)

        return result

    def _get_filters(self) -> model.MigrationFilters:
        filters = copy.deepcopy(self._owner.options.filters)

        checks_with_excluded_objects: list[str] = [
            check_id for check_id, flag in self._issue_resolution.items() if model.CompatibilityFlags.EXCLUDE_OBJECT == flag
        ]

        for check_id in checks_with_excluded_objects:
            issue = self._compatibility_check_summary.issues.get(check_id)

            if not issue:
                issue = self._upgrade_check_summary.issues.get(check_id)

            if not issue:
                continue

            for object in issue.objects:
                pos = object.find(":")

                if -1 != pos:
                    object_type = object[0:pos].lower()
                    object_name = object[pos + 1:]
                    where = None

                    # select the filter
                    match object_type:
                        case "user":
                            where = "users"
                        case "schema":
                            where = "schemas"
                        case "table" | "view":
                            where = "tables"
                        case "column" | "foreignkey" | "index":
                            # exclude the table instead
                            where = "tables"
                            unquoted = unquote_db_object(object_name)
                            object_name = quote_db_object(
                                unquoted[0], unquoted[1]
                            )
                        case "function" | "procedure" | "routine":
                            where = "routines"
                        case "parameter":
                            # exclude the routine instead
                            where = "routines"
                            unquoted = unquote_db_object(object_name)
                            object_name = quote_db_object(
                                unquoted[0], unquoted[1]
                            )
                        case "event":
                            where = "events"
                        case "trigger":
                            where = "triggers"

                    # make sure object name is properly quoted
                    match object_type:
                        case "user":
                            # we keep this one as-is
                            pass

                        case _:
                            object_name = quote_db_object(
                                *unquote_db_object(object_name)
                            )

                    if where is not None:
                        if getattr(filters, where) is None:
                            setattr(filters, where, model.IncludeList())

                        getattr(filters, where).exclude.append(object_name)
                    else:
                        logging.warning(
                            f"Couldn't match object to be excluded: {object}"
                        )

        # make sure excludes we've added above are unique
        for attr in ["schemas", "tables", "routines", "events", "libraries", "triggers", "users"]:
            il = getattr(filters, attr)

            if il is not None:
                il.exclude = list(set(il.exclude))

        return filters

    def check_compatibility(self) -> Optional[MigrationError]:
        # Return value is error with check itself, actual check issues in member var
        try:
            compatibility_issues = self._source_check.check_compatibility(
                self._get_compatibility_flags(),
                self._get_filters()
            )

            errors = self._compatibility_check_summary.update(
                compatibility_issues, self._issue_resolution
            )

            logging.info(
                f"{self}: compatibility status={self._compatibility_check_summary.status} errors={errors}"
            )
        except Exception as e:
            logging.exception("while running compatibility checks")
            return MigrationError._from_exception(e)

        return None

    def check_upgrade(self) -> Optional[MigrationError]:
        # Return value is error with check itself, actual check issues in member var
        try:
            logging.debug(f"{self}: 📋 running upgrade checks...")

            upgrade_issues = self._source_check.check_upgrade(
                self._get_filters()
            )

            errors = self._upgrade_check_summary.update(
                upgrade_issues, self._issue_resolution
            )

            logging.info(
                f"{self}: upgrade status={self._upgrade_check_summary.status} errors={errors}"
            )
        except Exception as e:
            logging.exception("while running upgrade checks")
            return MigrationError._from_exception(e)

        return None

    def apply(self, config: dict) -> bool:
        def merge_issue_resolution(current: dict, update: dict) -> bool:
            changed = False
            for k, v in update.items():
                if current.get(k) != v:
                    current[k] = v
                    changed = True
            return changed

        # make sure that fatal errors from previous execution are retained
        self._errors = self.__execution_errors.copy()

        if "values" not in config:
            return False

        options: MigrationChecksOptions = self.parse_values(
            config, MigrationChecksOptions
        )

        changed = False

        current_filters = updated_filters = self._get_filters()

        if merge_issue_resolution(self._issue_resolution, options.issueResolution):
            logging.debug(
                f"{self.id}: compatibility fixes changed to {self._issue_resolution}"
            )
            self._project.set_plan_step_data(
                self.id, {"issueResolution": self._issue_resolution})
            changed = True
            updated_filters = self._get_filters()
            self._compatibility_check_summary.ignore_issues(
                self._issue_resolution
            )
            self._upgrade_check_summary.ignore_issues(self._issue_resolution)

        if current_filters != updated_filters:
            logging.debug(
                f"{self.id}: object filters changed to {updated_filters}"
            )
            changed = True

        if changed:
            logging.debug("Issue resolution changed")
            self.run_checks()

        return changed

    def is_ready(self) -> bool:
        ready = False

        if (
            self._started
            and not self._has_fatal_errors
            and self._compatibility_check_summary.status == model.CheckStatus.OK
            and self._upgrade_check_summary.status == model.CheckStatus.OK
        ):
            ready = True

        logging.info(
            f"{self}.is_ready={ready}: started={self._started} nerrors={len(self._errors)} "
            f"has_fatal={self._has_fatal_errors} "
            f"compat={self._compatibility_check_summary.status} "
            f"upgrade={self._upgrade_check_summary.status}"
        )

        return ready

    def start(self, blocking=True):
        logging.info(f"{self}.start")
        if not self._owner.is_finished(SubStepId.SOURCE_SELECTION) or not self._owner.is_finished(SubStepId.TARGET_OPTIONS):
            logging.info(
                f"{self}.start: {' '.join([s.name + '=' + str(self._owner.is_finished(s)) for s in [SubStepId.SOURCE_SELECTION, SubStepId.TARGET_OPTIONS]])}")
            return
        if not self._start_mutex.acquire(blocking=blocking):
            logging.info(f"{self}.start (busy)")
            return
        try:
            self.run_checks()
            self._started = True
        finally:
            self._start_mutex.release()

    def run_checks(self):
        self.__execution_errors = []
        try:
            # TODO only re-run checks for which options changed
            err = self.check_compatibility()
            if not err:
                err = self.check_upgrade()
            if err:
                self.__execution_errors.append(err)
        except Exception as e:
            self.__execution_errors.append(MigrationError._from_exception(e))

        # populate the errors
        self._errors = self.__execution_errors.copy()

    def will_commit(self) -> bool:
        if not self._started:
            return False
        # #=self.run_checks()
        return self.is_ready()

    def commit(self) -> MigrationPlanState:
        self._owner.options.compatibilityFlags = self._get_compatibility_flags()
        self._owner.options.filters = self._get_filters()
        self._done = True
        return self.info()

    def info_values(self) -> MigrationChecksOptions:
        options = MigrationChecksOptions()
        options.issueResolution = self._issue_resolution
        return options

    def info_data(self) -> Optional[MigrationChecksData]:
        issues: list[model.CheckResult] = \
            list(self._compatibility_check_summary.issues.values()) + \
            list(self._upgrade_check_summary.issues.values())

        # put all errors first
        # TODO put errors that have no solution other than EXCLUDE first

        # TODO - put an extra warning/confirmation for auto-excluding objects (in the preview step)
        data = MigrationChecksData()

        order = [l.value for l in MessageLevel]
        issues.sort(key=lambda i: order.index(i.level))

        data.issues = issues
        return data


def sanitize_bucket_name(name: str) -> str:
    # Convert to lowercase
    name = name.lower()
    # Only allow a-z, 0-9, -, .
    name = re.sub(r'[^a-z0-9\-.]', '-', name)
    # Remove consecutive periods or hyphens
    name = re.sub(r'\.\.+', '.', name)
    name = re.sub(r'-+', '-', name)
    # Remove hyphen next to period (replace '-.' or '.-' with '-')
    name = re.sub(r'(\.-)|(-\.)', '-', name)
    # Trim to valid length
    name = name[:63]
    # Remove leading/trailing non-alphanumeric
    name = re.sub(r'^[^a-z0-9]+', '', name)
    name = re.sub(r'[^a-z0-9]+$', '', name)
    # Ensure length is at least 3
    if len(name) < 3:
        name = (name + 'bucket')[:3]
    return name


class TargetOptionsSubStep(PlanSubStep):
    "Used internally only by the frontend"

    id = SubStepId.TARGET_OPTIONS
    caption = "Target Database"

    def __init__(self, owner: "MigrationPlanStep") -> None:
        super().__init__(owner)

        self._override_root_compartment_id = os.getenv(
            "MIGRATION_TEST_ROOT_COMPARTMENT_ID", "")
        if self._override_root_compartment_id:
            logging.info(
                f"MIGRATION_TEST_ROOT_COMPARTMENT_ID set to {self._override_root_compartment_id}")

        self._default_compartment_name = os.getenv(
            "MIGRATION_TEST_DEFAULT_COMPARTMENT_NAME", "")
        if self._default_compartment_name:
            logging.info(
                f"MIGRATION_TEST_DEFAULT_COMPARTMENT_NAME set to {self._default_compartment_name}")

        self._default_networks_compartment_name = os.getenv(
            "MIGRATION_TEST_DEFAULT_NETWORKS_COMPARTMENT_NAME", "")
        if self._default_networks_compartment_name:
            logging.info(
                f"MIGRATION_TEST_DEFAULT_NETWORKS_COMPARTMENT_NAME set to {self._default_networks_compartment_name}")

        self._default_vcn_name = os.getenv(
            "MIGRATION_TEST_DEFAULT_VCN_NAME", "")
        if self._default_vcn_name:
            logging.info(
                f"MIGRATION_TEST_DEFAULT_VCN_NAME set to {self._default_vcn_name}")

        self._start_mutex = threading.Lock()
        self.reset()

    @property
    def compute_resolution_notice(self):
        return self._compute_resolution_notice

    def on_event(self, event: PlanEvent):
        if event == PlanEvent.OCI_PROFILE_CHANGED:
            self.reset()
            self.start()

    def reset(self):
        self._target_check = None
        self._option_errors = []
        self._compute_resolution_notice = ""

    def set_defaults(self) -> bool:
        if not self._owner.oci_config_ready:
            logging.error(f"{self}.set_defaults: oci_config not yet ready")
            raise errors.BadRequest("OCI configuration not yet provided")
        if (
            not self._owner.source_session_ready
            or not self._owner.options.sourceConnectionOptions
        ):
            logging.error(f"{self}.set_defaults: source not yet ready")
            raise errors.BadRequest("Source DB not yet provided")

        if not self._target_check:
            self._target_check = target_config.ConfigureTargetDBSystem(
                self._owner.oci_config, self._owner.project.find_shared_ssh_key, self._owner.source_info,
                override_root_compartment_id=self._override_root_compartment_id,
                default_compartment_name=self._default_compartment_name,
                default_networks_compartment_name=self._default_networks_compartment_name,
                default_vcn_name=self._default_vcn_name
            )

        logging.info(f"{self}.set_defaults: gathering initial OCI options")
        self._owner.options.targetHostingOptions = (
            self._target_check.get_recommended_oci_options()
        )
        self._compute_resolution_notice = self._target_check.compute_resolution_notice

        # ensure bucket name is unique
        self._owner.options.targetHostingOptions.bucketName = sanitize_bucket_name(
            self._owner.project.id)

        logging.info(f"{self}.set_defaults: gathering initial MySQL options")
        self._owner.options.targetMySQLOptions = (
            self._target_check.get_recommended_dbsystem_options(
                self._owner.project, self._owner.options.sourceConnectionOptions
            )
        )

        logging.info(f"{self}.set_defaults: gathering MySQL configuration")
        self._owner.options.mysqlConfiguration = target_config.get_sysvars(
            self._owner.source_session
        )
        self._owner.options.mysqlConfiguration, issues = target_config.adjust_mysql_configuration(
            self._owner.options.mysqlConfiguration
        )
        # TODO: push the config adjustments to the frontend
        logging.info(
            f"{self}.set_defaults: configuration adjustments/issues: {issues}")

        logging.info(f"{self}.set_defaults: done")

        return True

    def start(self, blocking=True):
        logging.info(f"{self}.start")
        if not self._owner.source_session_ready:
            logging.info(f"{self}.start: session to source DB is not ready")
            return

        if not self._start_mutex.acquire(blocking=blocking):
            logging.info(f"{self}.start (busy)")
            return

        try:
            if self.set_defaults():
                self._started = True
        finally:
            self._start_mutex.release()

    def apply(self, config: dict) -> bool:
        if "values" not in config:
            return False

        def is_partial_update(values: dict) -> bool:
            def count_values(values: dict):
                n = 0
                for k, v in values.items():
                    if isinstance(v, dict):
                        n += count_values(v)
                    else:
                        n += 1
                return n
            if count_values(values) <= 1:
                return True
            return False

        partial_update = is_partial_update(config["values"])

        # parse for type validation
        self.parse_values(config, TargetOptionsOptions)
        hosting_changes = apply_object_changes(
            self._owner.options.targetHostingOptions, config["values"].get(
                "hosting", {}),
            "hosting.")

        database_changes = apply_object_changes(
            self._owner.options.targetMySQLOptions, config["values"].get(
                "database", {}),
            "database.")

        logging.debug(
            f"{self}.apply: changes: {database_changes} {hosting_changes}")

        if hosting_changes or database_changes or not partial_update:
            assert self._target_check
            self._done = False

            if not partial_update:
                self._run_checks()
            else:
                self._run_checks(hosting_changes, database_changes)

        return True if hosting_changes or database_changes else False

    def _run_checks(self, hosting_changes: list[str] | None = None, database_changes: list[str] | None = None):
        assert self._target_check

        option_errors = []
        if self._owner.options.targetHostingOptions and (hosting_changes or hosting_changes is None):
            option_errors += self._target_check.validate_target_options(
                self._owner.options.targetHostingOptions, hosting_changes
            )
            self._target_check.resolve_jump_host(
                self._owner.options.targetHostingOptions)
            self._compute_resolution_notice = self._target_check.compute_resolution_notice

        if self._owner.options.targetMySQLOptions and (database_changes or database_changes is None):
            option_errors += self._target_check.validate_target_mysql_options(
                self._owner.options.targetMySQLOptions, database_changes
            )

        # ensure errors for options that weren't changed aren't cleared because they weren't rechecked
        if hosting_changes is None or database_changes is None:
            assert hosting_changes is None and database_changes is None
            self._option_errors = option_errors
        else:
            self._update_option_errors(
                option_errors, hosting_changes + database_changes)

    def _update_option_errors(self, errors: list[MigrationError], changed_options: list[str]):
        def clear_error(option: str):
            cleaned = []
            for err in self._option_errors:
                error_option = err.info.get("input")
                if error_option != option and not (option.endswith(".") and error_option.startswith(option)):
                    cleaned.append(err)
            self._option_errors = cleaned

        # clear old errors from options that changed
        for option in changed_options:
            clear_error(option)

        # detail options of an option that changed
        if "hosting.createVcn" in changed_options:
            for option in ["hosting.networkCompartmentId", "hosting.vcnId", "hosting.privateSubnet.", "hosting.publicSubnet."]:
                clear_error(option)

        # add new errors
        self._option_errors.extend(errors)

    def errors(self, errors_only=False) -> list[MigrationError]:
        if errors_only:
            return [e for e in self._errors + self._option_errors if e.level == MessageLevel.ERROR]
        else:
            return self._errors + self._option_errors

    def is_ready(self) -> bool:
        if (
            self._started
            and self._owner.oci_config_ready
            and not self.errors(errors_only=True)
            and self._owner.options.targetHostingOptions
            and self._owner.options.targetMySQLOptions
        ):
            return True
        return False

    def resolve_ssh_keys(self):
        assert self._owner.options.targetHostingOptions
        # if provisioning a new compute, we can use:
        # - newly generated key
        #   - if user wants to keep the compute, we save the key for later
        # - user specified key (not supported yet)
        # if reusing an old compute:
        # - reuse key saved for later (handled during provisioning)
        # - user specified key (not supported yet)
        if not self._owner.options.targetHostingOptions.computeId and not self._owner.project.resources.computeId:
            # new compute
            logging.info("Generating SSH key pair for new compute")
            self._project.create_ssh_key_pair()
        # else:
            # TODO when handling user specified key, validate it here

    def commit(self) -> MigrationPlanState:
        assert self._target_check

        logging.info(
            f"{self}: commit hosting={self._owner.options.targetHostingOptions}"
        )
        logging.info(
            f"{self}: commit mysql={self._owner.options.targetMySQLOptions}")
        logging.info(
            f"{self}: commit mysql-config={self._owner.options.mysqlConfiguration}")

        if not self.errors(errors_only=True):
            self._done = True
        else:
            logging.info(
                f"{self}.commit: commit failed because errors: {self.errors()}")

        return self.info()

    def info_data(self) -> Optional[TargetOptionsData]:
        data = TargetOptionsData()
        if self._owner.options.targetHostingOptions and self._target_check:
            data.compartmentPath = self._target_check.get_full_compartment_path()
            data.networkCompartmentPath = self._target_check.get_full_network_compartment_path()
            data.allowCreateNewVcn = not self._target_check.default_vcn_exists

        return data

    def info_values(self) -> TargetOptionsOptions:
        options = TargetOptionsOptions()
        assert isinstance(
            self._owner.options.targetHostingOptions, model.OCIHostingOptions
        ), self._owner.options.targetHostingOptions
        options.hosting = (
            self._owner.options.targetHostingOptions or model.OCIHostingOptions()
        )
        assert isinstance(
            self._owner.options.targetMySQLOptions, model.DBSystemOptions
        ), self._owner.options.targetMySQLOptions
        options.database = (
            self._owner.options.targetMySQLOptions or model.DBSystemOptions()
        )
        return options


class PreviewPlanSubStep(PlanSubStep):
    id = SubStepId.PREVIEW_PLAN
    caption = "Preview Migration Plan"
    _done = True

    def info_data(self) -> Optional[PreviewPlanData]:
        data = PreviewPlanData()
        options = self._owner.options._json()
        del options["targetMySQLOptions"]["adminPassword"]
        del options["targetMySQLOptions"]["adminPasswordConfirm"]
        data.options = model.parse(options, [MigrationOptions])
        target = cast(TargetOptionsSubStep,
                      self._owner.get_step(SubStepId.TARGET_OPTIONS))
        data.computeResolutionNotice = target.compute_resolution_notice
        return data

    def is_ready(self) -> bool:
        return True

    def apply(self, config: dict) -> bool:
        return True

    def commit(self) -> MigrationPlanState:
        self._done = True
        return self.info()


class MigrationPlanStep:
    _source_session: Optional[MigrationSession] = None
    _name = "MigrationPlanStep"

    _impl_classes = [
        SourceSelectionSubStep,
        OCIProfileSubStep,
        TargetOptionsSubStep,
        MigrationTypeSubStep,
        MigrationChecksSubStep,
        PreviewPlanSubStep
    ]

    _frontend_classes = [
        OCIProfileSubStep,
        MigrationTypeSubStep,
        MigrationChecksSubStep,
        PreviewPlanSubStep
    ]

    @classmethod
    def get_sub_steps(cls):
        return [{"id": c.id, "caption": c.caption} for c in cls._frontend_classes]

    def __init__(self, project: Project):
        self._mutex = threading.Lock()
        self.project = project

        self.steps: dict[int, PlanSubStep] = {}
        for step_c in self._impl_classes:
            step = step_c(self)
            self.steps[step.id] = step

    def get_step(self, sub_step_id: SubStepId) -> PlanSubStep:
        assert sub_step_id in self.steps
        return self.steps[sub_step_id]

    @property
    def ordered_steps(self) -> list[PlanSubStep]:
        return sorted(self.steps.values(), key=lambda x: x.id.value)

    @property
    def source_session_ready(self) -> bool:
        return True if self._source_session else False

    @property
    def source_session(self) -> MigrationSession:
        assert self._source_session

        return self._source_session

    @source_session.setter
    def source_session(self, session: MigrationSession):
        self._source_session = session

    @property
    def source_info(self) -> model.ServerInfo:
        return self.project.source_info

    @source_info.setter
    def source_info(self, info: model.ServerInfo):
        self.project.source_info = info

    @property
    def options(self) -> MigrationOptions:
        return self.project.options

    @property
    def region(self) -> str:
        return self.project.options.region

    @region.setter
    def region(self, value: str):
        self.project.options.region = value

    @property
    def oci_config_ready(self) -> bool:
        return True if self.project.oci_config else False

    @property
    def oci_config(self):
        assert self.project.oci_config

        return self.project.oci_config

    def notify(self, event: PlanEvent):
        logging.debug(f"Notifying {event}")
        for step in self.steps.values():
            step.on_event(event)

    def update(self, sub_step_id: int, input: dict, nolock: bool = False) -> MigrationPlanState:
        _name = f"{self._name}.update"

        if sub_step_id not in self.steps:
            logging.error(f"{_name}: Invalid input {sub_step_id}")
            raise errors.BadRequest(
                f"{_name}: invalid step id {sub_step_id}")
        step = self.steps[sub_step_id]

        if not nolock:
            logging.info(f"{_name}: acquiring lock")
            self._mutex.acquire()
            logging.debug(f"{_name}: lock acquired")
        try:
            try:
                logging.debug(f"{_name}: update({step})")

                res = step.update(input)
                self.project.save()
            except errors.BadRequest:
                raise
            except Exception as e:
                logging.exception(f"{_name}")

                res = MigrationPlanState(
                    step.id,
                    status=MigrationStepStatus.ERROR,
                    errors=[MigrationError._from_exception(e)],
                )
        finally:
            if not nolock:
                self._mutex.release()

        logging.debug(f"{_name}: result={res}")
        return res

    def update_all(self, input: list[dict]) -> list[MigrationPlanState]:
        _name = f"{self._name}.update"
        steps = []
        for step_in in input:
            if "id" not in step_in or step_in["id"] not in self.steps:
                logging.error(f"{_name}: Invalid input {step_in}")
                raise errors.BadRequest(
                    f"{_name}: invalid step id in {step_in} from frontend"
                )

            steps.append((step_in["id"], step_in))
        if not steps:
            steps = [(s, {}) for s in self.steps.keys()]

        logging.info(f"{_name}: acquiring lock")
        with self._mutex:
            logging.debug(f"{_name}: lock acquired")
            res = []
            for step_id, data in steps:
                res.append(self.update(step_id, data, nolock=True))

        return res

    def commit(self, sub_step_id: SubStepId) -> MigrationPlanState:
        _name = f"{self._name}.commit"

        if sub_step_id not in self.steps:
            logging.error(f"{_name}: Invalid step-id {sub_step_id}")
            raise errors.BadRequest(f"invalid sub-step id={sub_step_id}")

        try:
            logging.info(f"{_name}: acquiring lock")
            with self._mutex:
                logging.debug(f"{_name}: lock acquired")

                step = self.steps[sub_step_id]
                ready = step.will_commit()
                logging.debug(f"{_name}: commit({step}) ready={ready}")

                if not ready:
                    raise errors.BadRequest(
                        f"{step}: sub-step is not ready to be committed"
                    )

                res = step.commit()

                if res.status == MigrationStepStatus.FINISHED:
                    self.project.save()

                    # self.start_dependencies(sub_step_id)

        except errors.BadRequest:
            raise
        except Exception as e:
            logging.exception(f"{_name}")
            res = MigrationPlanState(
                sub_step_id, status=MigrationStepStatus.ERROR, errors=[
                    MigrationError._from_exception(e)]
            )
        logging.debug(f"{_name}: result={res}")

        return res

    def is_finished(self, sub_step_id: SubStepId) -> bool:
        return self.steps[sub_step_id].current_status == MigrationStepStatus.FINISHED

    def start_dependencies(self, sub_step_id: SubStepId):
        # TODO - this has a race condition
        # Start/init steps that depend on the given one
        if sub_step_id == SubStepId.SOURCE_SELECTION:
            def init():
                logging.info(
                    "Pre-initializing dependencies of SOURCE_SELECTION")
                self.steps[SubStepId.MIGRATION_TYPE].start(blocking=False)
                self.steps[SubStepId.MIGRATION_CHECKS].start(blocking=False)
                if self.is_finished(SubStepId.OCI_PROFILE):
                    logging.info(
                        "Pre-initializing dependencies of OCI_PROFILE")
                    self.steps[SubStepId.TARGET_OPTIONS].start(
                        blocking=False)

            thread = threading.Thread(target=init, daemon=True)
            thread.start()

        elif sub_step_id == SubStepId.OCI_PROFILE:
            def init():
                logging.info(
                    "Pre-initializing dependencies of OCI_PROFILE")
                self.steps[SubStepId.TARGET_OPTIONS].start(blocking=False)

            if self.is_finished(SubStepId.SOURCE_SELECTION):
                thread = threading.Thread(target=init, daemon=True)
                thread.start()

    def check_ready(self):
        _name = f"{self._name}.check_ready"
        try:
            logging.info(f"{_name}: acquiring lock")
            with self._mutex:
                logging.debug(f"{_name}: lock acquired")

                ready = True
                for step in self.steps.values():
                    if step.current_status != MigrationStepStatus.FINISHED:
                        logging.warning(
                            f"Step {step} is still in state {step.current_status}")
                        ready = False
                        break
                if not ready:
                    raise errors.BadRequest("Migration plan is not ready")

        except Exception as e:
            logging.exception(f"{_name}")
            raise

    def oci_sign_in(self, force_bootstrap: bool):
        from mds_plugin.bootstrap.mds import bootstrap_migration_profile
        import oci.exceptions

        def report_progress(message: str, info: dict = {}):
            print(json.dumps({"message": message} | {"info": info}))

        if not force_bootstrap and os.path.exists(self.project._oci_config_file):
            self.project.open_oci_profile()
            return

        report_progress("Signing in to OCI...")

        # TODO support for api key passphrase
        # TODO support >1 profile
        # TODO see if its viable to use the session token before switching to api key
        logging.info(
            f"Bootstrapping OCI profile {oci_utils.k_oci_profile_name} at {self.project._oci_config_file} for region={self.region}"
        )
        try:
            profile_info = bootstrap_migration_profile(
                profile_name=oci_utils.k_oci_profile_name,
                config_location=str(self.project._oci_config_file),
                region=self.region,
                passphrase="",
                report_cb=report_progress
            )
        except oci.exceptions.ServiceError as e:
            raise errors.OCIRuntimeError(
                f"Could not bootstrap an OCI find your tenancy in region {self.region}. Please ensure you have selected the correct tenancy and a region you are subscribed to.")

        report_progress(
            f"Authentication completed successfully and an OCI configuration file and profile was created. Please wait a few moments for your new OCI profile to be activated.")
        logging.info(f"Created OCI profile {profile_info}")
        assert profile_info["config_file"] == str(
            self.project._oci_config_file)

        self.region = profile_info["home_region"]

        self.project.open_oci_profile()

        self.project.check_oci_config(
            retry_strategy=oci_utils.ProfilePropagationRetryStrategy()
        )

        # the profile has been bootstrapped, retry on 401 errors, as it takes
        # some time for the OCI to propagate the new API key
        oci_utils.MIGRATION_RETRY_STRATEGY.retry_on_unauthorized_errors()


def get_plan() -> MigrationPlanStep:
    from migration_plugin.lib.migration import get_project
    return get_project().plan_step


k_log_filters = {"logfilters": [{"type": "key", "keys": [
    "password", "adminPassword", "adminPasswordConfirm"]}]}


@plugin_function("migration.planUpdate", shell=True, cli=False,
                 web=k_log_filters)
@plugin_log
def plan_update(configs: list[dict]) -> list[MigrationPlanState]:
    """
    Update migration plan sub-step with user input.
   
    Args:
        configs (list): list of {"id", "values":[]} sub-steps to update
    """
    plan = get_plan()

    res = plan.update_all(configs)
    return [i._json() for i in res]  # type: ignore


@plugin_function("migration.planUpdateSubStep", shell=True, cli=False,
                 web=k_log_filters)
@plugin_log
def plan_update_sub_step(sub_step_id: int, configs: dict) -> MigrationPlanState:
    """
    Fetch and/or update migration plan sub-step with user input.

    Args:
        sub_step_id (int): id of the sub-step to be updated
        configs (dict): sub-step updates to make
    """
    plan = get_plan()

    res = plan.update(sub_step_id, configs)
    return res._json()  # type: ignore


@plugin_function("migration.planCommit", shell=True, cli=False,
                 web=k_log_filters)
@plugin_log
def plan_commit(sub_step_id: int) -> MigrationPlanState:
    """
    Commit changes to the given sub-step and performs checks.
    Call before switching from a sub-step to the next one.

    Args:
        sub_step_id (int): the id of the sub-step to be committed
    """
    plan = get_plan()

    return plan.commit(sub_step_id)._json(noclass=True)  # type: ignore


@plugin_function("migration.ociSignIn", shell=True, cli=False, web=True)
@plugin_log
def oci_sign_in(sign_up: bool = False) -> None:
    """
    Call to Sign In to OCI, create a session and bootstrap a OCI profile.
    If signing-in, region must have been already picked in the OCIProfile
    sub-step.

    Args:
        sign_up (bool): if True, opens browser on OCI sign-up page instead
    """
    if sign_up:
        webbrowser.open_new(k_oci_signup_url)
    else:
        plan = get_plan()

        plan.oci_sign_in(force_bootstrap=False)
