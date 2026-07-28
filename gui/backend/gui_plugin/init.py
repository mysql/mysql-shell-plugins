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

"""Plugin registration

This file is automatically loaded by the MySQL Shell at startup time.

It registers the plugin objects and then imports all sub-modules to
register the plugin object member functions.
"""

from os import environ

from mysqlsh.plugin_manager import plugin  # pylint: disable=import-error

DEBUG_MODE = int(environ.get("MYSQL_SHELL_GUI_DEBUG_MODE", "0"))


# Create a class representing the structure of the plugin and use the
# @register_plugin decorator to register it
@plugin
class gui:
    """MySQL Shell GUI backend plugin.

    This plugin serves as the backend for the MySQL Shell GUI projects.
    """

    def __init__(self):
        """Constructor that will import all relevant sub-modules

        The constructor is called by the @plugin decorator to
        automatically register all decorated functions in the sub-modules
        """
        # Import all sub-modules to register the decorated functions there
        from gui_plugin import (
            cluster,
            core,
            db_connections,
            legacy,
            meb,
            mds,
            migration,
            modeler,
        )
        from gui_plugin import shell, sql_editor, users, start
        from gui_plugin import modules, db, general, mysql
        from gui_plugin import Meb

        migration.register()

        if DEBUG_MODE:
            from gui_plugin import debugger

    class cluster:
        """The InnoDB Cluster MySQL Shell GUI backend module

        This extension object holds the backend implementation of the
        InnoDB Cluster MySQL Shell GUI module
        """

    class core:
        """The Core MySQL Shell GUI backend module

        This extension object holds the backend implementation of the
        Core MySQL Shell GUI module
        """

    class db_connections:
        """The DB Connections MySQL Shell GUI backend module

        This extension object holds the backend implementation of the
        DB Connections MySQL Shell GUI module
        """

    class legacy:
        """The legacy configuration import backend module.

        This extension object discovers and imports supported data from
        classic Workbench and MySQL Shell for VS Code.
        """

    class modeler:
        """The Modeler MySQL Shell GUI backend module

        This extension object holds the backend implementation of the
        Modeler MySQL Shell GUI module
        """

    class modules:
        """The Modules MySQL Shell GUI backend module

        This extension object holds the backend implementation of the
        Modules MySQL Shell GUI module
        """

    class mds:
        """The MySQL Database Service MySQL Shell GUI backend module

        This extension object holds the backend implementation of the
        MySQL Database Service MySQL Shell GUI module
        """

    class migration:
        """The Migration Assistant MySQL Shell GUI backend module

        This extension object holds the backend implementation of the
        Migration Assistant module
        """

    class meb:
        """The MySQL Enterprise Backup MySQL Shell GUI backend module

        This extension object holds the backend implementation of the
        MySQL Enterprise Backup GUI module.
        """

    class shell:
        """The Shell MySQL Shell GUI backend module

        This extension object holds the backend implementation of the
        Shell MySQL Shell GUI module
        """

    class sql_editor:
        """The SQL Editor MySQL Shell GUI backend module

        This extension object holds the backend implementation of the
        SQL Editor MySQL Shell GUI module
        """

    class users:
        """The Users MySQL Shell GUI backend module

        This extension object holds the backend implementation of the
        Users MySQL Shell GUI module
        """

    if DEBUG_MODE:

        class debugger:
            """The websocket debugger module

            This extension object holds the backend implementation of the
            Websocket debugger module
            """

    class start:
        """Used to start the MySQL Shell GUI

        The MySQL Shell GUI is hosted by the MySQL Workbench desktop application.
        """

    class db:
        """Used to retrieve metadata from database

        This extension allow user to retrieve metadata form databases.
        """

    class mysql:
        """Used to interact with MySQL specific features

        This extension allow user to interact with MySQL specific features.
        """
