# Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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

"""Sub-Module for managing MRS schemas"""

# cSpell:ignore mysqlsh, mrs, privs

import os
from pathlib import Path
from mysqlsh.plugin_manager import plugin_function
import mrs_plugin.lib as lib
from .interactive import resolve_schema, resolve_service, resolve_db_object, resolve_file_path, resolve_overwrite_file


def resolve_db_object_ids(db_object_name=None, schema_id=None, service_id=None, request_path=None, **kwargs):
    session = kwargs.get("session")

    db_object_id = kwargs.pop("db_object_id", None)

    kwargs["db_object_ids"] = [
        db_object_id] if db_object_id is not None else []

    if not db_object_id:
        schema = resolve_schema(session, schema_id, service_id)
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


def generate_create_statement(**kwargs) -> str:
    lib.core.convert_ids_to_binary(["service_id", "schema_id", "db_object_id"], kwargs)
    db_object_id = kwargs.get("db_object_id")
    schema_id = kwargs.get("schema_id")
    service_id = kwargs.get("service_id")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        db_object = resolve_db_object(session, db_object_id, schema_id, service_id)

        return lib.db_objects.get_create_statement(session, db_object)


@plugin_function('mrs.add.dbObject', shell=True, cli=True, web=True)
def add_db_object(**kwargs):
    """Add a db_object to the given MRS schema

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
        enabled (int): Whether the db object is enabled
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
        options (dict): The options of this db object
        metadata (dict): The metadata of this db object
        objects (list): The result/parameters objects definition in JSON format
        session (object): The database session to use.

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
    crud_operation_format = kwargs.get("crud_operation_format")
    requires_auth = kwargs.get("requires_auth")
    items_per_page = kwargs.get("items_per_page")
    row_user_ownership_enforced = kwargs.get(
        "row_user_ownership_enforced", None)
    row_user_ownership_column = kwargs.get("row_user_ownership_column", None)
    comments = kwargs.get("comments")

    media_type = kwargs.get("media_type")
    auto_detect_media_type = kwargs.get("auto_detect_media_type", True)
    auth_stored_procedure = kwargs.get("auth_stored_procedure")
    options = kwargs.get("options")
    metadata = kwargs.get("metadata")

    objects = kwargs.get("objects")

    session = kwargs.get("session")

    interactive = lib.core.get_interactive_default()

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
                    # If the service does not exist, it should be handled in the scope
                    # of this particular operation.
                    service = resolve_service(session=session, required=False)

                    if not service:
                        raise RuntimeError(
                            "Operation cancelled. The service was not found.")

                    schema_id = lib.schemas.add_schema(schema_name=schema_name,
                                                       service_id=service["id"],
                                                       request_path=f"/{schema_name}",
                                                       requires_auth=True if requires_auth else False,
                                                       session=session)

            schema = resolve_schema(session, schema_query=schema_id)

            if not db_object_type and interactive:
                # Get object counts per type
                table_count = lib.database.get_object_type_count(
                    session, schema.get("name"), "TABLE")
                view_count = lib.database.get_object_type_count(
                    session, schema.get("name"), "VIEW")
                proc_count = lib.database.get_object_type_count(
                    session, schema.get("name"), "PROCEDURE")

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
                db_objects = lib.database.get_db_objects(
                    session, schema.get("name"), db_object_type)

                if len(db_objects) == 0:
                    raise ValueError(
                        f"No database objects of type {db_object_type} in the "
                        f"database schema {schema.get('name')}")

                db_object_name = lib.core.prompt_for_list_item(
                    item_list=[db_object["OBJECT_NAME"]
                               for db_object in db_objects],
                    prompt_caption=("Please enter the name or index of a "
                                    "database object: "),
                    print_list=True)

                if not db_object_name:
                    raise ValueError('Operation cancelled.')
            # If a db_object name has been provided, check if that db_object exists
            # in that schema
            elif db_object_name and db_object_type:
                db_object = lib.database.get_db_object(
                    session, schema.get("name"), db_object_name, db_object_type)

                if not db_object:
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

            # Get requires_auth
            if requires_auth is None:
                if interactive:
                    requires_auth = lib.core.prompt(
                        "Should the db_object require authentication? [y/N]: ",
                        {'defaultValue': 'n'}).strip().lower() == 'y'
                else:
                    requires_auth = False

            # Get items_per_page
            if items_per_page is None:
                if interactive:
                    items_per_page = lib.core.prompt(
                        "How many items should be listed per page? "
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

            db_object_id, grants = lib.db_objects.add_db_object(
                session=session, schema_id=schema.get("id"),
                db_object_name=db_object_name, request_path=request_path, enabled=enabled,
                db_object_type=db_object_type,
                items_per_page=items_per_page, requires_auth=requires_auth,
                row_user_ownership_enforced=row_user_ownership_enforced,
                row_user_ownership_column=row_user_ownership_column,
                crud_operation_format=crud_operation_format,
                comments=comments, media_type=media_type, auto_detect_media_type=auto_detect_media_type,
                auth_stored_procedure=auth_stored_procedure, options=options, metadata=metadata,
                objects=objects)

            for grant in grants:
                lib.core.MrsDbExec(grant).exec(session)

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
        schema_name (str): The name of the schema
        absolute_request_path (str): The absolute request_path to the db_object
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

    absolute_request_path = kwargs.get("absolute_request_path")

    interactive = lib.core.get_interactive_default()

    schema = None

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:

        if db_object_id:
            return lib.db_objects.get_db_object(session=session, db_object_id=db_object_id)

        if absolute_request_path:
            return lib.db_objects.get_db_object(session=session, absolute_request_path=absolute_request_path)

        if schema_id:
            schema = lib.schemas.get_schema(
                schema_id=schema_id, session=session)
        elif schema_name:
            schema = lib.schemas.get_schema(
                schema_name=schema_name, session=session)
        elif interactive:
            rows = lib.database.get_schemas(session)

            schemas = [row["SCHEMA_NAME"] for row in rows]

            if schemas is None or len(schemas) == 0:
                raise ValueError('No database schemas available.')

            schema_name = lib.core.prompt_for_list_item(
                item_list=schemas,
                prompt_caption='Please enter the name or index of a schema: ',
                print_list=True)
            schema = lib.schemas.get_schema(
                schema_name=schema_name, session=session)

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


@plugin_function('mrs.get.dbObjectParameters', shell=True, cli=True, web=True)
def get_db_object_parameters(request_path=None, **kwargs):
    """Gets the list of available parameters given db_object representing a
    STORED PROCEDURE or FUNCTION

    Args:
        request_path (str): The request path of the db_object
        **kwargs: Additional options

    Keyword Args:
        db_object_id (str): The id of the db_object
        db_schema_name (str): The name of the db_schema
        db_object_name (str): The name of the db_object
        db_type (str): The type of the db_object, either PROCEDURE or FUNCTION
        session (object): The database session to use.

    Returns:
        The list of available db object fields
    """
    if request_path is not None:
        lib.core.Validations.request_path(request_path)

    db_object_id = kwargs.get("db_object_id")
    if db_object_id is not None:
        db_object_id = lib.core.id_to_binary(db_object_id, "db_object_id")

    db_schema_name = kwargs.get("db_schema_name")
    db_object_name = kwargs.get("db_object_name")
    db_type = kwargs.get("db_type", "PROCEDURE")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        if db_object_id:
            return lib.db_objects.get_db_object_parameters(session, db_object_id)

        if not db_schema_name:
            raise Exception("You must supply the schema name.")
        if not db_object_name:
            raise Exception("You must supply the DB Object name.")

        return lib.db_objects.get_db_object_parameters(session,
                                                       db_schema_name=db_schema_name,
                                                       db_object_name=db_object_name,
                                                       db_type=db_type)


@plugin_function('mrs.get.dbFunctionReturnType', shell=True, cli=True, web=True)
def get_db_function_return_type(db_schema_name, db_object_name, **kwargs):
    """Gets the return data type of the FUNCTION

    Args:
        db_schema_name (str): The name of the db_schema
        db_object_name (str): The name of the db_object
        **kwargs: Additional options

    Keyword Args:
        session (object): The database session to use.

    Returns:
        The datatype as string
    """
    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        return lib.db_objects.get_db_function_return_type(
            session, db_schema_name=db_schema_name, db_object_name=db_object_name)


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
        db_object = lib.db_objects.get_db_object(
            session=session, db_object_id=db_object_id)

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


@plugin_function('mrs.enable.dbObject', shell=True, cli=True, web=True)
def enable_db_object(db_object_name=None, schema_id=None,
                     **kwargs):
    """Enables a db_object of the given schema

    Args:
        db_object_name (str): The name of the db_object
        schema_id (str): The id of the schema
        **kwargs: Additional options

    Keyword Args:
        db_object_id (str): The id of the db_object
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    lib.core.convert_ids_to_binary(["schema_id", "db_object_id"], kwargs)

    kwargs["value"] = True

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
    """Disables a db_object of the given schema

    Args:
        db_object_name (str): The name of the db_object
        schema_id (str): The id of the schema
        **kwargs: Additional options

    Keyword Args:
        db_object_id (str): The id of the db_object
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
    """Deletes a db_object of the given schema

    Args:
        db_object_name (str): The name of the db_object
        schema_id (str): The id of the schema
        **kwargs: Additional options

    Keyword Args:
        db_object_id (str): The id of the db_object
        session (object): The database session to use.

    Returns:
        True if the object was deleted.
    """
    lib.core.convert_ids_to_binary(["db_object_id"], kwargs)

    if schema_id is not None:
        schema_id = lib.core.id_to_binary(schema_id, "schema_id")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        kwargs["session"] = session
        db_object_id = kwargs.get("db_object_id")

        with lib.core.MrsDbTransaction(session):
            if db_object_id is not None:
                lib.db_objects.delete_db_object(session, db_object_id)
            else:
                kwargs = resolve_db_object_ids(
                    db_object_name, schema_id, **kwargs)
                lib.db_objects.delete_db_objects(**kwargs)

        if lib.core.get_interactive_result():
            return f"The db_object has been deleted."
        return True
    return False


@plugin_function('mrs.update.dbObject', shell=True, cli=True, web=True)
def update_db_object(**kwargs):
    """Update a db_object

    Args:
        **kwargs: Additional options

    Keyword Args:
        db_object_id (str): The id of the database object
        db_object_ids (list): A list of database object ids to update
        db_object_name (str): The name of the database object to update
        schema_id (str): The id of the schema that contains the database object to be updated
        request_path (str): The request_path
        value (dict): The values to update
        session (object): The database session to use.

    Allowed options for value:
        name (str): The new name to apply to the database object
        db_schema_id (str): The id of the schema to update in the database object
        enabled (int): If the database object is enabled or not
        crud_operation_format (str): The format to use for the CRUD operation
        requires_auth (bool): Whether authentication is required to access
            the database object
        items_per_page (int): The number of items returned per page
        request_path (str): The request_path
        auto_detect_media_type (bool): Whether the media type should be detected automatically
        comments (str): Comments for the database object
        media_type (str): The media_type of the db object
        auth_stored_procedure (str): The stored procedure that implements the authentication check for this db object
        options (dict): The options of this db object
        metadata (dict): The metadata settings of the db object
        objects (list): The result/parameters objects definition in JSON format

    Returns:
        The result message as string
    """

    # convert to python native types or default kwargs["value"] to {} of "values" is not supplied
    kwargs["value"] = lib.core.convert_json(kwargs.get("value", {}))
    lib.core.convert_ids_to_binary(["db_schema_id"], kwargs["value"])

    if kwargs.get("request_path") is not None:
        lib.core.Validations.request_path(kwargs["request_path"])

    lib.core.convert_ids_to_binary(["schema_id", "db_object_id"], kwargs)

    schema_name = kwargs["value"].pop("schema_name", None)

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        kwargs["session"] = session
        if not kwargs.get("db_object_id"):
            schema = resolve_schema(session, schema_query=kwargs["schema_id"])
            kwargs["schema_id"] = schema.get("id")

        kwargs = resolve_db_object_ids(**kwargs)

        # verify the objects exist in the schema
        for object_id in kwargs["db_object_ids"]:

            db_object = lib.db_objects.get_db_object(
                session=session, db_object_id=object_id)
            target_name = kwargs["value"].get("name") or db_object["name"]

            # get the target schema
            if kwargs["value"].get("db_schema_id") or schema_name:
                target_schema = lib.schemas.get_schema(session,
                                                       schema_id=kwargs["value"].get(
                                                           "db_schema_id"),
                                                       schema_name=schema_name)
            else:
                target_schema = lib.schemas.get_schema(
                    session, db_object["db_schema_id"])

            if not target_schema:
                raise ValueError("The target schema does not exist.")

            # check if the target object exists in the target schema
            if not lib.database.get_db_object(session, target_schema["name"], target_name, db_object["object_type"]):
                raise ValueError(
                    f"The {db_object.get('object_type')} named '{target_name}' "
                    f"does not exists in database schema '{target_schema['name']}'.")

            # check if the MRS db_object already exists in the target MRS schema
            if db_object["db_schema_id"] != target_schema["id"]:
                if lib.db_objects.get_db_object(session, schema_id=target_schema["id"], db_object_name=target_name):
                    raise ValueError(
                        "The object already exists in the target schema.")

            kwargs["value"]["db_schema_id"] = target_schema["id"]

        with lib.core.MrsDbTransaction(session):
            lib.db_objects.update_db_objects(session=session,
                                             db_object_ids=kwargs["db_object_ids"], value=kwargs["value"])

            if lib.core.get_interactive_result():
                if len(kwargs['db_object_ids']) == 1:
                    return f"The database object has been updated."
                return f"The database objects have been updated."
            return True
    return False


@plugin_function('mrs.get.tableColumnsWithReferences', shell=True, cli=True, web=True)
def get_table_columns_with_references(db_object_id=None, schema_id=None,
                                      request_path=None, db_object_name=None, **kwargs):
    """Gets the list of table columns and references

    Args:
        db_object_id (str): The id of the db_object
        schema_id (str): The id of the schema
        request_path (str): The request_path of the schema
        db_object_name (str): The name of the db_object
        **kwargs: Additional options

    Keyword Args:
        schema_name (str): The name of the schema
        db_object_type (str): The type of the db_object (TABLE, VIEW, PROCEDURE)
        session (object): The database session to use.

    Returns:
        The list of table columns and references
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
            return lib.db_objects.get_table_columns_with_references(session, db_object_id)

        if schema_id:
            schema = lib.schemas.get_schema(session, schema_id=schema_id)
            schema_name = schema.get("name")
        else:
            if not schema_name:
                raise Exception("You must supply the schema name.")

        return lib.db_objects.get_table_columns_with_references(session,
                                                                schema_name=schema_name,
                                                                db_object_name=db_object_name,
                                                                db_object_type=db_object_type)


