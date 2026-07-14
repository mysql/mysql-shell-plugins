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

from typing import Optional
from dataclasses import dataclass, field

# pylint: disable=invalid-name


@dataclass
class MySQLUserListItemSSLOptions:
    """Represents the SSL options for a MySQL user, used in the listUsers endpoint."""

    requiresCertificate: bool
    sslCipher: Optional[str]
    x509Issuer: Optional[str]
    x509Subject: Optional[str]


@dataclass
class MySQLTablePrivilege:
    """Privileges granted on one table."""

    schema: str
    table: str
    privileges: list[str] = field(default_factory=list)


@dataclass
class MySQLRoutinePrivilege:
    """Privileges granted on one routine."""

    schema: str
    routine: str
    routineType: str
    privileges: list[str] = field(default_factory=list)


@dataclass
class MySQLColumnPrivilege:
    """Privileges granted on one column."""

    schema: str
    table: str
    column: str
    privileges: list[str] = field(default_factory=list)


@dataclass
class MySQLUserListItem:
    """A simplified representation of a MySQL user, used for the listUsers endpoint."""

    accountLocked: bool
    plugin: str
    user: str
    host: str
    temporarilyLocked: bool = False
    isRole: bool = False
    globalPrivileges: list[str] = field(default_factory=list)
    passwordExpired: bool = False
    passwordExpiration: Optional[str] = None
    roles: list[str] = field(default_factory=list)
    defaultRoles: list[str] = field(default_factory=list)
    schemaPrivileges: dict[str, list[str]] = field(default_factory=dict)
    tablePrivileges: list[MySQLTablePrivilege] = field(default_factory=list)
    columnPrivileges: list[MySQLColumnPrivilege] = field(default_factory=list)
    routinePrivileges: list[MySQLRoutinePrivilege] = field(default_factory=list)
    partialRevokes: dict[str, list[str]] = field(default_factory=dict)
    sslOptions: Optional[MySQLUserListItemSSLOptions] = None


@dataclass
class MySQLGlobalPrivilegeCatalogItem:
    """A global privilege supported by the connected MySQL server."""

    privilege: str
    category: str = ""
    description: str = ""


@dataclass
class MySQLDefaultUserOptions:
    """Server defaults for user account options."""

    passwordLifetime: int = 0
    passwordReuseHistory: int = 0
    passwordReuseInterval: int = 0
    passwordRequireCurrent: bool = False
    maxUserConnections: int = 0


@dataclass
class ObjectPrivilegeTarget:
    """A target object for direct MySQL object privileges."""

    kind: str
    schema: str
    objectName: Optional[str] = None
    routineType: Optional[str] = None
    column: Optional[str] = None


@dataclass
class MySQLObjectPrivilegeSchemaTarget:
    """An available table or routine in a schema for object privilege assignment."""

    kind: str
    objectName: str
    routineType: Optional[str] = None


@dataclass
class MySQLUser:
    """A more detailed representation of a MySQL user."""

    host: str = ""
    user: str = ""
    sslType: Optional[str] = None
    sslCipher: Optional[str] = None
    x509Issuer: Optional[str] = None
    x509Subject: Optional[str] = None
    maxQuestions: Optional[int] = None
    maxUpdates: Optional[int] = None
    maxConnections: Optional[int] = None
    maxUserConnections: Optional[int] = None
    plugin: Optional[str] = None
    passwordExpire: Optional[bool] = None
    passwordLastChanged: Optional[str] = None
    passwordLifetime: Optional[int] = None
    accountLocked: Optional[bool] = None
    passwordReuseHistory: Optional[int] = None
    passwordReuseInterval: Optional[int] = None
    passwordRequireCurrent: Optional[bool] = None
    comment: Optional[str] = None
    failedLoginAttempts: Optional[int] = None
    passwordLockTime: Optional[int] = None
    authString: Optional[str] = None
    randomPassword: Optional[bool] = False


@dataclass
class UserInfo:
    """Information returned after creating or updating a MySQL user."""

    generatedPassword: Optional[str] = None
