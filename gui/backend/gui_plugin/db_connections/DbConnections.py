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


@plugin_function('gui.dbConnections.addDbConnection', shell=False, web=True)
def add_db_connection(profile_id, connection, folder_path_id=None,
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
        folder_path_id (int): The id of the folder path used for grouping and nesting connections, optional
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

            if folder_path_id is None:
                folder_path_id = 1 # Root folder

            index = db_connections.get_next_connection_index(
                db, profile_id, folder_path_id)

            # Insert n:m profile_has_db_connection to associate the connection with
            # a profile
            db.execute('''INSERT INTO profile_has_db_connection(
                profile_id, db_connection_id, folder_path_id, `index`)
                VALUES(?, ?, ?, ?)''',
                       (profile_id, connection_id, folder_path_id, index))

    return connection_id


@plugin_function('gui.dbConnections.updateDbConnection', shell=False, web=True)
def update_db_connection(profile_id, connection_id, connection, folder_path_id=None, be_session=None):
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
        folder_path_id (int): The id of the folder path used for grouping and nesting connections, optional
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
            if "folder_path_id" in connection:
                index = db_connections.get_next_connection_index(
                    db, profile_id, folder_path_id)
                db.execute("""UPDATE profile_has_db_connection
                              SET folder_path_id=?
                              WHERE profile_id=? AND db_connection_id=?""",
                           (connection['folder_path_id'], profile_id, connection_id))
                db.execute("""UPDATE profile_has_db_connection
                              SET `index`=?
                              WHERE profile_id=? AND folder_path_id=? AND db_connection_id=?""",
                           (index, profile_id, connection['folder_path_id'], connection_id))


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
def list_db_connections(profile_id, folder_path_id=None, be_session=None):
    """Lists the db_connections for the given profile

    Args:
        profile_id (int): The id of the profile
        folder_path_id (int): The folder path ID used for grouping and nesting
            connections, optional
        be_session (object):  A session to the GUI backend database
            where the operation will be performed.

    Returns:
        list: the list of connections
    """
    with BackendDatabase(be_session) as db:
        return db.select('''SELECT dc.id, fc.caption as `folder_path`, dc.caption,
            dc.description, dc.db_type, dc.options, dc.settings, p_dc.`index`
            FROM profile_has_db_connection p_dc
                LEFT JOIN db_connection dc ON
                    p_dc.db_connection_id = dc.id
                LEFT JOIN folder_path fc ON
                    p_dc.folder_path_id = fc.id
            WHERE p_dc.profile_id = ? AND fc.id = ?''',
                         (profile_id, '1' if folder_path_id is None else folder_path_id))


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
def move_connection(profile_id, folder_id, connection_id_to_move, connection_id_offset, before=False, be_session=None):
    """Updates the connections sort order for the given profile

    Args:
        profile_id (int): The id of the profile
        folder_id (int): The folder id used for grouping and nesting connections
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
            index_to_move = db_connections.get_connection_index(
                db, profile_id, folder_id, connection_id_to_move)
            index_offset = db_connections.get_connection_index(
                db, profile_id, folder_id, connection_id_offset)

            if index_to_move > index_offset:
                index = index_offset if before else index_offset + 1
                db.execute("""UPDATE profile_has_db_connection
                          SET `index`=`index`+1
                          WHERE profile_id=? AND folder_path_id=? AND `index`>=? AND `index`<?""",
                           (profile_id, folder_id, index, index_to_move))
                db.execute("""UPDATE folder_path
                          SET `index`=`index`+1
                          WHERE `index`>=? AND `index`<?""",
                           (index, index_to_move))
            else:
                index = index_offset - 1 if before else index_offset
                db.execute("""UPDATE profile_has_db_connection
                          SET `index`=`index`-1
                          WHERE profile_id=? AND folder_path_id=? AND `index`<=? AND `index`>?""",
                           (profile_id, folder_id, index, index_to_move))
                db.execute("""UPDATE folder_path
                          SET `index`=`index`-1
                          WHERE `index`<=? AND `index`>?""",
                           (index, index_to_move))

            db.execute("""UPDATE profile_has_db_connection
                          SET `index`=?
                          WHERE profile_id=? AND folder_path_id=? AND db_connection_id=?""",
                       (index, profile_id, folder_id, connection_id_to_move))


@plugin_function('gui.dbConnections.addFolderPath', shell=False, web=True)
def add_folder_path(profile_id, caption, parent_folder_id=None, be_session=None):
    """Add a new folder path

    Args:
        profile_id (int): The id of the profile
        caption (str): The caption of the folder
        parent_folder_id (int): The id of the parent folder, optional
        be_session (object): A session to the GUI backend database where the operation will be performed.

    Returns:
        int: The folder path ID
    """
    with BackendDatabase(be_session) as db:
        with BackendTransaction(db):
            if parent_folder_id is None:
                parent_folder_id = 1  # Root folder
            folder_path_id = db_connections.folder_exists(db, caption, parent_folder_id)
            if folder_path_id is None:
                index = db_connections.get_next_connection_index(
                    db, profile_id, parent_folder_id)
                db.execute('''INSERT INTO folder_path (parent_folder_id, caption, `index`)
                            VALUES (?, ?, ?)''',
                        (parent_folder_id, caption, index))
                folder_path_id = db.get_last_row_id()
    return folder_path_id


@plugin_function('gui.dbConnections.removeFolderPath', shell=False, web=True)
def remove_folder_path(folder_path_id, be_session=None):
    """Remove a folder path

    Args:
        folder_path_id (int): The id of the folder path to remove
        be_session (object): A session to the GUI backend database where the operation will be performed.

    Returns:
        None
    """
    with BackendDatabase(be_session) as db:
        db.execute('''DELETE FROM folder_path WHERE id=?''', (folder_path_id,))


@plugin_function('gui.dbConnections.renameFolderPath', shell=False, web=True)
def rename_folder_path(folder_path_id, new_caption, be_session=None):
    """Rename a folder path

    Args:
        folder_path_id (int): The id of the folder path to rename
        new_caption (str): The new caption for the folder path
        be_session (object): A session to the GUI backend database where the operation will be performed.

    Returns:
        None
    """
    with BackendDatabase(be_session) as db:
        db.execute('''UPDATE folder_path SET caption=? WHERE id=?''', (new_caption, folder_path_id))


@plugin_function('gui.dbConnections.moveFolder', shell=False, web=True)
def move_folder(folder_path_id, new_parent_folder_id, be_session=None):
    """Move a folder path to a new parent folder

    Args:
        folder_path_id (int): The id of the folder path to move
        new_parent_folder_id (int): The id of the new parent folder
        be_session (object): A session to the GUI backend database where the operation will be performed.

    Returns:
        None
    """
    with BackendDatabase(be_session) as db:
        db.execute('''UPDATE folder_path SET parent_folder_id=? WHERE id=?''', (new_parent_folder_id, folder_path_id))


@plugin_function('gui.dbConnections.listFolderPaths', shell=False, web=True)
def list_folder_paths(parent_folder_id=None, be_session=None):
    """List folder paths

    Args:
        parent_folder_id (int): The id of the parent folder to list child folders, optional
        be_session (object): A session to the GUI backend database where the operation will be performed.

    Returns:
        list: The list of folder paths
    """
    with BackendDatabase(be_session) as db:
        if parent_folder_id is None:
            return db.select('''SELECT * FROM folder_path WHERE parent_folder_id IS NULL ORDER BY `index` ASC''')
        else:
            return db.select('''SELECT * FROM folder_path WHERE parent_folder_id=? ORDER BY `index` ASC''', (parent_folder_id,))


@plugin_function('gui.dbConnections.listAll', shell=False, web=True)
def list_all(profile_id, folder_id=None, be_session=None):
    """Lists all connections and folder paths for the given profile and folder

    Args:
        profile_id (int): The id of the profile
        folder_id (int): The id of the folder, optional (for None use root folder)
        be_session (object): A session to the GUI backend database where the operation will be performed.

    Returns:
        list: A list of dictionaries containing connections and folders sorted by index
    """
    with BackendDatabase(be_session) as db:
        combined_list = db.select('''
            SELECT dc.id, dc.caption, dc.description, dc.db_type, dc.options, dc.settings, p_dc.`index`, 'connection' AS type
                FROM profile_has_db_connection p_dc
                LEFT JOIN db_connection dc ON p_dc.db_connection_id = dc.id
                WHERE p_dc.profile_id = ? AND p_dc.folder_path_id = ?
            UNION ALL
            SELECT fp.id, fp.caption, NULL AS description, NULL AS db_type, NULL AS options, NULL AS settings, fp.`index`, 'folder' AS type
                FROM folder_path fp
                WHERE fp.parent_folder_id = ?
                ORDER BY `index` ASC
        ''', (profile_id, folder_id if folder_id is not None else 1, folder_id if folder_id is not None else None))

    return combined_list
