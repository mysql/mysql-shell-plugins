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

from gui_plugin.core.Error import MSGException
import gui_plugin.core.Error as Error


FOLDERS_TREE_SQL = """WITH RECURSIVE
                      folders(id, caption, parent_folder_id) AS (
                        SELECT id, caption, parent_folder_id FROM data_folder
                            WHERE id=?
                        UNION ALL
                        SELECT df.id, df.caption, df.parent_folder_id
                            FROM folders f
                            JOIN data_folder df ON f.id=df.parent_folder_id
                      )
                      SELECT DISTINCT id, caption, parent_folder_id FROM folders"""


def create_folder(db, caption, parent_folder_id=None):
    """Creates folder structures for given path.

    Args:
        db (object): The db object
        caption (str): The caption of the folder
        parent_folder_id (int): The id of the parent folder

    Returns:
        The id of created folder.
    """
    root_folder_id = None
    folder_id = None
    # We have to determine if this is caption or path
    if not caption.startswith("/"):
        db.execute("""INSERT INTO data_folder (caption, parent_folder_id)
                    VALUES(?, ?)""", (caption, parent_folder_id,))
        folder_id = db.get_last_row_id()
        if root_folder_id is None:
            root_folder_id = folder_id
    else:
        parent_id = parent_folder_id
        for folder in caption.split("/")[1:]:
            parent_id, root_folder_id = create_folder(db, folder, parent_id)
        folder_id = parent_id

    return (folder_id, root_folder_id)


def add_data_to_folder(db, data_id, folder_id, read_only):
    """Inserts a new record into the data_folder_has_data table.

    Args:
        db (object): The db object
        data_id (int): The id of the data
        folder_id (int): The id of the folder path
        read_only (int): The flag that specifies whether the data is read only

    Returns:
        None
    """

    db.execute("""INSERT INTO data_folder_has_data
                                (data_id, data_folder_id, read_only)
                    VALUES(?, ?, ?)""", (
        data_id, folder_id, read_only))


def get_user_privileges_for_data(db, data_id, user_id):
    """Get privileges to data for the given user.

        Args:
            db (object): The db object
            data_id (int): The id of the data
            user_id (int): The id of the user

        Returns:
            List of all privileges that user have to data_id.
    """

    privilege_list = []

    ROOT_FOLDERS_SQL = """WITH RECURSIVE
                            path(id, parent_folder_id) AS (
                                SELECT id, parent_folder_id FROM data_folder
                                    WHERE id=?
                                UNION ALL
                                SELECT df.id, df.parent_folder_id
                                    FROM path p
                                    JOIN data_folder df ON df.id=p.parent_folder_id
                            )
                        SELECT DISTINCT id, ?
                        FROM path
                            WHERE parent_folder_id is NULL;"""

    db.execute(
        """CREATE TEMP TABLE root_folders(folder_id INTEGER, read_only TINYINT)""", ())
    res = db.execute("""SELECT data_folder_id, read_only
                        FROM data_folder_has_data
                            WHERE data_id=?;""",
                     (data_id,)).fetch_all()

    for r in res:
        sql = f"""INSERT INTO temp.root_folders {ROOT_FOLDERS_SQL}"""
        db.execute(sql, (r['data_folder_id'], r['read_only']))

    res = db.execute("""SELECT p.id, rf.read_only
                        FROM profile p
                        JOIN data_profile_tree dpf ON dpf.profile_id = p.id
                        JOIN root_folders rf ON rf.folder_id = dpf.root_folder_id
                            WHERE p.user_id = ?;""",
                     (user_id,)).fetch_all()

    for row in res:
        privilege_list.append({"type": "PROFILE",
                               "id": row['id'],
                               "read_only": row['read_only']})

    res = db.execute("""SELECT ug.id, rf.read_only
                        FROM user_group_has_user ughu
                        JOIN user_group ug ON ughu.user_group_id = ug.id
                        JOIN data_user_group_tree dugt ON dugt.user_group_id = ug.id
                        JOIN root_folders rf ON rf.folder_id = dugt.root_folder_id
                            WHERE ughu.user_id = ?;""",
                     (user_id,)).fetch_all()
    for row in res:
        privilege_list.append({"type": "GROUP",
                               "id": row['id'],
                               "read_only": row['read_only']})

    db.execute("""DROP TABLE temp.root_folders""", ())

    if not privilege_list:
        raise MSGException(Error.MODULES_NO_PRIVILEGES_FOUND_FOR_MODULE_DATA,
                           f"User have no privileges for data id '{data_id}'.")

    return privilege_list


def get_profile_owner(db, profile_id):
    """Get owner of the given profile.

        Args:
            db (object): The db object
            profile_id (int): The id of the profile

        Returns:
            The id of the user that owns the profile.
    """
    owner_id = None
    res = db.execute("""SELECT user_id
                        FROM profile
                        WHERE id = ?;""",
                     (profile_id,)).fetch_one()
    if res is None:
        raise MSGException(Error.MODULES_NO_PROFILE_FOUND,
                           f"The is no profile with id {profile_id}")
    else:
        owner_id = res[0]

    return owner_id


