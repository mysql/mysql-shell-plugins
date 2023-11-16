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

from mrs_plugin.lib import core, schemas, database
import json


def format_db_object_listing(db_objects, print_header=False):
    """Formats the listing of db_objects

    Args:
        db_objects (list): A list of db_objects as dicts
        print_header (bool): If set to true, a header is printed

    Returns:
        The formatted list of services
    """
    if print_header:
        output = (f"{'ID':>3} {'PATH':35} {'OBJECT NAME':30} {'CRUD':4} "
                  f"{'TYPE':10} {'ENABLED':7} {'AUTH':4} "
                  f"{'LAST META CHANGE':16}\n")
    else:
        output = ""

    for i, item in enumerate(db_objects, start=1):
        path = (item['host_ctx'] + item['schema_request_path'] +
                item['request_path'])

        if len(path) > 35:
            path = f"{path[:32]}..."

        # Shorten the list of CRUD operation names to just the first characters
        crud = ''.join([o[0] for o in item['crud_operations']]) \
            if item['crud_operations'] else ""
        changed_at = str(item['changed_at']) if item['changed_at'] else ""

        output += (f"{i:>3} {path[:35]:35} "
                   f"{item['name'][:30]:30} {crud:4} "
                   f"{item['object_type'][:9]:10} "
                   f"{'Yes' if item['enabled'] else '-':7} "
                   f"{'Yes' if item['requires_auth'] else '-':4} "
                   f"{changed_at[:16]:16}")
        if i < len(db_objects):
            output += "\n"

    return output


def map_crud_operations(crud_operations):
    grant_privileges = []
    for crud_operation in crud_operations:
        if crud_operation == "CREATE" or crud_operation == "1":
            grant_privileges.append("INSERT")
        elif crud_operation == "READ" or crud_operation == "2":
            grant_privileges.append("SELECT")
        elif crud_operation == "UPDATE" or crud_operation == "3":
            grant_privileges.append("UPDATE")
        elif crud_operation == "DELETE" or crud_operation == "4":
            grant_privileges.append("DELETE")
        else:
            raise ValueError(f"The given CRUD operation {crud_operation} "
                             "does not exist.")
    return grant_privileges


def validate_value(value, value_name):
    if not value and not isinstance(value, bool):
        raise ValueError(f"The '{value_name}' field was not set.")
    return value


def add_where_clause(where, new):
    return f"{where} {'AND' if where else 'WHERE'} {new}"


def delete_db_object(session, db_object_id):
    # The db_object was not set
    if db_object_id is None:
        raise ValueError("The specified db_object was not found.")

    # Update all given services
    db_object = get_db_object(session, db_object_id)
    db_schema = schemas.get_schema(session, db_object["db_schema_id"])

    database.revoke_all_from_db_object(
        session, db_schema["name"], db_object["name"], db_object["object_type"])

    # remove the db_object
    core.delete(table="db_object",
                where="id=?"
                ).exec(session, [db_object_id]).success


def delete_db_objects(session, db_object_ids: list):
    # The list of db_objects to be changed
    if not db_object_ids:
        raise ValueError("The specified db_object was not found.")

    # Update all given services
    for db_object_id in db_object_ids:
        delete_db_object(session, db_object_id)


def enable_db_object(session, value: bool, db_object_ids: list):
    # The list of db_objects to be changed
    if not db_object_ids:
        raise ValueError("The specified db_object was not found.")

    # Update all given services
    for db_object_id in db_object_ids:
        result = core.update(table="db_object",
                             sets="enabled=?",
                             where="id=?"
                             ).exec(session, [value, db_object_id]).success

        if not result:
            raise Exception(
                f"The specified db_object with id {db_object_id} was not "
                "found.")


