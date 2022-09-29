# Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

"""Sub-Module for managing MRS schemas"""

# cSpell:ignore mysqlsh, mrs, privs

import json
from unittest.loader import VALID_MODULE_NAME
from mysqlsh.plugin_manager import plugin_function
from mrs_plugin import core, schemas as mrs_schemas

# db_object operations
DB_OBJECT_DISABLE = 1
DB_OBJECT_ENABLE = 2
DB_OBJECT_DELETE = 3
DB_OBJECT_SET_ALL = 4

DB_OBJECT_SELECT = """
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


def validate_value(value, value_name):
    if not value and not isinstance(value, bool):
        raise ValueError(f"The '{value_name}' parameter was not set.")
    return value


def add_where_clause(where, new):
    return f"{where} {'AND' if where else 'WHERE'} {new}"


@plugin_function('mrs.add.dbObject', shell=True, cli=True, web=True)
def add_db_object(**kwargs):
    """Add a db_object to the given MRS service schema

    Args:
        **kwargs: Additional options

    Keyword Args:
        db_object_name (str): The name of the schema object add
        db_object_type (str): Either TABLE, VIEW or PROCEDURE
        schema_id (int): The id of the schema the object should be added to
        schema_name (str): The name of the schema
        auto_add_schema (bool): If the schema should be added as well if it
            does not exist yet
        request_path (str): The request_path
        enabled (bool): Whether the db object is enabled
        crud_operations (list): The allowed CRUD operations for the object
        crud_operation_format (str): The format to use for the CRUD operation
        requires_auth (bool): Whether authentication is required to access
            the schema
        items_per_page (int): The number of items returned per page
        row_user_ownership_enforced (bool): Enable row ownership enforcement
        row_user_ownership_column (str): The column for row ownership enforcement
        comments (str): Comments for the schema
        media_type (str): The media_type of the db object
        auto_detect_media_type (bool): Whether to automatically detect the media type
        auth_stored_procedure (str): The stored procedure that implements the authentication check for this db object
        options (str): The options of this db object
        parameters (str): The parameter definition in JSON format
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised
        return_formatted (bool): If true a human readable string is returned
        return_python_object (bool): Used for internal plugin calls

    Allowed options for parameters:
        id (int,optional): The id of the parameter or a negative value when it is a new parameter
        db_object_id (int,optional): The id of the corresponding db object
        position (int): The position of the parameter;
        name (str): The name of the parameter;
        bind_column_name (str): The column name of the TABLE or VIEW or parameter name the PROCEDURE
            this parameter maps to
        datatype (str): The datatype, 'STRING', 'INT', 'DOUBLE', 'BOOLEAN', 'LONG', 'TIMESTAMP', 'JSON'
        mode (str): The parameter mode, "IN", "OUT", "INOUT"
        comments (str,optional): The comments for the parameter

    Returns:
        None
    """

    db_object_name = kwargs.get("db_object_name")
    db_object_type = kwargs.get("db_object_type")
    schema_id = kwargs.get("schema_id")
    schema_name = kwargs.get("schema_name")
    auto_add_schema = kwargs.get("auto_add_schema", False)

    request_path = kwargs.get("request_path")
    enabled = kwargs.get("enabled", True)
    crud_operations = kwargs.get("crud_operations")
    crud_operation_format = kwargs.get("crud_operation_format")
    requires_auth = kwargs.get("requires_auth")
    items_per_page = kwargs.get("items_per_page")
    row_user_ownership_enforced = kwargs.get("row_user_ownership_enforced")
    row_user_ownership_column = kwargs.get("row_user_ownership_column")
    comments = kwargs.get("comments")

    media_type = kwargs.get("media_type")
    auto_detect_media_type = kwargs.get("auto_detect_media_type", True)
    auth_stored_procedure = kwargs.get("auth_stored_procedure")
    options = kwargs.get("options")

    parameters = kwargs.get("parameters")

    session = kwargs.get("session")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)
    return_python_object = kwargs.get("return_python_object", False)

    if crud_operations:
        crud_operations = list(crud_operations)

    try:
        session = core.get_current_session_with_rds_metadata(session)

        # If auto_add_schema is set, check if the schema is registered already.
        # If not, create it
        if auto_add_schema and schema_name and not schema_id:
            try:
                schema = mrs_schemas.get_schema(
                    schema_name=schema_name,
                    session=session, interactive=False,
                    return_formatted=False)

                schema_id = schema.get("id")
            except:
                schema_id = mrs_schemas.add_schema(schema_name=schema_name,
                                                   request_path=f"/{schema_name}",
                                                   requires_auth=True if requires_auth else False,
                                                   session=session,
                                                   interactive=False)

        # Get the schema
        schema = mrs_schemas.get_schema(
            schema_name=schema_name,
            schema_id=schema_id, auto_select_single=True,
            session=session, interactive=interactive,
            return_formatted=False)

        if not schema:
            raise Exception("Cancelling operation.")

        if not db_object_type and interactive:
            # Get object counts per type
            row = session.run_sql('''
                SELECT COUNT(*) AS table_count
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
                ''', [schema.get("name")]).fetch_one()
            table_count = int(row.get_field("table_count")) if row else 0

            row = session.run_sql('''
                SELECT COUNT(*) AS view_count
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_SCHEMA = ? AND
                    (TABLE_TYPE = 'VIEW' OR TABLE_TYPE = 'SYSTEM VIEW')
                ''', [schema.get("name")]).fetch_one()
            view_count = int(row.get_field("view_count")) if row else 0

            row = session.run_sql('''
                SELECT COUNT(*) AS proc_count
                FROM INFORMATION_SCHEMA.ROUTINES
                WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = 'PROCEDURE'
                ''', [schema.get("name")]).fetch_one()
            proc_count = int(row.get_field("proc_count")) if row else 0

            db_object_types = []
            if table_count > 0:
                db_object_types.append("TABLE")
            if view_count > 0:
                db_object_types.append("VIEW")
            if proc_count > 0:
                db_object_types.append("PROCEDURE")

            if len(db_object_types) == 0:
                raise ValueError("No database objects in the database schema "
                                 f"{schema.get('name')}")

            caption = (
                "Please enter the name or index of a database object type"
                f"{' [TABLE]: ' if table_count > 0 else ': '}")
            db_object_type = core.prompt_for_list_item(
                item_list=db_object_types,
                prompt_caption=caption,
                prompt_default_value="TABLE" if table_count > 0 else None,
                print_list=True)

            if not db_object_type:
                raise ValueError('Operation cancelled.')

        if not db_object_name and interactive:
            if db_object_type == "TABLE":
                sql = '''
                    SELECT TABLE_NAME AS OBJECT_NAME
                    FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_SCHEMA = ? /*=sakila*/
                        AND TABLE_TYPE = 'BASE TABLE'
                    ORDER BY TABLE_NAME
                '''
            elif db_object_type == "VIEW":
                sql = '''
                    SELECT TABLE_NAME AS OBJECT_NAME
                    FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_SCHEMA = ? /*=sakila*/
                        AND (TABLE_TYPE = 'VIEW'
                            OR TABLE_TYPE = 'SYSTEM VIEW')
                    ORDER BY TABLE_NAME
                '''
            else:
                sql = '''
                    SELECT ROUTINE_NAME AS OBJECT_NAME
                    FROM INFORMATION_SCHEMA.ROUTINES
                    WHERE ROUTINE_SCHEMA = ? /*=sakila*/
                        AND ROUTINE_TYPE = 'PROCEDURE'
                    ORDER BY ROUTINE_NAME
                '''

            res = session.run_sql(
                sql, [schema.get("name")])
            rows = res.fetch_all()
            db_objects = \
                [row.get_field("OBJECT_NAME") for row in rows]

            if len(db_objects) == 0:
                raise ValueError(
                    f"No database objects of type {db_object_type} in the "
                    f"database schema {schema.get('name')}")

            db_object_name = core.prompt_for_list_item(
                item_list=db_objects,
                prompt_caption=("Please enter the name or index of an "
                                "database object: "),
                print_list=True)

            if not db_object_name:
                raise ValueError('Operation cancelled.')
        # If a schema name has been provided, check if that schema exists
        elif db_object_name and db_object_type:

            if db_object_type == "TABLE":
                sql = '''
                    SELECT TABLE_NAME AS OBJECT_NAME
                    FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
                        AND TABLE_NAME = ?
                '''
            elif db_object_type == "VIEW":
                sql = '''
                    SELECT TABLE_NAME AS OBJECT_NAME
                    FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_SCHEMA = ?
                        AND (TABLE_TYPE = 'VIEW' OR TABLE_TYPE = 'SYSTEM VIEW')
                        AND TABLE_NAME = ?
                '''
            elif db_object_type == "PROCEDURE":
                sql = '''
                    SELECT ROUTINE_NAME AS OBJECT_NAME
                    FROM INFORMATION_SCHEMA.ROUTINES
                    WHERE ROUTINE_SCHEMA = ?
                        AND ROUTINE_TYPE = 'PROCEDURE'
                        AND ROUTINE_NAME = ?
                '''
            else:
                raise ValueError('Invalid db_object_type. Only valid types are '
                                 'TABLE, VIEW and PROCEDURE.')

            res = session.run_sql(sql, [schema.get("name"), db_object_name])
            row = res.fetch_one()
            if row:
                db_object_name = row.get_field("OBJECT_NAME")
            else:
                raise ValueError(
                    f"The {db_object_type} named '{db_object_name}' "
                    f"does not exists in database schema {schema.get('name')}.")

        # Get request_path
        if not request_path:
            if interactive:
                request_path = core.prompt(
                    "Please enter the request path for this object ["
                    f"/{db_object_name}]: ",
                    {'defaultValue': '/' + db_object_name}).strip()
            else:
                request_path = '/' + db_object_name

        if not request_path.startswith('/'):
            raise Exception(
                f"The request_path '{request_path}' has to start with '/'.")

        # Check if the request_path starts with / and is unique for the schema
        core.check_request_path(
            schema.get("host_ctx") + schema.get("request_path") +
            request_path, session=session)

        # Get crud_operations
        if not crud_operations and interactive:
            crud_operation_options = [
                'CREATE',
                'READ',
                'UPDATE',
                'DELETE']
            crud_operations = core.prompt_for_list_item(
                item_list=crud_operation_options,
                prompt_caption=("Please select the CRUD operations that "
                                "should be supported, '*' for all [READ]: "),
                prompt_default_value="2",
                print_list=True,
                allow_multi_select=True)
        if not crud_operations:
            raise ValueError("No CRUD operations specified."
                             "Operation cancelled.")

        if not crud_operation_format and interactive:
            crud_operation_format_options = [
                'FEED',
                'ITEM',
                'MEDIA']
            crud_operation_format = core.prompt_for_list_item(
                item_list=crud_operation_format_options,
                prompt_caption=("Please select the CRUD operation format "
                                "[FEED]: "),
                prompt_default_value="FEED",
                print_list=True)
        if not crud_operation_format:
            raise ValueError("No CRUD operation format specified."
                             "Operation cancelled.")

        if type(crud_operations) != list:
            raise ValueError("The crud_operations need to be specified as "
                             "list. Operation cancelled.")

        # Get requires_auth
        if not requires_auth:
            if interactive:
                requires_auth = core.prompt(
                    "Should the db_object require authentication [y/N]: ",
                    {'defaultValue': 'n'}).strip().lower() == 'y'
            else:
                requires_auth = False

        # Get row_user_ownership_enforced
        if not row_user_ownership_enforced:
            if interactive:
                row_user_ownership_enforced = core.prompt(
                    "Should row ownership be required when querying the "
                    "object [y/N]: ",
                    {'defaultValue': 'n'}).strip().lower() == 'y'
            else:
                row_user_ownership_enforced = False

        if row_user_ownership_enforced and not row_user_ownership_column:
            if interactive:
                fields = get_db_object_row_ownership_fields(
                    schema_name=schema["name"],
                    db_object_name=db_object_name,
                    db_object_type=db_object_type)
                if len(fields) < 1:
                    raise ValueError(
                        "No IN parameters available for this procedure.")

                print("List of available fields:")
                row_user_ownership_column = core.prompt_for_list_item(
                    item_list=fields, prompt_caption="Which "
                    + ("parameter" if db_object_type == "PROCEDURE" else "column")
                    + " should be used for row ownership checks",
                    print_list=True)

                if not row_user_ownership_column or row_user_ownership_column == "":
                    raise ValueError('Operation cancelled.')

        # Get items_per_page
        if not items_per_page:
            if interactive:
                items_per_page = core.prompt(
                    "How many items should be listed per page "
                    "[Schema Default]: ",
                    {'defaultValue': 'NULL'}).strip()
                if items_per_page:
                    if items_per_page != 'NULL':
                        try:
                            items_per_page = int(items_per_page)
                        except:
                            raise ValueError("No valid value given."
                                             "Operation cancelled.")
                    else:
                        items_per_page = None

        # Get comments
        if not comments:
            if interactive:
                comments = core.prompt(
                    "Comments: ").strip()
            else:
                comments = ""

        grant_privs = ""
        for crud_operation in crud_operations:
            if crud_operation == "CREATE" or crud_operation == "1":
                grant_privs += "CREATE, "
            elif crud_operation == "READ" or crud_operation == "2":
                grant_privs += "SELECT, "
            elif crud_operation == "UPDATE" or crud_operation == "3":
                grant_privs += "UPDATE, "
            elif crud_operation == "DELETE" or crud_operation == "4":
                grant_privs += "DELETE, "
            else:
                raise ValueError(f"The given CRUD operation {crud_operation} "
                                 "does not exist.")

        sql = """
            INSERT INTO mysql_rest_service_metadata.db_object(
                db_schema_id, name, request_path, enabled,
                object_type, items_per_page, requires_auth,
                row_user_ownership_enforced, row_user_ownership_column,
                crud_operations, format,
                comments, media_type, auto_detect_media_type,
                auth_stored_procedure, options)
            VALUES(?, ?, ?, ?,
                ?, ?, ?,
                ?,?,?,?,?,
                ?, ?, ?, ?)
            """

        res = session.run_sql(
            sql,
            [schema.get("id"), db_object_name, request_path, enabled,
             db_object_type, items_per_page,
             1 if requires_auth else 0,
             1 if row_user_ownership_enforced else 0, row_user_ownership_column,
             ",".join(crud_operations), crud_operation_format,
             comments, media_type, auto_detect_media_type,
             auth_stored_procedure, options])
        db_object_id = res.auto_increment_value

        # Insert parameter
        if parameters:
            parameters = json.loads(parameters)

            for param in parameters:
                res = session.run_sql("""
                    INSERT INTO `mysql_rest_service_metadata`.`parameter` (
                        `db_object_id`, `position`, `name`,
                       `bind_column_name`, `param_datatype`, `mode`, `comments`)
                    VALUES (?, ?, ?, ?, ?, ?, ?);
                """, [db_object_id, param.get("position"), param.get("name"),
                      param.get("bind_column_name", param.get(
                          "bindColumnName")), param.get("datatype"),
                      param.get("mode"), param.get("comments")])

        # Grant privilege to the 'mrs_provider_data_access' role
        if grant_privs:
            grant_privs = grant_privs[0:-2]
        else:
            raise ValueError("No valid CRUD Operation specified")

        if db_object_type == "PROCEDURE":
            sql = (f"GRANT EXECUTE ON PROCEDURE `"
                   f"{schema.get('name')}`.`{db_object_name}` "
                   "TO 'mrs_provider_data_access'")
        else:
            sql = (f"GRANT {grant_privs} ON "
                   f"{schema.get('name')}.{db_object_name} "
                   "TO 'mrs_provider_data_access'")
        res = session.run_sql(sql)

        if return_formatted:
            return "\n" + "Object added successfully."
        else:
            return db_object_id

    except Exception as e:
        if raise_exceptions:
            raise
        print(f"Error: {str(e)}")


@plugin_function('mrs.get.dbObject', shell=True, cli=True, web=True)
def get_db_object(request_path=None, db_object_name=None, **kwargs):
    """Gets a specific MRS db_object

    Args:
        request_path (str): The request_path of the schema
        db_object_name (str): The name of the schema
        **kwargs: Additional options

    Keyword Args:
        db_object_id (int): The id of the db_object
        schema_id (int): The id of the schema
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode

    Returns:
        The db_object as dict
    """

    db_object_id = kwargs.get("db_object_id")
    schema_id = kwargs.get("schema_id")
    session = kwargs.get("session")
    interactive = kwargs.get("interactive", core.get_interactive_default())

    try:
        session = core.get_current_session_with_rds_metadata(session)

        if not db_object_id:
            if not schema_id:
                schema = mrs_schemas.get_schema(
                    schema_id=schema_id, session=session, interactive=interactive,
                    return_formatted=False)
                if not schema:
                    return

                schema_id = schema.get("id")

            # If there are no selective parameters given
            if (not request_path or not db_object_name
                    and interactive):
                db_objects = get_db_objects(
                    schema_id=schema.get("id"), session=session, interactive=False)
                print(f"DB Object Listing for Schema "
                      f"{schema.get('host_ctx')}"
                      f"{schema.get('request_path')}")
                item = core.prompt_for_list_item(
                    item_list=db_objects,
                    prompt_caption=("Please select a db_object index or type "
                                    "the request_path: "),
                    item_name_property="request_path",
                    print_list=True)
                if not item:
                    raise ValueError("Operation cancelled.")
                else:
                    return item

            if request_path and not request_path.startswith('/'):
                raise Exception("The request_path has to start with '/'.")

        # Build SQL based on which input has been provided
        sql = DB_OBJECT_SELECT
        params = []
        where = ""
        if schema_id:
            where = add_where_clause(where, "o.db_schema_id = ?")
            params = [schema_id]
        if request_path:
            where = add_where_clause(where, "o.request_path = ?")
            params.append(request_path)
        if db_object_name:
            where = add_where_clause(where, "o.name = ?")
            params.append(db_object_name)
        if db_object_id:
            where = add_where_clause(where, "o.id = ?")
            params.append(db_object_id)
        sql += where
        sql += " GROUP BY o.id"

        res = session.run_sql(sql, params)

        db_objects = core.get_sql_result_as_dict_list(res)

        if len(db_objects) != 1:
            raise Exception("The given db_objects was not found.")
        else:
            return db_objects[0]

    except Exception as e:
        if interactive:
            print(f"Error: {str(e)}")
        else:
            raise


@plugin_function('mrs.get.dbObjectRowOwnershipFields', shell=True, cli=True, web=True)
def get_db_object_row_ownership_fields(request_path=None, db_object_name=None, **kwargs):
    """Gets the list of possible row ownership fields for the given db_object

    Args:
        request_path (str): The request_path of the schema
        db_object_name (str): The name of the db_object
        **kwargs: Additional options

    Keyword Args:
        db_object_id (int): The id of the db_object
        schema_id (int): The id of the schema
        schema_name (str): The name of the schema
        db_object_type (str): The type of the db_object (TABLE, VIEW, PROCEDURE)
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode

    Returns:
        The list of possible row ownership fields names
    """

    schema_name = kwargs.get("schema_name")
    db_object_type = kwargs.get("db_object_type")
    schema_id = kwargs.get("schema_id")

    session = kwargs.get("session")
    interactive = kwargs.get("interactive", core.get_interactive_default())

    try:
        if db_object_type and db_object_type != "TABLE" and db_object_type != "VIEW" and db_object_type != "PROCEDURE":
            raise ValueError(
                "The object_type must be either set to TABLE, VIEW or PROCEDURE.")

        if not (schema_name and db_object_name and db_object_type):
            db_object = get_db_object(request_path=request_path,
                                      db_object_name=db_object_name,
                                      schema_id=schema_id, session=session,
                                      interactive=interactive)
            if db_object:
                schema_name = db_object["schema_name"]
                db_object_name = db_object["name"]
                db_object_type = db_object["object_type"]

        if not (schema_name and db_object_name and db_object_type):
            raise ValueError(
                "The database object must be identified via schema_name, db_object_name and db_object_type "
                "or via the request_path and db_object_name.")

        session = core.get_current_session_with_rds_metadata(session)

        if db_object_type == "PROCEDURE":
            sql = """
                SELECT PARAMETER_NAME FROM `INFORMATION_SCHEMA`.`PARAMETERS`
                WHERE SPECIFIC_SCHEMA = ?
                    AND SPECIFIC_NAME = ?
                    AND PARAMETER_MODE = "IN"
                ORDER BY ORDINAL_POSITION
            """
        else:
            sql = """
                SELECT COLUMN_NAME FROM `INFORMATION_SCHEMA`.`COLUMNS`
                WHERE TABLE_SCHEMA = ?
                    AND TABLE_NAME = ?
                    AND GENERATION_EXPRESSION = ""
                ORDER BY ORDINAL_POSITION
            """

        res = session.run_sql(sql, [schema_name, db_object_name])
        rows = res.fetch_all()

        return [f[0] for f in rows]

    except Exception as e:
        if interactive:
            print(f"Error: {str(e)}")
        else:
            raise


@plugin_function('mrs.get.dbObjectFields', shell=True, cli=True, web=True)
def get_db_object_fields(request_path=None, db_object_name=None, **kwargs):
    """Gets the list of available row ownership fields for the given db_object

    Args:
        request_path (str): The request_path of the schema
        db_object_name (str): The name of the db_object
        **kwargs: Additional options

    Keyword Args:
        db_object_id (int): The id of the db_object
        schema_id (int): The id of the schema
        schema_name (str): The name of the schema
        db_object_type (str): The type of the db_object (TABLE, VIEW, PROCEDURE)
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode

    Returns:
        The list of available db object fields
    """

    schema_name = kwargs.get("schema_name")
    db_object_type = kwargs.get("db_object_type")
    schema_id = kwargs.get("schema_id")

    session = kwargs.get("session")
    interactive = kwargs.get("interactive", core.get_interactive_default())

    try:
        if db_object_type and db_object_type != "TABLE" and db_object_type != "VIEW" and db_object_type != "PROCEDURE":
            raise ValueError(
                "The object_type must be either set to TABLE, VIEW or PROCEDURE.")

        if not (schema_name and db_object_name and db_object_type):
            db_object = get_db_object(request_path=request_path,
                                      db_object_name=db_object_name,
                                      schema_id=schema_id, session=session,
                                      interactive=False)
            schema_name = db_object["schema_name"]
            db_object_name = db_object["db_object_name"]
            db_object_type = db_object["object_type"]

        if not (schema_name and db_object_name and db_object_type):
            raise ValueError(
                "The database object must be identified via schema_name, db_object_name and db_object_type "
                "or via the request_path and db_object_name.")

        session = core.get_current_session_with_rds_metadata(session)

        # cSpell:ignore mediumint tinyint id
        if db_object_type == "PROCEDURE":
            sql = """
                SELECT @id:=@id-1 AS id, @id * -1 AS position,
                    PARAMETER_NAME AS name, PARAMETER_NAME AS bindColumnName,
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
                    COLUMN_NAME AS name, COLUMN_NAME AS bindColumnName,
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

        res = session.run_sql(sql, [schema_name, db_object_name])

        return core.get_sql_result_as_dict_list(res)

    except Exception as e:
        if interactive:
            print(f"Error: {str(e)}")
        else:
            raise


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

    i = 0
    for item in db_objects:
        i += 1
        path = (item['host_ctx'] + item['schema_request_path'] +
                item['request_path'])
        # Shorten the list of CRUD operation names to just the first characters
        crud = ''.join([o[0] for o in item['crud_operations']]) \
            if item['crud_operations'] else ""
        changed_at = str(item['changed_at']) if item['changed_at'] else ""

        output += (f"{item['id']:>3} {path[:35]:35} "
                   f"{item['name'][:30]:30} {crud:4} "
                   f"{item['object_type'][:9]:10} "
                   f"{'Yes' if item['enabled'] else '-':7} "
                   f"{'Yes' if item['requires_auth'] else '-':4} "
                   f"{changed_at[:16]:16}")
        if i < len(db_objects):
            output += "\n"

    return output


