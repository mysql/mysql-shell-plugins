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

import enum
from dataclasses import dataclass, field
from typing import Optional, TypeAlias, TypeVar

from . import model
from .model import (
    MigrationError,
    MigrationMessage,
    SchemaSelectionOptions,
    SubStepId,
)


@dataclass
class InstanceContents(MigrationMessage):
    schemas: list[str] = field(default_factory=list)
    accounts: list[str] = field(default_factory=list)


@dataclass
class SchemaObjects(MigrationMessage):
    schema: str = ""
    objects: list[str] = field(default_factory=list)


@dataclass
class SchemaTables(MigrationMessage):
    schema: str = ""
    tables: list[str] = field(default_factory=list)
    views: list[str] = field(default_factory=list)


@dataclass
class ReplicationChannelInfo(MigrationMessage):
    sourceUser: str = ""
    replicateIgnoreDb: list[str] = field(default_factory=list)
    replicateIgnoreTable: list[str] = field(default_factory=list)
    replicateWildIgnoreTable: list[str] = field(default_factory=list)


class MigrationStepStatus(enum.StrEnum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    READY_TO_COMMIT = "READY_TO_COMMIT"
    FINISHED = "FINISHED"
    ERROR = "ERROR"


class PlanEvent(enum.StrEnum):
    OCI_PROFILE_CHANGED = "OCI_PROFILE_CHANGED"
    SOURCE_CONNECTED = "SOURCE_CONNECTED"


@dataclass
class SourceSelectionData(MigrationMessage):
    serverInfo: Optional[model.ServerInfo] = None


@dataclass
class MigrationTypeData(MigrationMessage):
    allowedTypes: list[str] = field(default_factory=list)
    allowedConnectivity: list[str] = field(default_factory=list)


@dataclass
class SchemaSelectionData(MigrationMessage):
    contents: InstanceContents = field(default_factory=InstanceContents)


class MigrationCheckStatus(enum.StrEnum):
    PENDING = "PENDING"
    RUNNING_UPGRADE_CHECKS = "RUNNING_UPGRADE_CHECKS"
    RUNNING_COMPATIBILITY_CHECKS = "RUNNING_COMPATIBILITY_CHECKS"
    DONE = "DONE"
    ABORTED = "ABORTED"
    ERROR = "ERROR"


@dataclass
class MigrationChecksData(MigrationMessage):
    issues: list[model.CheckResult] = field(default_factory=list)
    checkProgress: model.MigrationCheckProgress = field(
        default_factory=model.MigrationCheckProgress
    )
    checkStatus: MigrationCheckStatus = MigrationCheckStatus.PENDING


@dataclass
class PreviewPlanData(MigrationMessage):
    options: model.MigrationOptions = field(default_factory=model.MigrationOptions)
    computeResolutionNotice: str = ""
    channelInfo: Optional[ReplicationChannelInfo] = None


@dataclass
class TargetOptionsData(MigrationMessage):
    compartmentPath: str = ""
    networkCompartmentPath: str = ""
    allowCreateNewVcn: bool = True


@dataclass
class OCIProfileOptions(MigrationMessage):
    configFile: str = ""
    profile: str = "DEFAULT"
    availableProfiles: list[str] = field(default_factory=list)
    region: str = ""
    availableRegions: list[str] = field(default_factory=list)


@dataclass
class SourceSelectionOptions(MigrationMessage):
    sourceUri: str = ""
    password: str = ""


@dataclass
class MigrationTypeOptions(MigrationMessage):
    type: model.MigrationType = model.MigrationType.COLD
    connectivity: model.CloudConnectivity = model.CloudConnectivity.NOT_SET


@dataclass
class MigrationChecksOptions(MigrationMessage):
    runChecks: bool = False
    abortChecks: bool = False
    issueResolution: dict[str, model.CompatibilityFlags] = field(default_factory=dict)


@dataclass
class TargetOptionsOptions(MigrationMessage):
    hosting: Optional[model.OCIHostingOptions] = None
    database: Optional[model.DBSystemOptions] = None


SubStepData: TypeAlias = (
    SourceSelectionData
    | MigrationTypeData
    | SchemaSelectionData
    | MigrationChecksData
    | TargetOptionsData
    | PreviewPlanData
)
SubStepValues: TypeAlias = (
    OCIProfileOptions
    | SourceSelectionOptions
    | MigrationTypeOptions
    | SchemaSelectionOptions
    | MigrationChecksOptions
    | TargetOptionsOptions
)

T = TypeVar("T")


class PlanDataItemType(enum.StrEnum):
    SCHEMA_TABLES = "tables"
    SCHEMA_ROUTINES = "routines"
    SCHEMA_TRIGGERS = "triggers"
    SCHEMA_EVENTS = "events"
    SCHEMA_LIBRARIES = "libraries"


PlanDataItem: TypeAlias = SchemaObjects | SchemaTables


@dataclass
class MigrationPlanState(MigrationMessage):
    id: SubStepId = SubStepId.ORCHESTRATION
    status: MigrationStepStatus = MigrationStepStatus.NOT_STARTED
    errors: list[MigrationError] = field(default_factory=list)
    data: Optional[SubStepData] = None
    values: Optional[SubStepValues] = None
