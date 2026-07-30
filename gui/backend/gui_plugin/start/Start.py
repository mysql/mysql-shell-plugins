# Copyright (c) 2020, 2026, Oracle and/or its affiliates.
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

"""MySQL Shell GUI desktop bridge entry point."""

from mysqlsh.plugin_manager import plugin_function  # pylint: disable=no-name-in-module

import gui_plugin.core.Logger as logger
from gui_plugin.core.RouterCertificates import ensure_router_certificate
from gui_plugin.core.ShellGuiStdioBridge import ShellGuiStdioBridge


@plugin_function("gui.start.desktopBridge", cli=True)
def desktop_bridge():
    """Starts the trusted local GUI JSON bridge over standard I/O.

    The Workbench Electron host owns the renderer and launches MySQL Shell as
    its child process. Standard output is therefore reserved for JSON protocol
    messages and logging is sent to standard error.

    Returns:
        Nothing
    """
    logger.set_console_stream("stderr")
    if not ensure_router_certificate():
        logger.warning("Could not create TLS material for local MySQL Router instances")
    logger.info("Starting MySQL Shell GUI desktop bridge...")
    with ShellGuiStdioBridge() as bridge:
        bridge.run()
