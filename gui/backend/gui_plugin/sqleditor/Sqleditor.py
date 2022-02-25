# Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

from mysqlsh.plugin_manager import plugin_function  # pylint: disable=no-name-in-module
from gui_plugin.core.Protocols import Response
from gui_plugin.sqleditor.SqleditorModuleSession import SqleditorModuleSession


@plugin_function('gui.sqleditor.isGuiModuleBackend', web=True)
def is_gui_module_backend():
    """Indicates whether this module is a GUI backend module

    Returns:
        True
    """
    return True


@plugin_function('gui.sqleditor.getGuiModuleDisplayInfo', web=True)
def get_gui_module_display_info():
    """Returns display information about the module

    Returns:
        A dict with display information for the module
    """
    return {"name": "SQL Editor",
            "description": "A graphical SQL Editor",
            "icon_path": "/images/icons/modules/gui.sqleditor.svg"}


@plugin_function('gui.sqleditor.startSession', shell=False, web=True)
def start_session(web_session=None):
    """Starts a SQL Editor Session

    Args:
        web_session (object): The web_session object this session will belong to
    Returns:
        A dict holding the result message
    """
    new_session = SqleditorModuleSession(web_session)

    result = Response.ok("New SQL Editor session created successfully.", {
        "module_session_id": new_session.module_session_id
    })

    return result


@plugin_function('gui.sqleditor.closeSession', shell=False, web=True)
def close_session(module_session):
    """Closes the SQL Editor Session

    Args:
        module_session (object): The module session object that should be closed
    Returns:
        A dict holding the result message
    """
    module_session.close()

    return Response.ok("SQL Editor session has been closed successfully.", {
        "module_session_id": module_session.module_session_id
    })


@plugin_function('gui.sqleditor.openConnection', shell=False, web=True)
def open_connection(db_connection_id, module_session, request_id, password=None):
    """Opens the SQL Editor Session

    Args:
        db_connection_id (int): The id of the db_connection
        module_session (object): The session where the connection will open
        request_id (str): ID of the request starting the session.
        password (str): The password to use when opening the connection. If not supplied, then use the password defined in the database options.

    Returns:
        A dict holding the result message and the connection information
        when available.
    """
    module_session.open_connection(db_connection_id, password, request_id)

@plugin_function('gui.sqleditor.reconnect', shell=False, web=True)
def reconnect(module_session, request_id):
    """Reconnects the SQL Editor Session

    Args:
        module_session (object): The session where the session will be reconnected
        request_id (str): ID of the request for reconnection.

    Returns:
        A dict holding the result message and the connection information
        when available.
    """
    module_session.reconnect(request_id)


@plugin_function('gui.sqleditor.execute', shell=False, web=True)
def execute(sql, module_session, request_id, params=None, options=None):
    """Executes the given SQL.

    Args:
        sql (str): The sql command to execute.
        module_session (object): The module session object the function should operate on
        request_id (str): The request_id of the command.
        params (list): The parameters for the sql command.
        options (dict): A dictionary that holds additional options, e.g.
            {"row_packet_size": -1}

    Allowed options for options:
        row_packet_size (int): The pack size for each result segment

    Returns:
        A dict holding the result message
    """
    module_session.execute(sql=sql, request_id=request_id, params=params,
                           options=options)


@plugin_function('gui.sqleditor.killQuery', shell=False, web=True)
def kill_query(module_session):
    """Stops the query that is currently executing.

    Args:
        module_session (object): The module session object where the query is running

    Returns:
        Nothing
    """
    module_session.kill_query()

    result = Response.ok('Query kill requested')


@plugin_function('gui.sqleditor.getCurrentSchema', shell=False, web=True)
def get_current_schema(module_session, request_id):
    """Requests the current schema for this module.

    Args:
        module_session (object): The module session object where to get the current schema from
        request_id (str): The request_id of the command.

    Returns:
        Nothing
    """
    module_session.get_current_schema(request_id=request_id)


@plugin_function('gui.sqleditor.setCurrentSchema', shell=False, web=True)
def set_current_schema(module_session, request_id, schema_name):
    """Requests to change the current schema for this module.

    Args:
        module_session (object): The module session object where to update the current schema
        request_id (str): The request_id of the command.
        schema_name (str): The name of the schema to use

    Returns:
        Nothing
    """
    module_session.set_current_schema(
        request_id=request_id, schema_name=schema_name)


@plugin_function('gui.sqleditor.getAutoCommit', shell=False, web=True)
def get_auto_commit(module_session, request_id):
    """Requests the auto-commit status for this module.

    Args:
        module_session (object): The module session object where to get the current schema from
        request_id (str): The request_id of the command.

    Returns:
        Nothing
    """
    module_session.get_auto_commit(request_id=request_id)


@plugin_function('gui.sqleditor.setAutoCommit', shell=False, web=True)
def set_auto_commit(module_session, request_id, state):
    """Requests to change the auto-commit status for this module.

    Args:
        module_session (object): The module session object where to update the current schema
        request_id (str): The request_id of the command.
        state (bool): The auto-commit state to set for the module session

    Returns:
        Nothing
    """
    module_session.set_auto_commit(request_id=request_id, state=state)
