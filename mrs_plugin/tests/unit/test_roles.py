# Copyright (c) 2023, 2025, Oracle and/or its affiliates.
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

import pytest

from ...roles import *
from mrs_plugin import lib
from .helpers import get_default_role_init, RoleCT, QueryResults, TableContents


def test_sql(phone_book):
    session = phone_book["session"]

    session.run_sql("use rest service localhost/test")

    with QueryResults(lambda: session.run_sql("show rest roles")) as qr:
        session.run_sql('create rest role "myrole"')

        qr.expect_added(
            [
                {
                    "REST role": "myrole",
                    "derived_from_role": "",
                    "description": "",
                    "options": "{}",
                    "specific_to_service": "localhost/test",
                }
            ]
        )
        session.run_sql('create rest role "myrole2" on service localhost/test')
        qr.expect_added(
            [
                {
                    "REST role": "myrole",
                    "derived_from_role": "",
                    "description": "",
                    "options": "{}",
                    "specific_to_service": "localhost/test",
                },
                {
                    "REST role": "myrole2",
                    "derived_from_role": "",
                    "description": "",
                    "options": "{}",
                    "specific_to_service": "localhost/test",
                },
            ]
        )

        session.run_sql('create rest role "myrole3" extends "myrole"')
        qr.expect_added(
            [
                {
                    "REST role": "myrole",
                    "derived_from_role": "",
                    "description": "",
                    "options": "{}",
                    "specific_to_service": "localhost/test",
                },
                {
                    "REST role": "myrole2",
                    "derived_from_role": "",
                    "description": "",
                    "options": "{}",
                    "specific_to_service": "localhost/test",
                },
                {
                    "REST role": "myrole3",
                    "derived_from_role": "myrole",
                    "description": "",
                    "options": "{}",
                    "specific_to_service": "localhost/test",
                },
            ]
        )

    with QueryResults(lambda: session.run_sql("show rest roles")) as qr:
        session.run_sql('drop rest role "myrole3"')
        session.run_sql('drop rest role "myrole2"')
        session.run_sql('drop rest role "myrole"')

        qr.expect_removed(
            [
                {
                    "REST role": "myrole3",
                    "derived_from_role": "myrole",
                    "description": "",
                    "options": "{}",
                    "specific_to_service": "localhost/test",
                },
                {
                    "REST role": "myrole2",
                    "derived_from_role": "",
                    "description": "",
                    "options": "{}",
                    "specific_to_service": "localhost/test",
                },
                {
                    "REST role": "myrole",
                    "derived_from_role": "",
                    "description": "",
                    "options": "{}",
                    "specific_to_service": "localhost/test",
                },
            ]
        )


