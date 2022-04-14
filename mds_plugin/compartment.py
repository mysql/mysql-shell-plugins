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

"""Sub-Module for supporting OCI Compartments"""

from mysqlsh.plugin_manager import plugin_function
from mds_plugin import core, configuration


def get_compartment_by_id(compartment_id, config, interactive=True):
    """Returns a compartment object for the given id

    Args:
        compartment_id (str): OCID of the compartment.
        config (object): An OCI config object or None.
        interactive (bool): If set to false exceptions are raised.

    Returns:
        The compartment or tenancy object with the given id
    """

    try:
        # Get the right config, either the one passed in or, if that one is None,
        # the global one
        config = configuration.get_current_config(config=config)

        import oci.identity

        # Initialize the identity client
        identity = core.get_oci_identity_client(config=config)

        if compartment_id == config.get("tenancy"):
            comp = identity.get_tenancy(config.get("tenancy")).data
        else:
            comp = identity.get_compartment(compartment_id).data

        return comp
    except oci.exceptions.ServiceError as e:
        if not interactive:
            raise
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except (ValueError, oci.exceptions.ClientError) as e:
        if not interactive:
            raise
        print(f'ERROR: {e}')
        return


def get_compartment_id_by_path(compartment_path, compartment_id=None,
                               config=None):
    """Gets a compartment by path

    Args:
        compartment_path (str): The path, either absolute starting with /
            or . or ..
        current_id (str): OCID of the parent compartment.
        config (object): An OCI config object or None.

    Returns:
        The OCID of the matching compartment
    """
    compartment = get_compartment_by_path(
        compartment_path=compartment_path,
        compartment_id=compartment_id, config=config)

    return None if compartment is None else compartment.id


def get_compartment_by_path(compartment_path, compartment_id=None,
                            config=None, interactive=True):
    """Gets a compartment by path

    Args:
        compartment_path (str): The path, either absolute starting with /
            or . or ..
        current_id (str): OCID of the parent compartment.
        config (object): An OCI config object or None.

    Returns:
        The matching compartment object
    """

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        import oci.identity
        import mysqlsh

        # If / was given, return the OCID of the tenancy
        if compartment_path == '/':
            return get_compartment_by_id(
                compartment_id=config.get('tenancy'), config=config)

        # If . was given, return the id of the current compartment
        if compartment_path == '.':
            return get_compartment_by_id(
                compartment_id=compartment_id, config=config)

        # Initialize the identity client
        identity = core.get_oci_identity_client(config=config)

        # If .. was given, return the parent compartment's or the tenancy itself
        # if the current compartment is the tenancy
        if compartment_path == '..':
            comp = get_compartment_by_id(
                compartment_id=compartment_id, config=config)
            if type(comp) == oci.identity.models.Tenancy:
                return comp
            else:
                return get_compartment_by_id(
                    compartment_id=comp.compartment_id, config=config)
        elif compartment_path.startswith("/"):
            # Lookup full path in the full compartment tree list
            data = identity.list_compartments(
                compartment_id=config.get("tenancy"),
                compartment_id_in_subtree=True).data

            # Filter out all deleted compartments
            data = [c for c in data if c.lifecycle_state != "DELETED"]

            path_items = compartment_path[1:].lower().split("/")
            full_path = ""
            i = 0
            parent_id = config.get("tenancy")
            # Walk the given compartment_path and try to find matching path
            while i < len(path_items):
                for c in data:
                    if c.compartment_id == parent_id and \
                            c.name.lower() == path_items[i]:
                        full_path = f"{full_path}/{c.name.lower()}"

                        if full_path == compartment_path.lower():
                            return c

                        parent_id = c.id

                        break
                i += 1
        else:
            # Lookup name in the current compartment's list of sub-compartments

            # List the compartments. If no compartment_id was given, take the id
            # from the tenancy and display full subtree of compartments
            data = identity.list_compartments(
                compartment_id=compartment_id,
                compartment_id_in_subtree=False).data

            # Filter out all deleted compartments
            data = [c for c in data if c.lifecycle_state != "DELETED"]

            for c in data:
                if c.name.lower() == compartment_path.lower():
                    return c

        return None
    except oci.exceptions.ServiceError as e:
        if not interactive:
            raise
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except Exception as e:
        if not interactive:
            raise
        print(f'ERROR: {e}')
        return


