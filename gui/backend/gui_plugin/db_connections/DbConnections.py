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

import json
from typing import Any, Optional

from mysqlsh.plugin_manager import plugin_function  # pylint: disable=no-name-in-module

import gui_plugin.core.Error as Error
from gui_plugin.core.backend_db import db_connections
from gui_plugin.core.Db import BackendDatabase, BackendTransaction
from gui_plugin.core.dbms import DbSessionFactory
from gui_plugin.core.Error import MSGException
from gui_plugin.core.modules.DbModuleSession import DbModuleSession
from gui_plugin.db_connections import InternalData


def _sanitize_connection_tags(tags):
    if not isinstance(tags, dict):
        return {}

    sanitized = {}
    for caption, color in tags.items():
        if not isinstance(caption, str) or not isinstance(color, str):
            continue

        caption = caption.strip()
        color = color.strip()
        if caption and color:
            sanitized[caption] = color

    return sanitized


def _get_profile_user_id(db, profile_id):
    result = db.select("SELECT user_id FROM profile WHERE id=?", (profile_id,))
    if len(result) == 0:
        raise MSGException(
            Error.CORE_INVALID_PARAMETER,
            f"No profile found for id {profile_id}.",
        )

    return result[0]["user_id"]


def _get_connection_tag_rows(db, profile_id):
    user_id = _get_profile_user_id(db, profile_id)

    return db.select(
        """SELECT id, caption, color
        FROM tag
        WHERE user_id=?
        ORDER BY id""",
        (user_id,),
    )


def _hydrate_connection_tags(db, profile_id, connection):
    selected_tags = db.select(
        """SELECT t.caption
        FROM db_connection_has_tag dcht
            JOIN tag t ON dcht.tag_id = t.id
        WHERE dcht.profile_id=? AND dcht.db_connection_id=?
        ORDER BY t.id""",
        (profile_id, connection["id"]),
    )
    connection["tags"] = [tag["caption"] for tag in selected_tags]

    return connection


def _connection_tags_for_sync(connection):
    selected_tags = connection.get("tags")
    if selected_tags is None:
        settings = connection.get("settings")
        selected_tags = settings.get("tags") if isinstance(settings, dict) else None

    return selected_tags


def _sync_connection_tags(db, profile_id, connection_id, connection):
    selected_tags = _connection_tags_for_sync(connection)
    if selected_tags is None:
        return

    if not isinstance(selected_tags, list):
        selected_tags = []

    selected_tags = [
        tag.strip() for tag in selected_tags
        if isinstance(tag, str) and tag.strip()
    ]
    selected_tags = list(dict.fromkeys(selected_tags))
    tag_ids = {
        row["caption"]: row["id"]
        for row in _get_connection_tag_rows(db, profile_id)
    }

    db.execute(
        """DELETE FROM db_connection_has_tag
        WHERE profile_id=? AND db_connection_id=?""",
        (profile_id, connection_id),
    )
    for tag in selected_tags:
        tag_id = tag_ids.get(tag)
        if tag_id is not None:
            db.execute(
                """INSERT INTO db_connection_has_tag(
                profile_id, db_connection_id, tag_id)
                VALUES(?, ?, ?)""",
                (profile_id, connection_id, tag_id),
            )


def _delete_connection_tag_links(db, user_id, tag_id):
    db.execute(
        """DELETE FROM db_connection_has_tag
        WHERE tag_id=?
            AND profile_id IN (
                SELECT id
                FROM profile
                WHERE user_id=?
            )""",
        (tag_id, user_id),
    )


def _settings_for_storage(connection):
    raw_settings = connection.get("settings", {})
    if not isinstance(raw_settings, dict):
        raise MSGException(
            Error.CORE_INVALID_PARAMETER,
            "The settings parameter must be a dictionary.",
        )

    settings = dict(raw_settings)
    settings.pop("tags", None)
    settings.pop("badge", None)
    settings.pop(InternalData.SERVER_STATUS_CACHE_KEY, None)

    return settings


def _connection_credential_url(connection):
    if connection.get("db_type", "").lower() != "mysql":
        return None

    options = connection.get("options")
    if not isinstance(options, dict):
        return None

    user = options.get("user")
    if not isinstance(user, str) or not user:
        return None

    socket = options.get("socket")
    if isinstance(socket, str) and socket:
        target = socket
    else:
        host = options.get("host")
        if not isinstance(host, str) or not host:
            return None

        port = options.get("port")
        target = f"{host}:{port}" if port else host

    return f"{user}@{target}"


