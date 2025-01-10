# Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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

from mysqlsh.plugin_manager import plugin_function
from mrs_plugin import lib
from .interactive import service_query_selection, resolve_file_path, resolve_overwrite_file, user_query_selection, resolve_user

def generate_create_statement(**kwargs) -> str:
    lib.core.convert_ids_to_binary(["user_id"], kwargs)
    lib.core.try_convert_ids_to_binary(["user"], kwargs)

    include_all_objects = kwargs.get("include_all_objects", False)
    user_query = user_query_selection(**kwargs)

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        user = resolve_user(session, user_query=user_query)

        return lib.users.get_create_statement(session, user, include_all_objects)


@plugin_function("mrs.list.users", shell=True, cli=True, web=True)
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

    with lib.core.MrsDbSession(
        exception_handler=lib.core.print_exception, **kwargs
    ) as session:
        users = None
        return lib.users.get_users(
            session, auth_app_id=auth_app_id, service_id=service_id
        )


@plugin_function("mrs.get.user", shell=True, cli=True, web=True)
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

    with lib.core.MrsDbSession(
        exception_handler=lib.core.print_exception, **kwargs
    ) as session:
        return lib.users.get_user(session, user_id)


@plugin_function("mrs.add.user", shell=True, cli=True, web=True)
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
        app_options (dict): The authentication app options for this user
        auth_string (str): The authentication string for the user.
        user_roles (list): The list of user roles for this user. This needs to be in the following format
            {
                "role_id": "0x......",
                "comments": "Add some comments"
            }
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

    user_roles = kwargs.get("user_roles")

    with lib.core.MrsDbSession(
        exception_handler=lib.core.print_exception, **kwargs
    ) as session:
        with lib.core.MrsDbTransaction(session):
            user_id = lib.users.add_user(
                session=session,
                auth_app_id=auth_app_id,
                name=name,
                email=email,
                vendor_user_id=vendor_user_id,
                login_permitted=login_permitted,
                mapped_user_id=mapped_user_id,
                app_options=app_options,
                auth_string=auth_string,
            )

            if user_roles is None:
                user_roles = []

            user_roles = [
                {
                    "user_id": user_id,
                    "role_id": lib.core.id_to_binary(
                        user_role["role_id"], "user_role_id"
                    ),
                    "comments": None,
                }
                for user_role in user_roles
            ]

            auth_app = lib.auth_apps.get_auth_app(session, auth_app_id)
            default_role_id = auth_app["default_role_id"]

            # Add the default role to the user if specified
            user_role_filter = list(
                filter(lambda role: role["role_id"] == default_role_id, user_roles)
            )
            if default_role_id and not user_role_filter:
                user_roles.append(
                    {
                        "user_id": user_id,
                        "role_id": default_role_id,
                        "comments": "Default role.",
                    }
                )

            for role in user_roles:
                lib.users.add_user_role(
                    session, role["user_id"], role["role_id"], role["comments"]
                )

            return lib.users.get_user(session, user_id)


@plugin_function("mrs.delete.user", shell=True, cli=True, web=True)
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

    with lib.core.MrsDbSession(
        exception_handler=lib.core.print_exception, session=session
    ) as session:
        with lib.core.MrsDbTransaction(session):
            lib.users.delete_user_by_id(session, user_id)


@plugin_function("mrs.update.user", shell=True, cli=True, web=True)
def update_user(**kwargs):
    """Update user

    Args:
        **kwargs: Additional options

    Keyword Args:
        user_id (str): The id of the user to update
        value (dict): The values to be updated
        user_roles (list): The list of user roles for this user. This needs to be in the following format
            {
                "role_id": "0x......",
                "comments": "Add some comments"
            }
        session (object): The database session to use.

    Allowed options for value:
        auth_app_id (str): The id of the auth_app for which the user is being created for.
        name (str): The name of the user.
        email (str): The email of the user
        vendor_user_id (str): The id of the vendor.
        login_permitted (bool): If permission is permitted by this user
        mapped_user_id (str): The id for the mapped user
        app_options (dict): The authentication app options for this user
        auth_string (str): The authentication string for the user.

    Returns:
        None
    """
    lib.core.convert_ids_to_binary(["user_id"], kwargs)

    user_id = kwargs.get("user_id")

    value = lib.core.convert_json(kwargs.get("value"))
    user_roles = lib.core.convert_json(kwargs.get("user_roles"))

    if user_roles:
        for user_role in user_roles:
            lib.core.convert_ids_to_binary(["user_id", "role_id"], user_role)

    if value.get("auth_string") == lib.users.STORED_PASSWORD_STRING:
        del value["auth_string"]

    lib.core.convert_ids_to_binary(["auth_app_id"], value)

    if "auth_string" in value and "auth_app_id" not in value:
        raise RuntimeError("The auth_app_id is required to set the auth_string.")

    with lib.core.MrsDbSession(
        exception_handler=lib.core.print_exception, **kwargs
    ) as session:
        with lib.core.MrsDbTransaction(session):
            if value:
                lib.users.update_user(
                    session,
                    user_id=user_id,
                    value=value,
                )

            if user_roles is not None:
                lib.users.delete_user_roles(session, user_id)

                for role in user_roles:
                    lib.users.add_user_role(
                        session, user_id, role["role_id"], role["comments"]
                    )


