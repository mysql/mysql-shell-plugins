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
from ... db_objects import *

@pytest.mark.usefixtures("init_mrs")
def test_add_db_object(init_mrs):
    db_object = {
        "db_object_name": "ContactsWithEmail",
        "db_object_type": "VIEW",
        "schema_name": "PhoneBook",
        "auto_add_schema": True,
        "request_path": "/view_contects_wit_email",
        "crud_operations": ['CREATE', 'READ', 'UPDATE'],
        "crud_operation_format": "MEDIA",
        "requires_auth": False,
        "items_per_page": 10,
        "row_user_ownership_enforced": False,
        "row_ownership_enforced": False,
        "row_ownership_column": "",
        "row_ownership_parameter": "",
        "comments": "Test table",
        "session": init_mrs,
        "interactive": False,
        "raise_exceptions": True,
        "return_formatted": False
    }
    id = add_db_object(**db_object)
    assert id is not None
    assert isinstance(id, int)

    db_object = {
        "db_object_name": "GetAllContacts",
        "db_object_type": "PROCEDURE",
        "schema_name": "PhoneBook",
        "auto_add_schema": True,
        "request_path": "/procedure_get_all_contacts",
        "crud_operations": ['CREATE', 'READ', 'UPDATE'],
        "crud_operation_format": "FEED",
        "requires_auth": False,
        "items_per_page": 10,
        "row_ownership_enforced": False,
        "row_ownership_column": "",
        "row_ownership_parameter": "",
        "comments": "Test table",
        "session": init_mrs,
        "interactive": False,
        "raise_exceptions": True,
        "return_formatted": False
    }
    id = add_db_object(**db_object)
    assert id is not None
    assert isinstance(id, int)

    db_object = {
        "db_object_name": "Addresses",
        "db_object_type": "TABLE",
        "schema_name": "PhoneBook",
        "auto_add_schema": True,
        "request_path": "table_addresses",
        "requires_auth": False,
        "items_per_page": 10,
        "row_ownership_enforced": False,
        "row_ownership_column": "",
        "row_ownership_parameter": "",
        "session": init_mrs,
        "interactive": True,
        "raise_exceptions": False,
        "return_formatted": False
    }

    result = add_db_object(**db_object)
    assert result is None

    db_object["interactive"] = False
    db_object["raise_exceptions"] = True
    with pytest.raises(Exception) as exc_info:
        add_db_object(**db_object)
    assert str(exc_info.value) == "The request_path has to start with '/'."

    db_object["request_path"] = "/table_addresses"
    with pytest.raises(ValueError) as exc_info:
        add_db_object(**db_object)
    assert str(exc_info.value) == "No CRUD operations specified.Operation chancelled."

    db_object["crud_operations"] = ['CREATE', 'READ', 'UPDATE', 'DELETE']
    with pytest.raises(ValueError) as exc_info:
        add_db_object(**db_object)
    assert str(exc_info.value) == "No CRUD operation format specified.Operation chancelled."

    db_object["crud_operation_format"] = "FEED"
    db_object["crud_operations"] = 1
    with pytest.raises(TypeError) as exc_info:
        add_db_object(**db_object)
    assert str(exc_info.value) == "'int' object is not iterable"

    db_object["crud_operations"] = ['CRETE']
    with pytest.raises(ValueError) as exc_info:
        add_db_object(**db_object)
    assert str(exc_info.value) == "The given CRUD operation CRETE does not exist."

    db_object["crud_operations"] = ['CREATE', 'READ', 'UPDATE', 'DELETE']
    del db_object["request_path"]
    id = add_db_object(**db_object)
    assert id is not None
    assert isinstance(id, int)

    db_object["db_object_type"] = "TBLE"
    with pytest.raises(ValueError) as exc_info:
        add_db_object(**db_object)
    assert str(exc_info.value) == "Invalid db_object_type. Only valid types are TABLE, VIEW and PROCEDURE."

    db_object["db_object_type"] = "TABLE"
    db_object["db_object_name"] = "db999"
    with pytest.raises(ValueError) as exc_info:
        add_db_object(**db_object)
    assert str(exc_info.value) == "The TABLE named 'db999' does not exists in database schema PhoneBook."


