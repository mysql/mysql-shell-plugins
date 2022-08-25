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

"""Sub-Module to manage OCI Networking"""

from mysqlsh.plugin_manager import plugin_function
from mds_plugin import core, configuration

# cSpell:ignore vcns


def subnet_is_public(subnet, config):
    import oci.exceptions

    # Create VirtualNetworkClient
    virtual_network = core.get_oci_virtual_network_client(
        config=config)

    # Get Routing Table
    try:
        rt = virtual_network.get_route_table(subnet.route_table_id).data

        is_public = False
        for rr in rt.route_rules:
            if "internetgateway" in rr.network_entity_id:
                is_public = True
                break

        return is_public
    except oci.exceptions.ServiceError as e:
        if e.status == 404:
            return False


def subnet_privilege_check(subnet, config):
    # Create VirtualNetworkClient
    virtual_network = core.get_oci_virtual_network_client(
        config=config)

    try:
        subnet = virtual_network.get_subnet(subnet.id)

        return True
    except:
        return False


def network_has_subnet(network, compartment_id, config, public_subnet=None,
                       check_privileges=False):
    # Create VirtualNetworkClient
    virtual_network = core.get_oci_virtual_network_client(
        config=config)

    # Get Subnets
    subnets = virtual_network.list_subnets(
        compartment_id=compartment_id, vcn_id=network.id).data

    if public_subnet is not None:
        if public_subnet:
            subnets = [s for s in subnets
                       if subnet_is_public(subnet=s, config=config)]
        else:
            subnets = [s for s in subnets
                       if not subnet_is_public(subnet=s, config=config)]

    return len(subnets) > 0


def format_network_listing(vcns, current_network_id=None):
    import re

    out = ""

    # return compartments in READABLE text output
    i = 1
    for v in vcns:
        # Shorten to 24 chars max, remove linebreaks
        name = re.sub(r'[\n\r]', ' ',
                      v.display_name[:32] + '..'
                      if len(v.display_name) > 34
                      else v.display_name)

        # Shorten to 24 chars max, remove linebreaks
        domain_name = v.vcn_domain_name if v.vcn_domain_name else ''
        domain_name = re.sub(r'[\n\r]', ' ',
                             domain_name[:30] + '..'
                             if len(domain_name) > 32
                             else domain_name)

        index = f"*{i:>3}" if current_network_id == v.id else f"{i:>4}"
        out += f"{index} {name:34} {domain_name:32} {v.cidr_block:19} " \
            f"{v.lifecycle_state}\n"
        i += 1

    if len(vcns) == 0:
        out = "No virtual networks available in this compartment.\n"

    return out


def format_subnet_listing(subnets):
    import re

    out = ""

    i = 1
    for s in subnets:
        s_name = re.sub(r'[\n\r]', ' ',
                        s.display_name[:22] + '..'
                        if len(s.display_name) > 24
                        else s.display_name)

        availability_domain = \
            s.availability_domain if s.availability_domain else ''
        availability_domain = re.sub(r'[\n\r]', ' ',
                                     availability_domain[:22] + '..'
                                     if len(availability_domain) > 24
                                     else availability_domain)

        domain_name = s.subnet_domain_name if s.subnet_domain_name else ''
        domain_name = re.sub(r'[\n\r]', ' ',
                             domain_name[:42] + '..'
                             if len(domain_name) > 44
                             else domain_name)

        out += f"{i:>4} {s_name:24} {s.cidr_block:19} {availability_domain:24} "
        out += f"{domain_name:44}\n"
        i += 1

    if len(subnets) == 0:
        out = "No subnets available in this virtual network.\n"

    return out


def format_load_balancer_listing(items, current=None) -> str:
    """Formats a given list of objects in a human readable form

    Args:
        items: Either a list of objects or a single object
        current (str): OCID of the current item

    Returns:
       The db_systems formatted as str
    """

    # If a single db_system was given, wrap it in a list
    if not type(items) is list:
        items = [items]

    # return objects in READABLE text output
    out = ""
    id = 1
    for i in items:
        index = f"*{id:>3} " if current == i.id else f"{id:>4} "
        ips = ""
        for ip in i.ip_addresses:
            ips += ip.ip_address + "*, " if ip.is_public else ", "
        if len(ips) > 2:
            ips = ips[0:-2]
        out += (index +
                core.fixed_len(i.display_name, 24, ' ', True) +
                core.fixed_len(i.lifecycle_state, 8, ' ') +
                core.fixed_len(f"{ips}", 24, '\n'))
        id += 1

    return out


