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
from .helpers import ServiceCT, SchemaCT, QueryResults


def test_grant_revoke_sql(phone_book):
    session = phone_book["session"]

    with SchemaCT(session, phone_book["service_id"], "PhoneBook", "/phonebook2") as schema_id:
        session.run_sql('create rest role "role1"')

        with QueryResults(
            lambda: session.run_sql('show rest grants for "role1"')
        ) as qr:
            # invalid schema
            with pytest.raises(Exception) as exc_info:
                session.run_sql(
                    'GRANT REST CREATE, READ, UPDATE, DELETE ON SERVICE localhost/test SCHEMA /sakila TO "role1"'
                )
            assert (
                "Schema `/sakila` was not found."
                in str(exc_info.value)
            ), exc_info.value
            qr.expect_added([])

            # invalid but wildcard
            session.run_sql(
                'GRANT REST CREATE, READ, UPDATE, DELETE ON SERVICE localhost/test SCHEMA "/sakil*" TO "role1"'
            )
            qr.expect_added(
                [
                    {
                        "REST grants for role1": 'GRANT REST CREATE,READ,UPDATE,DELETE ON SERVICE localhost/test SCHEMA "/sakil*" TO "role1"'
                    }
                ]
            )

            # valid schema
            session.run_sql(
                'GRANT REST CREATE, READ, UPDATE, DELETE ON SERVICE localhost/test SCHEMA /phonebook2 TO "role1"'
            )
            qr.expect_added(
                [
                    {
                        "REST grants for role1": 'GRANT REST CREATE,READ,UPDATE,DELETE ON SERVICE localhost/test SCHEMA "/sakil*" TO "role1"'
                    },
                    {
                        "REST grants for role1": 'GRANT REST CREATE,READ,UPDATE,DELETE ON SERVICE localhost/test SCHEMA /phonebook2 TO "role1"'
                    },
                ]
            )

            session.run_sql(
                'revoke rest create, delete on service localhost/test SCHEMA /phonebook2 FROM "role1"'
            )
            session.run_sql(
                'revoke rest update,read,create,delete on service localhost/test SCHEMA "/sakil*" FROM "role1"'
            )
            qr.expect_added(
                [
                    {
                        "REST grants for role1": 'GRANT REST READ,UPDATE ON SERVICE localhost/test SCHEMA /phonebook2 TO "role1"'
                    },
                ]
            )
            session.run_sql('revoke rest update on SCHEMA /phonebook2 FROM "ROLE1"')
            qr.expect_added(
                [
                    {
                        "REST grants for role1": 'GRANT REST READ ON SERVICE localhost/test SCHEMA /phonebook2 TO "role1"'
                    },
                ]
            )
            session.run_sql(
                'revoke rest read,delete ON SCHEMA /phonebook2 FROM "ROLE1"'
            )
            qr.expect_added([])

            session.run_sql('drop rest role "role1"')

