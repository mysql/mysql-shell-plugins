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

"""Read the MySQL account metadata needed by the password reset dialog."""

from typing import Any, Literal, Optional

from mysqlsh import mysql  # pyright: ignore[reportMissingImports] pylint: disable=import-error

from gui_plugin.core.dbms.DbMySQLSessionCommon import MySQLData
from gui_plugin.core.dbms.MySQLUserManagement import (
    _mandatory_role_accounts as _parse_role_accounts,
)

INTERNAL_PASSWORD_PLUGINS = {
    "caching_sha2_password",
    "mysql_native_password",
    "sha256_password",
}


class PasswordResetAccount:
    user: Optional[str]
    host: Optional[str]


class PasswordResetCurrentPassword:
    accountSetting: Literal["required", "optional", "default", "unknown"]
    requiredByPolicy: Optional[bool]
    required: bool


class PasswordResetFactor:
    plugin: str
    kind: Literal["internalPassword", "externalPassword"]
    passwordless: bool
    requiresRegistration: Optional[bool]


class PasswordResetInfo:
    account: PasswordResetAccount
    factors: list[PasswordResetFactor]
    sqlResetSupported: Optional[bool]
    retainCurrentPasswordSupported: bool
    currentPassword: PasswordResetCurrentPassword


def _row_value(row: Any, index: int, name: str) -> Any:
    if isinstance(row, dict):
        return row.get(name, row.get(name.lower()))
    if row is None:
        return None
    try:
        return row[index]
    except (IndexError, KeyError, TypeError):
        return None


def _unquote_token(token: dict[str, str]) -> str:
    if token["type"] == "BACK_TICK_QUOTED_ID":
        if token["token"] == "``":
            return ""
        return mysql.unquote_identifier(token["token"])
    if token["type"] in {"SINGLE_QUOTED_TEXT", "DOUBLE_QUOTED_TEXT"}:
        return mysql.unquote_string(token["token"])

    return token["token"]


def _parse_show_create_user(
    statement: str,
) -> tuple[Optional[str], Optional[str], list[str], str, bool]:
    tokens = [
        token for token in mysql.tokenize_statement(statement)
        if not token["type"].endswith("WHITESPACE") and "COMMENT" not in token["type"]
    ]
    token_types = [token["type"] for token in tokens]

    user = host = None
    for index in range(len(tokens) - 4):
        if token_types[index:index + 2] == ["CREATE_SYMBOL", "USER_SYMBOL"] \
                and token_types[index + 3] == "AT_SIGN_SYMBOL":
            user = _unquote_token(tokens[index + 2])
            host = _unquote_token(tokens[index + 4])
            break

    plugins = []
    for index in range(len(tokens) - 2):
        if token_types[index:index + 2] != ["IDENTIFIED_SYMBOL", "WITH_SYMBOL"]:
            continue
        if index >= 2 and token_types[index - 2:index] == ["INITIAL_SYMBOL", "AUTHENTICATION_SYMBOL"]:
            continue
        plugins.append(_unquote_token(tokens[index + 2]))

    setting = "unknown"
    for index in range(len(tokens) - 2):
        if token_types[index:index + 3] != ["PASSWORD_SYMBOL", "REQUIRE_SYMBOL", "CURRENT_SYMBOL"]:
            continue
        following_type = token_types[index + 3] if index + 3 < len(tokens) else None
        setting = {
            "OPTIONAL_SYMBOL": "optional",
            "DEFAULT_SYMBOL": "default",
        }.get(following_type, "required")
        break

    has_initial_authentication = any(
        token_types[index:index + 2] == ["INITIAL_SYMBOL", "AUTHENTICATION_SYMBOL"]
        for index in range(len(tokens) - 1)
    )

    return user, host, plugins, setting, has_initial_authentication


def _default_info(user: Optional[str] = None, host: Optional[str] = None) -> dict[str, Any]:
    return {
        "account": {"user": user, "host": host},
        "sqlResetSupported": None,
        "retainCurrentPasswordSupported": False,
        "currentPassword": {
            "accountSetting": "unknown",
            "requiredByPolicy": None,
            "required": False,
        },
        "factors": [],
    }


def _password_reset_privileges(session: Any) -> tuple[bool, bool, bool]:
    """Return verification exemption, account management, and password management privileges."""
    result = session.execute_thread("SELECT CURRENT_ROLE()", None)
    row = result.fetch_one() if result is not None else None
    active_roles = _parse_role_accounts(str(_row_value(row, 0, "CURRENT_ROLE()")))

    statement = "SHOW GRANTS"
    params = None
    if active_roles:
        statement = "SHOW GRANTS FOR CURRENT_USER USING " + ", ".join(
            "!@!" for _ in active_roles
        )
        params = [part for role in active_roles for part in role]

    result = session.execute_thread(statement, params)
    rows = result.fetch_all() if result is not None else []
    global_privileges: set[str] = set()
    for row in rows:
        tokens = [token for token in mysql.tokenize_statement(str(row[0]))
                  if not token["type"].endswith("WHITESPACE") and "COMMENT" not in token["type"]]
        if not tokens or tokens[0]["token"].upper() not in {"GRANT", "REVOKE"}:
            continue
        on_index = next((i for i, token in enumerate(tokens) if token["type"] == "ON_SYMBOL"), None)
        if on_index is None:
            continue
        scope = "".join(_unquote_token(token) for token in tokens[on_index + 1:on_index + 4])
        if scope != "*.*" or tokens[0]["token"].upper() != "GRANT":
            continue
        names = " ".join(token["token"].upper() for token in tokens[1:on_index])
        granted = {name.strip() for name in names.split(",")}
        global_privileges.update(granted)

    can_manage_all_accounts = bool({"CREATE USER", "ALL PRIVILEGES"} & global_privileges)
    # UPDATE on mysql.* is a legacy account-management path. Intentionally do
    # not offer it here because it encourages direct system-table updates.
    return (
        can_manage_all_accounts,
        can_manage_all_accounts,
        "APPLICATION_PASSWORD_ADMIN" in global_privileges,
    )


