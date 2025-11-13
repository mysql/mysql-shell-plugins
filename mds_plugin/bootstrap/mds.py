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

import os
import oci
import uuid

from mds_plugin.bootstrap import cli_util, cli_setup, cli_setup_bootstrap


def get_default_oci_config_path():
    """Get the default OCI config file path based on the operating system."""
    if 'OCI_CLI_CONFIG_FILE' in os.environ:
        return os.environ['OCI_CLI_CONFIG_FILE']

    if os.name == 'nt':  # Windows
        appdata = os.getenv('APPDATA')
        if appdata:
            return os.path.join(appdata, 'Oracle', 'oci', 'config')
        else:
            raise EnvironmentError("APPDATA environment variable is not set.")
    else:  # MacOS and Linux
        return cli_setup.DEFAULT_CONFIG_LOCATION


def find_home_region(signer, tenancy_id: str) -> str:
    popular_regions = [
        "us-phoenix-1",
        "us-ashburn-1",
        "uk-london-1",
        "ap-tokyo-1",
        "eu-frankfurt-1",
        "us-sanjose-1",
        "ap-mumbai-1",
        "ca-toronto-1",
        "ap-seoul-1",
        "me-dubai-1",
        "sa-saopaulo-1",
        "sa-santiago-1",
    ]

    for region in popular_regions + list(set(oci.regions.REGIONS) - set(popular_regions)):
        client = oci.identity.IdentityClient({"region": region}, signer=signer)
        try:
            result = client.list_region_subscriptions(tenancy_id)
            # find home region and create new client targeting home region to use for subsequent identity requests
            for r in result.data:
                if r.is_home_region:
                    return r.region_name
        except:
            continue

    raise RuntimeError(
        f"Could not find the home region for tenancy {tenancy_id}")


def bootstrap_migration_profile(
        region: str, passphrase: str = None, config_location: str = "",
        profile_name: str = cli_setup.DEFAULT_PROFILE_NAME,
        connection_timeout: int = cli_setup_bootstrap.DEFAULT_CONNECTION_TIMEOUT,
        read_timeout: int = cli_setup_bootstrap.DEFAULT_READ_TIMEOUT,
        report_cb=None):
    """
    Creates an OCI config file using username/password based login through a
    browser.

    The configuration is created  at the migrations/<migration-id> folder at
    the MySQL Shell user config directory which by default is:

    - MacOS / Linux: ~/.mysqlsh
    - Windows: %APPDATA%\\MySQL\\mysqlsh

    Args:
        region (str): The name of the region for the user.
        passphrase (str): Passphrase for the key file.
        config_location (str): Pass to the config file to store profile
        profile_name (str): Name of the profile to create
        connection_timeout (int): Timeout for the client when connecting to OCI
        (user's account).
        read_timeout: Timeout for the client when uploading data to OCI (user's
        account).
        report_cb: Callback for reporting status and messages.

    Once the user is logged in, new API keys will be generated and uploaded to
    it's OCI account.
    """
    # Resolves the location of the migration folder
    if not config_location:
        mysqlsh_user_home = mysqlsh.plugin_manager.general.get_shell_user_dir()
        migration_id = str(uuid.uuid4())
        migration_location = os.path.join(
            mysqlsh_user_home, 'migrations', migration_id)

        # Ensures the folder exists
        cli_util.create_directory(migration_location)

        config_location = os.path.join(migration_location, 'config')
    else:
        migration_location = os.path.dirname(config_location)

    user_session = cli_setup_bootstrap.create_user_session(
        region=region, report_cb=report_cb)

    public_key = user_session.public_key
    private_key = user_session.private_key
    region = user_session.region
    token = user_session.token
    tenancy_ocid = user_session.tenancy_ocid
    user_ocid = user_session.user_ocid

    # create initial SDK client which targets region that user specified
    signer = oci.auth.signers.SecurityTokenSigner(token, private_key)

    if report_cb:
        report_cb("Searching for home region...")
    if region:
        client = oci.identity.IdentityClient({"region": region}, signer=signer)

        # find home region and create new client targeting home region to use for subsequent identity requests
        result = client.list_region_subscriptions(tenancy_ocid)
        for r in result.data:
            if r.is_home_region:
                home_region = r.region_name
                break
    else:
        home_region = find_home_region(signer, tenancy_ocid)
        user_session.region = home_region

    if report_cb:
        report_cb(f"Home region is {home_region}", {"region": home_region})

    client = oci.identity.IdentityClient(
        {"region": home_region},
        signer=signer,
        timeout=(connection_timeout, read_timeout),
    )

    create_api_key_details = oci.identity.models.CreateApiKeyDetails()
    create_api_key_details.key = cli_util.serialize_key(
        public_key=public_key).decode("UTF-8")

    try:
        result = client.upload_api_key(user_ocid, create_api_key_details)
    except oci.exceptions.ServiceError as e:
        raise RuntimeError(
            f"Couldn't upload any more API keys. Delete some to make room for more ({e.code})")

    profile_name, config_location = cli_setup_bootstrap.persist_user_session(
        user_session,
        config_location=config_location,
        overwrite_config=True,
        profile_name=profile_name,
        key_passphrase=passphrase,
        persist_passphrase=True,
        persist_token=False,
        bootstrap=True,
        session_auth_root=migration_location
    )

    return {
        "config_file": config_location,
        "user_ocid": user_session.user_ocid,
        "token_expiration": user_session.token_expiration,
        "home_region": home_region
    }
