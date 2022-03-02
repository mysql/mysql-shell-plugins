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
from mrs_plugin import core, services as mrs_services

# Schema operations
SCHEMA_SET_ALL = 0
SCHEMA_DISABLE = 1
SCHEMA_ENABLE = 2
SCHEMA_DELETE = 3
SCHEMA_SET_NAME = 4
SCHEMA_SET_REQUEST_PATH = 5
SCHEMA_SET_REQUIRES_AUTH = 6
SCHEMA_SET_ITEMS_PER_PAGE = 7
SCHEMA_SET_COMMENTS = 8


def format_schema_listing(schemas, print_header=False):
    """Formats the listing of schemas

    Args:
        schemas (list): A list of schemas as dicts
        print_header (bool): If set to true, a header is printed


    Returns:
        The formated list of services
    """

    if len(schemas) == 0:
        return "No items available."

    if print_header:
        output = (f"{'ID':>3} {'PATH':38} {'SCHEMA NAME':30} {'ENABLED':8} "
                  f"{'AUTH':9}\n")
    else:
        output = ""

    i = 0
    for item in schemas:
        i += 1
        url = (item['host_ctx'] + item['request_path'])
        output += (f"{item['id']:>3} {url[:37]:38} "
                   f"{item['name'][:29]:30} "
                   f"{'Yes' if item['enabled'] else '-':8} "
                   f"{'Yes' if item['requires_auth'] else '-':5}")
        if i < len(schemas):
            output += "\n"

    return output


def prompt_for_request_path(schema_name) -> str:
    return core.prompt(
        "Please enter the request path for this schema ["
        f"/{schema_name}]: ",
        {'defaultValue': '/' + schema_name}).strip()


def prompt_for_requires_auth() -> bool:
    return core.prompt(
        "Should the schema require authentication [y/N]: ",
        {'defaultValue': 'n'}).strip().lower() == 'y'


def prompt_for_items_per_page() -> int:
    return int(core.prompt(
        "How many items should be listed per page [25]: ",
        {'defaultValue': '25'}).strip())


