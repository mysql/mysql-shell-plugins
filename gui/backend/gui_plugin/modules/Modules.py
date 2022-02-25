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
import datetime
from gui_plugin.core.Db import BackendDatabase, BackendTransaction
from gui_plugin.core.Protocols import Response
from . import backend
from gui_plugin.core.Error import MSGException
import gui_plugin.core.Error as Error
from json.decoder import JSONDecodeError


@plugin_function('gui.modules.addData', shell=False, web=True)
def add_data(caption, content, data_category_id, tree_identifier, folder_path=None, profile_id=None, web_session=None):
    """Creates a new Module Data record for the given module
       and associates it to the active user profile and personal user group.

    Args:
        caption (str): The data caption
        content (str): The content of data module
        data_category_id (int): The id of data category
        tree_identifier (str): The identifier of the tree
        folder_path (str): The folder path f.e. "/scripts/server1"
        profile_id (int): The id of profile
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically

    Returns:
        The id of the new record.
    """

    if caption.strip() == "":
        raise MSGException(Error.CORE_INVALID_PARAMETER, f"Parameter 'caption' cannot be empty.")

    if tree_identifier.strip() == "":
        raise MSGException(Error.CORE_INVALID_PARAMETER, f"Parameter 'tree_identifier' cannot be empty.")

    if folder_path.strip() == "" or folder_path.strip() == "/":
        folder_path = None

    with BackendDatabase(web_session) as db:
        with BackendTransaction(db):
            db.execute('''INSERT INTO data (data_category_id, caption,
                            content, created, last_update)
                            VALUES(?, ?, ?, ?, ?)''',
                       (data_category_id,
                        caption,
                        json.dumps(content),
                        datetime.datetime.now(),
                        datetime.datetime.now()))

            id = db.get_last_row_id()

            backend.add_data_associations(db,
                                          id,
                                          tree_identifier,
                                          folder_path,
                                          profile_id if profile_id else web_session.session_active_profile_id,
                                          web_session.user_personal_group_id)

            return id


@plugin_function('gui.modules.listData', shell=False, web=True)
def list_data(folder_id, data_category_id=None, web_session=None):
    """Get list of data

    Args:
        folder_id (int): The id of the folder
        data_category_id (int): The id of data category
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically

    Returns:
        The list of the data.
    """

    with BackendDatabase(web_session) as db:
        sql = """SELECT d.id, d.data_category_id, d.caption, d.created, d.last_update
                 FROM data d
                 JOIN data_folder_has_data dfhd ON dfhd.data_id=d.id
                    WHERE dfhd.data_folder_id=?"""
        args = (folder_id,)
        if data_category_id:
            CATEGORIES_SQL = """WITH RECURSIVE
                                categories(id) AS (
                                    SELECT id FROM data_category
                                        WHERE id=?
                                    UNION ALL
                                    SELECT dc.id
                                        FROM categories c
                                        JOIN data_category dc ON c.id=dc.parent_category_id
                                )
                                SELECT DISTINCT id FROM categories"""
            sql += f" AND d.data_category_id in ({CATEGORIES_SQL})"
            args += (data_category_id,)
        res = db.select(sql, args)

        return res["rows"] if res else []


@plugin_function('gui.modules.getDataContent', shell=False, web=True)
def get_data_content(id, web_session=None):
    """Gets content for the given module

    Args:
        id (int): The id of the data
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically


    Returns:
        The content of the data.
    """
    with BackendDatabase(web_session) as db:
        res = db.execute('''SELECT content
                            FROM data
                            WHERE id=?''',
                            (id,)).fetch_one()
        # First we nee to make sure that data content exists for given module id,
        # then we can check if user have privileges for it.
        if res is None:
            raise MSGException(Error.MODULES_INVALID_MODULE_ID,
                                f"There is no data for the given module id: {id}.")

        # If user have any privileges either assigned to user group or profile
        # he can see data content, otherwise Exception will be raised
        backend.get_user_privileges_for_data(db, id, web_session.user_id)

        try:
            content = json.loads(res['content'])
        except Exception as e:
            raise MSGException(Error.CORE_INVALID_DATA_FORMAT,
                                f"Error decoding data content: {str(e)}")

        return content


