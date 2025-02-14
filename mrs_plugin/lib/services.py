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

from mrs_plugin.lib import core
from mrs_plugin.lib.MrsDdlExecutor import MrsDdlExecutor

import re


def prompt_for_url_context_root(default=None):
    """Prompts the user for the url_context_root

    Returns:
        The url_context_root as str
    """
    return core.prompt(
        "Please enter the context path for this service [/myService]: ",
        {'defaultValue': default if default else "/myService"}).strip()


def prompt_for_service_protocol(default=None):
    """Prompts the user for the supported service protocols

    Returns:
        The service protocols as str
    """

    protocols = core.prompt_for_list_item(
        item_list=[
            "HTTP", "HTTPS",
            # "WEBSOCKET VIA HTTP", "WEBSOCKET VIA HTTPS"
        ],
        prompt_caption=(
            "Please select the protocol(s) the service should support "
            f"[{default if default else 'HTTP,HTTPS'}]: "),
        prompt_default_value=default if default else 'HTTP,HTTPS',
        print_list=True,
        allow_multi_select=True)

    return ','.join(protocols)


def format_service_listing(services, print_header=False):
    """Formats the listing of MRS services

    Args:
        services (list): A list of services as dicts
        print_header (bool): If set to true, a header is printed


    Returns:
        The formatted list of services
    """

    if print_header:
        output = (f"{'ID':>3} {'PATH':25} {'ENABLED':8} {'PROTOCOL(s)':20} "
                  f"{'DEFAULT':9}\n")
    else:
        output = ""

    for i, item in enumerate(services, start=1):
        url = item.get('url_host_name') + item.get('url_context_root')
        output += (f"{i:>3} {url[:24]:25} "
                   f"{'Yes' if item['enabled'] else '-':8} "
                   f"{','.join(item['url_protocol'])[:19]:20} "
                   f"{'Yes' if item['is_current'] else '-':5}")
        if i < len(services):
            output += "\n"

    return output


def format_metadata(host_ctx, version):
    """Formats the service metadata details

    Args:
        host_ctx (str): The url root context path
        version (int): The version in the metadata audit log

    Returns:
        The metadata details in a tabular string
    """
    return f"{'ID':>3} {'ROOT PATH':25} {'VERSION':15}\n{1:>3} {host_ctx[:24]:25} {version}"


def add_service(session, url_host_name, service):
    if "options" in service:
        service["options"] = core.convert_json(service["options"])
    else:
        service["options"] = {
            "headers": {
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Origin, X-Auth-Token",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
            },
            "http": {
                "allowedOrigin": "auto"
            },
            "logging": {
                "exceptions": True,
                "request": {
                    "body": True,
                    "headers": True
                },
                "response": {
                    "body": True,
                    "headers": True
                }
            },
            "returnInternalErrorDetails": True
        }

    path = service.get("url_context_root").lower()
    if path == "/mrs":
        raise Exception(
            f'The REST service path `{path}` is reserved and cannot be used.')

    # If there is no id for the given host yet, create a host entry
    if service.get("url_host_id") is None:
        host = core.select(table="url_host",
                           where=["name=?"]
                           ).exec(session, [url_host_name if url_host_name else '']).first

        if host:
            service["url_host_id"] = host["id"]
        else:
            service["url_host_id"] = core.get_sequence_id(session)
            core.insert(table="url_host",
                        values={
                            "id": service["url_host_id"],
                            "name": url_host_name or ''
                        }
                        ).exec(session)

    service["id"] = core.get_sequence_id(session)

    # metadata column was only added in 3.0.0
    current_version = core.get_mrs_schema_version(session)
    if current_version[0] <= 2:
        service.pop("metadata", None)

    if not core.insert(table="service", values=service).exec(session).success:
        raise Exception("Failed to add the new service.")

    return service["id"]


def delete_service(session, service_id):
    res = core.delete(table="service", where=["id=?"]).exec(
        session, params=[service_id])

    if not res.success:
        raise Exception(
            f"The specified service with id {service_id} was not found.")


def delete_services(session, service_ids):
    for service_id in service_ids:
        delete_service(session, service_id)


