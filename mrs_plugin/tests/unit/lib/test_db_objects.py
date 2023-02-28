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


@pytest.mark.usefixtures("phone_book")
def test_add_db_object(phone_book, table_contents):
    db_object = {
        "db_object_name": "Addresses",
        "db_object_type": "TABLE",
        "schema_id": phone_book["schema_id"],
        "request_path": "table_addresses",
        "requires_auth": False,
        "items_per_page": 10,
        "row_user_ownership_enforced": False,
        "row_user_ownership_column": "",
        "session": phone_book["session"],
        "crud_operations": None,
        "crud_operation_format": None,
        "comments": None,
        "media_type": None,
        "enabled": True,
        "auto_detect_media_type": True,
        "auth_stored_procedure": '0',
        "options": None,
        "fields": None
    }

    # db_object_table = table_contents("db_object")
    # with pytest.raises(Exception) as exc_info:
    #     lib.db_objects.add_db_object(**db_object)
    # assert str(exc_info.value) == "The request_path has to start with '/'."

    # assert db_object_table.same_as_snapshot

    # db_object["request_path"] = "/table_addresses"
    # with pytest.raises(ValueError) as exc_info:
    #     lib.db_objects.add_db_object(**db_object)
    # assert str(exc_info.value) == "No CRUD operations specified.Operation cancelled."

    # assert db_object_table.same_as_snapshot

    # db_object["crud_operations"] = ['CREATE', 'READ', 'UPDATE', 'DELETE']
    # with pytest.raises(ValueError) as exc_info:
    #     lib.db_objects.add_db_object(**db_object)
    # assert str(exc_info.value) == "No CRUD operation format specified.Operation cancelled."

    # assert db_object_table.same_as_snapshot

    # db_object["crud_operation_format"] = "FEED"
    # db_object["crud_operations"] = 1
    # with pytest.raises(TypeError) as exc_info:
    #     lib.db_objects.add_db_object(**db_object)
    # assert str(exc_info.value) == "The crud_operations parameter need to be specified as list. Operation cancelled."

    # assert db_object_table.same_as_snapshot

    # db_object["crud_operations"] = ['CRETE']
    # with pytest.raises(ValueError) as exc_info:
    #     lib.db_objects.add_db_object(**db_object)
    # assert str(exc_info.value) == "The given CRUD operation CRETE does not exist."

    # assert db_object_table.same_as_snapshot

    # db_object["db_object_type"] = "TBLE"
    # with pytest.raises(ValueError) as exc_info:
    #     lib.db_objects.add_db_object(**db_object)
    # assert str(exc_info.value) == "Invalid db_object_type. Only valid types are TABLE, VIEW and PROCEDURE."

    # assert db_object_table.same_as_snapshot


def test_get_db_object(phone_book, mobile_phone_book):

    with lib.core.MrsDbSession(session=phone_book["session"]) as session:

        db_object = lib.db_objects.get_db_object(session=session, schema_id=phone_book["schema_id"])

        # with pytest.raises(Exception) as exc_info:
        #     lib.db_objects.get_db_object(session=session, schema_id=phone_book["schema_id"], request_path="/test_abc", db_object_name="db1")
        # assert str(exc_info.value) == "The given database object was not found."
        db_object = lib.db_objects.get_db_object(session=session, schema_id=phone_book["schema_id"],
            request_path="/test_abc", db_object_name="db1")
        assert db_object is None

        db_object = lib.db_objects.get_db_object(session=session, db_object_id=phone_book["db_object_id"])
        assert db_object is not None
        assert db_object['id'] == phone_book["db_object_id"]
        assert db_object['name'] == 'Contacts'
        assert db_object['object_type'] == 'TABLE'

        # This might take one of these values depending on if the db_object tests already ran
        assert db_object['request_path'] == '/db_table' or db_object['request_path'] == '/movedObject'
        assert db_object['db_schema_id'] == phone_book["schema_id"] or db_object['db_schema_id'] == mobile_phone_book["schema_id"]