@plugin_function('gui.modules.shareDataToUserGroup', shell=False, web=True)
def share_data_to_user_group(id, user_group_id, read_only, tree_identifier, folder_path=None, web_session=None):
    """Shares data to user group

    Args:
        id (int): The id of the data
        user_group_id (int): The id of user group
        read_only (int): The flag that specifies whether the data is read only
        tree_identifier (str): The identifier of the tree
        folder_path (str): The folder path f.e. "/scripts/server1"
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically


    Returns:
        The id of the folder to which the data was shared.
    """

    if tree_identifier.strip() == "":
        raise MSGException(Error.CORE_INVALID_PARAMETER, f"Parameter 'tree_identifier' cannot be empty.")

    if folder_path.strip() == "" or folder_path.strip() == "/":
        folder_path = None

    with BackendDatabase(web_session) as db:
        with BackendTransaction(db):
            privileges = backend.get_user_privileges_for_data(db, id, web_session.user_id)
            max_privilege = min([p['read_only'] for p in privileges])
            if max_privilege <= read_only:
                user_group_root_folder_id = backend.get_root_folder_id(db, tree_identifier, 'group', user_group_id)

                if user_group_root_folder_id is None:
                    user_group_root_folder_id = backend.create_user_group_data_tree(db, tree_identifier, user_group_id)

                if folder_path:
                    folder_user_group_id, _ = backend.create_folder(db, folder_path, user_group_root_folder_id)
                else:
                    folder_user_group_id = user_group_root_folder_id

                backend.add_data_to_folder(db, id, folder_user_group_id, read_only)
            else:
                raise MSGException(Error.MODULES_SHARING_WITH_HIGHER_PERMISSIONS, "Cannot share data with higher permission than user has.")

            return folder_user_group_id


@plugin_function('gui.modules.addDataToProfile', shell=False, web=True)
def add_data_to_profile(id, profile_id, read_only, tree_identifier, folder_path=None, web_session=None):
    """Shares data to user group

    Args:
        id (int): The id of the data
        profile_id (int): The id of profile
        read_only (int): The flag that specifies whether the data is read only
        tree_identifier (str): The identifier of the tree
        folder_path (str): The folder path f.e. "/scripts/server1"
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically


    Returns:
        The id of the folder to which the data was shared.
    """

    if tree_identifier.strip() == "":
        raise MSGException(Error.CORE_INVALID_PARAMETER, f"Parameter 'tree_identifier' cannot be empty.")

    if folder_path.strip() == "" or folder_path.strip() == "/":
        folder_path = None

    with BackendDatabase(web_session) as db:
        with BackendTransaction(db):
            privileges = backend.get_user_privileges_for_data(db, id, web_session.user_id)
            max_privilege = min([p['read_only'] for p in privileges])
            # We check if the user is owner of given profile
            if backend.get_profile_owner(db, profile_id) == web_session.user_id:
                if max_privilege <= read_only:
                    profile_root_folder_id = backend.get_root_folder_id(db, tree_identifier, 'profile', profile_id)

                    if profile_root_folder_id is None:
                        profile_root_folder_id = backend.create_profile_data_tree(db, tree_identifier, profile_id)

                    if folder_path:
                        folder_profile_id, _ = backend.create_folder(db, folder_path, profile_root_folder_id)
                    else:
                        folder_profile_id = profile_root_folder_id

                    backend.add_data_to_folder(db, id, folder_profile_id, read_only)
                else:
                    raise MSGException(Error.MODULES_SHARING_WITH_HIGHER_PERMISSIONS, "Cannot assign data to profile with higher permission than user has.")
            else:
                raise MSGException(Error.MODULES_USER_HAVE_NO_PRIVILEGES, "User have no privileges to perform operation.")

            return folder_profile_id


