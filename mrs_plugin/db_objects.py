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

"""Sub-Module for managing MRS schemas"""

# cSpell:ignore mysqlsh, mrs, privs


from mysqlsh.plugin_manager import plugin_function
import mrs_plugin.lib as lib
from .interactive import resolve_schema



def resolve_db_object_ids(db_object_name=None, schema_id=None, request_path=None, **kwargs):
    session = kwargs.get("session")

    db_object_id = kwargs.pop("db_object_id", None)

    kwargs["db_object_ids"] = [db_object_id] if db_object_id is not None else []

    if not db_object_id:
        schema = resolve_schema(session, schema_id)
        schema_id = schema.get("id")

        if db_object_name:
            # Lookup the db_object name
            rows = lib.core.select(table="db_object", cols="id", where=["name=?", "db_schema_id=?"]
            ).exec(session, [db_object_name, schema_id]).items

            for row in rows:
                kwargs["db_object_ids"].append(row["id"])
        elif lib.core.get_interactive_default():
            db_objects = lib.db_objects.get_db_objects(
                session=session,
                schema_id=schema_id,
                include_enable_state=None
                )
            caption = ("Please select a db_object index, type "
                        "the request_path or type '*' "
                        "to select all: ")
            selection = lib.core.prompt_for_list_item(
                item_list=db_objects,
                prompt_caption=caption,
                item_name_property="request_path",
                given_value=None,
                print_list=True,
                allow_multi_select=True)
            if not selection:
                raise ValueError("Operation cancelled.")

            kwargs["db_object_ids"] = [item["id"] for item in selection]


    return kwargs


