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
    plugin_function  # pylint: disable=import-error

from gui_plugin.core import Error
from gui_plugin.core.Context import get_context
from gui_plugin.core.Db import BackendDatabase, BackendTransaction
from gui_plugin.core.Error import MSGException
from gui_plugin.db import backend as db_backend
from gui_plugin.modules.Modules import (add_data, delete_data,
                                        get_data_category_id, list_data)
from gui_plugin.sql_editor.SqlEditorModuleSession import SqlEditorModuleSession

from . import backend as sql_editor_backend

@plugin_function('gui.sqlEditor.isGuiModuleBackend', web=True)
def is_gui_module_backend():
    """Indicates whether this module is a GUI backend module

    Returns:
        bool: True
    """
    return True


@plugin_function('gui.sqlEditor.getGuiModuleDisplayInfo', web=True)
def get_gui_module_display_info():
    """Returns display information about the module

    Returns:
        dict: display information for the module
    """
    return {"name": "SQL Editor",
            "description": "A graphical SQL Editor",
            "icon_path": "/images/icons/modules/gui.sqlEditor.svg"}


@plugin_function('gui.sqlEditor.startSession', shell=False, web=True)
def start_session():
    """Starts a SQL Editor Session

    Returns:
        dict: contains module session ID
    """
    new_session = SqlEditorModuleSession()

    return {"module_session_id": new_session.module_session_id}


@plugin_function('gui.sqlEditor.closeSession', shell=False, web=True)
def close_session(module_session):
    """Closes the SQL Editor Session

    Args:
        module_session (object): The module session object that should be closed
    Returns:
        None
    """
    module_session.close()


@plugin_function('gui.sqlEditor.openConnection', shell=False, web=True)
def open_connection(db_connection_id, module_session, password=None):
    """Opens the SQL Editor Session

    Args:
        db_connection_id (int): The id of the db_connection
        module_session (object): The session where the connection will open
        password (str): The password to use when opening the connection. If not supplied, then use the password defined in the database options.

    Returns:
        None
    """
    module_session.open_connection(db_connection_id, password)


@plugin_function('gui.sqlEditor.reconnect', shell=False, web=True)
def reconnect(module_session):
    """Reconnects the SQL Editor Session

    Args:
        module_session (object): The session where the session will be reconnected

    Returns:
        None
    """
    module_session.reconnect()


@plugin_function('gui.sqlEditor.startTransaction', shell=False, web=True)
def start_transaction(session):
    """Starts a new transaction

    Args:
        session (object): The session used to execute the operation

    Returns:
        None
    """
    session = db_backend.get_db_session(session)

    session.start_transaction()


@plugin_function('gui.sqlEditor.commitTransaction', shell=False, web=True)
def commit_transaction(session):
    """Starts a new transaction

    Args:
        session (object): The session used to execute the operation

    Returns:
        None
    """
    session = db_backend.get_db_session(session)

    session.commit()


@plugin_function('gui.sqlEditor.rollbackTransaction', shell=False, web=True)
def rollback_transaction(session):
    """Starts a new transaction

    Args:
        session (object): The session used to execute the operation

    Returns:
        None
    """
    session = db_backend.get_db_session(session)

    session.rollback()


@plugin_function('gui.sqlEditor.execute', shell=True, web=True)
def execute(session, sql, params=None, options=None):
    """Executes the given SQL.

    Args:
        session (object): The session used to execute the operation
        sql (str): The sql command to execute.
        params (list): The parameters for the sql command.
        options (dict): A dictionary that holds additional options, e.g.
            {"row_packet_size": -1}

    Allowed options for options:
        row_packet_size (int): The pack size for each result segment

    Returns:
        dict: the result message
    """
    session = db_backend.get_db_session(session)

    return session.execute(sql=sql, params=params, options=options)


@plugin_function('gui.sqlEditor.killQuery', shell=False, web=True)
def kill_query(module_session):
    """Stops the query that is currently executing.

    Args:
        module_session (object): The module session object where the query is running

    Returns:
        None
    """
    module_session.kill_query()


