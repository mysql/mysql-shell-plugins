# Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

"""Sub-Module to manage OCI Bastions"""

from code import interact
from mysqlsh.plugin_manager import plugin_function
from mds_plugin import core, configuration, compute, mysql_database_service
from mds_plugin import network

# cSpell:ignore vnics, vnic


def format_bastion_listing(items, current=None) -> str:
    """Formats a given list of objects in a human readable form

    Args:
        items: Either a list of objects or a single object
        current (str): OCID of the current item

    Returns:
       The db_systems formated as str
    """

    # If a single db_system was given, wrap it in a list
    if not type(items) is list:
        items = [items]

    # return objects in READABLE text output
    out = ""
    id = 1
    for i in items:
        index = f"*{id:>3} " if current == i.id else f"{id:>4} "
        out += (index +
                core.fixed_len(i.name, 24, ' ', True) +
                core.fixed_len(i.lifecycle_state, 8, ' ') +
                core.fixed_len(f"{i.time_created:%Y-%m-%d %H:%M}", 16, '\n'))
        id += 1

    return out


def format_session_listing(items, current=None) -> str:
    """Formats a given list of objects in a human readable form

    Args:
        items: Either a list of objects or a single object
        current (str): OCID of the current item

    Returns:
       The db_systems formated as str
    """

    # If a single db_system was given, wrap it in a list
    if not type(items) is list:
        items = [items]

    # return objects in READABLE text output
    out = ""
    id = 1
    for i in items:
        index = f"*{id:>3} " if current == i.id else f"{id:>4} "
        s_type = i.target_resource_details.session_type
        s_port = str(i.target_resource_details.target_resource_port)
        s_ip = i.target_resource_details.target_resource_private_ip_address
        s_time = f'{i.time_created:%Y%m%d-%H%M%S}'
        out += (index +
                core.fixed_len(i.display_name, 24, ' ', True) +
                core.fixed_len(i.lifecycle_state, 8, ' ') +
                core.fixed_len(s_type, 15, ' ') +
                core.fixed_len(s_ip, 15, ' ') +
                core.fixed_len(s_port, 15, ' ') +
                core.fixed_len(s_time, 15, '\n'))
        id += 1
        # try:
        #     out += "       " + i.ssh_metadata.get("command") + "\n"
        # except:
        #     pass

    return out


@plugin_function('mds.list.bastions', shell=True, cli=True, web=True)
def list_bastions(**kwargs):
    """Lists bastions

    This function will list all bastions of the compartment with the
    given compartment_id.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        compartment_id (str): OCID of the parent compartment
        valid_for_db_system_id (str): OCID of the db_system_id the bastions 
            needs to be valid for and therefore are in the same subnet
        config (dict): An OCI config object or None
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        return_type (str): "STR" will return a formatted string, "DICT" will
            return the object converted to a dict structure and "OBJ" will
            return the OCI Python object for internal plugin usage
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
        Based on return_type
    """

    compartment_id = kwargs.get("compartment_id")
    valid_for_db_system_id = kwargs.get("valid_for_db_system_id")

    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    return_type = kwargs.get(
        "return_type",  # In interactive mode, default to formatted str return
        core.RETURN_STR if interactive else core.RETURN_DICT)
    raise_exceptions = kwargs.get(
        "raise_exceptions",  # On internal call (RETURN_OBJ), raise exceptions
        True if return_type == core.RETURN_OBJ else not interactive)

    try:
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        current_bastion_id = configuration.get_current_bastion_id(
            config=config)

        import oci.exceptions
        try:
            # Initialize the  Object Store client
            bastion_client = core.get_oci_bastion_client(config=config)

            # List the bastions
            bastions = bastion_client.list_bastions(
                compartment_id=compartment_id).data

            # Filter out all deleted bastions
            bastions = [b for b in bastions if b.lifecycle_state != "DELETED"]

            # Filter out all bastions that are not valid for the given DbSystem
            if valid_for_db_system_id:
                # Just consider active bastions here
                bastions = [b for b in bastions if b.lifecycle_state == "ACTIVE"]
                valid_bastions = []
                db_system = mysql_database_service.get_db_system(
                    db_system_id=valid_for_db_system_id,
                    config=config, interactive=False,
                    return_python_object=True)
                for b in bastions:
                    bastion = bastion_client.get_bastion(bastion_id=b.id).data
                    if bastion.target_subnet_id == db_system.subnet_id:
                        valid_bastions.append(bastion)
                bastions = valid_bastions


            # Add the is_current field
            current_bastion_id = configuration.get_current_bastion_id(
                config=config)

            for b in bastions:
                # Add the is_current field to the object, also adding it to
                # the swagger_types so oci.util.to_dict() does include it
                setattr(b, "is_current", b.id == current_bastion_id)
                b.swagger_types["is_current"] = "bool"
                # bastions[i] = b

            if len(bastions) < 1 and interactive:
                print("This compartment contains no bastions.")
                bastions = None

            return core.oci_object(
                oci_object=bastions,
                return_type=return_type,
                format_function=format_bastion_listing,
                current=current_bastion_id)
        except oci.exceptions.ServiceError as e:
            if raise_exceptions:
                raise
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
    except Exception as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')


