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
from mrs_plugin.lib import core, services, users

MYSQL_AUTHENTICATION = 1
DEFAULT_ROLE_ID = bytes.fromhex("31000000000000000000000000000000")


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
        description = item['description'] if item['description'] is not None else ""

        if len(description) > 36:
            description = f"{description[:33]}..."

        output += (f"{i:>3} {item['name'][:25]:26} "
                   f"{description[:35]:36} "
                   f"{item['auth_vendor'][:15]:16} "
                   f"{'Yes' if item['enabled'] else '-':8} ")
        if i < len(auth_apps):
            output += "\n"

    return output


def get_auth_vendors(session, enabled=None):
    params = []
    sql = """
        SELECT * FROM `mysql_rest_service_metadata`.`auth_vendor`
    """
    if enabled is not None:
        sql += "WHERE enabled = ?"
        params.append(enabled)

    return core.MrsDbExec(sql, params).exec(session).items


def get_auth_vendor(session, vendor_id=None, name=None):
    if vendor_id is not None:
        sql = """
            SELECT * FROM `mysql_rest_service_metadata`.`auth_vendor`
            WHERE id = ?
        """

        return core.MrsDbExec(sql, [vendor_id]).exec(session).first

    if name is not None:
        sql = """
            SELECT * FROM `mysql_rest_service_metadata`.`auth_vendor`
            WHERE name LIKE ?
        """

        return core.MrsDbExec(sql, [name]).exec(session).first


def get_auth_app(session, app_id=None, service_id=None, name=None):
    if app_id is not None:
        sql = """
            SELECT a.id, a.auth_vendor_id, a.service_id, a.name,
                a.description, a.url, a.url_direct_auth, a.access_token, a.app_id, a.enabled,
                a.limit_to_registered_users, a.default_role_id,
                v.name as auth_vendor
            FROM `mysql_rest_service_metadata`.`auth_app` a
                LEFT OUTER JOIN `mysql_rest_service_metadata`.`auth_vendor` v
                    ON v.id = a.auth_vendor_id
            WHERE a.id = ?
            """

        return core.MrsDbExec(sql, [app_id]).exec(session).first

    if service_id is not None and name is not None:
        sql = """
            SELECT a.id, a.auth_vendor_id, a.service_id, a.name,
                a.description, a.url, a.url_direct_auth, a.access_token, a.app_id, a.enabled,
                a.limit_to_registered_users, a.default_role_id,
                v.name as auth_vendor
            FROM `mysql_rest_service_metadata`.`auth_app` a
                LEFT OUTER JOIN `mysql_rest_service_metadata`.`auth_vendor` v
                    ON v.id = a.auth_vendor_id
            WHERE a.service_id = ? AND UPPER(a.name) = UPPER(?)
            """

        return core.MrsDbExec(sql, [service_id, name]).exec(session).first


def get_auth_apps(session, service_id: bytes, include_enable_state=None):
    """Returns all authentication apps for the given MRS service

    Args:
        session (object): The database session to use.
        service_id: The id of the service to list the schemas from
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
            a.description, a.url, a.url_direct_auth, a.access_token, a.app_id, a.enabled,
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

    return core.MrsDbExec(sql).exec(session, [service.get("id")]).items


def add_auth_app(session, service_id, auth_vendor_id, app_name, description, url, url_direct_auth,
                 access_token, app_id, limit_to_reg_users, default_role_id, enabled=True):

    auth_app_id = core.get_sequence_id(session)
    core.insert(table="auth_app", values=[
        "id", "auth_vendor_id", "service_id", "name", "description", "url",
        "url_direct_auth", "access_token", "app_id", "enabled",
        "limit_to_registered_users",
        "default_role_id"
    ]).exec(session, [
        auth_app_id,
        auth_vendor_id,
        service_id,
        app_name,
        description,
        url,
        url_direct_auth,
        access_token,
        app_id,
        int(enabled),
        int(limit_to_reg_users) if limit_to_reg_users else 0,
        default_role_id
    ])

    return auth_app_id


def delete_auth_app(session, app_id):
    users.delete_users_by_auth_app(session, auth_app_id=app_id)

    core.MrsDbExec("""DELETE FROM `mysql_rest_service_metadata`.`auth_app`
                      WHERE id = ?""", [app_id]).exec(session)


def update_auth_app(session, app_id, data: dict):

    sets = []
    params = []

    for key, value in data.items():
        sets.append(f"{key} = ?")
        params.append(value)

    params.append(app_id)

    sql = f"""UPDATE `mysql_rest_service_metadata`.`auth_app`
              SET {",".join(sets)}
              WHERE id = ?"""

    core.MrsDbExec(sql, params).exec(session)
