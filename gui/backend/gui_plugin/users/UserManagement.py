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

import re
import json
import mysqlsh
from gui_plugin.core.Db import BackendDatabase, BackendTransaction
from gui_plugin.core.Protocols import Response
from mysqlsh.plugin_manager import plugin_function  # pylint: disable=no-name-in-module
from . import backend
import gui_plugin.core.Error as Error
from gui_plugin.core.Error import MSGException


@plugin_function('gui.users.createUser', cli=True, web=True)
def create_user(username, password, role=None, allowed_hosts=None, web_session=None):
    """Creates a new user account

    Args:
        username (str): The name of the user
        password (str): The user's password
        role (str): The role that should be granted to the user, optional
        allowed_hosts (str): Allowed hosts that user can connect from
        web_session (object): The webserver session object, optional. Will be
            passed in by the webserver automatically

    Returns:
        The generated shell request record.
    """
    with BackendDatabase(web_session) as db:
        with BackendTransaction(db):
            user_id = backend.create_user(
                db, username, password, role, allowed_hosts)

            return Response.ok(
                "User created successfully.", {"id": user_id})


@plugin_function('gui.users.setAllowedHosts', web=True)
def set_allowed_hosts(user_id, allowed_hosts, web_session=None):
    """Sets the allowed hosts for the given user.

    Args:
        user_id (int): The id of the user.
        allowed_hosts (str): Allowed hosts that user can connect from
        web_session (object): The webserver session object, optional. Will be
            passed in by the webserver automatically

    Returns:
        The generated shell request record.
    """
    with BackendDatabase(web_session) as db:
        with BackendTransaction(db):
            db.execute('''UPDATE user SET allowed_hosts = ?
                WHERE id = ?''',
                       (allowed_hosts, user_id,))

    return Response.ok("Allowed hosts set successfully.")


@plugin_function('gui.users.deleteUser', cli=True, web=True)
def delete_user(username, web_session=None):
    """Deletes a user account

    Args:
        username (str):    The name of the user
        web_session (object): The webserver session object, optional.

    Returns:
        The generated shell request record.
    """
    with BackendDatabase(web_session) as db:
        user_id = backend.get_user_id(db, username)
        if not user_id:
            result = Response.error("User not exists.")
        else:
            with BackendTransaction(db):
                db.execute("DELETE FROM user WHERE name = ?", (username,))
                db.execute(
                    "DELETE FROM user_has_role WHERE user_id = ?", (user_id,))

            result = Response.ok("User deleted successfully.")

    return result


@plugin_function('gui.users.grantRole', web=True)
def grant_role(username, role, web_session=None):
    """Grant the given roles to the user.

    Args:
        username (str): The name of the user
        role (str): The list of roles that should be assigned to the
            user. Use listRoles() to list all available roles.
        web_session (object): The webserver session object, optional. Will be
            passed in by the webserver automatically

    Returns:
        The generated shell request record.
    """
    result = Response.ok("Role(s) successfully granted to user.")
    with BackendDatabase(web_session) as db:
        user_id = backend.get_user_id(db, username)
        if not user_id:
            raise MSGException(Error.USER_INVALID_ROLE,
                               f"There is no user with the name '{username}'.")

        # ensure roles is always a list
        roles = [role]

        # check for each role specified if that role actually exists in the db
        with BackendTransaction(db):
            for role in roles:
                res = db.execute(
                    "SELECT id FROM role WHERE name = ?", (role,)).fetch_one()
                if not res:
                    raise MSGException(Error.USER_INVALID_ROLE,
                                       f"There is no role with the name '{role}'.")
                else:
                    role_id = res[0]

                # perform the many-to-many insert
                db.execute("INSERT INTO user_has_role("
                           "user_id, role_id) "
                           "VALUES(?, ?)", (user_id, role_id))

    return result


@plugin_function('gui.users.getUserId', web=True)
def get_user_id(username, web_session=None):
    """Gets the id for a given user.

    Args:
        username (str): The user for which the id will be returned.
        web_session (object): The webserver session object, optional. Will be
            passed in by the webserver automatically

    Returns:
        The generated shell request record.
    """
    with BackendDatabase(web_session) as db:
        user_id = backend.get_user_id(db, username)

    return Response.ok("Successfully obtained user id.", {
        "id": user_id})