@plugin_function('mds.get.bastion', shell=True, cli=True, web=True)
def get_bastion(**kwargs):
    """Gets a Bastion with the given id

    If no id is given, it will prompt the user for the id.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        bastion_name (str): The new name bastion
        bastion_id (str): OCID of the bastion.
        await_state (str): Await the given lifecycle state, ACTIVE, DELETED, ..
        ignore_current (bool): Whether the current bastion should be ignored
        fallback_to_any_in_compartment (bool): Whether to lookup bastion in
            compartment
        compartment_id (str): OCID of the compartment.
        config (dict): An OCI config object or None.
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        return_type (str): "STR" will return a formatted string, "DICT" will
            return the object converted to a dict structure and "OBJ" will
            return the OCI Python object for internal plugin usage
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
       None
    """

    bastion_name = kwargs.get("bastion_name")
    bastion_id = kwargs.get("bastion_id")
    await_state = kwargs.get("await_state")
    ignore_current = kwargs.get("ignore_current", False)
    fallback_to_any_in_compartment = kwargs.get(
        "fallback_to_any_in_compartment", False)

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    return_type = kwargs.get("return_type", core.RETURN_DICT)
    raise_exceptions = kwargs.get(
        "raise_exceptions",  # On internal call (RETURN_OBJ), raise exceptions
        True if return_type == core.RETURN_OBJ else not interactive)

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        if not ignore_current and bastion_name is None:
            bastion_id = configuration.get_current_bastion_id(
                bastion_id=bastion_id, config=config)

        import oci.exceptions
        try:
            # Initialize the Bastion client
            bastion_client = core.get_oci_bastion_client(config=config)

            if not interactive and not bastion_id and not bastion_name:
                raise ValueError('No bastion_id nor bastion_name given.')

            bastion = None

            if bastion_id:
                bastion = bastion_client.get_bastion(
                    bastion_id=bastion_id).data
                if not bastion:
                    raise ValueError('The bastion with the given OCID '
                        f'{bastion_id} was not found.')

            if not bastion and (bastion_name or interactive):
                # List the Bastion of the current compartment
                bastions = bastion_client.list_bastions(
                    compartment_id=compartment_id).data

                # Filter out all deleted compartments
                bastions = [
                    u for u in bastions if u.lifecycle_state != "DELETED"]

                if len(bastions) == 0:
                    if interactive:
                        print("No Bastions available in this compartment.")
                    return

                # If a bastion name was given, look it up
                if bastion_name:
                    for b in bastions:
                        if b.name == bastion_name:
                            bastion = bastion_client.get_bastion(
                                bastion_id=b.id).data
                            break

                    if not interactive:
                        raise ValueError(f"Bastion {bastion_name} was not "
                                         "found in this compartment.")

                # Fallback to first in compartment
                if fallback_to_any_in_compartment:
                    bastion = bastion_client.get_bastion(
                        bastion_id=bastions[0].id).data

            if not bastion and interactive:
                # If the user_name was not given or found, print out the list
                bastion_list = format_bastion_listing(items=bastions)
                if bastion_name is None:
                    print(bastion_list)

                # Let the user choose from the list
                selected_bastion = core.prompt_for_list_item(
                    item_list=bastions,
                    prompt_caption=("Please enter the name or index "
                                    "of the Bastion: "),
                    item_name_property="name", given_value=bastion_name)

                if selected_bastion:
                    bastion = bastion_client.get_bastion(
                        bastion_id=selected_bastion.id).data

            if bastion and await_state:
                import time
                if interactive:
                    print(f'Waiting for Bastion to reach '
                          f'{await_state} state...')

                bastion_id = bastion.id

                # Wait for the Bastion Session to reach state await_state
                cycles = 0
                while cycles < 48:
                    bastion = bastion_client.get_bastion(
                        bastion_id=bastion_id).data
                    if bastion.lifecycle_state == await_state:
                        break
                    else:
                        time.sleep(5)
                        s = "." * (cycles + 1)
                        if interactive:
                            print(f'Waiting for Bastion to reach '
                                  f'{await_state} state...{s}')
                    cycles += 1

                if bastion.lifecycle_state != await_state:
                    raise Exception("Bastion did not reach the state "
                                    f"{await_state} within 4 minutes.")

            return core.oci_object(
                oci_object=bastion,
                return_type=return_type,
                format_function=format_bastion_listing)
        except oci.exceptions.ServiceError as e:
            if interactive:
                raise
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
            return
    except Exception as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')


