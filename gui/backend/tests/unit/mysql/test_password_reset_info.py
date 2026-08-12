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

from unittest.mock import Mock

import pytest

from gui_plugin.mysql.PasswordResetInfo import discover_password_reset_info
from gui_plugin.core.dbms.DbMySQLSessionCommon import MySQLData


class Result:
    def __init__(self, row):
        self.row = row

    def fetch_one(self):
        return self.row

    def fetch_all(self):
        return self.row


class Session:
    connection_options = {"host": "localhost"}
    data = {MySQLData.VERSION_INFO: "8.4.0"}

    def execute_thread(self, sql, _params=None):
        if sql == "SHOW CREATE USER CURRENT_USER":
            return Result([
                "Create User for app@localhost",
                "CREATE USER `expire`@`%` IDENTIFIED WITH 'caching_sha2_password' AS <secret> "
                "REQUIRE NONE PASSWORD EXPIRE DEFAULT ACCOUNT UNLOCK PASSWORD HISTORY DEFAULT "
                "PASSWORD REUSE INTERVAL DEFAULT PASSWORD REQUIRE CURRENT",
            ])
        if sql == "SHOW GRANTS":
            return Result([["GRANT APPLICATION_PASSWORD_ADMIN ON *.* TO `app`@`localhost`"]])
        if sql == "SELECT CURRENT_ROLE()":
            return Result(["NONE"])
        raise AssertionError(sql)


def test_internal_password_authentication_is_supported():
    info = discover_password_reset_info(Session())

    assert info["sqlResetSupported"] is True
    assert info["retainCurrentPasswordSupported"] is True
    assert info["currentPassword"]["requiredByPolicy"] is True
    assert info["currentPassword"]["required"] is True
    assert info["account"] == {"user": "expire", "host": "%"}
    assert info["factors"][0]["kind"] == "internalPassword"


def test_password_reset_discovery_activates_all_roles():
    session = Session()
    events = []
    session.activate_all_roles = lambda: events.append("activate all roles")
    session.lock = lambda: events.append("lock")
    session.release = lambda: events.append("release")

    discover_password_reset_info(session)

    assert events == ["lock", "activate all roles", "release"]


class DiscoverySession:
    def __init__(self, statement, grants=None, default=None, error=None, connection_options=None,
                 version="8.4.0", active_roles="NONE", active_role_grants=None, current_statement=None):
        self.statement = statement
        self.current_statement = current_statement
        self.grants = grants or []
        self.default = default
        self.error = error
        self.active_roles = active_roles
        self.active_role_grants = active_role_grants
        self.calls = []
        self.connection_options = connection_options or {"host": "db.example"}
        self.data = {MySQLData.VERSION_INFO: version}

    def execute_thread(self, sql, params=None):
        self.calls.append((sql, params))
        if sql.startswith("SHOW CREATE USER"):
            if self.error:
                raise self.error
            statement = self.current_statement if sql == "SHOW CREATE USER CURRENT_USER" else None
            statement = statement or self.statement
            return Result(["Create User", statement]) if statement else None
        if sql == "SELECT CURRENT_ROLE()":
            return Result([self.active_roles])
        if sql.startswith("SHOW GRANTS"):
            grants = (
                self.active_role_grants
                if "USING" in sql and self.active_role_grants is not None
                else self.grants
            )
            return Result([[grant] for grant in grants])
        if sql == "SELECT @@password_require_current":
            return Result([self.default])
        raise AssertionError(sql)


def test_anonymous_current_account_is_supported():
    session = DiscoverySession(
        "CREATE USER ``@`localhost` IDENTIFIED WITH caching_sha2_password AS <secret>"
    )

    info = discover_password_reset_info(session)

    assert info["account"] == {"user": "", "host": "localhost"}


def test_expired_password_reset_info_skips_account_metadata():
    session = DiscoverySession(
        "CREATE USER `app`@`localhost` IDENTIFIED WITH caching_sha2_password AS <secret>",
        connection_options={"host": "localhost"},
    )
    session.data = {}

    info = discover_password_reset_info(session, password_expired=True)

    assert info["factors"] == []
    assert info["currentPassword"]["required"] is True
    assert session.calls == []


