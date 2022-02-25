# Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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
from ... schemas import *

@pytest.mark.usefixtures("init_mrs")
def test_add_schema(init_mrs):
    args = {
        "schema_name": "PhoneBook",
        "service_id": 1,
        "requires_auth": False,
        "enabled": True,
        "session": init_mrs,
        "interactive": False
    }
    result = add_schema(**args)
    assert result is not None
    assert isinstance(result, int)

    args['schema_name'] = "test_schema_123"
    with pytest.raises(ValueError) as exc_info:
        add_schema(**args)
    assert str(exc_info.value) == "The given schema_name 'test_schema_123' does not exists."

    args['schema_name'] = "PhoneBook"
    args['request_path'] = "test_schema_3"
    with pytest.raises(Exception) as exc_info:
        add_schema(**args)
    assert str(exc_info.value) == "The request_path has to start with '/'."


@pytest.mark.usefixtures("init_mrs")
def test_get_schemas(init_mrs):
    schemas = get_schemas()
    assert schemas is not None
    assert isinstance(schemas, str)

    args = {
        "service_id": 1,
        "include_enable_state": True,
        "session": init_mrs,
        "interactive": False,
        "raise_exceptions": True,
        "return_formatted": False
    }
    schemas = get_schemas(**args)
    assert schemas is not None
    assert schemas ==  [
        {'id': 2,
         'name': 'PhoneBook',
         'service_id': 1,
         'request_path': '/PhoneBook',
         'requires_auth': 0,
         'enabled': 1,
         'items_per_page': 25,
         'comments': '',
         'host_ctx': 'localhost/test'},

        {'id': 1,
         'name': 'PhoneBook',
         'service_id': 1,
         'request_path': '/test_schema',
         'requires_auth': 0,
         'enabled': 1,
         'items_per_page': 20,
         'comments': 'test schema',
         'host_ctx': 'localhost/test'}
    ]

@pytest.mark.usefixtures("init_mrs")
def test_get_schema(init_mrs):
    args = {
        "request_path": "/PhoneBook",
        "schema_name": "PhoneBook",
        "schema_id": 2,
        "service_id": 1,
        "auto_select_single": True,
        "session": init_mrs,
        "interactive": False,
        "raise_exceptions": True,
        "return_formatted": False,
        "return_python_object": False
    }
    result = get_schema(**args)
    assert result is not None
    assert result == {'id': 2,
                      'name': 'PhoneBook',
                      'service_id': 1,
                      'request_path': '/PhoneBook',
                      'requires_auth': 0,
                      'enabled': 1,
                      'items_per_page': 25,
                      'comments': '',
                      'host_ctx': 'localhost/test'}

    args['return_formatted'] = True
    result = get_schema(**args)
    assert result is not None
    assert isinstance(result, str)

    args['request_path'] = "PhoneBook"
    with pytest.raises(Exception) as exc_info:
        get_schema(**args)
    assert str(exc_info.value) == "The request_path has to start with '/'."

@pytest.mark.usefixtures("init_mrs")
def test_change_schema(init_mrs):
    args = {
        "schema_name": "PhoneBook",
        "service_id": 1,
        "session": init_mrs,
        "interactive": False,
        "raise_exceptions": True
    }

    result = disable_schema(**args)
    assert result is not None
    assert result == "The schemas have been disabled."

    result = enable_schema(**args)
    assert result is not None
    assert result == "The schemas have been enabled."

    args['schema_id'] = 2
    args['value'] = "PhoneBook2"
    result = set_name(**args)
    assert result is not None
    assert result == "The schema has been updated."

    args['value'] = "/test_schema_4"
    result = set_request_path(**args)
    assert result is not None
    assert result == "The schema has been updated."

    args['value'] = True
    result = set_require_auth(**args)
    assert result is not None
    assert result == "The schema has been updated."

    args['value'] = 20
    result = set_items_per_page(**args)
    assert result is not None
    assert result == "The schema has been updated."

    args['value'] = "New comment"
    result = set_comments(**args)
    assert result is not None
    assert result == "The schema has been updated."

    args['value'] = {
        "schema_name": "PhoneBook",
        "requires_auth": False,
        "enabled": True,
        "request_path": "/PhoneBook",
        "items_per_page": 25,
        "comments": "Test comment 6"
    }
    result = update_schema(**args)
    assert result is not None
    assert result == "The schema has been updated."

    del args['value']
    result = delete_schema(**args)
    assert result is not None
    assert result == "The schema has been deleted."