@plugin_function('mds.create.bastion', shell=True, cli=True, web=True)
def create_bastion(**kwargs):
    """Creates a Bastion

    Args:
        **kwargs: Additional options

    Keyword Args:
        bastion_name (str): The new name of the compartment.
        db_system_id (str): OCID of the DbSystem.
        client_cidr (str): The client CIDR, defaults to "0.0.0.0/0"
        max_session_ttl_in_seconds (int): The maximum amount of time that any
            session on the bastion can remain active, defaults to 10800
        target_subnet_id (str): The OCID of the subnet, defaults to the
            subnet of the db_system if db_system_id is given
        await_active_state (bool): Await the ACTIVE lifecycle state before 
            returning
        compartment_id (str): OCID of the compartment.
        config (dict): An OCI config object or None.
        config_profile (str): The name of an OCI config profile
        ignore_current (bool): Whether the current DbSystem should be ignored
        interactive (bool): Whether exceptions are raised
        return_type (str): "STR" will return a formatted string, "DICT" will
            return the object converted to a dict structure and "OBJ" will
            return the OCI Python object for internal plugin usage
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
       The id of the Bastion Session, None in interactive mode
    """

    bastion_name = kwargs.get("bastion_name")
    db_system_id = kwargs.get("db_system_id")
    client_cidr = kwargs.get("client_cidr", "0.0.0.0/0")
    max_session_ttl_in_seconds = kwargs.get(
        "max_session_ttl_in_seconds", 10800)
    target_subnet_id = kwargs.get("target_subnet_id")
    await_active_state = kwargs.get("await_active_state", False)

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("bastionconfigname")
    config_profile = kwargs.get("config_profile")
    ignore_current = kwargs.get("ignore_current", False)

    interactive = kwargs.get("interactive", core.get_interactive_default())
    return_type = kwargs.get(
        "return_type",  # In interactive mode, default to formatted str return
        core.RETURN_STR if interactive else core.RETURN_DICT)
    raise_exceptions = kwargs.get(
        "raise_exceptions",  # On internal call (RETURN_OBJ), raise exceptions
        True if return_type == core.RETURN_OBJ else not interactive)

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        current_compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        if not ignore_current:
            db_system_id = configuration.get_current_db_system_id(
                db_system_id=db_system_id, config=config)

        import oci.bastion.models
        import oci.mysql.models
        import oci.exceptions
        try:
            # Initialize the Bastion client
            bastion_client = core.get_oci_bastion_client(config=config)
            db_system = None

            if db_system_id:
                db_system = mysql_database_service.get_db_system(
                    db_system_id=db_system_id,
                    config=config, interactive=False,
                    return_python_object=True)
                if not db_system:
                    raise ValueError("No db_system found with the given id. "
                                     "Operation cancelled.")
            elif interactive:
                for_db_system = core.prompt(
                    "Should the new Bastion be used to connect to "
                    "a MySQL DB System? [Y/n]: ",
                    options={'defaultValue': 'y'})
                if not for_db_system:
                    raise ValueError("Operation cancelled.")

                if for_db_system.lower() == 'y':
                    db_system = mysql_database_service.get_db_system(
                        compartment_id=current_compartment_id,
                        config=config, interactive=interactive,
                        return_python_object=True)
                    if not db_system:
                        raise ValueError("Operation cancelled.")
            else:
                raise ValueError("No db_system_id given. "
                                 "Operation cancelled.")

            # Check if the db_system already has a Bastion set in the 
            # freeform_tags
            # if db_system and db_system.freeform_tags.get('bastion_id'):
            #     bastion = None
            #     # Check if that bastion still exists
            #     try:
            #         print("Check if that bastion still exists")
            #         bastion = get_bastion(
            #             bastion_id=db_system.freeform_tags.get('bastion_id'),
            #             return_type="OBJ",
            #             config=config, interactive=False)
            #     except ValueError:
            #         # If not, remove that old bastion id from the freeform_tags
            #         db_system.freeform_tags.pop('bastion_id', None)
            #         mysql_database_service.update_db_system(
            #             db_system_id=db_system.id,
            #             new_freeform_tags=db_system.freeform_tags,
            #             config=config, interactive=False)

            #     # If the assigned bastion does exist, error out
            #     if bastion and bastion.lifecycle_state == \
            #         oci.bastion.models.Bastion.LIFECYCLE_STATE_ACTIVE:
            #         raise ValueError(
            #             "The given MySQL DB System already has a Bastion "
            #             "assigned. Please remove 'bastion_id' from the "
            #             "freeform_tags to create a new Bastion for this "
            #             "DB System. Operation cancelled.")

            # If a db_system was given, take the compartment_id from there
            if not compartment_id and db_system:
                compartment_id = db_system.compartment_id
            elif not compartment_id:
                compartment_id = current_compartment_id

            if not bastion_name:
                if db_system:
                    import re

                    vcn_client = core.get_oci_virtual_network_client(
                        config=config)

                    subnet = vcn_client.get_subnet(
                        subnet_id=db_system.subnet_id).data
                    
                    # Get a unique name for the new bastion, ensure it does
                    # not collide with another bastion in the compartment and
                    # that it only contains of alphanumeric characters
                    bastion_core_name = (
                        "Bastion4" + 
                        re.sub('[\W_]+', '', subnet.display_name[:35]))
                    bastion_name = bastion_core_name

                    bastions = list_bastions(
                        compartment_id=compartment_id,
                        config=config, interactive=False,
                        return_type="OBJ", raise_exceptions=True)
                    b_nr = 2
                    name_found = False

                    # Keep increasing the trailing number till a unique name is 
                    # found
                    while not name_found:
                        name_found = True
                        for b in bastions:
                            if b.name == bastion_name:
                                bastion_name = f'{bastion_core_name}{b_nr}'
                                name_found = False
                                b_nr += 1
                                break

                elif interactive:
                    bastion_name = core.prompt(
                        'Please enter a name for this new Bastion: ')
                    if not bastion_name:
                        raise ValueError("Operation cancelled.")
            if not bastion_name:
                raise ValueError("No bastion_name given. "
                                 "Operation cancelled.")

            if not target_subnet_id:
                if db_system:
                    target_subnet_id = db_system.subnet_id
                elif interactive:
                    # Get private subnet
                    subnet = network.get_subnet(
                        public_subnet=False,
                        compartment_id=compartment_id, config=config,
                        interactive=interactive)
                    if subnet is None:
                        print("Operation cancelled.")
                        return
                    target_subnet_id = subnet.id
                else:
                    raise ValueError("No target_subnet_id given. "
                                     "Operation cancelled.")

            bastion_details = oci.bastion.models.CreateBastionDetails(
                bastion_type="standard",
                client_cidr_block_allow_list=[client_cidr],
                compartment_id=compartment_id,
                max_session_ttl_in_seconds=max_session_ttl_in_seconds,
                name=bastion_name,
                target_subnet_id=target_subnet_id
            )

            # Create the new bastion
            new_bastion = bastion_client.create_bastion(
                create_bastion_details=bastion_details).data

            # Update the db_system freeform_tags to hold the assigned bastion 
            # if db_system:
            #     print("Update the db_system freeform_tags to hold the assigned bastion ")
            #     db_system.freeform_tags["bastion_id"] = new_bastion.id

            #     mysql_database_service.update_db_system(
            #         db_system_id=db_system.id,
            #         new_freeform_tags=db_system.freeform_tags,
            #         config=config, interactive=False)

            if new_bastion and await_active_state:
                import time
                if interactive:
                    print(f'Waiting for Bastion to reach '
                          f'ACTIVE state...')

                bastion_id = new_bastion.id

                # Wait for the Bastion Session to reach state await_state
                cycles = 0
                while cycles < 60:
                    bastion = bastion_client.get_bastion(
                        bastion_id=bastion_id).data
                    if bastion.lifecycle_state == "ACTIVE":
                        break
                    else:
                        time.sleep(5)
                        s = "." * (cycles + 1)
                        if interactive:
                            print(f'Waiting for Bastion to reach '
                                  f'ACTIVE state...{s}')
                    cycles += 1

                if bastion.lifecycle_state != "ACTIVE":
                    raise Exception("Bastion did not reach the state "
                                    f"ACTIVE within 5 minutes.")

                return core.oci_object(
                    oci_object=bastion,
                    return_type=return_type,
                    format_function=lambda b: print(
                        f"Bastion {b.name} has been created."))

            else:
                return core.oci_object(
                    oci_object=new_bastion,
                    return_type=return_type,
                    format_function=lambda b: print(
                        f"Bastion {b.name} is being "
                        f"created. Use mds.list.bastions() to check "
                        "it's provisioning state.\n"))

        except oci.exceptions.ServiceError as e:
            if raise_exceptions:
                raise
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
    except Exception as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')


