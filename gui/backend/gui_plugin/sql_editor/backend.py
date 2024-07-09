# Copyright (c) 2024, Oracle and/or its affiliates.
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
from gui_plugin.core import Error
from gui_plugin.core.Error import MSGException
from ..modules import backend as modules_backend

def get_folder_id(db, connection_id, group_id, profile_id=None):
    """Returns the folder ID for the given connection ID

    Args:
        db (object): The database object
        connection_id (int): The connection ID
        group_id (int): The group ID
        profile_id (int): The profile ID

    Returns:
        int: The folder ID
    """
    tree_identifier = "DBNotebookCodeHistoryTree"
    folder_name = f"db_notebook_code_history_{connection_id}"
    if profile_id is None:
        root_folder_id = modules_backend.get_root_folder_id(
                                        db, tree_identifier, 'group', group_id)
    else:
        root_folder_id = modules_backend.get_root_folder_id(
                                        db, tree_identifier, 'profile', profile_id)

    return modules_backend.get_folder_id(
                            db, root_folder_id, folder_name)


def get_entry(db, entry_id):
    """Returns the entry for the given entry ID

    Args:
        db (object): The database object
        entry_id (int): The entry ID

    Returns:
        dict: The entry info
    """
    rows = db.select("""SELECT caption, content, last_update FROM data
                             WHERE id = ?""",
                             (entry_id,))
    if rows:
        row = rows[0]
        try:
            content = json.loads(row['content'])
        except Exception as e:
            raise MSGException(Error.CORE_INVALID_DATA_FORMAT,
                                f'Error decoding data content: {str(e)}') from e
        return {"code": content,
                "language_id": row['caption'],
                "current_timestamp": row['last_update']}

    return {}