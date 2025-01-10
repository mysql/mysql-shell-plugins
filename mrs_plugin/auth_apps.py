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

"""Sub-Module for managing MRS auth_apps"""

# cSpell:ignore mysqlsh, mrs

from mysqlsh.plugin_manager import plugin_function
import mrs_plugin.lib as lib
from .interactive import resolve_service, resolve_auth_app, resolve_file_path, resolve_overwrite_file, auth_app_query_selection, service_query_selection

def generate_create_statement(**kwargs) -> str:
    lib.core.convert_ids_to_binary(["service_id", "auth_app_id"], kwargs)
    lib.core.try_convert_ids_to_binary(["service", "schema"], kwargs)

    include_all_objects = kwargs.get("include_all_objects", False)
    auth_app_query = auth_app_query_selection(**kwargs)
    service_query = service_query_selection(**kwargs)

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        service = resolve_service(session, service_query=service_query)
        auth_app = resolve_auth_app(session, auth_app_query=auth_app_query, service_query=service_query)

        return lib.auth_apps.get_create_statement(session, auth_app, service, include_all_objects)


@plugin_function('mrs.get.authenticationVendors', shell=True, cli=True, web=True)
def get_auth_vendors(**kwargs):
    """Adds an auth_app to the given MRS service

    Args:
        **kwargs: Additional options

    Keyword Args:
        enabled (bool): Whether to return just the enabled vendors (default) or all
        session (object): The database session to use

    Returns:
        The list of vendor objects
    """

    enabled = kwargs.get("enabled", True)

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        return lib.auth_apps.get_auth_vendors(session, enabled)