@plugin_function('mrs.add.schema', shell=True, cli=True, web=True)
def add_schema(**kwargs):
    """Add a schema to the given MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_name (str): The name of the schema to add
        service_id (int): The id of the service the schema should be added to
        request_path (str): The request_path
        requires_auth (bool): Whether authentication is required to access
            the schema
        enabled (bool): The enabled state
        items_per_page (int): The number of items returned per page
        comments (str): Comments for the schema
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode

    Returns:
        None
    """

    schema_name = kwargs.get("schema_name")
    service_id = kwargs.get("service_id")
    request_path = kwargs.get("request_path")
    requires_auth = kwargs.get("requires_auth")
    enabled = kwargs.get("enabled", True)
    items_per_page = kwargs.get("items_per_page")
    comments = kwargs.get("comments")
    session = kwargs.get("session")
    interactive = kwargs.get("interactive", True)

    try:
        session = core.get_current_session(session)
        service = core.get_current_service()
        if service_id is not None or service is None:
            service = mrs_services.get_service(service_id=service_id, get_default=False if service_id else True,
                auto_select_single=True,
                session=session, interactive=interactive,
                return_formatted=False)

        if not schema_name and interactive:
            res = session.run_sql('''
                SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA
                WHERE SCHEMA_NAME NOT LIKE ?
                    AND SCHEMA_NAME NOT LIKE ?
                    AND SCHEMA_NAME <> ?
                ''', ['.%', 'mysql_%', 'mysql'])
            rows = res.fetch_all()
            schemas = \
                [row.get_field("SCHEMA_NAME") for row in rows]

            if len(schemas) == 0:
                raise ValueError('No database schemas available.')

            schema_name = core.prompt_for_list_item(
                item_list=schemas,
                prompt_caption='Please enter the name or index of a schema: ',
                print_list=True)

            if not schema_name:
                raise ValueError('Operation cancelled.')
        # If a schema name has been provided, check if that schema exists
        else:
            res = session.run_sql('''
                SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA
                WHERE SCHEMA_NAME = ?
                ORDER BY SCHEMA_NAME
                ''', [schema_name])
            row = res.fetch_one()
            if row:
                schema_name = row.get_field("SCHEMA_NAME")
            else:
                raise ValueError(
                    f"The given schema_name '{schema_name}' "
                    "does not exists.")

        # Get request_path
        if not request_path:
            if interactive:
                request_path = prompt_for_request_path(schema_name)
            else:
                request_path = '/' + schema_name

        if not request_path.startswith('/'):
            raise Exception("The request_path has to start with '/'.")

        core.check_request_path(
            service.get('url_host_name') + service.get('url_context_root') +
            request_path,
            session=session)

        # Get requires_auth
        if not requires_auth:
            if interactive:
                requires_auth = prompt_for_requires_auth()
            else:
                requires_auth = False

        # Get items_per_page
        if not items_per_page:
            if interactive:
                items_per_page = prompt_for_items_per_page()
            else:
                items_per_page = 25

        # Get comments
        if not comments:
            if interactive:
                comments = core.prompt(
                    "Comments: ").strip()
            else:
                comments = ""

        res = session.run_sql("""
            INSERT INTO `mysql_rest_service_metadata`.db_schema(
                service_id, name, request_path,
                requires_auth, enabled, items_per_page, comments)
            VALUES(?, ?, ?, ?, ?, ?, ?)
            """, [service.get("id"), schema_name,
                  request_path, 1 if requires_auth else 0,
                  1 if enabled else 0,
                  items_per_page, comments])

        if interactive:
            return "\n" + "Schema added successfully."
        else:
            return res.auto_increment_value

    except Exception as e:
        if interactive:
            print(f"Error: {str(e)}")
        else:
            raise


