# Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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
from mrs_plugin.lib import core
"""
Module that deals with the "real" database schema instead of the MRS objects
"""


def get_schemas(session, ignore_system_schemas=True):
    ignore = ['.%', 'mysql_%', 'mysql'] if ignore_system_schemas else []
    wheres = ["SCHEMA_NAME NOT LIKE ?", "SCHEMA_NAME NOT LIKE ?",
              "SCHEMA_NAME <> ?"] if ignore_system_schemas else None

    return core.select(table="INFORMATION_SCHEMA.SCHEMATA",
                       cols="SCHEMA_NAME",
                       where=wheres
                       ).exec(session, params=ignore).items


def get_schema(session, schema_name):
    return core.select(table="INFORMATION_SCHEMA.SCHEMATA",
                       cols="SCHEMA_NAME",
                       where=["SCHEMA_NAME = ?"]
                       ).exec(session, params=[schema_name]).first


def get_db_objects(session, schema_name, db_object_type):
    if db_object_type == "TABLE":
        return core.select(table="INFORMATION_SCHEMA.TABLES", cols="TABLE_NAME AS OBJECT_NAME",
                           where=["TABLE_SCHEMA=? /*=sakila*/",
                                  "TABLE_TYPE = 'BASE TABLE'"],
                           order="TABLE_NAME"
                           ).exec(session, [schema_name]).items
    elif db_object_type == "VIEW":
        return core.select(table="INFORMATION_SCHEMA.TABLES", cols="TABLE_NAME AS OBJECT_NAME",
                           where=["TABLE_SCHEMA=? /*=sakila*/",
                                  "(TABLE_TYPE='VIEW' OR TABLE_TYPE='SYSTEM VIEW')"],
                           order="TABLE_NAME"
                           ).exec(session, [schema_name]).items
    elif db_object_type == "PROCEDURE":
        return core.select(table="INFORMATION_SCHEMA.ROUTINES", cols="ROUTINE_NAME AS OBJECT_NAME",
                           where=["ROUTINE_SCHEMA=? /*=sakila*/",
                                  "ROUTINE_TYPE='PROCEDURE'"],
                           order="ROUTINE_NAME"
                           ).exec(session, [schema_name]).items
    elif db_object_type == "FUNCTION":
        return core.select(table="INFORMATION_SCHEMA.ROUTINES", cols="ROUTINE_NAME AS OBJECT_NAME",
                           where=["ROUTINE_SCHEMA=? /*=sakila*/",
                                  "ROUTINE_TYPE='FUNCTION'"],
                           order="ROUTINE_NAME"
                           ).exec(session, [schema_name]).items

    raise ValueError('Invalid db_object_type. Only valid types are '
                     'TABLE, VIEW, PROCEDURE, FUNCTION and SCHEMA.')


def get_db_object(session, schema_name, db_object_name, db_object_type):
    if db_object_type == "TABLE":
        return core.select(table="INFORMATION_SCHEMA.TABLES", cols="TABLE_NAME AS OBJECT_NAME",
                           where=["TABLE_SCHEMA=?",
                                  "TABLE_TYPE='BASE TABLE'", "TABLE_NAME=?"]
                           ).exec(session, [schema_name, db_object_name]).first
    elif db_object_type == "VIEW":
        return core.select(table="INFORMATION_SCHEMA.TABLES", cols="TABLE_NAME AS OBJECT_NAME",
                           where=[
                               "TABLE_SCHEMA=?", "(TABLE_TYPE='VIEW' OR TABLE_TYPE='SYSTEM VIEW')", "TABLE_NAME=?"]
                           ).exec(session, [schema_name, db_object_name]).first
    elif db_object_type == "PROCEDURE":
        return core.select(table="INFORMATION_SCHEMA.ROUTINES", cols="ROUTINE_NAME AS OBJECT_NAME",
                           where=["ROUTINE_SCHEMA=?",
                                  "ROUTINE_TYPE='PROCEDURE'", "ROUTINE_NAME=?"]
                           ).exec(session, [schema_name, db_object_name]).first
    elif db_object_type == "FUNCTION":
        return core.select(table="INFORMATION_SCHEMA.ROUTINES", cols="ROUTINE_NAME AS OBJECT_NAME",
                           where=["ROUTINE_SCHEMA=?",
                                  "ROUTINE_TYPE='FUNCTION'", "ROUTINE_NAME=?"]
                           ).exec(session, [schema_name, db_object_name]).first


    raise ValueError('Invalid db_object_type. Only valid types are '
                     'TABLE, VIEW, PROCEDURE, FUNCTION and SCHEMA.')


