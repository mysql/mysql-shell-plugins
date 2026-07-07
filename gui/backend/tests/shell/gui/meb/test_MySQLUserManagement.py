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

import config
import mysqlsh
import pytest

from gui_plugin.core.dbms.MySQLUserManagement import (
    MySQLGrantRequirement,
    validate_mysql_user_grants,
)


@pytest.fixture(scope="module")
def mysql_session():
    connection = config.Config.get_instance().database_connections[0]["options"].copy()
    mysqlsh.globals.shell.connect(
        f"{connection['user']}:{connection['password']}@{connection['host']}:{connection['port']}"
    )
    session = mysqlsh.globals.session

    yield session

    session.close()


def test_mandatory_roles_with_special_characters(mysql_session):
    variables = {
        row[0].lower(): row[1]
        for row in mysql_session.run_sql(
            "SHOW GLOBAL VARIABLES WHERE Variable_name IN "
            "('activate_mandatory_roles', 'mandatory_roles')"
        ).fetch_all()
    }
    if "activate_mandatory_roles" not in variables:
        pytest.skip("activate_mandatory_roles is required to test mandatory role activation.")

    suffix = uuid.uuid4().hex[:8]
    user = "meb_grant_test_" + suffix
    quoted_role = "meb,'`quoted_" + suffix
    bare_role = "meb_bare_" + suffix

    try:
        mysql_session.run_sql("CREATE USER ?@?", [user, "%"])
        mysql_session.run_sql(
            "CREATE ROLE ?@?, ?@?", [quoted_role, "%", bare_role, "%"]
        )
        mysql_session.run_sql(
            "GRANT !@!, !@! TO !@!", [quoted_role, "%", bare_role, "%", user, "%"]
        )
        mysql_session.run_sql("GRANT SELECT ON *.* TO !@!", [quoted_role, "%"])
        mysql_session.run_sql("GRANT SELECT ON *.* TO !@!", [bare_role, "%"])
        quoted_role_account = "`" + quoted_role.replace("`", "``") + "`@`%`"
        mysql_session.run_sql(
            "SET GLOBAL mandatory_roles = ?",
            [quoted_role_account + "," + bare_role],
        )
        mysql_session.run_sql("SET GLOBAL activate_mandatory_roles = ON")

        validation = validate_mysql_user_grants(
            mysql_session,
            user,
            "%",
            [MySQLGrantRequirement("*.*", ("SELECT",))],
        )

        assert validation.valid
    finally:
        mysql_session.run_sql(
            "SET GLOBAL mandatory_roles = ?", [variables["mandatory_roles"]]
        )
        mysql_session.run_sql(
            "SET GLOBAL activate_mandatory_roles = ?",
            [variables["activate_mandatory_roles"]],
        )
        mysql_session.run_sql("DROP USER IF EXISTS ?@?", [user, "%"])
        mysql_session.run_sql(
            "DROP ROLE IF EXISTS ?@?, ?@?", [quoted_role, "%", bare_role, "%"]
        )
