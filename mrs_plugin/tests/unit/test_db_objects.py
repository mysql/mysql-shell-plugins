# Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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
from pathlib import Path

from mrs_plugin.db_objects import *
from mrs_plugin.lib.services import get_current_service_id, set_current_service_id
from mrs_plugin import lib
from .helpers import get_db_object_privileges, TableContents, SchemaCT, DbObjectCT, get_default_db_object_init

db_object_create_statement = """CREATE OR REPLACE REST VIEW /Contacts
    ON SERVICE localhost/test SCHEMA /PhoneBook
    AS PhoneBook.Contacts CLASS MyServiceAnalogPhoneBookContacts {
        id: id @SORTABLE,
        fName: f_name,
        lName: l_name,
        number: number,
        email: email
    }
    AUTHENTICATION REQUIRED;"""

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
        "crud_operations": ["CREATE", "READ", "UPDATE", "DELETE"],
        "requires_auth": int(db_object_init1["requires_auth"]),
        "items_per_page": db_object_init1["items_per_page"],
        "comments": db_object_init1["comments"],
        "media_type": db_object_init1["media_type"],
        "metadata": db_object_init1["metadata"],
        "auto_detect_media_type": int(db_object_init1["auto_detect_media_type"]),
        "auth_stored_procedure": '1' if db_object_init1["auth_stored_procedure"] else None,
        "options": db_object_init1["options"],
        "enabled": 1,
        "format": db_object_init1["crud_operation_format"],
        "details": None,
        "internal": 0,
    }

    grants = get_db_object_privileges(session, schema["name"], db_object_init1["db_object_name"])
    assert grants == ["SELECT", "INSERT", "UPDATE", "DELETE"]

    db_object_init2 = get_default_db_object_init(session, schema_id, "GetAllContacts", "/procedure_get_all_contacts")
    db_object_init2["db_object_type"] = "PROCEDURE"

    db_object_id2 = add_db_object(**db_object_init2)
    assert db_object_id2 is not None
    assert db_objects_table.count == db_objects_table.snapshot.count + 2

    # Check grants for PROCEDURE (not the same as in TABLE/VIEW)
    grants = get_db_object_privileges(session, schema["name"], db_object_init2["db_object_name"])
    assert grants == ['EXECUTE']

    db_object_init3 = get_default_db_object_init(session, schema_id, object_options={})
    db_object_id3 = add_db_object(**db_object_init3)

    assert db_objects_table.count == db_objects_table.snapshot.count + 3

    db_object_init4 = {
        "db_object_name": "Addresses",
        "db_object_type": "TABLE",
        "schema_name": "PhoneBook",
        "auto_add_schema": True,
        "request_path": "table_addresses",
        "requires_auth": False,
        "items_per_page": 10,
        "session": session,
    }

    with pytest.raises(Exception) as exc_info:
        add_db_object(**db_object_init4)
    assert str(exc_info.value) == "The request_path has to start with '/'."

    assert db_objects_table.count == db_objects_table.snapshot.count + 3

    #  Test deletes
    assert delete_db_object(db_object_name="ContactsWithEmail", schema_id=schema["id"])
    assert db_objects_table.count == db_objects_table.snapshot.count + 2
    grants = get_db_object_privileges(session, schema["name"], db_object_init1["db_object_name"])
    assert grants == []

    assert delete_db_object(db_object_id=db_object_id2)
    assert db_objects_table.count == db_objects_table.snapshot.count + 1
    grants = get_db_object_privileges(session, schema["name"], db_object_init2["db_object_name"])
    assert grants == []

    assert delete_db_object(db_object_id=db_object_id3)
    assert db_objects_table.count == db_objects_table.snapshot.count

    # Check grants for tables and routines used by a VIEW
    db_object_init5 = get_default_db_object_init(
        session, schema_id, "ContactNotes", "/contactNotes"
    )
    db_object_id5 = add_db_object(**db_object_init5)

    grants = get_db_object_privileges(session, schema["name"], "Notes")
    assert grants == ["SELECT", "INSERT", "UPDATE", "DELETE"]

    grants = get_db_object_privileges(session, schema["name"], "format_name")
    assert grants == ["EXECUTE"]

    assert delete_db_object(db_object_id=db_object_id5)


