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
import tempfile

from mds_plugin.bootstrap.interactive import resolve_passphrase_usage, resolve_config_location, resolve_region


@pytest.mark.usefixtures("testutil")
def test_resolve_passphrase_usage_no_passphrase(testutil):
    testutil.expect_prompt(
        "A new key file will be created, do you want to assign a passphrase to the key file?", "&Yes")
    testutil.expect_prompt(
        "Enter a passphrase for the private key: ", "test_passphrase")
    testutil.expect_prompt(
        "Please confirm the passphrase: ", "test_passphrase")
    testutil.expect_prompt(
        "Do you want to write your passphrase to the config file? (If not, you will need to enter it when prompted each time you run an oci command)", "&Yes")

    passphrase, persist_passphrase = resolve_passphrase_usage()

    assert passphrase == "test_passphrase"
    assert persist_passphrase


@pytest.mark.usefixtures("testutil")
def test_resolve_passphrase_usage_no_passphrase_decline(testutil):
    testutil.expect_prompt(
        "A new key file will be created, do you want to assign a passphrase to the key file?", "&No")

    passphrase, persist_passphrase = resolve_passphrase_usage()

    assert passphrase is None
    # This is the default behavior when passphrase is None
    assert persist_passphrase is False


@pytest.mark.usefixtures("testutil")
def test_resolve_passphrase_usage_with_passphrase_persist(testutil):
    testutil.expect_prompt(
        "Do you want to write your passphrase to the config file? (If not, you will need to enter it when prompted each time you run an oci command)", "&Yes")

    passphrase, persist_passphrase = resolve_passphrase_usage(
        passphrase="test_passphrase")

    assert passphrase == "test_passphrase"
    assert persist_passphrase


@pytest.mark.usefixtures("testutil")
def test_resolve_passphrase_usage_with_passphrase_no_persist(testutil):
    testutil.expect_prompt(
        "Do you want to write your passphrase to the config file? (If not, you will need to enter it when prompted each time you run an oci command)", "&No")

    passphrase, persist_passphrase = resolve_passphrase_usage(
        passphrase="test_passphrase")

    assert passphrase == "test_passphrase"
    assert not persist_passphrase


def test_resolve_passphrase_usage_with_passphrase_and_persist_passphrase():
    passphrase, persist_passphrase = resolve_passphrase_usage(
        passphrase="test_passphrase", persist_passphrase=True)

    assert passphrase == "test_passphrase"
    assert persist_passphrase


def test_resolve_region_valid_region():
    assert 'us-ashburn-1' == resolve_region(region='us-ashburn-1')


def test_resolve_region_invalid_region():
    with pytest.raises(ValueError, match=r"^'my-region' is not a valid region. Valid regions are"):
        resolve_region(region='my-region')


@pytest.mark.usefixtures("testutil")
def test_resolve_region_no_region(testutil):
    testutil.expect_prompt("Select the region: ", 'us-ashburn-1')
    assert 'us-ashburn-1' == resolve_region()


@pytest.mark.usefixtures("testutil")
class TestResolveConfigLocation:

    def test_config_location_not_provided_pick_default(self, testutil, temp_oci_config):
        testutil.expect_prompt(
            f"Enter the config file path [{temp_oci_config}]: ", temp_oci_config)
        result = resolve_config_location()
        assert result[0] == temp_oci_config
        assert result[1] == False

    def test_config_location_not_provided_pick_empty(self, testutil, temp_oci_config):
        testutil.expect_prompt(
            f"Enter the config file path [{temp_oci_config}]: ", '')
        result = resolve_config_location()
        assert result[0] == temp_oci_config
        assert result[1] == False

    def test_config_location_not_provided_and_is_directory(self, testutil, temp_oci_config):
        with tempfile.TemporaryDirectory() as config_location:
            with pytest.raises(ValueError, match=f"Target location {config_location} is a directory, should be a file"):
                testutil.expect_prompt(
                    f"Enter the config file path [{temp_oci_config}]: ", config_location)
                resolve_config_location()

    def test_config_location_provided_and_does_not_exist(self):
        with tempfile.TemporaryDirectory() as dir:
            config_location = os.path.join(dir, 'unexisting')
            result = resolve_config_location(config_location)
            assert result[0] == config_location
            assert result[1] == False

    def test_config_location_provided_and_is_directory(self):
        with tempfile.TemporaryDirectory() as config_location:
            with pytest.raises(ValueError, match=f"Target location {config_location} is a directory, should be a file"):
                resolve_config_location(config_location)

    def test_config_location_exists_and_user_chooses_use(self, testutil):
        with tempfile.NamedTemporaryFile() as config_location:
            testutil.expect_prompt(
                "Do you want to use it or overwrite it or specify a different path?", '&Use')
            result = resolve_config_location(config_location.name)
            assert result[0] == config_location.name
            assert result[1] == False  # overwrite is False

    def test_config_location_exists_and_user_chooses_overwrite(self, testutil):
        with tempfile.NamedTemporaryFile() as config_location:
            testutil.expect_prompt(
                "Do you want to use it or overwrite it or specify a different path?", '&Overwrite')
            result = resolve_config_location(config_location.name)
            assert result[0] == config_location.name
            assert result[1] == True  # overwrite is True

    def test_config_location_exists_and_user_chooses_different(self, testutil, temp_oci_config):
        with tempfile.NamedTemporaryFile() as config_location:
            testutil.expect_prompt(
                "Do you want to use it or overwrite it or specify a different path?", '&Different')
            testutil.expect_prompt(
                f"Enter the config file path [{temp_oci_config}]: ", '/new/path')
            result = resolve_config_location(config_location.name)
            assert result[0] == '/new/path'
            assert result[1] == False  # path_exists is False