@plugin_function('mrs.get.schema', shell=True, cli=True, web=True)
def get_schema(**kwargs):
    """Gets a specific MRS schema

    Args:
        **kwargs: Additional options

    Keyword Args:
        request_path (str): The request_path of the schema
        schema_name (str): The name of the schema
        schema_id (int): The id of the schema
        service_id (int): The id of the service
        auto_select_single (bool): If there is a single service only, use that
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised
        return_formatted (bool): If true a human readable string is returned
        return_python_object (bool): Used for internal plugin calls

    Returns:
        The schema as dict or None on error in interactive mode
    """

    request_path = kwargs.get("request_path")
    schema_name = kwargs.get("schema_name")

    schema_id = kwargs.get("schema_id")
    service_id = kwargs.get("service_id")
    auto_select_single = kwargs.get("auto_select_single", False)
    session = kwargs.get("session")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)

    try:
        session = core.get_current_session(session)

        # Make sure the MRS metadata schema exists and has the right version
        core.ensure_rds_metadata_schema(session)

        # If there are no selective parameters given
        if (not request_path and not schema_name and not schema_id
                and interactive):
            # See if there is a current schema, if so, return that one
            schema = core.get_current_schema(session=session)
            if schema:
                return schema

            # Get the service_id
            service = mrs_services.get_service(
                service_id=service_id, auto_select_single=auto_select_single,
                session=session, interactive=interactive,
                return_formatted=False)
            if not service:
                return
            service_id = service.get("id")

            # Check if there already is at least one db_schema
            sql = """
                SELECT COUNT(*) as schema_count, MIN(id) AS id
                FROM `mysql_rest_service_metadata`.db_schema
                WHERE service_id = ?
                """
            res = session.run_sql(sql, [service_id])
            row = res.fetch_one()
            schema_count = row.get_field("schema_count") if row else 0

            # If there is exactly one service, set id to its id
            if schema_count == 0:
                raise ValueError("No schemas available. Use mrs.add.schema() "
                                 "to add a schema.")
            if auto_select_single and schema_count == 1:
                schema_id = row.get_field("id")

            # If there are more services, let the user select one or all
            if not schema_id and interactive:
                schemas = get_schemas(
                    service_id=service_id, session=session,
                    interactive=False, return_formatted=False)
                print(f"DB Schema Listing for Service "
                      f"{service.get('url_host_name')}"
                      f"{service.get('url_context_root')}")
                item = core.prompt_for_list_item(
                    item_list=schemas,
                    prompt_caption=("Please select a schema index or type "
                                    "the schema name: "),
                    item_name_property="name",
                    given_value=None,
                    print_list=True)
                if not item:
                    raise ValueError("Operation cancelled.")
                else:
                    return item

        if request_path and not request_path.startswith('/'):
            raise Exception("The request_path has to start with '/'.")

        # Build SQL based on which input has been provided
        sql = """
            SELECT sc.id, sc.name, sc.service_id, sc.request_path,
                sc.requires_auth, sc.enabled, sc.items_per_page, sc.comments,
                CONCAT(h.name, se.url_context_root) AS host_ctx
            FROM `mysql_rest_service_metadata`.db_schema sc
                LEFT OUTER JOIN `mysql_rest_service_metadata`.service se
                    ON se.id = sc.service_id
                LEFT JOIN `mysql_rest_service_metadata`.url_host h
				    ON se.url_host_id = h.id
            WHERE 1 = 1
            """
        params = []
        if service_id:
            sql += "AND sc.service_id = ? "
            params = [service_id]
        if request_path:
            sql += "AND sc.request_path = ? "
            params.append(request_path)
        if schema_name:
            sql += "AND sc.name = ? "
            params.append(schema_name)
        if schema_id:
            sql += "AND sc.id = ? "
            params.append(schema_id)

        res = session.run_sql(sql, params)

        schemas = core.get_sql_result_as_dict_list(res)

        if len(schemas) != 1:
            raise Exception("The given schema was not found.")
        else:
            if return_formatted:
                return format_schema_listing(schemas)
            else:
                return schemas[0]

    except Exception as e:
        if raise_exceptions:
            raise
        print(f"Error: {str(e)}")


@plugin_function('mrs.list.schemas', shell=True, cli=True, web=True)
def get_schemas(**kwargs):
    """Returns all schemas for the given MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (int): The id of the service to list the schemas from
        include_enable_state (bool): Only include schemas with the given
            enabled state
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised
        return_formatted (bool): If set to true, a list object is returned

    Returns:
        Either a string listing the schemas when interactive is set or list
        of dicts representing the schemas
    """

    service_id = kwargs.get("service_id")
    include_enable_state = kwargs.get("include_enable_state")
    session = kwargs.get("session")
    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)

    try:
        session = core.get_current_session(session)

        # Make sure the MRS metadata schema exists and has the right version
        core.ensure_rds_metadata_schema(session)

        # Check the given service_id or get the default if none was given
        service = mrs_services.get_service(
            service_id=service_id, auto_select_single=True,
            session=session, interactive=interactive,
            return_formatted=False)

        sql = """
            SELECT sc.id, sc.name, sc.service_id, sc.request_path,
                sc.requires_auth, sc.enabled, sc.items_per_page, sc.comments,
                CONCAT(h.name, se.url_context_root) AS host_ctx
            FROM `mysql_rest_service_metadata`.db_schema sc
                LEFT OUTER JOIN `mysql_rest_service_metadata`.service se
                    ON se.id = sc.service_id
                LEFT JOIN `mysql_rest_service_metadata`.url_host h
				    ON se.url_host_id = h.id
            WHERE sc.service_id = ? /*=1*/
            """
        if include_enable_state is not None:
            sql += ("AND sc.enabled = "
                    f"{'TRUE' if include_enable_state else 'FALSE'} ")

        sql += "ORDER BY sc.request_path"

        res = session.run_sql(sql, [service.get("id")])

        schemas = core.get_sql_result_as_dict_list(res)

        if return_formatted:
            return format_schema_listing(schemas=schemas, print_header=True)
        else:
            return schemas

    except Exception as e:
        if raise_exceptions:
            raise
        print(f"Error: {str(e)}")