@plugin_function('gui.users.listUsers', cli=True, web=True)
def list_users(web_session=None):
    """Lists all user accounts.

    Args:
        web_session (object): The webserver session object, optional. Will be
            passed in by the webserver automatically

    Returns:
        The generated shell request record.
    """
    with BackendDatabase(web_session) as db:
        return backend.list_users(db)


@plugin_function('gui.users.listUserRoles', web=True)
def list_user_roles(username, web_session=None):
    """List the granted roles for a given user.

    Args:
        username (str): The name of the user
        web_session (object): The webserver session object, optional. Will be
            passed in by the webserver automatically

    Returns:
        The generated shell request record.
    """
    with BackendDatabase(web_session) as db:
        return db.select('''SELECT r.name, r.description
            FROM user u
                INNER JOIN user_has_role u_r
                    ON u.id = u_r.user_id
                INNER JOIN role r
                    ON u_r.role_id=r.id
            WHERE upper(u.name) = upper(?)''', (username,))


@plugin_function('gui.users.listRoles', web=True)
def list_roles(web_session=None):
    """Lists all roles that can be assigned to users.

    Args:
        web_session (object): The webserver session object, optional. Will be
            passed in by the webserver automatically

    Returns:
        The generated shell request record.
    """
    with BackendDatabase(web_session) as db:
        return db.select("SELECT name, description "
                         "FROM role")


@plugin_function('gui.users.listRolePrivileges', web=True)
def list_role_privileges(role, web_session=None):
    """Lists all privileges of a role.

    Args:
        role (str): The name of the role.
        web_session (object): The webserver session object, optional. Will be
            passed in by the webserver automatically

    Returns:
        The generated shell request record.
    """
    with BackendDatabase(web_session) as db:
        return db.select('''SELECT pt.name as type, p.name, p.access_pattern
            FROM privilege p
                INNER JOIN role_has_privilege r_p
                    ON p.id = r_p.privilege_id
                INNER JOIN privilege_type pt
                    ON p.privilege_type_id=pt.id
                INNER JOIN role r
                    ON r_p.role_id = r.id
            WHERE r.name = ?''', (role,))


@plugin_function('gui.users.listUserPrivileges', web=True)
def list_user_privileges(username, web_session=None):
    """Lists all privileges assigned to a user.

    Args:
        username (str): The name of the user.
        web_session (object): The webserver session object, optional. Will be
            passed in by the webserver automatically

    Returns:
        The generated shell request record.
    """
    with BackendDatabase(web_session) as db:
        return db.select('''SELECT r.name, pt.name, p.name, p.access_pattern
            FROM privilege p
                INNER JOIN role_has_privilege r_p
                    ON p.id = r_p.privilege_id
                INNER JOIN user_has_role u_r
                    ON r_p.role_id = u_r.role_id
                INNER JOIN privilege_type pt
                    ON p.privilege_type_id=pt.id
                INNER JOIN user u
                    ON u_r.user_id = u.id
                INNER JOIN role r
                    ON u_r.role_id = r.id
            WHERE upper(u.name) = upper(?)''', (username,))


@plugin_function('gui.users.getGuiModuleList', shell=False, web=True)
def get_gui_module_list(user_id, web_session=None):
    """Returns the list of modules for the given user.

    Args:
        user_id (int): The id of the user.
        web_session (object): The webserver session object, optional. Will be
            passed in by the webserver automatically

    Returns:
        The generated shell request record.
    """
    with BackendDatabase(web_session) as db:
        modules = []

        res = db.execute('''SELECT p.access_pattern
            FROM privilege p
                INNER JOIN role_has_privilege r_p
                    ON p.id = r_p.privilege_id
                INNER JOIN role r
                    ON r_p.role_id=r.id
                INNER JOIN user_has_role u_r
                    ON r.id = u_r.role_id
            WHERE u_r.user_id = ? AND p.privilege_type_id=2''',
                         (user_id,)).fetch_all()
        if not res:
            return {"result:": [], "status": {
                "type": "OK", "msg": "No privileges to any modules."}}

        patterns = []
        for pattern in res:
            patterns.append(re.compile(pattern[0]))

        # Only look at the gui extension object for now
        mod = getattr(mysqlsh.globals, "gui")
        obj_names = dir(mod)
        for obj_name in obj_names:
            for p in patterns:
                m = p.match(obj_name)
                if m:
                    obj = getattr(mod, obj_name)
                    func_names = dir(obj)
                    if "is_gui_module_backend" in func_names:
                        f = getattr(obj, "is_gui_module_backend")
                        if f():
                            modules.append(f"gui.{obj_name}")

        result = Response.ok("Module list gathered.", {"result": modules})

    return result


