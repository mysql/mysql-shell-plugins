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
import os
from pathlib import Path
from ... schemas import *
import mysqlsh
from .helpers import SchemaCT, DbObjectCT, get_default_db_object_init

schema_create_statement = """CREATE OR REPLACE REST SCHEMA /PhoneBook ON SERVICE /test
    FROM `PhoneBook`;

CREATE OR REPLACE REST VIEW /Contacts
    ON SERVICE /test SCHEMA /PhoneBook
    AS PhoneBook.Contacts CLASS MyServiceAnalogPhoneBookContacts {
        id: id @KEY @SORTABLE,
        fName: f_name,
        lName: l_name,
        number: number,
        email: email
    }
    AUTHENTICATION REQUIRED;"""

def test_add_schema(phone_book, table_contents):
    session = phone_book["session"]
    schemas_table = table_contents("db_schema")

    with SchemaCT(session, phone_book["service_id"], "PhoneBook", "/PhoneBook2") as schema_id:
        assert schemas_table.count == schemas_table.snapshot.count + 1
    assert schemas_table.same_as_snapshot


def test_get_schemas(phone_book):
    session = phone_book["session"]
    with SchemaCT(session, phone_book["service_id"], "PhoneBook", "/PhoneBook2", comments="This is a schema comment") as schema_id:
        schemas = get_schemas(session=phone_book["session"], service_id=phone_book["service_id"])
        assert schemas is not None
        assert isinstance(schemas, list)

        for schema in schemas:
            if schema["id"] == schema_id:
                assert schema == {
                    'comments': 'This is a schema comment',
                    'enabled': 1,
                    'host_ctx': '/test',
                    'id': schema_id,
                    'items_per_page': 25,
                    'name': 'PhoneBook',
                    'request_path': '/PhoneBook2',
                    'options': None,
                    'metadata': None,
                    'requires_auth': 0,
                    'service_id': phone_book["service_id"],
                    'url_host_id': schemas[1]["url_host_id"],
                    "schema_type": "DATABASE_SCHEMA",
                }


def test_get_schema(phone_book):
    args = {
        "request_path": "/PhoneBook",
        "schema_name": "PhoneBook",
        "schema_id": phone_book["schema_id"],
        "service_id": phone_book["service_id"],
        "auto_select_single": True,
        "session": phone_book["session"],
    }
    result = get_schema(**args)
    assert result is not None
    assert result == {
        'comments': 'test schema',
        'enabled': 1,
        'host_ctx': '/test',
        'id': phone_book["schema_id"],
        'items_per_page': 20,
        'name': 'PhoneBook',
        'request_path': '/PhoneBook',
        'requires_auth': 0,
        'service_id': phone_book["service_id"],
        'options': None,
        'metadata': None,
        'url_host_id': phone_book["url_host_id"],
        "schema_type": "DATABASE_SCHEMA",
    }