def change_schema(**kwargs):
    """Makes a given change to a MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        change_type (int): Type of change
        schema_name (str): The name of the schema
        request_path (str): The request_path of the schema
        service_id (int): The id of the service
        value (str): The values as string or dict
        schema_id (int): The id of the schema
        session (object): The database session to use
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
        The result message as string
    """
    import json

    change_type = kwargs.get("change_type")
    schema_name = kwargs.get("schema_name")
    request_path = kwargs.get("request_path")
    service_id = kwargs.get("service_id")
    value = kwargs.get("value")

    schema_id = kwargs.get("schema_id")
    session = kwargs.get("session")
    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)

    try:
        session = core.get_current_session(session)

        # Make sure the MRS metadata schema exists and has the right version
        core.ensure_rds_metadata_schema(session)

        # The list of schemas to be changed
        schema_ids = [schema_id] if schema_id else []
        include_enable_state = None

        if not schema_id:
            # Check if given service_id exists or use the current service
            service = mrs_services.get_service(
                service_id=service_id, session=session, interactive=interactive,
                return_formatted=False)

            if not schema_name and not request_path and interactive:
                schemas = get_schemas(
                    service_id=service.get("id"),
                    include_enable_state=include_enable_state,
                    session=session, interactive=False)
                caption = ("Please select a schema index, type "
                           "the request_path or type '*' "
                           "to select all: ")
                selection = core.prompt_for_list_item(
                    item_list=schemas,
                    prompt_caption=caption,
                    item_name_property="request_path",
                    given_value=None,
                    print_list=True,
                    allow_multi_select=True)
                if not selection:
                    raise ValueError("Operation cancelled.")

                schema_ids = [item["id"] for item in selection]

            if schema_name:
                # Lookup the schema name
                res = session.run_sql(
                    """
                    SELECT id FROM `mysql_rest_service_metadata`.db_schema
                    WHERE name = ? AND service_id = ?
                    """,
                    [schema_name, service.get("id")])
                rows = res.fetch_all()
                if rows:
                    for row in rows:
                        schema_ids.append(row.get_field("id"))

            if request_path:
                # Lookup the schema name
                res = session.run_sql(
                    """
                    SELECT id FROM `mysql_rest_service_metadata`.db_schema
                    WHERE request_path = ? AND service_id = ?
                    """,
                    [request_path, service.get("id")])
                row = res.fetch_one()
                if row:
                    schema_ids.append(row.get_field("id"))

        if len(schema_ids) == 0:
            raise ValueError("The specified schema was not found.")

        # Check the given value
        if interactive and not value:
            if change_type == SCHEMA_SET_REQUIRES_AUTH:
                value = prompt_for_requires_auth()
            elif change_type == SCHEMA_SET_ITEMS_PER_PAGE:
                value = prompt_for_items_per_page()
            elif change_type == SCHEMA_SET_COMMENTS:
                value = core.prompt_for_comments()

        # Update all given services
        for schema_id in schema_ids:
            params = [schema_id]

            # The REQUEST_PATH has to be checked for each schema
            if change_type == SCHEMA_SET_REQUEST_PATH:
                request_path_val = value
            elif change_type == SCHEMA_SET_ALL:
                if type(value) == str:  # TODO: Check why dicts cannot be used
                    value = json.loads(value)
                request_path_val = value.get("request_path")

            if (change_type == SCHEMA_SET_REQUEST_PATH or
               change_type == SCHEMA_SET_ALL):
                schema = get_schema(
                    request_path=request_path,
                    schema_id=schema_id, session=session,
                    interactive=False, return_formatted=False)

                if interactive and not request_path:
                    request_path_val = prompt_for_request_path(
                        schema.get("name"))

                # If the request path has changed, check if the new one is valid
                if request_path_val != schema.get("request_path"):
                    if (not request_path_val or
                            not request_path_val.startswith('/')):
                        raise ValueError(
                            "The url_context_root has to start with '/'.")

                    core.check_request_path(
                        schema.get("host_ctx") + request_path_val, session=session)

            if change_type == SCHEMA_DISABLE:
                sql = """
                    UPDATE `mysql_rest_service_metadata`.db_schema
                    SET enabled = FALSE
                    WHERE id = ?
                    """
            elif change_type == SCHEMA_ENABLE:
                sql = """
                    UPDATE `mysql_rest_service_metadata`.db_schema
                    SET enabled = TRUE
                    WHERE id = ?
                    """
            elif change_type == SCHEMA_DELETE:
                session.run_sql("""
                    DELETE FROM `mysql_rest_service_metadata`.db_object
                    WHERE db_schema_id = ?
                    """, [schema_id])
                sql = """
                    DELETE FROM `mysql_rest_service_metadata`.db_schema
                    WHERE id = ?
                    """
            elif change_type == SCHEMA_SET_NAME:
                sql = """
                    UPDATE `mysql_rest_service_metadata`.db_schema
                    SET name = ?
                    WHERE id = ?
                    """
                params.insert(0, value)
            elif change_type == SCHEMA_SET_REQUEST_PATH:
                sql = """
                    UPDATE `mysql_rest_service_metadata`.db_schema
                    SET request_path = ?
                    WHERE id = ?
                    """
                params.insert(0, value)
            elif change_type == SCHEMA_SET_REQUIRES_AUTH:
                sql = """
                    UPDATE `mysql_rest_service_metadata`.db_schema
                    SET requires_auth = ?
                    WHERE id = ?
                    """
                params.insert(0, str(value).lower() == "true")
            elif change_type == SCHEMA_SET_ITEMS_PER_PAGE:
                sql = """
                    UPDATE `mysql_rest_service_metadata`.db_schema
                    SET items_per_page = ?
                    WHERE id = ?
                    """
                params.insert(0, value)
            elif change_type == SCHEMA_SET_COMMENTS:
                sql = """
                    UPDATE `mysql_rest_service_metadata`.db_schema
                    SET comments = ?
                    WHERE id = ?
                    """
                params.insert(0, value)
            elif change_type == SCHEMA_SET_ALL:
                sql = """
                    UPDATE `mysql_rest_service_metadata`.`db_schema`
                    SET name = ?,
                        request_path = ?,
                        requires_auth = ?,
                        enabled = ?,
                        items_per_page = ?,
                        comments = ?
                    WHERE id = ?
                    """
                params.insert(0, value.get("name", ""))
                params.insert(1, request_path_val)
                params.insert(
                    2, (str(value.get("requires_auth")).lower() == "true" or
                    str(value.get("requires_auth")) == "1"))
                params.insert(
                    3, (str(value.get("enabled")).lower() == "true" or
                    str(value.get("enabled")) == "1"))
                params.insert(4, value.get("items_per_page", 25))
                params.insert(5, value.get("comments", ""))
            else:
                raise Exception("Operation not supported")

            res = session.run_sql(sql, params)
            if res.get_affected_row_count() == 0:
                raise Exception(
                    f"The specified schema with id {schema_id} was not "
                    "found.")

        if len(schema_ids) == 1:
            msg = "The schema has been "
        else:
            msg = "The schemas have been "

        if change_type == SCHEMA_DISABLE:
            msg += "disabled."
        elif change_type == SCHEMA_ENABLE:
            msg += "enabled."
        elif change_type == SCHEMA_DELETE:
            msg += "deleted."
        else:
            msg += "updated."

        return msg

    except Exception as e:
        if raise_exceptions:
            raise
        print(f"Error: {str(e)}")


