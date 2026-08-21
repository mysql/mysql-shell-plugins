# Copyright (c) 2026, Oracle and/or its affiliates.
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
# separately licensed software that they have either included with the
# program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

from dataclasses import dataclass, field
from typing import Literal, Optional


@dataclass
class MebStatusItem:
    label: str = ""
    value: str = ""
    tone: str = "info"


@dataclass
class MebValidationStatus:
    tone: str = "info"
    message: str = ""


@dataclass
class MebPrerequisitesValidation:
    valid: bool = False
    osUser: str = ""
    mysqlbackupPath: Optional[str] = None
    mysqlbackupExists: bool = False
    datadir: Optional[str] = None
    datadirOwner: Optional[str] = None
    datadirGroup: Optional[str] = None
    currentOsUser: Optional[str] = None
    platform: str = ""
    schedulerName: str = ""
    userStatus: MebValidationStatus = field(default_factory=MebValidationStatus)
    mysqlbackupStatus: MebValidationStatus = field(default_factory=MebValidationStatus)
    datadirStatus: MebValidationStatus = field(default_factory=MebValidationStatus)


@dataclass
class MebBackupHomeValidation:
    valid: bool = False
    backupHomePath: Optional[str] = None
    exists: bool = False
    owner: Optional[str] = None
    status: MebValidationStatus = field(default_factory=MebValidationStatus)
    ownershipStatus: MebValidationStatus = field(default_factory=MebValidationStatus)
    permissionsStatus: MebValidationStatus = field(default_factory=MebValidationStatus)
    reuseStatus: MebValidationStatus = field(default_factory=MebValidationStatus)
    accessStatus: MebValidationStatus = field(default_factory=MebValidationStatus)


@dataclass
class MebMysqlBackupUserValidation:
    valid: bool = False
    exists: bool = False
    host: Optional[str] = None
    passwordStored: bool = False
    loginFile: Optional[str] = None
    loginPath: Optional[str] = None
    missingGrants: list[str] = field(default_factory=list)
    status: MebValidationStatus = field(default_factory=MebValidationStatus)
    passwordStatus: MebValidationStatus = field(default_factory=MebValidationStatus)


@dataclass
class MebProfileSchedule:
    enabled: bool = False
    interval: int = 1
    frequency: int = 0
    monthDays: list[int] = field(default_factory=lambda: [1])
    weekDays: list[bool] = field(default_factory=lambda: [False, False, False, False, False, False, False])
    hour: int = 0
    minute: int = 0


@dataclass
class MebBackupProfileInfo:
    uuid: str = ""
    label: str = "Backup"
    type: str = "Full Data"
    destination: str = ""
    latest: str = "No backups"
    nextFull: str = "Manual"
    nextIncremental: str = "Manual"
    status: str = "New"
    schedulerLoginRequirement: Optional[Literal["required", "notRequired"]] = None
    command: Optional[str] = None
    user: Optional[str] = None
    configPath: Optional[str] = None
    applyLog: bool = False
    comments: Optional[str] = None
    compress: bool = False
    compressLevel: str = "1"
    compressMethod: str = "lz4"
    storageType: Literal["local"] = "local"
    cloudService: Optional[str] = "OCI"
    cloudObject: Optional[str] = None
    cloudParUrl: Optional[str] = None
    cloudHost: Optional[str] = None
    cloudBucket: Optional[str] = None
    cloudObjectKey: Optional[str] = None
    cloudAccessKeyId: Optional[str] = None
    cloudAwsRegion: Optional[str] = None
    cloudContainer: Optional[str] = None
    cloudUserId: Optional[str] = None
    cloudTempAuthUrl: Optional[str] = None
    cloudBasicAuthUrl: Optional[str] = None
    cloudIdentityUrl: Optional[str] = None
    cloudTenant: Optional[str] = None
    cloudRegion: Optional[str] = None
    cloudChunkedTransfer: bool = False
    cloudChunkSize: Optional[str] = None
    cloudProxy: Optional[str] = None
    cloudCaInfo: Optional[str] = None
    cloudCaPath: Optional[str] = None
    cloudBufferSize: Optional[str] = None
    cloudTrace: bool = False
    excludeTables: Optional[str] = None
    fullSchedule: MebProfileSchedule = field(default_factory=MebProfileSchedule)
    includeTables: Optional[str] = None
    legacyPartialBackupConverted: bool = False
    legacyPartialBackupConversionMessage: Optional[str] = None
    incrementalBase: str = "history:last_backup"
    incrementalWithRedoLogOnly: bool = False
    incSchedule: MebProfileSchedule = field(default_factory=MebProfileSchedule)
    partial: bool = False
    skipUnusedPages: bool = False
    usingTts: Literal["0", "1", "2"] = "0"
    datadir: Optional[str] = None
    mysqlBasedir: Optional[str] = None
    mysqlVersion: Optional[str] = None


@dataclass
class MebActivityItem:
    time: str = ""
    title: str = ""
    detail: str = ""
    tone: str = "info"
    activityId: Optional[str] = None
    size: Optional[str] = None
    profile: Optional[str] = None
    profileId: Optional[str] = None
    status: Optional[str] = None
    backupType: Optional[str] = None
    isBackup: bool = False


