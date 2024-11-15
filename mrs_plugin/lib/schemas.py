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

from mrs_plugin.lib import core, database, db_objects
from mrs_plugin.lib.MrsDdlExecutor import MrsDdlExecutor


def format_schema_listing(schemas, print_header=False):
    """Formats the listing of schemas

    Args:
        schemas (list): A list of schemas as dicts
        print_header (bool): If set to true, a header is printed


    Returns:
        The formatted list of services
    """

    if not schemas:
        return "No items available."

    if print_header:
        output = (f"{'ID':>3} {'PATH':38} {'SCHEMA NAME':30} {'ENABLED':8} "
                  f"{'AUTH':9}\n")
    else:
        output = ""

    for i, item in enumerate(schemas, start=1):
        url = (item['host_ctx'] + item['request_path'])
        output += (f"{i:>3} {url[:37]:38} "
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
        "Should the schema require authentication? [y/N]: ",
        {'defaultValue': 'n'}).strip().lower() == 'y'


def prompt_for_items_per_page() -> int:
    while True:
        result = core.prompt(
            "How many items should be listed per page? [Schema Default]: ",
            {'defaultValue': '25'}).strip()

        try:
            int_result = int(result)
            return int_result
        except:
            print("Required an integer value.")
            continue


def delete_schema(session, schema_id):
    if not schema_id:
        raise ValueError("No schema_id given.")

    result = core.delete(table="db_schema", where=["id=?"]).exec(
        session, params=[schema_id])

    if not result.success:
        raise Exception(
            f"The specified schema with id {core.convert_id_to_string(schema_id)} was not found.")


def delete_schemas(session, schemas: list):
    if not schemas:
        raise ValueError("The specified schema was not found.")

    for schema_id in schemas:
        delete_schema(session, schema_id)


def update_schema(session, schemas: list, value: dict):
    if not schemas:
        raise ValueError("The specified schema was not found.")

    # Update all given services
    for schema_id, host_ctx in schemas.items():
        schema = get_schema(session=session, schema_id=schema_id)

        if not schema:
            raise Exception(
                f"The specified schema with id {core.convert_id_to_string(schema_id)} was not "
                "found.")

        # metadata column was only added in 3.0.0
        current_version = core.get_mrs_schema_version(session)
        if current_version[0] <= 2:
            value.pop("metadata", None)

        core.update(table="db_schema",
                    sets=value,
                    where=["id=?"]
                    ).exec(session, [schema_id])


def query_schemas(session, schema_id=None, service_id=None,
                  schema_name=None, request_path=None, include_enable_state=None, auto_select_single=False):

    if not session:
        raise ValueError("The session is invalid.")

    if schema_id is None and auto_select_single:
        record = core.select(table="db_schema",
                             cols=["count(*) as service_count", "min(id)"]
                             ).exec(session).first

        if record["service_count"] == 1:
            schema_id = record["id"]

    if request_path and not request_path.startswith('/'):
        raise Exception("The request_path has to start with '/'.")

    # Build SQL based on which input has been provided

    # metadata column was only added in 3.0.0
    current_version = core.get_mrs_schema_version(session)
    if current_version[0] <= 2:
        sql = """
            SELECT sc.id, sc.name, sc.service_id, sc.request_path,
                sc.requires_auth, sc.enabled, sc.items_per_page, sc.comments,  se.url_host_id,
                CONCAT(h.name, se.url_context_root) AS host_ctx,
                sc.options
            FROM `mysql_rest_service_metadata`.db_schema sc
                LEFT OUTER JOIN `mysql_rest_service_metadata`.service se
                    ON se.id = sc.service_id
                LEFT JOIN `mysql_rest_service_metadata`.url_host h
                    ON se.url_host_id = h.id
            """
    else:
        sql = """
            SELECT sc.id, sc.name, sc.service_id, sc.request_path,
                sc.requires_auth, sc.enabled, sc.items_per_page, sc.comments, se.url_host_id,
                CONCAT(h.name, se.url_context_root) AS host_ctx,
                sc.options, sc.metadata, sc.schema_type
            FROM `mysql_rest_service_metadata`.db_schema sc
                LEFT OUTER JOIN `mysql_rest_service_metadata`.service se
                    ON se.id = sc.service_id
                LEFT JOIN `mysql_rest_service_metadata`.url_host h
                    ON se.url_host_id = h.id
            """
    params = []
    wheres = []
    if schema_id:
        wheres.append("sc.id = ?")
        params.append(schema_id)
    else:
        if service_id:
            wheres.append("sc.service_id = ?")
            params.append(service_id)
        if request_path:
            wheres.append("sc.request_path = ?")
            params.append(request_path)
        if schema_name:
            wheres.append("sc.name = ?")
            params.append(schema_name)
    if include_enable_state is not None:
        wheres.append("sc.enabled = ?")
        params.append(True if include_enable_state else False)

    sql += core._generate_where(wheres)
    sql += " ORDER BY sc.request_path"

    return core.MrsDbExec(sql, params).exec(session).items


