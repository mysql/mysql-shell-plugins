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
import mrs_plugin.lib as lib

def verify_value_keys(**kwargs):
    for key in kwargs["value"].keys():
        if key not in ["url_host_id",  "url_context_root",  "url_protocol", "url_host_name",
            "enabled",  "is_default",  "comments",
            "options",
            "auth_path", "auth_completed_url", "auth_completed_url_validation",
            "auth_completed_page_content", "auth_apps"] and key != "delete":
            raise Exception(f"Attempting to change an invalid service value.")

def resolve_service_ids(**kwargs):
    value = kwargs.get("value")
    session = kwargs.get("session")

    service_id = kwargs.pop("service_id", None)
    url_context_root = kwargs.pop("url_context_root", None)
    url_host_name = kwargs.pop("url_host_name", None)
    interactive = lib.core.get_interactive_default()
    kwargs.pop("url_protocol", None)

    kwargs["service_ids"] = []

    if service_id is not None:
        kwargs["service_ids"] = [service_id]
    else:
        # Get the right service_id(s) if service_id is not given
        if not url_context_root:
            # Check if there already is at least one service
            rows = lib.core.select(table="service",
                cols=["COUNT(*) AS service_count", "MAX(id) AS id"]
            ).exec(session).items
            if len(rows) == 0 or rows[0]["service_count"] == 0:
                Exception("No service available.")

            # If there are more services, let the user select one or all
            if interactive:
                allow_multi_select = ("enable" in value or "delete" in value)

                if allow_multi_select:
                    caption = ("Please select a service index, type "
                                "'hostname/root_context' or type '*' "
                                "to select all: ")
                else:
                    caption = ("Please select a service index or type "
                                "'hostname/root_context'")

                services = lib.services.get_services(session=session)
                selection = lib.core.prompt_for_list_item(
                    item_list=services,
                    prompt_caption=caption,
                    item_name_property="host_ctx",
                    given_value=None,
                    print_list=True,
                    allow_multi_select=allow_multi_select)
                if not selection or selection == "":
                    raise ValueError("Operation cancelled.")

                if allow_multi_select:
                    kwargs["service_ids"] = [item["id"] for item in selection]
                else:
                    kwargs["service_ids"].append(selection["id"])
        else:
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
                kwargs["service_ids"].append(row.get_field("id"))

    if len(kwargs["service_ids"]) == 0:
        raise ValueError("The specified service was not found.")

    for service_id in kwargs["service_ids"]:

        service = lib.services.get_service(
            service_id=service_id, session=session)

        if value is not None and "url_context_root" in value:
            url_ctx_root = value["url_context_root"]

            if interactive and not url_ctx_root:
                url_ctx_root = lib.services.prompt_for_url_context_root(
                    default=service.get('url_context_root'))

            # If the context root has changed, check if the new one is valid
            if service["url_context_root"] != url_ctx_root:
                if (not url_ctx_root or not url_ctx_root.startswith('/')):
                    raise ValueError(
                        "The url_context_root has to start with '/'.")

                lib.core.check_request_path(
                    url_ctx_root, session=session)

    return kwargs

def resolve_url_context_root(required=False, **kwargs):
    interactive = lib.core.get_interactive_default()
    url_context_root = kwargs.get("url_context_root")
    if url_context_root is None and interactive:
        url_context_root = kwargs["value"]["url_context_root"] = lib.services.prompt_for_url_context_root()

    if required and url_context_root is None:
        raise Exception("No context path given. Operation cancelled.")
    if url_context_root is not None and not url_context_root.startswith('/'):
        raise Exception(f"The url_context_root [{url_context_root}] has to start with '/'.")

    return kwargs

def resolve_url_host_name(required=False, **kwargs):
    value = kwargs.get("value", {})
    interactive = lib.core.get_interactive_default()
    url_host_name = value.get("url_host_name")

    if interactive:
        if url_host_name is None:
            url_host_name = lib.core.prompt(
                "Please enter the host name for this service (e.g. "
                "None or localhost) [None]: ",
                {'defaultValue': 'None'}).strip()

    if url_host_name and url_host_name.lower() == 'none':
        url_host_name = None

    return kwargs

def resolve_url_protocol(required, **kwargs):
    value = kwargs.get("value", {})
    interactive = lib.core.get_interactive_default()
    if interactive:
        if value is None or "url_protocol" in value and value["url_protocol"] is None:
            kwargs["value"]["url_protocol"] = lib.services.prompt_for_service_protocol()

    if required and value["url_protocol"] is None:
        raise ValueError("No value given.")

    return kwargs