def get_parent_compartment(compartment, config):
    """Returns the parent compartment object for the given compartment

    Args:
        compartment (object): A compartment object.
        config (object): An OCI config object or None.

    Returns:
        The parent compartment object or None if the compartment is a tenancy
    """
    import oci.identity

    if compartment is None or compartment.id == config.get('tenancy'):
        return None
    else:
        # Initialize the identity client
        identity = core.get_oci_identity_client(config=config)

        parent_comp = identity.get_compartment(
            compartment.compartment_id).data

        return parent_comp


def get_compartment_full_path(compartment_id, config, interactive=True):
    """Returns the full path of a given compartment id

    Path seperator is /.

    Args:
        compartment_id (str): A OCID of the compartment.
        config (object): An OCI config object or None.
        interactive (bool): If set to false exceptions are raised.

    Returns:
        The full path of the compartment
    """
    import oci.identity
    import re

    # If the given compartment_id is the OCID of the tenancy return /
    if not compartment_id or compartment_id == config.get('tenancy'):
        return "/"
    else:
        # Initialize the identity client
        identity = core.get_oci_identity_client(config=config)

        # Get the full compartment tree item list of the tenancy
        try:
            comp_list = identity.list_compartments(
                compartment_id=config.get('tenancy'),
                compartment_id_in_subtree=True).data
        except oci.exceptions.ServiceError as e:
            if not interactive:
                raise
            print("Could not list all compartments.\n"
                  f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
            return
        except Exception as e:
            if not interactive:
                raise
            print(f'ERROR: {e}')
            return

        full_path = ""
        comp_id = compartment_id
        # repeat until the tenancy is reached
        while comp_id and comp_id != config.get('tenancy'):
            # look through complete tree item list
            id_not_found = True
            for c in comp_list:
                # if comp_id is found, insert comp into full_path and set
                # comp_id to parent
                if c.id == comp_id:
                    name = re.sub(r'[\n\r]', ' ',
                                  c.name[:22] + '..'
                                  if len(c.name) > 24
                                  else c.name)
                    full_path = f"/{name}{full_path}"
                    comp_id = c.compartment_id
                    id_not_found = False
                    break

            if id_not_found:
                if not interactive:
                    raise ValueError(
                        f"Compartment with id {comp_id} not found.")
                print(f"ERROR: Compartment with id {comp_id} not found.")
                break

        return full_path


def format_compartment_listing(data, current_compartment_id=None):
    """Returns a formatted list of compartments.

    If compartment_id is given, the current and parent compartment
    will be listed as well.

    Args:
        data (list): A list of compartment objects.

    Returns:
        The formated list as string
    """
    import re

    out = ""

    # return compartments in READABLE text output
    i = 1
    for c in data:
        # Shorten to 24 chars max, remove linebreaks
        name = re.sub(r'[\n\r]', ' ',
                      c.name[:22] + '..'
                      if len(c.name) > 24
                      else c.name)
        # Shorten to 54 chars max, remove linebreaks
        description = re.sub(r'[\n\r]', ' ',
                             c.description[:52] + '..'
                             if len(c.description) > 54
                             else c.description)

        index = f"*{i:>3}" if current_compartment_id == c.id else f"{i:>4}"
        out += f"{index} {name:24} {description:54} {c.lifecycle_state}\n"
        i += 1

    return out


def format_availability_domain_listing(data):
    """Returns a formatted list of availability domains
    Args:
        data (list): A list of availability domain objects.

    Returns:
        The formated list as string
    """
    import re

    out = ""

    # return compartments in READABLE text output
    i = 1
    for a in data:
        # Shorten to 24 chars max, remove linebreaks
        name = re.sub(r'[\n\r]', ' ',
                      a.name[:62] + '..'
                      if len(a.name) > 64
                      else a.name)

        out += f"{i:>4} {name:64}\n"
        i += 1

    return out


def format_availability_domain(items) -> str:
    """Formats a given list of objects in a human readable form

    Args:
        items: Either a list of objects or a single object

    Returns:
       The objects formated as str
    """

    # If a single db_system was given, wrap it in a list
    if not type(items) is list:
        items = [items]

    # return objects in READABLE text output
    out = ""
    for i in items:
        out += core.fixed_len(i.name, 32, '\n', True)

    return out


@plugin_function('mds.get.availabilityDomain', shell=True, cli=True, web=True)
def get_availability_domain(**kwargs):
    """Returns the name of a randomly chosen availability_domain

    If a name is given, it will be checked if that name actually exists
    in the current compartment

    Args:
        **kwargs: Additional options

    Keyword Args:
        availability_domain (str): The name of the availability_domain.
        random_selection (bool): Whether a random selection should be made
        compartment_id (str): OCID of the parent compartment.
        config (dict): An OCI config object or None
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised
        return_formatted (bool): If true a human readable string is returned
        return_python_object (bool): Used for internal plugin calls

    Returns:
        The availability_domain
    """

    availability_domain = kwargs.get("availability_domain")
    random_selection = kwargs.get("random_selection", True)

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)
    return_python_object = kwargs.get("return_python_object", False)

    try:
        # Get the active config and compartment
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        import oci.identity
        import oci.exceptions
        import random

        try:
            # Initialize the identity client
            identity = core.get_oci_identity_client(config=config)

            # Get availability domains
            availability_domains = identity.list_availability_domains(
                compartment_id).data

            # Lookup id and proper name of availability_domain
            availability_domain_obj = None
            if availability_domain:
                for ad in availability_domains:
                    if ad.name.lower() == availability_domain.lower():
                        availability_domain_obj = ad
                        break
                if not availability_domain_obj or \
                        availability_domain_obj.name == "":
                    raise Exception(
                        f"The given availability domain {availability_domain} "
                        "was not found.")

            # If the user did not specify a availability_domain use a random one
            if not availability_domain_obj:
                if len(availability_domains) == 0:
                    raise Exception("No availability domain available.")
                elif len(availability_domains) == 1:
                    availability_domain_obj = availability_domains[0]
                elif random_selection:
                    index = random.randrange(len(availability_domains))
                    availability_domain_obj = availability_domains[index]
                elif interactive:
                    availability_domain_obj = core.prompt_for_list_item(
                        item_list=availability_domains, prompt_caption=(
                            "Please enter the name or index of the "
                            "availability domain: "),
                        item_name_property="name",
                        print_list=True)

            if not availability_domain_obj:
                raise Exception("No availability domain specified.")

            return core.return_oci_object(
                oci_object=availability_domain_obj,
                return_formatted=return_formatted,
                return_python_object=return_python_object,
                format_function=format_availability_domain)
        except oci.exceptions.ServiceError as e:
            if e.code == "NotAuthorizedOrNotFound":
                error = (f'You do not have privileges to list the  '
                    f'availabilitydomains for this compartment.\n')
            else:
                error = (f'Could not list the availability domains for this '
                    f'compartment.\n')
            error += f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})'
            if raise_exceptions:
                raise Exception(error)
            print(error)
    except Exception as e:
        if raise_exceptions:
            raise
        print(f'Could not list the availability domains for this '
              f'compartment.\nERROR: {str(e)}')


