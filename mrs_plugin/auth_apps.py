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

"""Sub-Module for managing MRS auth_apps"""

# cSpell:ignore mysqlsh, mrs

from mysqlsh.plugin_manager import plugin_function
from mrs_plugin import core, core, services as mrs_services

# Content_set operations
AUTH_APP_DISABLE = 1
AUTH_APP_ENABLE = 2
AUTH_APP_DELETE = 3


def format_auth_app_listing(auth_apps, print_header=False):
    """Formats the listing of auth_apps

    Args:
        auth_apps (list): A list of auth_apps as dicts
        print_header (bool): If set to true, a header is printed


    Returns:
        The formated list of services
    """

    if len(auth_apps) == 0:
        return "No items available."

    if print_header:
        output = (f"{'ID':>3} {'NAME':26} {'DESCRIPTION':36} {'AUTH VENDOR':16} "
                  f"{'ENABLED':8}\n")
    else:
        output = ""

    i = 0
    for item in auth_apps:
        i += 1
        description=item['description'] if item['description'] is not None else ""
        output += (f"{item['id']:>3} {item['name'][:25]:26} "
                   f"{description[:35]:36} "
                   f"{item['auth_vendor'][:15]:16} "
                   f"{'Yes' if item['enabled'] else '-':8} ")
        if i < len(auth_apps):
            output += "\n"

    return output


@plugin_function('mrs.add.authenticationApp', shell=True, cli=True, web=True)
def add_auth_app(app_name=None, service_id=None, **kwargs):
    """Adds an auth_app to the given MRS service

    Args:
        app_name (str): The app_name
        service_id (int): The id of the service the schema should be added to
        **kwargs: Additional options

    Keyword Args:
        auth_vendor_id (str): The auth_vendor_id
        description (str): A description of the app
        url (str): url of the app
        access_token (str): access_token of the app
        app_id (str): app_id of the app
        limit_to_registered_users (bool): Limit access to registered users
        registered_users (str): List of registered users, separated by ,
        session (object): The database session to use
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
        None in interactive mode, a dict with content_set_id and
            number_of_files_uploaded
    """

    import os

    auth_vendor_id = kwargs.get("auth_vendor_id")
    description = kwargs.get("description")
    url = kwargs.get("url")
    access_token = kwargs.get("access_token")
    app_id = kwargs.get("app_id")
    limit_to_reg_users = kwargs.get("limit_to_registered_users")
    registered_users = kwargs.get("registered_users")
    session = kwargs.get("session")
    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)

    try:
        session = core.get_current_session(session)

        service = mrs_services.get_service(
            service_id=service_id, auto_select_single=True,
            session=session, interactive=interactive,
            return_formatted=False)

        # Get auth_vendor_id
        if not auth_vendor_id and interactive:
            res = session.run_sql("""
                SELECT id, name
                FROM `mysql_rest_service_metadata`.`auth_vendor`
                WHERE enabled = 1
                """)
            app_vendors = core.get_sql_result_as_dict_list(res)
            if len(app_vendors) == 0:
                raise ValueError("No authentication vendors enabled.")

            app_vendor = core.prompt_for_list_item(
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
            if auth_vendor_id == 1:
                app_name = core.prompt(
                    "Please enter the name of the authentication app "
                    "[MySQL Account Access]: ",
                    {'defaultValue': 'MySQL Account Access'})
            else:
                app_name = core.prompt(
                    "Please enter the name of the authentication app: ")
            if not app_name:
                raise ValueError("Operation cancelled.")
        if not app_name:
            raise ValueError("No app name specified.")

        # Get description
        if not description and interactive:
            if auth_vendor_id == 1:
                description = core.prompt(
                    "Please enter a description for the authentication app "
                    "[Authentication via MySQL accounts]",
                    {'defaultValue':
                     'Authentication via MySQL accounts'})
            else:
                description = core.prompt(
                    "Please enter a description for the authentication app: ")

        # Get limit_to_registered_users
        if not limit_to_reg_users and interactive:
            limit_to_reg_users = core.prompt(
                "Limit authentication to registered users? [y/N]: ",
                {'defaultValue': 'n'}).strip().lower() == 'y'

        # Get registered_users, convert to list
        if limit_to_reg_users and not registered_users and interactive:
            registered_users = core.prompt(
                "Please enter a list of registered user names, separated "
                "by comma (,): ")

        if registered_users:
            registered_users = registered_users.split(',')
            registered_users = [reg_user.strip()
                                for reg_user in registered_users]

        # Create the auth_app
        res = session.run_sql("""
            INSERT INTO `mysql_rest_service_metadata`.`auth_app`(
                auth_vendor_id, service_id, name, description, url,
                access_token, app_id, enabled, limit_to_registered_users)
            VALUES(?, ?, ?, ?, ?,
                ?, ?, ?, ?)
            """, [auth_vendor_id,
                  service.get("id"),
                  app_name,
                  description,
                  url,
                  access_token,
                  app_id,
                  1,
                  limit_to_reg_users if limit_to_reg_users else 0])
        auth_app_id = res.auto_increment_value

        # Create the registered_users if specified
        if registered_users and len(registered_users) > 0:
            for reg_user in registered_users:
                res = session.run_sql("""
                    INSERT INTO `mysql_rest_service_metadata`.`auth_user`(
                        auth_app_id, name)
                    VALUES(?, ?)
                    """, [auth_app_id, reg_user])

        if interactive:
            return "\n" + "Authentication app added successfully."
        else:
            return {
                "auth_app_id": auth_app_id
            }

    except Exception as e:
        if raise_exceptions:
            raise
        print(f"Error: {str(e)}")


@plugin_function('mrs.list.authenticationApps', shell=True, cli=True, web=True)
def get_auth_apps(service_id=None, **kwargs):
    """Returns all authentication apps for the given MRS service

    Args:
        service_id (int): The id of the service to list the schemas from
        **kwargs: Additional options

    Keyword Args:
        include_enable_state (bool): Only include items with the given
            enabled state
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised
        return_formatted (bool): If set to true, a list object is returned

    Returns:
        Either a string listing the content sets when interactive is set or list
        of dicts representing the content sets
    """

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
            SELECT a.id, a.auth_vendor_id, a.service_id, a.name,
                a.description, a.url, a.access_token, a.app_id, a.enabled,
                a.limit_to_registered_users, v.name as auth_vendor
            FROM `mysql_rest_service_metadata`.`auth_app` a
                LEFT OUTER JOIN `mysql_rest_service_metadata`.`auth_vendor` v
                    ON v.id = a.auth_vendor_id
            WHERE a.service_id = ? /*=1*/
            """
        if include_enable_state is not None:
            sql += ("AND a.enabled = "
                    f"{'TRUE' if include_enable_state else 'FALSE'} ")

        sql += "ORDER BY a.name"

        res = session.run_sql(sql, [service.get("id")])

        auth_apps = core.get_sql_result_as_dict_list(res)

        if return_formatted:
            return format_auth_app_listing(
                auth_apps=auth_apps, print_header=True)
        else:
            return auth_apps

    except Exception as e:
        if raise_exceptions:
            raise
        print(f"Error: {str(e)}")
