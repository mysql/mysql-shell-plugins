# Copyright (c) 2020, 2025, Oracle and/or its affiliates.
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

import json

from mysqlsh.plugin_manager import \
    plugin_function  # pylint: disable=no-name-in-module

import gui_plugin.core.Error as Error
from gui_plugin.core.backend_db import db_connections
from gui_plugin.core.Db import BackendDatabase, BackendTransaction
from gui_plugin.core.dbms import DbSessionFactory
from gui_plugin.core.Error import MSGException
from gui_plugin.core.modules.DbModuleSession import DbModuleSession


@plugin_function('gui.dbConnections.addDbConnection', cli=True, shell=True, web=True)
def add_db_connection(profile_id, connection, folder_path='',
                      be_session=None):
    """Add a new db_connection and associate the connection with a profile

    Args:
        profile_id (int): The id of the profile
        connection (dict): The connection information as a dict, e.g. {
            "db_type": "MySQL",
            "caption": "Local MySQL Server",
            "description": "Connection to local MySQL Server on 3306",
            "options": {
                "uri": "mysql://mike@localhost:3306/test",
                "password": "myPassword2BeStoredEncrypted"
            },
            "settings": {
                "defaultEditor": "DB Notebook",
            }}
        folder_path (str): The folder path used for grouping and nesting
            connections, optional
        be_session (object):  A session to the GUI backend database
            where the operation will be performed.

    Allowed options for connection:
        db_type (str): The db type name
        caption (str): A name for this connection
        description (str): A longer description for this connection
        options (dict): The options specific for the current database type
        settings (dict): The additional settings for the given connection

    Returns:
        int: The connection ID
    """
    # Verify connection parameters
    if not 'caption' in connection \
            or not isinstance(connection['caption'], str) \
            or connection['caption'].strip() == "":
        raise MSGException(Error.CORE_INVALID_PARAMETER,
                           "The connection must contain valid caption.")

    if not 'db_type' in connection \
            or not isinstance(connection['db_type'], str) \
            or not connection['db_type'].upper() in ["MYSQL", "SQLITE"]:
        raise MSGException(Error.CORE_INVALID_PARAMETER,
                           "The connection must contain valid database type.")

    with BackendDatabase(be_session) as db:
        # TODO: Encrypt stored password. The password will be inside "options", but we
        # don't know the structure of that object. Maybe the FE should pass the keys that should
        # be encrypted.

        with BackendTransaction(db):
            # Insert new db_connection
            db.execute('''INSERT INTO db_connection(
                db_type, caption, description, options, settings)
                VALUES(?, ?, ?, ?, ?)''',
                       (connection.get('db_type', "MySQL"),
                        connection.get('caption', 'New Connection'),
                        connection.get('description', ''),
                        json.dumps(connection.get('options', {})),
                        json.dumps(connection.get('settings', {}))))

            connection_id = db.get_last_row_id()

            index = db_connections.get_next_connection_index(
                db, profile_id, folder_path)

            # Insert n:m profile_has_db_connection to associate the connection with
            # a profile
            db.execute('''INSERT INTO profile_has_db_connection(
                profile_id, db_connection_id, folder_path, `index`)
                VALUES(?, ?, ?, ?)''',
                       (profile_id, connection_id, folder_path, index))

    return connection_id


