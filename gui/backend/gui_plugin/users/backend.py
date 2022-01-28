# Copyright (c) 2021, Oracle and/or its affiliates.
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
from gui_plugin.core.Protocols import Response

ALL_USERS_GROUP_ID = 1

def create_group(db, name, description):
    """Returns the ID of the created user_group.

    Args:
        db (object): The db object
        name (str): Group name
        description (str): Description of the group

    Returns:
        Value of ID created user_group
    """

    db.execute('''INSERT INTO user_group(name, description, active)
                    VALUES(?, ?, ?)''',
               (name, description, 1))

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

    db.execute('''INSERT INTO user_group_has_user(user_group_id, user_id, owner, active)
                    VALUES(?, ?, ?, ?)''',
               (group_id, user_id, owner, 1))

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

    if len(search['rows']) > 0:
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
                            WHERE upper(name) = upper(?)
                            AND active = 1""",
                     (username,)).fetch_one()

    if res is None:
        raise MSGException(Error.USER_INVALID_USER, f"There is no user with the name '{username}'.")

    return res[0]


def list_users(db):
    return db.select("SELECT name FROM user WHERE active=1")


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

    # TODO(someone): Not all the fields are to be returned, i.e. active
    # should not and we should review if user_id is required
    result = db.select('''SELECT * FROM profile
        WHERE id = ? AND active = 1''', (profile_id,))

    if not result:
        raise MSGException(Error.USER_INVALID_PROFILE,
            "The profile does not exist.")

    return result['rows'][0]


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
        raise MSGException(Error.USER_INVALID_USER, f"There is no user with the given id.")

    profile_id = user_row[0]
    if profile_id is None:
        profile_id = add_profile(
            db, user_id, {'name': 'Default', 'description': 'Default Profile'})

        set_default_profile(db, user_id, profile_id)

    return get_profile(db, profile_id)

def enable_profile(db, user_id, profile_id, state):
    """Sets the 'active' flag of a profile

    Args:
        db (object): The db object
        user_id (int): The id of the user.
        profile_id (int): The id of the profile to update.
        state (bool): The state of the 'active' flag

    Returns:
        True if the record was updated, False otherwise
    """
    db.execute('''UPDATE profile SET active=?
        WHERE user_id=? and id=?''',
                (state, user_id, profile_id))

    return not db.rows_affected == 0

def get_user_groups(db):
    """Request for the active user groups

    Args:
        db (object): The db object


    Returns:
        The active user groups
    """
    return db.select('''SELECT id, name, description FROM user_group
                            WHERE active = 1''',
                     None)


def get_id_personal_user_group(db, user_id):
    """Gets the id for a given user.

    Args:
        user_id (id): The user for which the id will be returned.
        web_session (object): The webserver session object, optional. Will be
            passed in my the webserver automatically

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
            raise MSGException(Error.USER_INVALID_GROUP,
                f"There is no personal group for the user '{user_id}'.")
        else:
            group_id = res[0]

    except Exception as e:
        raise e

    return group_id