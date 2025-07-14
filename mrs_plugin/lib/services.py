# Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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

from mrs_plugin.lib import (
    core,
    roles,
    schemas,
    content_sets,
    auth_apps,
    database,
    script,
)

import re
import os
from zipfile import ZipFile, is_zipfile
import copy
import json
import shutil
from datetime import datetime
import mysqlsh
from typing import Optional


DEFAULT_OPTIONS = {
    "headers": {
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Origin, X-Auth-Token",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    },
    "http": {"allowedOrigin": "auto"},
    "logging": {
        "exceptions": True,
        "request": {"body": True, "headers": True},
        "response": {"body": True, "headers": True},
    },
    "returnInternalErrorDetails": True,
    "includeLinksInResults": False,
}


def prompt_for_url_context_root(default=None):
    """Prompts the user for the url_context_root

    Returns:
        The url_context_root as str
    """
    return core.prompt(
        "Please enter the context path for this service [/myService]: ",
        {"defaultValue": default if default else "/myService"},
    ).strip()


def prompt_for_service_protocol(default=None):
    """Prompts the user for the supported service protocols

    Returns:
        The service protocols as str
    """

    protocols = core.prompt_for_list_item(
        item_list=[
            "HTTP",
            "HTTPS",
            # "WEBSOCKET VIA HTTP", "WEBSOCKET VIA HTTPS"
        ],
        prompt_caption=(
            "Please select the protocol(s) the service should support "
            f"[{default if default else 'HTTP,HTTPS'}]: "
        ),
        prompt_default_value=default if default else "HTTP,HTTPS",
        print_list=True,
        allow_multi_select=True,
    )

    return ",".join(protocols)


def format_service_listing(services, print_header=False):
    """Formats the listing of MRS services

    Args:
        services (list): A list of services as dicts
        print_header (bool): If set to true, a header is printed


    Returns:
        The formatted list of services
    """

    if print_header:
        output = (
            f"{'ID':>3} {'PATH':25} {'ENABLED':8} {'PROTOCOL(s)':20} "
            f"{'DEFAULT':9}\n"
        )
    else:
        output = ""

    for i, item in enumerate(services, start=1):
        url = item.get("url_host_name") + item.get("url_context_root")
        output += (
            f"{i:>3} {url[:24]:25} "
            f"{'Yes' if item['enabled'] else '-':8} "
            f"{','.join(item['url_protocol'])[:19]:20} "
            f"{'Yes' if item['is_current'] else '-':5}"
        )
        if i < len(services):
            output += "\n"

    return output


def format_metadata(host_ctx: Optional[str] = None, version: Optional[str] = None):
    """Formats the service metadata details

    Args:
        host_ctx (str): The url root context path
        version (int): The version in the metadata audit log

    Returns:
        The metadata details in a tabular string
    """
    table = f"{'ID':>3} {'ROOT PATH':25} {'VERSION':15}"

    if host_ctx is None:
        return table

    return f"{table}\n{1:>3} {host_ctx[:24]:25} {version}"


def add_service(session, url_host_name, service):
    if "options" in service:
        service["options"] = core.convert_json(service["options"])
    else:
        service["options"] = DEFAULT_OPTIONS

    path = service.get("url_context_root").lower()
    if path == "/mrs":
        raise Exception(
            f"The REST service path `{path}` is reserved and cannot be used."
        )

    # If there is no id for the given host yet, create a host entry
    if service.get("url_host_id") is None:
        host = (
            core.select(table="url_host", where=["name=?"])
            .exec(session, [url_host_name if url_host_name else ""])
            .first
        )

        if host:
            service["url_host_id"] = host["id"]
        else:
            service["url_host_id"] = core.get_sequence_id(session)
            core.insert(
                table="url_host",
                values={"id": service["url_host_id"], "name": url_host_name or ""},
            ).exec(session)

    service["id"] = core.get_sequence_id(session)

    # metadata column was only added in 3.0.0
    current_version = core.get_mrs_schema_version(session)
    if current_version[0] <= 2:
        service.pop("metadata", None)

    if not core.insert(table="service", values=service).exec(session).success:
        raise Exception("Failed to add the new service.")

    return service["id"]


def validate_service_path(session, path):
    """Ensures the given path is valid in any of the registered services.

    Args:
        session (object): The database session to use.
        path (str): The path to validate.

    Returns:
        service, schema, content_set as dict.
    """
    if not path:
        return None, None, None

    service = None
    schema = None
    content_set = None

    # Match path against services and schemas
    all_services = get_services(session)
    for item in all_services:
        host_ctx = item.get("host_ctx")
        if host_ctx == path[: len(host_ctx)]:
            service = item
            if len(path) > len(host_ctx):
                sub_path = path[len(host_ctx) :]

                db_schemas = schemas.get_schemas(
                    service_id=service.get("id"), session=session
                )

                if db_schemas:
                    for item in db_schemas:
                        request_path = item.get("request_path")
                        if request_path == sub_path[: len(request_path)]:
                            schema = item
                            break

                if not schema:
                    content_sets_local = content_sets.get_content_sets(
                        service_id=service.get("id"), session=session
                    )

                    if content_sets_local:
                        for item in content_sets_local:
                            request_path = item.get("request_path")
                            if request_path == sub_path[: len(request_path)]:
                                content_set = item
                            break

                if not schema and not content_set:
                    raise ValueError(f"The given schema or content set was not found.")
            break

    if not service:
        raise ValueError(f"The given MRS service was not found.")

    return service, schema, content_set


def delete_service(session, service_id):
    res = core.delete(table="service", where=["id=?"]).exec(
        session, params=[service_id]
    )

    if not res.success:
        raise Exception(f"The specified service with id {service_id} was not found.")


def delete_services(session, service_ids):
    for service_id in service_ids:
        delete_service(session, service_id)


def update_services(session, service_ids, value, merge_options=False):
    """Makes a given change to a MRS service

    Args:
        session: The database session to use
        service_ids: The list of service ids to change
        value: The value to be set as a dict for all values that will be changed
        merge_options: If set to True, specified options will be merged rather than overwritten

    Returns:
        The result message as string
    """
    # Update all given services
    for service_id in service_ids:

        service = get_service(session, service_id=service_id)

        if service is None:
            raise Exception(
                f"The specified service with id {core.convert_id_to_string(service_id)} was not found."
            )

        if "url_host_name" in value:
            host = (
                core.select(table="url_host", where="name=?")
                .exec(session, [value["url_host_name"]])
                .first
            )

            if host:
                host_id = host["id"]
            else:
                host_id = core.get_sequence_id(session)
                core.insert(
                    table="url_host",
                    values={"id": host_id, "name": value["url_host_name"]},
                ).exec(session)

            del value["url_host_name"]
            value["url_host_id"] = host_id

        # metadata column was only added in 3.0.0
        current_version = core.get_mrs_schema_version(session)
        if current_version[0] <= 2:
            value.pop("metadata", None)
            value.pop("published", None)

        # Reset an empty in_development.developers list to None
        in_development = value.get("in_development", None)
        if in_development is not None:
            developers = in_development.get("developers", None)
            if developers is not None and len(developers) == 0:
                value["in_development"] = None

        # Prepare the merge of options, if requested
        if merge_options:
            options = value.get("options", None)
            # Check if there are options set already, if so, merge the options
            if options is not None:
                row = (
                    core.MrsDbExec(
                        """
                    SELECT options IS NULL AS options_is_null
                    FROM `mysql_rest_service_metadata`.`service`
                    WHERE id = ?""",
                        [service_id],
                    )
                    .exec(session)
                    .first
                )
                if row and row["options_is_null"] == 1:
                    merge_options = False
                else:
                    value.pop("options")

        if value:
            core.update("service", sets=value, where=["id=?"]).exec(
                session, [service_id]
            )

        # Merge options if requested
        if merge_options and options is not None:
            core.MrsDbExec(
                """
                UPDATE `mysql_rest_service_metadata`.`service`
                SET options = JSON_MERGE_PATCH(options, ?)
                WHERE id = ?
                """,
                [options, service_id],
            ).exec(session)


def query_services(
    session,
    service_id: bytes = None,
    url_context_root=None,
    url_host_name="",
    get_default=False,
    developer_list=None,
    auth_app_id=None,
):
    """Query MRS services

    Query the existing services. Filters may be applied as the 'service_id' or
    the 'url_context_root' with the 'url_host_name'.

    In the case no service is found, the default service may be fetched if the
    'get_default' is set to True.

    To get the default service, don't set any other filters and set 'get_default'
    to True.

    Args:
        session (object): The database session to use.
        service_id: The id of the service
        url_context_root (str): The context root for this service
        get_default (bool): Whether to return the default service

    Returns:
        The list of found services.
    """
    if url_context_root and not url_context_root.startswith("/"):
        raise Exception("The url_context_root has to start with '/'.")

    url_host_name = ""  # no longer supported

    current_service_id = get_current_service_id(session)
    if not current_service_id:
        current_service_id = "0x00000000000000000000000000000000"

    wheres = []
    params = [current_service_id]

    current_version = core.get_mrs_schema_version(session)
    if current_version[0] <= 2:
        # Build SQL based on which input has been provided
        sql = f"""
            SELECT se.id, se.enabled, se.url_protocol, h.name AS url_host_name,
                se.url_context_root, se.comments, se.options, se.url_host_id,
                CONCAT(h.name, se.url_context_root) AS host_ctx,
                CONCAT(h.name, se.url_context_root) AS full_service_path,
                se.auth_path, se.auth_completed_url,
                se.auth_completed_url_validation,
                se.auth_completed_page_content,
                se.id = ? as is_current,
                NULL AS in_development,
                NULL AS sorted_developers,
                se.name
            FROM `mysql_rest_service_metadata`.`service` se
                LEFT JOIN `mysql_rest_service_metadata`.url_host h
                    ON se.url_host_id = h.id
            """
    else:
        sql = f"""
            SELECT se.id, se.enabled, se.published, se.url_protocol, h.name AS url_host_name,
                se.url_context_root, se.comments, se.options, se.url_host_id,
                CONCAT(h.name, se.url_context_root) AS host_ctx,
                (SELECT CONCAT(COALESCE(CONCAT(GROUP_CONCAT(IF(item REGEXP '^[A-Za-z0-9_]+$', item, QUOTE(item)) ORDER BY item), '@'), ''), h.name, se.url_context_root) FROM JSON_TABLE(
                    se.in_development->>'$.developers', '$[*]' COLUMNS (item text path '$')
                    ) AS jt) AS full_service_path,
                se.auth_path, se.auth_completed_url,
                se.auth_completed_url_validation,
                se.auth_completed_page_content,
                se.metadata, se.parent_id,
                se.id = ? as is_current,
                se.in_development,
                (SELECT GROUP_CONCAT(IF(item REGEXP '^[A-Za-z0-9_]+$', item, QUOTE(item)) ORDER BY item)
                    FROM JSON_TABLE(
                    se.in_development->>'$.developers', '$[*]' COLUMNS (item text path '$')
                    ) AS jt) AS sorted_developers,
                se.name,
                (SELECT JSON_ARRAYAGG(aa.name) FROM `mysql_rest_service_metadata`.`service_has_auth_app` sa2
                    JOIN `mysql_rest_service_metadata`.`auth_app` AS aa ON
                        sa2.auth_app_id = aa.id
                WHERE sa2.service_id = se.id) AS auth_apps
            FROM `mysql_rest_service_metadata`.`service` se
                LEFT JOIN `mysql_rest_service_metadata`.url_host h
                    ON se.url_host_id = h.id
            """

        if auth_app_id is not None:
            sql += """
                JOIN `mysql_rest_service_metadata`.`service_has_auth_app` sa
                    ON se.id = sa.service_id AND sa.auth_app_id = ?
                """
            params.append(auth_app_id)
        # Make sure that each user only sees the services that are either public or the user is a developer of
        # wheres.append("(in_development IS NULL OR "
        #               "SUBSTRING_INDEX(CURRENT_USER(),'@',1) MEMBER OF(in_development->>'$.developers'))")

    if service_id:
        wheres.append("se.id = ?")
        params.append(service_id)
    elif (
        url_context_root is not None
        and url_host_name is not None
        and developer_list is None
    ):
        wheres.append("h.name = ?")
        wheres.append("url_context_root = ?")
        params.append(url_host_name)
        params.append(url_context_root)
        wheres.append("se.in_development IS NULL")
    elif get_default:
        # if nothing else is supplied and get_default is True, then get the default service
        wheres = ["se.id = ?"]
        params = [current_service_id, current_service_id]

        return (
            core.MrsDbExec(sql + core._generate_where(wheres), params)
            .exec(session)
            .items
        )

    having = ""
    if developer_list is not None:

        def quote(s):
            return f"'{s}'"

        # Build the sorted_developer string that matches the selected column, use same quoting as MySQL
        developer_list.sort()
        sorted_developers = ",".join(
            (
                dev
                if re.match("^[A-Za-z0-9_-]*$", dev)
                else quote(re.sub(r"(['\\])", "\\\\\\1", dev, 0, re.MULTILINE))
            )
            for dev in developer_list
        )
        having = (
            "\nHAVING h.name = ? AND url_context_root = ? AND sorted_developers = ?"
        )
        params.append(url_host_name)
        params.append(url_context_root)
        params.append(sorted_developers)

    result = (
        core.MrsDbExec(
            sql
            + core._generate_where(wheres)
            + having
            + "\nORDER BY se.url_context_root, h.name, sorted_developers",
            params,
        )
        .exec(session)
        .items
    )

    if len(result) == 0 and get_default:
        # No service was found s if we should get the default, then lets get it
        wheres = ["se.id = ?"]
        params = [current_service_id, current_service_id]

        result = (
            core.MrsDbExec(sql + core._generate_where(wheres), params)
            .exec(session)
            .items
        )

    return result


def get_service(
    session,
    service_id: bytes = None,
    url_context_root=None,
    url_host_name=None,
    get_default=False,
    developer_list=None,
):
    """Gets a specific MRS service

    If no service is specified, the service that is set as current service is
    returned if it was defined before

    Args:
        session (object): The database session to use.
        service_id: The id of the service
        url_context_root (str): The context root for this service
        get_default (bool): Whether to return the default service

    Returns:
        The service as dict or None on error in interactive mode
    """
    # url_host_name kept as a param for temporary backwards compat, but is no longer supported
    result = query_services(
        session,
        service_id=service_id,
        url_context_root=url_context_root,
        url_host_name="",
        get_default=get_default,
        developer_list=developer_list,
    )
    return result[0] if len(result) == 1 else None


def get_services(session):
    """Get a list of MRS services

    Args:
        session (object): The database session to use.

    Returns:
        List of dicts representing the services
    """
    return query_services(session)


def get_current_service(session):
    service_id = get_current_service_id(session)

    return get_service(session=session, service_id=service_id)


def get_current_service_id(session):
    """Returns the current service

    Args:
        session (object): The database session to use.

    Returns:
        The current or default service or None if no default is set
    """
    if not session:
        raise RuntimeError("A valid session is required.")

    config = core.ConfigFile()

    current_objects = config.settings.get("current_objects", [])

    # Try to find the settings for the connection which the service resides on
    connection_settings = list(
        filter(
            lambda item: item["connection"] == core.get_session_uri(session),
            current_objects,
        )
    )

    if not connection_settings:
        return None

    return connection_settings[0].get("current_service_id")


def set_current_service_id(session, service_id: bytes):
    if not session:
        raise RuntimeError("A valid session is required.")

    config = core.ConfigFile()

    current_objects = config.settings.get("current_objects", [])

    # Try to find the settings for the connection which the service resides on
    connection_settings = list(
        filter(
            lambda item: item["connection"] == core.get_session_uri(session),
            current_objects,
        )
    )

    if connection_settings:
        # Found the settings for this host
        connection_settings[0]["current_service_id"] = service_id
    else:
        # The settings for this host do not exist yet....create them.
        current_objects.append(
            {
                "connection": core.get_session_uri(session),
                "current_service_id": service_id,
            }
        )

    config.settings["current_objects"] = current_objects
    config.store()


def get_service_create_statement(
    session,
    service: dict,
    include_database_endpoints: bool,
    include_static_endpoints: bool,
    include_dynamic_endpoints: bool,
) -> str:
    output = []
    result = []
    service_linked_auth_apps = []
    service_linked_auth_apps = auth_apps.get_auth_apps(session, service["id"])

    # create the service
    output.append(f'CREATE OR REPLACE REST SERVICE {service.get("host_ctx")}')

    if service.get("enabled") != 1:
        output.append("    DISABLED")
    if service.get("comments"):  # ignore either None or empty
        output.append(f"    COMMENT {core.squote_str(service.get("comments"))}")

    if service.get("published", False):
        output.append(f"    PUBLISHED")

    auth = []
    if service.get("auth_path") != "/authentication":
        auth.append(f'        PATH {core.quote_auth_app(service.get("auth_path"))}')
    if service.get("auth_completed_url"):  # ignore either None or empty
        auth.append(
            f'        REDIRECTION {core.quote_str(service.get("auth_completed_url"))}'
        )
    if service.get("auth_completed_url_validation"):  # ignore either None or empty
        auth.append(
            f'        VALIDATION {core.quote_str(service.get("auth_completed_url_validation"))}'
        )
    if service.get("auth_completed_page_content"):  # ignore either None or empty
        auth.append(
            f'        PAGE CONTENT {core.quote_str(service.get("auth_completed_page_content"))}'
        )
    if auth:  # ignore either None or empty
        auth.insert(0, f"    AUTHENTICATION")
        output.append("\n".join(auth))

    if service.get("options"):
        output.append(core.format_json_entry("OPTIONS", service.get("options")))
    if service.get("metadata"):
        output.append(core.format_json_entry("METADATA", service.get("metadata")))

    for auth_app in service_linked_auth_apps:
        output.append(
            f"    ADD AUTH APP {core.quote_auth_app(auth_app["name"])} IF EXISTS"
        )

    result.append("\n".join(output) + ";")

    if include_database_endpoints:
        for role in roles.get_roles(session, service["id"], include_global=False):
            result.append(roles.get_role_create_statement(session, role))

        result += [
            schemas.get_schema_create_statement(session, schema, True)
            for schema in schemas.get_schemas(session, service["id"])
            if schema["schema_type"] != "SCRIPT_MODULE"
        ]

    if include_static_endpoints or include_dynamic_endpoints:
        result += [
            content_sets.get_content_set_create_statement(
                session, content_set, include_dynamic_endpoints
            )
            for content_set in content_sets.get_content_sets(session, service["id"])
        ]

    return "\n\n".join(result)


def store_service_create_statement(
    session,
    service: dict,
    file_path: str,
    zip: bool,
    include_database_endpoints: bool = False,
    include_static_endpoints: bool = False,
    include_dynamic_endpoints: bool = False,
):
    file_content = get_service_create_statement(
        session,
        service,
        include_database_endpoints,
        include_static_endpoints,
        include_dynamic_endpoints,
    )

    if zip and file_path.endswith(".zip"):
        file_path = file_path[: -len(".zip")]

    with open(file_path, "w") as f:
        f.write(file_content)

    if zip:
        with ZipFile(f"{file_path}.zip", "w") as f:
            f.write(file_path, arcname="service.mrs.sql")
        os.remove(file_path)


def store_project_validations(
    session,
    destination: str,
    services: list,
    schemas: list,
    project_settings: dict,
    create_zip: bool,
):
    core.validate_path_for_filesystem(destination)

    for service_data in services:
        service_name = service_data["name"]
        service = get_service(session, url_context_root=service_name)
        if service is None:
            raise Exception(f"The service '{service_name}' was not found.")

    for schema_request_path in schemas:
        file_path = schema_request_path.get("file_path")
        if file_path and not (
            os.path.exists(file_path)
            and (os.path.isfile(file_path) or os.path.isdir(file_path))
        ):

            raise Exception(f"The given schema '{file_path}' was not found")

    if project_settings["icon_path"]:
        if not os.path.isfile(project_settings["icon_path"]):
            raise Exception("The icon path is not valid.")


def store_project(
    session,
    destination: str,
    services: list,
    schemas: list,
    project_settings: dict,
    create_zip: bool,
):

    # expand the destination path
    destination = os.path.expanduser(destination)

    config = {
        "name": project_settings["name"],
        "version": project_settings["version"],
        "restServices": [],
        "schemas": [],
        "creationDate": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }

    if project_settings["publisher"]:
        config["publisher"] = project_settings["publisher"]

    if project_settings["description"]:
        config["description"] = project_settings["description"]

    # remove the ".zip" from the destination to create the temp directory
    temp_dir = (
        destination[:-4] if create_zip and destination.endswith(".zip") else destination
    )

    os.makedirs(temp_dir, exist_ok=True)

    # copy icon if set to do so
    if project_settings["icon_path"]:
        config["icon"] = f"appIcon{os.path.splitext(project_settings["icon_path"])[1]}"
        icon_target_path = os.path.join(temp_dir, config["icon"])
        shutil.copy(project_settings["icon_path"], icon_target_path)

    for service_data in services:
        service = get_service(session, url_context_root=service_data["name"])

        # create the path by removing the '/' in the service request path
        target_file_name = f"{service_data["name"][1:]}.service.mrs.sql"
        file_path = os.path.join(temp_dir, target_file_name)

        store_service_create_statement(
            session,
            service,
            file_path,
            False,
            service_data["include_database_endpoints"],
            service_data["include_static_endpoints"],
            service_data["include_dynamic_endpoints"],
        )
        config["restServices"].append(
            {
                "serviceName": service_data["name"],
                "fileName": target_file_name,
            }
        )

    for schema_data in schemas:
        schema_target = os.path.join(temp_dir, schema_data["name"])
        schema_format = None
        schema_relative_path = core.make_string_valid_for_filesystem(
            schema_data["name"]
        )

        if schema_data.get("file_path"):
            # The schema dump already exists, so we just need to copy it
            if os.path.isdir(schema_data["file_path"]):
                schema_format = "folder"

                shutil.copytree(schema_data["file_path"], schema_target)
            else:
                schema_target = f"{schema_target}.sql"
                schema_relative_path = f"{schema_relative_path}.sql"
                schema_format = "sqlFile"

                shutil.copy(schema_data["file_path"], schema_target)
        else:
            # Create a schema dump into the target directory
            schema_format = "dump"

            # Set the mysqlsh session to the one that was given
            if "shell.Object" in str(type(session)):
                mysqlsh.globals.shell.set_session(session)
            else:
                mysqlsh.globals.shell.set_session(session.session)
            mysqlsh.globals.util.dump_schemas(
                [schema_data["name"]],
                f"file://{schema_target}",
                {
                    "skipUpgradeChecks": True,
                    "showProgress": False,
                },
            )

        config["schemas"].append(
            {
                "schemaName": schema_data["name"],
                "path": schema_relative_path,
                "format": schema_format,  # sqlFile or folder or dump
            }
        )

    with open(os.path.join(temp_dir, "mrs.package.json"), "w") as f:
        json.dump(config, f, indent=4)

    if create_zip:
        zf = ZipFile(destination, "w")
        for dirname, subdirs, files in os.walk(temp_dir):
            for filename in files:
                zip_filename = os.path.join(dirname, filename)[
                    len(temp_dir) + 1 :
                ]  # truncate the base directory
                zf.write(os.path.join(dirname, filename), arcname=zip_filename)
        zf.close()

        shutil.rmtree(temp_dir)


def run_sql_script(session, sql_script, is_mrs: bool = False):
    commands = mysqlsh.mysql.split_script(sql_script)

    sql_mode = session.run_sql("select @@session.sql_mode").fetch_one()[0]
    for command in commands:
        command = command.strip()

        if not command:
            continue

        if is_mrs:
            script.run_mrs_script(
                command,
                **{"session": session, "sql_mode": sql_mode, "state_data": {}},
            )
        else:
            session.run_sql(command)


def load_service(session, path: str):
    with open(path, "r") as f:
        sql_script = f.read()

    run_sql_script(session, sql_script=sql_script, is_mrs=True)


from tempfile import TemporaryDirectory


def load_project(session, path: str):

    if is_zipfile(path):
        with TemporaryDirectory(delete=False) as base_directory:
            zip_file = ZipFile(path)
            zip_file.extractall(base_directory)
    else:
        base_directory = path

    project_file = os.path.join(base_directory, "mrs.package.json")
    project_config = None

    with open(project_file, "r") as f:
        project_config = json.load(f)

    with core.MrsDbTransaction(session):
        for schema in project_config.get("schemas", []):
            schema_path = os.path.join(base_directory, schema["path"])
            if schema["format"] == "sqlFile":
                with open(schema_path) as f:
                    run_sql_script(session, f.read())
            elif schema["format"] == "folder":
                folder_path = schema_path
                only_files = [
                    f
                    for f in os.listdir(folder_path)
                    if os.path.isfile(os.path.join(folder_path, f))
                    and f.endswith(".sql")
                ]

                for file in only_files:
                    file = os.path.join(schema_path, file)
                    with open(file) as f:
                        run_sql_script(session, f.read())

            elif schema["format"] == "dump":
                if "shell.Object" in str(type(session)):
                    mysqlsh.globals.shell.set_session(session)
                else:
                    mysqlsh.globals.shell.set_session(session.session)

                session.run_sql("SET GLOBAL local_infile = 'ON'")
                mysqlsh.globals.util.load_dump(schema_path, ignoreExistingObjects=True)
            else:
                raise Exception("Invalid schema format.")

        for service in project_config.get("restServices", []):
            with open(os.path.join(base_directory, service["fileName"])) as f:
                run_sql_script(session, f.read())


def get_service_sdk_data(session, service_id, binary_formatter=None):
    return database.get_sdk_service_data(
        session, service_id, binary_formatter=binary_formatter
    )


def clone_service(session, service, new_url_context_root, dev_list):
    new_service = copy.deepcopy(service)

    # Cleanup the existing data to properly insert it again
    new_service.pop("id", None)
    new_service.pop("url_host_name", None)
    new_service.pop("host_ctx", None)
    new_service.pop("full_service_path", None)
    new_service.pop("is_current", None)
    new_service.pop("sorted_developers", None)
    new_service.pop("auth_apps", None)
    new_service.pop("merge_options", None)

    new_service["url_context_root"] = new_url_context_root
    new_service["published"] = False
    new_service["in_development"] = {"developers": dev_list}

    # Add the service
    new_service_id = add_service(
        session=session, url_host_name=None, service=new_service
    )

    # Create links for the auth apps
    for service_auth_app in auth_apps.get_auth_apps(session, service["id"]):
        auth_apps.link_auth_app(session, service_auth_app["id"], new_service_id)

    # Clone the schemas
    for schema in schemas.get_schemas(session, service["id"]):
        schemas.clone_schema(session, schema, new_service_id)

    # Clone the content sets
    for content_set in content_sets.get_content_sets(session, service["id"]):
        content_sets.clone_content_set(session, content_set, new_service_id)

    return