def get_schemas(session, service_id: bytes = None, include_enable_state=None):
    """Returns all schemas for the given MRS service

    Args:
        session (object): The database session to use.
        service_id: The id of the service to list the schemas from
        include_enable_state (bool): Only include schemas with the given
            enabled state

    Returns:
        List of dicts representing the schemas
    """
    return query_schemas(session, service_id=service_id, include_enable_state=include_enable_state)


def get_schema(session, schema_id: bytes = None, service_id: bytes = None,
               schema_name=None, request_path=None, auto_select_single=False):
    """Gets a specific MRS schema

    Args:
        session (object): The database session to use.
        request_path (str): The request_path of the schema
        schema_name (str): The name of the schema
        schema_id: The id of the schema
        service_id: The id of the service

    Returns:
        The schema as dict or None on error in interactive mode
    """
    result = query_schemas(session, schema_id=schema_id, service_id=service_id,
                           schema_name=schema_name, request_path=request_path, auto_select_single=False)
    return result[0] if result else None


def add_schema(session, schema_name, service_id: bytes = None, request_path=None, requires_auth=None,
               enabled=1, items_per_page=None, comments=None, options=None, metadata=None,
               schema_type="DATABASE_SCHEMA", internal=False, schema_id=None):
    """Add a schema to the given MRS service

    Args:
        schema_name (str): The name of the schema to add
        service_id: The id of the service the schema should be added to
        request_path (str): The request_path
        requires_auth (bool): Whether authentication is required to access
            the schema
        enabled (int): The enabled state
        items_per_page (int): The number of items returned per page
        comments (str): Comments for the schema
        options (dict): The options for the schema
        metadata (dict): Metadata of the schema
        schema_type (str): Either "DATABASE_SCHEMA" or "SCRIPT_MODULE"
        session (object): The database session to use.

    Returns:
        The id of the inserted schema
    """
    if schema_type == "DATABASE_SCHEMA":
        # If a schema name has been provided, check if that schema exists
        row = database.get_schema(session, schema_name)

        if row is None:
            raise ValueError(
                f"The given database schema name '{schema_name}' does not exists.")

        schema_name = row["SCHEMA_NAME"]
    elif schema_name is None:
        raise ValueError(
            f"No schema name given.")

    # Get request_path and default it to '/'
    if request_path is None:
        request_path = '/' + schema_name

    core.Validations.request_path(request_path)

    # Get requires_auth
    if requires_auth is None:
        requires_auth = False

    # Get items_per_page
    if items_per_page is None:
        items_per_page = 25

    # Get comments
    if comments is None:
        comments = ""

    if options is None:
        options = ""

    if schema_id is None:
        schema_id = core.get_sequence_id(session)
    values = {
        "id": schema_id,
        "service_id": service_id,
        "name": schema_name,
        "request_path": request_path,
        "requires_auth": int(requires_auth),
        "enabled": enabled,
        "items_per_page": items_per_page,
        "comments": comments,
        "options": core.convert_json(options) if options else None,
        "metadata": core.convert_json(metadata) if metadata else None,
        "schema_type": schema_type,
        "internal": int(internal)}

    # metadata column was only added in 3.0.0
    current_version = core.get_mrs_schema_version(session)
    if current_version[0] <= 2:
        values.pop("metadata", None)
        values.pop("schema_type", None)
        values.pop("internal", None)

    core.insert(table="db_schema", values=values).exec(session)

    return schema_id


def get_current_schema(session):
    """Returns the current schema

    Args:
        session (object): The database session to use.

    Returns:
        The current or default service or None if no default is set
    """
    # Get current_service_id from the global mrs_config
    mrs_config = core.get_current_config()
    current_schema_id = mrs_config.get('current_schema_id')

    current_schema = None
    if current_schema_id:
        current_schema = get_schema(session, schema_id=current_schema_id)

    return current_schema

def get_create_statement(session, schema) -> str:
    executor = MrsDdlExecutor(
        session=session,
        current_schema_id=schema["id"])

    executor.showCreateRestSchema({
        "current_operation": "SHOW CREATE REST SCHEMA",
        "request_path": schema["request_path"],
    })

    if executor.results[0]["type"] == "error":
        raise Exception(executor.results[0]['message'])

    result = [executor.results[0]["result"][0]["CREATE REST SCHEMA "]]

    schema_db_objects = db_objects.get_db_objects(session, schema["id"])

    for schema_db_object in schema_db_objects:
        result.append(db_objects.get_create_statement(session, schema_db_object))

    return "\n".join(result)
