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

import hashlib
import os
import json
from gui_plugin.core.Error import MSGException
import gui_plugin.core.Error as Error
import secrets

ALL_USERS_GROUP_ID = 1
LOCAL_USERNAME = "LocalAdministrator"


def create_group(db, name, description):
    """Returns the ID of the created user_group.

    Args:
        db (object): The db object
        name (str): Group name
        description (str): Description of the group

    Returns:
        Value of ID created user_group
    """

    db.execute('''INSERT INTO user_group(name, description)
                    VALUES(?, ?)''',
               (name, description))

    return db.get_last_row_id()


def add_user_to_group(db, user_id, group_id, owner=None):
    """Returns the ID of the created record.

    Args:
        db (object): The db object
        user_id (int): User ID
        group_id (int): Group ID
        owner (int): If user is owner

    Returns:
        Value of ID created record
    """

    db.execute('''INSERT INTO user_group_has_user(user_group_id, user_id, owner)
                    VALUES(?, ?, ?)''',
               (group_id, user_id, owner))

    return db.get_last_row_id()


def add_user_role(db, user_id, role):
    """Returns the ID of the created record.

    Args:
        db (object): The db object
        user_id (int): User ID
        role (string): Role Name

    Returns:
        Value of ID created record
    """
    res = db.execute(
        "SELECT id FROM role WHERE name = ?", (role,)).fetch_one()

    if not res:
        raise MSGException(Error.USER_INVALID_ROLE,
                           f"There is no role with the name '{role}'.")
    else:
        role_id = res[0]

    db.execute('''INSERT INTO user_has_role(user_id, role_id)
                    VALUES(?, ?)''',
               (user_id, role_id))

    return db.get_last_row_id()


def create_user(db, username, password, role=None, allowed_hosts=None):
    """Creates a new user account

    Args:
        db (object): The db object
        username (str): The name of the user
        password (str): The user's password
        allowed_hosts (str): Allowed hosts that user can connect from, optional

    Returns:
        Returns the ID of the created user account.
    """

    search = db.select("SELECT * FROM user WHERE name = ?", (username, ))

    if len(search) > 0:
        raise MSGException(Error.USER_CREATE, "User already exists.")

    salt = os.urandom(32).hex()

    password_hash = hashlib.pbkdf2_hmac(
        'sha256', password.encode(), salt.encode(), 100000).hex()

    if allowed_hosts:
        db.execute("INSERT INTO user(name, password_hash, allowed_hosts) "
                   "VALUES(?, ?, ?)",
                   (username, password_hash + salt, allowed_hosts))
    else:
        db.execute("INSERT INTO user(name, password_hash) "
                   "VALUES(?, ?)",
                   (username, password_hash + salt))

    user_id = db.get_last_row_id()

    # if a role was given, add role to user
    if role:
        # perform the many-to-many insert
        add_user_role(db, user_id, role)

    group_id = create_group(db, username, f"{username} default group")
    add_user_to_group(db, user_id, group_id, owner=True)

    add_user_to_group(db, user_id, ALL_USERS_GROUP_ID)

    return user_id


def get_user_id(db, username):
    """Gets the id for a given user.

    Args:
        db (object): The db object
        username (str): The user for which the id will be returned.

    Returns:
        The id associated to the given user or None.
    """

    res = db.execute("""SELECT id FROM user
                            WHERE upper(name) = upper(?)""",
                     (username,)).fetch_one()

    if res is None:
        raise MSGException(Error.USER_INVALID_USER,
                           f"There is no user with the name '{username}'.")

    return res[0]


def list_users(db):
    return db.select("SELECT name FROM user")


def add_profile(db, user_id, profile):
    """Returns the specified profile.

    Args:
        db (object): The db object
        user_id (int): The id of the user.
        profile (dict): The profile to add
    """
    db.execute('''INSERT INTO profile(user_id, name,
        description, options) VALUES(?, ?, ?, ?)''',
               (user_id, profile.get('name', 'New Profile'),
                profile.get('description', ''),
                json.dumps(profile.get('options', {}))))

    return db.get_last_row_id()


def set_default_profile(db, user_id, profile_id):
    """Sets the default profile for the given user.

    Args:
        db (object): The db object
        user_id (int): The id of the user.
        profile_id (int): The id of the profile to become the default profile
    """
    db.execute('''UPDATE user SET default_profile_id = ?
            WHERE id = ?''',
               (profile_id, user_id,))


def get_profile(db, profile_id):
    """Returns the specified profile.

    Args:
        db (object): The db object
        profile_id (int): The id of the profile.

    Returns:
        The record for the given profile
    """
    if profile_id is None or profile_id <= 0:
        raise MSGException(Error.CORE_INVALID_PARAMETER, "Invalid profile id.")

    result = db.select('''SELECT id, user_id, name, description, options FROM profile
        WHERE id = ?''', (profile_id,))

    if not result:
        raise MSGException(Error.USER_INVALID_PROFILE,
                           "The profile does not exist.")

    return result[0]


