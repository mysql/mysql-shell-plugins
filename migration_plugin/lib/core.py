# Copyright (c) 2025, Oracle and/or its affiliates.
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

"""Sub-Module for core functions"""

# cSpell:ignore mysqlsh, msm
from enum import IntEnum
import os
import pathlib
import threading
import mysqlsh
import mysqlsh.plugin_manager
import mysqlsh.mysql
from mds_plugin import configuration as mds_configuration


def get_plugin_data_path(create=True) -> str:
    # Get migration plugin data folder, create if it does not exist yet
    plugin_data_path = os.path.abspath(
        mysqlsh.plugin_manager.general.get_shell_user_dir(
            "plugin_data", "migration_plugin"
        )
    )

    if create:
        pathlib.Path(plugin_data_path).mkdir(parents=True, exist_ok=True)

    return plugin_data_path


def get_mysqlsh_log_path() -> str:
    return os.path.abspath(
        mysqlsh.plugin_manager.general.get_shell_user_dir(
            "mysqlsh.log"
        )
    )


def default_projects_directory(create: bool):
    return get_plugin_data_path(create=create)


def default_shared_ssh_key_directory(create: bool):
    path = os.path.join(get_plugin_data_path(), "ssh")
    if create:
        os.makedirs(path, mode=0o700, exist_ok=True)
    return path


def default_oci_config_file() -> str:
    return mds_configuration.get_default_config_file_path()


def default_oci_profile() -> str:
    return mds_configuration.get_default_profile() or "DEFAULT"


def get_interactive_default():
    """Returns the default of the interactive mode

    Returns:
        True if the interactive mode is enabled, False otherwise
    """
    if mysqlsh.globals.shell.options.useWizards:
        ct = threading.current_thread()
        if ct.__class__.__name__ == "_MainThread":
            return True
    return False


class LogLevel(IntEnum):
    NONE = 1
    INTERNAL_ERROR = 2
    ERROR = 3
    WARNING = 4
    INFO = 5
    DEBUG = 6
    DEBUG2 = 7
    DEBUG3 = 8


def get_interactive_result():
    """
    To be used in plugin functions that may return pretty formatted result when
    called in an interactive Shell session
    """
    return get_interactive_default()


def script_path(*suffixes):
    return os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), *suffixes
    )


def escape_str(s):
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("'", "\\'")


def quote_str(s):
    return '"' + escape_str(s) + '"'


def unescape_str(s):
    return s.replace("\\'", "'").replace('\\"', '"').replace("\\\\", "\\")


def unquote_str(s):
    if (s.startswith("'") and s.endswith("'")) or (
        s.startswith('"') and s.endswith('"')
    ):
        return unescape_str(s[1:-1])
    return s


def quote_ident(s):
    return mysqlsh.mysql.quote_identifier(s)


def unquote_ident(s):
    return mysqlsh.mysql.unquote_identifier(s)


def make_string_valid_for_filesystem(str, invalid_characters='<>:"/\\|?*'):
    for invalid_character in invalid_characters:
        str = str.replace(invalid_character, "")
    return str