def test_old_servers_do_not_advertise_replace_or_retain_current_password():
    session = DiscoverySession(
        "CREATE USER `app`@`localhost` IDENTIFIED WITH caching_sha2_password AS <secret>",
        grants=["GRANT APPLICATION_PASSWORD_ADMIN ON *.* TO `app`@`localhost`"],
        version="8.0.12",
    )

    info = discover_password_reset_info(session)

    assert info["currentPassword"]["required"] is False
    assert info["retainCurrentPasswordSupported"] is False


def test_external_only_authentication_does_not_support_password_reset():
    session = DiscoverySession(
        "CREATE USER `external`@`%` IDENTIFIED WITH authentication_ldap_sasl AS 'uid=external'"
    )

    info = discover_password_reset_info(session)

    assert info["sqlResetSupported"] is False
    assert info["retainCurrentPasswordSupported"] is False
    assert info["factors"] == [{
        "plugin": "authentication_ldap_sasl",
        "kind": "externalPassword",
        "passwordless": False,
        "requiresRegistration": None,
    }]
    assert not any(sql == "SHOW GRANTS" for sql, _ in session.calls)


def test_only_factor_one_can_support_password_reset():
    session = DiscoverySession(
        "CREATE USER `mixed`@`%` IDENTIFIED WITH authentication_ldap_sasl AS 'uid=mixed' "
        "AND IDENTIFIED WITH caching_sha2_password AS '$A$005$hash'",
        grants=["GRANT CREATE USER ON *.* TO `mixed`@`%`"],
    )

    info = discover_password_reset_info(session)

    assert info["sqlResetSupported"] is False
    assert info["retainCurrentPasswordSupported"] is False
    assert [factor["kind"] for factor in info["factors"]] == ["externalPassword", "internalPassword"]
    assert not any(sql == "SHOW GRANTS" for sql, _ in session.calls)


def test_passwordless_webauthn_excludes_initial_authentication_factor():
    session = DiscoverySession(
        "CREATE USER `device`@`%` IDENTIFIED WITH authentication_webauthn "
        "INITIAL AUTHENTICATION IDENTIFIED WITH caching_sha2_password AS <secret>"
    )

    info = discover_password_reset_info(session)

    assert info["sqlResetSupported"] is False
    assert info["factors"] == [{
        "plugin": "authentication_webauthn",
        "kind": "externalPassword",
        "passwordless": True,
        "requiresRegistration": True,
    }]


@pytest.mark.parametrize(("suffix", "default", "expected"), [
    ("PASSWORD REQUIRE CURRENT", None, True),
    ("PASSWORD REQUIRE CURRENT OPTIONAL", None, False),
    ("PASSWORD REQUIRE CURRENT DEFAULT", "ON", True),
    ("PASSWORD REQUIRE CURRENT DEFAULT", "OFF", False),
])
def test_password_require_current_settings(suffix, default, expected):
    session = DiscoverySession(
        f"CREATE USER `app`@`localhost` IDENTIFIED WITH caching_sha2_password AS <secret> {suffix}",
        default=default,
    )

    info = discover_password_reset_info(session)

    assert info["currentPassword"]["requiredByPolicy"] is expected
    assert ("SELECT @@password_require_current", None) in session.calls if default is not None else \
        ("SELECT @@password_require_current", None) not in session.calls


@pytest.mark.parametrize("grants, expected, version", [
    (["GRANT APPLICATION_PASSWORD_ADMIN ON *.* TO `app`@`localhost`"], True, "8.4.0"),
    (["GRANT CREATE USER ON *.* TO `app`@`localhost`"], True, "8.4.0"),
    (["GRANT ALL PRIVILEGES ON *.* TO `app`@`localhost`"], True, "8.0.14"),
    (["GRANT UPDATE ON `mysql`.* TO `app`@`localhost`"], False, "8.4.0"),
    (["GRANT SELECT ON *.* TO `app`@`localhost`"], False, "8.4.0"),
])
def test_selected_account_retain_current_password_requires_privilege(grants, expected, version):
    session = DiscoverySession(
        "CREATE USER `app`@`localhost` IDENTIFIED WITH caching_sha2_password AS <secret>",
        grants=grants,
        version=version,
    )

    assert discover_password_reset_info(session, "app", "localhost")["retainCurrentPasswordSupported"] is expected