@plugin_function("mrs.list.userRoles", shell=True, cli=True, web=True)
def get_user_roles(user_id=None, session=None):
    """Get all user roles

    Args:
        user_id (str): The id of the user
        session (object): The database session to use.

    Returns:
        None
    """
    if user_id:
        user_id = lib.core.id_to_binary(user_id, "user_id")

    with lib.core.MrsDbSession(session=session) as session:
        return lib.users.get_user_roles(session, user_id)


@plugin_function("mrs.add.userRole", shell=True, cli=True, web=True)
def add_user_role(user_id=None, role_id=None, comments=None, session=None):
    """Add a user role

    Args:
        user_id (str): The id of the user
        role_id (str): The id of the role
        comments (str): Comments for this role connection
        session (object): The database session to use.

    Returns:
        None
    """
    if user_id:
        user_id = lib.core.id_to_binary(user_id, "user_id")
    if role_id:
        role_id = lib.core.id_to_binary(role_id, "role_id")

    with lib.core.MrsDbSession(session=session) as session:
        with lib.core.MrsDbTransaction(session):
            lib.users.add_user_role(session, user_id, role_id, comments)


@plugin_function("mrs.delete.userRoles", shell=True, cli=True, web=True)
def delete_user_roles(user_id=None, role_id=None, session=None):
    """Delete all user roles or a single one if the role id is also specified

    Args:
        user_id (str): The id of the user
        role_id (str): The id of the role
        session (object): The database session to use.

    Returns:
        None
    """
    if user_id:
        user_id = lib.core.id_to_binary(user_id, "user_id")
    if role_id:
        role_id = lib.core.id_to_binary(role_id, "role_id")

    with lib.core.MrsDbSession(session=session) as session:
        with lib.core.MrsDbTransaction(session):
            lib.users.delete_user_roles(session, user_id, role_id)


@plugin_function('mrs.get.userCreateStatement', shell=True, cli=True, web=True)
def get_create_statement(**kwargs):
    """Returns the corresponding CREATE REST SCHEMA SQL statement of the given MRS service object.

    When using the 'user' parameter, you can choose either of these formats:
        - '0x11EF8496143CFDEC969C7413EA499D96' - Hexadecimal string ID
        - 'Ee+ElhQ8/eyWnHQT6kmdlg==' - Base64 string ID
        - 'localhost/myService/authApp/user' - Human readable string ID

    Args:
        **kwargs: Options to determine what should be generated.

    Keyword Args:
        user_id (str): The ID of the user to generate.
        user (str): The identifier of the user.
        include_all_objects (bool): Include all objects that belong to the user.
        session (object): The database session to use.

    Returns:
        The SQL that represents the create statement for the MRS schema
    """
    return generate_create_statement(**kwargs)


@plugin_function('mrs.dump.userCreateStatement', shell=True, cli=True, web=True)
def store_create_statement(**kwargs):
    """Stores the corresponding CREATE REST schema SQL statement of the given MRS schema
    object into a file.

    When using the 'user' parameter, you can choose either of these formats:
        - '0x11EF8496143CFDEC969C7413EA499D96' - Hexadecimal string ID
        - 'Ee+ElhQ8/eyWnHQT6kmdlg==' - Base64 string ID
        - 'localhost/myService/authApp/user' - Human readable string ID

    Args:
        **kwargs: Options to determine what should be generated.

    Keyword Args:
        user_id (str): The ID of the user to generate.
        user (str): The identifier of the user.
        include_all_objects (bool): Include all objects that belong to the user.
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