def test_set_crud_operations(phone_book, mobile_phone_book, table_contents):

    with lib.core.MrsDbSession(session=phone_book["session"]) as session:
        db_object_table = table_contents("db_object")

        with pytest.raises(ValueError) as exc_info:
            lib.db_objects.set_crud_operations(session=session, db_object_id=phone_book["db_object_id"], crud_operations=None,
                crud_operation_format="FEED")
        assert str(exc_info.value) == "No CRUD operations specified.Operation cancelled."

        assert db_object_table.same_as_snapshot

        with pytest.raises(ValueError) as exc_info:
            lib.db_objects.set_crud_operations(session=session, db_object_id=phone_book["db_object_id"], crud_operations=['CREATE', 'READ', 'UPDATE', 'DELETE'],
                crud_operation_format=None)
        assert str(exc_info.value) == "No CRUD operation format specified.Operation cancelled."

        assert db_object_table.same_as_snapshot

        with pytest.raises(ValueError) as exc_info:
            lib.db_objects.set_crud_operations(session=session, db_object_id=phone_book["db_object_id"], crud_operations=('CREATE', 'READ', 'UPDATE', 'DELETE'),
                crud_operation_format="FEED")
        assert str(exc_info.value) == "The crud_operations need to be specified as list. Operation cancelled."

        assert db_object_table.same_as_snapshot

        with pytest.raises(ValueError) as exc_info:
            lib.db_objects.set_crud_operations(session=session, db_object_id=phone_book["db_object_id"], crud_operations=['CRAETE'], crud_operation_format="FEED")
        assert str(exc_info.value) == "The given CRUD operation CRAETE does not exist."

        assert db_object_table.same_as_snapshot

        lib.db_objects.set_crud_operations(session=session,
            db_object_id=phone_book["db_object_id"], crud_operations=['CREATE', 'READ', 'UPDATE'],
            crud_operation_format="FEED")

        result = lib.db_objects.get_db_object(session, db_object_id=phone_book["db_object_id"])
        assert result == {
            'id': phone_book["db_object_id"],
            'changed_at': result["changed_at"],
            'db_schema_id': phone_book["schema_id"],
            'name': 'Contacts',
            'request_path': '/db_table',
            'enabled': 1,
            'object_type': 'TABLE',
            'crud_operation_format': 'FEED',
            'crud_operations': ['CREATE', 'READ', 'UPDATE'],
            'host_ctx': 'localhost/test',
            'qualified_name': 'PhoneBook.Contacts',
            'items_per_page': None,
            'media_type': None,
            'auto_detect_media_type': 1,
            'requires_auth': 0,
            'auth_stored_procedure': '0',
            'row_user_ownership_enforced': 0,
            'row_user_ownership_column': '',
            'comments': 'Test table',
            'options': None,
            'schema_name': 'PhoneBook',
            'schema_request_path': '/PhoneBook',
            'service_id': phone_book["service_id"],
        } or result == {
            'id': phone_book["db_object_id"],
            'changed_at': result["changed_at"],
            'db_schema_id': mobile_phone_book["schema_id"],
            'name': 'Contacts',
            'request_path': '/movedObject',
            'enabled': 1,
            'object_type': 'TABLE',
            'crud_operation_format': 'FEED',
            'crud_operations': ['CREATE', 'READ', 'UPDATE'],
            'host_ctx': 'localhost/test',
            'qualified_name': 'MobilePhoneBook.Contacts',
            'items_per_page': None,
            'media_type': None,
            'auto_detect_media_type': 1,
            'requires_auth': 0,
            'auth_stored_procedure': '0',
            'row_user_ownership_enforced': 0,
            'row_user_ownership_column': '',
            'comments': 'Test table',
            'options': None,
            'schema_name': 'MobilePhoneBook',
            'schema_request_path': '/MobilePhoneBook',
            'service_id': phone_book["service_id"],
        }

        db_object_table_data = db_object_table.get("id", phone_book["db_object_id"])
        assert db_object_table_data["crud_operations"] == ["CREATE","READ","UPDATE"]

        assert not db_object_table.same_as_snapshot

        lib.db_objects.set_crud_operations(session=session,
            db_object_id=phone_book["db_object_id"], crud_operations=['CREATE', 'READ', 'UPDATE', 'DELETE'],
            crud_operation_format="FEED")

        result = lib.db_objects.get_db_object(session, db_object_id=phone_book["db_object_id"])

        assert result == {
            'id': phone_book["db_object_id"],
            'changed_at': result["changed_at"],
            'db_schema_id': phone_book["schema_id"],
            'name': 'Contacts',
            'request_path': '/db_table',
            'enabled': 1,
            'object_type': 'TABLE',
            'crud_operation_format': 'FEED',
            'crud_operations': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
            'host_ctx': 'localhost/test',
            'qualified_name': 'PhoneBook.Contacts',
            'items_per_page': None,
            'media_type': None,
            'auto_detect_media_type': 1,
            'requires_auth': 0,
            'auth_stored_procedure': '0',
            'row_user_ownership_enforced': 0,
            'row_user_ownership_column': '',
            'comments': 'Test table',
            'options': None,
            'schema_name': 'PhoneBook',
            'schema_request_path': '/PhoneBook',
            'service_id': phone_book["service_id"],

        } or result == {
            'id': phone_book["db_object_id"],
            'changed_at': result["changed_at"],
            'db_schema_id': mobile_phone_book["schema_id"],
            'name': 'Contacts',
            'request_path': '/movedObject',
            'enabled': 1,
            'object_type': 'TABLE',
            'crud_operation_format': 'FEED',
            'crud_operations': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
            'host_ctx': 'localhost/test',
            'qualified_name': 'MobilePhoneBook.Contacts',
            'items_per_page': None,
            'media_type': None,
            'auto_detect_media_type': 1,
            'requires_auth': 0,
            'auth_stored_procedure': '0',
            'row_user_ownership_enforced': 0,
            'row_user_ownership_column': '',
            'comments': 'Test table',
            'options': None,
            'schema_name': 'MobilePhoneBook',
            'schema_request_path': '/MobilePhoneBook',
            'service_id': phone_book["service_id"],
        }
        db_object_table_data = db_object_table.get("id", phone_book["db_object_id"])
        assert db_object_table_data["crud_operations"] == ["CREATE","READ","UPDATE","DELETE"]


