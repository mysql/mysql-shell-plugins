# Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

from mysqlsh.plugin_manager import plugin


# Create a class representing the structure of the plugin and use the
# @register_plugin decorator to register it
@plugin
class mds():
    """Plugin to manage the MySQL Database Service on OCI.

    This global object exposes a list of shell extensions
    to work with the MySQL Database Service on the Oracle Cloud Infrastructure.
    """

    def __init__(self):
        """Constructor that will import all relevant sub-modules

        The constructor is called by the @plugin decorator to 
        automatically register all decorated functions in the sub-modules
        """
        # Import all sub-modules to register the decorated functions there
        from mds_plugin import core, general, compartment, compute
        from mds_plugin import configuration, mysql_database_service, network
        from mds_plugin import object_store, user, bastion, util

    class create():
        """Used to create OCI objects.

        A collection of create functions to create objects like
        compartments, users, groups, policies and network sources
        """

    class delete():
        """Used to delete OCI objects.

        A collection of delete functions to list objects like
        compartments, users, groups, policies and network sources.
        """

    class execute():
        """Allows execution of commands on various objects.

        A collection of execute functions to run commands on OCI objects.
        """

    class get():
        """Various getters.

        Module to access getters for OCI objects and configs.
        """

    class list():
        """Used to list OCI objects.

        A collection of list functions to list objects like
        compartments, users, groups, policies and network sources.
        """

    class util():
        """Various utility functions to work with MySQL DB Systems.

        A collection of utility functions to work with MySQL DB Systems.
        """

    class set():
        """Various setters.

        Module to access setters for OCI objects and configs.
        """

    class update():
        """Various functions to update OCI objects.

        Module that holds various update functions for OCI objects
        and configs.
        """

    class stop():
        """Various stop functions.

        Module to stop various OCI objects.
        """

    class start():
        """Various start functions.

        Module to start various OCI objects.
        """

    class restart():
        """Various restart functions.

        Module to restart various OCI objects.
        """