@plugin_function('mds.list.compartments', shell=True, cli=True, web=True)
def list_compartments(**kwargs):
    """Lists compartments

    This function will list all sub-compartments of the compartment with the
    given compartment_id. If compartment_id is omitted, all compartments of
    the tenancy are listed.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        compartment_id (str): OCID of the parent compartment
        include_tenancy (bool): Whether to include the tenancy as compartment
        config (dict): An OCI config object or None
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised
        return_formatted (bool): If set to true, a list object is returned

    Returns:
        A list of dicts representing the compartments
    """

    compartment_id = kwargs.get("compartment_id")
    include_tenancy = kwargs.get("include_tenancy", compartment_id is None)

    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)

    try:
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)

        import oci.identity
        import oci.util
        import oci.pagination

        # If no compartment_id is given, return full subtree of the tenancy
        if compartment_id is None:
            full_subtree = True
            compartment_id = config["tenancy"]
        else:
            full_subtree = False

        # Initialize the identity client
        identity = core.get_oci_identity_client(config=config)

        # List the compartments
        data = oci.pagination.list_call_get_all_results(
                identity.list_compartments,
                compartment_id=compartment_id,
                access_level="ANY",
                compartment_id_in_subtree=full_subtree,
                limit=1000).data

        current_compartment_id = configuration.get_current_compartment_id(
            profile_name=config_profile)

        # Filter out all deleted compartments
        data = [c for c in data if c.lifecycle_state != "DELETED"]

        if include_tenancy:
            tenancy = oci.identity.models.Compartment(
                id=config["tenancy"],
                name="/ (Root Compartment)",
                description="The tenancy is the root compartment.",
                freeform_tags={},
                time_created="2020-01-01T00:00:00.000000+00:00"
            )
            tenancy.lifecycle_state = "ACTIVE"
            tenancy.defined_tags = {}
            data.append(tenancy)

        if return_formatted:
            return format_compartment_listing(
                data,
                current_compartment_id=current_compartment_id)
        else:
            compartments = oci.util.to_dict(data)
            for compartment in compartments:
                compartment['is_current'] = (
                    compartment['id'] == current_compartment_id)
            return compartments
    except oci.exceptions.ServiceError as e:
        if raise_exceptions:
            raise
        else:
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
    except Exception as e:
        if raise_exceptions:
            raise
        else:
            print(f'ERROR: {e}')