@plugin_function('mrs.list.dbObjects', shell=True, cli=True, web=True)
def get_db_objects(**kwargs):
    """Returns all db_objects for the given schema

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_id (int): The id of the schema to list the db_objects from
        include_enable_state (bool): Only include db_objects with the given
            enabled state
        session (object): The database session to use
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised
        return_formatted (bool): If set to true, a list object is returned

    Returns:
        A list of dicts representing the db_objects of the schema
    """

    schema_id = kwargs.get("schema_id")
    include_enable_state = kwargs.get("include_enable_state")
    session = kwargs.get("session")
    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)

    try:
        session = core.get_current_session_with_rds_metadata(session)

        # Check the given service_id or get the default if none was given
        schema = mrs_schemas.get_schema(
            schema_id=schema_id,
            session=session, interactive=interactive,
            raise_exceptions=raise_exceptions,
            return_formatted=False)

        schema_id = schema.get("id")

        sql = DB_OBJECT_SELECT
        where = ""
        if schema_id:
            where = add_where_clause(where, "o.db_schema_id = ?")

        if include_enable_state is not None:
            where = add_where_clause(
                where,
                f"o.enabled = {'TRUE' if include_enable_state else 'FALSE'}")
        sql += where
        sql += " GROUP BY o.id"

        res = session.run_sql(sql, [schema["id"]])

        db_objects = core.get_sql_result_as_dict_list(res)

        if return_formatted:
            return format_db_object_listing(db_objects, print_header=True)
        else:
            return db_objects

    except Exception as e:
        if raise_exceptions:
            raise
        print(f"Error: {str(e)}")