def test_change_schema(phone_book, table_contents):
    session = phone_book["session"]
    schema_table = table_contents("db_schema")

    args = {
        "schema_name": "PhoneBook",
        "session": phone_book["session"],
    }

    with SchemaCT(session, phone_book["service_id"], "PhoneBook", "/test_schema2") as schema_id:
        schema_table.count == schema_table.snapshot.count + 1
        assert schema_table.get("id", schema_id) == {
            "comments": "",
            "enabled": 1,
            "id": schema_id,
            "items_per_page": 25,
            "name": "PhoneBook",
            "request_path": "/test_schema2",
            "requires_auth": 0,
            "service_id": phone_book["service_id"],
            "options": None,
            "metadata": None,
            "schema_type": "DATABASE_SCHEMA",
            "internal": 0,
        }

        result = disable_schema(schema_id=schema_id, **args)
        assert result is not None
        assert result == True
        assert schema_table.get("id", schema_id)["enabled"] == False

        kwargs = {
            "schema_id": schema_id,
            "session": phone_book["session"]
        }
        schema = get_schema(**kwargs)
        assert schema.get("enabled") == 0

        result = enable_schema(schema_id=schema_id, **args)
        assert result is not None
        assert result == True
        assert schema_table.get("id", schema_id)["enabled"] == True

        schema = get_schema(**kwargs)
        assert schema.get("enabled") == 1

        args['value'] = "PhoneBook2"
        result = set_name(schema_id=schema_id, **args)
        assert result is not None
        assert result == True
        assert schema_table.get("id", schema_id)["name"] == "PhoneBook2"

        schema = get_schema(**kwargs)
        assert schema.get("name") == "PhoneBook2"

        args['schema_name'] = "PhoneBook2"
        args['value'] = "PhoneBook"
        result = set_name(schema_id=schema_id, **args)
        assert result is not None
        assert result == True
        assert schema_table.get("id", schema_id)["name"] == "PhoneBook"

        schema = get_schema(**kwargs)
        assert schema.get("name") == "PhoneBook"
        args['schema_name'] = "PhoneBook"

        # Allow to set the same request_path...will stay unchanged
        args['value'] = schema["request_path"]
        result = set_request_path(schema_id=schema_id, **args)

        # Try to change to an existing request_path
        args['value'] = "/PhoneBook"
        with pytest.raises(Exception) as exc_info:
            result = set_request_path(schema_id=schema_id, **args)
        assert str(exc_info.value) == "MySQL Error (1644): The request_path is already used by another entity."

        args['value'] = "/test_schema_4"
        result = set_request_path(schema_id=schema_id, **args)
        assert result is not None
        assert result == True
        schema = get_schema(**kwargs)
        assert schema.get("name") == "PhoneBook"
        assert schema.get("request_path") == args['value']
        assert schema_table.get("id", schema_id)["request_path"] == "/test_schema_4"

        args['value'] = True
        result = set_require_auth(schema_id=schema_id, **args)
        assert result is not None
        assert result == True
        schema = get_schema(**kwargs)
        assert schema.get("name") == "PhoneBook"
        assert schema.get("requires_auth") == args['value']
        assert schema_table.get("id", schema_id)["requires_auth"] == True

        args['value'] = 30
        result = set_items_per_page(schema_id=schema_id, **args)
        assert result is not None
        assert result == True
        schema = get_schema(**kwargs)
        assert schema.get("name") == "PhoneBook"
        assert schema.get("items_per_page") == args['value']
        assert schema_table.get("id", schema_id)["items_per_page"] == 30


        args['value'] = "New comment"
        result = set_comments(schema_id=schema_id, **args)
        assert result is not None
        assert result == True
        assert schema_table.get("id", schema_id)["comments"] == "New comment"

        args['value'] = {
            "name": "PhoneBook3",
            "requires_auth": False,
            "enabled": True,
            "request_path": "/PhoneBook3",
            "items_per_page": 25,
            "comments": "Test comment 6"
        }

        result = update_schema(schema_id=schema_id, **args)
        assert result is not None
        assert result == True
        assert schema_table.get("id", schema_id) == {
            "comments": args["value"]["comments"],
            "enabled": int(args["value"]["enabled"]),
            "id": schema_id,
            "items_per_page": args["value"]["items_per_page"],
            "name": args["value"]["name"],
            "request_path": args["value"]["request_path"],
            "requires_auth": int(args["value"]["requires_auth"]),
            "options": None,
            "service_id": phone_book["service_id"],
            "metadata": None,
            "schema_type": "DATABASE_SCHEMA",
            "internal": 0,
        }

        schema = get_schema(**kwargs)
        assert schema.get("name") == args['value']["name"]
        assert schema.get("requires_auth") == args['value']["requires_auth"]
        assert schema.get("enabled") == args['value']["enabled"]
        assert schema.get("items_per_page") == args['value']["items_per_page"]
        assert schema.get("comments") == args['value']["comments"]

        args['value'] = {
            "namexxx": "PhoneBook3",
            "requires_auth": False,
            "enabled": True,
            "request_path": "/PhoneBook3",
            "items_per_page": 25,
            "comments": "Test comment 6"
        }
        with pytest.raises(Exception) as exc_info:
            update_schema(schema_id=schema_id, **args)
        assert str(exc_info.value) == "Attempting to change an invalid schema value."


def test_get_create_statement(phone_book, table_contents):

    sql = get_create_statement(schema_id=phone_book["schema_id"], session=phone_book["session"], include_all_objects=True)

    assert sql == schema_create_statement

    sql = get_create_statement(schema="/test/PhoneBook", session=phone_book["session"], include_all_objects=True)

    assert sql == schema_create_statement


def test_dump_create_statement(phone_book, table_contents):
    home_file = "~/schema.dump.sql"
    relative_file = "schema.dump.sql"
    full_path_file = os.path.expanduser("~/schema.dump.sql")

    # Test home path
    create_function = lambda file_path, overwrite: \
        store_create_statement(file_path=file_path,
                                    overwrite=overwrite,
                                    schema_id=phone_book["schema_id"],
                                    include_all_objects=True,
                                    session=phone_book["session"])

    result = create_function(file_path=home_file, overwrite=True)

    assert result == True

    with open(os.path.expanduser(home_file), "r+") as f:
        assert f.read() == schema_create_statement

    # Test overwrite
    with open(os.path.expanduser(home_file), "a+") as f:
        f.write("<=============================>")

    with pytest.raises(Exception, match=f"Cancelling operation. File '{os.path.expanduser(home_file)}' already exists."):
        create_function(file_path=home_file, overwrite=False)

    with open(os.path.expanduser(home_file), "r") as f:
        contents = f.read()
        assert contents.startswith(schema_create_statement)
        assert contents.endswith("<=============================>")


    result = create_function(file_path=home_file, overwrite=True)

    with open(os.path.expanduser(home_file), "r") as f:
        assert f.read() == schema_create_statement

    os.remove(os.path.expanduser(home_file))

    # Test relative path
    if os.path.exists(str(Path.home() / relative_file)):
        os.remove(Path.home() / relative_file)

    result = create_function(file_path=relative_file, overwrite=False)

    assert result == True
    with open(Path.home() / relative_file, "r") as f:
        assert f.read() == schema_create_statement

    # Test absolute path
    if os.path.exists(full_path_file):
        os.remove(full_path_file)

    result = create_function(file_path=full_path_file, overwrite=False)

    assert result == True
    with open(full_path_file, "r") as f:
        assert f.read() == schema_create_statement


