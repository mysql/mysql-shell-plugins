# Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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


def get_next_connection_index(db, profile_id, folder_path_id):
    """Finds next connection index

    Args:
        db (object): The db object
        profile_id (int): The id of the profile
        folder_path_id (int): The id of the folder path used for grouping and nesting connections

    Returns:
        Next connection index value
    """
    res = db.execute('''SELECT MAX(max_index) AS max_index
                        FROM (
                            SELECT MAX(`index`) AS max_index
                                FROM profile_has_db_connection
                                WHERE profile_id=? AND folder_path_id=?
                            UNION ALL
                            SELECT MAX(`index`) AS max_index
                                FROM folder_path
                                WHERE parent_folder_id=?
                        ) AS combined_max_index;''', (profile_id, folder_path_id, folder_path_id)).fetchone()

    return res[0] + 1 if res[0] is not None else 1

def get_connection_index(db, profile_id, folder_id, connection_id):
    """Finds connection index in folder

    Args:
        db (object): The db object
        profile_id (int): The id of the profile
        folder_id (int): The folder id used for grouping and nesting connections
        connection_id (int): The id of the connection

    Returns:
        Connection index value
    """
    res = db.execute('''SELECT `index`
                        FROM profile_has_db_connection
                        WHERE profile_id=? and folder_path_id=? and db_connection_id=?''',
                    (profile_id, folder_id, connection_id)).fetch_one()
    return res[0]

def folder_exists(db, caption, parent_folder_id):
    """Checks if folder path exists

    Args:
        db (object): The db object
        caption (str): The caption of the folder
        parent_folder_id (int): The parent folder id

    Returns:
        The id of the folder or None
    """
    res = db.execute('''SELECT id
                        FROM folder_path
                        WHERE caption=? AND parent_folder_id=?''',
                    (caption, parent_folder_id)).fetch_one()
    return res[0] if res else None