@plugin_function('mds.delete.bastion', shell=True, cli=True, web=True)
def delete_bastion(**kwargs):
    """Deletes a Bastion with the given id

    If no id is given, it will prompt the user for the id.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        bastion_name (str): The new name bastion
        bastion_id (str): OCID of the bastion.
        await_deletion (bool): Whether to wait till the bastion reaches
            lifecycle state DELETED
        compartment_id (str): OCID of the compartment.
        config (dict): An OCI config object or None.
        config_profile (str): The name of an OCI config profile
        ignore_current (bool): Whether the current bastion should be ignored
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
       None
    """

    bastion_name = kwargs.get("bastion_name")
    bastion_id = kwargs.get("bastion_id")
    await_deletion = kwargs.get("await_deletion")

    compartment_id = kwargs.get("compartment_id")
    ignore_current = kwargs.get("ignore_current", True)
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)

    import mysqlsh

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        if not ignore_current and bastion_name is None:
            bastion_id = configuration.get_current_bastion_id(
                bastion_id=bastion_id, config=config)

        import oci.identity
        import oci.mysql
        try:
            bastion = get_bastion(
                bastion_name=bastion_name,
                bastion_id=bastion_id, compartment_id=compartment_id,
                config=config, ignore_current=ignore_current,
                interactive=interactive, return_type=core.RETURN_OBJ)
            if not bastion:
                raise ValueError(
                    "No bastion given or found. "
                    "Operation cancelled.")
            bastion_id = bastion.id

            if interactive:
                # Prompt the user for specifying a compartment
                prompt = mysqlsh.globals.shell.prompt(
                    f"Are you sure you want to delete the Bastion "
                    f"{bastion.name} [yes/NO]: ",
                    {'defaultValue': 'no'}).strip().lower()
                if prompt != "yes":
                    raise Exception("Deletion aborted.\n")

            # Initialize the Bastion client
            bastion_client = core.get_oci_bastion_client(config=config)

            bastion_client.delete_bastion(bastion_id=bastion_id)

            # Get db_system client
            db_system_client = core.get_oci_db_system_client(config=config)

            # Update db_systems in the compartment and remove the bastion_id
            # db_systems = mysql_database_service.list_db_systems(
            #     compartment_id=bastion.compartment_id,
            #     config=config, interactive=False)
            # for db_system in db_systems:
            #     if "bastion_id" in db_system.get("freeform_tags"):
            #         if db_system.get("freeform_tags").get("bastion_id") == \
            #                 bastion_id:
            #             # Remove the "bastion_id" key from the dict
            #             db_system.get("freeform_tags").pop("bastion_id")

            #             # Update the db_system
            #             update_details = oci.mysql.models.UpdateDbSystemDetails(
            #                 freeform_tags=db_system.get("freeform_tags"))
            #             db_system_client.update_db_system(
            #                 db_system.get("id"), update_details)

            # If the current bastion has been deleted, clear it
            if configuration.get_current_bastion_id(
                    config=config) == bastion_id:
                configuration.set_current_bastion(bastion_id='')

            # If the function should wait till the bastion reaches the DELETED
            # lifecycle state
            if await_deletion:
                import time
                if interactive:
                    print('Waiting for Bastion to be deleted...')

                # Wait for the Bastion Session to be ACTIVE
                cycles = 0
                while cycles < 48:
                    bastion = bastion_client.get_bastion(
                        bastion_id=bastion_id).data
                    if bastion.lifecycle_state == "DELETED":
                        break
                    else:
                        time.sleep(5)
                        s = "." * (cycles + 1)
                        if interactive:
                            print(f'Waiting for Bastion to be deleted...{s}')
                    cycles += 1

                if bastion.lifecycle_state != "DELETED":
                    raise Exception("Bastion did not reach the DELETED "
                                    "state within 4 minutes.")
                if interactive:
                    print(
                        f"Bastion '{bastion.name}' was deleted successfully.")
            elif interactive:
                print(f"Bastion '{bastion.name}' is being deleted.")

        except oci.exceptions.ServiceError as e:
            if interactive:
                raise
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
    except (Exception) as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')


