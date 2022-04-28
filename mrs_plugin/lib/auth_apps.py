# Copyright (c) 2022, Oracle and/or its affiliates.
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
from mrs_plugin.lib import core, services

MYSQL_AUTHENTICATION = 1

def format_auth_app_listing(auth_apps, print_header=False):
    """Formats the listing of auth_apps

    Args:
        auth_apps (list): A list of auth_apps as dicts
        print_header (bool): If set to true, a header is printed


    Returns:
        The formatted list of authorized applications
    """

    if not auth_apps:
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

def get_auth_apps(session, service_id, include_enable_state=None):
    """Returns all authentication apps for the given MRS service

    Args:
        session (object): The database session to use.
        service_id (int): The id of the service to list the schemas from
        include_enable_state (bool): Only include items with the given
            enabled state

    Returns:
        list of dicts representing the authorized applications
    """
    # Check the given service_id or get the default if none was given
    service = services.get_service(
        service_id=service_id, session=session)

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

    return core.MrsDbExec(sql).exec(session, [service.get("id")]).items



