# Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

from mysqlsh.plugin_manager import plugin_function
from mds_plugin import core, configuration

# Define plugin version
VERSION = "1.19.0"


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

    import oci.identity
    import oci.util
    import re
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