def _validate_new_connection(connection):
    if (
        "caption" not in connection
        or not isinstance(connection["caption"], str)
        or connection["caption"].strip() == ""
    ):
        raise MSGException(
            Error.CORE_INVALID_PARAMETER,
            "The connection must contain valid caption.",
        )

    if (
        "db_type" not in connection
        or not isinstance(connection["db_type"], str)
        or connection["db_type"].upper() not in ["MYSQL", "SQLITE"]
    ):
        raise MSGException(
            Error.CORE_INVALID_PARAMETER,
            "The connection must contain valid database type.",
        )


def insert_db_connection(db, profile_id, connection, folder_path_id=None):
    """Insert and associate a validated connection using an open transaction."""
    _validate_new_connection(connection)
    db.execute(
        """INSERT INTO db_connection(
        db_type, caption, description, options, settings)
        VALUES(?, ?, ?, ?, ?)""",
        (
            connection.get("db_type", "MySQL"),
            connection.get("caption", "New Connection"),
            connection.get("description", ""),
            json.dumps(connection.get("options", {})),
            json.dumps(_settings_for_storage(connection)),
        ),
    )
    connection_id = db.get_last_row_id()

    if folder_path_id is None:
        folder_path_id = 1
    index = db_connections.get_next_connection_index(
        db,
        profile_id,
        folder_path_id,
    )
    db.execute(
        """INSERT INTO profile_has_db_connection(
        profile_id, db_connection_id, folder_path_id, `index`)
        VALUES(?, ?, ?, ?)""",
        (profile_id, connection_id, folder_path_id, index),
    )
    _sync_connection_tags(db, profile_id, connection_id, connection)

    return (connection_id, folder_path_id, index)


def ensure_folder_path(
    db,
    profile_id,
    caption,
    settings=None,
    parent_folder_id=None,
):
    """Return or create a folder path using an open transaction."""
    if parent_folder_id is None:
        parent_folder_id = 1
    folder_path_id = db_connections.folder_exists(
        db,
        caption,
        parent_folder_id,
    )
    if folder_path_id is None:
        index = db_connections.get_next_connection_index(
            db,
            profile_id,
            parent_folder_id,
        )
        db.execute(
            """INSERT INTO folder_path(
            parent_folder_id, caption, `index`, settings)
            VALUES (?, ?, ?, ?)""",
            (
                parent_folder_id,
                caption,
                index,
                json.dumps(settings or {}),
            ),
        )
        folder_path_id = db.get_last_row_id()

    return db.select(
        "SELECT * FROM folder_path WHERE id=?",
        (folder_path_id,),
    )[0]