@plugin_function('mrs.enable.schema', shell=True, cli=True, web=True)
def enable_schema(**kwargs):
    """Enables a schema of the given service

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_name (str): The name of the schema
        service_id (int): The id of the service
        schema_id (int): The id of the schema
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
        The result message as string
    """

    return change_schema(
        change_type=SCHEMA_ENABLE,
        **kwargs)


@plugin_function('mrs.disable.schema', shell=True, cli=True, web=True)
def disable_schema(**kwargs):
    """Disables a schema of the given service

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_name (str): The name of the schema
        service_id (int): The id of the service
        schema_id (int): The id of the schema
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
        The result message as string
    """

    return change_schema(
        change_type=SCHEMA_DISABLE,
        **kwargs)


@plugin_function('mrs.delete.schema', shell=True, cli=True, web=True)
def delete_schema(**kwargs):
    """Deletes a schema of the given service

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_name (str): The name of the schema
        service_id (int): The id of the service
        schema_id (int): The id of the schema
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
        The result message as string
    """

    return change_schema(
        change_type=SCHEMA_DELETE,
        **kwargs)


@plugin_function('mrs.set.schema.name', shell=True, cli=True, web=True)
def set_name(**kwargs):
    """Sets the name of a given schema

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_name (str): The name of the schema
        service_id (int): The id of the service
        schema_id (int): The id of the schema
        value (str): The value
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
        The result message as string
    """

    return change_schema(
        change_type=SCHEMA_SET_NAME,
        **kwargs)


