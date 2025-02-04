# Copyright (c) 2025 Oracle and/or its affiliates.
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

"""The MySQL Shell Schema Plugin"""

# cSpell:ignore mysqlsh

import json
from mysqlsh.plugin_manager import plugin_function
import msm_plugin.lib as lib
import os
from pathlib import Path

@plugin_function('msm.info', shell=True, cli=True, web=True)
def info() -> str:
    """Returns basic information about this plugin.

    Returns:
        str
    """
    return (f"MySQL Schema Management Plugin Version {lib.general.VERSION} PREVIEW\n"
            "Warning! For testing purposes only!")


@plugin_function('msm.version', shell=True, cli=True, web=True)
def version() -> str:
    """Returns the version number of the plugin

    Returns:
        str
    """
    return lib.general.VERSION


@plugin_function('msm.pwd', shell=True, cli=True, web=False)
def pwd() -> str:
    """Returns the current working directory.

    Returns:
        The current working directory.
    """
    return lib.core.get_working_dir()


@plugin_function('msm.cd', shell=True, cli=True, web=False)
def cd(directory: str) -> None:
    """Changes the current working directory.

    Args:
        directory (str): The directory to change the current working directory
            to. Use .. to change to the parent directory.

    Returns:
        None
    """
    working_dir = lib.core.get_working_dir()

    if directory.startswith("/") or directory.startswith("\\") or directory.startswith("~"):
        new_path = os.path.expanduser(directory)
    elif directory == "..":
        new_path = Path(working_dir).parent
    else:
        new_path = os.path.join(working_dir, directory)

    if not os.path.exists(new_path):
        raise ValueError(f"The given path {new_path} does not exist.")

    config_file = lib.core.ConfigFile()
    config_file.settings["workingDirectory"] = str(new_path)
    config_file.store()


@plugin_function('msm.ls', shell=True, cli=True, web=False)
def ls(path: str = None) -> list[str]:
    """Shows the content of the current working directory.

    Args:
        path (str): If specified, the contents of the path relative to the
            current working directory will be listed.

    Returns:
        A list of sub-folders of the current working directory
    """
    working_dir = lib.core.get_working_dir()

    if path is not None:
        if path.startswith("/") or path.startswith("\\") or path.startswith("~"):
            working_dir = os.path.expanduser(path)
        else:
            working_dir = os.path.join(working_dir, path)

    if not os.path.exists(working_dir):
        raise ValueError(f"The path {working_dir} does not exist.")

    items = []
    for sub_dir in next(os.walk(working_dir))[1]:
        items.append(f"{sub_dir} [Directory]")
    items.sort()

    files = []
    for file in next(os.walk(working_dir))[2]:
        files.append(file)
    files.sort()

    items.extend(files)

    if lib.core.get_interactive_default():
        print(f"Contents of `{working_dir}`:\n{"\n".join(items)}")
    else:
        return items