@plugin_function('mds.list.bastionSessions', shell=True, cli=True, web=True)
def list_sessions(**kwargs):
    """Lists bastion sessions

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        bastion_id (str): OCID of the bastion.
        ignore_current (bool): Whether to not default to the current bastion.
        compartment_id (str): OCID of the parent compartment.
        config (object): An OCI config object or None.
        config_profile (str): The name of an OCI config profile
        interactive (bool): Whether output is more descriptive
        return_type (str): "STR" will return a formatted string, "DICT" will
            return the object converted to a dict structure and "OBJ" will
            return the OCI Python object for internal plugin usage
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
        A list of dicts representing the bastions
    """

    bastion_id = kwargs.get("bastion_id")
    ignore_current = kwargs.get("ignore_current", False)
    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    return_type = kwargs.get(
        "return_type",  # In interactive mode, default to formatted str return
        core.RETURN_STR if interactive else core.RETURN_DICT)
    raise_exceptions = kwargs.get(
        "raise_exceptions",  # On internal call (RETURN_OBJ), raise exceptions
        True if return_type == core.RETURN_OBJ else not interactive)

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        current_bastion_id = configuration.get_current_bastion_id(
            config=config)

        import oci.exceptions
        try:
            # Initialize the  Object Store client
            bastion_client = core.get_oci_bastion_client(config=config)

            if not bastion_id and not ignore_current:
                bastion_id = current_bastion_id

            bastion = get_bastion(
                bastion_id=bastion_id,
                compartment_id=compartment_id, config=config,
                ignore_current=ignore_current, interactive=interactive,
                return_type=core.RETURN_OBJ)

            sessions = bastion_client.list_sessions(bastion_id=bastion.id).data

            # Filter out all deleted sessions
            # bastions = [s for s in sessions if s.lifecycle_state != "DELETED"]

            ext_sessions = []
            for s in sessions:
                if s.lifecycle_state != "DELETED":
                    ext_sessions.append(
                        bastion_client.get_session(session_id=s.id).data)
                else:
                    ext_sessions.append(s)

            if len(ext_sessions) < 1 and interactive:
                print("This bastion contains no sessions.")

            return core.oci_object(
                oci_object=ext_sessions,
                return_type=return_type,
                format_function=format_session_listing)
        except oci.exceptions.ServiceError as e:
            if raise_exceptions:
                raise
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
    except Exception as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')


