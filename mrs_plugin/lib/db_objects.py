# Copyright (c) 2022, Oracle and/or its affiliates.
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

from mrs_plugin.lib import core, schemas
import json



def format_db_object_listing(db_objects, print_header=False):
    """Formats the listing of db_objects

    Args:
        db_objects (list): A list of db_objects as dicts
        print_header (bool): If set to true, a header is printed

    Returns:
        The formated list of services
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

def validate_value(value, value_name):
    if not value and not isinstance(value, bool):
        raise ValueError(f"The '{value_name}' field was not set.")
    return value


def add_where_clause(where, new):
    return f"{where} {'AND' if where else 'WHERE'} {new}"

def delete_db_object(session, db_object_ids: list):
    # The list of db_objects to be changed
    if not db_object_ids:
        raise ValueError("The specified db_object was not found.")

    # Update all given services
    for db_object_id in db_object_ids:
        # remove all fields for this db_object
        core.delete(table="field", where=["db_object_id=?"]).exec(session, [db_object_id])

        # remove the db_object
        core.delete(table="db_object",
            where="id=?"
        ).exec(session, [db_object_id]).success



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
    db_object_name=None, include_enable_state=None):

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

    if include_enable_state is not None:
        wheres.append("o.enabled = ?")
        params.append("TRUE" if include_enable_state else "FALSE")

    sql += core._generate_where(wheres)
    sql += " GROUP BY o.id"

    return core.MrsDbExec(sql, params).exec(session).items


def get_db_object(session, db_object_id: bytes=None, schema_id: bytes=None, request_path=None, db_object_name=None):
    """Gets a specific MRS db_object

    Args:
        session (object): The database session to use.
        db_object_id: The id of the db_object
        schema_id: The id of the schema
        request_path (str): The request_path of the schema
        db_object_name (str): The name of the schema

    Returns:
        The db_object as dict
    """
    result = None

    if db_object_id is not None:
        result = query_db_objects(session=session, db_object_id=db_object_id)
    else:
        if request_path:
            result = query_db_objects(session=session, schema_id=schema_id, request_path=request_path)
        elif db_object_name:
            result = query_db_objects(session=session, schema_id=schema_id, db_object_name=db_object_name)

    return result[0] if result else None


def get_db_objects(session, schema_id: bytes, include_enable_state=None):
    """Returns all db_objects for the given schema

    Args:
        schema_id: The id of the schema to list the db_objects from
        include_enable_state (bool): Only include db_objects with the given
            enabled state
        session (object): The database session to use

    Returns:
        A list of dicts representing the db_objects of the schema
    """
    return query_db_objects(session=session, schema_id=schema_id, include_enable_state=include_enable_state)


def add_db_object(session, schema_id, db_object_name, request_path, db_object_type,
    enabled, items_per_page, requires_auth,
    row_user_ownership_enforced, row_user_ownership_column, crud_operations,
    crud_operation_format, comments, media_type, auto_detect_media_type, auth_stored_procedure,
    options, fields):

    options = core.convert_json(options)
    fields = core.convert_json(fields)

    if not isinstance(db_object_name, str):
        raise Exception('Invalid object name.')

    if db_object_type not in ["TABLE", "VIEW", "PROCEDURE"]:
        raise ValueError('Invalid db_object_type. Only valid types are TABLE, VIEW and PROCEDURE.')

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

    if not items_per_page:
        items_per_page = 25
        # raise ValueError("No valid value given as items per page.")

    if not comments:
        comments = ""

    if fields is None:
        fields = []

    schema = schemas.get_schema(session=session,
        schema_id=schema_id, auto_select_single=True)

    core.check_request_path(session, request_path)


    grant_privileges = []
    for crud_operation in crud_operations:
        if crud_operation == "CREATE" or crud_operation == "1":
            grant_privileges.append("CREATE")
        elif crud_operation == "READ" or crud_operation == "2":
            grant_privileges.append("SELECT")
        elif crud_operation == "UPDATE" or crud_operation == "3":
            grant_privileges.append("UPDATE")
        elif crud_operation == "DELETE" or crud_operation == "4":
            grant_privileges.append("DELETE")
        else:
            raise ValueError(f"The given CRUD operation {crud_operation} "
                                "does not exist.")

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
        "options": options
    }).exec(session)

    for field in fields:
        field["id"] = core.get_sequence_id(session)
        field["db_object_id"] = db_object_id
        core.insert(table="field", values=field).exec(session)

    # Grant privilege to the 'mrs_provider_data_access' role
    if not grant_privileges:
        raise ValueError("No valid CRUD Operation specified")

    if db_object_type == "PROCEDURE":
        sql = (f"GRANT EXECUTE ON PROCEDURE `"
                f"{schema.get('name')}`.`{db_object_name}` "
                "TO 'mrs_provider_data_access'")
    else:
        sql = (f"GRANT {','.join(grant_privileges)} ON "
                f"{schema.get('name')}.{db_object_name} "
                "TO 'mrs_provider_data_access'")
    session.run_sql(sql)

    return db_object_id


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
    # Get the object with the given id or let the user select it
    db_object = get_db_object(session, db_object_id=db_object_id)

    if db_object is None:
        raise Exception("The db_object was not found.")

    schema = schemas.get_schema(session,
        schema_id=db_object.get("db_schema_id"), auto_select_single=True)

    if not schema:
        raise Exception('Schema not found.')

    if not crud_operations:
        raise ValueError("No CRUD operations specified."
                             "Operation cancelled.")

    if not isinstance(crud_operations, list):
        raise ValueError("The crud_operations need to be specified as "
                            "list. Operation cancelled.")

    for index in range(0, len(crud_operations)):
        crud_operation = crud_operations[index]
        crud_operation_mapping = {
            '1': 'CREATE',
            '2': 'READ',
            '3': 'UPDATE',
            '4': 'DELETE'
        }

        if crud_operation in crud_operation_mapping.keys():
            crud_operation = crud_operation_mapping[crud_operation]

        if crud_operation not in ['CREATE', 'READ', 'UPDATE', 'DELETE']:
            raise ValueError(f"The given CRUD operation {crud_operation} "
                                "does not exist.")

    if not crud_operation_format:
        raise ValueError("No CRUD operation format specified."
                            "Operation cancelled.")

    if crud_operation_format not in ['FEED', 'ITEM', 'MEDIA']:
        raise Exception(f'Invalid CRUD operation format.')

    crud_to_grant_mapping = {
        'CREATE': 'CREATE',
        'READ': 'SELECT',
        'UPDATE': 'UPDATE',
        'DELETE': 'DELETE'
    }

    grant_privileges = []
    for crud_operation in crud_operations:
        grant_privileges.append(crud_to_grant_mapping[crud_operation])

    if not grant_privileges:
        raise ValueError("No valid CRUD Operation specified")

    with core.MrsDbTransaction(session):
        sql = (f"REVOKE IF EXISTS ALL ON  "
            f"{schema.get('name')}.{db_object.get('name')} "
            "FROM 'mrs_provider_data_access'")
        session.run_sql(sql)

        core.update(table="db_object", sets={
            "crud_operations": crud_operations,
            "format": crud_operation_format
        }, where="id=?").exec(session, [db_object_id])

        db_object = get_db_object(session, db_object_id=db_object_id)

        sql = (f"GRANT {','.join(grant_privileges)} ON "
            f"{schema.get('name')}.{db_object.get('name')} "
            "TO 'mrs_provider_data_access'")

        session.run_sql(sql)


def get_available_db_object_row_ownership_fields(session, schema_name, db_object_name, db_object_type):
    if db_object_type == "PROCEDURE":
        sql = core.select(table="`INFORMATION_SCHEMA`.`PARAMETERS`",
            cols="PARAMETER_NAME as name",
            where=["SPECIFIC_SCHEMA = ?", "SPECIFIC_NAME = ?", "PARAMETER_MODE = 'IN'"],
            order="ORDINAL_POSITION")
    else:
        sql = core.select(table="`INFORMATION_SCHEMA`.`COLUMNS`",
            cols="COLUMN_NAME as name",
            where=["TABLE_SCHEMA = ?", "TABLE_NAME = ?", "GENERATION_EXPRESSION = ''"],
            order="ORDINAL_POSITION")

    return [record["name"] for record in sql.exec(session, [schema_name, db_object_name]).items]


def get_db_object_row_ownership_fields(session, db_object_id):
    return [record["name"] for record in core.select(table="field",
        where="db_object_id=?").exec(session, [db_object_id]).items]


def update_db_objects(session, db_object_ids, value):
    if "crud_operation_format" in value:
        value["format"] = value.pop("crud_operation_format")

    for db_object_id in db_object_ids:
        fields = value.pop("fields", None)

        core.update("db_object",
            sets=value,
            where=["id=?"]).exec(session, [db_object_id])

        if fields is not None:
            update_db_object_fields(session, db_object_id, fields)


def update_db_object_fields(session, db_object_id, fields):
    fields_in_db = core.select(table="field",
        where="db_object_id=?"
    ).exec(session, [db_object_id]).items

    for field_in_db in fields_in_db:
        if field_in_db["id"] not in [field["id"] for field in fields]:
            core.delete(table="field", where="id=?").exec(session, [field_in_db["id"]])

    for field in fields:
        id = field.pop("id", None)
        field["db_object_id"] = db_object_id    # force the db_object_id to the current one

        if id:
            core.update(table="field", sets=field, where="id=?").exec(session, [id])
        else:
            field["id"] = core.get_sequence_id(session)
            core.insert(table="field", values=field).exec(session)

def get_db_object_fields(session, db_object_id=None,
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

    if db_object_type not in ["TABLE", "VIEW", "PROCEDURE"]:
        raise ValueError(
            "The object_type must be either set to TABLE, VIEW or PROCEDURE.")


    # cSpell:ignore mediumint tinyint id
    if db_object_type == "PROCEDURE":
        sql = """
            SELECT @id:=@id-1 AS id, @id * -1 AS position,
                PARAMETER_NAME AS name, PARAMETER_NAME AS bind_field_Name,
                PARAMETER_MODE AS mode,
                CASE
                    WHEN (DTD_IDENTIFIER = "tinyint(1)") THEN "BOOLEAN"
                    WHEN (DATA_TYPE = "bigint") THEN "LONG"
                    WHEN (DATA_TYPE = "tinyint" OR DATA_TYPE = "smallint" OR DATA_TYPE = "mediumint"
                        OR DATA_TYPE = "int") THEN "INT"
                    WHEN (DATA_TYPE = "numeric" OR DATA_TYPE = "decimal" OR DATA_TYPE = "float"
                        OR DATA_TYPE = "real" OR DATA_TYPE = "double precision") THEN "DOUBLE"
                    WHEN (DATA_TYPE = "json") THEN "JSON"
                    ELSE "STRING"
                END as datatype,
                "" as comments
            FROM `INFORMATION_SCHEMA`.`PARAMETERS`, (SELECT @id:=0) as init
            WHERE SPECIFIC_SCHEMA = ?
                AND SPECIFIC_NAME = ?
            ORDER BY ORDINAL_POSITION
        """
    else:
        sql = """
            SELECT @id:=@id-1 as id, @id * -1 AS position,
                COLUMN_NAME AS name, COLUMN_NAME AS bind_field_Name,
                "IN" AS mode,
                CASE
                    WHEN (COLUMN_TYPE = "tinyint(1)") THEN "BOOLEAN"
                    WHEN (DATA_TYPE = "bigint") THEN "LONG"
                    WHEN (DATA_TYPE = "tinyint" OR DATA_TYPE = "smallint" OR DATA_TYPE = "mediumint"
                        OR DATA_TYPE = "int") THEN "INT"
                    WHEN (DATA_TYPE = "numeric" OR DATA_TYPE = "decimal" OR DATA_TYPE = "float"
                        OR DATA_TYPE = "real" OR DATA_TYPE = "double precision") THEN "DOUBLE"
                    WHEN (DATA_TYPE = "json") THEN "JSON"
                    ELSE "STRING"
                END as datatype,
                "" as comments
            FROM `INFORMATION_SCHEMA`.`COLUMNS`, (SELECT @id:=0) as init
            WHERE TABLE_SCHEMA = ?
                AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
        """

    return core.MrsDbExec(sql).exec(session, [schema_name, db_object_name]).items