def get_object_type_count(session, schema_name, db_object_type):
    if db_object_type == "TABLE":
        query = core.select(table="INFORMATION_SCHEMA.TABLES",
                            cols="COUNT(*) AS object_count",
                            where=["TABLE_SCHEMA=?", "TABLE_TYPE='BASE TABLE'"]
                            )
    if db_object_type == "VIEW":
        query = core.select(table="INFORMATION_SCHEMA.TABLES",
                            cols="COUNT(*) AS object_count",
                            where=[
                                "TABLE_SCHEMA=?", "(TABLE_TYPE = 'VIEW' OR TABLE_TYPE = 'SYSTEM VIEW')"]
                            )
    elif db_object_type == "PROCEDURE":
        query = core.select(table="INFORMATION_SCHEMA.ROUTINES",
                            cols="COUNT(*) AS object_count",
                            where=["ROUTINE_SCHEMA=?",
                                   "ROUTINE_TYPE='PROCEDURE'"]
                            )
    elif db_object_type == "FUNCTION":
        query = core.select(table="INFORMATION_SCHEMA.ROUTINES",
                            cols="COUNT(*) AS object_count",
                            where=["ROUTINE_SCHEMA=?",
                                   "ROUTINE_TYPE='FUNCTION'"]
                            )
    else:
        raise ValueError('Invalid db_object_type. Only valid types are '
                         'TABLE, VIEW, PROCEDURE and FUNCTION.')

    row = query.exec(session, [schema_name]).first
    return int(row["object_count"]) if row else 0


def get_db_object_parameters(session, db_schema_name, db_object_name, db_type):
    sql = """
        SELECT @id:=@id-1 AS id, @id * -1 AS position,
            PARAMETER_NAME AS name,
            PARAMETER_MODE AS mode,
            DTD_IDENTIFIER AS datatype,
            CHARACTER_SET_NAME as charset,
            COLLATION_NAME as collation
        FROM `INFORMATION_SCHEMA`.`PARAMETERS`, (SELECT @id:=0) as init
        WHERE SPECIFIC_SCHEMA = ?
            AND SPECIFIC_NAME = ?
            AND ROUTINE_TYPE = ?
            AND NOT ISNULL(PARAMETER_MODE)
        ORDER BY ORDINAL_POSITION
    """

    return core.MrsDbExec(sql).exec(session, [db_schema_name, db_object_name, db_type]).items


def get_db_function_return_type(session, db_schema_name, db_object_name):
    sql = """
        SELECT DATA_TYPE
        FROM `INFORMATION_SCHEMA`.`ROUTINES`
        WHERE ROUTINE_SCHEMA = ?
            AND ROUTINE_NAME = ?
    """

    row = core.MrsDbExec(sql).exec(session, [db_schema_name, db_object_name]).first

    return row["DATA_TYPE"] if row else None


def db_schema_object_is_table(session, db_schema_name, db_object_name):
    sql = """
        SELECT TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
    """

    row = core.MrsDbExec(sql).exec(
        session, [db_schema_name, db_object_name]).first

    return row and "TABLE" in row["TABLE_TYPE"]


def stored_object_executes_as_invoker(session, schema_name, db_object_name):
    sql = """
        SELECT SECURITY_TYPE FROM INFORMATION_SCHEMA.VIEWS
        WHERE TABLE_SCHEMA = ? and TABLE_NAME = ?
        UNION
        SELECT SECURITY_TYPE FROM INFORMATION_SCHEMA.ROUTINES
        WHERE ROUTINE_SCHEMA = ? and ROUTINE_NAME = ?
    """

    row = (
        core.MrsDbExec(sql)
        .exec(session, [schema_name, db_object_name, schema_name, db_object_name])
        .first
    )

    return row and "INVOKER" in row["SECURITY_TYPE"]


def get_tables_used_in_view_including_required_grants(
    session, schema_name, db_object_name
):
    sql = """
        SELECT TABLE_NAME AS OBJ_NAME FROM INFORMATION_SCHEMA.VIEW_TABLE_USAGE
        WHERE VIEW_SCHEMA = ? AND VIEW_NAME = ?
    """

    rows = core.MrsDbExec(sql).exec(session, [schema_name, db_object_name]).items

    return [
        (row["OBJ_NAME"], "TABLE", ["SELECT", "INSERT", "UPDATE", "DELETE"])
        for row in rows
    ]


def get_routines_used_in_view_including_required_grants(
    session, schema_name, db_object_name
):
    sql = """
        SELECT DISTINCT t1.SPECIFIC_NAME AS OBJ_NAME, t2.ROUTINE_TYPE OBJ_TYPE
        FROM INFORMATION_SCHEMA.VIEW_ROUTINE_USAGE t1
        JOIN INFORMATION_SCHEMA.ROUTINES t2
        ON t1.SPECIFIC_NAME = t2.ROUTINE_NAME
        WHERE t1.TABLE_SCHEMA = ? AND t1.TABLE_NAME = ?;
    """

    rows = core.MrsDbExec(sql).exec(session, [schema_name, db_object_name]).items

    return [(row["OBJ_NAME"], row["OBJ_TYPE"], ["EXECUTE"]) for row in rows]


def get_objects_used_in_view_including_required_grants(
    session, schema_name, db_object_name
):
    objects_with_grants = get_tables_used_in_view_including_required_grants(
        session, schema_name, db_object_name
    )
    objects_with_grants.extend(
        get_routines_used_in_view_including_required_grants(
            session, schema_name, db_object_name
        )
    )

    return objects_with_grants


