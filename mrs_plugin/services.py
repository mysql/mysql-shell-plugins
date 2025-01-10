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

"""Sub-Module for managing MRS services"""

# cSpell:ignore mysqlsh, mrs

from mysqlsh.plugin_manager import plugin_function
import mrs_plugin.lib as lib
from .interactive import resolve_service, resolve_options, resolve_file_path, resolve_overwrite_file, service_query_selection
from pathlib import Path
import os
import shutil
import json
import datetime
import re


def verify_value_keys(**kwargs):
    for key in kwargs["value"].keys():
        if key not in ["url_host_id",  "url_context_root",  "url_protocol", "url_host_name",
                       "enabled",  "comments", "options",
                       "auth_path", "auth_completed_url", "auth_completed_url_validation",
                       "auth_completed_page_content", "auth_apps", "metadata",
                       "in_development", "published", "name"] and key != "delete":
            raise Exception(f"Attempting to change an invalid service value.")


def resolve_service_ids(**kwargs):
    value = kwargs.get("value")
    session = kwargs.get("session")

    service_id = kwargs.pop("service_id", None)
    url_context_root = kwargs.pop("url_context_root", None)
    url_host_name = kwargs.pop("url_host_name", None)
    interactive = lib.core.get_interactive_default()
    allow_multi_select = kwargs.pop("allow_multi_select", False)
    kwargs.pop("url_protocol", None)

    kwargs["service_ids"] = []

    if service_id is not None:
        kwargs["service_ids"] = [service_id]
    else:
        # Get the right service_id(s) if service_id is not given
        if not url_context_root:
            # Check if there already is at least one service
            rows = lib.core.select(table="service",
                                   cols=["COUNT(*) AS service_count",
                                         "MAX(id) AS id"]
                                   ).exec(session).items
            if len(rows) == 0 or rows[0]["service_count"] == 0:
                Exception("No service available.")

            # If there are more services, let the user select one or all
            if interactive:
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

        # Determine changes in the url_context_root for this service
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

    return kwargs


def resolve_url_context_root(required=False, **kwargs):
    url_context_root = kwargs.get("url_context_root")
    if url_context_root is None and lib.core.get_interactive_default():
        url_context_root = kwargs["url_context_root"] = lib.services.prompt_for_url_context_root(
        )

    if required and url_context_root is None:
        raise Exception("No context path given. Operation cancelled.")
    if url_context_root is not None and not url_context_root.startswith('/'):
        raise Exception(
            f"The url_context_root [{url_context_root}] has to start with '/'.")

    return kwargs


def resolve_url_host_name(required=False, **kwargs):
    url_host_name = kwargs.get("url_host_name")

    if lib.core.get_interactive_default():
        if url_host_name is None:
            url_host_name = lib.core.prompt(
                "Please enter the host name for this service (e.g. "
                "None or localhost) [None]: ",
                {'defaultValue': 'None'}).strip()

    if url_host_name and url_host_name.lower() == 'none':
        url_host_name = None

    kwargs["url_host_name"] = url_host_name

    return kwargs


def resolve_url_protocol(**kwargs):
    if kwargs.get("url_protocol") is None:
        if lib.core.get_interactive_default():
            kwargs["url_protocol"] = lib.services.prompt_for_service_protocol()
        else:
            kwargs["url_protocol"] = ["HTTP", "HTTPS"]

    return kwargs


def resolve_comments(**kwargs):
    if lib.core.get_interactive_default():
        if kwargs.get("comments") is None:
            kwargs["comments"] = lib.core.prompt_for_comments()

    return kwargs


def call_update_service(op_text, **kwargs):

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        kwargs["session"] = session
        kwargs = resolve_service_ids(**kwargs)

        with lib.core.MrsDbTransaction(session):
            lib.services.update_services(**kwargs)

            if lib.core.get_interactive_result():
                if len(kwargs['service_ids']) == 1:
                    return f"The service has been {op_text}."
                return f"The services have been {op_text}."
            return True
    return False