def query_db_objects(session, db_object_id=None, schema_id=None, request_path=None,
                     db_object_name=None, include_enable_state=None, object_types=None):

    # Build SQL based on which input has been provided
    sql = """
            SELECT o.id, o.db_schema_id, o.name, o.request_path,
                o.requires_auth, o.enabled, o.object_type,
                o.items_per_page, o.row_user_ownership_enforced,
                o.row_user_ownership_column, o.comments,
                sc.request_path AS schema_request_path,
                CONCAT(h.name, se.url_context_root) AS host_ctx,
                o.crud_operations, o.format as crud_operation_format,
                o.media_type, o.auto_detect_media_type,
                o.auth_stored_procedure, o.options,
                MAX(al.changed_at) as changed_at,
                CONCAT(sc.name, '.', o.name) AS qualified_name,
                se.id AS service_id, sc.name AS schema_name
            FROM mysql_rest_service_metadata.db_object o
                LEFT OUTER JOIN mysql_rest_service_metadata.db_schema sc
                    ON sc.id = o.db_schema_id
                LEFT OUTER JOIN mysql_rest_service_metadata.service se
                    ON se.id = sc.service_id
                LEFT JOIN mysql_rest_service_metadata.url_host h
                    ON se.url_host_id = h.id
                LEFT OUTER JOIN (
                    SELECT new_row_id AS id, MAX(changed_at) as changed_at
                    FROM mysql_rest_service_metadata.audit_log
                    WHERE table_name = 'db_object'
                    GROUP BY new_row_id) al
                ON al.id = o.id
            """

    params = []
    wheres = []
    if db_object_id is not None:
        wheres.append("o.id = ?")
        params.append(db_object_id)
    else:
        if schema_id is not None:
            wheres.append("o.db_schema_id = ?")
            params.append(schema_id)
        if request_path is not None:
            wheres.append("o.request_path = ?")
            params.append(request_path)
        if db_object_name is not None:
            wheres.append("o.name = ?")
            params.append(db_object_name)
        if object_types is not None:
            if len(object_types) > 1:
                s = "(" + ("o.object_type = ? OR " * len(object_types))
                wheres.append(s[0:-4] + ")")
                for t in object_types:
                    params.append(t)
            elif len(object_types) == 1:
                wheres.append("o.object_type = ?")
                params.append(object_types[0])

    if include_enable_state is not None:
        wheres.append("o.enabled = ?")
        params.append("TRUE" if include_enable_state else "FALSE")

    sql += core._generate_where(wheres)
    sql += " GROUP BY o.id"

    return core.MrsDbExec(sql, params).exec(session).items


def get_db_object(session, db_object_id: bytes = None, schema_id: bytes = None, request_path=None, db_object_name=None,
                  absolute_request_path: str = None):
    """Gets a specific MRS db_object

    Args:
        session (object): The database session to use.
        db_object_id: The id of the db_object
        schema_id: The id of the schema
        request_path (str): The request_path of the schema
        db_object_name (str): The name of the schema
        absolute_request_path (str): The absolute request_path to the db_object

    Returns:
        The db_object as dict
    """
    result = None

    if db_object_id is not None:
        result = query_db_objects(session=session, db_object_id=db_object_id)
    else:
        if request_path:
            result = query_db_objects(
                session=session, schema_id=schema_id, request_path=request_path)
        elif db_object_name:
            result = query_db_objects(
                session=session, schema_id=schema_id, db_object_name=db_object_name)
        elif absolute_request_path:
            result = database.get_object_via_absolute_request_path(
                session=session, absolute_request_path=absolute_request_path,
                ignore_case=True)

    return result[0] if result else None


def get_db_objects(session, schema_id: bytes, include_enable_state=None, object_types=None):
    """Returns all db_objects for the given schema

    Args:
        schema_id: The id of the schema to list the db_objects from
        include_enable_state (bool): Only include db_objects with the given
            enabled state
        session (object): The database session to use

    Returns:
        A list of dicts representing the db_objects of the schema
    """
    return query_db_objects(
        session=session, schema_id=schema_id,
        include_enable_state=include_enable_state, object_types=object_types)


