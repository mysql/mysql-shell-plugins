# Copyright (c) 2022, Oracle and/or its affiliates.
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


def get_next_connection_index(db, profile_id, folder_path):
    """Finds next connection index

    Args:
        db (object): The db object
        profile_id (int): The id of the profile
        folder_path (str): The folder path used for grouping and nesting connections

    Returns:
        Next connection index value
    """
    res = db.execute('''SELECT max(`index`)
                        FROM profile_has_db_connection
                        WHERE profile_id=? and folder_path=?''',
                    (profile_id, folder_path)).fetch_one()

    return res[0] + 1 if res[0] is not None else 1

def get_connection_folder_index(db, profile_id, folder_path, connection_id):
    """Finds connection index in folder

    Args:
        db (object): The db object
        profile_id (int): The id of the profile
        folder_path (str): The folder path used for grouping and nesting connections
        connection_id (int): The id of the connection

    Returns:
        Connection index value
    """
    res = db.execute('''SELECT `index`
                        FROM profile_has_db_connection
                        WHERE profile_id=? and folder_path=? and db_connection_id=?''',
                    (profile_id, folder_path, connection_id)).fetch_one()
    return res[0]