def file_name_using_language_convention(name, sdk_language):
    if sdk_language == "Python":
        return lib.core.convert_to_snake_case(name)
    return name


def default_copyright_header(sdk_language):
    header = "Copyright (c) 2023, 2024, Oracle and/or its affiliates."

    if sdk_language == "TypeScript":
        return f"// {header}"

    if sdk_language == "Python":
        return f"# {header}"


def generate_create_statement(**kwargs):
    lib.core.convert_ids_to_binary(["service_id"], kwargs)
    lib.core.try_convert_ids_to_binary(["service"], kwargs)

    include_all_objects = kwargs.get("include_all_objects", False)
    service_query = service_query_selection(**kwargs)

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        service = resolve_service(session, service_query=service_query)

        if service is None:
            raise ValueError("The specified service was not found.")

        return lib.services.get_create_statement(session=session, service=service, include_all_objects=include_all_objects)


@plugin_function('mrs.add.service', shell=True, cli=True, web=True)
def add_service(**kwargs):
    """Adds a new MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        url_context_root (str): The context root for this service
        url_host_name (str): The host name for this service
        enabled (bool): Whether the new service should be enabled
        url_protocol (list): The protocols supported by this service
        comments (str): Comments about the service
        options (dict): Options for the service
        auth_path (str): The authentication path
        auth_completed_url (str): The redirection URL called after authentication
        auth_completed_url_validation (str): The regular expression that validates the
            app redirection URL specified by the /login?onCompletionRedirect parameter
        auth_completed_page_content (str): The custom page content to use of the
            authentication completed page
        metadata (dict): Metadata of the service
        published (bool): Whether the new service should be published immediately
        name (str): The name of the service
        session (object): The database session to use.

    Returns:
        Text confirming the service creation with its id or a dict holding the new service id otherwise
    """
    if "options" in kwargs:
        kwargs["options"] = lib.core.convert_json(kwargs["options"])

    if "metadata" in kwargs:
        kwargs["metadata"] = lib.core.convert_json(kwargs["metadata"])

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        options = kwargs.get("options")

        kwargs["session"] = session

        # Get url_context_root
        kwargs = resolve_url_context_root(required=True, **kwargs)
        url_context_root = kwargs["url_context_root"]

        # Get url_host_name
        kwargs = resolve_url_host_name(required=False, **kwargs)
        url_host_name = kwargs["url_host_name"]
        if url_host_name is None:
            url_host_name = ""

        # Get url_protocol
        kwargs = resolve_url_protocol(**kwargs)

        kwargs = resolve_comments(**kwargs)

        defaultOptions = {
            "headers": {
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
            },
            "http": {
                "allowedOrigin": "auto"
            },
            "logging": {
                "request": {
                    "headers": True,
                    "body": True
                },
                "response": {
                    "headers": True,
                    "body": True
                },
                "exceptions": True
            },
            "returnInternalErrorDetails": True,
            "includeLinksInResults": False
        }

        options = resolve_options(options, defaultOptions)

        with lib.core.MrsDbTransaction(session):
            service_id = lib.services.add_service(session, url_host_name, {
                "url_context_root": url_context_root,
                "url_protocol": kwargs.get("url_protocol"),
                "enabled": int(kwargs.get("enabled", True)),
                "comments": kwargs.get("comments"),
                "options": options,
                "auth_path": kwargs.get("auth_path", '/authentication'),
                "auth_completed_url": kwargs.get("auth_completed_url"),
                "auth_completed_url_validation": kwargs.get("auth_completed_url_validation"),
                "auth_completed_page_content": kwargs.get("auth_completed_page_content"),
                "metadata": kwargs.get("metadata"),
                "published": int(kwargs.get("published", False)),
                "name": kwargs.get("name"),
            })

        service = lib.services.get_service(session, service_id)

        if lib.core.get_interactive_result():
            return f"\nService '{service['host_ctx']}' created successfully."
        else:
            return service


