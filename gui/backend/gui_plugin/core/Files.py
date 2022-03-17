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
from gui_plugin.core.Db import GuiBackendDb
import os
import sqlite3
from gui_plugin.core.Protocols import Response
import mysqlsh
from pathlib import Path, PurePath
from gui_plugin.core.Error import MSGException
import gui_plugin.core.Error as Error
from gui_plugin.core.Db import BackendDatabase, BackendTransaction


def resolve_path(path, web_session):
    "This function returns a tuple (full path, relative path) with the resolved paths"
    if PurePath(Path(path).name.split(",")[0]).is_reserved():
        raise MSGException(Error.CORE_RESERVED_NOT_ALLOWED,
                           "Reserved paths are not allowed.")

    if not web_session or web_session.is_local_session:
        # This is a local connection
        if os.path.isabs(path):
            return Path(os.path.abspath(path)).as_posix(), Path(os.path.abspath(path)).as_posix()
        return Path(os.path.abspath(os.path.join(str(Path.home()), path))).as_posix(), Path(str(Path.home())).as_posix()

    # This is a remote (non-local) connection
    if os.path.isabs(path):
        raise MSGException(Error.CORE_ABSPATH_NOT_ALLOWED,
                           "Absolute paths are not allowed.")

    user_space = os.path.abspath(mysqlsh.plugin_manager.general.get_shell_user_dir(
        'plugin_data', 'gui_plugin', f"user_{web_session.user_id}"))
    full_path = os.path.abspath(os.path.join(user_space, path))

    if not full_path.startswith(user_space):
        raise MSGException(Error.CORE_ACCESS_OUTSIDE_USERSPACE,
                           "Trying to access outside the user directory.")

    # +1 to remove the leading / since it's a relative path
    return Path(full_path).as_posix(), Path(full_path[len(user_space) + 1:]).as_posix()


@plugin_function('gui.core.listFiles', shell=False, web=True)
def list_files(path="", web_session=None):
    """Returns the contents of a directory.

    It gets the contents of the specified directory and returns them.
    If running in multi-user mode, the directory is relative to the user space and requests
    outside the user space will result in error.
    If running in single-user mode, absolute paths area allowed, but if a relative path is
    supplied, then it will be relative to the system user home directory.
    If the path is empty, "." or "./" it will be resolved as the root to the relative
    path in the running mode.

    Args:
        path (str): The path to get the contents from
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically

    Returns:
        A list of files that exist in the requested directory
    """

    # the rel_path is the full_path on local sessions
    full_path, rel_path = resolve_path(path, web_session)

    if not os.path.exists(full_path):
        raise MSGException(Error.CORE_PATH_NOT_EXIST,
                            "The supplied path does not exist.")

    if not os.path.isdir(full_path):
        raise MSGException(Error.CORE_NOT_DIRECTORY,
                            "The supplied path is not a directory.")

    if not os.access(full_path, os.R_OK):
        raise MSGException(Error.CORE_PERMISSION_DENIED,
                            "No permissions to access the directory.")

    list_of_files = []
    for item in os.listdir(full_path):
        p = Path(os.path.join(rel_path, item))
        list_of_files.append(p.as_posix())

    result = Response.ok("Files in directory", {
        "result": list_of_files
    })

    return result


@plugin_function('gui.core.createFile', shell=False, web=True)
def create_file(path, web_session=None):
    """Creates a new file specified by the path.

    If running in multi-user mode, the directory is relative to the user space and requests
    outside the user space will result in error.
    If running in single-user mode, absolute paths area allowed, but if a relative path is
    supplied, then it will be relative to the system user home directory.
    If the path starts with "." or "./" it will be resolved as the root to the relative
    path in the running mode.

    The file type to be created is determined by the file extension.
    The supported file types are as follows:
        - SQLITE (use the .sqlite or .sqlite3 extensions)

    Args:
        path (str): The path and file name relative to the user space
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically

    Returns:
        The path to the created file on success.
    """

    if path == "":
        raise MSGException(Error.CORE_PATH_NOT_SUPPLIED,
                            "The supplied path is empty.")

    # the rel_path is the full_path on local sessions
    full_path, rel_path = resolve_path(path, web_session)

    if os.path.isdir(full_path):
        raise MSGException(Error.CORE_NOT_FILE,
                            "The supplied path is not a file.")

    if not os.access(os.path.dirname(full_path), os.W_OK):
        raise MSGException(Error.CORE_PERMISSION_DENIED,
                            "No permissions to access the directory.")

    if os.path.exists(full_path):
        raise MSGException(Error.CORE_PATH_ALREADY_EXISTS,
                            "The supplied file already exists.")

    if full_path.endswith(".sqlite") or full_path.endswith(".sqlite3"):
        conn = sqlite3.connect(full_path)
        conn.close()
    else:
        raise MSGException(Error.CORE_INVALID_EXTENSION,
                            "The file does not have a valid extension.")

    result = Response.ok("The file was created", {
        "result": rel_path
    })

    return result


@plugin_function('gui.core.validatePath', shell=False, web=True)
def validate_path(path, web_session=None):
    """Validates the specified path.

    If running in multi-user mode, the directory is relative to the user space and requests
    outside the user space will result in error.
    If running in single-user mode, absolute paths area allowed, but if a relative path is
    supplied, then it will be relative to the system user home directory.
    If the path is empty, "." or "./" it will be resolved as the root to the relative
    path in the running mode.

    Args:
        path (str): The path to a directory or file
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically

    Returns:
        The path to the created file on success.
    """

    try:
        # the rel_path is the full_path on local sessions
        full_path, rel_path = resolve_path(path, web_session)
        return_path = full_path if web_session.is_local_session else rel_path

        if not os.path.exists(full_path):
            raise MSGException(Error.CORE_PATH_NOT_EXIST,
                               "The supplied path does not exist.")

        if not os.access(full_path, os.R_OK):
            raise MSGException(Error.CORE_PERMISSION_DENIED,
                               "No permissions to read from the supplied path.")

        if not os.access(full_path, os.W_OK):
            raise MSGException(Error.CORE_PERMISSION_DENIED,
                               "No permissions to write in the supplied path.")

        result = Response.ok("", {
            "result": {
                "path": return_path
            }
        })

    except Exception as e:  # pragma: no cover
        result = Response.exception(e, {
            "result": {
                # Might happen the resolve_path raises an error
                "path": return_path if 'return_path' in locals() else path
            }
        })

    return result
