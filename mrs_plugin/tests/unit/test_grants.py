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
import random

from ...roles import *
from mrs_plugin import lib
from .helpers import ServiceCT, SchemaCT, QueryResults, TableContents

def assert_lists(actual, expected):
    for a in actual:
        assert a in expected, "Expected:\n"+"\n".join(expected)
    for e in expected:
        assert e in actual, "Actual:\n"+"\n".join(actual)


# - 1: It is possible to grant to a service, to a schema and object
#   - 1.1: If service is omitted, current_service is the default
#   - 1.2: If neither schema nor object are given, grant is on (service, "", "")
#   - 1.3: If schema is given, but not object, grant is on (service, schema, "")
#   - 1.4: If schema and object are given, grant is on (service, schema, object)
#   - 1.5: If schema is not given but object is given, then (syntax) ERROR
#   - 1.6: Service must include the host (if there is one) (localhost/myService)
#   - Note: Paths are not validated whether the pointed object exists
# - 2: Granting on an exact path that already exists will add privs to the existing grant
#   - 2.1: Granting a priv that's already granted is a no-op
# - 3: Revoke only works on exact path matches
# - 4: Revoke on a path that doesn't match is ERROR
# - 5: Revoke removes named privileges from a grant on that path
#   - 5.1: Revoke missing privilege on a valid path is a no-op
# - 6: If all privileges are removed from a grant, the grant itself is removed
# - 7: Role and privilege names are case-insensitive
# - 8: Paths are case sensitive


