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

# cSpell:ignore mysqlsh, mrs

from mysqlsh.plugin_manager import plugin_function
import mrs_plugin.lib as lib

def verify_value_keys(**kwargs):
    for key in kwargs["value"].keys():
        if key not in ["name", "request_path", "requires_auth",
            "enabled", "items_per_page", "comments", "options"] and key != "delete":
            raise Exception(f"Attempting to change an invalid schema value.")

def resolve_schemas(**kwargs):
    session = kwargs.get("session")

    service_id = kwargs.pop("service_id", None)
    schema_id = kwargs.pop("schema_id", None)
    schema_name = kwargs.pop("schema_name", None)
    request_path = kwargs.pop("request_path", None)
    interactive = kwargs.pop("interactive", lib.core.get_interactive_default())
    allow_multi_select = kwargs.pop("allow_multi_select", True)

    kwargs["schemas"] = {}

    # if there's g proper schema_id, then use it
    if isinstance(schema_id, int) and schema_id > 0:
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
        schema = lib.schemas.get_schema(session=session, schema_id=rows[0]["id"])
        kwargs["schemas"][rows[0]["id"]] = schema.get("host_ctx")
        return kwargs

    if schema_name is not None:
        # Lookup the schema name
        row = lib.core.select(table="db_schema",
            cols="id",
            where=["name=?", "service_id=?"]
        ).exec(session, [schema_name, service.get("id")]).first

        schema = lib.schemas.get_schema(session=session, schema_id=rows[0]["id"])
        kwargs["schemas"][rows[0]["id"]] = schema.get("host_ctx")
        return kwargs

    if request_path is not None:
        # Lookup the request path
        if not request_path.startswith('/'):
            raise Exception("The request_path has to start with '/'.")

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

    if not interactive:
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
    interactive = kwargs.get("interactive", lib.core.get_interactive_default())
    if not interactive:
        return kwargs

    if value is None or "requires_auth" in value and value["requires_auth"] is None:
        kwargs["value"]["requires_auth"] = lib.core.prompt_for_requires_auth()

    return kwargs

def resolve_items_per_page(**kwargs):
    value = kwargs.get("value")
    interactive = kwargs.get("interactive", lib.core.get_interactive_default())
    if not interactive:
        return kwargs

    if value is None or "items_per_page" in value and value["items_per_page"] is None:
        kwargs["value"]["items_per_page"] = lib.core.prompt_for_items_per_page()

    return kwargs

def resolve_comments(**kwargs):
    value = kwargs.get("value")
    interactive = kwargs.get("interactive", lib.core.get_interactive_default())
    if not interactive:
        return kwargs

    if value is None or "comments" in value and value["comments"] is None:
        kwargs["value"]["comments"] = lib.core.core.prompt_for_comments()

    return kwargs

def call_update_schema(**kwargs):
    text_update = kwargs.pop("text_update", "updated")
    lib_func = kwargs.pop("lib_function", lib.schemas.update_schema)

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        kwargs["session"] = session
        kwargs = resolve_schemas(**kwargs)

        with lib.core.MrsDbTransaction(session):
            lib_func(**kwargs)

            if len(kwargs['schemas']) == 1:
                return f"The schema has been {text_update}."
            return f"The schemas have been {text_update}."


@plugin_function('mrs.add.schema', shell=True, cli=True, web=True)
def add_schema(service_id, **kwargs):
    """Add a schema to the given MRS service

    Args:
        service_id (int): The id of the service the schema should be added to
        **kwargs: Additional options

    Keyword Args:
        schema_name (str,required): The name of the schema to add
        request_path (str,required): The request_path
        requires_auth (bool): Whether authentication is required to access
            the schema
        enabled (bool): The enabled state
        items_per_page (int): The number of items returned per page
        comments (str): Comments for the schema
        options (dict): The options for the schema
        session (object): The database session to use.

    Returns:
        The schema_id of the created schema when not in interactive mode
    """
    schema_name = kwargs.get("schema_name")
    request_path = kwargs.get("request_path")
    requires_auth = kwargs.get("requires_auth")
    enabled = kwargs.get("enabled", True)
    items_per_page = kwargs.get("items_per_page")
    comments = kwargs.get("comments")
    options = kwargs.get("options")
    interactive = lib.core.get_interactive_default()
    return_formatted = lib.core.get_interactive_result()

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        lib.services.get_service(service_id=service_id, get_default=True,
            session=session)

        if not schema_name and interactive:
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

            if not schema_name:
                raise ValueError('Operation cancelled.')

        # Get request_path
        if request_path is None and interactive:
            request_path = lib.schemas.prompt_for_request_path(schema_name)


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
            auto_increment_value = lib.schemas.add_schema(schema_name=schema_name, service_id=service_id,
                request_path=request_path, requires_auth=requires_auth, enabled=enabled,
                items_per_page=items_per_page, comments=comments, options=options,
                session=session)

            if return_formatted:
                return f"\nSchema with id {auto_increment_value} was added successfully."
            return auto_increment_value


@plugin_function('mrs.get.schema', shell=True, cli=True, web=True)
def get_schema(**kwargs):
    """Gets a specific MRS schema

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (int,required): The id of the service
        request_path (str,required): The request_path of the schema
        schema_name (str,required): The name of the schema
        schema_id (int,required): The id of the schema
        auto_select_single (bool,required): If there is a single service only, use that
        session (object): The database session to use.

    Returns:
        The schema as dict or None on error in interactive mode
    """
    return_formatted = lib.core.get_interactive_result()

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        kwargs["session"] = session
        kwargs["allow_multi_select"] = False
        kwargs = resolve_schemas(**kwargs)
        kwargs["schema_id"] = list(kwargs["schemas"].keys())[0]
        schema = lib.schemas.get_schema(session, schema_id=kwargs["schema_id"])

        if return_formatted:
            return lib.schemas.format_schema_listing([schema], True)

        return schema


