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

from mrs_plugin import lib


def get_object_fields(session, id):
    return lib.core.select('field', where=['db_object_id=?'],
                           binary_formatter=lambda x: f"0x{x.hex()}").exec(
        session, params=[id]).items


def get_object_dump(session, id):
    object = lib.core.select('db_object', where=['id=?'],
                             binary_formatter=lambda x: f"0x{x.hex()}").exec(
        session, params=[id]).first

    object["fields"] = get_object_fields(session, id)

    return object


def get_schema_dump(session, id):
    schema = lib.core.select('db_schema', where=['id=?'],
                             binary_formatter=lambda x: f"0x{x.hex()}").exec(
        session, params=[id]).first

    schema["objects"] = []

    objects = lib.core.select('db_object', cols=['id'], where=['db_schema_id=?']).exec(
        session, params=[id]).items

    schema["objects"] = [get_object_dump(
        session, object['id']) for object in objects]

    return schema


def get_service_dump(session, id):
    service = lib.core.select('service', where=['id=?'],
                              binary_formatter=lambda x: f"0x{x.hex()}").exec(
        session, params=[id]).first

    service["schemas"] = []

    schemas = lib.core.select('db_schema', cols=['id'], where=['service_id=?']).exec(
        session, params=[id]).items

    service["schemas"] = [get_schema_dump(
        session, schema['id']) for schema in schemas]

    return service


def load_object_dump(session, target_schema_id, object, reuse_ids):
    db_object_id = None
    if reuse_ids:
        db_object_id = lib.core.id_to_binary(object["id"], "object.id")

    return lib.db_objects.add_db_object(session, target_schema_id,
                                        object["name"],
                                        object["request_path"],
                                        object["object_type"],
                                        object["enabled"],
                                        object["items_per_page"],
                                        object["requires_auth"],
                                        object["row_user_ownership_enforced"],
                                        object["row_user_ownership_column"],
                                        object["crud_operations"],
                                        object["format"],
                                        object["comments"],
                                        object["media_type"],
                                        object["auto_detect_media_type"],
                                        object["auth_stored_procedure"],
                                        object["options"],
                                        object["fields"],
                                        db_object_id=db_object_id,
                                        reuse_ids=reuse_ids)  # object.fields)


def load_schema_dump(session, target_service_id, schema, reuse_ids):
    schema_id = None
    if reuse_ids:
        schema_id = lib.core.id_to_binary(schema["id"], "object.id")

    schema_id = lib.schemas.add_schema(session,
                                       schema["name"],
                                       target_service_id,
                                       schema["request_path"],
                                       schema["requires_auth"],
                                       schema["enabled"],
                                       schema["items_per_page"],
                                       schema["comments"],
                                       schema["options"],
                                       schema_id=schema_id)

    for object in schema["objects"]:
        load_object_dump(session, schema_id, object, reuse_ids)

    return schema_id