def add_db_object(session, schema_id, db_object_name, request_path, db_object_type,
                  enabled, items_per_page, requires_auth,
                  row_user_ownership_enforced, row_user_ownership_column, crud_operations,
                  crud_operation_format, comments, media_type, auto_detect_media_type, auth_stored_procedure,
                  options, objects, db_object_id=None, reuse_ids=False):

    if not isinstance(db_object_name, str):
        raise Exception('Invalid object name.')

    if db_object_type not in ["TABLE", "VIEW", "PROCEDURE", "FUNCTION"]:
        raise ValueError(
            'Invalid db_object_type. Only valid types are TABLE, VIEW, PROCEDURE and FUNCTION.')

    if not crud_operations:
        raise ValueError("No CRUD operations specified."
                         "Operation cancelled.")

    if not isinstance(crud_operations, list):
        raise TypeError("The crud_operations parameter need to be specified as "
                        "list. Operation cancelled.")

    if not crud_operation_format:
        raise ValueError("No CRUD operation format specified."
                         "Operation cancelled.")

    if row_user_ownership_enforced is None:
        row_user_ownership_enforced = False

    if row_user_ownership_enforced and not row_user_ownership_column:
        raise ValueError('Operation cancelled.')

    if not comments:
        comments = ""

    schema = schemas.get_schema(session=session,
                                schema_id=schema_id, auto_select_single=True)

    core.check_request_path(
        session, schema["host_ctx"] + schema["request_path"] + request_path)

    if db_object_type == "PROCEDURE" or db_object_type == "FUNCTION":
        crud_operations = ["UPDATE"]

    if db_object_id is None:
        db_object_id = core.get_sequence_id(session)
    core.insert(table="db_object", values={
        "id": db_object_id,
        "db_schema_id": schema_id,
        "name": db_object_name,
        "request_path": request_path,
        "object_type": db_object_type,
        "enabled": enabled,
        "items_per_page": items_per_page,
        "requires_auth": int(requires_auth),
        "row_user_ownership_enforced": int(row_user_ownership_enforced),
        "row_user_ownership_column": row_user_ownership_column,
        "crud_operations": crud_operations,
        "format": crud_operation_format,
        "comments": comments,
        "media_type": media_type,
        "auto_detect_media_type": int(auto_detect_media_type),
        "auth_stored_procedure": auth_stored_procedure,
        "options": options,
    }).exec(session)

    set_objects(session, db_object_id, objects)

    if db_object_type == "PROCEDURE" or db_object_type == "FUNCTION":
        grant_privileges = ["EXECUTE"]
    else:
        grant_privileges = map_crud_operations(crud_operations)

    if not grant_privileges:
        raise ValueError("No valid CRUD Operation specified")

    return db_object_id, database.get_grant_statements(
        schema["name"], db_object_name, grant_privileges, objects, db_object_type)


def get_crud_operations(session, db_object_id: bytes):
    result = core.select("db_object",
                        cols="crud_operations, format",
                        where=["id = ?"]).exec(session, [db_object_id]).first
    return result["crud_operations"], result["format"]


def set_crud_operations(session, db_object_id: bytes, crud_operations=None,
                        crud_operation_format=None):
    """Sets the request_path of the given db_object

    Args:
        session (object): The database session to use
        db_object_id: The id of the schema to list the db_objects from
        crud_operations (list): The allowed CRUD operations for the object
        crud_operation_format (str): The format to use for the CRUD operation

    Returns:
        None
    """
    core.update(table="db_object", sets={
        "crud_operations": crud_operations,
        "format": crud_operation_format
    }, where="id=?").exec(session, [db_object_id])



