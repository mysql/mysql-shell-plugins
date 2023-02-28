# Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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
from mrs_plugin import lib

def test_add_schema(phone_book, table_contents):
    schema_table = table_contents("db_schema")
    args = {
        "schema_name": "PhoneBook",
        "service_id": phone_book["service_id"],
        "requires_auth": False,
        "request_path": "/test_schema_123",
        "enabled": True,
        "session": phone_book["session"]
    }

    args['schema_name'] = "test_schema_123"
    with pytest.raises(ValueError) as exc_info:
        lib.schemas.add_schema(**args)
    assert str(exc_info.value) == "The given schema_name 'test_schema_123' does not exists."

    schema_table.same_as_snapshot

    args['schema_name'] = "PhoneBook"
    args['request_path'] = "test_schema_3"
    with pytest.raises(Exception) as exc_info:
        lib.schemas.add_schema(**args)
    assert str(exc_info.value) == "The request_path has to start with '/'."

    schema_table.same_as_snapshot


def test_get_schema(phone_book):

    args = {
        "request_path": "PhoneBook",
        "service_id": 1,
        "auto_select_single": True,
        "session": phone_book["session"],
    }
    with pytest.raises(Exception) as exc_info:
        lib.schemas.get_schema(**args)
    assert str(exc_info.value) == "The request_path has to start with '/'."


