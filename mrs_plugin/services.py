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

"""Sub-Module for managing MRS services"""

# cSpell:ignore mysqlsh, mrs

from mysqlsh.plugin_manager import plugin_function
from mrs_plugin import core

# Service operations
SERVICE_SET_ALL = 0
SERVICE_DISABLE = 1
SERVICE_ENABLE = 2
SERVICE_DELETE = 3
SERVICE_SET_DEFAULT = 4
SERVICE_SET_CONTEXT_ROOT = 5
SERVICE_SET_PROTOCOL = 6
SERVICE_SET_COMMENTS = 7


def prompt_for_url_context_root(default=None):
    """Prompts the user for the url_context_root

    Returns:
        The url_context_root as str
    """
    return core.prompt(
        "Please enter the context path for this service [/mrs]: ",
        {'defaultValue': default if default else "/mrs"}).strip()


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
        The formated list of services
    """

    if print_header:
        output = (f"{'ID':>3} {'PATH':25} {'ENABLED':8} {'PROTOCOL(s)':20} "
                  f"{'DEFAULT':9}\n")
    else:
        output = ""

    i = 0
    for item in services:
        i += 1
        url = item.get('url_host_name') + item.get('url_context_root')
        output += (f"{item['id']:>3} {url[:24]:25} "
                   f"{'Yes' if item['enabled'] else '-':8} "
                   f"{item['url_protocol'][:19]:20} "
                   f"{'Yes' if item['is_default'] else '-':5}")
        if i < len(services):
            output += "\n"

    return output


@plugin_function('mrs.add.service', shell=True, cli=True, web=True)
def add_service(url_context_root=None, url_host_name=None, enabled=True,
                **kwargs):
    """Adds a new MRS service

    Args:
        url_context_root (str): The context root for this service
        url_host_name (str): The host name for this service
        enabled (bool): Whether the new service should be enabled
        **kwargs: Additional options

    Keyword Args:
        url_protocol (str): The protocols supported by this service
        is_default (bool): Whether the new service should be the new default
        comments (str): Comments about the service
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
        None in interactive mode, a dict holding the new service id otherwise
    """

    url_protocol = kwargs.get("url_protocol")
    is_default = kwargs.get("is_default")
    comments = kwargs.get("comments")
    session = kwargs.get("session")
    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)

    try:
        session = core.get_current_session(session)

        # Make sure the MRS metadata schema exists and has the right version
        core.ensure_rds_metadata_schema(session)

        # Check if there already is at least one service
        res = session.run_sql("""
            SELECT COUNT(*) as service_count
            FROM `mysql_rest_service_metadata`.`service`
            """)
        row = res.fetch_one()
        service_count = row.get_field("service_count") if row else 0

        # Get url_context_root
        if not url_context_root and interactive:
            url_context_root = prompt_for_url_context_root()
        if not url_context_root:
            raise Exception("No context path given. Operation cancelled.")
        if not url_context_root.startswith('/'):
            raise Exception("The url_context_root has to start with '/'.")

        # Get url_host_name
        if not url_host_name and interactive:
            url_host_name = core.prompt(
                "Please enter the host name for this service (e.g. "
                "None or localhost) [None]: ",
                {'defaultValue': 'None'}).strip()
        if url_host_name and url_host_name.lower() == 'none':
            url_host_name = None

        # Get url_protocol
        if not url_protocol and interactive:
            url_protocol = prompt_for_service_protocol()

        # Get is_default
        if not is_default and interactive:
            is_default = core.prompt(
                "Should the new service be made the default service "
                f"{'[y/N]' if service_count > 0 else '[Y/n]'}: ",
                {'defaultValue': 'n' if service_count > 0 else 'y'}
            ).strip().lower() == 'y'

        if not comments and interactive:
            comments = core.prompt_for_comments()

        # Check if any service is active
        res = session.run_sql("""
            SELECT COUNT(*) as cnt
            FROM `mysql_rest_service_metadata`.`service` se
                LEFT JOIN `mysql_rest_service_metadata`.url_host h
				    ON se.url_host_id = h.id
            WHERE h.name = ?
                AND se.url_context_root = ?
            """, [
            url_host_name if url_host_name else '',
            url_context_root if url_context_root else '/rds'])
        row = res.fetch_one()
        cnt = row.get_field("cnt") if row else None
        if cnt and int(cnt) > 0:
            raise Exception("A service with this host_name and "
                            "context_root already exists.")

        # Get id of the host
        res = session.run_sql("""
            SELECT h.id FROM `mysql_rest_service_metadata`.url_host h
            WHERE h.name = ?
            """, [
            url_host_name if url_host_name else ''])
        row = res.fetch_one()
        host_id = row.get_field("id") if row else None
        # If there is no id for the given host yet, create a host entry
        if not host_id:
            res = session.run_sql("""
                INSERT INTO `mysql_rest_service_metadata`.url_host(name)
                VALUES (?)
                """, [
                url_host_name if url_host_name else ''])
            host_id = res.auto_increment_value

        # cSpell:ignore mrs
        res = session.run_sql("""
            INSERT INTO `mysql_rest_service_metadata`.`service`(
                enabled, url_host_id, url_protocol,
                url_context_root, is_default, comments)
            VALUES(1, ?, ?, ?, ?, ?)
            """, [
            host_id,
            url_protocol if url_protocol else 'HTTP',
            url_context_root if url_context_root else '/mrs',
            1 if is_default else 0,
            comments])

        if is_default and res.auto_increment_value > 0:
            session.run_sql("""
                UPDATE `mysql_rest_service_metadata`.`service`
                SET is_default = 0
                WHERE id <> ?
                """, [res.auto_increment_value])

        if interactive:
            return "\n" + "Service created successfully."
        else:
            return get_service(service_id=res.auto_increment_value,
                               interactive=False, return_formatted=False,
                               session=session)
    except Exception as e:
        if raise_exceptions:
            raise
        else:
            print(f"Error: {str(e)}")


@plugin_function('mrs.get.service', shell=True, cli=True, web=True)
def get_service(url_context_root=None, url_host_name=None, service_id=None,
                **kwargs):
    """Gets a specific MRS service

    If no service is specified, the service that is set as current service is
    returned if it was defined before

    Args:
        url_context_root (str): The context root for this service
        url_host_name (str): The host name for this service
        service_id (int): The id of the service
        **kwargs: Additional options

    Keyword Args:
        get_default (bool): Whether to return the default service
        auto_select_single (bool): If there is a single service only, use that
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised
        return_formatted (bool): If set to true, a list object is returned

    Returns:
        The service as dict or None on error in interactive mode
    """

    get_default = kwargs.get("get_default", False)
    auto_select_single = kwargs.get("auto_select_single", False)
    session = kwargs.get("session")
    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)

    try:
        session = core.get_current_session(session)

        # Make sure the MRS metadata schema exists and has the right version
        core.ensure_rds_metadata_schema(session)

        # If there are no selective parameters given and interactive mode
        if (not url_context_root and not service_id and not get_default
                and interactive):
            # See if there is a current service, if so, return that one
            service = core.get_current_service(session=session)
            if service:
                return service

            # Check if there already is at least one service
            sql = """
                SELECT COUNT(*) as service_count, MIN(id) AS id
                FROM `mysql_rest_service_metadata`.`service`
                """
            res = session.run_sql(sql)
            row = res.fetch_one()
            service_count = row.get_field("service_count") if row else 0

            if service_count == 0:
                raise ValueError("No services available. Use "
                                 "mrs.add.`service`() to add a new service.")
            if auto_select_single and service_count == 1:
                service_id = row.get_field("id")

            # If there are more services, let the user select one or all
            if not service_id:
                services = get_services(session=session, interactive=False)
                print("MRS Service Listing")
                item = core.prompt_for_list_item(
                    item_list=services,
                    prompt_caption=("Please select a service index or type "
                                    "'hostname/root_context': "),
                    item_name_property="host_ctx",
                    given_value=None,
                    print_list=True)
                if not item:
                    raise ValueError("Operation cancelled.")
                else:
                    return item

        if url_context_root and not url_context_root.startswith('/'):
            raise Exception("The url_context_root has to start with '/'.")

        # Build SQL based on which input has been provided
        sql = """
            SELECT se.id, se.enabled, se.url_protocol, h.name AS url_host_name,
                se.url_context_root, se.is_default, se.comments,
                CONCAT(h.name, se.url_context_root) AS host_ctx
            FROM `mysql_rest_service_metadata`.`service` se
                LEFT JOIN `mysql_rest_service_metadata`.url_host h
                    ON se.url_host_id = h.id
            WHERE 1 = 1
            """
        params = []
        if url_context_root:
            sql += "AND h.name = ? AND url_context_root = ? "
            params.append(url_host_name if url_host_name else "")
            params.append(url_context_root)
        if service_id:
            sql += "AND se.id = ? "
            params.append(service_id)
        if get_default:
            sql += "AND se.is_default = 1 "

        res = session.run_sql(sql, params)

        services = core.get_sql_result_as_dict_list(res)

        if len(services) != 1:
            raise Exception("The given service was not found.")

        if return_formatted:
            return format_service_listing(services)
        else:
            return services[0]

    except Exception as e:
        if raise_exceptions:
            raise
        else:
            print(f"Error: {str(e)}")


@plugin_function('mrs.list.services', shell=True, cli=True, web=True)
def get_services(**kwargs):
    """Get a list of MRS services

    Args:
        **kwargs: Additional options

    Keyword Args:
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised
        return_formatted (bool): If set to true, a list object is returned

    Returns:
        Either a string listing the services when interactive is set or list
        of dicts representing the services
    """

    session = kwargs.get("session")
    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)

    try:
        session = core.get_current_session(session)

        sql = """
            SELECT se.id, se.enabled, se.url_protocol, h.name AS url_host_name,
                se.url_context_root, se.is_default, se.comments,
                CONCAT(h.name, se.url_context_root) AS host_ctx
            FROM `mysql_rest_service_metadata`.`service` se
                LEFT JOIN `mysql_rest_service_metadata`.url_host h
                    ON se.url_host_id = h.id
            ORDER BY h.name, se.url_context_root
            """
        res = session.run_sql(sql)

        services = core.get_sql_result_as_dict_list(res)

        if return_formatted:
            return format_service_listing(services)
        else:
            return services

    except Exception as e:
        if raise_exceptions:
            raise
        else:
            print(f"Error: {str(e)}")


def change_service(**kwargs):
    """Makes a given change to a MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (int): The id of the service
        change_type (int): Type of change
        url_context_root (str): The context root for this service
        url_host_name (str): The host name for this service
        value (str): The value to be set as string or a dict if all are set
        session (object): The database session to use
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
        The result message as string
    """
    import json

    service_id = kwargs.get("service_id")

    change_type = kwargs.get("change_type")
    url_context_root = kwargs.get("url_context_root")
    url_host_name = kwargs.get("url_host_name")
    value = kwargs.get("value")

    session = kwargs.get("session")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)

    try:
        session = core.get_current_session(session)

        # Make sure the MRS metadata schema exists and has the right version
        core.ensure_rds_metadata_schema(session)

        # List of services to be changed, initialized with service_id if given
        service_ids = [service_id] if service_id else []

        # Get the right service_id(s) if service_id is not given
        if not url_context_root and not service_id:
            # Check if there already is at least one service
            res = session.run_sql("""
                SELECT COUNT(*) AS service_count, MAX(id) AS id
                FROM `mysql_rest_service_metadata`.`service`
                """)
            row = res.fetch_one()
            service_count = row.get_field("service_count") if row else 0

            # If there is no service to change, error out.
            if service_count == 0:
                Exception("No service available.")
            # If there is exactly 1 service, use that one
            # elif service_count == 1:
            #    service_ids.append(row.get_field("id"))

            # If there are more services, let the user select one or all
            if interactive:
                allow_multi_select = (
                    change_type == SERVICE_DISABLE or
                    change_type == SERVICE_ENABLE or
                    change_type == SERVICE_DELETE)

                if allow_multi_select:
                    caption = ("Please select a service index, type "
                               "'hostname/root_context' or type '*' "
                               "to select all: ")
                else:
                    caption = ("Please select a service index or type "
                               "'hostname/root_context'")

                services = get_services(session=session, interactive=False)
                selection = core.prompt_for_list_item(
                    item_list=services,
                    prompt_caption=caption,
                    item_name_property="host_ctx",
                    given_value=None,
                    print_list=True,
                    allow_multi_select=allow_multi_select)
                if not selection or selection == "":
                    raise ValueError("Operation cancelled.")

                if allow_multi_select:
                    service_ids = [item["id"] for item in selection]
                else:
                    service_ids.append(selection["id"])

            # Lookup the service id
            res = session.run_sql(
                """
                SELECT se.id FROM `mysql_rest_service_metadata`.`service` se
                    LEFT JOIN `mysql_rest_service_metadata`.url_host h
                        ON se.url_host_id = h.id
                WHERE h.name = ? AND se.url_context_root = ?
                """,
                [url_host_name if url_host_name else "", url_context_root])
            row = res.fetch_one()
            if row:
                service_ids.append(row.get_field("id"))

        if len(service_ids) == 0:
            raise ValueError("The specified service was not found.")

        # Check the given value
        if interactive and not value:
            if change_type == SERVICE_SET_PROTOCOL:
                value = prompt_for_service_protocol()
            elif change_type == SERVICE_SET_COMMENTS:
                value = core.prompt_for_comments()

        if change_type == SERVICE_SET_PROTOCOL and not value:
            raise ValueError("No value given.")

        # Update all given services
        for service_id in service_ids:
            service = get_service(
                service_id=service_id, session=session, interactive=False,
                return_formatted=False)

            if change_type == SERVICE_SET_CONTEXT_ROOT:
                url_ctx_root = value
            elif change_type == SERVICE_SET_ALL:
                if type(value) == str: # TODO: Check why dicts cannot be used
                    value = json.loads(value)

                url_ctx_root = value.get("url_context_root")

            if (change_type == SERVICE_SET_CONTEXT_ROOT or
               change_type == SERVICE_SET_ALL):
                if interactive and not url_ctx_root:
                    url_ctx_root = prompt_for_url_context_root(
                        default=service.get('url_context_root'))

                # If the context root has changed, check if the new one is valid
                if service.get("url_context_root") != url_ctx_root:
                    if (not url_ctx_root or not url_ctx_root.startswith('/')):
                        raise ValueError(
                            "The url_context_root has to start with '/'.")

                    core.check_request_path(
                        url_ctx_root, session=session)

            params = [service_id]
            if change_type == SERVICE_DISABLE:
                sql = """
                    UPDATE `mysql_rest_service_metadata`.`service`
                    SET enabled = FALSE
                    WHERE id = ?
                    """
            elif change_type == SERVICE_ENABLE:
                sql = """
                    UPDATE `mysql_rest_service_metadata`.`service`
                    SET enabled = TRUE
                    WHERE id = ?
                    """
            elif change_type == SERVICE_DELETE:
                sql = """
                    DELETE FROM `mysql_rest_service_metadata`.`service`
                    WHERE id = ?
                    """
            elif change_type == SERVICE_SET_DEFAULT:
                res = session.run_sql("""
                    UPDATE `mysql_rest_service_metadata`.`service`
                    SET is_default = FALSE
                    """)
                sql = """
                    UPDATE `mysql_rest_service_metadata`.`service`
                    SET is_default = TRUE
                    WHERE id = ?
                    """
            elif change_type == SERVICE_SET_CONTEXT_ROOT:
                sql = """
                    UPDATE `mysql_rest_service_metadata`.`service`
                    SET url_context_root = ?
                    WHERE id = ?
                    """
                params.insert(0, url_ctx_root)
            elif change_type == SERVICE_SET_PROTOCOL:
                sql = """
                    UPDATE `mysql_rest_service_metadata`.`service`
                    SET url_protocol = ?
                    WHERE id = ?
                    """
                params.insert(0, value)
            elif change_type == SERVICE_SET_COMMENTS:
                sql = """
                    UPDATE `mysql_rest_service_metadata`.`service`
                    SET comments = ?
                    WHERE id = ?
                    """
                params.insert(0, value)
            elif change_type == SERVICE_SET_ALL:
                sql = """
                    UPDATE `mysql_rest_service_metadata`.`service`
                    SET enabled = ?,
                        url_context_root = ?,
                        url_protocol = ?,
                        comments = ?,
                        is_default = ?
                    WHERE id = ?
                    """
                if str(value.get("is_default")).lower() == "true":
                    res = session.run_sql("""
                        UPDATE `mysql_rest_service_metadata`.`service`
                        SET is_default = FALSE
                        """)

                params.insert(
                    0, (str(value.get("enabled")).lower() == "true" or
                    str(value.get("enabled")) == "1"))
                params.insert(1, url_ctx_root)
                params.insert(2, value.get("url_protocol", ""))
                params.insert(3, value.get("comments", ""))
                params.insert(
                    4, (str(value.get("is_default")).lower() == "true" or
                    str(value.get("is_default")) == "1"))
            else:
                raise Exception("Operation not supported")

            res = session.run_sql(sql, params)
            if res.get_affected_row_count() == 0:
                raise Exception(
                    f"The specified service with id {service_id} was not "
                    "found.")

        if change_type == SERVICE_SET_DEFAULT:
            return "The service has been made the default."

        if len(service_ids) == 1:
            msg = "The service has been "
        else:
            msg = "The services have been "

        if change_type == SERVICE_DISABLE:
            msg += "disabled."
        elif change_type == SERVICE_ENABLE:
            msg += "enabled."
        elif change_type == SERVICE_DELETE:
            msg += "deleted."
        else:
            msg += "updated."

        return msg

    except Exception as e:
        if raise_exceptions:
            raise
        else:
            print(f"Error: {str(e)}")


@plugin_function('mrs.enable.service', shell=True, cli=True, web=True)
def enable_service(**kwargs):
    """Enables a MRS service

    If there is no service yet, a service with default values will be
    created and set as default.

    Args:
        **kwargs: Additional options

    Keyword Args:
        url_context_root (str): The context root for this service
        url_host_name (str): The host name for this service
        service_id (int): The id of the service
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
        The result message as string
    """

    return change_service(
        change_type=SERVICE_ENABLE,
        **kwargs)


@plugin_function('mrs.disable.service', shell=True, cli=True, web=True)
def disable_service(**kwargs):
    """Disables a MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        url_context_root (str): The context root for this service
        url_host_name (str): The host name for this service
        service_id (int): The id of the service
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
        The result message as string
    """

    return change_service(
        change_type=SERVICE_DISABLE,
        **kwargs)


@plugin_function('mrs.delete.service', shell=True, cli=True, web=True)
def delete_service(**kwargs):
    """Deletes a MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        url_context_root (str): The context root for this service
        url_host_name (str): The host name for this service
        service_id (int): The id of the service
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
        The result message as string
    """

    return change_service(
        change_type=SERVICE_DELETE,
        **kwargs)


@plugin_function('mrs.set.service.default', shell=True, cli=True, web=True)
def set_default_service(**kwargs):
    """Sets the default MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        url_context_root (str): The context root for this service
        url_host_name (str): The host name for this service
        service_id (int): The id of the service
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
        The result message as string
    """

    return change_service(
        change_type=SERVICE_SET_DEFAULT,
        **kwargs)


@plugin_function('mrs.set.service.contextPath', shell=True, cli=True, web=True)
def set_url_context_root(**kwargs):
    """Sets the url_context_root of a MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        url_context_root (str): The context root for this service
        url_host_name (str): The host name for this service
        value (str): The context_path
        service_id (int): The id of the service
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
        The result message as string
    """

    return change_service(
        change_type=SERVICE_SET_CONTEXT_ROOT,
        **kwargs)


@plugin_function('mrs.set.service.protocol', shell=True, cli=True, web=True)
def set_protocol(**kwargs):
    """Sets the protocol of a MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        url_context_root (str): The context root for this service
        url_host_name (str): The host name for this service
        value (str): The protocol either 'HTTP', 'HTTPS' or 'HTTP,HTTPS'
        service_id (int): The id of the service
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
        The result message as string
    """

    return change_service(
        change_type=SERVICE_SET_PROTOCOL,
        **kwargs)


@plugin_function('mrs.set.service.comments', shell=True, cli=True, web=True)
def set_comments(**kwargs):
    """Sets the comments of a MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        url_context_root (str): The context root for this service
        url_host_name (str): The host name for this service
        value (str): The comments
        service_id (int): The id of the service
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
        The result message as string
    """

    return change_service(
        change_type=SERVICE_SET_COMMENTS,
        **kwargs)


@plugin_function('mrs.update.service', shell=True, cli=True, web=True)
def update_service(**kwargs):
    """Sets all properties of a MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (int): The id of the service
        url_context_root (str): The context root for this service
        url_host_name (str): The host name for this service
        value (str): The values as dict #TODO: check why dicts cannot be passed
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
        The result message as string
    """

    return change_service(
        change_type=SERVICE_SET_ALL,
        **kwargs)