@plugin_function('mds.list.networks')
def list_networks(**kwargs):
    """Lists all networks of the given compartment

    Args:
        **kwargs: Additional options

    Keyword Args:
        public_subnet (bool): Whether only public or private subnets should be 
            considered
        compartment_id (str): OCID of the parent compartment.
        config (object): An OCI config object or None.
        return_formatted (bool): If set to true, a list object is returned.
        check_privileges (bool): Checks if the user has privileges for the 
            subnet

    Returns:
        a network object
    """
    public_subnet = kwargs.get("public_subnet")
    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    return_formatted = kwargs.get("return_formatted", True)
    check_privileges = kwargs.get("check_privileges", False)

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        import oci.exceptions

        # Create VirtualNetworkClient
        virtual_network = core.get_oci_virtual_network_client(
            config=config)

        # List the virtual networks
        vcns = virtual_network.list_vcns(
            compartment_id=compartment_id).data

        # Filter out all sub-nets that are not conforming to the
        # public_subnet options
        if public_subnet is not None:
            # Loop over VCNs to see if access is granted
            good_vcns = []
            for vcn in vcns:
                try:
                    if network_has_subnet(
                            network=vcn, compartment_id=compartment_id,
                            config=config,
                            public_subnet=public_subnet,
                            check_privileges=check_privileges):
                        good_vcns.append(vcn)
                except oci.exceptions.ServiceError as e:
                    pass
            vcns = good_vcns

        if return_formatted:
            return format_network_listing(vcns)
        else:
            return oci.util.to_dict(vcns)

    except ValueError as e:
        print(f"ERROR: {str(e)}")
        return


@plugin_function('mds.get.network')
def get_network(**kwargs):
    """Returns a network object

    If multiple or no networks are available in the current compartment,
    let the user select a different compartment

    Args:
        **kwargs: Additional options

    Keyword Args:
        network_name (str): The display_name of the network
        network_id (str): The OCID of the network
        public_subnet (bool): Whether only public or private subnets should be 
            considered
        compartment_id (str): OCID of the parent compartment.
        config (object): An OCI config object or None.
        interactive (bool): Whether to query the user for input
        ignore_current (bool): Whether to ignore the current

    Returns:
        a network object
    """
    network_name = kwargs.get("network_name")
    network_id = kwargs.get("network_id")
    public_subnet = kwargs.get("public_subnet")
    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    interactive = kwargs.get("interactive", True)
    ignore_current = kwargs.get("ignore_current", False)

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        import oci.exceptions
        from mds_plugin import compartment

        # Create VirtualNetworkClient
        virtual_network = core.get_oci_virtual_network_client(
            config=config)

        # If a specific network was specified, return this network
        if network_id:
            vcn = virtual_network.get_vcn(vcn_id=network_id).data
            return vcn

        # Loop until the user selected a compartment with vcns
        vcns = []
        rejected_vcns = []
        while len(vcns) == 0:
            try:
                # List the virtual networks, filter by network_name if given
                vcns = virtual_network.list_vcns(
                    compartment_id=compartment_id,
                    display_name=network_name).data
                # Filter out rejected VCNs
                vcns = [n for n in vcns if n not in rejected_vcns]
                if len(vcns) == 0:
                    network_comp = compartment.get_compartment_by_id(
                        compartment_id=compartment_id, config=config)
                    print(f"The compartment {network_comp.name} does not "
                          "contain a suitable virtual network.")
                    if interactive:
                        print("Please select another compartment.\n")
                    else:
                        return

                    compartment_id = compartment.get_compartment_id(
                        parent_compartment_id=compartment_id, config=config)

                    if compartment_id == None:
                        print("Operation cancelled.")
                        return
                else:
                    # Filter out all sub-nets that are not conforming to the
                    # public_subnet options
                    if public_subnet is not None:
                        # Loop over VCNs to see if access is granted
                        good_vcns = []
                        for vcn in vcns:
                            newly_rejected_vcns = []
                            try:
                                if network_has_subnet(
                                        network=vcn,
                                        compartment_id=compartment_id,
                                        config=config,
                                        public_subnet=public_subnet):
                                    good_vcns.append(vcn)
                                else:
                                    newly_rejected_vcns.append(vcn)
                            except oci.exceptions.ServiceError as e:
                                if e.status == 404:
                                    newly_rejected_vcns.append(vcn)

                        rejected_vcns = rejected_vcns + newly_rejected_vcns
                        vcns = good_vcns

            except oci.exceptions.ServiceError as e:
                if e.code == "NotAuthorizedOrNotFound":
                    print(f'You do not have privileges to list the '
                          f'networks of this compartment.')
                else:
                    print(f'Could not list networks of compartment '
                          f'{network_comp.name}\n')
                print(
                    f'ERROR: {e.message}. (Code: {e.code}; '
                    f'Status: {e.status})')
                vcns = []
            except (ValueError, oci.exceptions.ClientError) as e:
                print(f'ERROR: {e}')
                vcns = []

        # If there is a single network in this compartment, return this
        # one if it matches the network_name (if given)
        if len(vcns) == 1 and not ignore_current:
            return vcns[0]

        if not interactive:
            print("Error: There are multiple virtual networks in this "
                  "compartment.")
            return

        # Let the user choose from the list
        vcn = core.prompt_for_list_item(
            item_list=vcns, prompt_caption=("Please enter the name or index "
                                            "of the virtual network: "),
            item_name_property="display_name",
            print_list=True)

        return vcn

    except oci.exceptions.ServiceError as e:
        if e.code == "NotAuthorizedOrNotFound":
            print(f'You do not have privileges to access this network.')
        else:
            print(f'Could not get the network.')
        print(
            f'ERROR: {e.message}. (Code: {e.code}; '
            f'Status: {e.status})')
    except (ValueError, oci.exceptions.ClientError) as e:
        print(f'ERROR: {e}')


