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
from ..helpers import get_db_object_privileges, DbObjectCT, TableContents, get_default_db_object_init

@pytest.mark.usefixtures("phone_book")
def test_add_db_object(phone_book, table_contents):
    db_object_table = table_contents("db_object")
    session = phone_book["session"]
    schema_id = phone_book["schema_id"]
    db_object_init = get_default_db_object_init(session, schema_id)

    with DbObjectCT(session, **db_object_init) as db_object_id:
        assert db_object_table.get("id", db_object_id) == {
            'auth_stored_procedure': None,
            'auto_detect_media_type': 1,
            'comments': 'Object that will be removed',
            'crud_operations': ['CREATE', 'READ', 'UPDATE'],
            'db_schema_id': schema_id,
            'details': None,
            'enabled': 1,
            'format': 'FEED',
            'id': db_object_id,
            'items_per_page': 10,
            'media_type': 'media type',
            'name': 'ContactBasicInfo',
            'object_type': 'VIEW',
            'options': {
                'aaa': 'val aaa',
                'bbb': 'val bbb'
            },
            'request_path': '/view_contact_basic_info',
            'requires_auth': 0,
            'row_user_ownership_column': '',
            'row_user_ownership_enforced': 0,
        }

    assert db_object_table.same_as_snapshot

def test_update_db_object(phone_book, table_contents):
    db_object_table: TableContents = table_contents("db_object")

    with lib.core.MrsDbSession(session=phone_book["session"]) as session:
        db_object = get_default_db_object_init(session, phone_book["schema_id"])

        with DbObjectCT(session, **db_object) as db_object_id:
            expected = {
                "id": db_object_id,
                "auth_stored_procedure": db_object["auth_stored_procedure"],
                "auto_detect_media_type": int(db_object["auto_detect_media_type"]),
                "comments": db_object["comments"],
                "crud_operation_format": db_object["crud_operation_format"],
                "crud_operations": db_object["crud_operations"],
                "db_schema_id": phone_book["schema_id"],
                "enabled": int(db_object["enabled"]),
                "host_ctx": "localhost/test",
                "items_per_page": db_object["items_per_page"],
                "media_type": db_object["media_type"],
                "name": db_object["db_object_name"],
                "object_type": db_object["db_object_type"],
                "options": db_object["options"],
                "qualified_name": f'PhoneBook.{db_object["db_object_name"]}',
                "request_path": db_object["request_path"],
                "requires_auth": int(db_object["requires_auth"]),
                "row_user_ownership_column": db_object["row_user_ownership_column"],
                "row_user_ownership_enforced": int(db_object["row_user_ownership_enforced"]),
                "schema_name": "PhoneBook",
                "schema_request_path": "/PhoneBook",
                "service_id": phone_book["service_id"],

            }

            result = lib.db_objects.get_db_object(session, db_object_id)
            assert result is not None
            expected["changed_at"] = result["changed_at"]

            assert result == expected

            final = {
                "auth_stored_procedure": "<stored procedure text>",
                "auto_detect_media_type": True,
                "comments": "Comments updated",
                "crud_operation_format": "ITEM",
                "crud_operations": ["CREATE", "READ", "UPDATE", "DELETE"],
                "enabled": False,
                "items_per_page": 30,
                "media_type": "media type updated",
                "name": "ContactBasicInfoUpdated",
                "object_type": "TABLE",
                "options": {
                    "bbb": "val bbb updated",
                    "ccc": "val ccc inserted"
                },
            }


            for key, value in final.items():
                lib.db_objects.update_db_objects(session, [db_object_id], { key: value })
                expected[key] = int(value) if isinstance(value, bool) else value

                if key == "name":
                    expected["qualified_name"] = f'PhoneBook.{final[key]}'

                result = lib.db_objects.get_db_object(session, db_object_id)
                assert result is not None
                expected["changed_at"] = result["changed_at"]

                assert result == expected

            expected_object = {
                'comments': 'Comment for object',
                'db_object_id': db_object_id,
                'id': db_object["objects"][0]["id"],
                'kind': 'RESULT',
                'name': 'MyServicePhoneBookContactsWithEmail',
                'position': 0,
                'sdk_options': {
                    'option1': 'value 1',
                    'option2': 'value 2'
                }
            }
            objects = lib.db_objects.get_objects(session, db_object_id)
            for object in objects:
                expected_field = {
                    'allow_filtering': True,
                    'allow_sorting': False,
                    'caption': '- id',
                    'comments': None,
                    'db_column': {
                        'comment': '',
                        'datatype': 'int',
                        'id_generation': None,
                        'is_generated': False,
                        'is_primary': False,
                        'is_unique': False,
                        'name': 'id',
                        'not_null': True,
                        'srid': None
                    },
                    'enabled': True,
                    'id': db_object["objects"][0]["fields"][0]["id"],
                    'lev': 1,
                    'name': 'id',
                    'no_check': False,
                    'no_update': False,
                    'object_id': db_object["objects"][0]["id"],
                    'object_reference': None,
                    'parent_reference_id': None,
                    'position': 1,
                    'represents_reference_id': None,
                    'sdk_options': None
                }
                fields = lib.db_objects.get_object_fields_with_references(session, object["id"])

                assert fields == [expected_field]

            assert objects == [expected_object]