@plugin_function('mds.get.compartment', shell=True, cli=True, web=True)
def get_compartment(compartment_path=None, **kwargs):
    """Gets a compartment by path

    If the path was not specified or does not match an existing compartment,
    show the user a list to select a compartment

    Args:
        compartment_path (str): The name of the compartment
        **kwargs: Optional parameters

    Keyword Args:
        parent_compartment_id (str): OCID of the parent compartment.
        config (object): An OCI config object or None.

    Returns:
        The compartment object
    """

    parent_compartment_id = kwargs.get("parent_compartment_id")
    config = kwargs.get("config")

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=parent_compartment_id, config=config)
    except ValueError as e:
        print(f"ERROR: {str(e)}")
        return

    import oci.identity
    import mysqlsh

    # Start with an empty compartment
    compartment = None

    # If a compartment path was given, look it up
    if compartment_path is not None:
        compartment = get_compartment_by_path(
            compartment_path, compartment_id, config)
        if compartment is not None:
            return compartment
        else:
            print(f"The compartment with the path {compartment_path} was not "
                  f"found.\nPlease select another compartment.\n")

    # Initialize the identity client
    identity = core.get_oci_identity_client(config=config)

    # List the compartments. If no compartment_id was given, take the id from
    # the tenancy and display full subtree of compartments
    data = identity.list_compartments(
        compartment_id=compartment_id,
        compartment_id_in_subtree=False).data

    # Filter out all deleted compartments
    data = [c for c in data if c.lifecycle_state != "DELETED"]

    # Print special path descriptions
    full_path = get_compartment_full_path(compartment_id, config)
    is_tenancy = compartment_id == config.get('tenancy')
    print(f"Directory of compartment {full_path}"
          f"{' (the tenancy)' if is_tenancy else ''}\n")
    if compartment_id != config.get("tenancy"):
        print("   / Root compartment (the tenancy)\n"
              "   . Current compartment\n"
              "  .. Parent compartment\n")

    # If the compartment_name was not given or found, print out the list
    comp_list = format_compartment_listing(data)
    if comp_list == "":
        comp_list = "Child Compartments:\n   - None\n"
    print(comp_list)

    # Let the user choose from the list
    while compartment is None:
        # Prompt the user for specifying a compartment
        prompt = mysqlsh.globals.shell.prompt(
            "Please enter the name, index or path of the compartment: ",
            {'defaultValue': ''}).strip().lower()

        if prompt == "":
            return

        try:
            if prompt.startswith('/'):
                if prompt == '/':
                    # The compartment will be the tenancy
                    compartment = get_compartment_by_id(
                        compartment_id=config.get('tenancy'), config=config)
                    continue
                else:
                    # Get the compartment by full path
                    compartment = get_compartment_by_path(
                        compartment_path=prompt, compartment_id=compartment_id,
                        config=config)
                    if compartment is None:
                        raise ValueError
                    continue
            elif prompt == '.':
                # The compartment will be the current compartment
                compartment = get_compartment_by_id(
                    compartment_id=compartment_id, config=config)
                continue
            elif prompt == '..':
                # The compartment will be the parent compartment or none
                compartment = get_parent_compartment(
                    get_compartment_by_id(
                        compartment_id=compartment_id, config=config),
                    config=config)
                if compartment is None:
                    raise ValueError
                continue

            try:
                # If the user provided an index, try to map that to a compartment
                nr = int(prompt)
                if nr > 0 and nr <= len(data):
                    compartment = data[nr - 1]
                else:
                    raise IndexError
            except ValueError:
                # Search by name
                for c in data:
                    if c.name.lower() == prompt:
                        compartment = c
                        break
                if compartment is None:
                    raise ValueError

        except ValueError:
            print(
                f'The compartment {prompt} was not found. Please try again.\n')
        except IndexError:
            print(f'A compartment with the index {prompt} was not found. '
                  f'Please try again.\n')

    return compartment


