# Copyright (c) 2023, 2025, Oracle and/or its affiliates.
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
import mrs_plugin.lib as lib
from .interactive import service_query_selection, resolve_file_path, resolve_overwrite_file, role_query_selection, resolve_role


def generate_create_statement(**kwargs) -> str:
    lib.core.convert_ids_to_binary(["role_id"], kwargs)
    lib.core.try_convert_ids_to_binary(["role"], kwargs)

    role_query = role_query_selection(**kwargs)

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        role = resolve_role(session, role_query=role_query)

        if role is None:
            raise Exception("Role not found.")

        return lib.roles.get_create_statement(session, role)


@plugin_function("mrs.list.roles", shell=True, cli=True, web=True)
def get_roles(service_id=None, session=None):
    """List the roles for the specified service

    Args:
        service_id (str): The id of the service
        session (object): The database session to use.

    Returns:
        The list of roles for the specified service
    """
    if service_id:
        service_id = lib.core.id_to_binary(service_id, "service_id")

    with lib.core.MrsDbSession(
        exception_handler=lib.core.print_exception, session=session
    ) as session:
        return lib.roles.get_roles(session, service_id)


@plugin_function("mrs.get.role", shell=True, cli=True, web=True)
def get_role(role_id=None, session=None, specific_to_service_id=None, caption=None):
    """Get a role by id or its caption.

    Args:
        role_id (str): The id of the role.
        caption (str): The caption of the role.
        specific_to_service_id (str): The id of the service when looking up the role by caption.
        session (object): The database session to use.

    Returns:
        The role with the given id or caption.
    """
    if specific_to_service_id:
        specific_to_service_id = lib.core.id_to_binary(
            specific_to_service_id, "specific_to_service_id"
        )

    with lib.core.MrsDbSession(
        exception_handler=lib.core.print_exception, session=session
    ) as session:
        return lib.roles.get_role(
            session,
            role_id=role_id,
            specific_to_service_id=specific_to_service_id,
            caption=caption,
        )


@plugin_function("mrs.add.role", shell=True, cli=True, web=True)
def add_role(caption, **kwargs):
    """Add a new role

    Args:
        caption (str): The caption for the new role
        **kwargs: Additional options

    Keyword Args:
        derived_from_role_id (str): The role from which this role derives
        specific_to_service_id (str): The id for the service to which this role belongs
        description (str): The role description
        session (object): The database session to use.

    Returns:
        None
    """
    lib.core.convert_ids_to_binary(
        ["derived_from_role_id", "specific_to_service_id"], kwargs
    )

    with lib.core.MrsDbSession(
        exception_handler=lib.core.print_exception, **kwargs
    ) as session:
        with lib.core.MrsDbTransaction(session):
            role_id = lib.roles.add_role(
                session,
                kwargs.get("derived_from_role_id"),
                kwargs.get("specific_to_service_id"),
                caption,
                kwargs.get("description"),
            )

            return lib.roles.get_role(session, role_id)


@plugin_function("mrs.add.rolePrivilege", shell=True, cli=True, web=True)
def add_role_privilege(role_id=None, session=None, operations=[], **kwargs):
    """
    Add a privilege to a role.

    Args:
        role_id (str): Id of the role to add privileges to.
        session (object): The database session to use.
        operations (list): List of operations allowed (CREATE, READ, UPDATE, DELETE)
        **kwargs: Additional options

    Keyword Args:
        service_path (str): The service path or pattern to grant privileges on.
        schema_path (str): The schema path or pattern to grant privileges on.
        object_path (str): The object path or pattern to grant privileges on.
    """

    if not operations:
        return

    lib.core.convert_ids_to_binary(["role_id"], kwargs)

    with lib.core.MrsDbSession(
        exception_handler=lib.core.print_exception, **kwargs
    ) as session:
        with lib.core.MrsDbTransaction(session):
            lib.roles.add_role_privilege(
                session=session,
                role_id=role_id,
                privileges=operations,
                service_path=kwargs.get("service_path"),
                schema_path=kwargs.get("schema_path"),
                object_path=kwargs.get("object_path"),
            )

            return lib.roles.get_role(session, role_id)


@plugin_function("mrs.delete.rolePrivilege", shell=True, cli=True, web=True)
def delete_role_privilege(role_id=None, session=None, operations=None, **kwargs):
    """
    Delete a privilege from a role.

    Args:
        role_id (str): Id of the role to delete privileges from.
        session (object): The database session to use.
        operations (list): List of operations to be removed (CREATE, READ, UPDATE, DELETE)
        **kwargs: Additional options

    Keyword Args:
        service (str): The service path or pattern to revoke privileges from.
        schema (str): The schema path or pattern to revoke privileges from.
        object (str): The object path or pattern to revoke privileges from.
    """

    lib.core.convert_ids_to_binary(["role_id"], kwargs)

    with lib.core.MrsDbSession(
        exception_handler=lib.core.print_exception, **kwargs
    ) as session:
        with lib.core.MrsDbTransaction(session):
            role_id = lib.roles.delete_role_privilege(
                session=session,
                role_id=role_id,
                privileges=operations,
                service_path=kwargs.get("service_path"),
                schema_path=kwargs.get("schema_path"),
                object_path=kwargs.get("object_path"),
            )

            return lib.roles.get_role(session, role_id)


@plugin_function('mrs.get.roleCreateStatement', shell=True, cli=True, web=True)
def get_create_statement(**kwargs):
    """Returns the corresponding CREATE REST ROLE SQL statement of the given MRS service object.

    When using the 'role' parameter, you can choose either of these formats:
        - '0x11EF8496143CFDEC969C7413EA499D96' - Hexadecimal string ID
        - 'Ee+ElhQ8/eyWnHQT6kmdlg==' - Base64 string ID
        - 'localhost/myService/myRole' - Human readable string ID

    Args:
        **kwargs: Options to determine what should be generated.

    Keyword Args:
        role_id (str): The ID of the role to generate.
        role_name (str): The name of the role to generate.
        role (str): The identifier of the schema.
        session (object): The database session to use.

    Returns:
        The SQL that represents the create statement for the MRS schema
    """
    return generate_create_statement(**kwargs)


@plugin_function('mrs.dump.roleCreateStatement', shell=True, cli=True, web=True)
def store_create_statement(**kwargs):
    """Stores the corresponding CREATE REST role SQL statement of the given MRS role
    object into a file.

    When using the 'role' parameter, you can choose either of these formats:
        - '0x11EF8496143CFDEC969C7413EA499D96' - Hexadecimal string ID
        - 'Ee+ElhQ8/eyWnHQT6kmdlg==' - Base64 string ID
        - 'localhost/myService/myRole' - Human readable string ID

    Args:
        **kwargs: Options to determine what should be generated.

    Keyword Args:
        role_id (str): The ID of the role to generate.
        role_name (str): The name of the role to generate.
        role (str): The identifier of the schema.
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