@plugin_function('mrs.get.dbObjectParameters', shell=True, cli=True, web=True)
def get_db_object_parameters(request_path=None, db_object_name=None, **kwargs):
    """Gets the list of parameters for the given db_object

    Args:
        request_path (str): The request_path of the schema
        db_object_name (str): The name of the db_object
        **kwargs: Additional options

    Keyword Args:
        db_object_id (int): The id of the db_object
        schema_id (int): The id of the schema
        schema_name (str): The name of the schema
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode

    Returns:
        The list of db object parameters
    """

    db_object_id = kwargs.get("db_object_id")
    schema_name = kwargs.get("schema_name")
    schema_id = kwargs.get("schema_id")

    session = kwargs.get("session")
    interactive = kwargs.get("interactive", core.get_interactive_default())

    try:
        if not db_object_id:
            db_object = get_db_object(request_path=request_path,
                                      db_object_name=db_object_name,
                                      schema_id=schema_id, session=session,
                                      interactive=False)
            db_object_id = db_object["id"]

        if not db_object_id:
            raise ValueError(
                "The given DB Object could not be found.")

        # Make sure the MRS metadata schema exists and has the right version
        session = core.get_current_session_with_rds_metadata(session)

        sql = """
            SELECT id, db_object_id AS dbObjectId, position, name,
                bind_column_name AS bindColumnName,
                param_datatype AS datatype, mode, comments
            FROM mysql_rest_service_metadata.parameter
            WHERE db_object_id = ?
            ORDER BY id, position
            """

        res = session.run_sql(sql, [db_object_id])

        return core.get_sql_result_as_dict_list(res)

    except Exception as e:
        if interactive:
            print(f"Error: {str(e)}")
        else:
            raise