@pytest.mark.parametrize("grants, expected", [
    (["GRANT APPLICATION_PASSWORD_ADMIN ON *.* TO `app`@`localhost`"], True),
    (["GRANT CREATE USER ON *.* TO `app`@`localhost`"], True),
    (["GRANT ALL PRIVILEGES ON *.* TO `app`@`localhost`"], True),
    (["GRANT SELECT ON *.* TO `app`@`localhost`"], False),
])
def test_current_account_retain_current_password_requires_privilege(grants, expected):
    session = DiscoverySession(
        "CREATE USER `app`@`localhost` IDENTIFIED WITH caching_sha2_password AS <secret>",
        grants=grants,
    )

    assert discover_password_reset_info(session)["retainCurrentPasswordSupported"] is expected


@pytest.mark.parametrize(
    "privilege,target,user,host",
    [
        ("APPLICATION_PASSWORD_ADMIN", "*.*", None, None),
        ("CREATE USER", "*.*", "selected", "localhost"),
    ],
)
def test_retain_current_password_uses_active_role_privileges(
    privilege, target, user, host,
):
    session = DiscoverySession(
        "CREATE USER `selected`@`localhost` "
        "IDENTIFIED WITH caching_sha2_password AS <secret>",
        grants=["GRANT `account_admin`@`%` TO `app`@`localhost`"],
        active_roles="`account_admin`@`%`",
        active_role_grants=[
            f"GRANT {privilege} ON {target} TO `app`@`localhost`",
        ],
    )

    info = discover_password_reset_info(session, user, host)

    assert info["retainCurrentPasswordSupported"] is True
    assert (
        "SHOW GRANTS FOR CURRENT_USER USING !@!",
        ["account_admin", "%"],
    ) in session.calls


def test_selected_account_uses_requested_user_and_host():
    session = DiscoverySession(
        "CREATE USER `selected`@`host.example` IDENTIFIED WITH caching_sha2_password AS <secret>"
    )

    info = discover_password_reset_info(session, "selected", "host.example")

    assert session.calls[0] == ("SHOW CREATE USER ?@?", ["selected", "host.example"])
    assert info["account"] == {"user": "selected", "host": "host.example"}


@pytest.mark.parametrize("statement, error", [
    (None, None),
    (None, RuntimeError("SHOW CREATE USER denied")),
])
def test_show_create_user_failures_are_reported(statement, error):
    session = DiscoverySession(statement, error=error)

    with pytest.raises((ValueError, RuntimeError)):
        discover_password_reset_info(session)


@pytest.mark.parametrize("grants,required", [
    (["GRANT CREATE USER ON *.* TO `app`@`localhost`"], False),
    (["GRANT ALL PRIVILEGES ON *.* TO `app`@`localhost`"], False),
    (["GRANT UPDATE ON `mysql`.* TO `app`@`localhost`"], True),
    (["GRANT UPDATE ON *.* TO `app`@`localhost`"], True),
    (["GRANT UPDATE ON *.* TO `app`@`localhost`",
      "REVOKE UPDATE ON `mysql`.* FROM `app`@`localhost`"], True),
    (["GRANT APPLICATION_PASSWORD_ADMIN ON *.* TO `app`@`localhost`"], True),
    (["GRANT SELECT ON *.* TO `CREATE USER`@`localhost`"], True),
    (["GRANT SELECT ON *.* TO `APPLICATION_PASSWORD_ADMIN`@`localhost`"], True),
])
@pytest.mark.parametrize("active_role", [False, True])
def test_current_password_requirement_uses_effective_privileges(grants, required, active_role):
    session = DiscoverySession(
        "CREATE USER `app`@`localhost` IDENTIFIED WITH caching_sha2_password AS <secret> "
        "PASSWORD REQUIRE CURRENT",
        grants=[] if active_role else grants,
        active_roles="`account_admin`@`%`" if active_role else "NONE",
        active_role_grants=grants if active_role else None,
    )

    info = discover_password_reset_info(session)

    assert info["currentPassword"]["requiredByPolicy"] is True
    assert info["currentPassword"]["required"] is required


@pytest.mark.parametrize("current_account,expected", [("app", True), ("other", False)])
def test_selected_account_retention_checks_authenticated_identity(current_account, expected):
    session = DiscoverySession(
        "CREATE USER `app`@`localhost` IDENTIFIED WITH caching_sha2_password AS <secret>",
        current_statement=f"CREATE USER `{current_account}`@`localhost` "
                          "IDENTIFIED WITH caching_sha2_password AS <secret>",
        grants=["GRANT APPLICATION_PASSWORD_ADMIN ON *.* TO `app`@`localhost`"],
    )

    info = discover_password_reset_info(session, "app", "localhost")

    assert info["retainCurrentPasswordSupported"] is expected