@plugin_function('gui.sqlEditor.getCurrentSchema', shell=True, web=True)
def get_current_schema(session):
    """Requests the current schema for this module.

    Args:
        session (object): The session used to execute the operation

    Returns:
        str: current schema name
    """
    session = db_backend.get_db_session(session)
    return session.get_current_schema()


@plugin_function('gui.sqlEditor.setCurrentSchema', shell=True, web=True)
def set_current_schema(session, schema_name):
    """Requests to change the current schema for this module.

    Args:
        session (object): The session used to execute the operation
        schema_name (str): The name of the schema to use

    Returns:
        None
    """
    session = db_backend.get_db_session(session)
    session.set_current_schema(schema_name=schema_name)


@plugin_function('gui.sqlEditor.getAutoCommit', shell=True, web=True)
def get_auto_commit(session):
    """Requests the auto-commit status for this module.

    Args:
        session (object): The session used to execute the operation

    Returns:
        int: auto-commit status
    """
    session = db_backend.get_db_session(session)
    return session.get_auto_commit()


@plugin_function('gui.sqlEditor.setAutoCommit', shell=True, web=True)
def set_auto_commit(session, state):
    """Requests to change the auto-commit status for this module.

    Args:
        session (object): The session used to execute the operation
        state (bool): The auto-commit state to set for the module session

    Returns:
        None
    """
    session = db_backend.get_db_session(session)
    session.set_auto_commit(state=state)


@plugin_function('gui.sqlEditor.addExecutionHistoryEntry', shell=False, web=True)
def add_execution_history_entry(connection_id, code, language_id, profile_id=None, be_session=None):
    """Adds a new entry in the execution_history

    Adds an entry of the code + language_id + current_timestamp at the beginning of
    the execution_history of the given connection_id. Each connection_id has its own execution_history.

    execution_history has a maximum size that can be configured, defaults to 50 entries.

    Args:
        connection_id (int): The id of the db_connection
        code (str): The code to be stored in the history
        language_id (str): The language id of the code
        profile_id (int): The id of profile
        be_session (object):  A session to the GUI backend database
            where the operation will be performed.

    Returns:
        int: the id of the new record.
    """

    max_entries = 50
    category_id = get_data_category_id("DB Notebook Code History")
    folder_name = f"db_notebook_code_history_{connection_id}"
    tree_identifier = "DBNotebookCodeHistoryTree"

    with BackendDatabase(be_session) as db:
        context = get_context()
        group_id = context.web_handler.user_personal_group_id if context is not None else None
        folder_id = sql_editor_backend.get_folder_id(db, connection_id, group_id)

        history_entries = list_data(folder_id, category_id, be_session)
        history_entries.sort(key=lambda x: x['last_update'], reverse=True)

        # Check if the last entry has the same code
        if history_entries and len(history_entries) > 0:
            previous_entry_code = sql_editor_backend.get_entry(db, history_entries[0]['id'])["code"]
            if previous_entry_code == code:
                return history_entries[0]['id']

        entry_id = add_data(language_id, code, category_id, tree_identifier, folder_name, profile_id, be_session)

        if len(history_entries) >= max_entries:
            delete_data(history_entries[0]['id'], folder_id, be_session)

    return entry_id


