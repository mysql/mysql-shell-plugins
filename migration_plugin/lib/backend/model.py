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

from enum import StrEnum, IntEnum
import enum
from typing import Optional, Any
import json
import inspect
from dataclasses import dataclass, field
from copy import deepcopy

from ..util import sanitize_dict_any_pass
from .. import logging, errors


def parse(data: dict, message_classes: list = []):
    if not message_classes:
        allowed_classes = k_message_classes
    else:
        allowed_classes = dict([(c.__name__, c) for c in message_classes])
    try:
        if "_class" in data:
            class_name = data["_class"]
            if class_name not in allowed_classes:
                raise Exception(f"Invalid class {class_name} in message")
            obj = allowed_classes[class_name]()
        else:
            assert message_classes, f"message_classes=[] {data}"
            obj = message_classes[0]()

        obj._parse(data)

        return obj
    except:
        logging.error(f"Error parsing {data}")
        raise


def _get_field_type(obj, field: str) -> tuple[type | None, list[type]]:
    from typing import get_origin, get_type_hints, Union, get_args
    from types import UnionType

    def _get_annotations(c, field: str) -> tuple[type | None, list[type]]:
        ann = get_type_hints(c)

        assert field in ann, f"no annotation for field '{field}' of {obj.__class__} "

        t = ann[field]
        if inspect.isclass(t):
            return None, [t]

        origin = get_origin(t)

        if origin is list:
            return list, [t.__args__[0]]
        if origin in (Union, UnionType):
            return None, list(get_args(t))
        if origin is dict:
            return dict, t.__args__

        assert t in (str, int), f"{field} type={t} origin={origin}"
        return None, [t]

    return _get_annotations(obj.__class__, field)


class MigrationMessage(object):
    def _parse(self, j: dict):
        for k, v in j.items():
            if not k.startswith("_"):
                try:
                    self._parse_one(k, v)
                except Exception as e:
                    raise

    def _parse_one(self, field: str, value: Any):
        from typing import get_origin, Union, get_args
        from types import UnionType

        def parse_simple_type(value, expected_types: list[type]):
            if value is None:
                assert any([isinstance(value, t) for t in expected_types]
                           ), f"{field} types={expected_types} value={value}"
                return None

            if isinstance(value, dict) and "_class" in value:
                if value["_class"] not in [t.__name__ for t in expected_types]:
                    raise Exception(
                        f"Message contains invalid value for '{field}' _class={value["_class"]} but expected={expected_types})")

                o = parse(value, expected_types)
                assert any([isinstance(o, t) for t in expected_types]
                           ), f"{field} type={type(o)} types={expected_types}"
                return o
            else:
                # if _class is not in the object being parsed, then polymorphism is not allowed
                not_none_types = [
                    t for t in expected_types if t is not type(None)]
                assert len(
                    not_none_types) <= 1, f"{field} too many expected types={not_none_types}"
                if not_none_types:
                    expected_type = not_none_types[0]
                    if inspect.isclass(expected_type) and issubclass(
                        expected_type, MigrationMessage
                    ):
                        o = parse(value, [expected_type])
                        if not isinstance(o, expected_type):
                            raise Exception(
                                f"Message contains invalid value for '{field}' ({expected_type} expected but is {o.__class__.__name__})"
                            )
                        return o
                    else:
                        assert callable(expected_type), expected_type

                        return expected_type(value)
                else:
                    raise Exception(
                        f"Message contains invalid value for '{field}' (only None allowed but value is {value})"
                    )

        container_type, expected_types = _get_field_type(self, field)
        parsed = None
        if container_type is list:
            parsed = []
            for v in value:
                parsed.append(parse_simple_type(v, expected_types))
        elif container_type is dict:
            # typed dict is here, untyped dict is handled as regular type
            assert isinstance(expected_types, tuple) and len(
                expected_types) == 2, expected_types
            key_type = expected_types[0]
            value_type = expected_types[1]
            parsed = {}
            for k, v in value.items():
                parsed_key = parse_simple_type(k, [key_type])

                origin = get_origin(value_type)
                if origin in (Union, UnionType):
                    parsed_value = parse_simple_type(
                        v, list(get_args(value_type)))
                else:
                    parsed_value = parse_simple_type(v, [value_type])

                parsed[parsed_key] = parsed_value
        else:
            parsed = parse_simple_type(value, expected_types)

        setattr(self, field, parsed)

    def __getitem__(self, key: str):
        return getattr(self, key)

    def _json(self, noclass=True) -> dict:
        def to_json(value):
            if isinstance(value, MigrationMessage):
                return value._json(noclass=noclass)
            elif isinstance(value, StrEnum):
                return value.value
            elif isinstance(value, IntEnum):
                return value.value
            elif isinstance(value, list):
                return [to_json(v) for v in value]
            elif isinstance(value, dict):
                return dict([(to_json(k), to_json(v)) for k, v in value.items()])
            elif callable(value):
                assert (
                    0
                ), f"{value} found in MigrationMessage... non-data members must begin with _"
            else:
                return value

        if noclass:
            j = {}
        else:
            j = {"_class": self.__class__.__name__}
        for k in dir(self):
            if not k.startswith("_"):
                value = getattr(self, k)
                j[to_json(k)] = to_json(value)
        return j

    def __str__(self) -> str:
        return json.dumps(sanitize_dict_any_pass(self._json()))