@plugin_function('mds.get.compartmentId')
def get_compartment_id(compartment_path=None, **kwargs):
    """Gets a compartment OCID by path

    If the path was not specified or does not match an existing compartment,
    show the user a list to select a compartment

    Args:
        compartment_path (str): The name of the compartment
        **kwargs: Optional parameters

    Keyword Args:
        parent_compartment_id (str): OCID of the parent compartment.
        config (object): An OCI config object or None.


    Returns:
        The OCID of a compartment
    """

    compartment = get_compartment(
        compartment_path=compartment_path,
        compartment_id=kwargs.get("parent_compartment_id"),
        config=kwargs.get("config"))

    return None if compartment is None else compartment.id


@plugin_function('mds.create.compartment')
def create_compartment(**kwargs):
    """Creates a new compartment

    This function will create a new compartment.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        name (str): The name used for the new compartment.
        description (str): A description used for the new compartment.
        parent_compartment_id (str): OCID of the parent compartment.
        config (object): An OCI config object or None.
        return_object (bool): Whether to return the object
        interactive (bool): Whether exceptions are raised

    Returns:
        The new compartment if return_object is set to true
    """

    name = kwargs.get("name")
    description = kwargs.get("description")
    parent_compartment_id = kwargs.get("parent_compartment_id")
    config = kwargs.get("config")
    return_object = kwargs.get("return_object", False)
    interactive = kwargs.get("interactive", True)

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)
        parent_compartment_id = configuration.get_current_compartment_id(
            compartment_id=parent_compartment_id, config=config)

        import oci.identity
        import mysqlsh

        # Get a name
        if name is None and interactive:
            name = mysqlsh.globals.shell.prompt(
                "Please enter the name for the new compartment: ",
                {'defaultValue': ''}).strip()
            if name == "":
                print("Operation cancelled.")
                return

        # Get a description
        if description is None and interactive:
            description = mysqlsh.globals.shell.prompt(
                "Please enter a description for the new compartment [-]: ",
                {'defaultValue': '-'}).strip()
            if description == "":
                print("Operation cancelled.")
                return

        # Initialize the identity client
        identity = core.get_oci_identity_client(config=config)

        # Setup the compartment details
        compartment_details = oci.identity.models.CreateCompartmentDetails(
            compartment_id=parent_compartment_id,
            name=name,
            description=description if description is not None else "-"
        )

        # Create the compartment
        compartment = identity.create_compartment(compartment_details).data

        print(f"Compartment {name} is being created.\n")

        if return_object:
            return compartment
    except oci.exceptions.ServiceError as e:
        if interactive:
            raise
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except (ValueError, oci.exceptions.ClientError) as e:
        if interactive:
            raise
        print(f'ERROR: {e}')