def update_services(session, service_ids, value):
    """Makes a given change to a MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_ids (int): The list of service ids to change
        value (dict): The value to be set as a dict for all values that will be changed
        session (object): The database session to use

    Returns:
        The result message as string
    """
    # Update all given services
    for service_id in service_ids:

        service = get_service(session, service_id=service_id)

        if service is None:
            raise Exception(
                f"The specified service with id {core.convert_id_to_string(service_id)} was not found.")

        if "url_host_name" in value:
            host = core.select(table="url_host",
                               where="name=?"
                               ).exec(session, [value["url_host_name"]]).first

            if host:
                host_id = host["id"]
            else:
                host_id = core.get_sequence_id(session)
                core.insert(table="url_host",
                            values={
                                "id": host_id,
                                "name": value["url_host_name"]
                            }
                            ).exec(session)

            del value["url_host_name"]
            value["url_host_id"] = host_id

        # metadata column was only added in 3.0.0
        current_version = core.get_mrs_schema_version(session)
        if current_version[0] <= 2:
            value.pop("metadata", None)
            value.pop("published", None)

        core.update("service",
                    sets=value,
                    where=["id=?"]).exec(session, [service_id])


def query_services(session, service_id: bytes = None, url_context_root=None, url_host_name=None,
                   get_default=False, developer_list=None, auth_app_id=None):
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
        url_host_name (str): The host name for this service
        get_default (bool): Whether to return the default service

    Returns:
        The list of found services.
    """
    if url_context_root and not url_context_root.startswith('/'):
        raise Exception("The url_context_root has to start with '/'.")


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
    elif url_context_root is not None and url_host_name is not None and developer_list is None:
        wheres.append("h.name = ?")
        wheres.append("url_context_root = ?")
        params.append(url_host_name)
        params.append(url_context_root)
        wheres.append("se.in_development IS NULL")
    elif get_default:
        # if nothing else is supplied and get_default is True, then get the default service
        wheres = ["se.id = ?"]
        params = [current_service_id, current_service_id]

        return core.MrsDbExec(sql + core._generate_where(wheres), params).exec(session).items

    having = ""
    if developer_list is not None:
        def quote(s):
            return f"'{s}'"
        # Build the sorted_developer string that matches the selected column, use same quoting as MySQL
        developer_list.sort()
        sorted_developers = ",".join(
            dev if re.match("^[A-Za-z0-9_-]*$", dev) else
            quote(re.sub(r"(['\\])", "\\\\\\1", dev, 0, re.MULTILINE)) for dev in developer_list)
        having = "\nHAVING h.name = ? AND url_context_root = ? AND sorted_developers = ?"
        params.append(url_host_name)
        params.append(url_context_root)
        params.append(sorted_developers)

    result = core.MrsDbExec(
        sql + core._generate_where(wheres) + having
        + "\nORDER BY se.url_context_root, h.name, sorted_developers", params).exec(session).items

    if len(result) == 0 and get_default:
        # No service was found s if we should get the default, then lets get it
        wheres = ["se.id = ?"]
        params = [current_service_id, current_service_id]

        result = core.MrsDbExec(
            sql + core._generate_where(wheres), params).exec(session).items

    return result


def get_service(session, service_id: bytes = None, url_context_root=None, url_host_name=None,
                get_default=False, developer_list=None):
    """Gets a specific MRS service

    If no service is specified, the service that is set as current service is
    returned if it was defined before

    Args:
        session (object): The database session to use.
        service_id: The id of the service
        url_context_root (str): The context root for this service
        url_host_name (str): The host name for this service
        get_default (bool): Whether to return the default service

    Returns:
        The service as dict or None on error in interactive mode
    """
    result = query_services(session, service_id=service_id, url_context_root=url_context_root,
                            url_host_name=url_host_name, get_default=get_default,
                            developer_list=developer_list)
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
    connection_settings = list(filter(lambda item: item["connection"] == core.get_session_uri(session),
                                      current_objects))

    if not connection_settings:
        return None

    return connection_settings[0].get("current_service_id")


def set_current_service_id(session, service_id: bytes):
    if not session:
        raise RuntimeError("A valid session is required.")

    config = core.ConfigFile()

    current_objects = config.settings.get("current_objects", [])

    # Try to find the settings for the connection which the service resides on
    connection_settings = list(filter(lambda item: item["connection"] == core.get_session_uri(session),
                                      current_objects))

    if connection_settings:
        # Found the settings for this host
        connection_settings[0]["current_service_id"] = service_id
    else:
        # The settings for this host do not exist yet....create them.
        current_objects.append({
            "connection": core.get_session_uri(session),
            "current_service_id": service_id
        })

    config.settings["current_objects"] = current_objects
    config.store()


def get_create_statement(session, service:bytes, include_all_objects: bool=False) -> str:
    executor = MrsDdlExecutor(
        session=session,
        current_service_id=service["id"])

    executor.showCreateRestService({
        "current_operation": "SHOW CREATE REST SERVICE",
        **service,
        "include_all_objects": include_all_objects ,
    })

    if executor.results[0]["type"] == "error":
        raise Exception(executor.results[0]['message'])

    return executor.results[0]['result'][0]['CREATE REST SERVICE']