def get_available_db_object_row_ownership_fields(session, schema_name, db_object_name, db_object_type):
    if db_object_type == "PROCEDURE":
        sql = core.select(table="`INFORMATION_SCHEMA`.`PARAMETERS`",
                          cols="PARAMETER_NAME as name",
                          where=["SPECIFIC_SCHEMA = ?",
                                 "SPECIFIC_NAME = ?", "PARAMETER_MODE = 'IN'"],
                          order="ORDINAL_POSITION")
    else:
        sql = core.select(table="`INFORMATION_SCHEMA`.`COLUMNS`",
                          cols="COLUMN_NAME as name",
                          where=["TABLE_SCHEMA = ?", "TABLE_NAME = ?",
                                 "GENERATION_EXPRESSION = ''"],
                          order="ORDINAL_POSITION")

    return [record["name"] for record in sql.exec(session, [schema_name, db_object_name]).items]


def update_db_objects(session, db_object_ids, value):
    if "crud_operation_format" in value:
        value["format"] = value.pop("crud_operation_format")

    for db_object_id in db_object_ids:
        objects = value.pop("objects", None)

        if objects is not None:
            core.check_mrs_object_names(session=session, db_schema_id=value["db_schema_id"], objects=objects)

        core.update("db_object",
                    sets=value,
                    where=["id=?"]).exec(session, [db_object_id])

        grant_privileges = map_crud_operations(
            value.get("crud_operations", []))

        db_object = get_db_object(session, db_object_id)

        schema = schemas.get_schema(session, db_object["db_schema_id"])

        # Revoke all grants before granting the necessary ones
        database.revoke_all_from_db_object(
            session, schema["name"], db_object["name"], db_object["object_type"])

        # Grant privilege to the 'mysql_rest_service_data_provider' role
        if grant_privileges:
            database.grant_db_object(
                session, schema.get("name"), db_object['name'], grant_privileges, objects, db_object["object_type"])

        if objects is not None:
            set_objects(session, db_object_id, objects)


def db_schema_object_is_table(session, db_schema_name, db_object_name):
    return database.db_schema_object_is_table(
        session=session,
        db_schema_name=db_schema_name,
        db_object_name=db_object_name)


def get_db_object_parameters(session, db_object_id=None,
                             db_schema_name=None, db_object_name=None,
                             db_type="PROCEDURE"):

    if db_object_id:
        db_object = get_db_object(session, db_object_id)

        if not db_object:
            raise ValueError(
                "The database object must be identified via schema_name and db_object_name "
                "or db_object_id.")

        db_schema_name = db_object["schema_name"]
        db_object_name = db_object["name"]
        db_type = db_object["object_type"]
        if db_object["object_type"] != "PROCEDURE" or db_object["object_type"] != "FUNCTION":
            raise ValueError(
                "This function can only be called for PROCEDUREs and FUNCTIONs.")

    return database.get_db_object_parameters(
        session=session, db_schema_name=db_schema_name, db_object_name=db_object_name, db_type=db_type)

def get_db_function_return_type(session, db_schema_name, db_object_name):
    return database.get_db_function_return_type(
        session=session, db_schema_name=db_schema_name, db_object_name=db_object_name)


def get_table_columns_with_references(session, db_object_id=None,
                                      schema_name=None, db_object_name=None, db_object_type=None):

    if db_object_id:
        db_object = get_db_object(session, db_object_id)

        if not db_object:
            raise ValueError(
                "The database object must be identified via schema_name, db_object_name and db_object_type "
                "or via the request_path and db_object_name.")

        schema_name = db_object["schema_name"]
        db_object_name = db_object["name"]
        db_object_type = db_object["object_type"]

    if db_object_type and db_object_type not in ["TABLE", "VIEW"]:
        raise ValueError(
            "The object_type must be either set to TABLE or VIEW.")

    return database.get_table_columns_with_references(session, schema_name, db_object_name, db_object_type)


def get_objects(session, db_object_id):
    return database.get_objects(session, db_object_id)


def get_object_fields_with_references(session, object_id, binary_formatter=None):
    return database.get_object_fields_with_references(session, object_id, binary_formatter=binary_formatter)