@plugin_function('mrs.add.dbObject', shell=True, cli=True, web=True)
def add_db_object(**kwargs):
    """Add a db_object to the given MRS service schema

    Args:
        **kwargs: Additional options

    Keyword Args:
        db_object_name (str): The name of the schema object add
        db_object_type (str): Either TABLE, VIEW or PROCEDURE
        schema_id (str): The id of the schema the object should be added to
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
        options (dict,required): The options of this db object
        fields (list): The fields definition in JSON format
        session (object): The database session to use.

    Allowed options for fields:
        id (int,optional): The id of the fields or a negative value when it is a new field
        db_object_id (str,optional): The id of the corresponding db object
        position (int): The position of the field;
        name (str): The name of the field;
        bind_field_name (str): The column name of the TABLE or VIEW or field name the PROCEDURE
            this field maps to
        datatype (str): The datatype, 'STRING', 'INT', 'DOUBLE', 'BOOLEAN', 'LONG', 'TIMESTAMP', 'JSON'
        mode (str): The field mode, "IN", "OUT", "INOUT"
        comments (str,optional): The comments for the field

    Returns:
        None
    """
    lib.core.convert_ids_to_binary(["schema_id"], kwargs)

    if kwargs.get("request_path") is not None:
        lib.core.Validations.request_path(kwargs.get("request_path"))

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

    fields = kwargs.get("fields")

    session = kwargs.get("session")

    interactive = lib.core.get_interactive_default()

    if crud_operations:
        crud_operations = list(crud_operations)

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        kwargs["session"] = session

        with lib.core.MrsDbTransaction(session):
            schema = None
            # If auto_add_schema is set, check if the schema is registered already.
            # If not, create it
            if auto_add_schema and schema_name and not schema_id:
                try:
                    schema = lib.schemas.get_schema(
                        schema_name=schema_name,
                        session=session)

                    schema_id = schema.get("id")
                except:
                    schema_id = lib.schemas.add_schema(schema_name=schema_name,
                        request_path=f"/{schema_name}",
                        requires_auth=True if requires_auth else False,
                        session=session)

            schema = resolve_schema(session, schema_id)

            if not db_object_type and interactive:
                # Get object counts per type
                row = lib.core.select(table="INFORMATION_SCHEMA.TABLES", cols="COUNT(*) AS table_count",
                    where=["TABLE_SCHEMA=?", "TABLE_TYPE='BASE TABLE'"]
                ).exec(session, [schema.get("name")]).first
                table_count = int(row["table_count"]) if row else 0

                row = lib.core.select(table="INFORMATION_SCHEMA.TABLES",
                    cols="COUNT(*) AS view_count",
                    where=["TABLE_SCHEMA=?", "(TABLE_TYPE = 'VIEW' OR TABLE_TYPE = 'SYSTEM VIEW')"]
                ).exec(session, [schema.get("name")]).first
                view_count = int(row["view_count"]) if row else 0

                row = lib.core.select(table="INFORMATION_SCHEMA.ROUTINES",
                    cols="COUNT(*) AS proc_count",
                    where=["ROUTINE_SCHEMA=?", "ROUTINE_TYPE='PROCEDURE'"]
                ).exec(session, [schema.get("name")]).first
                proc_count = int(row["proc_count"]) if row else 0

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
                db_object_type = lib.core.prompt_for_list_item(
                    item_list=db_object_types,
                    prompt_caption=caption,
                    prompt_default_value="TABLE" if table_count > 0 else None,
                    print_list=True)

                if not db_object_type:
                    raise ValueError('Operation cancelled.')

            if not db_object_name and interactive:
                if db_object_type == "TABLE":
                    sql = lib.core.select(table="INFORMATION_SCHEMA.TABLES", cols="TABLE_NAME AS OBJECT_NAME",
                        where=["TABLE_SCHEMA=? /*=sakila*/", "TABLE_TYPE = 'BASE TABLE'"],
                        order="TABLE_NAME")
                elif db_object_type == "VIEW":
                    sql = lib.core.select(table="INFORMATION_SCHEMA.TABLES", cols="TABLE_NAME AS OBJECT_NAME",
                        where=["TABLE_SCHEMA=? /*=sakila*/", "(TABLE_TYPE='VIEW' OR TABLE_TYPE='SYSTEM VIEW')"],
                        order="TABLE_NAME")
                else:
                    sql = lib.core.select(table="INFORMATION_SCHEMA.ROUTINES", cols="ROUTINE_NAME AS OBJECT_NAME",
                        where=["ROUTINE_SCHEMA=? /*=sakila*/", "ROUTINE_TYPE='PROCEDURE'"],
                        order="ROUTINE_NAME")

                db_objects = sql.exec(session, [schema.get("name")]).items

                if len(db_objects) == 0:
                    raise ValueError(
                        f"No database objects of type {db_object_type} in the "
                        f"database schema {schema.get('name')}")

                db_object_name = lib.core.prompt_for_list_item(
                    item_list=[db_object["OBJECT_NAME"] for db_object in db_objects],
                    prompt_caption=("Please enter the name or index of a "
                                    "database object: "),
                    print_list=True)

                if not db_object_name:
                    raise ValueError('Operation cancelled.')
            # If a schema name has been provided, check if that schema exists
            elif db_object_name and db_object_type:

                if db_object_type == "TABLE":
                    sql = lib.core.select(table="INFORMATION_SCHEMA.TABLES", cols="TABLE_NAME AS OBJECT_NAME",
                        where=["TABLE_SCHEMA=?", "TABLE_TYPE='BASE TABLE'", "TABLE_NAME=?"]
                    )
                elif db_object_type == "VIEW":
                    sql = lib.core.select(table="INFORMATION_SCHEMA.TABLES", cols="TABLE_NAME AS OBJECT_NAME",
                        where=["TABLE_SCHEMA=?", "(TABLE_TYPE='VIEW' OR TABLE_TYPE='SYSTEM VIEW')", "TABLE_NAME=?"]
                    )
                elif db_object_type == "PROCEDURE":
                    sql = lib.core.select(table="INFORMATION_SCHEMA.ROUTINES", cols="ROUTINE_NAME AS OBJECT_NAME",
                        where=["ROUTINE_SCHEMA=?", "ROUTINE_TYPE='PROCEDURE'", "ROUTINE_NAME=?"]
                    )
                else:
                    raise ValueError('Invalid db_object_type. Only valid types are '
                                    'TABLE, VIEW and PROCEDURE.')

                row = sql.exec(session, [schema.get("name"), db_object_name]).first

                if row:
                    db_object_name = row["OBJECT_NAME"]
                else:
                    raise ValueError(
                        f"The {db_object_type} named '{db_object_name}' "
                        f"does not exists in database schema {schema.get('name')}.")

            # Get request_path
            if not request_path:
                if interactive:
                    request_path = lib.core.prompt(
                        "Please enter the request path for this object ["
                        f"/{db_object_name}]: ",
                        {'defaultValue': '/' + db_object_name}).strip()
                else:
                    request_path = '/' + db_object_name

            if not request_path.startswith('/'):
                raise Exception("The request_path has to start with '/'.")


            # Check if the request_path starts with / and is unique for the schema
            lib.core.check_request_path(session, schema["host_ctx"] + schema['request_path'] + request_path)

            # Get crud_operations
            if not crud_operations and interactive:
                crud_operation_options = [
                    'CREATE',
                    'READ',
                    'UPDATE',
                    'DELETE']
                crud_operations = lib.core.prompt_for_list_item(
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
                crud_operation_format = lib.core.prompt_for_list_item(
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
            if requires_auth is None:
                if interactive:
                    requires_auth = lib.core.prompt(
                        "Should the db_object require authentication [y/N]: ",
                        {'defaultValue': 'n'}).strip().lower() == 'y'
                else:
                    requires_auth = False

            # Get row_user_ownership_enforced
            if row_user_ownership_enforced is None:
                if interactive:
                    row_user_ownership_enforced = lib.core.prompt(
                        "Should row ownership be required when querying the "
                        "object [y/N]: ",
                        {'defaultValue': 'n'}).strip().lower() == 'y'
                else:
                    row_user_ownership_enforced = False

            if row_user_ownership_enforced and row_user_ownership_column is None:
                if interactive:
                    available_fields = lib.db_objects.get_available_db_object_row_ownership_fields(
                        session,
                        schema_name=schema["name"],
                        db_object_name=db_object_name,
                        db_object_type=db_object_type)
                    if len(available_fields) < 1:
                        raise ValueError(
                            "No IN parameters available for this procedure.")

                    print("List of available fields:")
                    row_user_ownership_column = lib.core.prompt_for_list_item(
                        item_list=available_fields, prompt_caption="Which "
                        + ("parameter" if db_object_type == "PROCEDURE" else "column")
                        + " should be used for row ownership checks",
                        print_list=True)

            # Get items_per_page
            if items_per_page is None:
                if interactive:
                    items_per_page = lib.core.prompt(
                        "How many items should be listed per page "
                        "[Schema Default]: ",
                        {'defaultValue': "25"}).strip()
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
            if comments is None:
                if interactive:
                    comments = lib.core.prompt(
                        "Comments: ").strip()
                else:
                    comments = ""

            db_object_id = lib.db_objects.add_db_object(session=session, schema_id=schema.get("id"),
                db_object_name=db_object_name, request_path=request_path, enabled=enabled,
                db_object_type=db_object_type,
                items_per_page=items_per_page, requires_auth=requires_auth,
                row_user_ownership_enforced=row_user_ownership_enforced,
                row_user_ownership_column=row_user_ownership_column,
                crud_operations=crud_operations, crud_operation_format=crud_operation_format,
                comments=comments, media_type=media_type, auto_detect_media_type=auto_detect_media_type,
                auth_stored_procedure=auth_stored_procedure, options=options, fields=fields)

            if lib.core.get_interactive_result():
                return "\n" + "Object added successfully."

            return db_object_id


@plugin_function('mrs.get.dbObject', shell=True, cli=True, web=True)
def get_db_object(request_path=None, db_object_name=None, **kwargs):
    """Gets a specific MRS db_object

    Args:
        request_path (str): The request_path of the schema
        db_object_name (str): The name of the schema
        **kwargs: Additional options

    Keyword Args:
        db_object_id (str): The id of the db_object
        schema_id (str): The id of the schema
        schema_name (int): The name of the schema
        session (object): The database session to use.

    Returns:
        The db_object as dict
    """
    lib.core.convert_ids_to_binary(["schema_id", "db_object_id"], kwargs)

    if request_path is not None:
        lib.core.Validations.request_path(request_path)

    db_object_id = kwargs.get("db_object_id")
    schema_id = kwargs.get("schema_id")

    schema_name = kwargs.get("schema_name")

    interactive = lib.core.get_interactive_default()

    schema = None

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:

        if db_object_id:
            return lib.db_objects.get_db_object(session=session, db_object_id=db_object_id)

        if schema_id:
            schema = lib.schemas.get_schema(schema_id=schema_id, session=session)
        elif schema_name:
            schema = lib.schemas.get_schema(schema_name=schema_name, session=session)
        elif interactive:
            rows = lib.core.select(table="INFORMATION_SCHEMA.SCHEMATA",
                cols="SCHEMA_NAME",
                where=["SCHEMA_NAME NOT LIKE ?", "SCHEMA_NAME NOT LIKE ?", "SCHEMA_NAME <> ?"]
            ).exec(session, params=['.%', 'mysql_%', 'mysql']).items

            schemas = [row["SCHEMA_NAME"] for row in rows]

            if schemas is None or len(schemas) == 0:
                raise ValueError('No database schemas available.')

            schema_name = lib.core.prompt_for_list_item(
                item_list=schemas,
                prompt_caption='Please enter the name or index of a schema: ',
                print_list=True)
            schema = lib.schemas.get_schema(schema_name=schema_name, session=session)

        if not schema:
            raise ValueError("Unable to find the schema.")

        if request_path:
            return lib.db_objects.get_db_object(session=session, schema_id=schema.get("id"),
                request_path=request_path)

        if db_object_name:
            return lib.db_objects.get_db_object(session=session, schema_id=schema.get("id"),
                db_object_name=db_object_name)

        if interactive:
            schema_id = schema.get("id")
            db_objects = lib.db_objects.get_db_objects(
                session=session, schema_id=schema.get("id"))
            print(f"DB Object Listing for Schema "
                  f"{schema.get('host_ctx')}"
                  f"{schema.get('request_path')}")
            item = lib.core.prompt_for_list_item(
                item_list=db_objects,
                prompt_caption=("Please select a db_object index or type "
                                "the request_path: "),
                item_name_property="request_path",
                print_list=True)

            if not item:
                raise ValueError("Operation cancelled.")

        if not request_path and not db_object_name:
            raise ValueError("Unable to search DB object.")

        return lib.db_objects.get_db_object(session=session, schema_id=schema.get("id"),
            request_path=request_path)


@plugin_function('mrs.get.dbObjectRowOwnershipFields', shell=True, cli=True, web=True)
def get_db_object_row_ownership_fields(**kwargs):
    """Gets the list of available row ownership fields for the given db_object

    Args:
        **kwargs: Additional options

    Keyword Args:
        db_object_id (str): The id of the db_object
        schema_id (str): The id of the schema
        schema_name (str): The name of the schema
        request_path (str): The request_path of the schema
        db_object_name (str): The name of the db_object
        db_object_type (str): The type of the db_object (TABLE, VIEW, PROCEDURE)
        session (object): The database session to use.

    Returns:
        The list of available row ownership fields names
    """
    lib.core.convert_ids_to_binary(["schema_id", "db_object_id"], kwargs)

    if kwargs.get("request_path") is not None:
        lib.core.Validations.request_path(kwargs.get("request_path"))

    db_object_id = kwargs.get("db_object_id")
    schema_id = kwargs.get("schema_id")

    request_path = kwargs.get("request_path")
    db_object_name = kwargs.get("db_object_name")
    schema_name = kwargs.get("schema_name")
    db_object_type = kwargs.get("db_object_type")

    if not db_object_id:
        db_object_id = None

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        if db_object_type not in ["TABLE", "VIEW", "PROCEDURE"]:
            raise ValueError(
                "The object_type must be either set to TABLE, VIEW or PROCEDURE.")

        schema = lib.schemas.get_schema(schema_id=schema_id, schema_name=schema_name, session=session)
        if schema:
            schema_id = schema.get("id")
            schema_name = schema.get("name")

        db_object = lib.db_objects.get_db_object(session=session, schema_id=schema_id,
                                                db_object_id=db_object_id,
                                                request_path=request_path,
                                                db_object_name=db_object_name)

        if db_object:
            return lib.db_objects.get_db_object_row_ownership_fields(session, db_object["id"])

        return lib.db_objects.get_available_db_object_row_ownership_fields(session,
                                                                            schema_name,
                                                                            db_object_name,
                                                                            db_object_type)



@plugin_function('mrs.list.dbObjects', shell=True, cli=True, web=True)
def get_db_objects(**kwargs):
    """Returns all db_objects for the given schema

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_id (str): The id of the schema to list the db_objects from
        include_enable_state (bool): Only include db_objects with the given
            enabled state
        session (object): The database session to use

    Returns:
        A list of dicts representing the db_objects of the schema
    """
    lib.core.convert_ids_to_binary(["schema_id"], kwargs)

    schema_id = kwargs.get("schema_id")

    include_enable_state = kwargs.get("include_enable_state")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        db_objects = lib.db_objects.get_db_objects(session=session, schema_id=schema_id,
            include_enable_state=include_enable_state)

        if lib.core.get_interactive_result():
            return lib.db_objects.format_db_object_listing(db_objects, print_header=True)
        else:
            return db_objects


@plugin_function('mrs.get.dbObjectSelectedFields', shell=True, cli=True, web=True)
def get_db_object_selected_fields(request_path=None, db_object_name=None, **kwargs):
    """Gets the list of selected fields for the given db_object

    Args:
        request_path (str): The request_path of the schema
        db_object_name (str): The name of the db_object
        **kwargs: Additional options

    Keyword Args:
        db_object_id (str): The id of the db_object
        schema_id (str): The id of the schema
        schema_name (str): The name of the schema
        session (object): The database session to use.

    Returns:
        The list of db object parameters
    """
    lib.core.convert_ids_to_binary(["schema_id", "db_object_id"], kwargs)

    if request_path is not None:
        lib.core.Validations.request_path(request_path)

    db_object_id = kwargs.get("db_object_id")
    schema_id = kwargs.get("schema_id")

    session = kwargs.get("session")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        if not db_object_id:
            db_object = lib.db_objects.get_db_object(request_path=request_path,
                                      db_object_name=db_object_name,
                                      schema_id=schema_id, session=session)
            db_object_id = db_object["id"]

        if not db_object_id:
            raise ValueError(
                "The given DB Object could not be found.")

        results = lib.core.select(table="field",
            where="db_object_id=?",
            order="id, position"
        ).exec(session, [db_object_id]).items

        return results



@plugin_function('mrs.get.dbObjectFields', shell=True, cli=True, web=True)
def get_db_object_fields(db_object_id=None, schema_id=None,
    request_path=None, db_object_name=None, **kwargs):
    """Gets the list of available row ownership fields for the given db_object

    Args:
        db_object_id (int): The id of the db_object
        schema_id (int): The id of the schema
        request_path (str): The request_path of the schema
        db_object_name (str): The name of the db_object
        **kwargs: Additional options

    Keyword Args:
        schema_name (str): The name of the schema
        db_object_type (str): The type of the db_object (TABLE, VIEW, PROCEDURE)
        session (object): The database session to use.

    Returns:
        The list of available db object fields
    """
    if db_object_id is not None:
        db_object_id = lib.core.id_to_binary(db_object_id, "db_object_id")
    if schema_id is not None:
        schema_id = lib.core.id_to_binary(schema_id, "schema_id")

    if request_path is not None:
        lib.core.Validations.request_path(request_path)

    schema_name = kwargs.get("schema_name")
    db_object_type = kwargs.get("db_object_type")

    # Guarantee we have upper case type
    if db_object_type:
        db_object_type = db_object_type.upper()

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        if db_object_id:
            return lib.db_objects.get_db_object_fields(session, db_object_id)

        if schema_id:
            schema = lib.schemas.get_schema(session, schema_id=schema_id)
            schema_name = schema.get("name")
        else:
            if not schema_name:
                raise Exception("You must supply the schema name.")

        return lib.db_objects.get_db_object_fields(session,
            schema_name=schema_name,
            db_object_name=db_object_name,
            db_object_type=db_object_type)


@plugin_function('mrs.set.dbObject.requestPath', shell=True, cli=True, web=True)
def set_request_path(db_object_id=None, request_path=None, **kwargs):
    """Sets the request_path of the given db_object

    Args:
        db_object_id (str): The id of the schema to list the db_objects from
        request_path (str): The request_path that should be set
        **kwargs: Additional options

    Keyword Args:
        session (object): The database session to use

    Returns:
        None
    """
    if db_object_id is not None:
        db_object_id = lib.core.id_to_binary(db_object_id, "db_object_id")

    if request_path is not None:
        lib.core.Validations.request_path(request_path)

    interactive = lib.core.get_interactive_default()

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        kwargs["session"] = session

        # Get the object with the given id or let the user select it
        db_object = lib.db_objects.get_db_object(session=session, db_object_id=db_object_id)

        if not db_object:
            return

        if not request_path and interactive:
            request_path = lib.core.prompt(
                "Please enter a new request_path "
                f"for the db_object {db_object.get('name')} "
                f"[{db_object.get('request_path')}]: ",
                {"defaultValue": db_object.get('request_path')})

        if request_path == db_object.get('request_path'):
            if interactive:
                print("The request_path was left unchanged.")
                return

        # Ensure the new request_path is unique
        schema = lib.schemas.get_schema(
            schema_id=db_object.get("db_schema_id"),
            session=session)
        lib.core.check_request_path(session, schema["host_ctx"] + schema['request_path'] + request_path)

        res = lib.core.update(table="db_object", sets="request_path=?",
            where="id=?"
        ).exec(session, [request_path, db_object.get("id")])

        if not res.success:
            raise Exception("Could not update the db_object.")

        if lib.core.get_interactive_result():
            print(f"The db_object {db_object.get('name')} was updated "
                  "successfully.")
        return True
    return False



@plugin_function('mrs.set.dbObject.crudOperations', shell=True, cli=True, web=True)
def set_crud_operations(db_object_id=None, crud_operations=None,
                        crud_operation_format=None, **kwargs):
    """Sets the request_path of the given db_object

    Args:
        db_object_id (str): The id of the schema to list the db_objects from
        crud_operations (list,required): The allowed CRUD operations for the object
        crud_operation_format (str,required): The format to use for the CRUD operation
        **kwargs: Additional options

    Keyword Args:
        session (object): The database session to use

    Returns:
        None
    """
    if db_object_id is not None:
        db_object_id = lib.core.id_to_binary(db_object_id, "db_object_id")

    interactive = lib.core.get_interactive_default()

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        # Get crud_operations
        if not crud_operations and interactive:
            crud_operation_options = [
                'CREATE',
                'READ',
                'UPDATE',
                'DELETE']
            crud_operations = lib.core.prompt_for_list_item(
                item_list=crud_operation_options,
                prompt_caption=("Please select the CRUD operations that "
                                "should be supported, '*' for all: "),
                print_list=True,
                allow_multi_select=True)

        if not crud_operation_format and interactive:
            crud_operation_format_options = [
                'FEED',
                'ITEM',
                'MEDIA']
            crud_operation_format = lib.core.prompt_for_list_item(
                item_list=crud_operation_format_options,
                prompt_caption=("Please select the CRUD operation format "
                                "[FEED]: "),
                prompt_default_value="FEED",
                print_list=True)

        lib.db_objects.set_crud_operations(session=session, db_object_id=db_object_id,
            crud_operations=crud_operations, crud_operation_format=crud_operation_format)

        db_object = lib.db_objects.get_db_object(session, db_object_id=db_object_id)
        if lib.core.get_interactive_result():
            return f"The db_object {db_object.get('name')} was updated successfully."
        return db_object



@plugin_function('mrs.enable.dbObject', shell=True, cli=True, web=True)
def enable_db_object(db_object_name=None, schema_id=None,
                     **kwargs):
    """Enables a db_object of the given schema

    Args:
        db_object_name (str): The name of the db_object
        schema_id (str): The id of the schema
        **kwargs: Additional options

    Keyword Args:
        db_object_id (str,required): The id of the db_object
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    lib.core.convert_ids_to_binary(["schema_id", "db_object_id"], kwargs)

    kwargs["value"] =True

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        kwargs["session"] = session
        kwargs = resolve_db_object_ids(db_object_name, schema_id, **kwargs)

        with lib.core.MrsDbTransaction(session):
            lib.db_objects.enable_db_object(**kwargs)

        if lib.core.get_interactive_result():
            if len(kwargs["db_object_ids"]) == 1:
                return f"The db_object has been enabled."
            return f"The db_objects have been enabled."
        return True
    return False


@plugin_function('mrs.disable.dbObject', shell=True, cli=True, web=True)
def disable_db_object(db_object_name=None, schema_id=None, **kwargs):
    """Disables a db_object of the given service

    Args:
        db_object_name (str): The name of the db_object
        schema_id (str): The id of the schema
        **kwargs: Additional options

    Keyword Args:
        db_object_id (str,required): The id of the db_object
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    lib.core.convert_ids_to_binary(["db_object_id"], kwargs)

    if schema_id is not None:
        schema_id = lib.core.id_to_binary(schema_id, "schema_id")

    kwargs["value"] = False

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        kwargs["session"] = session
        kwargs = resolve_db_object_ids(db_object_name, schema_id, **kwargs)

        with lib.core.MrsDbTransaction(session):
            lib.db_objects.enable_db_object(**kwargs)

        if lib.core.get_interactive_result():
            if len(kwargs["db_object_ids"]) == 1:
                return f"The db_object has been disabled."
            return f"The db_objects have been disabled."
        return True
    return False


@plugin_function('mrs.delete.dbObject', shell=True, cli=True, web=True)
def delete_db_object(db_object_name=None, schema_id=None, **kwargs):
    """Deletes a schema of the given service

    Args:
        db_object_name (str): The name of the db_object
        schema_id (str): The id of the schema
        **kwargs: Additional options

    Keyword Args:
        db_object_id (str,required): The id of the db_object
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    lib.core.convert_ids_to_binary(["db_object_id"], kwargs)

    if schema_id is not None:
        schema_id = lib.core.id_to_binary(schema_id, "schema_id")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        kwargs["session"] = session
        kwargs = resolve_db_object_ids(db_object_name, schema_id, **kwargs)

        with lib.core.MrsDbTransaction(session):
            lib.db_objects.delete_db_object(**kwargs)

        if lib.core.get_interactive_result():
            if len(kwargs["db_object_ids"]) == 1:
                return f"The db_object has been deleted."
            return f"The db_objects have been deleted."
        return True
    return False


@plugin_function('mrs.update.dbObject', shell=True, cli=True, web=True)
def update_db_object(**kwargs):
    """Update a db_object

    Args:
        **kwargs: Additional options

    Keyword Args:
        db_object_id (str): The id of the db object
        db_object_name (str): The name of the schema object add
        schema_id (str): The id of the schema the object should be added to
        request_path (str): The request_path
        value (dict,required): The values to update
        session (object): The database session to use.

    Allowed options for value:
        name (str): The new name to apply to the database object
        enabled (bool): If the DB Object is enabled or not
        crud_operations (list): The allowed CRUD operations for the object
        crud_operation_format (str): The format to use for the CRUD operation
        requires_auth (bool): Whether authentication is required to access
            the schema
        items_per_page (int): The number of items returned per page
        request_path (str): The request_path
        auto_detect_media_type (bool): Whether the media type should be detected automatically
        row_user_ownership_enforced (bool): Enable row ownership enforcement
        row_user_ownership_column (str): The column for row ownership enforcement
        comments (str): Comments for the schema
        media_type (str): The media_type of the db object
        auth_stored_procedure (str): The stored procedure that implements the authentication check for this db object
        options (dict,required): The options of this db object
        fields (list): The db objects fields as JSON string

    Returns:
        The result message as string
    """
    if kwargs.get("value") is not None:
        kwargs["value"] = lib.core.convert_json(kwargs["value"])

        for field in kwargs["value"].get("fields", []):
            # the ids to insert have the value of position * -1, otherwise, it comes
            ids=['db_object_id']

            # with the id to update. To avoid issues, for inserts, we're marking
            # the id to None
            if field["id"].startswith("-"):
                field["id"] = None
            else:
                ids.append("id")

            lib.core.convert_ids_to_binary(ids, field)

    if kwargs.get("request_path") is not None:
        lib.core.Validations.request_path(kwargs["request_path"])

    lib.core.convert_ids_to_binary(["schema_id", "db_object_id"], kwargs)

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        kwargs["session"] = session
        if not kwargs.get("db_object_id"):
            schema = resolve_schema(session, kwargs["schema_id"])
            kwargs["schema_id"] = schema.get("id")

        kwargs = resolve_db_object_ids(**kwargs)

        # check for request_path collisions
        if kwargs["value"].get("request_path"):
            for db_object_id in kwargs["db_object_ids"]:
                db_object = lib.db_objects.get_db_object(session=session, db_object_id=db_object_id)
                schema = lib.schemas.get_schema(session=session, schema_id=db_object["db_schema_id"])
                if db_object["request_path"] != kwargs["value"]["request_path"]:
                    lib.core.check_request_path(session, schema["host_ctx"] + schema['request_path'] + kwargs["value"]["request_path"])

        with lib.core.MrsDbTransaction(session):
            lib.db_objects.update_db_objects(session=session,
                db_object_ids=kwargs["db_object_ids"], value=kwargs["value"])

            if lib.core.get_interactive_result():
                if len(kwargs['db_object_ids']) == 1:
                    return f"The db_object has been updated."
                return f"The db_object have been updated."
            return True
    return False





