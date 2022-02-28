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
from .ShellModuleSession import ShellModuleSession
from gui_plugin.core.Db import BackendDatabase
from gui_plugin.core import Error
import mysqlsh


@plugin_function('gui.shell.isGuiModuleBackend', web=True)
def is_gui_module_backend():
    """Indicates whether this module is a GUI backend module
    Returns:
        True
    """
    return True


@plugin_function('gui.shell.getGuiModuleDisplayInfo', web=True)
def get_gui_module_display_info():
    """Returns display information about the module
    Returns:
        A dict with display information for the module
    """
    return {
        "name": "MySQL Shell Console",
        "description": "A graphical MySQL Shell Console",
        "icon_path": "/images/icons/modules/gui.shell.svg"
    }


@plugin_function('gui.shell.startSession', shell=False, web=True)
def start_session(request_id, db_connection_id=None, shell_args=None, web_session=None):
    """Starts a new Shell Interactive Session
    Args:
        request_id (str): The request_id of the command.
        db_connection_id (int): The id of the connection id to use on the shell session.
        shell_args (list): The list of command line arguments required to execute a specific operation.
        web_session (object): The web_session object this session will belong to
    Returns:
        A dict holding the result message
    """
    options = None
    if db_connection_id is not None:
        db_type = None
        with BackendDatabase(web_session) as db:
            db_type, options = db.get_connection_details(db_connection_id)

        if db_type != "MySQL":
            raise Error.MSGException(Error.DB_INVALID_DB_TYPE,
                                     f'Shell operations only work with MySQL database connections.')

    new_session = ShellModuleSession(
        web_session, request_id, options=options, shell_args=shell_args)
    return Response.pending("New Shell session initiated...", {
        "module_session_id": new_session.module_session_id,
        "result": new_session._last_prompt
    })


@plugin_function('gui.shell.closeSession', shell=False, web=True)
def close_session(module_session):
    """Closes the Shell Interactive Session
    Args:
        module_session (object): The module session object that should be closed
    Returns:
        A dict holding the result message
    """
    module_session.close()
    return Response.ok("The Shell Interactive session has been closed successfully.", {
        "module_session_id": module_session.module_session_id
    })


@plugin_function('gui.shell.execute', shell=False, web=True)
def execute(command, module_session, request_id):
    """Execute a shell command
    Args:
        command (str): The shell command to run in the interactive shell
        module_session (object): The module session object where the command will be executed
        request_id (str): The request_id of the command.
    Returns:
        A dict holding the result message
    """
    module_session.execute(command=command, request_id=request_id)


@plugin_function('gui.shell.complete', shell=False, web=True)
def complete(data, offset, module_session, request_id):
    """Retrieve options to complete the given text on the shell context
    Args:
        data (str): The shell text to be completed
        offset (int): Completion offset
        module_session (object): The module session object where the completion will be executed
        request_id (str): The request_id of the command.
    Returns:
        A string list with the completion options
    """
    module_session.complete(data=data, offset=offset, request_id=request_id)


@plugin_function('gui.shell.killTask', shell=False, web=True)
def kill_task(module_session, request_id):
    """Kill a shell task
    Args:
        module_session (object): The module_session object that should be closed
        request_id (str): The request_id of the command.
    Returns:
        A dict holding the result message
    """
    module_session.kill_shell_task(request_id)