def resolve_comments(**kwargs):
    value = kwargs.get("value")
    interactive = lib.core.get_interactive_default()
    if interactive:
        if value is None or "comments" in value and value["comments"] is None:
            kwargs["value"]["comments"] = lib.core.prompt_for_comments()

    return kwargs

def call_update_service(op_text, **kwargs):
    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        kwargs["session"] = session
        kwargs = resolve_service_ids(**kwargs)

        with lib.core.MrsDbTransaction(session):
            lib.services.update_service(**kwargs)

            if len(kwargs['service_ids']) == 1:
                return f"The service has been {op_text}."
            return f"The services have been {op_text}."



@plugin_function('mrs.add.service', shell=True, cli=True, web=True)
def add_service(**kwargs):
    """Adds a new MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        url_context_root (str,required): The context root for this service
        url_host_name (str,required): The host name for this service
        enabled (bool,required): Whether the new service should be enabled
        url_protocol (list,required): The protocols supported by this service
        is_default (bool,required): Whether the new service should be the new default
        comments (str,required): Comments about the service
        options (dict): Options for the service
        auth_path (str): The authentication path
        auth_completed_url (str): The redirection URL called after authentication
        auth_completed_url_validation (str): The regular expression that validates the
            app redirection URL specified by the /login?onCompletionRedirect parameter
        auth_completed_page_content (str): The custom page content to use of the
            authentication completed page
        auth_apps (list): The list of auth_apps in JSON format
        session (object): The database session to use.

    Returns:
        Text confirming the service creation with its id or a dict holding the new service id otherwise
    """
    interactive = lib.core.get_interactive_default()

    # kwargs["url_context_root"] = kwargs.get("url_context_root")
    if "options" in kwargs:
        kwargs["options"] = lib.core.convert_json(kwargs["options"])

    if "auth_apps" in kwargs:
        auth_apps = []
        for app in kwargs.get("auth_apps", []):
            auth_apps.append(lib.core.convert_json(app))
        kwargs["auth_apps"] = auth_apps

    options = kwargs.get("options")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        kwargs["session"] = session
        row = lib.core.select(table="service",
            cols="COUNT(*) as service_count"
        ).exec(session).first
        service_count = row.get("service_count", 0) if row else 0

        # Get url_context_root
        kwargs = resolve_url_context_root(required=True, **kwargs)
        url_context_root = kwargs["url_context_root"]

        # Get url_host_name
        kwargs = resolve_url_host_name(required=False, **kwargs)
        url_host_name = kwargs["url_host_name"]

        # Get url_protocol
        kwargs = resolve_url_protocol(required=False, **kwargs)

        # Get is_default
        is_default = kwargs["is_default"]
        if is_default is None and interactive:
            is_default = lib.core.prompt(
                "Should the new service be made the default service "
                f"{'[y/N]' if service_count > 0 else '[Y/n]'}: ",
                {'defaultValue': 'n' if service_count > 0 else 'y'}
            ).strip().lower() == 'y'

        kwargs = resolve_comments(**kwargs)


        if not options and interactive:
            optionsPrompt = lib.core.prompt("Options (in JSON format): ")
            if optionsPrompt:
                options = optionsPrompt

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
        row = lib.core.select(table="url_host",
            cols="id",
            where="name=?"
        ).exec(session, [url_host_name if url_host_name else '']).first
        url_host_id = row["id"] if row else None

        with lib.core.MrsDbTransaction(session):
            service_id = lib.services.add_service(session, url_host_name, {
                "url_context_root": url_context_root,
                "url_protocol": kwargs.get("url_protocol"),
                "url_host_id": url_host_id,
                "enabled": int(kwargs.get("enabled", True)),
                "is_default": int(kwargs.get("is_default")),
                "comments": kwargs.get("comments"),
                "options": kwargs.get("options"),
                "auth_path": kwargs.get("auth_path", '/authentication'),
                "auth_completed_url": kwargs.get("auth_completed_url"),
                "auth_completed_url_validation": kwargs.get("auth_completed_url_validation"),
                "auth_completed_page_content": kwargs.get("auth_completed_page_content"),
                "auth_apps": kwargs.get("auth_apps", [])
            })

        if interactive:
            return f"\nService with id {service_id} created successfully."
        else:
            return lib.services.get_service(service_id=service_id,
                            session=session)