class MigrationType(StrEnum):
    COLD = "cold"
    HOT = "hot"


class CloudConnectivity(StrEnum):
    """
    SITE_TO_SITE
    DBSystem ---> source DB

    TUNNEL
    DBSystem -> jump host -> source DB
                        ^--ssh--/

    LOCAL_TUNNEL
    DBSystem -> jump host -> local -> source DB
                                ^--ssh--/
    """

    # no connectivity, used with MigrationType.COLD
    NOT_SET = ""
    # tool -> jump host/source/dbsystem, dbsystem -> source
    SITE_TO_SITE = "site-to-site"
    # tool -> jump host/source, dbsystem -> jump host, user ssh tunnel
    SSH_TUNNEL = "ssh-tunnel"
    # tool -> jump host/source, dbsystem -> jump host, built-in ssh tunnel
    LOCAL_SSH_TUNNEL = "local-ssh-tunnel"
    # tool -> jump host, jump host -> source/dbsystem, dbsystem -> source
    # SAME_CLOUD = "same-cloud"


class ServerType(StrEnum):
    MySQL = "mysql"
    HeatWave = "heatwave"

    MariaDB = "mariadb"
    Percona = "percona"
    RDS = "rds"
    Aurora = "aurora"
    OtherMySQL = "other"


@dataclass
class IncludeList(MigrationMessage):
    include: list[str] = field(default_factory=list)
    exclude: list[str] = field(default_factory=list)

    def __str__(self):
        return f"{{include={self.include}, exclude={self.exclude}}}"


@dataclass
class TargetHostingOptions(MigrationMessage):
    pass


@dataclass
class OCISubnetOptions(MigrationMessage):
    id: str = ""
    name: str = ""
    cidrBlock: str = ""
    dnsLabel: str = ""


@dataclass
class OCIHostingOptions(TargetHostingOptions):

    # main compartment where DBSystem and compute will be located
    parentCompartmentId: str = ""  # defaults to root
    compartmentId: str = ""  # if pre-existing
    compartmentName: str = "MySQL"

    createVcn: bool = False
    networkParentCompartmentId: str = ""  # defaults to same as parentCompartmentId
    networkCompartmentId: str = ""
    networkCompartmentName: str = "Network"
    vcnId: str = ""  # if pre-existing
    vcnName: str = ""
    vcnCidrBlock: str = ""
    internetGatewayName: str = ""
    serviceGatewayName: str = ""

    privateSubnet: OCISubnetOptions = field(default_factory=OCISubnetOptions)
    publicSubnet: OCISubnetOptions = field(default_factory=OCISubnetOptions)

    # to filter traffic to the jump-host
    onPremisePublicCidrBlock: str = ""

    computeId: str = ""  # if pre-existing
    computeName: str = ""
    availabilityDomain: str = ""  # optional
    shapeName: str = ""
    cpuCount: int = 1
    memorySizeGB: int = 16

    # sshPrivateKeyPath: str = ""  # if compute exists
    # sshPrivateKeyPassword: str = ""  # if compute exists

    bucketName: str = "migrated-data"

# For created/resolved resources


@dataclass
class CloudResources(MigrationMessage):
    compartmentId: str = ""
    compartmentName: str = ""
    networkCompartmentName: str = ""
    networkCompartmentId: str = ""

    vcnId: str = ""
    internetGatewayCidr: str = ""
    serviceGatewayCidr: str = ""

    computeId: str = ""
    computeName: str = ""
    computePublicIP: str = ""
    computePrivateIP: str = ""
    computeCreated: bool = False

    dbSystemId: str = ""
    dbSystemIP: str = ""
    dbSystemVersion: str = ""
    dbSystemCreated: bool = False
    channelId: str = ""

    bucketNamespace: str = ""
    bucketName: str = ""
    bucketCreated: bool = False
    bucketPar: Optional[dict] = None

    channelId: str = ""

    heatWaveClusterCreated: bool = False
    haEnabled: bool = False