@plugin_function('gui.modules.updateData', shell=False, web=True)
def update_data(id, caption=None, content=None, web_session=None):
    """Update data at the given module

    Args:
        id (int): The id of the data
        caption (str): Caption
        content (str): The content data
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically

    Returns:
        The id of the updated record..
    """

    with BackendDatabase(web_session) as db:
        with BackendTransaction(db):
            privileges = backend.get_user_privileges_for_data(db, id, web_session.user_id)
            if any([p['read_only'] == 0 for p in privileges]):
                actions=[]
                args=tuple()

                if caption:
                    actions.append("caption=?")
                    args += (caption,)
                if content:
                    actions.append("content=?")
                    args += (json.dumps(content),)

                db.execute("UPDATE data SET " + ",".join(actions) +
                            " WHERE id=?", args + (id,))
            else:
                raise MSGException(Error.MODULES_USER_HAVE_NO_PRIVILEGES, "User have no privileges to perform operation.")

            return id


@plugin_function('gui.modules.deleteData', shell=False, web=True)
def delete_data(id, folder_id, web_session=None):
    """Deletes data

    Args:
        id (int): The id of the data
        folder_id (int): The id of the folder
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically

    Returns:
        The id of the deleted record.
    """

    with BackendDatabase(web_session) as db:
        with BackendTransaction(db):
            backend.get_user_privileges_for_data(db, id, web_session.user_id)

            return backend.delete_data(db, id, folder_id)


@plugin_function("gui.modules.listDataCategories", shell=False, web=True)
def list_data_categories(category_id=None, web_session=None):
    """Gets the list of available data categories and sub categories
       for the given name.

    Args:
        category_id (int): The id of the data category
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically


    Returns:
        The list of available data categories
    """
    with BackendDatabase(web_session) as db:
        if category_id is None:
            res = db.select("""SELECT id, name, parent_category_id
                            FROM data_category
                            WHERE parent_category_id is NULL""",())
        else:
            res = db.select("""WITH RECURSIVE
                                categories(id, name, parent_category_id) AS (
                                    SELECT id, name, parent_category_id FROM data_category
                                        WHERE id=?
                                    UNION ALL
                                    SELECT dc.id, dc.name, dc.parent_category_id
                                        FROM categories c
                                        JOIN data_category dc ON c.id=dc.parent_category_id
                                )
                                SELECT DISTINCT id, name, parent_category_id FROM categories""",
                                (category_id,))
            if not res["rows"]:
                raise MSGException(Error.MODULES_INVALID_DATA_CATEGORY, "Data category does not exist.")

        status = db.get_last_status()
        if status['type'] != "OK":
            raise MSGException(Error.DB_ERROR, status['msg'])

        return res["rows"] if res else []

@plugin_function("gui.modules.addDataCategory", shell=False, web=True)
def add_data_category(name, parent_category_id=None, web_session=None):
    """Add a new data category to the list of available data categories for this module

    Args:
        name (str): The name of the data category
        parent_category_id (int): The id of the parent category
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically


    Returns:
        The id of added category.
    """

    if name.strip() == "":
        raise MSGException(Error.CORE_INVALID_PARAMETER, f"Parameter 'name' cannot be empty.")

    with BackendDatabase(web_session) as db:
        search = db.execute("""SELECT id from data_category
                                WHERE name=?""",
                                (name,)).fetch_one()

        if search:
            raise MSGException(Error.MODULES_INVALID_DATA_CATEGORY, "Data category already exists.")
        else:
            res = db.execute("""SELECT MAX(id) FROM data_category""").fetch_one()
            # First 100 ids are reserved for predefined data categories
            id = res[0] + 1 if res[0] > 100 else 101
            db.execute("""INSERT INTO data_category (id, parent_category_id, name)
                            VALUES (?, ?, ?)""",
                            (id, parent_category_id, name, ))
            category_id = db.get_last_row_id()


        return category_id