@plugin_function('gui.dbConnections.updateDbConnection', cli=True, shell=True, web=True)
def update_db_connection(profile_id, connection_id, connection, folder_path='', be_session=None):
    """Update the data for a database connection

    Args:
        profile_id (int): The id of the profile
        connection_id (int): The id of the connection to update
        connection (dict): The connection information as a dict, e.g. {
                "caption": "Local MySQL Server",
                "description": "Connection to local MySQL Server on 3306",
                "options": {
                    "uri": "mysql://mike@localhost:3306/test",
                    "password": "myPassword2BeStoredEncrypted"
                },
                "settings": {
                    "defaultEditor": "DB Notebook",
                }
            }
        folder_path (str): The folder path used for grouping and nesting
            connections, optional
        be_session (object):  A session to the GUI backend database
            where the operation will be performed.

    Allowed options for connection:
        db_type (str): The db type name
        caption (str): A name for this connection
        description (str): A longer description for this connection
        options (dict): The options specific for the current database type
        settings (dict): The additional settings for the given connection

    Returns:
        None
    """

    with BackendDatabase(be_session) as db:
        with BackendTransaction(db):
            if "db_type" in connection:
                db.execute("UPDATE db_connection SET db_type=? WHERE id=?",
                           (connection['db_type'], connection_id))
            if "caption" in connection:
                db.execute("UPDATE db_connection SET caption=? WHERE id=?",
                           (connection['caption'], connection_id))
            if "description" in connection:
                db.execute("UPDATE db_connection SET description=? WHERE id=?",
                           (connection['description'], connection_id))
            if "options" in connection:
                db.execute("UPDATE db_connection SET options=? WHERE id=?", (json.dumps(
                    connection['options']), connection_id))
            if "settings" in connection:
                db.execute("UPDATE db_connection SET settings=? WHERE id=?", (json.dumps(
                    connection['settings']), connection_id))
            if "folder_path" in connection:
                index = db_connections.get_next_connection_index(
                    db, profile_id, folder_path)
                db.execute("""UPDATE profile_has_db_connection
                              SET folder_path=?
                              WHERE profile_id=? AND db_connection_id=?""",
                           (connection['folder_path'], profile_id, connection_id))
                db.execute("""UPDATE profile_has_db_connection
                              SET `index`=?
                              WHERE profile_id=? AND folder_path=? AND db_connection_id=?""",
                           (index, profile_id, connection['folder_path'], connection_id))


@plugin_function('gui.dbConnections.removeDbConnection', cli=True, shell=True, web=True)
def remove_db_connection(profile_id, connection_id, be_session=None):
    """Remove a db_connection by disassociating the connection from a profile

    Args:
        profile_id (int): The id of the profile
        connection_id (int): The connection id to remove
        be_session (object):  A session to the GUI backend database
            where the operation will be performed.

    Returns:
        None
    """

    with BackendDatabase(be_session) as db:
        with BackendTransaction(db):

            # Remove the connection for this profile
            db.execute('''DELETE FROM profile_has_db_connection WHERE
                profile_id=? AND db_connection_id=?''', (profile_id, connection_id))

            # Check if some other profile is still using the connection
            result = db.select('''SELECT COUNT(*) as cnt FROM profile_has_db_connection
                WHERE db_connection_id=?''', (connection_id, ))

            # If no other profile is using this connection, remove it.
            if result[0]['cnt'] == 0:
                db.execute('''DELETE FROM db_connection
                    WHERE id=?''', (connection_id,))


@plugin_function('gui.dbConnections.listDbConnections', cli=True, shell=True, web=True)
def list_db_connections(profile_id, folder_path='', be_session=None):
    """Lists the db_connections for the given profile

    Args:
        profile_id (int): The id of the profile
        folder_path (str): The folder path used for grouping and nesting
            connections, optional
        be_session (object):  A session to the GUI backend database
            where the operation will be performed.

    Returns:
        list: the list of connections
    """
    with BackendDatabase(be_session) as db:
        return db.select('''SELECT dc.id, p_dc.folder_path, dc.caption,
            dc.description, dc.db_type, dc.options, dc.settings, p_dc.`index`
            FROM profile_has_db_connection p_dc
                LEFT JOIN db_connection dc ON
                    p_dc.db_connection_id = dc.id
            WHERE p_dc.profile_id = ? AND p_dc.folder_path LIKE ?''',
                         (profile_id, '%' if folder_path == '' else folder_path))


@plugin_function('gui.dbConnections.getDbConnection', cli=True, shell=True, web=True)
def get_db_connection(db_connection_id, be_session=None):
    """Get the db_connection

    Args:
        db_connection_id (int): The id of the db_connection
        be_session (object):  A session to the GUI backend database
            where the operation will be performed.

    Returns:
        dict: The db connection
    """
    with BackendDatabase(be_session) as db:
        return db.select('SELECT * FROM db_connection WHERE id = ?',
                         (db_connection_id,))[0]


