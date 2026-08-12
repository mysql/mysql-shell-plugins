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
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional, cast

import mysqlsh  # pyright: ignore[reportMissingImports] pylint: disable=import-error
from mysqlsh.plugin_manager import (  # pyright: ignore[reportMissingImports] # pylint: disable=no-name-in-module,import-error
    plugin_function,
)

import gui_plugin.mysql.backend.user_management as user_management  # pyright: ignore[reportMissingImports] # pylint: disable=no-name-in-module,import-error
from gui_plugin.mysql.backend.model import (
    MySQLUserListItem,
    MySQLGlobalPrivilegeCatalogItem,
    MySQLDefaultUserOptions,
    MySQLUser,
    MySQLObjectPrivilegeSchemaTarget,
    ObjectPrivilegeTarget,
    UserInfo,
)
from gui_plugin.core.dbms.DbSession import DbSession
from gui_plugin.core.dbms.DbMySQLSessionCommon import is_secure_mysql_transport
from gui_plugin.mysql.PasswordResetInfo import (
    PasswordResetInfo,
    discover_password_reset_info,
)

get_global_shell_session = cast(
    Callable[[], DbSession], mysqlsh.globals.shell.get_session
)


@plugin_function("gui.mysql.listUsers", cli=False, web=True)
def list_users(session: Optional[DbSession] = None) -> list[MySQLUserListItem]:
    """
    Lists MySQL users using the provided session object.

    Args:
        session (object): Session object with a run_sql method.

    Returns:
        list[MySQLUserListItem]: The MySQL user accounts.
    """
    if session is None:
        session = get_global_shell_session()

    activate_all_roles = getattr(session, "activate_all_roles", None)
    if activate_all_roles is not None:
        activate_all_roles()
    else:
        session.run_sql("SET ROLE ALL")

    return user_management.list_mysql_users(session)


@plugin_function("gui.mysql.setGrantedRoles", cli=False, web=True)
def set_granted_roles(
    user: str,
    host: str,
    roles: list[str],
    session: Optional[DbSession] = None,
    default_roles: Optional[list[str]] = None,
) -> None:
    """
    Replaces the granted/default roles for the given MySQL user account.

    Args:
        user (str): The username of the MySQL user to update.
        host (str): The host of the MySQL user to update.
        roles (list): The full list of selected role account identifiers.
        default_roles (list): The selected role account identifiers to set as default.
        session (object): Session object with a run_sql method.

    Returns:
        None: This function does not return a value.
    """
    if session is None:
        session = get_global_shell_session()

    user_management.set_granted_roles(session, user, host, roles, default_roles)


@plugin_function("gui.mysql.listGlobalPrivilegeCatalog", cli=False, web=True)
def list_global_privilege_catalog(
    session: Optional[DbSession] = None,
) -> list[MySQLGlobalPrivilegeCatalogItem]:
    """
    Lists global privileges supported by the connected MySQL server.

    Args:
        session (object): Session object with a run_sql method.

    Returns:
        list[MySQLGlobalPrivilegeCatalogItem]: The supported global privileges.
    """
    if session is None:
        session = get_global_shell_session()

    return user_management.list_global_privilege_catalog(session)


@plugin_function("gui.mysql.listSchemaPrivilegeCatalog", cli=False, web=True)
def list_schema_privilege_catalog(
    session: Optional[DbSession] = None,
) -> list[MySQLGlobalPrivilegeCatalogItem]:
    """
    Lists schema-level privileges supported by the connected MySQL server.

    Args:
        session (object): Session object with a run_sql method.

    Returns:
        list[MySQLGlobalPrivilegeCatalogItem]: The supported schema privileges.
    """
    if session is None:
        session = get_global_shell_session()

    return user_management.list_schema_privilege_catalog(session)


@plugin_function("gui.mysql.listObjectPrivilegeSchemaTargets", cli=False, web=True)
def list_object_privilege_schema_targets(
    schema: str, session: Optional[DbSession] = None,
) -> list[MySQLObjectPrivilegeSchemaTarget]:
    """Lists tables and routines in a schema for object privilege assignment.

    Args:
        schema (str): The schema name.
        session (object): Session object with a run_sql method.

    Returns:
        list[MySQLObjectPrivilegeSchemaTarget]: The schema's tables and routines.
    """
    if session is None:
        session = get_global_shell_session()

    return user_management.list_object_privilege_schema_targets(session, schema)


@plugin_function("gui.mysql.listAuthenticationPlugins", cli=False, web=True)
def list_authentication_plugins(session: Optional[DbSession] = None) -> list[str]:
    """
    Lists authentication plugins supported by the connected MySQL server.

    Args:
        session (object): Session object with a run_sql method.

    Returns:
        list[str]: The supported authentication plugin names.
    """
    if session is None:
        session = get_global_shell_session()

    return user_management.list_authentication_plugins(session)


@plugin_function("gui.mysql.getBundledAuthenticationPlugins", cli=False, web=True)
def get_bundled_authentication_plugins() -> list[str]:
    """Returns authentication plugins bundled with MySQL Shell."""

    plugin_dir = Path(mysqlsh.globals.shell.options["mysqlPluginDir"])
    client_plugin_suffix = (
        "_client.dll" if sys.platform == "win32" else "_client.so"
    )
    try:
        bundled_plugins = {
            entry.name.removesuffix(client_plugin_suffix)
            for entry in plugin_dir.iterdir()
            if entry.is_file() and entry.name.endswith(client_plugin_suffix)
        }
    except OSError:
        bundled_plugins = set()

    return [
        "password",
        *sorted(bundled_plugins),
    ]