def test_db_object_update(phone_book, table_contents):

    with lib.core.MrsDbSession(session=phone_book["session"]) as session:
        db_object_table = table_contents("db_object")
        db_object = lib.db_objects.get_db_object(session=session, db_object_id=phone_book["db_object_id"])
        assert db_object is not None

        value = {
            'auth_stored_procedure': '0',
            'auto_detect_media_type': 1,
            'comments': 'Test table',
            'crud_operation_format': 'ITEM',
            'crud_operations': ['CREATE', 'READ'],
            'db_schema_id': phone_book["schema_id"],
            'enabled': 1,
            'items_per_page': 15,
            'media_type': None,
            'name': 'ContactsWithEmail',
            'object_type': 'TABLE',
            'options': None,
            'request_path': '/view_contects_wit_email2',
            'requires_auth': 0,
            'row_user_ownership_column': '',
            'row_user_ownership_enforced': 0,
        }


        lib.db_objects.update_db_objects(session=session, db_object_ids=[phone_book["db_object_id"]], value=value)
        assert not db_object_table.same_as_snapshot

        lib.db_objects.update_db_objects(session=session, db_object_ids=[phone_book["db_object_id"]], value={
            'auth_stored_procedure': db_object["auth_stored_procedure"],
            'auto_detect_media_type': db_object["auto_detect_media_type"],
            'comments': db_object["comments"],
            'crud_operation_format': db_object["crud_operation_format"],
            'crud_operations': db_object["crud_operations"],
            'db_schema_id': db_object["db_schema_id"],
            'enabled': db_object["enabled"],
            'items_per_page': db_object["items_per_page"],
            'media_type': db_object["media_type"],
            'name': db_object["name"],
            'object_type': db_object["object_type"],
            'options': db_object["options"],
            'request_path': db_object["request_path"],
            'requires_auth': db_object["requires_auth"],
            'row_user_ownership_column': db_object["row_user_ownership_column"],
            'row_user_ownership_enforced': db_object["row_user_ownership_enforced"],
        })
        assert db_object_table.same_as_snapshot


