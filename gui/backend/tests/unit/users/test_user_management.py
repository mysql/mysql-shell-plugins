# Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

from gui_plugin.users import UserManagement
from gui_plugin.core.Error import MSGException
import gui_plugin.core.Logger as logger
import pytest
import os
import re

test_users_data = [
    ("pytest_user1", "password1", 'User'),
    ('pytest_user2', 'password2', None),
    ('pytest_user3', 'password3', 'Administrator')
]

test_fake_users_data = [
    ("pytest_fake_user1", "password1", 'FakeRole'),
    ('pytest_fake_user2', 'password2', 'Administrator_'),
    ('pytest_fake_user3', 'password3', 'Administrator ')
]

test_roles_privileges_data = [
    ("User", "Access to all web gui modules except shell", "GUI Module Access"),
    ("Administrator", "Full access to all web gui modules",
     "GUI Module Access")
]

test_user_privileges_data = [
    ("pytest_user2", "User", "\\\\b(?!shell\\\\b)\\\\w+"),
    ("pytest_user3", "Administrator", ".*")
]

test_modules_data = [
    ("pytest_user2", []),
    ("pytest_user3",
     ['gui.debugger', 'gui.sqleditor', 'gui.shell'])
]

def name_in_message(name, message):
    for row in message:
        if name == row["name"]:
            return True
    return False


def type_in_message(type, message):
    for row in message:
        if type == row["type"]:
            return True
    return False


def access_pattern_in_message(access_pattern, message):
    for row in message:
        if access_pattern == row["access_pattern"]:
            return True
    return False

def value_in_message(key, value, message):
    for row in message:
        if value == row[key]:
            return True
    return False


@pytest.mark.parametrize("user, password, role", test_users_data)
def test_create_user(user, password, role):
    msg = UserManagement.create_user(user, password, role=role)
    assert isinstance(msg, int)
    users = UserManagement.list_users()
    assert name_in_message(user, users) == True
    roles = UserManagement.list_user_roles(user)
    if role != None:
        assert name_in_message(role, roles) == True

@pytest.mark.parametrize("user, password, role", test_users_data)
def test_grant_role(user, password, role):
    if role == None:
        fake_role = "FakeRole"
        with pytest.raises(MSGException, match=re.escape(f"Error[MSG-1300]: There is no role with the name '{fake_role}'.")):
            msg = UserManagement.grant_role(user, fake_role)

        msg = UserManagement.grant_role(user, "User")
        assert msg is None
        roles = UserManagement.list_user_roles(user)
        assert name_in_message("User", roles) == True


@pytest.mark.parametrize("user, password, role", test_fake_users_data)
def test_grant_fake_role(user, password, role):
    with pytest.raises(MSGException, match=re.escape(f"Error[MSG-1300]: There is no role with the name '{role}'.")):
        UserManagement.create_user(user, password, role=role)

    users = UserManagement.list_users()
    assert name_in_message(user, users) == False

    with pytest.raises(MSGException, match=re.escape(f"Error[MSG-1301]: There is no user with the name '{user}'.")):
        UserManagement.grant_role(user, role)


@pytest.mark.parametrize("user, password, role", test_users_data)
def test_create_user_already_created(user, password, role):
    with pytest.raises(MSGException, match="User already exists."):
        UserManagement.create_user(user, password, role=role)


@pytest.mark.parametrize("role, privilege, privilege_type", test_roles_privileges_data)
def test_role_privileges(role, privilege, privilege_type):
    roles = UserManagement.list_roles()

    assert name_in_message(role, roles) == True
    privileges = UserManagement.list_role_privileges(role)
    assert type_in_message(privilege_type, privileges) == True
    assert name_in_message(privilege, privileges) == True


@pytest.mark.parametrize("user, role, privilege", test_user_privileges_data)
def test_user_privileges(user, role, privilege):
    privileges = UserManagement.list_user_privileges(user)
    assert name_in_message(role, privileges) == True
    assert access_pattern_in_message(privilege, privileges) == True


@pytest.mark.parametrize("user, password, role", test_fake_users_data)
def test_get_fake_user_id(user, password, role):
    with pytest.raises(MSGException, match=re.escape(f"Error[MSG-1301]: There is no user with the name '{user}'.")):
        UserManagement.get_user_id(user)


@pytest.mark.parametrize("user, modules", test_modules_data)
def test_gui_module_list(user, modules):
    msg = UserManagement.get_user_id(user)
    assert isinstance(msg, int)
    user_id = msg
    msg = UserManagement.get_gui_module_list(user_id)
    assert isinstance(msg, list)
    assert sorted(msg) == sorted(modules)


@pytest.mark.parametrize("user, password, role", test_users_data)
def test_profile(user, password, role):
    profile_name = f'{user}_profile'
    profile = {'name': profile_name,
               'description': 'Profile description.', 'options': {}}
    msg = UserManagement.get_user_id(user)
    assert isinstance(msg, int)
    user_id = msg

    profile_id = UserManagement.add_profile(user_id, profile)
    assert profile_id > 0
    profiles = UserManagement.list_profiles(user_id)
    assert name_in_message(profile_name, profiles)
    new_profile = UserManagement.get_profile(profile_id)
    assert profile_name == new_profile["name"]
    default_profile = UserManagement.get_default_profile(user_id)
    # assert "Default" == default_profile["result"].get("name")
    UserManagement.set_default_profile(user_id, profile_id)
    default_profile = UserManagement.get_default_profile(user_id)
    assert profile_name == default_profile["name"]

    fake_user_id = 999
    with pytest.raises(MSGException, match=re.escape(f"Error[MSG-1301]: There is no user with the given id.")):
        msg = UserManagement.get_default_profile(fake_user_id)

    profile['id'] = profile_id
    profile['description'] = 'Updated description'
    profile['options'] = {'test': 'test_value'}
    UserManagement.update_profile(profile)
    msg = UserManagement.get_profile(profile_id)
    assert isinstance(msg, dict)

    profiles = UserManagement.list_profiles(user_id)
    logger.debug(f"user_id: {user_id} , profile_id: {profile_id}")
    logger.debug(profiles)
    assert name_in_message(profile_name, profiles)
    # assert profile_list
    result = UserManagement.delete_profile(user_id, profile_id)
    logger.debug(f"result[profile_id: {profile_id}]: {result}")
    profiles = UserManagement.list_profiles(user_id)
    logger.debug(profiles)
    assert not name_in_message(profile_name, profiles)

    with pytest.raises(MSGException, match=re.escape(f"Error[MSG-1302]: Could not delete any profile with the supplied criteria.")):
        result = UserManagement.delete_profile(user_id + 1, profile_id)

    with pytest.raises(MSGException, match=re.escape(f"Error[MSG-1302]: Could not delete any profile with the supplied criteria.")):
        result = UserManagement.delete_profile(user_id + 1, profile_id + 1)