@plugin_function('mrs.set.dbObject.requestPath', shell=True, cli=True, web=True)
def set_request_path(db_object_id=None, request_path=None, **kwargs):
    """Sets the request_path of the given db_object

    Args:
        db_object_id (int): The id of the schema to list the db_objects from
        request_path (str): The request_path that should be set
        **kwargs: Additional options

    Keyword Args:
        session (object): The database session to use
        interactive (bool): Indicates whether to execute in interactive mode

    Returns:
        None
    """

    session = kwargs.get("session")
    interactive = kwargs.get("interactive", core.get_interactive_default())

    try:
        session = core.get_current_session_with_rds_metadata(session)

        # Get the object with the given id or let the user select it
        db_object = get_db_object(db_object_id=db_object_id,
                                  session=session, interactive=interactive)
        if not db_object:
            return

        if not request_path and interactive:
            request_path = core.prompt(
                "Please enter a new request_path "
                f"for the db_object {db_object.get('name')} "
                f"[{db_object.get('request_path')}]: ",
                {"defaultValue": db_object.get('request_path')})

        if request_path == db_object.get('request_path'):
            if interactive:
                print("The request_path was left unchanged.")
                return

        # Ensure the new request_path is unique
        schema = mrs_schemas.get_schema(
            schema_id=db_object.get("db_schema_id"),
            session=session, interactive=False,
            return_formatted=False)
        core.check_request_path(
            schema.get("host_ctx") + schema.get("request_path") + request_path,
            session=session)

        res = session.run_sql("""
            UPDATE mysql_rest_service_metadata.db_object
            SET request_path = ?
            WHERE id = ?
            """, [request_path, db_object.get("id")])
        if res.affected_items_count != 1:
            raise Exception("Could not update the db_object.")

        if interactive:
            print(f"The db_object {db_object.get('name')} was updated "
                  "successfully.")

    except Exception as e:
        if interactive:
            print(f"Error: {str(e)}")
        else:
            raise


