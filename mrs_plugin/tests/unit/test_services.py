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

service_create_statement = """CREATE OR REPLACE REST SERVICE /test
    COMMENT 'Test service'
    ADD AUTH APP `MRS Auth App` IF EXISTS;"""

service_create_statement_include_database_endpoints = """CREATE OR REPLACE REST SERVICE /test
    COMMENT 'Test service'
    ADD AUTH APP `MRS Auth App` IF EXISTS;

CREATE REST ROLE `DBA` ON SERVICE /test
    COMMENT 'Database administrator.';

CREATE REST ROLE `Maintenance Admin` EXTENDS `DBA` ON SERVICE /test
    COMMENT 'Maintenance administrator.';

CREATE REST ROLE `Process Admin` EXTENDS `Maintenance Admin` ON SERVICE /test
    COMMENT 'Process administrator.';

CREATE OR REPLACE REST SCHEMA /AnalogPhoneBook ON SERVICE /test
    FROM `AnalogPhoneBook`
    AUTHENTICATION NOT REQUIRED;

CREATE OR REPLACE REST VIEW /Contacts
    ON SERVICE /test SCHEMA /AnalogPhoneBook
    AS AnalogPhoneBook.Contacts CLASS MyServiceAnalogPhoneBookContacts {
        id: id @KEY @SORTABLE,
        fName: f_name,
        lName: l_name,
        number: number,
        email: email
    }
    AUTHENTICATION REQUIRED;

CREATE OR REPLACE REST SCHEMA /MobilePhoneBook ON SERVICE /test
    FROM `MobilePhoneBook`
    AUTHENTICATION NOT REQUIRED;

CREATE OR REPLACE REST VIEW /Contacts
    ON SERVICE /test SCHEMA /MobilePhoneBook
    AS MobilePhoneBook.Contacts CLASS MyServiceAnalogPhoneBookContacts {
        id: id @KEY @SORTABLE,
        fName: f_name,
        lName: l_name,
        number: number,
        email: email
    }
    AUTHENTICATION REQUIRED;

CREATE OR REPLACE REST SCHEMA /PhoneBook ON SERVICE /test
    FROM `PhoneBook`
    AUTHENTICATION NOT REQUIRED;

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


def test_validate_service_path(phone_book):
    session = phone_book["session"]

    service, schema, content_set = lib.services.validate_service_path(session, None)
    assert service is None
    assert schema is None
    assert content_set is None

    service, schema, content_set = lib.services.validate_service_path(session, "/test/PhoneBook")
    assert service is not None
    assert service == {
        "id": phone_book["service_id"],
        "parent_id": None,
        "enabled": 1,
        "auth_completed_page_content": None,
        "auth_completed_url": None,
        "auth_completed_url_validation": None,
        "auth_path": "/authentication",
        "url_protocol": ["HTTP"],
        "url_host_name": "",
        "url_context_root": "/test",
        "url_host_id": phone_book["url_host_id"],
        "options": None,
        "metadata": None,
        "comments": "Test service",
        "host_ctx": "/test",
        "is_current": 1,
        "in_development": None,
        "full_service_path": "/test",
        "published": 0,
        "sorted_developers": None,
        "name": "mrs",
        "auth_apps": ["MRS Auth App"],
    }

    assert schema is not None
    assert schema == {
        "id": phone_book["schema_id"],
        "name": "PhoneBook",
        "service_id": phone_book["service_id"],
        "request_path": "/PhoneBook",
        "requires_auth": 0,
        "enabled": 1,
        "options": None,
        "metadata": None,
        "items_per_page": 20,
        "comments": "test schema",
        "host_ctx": "/test",
        "url_host_id": phone_book["url_host_id"],
        "schema_type": "DATABASE_SCHEMA",
        "internal": 0,
    }

    assert content_set is None

    with pytest.raises(ValueError) as exc_info:
        service, schema, content_set = lib.services.validate_service_path(session, "/test/schema")
    assert str(exc_info.value) == "The given schema or content set was not found."

    with pytest.raises(ValueError) as exc_info:
        service, schema, content_set = lib.services.validate_service_path(session, "127.0.0.1/test")
    assert str(exc_info.value) == "The given MRS service was not found."


def test_add_service(phone_book, table_contents):
    session = phone_book["session"]
    args = {
        "url_protocol": ["HTTP"],
        "comments": "Test service",
        "session": session
    }

    services_table = table_contents("service")

    with pytest.raises(Exception) as exc_info:
        add_service(url_context_root="/test", enabled=True, **args)
    assert str(exc_info.value) == "MySQL Error (1644): The request_path is already used by another entity."

    assert services_table.same_as_snapshot

    args = {
        "url_protocol": ["HTTP"],
        "comments": "Test service 2",
    }

    with ServiceCT(session, "/service2", **args) as service_id:
        assert service_id is not None
        assert services_table.count == services_table.snapshot.count + 1

    assert services_table.same_as_snapshot


def test_get_services(phone_book, table_contents):
    session = phone_book["session"]
    session.run_sql("use rest service /test")

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
        "url_host_name": "",
        "url_context_root": "/test",
        "url_host_id": services[0]["url_host_id"],
        "options": None,
        "metadata": None,
        "comments": "Test service",
        "host_ctx": "/test",
        "is_current": 1,
        "in_development": None,
        "full_service_path": "/test",
        "published": 0,
        "sorted_developers": None,
        "name": "mrs",
        "auth_apps": ["MRS Auth App"],
    }]


def test_get_service(phone_book, table_contents):
    service_table = table_contents("service")
    session = phone_book["session"]
    session.run_sql("use rest service /test")

    args = {
    }

    service = get_service(url_context_root="/test", **args)

    assert service is not None
    assert isinstance(service, dict)
    assert service == {
        "comments": "Test service",
        "enabled": 1,
        "host_ctx": "/test",
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
        "url_host_name": "",
        "is_current": 1,
        "in_development": None,
        "full_service_path": "/test",
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

    with ServiceCT(session, "/service2", **args) as service_id:
        assert service_id is not None
        service = get_service(url_context_root="/service2", **args)
        assert service is not None
        assert isinstance(service, dict)
        assert service == {
            "comments": "",
            "enabled": 1,
            "host_ctx": "/service2",
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
            "url_protocol": ["HTTP"],
            "url_host_name": "",
            "is_current": 0,
            "in_development": None,
            "full_service_path": "/service2",
            "published": 0,
            "sorted_developers": None,
            "name": "mrs",
            "auth_apps": None,
        }


def test_change_service(phone_book):
    session = phone_book["session"]
    args = {
    }

    with ServiceCT(session, url_context_root="/service2", **args) as service_id:
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

        metadata = get_current_service_metadata(**args)
        assert sorted(metadata.keys()) == ["host_ctx", "id", "metadata_version"]
        assert metadata["id"] == lib.core.convert_id_to_string(phone_book["service_id"])

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
    assert str(exc_info.value) == "Invalid id format '1' for 'service_id'."

    assert delete_service(service_id=result["id"]) == True


def test_get_service_create_statement(phone_book, table_contents):
    content_file_table: TableContents = table_contents("content_file")
    user_table: TableContents = table_contents("mrs_user")
    session = phone_book["session"]

    expected_service_create_statement = string_replace(service_create_statement, {
            "__USER1_PASSWORD__": user_table.filter("name", "User 1")[0]["auth_string"],
        })

    expected_service_create_statement_include_database_endpoints = string_replace(service_create_statement_include_database_endpoints, {
            "__README_TXT_LAST_MODIFICATION__": content_file_table.filter("request_path", "/readme.txt")[0]["options"]["last_modification"],
            "__SOMEBINARYFILE_BIN_LAST_MODIFICATION__": content_file_table.filter("request_path", "/somebinaryfile.bin")[0]["options"]["last_modification"],
            "__USER1_PASSWORD__": user_table.filter("name", "User 1")[0]["auth_string"],
        })

    # Test without including all objects
    sql = get_service_create_statement(service_id=phone_book["service_id"], include_database_endpoints=False, session=phone_book["session"])

    assert sql == expected_service_create_statement

    # Test by including all objects
    sql = get_service_create_statement(service_id=phone_book["service_id"], include_database_endpoints=True, session=phone_book["session"])

    assert sql == expected_service_create_statement_include_database_endpoints

def test_service_selection(phone_book, table_contents):
    service_table: TableContents = table_contents("service")
    user_table: TableContents = table_contents("mrs_user")
    content_file_table: TableContents = table_contents("content_file")
    session = phone_book["session"]

    with ServiceCT(session, url_context_root="/service2", **{ "comments": "Test service2" }) as service2_id:
        assert service2_id is not None
        assert len(service_table.items) == 2, service_table.items
        service_id = phone_book["service_id"]

        service2_create_statement = """CREATE OR REPLACE REST SERVICE /service2
    COMMENT 'Test service2'
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
            { "service_id": lib.core.convert_id_to_string(service_id), "service": "/service2", "result": service_create_statement },
            { "service_id": lib.core.convert_id_to_string(service2_id), "result": service2_create_statement },
            { "service": "/service2", "result": service2_create_statement },
            { "service": lib.core.convert_id_to_string(service2_id), "result": service2_create_statement },
            { "url_context_root": "/service2", "result": service2_create_statement },
            #{ "service": "/test", "url_context_root": "/service2", "result": service_create_statement },
            #{ "service_id": lib.core.convert_id_to_string(service_id), "url_context_root": "/service2", "result": service_create_statement },
        ]

        for item in items:
            sql = get_service_create_statement(service_id=item.get("service_id"),
                                    service=item.get("service"),
                                    url_context_root=item.get("url_context_root"),
                                    include_database_endpoints=False, session=phone_book["session"])
            assert sql == item["result"]


def test_sql_service_add_authapp(phone_book):
    session = phone_book["session"]

    session.run_sql('create rest auth app `MyAuthApp` VENDOR `MRS`')
    session.run_sql('create rest auth app `MyAuthApp2` VENDOR `MRS`')
    session.run_sql("create rest service /myTestSvc add auth app `MyAuthApp` if exists add auth app `Invalid` if exists")
    ddl = session.run_sql("show create rest service /myTestSvc").fetch_one()[0]
    assert ddl == """CREATE OR REPLACE REST SERVICE /myTestSvc
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
    }
    ADD AUTH APP `MyAuthApp` IF EXISTS;"""
    session.run_sql("alter rest service /myTestSvc remove auth app `MyAuthApp` if exists remove auth app `Invalid` if exists add auth app `MyAuthApp2`")
    ddl = session.run_sql("show create rest service /myTestSvc").fetch_one()[0]
    assert ddl == """CREATE OR REPLACE REST SERVICE /myTestSvc
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
    }
    ADD AUTH APP `MyAuthApp2` IF EXISTS;"""

    session.run_sql('drop rest auth app `MyAuthApp`')
    session.run_sql('drop rest auth app `MyAuthApp2`')
    session.run_sql("drop rest service /myTestSvc")