@plugin_function('mds.list.subnets')
def list_subnets(**kwargs):
    """Lists all subnets of the given network

    Args:
        **kwargs: Additional options

    Keyword Args:
        network_id (str): The OCID of the parent network_id
        public_subnet (bool): Whether only public subnets should be considered
        availability_domain (str): The name if the availability_domain
        ignore_current_network (bool): Whether to ignore the current network
        compartment_id (str): OCID of the parent compartment.
        config (object): An OCI config object or None.
        interactive (bool): Whether to query the user for input
        return_formatted (bool): If set to true, a list object is returned.

    Returns:
        A list of subnets
    """

    network_id = kwargs.get("network_id")
    public_subnet = kwargs.get("public_subnet")
    # availability_domain = kwargs.get("availability_domain")
    ignore_current_network = kwargs.get("ignore_current_network")
    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    interactive = kwargs.get("interactive", True)
    return_formatted = kwargs.get("return_formatted", True)

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)
        # compartment_id = configuration.get_current_compartment_id(
        #     compartment_id=compartment_id, config=config)
        if not ignore_current_network:
            network_id = configuration.get_current_network_id(
                network_id=network_id, config=config)

        import oci.exceptions
        from mds_plugin import compartment

        # Create VirtualNetworkClient
        virtual_network = core.get_oci_virtual_network_client(
            config=config)

        # If a subnet_id was given, return the subnet of that subnet_id
        # if subnet_id is not None:
        #     try:
        #         return virtual_network.get_subnet(subnet_id=subnet_id).data
        #     except oci.exceptions.ServiceError as e:
        #         print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        #         return
        #     except (ValueError, oci.exceptions.ClientError) as e:
        #         print(f'ERROR: {e}')
        #         return

        network = get_network(network_id=network_id,
                              compartment_id=compartment_id, config=config,
                              public_subnet=public_subnet, interactive=interactive)
        if network is None:
            return
        network_name = network.display_name if network.display_name else \
            network.id
        network_compartment = network.compartment_id

        # Get the compartment
        compartment = compartment.get_compartment_by_id(
            compartment_id=network_compartment, config=config)
        if compartment is None:
            return

        # If no availability_domain was specified, use a random one
        # if availability_domain is None:
        #     availability_domain = compartment.get_availability_domain(
        #         compartment_id=compartment_id,
        #         availability_domain=availability_domain, config=config)

        subnets = virtual_network.list_subnets(
            compartment_id=network_compartment, vcn_id=network.id).data

        # Filter subnets by Availability Domain, None means the subnet
        # spans across all Availability Domains
        # subnets = [s for s in subnets
        #            if s.availability_domain == availability_domain or
        #            s.availability_domain is None]

        # Filter out all sub-nets that are not conforming to the
        # public_subnet options
        if public_subnet is not None and public_subnet:
            out = "All public "
            subnets = [s for s in subnets
                       if subnet_is_public(subnet=s, config=config)]
        elif public_subnet is not None and not public_subnet:
            out = "All private "
            subnets = [s for s in subnets
                       if not subnet_is_public(subnet=s, config=config)]
        else:
            out = "All "

        out += f"subnets of Network '{network_name}' in compartment " + \
            f"'{compartment.name}':\n\n"

        if return_formatted:
            return out + format_subnet_listing(subnets)
        else:
            return oci.util.to_dict(subnets)

    except oci.exceptions.ServiceError as e:
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except (ValueError, oci.exceptions.ClientError) as e:
        print(f'ERROR: {e}')
        return