@plugin_function('mds.get.bastionSession', shell=True, cli=True, web=True)
def get_session(**kwargs):
    """Gets a Bastion Session with the given id

    If no id is given, it will prompt the user for the id.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        session_name (str): The name of the session.
        session_id (str): OCID of the session.
        bastion_id (str): OCID of the bastion.
        compartment_id (str): OCID of the compartment.
        config (dict): An OCI config object or None.
        config_profile (str): The name of an OCI config profile
        ignore_current (bool): Whether the current bastion should be ignored
        interactive (bool): Whether exceptions are raised
        return_type (str): "STR" will return a formatted string, "DICT" will
            return the object converted to a dict structure and "OBJ" will
            return the OCI Python object for internal plugin usage
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
       None
    """

    session_name = kwargs.get("session_name")
    session_id = kwargs.get("session_id")
    bastion_id = kwargs.get("bastion_id")
    compartment_id = kwargs.get("compartment_id")
    ignore_current = kwargs.get("ignore_current", False)
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    return_type = kwargs.get("return_type", core.RETURN_DICT)
    raise_exceptions = kwargs.get(
        "raise_exceptions",  # On internal call (RETURN_OBJ), raise exceptions
        True if return_type == core.RETURN_OBJ else not interactive)

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        import oci.exceptions
        try:
            # Initialize the Bastion client
            bastion_client = core.get_oci_bastion_client(config=config)

            if session_id:
                return bastion_client.get_session(session_id=session_id).data

            if not bastion_id and interactive:
                bastion_id = get_bastion(
                    compartment_id=compartment_id,
                    config=config, ignore_current=ignore_current,
                    interactive=interactive, return_type=core.RETURN_OBJ).id
            if not bastion_id:
                raise Exception("No bastion_id given. "
                                "Cancelling operation.")

            # List the Bastion of the current compartment
            sessions = bastion_client.list_sessions(bastion_id=bastion_id).data

            if len(sessions) == 0:
                print("No Bastions available in this compartment.")
                return

            # If the user_name was not given or found, print out the list
            sessions_list = format_session_listing(sessions)
            if session_name is None:
                print(sessions_list)

            # Let the user choose from the list
            selected_session = core.prompt_for_list_item(
                item_list=sessions,
                prompt_caption=("Please enter the name or index "
                                "of the Bastion Session: "),
                item_name_property="display_name", given_value=session_name)

            session = bastion_client.get_session(
                session_id=selected_session.id).data

            return core.oci_object(
                oci_object=session,
                return_type=return_type,
                format_function=format_session_listing)
        except oci.exceptions.ServiceError as e:
            if raise_exceptions:
                raise
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
    except (ValueError, oci.exceptions.ClientError) as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')