@plugin_function("gui.mysql.getCreateUserDefaults", cli=False, web=True)
def get_create_user_defaults(
    session: Optional[DbSession] = None,
) -> MySQLDefaultUserOptions:
    """
    Returns server default values used to initialize the create user dialog.

    Args:
        session (object): Session object with a run_sql method.

    Returns:
        MySQLDefaultUserOptions: The server defaults for user creation.
    """
    if session is None:
        session = get_global_shell_session()

    return user_management.get_create_user_defaults(session)


@plugin_function("gui.mysql.getPasswordResetInfo", cli=False, web=True)
def get_password_reset_info(
    user: Optional[str] = None,
    host: Optional[str] = None,
    password_expired: bool = False,
    session: Optional[DbSession] = None,
) -> PasswordResetInfo:
    """Returns password reset metadata for an account.

    Args:
        user (str): The account user name. If omitted, the current user is inspected.
        host (str): The account host name. If omitted, the current user is inspected.
        password_expired (bool): Whether the session is limited to password recovery.
        session (object): Session object used to inspect the account.

    Returns:
        PasswordResetInfo: Password reset support and current-password requirements.
    """
    if session is None:
        raise ValueError("Password reset is only supported from a GUI database session.")

    if session.database_type != "MySQL":
        raise ValueError("Password reset is only supported for MySQL connections.")

    if not is_secure_mysql_transport(session.connection_options):
        raise ValueError("Password reset requires SSL Mode Required, Verify CA, or Verify Identity.")

    return discover_password_reset_info(session, user, host, password_expired)


@plugin_function("gui.mysql.setUserGlobalPrivileges", cli=False, web=True)
def set_user_global_privileges(
    user: str, host: str, privileges: list[str], session: Optional[DbSession] = None
) -> None:
    """
    Replaces the direct global privileges for the given MySQL user account.

    Args:
        user (str): The username of the MySQL user to update.
        host (str): The host of the MySQL user to update.
        privileges (list): The full list of selected global privileges.
        session (object): Session object with a run_sql method.

    Returns:
        None: This function does not return a value.
    """
    if session is None:
        session = get_global_shell_session()

    user_management.set_user_global_privileges(session, user, host, privileges)


@plugin_function("gui.mysql.setUserObjectPrivileges", cli=False, web=True)
def set_user_object_privileges(
    user: str,
    host: str,
    target: ObjectPrivilegeTarget,
    privileges: list[str],
    session: Optional[DbSession] = None,
) -> None:
    """
    Replaces the direct object privileges for the given MySQL user account.

    Args:
        user (str): The username of the MySQL user to update.
        host (str): The host of the MySQL user to update.
        target (object): The target object descriptor.
        privileges (list): The full list of selected object privileges.
        session (object): Session object with a run_sql method.

    Returns:
        None: This function does not return a value.
    """
    if session is None:
        session = get_global_shell_session()

    user_management.set_user_object_privileges(session, user, host, target, privileges)


@plugin_function("gui.mysql.getUser", cli=False, web=True)
def get_user(
    user: str, host: str, session: Optional[DbSession] = None
) -> Optional[MySQLUser]:
    """
    Retrieves a MySQL user by username and host using the provided session object.

    Args:
        user (str): The username of the MySQL user to retrieve.
        host (str): The host of the MySQL user to retrieve.
        session (object): Session object with a run_sql method

    Returns:
        Optional[MySQLUser]: The requested user, or None if it does not exist.
    """
    if session is None:
        session = get_global_shell_session()

    return user_management.get_mysql_user(session, user, host)


@plugin_function("gui.mysql.createUser", cli=False, web=True)
def create_user(options: MySQLUser, session: Optional[DbSession] = None) -> UserInfo:
    """
    Creates a MySQL user with the specified username, host, password
    and options using the provided session object.

    Args:
        options (object): An object containing various options for user creation, such as authentication options, resource limits, password options, etc.
        session (object): Session object with a run_sql method (accepts statement and optional args).

    Returns:
        UserInfo: Information about the created user, including a generated password when requested.
    """
    if session is None:
        session = get_global_shell_session()

    return UserInfo(
        generatedPassword=user_management.create_mysql_user(session, options)
    )


@plugin_function("gui.mysql.deleteUser", cli=False, web=True)
def delete_user(user: str, host: str, session: Optional[DbSession] = None) -> None:
    """
    Deletes a MySQL user with the specified username
    and host using the provided session object.

    Args:
        user (str): The username of the MySQL user to delete.
        host (str): The host of the MySQL user to delete.
        session (object): Session object with a run_sql method (accepts statement and optional args).

    Returns:
        None: This function does not return a value.
    """
    if session is None:
        session = get_global_shell_session()

    user_management.delete_mysql_user(session, user, host)


@plugin_function("gui.mysql.updateUser", cli=False, web=True)
def update_user(options: MySQLUser, session: Optional[DbSession] = None) -> UserInfo:
    """
    Updates a MySQL user details, specified by the user and host, with the options.

    Args:
        options (object): An object containing various options for user update, such as authentication options, resource limits, password options, etc.
        session (object): Session object with a run_sql method (accepts statement and optional args).

    Returns:
        UserInfo: Information about the updated user, including a generated password when requested.
    """
    if session is None:
        session = get_global_shell_session()

    return UserInfo(
        generatedPassword=user_management.update_mysql_user(session, options)
    )