def get_default_profile(db, user_id):
    """Returns the default profile for the given user.

    Args:
        db (object): The db object
        user_id (int): The id of the user.

    Returns:
        The default profile id if found, else None
    """
    user_row = db.execute(
        "SELECT default_profile_id FROM user WHERE id = ?",
        (user_id,)).fetch_one()

    if not user_row:
        raise MSGException(Error.USER_INVALID_USER,
                           f"There is no user with the given id.")

    profile_id = user_row[0]
    if profile_id is None:
        profile_id = add_profile(
            db, user_id, {'name': 'Default', 'description': 'Default Profile'})

        set_default_profile(db, user_id, profile_id)

    return get_profile(db, profile_id)


def get_default_group_id(db, user_id):
    """Returns the default group for the given user.

    Args:
        db (object): The db object
        user_id (int): The id of the user.

    Returns:
        The default group id
    """
    row = db.execute(
        "SELECT user_group_id FROM user_group_has_user WHERE user_id = ? and owner = 1",
        (user_id,)).fetch_one()

    if not row:
        raise MSGException(Error.USER_INVALID_USER,
                           f"There is no default group for user with the given id.")

    return row[0]


def delete_profile(db, user_id, profile_id):
    """Deletes a profile for the given user.

    Args:
        db (object): The db object
        user_id (int): The id of the user.
        profile_id (int): The id of the profile to delete.

    Returns:
        True if the record was deleted, False otherwise
    """
    db.execute('''DELETE FROM profile
                  WHERE user_id=? and id=?''',
               (user_id, profile_id))

    return not db.rows_affected == 0


def get_user_groups(db, user_id=None):
    """Retrieves the existing user groups,
       if member_is is provided returns
       only the groups associated to the user_id

    Args:
        db (object): The db object
        user_id (int): User ID

    Returns:
        The user groups
    """
    sql = '''SELECT id, name, description
             FROM user_group ug '''
    if user_id is not None:
        sql += '''JOIN user_group_has_user ughu ON ughu.user_group_id = ug.id
                  WHERE ughu.user_id=?'''

    args = (user_id,) if user_id is not None else None
    return db.select(sql, args)


def get_id_personal_user_group(db, user_id):
    """Gets the id for a given user.

    Args:
        db (object): The db object
        user_id (id): The user for which the id will be returned.

    Returns:
        The id associated to the given user.
    """
    try:
        group_id = None
        res = db.execute("""SELECT ug.id
                            FROM user u,
                                    user_group ug,
                                    user_group_has_user ughu
                            WHERE u.id = ughu.user_id
                            AND   ughu.user_group_id = ug.id
                            AND   u.name = ug.name
                            AND   u.id=?;""", (user_id,)).fetch_one()
        if not res:
            raise MSGException(Error.USER_MISSING_DEFAULT_GROUP,
                               f"There is no personal group for the user '{user_id}'.")
        else:
            group_id = res[0]

    except Exception as e:
        raise e

    return group_id


def remove_user_from_group(db, user_id, group_id):
    """Removes user from user group.

    Args:
        db (object): The db object
        user_id (int): User ID
        group_id (int): Group ID

    Returns:
        A boolean value indicating whether the given user was removed from the given group
    """
    default_user_group_id = get_default_group_id(db, user_id)
    if default_user_group_id == group_id:
        raise MSGException(Error.USER_INVALID_GROUP,
                           "Unable to delete user from personal group.")

    db.execute("""DELETE FROM user_group_has_user
                  WHERE user_id = ? AND user_group_id=?""",
               (user_id, group_id,))


def update_user_group(db, group_id, name=None, description=None):
    """Updates user group.

    Args:
        db (object): The db object
        group_id (int): Group ID
        name (str): Group name
        description (str): Description of the group

    Returns:
        A boolean value indicating whether the record was updated or not.
    """
    actions = []
    args = tuple()

    if name:
        actions.append("name=?")
        args += (name,)
    if description:
        actions.append("description=?")
        args += (description,)

    db.execute(f"""UPDATE user_group SET {",".join(actions)}
                WHERE id=?""", args + (group_id,))


def group_can_be_deleted(db, group_id):
    """Checks if user group is associated with data user group tree
       or any user is associated to it.

    Args:
        db (object): The db object
        group_id (int): Group ID

    Returns:
        A boolean value indicating whether the group can be deleted
        because no data group tree is associated to it
        and no user is associated to it.
    """
    res = db.execute("""SELECT user_group_id
                        FROM user_group_has_user
                        WHERE user_group_id=?
                        LIMIT 1""", (group_id,)).fetch_one()

    if res:
        return (False, "Can't delete user group that contains users.")

    res = db.execute("""SELECT user_group_id
                        FROM data_user_group_tree
                        WHERE user_group_id=?
                        LIMIT 1""", (group_id,)).fetch_one()

    if res:
        return (False, "Can't delete user group associated with data user group tree.")

    return (True, "")


def remove_user_group(db, group_id):
    """Removes given user group.

    Args:
        db (object): The db object
        group_id (int): Group ID

    Returns:
        A boolean value indicating whether the record was deleted or not.
    """
    value, reason = group_can_be_deleted(db, group_id)
    if not value:
        raise MSGException(Error.USER_CANT_DELETE_GROUP, reason)

    db.execute("""DELETE FROM user_group WHERE id=?""",
               (group_id,))

def create_local_user(db):
    try:
        get_user_id(db, LOCAL_USERNAME)
    except MSGException as e:
        if e.code == Error.USER_INVALID_USER:
            create_user(db, LOCAL_USERNAME, secrets.token_hex(
                32), "Administrator", "localhost")