@plugin_function('mds.get.subnet')
def get_subnet(**kwargs):
    """Returns a subnet object

    If multiple or no networks are available in the current compartment,
    let the user select a different compartment

    Args:
        **kwargs: Additional options

    Keyword Args:
        subnet_name (str): The display_name of the subnet
        subnet_id (str): The OCID of the subnet
        network_id (str): The OCID of the parent network_id
        public_subnet (bool): Whether only public subnets should be considered
        availability_domain (str): The name if the availability_domain
        compartment_id (str): OCID of the parent compartment.
        config (object): An OCI config object or None.
        interactive (bool): Whether to query the user for input

    Returns:
        a subnet object
    """

    subnet_name = kwargs.get("subnet_name")
    subnet_id = kwargs.get("subnet_id")
    network_id = kwargs.get("network_id")
    public_subnet = kwargs.get("public_subnet")
    availability_domain = kwargs.get("availability_domain")
    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    interactive = kwargs.get("interactive", True)

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        network_id = configuration.get_current_network_id(
            network_id=network_id, config=config)
    except ValueError as e:
        print(f"ERROR: {str(e)}")
        return

    import oci.exceptions
    from mds_plugin import compartment
    import re

    # Create VirtualNetworkClient
    virtual_network = core.get_oci_virtual_network_client(
        config=config)

    # If a subnet_id was given, return the subnet of that subnet_id
    if subnet_id:
        try:
            return virtual_network.get_subnet(subnet_id=subnet_id).data
        except oci.exceptions.ServiceError as e:
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
            return
        except (ValueError, oci.exceptions.ClientError) as e:
            print(f'ERROR: {e}')
            return

    # If no network_id was given, query the user for one
    network = get_network(
        network_id=network_id,
        compartment_id=compartment_id, config=config,
        public_subnet=public_subnet, interactive=interactive)
    if network is None:
        return
    network_id = network.id
    compartment_id = network.compartment_id

    # If no availability_domain was specified, use a random one
    if availability_domain is None:
        availability_domain_obj = compartment.get_availability_domain(
            compartment_id=compartment_id,
            random_selection=True,
            availability_domain=availability_domain, config=config,
            interactive=False, return_python_object=True)
        availability_domain = availability_domain_obj.name

    try:
        subnets = virtual_network.list_subnets(
            compartment_id=compartment_id, vcn_id=network_id).data

        # Filter subnets by Availability Domain, None means the subnet
        # spans across all Availability Domains
        subnets = [s for s in subnets
                   if s.availability_domain == availability_domain or
                   s.availability_domain is None]

        # Filter out all sub-nets that are not conforming to the
        # public_subnet options
        if public_subnet:
            subnets = [s for s in subnets
                       if subnet_is_public(subnet=s, config=config)]
        elif public_subnet is not None and not public_subnet:
            subnets = [s for s in subnets
                       if not subnet_is_public(subnet=s, config=config)]

        # If there are several subnets, let the user choose
        if len(subnets) == 0:
            return
        elif len(subnets) == 1:
            # If there is exactly 1 subnet, return that
            return subnets[0]

        print("\nPlease choose a subnet:\n")
        i = 1
        for s in subnets:
            s_name = re.sub(r'[\n\r]', ' ',
                            s.display_name[:22] + '..'
                            if len(s.display_name) > 24
                            else s.display_name)
            print(f"{i:>4} {s_name:24} {s.cidr_block:15}")
            i += 1
        print()

        return core.prompt_for_list_item(
            item_list=subnets, prompt_caption=(
                "Please enter the name or index of the subnet: "),
            item_name_property="display_name",
            given_value=subnet_name)

    except oci.exceptions.ServiceError as e:
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except Exception as e:
        print(f'ERROR: {e}')
        return


@plugin_function('mds.list.loadBalancers', shell=True, cli=True, web=True)
def list_load_balancers(**kwargs):
    """Lists load balancers

    This function will list all load balancers of the compartment with the
    given compartment_id.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        compartment_id (str): OCID of the parent compartment
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

        import oci.exceptions
        try:
            # Initialize the  Object Store client
            load_balancer_cl = core.get_oci_load_balancer_client(config=config)

            # List the load balancers
            load_balancers = load_balancer_cl.list_load_balancers(
                compartment_id=compartment_id).data

            # Filter out all deleted items
            load_balancers = [
                l for l in load_balancers if l.lifecycle_state != "DELETED"]

            return core.oci_object(
                oci_object=load_balancers,
                return_type=return_type,
                format_function=format_load_balancer_listing)
        except oci.exceptions.ServiceError as e:
            if raise_exceptions:
                raise
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
    except Exception as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')