@dataclass
class MebBackupProfile:
    applyLog: bool = False
    comments: Optional[str] = None
    compress: bool = False
    compressLevel: str = "1"
    compressMethod: str = "lz4"
    storageType: Literal["local"] = "local"
    cloudService: Optional[str] = None
    cloudObject: Optional[str] = None
    cloudParUrl: Optional[str] = None
    cloudHost: Optional[str] = None
    cloudBucket: Optional[str] = None
    cloudObjectKey: Optional[str] = None
    cloudAccessKeyId: Optional[str] = None
    cloudSecretAccessKey: Optional[str] = None
    cloudAwsRegion: Optional[str] = None
    cloudAccessKey: Optional[str] = None
    cloudSecretKey: Optional[str] = None
    cloudContainer: Optional[str] = None
    cloudUserId: Optional[str] = None
    cloudPassword: Optional[str] = None
    cloudTempAuthUrl: Optional[str] = None
    cloudBasicAuthUrl: Optional[str] = None
    cloudIdentityUrl: Optional[str] = None
    cloudTenant: Optional[str] = None
    cloudRegion: Optional[str] = None
    cloudChunkedTransfer: bool = False
    cloudChunkSize: Optional[str] = None
    cloudProxy: Optional[str] = None
    cloudCaInfo: Optional[str] = None
    cloudCaPath: Optional[str] = None
    cloudBufferSize: Optional[str] = None
    cloudTrace: bool = False
    label: str = ""
    destination: str = ""
    excludeTables: Optional[str] = None
    fullSchedule: MebProfileSchedule = field(default_factory=MebProfileSchedule)
    includeTables: Optional[str] = None
    incrementalBase: str = "history:last_backup"
    incrementalWithRedoLogOnly: bool = False
    incSchedule: MebProfileSchedule = field(default_factory=MebProfileSchedule)
    partial: bool = False
    skipUnusedPages: bool = False
    usingTts: Literal["0", "1", "2"] = "0"
    user: Optional[str] = None
    datadir: Optional[str] = None
    mysqlBasedir: Optional[str] = None
    configPath: Optional[str] = None


@dataclass
class MebLogContent:
    activityId: str = ""
    displayName: str = ""
    content: str = ""
    warnings: list[str] = field(default_factory=list)


@dataclass
class MebBackupContentRow:
    schema: str = ""
    table: str = ""
    engine: str = ""
    scope: str = ""
    coverage: str = ""
    inBackup: bool = False
    inInstance: bool = False
    action: str = ""


@dataclass
class MebBackupFileGroup:
    category: str = ""
    fileCount: int = 0
    description: str = ""
    sample: str = ""
    files: list[str] = field(default_factory=list)


@dataclass
class MebBackupRestoreChainEntry:
    name: str = ""
    type: Optional[Literal["Full", "Incremental"]] = None
    timestamp: Optional[str] = None


@dataclass
class MebBackupContent:
    backupHome: str = ""
    activityId: str = ""
    backupLabel: str = ""
    backupScope: Optional[str] = None
    applyLogDone: bool = False
    hasInstanceData: bool = False
    mysqlVersion: Optional[str] = None
    gtidExecuted: Optional[str] = None
    startTime: Optional[str] = None
    endTime: Optional[str] = None
    binlogFile: Optional[str] = None
    binlogPosition: Optional[str] = None
    restoreChain: list[MebBackupRestoreChainEntry] = field(default_factory=list)
    fileGroups: list[MebBackupFileGroup] = field(default_factory=list)
    rows: list[MebBackupContentRow] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


@dataclass
class MebStatus:
    configured: bool = False
    mysqlbackupCommand: Optional[str] = None
    backupHome: Optional[str] = None
    backupUser: Optional[str] = None
    mysqlVersion: Optional[str] = None
    mysqlEdition: Optional[str] = None
    mysqlBasedir: Optional[str] = None
    datadir: Optional[str] = None
    spaceAvailable: Optional[str] = None
    spaceUsed: Optional[str] = None
    spaceTotal: Optional[str] = None
    spaceUsedPercent: Optional[float] = None
    spaceOtherUsedPercent: Optional[float] = None
    profileTemplate: MebBackupProfileInfo = field(default_factory=MebBackupProfileInfo)
    profiles: list[MebBackupProfileInfo] = field(default_factory=list)
    statusItems: list[MebStatusItem] = field(default_factory=list)
    recentActivity: list[MebActivityItem] = field(default_factory=list)


@dataclass
class MebRestoreResult:
    succeeded: bool = False
    aborted: bool = False
    message: str = ""
    output: str = ""
    status: Optional[MebStatus] = None


@dataclass
class MebRestoreProgress:
    state: str = "starting"
    operationId: str = ""
    output: str = ""


@dataclass
class MebSetupState:
    configured: bool = False
    needsSetup: bool = True
    localSupported: bool = True
    message: str = ""
    messageTone: str = "info"
    backupHomePath: Optional[str] = None
    backupOsUser: Optional[str] = None
    runtimeHelperPath: Optional[str] = None
    mysqlbackupPath: Optional[str] = None
    mysqlbackupExists: bool = False
    mysqlBackupUser: str = "mysqlbackup@localhost"
    datadir: Optional[str] = None
    datadirOwner: Optional[str] = None
    datadirGroup: Optional[str] = None
    currentOsUser: Optional[str] = None
    platform: str = ""
    mysqlVersion: Optional[str] = None
    mysqlEdition: Optional[str] = None
    mysqlBasedir: Optional[str] = None
    loginFile: Optional[str] = None
    loginPath: Optional[str] = None
    schedulerName: str = ""
    status: Optional[MebStatus] = None