@plugin_function('mrs.add.authenticationApp', shell=True, cli=True, web=True)
def add_auth_app(app_name=None, service_id=None, **kwargs):
    """Adds an auth_app to the given MRS service

    Args:
        app_name (str): The app_name
        service_id (str): The id of the service the schema should be added to
        **kwargs: Additional options

    Keyword Args:
        auth_vendor_id (str): The auth_vendor_id
        description (str): A description of the app
        url (str): url of the app
        url_direct_auth (str): url direct auth of the app
        access_token (str): access_token of the app
        app_id (str): app_id of the app
        limit_to_registered_users (bool): Limit access to registered users
        registered_users (list): List of registered users
        default_role_id (str): The default role to be assigned to new users
        enabled (int): Whether the Auth App is enabled
        options (dict): Additional options
        session (object): The database session to use

    Returns:
        A dict with content_set_id and number_of_files_uploaded
    """
    if service_id:
        service_id = lib.core.id_to_binary(service_id, "service_id")
    lib.core.convert_ids_to_binary(["auth_vendor_id", "default_role_id"], kwargs)

    auth_vendor_id = kwargs.get("auth_vendor_id")
    default_role_id = kwargs.get("default_role_id")


    description = kwargs.get("description")
    url = kwargs.get("url")
    url_direct_auth = kwargs.get("url_direct_auth")
    access_token = kwargs.get("access_token")
    app_id = kwargs.get("app_id")

    limit_to_reg_users = kwargs.get("limit_to_registered_users")
    registered_users = kwargs.get("registered_users")

    enabled = kwargs.get("enabled", 1)
    options = kwargs.get("options")

    interactive = lib.core.get_interactive_default()

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        service = resolve_service(session, service_id)

        # Get auth_vendor_id
        if not auth_vendor_id and interactive:
            app_vendors = lib.core.select(table="auth_vendor",
                cols=["id", "name"],
                where="enabled=1"
            ).exec(session).items

            if len(app_vendors) == 0:
                raise ValueError("No authentication vendors enabled.")

            app_vendor = lib.core.prompt_for_list_item(
                item_list=app_vendors, prompt_caption=(
                    "Please select an authentication vendor: "),
                item_name_property="name",
                print_list=True)

            if not app_vendor:
                raise ValueError("Operation cancelled.")

            auth_vendor_id = app_vendor['id']

        if not auth_vendor_id:
            raise ValueError("No authentication vendor specified.")

        # Get app_name
        if not app_name and interactive:
            if auth_vendor_id == lib.auth_apps.MYSQL_AUTHENTICATION:
                app_name = lib.core.prompt(
                    "Please enter the name of the authentication app "
                    "[MySQL Account Access]: ",
                    {'defaultValue': 'MySQL Account Access'})
            else:
                app_name = lib.core.prompt(
                    "Please enter the name of the authentication app: ")
            if not app_name:
                raise ValueError("Operation cancelled.")
        if not app_name:
            raise ValueError("No app name specified.")

        # Get description
        if not description and interactive:
            if auth_vendor_id == lib.auth_apps.MYSQL_AUTHENTICATION:
                description = lib.core.prompt(
                    "Please enter a description for the authentication app "
                    "[Authentication via MySQL accounts]",
                    {'defaultValue':
                     'Authentication via MySQL accounts'})
            else:
                description = lib.core.prompt(
                    "Please enter a description for the authentication app: ")

        # Get limit_to_registered_users
        if not limit_to_reg_users and interactive:
            limit_to_reg_users = lib.core.prompt(
                "Limit authentication to registered users? [y/N]: ",
                {'defaultValue': 'n'}).strip().lower() == 'y'

        # Get registered_users, convert to list
        if limit_to_reg_users and not registered_users and interactive:
            registered_users = lib.core.prompt(
                "Please enter a list of registered user names, separated "
                "by comma (,): ")

            registered_users = registered_users.split(',')
            registered_users = [reg_user.strip()
                                for reg_user in registered_users]

        default_role_id = default_role_id or lib.auth_apps.DEFAULT_ROLE_ID

        with lib.core.MrsDbTransaction(session):
            # Create the auth_app
            auth_app_id = lib.auth_apps.add_auth_app(session, service["id"], auth_vendor_id,
                app_name, description, url, url_direct_auth, access_token, app_id,
                limit_to_reg_users, default_role_id, enabled, options)

            # Create the registered_users if specified
            if registered_users and len(registered_users) > 0:
                role_comments = "Default role." if default_role_id == lib.auth_apps.DEFAULT_ROLE_ID else ""
                for reg_user in registered_users:
                    user_id = lib.users.add_user(session, auth_app_id, reg_user, None, None, None,
                        None, None, None)

                    if default_role_id:
                        lib.users.add_user_role(session, user_id, default_role_id, role_comments)

        if lib.core.get_interactive_result():
            return f"\nAuthentication app with the id {auth_app_id} was added successfully."
        else:
            return {
                "auth_app_id": auth_app_id
            }


@plugin_function('mrs.get.authenticationApp', shell=True, cli=True, web=True)
def get_auth_app(app_id=None, session=None):
    """Returns the requested authentication app

    Args:
        app_id (str): The application id
        session (object): The database session to use.

    Returns:
        Either a string listing the content sets when interactive is set or list
        of dicts representing the authentication app
    """
    if app_id is not None:
        app_id = lib.core.id_to_binary(app_id, "app_id")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, session=session) as session:
        auth_app = resolve_auth_app(session, auth_app_query=app_id)

        if lib.core.get_interactive_result():
            return lib.auth_apps.format_auth_app_listing(
                auth_apps=auth_app, print_header=True)
        return auth_app

@plugin_function('mrs.list.authenticationApps', shell=True, cli=True, web=True)
def get_auth_apps(service_id=None, **kwargs):
    """Returns all authentication apps for the given MRS service

    Args:
        service_id (str): The id of the service to list the schemas from
        **kwargs: Additional options

    Keyword Args:
        include_enable_state (bool): Only include items with the given
            enabled state
        session (object): The database session to use.

    Returns:
        Either a string listing the content sets when interactive is set or list
        of dicts representing the authentication apps
    """
    if service_id is not None:
        service_id = lib.core.id_to_binary(service_id, "service_id")

    include_enable_state = kwargs.get("include_enable_state")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        service = resolve_service(session, service_id)
        auth_apps = lib.auth_apps.get_auth_apps(session, service["id"], include_enable_state)

        if lib.core.get_interactive_result():
            return lib.auth_apps.format_auth_app_listing(
                auth_apps=auth_apps, print_header=True)
        else:
            return auth_apps