@plugin_function('mrs.set.schema.requestPath', shell=True, cli=True, web=True)
def set_request_path(**kwargs):
    """Sets the request_path of a given schema

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_name (str): The name of the schema
        service_id (int): The id of the service
        schema_id (int): The id of the schema
        value (str): The value
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
        The result message as string
    """

    return change_schema(
        change_type=SCHEMA_SET_REQUEST_PATH,
        **kwargs)


@plugin_function('mrs.set.schema.requiresAuth', shell=True, cli=True, web=True)
def set_require_auth(**kwargs):
    """Sets the requires_auth flag of the given schema

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_name (str): The name of the schema
        service_id (int): The id of the service
        schema_id (int): The id of the schema
        value (bool): The value
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
        The result message as string
    """

    return change_schema(
        change_type=SCHEMA_SET_REQUIRES_AUTH,
        **kwargs)


@plugin_function('mrs.set.schema.itemsPerPage', shell=True, cli=True, web=True)
def set_items_per_page(**kwargs):
    """Sets the items_per_page of a given schema

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_name (str): The name of the schema
        service_id (int): The id of the service
        schema_id (int): The id of the schema
        value (int): The value
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
        The result message as string
    """

    return change_schema(
        change_type=SCHEMA_SET_ITEMS_PER_PAGE,
        **kwargs)


@plugin_function('mrs.set.schema.comments', shell=True, cli=True, web=True)
def set_comments(**kwargs):
    """Sets the comments of a given schema

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_name (str): The name of the schema
        service_id (int): The id of the service
        schema_id (int): The id of the schema
        value (str): The value
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
        The result message as string
    """

    return change_schema(
        change_type=SCHEMA_SET_COMMENTS,
        **kwargs)


@plugin_function('mrs.update.schema', shell=True, cli=True, web=True)
def update_schema(**kwargs):
    """Updates the given schema

    Args:
        **kwargs: Additional options

    Keyword Args:
        schema_name (str): The name of the schema
        service_id (int): The id of the service
        schema_id (int): The id of the schema
        value (str): The values as dict #TODO: check why dicts cannot be passed
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
        The result message as string
    """

    return change_schema(
        change_type=SCHEMA_SET_ALL,
        **kwargs)
