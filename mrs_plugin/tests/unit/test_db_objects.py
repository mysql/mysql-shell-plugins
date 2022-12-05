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
import json

@pytest.mark.usefixtures("init_mrs")
def test_add_db_object(init_mrs, table_contents):
    db_objects_table = table_contents("db_object")
    db_object = {
        "session": init_mrs["session"],
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
        "row_user_ownership_column": "",
        "comments": "Test table",
        "media_type": None,
        "auto_detect_media_type": True,
        "auth_stored_procedure": '0',
        "options": None,
        "fields": None
    }
    id = add_db_object(**db_object)
    assert id is not None
    assert db_objects_table.count == db_objects_table.snapshot.count + 1

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
        "row_user_ownership_enforced": False,
        "row_user_ownership_column": "",
        "comments": "Test table",
        "session": init_mrs["session"],
    }
    id = add_db_object(**db_object)
    assert id is not None
    assert db_objects_table.count == db_objects_table.snapshot.count + 2

    db_object["crud_operations"] = ""
    with pytest.raises(ValueError) as exc_info:
        add_db_object(**db_object)
    assert str(exc_info.value) == "No CRUD operations specified.Operation cancelled."


    db_object = {
        "db_object_name": "Addresses",
        "db_object_type": "TABLE",
        "schema_name": "PhoneBook",
        "auto_add_schema": True,
        "request_path": "table_addresses",
        "requires_auth": False,
        "items_per_page": 10,
        "row_user_ownership_enforced": False,
        "row_user_ownership_column": "",
        "session": init_mrs["session"],
    }

    with pytest.raises(Exception) as exc_info:
        add_db_object(**db_object)
    assert str(exc_info.value) == "The request_path has to start with '/'."

    assert db_objects_table.count == db_objects_table.snapshot.count + 2


@pytest.mark.usefixtures("init_mrs")
def test_get_db_objects(init_mrs):
    args = {
        "include_enable_state": False,
        "session": init_mrs["session"],
    }
    db_objects = get_db_objects(schema_id=init_mrs["schema_id"], **args)
    assert db_objects is not None



@pytest.mark.usefixtures("init_mrs")
def test_get_db_object(init_mrs):
    args = {
        "schema_id": 9999,
        "session": init_mrs["session"]
    }

    expected_db_object = get_db_object(session=init_mrs["session"], db_object_id=init_mrs["db_object_id"])

    with pytest.raises(Exception) as exc_info:
        get_db_object(**args)
    assert str(exc_info.value) == 'Invalid id type for schema_id.'


    args["schema_id"] = init_mrs["schema_id"]
    with pytest.raises(Exception) as exc_info:
        get_db_object(request_path="test_db", db_object_name="db", **args)
    assert str(exc_info.value) == "The request_path has to start with '/'."

    result = get_db_object(request_path="/test_table", db_object_name="Contacts", **args)
    assert result is not None
    assert isinstance(result, dict)
    # expected_db_object["changed_at"] = result["changed_at"]
    assert result == expected_db_object

    args["db_object_id"] = result.get("id")
    result = get_db_object(**args)
    assert result is not None
    assert isinstance(result, dict)
    # expected_db_object["changed_at"] = result["changed_at"]
    assert result == expected_db_object

@pytest.mark.usefixtures("init_mrs")
def test_set_request_path(init_mrs):
    args ={
        "session": init_mrs["session"]
    }

    result = set_request_path(db_object_id=init_mrs["db_object_id"], request_path="/db_table", **args)
    assert result is True


@pytest.mark.usefixtures("init_mrs")
def test_set_crud_operations(init_mrs, table_contents):
    db_object_table = table_contents("db_object")
    args ={
        "db_object_id": init_mrs["db_object_id"],
        "session": init_mrs["session"]
    }

    result = get_db_object(**args)
    set_crud_operations(crud_operations=result.get("crud_operations"),
            crud_operation_format="FEED", **args)
    assert db_object_table.assert_same

    with pytest.raises(Exception) as exc_info:
        result = get_db_object(request_path="test_db", db_object_name="db", **args)
    assert str(exc_info.value) == "The request_path has to start with '/'."

    with pytest.raises(Exception) as exc_info:
        set_crud_operations(crud_operations=['CREATE', 'READ', 'UPDATE', 'XXXXXXX'],
                crud_operation_format="FEED", **args)
    assert str(exc_info.value) == "The given CRUD operation XXXXXXX does not exist."
    assert db_object_table.assert_same

    set_crud_operations(crud_operations=['CREATE', 'READ'],
            crud_operation_format="FEED", **args)
    result = get_db_object(db_object_id=init_mrs["db_object_id"])
    assert result is not None
    assert not db_object_table.same_as_snapshot
    assert result["crud_operations"] == ['CREATE', 'READ']

    set_crud_operations(crud_operations=['CREATE', 'READ', 'UPDATE', 'DELETE'],
            crud_operation_format="FEED", **args)
    result = get_db_object(**args)
    assert result is not None
    assert not db_object_table.same_as_snapshot
    assert result["crud_operations"] == ['CREATE', 'READ', 'UPDATE', 'DELETE']


@pytest.mark.usefixtures("init_mrs")
def test_disable_enable(init_mrs, table_contents):
    db_object_table = table_contents("db_object")

    assert db_object_table.snapshot.count == 3

    args ={
        "db_object_id": init_mrs["db_object_id"],
        "session": init_mrs["session"]
    }
    assert db_object_table.get("id", init_mrs["db_object_id"])["enabled"] == True
    disable_db_object(db_object_name="db", schema_id=init_mrs["schema_id"], **args)
    assert db_object_table.get("id", init_mrs["db_object_id"])["enabled"] == False

    args ={
        "db_object_id": init_mrs["db_object_id"],
        "session": init_mrs["session"]
    }
    enable_db_object(db_object_name="db", schema_id=init_mrs["schema_id"], **args)
    assert db_object_table.get("id", init_mrs["db_object_id"])["enabled"] == True