@dataclass
class TargetMySQLOptions(MigrationMessage):
    adminUsername: str = ""
    adminPassword: str = ""
    adminPasswordConfirm: str = ""
    mysqlVersion: str = ""


@dataclass
class DBSystemOptions(TargetMySQLOptions):
    dbSystemId: str = ""

    name: str = ""
    description: str = ""
    contactEmails: str = ""

    hostnameLabel: str = ""

    availabilityDomain: str = ""
    faultDomain: str = ""  # optional (recommended if HA)

    enableHA: bool = False
    enableRestService: bool = False
    enableBackup: bool = False

    enableHeatWave: bool = False  # also controls lakehouse
    heatWaveShapeName: str = ""
    heatWaveClusterSize: int = 1

    shapeName: str = ""

    storageSizeGB: int = 0
    autoExpandStorage: bool = False
    autoExpandMaximumSizeGB: int = 0


@dataclass
class TargetSandboxOptions(TargetMySQLOptions):
    port: int = 3306


class CompatibilityFlags(StrEnum):
    create_invisible_pks = "create_invisible_pks"
    force_innodb = "force_innodb"
    force_non_standard_fks = "force_non_standard_fks"
    ignore_missing_pks = "ignore_missing_pks"
    ignore_wildcard_grants = "ignore_wildcard_grants"
    lock_invalid_accounts = "lock_invalid_accounts"
    skip_invalid_accounts = "skip_invalid_accounts"
    strip_definers = "strip_definers"
    strip_invalid_grants = "strip_invalid_grants"
    strip_restricted_grants = "strip_restricted_grants"
    strip_tablespaces = "strip_tablespaces"
    target_has_mysql_native_password = "target_has_mysql_native_password"
    unescape_wildcard_grants = "unescape_wildcard_grants"

    IGNORE = "IGNORE"
    EXCLUDE_OBJECT = "EXCLUDE_OBJECT"


@dataclass
class MigrationFilters(MigrationMessage):
    # Note: All object names must be quoted and fully qualified
    # additionally, only exclude lists are supported atm
    users: IncludeList = field(default_factory=IncludeList)
    schemas: IncludeList= field(default_factory=IncludeList)
    tables: IncludeList= field(default_factory=IncludeList)
    views: IncludeList= field(default_factory=IncludeList)
    routines: IncludeList= field(default_factory=IncludeList)
    events: IncludeList= field(default_factory=IncludeList)
    libraries: IncludeList= field(default_factory=IncludeList)
    triggers: IncludeList= field(default_factory=IncludeList)


@dataclass
class SchemaSelectionOptions(MigrationMessage):
    filter: MigrationFilters = field(default_factory=MigrationFilters)
    migrateSchema: bool = True
    migrateData: bool = True
    migrateRoutines: bool = True
    migrateTriggers: bool = True
    migrateEvents: bool = True
    migrateLibraries: bool = True
    migrateUsers: bool = True

@dataclass
class MigrationOptions(MigrationMessage):
    sourceConnectionOptions: Optional[dict] = None
    region: str = ""
    targetHostingOptions: OCIHostingOptions | None = None
    targetMySQLOptions: DBSystemOptions | None = None
    # [{"variable":str, "value":Any, "use_default":bool, etc}]
    mysqlConfiguration: list[dict] = field(default_factory=list)

    migrationType: MigrationType = MigrationType.COLD
    cloudConnectivity: CloudConnectivity = CloudConnectivity.NOT_SET

    # DB migration options
    compatibilityFlags: list[CompatibilityFlags] = field(default_factory=list)
    schemaSelection: SchemaSelectionOptions = field(default_factory=SchemaSelectionOptions)


class CheckStatus(IntEnum):
    OK = 0  # All OK, at most notices
    CONFIRMATION_REQUIRED = 1
    ACTION_REQUIRED = 2
    FATAL_ERROR = 3
    EXTERNAL_ERROR = 4


class MessageLevel(StrEnum):
    ERROR = "ERROR"
    WARNING = "WARNING"
    NOTICE = "NOTICE"
    INFO = "INFO"
    VERBOSE = "VERBOSE"


