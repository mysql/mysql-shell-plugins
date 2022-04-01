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

from mysqlsh.plugin_manager import plugin_function  # pylint: disable=no-name-in-module
import json
from gui_plugin.core.Db import GuiBackendDb
from gui_plugin.core.Protocols import Response
from gui_plugin.core.DbSession import DbSessionFactory
from gui_plugin.core.Db import BackendDatabase, BackendTransaction
import gui_plugin.core.Error as Error
from gui_plugin.core.Error import MSGException
from gui_plugin.core.modules.DbModuleSession import DbModuleSession
from gui_plugin.core.backenddb import dbconnections


@plugin_function('gui.dbconnections.addDbConnection', shell=False, web=True)
def add_db_connection(profile_id, connection, folder_path='',
                      web_session=None):
    """add a new db_connection and associate the connection with a profile

    Args:
        profile_id (int): The id of the profile
        connection (dict): The connection information as a dict, e.g. {
            "db_type": "MySQL",
            "caption": "Local MySQL Server",
            "description": "Connection to local MySQL Server on 3306",
            "options": {
                "uri": "mysql://mike@localhost:3306/test",
                "password": "myPassword2BeStoredEncrypted"
            }}
        folder_path (str): The folder path used for grouping and nesting
            connections, optional
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically

    Allowed options for connection:
        db_type (str,required): The db type name
        caption (str,required): A name for this connection
        description (str,required): A longer description for this connection
        options (dict,required): The options specific for the current database type

    Returns:
        string: The connection_id in a result JSON string
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

    with BackendDatabase(web_session) as db:
        # TODO: Encrypt stored password. The password will be inside "options", but we
        # don't know the structure of that object. Maybe the FE should pass the keys that should
        # be encrypted.

        with BackendTransaction(db):
            # Insert new db_connection
            db.execute('''INSERT INTO db_connection(
                db_type, caption, description, options)
                VALUES(?, ?, ?, ?)''',
                       (connection.get('db_type', "MySQL"),
                        connection.get('caption', 'New Connection'),
                        connection.get('description', ''),
                        json.dumps(connection.get('options', {}))))

            connection_id = db.get_last_row_id()

            index = dbconnections.get_next_connection_index(db, profile_id, folder_path)

            # Insert n:m profile_has_db_connection to associate the connection with
            # a profile
            db.execute('''INSERT INTO profile_has_db_connection(
                profile_id, db_connection_id, folder_path, `index`)
                VALUES(?, ?, ?, ?)''',
                       (profile_id, connection_id, folder_path, index))

        result = Response.fromStatus(db.get_last_status(), {
                                     "result": {"db_connection_id": connection_id}})

    return result


@plugin_function('gui.dbconnections.updateDbConnection', shell=False, web=True)
def update_db_connection(profile_id, connection_id, connection, folder_path='', web_session=None):
    """update the data for a database connection

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
            }
        folder_path (str): The folder path used for grouping and nesting
            connections, optional
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically

    Allowed options for connection:
        db_type (str,required): The db type name
        caption (str,required): A name for this connection
        description (str,required): A longer description for this connection
        options (dict,required): The options specific for the current database type

    Returns:
        Nothing
    """

    with BackendDatabase(web_session) as db:
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
            if "folder_path" in connection:
                index = dbconnections.get_next_connection_index(db, profile_id, folder_path)
                db.execute("""UPDATE profile_has_db_connection
                              SET folder_path=?
                              WHERE profile_id=? AND db_connection_id=?""",
                          (connection['folder_path'], profile_id, connection_id))
                db.execute("""UPDATE profile_has_db_connection
                              SET `index`=?
                              WHERE profile_id=? AND folder_path=? AND db_connection_id=?""",
                          (index, profile_id, connection['folder_path'], connection_id))


            result = Response.fromStatus(db.get_last_status(), {
                "result": {"db_connection_id": connection_id}})

    return result


@plugin_function('gui.dbconnections.removeDbConnection', shell=False, web=True)
def remove_db_connection(profile_id, connection_id, web_session=None):
    """remove a db_connection by disassociating the connection from a profile

    Args:
        profile_id (int): The id of the profile
        connection_id (int): The connection id to remove
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically

    Returns:
        Nothing
    """

    with BackendDatabase(web_session) as db:
        with BackendTransaction(db):

            # Remove the connection for this profile
            db.execute('''DELETE FROM profile_has_db_connection WHERE
                profile_id=? AND db_connection_id=?''', (profile_id, connection_id))

            # Check if some other profile is still using the connection
            result = db.select('''SELECT COUNT(*) as cnt FROM profile_has_db_connection
                WHERE db_connection_id=?''', (connection_id, ))

            # If no other profile is using this connection, remove it.
            if result['rows'][0]['cnt'] == 0:
                db.execute('''DELETE FROM db_connection
                    WHERE id=?''', (connection_id,))

            result = Response.fromStatus(db.get_last_status(), {
                "result": {"db_connection_id": connection_id}})

    return result


@plugin_function('gui.dbconnections.listDbConnections', shell=False, web=True)
def list_db_connections(profile_id, folder_path='', web_session=None):
    """lists the db_connections for the given profile

    Args:
        profile_id (int): The id of the profile
        folder_path (str): The folder path used for grouping and nesting
            connections, optional
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically

    Returns:
        str: The list of connections in a result JSON string
    """
    result = None
    with BackendDatabase(web_session) as db:
        result = db.select('''SELECT dc.id, p_dc.folder_path, dc.caption,
            dc.description, dc.db_type, dc.options, p_dc.`index`
            FROM profile_has_db_connection p_dc
                LEFT JOIN db_connection dc ON
                    p_dc.db_connection_id = dc.id
            WHERE p_dc.profile_id = ? AND p_dc.folder_path LIKE ?''',
                           (profile_id, '%' if folder_path == '' else folder_path),
                           close=(web_session is None))

    return result


@plugin_function('gui.dbconnections.getDbConnection', shell=False, web=True)
def get_db_connection(db_connection_id, web_session=None):
    """get the a db_connection

    Args:
        db_connection_id (int): The id of the db_connection
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically

    Returns:
        str: The db_connections in a result JSON string
    """
    result = None
    with BackendDatabase(web_session) as db:
        result = db.select('SELECT * FROM db_connection WHERE id = ?',
                           (db_connection_id,), close=(web_session is None))

    return result


@plugin_function('gui.dbconnections.getDbTypes', shell=False, web=True)
def get_db_types():
    """get the list of db_types

    Returns:
        str: The list of db_types in a result JSON string
    """

    return Response.ok("Successfully obtained db session types", {"db_type": DbSessionFactory.getSessionTypes()})


@plugin_function('gui.dbconnections.setCredential', shell=False, web=True)
def set_credential(url, password):
    """set the password of a db_connection url

    Args:
        url (str): The URL needs to be in the following form
            user@(host[:port]|socket).
        password (str): The password

    Returns:
        None
    """

    import mysqlsh

    mysqlsh.globals.shell.store_credential(url, password)


@plugin_function('gui.dbconnections.deleteCredential', shell=False, web=True)
def delete_credential(url):
    """deletes the password of a db_connection url

    Args:
        url (str): The URL needs to be in the following form
            user@(host[:port]|socket).

    Returns:
        None
    """

    import mysqlsh

    mysqlsh.globals.shell.delete_credential(url)


@plugin_function('gui.dbconnections.listCredentials', shell=False, web=True)
def list_credentials():
    """lists the db_connection urls that have a password stored

    Returns:
        list: The list of db_connection urls that have a password stored
    """

    import mysqlsh

    return mysqlsh.globals.shell.list_credentials()


@plugin_function('gui.dbconnections.testConnection', shell=False, web=True)
def test_connection(connection, request_id, password=None, web_session=None):
    """Opens test connection

    Args:
        connection (object): The id of the db_connection or connection information
        request_id (str): ID of the request starting the session.
        password (str): The password to use when opening the connection. If not supplied, then use the password defined in the database options.
        web_session (object): The web_session object this session will belong to

    Allowed options for connection:
        db_type (str,required): The db type name
        options (dict,required): The options specific for the current database type

    Returns:
        A dict holding the result message.
    """

    new_session = DbModuleSession(web_session)
    new_session.open_connection(connection, password, request_id)
    if password is None and not 'password' in connection['options']:
        result = Response.ok("New database session created successfully.", {
            "module_session_id": new_session.module_session_id,
            "request_id": request_id
        })
        return result

    new_session.close()


@plugin_function('gui.dbconnections.moveConnection', shell=False, web=True)
def move_connection(profile_id, folder_path, connection_id_to_move, connection_id_offset, before=False, web_session=None):
    """updates the connections sort order for the given profile

    Args:
        profile_id (int): The id of the profile
        folder_path (str): The folder path used for grouping and nesting connections
        connection_id_to_move (int): The id of the connection to move
        connection_id_offset (int): The id of the offset connection
        before (bool): Indicates whether connection_id_to_move should be moved before connection_id_offset or after
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically


    Returns:
        string: The connection_id in a result JSON string
    """

    with BackendDatabase(web_session) as db:
        with BackendTransaction(db):
            index_to_move = dbconnections.get_connection_folder_index(db, profile_id, folder_path, connection_id_to_move)
            index_offset = dbconnections.get_connection_folder_index(db, profile_id, folder_path, connection_id_offset)

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

            result = Response.ok("Successfully updated db connections sort order.")
    return result
