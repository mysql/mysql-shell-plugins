# Copyright (c) 2020, 2021, Oracle and/or its affiliates.
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
import mysqlsh
from gui_plugin.core.Protocols import Response
import re


@plugin_function('gui.core.getBackendInformation', shell=False, web=True)
def get_backend_information():
    """Returns information about backend

    Returns:
        A dict with information about backend
    """

    try:
        version = mysqlsh.globals.shell.version
        info = parse_shell_version(version)
    except Exception as e:
        return Response.error(str(e) + "\nMysql Shell version: %s" % version)

    return Response.ok("Successfully obtained backend info.", {"info": info})


def parse_shell_version(version):
    m = re.match(
        r"Ver (\d+\.\d+\.\d+)(-.+)? for (.+) on (.+) - for MySQL (\d+\.\d+\.\d+)(-.+)? \((.+)\)", version)
    if not m:
        raise Exception("Version does not match regexp pattern.")
    info = {}
    info["major"], info["minor"], info["patch"] = m.group(1).split(".")
    info["platform"] = m.group(3)
    info["architecture"] = m.group(4)
    info["server_major"], info["server_minor"], info["server_patch"] = m.group(
        5).split(".")
    info["server_distribution"] = m.group(7)
    return info
