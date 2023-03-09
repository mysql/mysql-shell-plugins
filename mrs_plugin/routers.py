# Copyright (c) 2023 Oracle and/or its affiliates.
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

@plugin_function('mrs.list.routerIds', shell=True, cli=True, web=True)
def get_router_ids(seen_within=None, session=None):
    """List all router ids

    Args:
        seen_within (int): When set, only routers that have checked-in within the last number of seconds are included.
        session (object): The database session to use.

    Returns:
        The list of router ids that fit into the criteria
    """
    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, session=session) as session:
        return lib.routers.get_router_ids(session, seen_within)


@plugin_function('mrs.list.routers', shell=True, cli=True, web=True)
def get_routers(active_when_seen_within=None, session=None):
    """List all configured routers

    Args:
        active_when_seen_within (int): The number of seconds after last check-in to declare the router is active or not.
        session (object): The database session to use.

    Returns:
        The list of configured router
    """
    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, session=session) as session:
        return lib.routers.get_routers(session, active_when_seen_within=active_when_seen_within or 10)


@plugin_function('mrs.delete.router', shell=True, cli=True, web=True)
def delete_router(router_id=None, session=None):
    """Delete an existing router

    Args:
        router_id (int): The id of the router to be deleted
        session (object): The database session to use.

    Returns:
        None
    """
    if not router_id:
        raise ValueError("The router_id needs to be specified.")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, session=session) as session:
        with lib.core.MrsDbTransaction(session):
            lib.routers.delete_router(session, router_id)