@plugin_function('gui.sqlEditor.getExecutionHistoryEntry', shell=False, web=True)
def get_execution_history_entry(connection_id, index, profile_id=None, be_session=None):
    """Returns an entry of the execution_history

    The execution_history stored the entries with newest entry on top. So passing an index of 0
    will return the last inserted history item. Passing an index higher than the current number
    of stored items will return an empty dict.

    Args:
        connection_id (int): The id of the db_connection
        index (int): The index of the history entry to return
        profile_id (int): The id of profile
        be_session (object):  A session to the GUI backend database
            where the operation will be performed.

    Returns:
        dict: index, code, language_id, current_timestamp of the entry
    """

    with BackendDatabase(be_session) as db:
        with BackendTransaction(db):
            context = get_context()
            group_id = context.web_handler.user_personal_group_id if context is not None else None
            category_id = get_data_category_id("DB Notebook Code History", be_session)
            folder_id = sql_editor_backend.get_folder_id(db, connection_id, group_id, profile_id)

            history_entries = list_data(folder_id, category_id, be_session)
            history_entries.sort(key=lambda x: x['last_update'], reverse=True)

            if index < len(history_entries):
                return sql_editor_backend.get_entry(db, history_entries[index]['id'])
            else:
                return {}


@plugin_function('gui.sqlEditor.getExecutionHistoryEntries', shell=False, web=True)
def get_execution_history_entries(connection_id, language_id="", truncate_code_length=-1, profile_id=None, be_session=None):
    """Returns the full list execution_history but truncates the code to truncate_code_length

    Used to display a list of history entries in the UI. If truncate_code_length is set to -1,
    the full code is returned.

    If the language_id is specified, the list is filtered to only the specific language

    Args:
        connection_id (int): The id of the db_connection
        language_id (str): The language id of the code
        truncate_code_length (int): The length to truncate the code to
        profile_id (int): The id of profile
        be_session (object):  A session to the GUI backend database
            where the operation will be performed.

    Returns:
        list[dict]: code, language_id, current_timestamp of the entry

    """

    with BackendDatabase(be_session) as db:
        with BackendTransaction(db):
            list_of_history_entries = []
            context = get_context()
            group_id = context.web_handler.user_personal_group_id if context is not None else None
            category_id = get_data_category_id("DB Notebook Code History", be_session)
            folder_id = sql_editor_backend.get_folder_id(db, connection_id, group_id, profile_id)

            history_entries = list_data(folder_id, category_id, be_session)
            if language_id != "":
                history_entries = [entry for entry in history_entries if entry['caption'] == language_id]
            history_entries.sort(key=lambda x: x['last_update'], reverse=True)
            for entry in history_entries:
                result = db.select("""SELECT content FROM data WHERE id = ?""", (entry['id'],))
                try:
                    content = json.loads(result[0]['content'])
                    if truncate_code_length != -1:
                        content = content[:truncate_code_length]
                except Exception as e:
                    raise MSGException(Error.CORE_INVALID_DATA_FORMAT,
                                       f'Error decoding data content: {str(e)}') from e
                list_of_history_entries.append({"code": content,
                                                "language_id": entry['caption'],
                                                "current_timestamp": entry['last_update']})

            return list_of_history_entries


@plugin_function('gui.sqlEditor.removeExecutionHistoryEntry', shell=False, web=True)
def remove_execution_history_entry(connection_id, index=-1, profile_id=None, be_session=None):
    """Removes the execution_history entry with the given index

    If -1 is passed as index, the whole execution_history list for this connection_id is cleared.

    Args:
        connection_id (int): The id of the db_connection
        index (int): The index of the history entry to return
        profile_id (int): The id of profile
        be_session (object):  A session to the GUI backend database
            where the operation will be performed.

    Returns:
        None
    """

    with BackendDatabase(be_session) as db:
        context = get_context()
        group_id = context.web_handler.user_personal_group_id if context is not None else None
        category_id = get_data_category_id("DB Notebook Code History", be_session)
        folder_id = sql_editor_backend.get_folder_id(db, connection_id, group_id, profile_id)

        history_entries = list_data(folder_id, category_id, be_session)
        history_entries.sort(key=lambda x: x['last_update'], reverse=True)

        if index >= len(history_entries):
            raise MSGException(Error.CORE_INVALID_PARAMETER,
                           "Parameter 'index' is out of range.")

        if index == -1:
            for entry in history_entries:
                delete_data(entry['id'], folder_id, be_session)
        else:
            delete_data(history_entries[index]['id'], folder_id, be_session)