def test_dump_and_recover(phone_book, table_contents):
    session = phone_book["session"]
    create_statement = """CREATE OR REPLACE REST SCHEMA /PhoneBook2 ON SERVICE /test
    FROM `PhoneBook`;"""
    create_function = lambda file_path, schema_id, overwrite=True: \
        store_create_statement(file_path=file_path,
                                overwrite=overwrite,
                                schema=schema_id,
                                include_all_objects=False,
                                session=session)
    session = phone_book["session"]
    service_id = phone_book["service_id"]

    script = ""

    full_path_file = os.path.expanduser("~/schema_compare_1.dump.sql")
    full_path_file2 = os.path.expanduser("~/schema_compare_2.dump.sql")

    schemas = lib.schemas.get_schemas(session, service_id)
    assert len(schemas) == 3

    with SchemaCT(session, service_id, "PhoneBook", "/PhoneBook2") as schema_id:

        db_object = get_default_db_object_init(session, schema_id, name="Addresses", request_path="/addresses")
        with DbObjectCT(session, **db_object) as db_object_id:
            result = create_function(file_path=full_path_file, schema_id=schema_id, overwrite=True)

            assert result == True

            schemas = lib.schemas.get_schemas(session, service_id)
            assert len(schemas) == 4


    with open(os.path.expanduser(full_path_file), "r+") as f:
        script = f.read()
        assert script == create_statement


    schemas = lib.schemas.get_schemas(session, service_id)
    assert len(schemas) == 3

    with open(full_path_file, "r") as f:
        script = f.read()

    results = lib.script.run_mrs_script(mrs_script=script)

    schemas = lib.schemas.get_schemas(session, service_id)
    assert len(schemas) == 4

    for schema in schemas:
        if schema["request_path"] == "/PhoneBook2":
            create_function(full_path_file2, schema["id"], True)

    for schema in schemas:
        if schema["request_path"] == "/PhoneBook2":
            lib.schemas.delete_schema(session, schema["id"])

    schemas = lib.schemas.get_schemas(session, service_id)
    assert len(schemas) == 3

    with open(full_path_file2, "r") as f:
        assert f.read() == script


def test_dump_and_recover_include_all_objects(phone_book, table_contents):
    session = phone_book["session"]
    create_statement = """CREATE OR REPLACE REST SCHEMA /PhoneBook2 ON SERVICE /test
    FROM `PhoneBook`;

CREATE OR REPLACE REST VIEW /addresses
    ON SERVICE /test SCHEMA /PhoneBook2
    AS PhoneBook.Addresses CLASS MyServicePhoneBookContactsWithEmail @INSERT @UPDATE @DELETE {
        id: id @KEY
    }
    AUTHENTICATION NOT REQUIRED
    ITEMS PER PAGE 10
    COMMENTS "Object that will be removed"
    MEDIA TYPE "application/json"
    OPTIONS {
        "aaa": "val aaa",
        "bbb": "val bbb"
    };"""
    create_function = lambda file_path, schema_id, overwrite=True: \
        store_create_statement(file_path=file_path,
                                overwrite=overwrite,
                                schema=schema_id,
                                include_all_objects=True,
                                session=session)
    session = phone_book["session"]
    service_id = phone_book["service_id"]

    script = ""

    full_path_file = os.path.expanduser("~/schema_compare_1.dump.sql")
    full_path_file2 = os.path.expanduser("~/schema_compare_2.dump.sql")

    schemas = lib.schemas.get_schemas(session, service_id)
    assert len(schemas) == 3

    with SchemaCT(session, service_id, "PhoneBook", "/PhoneBook2") as schema_id:

        db_object = get_default_db_object_init(session, schema_id, name="Addresses", request_path="/addresses")
        with DbObjectCT(session, **db_object) as db_object_id:
            result = create_function(file_path=full_path_file, schema_id=schema_id, overwrite=True)

            assert result == True

            schemas = lib.schemas.get_schemas(session, service_id)
            assert len(schemas) == 4


    with open(os.path.expanduser(full_path_file), "r+") as f:
        script = f.read()
        assert script == create_statement


    schemas = lib.schemas.get_schemas(session, service_id)
    assert len(schemas) == 3

    with open(full_path_file, "r") as f:
        script = f.read()

    results = lib.script.run_mrs_script(mrs_script=script)

    schemas = lib.schemas.get_schemas(session, service_id)
    assert len(schemas) == 4

    for schema in schemas:
        if schema["request_path"] == "/PhoneBook2":
            create_function(full_path_file2, schema["id"], True)

    for schema in schemas:
        if schema["request_path"] == "/PhoneBook2":
            lib.schemas.delete_schema(session, schema["id"])

    schemas = lib.schemas.get_schemas(session, service_id)
    assert len(schemas) == 3

    with open(full_path_file2, "r") as f:
        assert f.read() == script
