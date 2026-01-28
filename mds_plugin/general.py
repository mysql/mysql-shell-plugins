# Copyright (c) 2021, 2026, Oracle and/or its affiliates.
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

"""Sub-Module for shortcut functions"""

import os
from mysqlsh.plugin_manager import plugin_function
from mds_plugin import core, configuration
from mds_plugin.bootstrap import cli_setup_bootstrap, cli_util
from mds_plugin.bootstrap import interactive
import oci
from oci import identity

# Define plugin version
VERSION = "2026.2.1"


@plugin_function('mds.info')
def info():
    """Prints basic information about this plugin.

    Returns:
        None
    """
    print("MySQL Shell MDS Plugin for managing the MySQL Database Service (MDS) "
          f"Version {VERSION} PREVIEW\n"
          "Warning! For testing purposes only!")

    print(f"\n- mds.ls() can be used to list the current compartment's "
          f"resources, \n- mds.cd() to change the current compartment and "
          f"\n- mds.set.* functions to change the current objects.\n\n"
          f"For more help type \\? mds.\n")


@plugin_function('mds.version')
def version():
    """Returns the version number of the plugin

    Returns:
        str
    """
    return VERSION


@plugin_function('mds.ls')
def ls(compartment_path="", compartment_id=None, config=None):
    """Lists the compartment's sub-compartments and other resources

    This function will list all sub-compartments of the compartment with the
    given current_id. If current_id is omitted, all compartments are listed.

    Args:
        compartment_path (str): The compartment path.
        compartment_id (str): OCID of the parent compartment.
        config (dictionary): An OCI config object or None.

    Returns:
        None

    If compartment_path and the compartment_id are omitted, the current
    compartment's sub-compartments are listed.
    """

    # Get the active config, compartment and instance
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
    except ValueError as e:
        print(f"ERROR: {str(e)}")
        return

    from mds_plugin import compartment, mysql_database_service, compute
    from mds_plugin import object_store, bastion

    if compartment_path != "":
        compartment_id = compartment.get_compartment_id_by_path(
            compartment_path=compartment_path, compartment_id=compartment_id,
            config=config)

    comp_list = ""
    db_sys_list = ""
    compute_list = ""
    bucket_list = ""
    bastion_list = ""

    try:
        comp_list = ""
        if compartment_id is not None:
            # Get the full path of this tenancy
            full_path = compartment.get_compartment_full_path(
                compartment_id, config)

            print(f"Directory of compartment {full_path}\n")

        comp_list = compartment.list_compartments(
            compartment_id=compartment_id, config=config, interactive=False,
            raise_exceptions=True, return_formatted=True)

        # List Child Compartments
        if comp_list:
            print("Child Compartments:")
            print(comp_list)
    except oci.exceptions.ServiceError as e:
        # If a 404 error occurs, the user does not have privileges to list items
        if e.status == 404:
            print("No privileges to list compartments.")
        else:
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
            return
    except Exception as e:
        print(f'ERROR: {e}')
        return

    try:
        # List MySQL DB Systems
        db_sys_list = mysql_database_service.list_db_systems(
            compartment_id=compartment_id, config=config, interactive=False,
            raise_exceptions=True, return_formatted=True)
        if db_sys_list:
            print("MySQL DB Systems:")
            print(db_sys_list)
    except oci.exceptions.ServiceError as e:
        # If a 404 error occurs, the user does not have privileges to list items
        if e.status == 404:
            print("No privileges to list MySQL DB Systems in this "
                  "compartment.")
        else:
            print(f'Could not list the MySQL DB Systems.')
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
            return
    except Exception as e:
        print(f'ERROR: {e}')
        return

    # List Compute Instances
    try:
        compute_list = compute.list_instances(
            compartment_id=compartment_id, config=config, interactive=False,
            raise_exceptions=True, return_formatted=True)

        if compute_list != "":
            print("Compute Instances:")
            print(compute_list)
    except oci.exceptions.ServiceError as e:
        if e.status == 404:
            print("No privileges to list the compute instances in this "
                  "compartment.")
        else:
            print(f'Could not list the compute instances.')
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')

    # List Bastions and Sessions
    try:
        bastion_list = bastion.list_bastions(
            compartment_id=compartment_id, config=config, interactive=False,
            raise_exceptions=True, return_type=core.RETURN_STR)

        if bastion_list != "":
            print("Bastions:")
            print(bastion_list)
    except oci.exceptions.ServiceError as e:
        if e.status == 404:
            print("No privileges to list the bastions in this "
                  "compartment.")
        else:
            print(f'Could not list the bastions.')
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')

    # List Object Store Buckets
    try:
        bucket_list = object_store.list_buckets(
            compartment_id=compartment_id, config=config, interactive=False,
            raise_exceptions=True, return_formatted=True)

        if bucket_list != "":
            print("Object Store Buckets:")
            print(bucket_list)
    except oci.exceptions.ServiceError as e:
        if e.status == 404:
            print('No privileges to list the object store buckets in this '
                  'compartment.')
        else:
            print(f'Could not list the object store buckets.')
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')

    if comp_list == "" and db_sys_list == "" and compute_list == "" and \
            bastion_list == "" and bucket_list == "":
        print("-\n")

    # if compartment_id == config.get('tenancy'):
    #     print("Other Resources:")
    #     print("   - Users\n"
    #           "   - Groups\n")


