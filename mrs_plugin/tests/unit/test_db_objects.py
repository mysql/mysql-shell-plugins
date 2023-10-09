# Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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
from mrs_plugin.db_objects import *
from mrs_plugin.lib.services import get_current_service_id, set_current_service_id
from mrs_plugin import lib
from .helpers import get_db_object_privileges, TableContents, DbObjectCT, get_default_db_object_init


def test_add_delete_db_object(phone_book, table_contents):
    session = phone_book["session"]
    schema_id = phone_book["schema_id"]
    schema = lib.schemas.get_schema(session, schema_id)
    assert schema is not None
    db_objects_table: TableContents = table_contents("db_object")

    db_object_init1 = get_default_db_object_init(session, schema_id, "ContactsWithEmail", "/view_contects_wit_email")
    db_object_id1 = add_db_object(**db_object_init1)
    assert db_object_id1 is not None
    assert db_objects_table.count == db_objects_table.snapshot.count + 1

    assert db_objects_table.get("id", db_object_id1) == {
        "id": lib.core.id_to_binary(db_object_id1, "id"),
        "db_schema_id": lib.core.id_to_binary(phone_book["schema_id"], "schema_id"),
        "name": db_object_init1["db_object_name"],
        "object_type": db_object_init1["db_object_type"],
        "request_path": db_object_init1["request_path"],
        "crud_operations": db_object_init1["crud_operations"],
        "requires_auth": int(db_object_init1["requires_auth"]),
        "items_per_page": db_object_init1["items_per_page"],
        "row_user_ownership_enforced": int(db_object_init1["row_user_ownership_enforced"]),
        "row_user_ownership_column": db_object_init1["row_user_ownership_column"],
        "comments": db_object_init1["comments"],
        "media_type": db_object_init1["media_type"],
        "auto_detect_media_type": int(db_object_init1["auto_detect_media_type"]),
        "auth_stored_procedure": '1' if db_object_init1["auth_stored_procedure"] else None,
        "options": db_object_init1["options"],
        "enabled": 1,
        "format": db_object_init1["crud_operation_format"],
        "details": None,
    }

    grants = get_db_object_privileges(session, schema["name"], db_object_init1["db_object_name"])
    assert grants == ['SELECT', 'INSERT', 'UPDATE']

    db_object_init2 = get_default_db_object_init(session, schema_id, "GetAllContacts", "/procedure_get_all_contacts")
    db_object_init2["db_object_type"] = "PROCEDURE"

    db_object_id2 = add_db_object(**db_object_init2)
    assert db_object_id2 is not None
    assert db_objects_table.count == db_objects_table.snapshot.count + 2

    # Check grants for PROCEDURE (not the same as in TABLE/VIEW)
    grants = get_db_object_privileges(session, schema["name"], db_object_init2["db_object_name"])
    assert grants == ['EXECUTE']

    db_object_init3 = get_default_db_object_init(session, schema_id)
    db_object_init3["crud_operations"] = ""
    with pytest.raises(ValueError) as exc_info:
        add_db_object(**db_object_init3)
    assert str(exc_info.value) == "No CRUD operations specified.Operation cancelled."


    db_object_init4 = {
        "db_object_name": "Addresses",
        "db_object_type": "TABLE",
        "schema_name": "PhoneBook",
        "auto_add_schema": True,
        "request_path": "table_addresses",
        "requires_auth": False,
        "items_per_page": 10,
        "row_user_ownership_enforced": False,
        "row_user_ownership_column": "",
        "session": session,
    }

    with pytest.raises(Exception) as exc_info:
        add_db_object(**db_object_init4)
    assert str(exc_info.value) == "The request_path has to start with '/'."

    #  Test deletes
    assert db_objects_table.count == db_objects_table.snapshot.count + 2


    assert delete_db_object(db_object_name="ContactsWithEmail", schema_id=schema["id"])
    assert db_objects_table.count == db_objects_table.snapshot.count + 1
    grants = get_db_object_privileges(session, schema["name"], db_object_init1["db_object_name"])
    assert grants == []


    assert delete_db_object(db_object_id=db_object_id2)
    assert db_objects_table.count == db_objects_table.snapshot.count
    grants = get_db_object_privileges(session, schema["name"], db_object_init2["db_object_name"])
    assert grants == []


def test_get_db_objects(phone_book):
    args = {
        "include_enable_state": False,
        "session": phone_book["session"],
    }
    db_objects = get_db_objects(schema_id=phone_book["schema_id"], **args)
    assert db_objects is not None
    assert len(db_objects) == 0

    args = {
        "include_enable_state": None,
        "session": phone_book["session"],
    }
    db_objects = get_db_objects(schema_id=phone_book["schema_id"], **args)
    assert db_objects is not None
    assert len(db_objects) == 1


