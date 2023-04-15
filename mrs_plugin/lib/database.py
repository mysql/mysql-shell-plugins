# Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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

    raise ValueError('Invalid db_object_type. Only valid types are '
                     'TABLE, VIEW, PROCEDURE and SCHEMA.')


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

    raise ValueError('Invalid db_object_type. Only valid types are '
                     'TABLE, VIEW, PROCEDURE and SCHEMA.')


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
    else:
        raise ValueError('Invalid db_object_type. Only valid types are '
                         'TABLE, VIEW and PROCEDURE.')

    row = query.exec(session, [schema_name]).first
    return int(row["object_count"]) if row else 0


def get_db_object_fields(session, schema_name, db_object_name, db_object_type):
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


def grant_procedure(session, schema_name, procedure_name):
    sql = (f"GRANT EXECUTE ON PROCEDURE `"
           f"{schema_name}`.`{procedure_name}` "
           "TO 'mysql_rest_service_data_provider'")
    session.run_sql(sql)


def grant_db_object(session, schema_name, db_object_name, grant_privileges):
    sql = (f"GRANT {','.join(grant_privileges)} ON "
           f"{schema_name}.{db_object_name} "
           "TO 'mysql_rest_service_data_provider'")
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


def get_object_fields_with_references(session, object_id, binary_formatter=None):
    sql = """
        SELECT *
        FROM `mysql_rest_service_metadata`.`object_fields_with_references`
        WHERE object_id = ?
    """

    return core.MrsDbExec(sql, binary_formatter=binary_formatter).exec(session, [object_id]).items