@plugin_function('mrs.set.dbObject.crudOperations', shell=True, cli=True, web=True)
def set_crud_operations(db_object_id=None, crud_operations=None,
                        crud_operation_format=None, **kwargs):
    """Sets the request_path of the given db_object

    Args:
        db_object_id (int): The id of the schema to list the db_objects from
        crud_operations (list): The allowed CRUD operations for the object
        crud_operation_format (str): The format to use for the CRUD operation
        **kwargs: Additional options

    Keyword Args:
        session (object): The database session to use
        interactive (bool): Indicates whether to execute in interactive mode

    Returns:
        None
    """

    session = kwargs.get("session")
    interactive = kwargs.get("interactive", core.get_interactive_default())

    try:
        session = core.get_current_session_with_rds_metadata(session)

        # Get the object with the given id or let the user select it
        db_object = get_db_object(db_object_id=db_object_id,
                                  session=session, interactive=interactive)
        if not db_object:
            return

        # Get crud_operations
        if not crud_operations and interactive:
            crud_operation_options = [
                'CREATE',
                'READ',
                'UPDATE',
                'DELETE']
            crud_operations = core.prompt_for_list_item(
                item_list=crud_operation_options,
                prompt_caption=("Please select the CRUD operations that "
                                "should be supported, '*' for all: "),
                print_list=True,
                allow_multi_select=True)
        if not crud_operations:
            raise ValueError("No CRUD operations specified."
                             "Operation cancelled.")

        if not crud_operation_format and interactive:
            crud_operation_format_options = [
                'FEED',
                'ITEM',
                'MEDIA']
            crud_operation_format = core.prompt_for_list_item(
                item_list=crud_operation_format_options,
                prompt_caption=("Please select the CRUD operation format "
                                "[FEED]: "),
                prompt_default_value="FEED",
                print_list=True)
        if not crud_operation_format:
            raise ValueError("No CRUD operation format specified."
                             "Operation cancelled.")

        if type(crud_operations) != list:
            raise ValueError("The crud_operations need to be specified as "
                             "list. Operation cancelled.")

        grant_privs = ""
        for crud_operation in crud_operations:
            if crud_operation == "CREATE" or crud_operation == "1":
                grant_privs += "CREATE, "
            elif crud_operation == "READ" or crud_operation == "2":
                grant_privs += "SELECT, "
            elif crud_operation == "UPDATE" or crud_operation == "3":
                grant_privs += "UPDATE, "
            elif crud_operation == "DELETE" or crud_operation == "4":
                grant_privs += "DELETE, "
            else:
                raise ValueError(f"The given CRUD operation {crud_operation} "
                                 "does not exist.")

        res = session.run_sql("""
                UPDATE mysql_rest_service_metadata.db_object
                SET crud_operations = ?, format = ?
                WHERE id = ?
                """, [",".join(crud_operations), crud_operation_format, db_object.get("id")])
        if res.affected_items_count != 1:
            raise Exception(
                f"Could not update crud operations for the db_object {db_object.get('name')}.")

        # Update privilege to the 'mrs_provider_data_access' role
        if grant_privs:
            grant_privs = grant_privs[0:-2]
        else:
            raise ValueError("No valid CRUD Operation specified")

        schema = mrs_schemas.get_schema(schema_id=db_object.get("db_schema_id"), session=session,
                                        interactive=interactive, return_formatted=False)
        sql = (f"REVOKE ALL ON  "
               f"{schema.get('name')}.{db_object.get('name')} "
               "FROM 'mrs_provider_data_access'")
        res = session.run_sql(sql)

        sql = (f"GRANT {grant_privs} ON "
               f"{schema.get('name')}.{db_object.get('name')} "
               "TO 'mrs_provider_data_access'")
        res = session.run_sql(sql)

        if interactive:
            print(f"The db_object {db_object.get('name')} was updated "
                  "successfully.")

    except Exception as e:
        if interactive:
            print(f"Error: {str(e)}")
        else:
            raise