@plugin_function('mrs.get.service', shell=True, cli=True, web=True)
def get_service(**kwargs):
    """Gets a specific MRS service

    If no service is specified, the service that is set as current service is
    returned if it was defined before

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (str): The id of the service
        url_context_root (str): The context root for this service
        url_host_name (str): The host name for this service
        get_default (bool): Whether to return the default service
        auto_select_single (bool): If there is a single service only, use that
        session (object): The database session to use.

    Returns:
        The service as dict or None on error in interactive mode
    """
    lib.core.convert_ids_to_binary(["service_id"], kwargs)

    url_context_root = kwargs.get("url_context_root")
    url_host_name = kwargs.get("url_host_name")
    service_id = kwargs.get("service_id")
    get_default = kwargs.get("get_default", False)
    auto_select_single = kwargs.get("auto_select_single", False)

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        # If there are no selective parameters given and interactive mode
        if (not url_context_root and not service_id and not get_default
                and lib.core.get_interactive_default()):
            # See if there is a current service, if so, return that one
            service = lib.services.get_current_service(session=session)
            if service:
                return lib.services.format_service_listing([service], True)

            # Check if there already is at least one service
            row = lib.core.select(table="service",
                                  cols="COUNT(*) as service_count, MIN(id) AS id"
                                  ).exec(session).first
            service_count = row.get("service_count", 0) if row else 0

            if service_count == 0:
                raise ValueError("No services available. Use "
                                 "mrs.add.`service`() to add a new service.")
            if auto_select_single and service_count == 1:
                service_id = row["id"]

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
                    return lib.services.format_service_listing([item], True)

        service = lib.services.get_service(url_context_root=url_context_root, url_host_name=url_host_name,
                                           service_id=service_id, get_default=get_default, session=session)

        if lib.core.get_interactive_result():
            # in interactive mode, if there is no service, we should display an empty listing
            if service:
                return lib.services.format_service_listing([service], True)
            else:
                return "The specified service was not found."
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
    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        services = lib.services.get_services(session)

        if lib.core.get_interactive_result():
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
        service_id (str): The id of the service
        url_context_root (str): The context root for this service
        url_host_name (str): The host name for this service
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    lib.core.convert_ids_to_binary(["service_id"], kwargs)

    kwargs["value"] = {"enabled": True}
    kwargs["allow_multi_select"] = True

    return call_update_service("enabled", **kwargs)