@plugin_function('mrs.get.objects', shell=True, cli=True, web=True)
def get_objects(db_object_id=None, **kwargs):
    """Gets the list of objects for the given db_object

    Args:
        db_object_id (str): The id of the db_object
        **kwargs: Additional options

    Keyword Args:
        session (object): The database session to use.

    Returns:
        The list of objects of the given db_object
    """
    if not db_object_id:
        raise Exception("You must supply the db_object_id.")

    db_object_id = lib.core.id_to_binary(db_object_id, "db_object_id")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        return lib.db_objects.get_objects(session, db_object_id=db_object_id)


@plugin_function('mrs.get.objectFieldsWithReferences', shell=True, cli=True, web=True)
def get_object_fields_with_references(object_id=None, **kwargs):
    """Gets the list of object fields and references

    Args:
        object_id (str): The id of the db_object.object
        **kwargs: Additional options

    Keyword Args:
        session (object): The database session to use.

    Returns:
        The list of object fields and references
    """
    if not object_id:
        raise Exception("You must supply the object_id.")

    object_id = lib.core.id_to_binary(object_id, "object_id")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        return lib.db_objects.get_object_fields_with_references(session, object_id=object_id)


@plugin_function('mrs.get.dbObjectCreateStatement', shell=True, cli=True, web=True)
def get_create_statement(**kwargs):
    """Returns the corresponding CREATE REST <DB OBJECT> SQL statement of the given MRS service object.

    Args:
        **kwargs: Options to determine what should be generated.

    Keyword Args:
        service_id (str): The ID of the service where the db_object belongs.
        schema_id (str): The ID of the schema where the db_object belongs.
        db_object_id (str): The ID of the db_object to generate.
        session (object): The database session to use.

    Returns:
        The SQL that represents the create statement for the MRS DB OBJECT or False if it fails.
    """
    return generate_create_statement(**kwargs)

@plugin_function('mrs.dump.dbObjectCreateStatement', shell=True, cli=True, web=True)
def store_create_statement(**kwargs):
    """Stores the corresponding CREATE REST <DB OBJECT> SQL statement of the given MRS schema
    object into a file.

    Args:
        **kwargs: Options to determine what should be generated.

    Keyword Args:
        service_id (str): The ID of the service where the db_object belongs.
        schema_id (str): The ID of the schema where the db_object belongs.
        db_object_id (str): The ID of the db_object to dump.
        file_path (str): The path where to store the file.
        overwrite (bool): Overwrite the file, if already exists.
        session (object): The database session to use.

    Returns:
        True if the file was saved.
    """
    file_path = kwargs.get("file_path")
    overwrite = kwargs.get("overwrite")

    file_path = resolve_file_path(file_path)
    resolve_overwrite_file(file_path, overwrite)

    sql = generate_create_statement(**kwargs)

    with open(file_path, "w") as f:
        f.write(sql)

    if lib.core.get_interactive_result():
        return f"File created in {file_path}."

    return True