@dataclass
class MigrationError(MigrationMessage):
    level: MessageLevel = MessageLevel.ERROR
    type: Optional[str] = None
    message: str = ""
    title: Optional[str] = None  # TODO unused, delete?
    info: Optional[dict] = None

    @classmethod
    def _from_exception(cls, e: Exception, title: str = ""):
        err = MigrationError()
        err.level = MessageLevel.ERROR
        err.type, err.message, err.info = errors.format_exception(e)
        err.title = title
        return err


@dataclass
class CheckResult(MigrationMessage):
    checkId: Optional[str] = None
    level: MessageLevel = MessageLevel.ERROR
    title: str = ""
    result: str = ""
    description: str = ""
    objects: list[str] = field(default_factory=list)
    choices: list[CompatibilityFlags] = field(default_factory=list)
    status: CheckStatus = CheckStatus.OK


@dataclass
class MigrationCheckResults(MigrationMessage):
    status: CheckStatus = CheckStatus.OK
    checks: list[CheckResult] = field(default_factory=list)
    title: str = ""
    message: str = ""

    def _apply_status(self, status: CheckStatus):
        if status > self.status:
            self.status = status

    def _merge(self, other: "MigrationCheckResults"):
        self._apply_status(other.status)
        self.checks += other.checks

    def _add_check(
        self,
        check_id: Optional[str],
        level: MessageLevel,
        title: str,
        result: str,
        description: str,
        objects: list[str] = [],
        choices: list[CompatibilityFlags] = [],
        status: CheckStatus = CheckStatus.OK,
    ) -> CheckResult:
        check = CheckResult()
        check.checkId = check_id
        check.level = level
        check.title = title
        check.result = result
        check.description = description
        check.objects = objects
        check.choices = choices
        check.status = status
        self.checks.append(check)

        return check


@dataclass
class ValidationIssue(MigrationMessage):
    level: MessageLevel = MessageLevel.ERROR
    option: str = ""
    message: str = ""


@dataclass
class ValidationResults(MigrationMessage):
    issues: list[ValidationIssue] = field(default_factory=list)

    def _add(self, level: MessageLevel, option: str, message: str):
        issue = ValidationIssue()
        issue.level = level
        issue.option = option
        issue.message = message
        self.issues.append(issue)


@dataclass
class ServerInfo(MigrationMessage):
    version: str = ""
    versionComment: str = ""
    license: str = ""
    hostname: str = ""
    serverUuid: str = ""
    schemaCount: int = 0
    dataSize: int = 0

    hasMRS: bool = False
    numAccountsOnMysqlNativePassword: int = 0
    numAccountsOnOldPassword: int = 0

    sslSupported: bool = False
    serverType: ServerType = ServerType.MySQL
    gtidMode: str = ""
    replicationStatus: str = ""


class SubStepId(enum.IntEnum):
    ORCHESTRATION = 0

    # Plan
    OCI_PROFILE = 1040
    SOURCE_SELECTION = 1010
    MIGRATION_TYPE = 1020
    SCHEMA_SELECTION = 1021
    MIGRATION_CHECKS = 1030
    TARGET_OPTIONS = 1050
    PREVIEW_PLAN = 1100

    # Work
    PROVISION_VCN = 2010
    PROVISION_COMPARTMENT = 2020
    PROVISION_COMPUTE = 2030
    PROVISION_BUCKET = 2040
    PROVISION_HELPER = 2050
    PROVISION_DBSYSTEM = 2060
    PROVISION_HEATWAVE_CLUSTER = 2070

    DUMP = 3010
    LOAD = 3020
    CONNECT_DBSYSTEM = 3030
    ENABLE_CRASH_RECOVERY = 3040
    ENABLE_HA = 3050

    # hot migration via tunnel
    CREATE_SSH_TUNNEL = 4010
    CHECK_DIRECT_NETWORK = 4020
    CREATE_CHANNEL = 4030

    CONGRATS = 5010
    MONITOR_CHANNEL = 5020
    CLEANUP = 5090
    FINAL_SUMMARY = 5100


class WorkStatusEvent(enum.StrEnum):
    BEGIN = "begin"
    END = "end"
    ERROR = "error"
    ABORTED = "aborted"


class ReplicationStatus(enum.StrEnum):
    STOPPED = "stopped"
    ACTIVE = "active"
    RECEIVER_ERROR = "receiver_error"
    APPLIER_ERROR = "applier_error"
    ERROR = "error"