@plugin_function("gui.modules.removeDataCategory", shell=False, web=True)
def remove_data_category(category_id, web_session=None):
    """Remove a data category from the list of available data categories for this module

    Args:
        category_id (int): The id of the data category
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically


    Returns:
        The id of the removed category.
    """
    if category_id <= 100:
        raise MSGException(Error.MODULES_CANT_DELETE_MODULE_CATEGORY, "Can't delete predefined data category.")

    with BackendDatabase(web_session) as db:
        res = db.execute("""SELECT data_category_id
                                FROM data
                                WHERE data_category_id=?
                            LIMIT 1""",
                            (category_id,)).fetch_all()
        if res:
            raise MSGException(Error.MODULES_CANT_DELETE_MODULE_CATEGORY, "Can't delete data category associated with data.")

        res = db.execute("""SELECT id
                                FROM data_category
                                WHERE parent_category_id=?
                            LIMIT 1""",
                            (category_id,)).fetch_all()
        if res:
            raise MSGException(Error.MODULES_CANT_DELETE_MODULE_CATEGORY, "Can't delete data category associated with sub categories.")

        db.execute("""DELETE FROM data_category
                      WHERE id=?""",
                      (category_id,)).fetch_one()

        if db.rows_affected == 0:
            raise MSGException(Error.MODULES_INVALID_DATA_CATEGORY, "Data category does not exist.")

        return category_id


@plugin_function("gui.modules.getDataCategoryId", shell=False, web=True)
def get_data_category_id(name, web_session=None):
    """Gets id for given name and module id.

    Args:
        name (str): The name of the data category
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically


    Returns:
        The id of the data category.
    """

    with BackendDatabase(web_session) as db:
        res = db.execute("""SELECT id
                            FROM data_category
                                WHERE name=?""",
                            (name,)).fetch_one()

        if not res:
            raise MSGException(Error.MODULES_INVALID_DATA_CATEGORY, "Data category does not exist.")

        return res['id']


@plugin_function("gui.modules.createProfileDataTree", shell=False, web=True)
def create_profile_data_tree(tree_identifier, profile_id=None, web_session=None):
    """Creates the profile data tree for the given tree identifier and profile id.

    Args:
        tree_identifier (str): The identifier of the tree
        profile_id (int): The id of profile
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically


    Returns:
        The id of the root folder.
    """

    if tree_identifier.strip() == "":
        raise MSGException(Error.CORE_INVALID_PARAMETER, f"Parameter 'tree_identifier' cannot be empty.")

    with BackendDatabase(web_session) as db:
        with BackendTransaction(db):
            root_folder_id = backend.create_profile_data_tree(db,
                                            tree_identifier,
                                            profile_id if profile_id else web_session.session_active_profile_id)

            return root_folder_id


@plugin_function("gui.modules.getProfileDataTree", shell=False, web=True)
def get_profile_data_tree(tree_identifier, profile_id=None, web_session=None):
    """Gets the profile data tree for the given tree identifier and profile id.

    Args:
        tree_identifier (str): The identifier of the tree
        profile_id (int): The id of profile
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically


    Returns:
        The list of all folders in data tree.
    """

    with BackendDatabase(web_session) as db:
        root_folder_id = backend.get_root_folder_id(db,
                                                tree_identifier,
                                                'profile',
                                                profile_id if profile_id else web_session.session_active_profile_id)

        res = db.select(backend.FOLDERS_TREE_SQL, (root_folder_id,))

        return res["rows"] if res else []


