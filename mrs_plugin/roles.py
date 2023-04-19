# Copyright (c) 2023, Oracle and/or its affiliates.
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
import mrs_plugin.lib as lib


@plugin_function('mrs.list.roles', shell=True, cli=True, web=True)
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

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, session=session) as session:
        return lib.roles.get_roles(session, service_id)


@plugin_function('mrs.add.role', shell=True, cli=True, web=True)
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
    lib.core.convert_ids_to_binary(["derived_from_role_id", "specific_to_service_id"], kwargs)

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        with lib.core.MrsDbTransaction(session):
            role_id = lib.roles.add_role(session, kwargs.get("derived_from_role_id"),
                kwargs.get("specific_to_service_id"),
                caption,
                kwargs.get("description"))

            return lib.roles.get_role(session, role_id)