def test_get_db_object(phone_book):
    args = {
        "schema_id": 9999,
        "session": phone_book["session"]
    }

    expected_db_object = get_db_object(session=phone_book["session"], db_object_id=phone_book["db_object_id"])

    with pytest.raises(Exception) as exc_info:
        get_db_object(**args)
    assert str(exc_info.value) == 'Invalid id type for schema_id.'


    args["schema_id"] = phone_book["schema_id"]
    with pytest.raises(Exception) as exc_info:
        get_db_object(request_path="test_db", db_object_name="db", **args)
    assert str(exc_info.value) == "The request_path has to start with '/'."

    result = get_db_object(request_path="/test_table", db_object_name="Contacts", **args)
    assert result is not None
    assert isinstance(result, dict)
    assert result == expected_db_object

    args["db_object_id"] = result.get("id")
    result = get_db_object(**args)
    assert result is not None
    assert isinstance(result, dict)
    assert result == expected_db_object


def test_set_request_path(phone_book, table_contents):
    session = phone_book["session"]
    db_object_table: TableContents = table_contents("db_object")

    db_object = get_default_db_object_init(session, phone_book["schema_id"])

    with DbObjectCT(session, **db_object) as db_object_id:
        record = db_object_table.get("id", db_object_id)
        assert record is not None
        assert record["request_path"] == "/view_contact_basic_info"

        result = set_request_path(db_object_id=db_object_id, request_path="/db_table", session=session)
        assert result is True
        record = db_object_table.get("id", db_object_id)
        assert record is not None

        assert record["request_path"] == "/db_table"


def test_set_crud_operations(phone_book, table_contents):
    session = phone_book["session"]
    db_object_table: TableContents = table_contents("db_object")

    db_object = get_default_db_object_init(session, phone_book["schema_id"])

    with DbObjectCT(session, **db_object) as db_object_id:
        result = lib.db_objects.get_db_object(session, db_object_id)
        assert result is not None
        set_crud_operations(db_object_id, crud_operations=result.get("crud_operations"),
                crud_operation_format="FEED")
        assert db_object_table.assert_same

        with pytest.raises(Exception) as exc_info:
            result = get_db_object(request_path="test_db", db_object_name="db")
        assert str(exc_info.value) == "The request_path has to start with '/'."

        with pytest.raises(Exception) as exc_info:
            set_crud_operations(db_object_id, crud_operations=['CREATE', 'READ', 'UPDATE', 'XXXXXXX'],
                    crud_operation_format="FEED")
        assert str(exc_info.value) == "The given CRUD operation XXXXXXX does not exist."
        assert db_object_table.assert_same

        set_crud_operations(db_object_id, crud_operations=['CREATE', 'READ'],
                crud_operation_format="FEED")
        result = lib.db_objects.get_db_object(session, db_object_id)
        assert result is not None
        assert not db_object_table.same_as_snapshot
        assert result["crud_operations"] == ['CREATE', 'READ']

        set_crud_operations(db_object_id, crud_operations=['CREATE', 'READ', 'UPDATE', 'DELETE'],
                crud_operation_format="FEED")
        result = lib.db_objects.get_db_object(session, db_object_id)
        assert result is not None
        assert not db_object_table.same_as_snapshot
        assert result["crud_operations"] == ['CREATE', 'READ', 'UPDATE', 'DELETE']


def test_disable_enable(phone_book, table_contents):
    session = phone_book["session"]
    schema_id = phone_book["schema_id"]
    db_object_table = table_contents("db_object")

    db_object_init = get_default_db_object_init(session, schema_id)

    with DbObjectCT(session, **db_object_init) as db_object_id:
        assert db_object_table.count == db_object_table.snapshot.count + 1
        assert db_object_table.get("id", db_object_id)["enabled"] == True

        disable_db_object(db_object_id=db_object_id)
        assert db_object_table.get("id", db_object_id)["enabled"] == False

        enable_db_object(db_object_id=db_object_id)
        assert db_object_table.get("id", db_object_id)["enabled"] == True


        disable_db_object(db_object_name="ContactBasicInfo", schema_id=schema_id)
        assert db_object_table.get("id", db_object_id)["enabled"] == False

        enable_db_object(db_object_name="ContactBasicInfo", schema_id=schema_id)
        assert db_object_table.get("id", db_object_id)["enabled"] == True