@plugin_function("gui.modules.createUserGroupDataTree", shell=False, web=True)
def create_user_group_data_tree(tree_identifier, user_group_id=None, web_session=None):
    """Creates the user group data tree for the given tree identifier and user group id.

    Args:
        tree_identifier (str): The identifier of the tree
        user_group_id (int): The id of user group
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically


    Returns:
        The id of the root folder.
    """

    if tree_identifier.strip() == "":
        raise MSGException(Error.CORE_INVALID_PARAMETER, f"Parameter 'tree_identifier' cannot be empty.")

    with BackendDatabase(web_session) as db:
        with BackendTransaction(db):
            root_folder_id = backend.create_user_group_data_tree(db,
                                            tree_identifier,
                                            user_group_id if user_group_id else web_session.user_personal_group_id)

            return root_folder_id


@plugin_function("gui.modules.getUserGroupDataTree", shell=False, web=True)
def get_user_group_data_tree(tree_identifier, user_group_id=None, web_session=None):
    """Gets the user group data tree for the given tree identifier and user group id.

    Args:
        tree_identifier (str): The identifier of the tree
        user_group_id (int): The id of user group
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically


    Returns:
        The list of all folders in data tree.
    """

    with BackendDatabase(web_session) as db:
        root_folder_id = backend.get_root_folder_id(db,
                                                tree_identifier,
                                                'group',
                                                user_group_id if user_group_id else web_session.user_personal_group_id)

        res = db.select(backend.FOLDERS_TREE_SQL, (root_folder_id,))

        return res["rows"] if res else []


@plugin_function("gui.modules.getProfileTreeIdentifiers", shell=False, web=True)
def get_profile_tree_identifiers(profile_id=None, web_session=None):
    """Gets the tree identifiers associated with the given profile.

    Args:
        profile_id (int): The id of profile
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically


    Returns:
        The list of tree identifiers.
    """

    with BackendDatabase(web_session) as db:
        res = db.select("""SELECT tree_identifier
                           FROM data_profile_tree
                           WHERE profile_id=?""",
                           (profile_id if profile_id else web_session.session_active_profile_id,))

        return res["rows"] if res else []


@plugin_function("gui.modules.moveData", shell=False, web=True)
def move_data(id, tree_identifier, linked_to, link_id, source_path, target_path, web_session=None):
    """Moves data from source path to target path.

    Args:
        id (int): The id of the data
        tree_identifier (str): The identifier of the tree
        linked_to (str): ['profile'|'group']
        link_id (int): The profile id or the group id (depending on linked_to)
        source_path (str): The source folder path f.e. "/scripts/server1"
        target_path (str): The target folder path f.e. "/scripts/server2"
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically

    Returns:
        The id of the moved record.
    """
    if linked_to not in ['profile', 'group']:
        raise MSGException(Error.CORE_INVALID_PARAMETER, f"Parameter 'linked_to' can only take value 'profile' or 'group'.")

    if tree_identifier.strip() == "":
        raise MSGException(Error.CORE_INVALID_PARAMETER, f"Parameter 'tree_identifier' cannot be empty.")

    if source_path.strip() == "" or source_path.strip() == "/":
        source_path = None

    if target_path.strip() == "" or target_path.strip() == "/":
        target_path = None

    if source_path == target_path:
        raise MSGException(Error.CORE_INVALID_PARAMETER, f"Parameters 'source_path' and 'target_path' are the same.")

    with BackendDatabase(web_session) as db:
        with BackendTransaction(db):
            root_folder_id = backend.get_root_folder_id(db, tree_identifier, linked_to, link_id)

            if root_folder_id is None:
                raise MSGException(Error.CORE_INVALID_PARAMETER, f"Cannot find root folder id for the given 'tree_identifier'.")

            source_folder_id = backend.get_folder_id(db, root_folder_id, source_path)
            if source_folder_id is None:
                raise MSGException(Error.CORE_INVALID_PARAMETER, f"Cannot find the given 'source_path'.")
            target_folder_id = backend.get_folder_id(db, root_folder_id, target_path)

            if target_folder_id is None:
                target_folder_id, _ = backend.create_folder(db, target_path, root_folder_id)

            backend.add_data_to_folder(db, id, target_folder_id, read_only=0)

            return backend.delete_data(db, id, source_folder_id)