@plugin_function('mrs.delete.authenticationApp', shell=True, cli=True, web=True)
def delete_auth_app(**kwargs):
    """Deletes an existing auth_app

    Args:
        **kwargs: Additional options

    Keyword Args:
        app_id (str): The application id
        service_id (str): The id of the service that this auth_app belongs to
        session (object): The database session to use

    Returns:
        None
    """
    lib.core.convert_ids_to_binary(["app_id", "service_id"], kwargs)
    app_id = kwargs.get("app_id")
    service_id = kwargs.get("service_id")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        auth_app = resolve_auth_app(session, auth_app_query=app_id, service_query=service_id)

        with lib.core.MrsDbTransaction(session):
            lib.auth_apps.delete_auth_app(session, service_id=service_id, app_id=auth_app["id"])


@plugin_function('mrs.update.authenticationApp', shell=True, cli=True, web=True)
def update_auth_app(**kwargs):
    """Updates an existing auth_app

    Args:
        **kwargs: Additional options

    Keyword Args:
        app_id (str): The application id
        value (dict): The values as dict
        service_id (str): The id of the service that this auth_app belongs to
        auth_app_name (str): The name of the auth_app to update
        session (object): The database session to use

    Allowed options for value:
        auth_vendor_id (str): The auth_vendor_id
        name (str): The new name for the app
        description (str): The new description
        url (str): The new url for the app
        url_direct_auth (str): The new url direct auth for the app
        access_token (str): The new access token
        app_id (str): The new application id
        enabled (bool): Set if it's enabled or not
        limit_to_registered_users (bool): Set if limited to registered users
        default_role_id (str): The new default role id
        options (dict): Additional options

    Returns:
        A dict with content_set_id and number_of_files_uploaded
    """
    lib.core.convert_ids_to_binary(["app_id", "service_id"], kwargs)
    lib.core.convert_ids_to_binary(["default_role_id", "auth_vendor_id"], kwargs["value"])

    app_id = kwargs.get("app_id")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        value = kwargs.get("value")
        lib.auth_apps.update_auth_app(session, app_id, value)

@plugin_function('mrs.get.authAppCreateStatement', shell=True, cli=True, web=True)
def get_create_statement(**kwargs):
    """Returns the corresponding CREATE REST AUTH APP SQL statement of the given MRS service object.

    When using the 'auth_app' parameter, you can choose either of these formats:
        - '0x11EF8496143CFDEC969C7413EA499D96' - Hexadecimal string ID
        - 'Ee+ElhQ8/eyWnHQT6kmdlg==' - Base64 string ID
        - 'localhost/myService/authApp' - Human readable string ID

    Args:
        **kwargs: Options to determine what should be generated.

    Keyword Args:
        auth_app_id (str): The ID of the authentication app to generate.
        service_id (str): The ID of the service where the authentication app belongs.
        auth_app (str): The identifier of the authentication app.
        include_all_objects (bool): Include all objects that belong to the authentication app.
        session (object): The database session to use.

    Returns:
        The SQL that represents the create statement for the MRS schema
    """
    return generate_create_statement(**kwargs)


@plugin_function('mrs.dump.authAppCreateStatement', shell=True, cli=True, web=True)
def store_create_statement(**kwargs):
    """Stores the corresponding CREATE REST AUTH APP SQL statement of the given MRS schema
    object into a file.

    When using the 'auth_app' parameter, you can choose either of these formats:
        - '0x11EF8496143CFDEC969C7413EA499D96' - Hexadecimal string ID
        - 'Ee+ElhQ8/eyWnHQT6kmdlg==' - Base64 string ID
        - 'localhost/myService/authApp/user' - Human readable string ID

    Args:
        **kwargs: Options to determine what should be generated.

    Keyword Args:
        auth_app_id (str): The ID of the authentication app to generate.
        service_id (str): The ID of the service where the authentication app belongs.
        auth_app (str): The identifier of the authentication app.
        include_all_objects (bool): Include all objects that belong to the schema.
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