@plugin_function('mds.create.bastionSession', shell=True, cli=True, web=True)
def create_session(**kwargs):
    """Creates a Bastion Session for the given bastion_id

    If no id is given, it will prompt the user for the id.

    Args:
        **kwargs: Additional options

    Keyword Args:
        bastion_name (str): The new name of the compartment.
        bastion_id (str): OCID of the Bastion.
        fallback_to_any_in_compartment (bool): Fallback to first bastion in
            the given compartment
        session_type (str): The type of the session, either MANAGED_SSH or
            PORT_FORWARDING
        session_name (str): The name of the session.
        target_id (str): OCID of the session target.
        target_ip (str): The TCP/IP address of the session target.
        target_port (str): The TCP/IP Port of the session target.
        target_user (str): The user account on the session target.
        ttl_in_seconds (int): Time to live for the session, max 10800.
        public_key_file (str): The filename of a public SSH key.
        public_key_content (str): The public SSH key.
        await_creation (bool): Whether to wait till the bastion reaches
            lifecycle state ACTIVE
        compartment_id (str): OCID of the compartment.
        config (dict): An OCI config object or None.
        config_profile (str): The name of an OCI config profile
        ignore_current (bool): Whether the current Bastion should be ignored
        interactive (bool): Whether exceptions are raised
        return_type (str): "STR" will return a formatted string, "DICT" will
            return the object converted to a dict structure and "OBJ" will
            return the OCI Python object for internal plugin usage
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
       The id of the Bastion Session, None in interactive mode
    """

    bastion_name = kwargs.get("bastion_name")
    bastion_id = kwargs.get("bastion_id")
    session_type = kwargs.get("session_type")
    session_name = kwargs.get("session_name")
    target_id = kwargs.get("target_id")
    target_ip = kwargs.get("target_ip")
    target_port = kwargs.get("target_port")
    target_user = kwargs.get("target_user")
    ttl_in_seconds = kwargs.get("ttl_in_seconds", 10800)
    public_key_file = kwargs.get("public_key_file")
    public_key_content = kwargs.get("public_key_content")

    await_creation = kwargs.get("await_creation")

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("bastionconfigname")
    config_profile = kwargs.get("config_profile")
    ignore_current = kwargs.get("ignore_current", False)
    fallback_to_any_in_compartment = kwargs.get(
        "fallback_to_any_in_compartment", False)

    interactive = kwargs.get("interactive", core.get_interactive_default())
    return_type = kwargs.get(
        "return_type",  # In interactive mode, default to formatted str return
        core.RETURN_STR if interactive else core.RETURN_DICT)
    raise_exceptions = kwargs.get(
        "raise_exceptions",  # On internal call (RETURN_OBJ), raise exceptions
        True if return_type == core.RETURN_OBJ else not interactive)

    from datetime import datetime

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(
            config=config,
            config_profile=config_profile, interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        if not ignore_current and not bastion_name:
            bastion_id = configuration.get_current_bastion_id(
                bastion_id=bastion_id, config=config)

        # Initialize the Bastion client
        bastion_client = core.get_oci_bastion_client(config=config)

        if not bastion_id and (bastion_name or interactive):
            bastion_id = get_bastion(
                bastion_name=bastion_name,
                fallback_to_any_in_compartment=fallback_to_any_in_compartment,
                compartment_id=compartment_id,
                config=config, ignore_current=ignore_current,
                interactive=interactive, return_type=core.RETURN_OBJ).id

        if not bastion_id:
            raise ValueError("No bastion_id or bastion_name specified.")

        if session_type == "MANAGED_SSH":
            default_name = f'COMPUTE-{datetime.now():%Y%m%d-%H%M%S}'
        else:
            default_name = f'MDS-{datetime.now():%Y%m%d-%H%M%S}'

        if not session_name and interactive:
            session_name = core.prompt(
                "Please specify a name for the Bastion Session "
                f"({default_name}): ",
                {'defaultValue': default_name}).strip()

        if not session_type and interactive:
            session_type = core.prompt_for_list_item(
                item_list=["MANAGED_SSH", "PORT_FORWARDING"],
                prompt_caption=(
                    "Please select the Bastion Session type "
                    "(PORT_FORWARDING): "),
                print_list=True,
                prompt_default_value="PORT_FORWARDING")

        if not session_type:
            raise ValueError("No session_type given. "
                             "Operation cancelled.")

        if session_type == "MANAGED_SSH":
            if not target_id and interactive:
                instance = compute.get_instance(
                    compartment_id=compartment_id, config=config,
                    interactive=interactive,
                    return_python_object=True)
                if not instance:
                    raise Exception("No target_id specified."
                                    "Cancelling operation")

                target_id = instance.id

            if target_id and not target_ip:
                vnics = compute.list_vnics(
                    instance_id=target_id,
                    compartment_id=compartment_id, config=config,
                    interactive=False,
                    return_python_object=True)
                for vnic in vnics:
                    if vnic.private_ip:
                        target_ip = vnic.private_ip
                        break
                if not target_ip:
                    raise ValueError(
                        'No private IP found for this compute instance.')

            if not target_port:
                target_port = 22

            if not target_user:
                target_user = "opc"
        else:
            if not target_ip and interactive:
                db_system = mysql_database_service.get_db_system(
                    compartment_id=compartment_id, config=config,
                    return_python_object=True)
                if not db_system:
                    raise Exception("No target_id specified."
                                    "Cancelling operation")

                endpoint = db_system.endpoints[0]
                target_ip = endpoint.ip_address
                if not target_port:
                    target_port = endpoint.port

        if not target_ip:
            raise Exception("No target_ip specified."
                            "Cancelling operation")

        if not target_port:
            raise Exception("No target_port specified."
                            "Cancelling operation")

        if session_type == "MANAGED_SSH":
            if not target_id:
                raise Exception("No target_id specified."
                                "Cancelling operation")
            if not target_user:
                raise Exception("No target_user specified."
                                "Cancelling operation")

        # Convert Unix path to Windows
        import os.path
        ssh_key_location = os.path.abspath(os.path.expanduser("~/.ssh"))

        if not public_key_file and not public_key_content and interactive:
            from os import listdir

            files = [f for f in listdir(ssh_key_location)
                     if os.path.isfile(os.path.join(ssh_key_location, f)) and
                     f.lower().endswith(".pub")]

            public_key_file = core.prompt_for_list_item(
                item_list=files, print_list=True,
                prompt_caption="Please select a public SSH Key: ")
            if not public_key_file:
                raise Exception("No public SSH Key specified."
                                "Cancelling operation")

        default_key_file = os.path.join(ssh_key_location, "id_rsa.pub")
        if not public_key_file and os.path.exists(default_key_file):
            public_key_file = default_key_file

        if public_key_file and not public_key_content:
            with open(os.path.join(
                    ssh_key_location, public_key_file), 'r') as file:
                public_key_content = file.read()

        if not public_key_content:
            raise Exception("No public SSH Key specified. "
                            "Cancelling operation")

        import oci.identity
        import oci.bastion
        import hashlib
        try:
            if session_type == "MANAGED_SSH":
                target_details = oci.bastion.models.\
                    CreateManagedSshSessionTargetResourceDetails(
                        target_resource_id=target_id,
                        target_resource_port=target_port,
                        target_resource_private_ip_address=target_ip,
                        target_resource_operating_system_user_name=target_user)
            else:
                target_details = oci.bastion.models.\
                    CreatePortForwardingSessionTargetResourceDetails(
                        target_resource_id=target_id,
                        target_resource_port=target_port,
                        target_resource_private_ip_address=target_ip)

            if not session_name:
                # Calculate unique fingerprint based on all params
                params = (
                    target_id + bastion_id +
                    config_profile + public_key_content +
                    f'{target_ip}:{target_port}')

                fingerprint = hashlib.md5(params.encode('utf-8')).hexdigest()
                session_name = f'MDS-{fingerprint}'

            # Check if a session with this fingerprinted name already exists
            sessions = bastion_client.list_sessions(
                bastion_id=bastion_id,
                display_name=session_name,
                session_lifecycle_state='ACTIVE').data
            if len(sessions) == 1:
                # If so, return that session
                return core.oci_object(
                    oci_object=sessions[0],
                    return_type=return_type,
                    format_function=format_session_listing)

            if session_type == "MANAGED_SSH":
                # Check if Bastion Plugin is already enabled
                ia_client = core.get_oci_instance_agent_client(config)
                bastion_plugin = ia_client.get_instance_agent_plugin(
                    instanceagent_id=target_id,
                    compartment_id=compartment_id,
                    plugin_name="Bastion").data
                if bastion_plugin.status != "RUNNING":
                    # TODO: use UpdateInstanceDetails to enabled the bastion
                    # service
                    raise Exception(
                        'Please enabled the Bastion plugin on '
                        'this instance.')


            session_details = oci.bastion.models.CreateSessionDetails(
                bastion_id=bastion_id,
                display_name=session_name,
                key_details=oci.bastion.models.PublicKeyDetails(
                    public_key_content=public_key_content),
                key_type="PUB",
                session_ttl_in_seconds=ttl_in_seconds,
                target_resource_details=target_details
            )
            new_session = bastion_client.create_session(session_details).data

            if await_creation:
                import time
                # Wait for the Bastion Session to be ACTIVE
                cycles = 0
                while cycles < 24:
                    bastion_session = bastion_client.get_session(
                        session_id=new_session.id).data
                    if bastion_session.lifecycle_state == "ACTIVE":
                        # TODO: Report bug to the Bastion dev team.
                        # Ask them to only switch lifecycle_state to ACTIVE
                        # if the Bastion Session can actually accept connections
                        time.sleep(5)
                        break
                    else:
                        time.sleep(5)
                        s = "." * (cycles + 1)
                        if interactive:
                            print(f'Waiting for Bastion Session to become '
                                f'active...{s}')
                    cycles += 1

                bastion_session = bastion_client.get_session(
                    session_id=new_session.id).data
                if bastion_session.lifecycle_state != "ACTIVE":
                    raise Exception("Bastion Session did not reach ACTIVE "
                                    "state within 2 minutes.")

            return core.oci_object(
                oci_object=new_session,
                return_type=return_type,
                format_function=lambda s: print(
                    f"Bastion Session {s.display_name} is being\n"
                    f" created. Use mds.list.bastionSessions() to check "
                    "it's provisioning state.\n"))

        except oci.exceptions.ServiceError as e:
            if raise_exceptions:
                raise
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
    except Exception as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')


@plugin_function('mds.delete.bastionSession', shell=True, cli=True, web=True)
def delete_session(**kwargs):
    """Deletes a Bastion Session with the given id

    If no id is given, it will prompt the user for the id.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        session_name (str): The name of the bastion session
        session_id (str): The id of the bastion session
        bastion_name (str): The name of the bastion.
        bastion_id (str): OCID of the bastion.
        compartment_id (str): OCID of the compartment.
        config (dict): An OCI config object or None.
        config_profile (str): The name of an OCI config profile
        ignore_current (bool): Whether the current bastion should be ignored
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
       None
    """

    session_name = kwargs.get("session_name")
    session_id = kwargs.get("session_id")
    bastion_name = kwargs.get("bastion_name")
    bastion_id = kwargs.get("bastion_id")
    compartment_id = kwargs.get("compartment_id")
    ignore_current = kwargs.get("ignore_current", False)
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)

    import mysqlsh

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        if not ignore_current and bastion_name is None:
            bastion_id = configuration.get_current_bastion_id(
                bastion_id=bastion_id, config=config)

        import oci.exceptions
        try:
            if not session_id:
                bastion = get_bastion(
                    bastion_name=bastion_name,
                    bastion_id=bastion_id, compartment_id=compartment_id,
                    config=config, ignore_current=ignore_current,
                    interactive=interactive, return_type=core.RETURN_OBJ)
                if not bastion:
                    raise ValueError(
                        "No bastion given or found. "
                        "Operation cancelled.")

                session = get_session(
                    session_name=session_name, session_id=session_id,
                    bastion_id=bastion.id, compartment_id=compartment_id,
                    config=config, ignore_current=ignore_current,
                    interactive=interactive, return_type=core.RETURN_OBJ)
                if not session:
                    raise ValueError(
                        "No bastion session given or found. "
                        "Operation cancelled.")

                session_id = session.id

            if interactive:
                # Prompt the user for specifying a compartment
                prompt = mysqlsh.globals.shell.prompt(
                    f"Are you sure you want to delete the bastion session? "
                    f"[yes/NO]: ",
                    {'defaultValue': 'no'}).strip().lower()
                if prompt != "yes":
                    raise Exception("Deletion aborted.\n")

            # Initialize the Bastion client
            bastion_client = core.get_oci_bastion_client(config=config)

            bastion_client.delete_session(session_id=session_id)

            if interactive:
                print(f"The bastion session is being deleted.")

        except oci.exceptions.ServiceError as e:
            if interactive:
                raise
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
    except (Exception) as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')