@plugin_function('mrs.enable.dbObject', shell=True, cli=True, web=True)
def enable_db_object(db_object_name=None, schema_id=None,
                     **kwargs):
    """Enables a db_object of the given schema

    Args:
        db_object_name (str): The name of the db_object
        schema_id (int): The id of the schema
        **kwargs: Additional options

    Keyword Args:
        db_object_id (int): The id of the db_object
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode

    Returns:
        The result message as string
    """

    db_object_id = kwargs.get("db_object_id")
    session = kwargs.get("session")
    interactive = kwargs.get("interactive", core.get_interactive_default())

    return change_db_object(change_type=DB_OBJECT_ENABLE,
                            db_object_name=db_object_name,
                            schema_id=schema_id,
                            db_object_id=db_object_id,
                            session=session,
                            interactive=interactive)


@plugin_function('mrs.disable.dbObject', shell=True, cli=True, web=True)
def disable_db_object(db_object_name=None, schema_id=None, **kwargs):
    """Disables a db_object of the given service

    Args:
        db_object_name (str): The name of the db_object
        schema_id (int): The id of the schema
        **kwargs: Additional options

    Keyword Args:
        db_object_id (int): The id of the db_object
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode

    Returns:
        The result message as string
    """

    db_object_id = kwargs.get("db_object_id")
    session = kwargs.get("session")
    interactive = kwargs.get("interactive", core.get_interactive_default())

    return change_db_object(change_type=DB_OBJECT_DISABLE,
                            db_object_name=db_object_name,
                            schema_id=schema_id,
                            db_object_id=db_object_id,
                            session=session,
                            interactive=interactive)


