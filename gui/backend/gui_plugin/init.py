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

"""Plugin registration

This file is automatically loaded by the MySQL Shell at startup time.

It registers the plugin objects and then imports all sub-modules to
register the plugin object member functions.
"""

from mysqlsh.plugin_manager import plugin # pylint: disable=import-error


# Create a class representing the structure of the plugin and use the
# @register_plugin decorator to register it
@plugin
class gui():
    """MySQL Shell GUI backend plugin.

    This plugin serves as the backend for the MySQL Shell GUI projects.
    """

    def __init__(self):
        """Constructor that will import all relevant sub-modules

        The constructor is called by the @plugin decorator to
        automatically register all decorated functions in the sub-modules
        """
        # Import all sub-modules to register the decorated functions there
        from gui_plugin import cluster, core, dbconnections, mds, modeler
        from gui_plugin import shell, sqleditor, users, debugger, start
        from gui_plugin import modules, db, general

    class cluster():
        """The InnoDB Cluster MySQL Shell GUI backend module

        This extension object holds the backend implementation of the
        InnoDB Cluster MySQL Shell GUI module
        """

    class core():
        """The Core MySQL Shell GUI backend module

        This extension object holds the backend implementation of the
        Core MySQL Shell GUI module
        """

    class dbconnections():
        """The DB Connections MySQL Shell GUI backend module

        This extension object holds the backend implementation of the
        DB Connections MySQL Shell GUI module
        """

    class modeler():
        """The Modeler MySQL Shell GUI backend module

        This extension object holds the backend implementation of the
        Modeler MySQL Shell GUI module
        """

    class modules():
        """The Modules MySQL Shell GUI backend module

        This extension object holds the backend implementation of the
        Modules MySQL Shell GUI module
        """

    class mds():
        """The MySQL Database Service MySQL Shell GUI backend module

        This extension object holds the backend implementation of the
        MySQL Database Service MySQL Shell GUI module
        """

    class shell():
        """The Shell MySQL Shell GUI backend module

        This extension object holds the backend implementation of the
        Shell MySQL Shell GUI module
        """

    class sqleditor():
        """The SQL Editor MySQL Shell GUI backend module

        This extension object holds the backend implementation of the
        SQL Editor MySQL Shell GUI module
        """

    class users():
        """The Users MySQL Shell GUI backend module

        This extension object holds the backend implementation of the
        Users MySQL Shell GUI module
        """

    class debugger():
        """The websocket debugger module

        This extension object holds the backend implementation of the
        Websocket debugger module
        """

    class start():
        """Used to start the MySQL Shell GUI

        The MySQL Shell GUI can be started as a native application
        or as a web application served by a web server.
        """

    class db():
        """Used to retrive metadata from database

        This extension allow user to retrive metadata form databases.
        """