@plugin_function('mds.cd')
def cd(compartment_path=None, compartment_id=None,
       config=None, profile_name=None,
       file_location="~/.oci/oci_cli_rc"):
    """Change the current compartment to the given one

    If no compartment is specified, let the user choose one

    Args:
        compartment_path (str): The path of the compartment
        compartment_id (str): The id of the compartment.
        config (object): An OCI config object or None.
        profile_name (str): The name of the profile currently in use
        file_location (str): The location of the OCI CLI config file

    Returns:
        none

    If compartment_id is omitted, the current compartment of the connection will be used.

    If profile_name is omitted, the DEFAULT profile is used.

    If file_location is omitted, ~/.oci/oci_cli_rc is used.
    """

    configuration.set_current_compartment(
        compartment_path=compartment_path, compartment_id=compartment_id,
        config=config, profile_name=profile_name, file_location=file_location)


@plugin_function('mds.ociBootstrap')
def oci_bootstrap(**kwargs):
    """
    Creates an OCI config file using username / password based login through a browser.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        profile_name (str): Name of the profile to be created.
        config_location (str): Path to the oci configuration file.
        region (str): The name of the region for the user.
        passphrase (str): Passphrase for the key file.
        connection_timeout (int): Timeout for the client when connecting to OCI (user's account).
        read_timeout: Timeout for the client when uploading data to OCI (user's account).

    All of the arguments are optional, but needed for the operation, they will
    be resolved as follows if not specified.

    @li profile_name: it will be prompted, using DEFAULT as the suggested value.
    @li config_location: it will be prompted, using the standard location as the suggested value.
    @li region: the user will be prompted to select from the list of regions.
    @li passphrase: it will be prompted with no default value.
    @li connection_timeout: if not provided a timeout of 60 seconds will be used.
    @li read_timeout: if not provided a timeout of 10 seconds will be used.

    Once the user is logged in, new API keys will be generated and uploaded to
    it's OCI account, if a non empty passphrase is provided, it will be
    associated to the private key.
    """
    # Ensures a valid region is used
    region = interactive.resolve_region(kwargs.get('region', None))

    config_location, overwrite_config = interactive.resolve_config_location(
        kwargs.get('config_location', None))

    profile_name = interactive.resolve_profile_name(config_location, overwrite_config,
                                                    kwargs.get('profile_name', None))

    user_session = cli_setup_bootstrap.create_user_session(region=region)

    public_key = user_session.public_key
    private_key = user_session.private_key
    region = user_session.region
    token = user_session.token
    tenancy_ocid = user_session.tenancy_ocid
    user_ocid = user_session.user_ocid
    fingerprint = user_session.fingerprint

    # create initial SDK client which targets region that user specified
    signer = oci.auth.signers.SecurityTokenSigner(token, private_key)
    client = identity.IdentityClient({"region": region}, signer=signer)

    # find home region and create new client targeting home region to use for subsequent identity requests
    result = client.list_region_subscriptions(tenancy_ocid)
    for r in result.data:
        if r.is_home_region:
            home_region = r.region_name
            break

    connection_timeout = kwargs.get(
        'connection_timeout', cli_setup_bootstrap.DEFAULT_CONNECTION_TIMEOUT)
    read_timeout = kwargs.get(
        'read_timeout', cli_setup_bootstrap.DEFAULT_READ_TIMEOUT)

    client = identity.IdentityClient(
        {"region": home_region},
        signer=signer,
        timeout=(connection_timeout, read_timeout),
    )

    create_api_key_details = identity.models.CreateApiKeyDetails()
    create_api_key_details.key = cli_util.serialize_key(
        public_key=public_key).decode("UTF-8")

    try:
        result = client.upload_api_key(user_ocid, create_api_key_details)
    except oci.exceptions.ServiceError as e:
        # TODO(rennox): Do we want this logic? probably not in the migration use
        # case where a new setup is being done.

        # if e.status == 409 and e.code == "ApiKeyLimitExceeded":
        #     # User cannot upload any more API keys, so ask if they'd like to delete one
        #     result = client.list_api_keys(user_ocid)
        #     print("ApiKey limit has been reached for this user account.")
        #     print("The following API keys are currently enabled for this account:")
        #     count = 1
        #     for result in result.data:
        #         print(
        #             "\tKey [{index}]: Fingerprint: {fingerprint}, Time Created: {time_created}".format(
        #                 index=count,
        #                 fingerprint=result.fingerprint,
        #                 time_created=result.time_created,
        #             ),
        #             sys.stderr,
        #         )
        #         count += 1

        #     delete_thumbprint = click.prompt(
        #         text='Enter the fingerprint of the API key to delete to make space for the new key (leave empty to skip deletion and exit command)', confirmation_prompt=True)
        #     if not delete_thumbprint:
        #         raise RuntimeError(
        #             cli_setup_bootstrap.BOOTSTRAP_PROCESS_CANCELED_MESSAGE)

        #     client.delete_api_key(user_ocid, delete_thumbprint)
        #     print('Deleted Api key with fingerprint: {}'.format(delete_thumbprint))
        #     client.upload_api_key(user_ocid, create_api_key_details)
        #     raise e(
        #         "Couldn't upload any more API keys. Delete some to make room for more"
        #     )
        raise RuntimeError(
            "Couldn't upload any more API keys. Delete some to make room for more")

    print("Uploaded new API key with fingerprint: {}".format(fingerprint))

    passphrase, persist_passphrase = interactive.resolve_passphrase_usage(
        kwargs.get('passphrase', None), kwargs.get('persistPassphrase', None))

    # write credentials to filesystem
    config_loc = os.path.expanduser(
        config_location) if config_location else None

    profile_name, config_location = cli_setup_bootstrap.persist_user_session(
        user_session,
        config_location=config_loc,
        overwrite_config=overwrite_config,
        profile_name=profile_name,
        key_passphrase=passphrase,
        persist_passphrase=persist_passphrase,
        persist_token=False,
        bootstrap=True,
    )


# @plugin_function('mds.ociBootstrapMigration')
# def oci_bootstrap_migration():
#     return cli_setup_bootstrap.bootstrap_migration_profile('us-ashburn-1')
