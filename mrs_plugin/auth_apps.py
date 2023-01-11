# Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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

"""Sub-Module for managing MRS auth_apps"""

# cSpell:ignore mysqlsh, mrs

from mysqlsh.plugin_manager import plugin_function
import mrs_plugin.lib as lib

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
        return lib.core.select(table="auth_vendor",
            where="enabled=?"
        ).exec(session, [enabled]).items


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
        use_built_in_authorization (bool): Limit access to registered users
        registered_users (list): List of registered users, separated by ,
        default_role_id (str): The default role to be assigned to new users
        session (object): The database session to use

    Returns:
        A dict with content_set_id and number_of_files_uploaded
    """
    service_id = lib.core.id_to_binary(service_id, "service_id")
    lib.core.convert_ids_to_binary(["auth_vendor_id", "default_role_id"], kwargs)

    auth_vendor_id = kwargs.get("auth_vendor_id")
    default_role_id = kwargs.get("default_role_id")


    description = kwargs.get("description")
    url = kwargs.get("url")
    url_direct_auth = kwargs.get("url_direct_auth")
    access_token = kwargs.get("access_token")
    app_id = kwargs.get("app_id")


    use_built_in_authorization = kwargs.get("use_built_in_authorization")
    limit_to_reg_users = kwargs.get("limit_to_registered_users")
    registered_users = kwargs.get("registered_users")

    interactive = lib.core.get_interactive_default()

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        service = lib.services.get_service(
            service_id=service_id, session=session)

        if not service:
            raise Exception(f"Service not found.")

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

        with lib.core.MrsDbTransaction(session):
            # Create the auth_app
            auth_app_id = lib.core.get_sequence_id(session)
            lib.core.insert(table="auth_app", values=[
                "id", "auth_vendor_id", "service_id", "name", "description", "url",
                "url_direct_auth", "access_token", "app_id", "enabled",
                "use_built_in_authorization", "limit_to_registered_users",
                "default_role_id"
            ]).exec(session, [
                auth_app_id,
                auth_vendor_id,
                service.get("id"),
                app_name,
                description,
                url,
                url_direct_auth,
                access_token,
                app_id,
                1,
	            use_built_in_authorization if use_built_in_authorization else 1,
                limit_to_reg_users if limit_to_reg_users else 0,
                default_role_id
            ])

            # Create the registered_users if specified
            if registered_users and len(registered_users) > 0:
                for reg_user in registered_users:
                    lib.core.insert(table="mrs_user", values=["id", "auth_app_id", "name"]
                    ).exec(session, [lib.core.get_sequence_id(session), auth_app_id, reg_user])

        if lib.core.get_interactive_result():
            return f"\nAuthentication app with the id {auth_app_id} was added successfully."
        else:
            return {
                "auth_app_id": auth_app_id
            }


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
        of dicts representing the content sets
    """
    if service_id is not None:
        service_id = lib.core.id_to_binary(service_id, "service_id")

    include_enable_state = kwargs.get("include_enable_state")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        # Check the given service_id or get the default if none was given
        service = lib.services.get_service(
            service_id=service_id, session=session)

        sql = """
            SELECT a.id, a.auth_vendor_id, a.service_id, a.name,
                a.description, a.url, a.url_direct_auth, a.access_token,
                a.app_id, a.enabled, a.use_built_in_authorization,
                a.limit_to_registered_users, a.default_role_id,
                v.name as auth_vendor
            FROM `mysql_rest_service_metadata`.`auth_app` a
                LEFT OUTER JOIN `mysql_rest_service_metadata`.`auth_vendor` v
                    ON v.id = a.auth_vendor_id
            WHERE a.service_id = ? /*=1*/
            """
        if include_enable_state is not None:
            sql += ("AND a.enabled = "
                    f"{'TRUE' if include_enable_state else 'FALSE'} ")

        sql += "ORDER BY a.name"

        auth_apps = lib.core.MrsDbExec(sql).exec(session, [service.get("id")]).items

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
        session (object): The database session to use

    Returns:
        None
    """
    lib.core.convert_ids_to_binary(["app_id"], kwargs)
    app_id = kwargs.get("app_id")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        lib.auth_apps.delete_auth_app(session, app_id=app_id)


@plugin_function('mrs.update.authenticationApp', shell=True, cli=True, web=True)
def update_auth_app(**kwargs):
    """Updates an existing auth_app

    Args:
        **kwargs: Additional options

    Keyword Args:
        app_id (str): The application id
        value (dict,required): The values as dict
        session (object): The database session to use

    Allowed options for value:
        name (str,optional): The new name for the app
        description (str,optional): The new description
        url (str,optional): The new url for the app
        url_direct_auth (str,optional): The new url direct auth for the app
        access_token (str,optional): The new access token
        app_id (str,optional): The new application id
        enabled (bool,optional): Set if it's enabled or not
        use_built_in_authorization (bool,optional): Set if uses built in authorization
        limit_to_registered_users (bool,optional): Set if limited to registered users
        default_role_id (str,optional): The new default role id

    Returns:
        A dict with content_set_id and number_of_files_uploaded
    """
    lib.core.convert_ids_to_binary(["app_id"], kwargs)

    app_id = kwargs.get("app_id")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        value = kwargs.get("value")
        lib.auth_apps.update_auth_app(session, app_id, value)
