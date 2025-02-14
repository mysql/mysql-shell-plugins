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

from tests.conftest import table_contents
from ... services import *
from .helpers import ServiceCT, SchemaCT, AuthAppCT, DbObjectCT, get_default_db_object_init, TableContents, string_replace
from mrs_plugin import lib

service_create_statement = """CREATE REST SERVICE localhost/test
    COMMENTS "Test service";"""

service_create_statement_include_all_objects = """CREATE REST SERVICE localhost/test
    COMMENTS "Test service";

CREATE REST ROLE "Process Admin" EXTENDS "Maintenance Admin" ON SERVICE localhost/test
    COMMENTS "Process administrator."
    OPTIONS {};

CREATE REST ROLE "DBA"
    COMMENTS "Database administrator."
    OPTIONS {};

CREATE REST ROLE "Full Access"
    COMMENTS "Full access to all db_objects";

CREATE REST ROLE "Maintenance Admin" EXTENDS "DBA"
    COMMENTS "Maintenance administrator."
    OPTIONS {};

CREATE OR REPLACE REST SCHEMA /AnalogPhoneBook ON SERVICE localhost/test
    FROM `AnalogPhoneBook`;

CREATE OR REPLACE REST VIEW /Contacts
    ON SERVICE localhost/test SCHEMA /AnalogPhoneBook
    AS AnalogPhoneBook.Contacts CLASS MyServiceAnalogPhoneBookContacts {
        id: id @SORTABLE,
        fName: f_name,
        lName: l_name,
        number: number,
        email: email
    }
    AUTHENTICATION REQUIRED;

CREATE OR REPLACE REST SCHEMA /MobilePhoneBook ON SERVICE localhost/test
    FROM `MobilePhoneBook`;

CREATE OR REPLACE REST VIEW /Contacts
    ON SERVICE localhost/test SCHEMA /MobilePhoneBook
    AS MobilePhoneBook.Contacts CLASS MyServiceAnalogPhoneBookContacts {
        id: id @SORTABLE,
        fName: f_name,
        lName: l_name,
        number: number,
        email: email
    }
    AUTHENTICATION REQUIRED;

CREATE OR REPLACE REST SCHEMA /PhoneBook ON SERVICE localhost/test
    FROM `PhoneBook`;

CREATE OR REPLACE REST VIEW /Contacts
    ON SERVICE localhost/test SCHEMA /PhoneBook
    AS PhoneBook.Contacts CLASS MyServiceAnalogPhoneBookContacts {
        id: id @SORTABLE,
        fName: f_name,
        lName: l_name,
        number: number,
        email: email
    }
    AUTHENTICATION REQUIRED;

CREATE OR REPLACE REST CONTENT SET /test_content_set
    ON SERVICE localhost/test
    COMMENTS "Content Set"
    OPTIONS {};

CREATE OR REPLACE REST CONTENT FILE "/readme.txt"
    ON SERVICE localhost/test CONTENT SET /test_content_set
    OPTIONS {
        "last_modification": "__README_TXT_LAST_MODIFICATION__"
    }
    CONTENT 'Line \\'1\\'
Line "2"
Line \\\\3\\\\';

CREATE OR REPLACE REST CONTENT FILE "/somebinaryfile.bin"
    ON SERVICE localhost/test CONTENT SET /test_content_set
    OPTIONS {
        "last_modification": "__SOMEBINARYFILE_BIN_LAST_MODIFICATION__"
    }
    BINARY CONTENT 'AAECAwQFBgc=';"""

def test_add_service(phone_book, table_contents):
    session = phone_book["session"]
    args = {
        "url_protocol": ["HTTP"],
        "comments": "Test service",
        "session": session
    }

    services_table = table_contents("service")

    with pytest.raises(Exception) as exc_info:
        add_service(url_context_root="/test", url_host_name="localhost", enabled=True, **args)
    assert str(exc_info.value) == "MySQL Error (1644): The request_path is already used by another entity."

    assert services_table.same_as_snapshot

    args = {
        "url_protocol": ["HTTP"],
        "comments": "Test service 2",
    }

    with ServiceCT(session, "/service2", "localhost", **args) as service_id:
        assert service_id is not None
        assert services_table.count == services_table.snapshot.count + 1

    assert services_table.same_as_snapshot