def test_db_object_update(phone_book):
    session = phone_book["session"]
    schema_id = phone_book["schema_id"]

    db_object_init = get_default_db_object_init(session, schema_id)

    with DbObjectCT(session, **db_object_init) as db_object_id:

        original_db_object = get_db_object(session=session, db_object_id=db_object_id)
        assert original_db_object is not None

        args ={
            "db_object_id": db_object_id,
            "session": session,
            "value": {
                "name": "new_name",
            }
        }
        with pytest.raises(ValueError) as exc_info:
            update_db_object(**args)
        assert str(exc_info.value) == "The VIEW named 'new_name' does not exists in database schema 'PhoneBook'."

        args ={
            "db_object_id": db_object_id,
            "session": session,
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
        with pytest.raises(ValueError) as exp:
            update_db_object(**args)
        assert str(exp.value) == "The VIEW named 'new_name' does not exists in database schema 'PhoneBook'."

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
        assert db_object is not None

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

        # specific test to update items_per_page
        args["value"] = {
            "items_per_page": None
        }
        update_db_object(**args)
        db_object = get_db_object(**args)
        assert db_object is not None
        db_object["items_per_page"] = None

        args["value"] = {
            "items_per_page": 50
        }
        update_db_object(**args)
        db_object = get_db_object(**args)
        assert db_object is not None
        db_object["items_per_page"] = 50

        args["value"] = {
            "items_per_page": None
        }
        update_db_object(**args)
        db_object = get_db_object(**args)
        assert db_object is not None
        db_object["items_per_page"] = None


def test_move_db_object(phone_book, mobile_phone_book, table_contents):
    session = phone_book["session"]
    schema_id1 = phone_book["schema_id"]
    schema_id2 = mobile_phone_book["schema_id"]

    db_object_init1 = get_default_db_object_init(session, schema_id1)

    with DbObjectCT(session, **db_object_init1) as db_object_id1:

        # db_object = lib.db_objects.get_db_object(session, phone_book["db_object_id"])

        args ={
            "db_object_id": db_object_id1,
            "session": session,
            "value": {
                "name": "new_name",
                "schema_name": "NonExistingSchema",
            },
        }
        with pytest.raises(ValueError) as exp:
            update_db_object(**args)
        assert str(exp.value) == "The target schema does not exist."

        args ={
            "db_object_id": db_object_id1,
            "session": session,
            "value": {
                "name": "new_name",
                "schema_name": "PhoneBook",
            },
        }
        with pytest.raises(ValueError) as exp:
            update_db_object(**args)
        assert str(exp.value) == "The VIEW named 'new_name' does not exists in database schema 'PhoneBook'."

        db_object_init2 = get_default_db_object_init(session, schema_id2)
        with DbObjectCT(session, **db_object_init2) as db_object_id2:
            args ={
                "db_object_id": db_object_id1,
                "session": session,
                "value": {
                    "schema_name": "MobilePhoneBook",
                    "crud_operations": ["CREATE", "READ"],
                    "crud_operation_format": "ITEM",
                },
            }
            with pytest.raises(ValueError) as exp:
                update_db_object(**args)
            assert str(exp.value) == "The object already exists in the target schema."

        args ={
            "db_object_id": db_object_id1,
            "session": session,
            "value": {
                "schema_name": "NotExistingSchema",
                "request_path": "/movedObject",
                "crud_operations": ["CREATE", "READ"],
                "crud_operation_format": "ITEM",
            },
        }

        with pytest.raises(ValueError) as exp:
            update_db_object(**args)
        assert str(exp.value) == "The target schema does not exist."


        args ={
            "db_object_id": db_object_id1,
            "session": session,
            "value": {
                "schema_name": "MobilePhoneBook",
                "request_path": "/movedObject",
                "crud_operations": ["CREATE", "READ"],
                "crud_operation_format": "ITEM",
            },
        }

        update_db_object(**args)

        db_object = lib.db_objects.get_db_object(session, db_object_id1)

        assert db_object
        assert db_object["schema_name"] == args["value"]["schema_name"]
        assert db_object["request_path"] == args["value"]["request_path"]


def test_add_db_object_auto_add_schema(phone_book, table_contents):
    session = phone_book["session"]
    db_objects_table = table_contents("db_object")

    service_id = get_current_service_id(session)
    assert service_id is not None
    set_current_service_id(session, b"no_service")

    db_object_init = {
        "session": session,
        "db_object_name": "ContactsWithEmail",
        "db_object_type": "VIEW",
        "schema_name": "EmptyPhoneBook",
        "auto_add_schema": True,
        "request_path": "/view_contacts_with_email_no_service",
        "crud_operations": ['READ'],
        "crud_operation_format": "MEDIA",
        "requires_auth": False,
        "items_per_page": 10,
        "row_user_ownership_enforced": False,
        "comments": "Test table",
        "options": None
    }

    with pytest.raises(RuntimeError) as exc_info:
        add_db_object(**db_object_init)
    assert str(exc_info.value) == "Operation cancelled. The service was not found."

    set_current_service_id(session, service_id)

    db_object_init["request_path"] = "/view_contacts_with"

    schema = lib.schemas.get_schema(session, schema_name=db_object_init["schema_name"])
    assert schema is None


    db_object_id = add_db_object(**db_object_init)
    assert db_object_id is not None
    assert db_objects_table.count == db_objects_table.snapshot.count + 1

    schema = lib.schemas.get_schema(session, schema_name=db_object_init["schema_name"])
    assert schema is not None
    assert schema["name"] == db_object_init["schema_name"]

    lib.db_objects.delete_db_object(session, db_object_id)
    lib.schemas.delete_schema(session, schema["id"])