def get_grant_statements(session, schema_name, db_object_name, grant_privileges, objects, db_object_type=None):
    # We can not grant/revoke the information_schema
    if schema_name.lower() == "information_schema":
        return []

    # We can only grant select on the performance_schema
    if schema_name.lower() == "performance_schema":
        grant_privileges = ["SELECT"]

    if db_object_type == "PROCEDURE" or db_object_type == "FUNCTION":
        grant_privileges = ["EXECUTE"]

    db_objects = [(db_object_name, db_object_type, grant_privileges)]

    # A view that executes in invoker security context can perform only operations for which the invoker has
    # privileges. This means the MRS user needs the additional grants for the underlying tables.
    if db_object_type == "VIEW" and stored_object_executes_as_invoker(
        session, schema_name, db_object_name
    ):
        db_objects.extend(
            [
                (obj_name, obj_type, obj_grants)
                for obj_name, obj_type, obj_grants in get_objects_used_in_view_including_required_grants(
                    session, schema_name, db_object_name
                )
            ]
        )

    grants = [
        f"""GRANT {','.join(obj_grants)}
        ON {obj_type if obj_type == "PROCEDURE" or obj_type == "FUNCTION" else ''}
        {schema_name}.{obj_name}
        TO 'mysql_rest_service_data_provider'@'%'"""
        for obj_name, obj_type, obj_grants in db_objects
    ]

    # If the object is not a procedure, also add all referenced tables and views
    if db_object_type != "PROCEDURE" and db_object_type != "FUNCTION" and objects is not None:
        for obj in objects:
            for field in obj.get("fields"):
                if (field.get("object_reference") and
                    (field["object_reference"].get("unnest") or field["enabled"])):
                    ref_table = (f'{field["object_reference"]["reference_mapping"]["referenced_schema"]}' +
                        f'.{field["object_reference"]["reference_mapping"]["referenced_table"]}')
                    grants.append(f"""GRANT {','.join(grant_privileges)}
                        ON {ref_table}
                        TO 'mysql_rest_service_data_provider'@'%'""")

    return grants


def grant_db_object(session, schema_name, db_object_name, grant_privileges, objects=None, db_object_type=None):
    grants = get_grant_statements(session, schema_name, db_object_name, grant_privileges, objects, db_object_type)
    for grant in grants:
        session.run_sql(grant)


def revoke_all_from_db_object(session, schema_name, db_object_name, db_object_type):
    # We can not grant/revoke the information_schema
    if schema_name.lower() == "information_schema":
        return

    # We can not REVOKE ALL when dealing with the performance_schema
    if schema_name.lower() in ["performance_schema"]:
        sql = f"""
            REVOKE IF EXISTS SELECT ON
            {schema_name}.{db_object_name}
            FROM 'mysql_rest_service_data_provider'@'%'
        """
    else:
        sql = f"""
            REVOKE IF EXISTS
            {'EXECUTE ON PROCEDURE' if db_object_type == "PROCEDURE" else 'ALL PRIVILEGES ON'}
            {schema_name}.{db_object_name}
            FROM 'mysql_rest_service_data_provider'@'%'
        """
    session.run_sql(sql)

def get_table_columns_with_references(session, schema_name, db_object_name, db_object_type):
    sql = """
        SELECT *
        FROM `mysql_rest_service_metadata`.`table_columns_with_references`
        WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = ?
    """

    return core.MrsDbExec(sql).exec(session, [schema_name, db_object_name]).items


def get_objects(session, db_object_id):
    sql = """
        SELECT *
        FROM `mysql_rest_service_metadata`.`object`
        WHERE db_object_id = ?
        ORDER BY position
    """

    return core.MrsDbExec(sql).exec(session, [db_object_id]).items


def get_object_via_absolute_request_path(session, absolute_request_path, ignore_case=True):
    sql = """
        SELECT o.id
        FROM `mysql_rest_service_metadata`.`db_object` AS o
            JOIN `mysql_rest_service_metadata`.`db_schema` AS s
                ON s.id = o.db_schema_id
            JOIN `mysql_rest_service_metadata`.`service` AS se
                ON se.id = s.service_id
        """
    if ignore_case:
        sql += """
            WHERE LOWER(CONCAT(se.url_context_root, s.request_path, o.request_path)) = LOWER(?)
        """
    else:
        sql = """
            WHERE CONCAT(se.url_context_root, s.request_path, o.request_path) = ?
        """

    return core.MrsDbExec(sql).exec(session, [absolute_request_path]).items


def get_object_fields_with_references(session, object_id, binary_formatter=None):
    sql = """
        SELECT *
        FROM `mysql_rest_service_metadata`.`object_fields_with_references`
        WHERE object_id = ?
    """

    return core.MrsDbExec(sql, binary_formatter=binary_formatter).exec(session, [object_id]).items

def crud_mapping(crud_operations):
    crud_to_grant_mapping = {
        'CREATE': 'INSERT',
        'READ': 'SELECT',
        'UPDATE': 'UPDATE',
        'DELETE': 'DELETE'
    }

    grant_privileges = []
    for crud_operation in crud_operations:
        grant_privileges.append(crud_to_grant_mapping[crud_operation])

    return grant_privileges