def test_grant_revoke_sql(phone_book, table_contents: TableContents):
    session = phone_book["session"]
    roles_tables = table_contents("mrs_role")
    schemas_tables = table_contents("db_schema")

    def dump_grants(role):
        import mysqlsh

        shell = mysqlsh.globals.shell
        shell.dump_rows(session.run_sql("show rest grants for ?", [role]))

    session.run_sql("create rest service /myService")
    default_service = "/myService"
    session.run_sql(f"use rest service {default_service}")

    with SchemaCT(
        session, phone_book["service_id"], "PhoneBook", "/phonebook2"
    ) as schema_id:
        session.run_sql('create rest role "role1"')
        session.run_sql('create rest role "ROLE2"')

        k_services = [
            "/test",
            '`/test*`',
            "/myService",
            "*",
            "",
            None,
        ]
        k_schemas = ["/phonebook2", "/pho*", "*", "", None]
        k_objects = ["/Contacts", "/Cont*", "*", "", None]
        k_roles = ["role1", "ROLE2"]
        k_bad_roles = ["badrole"]

        def rand_case(s):
            if random.randint(0, 6) == 1:  # checks 7 and 8
                return s.capitalize()
            else:
                return s

        def fmt_target(svc, s, o, quote=False):
            def q(s):
                if s.startswith('`'):
                    return s
                return lib.core.quote_rpath(s)

            if quote:
                if svc is None:
                    svc = default_service
                if s is None:
                    s = ""
                if o is None:
                    o = ""
            s_svc = f"SERVICE {q(svc)}" if svc is not None else ""
            s_s = f"SCHEMA {q(s)}" if s is not None else ""
            s_o = f"OBJECT {q(o)}" if o is not None else ""
            if s_svc or s_s or s_o:
                return f"ON {s_svc} {s_s} {s_o}"
            return ""

        with QueryResults(
            lambda: session.run_sql('show rest grants for role1')
        ) as qr:
            for priv in ["UPDATE", "DELETE", "CREATE", "READ", "CREATE,READ"]:
                session.run_sql(f"GRANT REST {priv} ON SERVICE `*` SCHEMA `*` OBJECT `*` TO `role1`")
                qr.expect_added([{"REST grants for role1": f"GRANT REST {priv} ON SERVICE `*` SCHEMA `*` OBJECT `*` TO `role1`"}])
                session.run_sql(f"REVOKE REST {priv} ON SERVICE `*` SCHEMA `*` OBJECT `*` FROM `role1`")
                qr.expect_added([])

            with pytest.raises(Exception) as exc_info:
                session.run_sql(f"GRANT REST ALL ON SERVICE `*` SCHEMA `*` OBJECT `*` TO `role1`")
            assert "Syntax Error" in str(exc_info.value)
            qr.expect_added([])
            with pytest.raises(Exception) as exc_info:
                session.run_sql(f"REVOKE REST ALL ON SERVICE `*` SCHEMA `*` OBJECT `*` FROM `role1`")
            assert "Syntax Error" in str(exc_info.value)
            qr.expect_added([])

        # First grant all possible combinations (checks 1.*)
        expected_grants = dict(zip(k_roles, [set() for _ in k_roles]))
        privs = "UPDATE,DELETE"
        for svc in k_services:
            for s in k_schemas:
                for o in k_objects:
                    path = fmt_target(svc, s, o)
                    norm_path = fmt_target(svc, s, o, True)
                    for role in k_roles + k_bad_roles:
                        bad_role = role in k_bad_roles
                        role_ = rand_case(role)
                        sql = f"GRANT REST {rand_case(privs)} {path} TO '{role_}'"
                        normalized_sql = f'GRANT REST {privs} {norm_path} TO `{role}`'
                        if (s is None and o is not None):
                            with pytest.raises(Exception) as exc_info:
                                session.run_sql(sql)
                                print("DID NOT THROW:", sql)
                            assert not bad_role or f"Syntax Error" in str(
                                exc_info.value
                            ), sql
                        elif bad_role:
                            with pytest.raises(Exception) as exc_info:
                                session.run_sql(sql)
                            assert (
                                not bad_role
                                or f"Role `{role_}` was not found"
                                in str(exc_info.value)
                            ), (sql)
                        else:
                            session.run_sql(sql)
                            expected_grants[role].add(normalized_sql)
        for role in k_roles:
            grants = [
                r[0]
                for r in session.run_sql(f"SHOW REST GRANTS FOR '{role}'").fetch_all()
            ]
            assert_lists(grants, expected_grants[role])

        # Grant one priv to all paths twice (checks 2 and 2.1)
        for i in range(2):
            expected_grants2 = dict(zip(k_roles, [set() for _ in k_roles]))
            privs = "READ"
            final_privs = "READ,UPDATE,DELETE"
            for svc in k_services:
                for s in k_schemas:
                    for o in k_objects:
                        path = fmt_target(svc, s, o)
                        norm_path = fmt_target(svc, s, o, True)
                        for role in k_roles:
                            sql = f"GRANT REST {rand_case(privs)} {path} TO '{role}'"
                            normalized_sql = (
                                f'GRANT REST {final_privs} {norm_path} TO `{role}`'
                            )
                            if (s is None and o is not None):
                                with pytest.raises(Exception) as exc_info:
                                    session.run_sql(sql)
                                    print("DID NOT THROW:", sql)
                                assert not bad_role or f"Syntax Error" in str(
                                    exc_info.value
                                ), sql
                            else:
                                session.run_sql(sql)
                                expected_grants2[role].add(normalized_sql)

            for role in k_roles:
                grants = [
                    r[0]
                    for r in session.run_sql(f"SHOW REST GRANTS FOR '{role}'").fetch_all()
                ]
                assert_lists(grants, expected_grants2[role])

        # Revoke one priv from all paths twice (checks 5 and 5.1)
        for i in range(2):
            expected_grants2 = dict(zip(k_roles, [set() for _ in k_roles]))
            privs = "UPDATE"
            final_privs = "READ,DELETE"
            for svc in k_services:
                for s in k_schemas:
                    for o in k_objects:
                        path = fmt_target(svc, s, o)
                        norm_path = fmt_target(svc, s, o, True)
                        for role in k_roles:
                            sql = f"REVOKE REST {rand_case(privs)} {path} FROM '{role}'"
                            expected_sql = (
                                f'GRANT REST {final_privs} {norm_path} TO `{role}`'
                            )
                            if (s is None and o is not None):
                                with pytest.raises(Exception) as exc_info:
                                    session.run_sql(sql)
                                    print("DID NOT THROW:", sql)
                                assert not bad_role or f"Syntax Error" in str(
                                    exc_info.value
                                ), sql
                            else:
                                try:
                                    session.run_sql(sql)
                                except:
                                    print("UNEXPECTED ERROR", sql, "\n\t", expected_sql)
                                    raise
                                expected_grants2[role].add(expected_sql)
            if i == 0:
                for role in k_roles:
                    grants = [
                        r[0]
                        for r in session.run_sql(f"SHOW REST GRANTS FOR '{role}'").fetch_all()
                    ]
                    assert_lists(grants, expected_grants2[role])

        # Revoke everything from all paths (checks 6)
        privs = "CREATE,READ,UPDATE,DELETE"
        revoked = dict(zip(k_roles, [set() for _ in k_roles]))
        for svc in k_services:
            for s in k_schemas:
                for o in k_objects:
                    path = fmt_target(svc, s, o)
                    norm_path = fmt_target(svc, s, o, True)
                    for role in k_roles:
                        sql = f"REVOKE REST {rand_case(privs)} {path} FROM '{role}'"
                        if (s is None and o is not None):
                            with pytest.raises(Exception) as exc_info:
                                session.run_sql(sql)
                                print("DID NOT THROW:", sql)
                            assert not bad_role or f"Syntax Error" in str(
                                exc_info.value
                            ), sql
                        else:
                            # check if we didn't already revoke from an equivalent path
                            if norm_path not in revoked[role]:
                                session.run_sql(sql)
                                revoked[role].add(norm_path)

        for role in k_roles:
            grants = [
                r[0]
                for r in session.run_sql(f"SHOW REST GRANTS FOR '{role}'").fetch_all()
            ]
            assert grants == []
    # cleanup
    session.run_sql('drop rest role "role1"')
    session.run_sql('drop rest role "ROLE2"')
    session.run_sql('drop rest service /myService')
