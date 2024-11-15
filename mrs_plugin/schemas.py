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

"""Sub-Module for managing MRS schemas"""

# cSpell:ignore mysqlsh, mrs

from mysqlsh.plugin_manager import plugin_function
import mrs_plugin.lib as lib
from .interactive import resolve_service, resolve_schema, resolve_file_path, resolve_overwrite_file


def verify_value_keys(**kwargs):
    for key in kwargs["value"].keys():
        if key not in ["name", "request_path", "requires_auth",
                       "enabled", "items_per_page", "comments",
                       "service_id", "options", "metadata"] and key != "delete":
            raise Exception(f"Attempting to change an invalid schema value.")


def resolve_schemas(**kwargs):
    session = kwargs.get("session")

    service_id = kwargs.pop("service_id", None)
    schema_id = kwargs.pop("schema_id", None)
    schema_name = kwargs.pop("schema_name", None)
    request_path = kwargs.pop("request_path", None)
    allow_multi_select = kwargs.pop("allow_multi_select", True)

    kwargs["schemas"] = {}

    # if there's g proper schema_id, then use it
    if schema_id is not None:
        schema = lib.schemas.get_schema(session=session, schema_id=schema_id)
        kwargs["schemas"][schema_id] = schema.get("host_ctx")
        return kwargs

    # Check if given service_id exists or use the current service
    service = lib.services.get_service(
        service_id=service_id, session=session)

    if not service:
        raise Exception("Unable to get a service.")

    service_id = service.get("id")

    rows = lib.core.select(table="db_schema",
                           cols=["id"],
                           where="service_id=?"
                           ).exec(session, [service_id]).items

    if not rows:
        raise ValueError("No schemas available. Use mrs.add.schema() "
                         "to add a schema.")

    if len(rows) == 1:
        schema = lib.schemas.get_schema(
            session=session, schema_id=rows[0]["id"])
        kwargs["schemas"][rows[0]["id"]] = schema.get("host_ctx")
        return kwargs

    if schema_name is not None:
        # Lookup the schema name
        row = lib.core.select(table="db_schema",
                              cols="id",
                              where=["name=?", "service_id=?"]
                              ).exec(session, [schema_name, service.get("id")]).first

        schema = lib.schemas.get_schema(
            session=session, schema_id=rows[0]["id"])
        kwargs["schemas"][rows[0]["id"]] = schema.get("host_ctx")
        return kwargs

    if request_path is not None:
        # Lookup the request path
        row = lib.core.select(table="db_schema",
                              cols="id",
                              where=["request_path=?", "service_id=?"]
                              ).exec(session, [request_path, service.get("id")]).first

        schema = lib.schemas.get_schema(session=session, schema_id=row["id"])
        kwargs["schemas"][row["id"]] = schema.get("host_ctx")
        return kwargs

    schema = lib.schemas.get_current_schema(session=session)
    if schema is not None:
        kwargs["schemas"][schema.get("id")] = schema.get("host_ctx")
        return kwargs

    if not lib.core.get_interactive_default():
        raise ValueError("Operation cancelled.")

    # this is the code for interactive mode
    schemas = lib.schemas.get_schemas(
        service_id=service.get("id"),
        include_enable_state=None,
        session=session)
    caption = ("Please select a schema index, type "
               "the request_path or type '*' "
               "to select all: ")
    selection = lib.core.prompt_for_list_item(
        item_list=schemas,
        prompt_caption=caption,
        item_name_property="request_path",
        given_value=None,
        print_list=True,
        allow_multi_select=allow_multi_select)

    if not selection:
        raise ValueError("Operation cancelled.")

    for current_schema in selection:
        schema = lib.schemas.get_schema(request_path=request_path, schema_id=current_schema.get("id"),
                                        session=session)
        kwargs["schemas"][current_schema.get("id")] = schema.get("host_ctx")

    return kwargs


def resolve_requires_auth(**kwargs):
    value = kwargs.get("value")
    if not lib.core.get_interactive_default():
        return kwargs

    if value is None or "requires_auth" in value and value["requires_auth"] is None:
        kwargs["value"]["requires_auth"] = lib.core.prompt_for_requires_auth()

    return kwargs


def resolve_items_per_page(**kwargs):
    value = kwargs.get("value")
    if not lib.core.get_interactive_default():
        return kwargs

    if value is None or "items_per_page" in value and value["items_per_page"] is None:
        kwargs["value"]["items_per_page"] = lib.core.prompt_for_items_per_page()

    return kwargs