@plugin_function('gui.users.listProfiles', shell=False, web=True)
def list_profiles(user_id, web_session=None):
    """Returns the list of profile for the given user

    Args:
        user_id (int): The id of the user.
        web_session (object): The webserver session object, optional. Will be
            passed in by the webserver automatically

    Returns:
        The generated shell request record.
    """
    with BackendDatabase(web_session) as db:
        return db.select('''SELECT id, name FROM profile
            WHERE user_id = ?''', (user_id,))


@plugin_function('gui.users.getProfile', shell=False, web=True)
def get_profile(profile_id, web_session=None):
    """Returns the specified profile.

    Args:
        profile_id (int): The id of the profile.
        web_session (object): The webserver session object, optional. Will be
            passed in by the webserver automatically

    Returns:
        The generated shell request record.
    """
    with BackendDatabase(web_session) as db:
        profile = backend.get_profile(db, profile_id)

    result = Response.fromStatus(db.get_last_status(), {
        "result": profile})

    return result


@plugin_function('gui.users.updateProfile', shell=False, web=True)
def update_profile(profile, web_session=None):
    """Updates a user profile.

    Args:
        profile (dict): A dictionary with the profile information
        web_session (object): The webserver session object, optional. Will be
            passed in by the webserver automatically

    Allowed options for profile:
        id (int,required): The id of profile
        name (str,required): The profile name
        description (str,required): A longer description for profile
        options (dict,required): The options specific for the profile

    Returns:
        The generated shell request record.
    """
    with BackendDatabase(web_session) as db:
        options = profile.get('options', {})

        db.execute('''UPDATE profile SET
            name = ?,
            description = ?,
            options = ?
            WHERE id = ?''',
                   (profile.get('name'),
                    profile.get('description', ''),
                    None if options is None else json.dumps(options),
                    profile.get('id')))

    result = Response.fromStatus(db.get_last_status(), {
        "result": {"id": profile.get('id')}})

    return result


@plugin_function('gui.users.addProfile', shell=False, web=True)
def add_profile(user_id, profile, web_session=None):
    """Returns the specified profile.

    Args:
        user_id (int): The id of the user.
        profile (dict): The profile to add
        web_session (object): The webserver session object, optional. Will be
            passed in by the webserver automatically

    Allowed options for profile:
        name (str,required): The profile name
        description (str,required): A longer description for profile
        options (dict,required): The options specific for the profile

    Returns:
        The generated shell request record.
    """
    with BackendDatabase(web_session) as db:
        profile_id = backend.add_profile(db, user_id, profile)

    result = Response.fromStatus(db.get_last_status(), {
        "result": {"id": profile_id}})

    return result


@plugin_function('gui.users.deleteProfile', shell=False, web=True)
def delete_profile(user_id, profile_id, web_session=None):
    """Deletes a profile for the current user.

    Args:
        user_id (int): The id of the user to which the profile belongs to.
        profile_id (int): The ID of the profile to delete.
        web_session (object): The webserver session object, optional. Will be
            passed in by the webserver automatically

    Returns:
        The generated shell request record.
    """
    with BackendDatabase(web_session) as db:
        if not backend.delete_profile(db, user_id, profile_id):
            raise MSGException(Error.USER_DELETE_PROFILE,
                               f"Could not delete any profile with the supplied criteria.")

    result = Response.fromStatus(db.get_last_status())

    return result


@plugin_function('gui.users.getDefaultProfile', shell=False, web=True)
def get_default_profile(user_id, web_session=None):
    """Returns the default profile for the given user.

    Args:
        user_id (int): The id of the user.
        web_session (object): The webserver session object, optional. Will be
            passed in by the webserver automatically

    Returns:
        The generated shell request record.
    """
    with BackendDatabase(web_session) as db:
        # check if that user actually exists
        profile = backend.get_default_profile(db, user_id)

    result = Response.fromStatus(db.get_last_status(), {
        "result": profile})

    return result