def discover_password_reset_info(session: Any, user: Optional[str] = None,
                                 host: Optional[str] = None,
                                 password_expired: bool = False) -> PasswordResetInfo:
    """Returns reset support and current-password requirements for an account."""
    if (user is None) != (host is None):
        raise ValueError("Both user and host must be specified together.")

    lock = getattr(session, "lock", None)
    if callable(lock):
        lock()
    try:
        if not password_expired:
            activate_all_roles = getattr(session, "activate_all_roles", None)
            if activate_all_roles is not None:
                activate_all_roles()
        return _discover_password_reset_info(session, user, host, password_expired)
    finally:
        if callable(lock):
            session.release()


def _discover_password_reset_info(session: Any, user: Optional[str] = None,
                                  host: Optional[str] = None,
                                  password_expired: bool = False) -> PasswordResetInfo:
    is_current_account = user is None
    info = _default_info()
    if password_expired:
        # Server version cannot be queried in expired-password mode. Always ask
        # for the current password and version-gate REPLACE in the reset SQL.
        info["currentPassword"]["required"] = True
        return info

    version = str(getattr(session, "data", {}).get(MySQLData.VERSION_INFO, "0.0.0")).split("-", 1)[0]
    version_parts = tuple(int(part) for part in version.split(".")[:3])
    verification_supported = version_parts >= (8, 0, 13)
    retain_current_password_supported = version_parts >= (8, 0, 14)

    if user is None:
        result = session.execute_thread("SHOW CREATE USER CURRENT_USER", None)
    else:
        result = session.execute_thread("SHOW CREATE USER ?@?", [user, host])
    row = result.fetch_one() if result is not None else None
    statement = _row_value(row, 1, "Create User") or _row_value(row, 0, "create_user")
    if not statement:
        raise ValueError("SHOW CREATE USER returned no account statement.")

    user, host, plugins, setting, has_initial_authentication = _parse_show_create_user(str(statement))
    info["account"] = {"user": user, "host": host}
    info["currentPassword"]["accountSetting"] = setting
    if setting == "required":
        info["currentPassword"]["requiredByPolicy"] = True
    elif setting == "optional":
        info["currentPassword"]["requiredByPolicy"] = False
    elif setting == "default":
        result = session.execute_thread("SELECT @@password_require_current", None)
        row = result.fetch_one() if result is not None else None
        value = _row_value(row, 0, "@@password_require_current")
        info["currentPassword"]["requiredByPolicy"] = str(value).upper() in {"1", "ON", "TRUE"}
    info["currentPassword"]["required"] = (
        verification_supported and info["currentPassword"]["requiredByPolicy"] is True
    )

    passwordless_webauthn = len(plugins) == 1 and plugins[0].lower() == "authentication_webauthn"
    info["factors"] = [
        {
            "plugin": plugin,
            "kind": "internalPassword" if plugin.lower() in INTERNAL_PASSWORD_PLUGINS else "externalPassword",
            "passwordless": passwordless_webauthn and index == 0,
            "requiresRegistration": True
            if passwordless_webauthn and index == 0 and has_initial_authentication
            else None,
        }
        for index, plugin in enumerate(plugins)
    ]
    info["sqlResetSupported"] = bool(plugins and plugins[0].lower() in INTERNAL_PASSWORD_PLUGINS)
    if info["sqlResetSupported"] and verification_supported:
        privileged_reset, can_manage_accounts, can_manage_passwords = _password_reset_privileges(session)
        info["currentPassword"]["required"] = info["currentPassword"]["required"] and not privileged_reset
        if (retain_current_password_supported and can_manage_passwords
                and not can_manage_accounts and not is_current_account):
            result = session.execute_thread("SHOW CREATE USER CURRENT_USER", None)
            row = result.fetch_one() if result is not None else None
            current_statement = _row_value(row, 1, "Create User") or _row_value(row, 0, "create_user")
            current_user, current_host, *_ = _parse_show_create_user(str(current_statement or ""))
            is_current_account = (user, host) == (current_user, current_host)
        info["retainCurrentPasswordSupported"] = retain_current_password_supported and (
            can_manage_accounts or (is_current_account and can_manage_passwords)
        )

    return info