def resolve_comments(**kwargs):
    value = kwargs.get("value")
    if not lib.core.get_interactive_default():
        return kwargs

    if value is None or "comments" in value and value["comments"] is None:
        kwargs["value"]["comments"] = lib.core.core.prompt_for_comments()

    return kwargs


def call_update_schema(**kwargs):
    text_update = kwargs.pop("text_update", "updated")
    lib_func = kwargs.pop("lib_function", lib.schemas.update_schema)

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        kwargs["session"] = session
        if not kwargs.get("schema_id"):
            service = resolve_service(session, kwargs.get("service_id"))
            kwargs["service_id"] = service.get("id")
        kwargs = resolve_schemas(**kwargs)

        with lib.core.MrsDbTransaction(session):
            lib_func(**kwargs)

            if lib.core.get_interactive_result():
                if len(kwargs['schemas']) == 1:
                    return f"The schema has been {text_update}."
                return f"The schemas have been {text_update}."
            return True
    return False


def generate_create_statement(**kwargs) -> str:
    lib.core.convert_ids_to_binary(["service_id", "schema_id"], kwargs)
    service_id = kwargs.get("service_id")
    schema_id = kwargs.get("schema_id")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        schema = resolve_schema(session, schema_id, service_id)

        return lib.schemas.get_create_statement(session, schema)

@plugin_function('mrs.add.schema', shell=True, cli=True, web=True)
def add_schema(**kwargs):
    """Add a schema to the given MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (str): The id of the service the schema should be added to
        schema_name (str): The name of the schema to add
        request_path (str): The request_path
        requires_auth (bool): Whether authentication is required to access
            the schema
        enabled (int): The enabled state
        items_per_page (int): The number of items returned per page
        comments (str): Comments for the schema
        options (dict): The options for the schema
        metadata (dict): The metadata settings of the schema
        schema_type (str): Either 'DATABASE_SCHEMA' or 'SCRIPT_MODULE'
        internal (bool): Whether the schema is for internal usage
        session (object): The database session to use.

    Returns:
        The schema_id of the created schema when not in interactive mode
    """
    lib.core.convert_ids_to_binary(["service_id"], kwargs)

    schema_name = kwargs.get("schema_name")
    request_path = kwargs.get("request_path")
    requires_auth = kwargs.get("requires_auth")
    enabled = kwargs.get("enabled", 1)
    items_per_page = kwargs.get("items_per_page")
    comments = kwargs.get("comments")
    options = kwargs.get("options")
    metadata = kwargs.get("metadata")
    schema_type = kwargs.get("schema_type")
    internal = kwargs.get("internal", False)
    interactive = lib.core.get_interactive_default()

    if schema_type is None:
        schema_type = "DATABASE_SCHEMA"

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        service = resolve_service(session, kwargs.get("service_id"))

        if not service:
            raise RuntimeError(
                "Operation cancelled. The service was not found.")

        if not schema_name and interactive:
            rows = lib.database.get_schemas(session)

            schemas = [row["SCHEMA_NAME"] for row in rows]

            if schemas is None or len(schemas) == 0:
                raise ValueError('No database schemas available.')

            schema_name = lib.core.prompt_for_list_item(
                item_list=schemas,
                prompt_caption='Please enter the name or index of a schema: ',
                print_list=True)

            if not schema_name:
                raise ValueError('Operation cancelled.')

        # Get request_path
        if not request_path:
            if interactive:
                request_path = lib.schemas.prompt_for_request_path(schema_name)
            else:
                request_path = f"/{schema_name}"

        # Get requires_auth
        if requires_auth is None and interactive:
            requires_auth = lib.schemas.prompt_for_requires_auth()

        # Get items_per_page
        if items_per_page is None and interactive:
            items_per_page = lib.schemas.prompt_for_items_per_page()

        # Get comments
        if comments is None and interactive:
            comments = lib.core.prompt(
                "Comments: ").strip()

        if options is None and interactive:
            options = lib.core.prompt("Options: ").strip()

        with lib.core.MrsDbTransaction(session):
            id = lib.schemas.add_schema(schema_name=schema_name, service_id=service["id"],
                                        request_path=request_path, requires_auth=requires_auth, enabled=enabled,
                                        items_per_page=items_per_page, comments=comments, options=options,
                                        metadata=metadata, schema_type=schema_type, internal=internal,
                                        session=session)

            schema = lib.schemas.get_schema(session=session, schema_id=id)

            if lib.core.get_interactive_result():
                return f"\nService with path {schema['request_path']} created successfully."
            return id


