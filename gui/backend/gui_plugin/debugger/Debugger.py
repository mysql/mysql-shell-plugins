# Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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

import os
from pathlib import Path
from mysqlsh.plugin_manager import plugin_function  # pylint: disable=no-name-in-module


@plugin_function('gui.debugger.isGuiModuleBackend', web=True)
def is_gui_module_backend():
    """ Indicates whether this module is a GUI backend module

    Returns:
        bool True
    """
    return True


@plugin_function('gui.debugger.getGuiModuleDisplayInfo', web=True)
def get_gui_module_display_info():
    """ Returns display information about the module

    Returns:
        dict: display information for the module
    """
    return {"name:": "Debugger",
            "description": "Websocket Debugger",
            "icon_path": "/images/icons/modules/gui.wsdebugger.svg"}


def list_scripts() -> list:
    this_file = Path(__file__)
    user_stories = []
    root = Path(os.path.join(this_file.parent, "scripts"))
    root_len = len(root.as_posix())
    for path in root.rglob("*"):
        if path.as_posix().endswith('.pre') or path.as_posix().endswith('.post'):
            continue
        if path.is_file():
            user_stories.append(path.as_posix()[root_len + 1:])

    return user_stories


@plugin_function('gui.debugger.getScripts', shell=False, web=True)
def get_scripts() -> list:
    """Returns the list of available scripts

    Returns:
        list: available scripts
    """
    return list_scripts()


def read_script(path: str) -> str:
    this_file = Path(__file__)
    path_tokens = [this_file.parent, "scripts"] + path.split("/")
    target_path = os.path.join(*path_tokens)
    target = Path(target_path)
    if target.is_file():
        return target.read_text(encoding="utf-8")
    else:
        raise Exception(f"The requested story does not exist: {path}")


@plugin_function('gui.debugger.getScriptContent', shell=False, web=True)
def get_script_content(path: str) -> str:
    """Returns the content of the given script

    Args:
        path (string): The path to the script
    Returns:
        str: Content of the script

    The default behavior of this function is to return the script content
    exactly as defined.
    """
    return read_script(path)
