# Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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

from mysqlsh.plugin_manager import \
    plugin_function  # pylint: disable=no-name-in-module

from gui_plugin.db import backend
from gui_plugin.sqleditor.SqleditorModuleSession import SqleditorModuleSession


@plugin_function('gui.sqleditor.isGuiModuleBackend', web=True)
def is_gui_module_backend():
    """Indicates whether this module is a GUI backend module

    Returns:
        bool: True
    """
    return True


@plugin_function('gui.sqleditor.getGuiModuleDisplayInfo', web=True)
def get_gui_module_display_info():
    """Returns display information about the module

    Returns:
        dict: display information for the module
    """
    return {"name": "SQL Editor",
            "description": "A graphical SQL Editor",
            "icon_path": "/images/icons/modules/gui.sqleditor.svg"}


@plugin_function('gui.sqleditor.startSession', shell=False, web=True)
def start_session():
    """Starts a SQL Editor Session

    Returns:
        dict: contains module session ID
    """
    new_session = SqleditorModuleSession()

    return {"module_session_id": new_session.module_session_id}


@plugin_function('gui.sqleditor.closeSession', shell=False, web=True)
def close_session(module_session):
    """Closes the SQL Editor Session

    Args:
        module_session (object): The module session object that should be closed
    Returns:
        None
    """
    module_session.close()


@plugin_function('gui.sqleditor.openConnection', shell=False, web=True)
def open_connection(db_connection_id, module_session, password=None):
    """Opens the SQL Editor Session

    Args:
        db_connection_id (int): The id of the db_connection
        module_session (object): The session where the connection will open
        password (str): The password to use when opening the connection. If not supplied, then use the password defined in the database options.

    Returns:
        None
    """
    module_session.open_connection(db_connection_id, password)


@plugin_function('gui.sqleditor.reconnect', shell=False, web=True)
def reconnect(module_session):
    """Reconnects the SQL Editor Session

    Args:
        module_session (object): The session where the session will be reconnected

    Returns:
        None
    """
    module_session.reconnect()


@plugin_function('gui.sqleditor.execute', shell=True, web=True)
def execute(session, sql, params=None, options=None):
    """Executes the given SQL.

    Args:
        session (object): The session used to execute the operation
        sql (str): The sql command to execute.
        params (list): The parameters for the sql command.
        options (dict): A dictionary that holds additional options, e.g.
            {"row_packet_size": -1}

    Allowed options for options:
        row_packet_size (int): The pack size for each result segment

    Returns:
        dict: the result message
    """
    session = backend.get_db_session(session)

    return session.execute(sql=sql, params=params, options=options)


@plugin_function('gui.sqleditor.killQuery', shell=False, web=True)
def kill_query(module_session):
    """Stops the query that is currently executing.

    Args:
        module_session (object): The module session object where the query is running

    Returns:
        None
    """
    module_session.kill_query()


@plugin_function('gui.sqleditor.getCurrentSchema', shell=True, web=True)
def get_current_schema(session):
    """Requests the current schema for this module.

    Args:
        session (object): The session used to execute the operation

    Returns:
        str: current schema name
    """
    session = backend.get_db_session(session)
    return session.get_current_schema()


@plugin_function('gui.sqleditor.setCurrentSchema', shell=True, web=True)
def set_current_schema(session, schema_name):
    """Requests to change the current schema for this module.

    Args:
        session (object): The session used to execute the operation
        schema_name (str): The name of the schema to use

    Returns:
        None
    """
    session = backend.get_db_session(session)
    session.set_current_schema(schema_name=schema_name)


@plugin_function('gui.sqleditor.getAutoCommit', shell=True, web=True)
def get_auto_commit(session):
    """Requests the auto-commit status for this module.

    Args:
        session (object): The session used to execute the operation

    Returns:
        int: auto-commit status
    """
    session = backend.get_db_session(session)
    return session.get_auto_commit()


@plugin_function('gui.sqleditor.setAutoCommit', shell=True, web=True)
def set_auto_commit(session, state):
    """Requests to change the auto-commit status for this module.

    Args:
        session (object): The session used to execute the operation
        state (bool): The auto-commit state to set for the module session

    Returns:
        None
    """
    session = backend.get_db_session(session)
    session.set_auto_commit(state=state)
