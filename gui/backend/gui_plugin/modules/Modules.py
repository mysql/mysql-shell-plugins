# Copyright (c) 2020, 2021, Oracle and/or its affiliates.
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
            sql += " AND d.data_category_id=?"
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
            db.execute("""DELETE FROM data_folder_has_data
                            WHERE data_id=? AND data_folder_id=?""",
                          (id, folder_id,))

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

@plugin_function("gui.modules.listDataCategories", shell=False, web=True)
def list_data_categories(module_id, name=None, web_session=None):
    """Gets the list of available data categories for this module

    Args:
        module_id (str): The id of the module, e.g. 'gui.sqleditor'
        name (str): The name of the data category
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically


    Returns:
        The list of available data categories
    """
    with BackendDatabase(web_session) as db:
        if name:
            res = db.select("""WITH RECURSIVE
                                categories(id, name, parent_category_id) AS (
                                    SELECT id, name, parent_category_id FROM data_category
                                        WHERE name=? AND module_id=?
                                    UNION ALL
                                    SELECT dc.id, dc.name, dc.parent_category_id
                                        FROM categories c
                                        JOIN data_category dc ON c.id=dc.parent_category_id
                                )
                                SELECT DISTINCT id, name, parent_category_id FROM categories""",
                                (name, module_id))
        else:
            res = db.select("""SELECT id, name, parent_category_id
                               FROM data_category
                               WHERE parent_category_id is NULL""",())

        status = db.get_last_status()
        if status['type'] != "OK":
            raise MSGException(Error.DB_ERROR, status['msg'])

        return res["rows"] if res else []

@plugin_function("gui.modules.addDataCategory", shell=False, web=True)
def add_data_category(name, module_id, parent_category_id=None, web_session=None):
    """Add a new data category to the list of available data categories for this module

    Args:
        name (str): The name of the data category
        module_id (str): The id of the module, e.g. 'gui.sqleditor'
        parent_category_id (int): The id of the parent category
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically


    Returns:
        The id of added category.
    """
    if module_id is None:
        raise MSGException(Error.MODULES_INVALID_DATA_CATEGORY, "Unable add a global data category.")

    with BackendDatabase(web_session) as db:
        search = db.execute("""SELECT id, module_id from data_category
                                WHERE name=? AND (module_id IS NULL OR module_id=?)""",
                                (name, module_id)).fetch_one()

        if search:
            raise MSGException(Error.MODULES_INVALID_DATA_CATEGORY, "Data category already exists.")
        else:
            db.execute("""INSERT INTO data_category (parent_category_id, name, module_id)
                            VALUES (?, ?, ?)""",
                            (parent_category_id, name, module_id, ))
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
    with BackendDatabase(web_session) as db:
        res = db.execute("""SELECT data_category_id
                                FROM data
                                WHERE data_category_id=?
                            LIMIT 1""",
                            (category_id,)).fetch_all()
        if res:
            raise MSGException(Error.MODULES_CANT_DELETE_MODULE_CATEGORY, "Can't delete data category associated with data.")

        db.execute("""DELETE FROM data_category
                      WHERE id=?""",
                      (category_id,)).fetch_one()

        if db.rows_affected == 0:
            raise MSGException(Error.MODULES_INVALID_DATA_CATEGORY, "Data category does not exist.")

        return category_id


@plugin_function("gui.modules.getDataCategoryId", shell=False, web=True)
def get_data_category_id(name, module_id, web_session=None):
    """Gets id for given name and module id.

    Args:
        name (str): The name of the data category
        module_id (str): The id of the module, e.g. 'gui.sqleditor'
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically


    Returns:
        The id of the data category.
    """

    with BackendDatabase(web_session) as db:
        res = db.execute("""SELECT id
                            FROM data_category
                                WHERE name=? AND module_id=?""",
                            (name, module_id)).fetch_one()

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
