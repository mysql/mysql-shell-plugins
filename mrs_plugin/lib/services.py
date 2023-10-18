# Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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

from mrs_plugin.lib import core


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

    # Check if another service already uses this request path
    core.check_request_path(session, url_host_name +
                            service.get("url_context_root"))

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

    auth_apps = service.pop("auth_apps", [])

    service["id"] = core.get_sequence_id(session)

    if not core.insert(table="service", values=service).exec(session).success:
        raise Exception("Failed to add the new service.")

    for auth_app in auth_apps:
        auth_app.pop("auth_vendor_name", None)
        auth_app.pop("auth_vendor", None)
        auth_app.pop("position", None)
        auth_app["service_id"] = service["id"]
        auth_app["id"] = core.get_sequence_id(session)
        core.insert(table="auth_app", values=auth_app).exec(session)

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
    auth_apps = value.pop("auth_apps", None)

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

        core.update("service",
                    sets=value,
                    where=["id=?"]).exec(session, [service_id])

        if auth_apps is not None:
            auth_apps_in_db = core.select(table="auth_app",
                                          where="service_id=?"
                                          ).exec(session, [service_id]).items

            for auth_app_in_db in auth_apps_in_db:
                if auth_app_in_db["id"] not in [app["id"] for app in auth_apps]:
                    core.delete(table="auth_app", where="id=?").exec(
                        session, [auth_app_in_db["id"]])

            for auth_app in auth_apps:
                id = auth_app.pop("id", None)
                auth_app.pop("auth_vendor_name", None)
                auth_app.pop("auth_vendor", None)
                auth_app.pop("position", None)

                # force the current service id (we could also remove it and don't allow to update this)
                auth_app["service_id"] = service_id

                if id:
                    core.update(table="auth_app", sets=auth_app,
                                where="id=?").exec(session, [id])
                else:
                    auth_app["id"] = core.get_sequence_id(session)
                    core.insert(table="auth_app",
                                values=auth_app).exec(session)


def query_services(session, service_id: bytes = None, url_context_root=None, url_host_name=None,
                   get_default=False):
    """Query MRS services

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
    if url_context_root and not url_context_root.startswith('/'):
        raise Exception("The url_context_root has to start with '/'.")

    current_service_id = get_current_service_id(session)
    if not current_service_id:
        current_service_id = "0x00000000000000000000000000000000"

    # Build SQL based on which input has been provided
    sql = f"""
        SELECT se.id, se.enabled, se.url_protocol, h.name AS url_host_name,
            se.url_context_root, se.comments, se.options, se.url_host_id,
            CONCAT(h.name, se.url_context_root) AS host_ctx,
            se.auth_path, se.auth_completed_url,
            se.auth_completed_url_validation,
            se.auth_completed_page_content,
            se.id = ? as is_current
        FROM `mysql_rest_service_metadata`.`service` se
            LEFT JOIN `mysql_rest_service_metadata`.url_host h
                ON se.url_host_id = h.id
        """
    params = [current_service_id]
    wheres = []

    if service_id:
        wheres.append("se.id = ?")
        params.append(service_id)
    elif not get_default:
        if url_context_root and url_host_name is not None:
            wheres.append("h.name = ?")
            wheres.append("url_context_root = ?")
            params.append(url_host_name)
            params.append(url_context_root)
    else:
        wheres.append("se.id = ?")
        params.append(current_service_id)

    sql += core._generate_where(wheres)

    return core.MrsDbExec(sql, params).exec(session).items


def get_service(session, service_id: bytes = None, url_context_root=None, url_host_name=None,
                get_default=False):
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
                            url_host_name=url_host_name, get_default=get_default)
    return result[0] if result else None


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