def test_user_group():
    # Test create user group
    msg = UserManagement.list_user_groups()
    logger.debug(f"msg: {msg}")
    assert not value_in_message("name", "user_group_1", msg)

    msg = UserManagement.create_user_group("user_group_1", "First user group")

    assert isinstance(msg, int)
    user_group_id_1 = msg

    msg = UserManagement.create_user_group("user_group_2", "Second user group")

    assert isinstance(msg, int)
    user_group_id_2 = msg

    msg = UserManagement.list_user_groups()

    assert value_in_message("name", "user_group_1", msg)
    assert value_in_message("name", "user_group_2", msg)

    # Test list user group
    msg = UserManagement.get_user_id('pytest_user1')
    assert isinstance(msg, int)
    user_id = msg

    msg = UserManagement.list_user_groups(user_id)
    assert value_in_message("name", "pytest_user1", msg)
    assert value_in_message("name", "all", msg)
    assert not value_in_message("name", "user_group_1", msg)

    msg = UserManagement.add_user_to_group(user_id, user_group_id_1, 1)
    assert msg is None

    msg = UserManagement.list_user_groups(user_id)
    assert value_in_message("name", "pytest_user1", msg)
    assert value_in_message("name", "all", msg)
    assert value_in_message("name", "user_group_1", msg)

    msg = UserManagement.update_user_group(user_group_id_1, "user_group_1.1", "First user group updated")
    assert msg is None

    msg = UserManagement.list_user_groups(user_id)
    assert value_in_message("name", "pytest_user1", msg)
    assert value_in_message("name", "all", msg)
    assert not value_in_message("name", "user_group_1", msg)
    assert value_in_message("name", "user_group_1.1", msg)
    assert value_in_message("description", "First user group updated", msg)

    msg = UserManagement.remove_user_from_group(user_id, user_group_id_1)
    assert msg is None

    msg = UserManagement.list_user_groups(user_id)
    assert value_in_message("name", "pytest_user1", msg)
    assert value_in_message("name", "all", msg)
    assert not value_in_message("name", "user_group_1", msg)
    assert not value_in_message("name", "user_group_1.1", msg)


    # Test remove user group
    msg = UserManagement.list_user_groups()

    assert value_in_message("name", "all", msg)
    assert value_in_message("description", "All Users", msg)
    assert value_in_message("name", "pytest_user1", msg)
    assert value_in_message("description", "pytest_user1 default group", msg)
    assert value_in_message("name", "pytest_user2", msg)
    assert value_in_message("description", "pytest_user2 default group", msg)
    assert value_in_message("name", "pytest_user3", msg)
    assert value_in_message("description", "pytest_user2 default group", msg)
    assert value_in_message("name", "user_group_1.1", msg)
    assert value_in_message("description", "First user group updated", msg)
    assert value_in_message("name", "user_group_2", msg)
    assert value_in_message("description", "Second user group", msg)

    msg = UserManagement.add_user_to_group(user_id, user_group_id_1, 1)
    assert msg is None

    with pytest.raises(MSGException, match=re.escape(f"Error[MSG-1307]: Can't delete user group that contains users.")) as e:
        UserManagement.remove_user_group(user_group_id_1)

    msg = UserManagement.remove_user_from_group(user_id, user_group_id_1)
    assert msg is None

    msg = UserManagement.remove_user_group(user_group_id_1)
    assert msg is None
    msg = UserManagement.remove_user_group(user_group_id_2)
    assert msg is None

    msg = UserManagement.list_user_groups()

    assert value_in_message("name", "all", msg)
    assert value_in_message("description", "All Users", msg)
    assert value_in_message("name", "pytest_user1", msg)
    assert value_in_message("description", "pytest_user1 default group", msg)
    assert value_in_message("name", "pytest_user2", msg)
    assert value_in_message("description", "pytest_user2 default group", msg)
    assert value_in_message("name", "pytest_user3", msg)
    assert value_in_message("description", "pytest_user2 default group", msg)
    assert not value_in_message("name", "user_group_1.1", msg)
    assert not value_in_message("description", "First user group updated", msg)
    assert not value_in_message("name", "user_group_2", msg)
    assert not value_in_message("description", "Second user group", msg)


@pytest.mark.parametrize("user, password, role", test_users_data)
def test_delete_user(user, password, role):
    msg = UserManagement.delete_user(user)

    assert msg is None


@pytest.mark.parametrize("user, password, role", test_users_data)
def test_delete_user_not_exists(user, password, role):
    with pytest.raises(MSGException, match=re.escape(f"Error[MSG-1301]: There is no user with the name '{user}'.")):
        UserManagement.delete_user(user)