def test_get_db_object(phone_book, mobile_phone_book):

    with lib.core.MrsDbSession(session=phone_book["session"]) as session:

        db_object = lib.db_objects.get_db_object(session=session, schema_id=phone_book["schema_id"])
        assert db_object is None

        db_object = lib.db_objects.get_db_object(session=session, schema_id=phone_book["schema_id"],
            request_path="/test_abc", db_object_name="db1")
        assert db_object is None

        db_object = lib.db_objects.get_db_object(session=session, db_object_id=phone_book["db_object_id"])
        assert db_object is not None
        assert db_object['id'] == phone_book["db_object_id"]
        assert db_object['name'] == 'Contacts'
        assert db_object['object_type'] == 'TABLE'

        # This might take one of these values depending on if the db_object tests already ran
        assert db_object['request_path'] == '/test_table'
        assert db_object['db_schema_id'] == phone_book["schema_id"]


def test_set_crud_operations(phone_book, mobile_phone_book, table_contents):

    with lib.core.MrsDbSession(session=phone_book["session"]) as session:
        db_object_table: TableContents = table_contents("db_object")

        db_object = get_default_db_object_init(session, phone_book["schema_id"])

        with DbObjectCT(session, **db_object) as db_object_id:
            assert db_object_table.count == db_object_table.snapshot.count + 1
            db_object_table.take_snapshot()

            assert db_object_table.same_as_snapshot

            result = lib.db_objects.get_db_object(session, db_object_id=db_object_id)
            assert result is not None
            assert result == {
                'auth_stored_procedure': None,
                'auto_detect_media_type': int(db_object["auto_detect_media_type"]),
                'crud_operations': ["CREATE", "READ", "UPDATE"],
                'comments': db_object["comments"],
                'crud_operation_format': 'FEED',
                'enabled': int(db_object["enabled"]),
                'items_per_page': 10,
                'media_type': 'media type',
                'options': db_object["options"],
                'request_path': db_object["request_path"],
                'requires_auth': 0,
                'row_user_ownership_column': '',
                'row_user_ownership_enforced': 0,
                'changed_at': result["changed_at"],
                'db_schema_id': phone_book["schema_id"],
                'host_ctx': 'localhost/test',
                'id': result["id"],
                'name': db_object["db_object_name"],
                'object_type': 'VIEW',
                'qualified_name': 'PhoneBook.ContactBasicInfo',
                'schema_name': 'PhoneBook',
                'schema_request_path': '/PhoneBook',
                'service_id': phone_book["service_id"]
            }

            grants = get_db_object_privileges(session,
                result['schema_name'], result['name'])

            assert sorted(grants) == sorted(lib.db_objects.map_crud_operations(result["crud_operations"]))
            db_object_table_data = db_object_table.get("id", db_object_id)
            assert db_object_table_data is not None
            assert db_object_table_data["crud_operations"] == ["CREATE", "READ", "UPDATE"]
            assert db_object_table.same_as_snapshot

            new_crud_ops = ["CREATE", "READ", "UPDATE", "DELETE"]
            lib.database.revoke_all_from_db_object(session, result["schema_name"], result["name"], result["object_type"])
            lib.database.grant_db_object(session, result["schema_name"], result["name"],
                                         lib.database.crud_mapping(new_crud_ops))
            lib.db_objects.set_crud_operations(session=session,
                db_object_id=db_object_id, crud_operations=new_crud_ops,
                crud_operation_format="FEED")

            assert not db_object_table.same_as_snapshot

            result = lib.db_objects.get_db_object(session, db_object_id=db_object_id)
            assert result is not None
            assert result == {
                'auth_stored_procedure': None,
                'auto_detect_media_type': int(db_object["auto_detect_media_type"]),
                'crud_operations': new_crud_ops,
                'comments': db_object["comments"],
                'crud_operation_format': 'FEED',
                'enabled': int(db_object["enabled"]),
                'items_per_page': 10,
                'media_type': 'media type',
                'options': db_object["options"],
                'request_path': db_object["request_path"],
                'requires_auth': 0,
                'row_user_ownership_column': '',
                'row_user_ownership_enforced': 0,
                'changed_at': result["changed_at"],
                'db_schema_id': phone_book["schema_id"],
                'host_ctx': 'localhost/test',
                'id': result["id"],
                'name': db_object["db_object_name"],
                'object_type': 'VIEW',
                'qualified_name': 'PhoneBook.ContactBasicInfo',
                'schema_name': 'PhoneBook',
                'schema_request_path': '/PhoneBook',
                'service_id': phone_book["service_id"]
            }

            db_object_table_data = db_object_table.get("id", db_object_id)
            assert result["crud_operations"] == new_crud_ops
            grants = get_db_object_privileges(session,
                result['schema_name'], result['name'])
            assert sorted(grants) == sorted(lib.db_objects.map_crud_operations(new_crud_ops))

            new_crud_ops = ["CREATE", "READ", "UPDATE"]
            lib.database.revoke_all_from_db_object(session, result["schema_name"], result["name"], result["object_type"])
            lib.database.grant_db_object(session, result["schema_name"], result["name"],
                                         lib.database.crud_mapping(new_crud_ops))
            lib.db_objects.set_crud_operations(session=session,
                db_object_id=result["id"], crud_operations=new_crud_ops,
                crud_operation_format="FEED")

            result = lib.db_objects.get_db_object(session, db_object_id=db_object_id)
            assert result is not None
            assert result == {
                'auth_stored_procedure': None,
                'auto_detect_media_type': int(db_object["auto_detect_media_type"]),
                'crud_operations': new_crud_ops,
                'comments': db_object["comments"],
                'crud_operation_format': 'FEED',
                'enabled': int(db_object["enabled"]),
                'items_per_page': 10,
                'media_type': 'media type',
                'options': db_object["options"],
                'request_path': db_object["request_path"],
                'requires_auth': 0,
                'row_user_ownership_column': '',
                'row_user_ownership_enforced': 0,
                'changed_at': result["changed_at"],
                'db_schema_id': phone_book["schema_id"],
                'host_ctx': 'localhost/test',
                'id': result["id"],
                'name': db_object["db_object_name"],
                'object_type': 'VIEW',
                'qualified_name': 'PhoneBook.ContactBasicInfo',
                'schema_name': 'PhoneBook',
                'schema_request_path': '/PhoneBook',
                'service_id': phone_book["service_id"]
            }

            db_object_table_data = db_object_table.get("id", db_object_id)
            assert db_object_table_data is not None
            assert db_object_table_data["crud_operations"] == new_crud_ops

            grants = get_db_object_privileges(session,
                result['schema_name'], result['name'])
            assert sorted(grants) == sorted(lib.db_objects.map_crud_operations(result["crud_operations"]))


def test_db_object_update(phone_book, table_contents):
    session = phone_book["session"]

    with lib.core.MrsDbSession(session=phone_book["session"]) as session:
        db_object_table: TableContents = table_contents("db_object")
        db_object_init = get_default_db_object_init(session, phone_book["schema_id"])

        with DbObjectCT(session, **db_object_init) as db_object_id:
            assert db_object_table.count == db_object_table.snapshot.count + 1
            db_object_table.take_snapshot()

            db_object = lib.db_objects.get_db_object(session, db_object_id)
            assert db_object is not None

            value = {
                'auth_stored_procedure': None,
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


            lib.db_objects.update_db_objects(session=session, db_object_ids=[db_object_id], value=value)
            assert not db_object_table.same_as_snapshot

            lib.db_objects.update_db_objects(session=session, db_object_ids=[db_object_id], value={
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

            result = lib.db_objects.get_db_object(session, db_object_id=db_object_id)
            assert result is not None

            grants = get_db_object_privileges(session,
                result['schema_name'], result['name'])
            assert sorted(grants) == sorted(lib.db_objects.map_crud_operations(result["crud_operations"]))