@plugin_function('mds.delete.compartment')
def delete_compartment(compartment_path=None, **kwargs):
    """Deletes the compartment with the given id

    If no id is given, it will prompt the user for the id.

    Args:
        compartment_path (str): The full path to the compartment
        **kwargs: Optional parameters

    Keyword Args:
        compartment_id (str): OCID of the compartment.
        config (object): An OCI config object or None.
        interactive (bool): Whether exceptions are raised

    Returns:
       None
    """

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    interactive = kwargs.get("interactive")

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)

        import oci.identity
        import mysqlsh

        compartment = get_compartment(
            compartment_path=compartment_path, compartment_id=compartment_id,
            config=config)
        if compartment is None:
            print("Operation cancelled.")
            return

        # Initialize the identity client
        identity = core.get_oci_identity_client(config=config)

        # Prompt the user for specifying a compartment
        prompt = mysqlsh.globals.shell.prompt(
            f"Are you sure you want to delete the compartment {compartment.name} "
            f"[yes/NO]: ",
            {'defaultValue': 'no'}).strip().lower()

        if prompt != "yes":
            print("Deletion aborted.\n")
            return

        identity.delete_compartment(compartment.id)

        print(f"Compartment {compartment.name} is being deleted.")
    except oci.exceptions.ServiceError as e:
        if interactive:
            raise
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except (ValueError, oci.exceptions.ClientError) as e:
        if interactive:
            raise
        print(f'ERROR: {e}')


@plugin_function('mds.update.compartment')
def update_compartment(compartment_path=None, **kwargs):
    """Updates the compartment with the given id

    If no id is given, it will prompt the user for the id.

    Args:
        compartment_path (str): The name or path of the compartment to update.
        **kwargs: Optional parameters

    Keyword Args:
        name (str): The new name of the compartment.
        description (str): The new description of the compartment.
        compartment_id (str): OCID of the compartment.
        config (object): An OCI config object or None.
        interactive (bool): Whether exceptions are raised

    Returns:
       None
    """

    name = kwargs.get("name")
    description = kwargs.get("description")
    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    interactive = kwargs.get("interactive", True)

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)

        import oci.identity
        import mysqlsh

        # If a compartment_path was given, look the compartment up
        if compartment_path is not None and compartment_path != "":
            compartment = get_compartment_by_path(compartment_path, config)
        elif compartment_id is not None:
            # If the compartment_id was given, use that
            compartment = get_compartment_by_id(compartment_id, config)
        else:
            # Otherwise ask the user to select a compartment
            print("Please specify the compartment that should be updated.\n")
            try:
                compartment = get_compartment(
                    compartment_id=compartment_id,
                    config=config)
            except Exception as e:
                print(f"ERROR: Could not get compartment_id. {e}")
                return

        if compartment is None:
            print("Operation cancelled.")
            return

        # Initialize the identity client
        identity = core.get_oci_identity_client(config=config)

        # Prompt the user for the new values
        if name is None:
            name = mysqlsh.globals.shell.prompt(
                f"Please enter a new name for the compartment [{compartment.name}]: ",
                {'defaultValue': compartment.name}).strip()
        if description is None:
            description = mysqlsh.globals.shell.prompt(
                f"Please enter a new description [current description]: ",
                {'defaultValue': compartment.description}).strip()

        update_details = oci.identity.models.UpdateCompartmentDetails(
            name=name,
            description=description
        )
        identity.update_compartment(compartment.id, update_details)

        print(f"Compartment {compartment.name} is being updated.")
    except oci.exceptions.ServiceError as e:
        if interactive:
            raise
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except (ValueError, oci.exceptions.ClientError) as e:
        if interactive:
            raise
        print(f'ERROR: {e}')


@plugin_function('mds.list.availabilityDomains')
def list_availability_domains(**kwargs):
    """Lists Availability Domains

    This function will list all Availability Domains of the given compartment

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        compartment_id (str): OCID of the parent compartment.
        config (dict): An OCI config object or None.
        interactive (bool): If set to false exceptions are raised
        return_formatted (bool): If set to true, a list object is returned.

    Returns:
        A list of Availability Domains
    """

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    interactive = kwargs.get("interactive", True)
    return_formatted = kwargs.get("return_formatted", True)

    try:
        # Get the active config and compartment
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        import oci.identity
        import oci.util

        # Initialize the identity client
        identity = core.get_oci_identity_client(config=config)

        # List availability domains
        data = identity.list_availability_domains(
            compartment_id).data

        if return_formatted:
            return format_availability_domain_listing(data)
        else:
            return oci.util.to_dict(data)
    except oci.exceptions.ServiceError as e:
        if not interactive:
            raise
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except Exception as e:
        if not interactive:
            raise
        print(f'ERROR: {e}')
        return
