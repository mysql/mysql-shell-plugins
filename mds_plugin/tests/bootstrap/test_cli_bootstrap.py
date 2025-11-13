# Copyright (c) 2025, Oracle and/or its affiliates.
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

import pytest
import os
import configparser
import random
import string
import shutil
from mds_plugin.bootstrap.cli_setup_bootstrap import persist_user_session
from mds_plugin.bootstrap.cli_setup_bootstrap import UserSession
from mds_plugin.bootstrap import cli_setup
from mds_plugin.bootstrap import cli_util

import sys


@pytest.fixture
def user_session():
    private_key = cli_util.generate_key()
    public_key = private_key.public_key()
    fingerprint = cli_setup.public_key_to_fingerprint(public_key)

    return UserSession(
        'user_ocid', 'tenancy_ocid', 'region', 'token', 12345, public_key, private_key, fingerprint
    )


def get_random_string(length):
    # Define the possible characters (lowercase, uppercase, and digits)
    characters = string.ascii_letters + string.digits

    # Use random.choices to pick 'length' characters
    random_string = ''.join(random.choices(characters, k=length))

    return random_string


def test_persist_user_session_success(user_session, temp_oci_config):
    profile_name = f"gui_be_ut_profile_{get_random_string(5)}"

    result = persist_user_session(
        user_session, temp_oci_config, False, profile_name)

    public_key = os.path.join(cli_setup.DEFAULT_TOKEN_DIRECTORY,
                              profile_name, cli_setup.DEFAULT_KEY_NAME + cli_setup.PUBLIC_KEY_FILENAME_SUFFIX)
    private_key = os.path.join(cli_setup.DEFAULT_TOKEN_DIRECTORY, profile_name,
                               cli_setup.DEFAULT_KEY_NAME + cli_setup.PRIVATE_KEY_FILENAME_SUFFIX)

    assert result == (profile_name, temp_oci_config)
    assert os.path.exists(temp_oci_config)
    assert os.path.exists(public_key)
    assert os.path.exists(private_key)
    shutil.rmtree(os.path.dirname(public_key))


def test_persist_user_session_success_custom_auth_path(user_session, temp_dir):
    config_location = os.path.join(temp_dir, 'config')
    profile_name = 'test_profile'

    result = persist_user_session(
        user_session, config_location, False, profile_name, session_auth_root=temp_dir)

    public_key = os.path.join(temp_dir, 'sessions',
                              profile_name, cli_setup.DEFAULT_KEY_NAME + cli_setup.PUBLIC_KEY_FILENAME_SUFFIX)
    private_key = os.path.join(temp_dir, 'sessions', profile_name,
                               cli_setup.DEFAULT_KEY_NAME + cli_setup.PRIVATE_KEY_FILENAME_SUFFIX)

    assert result == (profile_name, config_location)
    assert os.path.exists(config_location)
    assert os.path.exists(public_key)
    assert os.path.exists(private_key)


def test_persist_user_session_public_key_failure(user_session, temp_dir):
    config_location = os.path.join(temp_dir, 'config')
    profile_name = 'test_profile'

    # Create a file with the same name as the public key file to simulate a failure
    public_key_file_path = os.path.join(temp_dir, 'sessions',
                                        profile_name, cli_setup.DEFAULT_KEY_NAME + cli_setup.PUBLIC_KEY_FILENAME_SUFFIX)
    os.makedirs(os.path.dirname(public_key_file_path))
    with open(public_key_file_path, 'w') as f:
        f.write('existing content')

    with pytest.raises(RuntimeError):
        persist_user_session(user_session, config_location,
                             False, profile_name, session_auth_root=temp_dir)


def test_persist_user_session_config_overwrite(user_session, temp_dir):
    config_location = os.path.join(temp_dir, 'config')

    persist_user_session(user_session, config_location,
                         True, 'profile_1', session_auth_root=temp_dir)

    persist_user_session(user_session, config_location,
                         False, 'profile_2', session_auth_root=temp_dir)

    config1 = configparser.ConfigParser()
    config1.read(config_location)
    assert len(config1.sections()) == 2
    assert 'profile_1' in config1.sections()
    assert 'profile_2' in config1.sections()

    persist_user_session(user_session, config_location,
                         True, 'profile_3', session_auth_root=temp_dir)

    config2 = configparser.ConfigParser()
    config2.read(config_location)
    assert len(config2.sections()) == 1
    assert 'profile_3' in config2.sections()

# Disables as it requires user interaction to login through the browser
# def test_bootstrap_migration_profile(testutil):
#     region = 'us-ashburn-1'
#     result = bootstrap_migration_profile(region)
#     assert result['profile'] == 'DEFAULT'
#     assert os.path.exists(result['config_file'])
#     assert os.path.exists(result['migration_location'])