def test_get_db_objects(phone_book, table_contents):
    args = {
        "include_enable_state": False,
        "session": phone_book["session"],
    }
    db_objects = get_db_objects(schema_id=phone_book["schema_id"], **args)
    assert db_objects is not None
    assert len(db_objects) == 0

    args = {
        "include_enable_state": True,
        "session": phone_book["session"],
    }
    db_objects = get_db_objects(schema_id=phone_book["schema_id"], **args)
    assert db_objects is not None
    assert len(db_objects) == 1

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
    assert str(exc_info.value) == "Invalid id type for 'schema_id'."

    args["schema_id"] = phone_book["schema_id"]
    with pytest.raises(Exception) as exc_info:
        get_db_object(request_path="test_db", db_object_name="db", **args)
    assert str(exc_info.value) == "The request_path has to start with '/'."

    result = get_db_object(request_path="/Contacts", db_object_name="Contacts", **args)
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

    db_object["objects"][0]["options"] = {
        "duality_view_insert": True,
        "duality_view_update": True,
        "duality_view_delete": True,
    }

    with DbObjectCT(session, **db_object) as db_object_id:
        result = lib.db_objects.get_db_object(session, db_object_id)
        assert result is not None

        assert result["crud_operations"] == ["CREATE", "READ", "UPDATE", "DELETE"]

    db_object["objects"][0]["options"] = {
        "duality_view_insert": False,
        "duality_view_update": True,
        "duality_view_delete": True,
    }

    with DbObjectCT(session, **db_object) as db_object_id:
        result = lib.db_objects.get_db_object(session, db_object_id)
        assert result is not None

        assert result["crud_operations"] == ["READ", "UPDATE", "DELETE"]

    db_object["objects"][0]["options"] = {
        "duality_view_insert": False,
        "duality_view_update": False,
        "duality_view_delete": True,
    }

    with DbObjectCT(session, **db_object) as db_object_id:
        result = lib.db_objects.get_db_object(session, db_object_id)
        assert result is not None

        assert result["crud_operations"] == ["READ", "DELETE"]

    db_object["objects"][0]["options"] = {
        "duality_view_insert": False,
        "duality_view_update": False,
        "duality_view_delete": False,
    }

    with DbObjectCT(session, **db_object) as db_object_id:
        result = lib.db_objects.get_db_object(session, db_object_id)
        assert result is not None

        assert result["crud_operations"] == ["READ"]

    db_object["objects"][0]["fields"][0]["options"] = {
        "duality_view_insert": True,
        "duality_view_update": True,
        "duality_view_delete": True,
    }

    with DbObjectCT(session, **db_object) as db_object_id:
        result = lib.db_objects.get_db_object(session, db_object_id)
        assert result is not None

        assert result["crud_operations"] == ["READ", "UPDATE"]


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
                "crud_operation_format": "ITEM",
                "media_type": "media type",
                "auto_detect_media_type": False,
                "requires_auth": False,
                "auth_stored_procedure": "some SP",
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
                "crud_operation_format": original_db_object.get("crud_operation_format"),
                "media_type": original_db_object.get("media_type"),
                "auto_detect_media_type": original_db_object.get("auto_detect_media_type"),
                "requires_auth": original_db_object.get("requires_auth"),
                "auth_stored_procedure": original_db_object.get("auth_stored_procedure"),
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
        assert db_object.get("crud_operation_format") == args["value"]["crud_operation_format"]
        assert db_object.get("media_type") == args["value"]["media_type"]
        assert db_object.get("auto_detect_media_type") == args["value"]["auto_detect_media_type"]
        assert db_object.get("requires_auth") == args["value"]["requires_auth"]
        assert db_object.get("auth_stored_procedure") == args["value"]["auth_stored_procedure"]
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
        "crud_operation_format": "MEDIA",
        "requires_auth": False,
        "items_per_page": 10,
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


def test_special_schemas(phone_book, mobile_phone_book, table_contents):
    session = phone_book["session"]
    information_schema_grants: TableContents = table_contents("INFORMATION_SCHEMA.TABLE_PRIVILEGES")

    with SchemaCT(session, phone_book["service_id"], "information_schema", "/information_schema") as schema_id:

        db_object_init = get_default_db_object_init(session, schema_id, "CHARACTER_SETS", "/character_sets")

        with DbObjectCT(session, **db_object_init) as db_object_id:
            assert information_schema_grants.same_as_snapshot


    with SchemaCT(session, phone_book["service_id"], "performance_schema", "/performance_schema") as schema_id:

        db_object_init = get_default_db_object_init(session, schema_id,
                                                    "accounts", "/accounts"
                                                    "TABLE")

        with DbObjectCT(session, **db_object_init) as db_object_id:
            assert not information_schema_grants.same_as_snapshot

            filtered = information_schema_grants.filter("TABLE_SCHEMA", "performance_schema")
            assert len(filtered) == 2

            row = filtered[0]
            assert row["TABLE_NAME"] == "accounts"
            assert row["GRANTEE"] == "'mysql_rest_service_data_provider'@'%'"
            assert row["PRIVILEGE_TYPE"] == "SELECT"

    assert information_schema_grants.same_as_snapshot