@dataclass
class ConnectionCheckResult(MigrationMessage):
    connectError: str = ""
    connectErrno: Optional[int] = None
    resolvable: Optional[bool] = None
    reachable: Optional[bool] = None


@dataclass
class SourceCheckResult(MigrationMessage):
    # TODO move suggestions away
    suggestedTargetVersion: str = "8.4"
    suggestedTargetShape: Optional[str] = None
    suggestedTargetVolumeSize: Optional[int] = None

    serverInfo: ServerInfo = field(default_factory=ServerInfo)


@dataclass
class TargetCheckResult(ConnectionCheckResult):
    userSchemaCount: int = 0
    userAccountCount: int = 0
    targetInfo: ServerInfo = field(default_factory=ServerInfo)


@dataclass
class DumpStatus(MigrationMessage):
    stage: str = ""
    stageCurrent: Optional[int] = None
    stageTotal: Optional[int] = None
    stageEta: Optional[str] = None


@dataclass
class LoadStatus(MigrationMessage):
    stage: str = ""
    stageCurrent: Optional[int] = None
    stageTotal: Optional[int] = None
    stageTotalExact: bool = False
    stageEta: Optional[str] = None


@dataclass
class LogInfo(MigrationMessage):
    data: str = ""
    lastOffset: int = 0


@dataclass
class MigrationSummaryInfo(MigrationMessage):
    adminUser: str = ""

    migrationType: str = ""
    cloudConnectivity: str = ""

    compartmentName: str = ""
    fullCompartmentName: str = ""

    region: str = ""
    dbSystemName: str = ""
    dbSystemId: str = ""
    dbSystemIP: str = ""
    dbSystemVersion: str = ""
    channelId: str = ""

    jumpHostName: str = ""
    jumpHostId: str = ""
    jumpHostPrivateIP: str = ""
    jumpHostPublicIP: str = ""
    jumpHostKeyPath: str = ""
    createdJumpHost: bool = False

    sourceHost: str = ""
    sourcePort: int = 0
    sourceVersion: str = ""

    bucketNamespace: str = ""
    bucketName: str = ""
    createdBucket: bool = False


class WorkStatus(enum.StrEnum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    READY = "ready"  # finished, but still replicating
    FINISHED = "finished"
    ABORTED = "aborted"
    ERROR = "error"


@dataclass
class WorkStageInfo(MigrationMessage):
    stage: SubStepId = SubStepId.ORCHESTRATION
    caption: str = ""
    enabled: bool = False
    status: WorkStatus = WorkStatus.NOT_STARTED
    errors: list[MigrationError] = field(default_factory=list)
    current: Optional[int] = None
    total: Optional[int] = None
    eta: Optional[int] = None
    message: str = ""
    info: dict = field(default_factory=dict)
    logItems: int = 0

    def _snapshot(self):
        return deepcopy(self)


@dataclass
class WorkStatusInfo(MigrationMessage):
    status: WorkStatus = WorkStatus.NOT_STARTED
    stages: list[WorkStageInfo] = field(default_factory=list)
    summary: MigrationSummaryInfo = field(default_factory=MigrationSummaryInfo)

    def __init__(self) -> None:
        super().__init__()
        self.summary = MigrationSummaryInfo()
        self.stages = []
        for ws in SubStepId:
            if ws >= 2000:
                info = WorkStageInfo()
                info.stage = ws
                info.caption = ws.name
                info.errors = []
                self.stages.append(info)

    def _stage(self, stage: SubStepId) -> WorkStageInfo:
        for s in self.stages:
            if s.stage == stage:
                return s
        raise ValueError(f"Invalid stage {stage}")

    def _snapshot(self) -> "WorkStatusInfo":
        return deepcopy(self)


@dataclass
class MigrationStep(object):
    id: int
    caption: str
    help: str = ""
    type: str = ""


@dataclass
class MigrationSteps(object):
    id: int = 0
    caption: str = ""
    items: list[MigrationStep] = field(default_factory=list)


@dataclass
class ProjectData(MigrationMessage):
    name: str = ""
    path: str = ""
    id: str = ""
    source: str = ""
    modifyTime: str = ""
    dataMigrationDidFinish: bool = False


k_message_classes = {}
for c in list(locals().values()):
    if inspect.isclass(c) and issubclass(c, MigrationMessage):
        assert len(c.__bases__) == 1, "no multiple inheritance here"
        k_message_classes[c.__name__] = c