def test_get_services(phone_book, table_contents):
    services = get_services()
    assert services is not None

    args = {
        "session": phone_book["session"]
    }
    services = get_services(**args)
    assert services is not None
    assert len(services) > 0
    assert services == [{
        "id": services[0]["id"],
        "parent_id": None,
        "enabled": 1,
        "auth_completed_page_content": None,
        "auth_completed_url": None,
        "auth_completed_url_validation": None,
        "auth_path": "/authentication",
        "url_protocol": ["HTTP"],
        "url_host_name": "localhost",
        "url_context_root": "/test",
        "url_host_id": services[0]["url_host_id"],
        "options": None,
        "metadata": None,
        "comments": "Test service",
        "host_ctx": "localhost/test",
        "is_current": 1,
        "in_development": None,
        "full_service_path": "localhost/test",
        "published": 0,
        "sorted_developers": None,
        "name": "mrs",
        "auth_apps": ["MRS Auth App"],
    }]


def test_get_service(phone_book, table_contents):
    service_table = table_contents("service")
    session = phone_book["session"]
    args = {
    }
    service = get_service(url_host_name="localhost", url_context_root="/test", **args)

    assert service is not None
    assert isinstance(service, dict)
    assert service == {
        "comments": "Test service",
        "enabled": 1,
        "host_ctx": "localhost/test",
        "id": service["id"],
        "parent_id": None,
        "auth_completed_page_content": None,
        "auth_completed_url": None,
        "auth_completed_url_validation": None,
        "auth_path": "/authentication",
        "options": None,
        "metadata": None,
        "url_context_root": "/test",
        "url_host_id": service["url_host_id"],
        "url_host_name": "localhost",
        "url_protocol": ["HTTP"],
        "is_current": 1,
        "in_development": None,
        "full_service_path": "localhost/test",
        "published": 0,
        "sorted_developers": None,
        "name": "mrs",
        "auth_apps": ["MRS Auth App"],
    }
    assert service_table.snapshot[0] == {
        "comments": "Test service",
        "enabled": 1,
        "id": service["id"],
        "parent_id": None,
        "auth_completed_page_content": None,
        "auth_completed_url": None,
        "auth_completed_url_validation": None,
        "auth_path": "/authentication",
        "options": None,
        "metadata": None,
        "url_context_root": "/test",
        "url_host_id": service["url_host_id"],
        "url_protocol": ["HTTP"],
        "custom_metadata_schema": None,
        "enable_sql_endpoint": 0,
        "in_development": None,
        "published": 0,
        "name": "mrs",
    }

    with ServiceCT(session, "/service2", "localhost", **args) as service_id:
        assert service_id is not None
        service = get_service(url_host_name="localhost", url_context_root="/service2", **args)
        assert service is not None
        assert isinstance(service, dict)
        assert service == {
            "comments": "",
            "enabled": 1,
            "host_ctx": "localhost/service2",
            "id": service_id,
            "parent_id": None,
            "auth_completed_page_content": None,
            "auth_completed_url": None,
            "auth_completed_url_validation": None,
            "auth_path": "/authentication",
            "options": {
                "headers": {
                    "Access-Control-Allow-Credentials": "true",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Origin, X-Auth-Token",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                },
                "http": { "allowedOrigin": "auto" },
                "logging": {
                    "exceptions": True,
                    "request": { "body": True, "headers": True },
                    "response": { "body": True, "headers": True },
                },
                "returnInternalErrorDetails": True,
            },
            "metadata": None,
            "url_context_root": "/service2",
            "url_host_id": service["url_host_id"],
            "url_host_name": "localhost",
            "url_protocol": ["HTTP"],
            "is_current": 0,
            "in_development": None,
            "full_service_path": "localhost/service2",
            "published": 0,
            "sorted_developers": None,
            "name": "mrs",
            "auth_apps": None,
        }


def test_change_service(phone_book):
    session = phone_book["session"]
    args = {
    }

    with ServiceCT(session, url_host_name="localhost", url_context_root="/service2", **args) as service_id:
        assert service_id is not None

        args_for_get_service = {
            "session": phone_book["session"],
        }

        args_for_get_service["service_id"] = args["service_id"] = service_id

        assert disable_service(**args) == True
        service2 = get_service(**args_for_get_service)
        assert not service2["enabled"]

        assert enable_service(**args) == True
        service2 = get_service(**args_for_get_service)
        assert service2["enabled"]

        assert set_current_service(**args) == True
        assert set_current_service(session=session, service_id=phone_book["service_id"]) == True

        with pytest.raises(Exception) as exc_info:
            set_url_context_root(**args, value="/test")
        assert str(exc_info.value) == "MySQL Error (1644): The request_path is already used by another entity."

        assert set_url_context_root(**args, value="/service3") == True
        service2 = get_service(**args_for_get_service)
        assert service2["url_context_root"] == "/service3"

        assert set_protocol(**args, value = ["HTTPS"]) == True
        service2 = get_service(**args_for_get_service)
        assert service2["url_protocol"] == ["HTTPS"]

        assert set_comments(**args, value="Test service updated") == True
        service2 = get_service(**args_for_get_service)
        assert service2["comments"] == "Test service updated"

        value = {
            "url_context_root": "/service4",
            "url_protocol": ["HTTP"],
            "comments": "Test service comments",
            "enabled": False
        }
        update_service(**args, value=value) == True
        service2 = get_service(**args_for_get_service)

        assert service2["url_context_root"] == value["url_context_root"]
        assert service2["url_protocol"] == value["url_protocol"]
        assert service2["comments"] == value["comments"]
        assert service2["enabled"] == value["enabled"]

        value = {
            "url_context_rootxxx": "/service4",
            "url_protocol": ["HTTP"],
            "comments": "Test service comments",
            "enabled": False
        }
        with pytest.raises(Exception) as exc_info:
            update_service(**args, service_ids=[1], value=value)
        assert str(exc_info.value) == "Attempting to change an invalid service value."


def test_delete_service(phone_book, table_contents):
    service_args = {
        "url_context_root": "/service_to_delete",
        "url_host_name": "localhost",
        "url_protocol": "HTTP",
        "is_default": False,
        "comments": "no comments",
        "name": "mrs",
    }

    result = add_service(**service_args)

    assert result is not None
    assert isinstance(result, dict)

    with pytest.raises(Exception) as exc_info:
        delete_service(service_id=1)
    assert str(exc_info.value) == "Invalid id type for 'service_id'."

    with pytest.raises(Exception) as exc_info:
        delete_service(service_id="1")
    assert str(exc_info.value) == "Invalid id format for 'service_id'."

    assert delete_service(service_id=result["id"]) == True


def test_get_create_statement(phone_book, table_contents):
    content_file_table: TableContents = table_contents("content_file")
    session = phone_book["session"]
    expected_service_create_statement = string_replace(service_create_statement_include_all_objects, {
            "__README_TXT_LAST_MODIFICATION__": content_file_table.filter("request_path", "/readme.txt")[0]["options"]["last_modification"],
            "__SOMEBINARYFILE_BIN_LAST_MODIFICATION__": content_file_table.filter("request_path", "/somebinaryfile.bin")[0]["options"]["last_modification"],
        })

    # Test without including all objects
    sql = get_create_statement(service_id=phone_book["service_id"], include_all_objects=False, session=phone_book["session"])

    assert sql == service_create_statement

    # Test by including all objects
    sql = get_create_statement(service_id=phone_book["service_id"], include_all_objects=True, session=phone_book["session"])

    assert sql == expected_service_create_statement



def test_dump_create_statement(phone_book, table_contents):
    home_file = "~/service.dump.sql"
    relative_file = "service.dump.sql"
    full_path_file = os.path.expanduser("~/service.dump.sql")

    # Test home path
    create_function = lambda file_path, overwrite, include_all_objects: \
        store_create_statement(file_path=file_path,
                                overwrite=overwrite,
                                include_all_objects=include_all_objects,
                                service_id=phone_book["service_id"],
                                session=phone_book["session"])

    # Test without including all objects
    result = create_function(file_path=home_file, overwrite=True, include_all_objects=False)

    assert result == True

    with open(os.path.expanduser(home_file), "r+") as f:
        assert f.read() == service_create_statement

    # Test by including all objects
    result = create_function(file_path=home_file, overwrite=True, include_all_objects=True)

    assert result == True

    content_file_table: TableContents = table_contents("content_file")
    expected_service_create_statement = string_replace(service_create_statement_include_all_objects, {
            "__README_TXT_LAST_MODIFICATION__": content_file_table.filter("request_path", "/readme.txt")[0]["options"]["last_modification"],
            "__SOMEBINARYFILE_BIN_LAST_MODIFICATION__": content_file_table.filter("request_path", "/somebinaryfile.bin")[0]["options"]["last_modification"],
        })

    with open(os.path.expanduser(home_file), "r+") as f:
        assert f.read() == expected_service_create_statement

    # Test overwrite
    with open(os.path.expanduser(home_file), "a+") as f:
        f.write("<=============================>")

    with pytest.raises(Exception, match=f"Cancelling operation. File '{os.path.expanduser(home_file)}' already exists."):
        create_function(file_path=home_file, overwrite=False, include_all_objects=True)

    with open(os.path.expanduser(home_file), "r") as f:
        contents = f.read()
        assert contents.startswith(expected_service_create_statement)
        assert contents.endswith("<=============================>")


    result = create_function(file_path=home_file, overwrite=True, include_all_objects=True)

    with open(os.path.expanduser(home_file), "r") as f:
        assert f.read() == expected_service_create_statement

    os.remove(os.path.expanduser(home_file))

    # Test relative path
    if os.path.exists(str(Path.home() / relative_file)):
        os.remove(Path.home() / relative_file)

    result = create_function(file_path=relative_file, overwrite=False, include_all_objects=True)

    assert result == True
    with open(Path.home() / relative_file, "r") as f:
        assert f.read() == expected_service_create_statement

    # Test absolute path
    if os.path.exists(full_path_file):
        os.remove(full_path_file)

    result = create_function(file_path=full_path_file, overwrite=False, include_all_objects=True)

    assert result == True
    with open(full_path_file, "r") as f:
        assert f.read() == expected_service_create_statement


def test_dump_and_recover(phone_book, table_contents):
    create_statement = """CREATE REST SERVICE localhost/test2
    OPTIONS {
        "http": {
            "allowedOrigin": "auto"
        },
        "headers": {
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Origin, X-Auth-Token",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Credentials": "true"
        },
        "logging": {
            "request": {
                "body": true,
                "headers": true
            },
            "response": {
                "body": true,
                "headers": true
            },
            "exceptions": true
        },
        "returnInternalErrorDetails": true
    };

CREATE REST ROLE "DBA"
    COMMENTS "Database administrator."
    OPTIONS {};

CREATE REST ROLE "Full Access"
    COMMENTS "Full access to all db_objects";

CREATE REST ROLE "Maintenance Admin" EXTENDS "DBA"
    COMMENTS "Maintenance administrator."
    OPTIONS {};

CREATE OR REPLACE REST SCHEMA /PhoneBook2 ON SERVICE localhost/test2
    FROM `PhoneBook`;

CREATE OR REPLACE REST VIEW /addresses
    ON SERVICE localhost/test2 SCHEMA /PhoneBook2
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
    create_function = lambda file_path, service_id, overwrite=True, include_all_objects=True: \
        store_create_statement(file_path=file_path,
                                    overwrite=overwrite,
                                    include_all_objects=include_all_objects,
                                    service_id=service_id,
                                    session=phone_book["session"])
    session = phone_book["session"]

    script = ""

    full_path_file = os.path.expanduser("~/service_compare_1.dump.sql")
    full_path_file2 = os.path.expanduser("~/service_compare_2.dump.sql")

    services = lib.services.get_services(session)
    assert len(services) == 1

    with ServiceCT(session, "/test2", "localhost") as service_id:
        with SchemaCT(session, service_id, "PhoneBook", "/PhoneBook2") as schema_id:
            auth_app_init = {
                "name": "Test Auth App 3",
                "service_id": service_id,
                "auth_vendor_id": lib.core.id_to_binary("0x31000000000000000000000000000000", "auth_vendor_id"),
                "default_role_id": lib.core.id_to_binary("0x31000000000000000000000000000000", "default_role_id"),
                "description": "Authentication via MySQL accounts 3",
                "url": "/test_auth3",
                "access_token": "test_token",
                "limit_to_registered_users": False,
                "registered_users": None,
                "app_id": "some app id",
            }
            with AuthAppCT(session, **auth_app_init) as auth_app_id:

                db_object = get_default_db_object_init(session, schema_id, name="Addresses", request_path="/addresses")
                with DbObjectCT(session, **db_object) as db_object_id:
                    result = create_function(file_path=full_path_file, service_id=service_id, include_all_objects=True)

                    assert result == True

                    services = lib.services.get_services(session)
                    assert len(services) == 2

    with open(os.path.expanduser(full_path_file), "r+") as f:
        script = f.read()
        assert script == create_statement.replace("Test Auth App 2", "Test Auth App 3").replace("Authentication via MySQL accounts 2", "Authentication via MySQL accounts 3")


    services = lib.services.get_services(session)
    assert len(services) == 1

    with open(full_path_file, "r") as f:
        script = f.read()

    results = lib.script.run_mrs_script(mrs_script=script)

    assert len(results) == 6 # for the 6 statements in create_statement

    for result in results:
        assert result["type"] == "success"

    services = lib.services.get_services(session)
    assert len(services) == 2

    for service in services:
        if service["host_ctx"] == "localhost/test2":
            create_function(full_path_file2, service["id"], include_all_objects=True)
            lib.services.delete_service(session, service["id"])

    services = lib.services.get_services(session)

    assert len(services) == 1

    with open(full_path_file2, "r") as f:
        assert f.read() == script


def test_service_selection(phone_book, table_contents):
    service_table: TableContents = table_contents("service")
    content_file_table: TableContents = table_contents("content_file")
    session = phone_book["session"]

    with ServiceCT(session, url_host_name="localhost", url_context_root="/service2", **{ "comments": "Test service2" }) as service2_id:
        assert service2_id is not None
        assert len(service_table.items) == 2
        service_id = phone_book["service_id"]

        service2_create_statement = """CREATE REST SERVICE localhost/service2
    COMMENTS "Test service2"
    OPTIONS {
        "http": {
            "allowedOrigin": "auto"
        },
        "headers": {
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Origin, X-Auth-Token",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Credentials": "true"
        },
        "logging": {
            "request": {
                "body": true,
                "headers": true
            },
            "response": {
                "body": true,
                "headers": true
            },
            "exceptions": true
        },
        "returnInternalErrorDetails": true
    };"""


        items = [
            { "result": service_create_statement },
            { "service_id": lib.core.convert_id_to_string(service_id), "result": service_create_statement },
            { "service_id": lib.core.convert_id_to_string(service_id), "service": "localhost/service2", "result": service_create_statement },
            { "service_id": lib.core.convert_id_to_string(service2_id), "result": service2_create_statement },
            { "service": "localhost/service2", "result": service2_create_statement },
            { "service": lib.core.convert_id_to_string(service2_id), "result": service2_create_statement },
            { "url_host_name": "localhost", "url_context_root": "/service2", "result": service2_create_statement },
            { "service": "localhost/test", "url_host_name": "localhost", "url_context_root": "/service2", "result": service_create_statement },
            { "service_id": lib.core.convert_id_to_string(service_id), "url_host_name": "localhost", "url_context_root": "/service2", "result": service_create_statement },
        ]

        for item in items:
            sql = get_create_statement(service_id=item.get("service_id"),
                                    service=item.get("service"),
                                    url_host_name=item.get("url_host_name"), url_context_root=item.get("url_context_root"),
                                    include_all_objects=False, session=phone_book["session"])

            assert sql == item["result"]