@plugin_function('mrs.get.service', shell=True, cli=True, web=True)
def get_service(**kwargs):
    """Gets a specific MRS service

    If no service is specified, the service that is set as current service is
    returned if it was defined before

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (int,required): The id of the service
        url_context_root (str,required): The context root for this service
        url_host_name (str,required): The host name for this service
        get_default (bool,required): Whether to return the default service
        auto_select_single (bool,required): If there is a single service only, use that
        session (object): The database session to use.

    Returns:
        The service as dict or None on error in interactive mode
    """
    url_context_root=kwargs.get("url_context_root")
    url_host_name=kwargs.get("url_host_name")
    service_id=kwargs.get("service_id")
    get_default = kwargs.get("get_default", False)
    auto_select_single = kwargs.get("auto_select_single", False)
    interactive = lib.core.get_interactive_default()
    return_formatted = lib.core.get_interactive_result()

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        # If there are no selective parameters given and interactive mode
        if (not url_context_root and not service_id and not get_default
                and interactive):
            # See if there is a current service, if so, return that one
            service = lib.services.get_current_service(session=session)
            if service:
                return service

            # Check if there already is at least one service
            row = lib.core.select(table="service",
                cols="COUNT(*) as service_count, MIN(id) AS id"
            ).exec(session).first
            service_count = row.get("service_count", 0) if row else 0

            if service_count == 0:
                raise ValueError("No services available. Use "
                                    "mrs.add.`service`() to add a new service.")
            if auto_select_single and service_count == 1:
                service_id = row.get_field("id")

            # If there are more services, let the user select one or all
            if not service_id:
                services = lib.services.get_services(session)
                print("MRS Service Listing")
                item = lib.core.prompt_for_list_item(
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

        service = lib.services.get_service(url_context_root=url_context_root, url_host_name=url_host_name,
            service_id=service_id, get_default=get_default, session=session)

        if return_formatted:
            return lib.services.format_service_listing([service], True)
        else:
            return service


@plugin_function('mrs.list.services', shell=True, cli=True, web=True)
def get_services(**kwargs):
    """Get a list of MRS services

    Args:
        **kwargs: Additional options

    Keyword Args:
        session (object): The database session to use.

    Returns:
        Either a string listing the services when interactive is set or list
        of dicts representing the services
    """
    return_formatted = lib.core.get_interactive_result()

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        services = lib.services.get_services(session)

        if return_formatted:
            return lib.services.format_service_listing(services, True)
        else:
            return services


@plugin_function('mrs.enable.service', shell=True, cli=True, web=True)
def enable_service(**kwargs):
    """Enables a MRS service

    If there is no service yet, a service with default values will be
    created and set as default.

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (int,required): The id of the service
        url_context_root (str,required): The context root for this service
        url_host_name (str,required): The host name for this service
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    kwargs["value"] = {"enabled": True}
    if "service_id" not in kwargs:
        kwargs = resolve_url_context_root(required=False, **kwargs)
        kwargs = resolve_url_host_name(required=False, **kwargs)

    return call_update_service("enabled", **kwargs)


@plugin_function('mrs.disable.service', shell=True, cli=True, web=True)
def disable_service(**kwargs):
    """Disables a MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (int,required): The id of the service
        url_context_root (str,required): The context root for this service
        url_host_name (str,required): The host name for this service
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    kwargs["value"] = {"enabled": False}
    if "service_id" not in kwargs:
        kwargs = resolve_url_context_root(required=False, **kwargs)
        kwargs = resolve_url_host_name(required=False, **kwargs)

    return call_update_service("disabled", **kwargs)


@plugin_function('mrs.delete.service', shell=True, cli=True, web=True)
def delete_service(**kwargs):
    """Deletes a MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (int,required): The id of the service
        url_context_root (str,required): The context root for this service
        url_host_name (str,required): The host name for this service
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    return_formatted = lib.core.get_interactive_result()
    if "service_id" not in kwargs:
        kwargs = resolve_url_context_root(required=False, **kwargs)
        kwargs = resolve_url_host_name(required=False, **kwargs)

    # return call_update_service("deleted", **kwargs)
    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        kwargs["session"] = session
        kwargs = resolve_service_ids(**kwargs)

        with lib.core.MrsDbTransaction(session):
            lib.services.delete_service(**kwargs)

        if return_formatted:
            if len(kwargs['service_ids']) == 1:
                return f"The service has been deleted."
            return f"The services have been deleted."

        return True
    return False


@plugin_function('mrs.set.service.default', shell=True, cli=True, web=True)
def set_default_service(**kwargs):
    """Sets the default MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (int,required): The id of the service
        url_context_root (str,required): The context root for this service
        url_host_name (str,required): The host name for this service
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    kwargs["value"] = {"is_default": True}
    if "service_id" not in kwargs:
        kwargs = resolve_url_context_root(required=False, **kwargs)
        kwargs = resolve_url_host_name(required=False, **kwargs)

    return call_update_service("made the default", **kwargs)


@plugin_function('mrs.set.service.contextPath', shell=True, cli=True, web=True)
def set_url_context_root(**kwargs):
    """Sets the url_context_root of a MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (int,required): The id of the service
        url_context_root (str,required): The context root for this service
        url_host_name (str,required): The host name for this service
        value (str,required): The context_path
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    kwargs["value"] = { "url_context_root": kwargs["value"]}
    if "service_id" not in kwargs:
        kwargs = resolve_url_context_root(required=False, **kwargs)
        kwargs = resolve_url_host_name(required=False, **kwargs)
        kwargs.pop("url_context_root", None)

    return call_update_service("updated", **kwargs)


@plugin_function('mrs.set.service.protocol', shell=True, cli=True, web=True)
def set_protocol(**kwargs):
    """Sets the protocol of a MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (int,required): The id of the service
        url_context_root (str,required): The context root for this service
        url_host_name (str,required): The host name for this service
        value (str,required): The protocol either 'HTTP', 'HTTPS' or 'HTTP,HTTPS'
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    kwargs["value"] = { "url_protocol": kwargs["value"]}
    if "service_id" not in kwargs:
        kwargs = resolve_url_context_root(required=False, **kwargs)
        kwargs = resolve_url_host_name(required=False, **kwargs)
        kwargs.pop("url_protocol", None)

    return call_update_service("updated", **kwargs)


@plugin_function('mrs.set.service.comments', shell=True, cli=True, web=True)
def set_comments(**kwargs):
    """Sets the comments of a MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (int,required): The id of the service
        url_context_root (str,required): The context root for this service
        url_host_name (str,required): The host name for this service
        value (str,required): The comments
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    kwargs["value"] = { "comments": kwargs["value"]}
    if "service_id" not in kwargs:
        kwargs = resolve_url_context_root(required=False, **kwargs)
        kwargs = resolve_url_host_name(required=False, **kwargs)
        kwargs.pop("comments", None)

    return call_update_service("updated", **kwargs)


@plugin_function('mrs.set.service.options', shell=True, cli=True, web=True)
def set_options(**kwargs):
    """Sets the options of a MRS service

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
    kwargs["value"] = { "options": kwargs["value"]}
    if "service_id" not in kwargs:
        kwargs = resolve_url_context_root(required=False, **kwargs)
        kwargs = resolve_url_host_name(required=False, **kwargs)
        kwargs.pop("options", None)

    return call_update_service("updated", **kwargs)



@plugin_function('mrs.update.service', shell=True, cli=True, web=True)
def update_service(**kwargs):
    """Sets all properties of a MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (int,required): The id of the service
        url_context_root (str,required): The context root for this service
        url_host_name (str,required): The host name for this service
        value (dict,required): The values as dict #TODO: check why dicts cannot be passed
        session (object): The database session to use.

    Allowed options for value:
        url_context_root (str,optional): The context root for this service
        url_protocol (list,optional): The protocol either 'HTTP', 'HTTPS' or 'HTTP,HTTPS'
        url_host_name (str,optional): The host name for this service
        enabled (bool,optional): Whether the service should be enabled
        is_default (bool,optional): Whether the new service should be the new default
        comments (str,optional): Comments about the service
        options (dict,optional): Options of the service
        auth_path (str,optional): The authentication path
        auth_completed_url (str,optional): The redirection URL called after authentication
        auth_completed_url_validation (str,optional): The regular expression that validates the
            app redirection URL specified by the /login?onCompletionRedirect parameter
        auth_completed_page_content (str,optional): The custom page content to use of the
            authentication completed page
        auth_apps (list,optional): The list of auth_apps in JSON format

    Returns:
        The result message as string
    """

    verify_value_keys(**kwargs)

    return call_update_service("updated", **kwargs)


@plugin_function('mrs.get.serviceRequestPathAvailability', shell=True, cli=True, web=True)
def get_service_request_path_availability(**kwargs):
    """Checks the availability of a given request path for the given service

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (int): The id of the service
        request_path (str): The request path to check
        session (object): The database session to use.

    Returns:
        True or False
    """

    service_id = kwargs.get("service_id")
    request_path = kwargs.get("request_path")
    interactive = lib.core.get_interactive_default()

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        if service_id:
            service = lib.services.get_service(session, service_id=service_id)
        else:
            service = lib.services.get_service(session, get_default=True)

        # Get request_path
        if not request_path and interactive:
            request_path = lib.core.prompt(
                "Please enter the request path for this content set ["
                f"/content]: ",
                {'defaultValue': '/content'}).strip()

        if not request_path.startswith('/'):
            raise Exception("The request_path has to start with '/'.")

        try:
            lib.core.check_request_path(
                request_path,
                session=session)
        except:
            return False

        return True