def get_root_folder_id(db, tree_identifier, linked_to, link_id):
    """Get id of the root folder for given data category and profile or user group

    Args:
        db (object): The db object
        tree_identifier (str): The identifier of the tree
        linked_to (str): ['profile'|'group']
        link_id (int): The profile id or the group id (depending on linked_to)

    Returns:
        The id of the root folder.
    """

    if linked_to not in ['profile', 'group']:
        raise MSGException(Error.CORE_INVALID_PARAMETER,
                           "Incorrect 'linked_to' value.")

    root_folder_id = None
    SQL_PROFILE = """SELECT root_folder_id
                     FROM data_profile_tree
                     WHERE profile_id=? AND tree_identifier=?"""
    SQL_USER_GROUP = """SELECT root_folder_id
                     FROM data_user_group_tree
                     WHERE user_group_id=? AND tree_identifier=?"""
    sql = SQL_PROFILE if linked_to == 'profile' else SQL_USER_GROUP
    res = db.execute(sql,
                     (link_id, tree_identifier)).fetch_one()
    if res:
        root_folder_id = res['root_folder_id']

    return root_folder_id


def add_data_associations(db, data_id, tree_identifier, folder_path, profile_id, user_group_id):
    """Creates associations to the active user profile
       and personal user group for the given data.

    Args:
        db (object): The db object
        data_id (int): The id of the data
        tree_identifier (str): The identifier of the tree
        folder_path (str): The folder path f.e. "/scripts/server1"
        profile_id (int): The id of profile
        user_group_id (int): The user group id

    Returns:
        None
    """

    profile_root_folder_id = get_root_folder_id(
        db, tree_identifier, 'profile', profile_id)
    user_group_root_folder_id = get_root_folder_id(
        db, tree_identifier, 'group', user_group_id)

    if profile_root_folder_id is None:
        profile_root_folder_id = create_profile_data_tree(
            db, tree_identifier, profile_id)

    if user_group_root_folder_id is None:
        user_group_root_folder_id = create_user_group_data_tree(
            db, tree_identifier, user_group_id)

    if folder_path:
        folder_profile_id = get_folder_id(
            db, profile_root_folder_id, folder_path)
        folder_user_group_id = get_folder_id(
            db, user_group_root_folder_id, folder_path)
        if folder_profile_id is None:
            folder_profile_id, _ = create_folder(
                db, folder_path, profile_root_folder_id)
        if folder_user_group_id is None:
            folder_user_group_id, _ = create_folder(
                db, folder_path, user_group_root_folder_id)
    else:
        folder_profile_id = profile_root_folder_id
        folder_user_group_id = user_group_root_folder_id

    add_data_to_folder(db, data_id, folder_profile_id, read_only=0)
    add_data_to_folder(db, data_id, folder_user_group_id, read_only=0)


def create_user_group_data_tree(db, tree_identifier, user_group_id):
    """Creates the user group data tree for the given tree identifier and profile_id.

    Args:
        db (object): The db object
        tree_identifier (str): The identifier of the tree
        user_group_id (int): The id of user group

    Returns:
        The id of the root folder
    """

    folder_id, _ = create_folder(db, tree_identifier)

    db.execute("""INSERT INTO data_user_group_tree
                  (user_group_id, root_folder_id, tree_identifier)
                  VALUES(?, ?, ?)""",
               (user_group_id, folder_id, tree_identifier))

    return folder_id


def create_profile_data_tree(db, tree_identifier, profile_id):
    """Creates the profile data tree for the given tree identifier and profile_id.

    Args:
        db (object): The db object
        tree_identifier (str): The identifier of the tree
        profile_id (int): The id of profile

    Returns:
        The id of the root folder
    """

    folder_id, _ = create_folder(db, tree_identifier)
    db.execute("""INSERT INTO data_profile_tree
                                (profile_id, root_folder_id, tree_identifier)
                  VALUES(?, ?, ?)""", (
        profile_id, folder_id, tree_identifier))

    return folder_id


def get_folder_id(db, root_folder_id, folder_path):
    """Gets the id of leaf folder in folder path for the given root_folder_id.

    Args:
        db (object): The db object
        root_folder_id (int): The id of root folder
        folder_path (str): The folder path f.e. "/scripts/server1"

    Returns:
        The id of the leaf folder in folder path
    """

    folder_id = None
    sql = f"""{FOLDERS_TREE_SQL} WHERE caption=?"""
    rows = db.execute(
        sql, (root_folder_id, folder_path.split("/")[-1])).fetch_all()
    if rows:
        for row in rows:
            res = db.execute("""WITH RECURSIVE
                                path(id, parent_folder_id, caption) AS (
                                    SELECT id, parent_folder_id, caption FROM data_folder
                                        WHERE id=?
                                    UNION ALL
                                    SELECT df.id, df.parent_folder_id, df.caption
                                        FROM path p
                                        JOIN data_folder df ON df.id=p.parent_folder_id
                                    )
                                SELECT DISTINCT caption FROM path;""",
                             (row['id'],)).fetch_all()
            if res:
                path = [r['caption'] for r in res][::-1][1:]
                if path == folder_path.split("/"):
                    folder_id = row['id']
                    break

    return folder_id


def delete_data(db, id, folder_id):
    """Deletes data

    Args:
        db (object): The db object
        id (int): The id of the data
        folder_id (int): The id of the folder

    Returns:
        The id of the deleted record.
    """
    db.execute("""DELETE FROM data_folder_has_data
                    WHERE data_id=? AND data_folder_id=?""",
               (id, folder_id,))

    if db.rows_affected == 0:
        raise MSGException(
            Error.DB_ERROR, "Cannot delete data from the given folder id.")

    res = db.execute("""SELECT data_id
                        FROM data_folder_has_data
                        WHERE data_id=?
                        LIMIT 1;""",
                     (id,)).fetch_all()
    if res is None:
        db.execute("""DELETE FROM data
                        WHERE id=?""",
                   (id,))

    return id
