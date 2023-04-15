# Copyright (c) 2023, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is also distributed with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms, as
# designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have included with MySQL.
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
from ..helpers import TableContents

EXPECTED = {
    "0x30000000000000000000000000000000": {
        "id": lib.core.id_to_binary("0x30000000000000000000000000000000", ""),
        "name": "MRS",
        "validation_url": None,
        "enabled": 1,
        "comments": "Built-in user management of MRS"
    },
    "0x31000000000000000000000000000000": {
        "id": lib.core.id_to_binary("0x31000000000000000000000000000000", ""),
        "name": "MySQL Internal",
        "validation_url": None,
        "enabled": 1,
        "comments": "Provides basic authentication via MySQL Server accounts"
    },
    "0x32000000000000000000000000000000": {
        "id": lib.core.id_to_binary("0x32000000000000000000000000000000", ""),
        "name": "Facebook",
        "validation_url": None,
        "enabled": 1,
        "comments": "Uses the Facebook Login OAuth2 service"
    },
    "0x34000000000000000000000000000000": {
        "id": lib.core.id_to_binary("0x34000000000000000000000000000000", ""),
        "name": "Google",
        "validation_url": None,
        "enabled": 1,
        "comments": "Uses the Google OAuth2 service"
    },
}


def test_get_auth_vendor(phone_book, table_contents):
    session = phone_book["session"]

    auth_vendor_table: TableContents = table_contents("auth_vendor")

    for key, value in EXPECTED.items():
        value["id"] = lib.core.id_to_binary(key, value["name"])

        auth_vendor = lib.auth_apps.get_auth_vendor(session, value["id"])

        assert auth_vendor == value



def test_get_auth_vendors(phone_book, table_contents):
    session = phone_book["session"]

    auth_vendor_table: TableContents = table_contents("auth_app")

    auth_vendors = lib.auth_apps.get_auth_vendors(session)

    assert len(auth_vendors) == len(EXPECTED)

    for auth_vendor in auth_vendors:
        assert auth_vendor == EXPECTED[lib.core.convert_id_to_string(auth_vendor["id"])]