@plugin_function('gui.dbConnections.getDbTypes', cli=True, shell=True, web=True)
def get_db_types():
    """Get the list of db_types

    Returns:
        list: The list of db types
    """

    return DbSessionFactory.getSessionTypes()


@plugin_function('gui.dbConnections.setCredential', cli=True, shell=True, web=True)
def set_credential(url, password):
    """Set the password of a db_connection url

    Args:
        url (str): The URL needs to be in the following form
            user@(host[:port]|socket).
        password (str): The password

    Returns:
        None
    """

    import mysqlsh

    mysqlsh.globals.shell.store_credential(url, password)


@plugin_function('gui.dbConnections.deleteCredential', cli=True, shell=True, web=True)
def delete_credential(url):
    """Deletes the password of a db_connection url

    Args:
        url (str): The URL needs to be in the following form
            user@(host[:port]|socket).

    Returns:
        None
    """

    import mysqlsh

    mysqlsh.globals.shell.delete_credential(url)


@plugin_function('gui.dbConnections.listCredentials', cli=True, shell=True, web=True)
def list_credentials():
    """Lists the db_connection urls that have a password stored

    Returns:
        list: The list of db_connection urls that have a password stored
    """

    import mysqlsh

    return mysqlsh.globals.shell.list_credentials()


@plugin_function('gui.dbConnections.testConnection', cli=True, shell=True, web=True)
def test_connection(connection, password=None):
    """Opens test connection

    Args:
        connection (object): The id of the db_connection or connection information
        password (str): The password to use when opening the connection. If not supplied, then use the password defined in the database options.

    Allowed options for connection:
        db_type (str): The db type name
        options (dict): The options specific for the current database type

    Returns:
        None
    """
    new_session = DbModuleSession()
    new_session.open_connection(connection, password)
    if not new_session.completion_event.has_errors and password is None and not 'password' in connection['options']:
        return {"module_session_id": new_session.module_session_id}

    new_session.completion_event.wait()

    if not new_session.completion_event.has_errors:
        new_session.close()


@plugin_function('gui.dbConnections.moveConnection', shell=False, web=True)
def move_connection(profile_id, folder_path, connection_id_to_move, connection_id_offset, before=False, be_session=None):
    """Updates the connections sort order for the given profile

    Args:
        profile_id (int): The id of the profile
        folder_path (str): The folder path used for grouping and nesting connections
        connection_id_to_move (int): The id of the connection to move
        connection_id_offset (int): The id of the offset connection
        before (bool): Indicates whether connection_id_to_move should be moved before connection_id_offset or after
        be_session (object):  A session to the GUI backend database
            where the operation will be performed.


    Returns:
        None
    """

    with BackendDatabase(be_session) as db:
        with BackendTransaction(db):
            index_to_move = db_connections.get_connection_folder_index(
                db, profile_id, folder_path, connection_id_to_move)
            index_offset = db_connections.get_connection_folder_index(
                db, profile_id, folder_path, connection_id_offset)

            if index_to_move > index_offset:
                index = index_offset if before else index_offset + 1
                db.execute("""UPDATE profile_has_db_connection
                          SET `index`=`index`+1
                          WHERE profile_id=? AND folder_path=? AND `index`>=? AND `index`<?""",
                           (profile_id, folder_path, index, index_to_move))
            else:
                index = index_offset - 1 if before else index_offset
                db.execute("""UPDATE profile_has_db_connection
                          SET `index`=`index`-1
                          WHERE profile_id=? AND folder_path=? AND `index`<=? AND `index`>?""",
                           (profile_id, folder_path, index, index_to_move))

            db.execute("""UPDATE profile_has_db_connection
                          SET `index`=?
                          WHERE profile_id=? AND folder_path=? AND db_connection_id=?""",
                       (index, profile_id, folder_path, connection_id_to_move))