@plugin_function('mrs.delete.dbObject', shell=True, cli=True, web=True)
def delete_db_object(db_object_name=None, schema_id=None, **kwargs):
    """Deletes a schema of the given service

    Args:
        db_object_name (str): The name of the db_object
        schema_id (int): The id of the schema
        **kwargs: Additional options

    Keyword Args:
        db_object_id (int): The id of the db_object
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode

    Returns:
        The result message as string
    """

    db_object_id = kwargs.get("db_object_id")
    session = kwargs.get("session")
    interactive = kwargs.get("interactive", core.get_interactive_default())

    return change_db_object(change_type=DB_OBJECT_DELETE,
                            db_object_name=db_object_name,
                            schema_id=schema_id,
                            db_object_id=db_object_id,
                            session=session,
                            interactive=interactive)


@plugin_function('mrs.update.dbObject', shell=True, cli=True, web=True)
def update_db_object(**kwargs):
    """Update a db_object

    Args:
        **kwargs: Additional options

    Keyword Args:
        db_object_id (int): The id of the db object
        db_object_name (str): The name of the schema object add
        schema_id (int): The id of the schema the object should be added to
        request_path (str): The request_path
        name (str): The new name to apply to the database object
        enabled (bool): If the DB Object is enabled or not
        crud_operations (list): The allowed CRUD operations for the object
        crud_operation_format (str): The format to use for the CRUD operation
        requires_auth (bool): Whether authentication is required to access
            the schema
        items_per_page (int): The number of items returned per page
        auto_detect_media_type (bool): Whether the media type should be detected automatically
        row_user_ownership_enforced (bool): Enable row ownership enforcement
        row_user_ownership_column (str): The column for row ownership enforcement
        comments (str): Comments for the schema
        media_type (str): The media_type of the db object
        auth_stored_procedure (str): The stored procedure that implements the authentication check for this db object
        options (str): The options of this db object
        parameters (str): The db objects parameters as JSON string
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised
        return_formatted (bool): If true a human readable string is returned
        return_python_object (bool): Used for internal plugin calls

    Returns:
        None
    """
    return change_db_object(
        change_type=DB_OBJECT_SET_ALL,
        **kwargs)


