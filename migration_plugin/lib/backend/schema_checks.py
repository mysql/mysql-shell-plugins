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

from typing import Tuple, List
from enum import StrEnum

from . import checks, filtering_utils, model, string_utils
from .. import logging
from .model import CompatibilityFlags, CheckStatus


# Keys are in format:
# check_id: [title, status, description, choices, link]
k_ocimds_description: dict[str, Tuple[str, CheckStatus, str, list[CompatibilityFlags]]] = {
    "user/unsupported_auth_plugin": (
        "Authentication Plugin Compatibility",
        CheckStatus.CONFIRMATION_REQUIRED,
        """
The following user accounts use unsupported authentication plugins and will be locked in the target MySQL.

The listed accounts use authentication plugins that are not supported by MySQL.
They will still be migrated, but they will be created LOCKED and their password
must be changed before they can connect to MySQL.

You may also manually convert these accounts to
<a href="https://dev.mysql.com/doc/refman/en/caching-sha2-pluggable-authentication.html">caching_sha2_password</a>
before migrating and reset their password; or exclude them from being migrated.
""",
        [CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "user/deprecated_auth_plugin": (
        "Authentication Plugin Deprecation",
        CheckStatus.CONFIRMATION_REQUIRED,
        """
The following user accounts use deprecated authentication plugins.

The listed accounts use authentication plugins that soon will not be supported
by MySQL. They will still be migrated, but they may require some additional
maintenance once the migration is finished.

Note: the deprecated mysql_native_password plugin has been replaced by
caching_sha2_password, which is more secure.

You may also manually convert these accounts to
<a href="https://dev.mysql.com/doc/refman/en/caching-sha2-pluggable-authentication.html">
caching_sha2_password</a> before
migrating and reset their password; or exclude them from being migrated.
""",
        [CompatibilityFlags.IGNORE, CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "user/mysql_native_password_auth_plugin": (
        "Authentication Plugin Availability",
        CheckStatus.CONFIRMATION_REQUIRED,
        """
The following user accounts use the mysql_native_password authentication plugin and will be locked in the target MySQL.

The listed accounts use the mysql_native_password authentication plugin which is disabled by default in MySQL 8.4.
They will still be migrated, but they will be created LOCKED and their password
must be changed before they can connect to MySQL.

You may also manually convert these accounts to
<a href="https://dev.mysql.com/doc/refman/en/caching-sha2-pluggable-authentication.html">caching_sha2_password</a>
before migrating and reset their password; or exclude them from being migrated.
""",
        [CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "user/no_password": (
        "User Password Requirements",
        CheckStatus.CONFIRMATION_REQUIRED,
        """
The following user accounts have no password and will be locked in the target MySQL.

The listed accounts have a blank password, which is
<a href="https://docs.oracle.com/en-us/iaas/mysql-database/doc/plugins-and-components.html#GUID-0EE82DBE-75A0-4ABA-8C4C-1DB47FB05C7F__UL_M12_CHZ_CTB">
not allowed</a> in the MySQL
HeatWave Service. They will still be migrated, but they will be created LOCKED
and their password must be changed before they can connect to MySQL.

You may also set a password before migrating or exclude the user from being
migrated.
""",
        [CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "user/restricted_grants": (
        "Restricted Grants",
        CheckStatus.CONFIRMATION_REQUIRED,
        """
The following user accounts have GRANTs that are restricted and will be updated.

MySQL HeatWave Service restricts certain privileges from regular user accounts
so they will be removed from the grant list of accounts when created at the
target database. All other things will remain the same, including password and
remaining grants.

<a href="https://docs.oracle.com/en-us/iaas/mysql-database/doc/default-mysql-privileges.html">
Read more</a>
""",
        [CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "user/invalid_grants": (
        "Invalid Grants",
        CheckStatus.CONFIRMATION_REQUIRED,
        """
The following user accounts have GRANTs on non-existent objects and will be updated.

GRANTs on non-existent objects will be commented out and will not be executed
at the target database.
""",
        [CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "user/wildcard_grant": (
        "Grant Syntax Compatibility",
        CheckStatus.CONFIRMATION_REQUIRED,
        """
The following user accounts have wildcard GRANTs at schema level.

MySQL HeatWave Service has the
<a href="https://dev.mysql.com/doc/refman/en/server-system-variables.html#sysvar_partial_revokes">
partial_revokes</a> system variable enabled by
default, which causes wildcard characters to be interpreted literally.
""",
        [CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "user/escaped_wildcard_grant": (
        "Grant Syntax Compatibility",
        CheckStatus.CONFIRMATION_REQUIRED,
        """
The following user accounts have escaped wildcard GRANTs at schema level.

MySQL HeatWave Service has the
<a href="https://dev.mysql.com/doc/refman/en/server-system-variables.html#sysvar_partial_revokes">
partial_revokes</a> system variable enabled by
default, which causes both escape characters and wildcard characters to be
interpreted literally.
""",
        [CompatibilityFlags.IGNORE, CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "user/grant_on_missing_object": (
        "Grants on Missing Objects",
        CheckStatus.CONFIRMATION_REQUIRED,
        """
The following user accounts have grants on objects that will not be migrated.

Grants on objects that do not exist will fail to execute, so they must be removed.
""",
        [CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "user/grant_on_missing_role": (
        "Grants on Missing Roles",
        CheckStatus.CONFIRMATION_REQUIRED,
        """
The following user accounts have roles that will not be migrated.

All such roles will not be granted to the migrated user accounts.
""",
        [CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "schema/encryption": (
        "Unsupported Encryption Option for Schema",
        CheckStatus.OK,
        """
Schema level <code>ENCRYPTION</code> option will be removed.

The schema level <code>ENCRYPTION</code> option is not supported in the MySQL
HeatWave Service and was removed from the listed schemas. The MySQL HeatWave
Service encrypts all database files at the block volume level.

<a href="https://docs.oracle.com/en-us/iaas/mysql-database/doc/unsupported-features.html">
Read more</a>
""",
        [CompatibilityFlags.IGNORE, CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "view/invalid_reference": (
        "View with Invalid References",
        CheckStatus.ACTION_REQUIRED,
        """
Views containing references to skipped tables must be excluded or manually repaired.

The following views contain references to tables that could not be found in list
of tables to be migrated. They must be manually fixed or excluded before
continuing.
""",
        [CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "view/mismatched_reference": (
        "View with Mismatched References",
        CheckStatus.ACTION_REQUIRED,
        """
Views containing references to tables using wrong letter case must be excluded or manually repaired.

The following views contain references to tables using wrong letter case. They
must be manually fixed or excluded before continuing.

This occurs because table names are case-sensitive in the MySQL HeatWave Service
and the source database is not.
""",
        [CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "view/invalid_definition": (
        "View with Invalid Definition",
        CheckStatus.ACTION_REQUIRED,
        """
Views containing invalid references must be excluded or manually repaired.

The following views contain references to invalid tables/columns/functions or
definer/invoker of these views lack rights to use them. They must be manually
fixed or excluded before continuing.
""",
        [CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "table/unsupported_engine": (
        "Table with Unsupported Storage Engine",
        CheckStatus.CONFIRMATION_REQUIRED,
        """
The tables below will be converted to the InnoDB storage engine.

Tables are required to use the high-performance, transactional InnoDB storage
engine. Non-InnoDB tables will be automatically converted to InnoDB in the
migrated database.
""",
        [CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "table/cannot_replace_engine": (
        "Incompatible Table with Unsupported Storage Engine",
        CheckStatus.ACTION_REQUIRED,
        """
The tables below cannot be converted to the InnoDB storage engine.

The following tables are incompatible with the InnoDB storage engine and must be
excluded or manually repaired.
""",
        [CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "table/missing_pk": (
        "Table Missing Primary Key or Equivalent",
        CheckStatus.CONFIRMATION_REQUIRED,
        """
The tables below do not have PRIMARY KEYs and will have one added.

In order to offer High Availability, the MySQL HeatWave Service requires all
tables to have either a PRIMARY KEY or a UNIQUE KEY on a NOT NULL column.

The MySQL HeatWave Service will automatically and transparently add a
<a href="https://dev.mysql.com/doc/refman/8.4/en/create-table-gipks.html">
Generated Invisible Primary Key (GIPK)</a> to your migrated tables at the destination.

You may select specific tables to be Excluded instead, if you prefer to not
migrate them.

<a href="https://docs.oracle.com/en-us/iaas/mysql-database/doc/prerequisites1.html">
MySQL HeatWave Service Pre-requisites</a>
""",
        [CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "table/missing_pk_manual_fix": (
        "Table not Eligible for Automatic Primary Key Creation",
        CheckStatus.ACTION_REQUIRED,
        """
The tables below do not have PRIMARY KEYs and cannot have one created automatically.

In order to offer High Availability, the MySQL HeatWave Service requires all
tables to have either a PRIMARY KEY or a UNIQUE KEY on a NOT NULL column.

The following tables cannot have a PRIMARY KEY created automatically and must be
either excluded or manually repaired.

<a href="https://docs.oracle.com/en-us/iaas/mysql-database/doc/prerequisites1.html">
MySQL HeatWave Service Pre-requisites</a>
""",
        [CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "table/data_or_index_directory": (
        "Unsupported Data or Index Directory Option",
        CheckStatus.OK,
        """
The <code>DATA/INDEX DIRECTORY</code> option removed.

The <code>DATA DIRECTORY</code> and <code>INDEX DIRECTORY</code> options are not
supported in the MySQL HeatWave Service and were removed from the listed tables.
""",
        [],
    ),
    "table/encryption": (
        "Unsupported Encryption Option for Table",
        CheckStatus.OK,
        """
Table level <code>ENCRYPTION</code> option will be removed.

The table level <code>ENCRYPTION</code> option is
<a href="https://docs.oracle.com/en-us/iaas/mysql-database/doc/unsupported-features.html">
not supported</a> in the MySQL
HeatWave Service and was removed from the listed tables. The MySQL HeatWave
Service encrypts all database files at the block volume level.
""",
        [CompatibilityFlags.IGNORE, CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "table/tablespace": (
        "Unsupported Tablespace Option for Table",
        CheckStatus.CONFIRMATION_REQUIRED,
        """
The <code>TABLESPACE</code> option will be removed from the following tables.

The MySQL HeatWave Service places some restrictions on tablespaces and they will
not be migrated. Tables that use the <code>TABLESPACE</code> option will be
modified to be placed in the default tablespace in the migrated database.
""",
        [CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "table/unsupported_row_format": (
        "Unsupported Row Format for Table",
        CheckStatus.CONFIRMATION_REQUIRED,
        """
The <code>ROW_FORMAT=FIXED</code> option will be removed from the following tables.

The MySQL HeatWave Service does not support fixed row format. Tables that use
this format will be modified and <code>ROW_FORMAT</code> option will be removed.
""",
        [CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "table/too_many_columns": (
        "Table Has Too Many Columns",
        CheckStatus.ACTION_REQUIRED,
        """
Table has too many columns and must be excluded or manually repaired.

The following tables have more columns than the limit for the InnoDB engine
(1017). They must be manually fixed or excluded before continuing.
""",
        [CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "object/restricted_definer": (
        "DEFINER Set to a Restricted User",
        CheckStatus.CONFIRMATION_REQUIRED,
        """
The <code>DEFINER</code> clause of the following objects will be removed because they are set to a restricted account.

Certain user account names are
<a href="https://docs.oracle.com/en-us/iaas/mysql-database/doc/reserved-usernames.html">reserved</a>
to MySQL HeatWave Service and cannot be
used by regular users. Any objects that have the <code>DEFINER</code> clause set
to such a user will have to be modified to remove the definer and default to the
<code>admin@%</code> account.

You may manually update the DEFINER to a different one before or after migrating
them or exclude them altogether.
""",
        [CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "object/invalid_definer": (
        "Disallowed DEFINER Clause",
        CheckStatus.CONFIRMATION_REQUIRED,
        """
The <code>DEFINER</code> clause of the following objects will be removed.

The MySQL HeatWave Service in specified version does not allow to set the
<code>DEFINER</code> attribute to any other account than the current account.
Any objects that have the <code>DEFINER</code> clause will have to be modified
to remove the definer and default to the <code>admin@%</code> account.

<a href="https://dev.mysql.com/doc/refman/en/stored-objects-security.html">Read more</a>
""",
        [CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "object/invalid_definer_users_not_dumped": (
        "Users Not Dumped",
        CheckStatus.ACTION_REQUIRED,
        """
The migrated objects have <code>DEFINER</code> clause and user accounts are not migrated.

Some of the migrated objects have the <code>DEFINER</code> clause, yet user
accounts are not migrated. This needs to be fixed before continuing.
""",
        [CompatibilityFlags.strip_definers],
    ),
    "object/invalid_definer_missing_user": (
        "Invalid DEFINER Clause",
        CheckStatus.ACTION_REQUIRED,
        """
<code>DEFINER</code> of the following objects will be removed because it is set to a user account that does not exist or will not be migrated.

The <code>DEFINER</code> clause can be used together with the
<code>SQL SECURITY DEFINER</code> clause to force objects such as views and
stored procedures to execute under the security context of the user account
specified as their definer.
""",
        [CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "object/missing_sql_security": (
        "Missing SQL SECURITY INVOKER Characteristic",
        CheckStatus.CONFIRMATION_REQUIRED,
        """
The <code>SQL SECURITY</code> characteristic of the following objects will be set to <code>INVOKER</code>.

The MySQL HeatWave Service in specified version does not allow to set the
<code>DEFINER</code> attribute to any other account than the current account and
for this reason will be removed. As an additional safety measure, the
<code>SQL SECURITY</code> characteristic will be set to <code>INVOKER</code>, to
prevent escalation of privileges.

<a href="https://dev.mysql.com/doc/refman/en/stored-objects-security.html">Stored Object Access Control</a>
""",
        [CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "object/missing_sql_security_and_definer": (
        "Missing DEFINER and SQL SECURITY INVOKER Characteristic",
        CheckStatus.CONFIRMATION_REQUIRED,
        """
The <code>SQL SECURITY INVOKER</code> characteristic will be added to the following objects.

These objects have neither the <code>DEFINER</code> clause nor the
<code>SQL SECURITY INVOKER</code> characteristic, their definition will be
modified to include the latter.

You may also manually set the <code>DEFINER</code> clause or exclude them
altogether.

<a href="https://dev.mysql.com/doc/refman/en/stored-objects-security.html">Stored Object Access Control</a>
""",
        [CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "object/object_collation_unsupported": (
        "Unsupported Collation",
        CheckStatus.ACTION_REQUIRED,
        """
The following objects are using an unsupported collation.

You need to manually change the collation to a supported one or exclude them
altogether.

<a href="https://dev.mysql.com/doc/refman/en/charset-charsets.html">Read more</a>
""",
        [CompatibilityFlags.EXCLUDE_OBJECT],
    ),
    "object/object_collation_replaced": (
        "Collation Replaced",
        CheckStatus.OK,
        """
The following objects will have the collation replaced.

These objects are using a <a href="https://dev.mysql.com/doc/refman/en/charset-charsets.html">collation</a>
which is not supported in the MySQL HeatWave
Service, and will have it replaced to a closest compatible collation available.
""",
        [],
    ),
    "routine/missing_dependency": (
        "Missing Dependency for Stored Routine",
        CheckStatus.ACTION_REQUIRED,
        """
The following routines are referencing a library which does not exist or will not be migrated.

The following routines contain references to libraries that could not be found
in list of libraries to be migrated. They must be manually fixed or excluded
before continuing.
""",
        [CompatibilityFlags.EXCLUDE_OBJECT],
    ),
}


class CompatibilityIssueStatus(StrEnum):
    FIXED = "FIXED"
    NOTE = "NOTE"
    WARNING = "WARNING"
    ERROR = "ERROR"


class CompatibilityIssueObjectType(StrEnum):
    UNSPECIFIED = "unspecified"
    USER = "user"
    SCHEMA = "schema"
    TABLE = "table"
    VIEW = "view"
    COLUMN = "column"
    FUNCTION = "function"
    PROCEDURE = "procedure"
    PARAMETER = "parameter"
    RETURN_VALUE = "return value of the function"
    EVENT = "event"
    TRIGGER = "trigger"


def compatibility_issue_to_message_level(status: CompatibilityIssueStatus) -> model.MessageLevel:
    match status:
        case CompatibilityIssueStatus.FIXED | CompatibilityIssueStatus.NOTE:
            return model.MessageLevel.NOTICE

        case CompatibilityIssueStatus.WARNING:
            return model.MessageLevel.WARNING

        case CompatibilityIssueStatus.ERROR:
            return model.MessageLevel.ERROR

        case _:
            return model.MessageLevel.NOTICE


class CompatibilityIssue:
    def __init__(self, args: dict) -> None:
        self.check_id: str = args["check"]
        self.compatibility_options: list[model.CompatibilityFlags] = []

        if "compatibilityOptions" in args:
            for option in args["compatibilityOptions"]:
                self.compatibility_options.append(
                    model.CompatibilityFlags(option)
                )

        self.description: str = args["description"]
        self.object_name: str = args["objectName"]
        self.object_type: CompatibilityIssueObjectType = CompatibilityIssueObjectType(
            args["objectType"]
        )
        self.status: CompatibilityIssueStatus = CompatibilityIssueStatus(
            args["status"]
        )

        # map return value to a function
        if CompatibilityIssueObjectType.RETURN_VALUE == self.object_type:
            self.object_type = CompatibilityIssueObjectType.FUNCTION


def compatibility_issue_to_check_result(issue: CompatibilityIssue) -> model.CheckResult:
    result = model.CheckResult()
    result.checkId = issue.check_id
    result.level = compatibility_issue_to_message_level(issue.status)
    result.title = issue.check_id
    result.result = ""
    result.description = issue.description.strip()
    result.objects = []
    result.choices = issue.compatibility_options

    status = model.CheckStatus.CONFIRMATION_REQUIRED

    if issue.check_id in k_ocimds_description:
        title, status, description, choices = k_ocimds_description[issue.check_id]
        result.title = title
        result.description = description.strip()

        # if issue wasn't fixed, offer more choices
        if CompatibilityIssueStatus.FIXED != issue.status:
            result.choices.extend(choices)

        # if object is not specified, it cannot be excluded
        if CompatibilityIssueObjectType.UNSPECIFIED == issue.object_type:
            try:
                result.choices.remove(model.CompatibilityFlags.EXCLUDE_OBJECT)
            except ValueError:
                # ignore ValueError raised when removed value is not present
                pass
    else:
        logging.devdebug(f"Missing check descriptor for {issue}", abort=False)

    # if issue is fixed, no further action is needed, update the status
    if CompatibilityIssueStatus.FIXED == issue.status:
        status = model.CheckStatus.OK
    elif 0 == len(result.choices):
        # if there are no choices available, this will require a manual fix
        status = model.CheckStatus.ACTION_REQUIRED

    result.status = status

    return result


def process_ocimds_issues(check_output: dict, result: model.MigrationCheckResults):
    issues_by_check: dict[str, model.CheckResult] = {}

    def format_object(issue: CompatibilityIssue):
        match issue.object_type:
            case CompatibilityIssueObjectType.UNSPECIFIED:
                return ""

            case _:
                return f"{issue.object_type}:{issue.object_name}"

    for check_item in check_output["issues"]:
        if "compatibilityIssue" not in check_item:
            continue

        issue = CompatibilityIssue(check_item["compatibilityIssue"])

        if issue.check_id not in issues_by_check:
            issues_by_check[issue.check_id] = compatibility_issue_to_check_result(
                issue)

        issues_by_check[issue.check_id].result += f"\n<li>{issue.description}"

        o = format_object(issue)

        if o not in issues_by_check[issue.check_id].objects:
            issues_by_check[issue.check_id].objects.append(o)

    for check_result in issues_by_check.values():
        result._apply_status(check_result.status)
        # make sure we always get the same order of objects/results
        check_result.result = "\n".join(
            sorted(check_result.result.strip().split("\n")))
        check_result.objects = sorted(check_result.objects)
        result.checks.append(check_result)


# TODO - check if mysql_old_password is checked somewhere


class DbObjectType(StrEnum):
    SCHEMA = "Schema"
    TABLE = "Table"
    VIEW = "View"
    COLUMN = "Column"
    INDEX = "Index"
    FOREIGN_KEY = "ForeignKey"
    ROUTINE = "Routine"
    EVENT = "Event"
    TRIGGER = "Trigger"
    SYSVAR = "SystemVariable"
    USER = "User"
    TABLESPACE = "Tablespace"
    PLUGIN = "Plugin"


class UpgradeIssueLevel(StrEnum):
    ERROR = "Error"
    WARNING = "Warning"
    NOTICE = "Notice"


def upgrade_issue_to_message_level(status: UpgradeIssueLevel) -> model.MessageLevel:
    match status:
        case UpgradeIssueLevel.NOTICE:
            return model.MessageLevel.NOTICE

        case UpgradeIssueLevel.WARNING:
            return model.MessageLevel.WARNING

        case UpgradeIssueLevel.ERROR:
            return model.MessageLevel.ERROR

        case _:
            return model.MessageLevel.NOTICE


class UpgradeIssue:
    def __init__(self, args: dict) -> None:
        self.level: UpgradeIssueLevel = UpgradeIssueLevel(args["level"])
        self.description: str = args["description"]
        self.documentation_link: str = args.get("documentationLink", "")
        self.object_name: str = args["dbObject"]
        self.object_type: DbObjectType = DbObjectType(args["dbObjectType"])


class UpgradeCheck:
    def __init__(self, args: dict) -> None:
        self.check_id: str = args["id"]
        self.title: str = args["title"]
        # args["status"] is always set to OK, we skip it here
        self.description: str = args.get("description", "")
        self.documentation_link: str = args.get("documentationLink", "")
        self.issues: list[UpgradeIssue] = [
            UpgradeIssue(issue) for issue in args["detectedProblems"]
        ]
        self.solutions: list[str] = args["solutions"]


def upgrade_issue_to_check_result(check: UpgradeCheck) -> model.CheckResult:
    assert check.issues

    def format_object(issue: UpgradeIssue):
        return f"{issue.object_type.value.lower()}:{issue.object_name}"

    # sort issues by object name
    check.issues = sorted(check.issues, key=lambda issue: issue.object_name)

    result = model.CheckResult()
    result.checkId = check.check_id
    result.level = upgrade_issue_to_message_level(check.issues[0].level)
    result.title = check.title
    result.result = ""

    for issue in check.issues:
        if result.result:
            result.result += "\n"

        result.result += "<li>"

        # make sure the description contains both object name and type
        unquoted = string_utils.unquote_db_object(issue.object_name)
        if not unquoted[0] in issue.description or (1 != len(unquoted) and not unquoted[1] in issue.description):
            if not issue.object_type.value.lower() in issue.description.lower():
                if DbObjectType.FOREIGN_KEY == issue.object_type:
                    result.result += "Foreign key"

                    if 2 == len(unquoted):
                        result.result += " of table"
                else:
                    result.result += issue.object_type.value

                result.result += " "

            result.result += issue.object_name
            result.result += ": "

        result.result += issue.description

    result.description = check.description

    if check.solutions:
        result.description += "\n\n"
        result.description += "You may:\n<li>" + "\n<li>".join(check.solutions)

    if check.documentation_link:
        result.description += "\n\n"
        result.description += f"""For more information, please refer to the <a href="{check.documentation_link}">documentation</a>."""

    result.objects = [format_object(issue) for issue in check.issues]

    # suggested actions and status
    result.choices = [model.CompatibilityFlags.EXCLUDE_OBJECT]

    if result.level == model.MessageLevel.NOTICE:
        result.status = model.CheckStatus.CONFIRMATION_REQUIRED
        result.choices.insert(0, model.CompatibilityFlags.IGNORE)
    else:
        result.status = model.CheckStatus.ACTION_REQUIRED

    return result


def process_upgrade_issues(check_output: dict, results: model.MigrationCheckResults, schema_selection: model.SchemaSelectionOptions):
    assert schema_selection.filter

    filters = filtering_utils.DbFilters(schema_selection.filter)

    for account in checks.k_excluded_users:
        filters.users.exclude(account)

    def include_issue(issue: UpgradeIssue) -> bool:
        match issue.object_type:
            case DbObjectType.SCHEMA:
                return filters.schemas.is_included(issue.object_name)

            case DbObjectType.TABLE | DbObjectType.VIEW:
                return filters.tables.is_included(issue.object_name)

            case DbObjectType.COLUMN | DbObjectType.FOREIGN_KEY | DbObjectType.INDEX:
                unqouted = string_utils.unquote_db_object(issue.object_name)
                return filters.tables.is_included(unqouted[0], unqouted[1])

            case DbObjectType.ROUTINE:
                if not schema_selection.migrateRoutines:
                    return False
                return filters.routines.is_included(issue.object_name)

            case DbObjectType.EVENT:
                if not schema_selection.migrateEvents:
                    return False
                return filters.events.is_included(issue.object_name)

            case DbObjectType.TRIGGER:
                if not schema_selection.migrateTriggers:
                    return False
                return filters.triggers.is_included(issue.object_name)

            case DbObjectType.USER:
                if not schema_selection.migrateUsers:
                    return False
                return filters.users.is_included(issue.object_name)

            case _:
                return True

    for check in check_output["issues"]:
        check = UpgradeCheck(check)

        # we don't report plugin and sysvar issues, these are not migrated
        # we don't report tablespace issues, these are removed by the dumper
        check.issues = [
            issue for issue in check.issues if issue.object_type not in (
                DbObjectType.PLUGIN,
                DbObjectType.SYSVAR,
                DbObjectType.TABLESPACE,
            )
        ]

        # we need to filter by include/exclude lists, as Upgrade Checker
        # currently doesn't have an option to filter DB objects
        check.issues = [
            issue for issue in check.issues if include_issue(issue)
        ]

        if check.issues:
            result = upgrade_issue_to_check_result(check)

            results._apply_status(result.status)
            results.checks.append(result)
