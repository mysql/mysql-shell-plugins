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
from .... import lib
from ..helpers import AuthAppCT, TableContents

def test_get_auth_app(phone_book, table_contents):
    session = phone_book["session"]

    auth_apps_table: TableContents = table_contents("auth_app")

    auth_apps = lib.auth_apps.get_auth_apps(session, phone_book["service_id"])

    assert auth_apps[0]["auth_vendor"] == "MRS"

    # auth_vendor is not part of the table, so remove to compare
    del auth_apps[0]["auth_vendor"]

    #assert auth_apps_table.items == auth_apps

    new_auth_app_data = {
        "service_id": phone_book["service_id"],
        "auth_vendor_id": lib.core.id_to_binary("0x30000000000000000000000000000000", "auth_vendor_id"),
        "name": "New Auth App",
        "description": "This is the new test auth app description",
        "url": "http://someurl.com",
        "url_direct_auth": "<some auth>",
        "access_token": "<some token>",
        "app_id": "<some app id>",
        "enabled": True,
        "limit_to_registered_users": False,
        "default_role_id": phone_book["roles"]["Full Access"]
    }

    with AuthAppCT(session, **new_auth_app_data) as auth_app_id:
        assert auth_app_id
        assert not auth_app_id == auth_apps[0]["id"]
        assert auth_apps_table.count == auth_apps_table.snapshot.count + 1

        new_auth_app = lib.auth_apps.get_auth_app(session, auth_app_id)

        assert new_auth_app["id"] == auth_app_id

        assert new_auth_app["auth_vendor"] == "MRS"

        for key, value in new_auth_app_data.items():
            if key != "service_id":
                assert new_auth_app[key] == value

    assert auth_apps_table.same_as_snapshot


def test_get_auth_apps(phone_book, table_contents):
    session = phone_book["session"]

    auth_apps_table: TableContents = table_contents("auth_app")

    auth_apps = lib.auth_apps.get_auth_apps(session, phone_book["service_id"])

    assert len(auth_apps) == 1

    new_auth_app_data = {
        "service_id": phone_book["service_id"],
        "auth_vendor_id": lib.core.id_to_binary("0x30000000000000000000000000000000", "auth_vendor_id"),
        "name": "New Auth App",
    }

    with AuthAppCT(session, **new_auth_app_data) as auth_app_id:
        assert auth_app_id
        assert auth_apps_table.count == auth_apps_table.snapshot.count + 1

        auth_apps = lib.auth_apps.get_auth_apps(session, phone_book["service_id"])

        assert len(auth_apps) == 2
