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

from mds_plugin.bootstrap import mds
from mds_plugin.bootstrap import cli_setup
import os
import oci
import configparser

import mysqlsh
shell_prompt = mysqlsh.globals.shell.prompt


def resolve_config_location(config_location: str = None) -> tuple:
    """
    Validates a given config file path, checks if it exists, and asks the user if it should be overwritten.
    If config_location is not provided or is empty, prompts the user for it.

    Args:
    - config_location (str, optional): The path to the config file. Defaults to None.

    Returns:
    - tuple: A tuple containing the config_location, a boolean indicating if the path exists, and a boolean indicating if it should be overwritten.
    """
    default_path = mds.get_default_oci_config_path()

    description = []
    while True:
        if config_location is None or not config_location.strip():
            config_location = shell_prompt(f"Enter the config file path [{default_path}]: ", {
                "title": 'Configuration Path', "defaultValue": default_path, "description": description}).strip()

        # Check if the path exists
        path_exists = os.path.exists(config_location)

        if path_exists and not os.path.isfile(config_location):
            raise ValueError(
                f"Target location {config_location} is a directory, should be a file")

        # If the path exists, ask the user if they want to overwrite it
        overwrite = False
        if path_exists:
            response = shell_prompt("Do you want to use it or overwrite it or specify a different path?", {
                "type": "confirm", "yes": "&Use", "no": "&Overwrite", "alt": "&Different", "defaultValue": "&Use", "description": [f"The config file {config_location} already exists."]})

            if response == '&Different':
                config_location = None  # Reset config_location to prompt again
                description = []
                continue
            else:
                overwrite = response == '&Overwrite'

        return config_location, overwrite


def resolve_profile_name(config_location: str, validate_config: bool, profile_name: str = None) -> tuple:
    """
    Validates a given config file path and profile name, checks if the profile exists, and asks the user if it should be overwritten.

    Args:
    - config_location (str): The path to the config file.
    - validate_config (bool): Validate the profile does not exist in an existing configuration file.
    - profile_name (str, optional): The name of the profile. Defaults to None.

    Returns:
    - The selected profile name.
    """

    # Parse config file
    config = None
    if validate_config:
        # Check if config_location is valid
        if not config_location or not isinstance(config_location, str):
            raise ValueError("Invalid config file path")

        # Check if config file exists
        if not os.path.isfile(config_location):
            raise FileNotFoundError(f"Config file {config_location} not found")

        config = configparser.ConfigParser()
        config.read(config_location)

    description = []
    while True:
        if profile_name is None or not profile_name.strip():
            profile_name = shell_prompt("Enter the profile name: ", {
                "title": 'Profile Name', "defaultValue": cli_setup.DEFAULT_PROFILE_NAME, "description": description}).strip()

            if not profile_name:
                description = ["Profile name cannot be empty."]
                continue

        # Check if profile exists
        if config and profile_name in config.sections():
            while True:
                response = shell_prompt("Do you want to overwrite it?", {
                    "type": "confirm", "defaultValue": "&No", "description": [f"The profile {profile_name} already exists."]})

                if response == '&No':
                    profile_name = None  # Reset profile_name to prompt again
                    break

        return profile_name


def resolve_passphrase_usage(passphrase=None, persist_passphrase=None):
    "Returns a passphrase and whether it should be stored in the config file or not"
    if passphrase is None:
        response = shell_prompt(
            "A new key file will be created, do you want to assign a passphrase to the key file?", {"type": "confirm"})
        if response == "&Yes":
            passphrase = cli_setup.prompt_for_passphrase()

    if passphrase and persist_passphrase is None:
        response = shell_prompt(
            "Do you want to write your passphrase to the config file? (If not, you will need to enter it when prompted each time you run an oci command)", {"type": "confirm"})
        persist_passphrase = response == "&Yes"

    return passphrase, persist_passphrase if persist_passphrase is not None else response == "&Yes"


def resolve_region(region=None):
    if region is None:
        region = cli_setup.prompt_for_region()

    if region in oci.regions.REGIONS_SHORT_NAMES:
        region = oci.regions.REGIONS_SHORT_NAMES[region]

    if not oci.regions.is_region(region):
        raise ValueError("'{}' is not a valid region. Valid regions are \n{}".format(region, oci.regions.REGIONS)
                         )

    return region