@pytest.mark.usefixtures("init_mrs")
def test_db_object_update(init_mrs):
    original_db_object = get_db_object(session=init_mrs["session"], db_object_id=init_mrs["db_object_id"])
    args ={
        "db_object_id": init_mrs["db_object_id"],
        "session": init_mrs["session"],
        "value": {
            "name": "new_name",
            "request_path": "/aaaaaa",
            "enabled": False,
            "items_per_page": 33,
            "crud_operations": ["CREATE", "READ"],
            "crud_operation_format": "ITEM",
            "media_type": "media type",
            "auto_detect_media_type": False,
            "requires_auth": False,
            "auth_stored_procedure": "some SP",
            "row_user_ownership_enforced": True,
            "row_user_ownership_column": "some column",
            "comments": "adding some comments",
            "options": {
                "aaa": "val aaa",
                "bbb": "val bbb"
            }
        },
    }
    update_db_object(**args)
    db_object = get_db_object(**args)

    assert db_object.get("name") == args["value"]["name"]
    assert db_object.get("request_path") == args["value"]["request_path"]
    assert db_object.get("enabled") == args["value"]["enabled"]
    assert db_object.get("items_per_page") == args["value"]["items_per_page"]
    assert db_object.get("crud_operations") == args["value"]["crud_operations"]
    assert db_object.get("crud_operation_format") == args["value"]["crud_operation_format"]
    assert db_object.get("media_type") == args["value"]["media_type"]
    assert db_object.get("auto_detect_media_type") == args["value"]["auto_detect_media_type"]
    assert db_object.get("requires_auth") == args["value"]["requires_auth"]
    assert db_object.get("auth_stored_procedure") == args["value"]["auth_stored_procedure"]
    assert db_object.get("row_user_ownership_enforced") == args["value"]["row_user_ownership_enforced"]
    assert db_object.get("row_user_ownership_column") == args["value"]["row_user_ownership_column"]
    assert db_object.get("comments") == args["value"]["comments"]
    assert db_object.get("options") == args["value"]["options"]

    args["value"] = {
            "name": original_db_object.get("name"),
            "request_path": original_db_object.get("request_path"),
            "enabled": original_db_object.get("enabled"),
            "items_per_page": original_db_object.get("item_per_page"),
            "crud_operations": original_db_object.get("crud_operations"),
            "crud_operation_format": original_db_object.get("crud_operation_format"),
            "media_type": original_db_object.get("media_type"),
            "auto_detect_media_type": original_db_object.get("auto_detect_media_type"),
            "requires_auth": original_db_object.get("requires_auth"),
            "auth_stored_procedure": original_db_object.get("auth_stored_procedure"),
            "row_user_ownership_enforced": original_db_object.get("row_user_ownership_enforced"),
            "row_user_ownership_column": original_db_object.get("row_user_ownership_column"),
            "comments": original_db_object.get("comments"),
            "options": original_db_object.get("options")
    }

    update_db_object(**args)
    db_object = get_db_object(**args)

    assert db_object.get("name") == args["value"]["name"]
    assert db_object.get("request_path") == args["value"]["request_path"]
    assert db_object.get("enabled") == args["value"]["enabled"]
    assert db_object.get("items_per_page") == args["value"]["items_per_page"]
    assert db_object.get("crud_operations") == args["value"]["crud_operations"]
    assert db_object.get("crud_operation_format") == args["value"]["crud_operation_format"]
    assert db_object.get("media_type") == args["value"]["media_type"]
    assert db_object.get("auto_detect_media_type") == args["value"]["auto_detect_media_type"]
    assert db_object.get("requires_auth") == args["value"]["requires_auth"]
    assert db_object.get("auth_stored_procedure") == args["value"]["auth_stored_procedure"]
    assert db_object.get("row_user_ownership_enforced") == args["value"]["row_user_ownership_enforced"]
    assert db_object.get("row_user_ownership_column") == args["value"]["row_user_ownership_column"]
    assert db_object.get("comments") == args["value"]["comments"]
    assert db_object.get("options") == args["value"]["options"]


@pytest.mark.usefixtures("init_mrs")
def test_delete(init_mrs, table_contents):
    db_object_table = table_contents("db_object")

    db_object = {
        "db_object_name": "ContactBasicInfo",
        "db_object_type": "VIEW",
        "schema_name": "PhoneBook",
        "auto_add_schema": True,
        "request_path": "/view_contact_basic_info",
        "crud_operations": ['READ'],
        "crud_operation_format": "FEED",
        "requires_auth": False,
        "items_per_page": 10,
        "row_user_ownership_enforced": False,
        "row_user_ownership_column": "",
        "comments": "Object that will be removed",
        "session": init_mrs["session"],
    }
    id = add_db_object(**db_object)
    assert id is not None
    assert db_object_table.count == db_object_table.snapshot.count + 1

    delete_db_object(session=init_mrs["session"], db_object_name="ContactBasicInfo", schema_id=init_mrs["schema_id"])
    assert db_object_table.count == db_object_table.snapshot.count


    id = add_db_object(**db_object)
    assert id is not None
    assert db_object_table.count == db_object_table.snapshot.count + 1

    delete_db_object(session=init_mrs["session"], db_object_id=id)
    assert db_object_table.count == db_object_table.snapshot.count