@plugin_function('mrs.disable.service', shell=True, cli=True, web=True)
def disable_service(**kwargs):
    """Disables a MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (str): The id of the service
        url_context_root (str): The context root for this service
        url_host_name (str): The host name for this service
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    lib.core.convert_ids_to_binary(["service_id"], kwargs)

    kwargs["value"] = {"enabled": False}
    kwargs["allow_multi_select"] = True

    return call_update_service("disabled", **kwargs)


@plugin_function('mrs.delete.service', shell=True, cli=True, web=True)
def delete_service(**kwargs):
    """Deletes a MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (str): The id of the service
        url_context_root (str): The context root for this service
        url_host_name (str): The host name for this service
        session (object): The database session to use.

    Returns:
        The result message as string
    """

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        lib.core.convert_ids_to_binary(["service_id"], kwargs)

        kwargs["session"] = session
        kwargs["allow_multi_select"] = True
        kwargs = resolve_service_ids(**kwargs)

        with lib.core.MrsDbTransaction(session):
            lib.services.delete_services(session, kwargs["service_ids"])

        if lib.core.get_interactive_result():
            if len(kwargs['service_ids']) == 1:
                return f"The service has been deleted."
            return f"The services have been deleted."

        return True


@plugin_function('mrs.set.service.contextPath', shell=True, cli=True, web=True)
def set_url_context_root(**kwargs):
    """Sets the url_context_root of a MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (str): The id of the service
        url_context_root (str): The context root for this service
        url_host_name (str): The host name for this service
        value (str): The context_path
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    lib.core.convert_ids_to_binary(["service_id"], kwargs)

    kwargs["value"] = {"url_context_root": kwargs["value"]}
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
        service_id (str): The id of the service
        url_context_root (str): The context root for this service
        url_host_name (str): The host name for this service
        value (str): The protocol either 'HTTP', 'HTTPS' or 'HTTP,HTTPS'
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    lib.core.convert_ids_to_binary(["service_id"], kwargs)

    kwargs["value"] = {"url_protocol": kwargs["value"]}
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
        service_id (str): The id of the service
        url_context_root (str): The context root for this service
        url_host_name (str): The host name for this service
        value (str): The comments
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    lib.core.convert_ids_to_binary(["service_id"], kwargs)

    kwargs["value"] = {"comments": kwargs["value"]}
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
        service_id (str): The id of the service
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    lib.core.convert_ids_to_binary(["service_id"], kwargs)

    kwargs["value"] = {"options": kwargs["value"]}
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
        service_id (str): The id of the service
        url_context_root (str): The context root for this service
        url_host_name (str): The host name for this service
        value (dict): The values as dict
        session (object): The database session to use.

    Allowed options for value:
        url_context_root (str): The context root for this service
        url_protocol (list): The protocol either 'HTTP', 'HTTPS' or 'HTTP,HTTPS'
        url_host_name (str): The host name for this service
        enabled (bool): Whether the service should be enabled
        comments (str): Comments about the service
        options (dict): Options of the service
        auth_path (str): The authentication path
        auth_completed_url (str): The redirection URL called after authentication
        auth_completed_url_validation (str): The regular expression that validates the
            app redirection URL specified by the /login?onCompletionRedirect parameter
        auth_completed_page_content (str): The custom page content to use of the
            authentication completed page
        metadata (dict): The metadata of the service
        in_development (dict): The development settings
        published (bool): Whether the service is published
        name (str): The name of the service

    Returns:
        The result message as string
    """
    if kwargs.get("value") is not None:
        # create a copy so that the dict won't change for the caller...and convert to dict
        kwargs["value"] = lib.core.convert_json(kwargs["value"])

    lib.core.convert_ids_to_binary(["service_id"], kwargs)

    verify_value_keys(**kwargs)

    return call_update_service("updated", **kwargs)


@plugin_function('mrs.get.serviceRequestPathAvailability', shell=True, cli=True, web=True)
def get_service_request_path_availability(**kwargs):
    """Checks the availability of a given request path for the given service

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (str): The id of the service
        request_path (str): The request path to check
        session (object): The database session to use.

    Returns:
        True or False
    """
    lib.core.convert_ids_to_binary(["service_id"], kwargs)

    service_id = kwargs.get("service_id")
    request_path = kwargs.get("request_path")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        service = resolve_service(session, service_id, True)

        # Get request_path
        if not request_path and lib.core.get_interactive_default():
            request_path = lib.core.prompt(
                "Please enter the request path for this content set ["
                f"/content]: ",
                {'defaultValue': '/content'}).strip()

        if not request_path.startswith('/'):
            raise Exception("The request_path has to start with '/'.")

        try:
            in_development = service.get("in_development", None)
            if in_development is None:
                in_development = {}

            lib.core.check_request_path(
                session,
                in_development.get("developers", "")
                + service["host_ctx"] + request_path)
        except:
            return False

        return True


@plugin_function('mrs.get.currentServiceMetadata', shell=True, cli=True, web=True)
def get_current_service_metadata(**kwargs):
    """Gets information about the current service

    This function returns the id of the current MRS service as well as the last id of the metadata audit_log
    related to this MRS service as metadata_version. If there are no entries for the service in the audit_log, the
    string noChange is returned instead.

    Args:
        **kwargs: Additional options

    Keyword Args:
        session (object): The database session to use.

    Returns:
        {id: string, host_ctx: string, metadata_version: string}
    """
    session = kwargs.get("session")
    if session.database_type != "MySQL":
        return {}

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        status = lib.general.get_status(session)
        if status.get("service_configured", False) == False:
            return {}

        service_id = lib.services.get_current_service_id(session)

        service = lib.services.get_service(
            session=session, service_id=service_id)

        # Lookup the last entry in the audit_log table that affects the service and use that as the
        # version int
        res = session.run_sql(
            """
            SELECT max(id) AS version FROM `mysql_rest_service_metadata`.`audit_log`
            """)
        row = res.fetch_one()

        metadata_version = row.get_field("version") if row is not None else "0"
        if metadata_version is None:
            metadata_version = "0"

        if service is None:
            lib.services.set_current_service_id(
                session=session, service_id=None)
            return {
                "metadata_version": metadata_version
            }

        metadata = {
            "id": lib.core.convert_id_to_string(service.get("id")),
            "host_ctx": service.get("host_ctx"),
            "metadata_version": metadata_version
        }

        if not lib.core.get_interactive_result():
            return metadata
        else:
            return lib.services.format_metadata(metadata["host_ctx"], metadata["metadata_version"])


@plugin_function('mrs.set.currentService', shell=True, cli=True, web=True)
def set_current_service(**kwargs):
    """Sets the default MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (str): The id of the service
        url_context_root (str): The context root for this service
        url_host_name (str): The host name for this service
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    lib.core.convert_ids_to_binary(["service_id"], kwargs)

    service_id = kwargs.get("service_id")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        if service_id is None:
            kwargs["session"] = session
            kwargs = resolve_url_context_root(required=False, **kwargs)
            kwargs = resolve_url_host_name(required=False, **kwargs)
            kwargs = resolve_service_ids(**kwargs)

            if kwargs["service_ids"]:
                service_id = kwargs["service_ids"][0]

        if service_id is None:
            if lib.core.get_interactive_result():
                return "The specified service was not found."
            return False

        lib.services.set_current_service_id(session, service_id)

    if lib.core.get_interactive_result():
        return "The service has been made the default."
    return True