@plugin_function('mrs.list.schemas', shell=True, cli=True, web=True)
def get_schemas(service_id=None, **kwargs):
    """Returns all schemas for the given MRS service

    Args:
        service_id (int): The id of the service to list the schemas from
        **kwargs: Additional options

    Keyword Args:
        include_enable_state (bool): Only include schemas with the given
            enabled state
        session (object): The database session to use.

    Returns:
        Either a string listing the schemas when interactive is set or list
        of dicts representing the schemas
    """
    include_enable_state = kwargs.get("include_enable_state")
    return_formatted = lib.core.get_interactive_result()

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        schemas = lib.schemas.get_schemas(service_id=service_id,
            include_enable_state=include_enable_state,
            session=session)

        if return_formatted:
            return lib.schemas.format_schema_listing(schemas=schemas, print_header=True)

        return schemas


@plugin_function('mrs.enable.schema', shell=True, cli=True, web=True)
def enable_schema(**kwargs):
    """Enables a schema of the given service

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_id (int,required): The id of the schema
        service_id (int,required): The id of the service
        schema_name (str,required): The name of the schema
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    kwargs["value"] = {"enabled": True}

    return call_update_schema(text_update="enabled", **kwargs)


@plugin_function('mrs.disable.schema', shell=True, cli=True, web=True)
def disable_schema(**kwargs):
    """Disables a schema of the given service

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_id (int,required): The id of the schema
        service_id (int,required): The id of the service
        schema_name (str,required): The name of the schema
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    kwargs["value"] = {"enabled": False}

    return call_update_schema(text_update="disabled", **kwargs)


@plugin_function('mrs.delete.schema', shell=True, cli=True, web=True)
def delete_schema(**kwargs):
    """Deletes a schema of the given service

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_id (int,required): The id of the schema
        service_id (int,required): The id of the service
        schema_name (str,required): The name of the schema
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    return call_update_schema(text_update="deleted", lib_function=lib.schemas.delete_schema, **kwargs)


@plugin_function('mrs.set.schema.name', shell=True, cli=True, web=True)
def set_name(**kwargs):
    """Sets the name of a given schema

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_id (int,required): The id of the schema
        service_id (int,required): The id of the service
        schema_name (str,required): The name of the schema
        value (str,required): The value
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    kwargs["value"] = { "name": kwargs.get("value") }

    return call_update_schema(**kwargs)


@plugin_function('mrs.set.schema.requestPath', shell=True, cli=True, web=True)
def set_request_path(**kwargs):
    """Sets the request_path of a given schema

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_id (int,required): The id of the schema
        service_id (int,required): The id of the service
        schema_name (str,required): The name of the schema
        value (str,required): The value
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    kwargs["value"] = { "request_path": kwargs.get("value") }

    return call_update_schema(**kwargs)


@plugin_function('mrs.set.schema.requiresAuth', shell=True, cli=True, web=True)
def set_require_auth(**kwargs):
    """Sets the requires_auth flag of the given schema

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_id (int,required): The id of the schema
        service_id (int,required): The id of the service
        schema_name (str,required): The name of the schema
        value (bool,required): The value
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    kwargs["value"] = { "requires_auth": kwargs.get("value", True) }
    kwargs = resolve_requires_auth(**kwargs)

    return call_update_schema(**kwargs)


@plugin_function('mrs.set.schema.itemsPerPage', shell=True, cli=True, web=True)
def set_items_per_page(**kwargs):
    """Sets the items_per_page of a given schema

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_id (int,required): The id of the schema
        service_id (int,required): The id of the service
        schema_name (str,required): The name of the schema
        value (int,required): The value
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    kwargs["value"] = { "items_per_page": kwargs.get("value", 25) }
    kwargs = resolve_items_per_page(**kwargs)

    return call_update_schema(**kwargs)


@plugin_function('mrs.set.schema.comments', shell=True, cli=True, web=True)
def set_comments(**kwargs):
    """Sets the comments of a given schema

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_id (int,required): The id of the schema
        service_id (int,required): The id of the service
        schema_name (str,required): The name of the schema
        value (str,required): The value
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    kwargs["value"] = { "comments": kwargs.get("value") }

    kwargs = resolve_comments(**kwargs)

    return call_update_schema(**kwargs)


@plugin_function('mrs.update.schema', shell=True, cli=True, web=True)
def update_schema(**kwargs):
    """Updates the given schema

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_id (int): The id of the schema
        service_id (int): The id of the service
        schema_name (str): The name of the schema
        value (dict,required): The values as dict #TODO: check why dicts cannot be passed
        session (object): The database session to use.

    Allowed options for value:
        schema_name (str): The name of the schema
        request_path (str): The request_path
        requires_auth (bool): Whether authentication is required to access
            the schema
        enabled (bool): The enabled state
        items_per_page (int): The number of items returned per page
        comments (str): Comments for the schema
        options (dict): The options for the schema

    Returns:
        The result message as string
    """
    if "schema_name" in kwargs["value"]:
        kwargs["value"]["name"] = kwargs["value"]["schema_name"]
        del kwargs["value"]["schema_name"]

    if not kwargs["value"].get("options"):
        try:
            del kwargs["value"]["options"]
        except:
            pass

    verify_value_keys(**kwargs)

    kwargs = resolve_requires_auth(**kwargs)
    kwargs = resolve_items_per_page(**kwargs)
    kwargs = resolve_comments(**kwargs)

    return call_update_schema(**kwargs)

