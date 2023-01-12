# Copyright (c) 2022, 2023 Oracle and/or its affiliates.
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

from mysqlsh.plugin_manager import plugin_function
from mrs_plugin import lib
from .interactive import resolve_auth_app

@plugin_function('mrs.list.users', shell=True, cli=True, web=True)
def get_users(**kwargs):
    """Get users configured within a service and/or auth_app

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (str): Use this service_id to search for all users within this service.
        auth_app_id (str): Use this auth_app_id to list all the users for this auth_app.
        session (object): The database session to use.

    Returns:
        None
    """
    lib.core.convert_ids_to_binary(["service_id", "auth_app_id"], kwargs)
    service_id = kwargs.get("service_id")
    auth_app_id = kwargs.get("auth_app_id")

    if auth_app_id is None and service_id is None:
        raise Exception("Either the auth_app_id or the service_id is required.")

    with lib.core.MrsDbSession(**kwargs) as session:
        users = None
        return lib.users.get_users(session, auth_app_id=auth_app_id, service_id=service_id)


@plugin_function('mrs.get.user', shell=True, cli=True, web=True)
def get_user(**kwargs):
    """Get user

    Args:
        **kwargs: Additional options

    Keyword Args:
        user_id (str): The user_id for the required user.
        session (object): The database session to use.

    Returns:
        None
    """
    lib.core.convert_ids_to_binary(["user_id"], kwargs)

    user_id = kwargs.get("user_id")

    with lib.core.MrsDbSession(**kwargs) as session:
        return lib.users.get_user(session, user_id)



@plugin_function('mrs.add.user', shell=True, cli=True, web=True)
def add_user(**kwargs):
    """Update user

    Args:
        **kwargs: Additional options

    Keyword Args:
        auth_app_id (str): The id of the auth_app for which the user is being created for.
        name (str): The name of the user.
        email (str): The email of the user
        vendor_user_id (str): The id of the vendor.
        login_permitted (bool): If permission is permitted by this user
        mapped_user_id (str): The id for the mapped user
        app_options (dict,required): The authentication app options for this user
        auth_string (str): The authentication string for the user.
        session (object): The database session to use.

    Returns:
        None
    """
    lib.core.convert_ids_to_binary(["auth_app_id"], kwargs)

    auth_app_id = kwargs.get("auth_app_id")
    name = kwargs.get("name")
    email = kwargs.get("email")
    vendor_user_id = kwargs.get("vendor_user_id")
    login_permitted = kwargs.get("login_permitted", False)
    mapped_user_id = kwargs.get("mapped_user_id")
    app_options = lib.core.convert_json(kwargs.get("app_options"))
    auth_string = kwargs.get("auth_string")

    with lib.core.MrsDbSession(**kwargs) as session:
        with lib.core.MrsDbTransaction(session):
            user_id = lib.users.add_user(session=session, auth_app_id=auth_app_id, name=name,
                email=email, vendor_user_id=vendor_user_id, login_permitted=login_permitted,
                mapped_user_id=mapped_user_id, app_options=app_options, auth_string=auth_string)

            auth_app = lib.auth_apps.get_auth_app(session, auth_app_id)
            if auth_app["default_role_id"]:
                role_comments = "Default role." if auth_app["default_role_id"] == lib.auth_apps.DEFAULT_ROLE_ID else ""
                lib.users.add_user_role(session, user_id, auth_app["default_role_id"], role_comments)

            return lib.users.get_user(session, user_id)


@plugin_function('mrs.delete.user', shell=True, cli=True, web=True)
def delete_user(user_id=None, session=None):
    """Delete user

    Args:
        user_id (str): The id of the user to delete
        session (object): The database session to use.

    Returns:
        None
    """
    user_id = lib.core.id_to_binary(user_id, "user_id")

    if not user_id:
        raise Exception("The user_id is required to perform this operation.")

    with lib.core.MrsDbSession(session=session) as session:
        with lib.core.MrsDbTransaction(session):
            lib.users.delete_user_by_id(session, user_id)

@plugin_function('mrs.update.user', shell=True, cli=True, web=True)
def update_user(**kwargs):
    """Update user

    Args:
        **kwargs: Additional options

    Keyword Args:
        user_id (str): The id of the user to update
        value (dict): The values to be updated
        session (object): The database session to use.

    Allowed options for value:
        auth_app_id (str): The id of the auth_app for which the user is being created for.
        name (str,required): The name of the user.
        email (str,required): The email of the user
        vendor_user_id (str,required): The id of the vendor.
        login_permitted (bool): If permission is permitted by this user
        mapped_user_id (str,required): The id for the mapped user
        app_options (dict,required): The authentication app options for this user
        auth_string (str,required): The authentication string for the user.

    Returns:
        None
    """
    lib.core.convert_ids_to_binary(["user_id"], kwargs)

    user_id = kwargs.get("user_id")

    value = lib.core.convert_json(kwargs.get("value"))

    if value.get("auth_string") == lib.users.STORED_PASSWORD_STRING:
        del value["auth_string"]

    lib.core.convert_ids_to_binary(["auth_app_id"], value)

    if "auth_string" in value and "auth_app_id" not in value:
        raise RuntimeError("The auth_app_id is required to set the auth_string.")

    with lib.core.MrsDbSession(**kwargs) as session:
        with lib.core.MrsDbTransaction(session):
            if value.keys():
                lib.users.update_user(session, user_id, value)

