# Copyright (c) 2021, Oracle and/or its affiliates.
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

# cSpell:ignore mrs, mysqlsh, InnoDB

# Create a class representing the structure of the plugin and use the
# @plugin decorator to register it


@plugin
class mrs():
    """Plugin to manage the MySQL REST Data Service (MRS).

    This global object is used to manage the MySQL REST Data Service (MRS).

    The MRS can be used to offer MySQL schema objects via the REST interface 
    from MySQL Routers in an InnoDB Cluster.
    """

    def __init__(self):
        """Constructor that will import all relevant sub-modules

        The constructor is called by the @plugin decorator to 
        automatically register all decorated functions in the sub-modules
        """
        # Import all sub-modules to register the decorated functions there
        from mrs_plugin import general, core, services, schemas
        from mrs_plugin import db_objects, content_sets, content_files

    class enable():
        """Used to enable MRS services, schemas and schema objects.

        A collection of functions to enable MRS services, schemas and 
        schema objects.
        """

    class disable():
        """Used to disable MRS services, schemas and schema objects.

        A collection of functions to disable MRS services, schemas and 
        schema objects.
        """

    class get():
        """Used to get MRS objects.

        A collection of functions to get MRS objects
        """

    class set():
        """Used to set MRS object properties.

        A collection of functions to set MRS object properties
        """

        class service():
            """Used to work with MRS services.

            A collection of functions to work with MRS services
            """

        class schema():
            """Used to work with MRS schemas.

            A collection of functions to work with MRS schemas
            """

        class dbObject():
            """Used to work with MRS DB objects.

            A collection of functions to work with MRS DB objects
            """

    class update():
        """Used to update MRS object properties.

        A collection of functions to update MRS object properties
        """

    class list():
        """Used to list MRS objects.

        A collection of functions to list MRS objects
        """

    class add():
        """Used to add MRS objects.

        A collection of functions to get MRS objects
        """

    class delete():
        """Used to delete MRS objects.

        A collection of functions to delete MRS objects
        """
