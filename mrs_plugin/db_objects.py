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

from mysqlsh.plugin_manager import plugin_function
from mrs_plugin import core, schemas as mrs_schemas

# db_object operations
DB_OBJECT_DISABLE = 1
DB_OBJECT_ENABLE = 2
DB_OBJECT_DELETE = 3


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
        crud_operations (list): The allowed CRUD operations for the object
        crud_operation_format (str): The format to use for the CRUD operation
        requires_auth (bool): Whether authentication is required to access
            the schema
        items_per_page (int): The number of items returned per page
        row_user_ownership_enforced (bool): Enable row ownership enforcement
        row_user_ownership_column (str): The column for row ownership enforcement
        comments (str): Comments for the schema
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised
        return_formatted (bool): If true a human readable string is returned
        return_python_object (bool): Used for internal plugin calls

    Returns:
        None
    """

    db_object_name = kwargs.get("db_object_name")
    db_object_type = kwargs.get("db_object_type")
    schema_id = kwargs.get("schema_id")
    schema_name = kwargs.get("schema_name")
    auto_add_schema = kwargs.get("auto_add_schema", False)

    request_path = kwargs.get("request_path")
    crud_operations = kwargs.get("crud_operations")
    crud_operation_format = kwargs.get("crud_operation_format")
    requires_auth = kwargs.get("requires_auth")
    items_per_page = kwargs.get("items_per_page")
    row_user_ownership_enforced = kwargs.get("row_user_ownership_enforced")
    row_user_ownership_column = kwargs.get("row_user_ownership_column")
    comments = kwargs.get("comments")
    session = kwargs.get("session")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)
    return_python_object = kwargs.get("return_python_object", False)

    if crud_operations:
        crud_operations = list(crud_operations)

    try:
        session = core.get_current_session(session)

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
            raise Exception("The request_path has to start with '/'.")

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
                             "Operation chancelled.")

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
                             "Operation chancelled.")

        if type(crud_operations) != list:
            raise ValueError("The crud_operations need to be specified as "
                             "list. Operation chancelled.")

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
                    "Should row ownership be prequired when querying the "
                    "object [y/N]: ",
                    {'defaultValue': 'n'}).strip().lower() == 'y'
            else:
                row_user_ownership_enforced = False

        if row_user_ownership_enforced and not row_user_ownership_column:
            if interactive:
                if db_object_type == "PROCEDURE":
                    # TODO: Give the user the list of params to choose from
                    row_user_ownership_column = core.prompt(
                        "Which procedure parameter should be used for "
                        "row ownership checks: ").strip()
                else:
                    # TODO: Give the user the list of columns to choose from
                    row_user_ownership_column = core.prompt(
                        "Which column should be used for row ownership "
                        "checks: ").strip()
                if not row_user_ownership_column or row_user_ownership_column == "":
                    raise ValueError('Operation chancelled.')

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
                                             "Operation chancelled.")
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
                db_schema_id, name, request_path,
                object_type, items_per_page, requires_auth,
                row_user_ownership_enforced, row_user_ownership_column,
                crud_operation, format,
                comments)
            VALUES(?, ?, ?,
                ?, ?, ?,
                ?,?,?,?,?)
            """

        res = session.run_sql(
            sql,
            [schema.get("id"), db_object_name, request_path,
             db_object_type, items_per_page,
             1 if requires_auth else 0,
             1 if row_user_ownership_enforced else 0, row_user_ownership_column,
             ",".join(crud_operations), crud_operation_format,
             comments])
        db_object_id = res.auto_increment_value


        # Grant privilege to the 'mrs_provider_data_access' role
        if grant_privs:
            grant_privs = grant_privs[0:-2]
        else:
            raise ValueError("No valid CRUD Operation specified")

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
    interactive = kwargs.get("interactive", True)

    try:
        session = core.get_current_session(session)

        # Make sure the MRS metadata schema exists and has the right version
        core.ensure_rds_metadata_schema(session)

        schema = mrs_schemas.get_schema(
            schema_id=schema_id, session=session, interactive=interactive,
            return_formatted=False)
        if not schema:
            return

        # If there are no selective parameters given
        if (not request_path and not db_object_name and not db_object_id
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
        sql = """
            SELECT o.id, o.db_schema_id, o.name, o.request_path,
                o.requires_auth, o.enabled, o.object_type,
                o.items_per_page, o.row_user_ownership_enforced,
                o.row_user_ownership_column, o.comments,
                sc.request_path AS schema_request_path,
                CONCAT(h.name, se.url_context_root) AS host_ctx,
                o.crud_operation,
                MAX(al.changed_at) as changed_at
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
            WHERE o.db_schema_id = ?
            """
        params = [schema.get("id")]
        if request_path:
            sql += "AND o.request_path = ? "
            params.append(request_path)
        if db_object_name:
            sql += "AND o.name = ? "
            params.append(db_object_name)
        if db_object_id:
            sql += "AND o.id = ? "
            params.append(db_object_id)

        sql += "GROUP BY o.id"

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

    i = 0
    for item in db_objects:
        i += 1
        path = (item['host_ctx'] + item['schema_request_path'] +
                item['request_path'])
        # Shorten the list of CRUD operation names to just the first characters
        crud = ''.join([o[0] for o in item['crud_operations'].split(',')]) \
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
def get_db_objects(schema_id, **kwargs):
    """Returns all db_objects for the given schema

    Args:
        schema_id (int): The id of the schema to list the db_objects from
        **kwargs: Additional options

    Keyword Args:
        include_enable_state (bool): Only include db_objects with the given
            enabled state
        session (object): The database session to use
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised
        return_formatted (bool): If set to true, a list object is returned

    Returns:
        A list of dicts representing the db_objects of the schema
    """

    include_enable_state = kwargs.get("include_enable_state")
    session = kwargs.get("session")
    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)

    try:
        session = core.get_current_session(session)

        sql = """
            SELECT o.id, o.db_schema_id, o.name, o.request_path,
                o.requires_auth, o.enabled, o.object_type,
                o.items_per_page, o.row_user_ownership_enforced,
                o.row_user_ownership_column,
                o.comments, sc.request_path AS schema_request_path,
                CONCAT(h.name, se.url_context_root) AS host_ctx,
                o.crud_operation as crud_operations,
                MAX(al.changed_at) as changed_at
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
            WHERE o.db_schema_id = ?
            """
        if include_enable_state is not None:
            sql += ("AND o.enabled = "
                    f"{'TRUE' if include_enable_state else 'FALSE'} ")

        sql += "GROUP BY o.id"

        res = session.run_sql(sql, [schema_id])

        db_objects = core.get_sql_result_as_dict_list(res)

        if return_formatted:
            return format_db_object_listing(db_objects, print_header=True)
        else:
            return db_objects

    except Exception as e:
        if raise_exceptions:
            raise
        print(f"Error: {str(e)}")


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
    interactive = kwargs.get("interactive", True)

    try:
        session = core.get_current_session(session)

        # Make sure the MRS metadata schema exists and has the right version
        core.ensure_rds_metadata_schema(session)

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
        if res.get_affected_row_count() != 1:
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
    interactive = kwargs.get("interactive", True)

    try:
        session = core.get_current_session(session)

        # Make sure the MRS metadata schema exists and has the right version
        core.ensure_rds_metadata_schema(session)

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
                             "Operation chancelled.")

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
                             "Operation chancelled.")

        if type(crud_operations) != list:
            raise ValueError("The crud_operations need to be specified as "
                             "list. Operation chancelled.")

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
                SET crud_operation = ?, format = ?
                WHERE id = ?
                """, [",".join(crud_operations), crud_operation_format, db_object.get("id")])
        if res.get_affected_row_count() != 1:
            raise Exception(f"Could not update crud operations for the db_object {db_object.get('name')}.")

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
    interactive = kwargs.get("interactive", True)

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
    interactive = kwargs.get("interactive", True)

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
    interactive = kwargs.get("interactive", True)

    return change_db_object(change_type=DB_OBJECT_DELETE,
                            db_object_name=db_object_name,
                            schema_id=schema_id,
                            db_object_id=db_object_id,
                            session=session,
                            interactive=interactive)


def change_db_object(change_type=None, db_object_name=None, request_path=None,
                     schema_id=None, **kwargs):
    """Makes a given change to a MRS service

    Args:
        change_type (int): Type of change
        db_object_name (str): The name of the db_object
        request_path (str): The request_path of the db_object
        schema_id (int): The id of the schema
        **kwargs: Additional options

    Keyword Args:
        db_object_id (int): The id of the db_object
        session (object): The database session to use
        interactive (bool): Indicates whether to execute in interactive mode

    Returns:
        The result message as string
    """

    db_object_id = kwargs.get("db_object_id")
    session = kwargs.get("session")
    interactive = kwargs.get("interactive", True)

    try:
        session = core.get_current_session(session)

        # Make sure the MRS metadata schema exists and has the right version
        core.ensure_rds_metadata_schema(session)

        # The list of db_objects to be changed
        db_object_ids = [db_object_id] if db_object_id else []
        include_enable_state = None

        schema = mrs_schemas.get_schema(
            schema_id=schema_id, session=session, interactive=interactive,
            return_formatted=False)

        if not db_object_id:
            if not db_object_name and not request_path and interactive:
                db_objects = get_db_objects(
                    schema_id=schema.get("id"),
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
                    [db_object_name, schema.get("id")])
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
                    [request_path, schema.get("id")])
                row = res.fetch_one()
                if row:
                    db_object_ids.append(row.get_field("id"))

        if len(db_object_ids) == 0:
            raise ValueError("The specified db_object was not found.")

        # Update all given services
        for db_object_id in db_object_ids:
            if change_type == DB_OBJECT_DISABLE:
                sql = """
                    UPDATE mysql_rest_service_metadata.db_object
                    SET enabled = FALSE
                    WHERE id = ?
                    """
            elif change_type == DB_OBJECT_ENABLE:
                sql = """
                    UPDATE mysql_rest_service_metadata.db_object
                    SET enabled = TRUE
                    WHERE id = ?
                    """
            elif change_type == DB_OBJECT_DELETE:
                sql = """
                    DELETE FROM mysql_rest_service_metadata.db_object
                    WHERE id = ?
                    """
            else:
                raise Exception("Operation not supported")

            res = session.run_sql(sql, [db_object_id])
            if res.get_affected_row_count() != 1:
                raise Exception(
                    f"The specified db_object with id {db_object_id} was not "
                    "found.")

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

        return msg

    except Exception as e:
        if interactive:
            print(f"Error: {str(e)}")
        else:
            raise