@plugin_function('mrs.get.schema', shell=True, cli=True, web=True)
def get_schema(**kwargs):
    """Gets a specific MRS schema

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (str): The id of the service
        request_path (str): The request_path of the schema
        schema_name (str): The name of the schema
        schema_id (str): The id of the schema
        auto_select_single (bool): If there is a single service only, use that
        session (object): The database session to use.

    Returns:
        The schema as dict or None on error in interactive mode
    """
    lib.core.convert_ids_to_binary(["service_id", "schema_id"], kwargs)

    if kwargs.get("request_path") is not None:
        lib.core.Validations.request_path(kwargs["request_path"])

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        kwargs["session"] = session
        kwargs["allow_multi_select"] = False
        service = resolve_service(session, kwargs.get("service_id"))

        if not service:
            raise RuntimeError(
                "Operation cancelled. The service was not found.")

        kwargs["service_id"] = service["id"]

        kwargs = resolve_schemas(**kwargs)
        schema_id = list(kwargs["schemas"].keys())[0]

        schema = lib.schemas.get_schema(session, schema_id=schema_id)

        if lib.core.get_interactive_result():
            return lib.schemas.format_schema_listing([schema], True)

        return schema


@plugin_function('mrs.list.schemas', shell=True, cli=True, web=True)
def get_schemas(service_id=None, **kwargs):
    """Returns all schemas for the given MRS service

    Args:
        service_id (str): The id of the service to list the schemas from
        **kwargs: Additional options

    Keyword Args:
        include_enable_state (bool): Only include schemas with the given
            enabled state
        session (object): The database session to use.

    Returns:
        Either a string listing the schemas when interactive is set or list
        of dicts representing the schemas
    """
    if service_id is not None:
        service_id = lib.core.id_to_binary(service_id, "service_id")

    include_enable_state = kwargs.get("include_enable_state")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        service = resolve_service(session, service_id, False)

        if service:
            service_id = service["id"]

        schemas = lib.schemas.get_schemas(service_id=service_id,
                                          include_enable_state=include_enable_state,
                                          session=session)

        if lib.core.get_interactive_result():
            return lib.schemas.format_schema_listing(schemas=schemas, print_header=True)
        return schemas


@plugin_function('mrs.enable.schema', shell=True, cli=True, web=True)
def enable_schema(**kwargs):
    """Enables a schema of the given service

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_id (str): The id of the schema
        service_id (str): The id of the service
        schema_name (str): The name of the schema
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    lib.core.convert_ids_to_binary(["service_id", "schema_id"], kwargs)

    kwargs["value"] = {"enabled": True}

    return call_update_schema(text_update="enabled", **kwargs)


@plugin_function('mrs.disable.schema', shell=True, cli=True, web=True)
def disable_schema(**kwargs):
    """Disables a schema of the given service

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_id (str): The id of the schema
        service_id (str): The id of the service
        schema_name (str): The name of the schema
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    lib.core.convert_ids_to_binary(["service_id", "schema_id"], kwargs)

    kwargs["value"] = {"enabled": False}

    return call_update_schema(text_update="disabled", **kwargs)


@plugin_function('mrs.delete.schema', shell=True, cli=True, web=True)
def delete_schema(**kwargs):
    """Deletes a schema of the given service

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_id (str): The id of the schema
        service_id (str): The id of the service
        schema_name (str): The name of the schema
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    lib.core.convert_ids_to_binary(["service_id", "schema_id"], kwargs)
    schema_id = kwargs.get("schema_id")
    if schema_id:
        with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
            return lib.schemas.delete_schema(schema_id=schema_id, session=session)
            # TODO: the result message is not properly returned in this case
    else:
        return call_update_schema(text_update="deleted", lib_function=lib.schemas.delete_schemas, **kwargs)


@plugin_function('mrs.set.schema.name', shell=True, cli=True, web=True)
def set_name(**kwargs):
    """Sets the name of a given schema

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_id (str): The id of the schema
        service_id (str): The id of the service
        schema_name (str): The name of the schema
        value (str): The value
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    lib.core.convert_ids_to_binary(["service_id", "schema_id"], kwargs)

    kwargs["value"] = {"name": kwargs.get("value")}

    return call_update_schema(**kwargs)