@plugin_function('mrs.get.sdkBaseClasses', shell=True, cli=True, web=True)
def get_sdk_base_classes(**kwargs):
    """Returns the SDK base classes source for the given language

    Args:
        **kwargs: Options to determine what should be generated.

    Keyword Args:
        sdk_language (str): The SDK language to generate
        prepare_for_runtime (bool): Prepare code to be used in Monaco at runtime
        session (object): The database session to use.

    Returns:
        The SDK base classes source
    """
    sdk_language = kwargs.get("sdk_language", "TypeScript")
    prepare_for_runtime = kwargs.get("prepare_for_runtime", False)

    return lib.sdk.get_base_classes(sdk_language=sdk_language, prepare_for_runtime=prepare_for_runtime)


@plugin_function('mrs.get.sdkServiceClasses', shell=True, cli=True, web=True)
def get_sdk_service_classes(**kwargs):
    """Returns the SDK service classes source for the given language

    Args:
        **kwargs: Options to determine what should be generated.

    Keyword Args:
        service_id (str): The id of the service
        service_url (str): The url of the service
        sdk_language (str): The SDK language to generate
        prepare_for_runtime (bool): Prepare code to be used in Monaco at runtime
        session (object): The database session to use.

    Returns:
        The SDK base classes source
    """
    lib.core.convert_ids_to_binary(["service_id"], kwargs)

    service_id = kwargs.get("service_id")
    sdk_language = kwargs.get("sdk_language", "TypeScript")
    prepare_for_runtime = kwargs.get("prepare_for_runtime", False)
    service_url = kwargs.get("service_url")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        service = resolve_service(
            session=session, service_query=service_id, required=False, auto_select_single=True)

        return lib.sdk.generate_service_sdk(
            service=service, sdk_language=sdk_language, session=session, prepare_for_runtime=prepare_for_runtime,
            service_url=service_url)


