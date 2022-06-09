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

from mysqlsh.plugin_manager import plugin_function  # pylint: disable=no-name-in-module
from gui_plugin.core.Protocols import Response
import gui_plugin.core.Error as Error
from gui_plugin.core.Error import MSGException
from gui_plugin.core.modules.DbModuleSession import DbModuleSession
from gui_plugin.db import backend


@plugin_function('gui.db.getObjectsTypes', shell=True, web=True)
def get_objects_types(session):
    """Returns the database objects supported by a DBMS

    Args:
        session (object): The session used to execute the operation

    Returns:
        object: The list of the database objects
    """
    session = backend.get_db_session(session)

    return session.get_objects_types()


@plugin_function('gui.db.getCatalogObjectNames', shell=True, web=True)
def get_catalog_object_names(session, type, filter='%'):
    """Returns the names of the existing objects of the given
        type. If a filter is provided, only the names matching the given filter will be returned.

    Args:
        session (object): The session used to execute the operation
        type (str): the catalog object type
        filter (str): object filter

    Returns:
        object: The list of names
    """
    session = backend.get_db_session(session)

    return session.get_catalog_object_names(type=type, filter=filter)


@plugin_function('gui.db.getSchemaObjectNames', shell=True, web=True)
def get_schema_object_names(session, type, schema_name, filter='%', routine_type=None):
    """Returns the names of the existing objects of the given type in the given
        schema that match the provided filter.

    Args:
        session (object): The session used to execute the operation
        type (str): the schema object type
        schema_name (str): schema name
        filter (str): object filter
        routine_type (str): type of the routine ['procedure'|'function']

    Returns:
        object: The list of names
    """
    if isinstance(routine_type, str) and routine_type.strip() == "":
        routine_type = None
    if routine_type is not None and routine_type not in ['procedure', 'function']:
        raise MSGException(Error.CORE_INVALID_PARAMETER,
                           "The routine_type could be only 'procedure' or 'function'.")
    session = backend.get_db_session(session)

    return session.get_schema_object_names(type=type,
                                           schema_name=schema_name,
                                           routine_type=routine_type,
                                           filter=filter)


@plugin_function('gui.db.getTableObjectNames', shell=True, web=True)
def get_table_object_names(session, type, schema_name, table_name, filter='%'):
    """Returns the names of the existing objects of the given type in the given
        table that match the provided filter.

    Args:
        session (object): The session used to execute the operation
        type (str): the table object type
        schema_name (str): schema name
        table_name (str): table name
        filter (str): object filter

    Returns:
        object: The list of names
    """
    session = backend.get_db_session(session)

    return session.get_table_object_names(type=type,
                                          schema_name=schema_name,
                                          table_name=table_name,
                                          filter=filter)


@plugin_function('gui.db.getCatalogObject', shell=True, web=True)
def get_catalog_object(session, type, name):
    """Returns a JSON representation of the object matching the given type and name.

    Args:
        session (object): The session used to execute the operation
        type (str): the catalog object type
        name (str): object name

    Returns:
        object: The catalog object
    """
    session = backend.get_db_session(session)

    return session.get_catalog_object(type=type, name=name)


@plugin_function('gui.db.getSchemaObject', shell=True, web=True)
def get_schema_object(session, type, schema_name, name):
    """Returns a JSON representation of the schema object matching the given type, schema and name.

    Args:
        session (object): The session used to execute the operation
        type (str): the database object type
        schema_name (str): schema name
        name (str): object name

    Returns:
        object: The database object
    """
    session = backend.get_db_session(session)

    return session.get_schema_object(type=type,
                                     schema_name=schema_name,
                                     name=name)


@plugin_function('gui.db.getTableObject', shell=True, web=True)
def get_table_object(session, type, schema_name, table_name, name):
    """Returns a JSON representation of the table object matching the given type, schema, table and name.

    Args:
        session (object): The session used to execute the operation
        type (str): the database object type
        schema_name (str): schema name
        table_name (str): table name
        name (str): object name

    Returns:
        object: The database object
    """
    session = backend.get_db_session(session)

    return session.get_table_object(type=type,
                                    schema_name=schema_name,
                                    table_name=table_name,
                                    name=name)


@plugin_function('gui.db.startSession', shell=False, web=True)
def start_session(connection, password=None, web_session=None):
    """Starts a DB Session
    Args:
        connection (object): The id of the db_connection or connection information
        password (str): The password to use when opening the connection. If not supplied, then use the password defined in the database options.
        web_session (object): The web_session object this session will belong to

    Returns:
        A dict holding the result message
    """

    new_session = DbModuleSession(web_session)
    new_session.open_connection(connection, password)

    return {"module_session_id": new_session.module_session_id}


@plugin_function('gui.db.closeSession', shell=False, web=True)
def close_session(module_session):
    """Closes the DB Session

    Args:
        module_session (object): The module session object that should be closed

    Returns:
        A dict holding the result message
    """
    module_session.close()

    return "Completed"


@plugin_function('gui.db.reconnect', shell=False, web=True)
def reconnect(module_session):
    """Reconnects the DB Session

    Args:
        module_session (object): The session where the session will be reconnected

    Returns:
        A dict holding the result message and the connection information
        when available.
    """
    module_session.reconnect()
