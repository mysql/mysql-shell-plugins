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

from mysqlsh.plugin_manager import plugin_function  # pylint: disable=no-name-in-module
from gui_plugin.core.Protocols import Response


@plugin_function('gui.db.getObjectsTypes', shell=False, web=True)
def get_objects_types(module_session, request_id):
    """Returns the database objects supported by a DBMS

    Args:
        module_session (object): The module session object where the query is running
        request_id (str): The request_id of the command

    Returns:
        object: The list of the database objects
    """
    module_session.get_objects_types(request_id=request_id)


@plugin_function('gui.db.getCatalogObjectNames', shell=False, web=True)
def get_catalog_object_names(module_session, request_id, type, filter='%'):
    """Returns the names of the existing objects of the given
        type. If a filter is provided, only the names matching the given filter will be returned.

    Args:
        module_session (object): The module session object where the query is running
        request_id (str): The request_id of the command
        type (str): the catalog object type
        filter (str): object filter

    Returns:
        object: The list of names
    """
    module_session.get_catalog_object_names(request_id=request_id,
                                            type=type,
                                            filter=filter)


@plugin_function('gui.db.getSchemaObjectNames', shell=False, web=True)
def get_schema_object_names(module_session, request_id, type, schema_name, filter='%'):
    """Returns the names of the existing objects of the given type in the given
        schema that match the provided filter.

    Args:
        module_session (object): The module session object where the query is running
        request_id (str): The request_id of the command
        type (str): the schema object type
        schema_name (str): schema name
        filter (str): object filter

    Returns:
        object: The list of names
    """
    module_session.get_schema_object_names(request_id=request_id,
                                           type=type,
                                           schema_name=schema_name,
                                           filter=filter)


@plugin_function('gui.db.getTableObjectNames', shell=False, web=True)
def get_table_object_names(module_session, request_id, type, schema_name, table_name, filter='%'):
    """Returns the names of the existing objects of the given type in the given
        table that match the provided filter.

    Args:
        module_session (object): The module session object where the query is running
        request_id (str): The request_id of the command
        type (str): the table object type
        schema_name (str): schema name
        table_name (str): table name
        filter (str): object filter

    Returns:
        object: The list of names
    """
    module_session.get_table_object_names(request_id=request_id,
                                           type=type,
                                           schema_name=schema_name,
                                           table_name=table_name,
                                           filter=filter)


@plugin_function('gui.db.getCatalogObject', shell=False, web=True)
def get_catalog_object(module_session, request_id, type, name):
    """Returns a JSON representation of the object matching the given type and name.

    Args:
        module_session (object): The module session object where the query is running
        request_id (str): The request_id of the command
        type (str): the catalog object type
        name (str): object name

    Returns:
        object: The catalog object
    """
    module_session.get_catalog_object(request_id=request_id,
                                      type=type,
                                      name=name)


@plugin_function('gui.db.getSchemaObject', shell=False, web=True)
def get_schema_object(module_session, request_id, type, schema_name, name):
    """Returns a JSON representation of the schema object matching the given type, schema and name.

    Args:
        module_session (object): The module session object where the query is running
        request_id (str): The request_id of the command
        type (str): the database object type
        schema_name (str): schema name
        name (str): object name

    Returns:
        object: The database object
    """
    module_session.get_schema_object(request_id=request_id,
                                     type=type,
                                     schema_name=schema_name,
                                     name=name)


@plugin_function('gui.db.getTableObject', shell=False, web=True)
def get_table_object(module_session, request_id, type, schema_name, table_name, name):
    """Returns a JSON representation of the table object matching the given type, schema, table and name.

    Args:
        module_session (object): The module session object where the query is running
        request_id (str): The request_id of the command
        type (str): the database object type
        schema_name (str): schema name
        table_name (str): table name
        name (str): object name

    Returns:
        object: The database object
    """
    module_session.get_table_object(request_id=request_id,
                                     type=type,
                                     schema_name=schema_name,
                                     table_name=table_name,
                                     name=name)