@plugin_function('mrs.dump.sdkServiceFiles', shell=True, cli=True, web=True)
def dump_sdk_service_files(**kwargs):
    """Dumps the SDK service files for a REST Service

    Args:
        **kwargs: Options to determine what should be generated.

    Keyword Args:
        directory (str): The directory to store the .mrs.sdk folder with the files
        options (dict): Several options how the SDK should be created
        session (object): The database session to use.

    Allowed options for options:
        service_id (str): The ID of the service the SDK should be generated for. If not specified, the default service
            is used.
        db_connection_uri (str): The dbConnectionUri that was used to export the SDK files
        sdk_language (str): The SDK language to generate
        add_app_base_class (str): The additional AppBaseClass file name
        service_url (str): The url of the service
        version (integer): The version of the generated files
        generationDate (str): The generation date of the SDK files
        header (str): The header to use for the SDK files

    Returns:
        True on success
    """
    directory = kwargs.get("directory")
    options = kwargs.get("options")

    if not directory:
        if lib.core.get_interactive_default():
            directory = lib.core.prompt(
                "Please enter the directory the folder with the SDK files should be placed:")
            if not directory:
                print("Cancelled.")
                return False
        else:
            raise Exception("No directory given.")

    # Ensure the directory path exists
    Path(directory).mkdir(parents=True, exist_ok=True)

    # Try to read the mrs_config from the directory
    mrs_config = get_stored_sdk_options(directory=directory)
    if mrs_config is None and options is None:
        raise Exception(
            f"No SDK options given and no existing SDK config found in the directory {directory}")

    if mrs_config is None:
        mrs_config = {}

    if options is not None:
        mrs_config["serviceId"] = options.get("service_id")
        mrs_config["sdkLanguage"] = options.get("sdk_language", "TypeScript")
        mrs_config["serviceUrl"] = options.get("service_url")
        mrs_config["addAppBaseClass"] = options.get("add_app_base_class")
        mrs_config["dbConnectionUri"] = options.get("db_connection_uri")
        mrs_config["header"] = options.get(
            "header", default_copyright_header(mrs_config["sdkLanguage"]))

    mrs_config["generationDate"] = datetime.datetime.now(
        datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    serviceId = lib.core.id_to_binary(
        mrs_config.get("serviceId"), "mrs.config.json", True)
    if serviceId is None:
        raise Exception(
            "No serviceId defined in mrs.config.json. Please export the MRS SDK again.")

    if mrs_config.get("sdkLanguage") is None:
        raise Exception("No SDK Language given.")

    sdk_language = mrs_config.get("sdkLanguage")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        service = resolve_service(session, serviceId, True, True)
        service_name = lib.core.convert_path_to_camel_case(
            service.get("url_context_root"))

        if sdk_language == "TypeScript":
            file_type = "ts"
            base_classes_file = os.path.join(directory, "MrsBaseClasses.ts")
        elif sdk_language == "Python":
            file_type = "py"
            base_classes_file = os.path.join(directory, "mrs_base_classes.py")

        base_classes = get_sdk_base_classes(
            sdk_language=sdk_language, session=session)
        with open(base_classes_file, 'w') as f:
            f.write(base_classes)

        file_name = file_name_using_language_convention(
            service_name, sdk_language)

        service_classes = get_sdk_service_classes(
            service_id=serviceId, service_url=mrs_config.get("serviceUrl"),
            sdk_language=sdk_language, session=session)
        with open(os.path.join(directory, f"{file_name}.{file_type}"), 'w') as f:
            f.write(service_classes)

        add_app_base_class = mrs_config.get("addAppBaseClass")

        if add_app_base_class is not None and isinstance(add_app_base_class, str) and add_app_base_class != '':
            path = os.path.abspath(__file__)
            file_path = Path(os.path.dirname(path), "sdk", sdk_language.lower(), add_app_base_class)
            shutil.copy(file_path, os.path.join(directory, add_app_base_class))

    # cspell:ignore timespec
    conf_file = Path(directory, "mrs.config.json")
    with open(conf_file, 'w') as f:
        f.write(json.dumps(mrs_config, indent=4))

    # TODO: this should be in a separate function (maybe context-aware for each language)
    if sdk_language == "Python":
        # In Python, we should create a "__init__.py" file to be able to import the directory as a regular package
        package_file = Path(directory, "__init__.py")
        with open(package_file, "w") as f:
            copyright_header = mrs_config["header"]
            f.write(copyright_header)

    return True


@plugin_function('mrs.get.sdkOptions', shell=True, cli=True, web=True)
def get_stored_sdk_options(directory):
    """Reads the SDK service option file located in a given directory

    Args:
        directory (str): The directory where the mrs.config.json file is stored

    Returns:
        The SDK options stored in that directory otherwise None
    """

    # Try to read the mrs_config from the directory
    mrs_config = {}
    conf_file = Path(directory, "mrs.config.json")
    if conf_file.is_file():
        try:
            with open(conf_file) as f:
                mrs_config = json.load(f)
        except:
            pass

    if "addAppBaseClass" in mrs_config:
        if isinstance(mrs_config["addAppBaseClass"], int):
            del mrs_config["addAppBaseClass"]

    return mrs_config


@plugin_function('mrs.get.runtimeManagementCode', shell=True, cli=True, web=True)
def get_runtime_management_code(**kwargs):
    """Returns the SDK service classes source for the given language

    Args:
        **kwargs: Options to determine what should be generated.

    Keyword Args:
        session (object): The database session to use.

    Returns:
        The SDK base classes source
    """

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        return lib.sdk.get_mrs_runtime_management_code(session=session)


@plugin_function('mrs.get.serviceCreateStatement', shell=True, cli=True, web=True)
def get_create_statement(**kwargs):
    """Returns the corresponding CREATE REST SERVICE SQL statement of the given MRS service object.

    When using the 'service' parameter, you can choose either of these formats:
        - '0x11EF8496143CFDEC969C7413EA499D96' - Hexadecimal string ID
        - 'Ee+ElhQ8/eyWnHQT6kmdlg==' - Base64 string ID
        - 'localhost/myService' - Human readable string ID

    The service search parameters will be prioritized in the following order:
        - service_id
        - service
        - url_host_name + url_context_root

    Args:
        **kwargs: Options to determine what should be generated.

    Keyword Args:
        service_id (str): The ID of the service to generate.
        service (str): The identifier of the service.
        url_context_root (str): The context root for this service
        url_host_name (str): The host name for this service
        include_all_objects (bool): Include all objects that belong to the service.
        session (object): The database session to use.

    Returns:
        The SQL that represents the create statement for the MRS service
    """
    return generate_create_statement(**kwargs)


@plugin_function('mrs.dump.serviceCreateStatement', shell=True, cli=True, web=True)
def store_create_statement(**kwargs):
    """Stores the corresponding CREATE REST SERVICE SQL statement of the given MRS service
    object into a file.

    When using the 'service' parameter, you can choose either of these formats:
        - '0x11EF8496143CFDEC969C7413EA499D96' - Hexadecimal string ID
        - 'Ee+ElhQ8/eyWnHQT6kmdlg==' - Base64 string ID
        - 'localhost/myService' - Human readable string ID

    The service search parameters will be prioritized in the following order:
        - service_id
        - service
        - url_host_name + url_context_root

    Args:
        **kwargs: Options to determine what should be generated.

    Keyword Args:
        service_id (str): The ID of the service to dump.
        service (str): The identifier of the service.
        url_context_root (str): The context root for this service
        url_host_name (str): The host name for this service
        include_all_objects (bool): Include all objects that belong to the service.
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