def set_objects(session, db_object_id, objects):
    if objects is None:
        objects = []

    sql = "DELETE FROM mysql_rest_service_metadata.object WHERE db_object_id = ?"
    core.MrsDbExec(sql).exec(session, [core.id_to_binary(
        db_object_id, "db_object_id")]).items

    for obj in objects:
        set_object_fields_with_references(session, db_object_id, obj)


def set_object_fields_with_references(session, db_object_id, obj):
    core.insert(table="object", values={
        "id": core.id_to_binary(obj.get("id"), "object.id"),
        "db_object_id": core.id_to_binary(db_object_id, "db_object_id"),
        "name": obj.get("name"),
        "kind": obj.get("kind", "RESULT"),
        "position": obj.get("position"),
        "sdk_options": core.convert_dict_to_json_string(obj.get("sdk_options")),
        "comments": obj.get("comments"),
    }).exec(session)

    fields = obj.get("fields", [])

    # Insert object_references first
    inserted_object_references_ids = []
    for field in fields:
        obj_ref = field.get("object_reference")

        if (obj_ref is not None and
                (not (obj_ref.get("id") in inserted_object_references_ids))):
            inserted_object_references_ids.append(obj_ref.get("id"))

            # make sure to covert the sub Dict with dict()
            ref_map = obj_ref.get("reference_mapping")
            ref_map_json = None
            if ref_map is not None:
                ref_map = dict(ref_map)

                # Convert column_mapping, which is a list of dict
                converted_col_mapping = []
                for cm in ref_map["column_mapping"]:
                    cm_dict = dict(cm)
                    # Check if column_mapping already follows new format
                    if "base" in cm_dict and "ref" in cm_dict:
                        converted_col_mapping.append(cm_dict)
                    else:
                        # If not, convert to new format that uses "base" and "ref" keys
                        for key in cm_dict.keys():
                            converted_col_mapping.append(
                                {"base": key, "ref": cm_dict.get(key)})

                ref_map["column_mapping"] = converted_col_mapping
                ref_map_json = json.dumps(ref_map)

            if not ref_map_json:
                raise Exception(
                    f'reference_mapping not defined for field {field.get("name")}')

            core.insert(table="object_reference", values={
                "id": core.id_to_binary(obj_ref.get("id"), "objectReference.id"),
                "reduce_to_value_of_field_id": core.id_to_binary(
                    obj_ref.get("reduce_to_value_of_field_id"),
                    "objectReference.reduce_to_value_of_field_id", True),
                "reference_mapping": ref_map_json,
                "unnest": obj_ref.get("unnest"),
                "crud_operations": obj_ref.get("crud_operations"),
                "sdk_options": core.convert_dict_to_json_string(obj_ref.get("sdk_options")),
                "comments": obj_ref.get("comments"),
            }).exec(session)

    # Then insert object_fields
    inserted_field_ids = []
    for field in fields:
        obj_ref = field.get("object_reference")

        if (not (field.get("id") in inserted_field_ids)):
            inserted_field_ids.append(field.get("id"))

            core.insert(table="object_field", values={
                "id": core.id_to_binary(field.get("id"), "field.id"),
                "object_id": core.id_to_binary(field.get("object_id"), "field.object_id"),
                "parent_reference_id": core.id_to_binary(
                    field.get("parent_reference_id"), "field.parent_reference_id", True),
                "represents_reference_id": core.id_to_binary(
                    field.get("represents_reference_id"), "field.represents_reference_id", True),
                "name": field.get("name"),
                "position": field.get("position"),
                "db_column": core.convert_dict_to_json_string(field.get("db_column")),
                "enabled": field.get("enabled"),
                "allow_filtering": field.get("allow_filtering"),
                "allow_sorting": field.get("allow_sorting", 0),
                "no_check": field.get("no_check"),
                "no_update": field.get("no_update"),
                "sdk_options": core.convert_dict_to_json_string(field.get("sdk_options")),
                "comments": field.get("comments"),
            }).exec(session)
