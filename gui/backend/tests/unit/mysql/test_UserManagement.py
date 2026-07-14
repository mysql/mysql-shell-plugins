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

import uuid
from typing import cast

from mysqlsh.plugin_manager import registrar

import gui_plugin.mysql.UserManagement as mysql_user_management
from gui_plugin.mysql.UserManagement import (
    UserInfo,
    create_user,
    delete_user,
    get_user,
    list_users,
    set_granted_roles,
    update_user,
)
from gui_plugin.mysql.backend.model import MySQLUser
from gui_plugin.core.dbms.DbSession import DbSession



def test_mysql_user_management_functions_are_web_only():
    definitions = {
        definition.fully_qualified_name: definition
        for definition in registrar.get_registry()
    }
    function_names = [
        "listUsers",
        "setGrantedRoles",
        "listGlobalPrivilegeCatalog",
        "listSchemaPrivilegeCatalog",
        "listAuthenticationPlugins",
        "getCreateUserDefaults",
        "setUserGlobalPrivileges",
        "setUserObjectPrivileges",
        "getUser",
        "createUser",
        "deleteUser",
        "updateUser",
    ]

    for function_name in function_names:
        definition = definitions[f"gui.mysql.{function_name}"]
        assert definition.cli is False
        assert definition.web is True


def _drop_account_if_exists(session, user, host):
    session.run_sql("DROP USER IF EXISTS ?@?", [user, host])


def _drop_role_if_exists(session, user, host):
    session.run_sql("DROP ROLE IF EXISTS ?@?", [user, host])


def test_set_granted_roles_uses_default_roles(monkeypatch):
    captured = {}
    fake_session = object()

    def fake_set_granted_roles(session, user, host, roles, default_roles=None):
        captured["args"] = (session, user, host, roles, default_roles)

    monkeypatch.setattr(
        mysql_user_management.user_management,
        "set_granted_roles",
        fake_set_granted_roles,
    )

    set_granted_roles(
        "alice",
        "localhost",
        ["reader@%"],
        cast(DbSession, fake_session),
        default_roles=["reader@%"],
    )

    assert captured["args"] == (
        fake_session,
        "alice",
        "localhost",
        ["reader@%"],
        ["reader@%"],
    )


def test_create_and_update_user_return_user_info(monkeypatch):
    fake_session = object()

    monkeypatch.setattr(
        mysql_user_management.user_management,
        "create_mysql_user",
        lambda session, options: "created-password",
    )
    monkeypatch.setattr(
        mysql_user_management.user_management,
        "update_mysql_user",
        lambda session, options: "updated-password",
    )

    options = MySQLUser(user="alice", host="localhost")

    assert create_user(options, cast(DbSession, fake_session)) == UserInfo(
        generatedPassword="created-password"
    )
    assert update_user(options, cast(DbSession, fake_session)) == UserInfo(
        generatedPassword="updated-password"
    )


def test_mysql_user_management_functions_use_real_session(session):
    suffix = uuid.uuid4().hex[:12]
    user = f"gui_um_{suffix}"
    role = f"gui_um_role_{suffix}"
    host = "%"

    _drop_account_if_exists(session, user, host)
    _drop_role_if_exists(session, role, host)

    try:
        create_user(
            MySQLUser(
                user=user,
                host=host,
                authString="password1",
                maxUserConnections=3,
                comment="GUI user management unit test",
            ),
            session,
        )
        session.run_sql("CREATE ROLE ?@?", [role, host])

        created_user = get_user(user, host, session)
        assert created_user is not None
        assert created_user.user == user
        assert created_user.host == host
        assert created_user.maxUserConnections == 3
        assert created_user.comment == "GUI user management unit test"

        update_user(
            MySQLUser(
                user=user,
                host=host,
                maxUserConnections=5,
            ),
            session,
        )

        updated_user = get_user(user, host, session)
        assert updated_user is not None
        assert updated_user.maxUserConnections == 5

        set_granted_roles(user, host, [f"{role}@{host}"], session)

        listed_user = next(
            item
            for item in list_users(session)
            if item.user == user and item.host == host
        )
        assert f"{role}@{host}" in listed_user.roles

        delete_user(user, host, session)
        assert get_user(user, host, session) is None
    finally:
        _drop_account_if_exists(session, user, host)
        _drop_role_if_exists(session, role, host)


def test_list_users_uses_current_mysql_shell_session(session):
    assert session is not None
    assert list_users()