@plugin_function("gui.dbConnections.addDbConnection", cli=True, shell=True, web=True)
def add_db_connection(profile_id, connection, folder_path_id=None, be_session=None):
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
        tags (list): The user-defined tags assigned to the connection

    Returns:
        tuple: A tuple containing (connection_id, folder_path_id, index)
    """
    _validate_new_connection(connection)

    with BackendDatabase(be_session) as db:
        with BackendTransaction(db):
            return insert_db_connection(
                db,
                profile_id,
                connection,
                folder_path_id,
            )


@plugin_function(
    "gui.dbConnections.importWorkbenchConnections",
    shell=False,
    cli=False,
    web=True,
)
def import_workbench_connections(
    profile_id: int,
    xml_content: str,
    be_session=None,
) -> dict:
    """Import non-secret connections from classic Workbench XML.

    Args:
        profile_id (int): The target profile id.
        xml_content (str): The selected Workbench connections XML.
        be_session (object): The current GUI backend session.

    Returns:
        dict: Counts and issues for the import.
    """
    from gui_plugin.db_connections.WorkbenchImport import import_workbench_xml

    with BackendDatabase(be_session) as db:
        with BackendTransaction(db):
            return import_workbench_xml(
                db,
                profile_id,
                xml_content,
                "workbenchManual",
            )


@plugin_function("gui.dbConnections.updateDbConnection", shell=True, web=True)
def update_db_connection(
    profile_id, connection_id, connection=None, folder_path_id=None, be_session=None
):
    """Update the data for a database connection

    Args:
        profile_id (int): The id of the profile
        connection_id (int): The id of the connection to update
        connection (dict): The connection information as a dict, optional, e.g. {
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
        tags (list): The user-defined tags assigned to the connection

    Returns:
        None
    """

    if connection is None and folder_path_id is None:
        raise MSGException(
            Error.CORE_INVALID_PARAMETER,
            "At least one of connection or folder_path_id must be provided.",
        )

    with BackendDatabase(be_session) as db:
        with BackendTransaction(db):
            if connection is not None:
                current = db.select(
                    "SELECT db_type, options FROM db_connection WHERE id=?",
                    (connection_id,),
                )
                invalidate_server_status = bool(current) and (
                    (
                        connection.get("db_type") is not None
                        and connection["db_type"] != current[0]["db_type"]
                    )
                    or (
                        connection.get("options") is not None
                        and connection["options"] != current[0]["options"]
                    )
                )
                if connection.get("db_type") is not None:
                    db.execute(
                        "UPDATE db_connection SET db_type=? WHERE id=?",
                        (connection["db_type"], connection_id),
                    )
                if connection.get("caption") is not None:
                    db.execute(
                        "UPDATE db_connection SET caption=? WHERE id=?",
                        (connection["caption"], connection_id),
                    )
                if connection.get("description") is not None:
                    db.execute(
                        "UPDATE db_connection SET description=? WHERE id=?",
                        (connection["description"], connection_id),
                    )
                if connection.get("options") is not None:
                    db.execute(
                        "UPDATE db_connection SET options=? WHERE id=?",
                        (json.dumps(connection["options"]), connection_id),
                    )
                if connection.get("settings") is not None:
                    db.execute(
                        "UPDATE db_connection SET settings=? WHERE id=?",
                        (json.dumps(_settings_for_storage(connection)), connection_id),
                    )
                if connection.get("tags") is not None:
                    _sync_connection_tags(db, profile_id, connection_id, connection)
                if invalidate_server_status:
                    InternalData.invalidate_server_status_cache(connection_id, db)
            if folder_path_id is not None:
                index = db_connections.get_next_connection_index(
                    db, profile_id, folder_path_id
                )
                db.execute(
                    """UPDATE profile_has_db_connection
                              SET folder_path_id=?
                              WHERE profile_id=? AND db_connection_id=?""",
                    (folder_path_id, profile_id, connection_id),
                )
                db.execute(
                    """UPDATE profile_has_db_connection
                              SET `index`=?
                              WHERE profile_id=? AND folder_path_id=? AND db_connection_id=?""",
                    (index, profile_id, folder_path_id, connection_id),
                )


@plugin_function("gui.dbConnections.removeDbConnection", cli=True, shell=True, web=True)
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
            db.execute(
                """DELETE FROM profile_has_db_connection WHERE
                profile_id=? AND db_connection_id=?""",
                (profile_id, connection_id),
            )

            # Check if some other profile is still using the connection
            result = db.select(
                """SELECT COUNT(*) as cnt FROM profile_has_db_connection
                WHERE db_connection_id=?""",
                (connection_id,),
            )

            # If no other profile is using this connection, remove it and its
            # password from the MySQL Shell credential store.
            if result[0]["cnt"] == 0:
                connection = db.select(
                    "SELECT db_type, options FROM db_connection WHERE id=?",
                    (connection_id,),
                )[0]
                credential_url = _connection_credential_url(connection)
                if credential_url:
                    try:
                        delete_credential(credential_url)
                    except RuntimeError as error:
                        if "Could not find the secret" not in str(error):
                            raise

                db.execute(
                    """DELETE FROM db_connection
                    WHERE id=?""",
                    (connection_id,),
                )


@plugin_function("gui.dbConnections.listDbConnections", cli=True, shell=True, web=True)
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
        connections = db.select(
            """SELECT dc.id, p_dc.folder_path_id, dc.caption,
            dc.description, dc.db_type, dc.options, dc.settings, p_dc.`index`
            FROM profile_has_db_connection p_dc
                LEFT JOIN db_connection dc ON
                    p_dc.db_connection_id = dc.id
            WHERE p_dc.profile_id = ? AND p_dc.folder_path_id = ?""",
            (profile_id, "1" if folder_path_id is None else folder_path_id),
        )
        for connection in connections:
            _hydrate_connection_tags(db, profile_id, connection)

        return connections


@plugin_function("gui.dbConnections.getDbConnection", cli=True, shell=True, web=True)
def get_db_connection(db_connection_id, profile_id=None, be_session=None):
    """Get the db_connection

    Args:
        db_connection_id (int): The id of the db_connection
        profile_id (int): The id of the profile, optional
        be_session (object):  A session to the GUI backend database
            where the operation will be performed.

    Returns:
        dict: The db connection
    """
    with BackendDatabase(be_session) as db:
        connection = db.select(
            """SELECT id, db_type, caption, description, options, settings
            FROM db_connection WHERE id = ?""",
            (db_connection_id,),
        )[0]
        if profile_id is not None:
            _hydrate_connection_tags(db, profile_id, connection)

        return connection


@plugin_function("gui.dbConnections.listConnectionTags", cli=True, shell=True, web=True)
def list_connection_tags(profile_id, be_session=None):
    """Lists the connection tag definitions for a profile's user.

    Args:
        profile_id (int): The id of the profile
        be_session (object): A session to the GUI backend database
            where the operation will be performed.

    Returns:
        dict: A mapping from tag caption to tag color.
    """
    with BackendDatabase(be_session) as db:
        return {
            row["caption"]: row["color"]
            for row in _get_connection_tag_rows(db, profile_id)
        }


@plugin_function("gui.dbConnections.updateConnectionTags", cli=True, shell=True, web=True)
def update_connection_tags(profile_id, tags, be_session=None):
    """Updates the connection tag definitions for a profile's user.

    Args:
        profile_id (int): The id of the profile
        tags (dict): A mapping from tag caption to tag color
        be_session (object): A session to the GUI backend database
            where the operation will be performed.

    Returns:
        None
    """
    sanitized_tags = _sanitize_connection_tags(tags)
    with BackendDatabase(be_session) as db:
        with BackendTransaction(db):
            user_id = _get_profile_user_id(db, profile_id)
            existing_tags = {
                row["caption"]: row["id"]
                for row in _get_connection_tag_rows(db, profile_id)
            }
            removed_tag_ids = [
                tag_id for caption, tag_id in existing_tags.items()
                if caption not in sanitized_tags
            ]
            for tag_id in removed_tag_ids:
                _delete_connection_tag_links(db, user_id, tag_id)
                db.execute("DELETE FROM tag WHERE id=?", (tag_id,))

            next_id_result = db.select("SELECT MAX(id) AS max_id FROM tag")
            next_id = (next_id_result[0]["max_id"] or 0) + 1
            for caption, color in sanitized_tags.items():
                tag_id = existing_tags.get(caption)
                if tag_id is None:
                    db.execute(
                        """INSERT INTO tag(id, user_id, caption, color)
                        VALUES(?, ?, ?, ?)""",
                        (next_id, user_id, caption, color),
                    )
                    next_id += 1
                else:
                    db.execute(
                        """UPDATE tag
                        SET color=?
                        WHERE id=? AND user_id=?""",
                        (color, tag_id, user_id),
                    )


def refresh_server_status_cache(
    connection_id: int, db_session: Any, be_session: Any = None
) -> None:
    """Refreshes backend-owned cached sysvars from a service session."""
    InternalData.refresh_server_status_cache(connection_id, db_session, be_session)


@plugin_function("gui.dbConnections.getServerStatusCache", shell=True, web=True)
def get_server_status_cache(
    module_session: object,
    be_session: Any = None,
) -> Optional[dict[str, Any]]:
    """Gets cached server status sysvars for an offline module session.

    Args:
        module_session (object): The profile-bound offline module session.
        be_session (object): A session to the GUI backend database
            where the operation will be performed.

    Returns:
        The cached server status data, or None if unavailable.
    """
    connection_id = module_session.get_offline_connection_id()
    return InternalData.get_server_status_cache(connection_id, be_session=be_session)


@plugin_function("gui.dbConnections.getDbTypes", cli=True, shell=True, web=True)
def get_db_types():
    """Get the list of db_types

    Returns:
        list: The list of db types
    """

    return DbSessionFactory.getSessionTypes()


@plugin_function("gui.dbConnections.setCredential", cli=True, shell=True, web=True)
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


@plugin_function("gui.dbConnections.deleteCredential", cli=True, shell=True, web=True)
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


@plugin_function("gui.dbConnections.listCredentials", cli=True, shell=True, web=True)
def list_credentials():
    """Lists the db_connection urls that have a password stored

    Returns:
        list: The list of db_connection urls that have a password stored
    """

    import mysqlsh

    return mysqlsh.globals.shell.list_credentials()


@plugin_function("gui.dbConnections.testConnection", cli=True, shell=True, web=True)
def test_connection(connection, password=None):
    """Opens test connection

    Args:
        connection (object): The id of the db_connection or connection information
        password (str): Optional password to use when opening the connection.

    Allowed options for connection:
        db_type (str): The db type name
        options (dict): The options specific for the current database type

    Returns:
        None
    """
    new_session = DbModuleSession()
    try:
        new_session.open_connection(connection, password)
        new_session.completion_event.wait()

        if new_session.completion_event.has_errors:
            raise new_session.completion_event.get_errors()[0]
    finally:
        new_session.close()


@plugin_function("gui.dbConnections.moveConnection", cli=True, shell=True, web=True)
def move_connection(
    profile_id,
    folder_id,
    connection_id_to_move,
    connection_id_offset,
    before=False,
    be_session=None,
):
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
                db, profile_id, folder_id, connection_id_to_move
            )
            index_offset = db_connections.get_connection_index(
                db, profile_id, folder_id, connection_id_offset
            )

            if index_to_move > index_offset:
                index = index_offset if before else index_offset + 1
                db.execute(
                    """UPDATE profile_has_db_connection
                          SET `index`=`index`+1
                          WHERE profile_id=? AND folder_path_id=? AND `index`>=? AND `index`<?""",
                    (profile_id, folder_id, index, index_to_move),
                )
                db.execute(
                    """UPDATE folder_path
                          SET `index`=`index`+1
                          WHERE `index`>=? AND `index`<?""",
                    (index, index_to_move),
                )
            else:
                index = index_offset - 1 if before else index_offset
                db.execute(
                    """UPDATE profile_has_db_connection
                          SET `index`=`index`-1
                          WHERE profile_id=? AND folder_path_id=? AND `index`<=? AND `index`>?""",
                    (profile_id, folder_id, index, index_to_move),
                )
                db.execute(
                    """UPDATE folder_path
                          SET `index`=`index`-1
                          WHERE `index`<=? AND `index`>?""",
                    (index, index_to_move),
                )

            db.execute(
                """UPDATE profile_has_db_connection
                          SET `index`=?
                          WHERE profile_id=? AND folder_path_id=? AND db_connection_id=?""",
                (index, profile_id, folder_id, connection_id_to_move),
            )


@plugin_function("gui.dbConnections.addFolderPath", cli=True, shell=True, web=True)
def add_folder_path(
    profile_id, caption, settings=None, parent_folder_id=None, be_session=None
):
    """Add a new folder path

    Args:
        profile_id (int): The id of the profile
        caption (str): The caption of the folder
        settings (dict): Additional settings for the folder, optional
        parent_folder_id (int): The id of the parent folder, optional
        be_session (object): A session to the GUI backend database where the operation will be performed.

    Allowed options for settings:
        color (str): The color of the tile

    Returns:
        int: The folder path ID
    """
    with BackendDatabase(be_session) as db:
        with BackendTransaction(db):
            return ensure_folder_path(
                db,
                profile_id,
                caption,
                settings,
                parent_folder_id,
            )


@plugin_function("gui.dbConnections.removeFolderPath", cli=True, shell=True, web=True)
def remove_folder_path(folder_path_id, be_session=None):
    """Remove a folder path

    Args:
        folder_path_id (int): The id of the folder path to remove
        be_session (object): A session to the GUI backend database where the operation will be performed.

    Returns:
        None
    """
    with BackendDatabase(be_session) as db:
        db.execute("""DELETE FROM folder_path WHERE id=?""", (folder_path_id,))


@plugin_function("gui.dbConnections.removeEmptyFolders", cli=True, shell=True, web=True)
def remove_empty_folders(be_session=None):
    """Remove all empty folders

    Args:
        be_session (object): A session to the GUI backend database where the operation will be performed.

    Returns:
        None
    """
    with BackendDatabase(be_session) as db:
        with BackendTransaction(db):
            no_more_empty_folders = False
            while not no_more_empty_folders:
                db.execute("""DELETE FROM folder_path WHERE id != 1 AND id NOT IN (
                    SELECT parent_folder_id FROM folder_path WHERE parent_folder_id IS NOT NULL
                    UNION
                    SELECT folder_path_id FROM profile_has_db_connection)""")

                result = db.select(
                    """SELECT COUNT(*) as cnt FROM folder_path WHERE id != 1 AND id NOT IN (
                    SELECT parent_folder_id FROM folder_path WHERE parent_folder_id IS NOT NULL
                    UNION
                    SELECT folder_path_id FROM profile_has_db_connection)"""
                )

                no_more_empty_folders = result[0]["cnt"] == 0


@plugin_function("gui.dbConnections.renameFolderPath", cli=True, shell=True, web=True)
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
        db.execute(
            """UPDATE folder_path SET caption=? WHERE id=?""",
            (new_caption, folder_path_id),
        )


@plugin_function("gui.dbConnections.moveFolder", cli=True, shell=True, web=True)
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
        db.execute(
            """UPDATE folder_path SET parent_folder_id=? WHERE id=?""",
            (new_parent_folder_id, folder_path_id),
        )


@plugin_function("gui.dbConnections.listFolderPaths", cli=True, shell=True, web=True)
def list_folder_paths(parent_folder_id=None, recursive=False, be_session=None):
    """List folder paths

    Args:
        parent_folder_id (int): The id of the parent folder to list child folders, optional
        recursive (bool): If True, returns all nested subfolders; if False, returns only immediate children
        be_session (object): A session to the GUI backend database where the operation will be performed.

    Returns:
        list: The list of folder paths
    """
    with BackendDatabase(be_session) as db:
        if not recursive:
            if parent_folder_id is None:
                return db.select(
                    """SELECT * FROM folder_path WHERE parent_folder_id IS NULL ORDER BY `index` ASC"""
                )
            else:
                return db.select(
                    """SELECT * FROM folder_path WHERE parent_folder_id=? ORDER BY `index` ASC""",
                    (parent_folder_id,),
                )
        else:
            result = []

            def get_folders_recursive(parent_id):
                if parent_id is None:
                    folders = db.select(
                        """SELECT * FROM folder_path WHERE parent_folder_id IS NULL ORDER BY `index` ASC"""
                    )
                else:
                    folders = db.select(
                        """SELECT * FROM folder_path WHERE parent_folder_id=? ORDER BY `index` ASC""",
                        (parent_id,),
                    )

                result.extend(folders)

                for folder in folders:
                    get_folders_recursive(folder["id"])

            get_folders_recursive(parent_folder_id)

            return result


@plugin_function("gui.dbConnections.listAll", cli=True, shell=True, web=True)
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
        combined_list = db.select(
            """
            SELECT dc.id, dc.caption, dc.description, dc.db_type, dc.options, dc.settings, p_dc.`index`, 'connection' AS type
                FROM profile_has_db_connection p_dc
                LEFT JOIN db_connection dc ON p_dc.db_connection_id = dc.id
                WHERE p_dc.profile_id = ? AND p_dc.folder_path_id = ?
            UNION ALL
            SELECT fp.id, fp.caption, NULL AS description, NULL AS db_type, NULL AS options, fp.settings, fp.`index`, 'folder' AS type
                FROM folder_path fp
                WHERE fp.parent_folder_id = ?
                ORDER BY `index` ASC
        """,
            (
                profile_id,
                folder_id if folder_id is not None else 1,
                folder_id if folder_id is not None else 1,
            ),
        )
        for entry in combined_list:
            if entry["type"] == "connection":
                _hydrate_connection_tags(db, profile_id, entry)

    return combined_list


@plugin_function(
    "gui.dbConnections.updateFolderSettings", cli=True, shell=True, web=True
)
def update_folder_settings(folder_path_id, new_settings, be_session=None):
    """Rename a folder path

    Args:
        folder_path_id (int): The id of the folder path to rename
        new_settings (dict): The new settings for the folder path
        be_session (object): A session to the GUI backend database where the operation will be performed.

    Allowed options for new_settings:
        color (str): The color of the tile

    Returns:
        None
    """
    with BackendDatabase(be_session) as db:
        db.execute(
            """UPDATE folder_path SET settings=? WHERE id=?""",
            (new_settings, folder_path_id),
        )


@plugin_function("gui.dbConnections.getFolder", cli=True, shell=True, web=True)
def get_folder(folder_path_id, be_session=None):
    """Get folder

    Args:
        folder_path_id (int): The id of the folder
        be_session (object):  A session to the GUI backend database
            where the operation will be performed.

    Returns:
        dict: The folder
    """
    with BackendDatabase(be_session) as db:
        return db.select("SELECT * FROM folder_path WHERE id = ?", (folder_path_id,))[0]