@plugin_function('gui.users.setDefaultProfile', shell=False, web=True)
def set_default_profile(user_id, profile_id, web_session=None):
    """Sets the default profile for the given user.

    Args:
        user_id (int): The id of the user.
        profile_id (int): The id of the profile to become the default profile
        web_session (object): The webserver session object, optional. Will be
            passed in by the webserver automatically

    Returns:
        The generated shell request record.
    """
    with BackendDatabase(web_session) as db:
        with BackendTransaction(db):
            backend.set_default_profile(db, user_id, profile_id)

    result = Response.ok("Default profile set successfully.")

    return result


@plugin_function('gui.users.setCurrentProfile', shell=False, web=True)
def set_current_profile(profile_id, web_session):
    """Sets the profile of the user's current web session.

    Args:
        profile_id (int): The id of the profile to become the current profile
        web_session (object): The webserver session object, optional. Will be
            passed in by the webserver automatically

    Returns:
        The generated shell request record.
    """
    web_session.set_active_profile_id(profile_id)

    return Response.ok("Profile set successfully.")


@plugin_function('gui.users.listUserGroups', cli=True, web=True)
def list_user_groups(member_id=None, web_session=None):
    """Returns the list of all groups or list all groups that given user belongs.

    Args:
        member_id (int): User ID
        web_session (object): The webserver session object, optional. Will be
            passed in by the webserver automatically

    Returns:
        The generated shell request record.
    """
    with BackendDatabase(web_session) as db:
        return backend.get_user_groups(db, member_id)


@plugin_function('gui.users.createUserGroup', cli=True, web=True)
def create_user_group(name, description, web_session=None):
    """Creates user group.

    Args:
        name (str): Group name
        description (str): Description of the group
        web_session (object): The webserver session object, optional. Will be
            passed in by the webserver automatically

    Returns:
        The generated shell request record.
    """

    with BackendDatabase(web_session) as db:
        try:
            group_id = backend.create_group(db, name, description)

            result = Response.ok(
                "User group created successfully.", {"id": group_id})
        except Exception as e:
            result = Response.exception(e)

    return result

@plugin_function('gui.users.addUserToGroup', cli=True, web=True)
def add_user_to_group(member_id, group_id, owner=0, web_session=None):
    """Adds user to user group.

    Args:
        member_id (int): User ID
        group_id (int): Group ID
        owner (int): If user is owner
        web_session (object): The webserver session object, optional. Will be
            passed in by the webserver automatically

    Returns:
        The generated shell request record.
    """

    with BackendDatabase(web_session) as db:
        try:
            backend.add_user_to_group(db, member_id, group_id, owner)

            result = Response.ok(
                "User has been added to group successfully.")
        except Exception as e:
            result = Response.exception(e)

    return result


@plugin_function('gui.users.removeUserFromGroup', cli=True, web=True)
def remove_user_from_group(member_id, group_id, web_session=None):
    """Removes user from user group.

    Args:
        member_id (int): User ID
        group_id (int): Group ID
        web_session (object): The webserver session object, optional. Will be
            passed in by the webserver automatically

    Returns:
        A boolean value indicating whether the given user was removed from the given group.
    """
    with BackendDatabase(web_session) as db:
        return backend.remove_user_from_group(db, member_id, group_id)


@plugin_function('gui.users.updateUserGroup', cli=True, web=True)
def update_user_group(group_id, name=None, description=None, web_session=None):
    """Updates user group.

    Args:
        group_id (int): Group ID
        name (str): Group name
        description (str): Description of the group
        web_session (object): The webserver session object, optional. Will be
            passed in by the webserver automatically

    Returns:
        A boolean value indicating whether the record was updated or not.
    """
    with BackendDatabase(web_session) as db:
        return backend.update_user_group(db, group_id, name, description)


@plugin_function('gui.users.removeUserGroup', cli=True, web=True)
def remove_user_group(group_id, web_session=None):
    """Removes given user group.

    Args:
        group_id (int): Group ID
        web_session (object): The webserver session object, optional. Will be
            passed in by the webserver automatically

    Returns:
        A boolean value indicating whether the record was deleted or not.
    """
    with BackendDatabase(web_session) as db:
        return backend.remove_user_group(db, group_id)