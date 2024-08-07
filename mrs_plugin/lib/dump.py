# Copyright (c) 2022, 2024, Oracle and/or its affiliates.
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

from mrs_plugin import lib
from mrs_plugin.lib import core, db_objects


def get_object_fields(session, id):
    return lib.core.select('field', where=['db_object_id=?'],
                           binary_formatter=lambda x: f"0x{x.hex()}").exec(
        session, params=[id]).items


def cleanup_object(target_object, additional_fields=[]):
    'Removes attributes from an object if they are None'
    delete_fields_if_none = ['sdk_options', 'comments']
    delete_fields_if_none = delete_fields_if_none + additional_fields

    for field in delete_fields_if_none:
        if field in target_object and target_object[field] is None:
            del target_object[field]


def reformat_field(field):
    """Formats a field entry so it matches the field definition used in
       set_object_fields_with_references'"""

    # Removes fields not used in input
    delete_fields = ['caption', 'lev']
    for name in delete_fields:
        del field[name]

    # Removes fields if they are None in field
    cleanup_object(field, ['represents_reference_id',
                   'parent_reference_id', 'object_reference'])

    # Deletes the object reference when it is not really an object reference
    object_reference = field.get('object_reference')
    if object_reference:
        # Removes fields if they are None in object_reference
        cleanup_object(object_reference, ['reduce_to_value_of_field_id'])

        if (object_reference.get('reduce_to_value_of_field_id')):
            binary_id = lib.core.id_to_binary(
                object_reference['reduce_to_value_of_field_id'], 'reduce_to_value_of_field_id')
            hex_id = lib.core.convert_id_to_string(binary_id)
            object_reference['reduce_to_value_of_field_id'] = hex_id

        # Inserts the reference object id
        object_reference['id'] = field['represents_reference_id']


def get_object_dump(session, id):
    'Gets a dump of the objects associated to a db_object'
    objects = lib.core.select(
        'object', where=['db_object_id=?'],
        binary_formatter=lambda x: f"0x{x.hex()}").exec(
        session, params=[id]).items

    for obj in objects:
        # Removes fields if they are None in object
        cleanup_object(obj)
        id = core.id_to_binary(obj['id'], 'object.id')
        obj['fields'] = db_objects.get_object_fields_with_references(
            session,
            id,
            binary_formatter=lambda x: f"0x{x.hex()}")

        for field in obj['fields']:
            reformat_field(field)

    return objects


def get_db_object_dump(session, id):
    'Gets a dump for a db_object'
    obj = lib.core.select('db_object', where=['id=?'],
                          binary_formatter=lambda x: f"0x{x.hex()}").exec(
        session, params=[id]).first

    # A db_object may have one or more associated objects (from the object table)
    obj["objects"] = get_object_dump(session, id)

    return obj


def get_db_schema_dump(session, id):
    schema = lib.core.select('db_schema', where=['id=?'],
                             binary_formatter=lambda x: f"0x{x.hex()}").exec(
        session, params=[id]).first

    schema["objects"] = []

    objects = lib.core.select('db_object', cols=['id'], where=['db_schema_id=?']).exec(
        session, params=[id]).items

    schema["objects"] = [get_db_object_dump(
        session, object['id']) for object in objects]

    return schema


def get_service_dump(session, id):
    service = lib.core.select('service', where=['id=?'],
                              binary_formatter=lambda x: f"0x{x.hex()}").exec(
        session, params=[id]).first

    service["schemas"] = []

    schemas = lib.core.select('db_schema', cols=['id'], where=['service_id=?']).exec(
        session, params=[id]).items

    service["schemas"] = [get_db_schema_dump(
        session, schema['id']) for schema in schemas]

    return service


def load_object_dump(session, target_schema_id, object, reuse_ids):
    db_object_id = None
    if reuse_ids:
        db_object_id = lib.core.id_to_binary(object["id"], "object.id")

    objects = object.get("objects")

    current_version = core.get_mrs_schema_version(session)
    if current_version[0] >= 3 and "crud_operations" in object.keys() and \
        objects is not None and len(objects) > 0:
        crud_operations = object.pop("crud_operations")

        if object["object_type"] == "TABLE" or object["object_type"] == "VIEW":
            options = objects[0].get("options")
            if options is None:
                options = {}
            if "CREATE" in crud_operations:
                options["duality_view_insert"] = True
            if "UPDATE" in crud_operations:
                options["duality_view_update"] = True
            if "DELETE" in crud_operations:
                options["duality_view_delete"] = True

            objects[0]["options"] = options


    return lib.db_objects.add_db_object(
        session=session, schema_id=target_schema_id,
        db_object_name=object["name"],
        request_path=object["request_path"],
        db_object_type=object["object_type"],
        enabled=object["enabled"],
        items_per_page=object["items_per_page"],
        requires_auth=object["requires_auth"],
        crud_operation_format=object["format"],
        comments=object["comments"],
        media_type=object["media_type"],
        auto_detect_media_type=object["auto_detect_media_type"],
        auth_stored_procedure=object["auth_stored_procedure"],
        options=object["options"],
        objects=objects,
        metadata=object.get("metadata", None),
        db_object_id=db_object_id,
        reuse_ids=reuse_ids,
        row_user_ownership_enforced=object.get(
            "row_user_ownership_enforced", None),
        row_user_ownership_column=object.get(
            "row_user_ownership_column", None))


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

    grants = []
    for obj in schema["objects"]:
        _, grant = load_object_dump(session, schema_id, obj, reuse_ids)
        grants.append(grant)

    return schema_id, grants
