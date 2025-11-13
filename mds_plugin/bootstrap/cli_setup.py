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

# NOTE: The functions in this file were taken from the cli_setup_bootstrap.py
#       file in the python OCI CLI at version 3.64.1, changes applied correspond
#       to te input (prompts) and output mechanisms (to use shell standard ones)

import os
import base64
import configparser
import mds_plugin.core as core

import mds_plugin.bootstrap.cli_util as cli_util
import mds_plugin.bootstrap.pymd5 as pymd5
import mysqlsh

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
import oci


NO_PASSPHRASE = "N/A"
PUBLIC_KEY_FILENAME_SUFFIX = "_public.pem"
PRIVATE_KEY_FILENAME_SUFFIX = ".pem"
PRIVATE_KEY_LABEL = "OCI_API_KEY"


DEFAULT_DIRECTORY = os.path.join(os.path.expanduser("~"), ".oci")
DEFAULT_KEY_NAME = "oci_api_key"
DEFAULT_PROFILE_NAME = "DEFAULT"
DEFAULT_TOKEN_DIRECTORY = os.path.join(DEFAULT_DIRECTORY, "sessions")
DEFAULT_CONFIG_LOCATION = os.path.join(DEFAULT_DIRECTORY, "config")


def prompt_for_region():
    # NOTE: this is a customized version of the function, using the mds plugin
    # standard for option resolution
    region = None

    sorted_region_list = sorted(oci.regions.REGIONS)
    named_region_list = [{"name": f"{name}"} for name in sorted_region_list]

    region = core.prompt_for_list_item(
        item_list=named_region_list, prompt_caption=(
            "Select the region: "),
        item_name_property="name",
        print_list=True)

    return region.get("name", None) if region else None


def prompt_for_passphrase():
    # NOTE: this is a customized version of the function, the oci cli one
    # was never like this
    message = "Enter a passphrase for the private key: "
    passphrase = None
    for _ in range(3):
        initial = core.prompt(message, {"type": "password"}).strip()
        confirmation = core.prompt(
            "Please confirm the passphrase: ", {"type": "password"}).strip()

        done = confirmation == initial
        if done:
            passphrase = initial
            break
        else:
            message = "Mismatched passphrase, enter a passphrase for the private key: "

    if passphrase is None:
        raise RuntimeError("Mistmatched passphrase")

    return passphrase


def remove_profile_from_config(config_file, profile_name_to_terminate):
    # Set default_section to custom value or else we can't delete 'DEFAULT'
    # profiles since it is protected by configparser
    config = configparser.ConfigParser(default_section="")
    config.read(config_file)
    config.remove_section(profile_name_to_terminate)
    with open(config_file, 'w') as config_file_handle:
        config.write(config_file_handle)


def public_key_to_fingerprint(public_key):
    bytes = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo)

    header = b'-----BEGIN PUBLIC KEY-----'
    footer = b'-----END PUBLIC KEY-----'
    bytes = bytes.replace(header, b'').replace(footer, b'').replace(b'\n', b'')

    key = base64.b64decode(bytes)
    fp_plain = pymd5.md5(key).hexdigest()
    return ':'.join(a + b for a, b in zip(fp_plain[::2], fp_plain[1::2]))


def write_config(filename, user_id=None, fingerprint=None, key_file=None, tenancy=None, region=None, pass_phrase=None, profile_name=DEFAULT_PROFILE_NAME, security_token_file=None, **kwargs):
    existing_file = os.path.exists(filename)
    with open(filename, 'a') as f:
        if existing_file:
            f.write('\n\n')

        f.write('[{}]\n'.format(profile_name))

        if user_id:
            f.write('user={}\n'.format(user_id))

        f.write('fingerprint={}\n'.format(fingerprint))
        f.write('key_file={}\n'.format(key_file))
        f.write('tenancy={}\n'.format(tenancy))
        f.write('region={}\n'.format(region))

        if pass_phrase:
            f.write("pass_phrase={}\n".format(pass_phrase))

        if security_token_file:
            f.write("security_token_file={}\n".format(security_token_file))

    # only user has R/W permissions to the config file
    cli_util.apply_user_only_access_permissions(filename)


def write_public_key_to_file(filename, public_key, overwrite=False, silent=False):
    if not overwrite and os.path.isfile(filename):
        return False

    with open(filename, "wb") as f:
        f.write(cli_util.serialize_key(public_key=public_key))

    # only user has R/W permissions to the key file
    cli_util.apply_user_only_access_permissions(filename)

    if not silent:
        print('Public key written to: {}'.format(filename))

    return True


def write_private_key_to_file(filename, private_key, passphrase, overwrite=False, silent=False, add_private_key_label=True):

    if not overwrite \
            and os.path.isfile(filename) \
            and "&No" == mysqlsh.globals.shell.prompt('File {} already exists, do you want to overwrite?'.format(filename), {'defaultValue': 'no', "type": "confirm"}):
        return False

    with open(filename, "wb") as f:
        f.write(cli_util.serialize_key(
            private_key=private_key, passphrase=passphrase))

    # Add PRIVATE_KEY_LABEL only if flag is true
    if add_private_key_label:
        # Open a file in append mode
        with open(filename, 'a') as file:
            # add the static label
            file.write(PRIVATE_KEY_LABEL)

    # only user has R/W permissions to the key file
    cli_util.apply_user_only_access_permissions(filename)

    if not silent:
        print('Private key written to: {}'.format(filename))

    return True