def change_db_object(**kwargs):
    """Makes a given change to a MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        db_object_id (int): The id of the db object
        db_object_name (str): The name of the schema object add
        schema_id (int): The id of the schema the object should be added to
        request_path (str): The request_path
        name (str): The new name to apply to the database object
        enabled (bool): If the DB Object is enabled or not
        crud_operations (list): The allowed CRUD operations for the object
        crud_operation_format (str): The format to use for the CRUD operation
        requires_auth (bool): Whether authentication is required to access
            the schema
        items_per_page (int): The number of items returned per page
        auto_detect_media_type (bool): Whether the media type should be detected automatically
        row_user_ownership_enforced (bool): Enable row ownership enforcement
        row_user_ownership_column (str): The column for row ownership enforcement
        comments (str): Comments for the schema
        media_type (str): The media_type of the db object
        auth_stored_procedure (str): The stored procedure that implements the authentication check for this db object
        options (str): The options of this db object
        parameters (str): The db objects parameters as JSON string
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised
        return_formatted (bool): If true a human readable string is returned
        return_python_object (bool): Used for internal plugin calls

    Returns:
        The result message as string
    """
    change_type = kwargs.get("change_type")

    db_object_id = kwargs.get("db_object_id")
    db_object_name = kwargs.get("db_object_name")
    request_path = kwargs.get("request_path")
    schema_id = kwargs.get("schema_id")

    name = kwargs.get("name")
    enabled = kwargs.get("enabled")
    crud_operations = kwargs.get("crud_operations")
    crud_operation_format = kwargs.get("crud_operation_format")
    requires_auth = kwargs.get("requires_auth")
    items_per_page = kwargs.get("items_per_page")
    auto_detect_media_type = kwargs.get("auto_detect_media_type")
    row_user_ownership_enforced = kwargs.get("row_user_ownership_enforced")
    row_user_ownership_column = kwargs.get("row_user_ownership_column")
    comments = kwargs.get("comments")
    media_type = kwargs.get("media_type")
    auth_stored_procedure = kwargs.get("auth_stored_procedure")
    options = kwargs.get("options")
    parameters = kwargs.get("parameters")

    session = kwargs.get("session")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)

    try:
        session = core.get_current_session_with_rds_metadata(session)

        # The list of db_objects to be changed
        db_object_ids = [db_object_id] if db_object_id else []
        include_enable_state = None

        schema = mrs_schemas.get_schema(
            schema_id=schema_id, session=session, interactive=interactive,
            return_formatted=False)

        schema_id = schema.get("id")

        if not db_object_id:
            if not db_object_name and not request_path and interactive:
                db_objects = get_db_objects(
                    schema_id=schema_id,
                    include_enable_state=include_enable_state,
                    session=session, interactive=False)
                caption = ("Please select a db_object index, type "
                           "the request_path or type '*' "
                           "to select all: ")
                selection = core.prompt_for_list_item(
                    item_list=db_objects,
                    prompt_caption=caption,
                    item_name_property="request_path",
                    given_value=None,
                    print_list=True,
                    allow_multi_select=True)
                if not selection:
                    raise ValueError("Operation cancelled.")

                db_object_ids = [item["id"] for item in selection]

            if db_object_name:
                # Lookup the db_object name
                res = session.run_sql(
                    """
                    SELECT id FROM mysql_rest_service_metadata.db_object
                    WHERE name = ? AND schema_id = ?
                    """,
                    [db_object_name, schema_id])
                rows = res.fetch_all()
                if rows:
                    for row in rows:
                        db_object_ids.append(row.get_field("id"))

            if request_path:
                res = session.run_sql(
                    """
                    SELECT id FROM mysql_rest_service_metadata.db_object
                    WHERE request_path = ? AND schema_id = ?
                    """,
                    [request_path, schema_id])
                row = res.fetch_one()
                if row:
                    db_object_ids.append(row.get_field("id"))

        if len(db_object_ids) == 0:
            raise ValueError("The specified db_object was not found.")

        # Update all given services
        for db_object_id in db_object_ids:
            params = []
            if change_type == DB_OBJECT_DISABLE:
                sql = """
                    UPDATE mysql_rest_service_metadata.db_object
                    SET enabled = FALSE
                    WHERE id = ?
                    """
                params.append(db_object_id)
            elif change_type == DB_OBJECT_ENABLE:
                sql = """
                    UPDATE mysql_rest_service_metadata.db_object
                    SET enabled = TRUE
                    WHERE id = ?
                    """
                params.append(db_object_id)
            elif change_type == DB_OBJECT_DELETE:
                sql = """
                    DELETE FROM mysql_rest_service_metadata.db_object
                    WHERE id = ?
                    """
                params.append(db_object_id)
            elif change_type == DB_OBJECT_SET_ALL:
                # Not checking optional parameters
                validate_value(name, "name")
                validate_value(request_path, "request_path")
                validate_value(enabled, "enabled")
                validate_value(crud_operations, "crud_operations")
                validate_value(crud_operation_format, "crud_operation_format")
                validate_value(auto_detect_media_type,
                               "auto_detect_media_type")
                validate_value(requires_auth, "requires_auth")
                validate_value(row_user_ownership_enforced,
                               "row_user_ownership_enforced")
                validate_value(schema_id, "db_schema_id")

                sql = """
                        UPDATE mysql_rest_service_metadata.db_object
                        SET name=?,
                            request_path = ?,
                            enabled = ?,
                            items_per_page = ?,
                            crud_operations = ?,
                            format = ?,
                            media_type = ?,
                            auto_detect_media_type = ?,
                            requires_auth = ?,
                            auth_stored_procedure = ?,
                            row_user_ownership_enforced = ?,
                            row_user_ownership_column = ?,
                            comments = ?,
                            options = ?,
                            db_schema_id = ?
                        WHERE id = ?
                """
                print(f"crud_operations: {crud_operations}")
                params.append(name if name else "")
                params.append(request_path
                              if request_path else "")
                params.append(enabled
                              if enabled is not None else 1)
                params.append(items_per_page)
                params.append(",".join(crud_operations)
                              if crud_operations else "")
                params.append(crud_operation_format
                              if crud_operation_format else "FEED")
                params.append(media_type)
                params.append(auto_detect_media_type
                              if auto_detect_media_type is not None else 0)
                params.append(requires_auth
                              if requires_auth is not None else 0)
                params.append(auth_stored_procedure
                              if auth_stored_procedure else '0')
                params.append(row_user_ownership_enforced
                              if row_user_ownership_enforced is not None else 0)
                params.append(row_user_ownership_column)
                params.append(comments)
                params.append(options)
                params.append(schema_id)

                params.append(db_object_id)

            else:
                raise Exception("Operation not supported")

            res = session.run_sql(sql, params)
            if res.affected_items_count != 1 and change_type != DB_OBJECT_SET_ALL:
                raise Exception(
                    f"The specified db_object with id {db_object_id} was not "
                    "updated.")

        # Synchronize the parameters
        if parameters:
            parameters = json.loads(parameters)

            session.run_sql("START TRANSACTION")
            try:
                session.run_sql("""
                    DELETE FROM `mysql_rest_service_metadata`.`parameter`
                    WHERE db_object_id = ?
                    """, [db_object_id])

                for param in parameters:
                    # If there is a negative id, it's a new column
                    res = session.run_sql("""
                        INSERT INTO `mysql_rest_service_metadata`.`parameter` (
                            `id`, `db_object_id`, `position`, `name`,
                        `bind_column_name`, `param_datatype`, `mode`, `comments`)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                    """, [param.get("id") if param.get("id") > 0 else None,
                          db_object_id, param.get(
                              "position"), param.get("name"),
                          param.get("bindColumnName"), param.get("datatype"),
                          param.get("mode"), param.get("comments")])

                session.run_sql("COMMIT")
            except Exception as e:
                session.run_sql("ROLLBACK")
                raise

        if len(db_object_ids) == 1:
            msg = "The db_object has been "
        else:
            msg = "The db_objects have been "

        if change_type == DB_OBJECT_DISABLE:
            msg += "disabled."
        if change_type == DB_OBJECT_ENABLE:
            msg += "enabled."
        elif change_type == DB_OBJECT_DELETE:
            msg += "deleted."
        elif change_type == DB_OBJECT_SET_ALL:
            msg += "updated."

        return msg

    except Exception as e:
        if not raise_exceptions:
            print(f"Error: {str(e)}")
        else:
            raise