def test_get_create_statement(phone_book, table_contents):

    sql = get_create_statement(db_object_id=phone_book["db_object_id"], session=phone_book["session"])

    assert sql == db_object_create_statement


def test_dump_create_statement(phone_book, table_contents):
    home_file = "~/db_object.dump.sql"
    relative_file = "db_object.dump.sql"
    full_path_file = os.path.expanduser("~/db_object.dump.sql")

    # Test home path
    create_function = lambda file_path, overwrite: \
        store_create_statement(file_path=file_path,
                                    overwrite=overwrite,
                                    db_object_id=phone_book["db_object_id"],
                                    session=phone_book["session"])

    result = create_function(file_path=home_file, overwrite=True)

    assert result == True

    with open(os.path.expanduser(home_file), "r+") as f:
        assert f.read() == db_object_create_statement

    # Test overwrite
    with open(os.path.expanduser(home_file), "a+") as f:
        f.write("<=============================>")

    with pytest.raises(Exception, match=f"Cancelling operation. File '{os.path.expanduser(home_file)}' already exists."):
        create_function(file_path=home_file, overwrite=False)

    with open(os.path.expanduser(home_file), "r") as f:
        contents = f.read()
        assert contents.startswith(db_object_create_statement)
        assert contents.endswith("<=============================>")


    result = create_function(file_path=home_file, overwrite=True)

    with open(os.path.expanduser(home_file), "r") as f:
        assert f.read() == db_object_create_statement

    os.remove(os.path.expanduser(home_file))

    # Test relative path
    if os.path.exists(str(Path.home() / relative_file)):
        os.remove(Path.home() / relative_file)

    result = create_function(file_path=relative_file, overwrite=False)

    assert result == True
    with open(Path.home() / relative_file, "r") as f:
        assert f.read() == db_object_create_statement

    # Test absolute path
    if os.path.exists(full_path_file):
        os.remove(full_path_file)

    result = create_function(file_path=full_path_file, overwrite=False)

    assert result == True
    with open(full_path_file, "r") as f:
        assert f.read() == db_object_create_statement

def test_dump_and_recover(phone_book):
    db_object_create_statement2 = """CREATE OR REPLACE REST VIEW /addresses
    ON SERVICE localhost/test SCHEMA /PhoneBook
    AS PhoneBook.Addresses CLASS MyServicePhoneBookContactsWithEmail @INSERT @UPDATE @DELETE {
        id: id
    }
    ITEMS PER PAGE 10
    COMMENTS "Object that will be removed"
    MEDIA TYPE "application/json"
    OPTIONS {
        "aaa": "val aaa",
        "bbb": "val bbb"
    };"""

    session = phone_book["session"]
    schema_id = phone_book["schema_id"]
    db_object = get_default_db_object_init(session, schema_id, name="Addresses", request_path="/addresses")
    script = ""

    db_objects = lib.db_objects.get_db_objects(session, schema_id)
    assert len(db_objects) == 1

    with DbObjectCT(session, **db_object) as db_object_id:
        db_objects = lib.db_objects.get_db_objects(session, schema_id)
        assert len(db_objects) == 2

        full_path_file = os.path.expanduser("~/db_object2.dump.sql")

        # Test home path
        create_function = lambda file_path, overwrite: \
            store_create_statement(file_path=file_path,
                                        overwrite=overwrite,
                                        db_object_id=db_object_id,
                                        session=phone_book["session"])

        result = create_function(file_path=full_path_file, overwrite=True)

        assert result == True


        with open(os.path.expanduser(full_path_file), "r+") as f:
            script = f.read()
            assert script == db_object_create_statement2


    db_objects = lib.db_objects.get_db_objects(session, schema_id)
    assert len(db_objects) == 1

    lib.script.run_mrs_script(path=full_path_file)

    db_objects = lib.db_objects.get_db_objects(session, schema_id)
    assert len(db_objects) == 2

    for db_object in db_objects:
        if db_object["name"] == "Addresses":
            lib.db_objects.delete_db_object(session, db_object["id"])

    db_objects = lib.db_objects.get_db_objects(session, schema_id)
    assert len(db_objects) == 1