def test_sql_show(phone_book):
    session = phone_book["session"]

    def count_table(table):
        return session.run_sql(
            "select count(*) from mysql_rest_service_metadata.!", [table]
        ).fetch_one()[0]

    num_services = count_table("service")
    num_user = count_table("mrs_user")
    num_role = count_table("mrs_role")
    num_auth_app = count_table("auth_app")
    num_privilege = count_table("mrs_privilege")
    num_service_has_auth_app = count_table("service_has_auth_app")

    session.run_sql("create rest service /rtest")
    session.run_sql("create rest service /rtest2")

    session.run_sql("use rest service /rtest2")

    session.run_sql('create rest auth app "MRSApp" vendor MRS')
    session.run_sql('create rest auth app "MySQLApp" vendor MySQL')

    session.run_sql('create rest role "roleA" on any service')
    session.run_sql('create rest role "roleB" on any service')
    session.run_sql('create rest role "roleC"')  # default to active service (test2)

    session.run_sql('create rest role "roleD" on service /rtest')
    session.run_sql('create rest role "roleE" on service /rtest2')

    session.run_sql("use rest service /rtest")

    session.run_sql('create rest user "me"@"MRSApp" identified by "pwd"')
    session.run_sql('create rest user "tuser"@"MRSApp" identified by "pwd"')
    session.run_sql('create rest user "demo"@"MySQLApp"')
    session.run_sql('create rest user "me"@"MySQLApp"')
    session.run_sql('grant rest role "roleD" to "me"@"MRSApp"')

    session.run_sql("use rest service /rtest2")

    #session.run_sql('grant rest role "roleA" to "me"@"MRSApp"')
    #session.run_sql('grant rest role "roleA" to "me"@"MySQLApp"')
    #session.run_sql('grant rest role "roleB" to "me"@"MRSApp"')

    # with pytest.raises(Exception) as e:
    #     session.run_sql(
    #         'grant rest role "roleB" to "tuser"@"MRSApp"'
    #     )  # this is from /tuser
    # assert 'User "tuser"@"MRSApp" was not found' in str(e)

    #session.run_sql('grant rest role "roleB" to "tuser2"@"MRSApp"')
    #session.run_sql('grant rest role "roleC" to "demo"@"MySQLApp"')

    import mysqlsh

    def role_names(res):
        rows = res.fetch_all()
        return set([row[0] for row in rows])

    mysqlsh.globals.shell.dump_rows(
        session.run_sql(
            """select r.id, r.caption, r.specific_to_service_id, s.url_context_root,
                (select group_concat(u.name, '@', a.name) from mysql_rest_service_metadata.mrs_user_has_role j
                        join mysql_rest_service_metadata.mrs_user u on u.id = j.user_id
                        join mysql_rest_service_metadata.auth_app a on a.id = u.auth_app_id
                         where j.role_id = r.id) as users
            from mysql_rest_service_metadata.mrs_role r
            left join service s on r.specific_to_service_id = s.id"""
        )
    )

    mysqlsh.globals.shell.dump_rows(
        session.run_sql(
            """select
                        u.id, s.url_context_root, u.name, a.name from mysql_rest_service_metadata.mrs_user u
                            join mysql_rest_service_metadata.auth_app a
                                on a.id = u.auth_app_id
                            join mysql_rest_service_metadata.service_has_auth_app sa on sa.auth_app_id = a.id
                            join mysql_rest_service_metadata.service s on s.id = sa.service_id
            """
        )
    )

    global_roles = {"roleA", "roleB", "Full Access"}

    # all roles that exist
    session.run_sql("use rest service /rtest")
    r = session.run_sql("show rest roles")
    assert role_names(r) == {"roleD"} | global_roles

    session.run_sql("use rest service /rtest2")
    r = session.run_sql("show rest roles")
    assert role_names(r) == {"roleC", "roleE"} | global_roles

    real_all_roles = set([r[0] for r in session.run_sql("select caption from mysql_rest_service_metadata.mrs_role").fetch_all()])

    r = session.run_sql("show rest roles from any service")
    assert role_names(r) == real_all_roles

    # for a given auth_app
    # r = session.run_sql('show rest roles for @"MRSApp"')
    # assert role_names(r) == {"roleA", "roleB"}

    # r = session.run_sql('show rest roles on any service for @"MRSApp"')
    # assert role_names(r) == {"roleA", "roleB", "roleD"}

    # r = session.run_sql('show rest roles for @"MySQLApp"')
    # assert role_names(r) == {"roleA", "roleC"}

    # # for a given user of an auth_app
    # r = session.run_sql('show rest roles for "me"@"MRSApp"')  # default /rtest2
    # assert role_names(r) == {"roleA", "roleB"}

    # r = session.run_sql('show rest roles on service /rtest for "me"@"MRSApp"')
    # assert role_names(r) == {"roleD"}

    # r = session.run_sql('show rest roles on any service for "me"@"MRSApp"')
    # assert role_names(r) == {"roleA", "roleB", "roleD"}

    # for a service
    # r = session.run_sql("show rest roles on service /rtest")
    # mysqlsh.globals.shell.dump_rows(r)

    # # for a given auth_app of a service
    # r = session.run_sql('show rest roles on service /rtest for @"MRSApp"')
    # mysqlsh.globals.shell.dump_rows(r)
    # # for a given user of an auth_app of a service
    # r = session.run_sql('show rest roles on service /rtest for "me"@"MRSApp"')
    # mysqlsh.globals.shell.dump_rows(r)

    session.run_sql('drop rest role "roleA"')
    session.run_sql('drop rest role "roleB"')
    session.run_sql('drop rest role "roleC"')
    session.run_sql('drop rest role "roleD"')
    session.run_sql('drop rest role "roleE"')
    session.run_sql("drop rest service /rtest")
    session.run_sql("drop rest service /rtest2")

    assert num_services == count_table("service")
    # assert num_user == count_table("mrs_user")
    # assert num_role == count_table("mrs_role")
    # assert num_auth_app == count_table("auth_app")
    # assert num_privilege == count_table("mrs_privilege")
    # assert num_service_has_auth_app == count_table("service_has_auth_app")

    session.run_sql("use rest service localhost/test")


def test_sql_default_role_service(phone_book):
    session = phone_book["session"]

    session.run_sql("create rest service /testService")
    session.run_sql("use rest service /testService")

    # should succeed and create on default service
    session.run_sql('create rest role "testRole2"')

    session.run_sql("drop rest service /testService")

    # should succeed because we want it on any service
    session.run_sql('create rest role "testRole3" on any service')

    # should fail because the default service is gone
    with pytest.raises(Exception) as exc_info:
        session.run_sql('create rest role "testRole4"')
    assert "No REST SERVICE specified." in str(exc_info.value)

    session.run_sql('drop rest role "testRole3"')