@pytest.mark.usefixtures("init_mrs")
def test_get_db_objects(init_mrs):
    args = {
        "include_enable_state": False,
        "session": init_mrs,
        "interactive": False,
        "raise_exceptions": True,
        "return_formatted": True
    }
    db_objects = get_db_objects(schema_id=1, **args)
    assert db_objects is not None

    args["return_formatted"] = False
    db_objects = get_db_objects(schema_id=1, **args)
    assert db_objects is not None

@pytest.mark.usefixtures("init_mrs")
def test_get_db_object(init_mrs):
    args = {
        "db_object_id": 1,
        "schema_id": 1,
        "session": init_mrs,
        "interactive": True
    }

    result = get_db_object(request_path="test_db", db_object_name="db", **args)
    assert result is None

    args["interactive"] = False
    with pytest.raises(Exception) as exc_info:
        get_db_object(request_path="test_db", db_object_name="db", **args)
    assert str(exc_info.value) == "The request_path has to start with '/'."

    with pytest.raises(Exception) as exc_info:
        get_db_object(request_path="/test_abc", db_object_name="db1", **args)
    assert str(exc_info.value) == "The given db_objects was not found."

    db_object = get_db_object(**args)
    assert db_object is not None
    assert db_object['id'] == 1
    assert db_object['db_schema_id'] == 1
    assert db_object['name'] == 'Contacts'
    assert db_object['request_path'] == '/test_table'
    assert db_object['object_type'] == 'TABLE'

@pytest.mark.usefixtures("init_mrs")
def test_set_request_path(init_mrs):
    args ={
        "session": init_mrs,
        "interactive": False
    }
    result = set_request_path(db_object_id=1, request_path="/db_table", **args)
    assert result is None


@pytest.mark.usefixtures("init_mrs")
def test_set_crud_operations(init_mrs):
    args ={
        "session": init_mrs,
        "interactive": False
    }

    with pytest.raises(ValueError) as exc_info:
        set_crud_operations(db_object_id=1, crud_operations=None,
            crud_operation_format="FEED", **args)
    assert str(exc_info.value) == "No CRUD operations specified.Operation chancelled."

    with pytest.raises(ValueError) as exc_info:
        set_crud_operations(db_object_id=1, crud_operations=['CREATE', 'READ', 'UPDATE', 'DELETE'],
            crud_operation_format=None, **args)
    assert str(exc_info.value) == "No CRUD operation format specified.Operation chancelled."

    with pytest.raises(ValueError) as exc_info:
        set_crud_operations(db_object_id=1, crud_operations=('CREATE', 'READ', 'UPDATE', 'DELETE'),
            crud_operation_format="FEED", **args)
    assert str(exc_info.value) == "The crud_operations need to be specified as list. Operation chancelled."

    with pytest.raises(ValueError) as exc_info:
        set_crud_operations(db_object_id=1, crud_operations=['CRAETE'], crud_operation_format="FEED", **args)
    assert str(exc_info.value) == "The given CRUD operation CRAETE does not exist."

    result = set_crud_operations(db_object_id=1, crud_operations=['CREATE', 'READ', 'UPDATE', 'DELETE'],
            crud_operation_format="FEED", **args)
    assert result is None


@pytest.mark.usefixtures("init_mrs")
def test_disable_enable(init_mrs):
    args ={
        "db_object_id": 1,
        "session": init_mrs,
        "interactive": False
    }
    result = disable_db_object(db_object_name="db", schema_id=1, **args)
    assert result is not None
    assert result == "The db_object has been disabled."

    args ={
        "db_object_id": 1,
        "session": init_mrs,
        "interactive": False
    }
    result = enable_db_object(db_object_name="db", schema_id=1, **args)
    assert result is not None
    assert result == "The db_object has been enabled."


@pytest.mark.usefixtures("init_mrs")
def test_delete(init_mrs):
    args ={
        "db_object_id": 1,
        "session": init_mrs,
        "interactive": False
    }
    result = delete_db_object(db_object_name="db", schema_id=1, **args)
    assert result is not None
    assert result == "The db_object has been deleted."