@plugin_function('mrs.set.schema.requestPath', shell=True, cli=True, web=True)
def set_request_path(**kwargs):
    """Sets the request_path of a given schema

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_id (str): The id of the schema
        service_id (str): The id of the service
        schema_name (str): The name of the schema
        value (str): The value
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    lib.core.convert_ids_to_binary(["service_id", "schema_id"], kwargs)

    kwargs["value"] = {"request_path": kwargs.get("value")}

    return call_update_schema(**kwargs)


@plugin_function('mrs.set.schema.requiresAuth', shell=True, cli=True, web=True)
def set_require_auth(**kwargs):
    """Sets the requires_auth flag of the given schema

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_id (str): The id of the schema
        service_id (str): The id of the service
        schema_name (str): The name of the schema
        value (bool): The value
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    lib.core.convert_ids_to_binary(["service_id", "schema_id"], kwargs)

    kwargs["value"] = {"requires_auth": kwargs.get("value", True)}
    kwargs = resolve_requires_auth(**kwargs)

    return call_update_schema(**kwargs)


@plugin_function('mrs.set.schema.itemsPerPage', shell=True, cli=True, web=True)
def set_items_per_page(**kwargs):
    """Sets the items_per_page of a given schema

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_id (str): The id of the schema
        service_id (str): The id of the service
        schema_name (str): The name of the schema
        value (int): The value
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    lib.core.convert_ids_to_binary(["service_id", "schema_id"], kwargs)

    kwargs["value"] = {"items_per_page": kwargs.get("value", 25)}
    kwargs = resolve_items_per_page(**kwargs)

    return call_update_schema(**kwargs)


@plugin_function('mrs.set.schema.comments', shell=True, cli=True, web=True)
def set_comments(**kwargs):
    """Sets the comments of a given schema

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_id (str): The id of the schema
        service_id (str): The id of the service
        schema_name (str): The name of the schema
        value (str): The value
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    lib.core.convert_ids_to_binary(["service_id", "schema_id"], kwargs)

    kwargs["value"] = {"comments": kwargs.get("value")}

    kwargs = resolve_comments(**kwargs)

    return call_update_schema(**kwargs)


@plugin_function('mrs.update.schema', shell=True, cli=True, web=True)
def update_schema(**kwargs):
    """Updates the given schema

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_id (str): The id of the schema
        service_id (str): The id of the service
        schema_name (str): (required) The name of the schema
        value (dict): The values as dict #TODO: check why dicts cannot be passed
        session (object): The database session to use.

    Allowed options for value:
        service_id (str): The new service id for the schema
        schema_name (str): The name of the schema
        request_path (str): The request_path
        requires_auth (bool): Whether authentication is required to access
            the schema
        enabled (int): The enabled state
        items_per_page (int): The number of items returned per page
        comments (str): Comments for the schema
        options (dict): The options for the schema
        metadata (dict): The metadata settings of the schema

    Returns:
        The result message as string
    """
    lib.core.convert_ids_to_binary(["service_id", "schema_id"], kwargs)

    kwargs["value"] = lib.core.convert_json(kwargs["value"])
    lib.core.convert_ids_to_binary(["service_id"], kwargs["value"])

    if kwargs.get("request_path") is not None:
        lib.core.Validations.request_path(kwargs["request_path"])

    if "schema_name" in kwargs["value"]:
        kwargs["value"]["name"] = kwargs["value"]["schema_name"]
        del kwargs["value"]["schema_name"]

    verify_value_keys(**kwargs)

    kwargs = resolve_requires_auth(**kwargs)
    kwargs = resolve_items_per_page(**kwargs)
    kwargs = resolve_comments(**kwargs)

    return call_update_schema(**kwargs)


@plugin_function('mrs.get.schemaCreateStatement', shell=True, cli=True, web=True)
def get_create_statement(**kwargs):
    """Returns the corresponding CREATE REST SCHEMA SQL statement of the given MRS service object.

    Args:
        **kwargs: Options to determine what should be generated.

    Keyword Args:
        service_id (str): The ID of the service where the schema belongs.
        schema_id (str): The ID of the schema to generate.
        session (object): The database session to use.

    Returns:
        The SQL that represents the create statement for the MRS schema
    """
    return generate_create_statement(**kwargs)


@plugin_function('mrs.dump.schemaCreateStatement', shell=True, cli=True, web=True)
def store_create_statement(**kwargs):
    """Stores the corresponding CREATE REST schema SQL statement of the given MRS schema
    object into a file.

    Args:
        **kwargs: Options to determine what should be generated.

    Keyword Args:
        service_id (str): The ID of the service where the schema belongs.
        schema_id (str): The ID of the schema to dump.
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