# Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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

"""Sub-Module for supporting OCI Compute Instances, Shapes, Images"""

# cSpell:ignore vnics, vnic, Paramiko, pkey, putfo, getfo, EX_CANTCREAT

# from os import EX_CANTCREAT
from mysqlsh.plugin_manager import plugin_function
from mds_plugin import core, configuration


class SshConnection:
    """ A class to handle SSH Connections"""

    def __init__(
            self, username, host, private_key_file_path="~/.ssh/id_rsa",
            private_key_passphrase=None):
        """ Opens a ssh connection to the given host

        Args:
            host (str): The hostname or IP of the host to connect to
            private_key_file_path (str): The path to the private key file
            private_key_passphrase (str): The pass phrase of the given key

        Returns:
            A Paramiko client
        """
        import os.path
        import paramiko
        import time

        self.client = paramiko.SSHClient()

        # Get private key
        private_key_file_path = os.path.abspath(
            os.path.expanduser(private_key_file_path))

        # Assume no passphrase
        try:
            private_key = paramiko.RSAKey.from_private_key_file(
                private_key_file_path, password=private_key_passphrase)
        except paramiko.ssh_exception.PasswordRequiredException:
            import mysqlsh
            private_key_passphrase = mysqlsh.globals.shell.prompt(
                "\nPlease enter the passphrase for the given SSH key: ",
                options={"type": "password"})
            try:
                private_key = paramiko.RSAKey.from_private_key_file(
                    private_key_file_path, password=private_key_passphrase)
            except paramiko.ssh_exception.SSHException:
                print("Could not decrypt SSH key, wrong password provided.")
                raise
        except paramiko.ssh_exception.SSHException:
            # If reading the file fails, try to add RSA which paramiko requires
            import io
            with open(private_key_file_path, mode='r') as file:
                public_key_content = file.read()
            keyfile = io.StringIO(public_key_content.replace(
                "BEGIN PRIVATE", "BEGIN RSA PRIVATE"))
            private_key = paramiko.RSAKey.from_private_key(keyfile)
            keyfile.close()

        self.client.set_missing_host_key_policy(
            paramiko.AutoAddPolicy())
        try:
            self.client.connect(host, 22, username, pkey=private_key,
                                passphrase=private_key_passphrase, timeout=10)
        except Exception:
            # Wait 5 more seconds
            time.sleep(5)
            # Try again
            self.client.connect(host, 22, username, pkey=private_key,
                                passphrase=private_key_passphrase, timeout=10)

        self.stdin = None
        self.stdout = None
        self.stderr = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.close()

    def execute(self, command):
        """ Executes the given command

        Args:
            command (str): The command to execute

        Returns:
            The stdout output of the command
        """
        self.stdin, self.stdout, self.stderr = self.client.exec_command(
            command)

        output = ""
        for line in self.stdout:
            output += line

        # Close stdin to work around Paramiko issue
        self.stdin.close()

        return output

    def executeAndSendOnStdin(self, command, stdin_text):
        import time

        success = False
        buffer = ""

        # Open channel
        chan = self.client.get_transport().open_session()
        try:
            chan.settimeout(timeout=None)
            chan.set_combine_stderr(combine=True)

            # Execute shell and call import function
            chan.exec_command(command)

            # Send password to stdin
            chan.sendall(f"{stdin_text}\n".encode('utf-8'))
            chan.shutdown_write()

            # While the command didn't return an exit code yet
            read_buffer_size = 1024
            while not chan.exit_status_ready():
                # Update every 0.1 seconds
                time.sleep(0.1)

                if chan.recv_ready():
                    buffer += chan.recv(
                        read_buffer_size).decode('utf-8')

            # Ensure we gobble up all remaining data
            while True:
                try:
                    output = chan.recv(
                        read_buffer_size).decode('utf-8')
                    if not output and not chan.recv_ready():
                        break
                    else:
                        buffer += output

                except Exception:
                    continue

            success = chan.recv_exit_status() == 0
        finally:
            chan.close()

        return success, buffer

    def put_local_file(self, local_file_path, remote_file_path):
        sftp = self.client.open_sftp()
        try:
            sftp.put(localpath=local_file_path, remotepath=remote_file_path)
        finally:
            sftp.close()

    def put_local_file_object(self, file_object, remote_file_path):
        sftp = self.client.open_sftp()
        try:
            sftp.putfo(fl=file_object, remotepath=remote_file_path)
        finally:
            sftp.close()

    def get_remote_file(self, remote_file_path, local_file_path):
        sftp = self.client.open_sftp()
        try:
            sftp.get(remotepath=remote_file_path, localpath=local_file_path)
        finally:
            sftp.close()

    def get_remote_file_as_file_object(self, remote_file_path, file_object):
        sftp = self.client.open_sftp()
        try:
            sftp.getfo(remotepath=remote_file_path, fl=file_object)
        finally:
            sftp.close()

    def get_last_error(self):
        if self.stderr is None:
            return ""

        output = ""
        for line in self.stderr:
            output += line

        return output

    def close(self):
        """ Closes an open connection

        Args:
            -

        Returns:
            None
        """
        try:
            self.client.close()
        except Exception as e:
            # Close stdin to work around Paramiko issue 1617 on github
            if str(e) != "'NoneType' object has no attribute 'time'":
                raise


def format_instance_listing(items, current=None, vnics=None,
                            config=None):
    """Returns a formatted list of instances.

    If compartment_id is given, the current and parent compartment
    will be listed as well.

    Args:
        data (list): A list of instance objects.
        config (object): An OCI config object or None.
        compartment_id (str): The OCID of the current compartment.

    Returns:
        The formatted list as string
    """
    import re
    import oci.core.models

    # If a single item was given, wrap it in a list
    if not type(items) is list:
        items = [items]

    out = ""

    # return compartments in READABLE text output
    i = 1
    for c in items:
        # Shorten to 24 chars max, remove linebreaks
        name = re.sub(r'[\n\r]', ' ',
                      c.display_name[:22] + '..'
                      if len(c.display_name) > 24
                      else c.display_name)
        # Get public IP
        public_ip = ""
        private_ip = ""
        if vnics and c.lifecycle_state in [
                oci.core.models.Instance.LIFECYCLE_STATE_RUNNING,
                oci.core.models.Instance.LIFECYCLE_STATE_STARTING,
                oci.core.models.Instance.LIFECYCLE_STATE_STOPPED,
                oci.core.models.Instance.LIFECYCLE_STATE_STOPPING]:

            instance_vnics = [v for v in vnics if v.instance_id == c.id]
            if len(instance_vnics) > 0:
                virtual_network = core.get_oci_virtual_network_client(
                    config=config)
                try:
                    vnic = virtual_network.get_vnic(
                        instance_vnics[0].vnic_id).data
                    public_ip = vnic.public_ip \
                        if vnic.public_ip else ''
                    private_ip = vnic.private_ip \
                        if vnic.private_ip else ''
                except oci.exceptions.ServiceError as e:
                    # Ignore NotFound error
                    if e.code == "NotAuthorizedOrNotFound":
                        pass

        index = f"*{i:>3}" if current == c.id else f"{i:>4}"
        out += (f"{index} {name:24} {c.shape[:22]:22} {c.fault_domain[:15]:15} "
                f"{public_ip if public_ip != '' else private_ip:15} "
                f"{c.lifecycle_state}\n")
        i += 1

    return out


def format_image_list_item(data, index):
    img = data[index]
    # Shorten to 16 chars max
    os = img.operating_system[:14] + '..' \
        if len(img.operating_system) > 16 \
        else img.operating_system
    # Shorten to 16 chars max
    os_version = img.operating_system_version[:20] + '..' \
        if len(img.operating_system_version) > 22 \
        else img.operating_system_version

    return (f"{index+1:>3} {os:16} "
            f"{os_version:22} {img.display_name[-12:]:12}")


def format_image_listing(data):
    """Returns a formatted list of images.

    Args:
        data (list): A list of images objects.

    Returns:
        The formatted list as string
    """

    import math

    out = ""

    # return compartments in READABLE text output
    split = math.ceil(len(data)/2)
    i = 1
    while i <= split:
        out += format_image_list_item(data, i-1)

        if i+split < len(data):
            out += f" {format_image_list_item(data, split+i-1)}\n"
        else:
            out += "\n"
        i += 1

    return out


def format_compute_images(items) -> str:
    """Formats a given list of objects in a human readable form

    Args:
        items: Either a list of objects or a single object

    Returns:
       The objects formatted as str
    """

    # If a single db_system was given, wrap it in a list
    if not type(items) is list:
        items = [items]

    # return objects in READABLE text output
    out = ""
    id = 1
    for i in items:
        out += (f"{id:>4} " +
                core.fixed_len(i.display_name, 48, ' ', True) +
                core.fixed_len(i.operating_system, 16, ' ', True) +
                core.fixed_len(i.operating_system_version, 7, ' ') +
                core.fixed_len(i.lifecycle_state, 11, '\n'))
        id += 1

    return out


def get_instance_by_id(**kwargs):
    """Returns an instance object for the given id

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        instance_id (str): OCID of the instance.
        config (dict): An OCI config object or None
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised
        return_formatted (bool): If true a human readable string is returned
        return_python_object (bool): Used for internal plugin calls

    Returns:
        The compartment or tenancy object with the given id
    """

    instance_id = kwargs.get("instance_id")

    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)
    return_python_object = kwargs.get("return_python_object", False)

    # Get the right config, either the one passed in or, if that one is None,
    # the global one
    try:
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        current_instance_id = configuration.get_current_instance_id(
            config=config)

        import oci.exceptions

        try:
            # Initialize the compute client
            compute = core.get_oci_compute_client(config=config)

            # Return the instance if found
            return core.return_oci_object(
                oci_object=compute.get_instance(instance_id).data,
                return_formatted=return_formatted,
                return_python_object=return_python_object,
                format_function=format_instance_listing,
                current=current_instance_id)
        except oci.exceptions.ServiceError as e:
            if raise_exceptions:
                raise
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
            return
    except Exception as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')


@plugin_function('mds.get.computeInstanceVncSecurityLists')
def get_instance_vcn_security_lists(**kwargs):
    """Returns the vnc_security_lists of an instance

    If no name is given, it will prompt the user for the name.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        instance_name (str): The name of the instance.
        instance_id (str): The OCID of the instance
        compartment_id (str): OCID of the compartment.
        config (object): An OCI config object or None.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised
        return_python_object (bool): Used for internal plugin calls

    Returns:
       None or a list of vnc_security_lists
    """

    instance_name = kwargs.get("instance_name")
    instance_id = kwargs.get("instance_id")

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_python_object = kwargs.get("return_python_object", False)

    # Get the active config, compartment and instance
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        instance_id = configuration.get_current_instance_id(
            instance_id=instance_id, config=config)

        import oci.exceptions

        try:
            instance = get_instance(
                instance_name=instance_name, instance_id=instance_id,
                compartment_id=compartment_id, config=config,
                interactive=interactive, raise_exceptions=raise_exceptions,
                return_python_object=True)
            if instance is None:
                raise Exception("No instance given or found."
                                "Operation cancelled.")

            # Initialize the identity client
            compute = core.get_oci_compute_client(config=config)

            # Get all VNICs of the instance
            attached_vnics = oci.pagination.list_call_get_all_results(
                compute.list_vnic_attachments,
                instance_id=instance.id,
                compartment_id=compartment_id).data

            # Find the VNIC with a public IP
            if attached_vnics:
                virtual_network = core.get_oci_virtual_network_client(
                    config=config)

                for attached_vnic in attached_vnics:
                    vnic = virtual_network.get_vnic(
                        attached_vnic.vnic_id).data
                    public_ip = vnic.public_ip
                    # If a public IP is found, get it's subnet and the
                    # corresponsing security lists
                    if public_ip:
                        subnet = virtual_network.get_subnet(
                            vnic.subnet_id).data
                        if subnet is None:
                            raise Exception(
                                "Could not get the subnet of the instance.")

                        # Get the list of ids of security lists
                        sec_lists = subnet.security_list_ids

                        # Get the actual security list objects
                        sec_lists = [
                            virtual_network.get_security_list(id).data
                            for id in sec_lists]

                        return core.return_oci_object(
                            oci_object=sec_lists,
                            return_python_object=return_python_object)

        except oci.exceptions.ServiceError as e:
            if raise_exceptions:
                raise
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
    except (ValueError, oci.exceptions.ClientError) as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')


def add_ingress_port_to_security_lists(**kwargs):
    """Checks if the given ingress port already is a security list,
    if not it gets added.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        security_lists (list): A list of security_lists.
        port (int): The port to check
        description (str): A description for the ingress rule
        compartment_id (str): The OCID of the compartment
        config (object): An OCI config object or None.
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised

    Returns:
       True on success
    """

    security_lists = kwargs.get("security_lists")
    port = kwargs.get("port")
    description = kwargs.get("description")

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)

    if security_lists is None:
        raise ValueError("No security_lists given.")

    try:
        # Get the active config and compartment
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        for sec_list in security_lists:
            for rule in sec_list.ingress_security_rules:
                if rule.tcp_options is not None and \
                        port >= rule.tcp_options.destination_port_range.min and \
                        port <= rule.tcp_options.destination_port_range.max and \
                        rule.protocol == "6" and \
                        rule.source == "0.0.0.0/0":
                    return True

        if len(security_lists) == 0:
            raise Exception("No security list available for this network.")
        sec_list = security_lists[0]

        import oci.exceptions

        try:
            network_client = core.get_oci_virtual_network_client(
                config=config)

            sec_list.ingress_security_rules.append(
                oci.core.models.IngressSecurityRule(
                    protocol="6",
                    source="0.0.0.0/0",
                    is_stateless=False,
                    source_type="CIDR_BLOCK",
                    tcp_options=oci.core.models.TcpOptions(
                        destination_port_range=oci.core.models.PortRange(
                            max=port,
                            min=port),
                        source_port_range=None),
                    udp_options=None,
                    description=description
                )
            )

            details = oci.core.models.UpdateSecurityListDetails(
                defined_tags=sec_list.defined_tags,
                display_name=sec_list.display_name,
                egress_security_rules=sec_list.egress_security_rules,
                freeform_tags=sec_list.freeform_tags,
                ingress_security_rules=sec_list.ingress_security_rules
            )

            network_client.update_security_list(
                security_list_id=sec_list.id,
                update_security_list_details=details)

            return True

        except oci.exceptions.ServiceError as e:
            if raise_exceptions:
                raise
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
    except Exception as e:
        if raise_exceptions:
            raise
        print(f'Could not list the availability domains for this '
              f'compartment.\nERROR: {str(e)}')


def format_shape_listing(data):
    """Returns a formatted list of shapes.

    Args:
        data (list): A list of shape objects.

    Returns:
        The formatted list as string
    """
    out = ""

    # return compartments in READABLE text output
    i = 1
    for s in data:
        # cSpell:ignore ocpus
        out += f"{i:>4} {s.shape:20} {s.ocpus:5.1f}x " \
            f"{s.processor_description[:22]:22} " \
            f"{s.memory_in_gbs:5.0f}GB Ram\n"
        i += 1

    return out


def format_shapes(items) -> str:
    """Formats a given list of objects in a human readable form

    Args:
        items: Either a list of objects or a single object

    Returns:
       The objects formatted as str
    """

    # If a single db_system was given, wrap it in a list
    if not type(items) is list:
        items = [items]

    # return objects in READABLE text output
    # cSpell:ignore gbps
    out = ""
    id = 1
    for i in items:
        out += (f"{id:>4} " +
                core.fixed_len(i.shape, 26, ' ', True) +
                core.fixed_len(str(i.ocpus), 7, ' ', align_right=True) +
                core.fixed_len(i.processor_description, 35, ' ') +
                core.fixed_len(
                    str(i.memory_in_gbs), 7, ' ', align_right=True) +
                core.fixed_len(
                    str(i.networking_bandwidth_in_gbps), 7, '\n',
                    align_right=True))
        id += 1

    return out


@plugin_function('mds.list.computeInstances', shell=True, cli=True, web=True)
def list_instances(**kwargs):
    """Lists instances

    This function will list all instances of the compartment with the
    given compartment_id.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        compartment_id (str): OCID of the parent compartment.
        config (object): An OCI config object or None.
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised
        return_formatted (bool): If set to true, a list object is returned.

    Returns:
        A list of dicts representing the compartments
    """

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)

    import oci.exceptions
    import oci.util
    import oci.pagination

    try:
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        current_instance_id = configuration.get_current_instance_id(
            config=config)

        # Initialize the identity client
        compute = core.get_oci_compute_client(config=config)

        # List the compute instances
        instances = compute.list_instances(
            compartment_id=compartment_id).data

        # Filter out all deleted compartments
        instances = [c for c in instances if c.lifecycle_state != "DELETED" and
                     c.lifecycle_state != "TERMINATED"]

        if return_formatted:
            # Get all VNICs of the compartment
            vnics = oci.pagination.list_call_get_all_results(
                compute.list_vnic_attachments,
                compartment_id=compartment_id).data

            return format_instance_listing(
                items=instances, vnics=vnics,
                current=current_instance_id, config=config)
        else:
            return oci.util.to_dict(instances)
    except oci.exceptions.ServiceError as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except Exception as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')
        return


@plugin_function('mds.get.computeInstance', shell=True, cli=True, web=True)
def get_instance(**kwargs):
    """Returns an instance object based on instance_name or instance_id

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        instance_name (str): The name of the instance
        instance_id (str): OCID of the instance
        ignore_current (bool): Whether the current instance should be ignored
        compartment_id (str): OCID of the compartment
        config (dict): An OCI config object or None
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised
        return_formatted (bool): If true a human readable string is returned
        return_python_object (bool): Used for internal plugin calls

    Returns:
        The compartment or tenancy object or None if not found
    """

    instance_name = kwargs.get("instance_name")
    instance_id = kwargs.get("instance_id")
    ignore_current = kwargs.get("ignore_current", False)

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)
    return_python_object = kwargs.get("return_python_object", False)

    try:
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        current_instance_id = configuration.get_current_instance_id(
            config=config)
        if not ignore_current and instance_name is None and instance_id is None:
            instance_id = current_instance_id

        # if the instance_id was given, look it up directly
        if instance_id:
            return get_instance_by_id(
                instance_id=instance_id, config=config,
                interactive=interactive, raise_exceptions=raise_exceptions,
                return_formatted=return_formatted,
                return_python_object=return_python_object)

        import oci.util
        import oci.exceptions
        from mds_plugin import compartment

        try:
            # Get the full path of this tenancy
            full_path = compartment.get_compartment_full_path(
                compartment_id, config)
            if instance_name is None:
                print(f"Directory of {full_path}\n")

            # Initialize the identity client
            compute = core.get_oci_compute_client(config=config)

            # Get the list of instances for this compartment

            data = compute.list_instances(
                compartment_id=compartment_id).data

            # Filter out all deleted instances
            data = [c for c in data if c.lifecycle_state != "DELETED"
                    and c.lifecycle_state != "TERMINATED"
                    and c.lifecycle_state != "TERMINATING"]

            if len(data) < 1:
                print("There are no instances in this compartment.\n")
                return

            # If an instance_name was given not given, print the instance list
            if instance_name is None:
                instance_list = format_instance_listing(
                    items=data, config=config)
                print(f"Compute Instances:\n{instance_list}")

            # Let the user choose from the list
            instance = core.prompt_for_list_item(
                item_list=data, prompt_caption=("Please enter the name or index "
                                                "of the compute instance: "),
                item_name_property="display_name", given_value=instance_name)

            return core.return_oci_object(
                oci_object=instance,
                return_formatted=return_formatted,
                return_python_object=return_python_object,
                format_function=format_instance_listing,
                current=current_instance_id)
        except oci.exceptions.ServiceError as e:
            if raise_exceptions:
                raise
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
    except Exception as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')


@plugin_function('mds.get.computeInstanceId')
def get_instance_id(instance_name=None, compartment_id=None, config=None,
                    interactive=True):
    """Returns an instance OCID based on instance_name or instance_id

    Args:
        instance_name (str): The name of the instance
        compartment_id (str): OCID of the compartment
        config (object): An OCI config object or None
        interactive (bool): Whether exceptions are raised

    Returns:
        The compartment or tenancy object or None if not found
    """
    instance = get_instance(
        instance_name=instance_name, compartment_id=compartment_id,
        config=config, interactive=interactive,
        return_python_object=True)

    return None if instance is None else instance.id


@plugin_function('mds.get.computeInstancePublicIp')
def get_instance_public_ip(**kwargs):
    """Returns the public ip of an instance

    If no name is given, it will prompt the user for the name.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        instance_name (str): The name of the instance.
        instance_id (str): The OCID of the instance
        private_ip_fallback (bool): Whether the private IP should be returned
            if there is no public one
        compartment_id (str): OCID of the compartment.
        config (object): An OCI config object or None.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
       The IP as string or None
    """

    instance_name = kwargs.get("instance_name")
    instance_id = kwargs.get("instance_id")
    private_ip_fallback = kwargs.get("private_ip_fallback")

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)

    # Get the active config, compartment and instance
    try:
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        instance_id = configuration.get_current_instance_id(
            instance_id=instance_id, config=config)

        import oci.exceptions

        try:
            instance = get_instance(
                instance_name=instance_name, instance_id=instance_id,
                compartment_id=compartment_id, config=config,
                return_python_object=True)
            if instance is None:
                raise ValueError("No instance given."
                                 "Operation cancelled.")

            # Initialize the identity client
            compute = core.get_oci_compute_client(config=config)

            # Get all VNICs of the instance
            try:
                attached_vnics = oci.pagination.list_call_get_all_results(
                    compute.list_vnic_attachments,
                    instance_id=instance.id,
                    compartment_id=compartment_id).data
            except Exception as e:
                raise Exception(
                    "Cannot get VNICs of the given instance.\n"
                    f"{str(e)}")

            instance_ip = None
            if attached_vnics:
                virtual_network = core.get_oci_virtual_network_client(
                    config=config)

                for attached_vnic in attached_vnics:
                    vnic = virtual_network.get_vnic(
                        attached_vnic.vnic_id).data
                    instance_ip = vnic.public_ip
                    if instance_ip:
                        break

                if not instance_ip and private_ip_fallback:
                    for attached_vnic in attached_vnics:
                        vnic = virtual_network.get_vnic(
                            attached_vnic.vnic_id).data
                        instance_ip = vnic.private_ip
                        if instance_ip:
                            break

            return instance_ip
        except oci.exceptions.ServiceError as e:
            if raise_exceptions:
                raise
            print(f'Could not get the VNIC of {instance.display_name}\n'
                  f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
    except ValueError as e:
        if raise_exceptions:
            raise
        print(f"ERROR: {str(e)}")


@plugin_function('mds.list.computeShapes', shell=True, cli=True, web=True)
def list_shapes(**kwargs):
    """Returns a list of all available compute shapes

    This list is specific for the given compartment and availability_domain

    Args:
        **kwargs: Additional options

    Keyword Args:
        limit_shapes_to (list): A list of shape names
        availability_domain (str): The name of the availability_domain to use
        compartment_id (str): OCID of the compartment
        config (dict): An OCI config object or None
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised
        return_formatted (bool): If true a human readable string is returned
        return_python_object (bool): Used for internal plugin calls

    Returns:
        A list of shapes
    """

    limit_shapes_to = kwargs.get("limit_shapes_to")
    availability_domain = kwargs.get("availability_domain")

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

        import oci.util
        import oci.exceptions
        from mds_plugin import compartment

        try:
            # Get the availability_domain name
            availability_domain_obj = compartment.get_availability_domain(
                random_selection=not interactive,
                compartment_id=compartment_id,
                availability_domain=availability_domain,
                config=config, interactive=interactive,
                raise_exceptions=raise_exceptions,
                return_formatted=return_formatted,
                return_python_object=True)
            if availability_domain_obj:
                availability_domain = availability_domain_obj.name

            if not availability_domain:
                raise ValueError("No availability domain given. "
                                 "Operation cancelled.")

            # Initialize the identity client
            compute_client = core.get_oci_compute_client(config=config)

            # Get list of available shapes
            shapes = compute_client.list_shapes(
                compartment_id=compartment_id,
                availability_domain=availability_domain).data

            # If a list of shape names was given, filter according to that list
            if limit_shapes_to is not None:
                shapes = [s for s in shapes if any(
                    s.shape in l_s for l_s in limit_shapes_to)]

            return core.return_oci_object(
                oci_object=shapes,
                return_formatted=return_formatted,
                return_python_object=return_python_object,
                format_function=format_shapes)
        except oci.exceptions.ServiceError as e:
            if raise_exceptions:
                raise e
            print(f'Could not list the shapes for this compartment.\n'
                  f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
    except Exception as e:
        if raise_exceptions:
            raise e
        print(f'Could not list the shapes for this compartment.\n'
              f'ERROR: {str(e)}')


@plugin_function('mds.get.computeShape')
def get_shape(**kwargs):
    """Gets a certain shape specified by name

    The shape is specific for the given compartment and availability_domain

    Args:
        **kwargs: Additional options

    Keyword Args:
        shape_name (str): Name of the shape
        limit_shapes_to (list): List of strings to limit the shape selection
        availability_domain (str): The name of the availability_domain to use
        compartment_id (str): OCID of the parent compartment.
        config (dict): An OCI config object or None
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised
        return_formatted (bool): If true a human readable string is returned
        return_python_object (bool): Used for internal plugin calls

    Returns:
        An shape object or None
    """

    shape_name = kwargs.get("shape_name")
    limit_shapes_to = kwargs.get("limit_shapes_to")
    availability_domain = kwargs.get("availability_domain")

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

        # Get the list of available shapes
        shapes = list_shapes(
            limit_shapes_to=limit_shapes_to,
            compartment_id=compartment_id,
            availability_domain=availability_domain,
            config=config, interactive=interactive,
            raise_exceptions=True,
            return_python_object=True)

        if not shapes:
            raise Exception("No shapes found.")

        # Let the user choose from the list
        shape = core.prompt_for_list_item(
            item_list=shapes,
            prompt_caption="Please enter the name or index of the shape: ",
            item_name_property="shape", given_value=shape_name,
            print_list=True)

        return core.return_oci_object(
            oci_object=shape,
            return_formatted=return_formatted,
            return_python_object=return_python_object,
            format_function=format_shapes)
    except Exception as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {str(e)}')


@plugin_function('mds.get.computeShapeName')
def get_shape_name(**kwargs):
    """Gets a certain shape id specified by name for the given compartment and
    availability_domain

    Args:
        **kwargs: Additional options

    Keyword Args:
        shape_name (str): Name of the shape
        limit_shapes_to (list): List of strings to limit the shape selection
        availability_domain (str): The name of the availability_domain to use
        compartment_id (str): OCID of the parent compartment.
        config (dict): An OCI config object or None
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised

    Returns:
        The shape's name (which is the shape's id) or None
    """

    shape_name = kwargs.get("shape_name")
    limit_shapes_to = kwargs.get("limit_shapes_to")
    availability_domain = kwargs.get("availability_domain")

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)

    shape = get_shape(
        shape_name=shape_name, limit_shapes_to=limit_shapes_to,
        availability_domain=availability_domain,
        compartment_id=compartment_id,
        config=config, config_profile=config_profile,
        interactive=interactive, raise_exceptions=raise_exceptions,
        return_python_object=True)

    return None if shape is None else shape.shape


@plugin_function('mds.list.computeImages')
def list_images(**kwargs):
    """Gets a compute image

    Args:
        **kwargs: Additional options

    Keyword Args:
        operating_system (str): The name of the operating system
        operating_system_version (str): The version of the operating system
        image_caption (str): The caption of the compute image to use
        shape (str): The name of the shape to use.
        compartment_id (str): OCID of the parent compartment.
        config (dict): An OCI config object or None
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised
        return_formatted (bool): If true a human readable string is returned
        return_python_object (bool): Used for internal plugin calls

    Returns:
        a compute image object
    """

    operating_system = kwargs.get("operating_system")
    operating_system_version = kwargs.get("operating_system_version")
    image_caption = kwargs.get("image_caption")
    shape = kwargs.get("shape")

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)
    return_python_object = kwargs.get("return_python_object", False)

    # Get the active config and compartment
    try:
        # Get the active config and compartment
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        import oci.pagination
        import oci.exceptions

        try:
            # Initialize the oci client
            compute_client = core.get_oci_compute_client(config=config)

            # Get list of images
            images = oci.pagination.list_call_get_all_results(
                compute_client.list_images,
                compartment_id=compartment_id,
                lifecycle_state="AVAILABLE",
                shape=shape,
                operating_system=operating_system,
                operating_system_version=operating_system_version,
                sort_by="DISPLAYNAME",
                sort_order="ASC").data

            # If no image_caption was given, let the user select an
            # operating system first, then the actual image
            if not image_caption and not operating_system and interactive:
                os_list = sorted({img.operating_system for img in images})

                operating_system = core.prompt_for_list_item(
                    item_list=os_list,
                    prompt_caption=(
                        "Please enter the name or index of the operating "
                        "system: "),
                    print_list=True)

            if operating_system is None:
                raise ValueError("No operation system given. "
                                 "Operation cancelled.")

            # Filter by given operating_system and sort by operating_system,
            # operating_system_version DESC, time_created
            images = sorted(sorted(
                [i for i in images if i.operating_system == operating_system],
                key=lambda img: (img.operating_system,
                                 img.operating_system_version,
                                 img.time_created),
                reverse=True), key=lambda img: img.operating_system)

            return core.return_oci_object(
                oci_object=images,
                return_formatted=return_formatted,
                return_python_object=return_python_object,
                format_function=format_compute_images)
        except oci.exceptions.ServiceError as e:
            if raise_exceptions:
                raise
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
    except Exception as e:
        if raise_exceptions:
            raise
        print(f"ERROR: {str(e)}")


@plugin_function('mds.get.computeImage')
def get_image(**kwargs):
    """Gets a compute image

    Args:
        **kwargs: Additional options

    Keyword Args:
        operating_system (str): The name of the operating system
        operating_system_version (str): The version of the operating system
        image_caption (str): The caption of the compute image to use
        shape (str): The name of the shape to use.
        use_latest_image (bool): Whether to use the latest compute image
        compartment_id (str): OCID of the parent compartment.
        config (dict): An OCI config object or None
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised
        return_formatted (bool): If true a human readable string is returned
        return_python_object (bool): Used for internal plugin calls

    Returns:
        a compute image object
    """

    operating_system = kwargs.get("operating_system")
    operating_system_version = kwargs.get("operating_system_version")
    image_caption = kwargs.get("image_caption")
    shape = kwargs.get("shape")
    use_latest_image = kwargs.get("use_latest_image", False)

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)
    return_python_object = kwargs.get("return_python_object", False)

    # Get the active config and compartment
    try:
        # Get the active config and compartment
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        images = list_images(
            operating_system=operating_system,
            operating_system_version=operating_system_version,
            image_caption=image_caption,
            shape=shape,
            compartment_id=compartment_id, config=config,
            interactive=interactive, raise_exceptions=raise_exceptions,
            return_python_object=True)

        if len(images) == 0:
            raise ValueError(
                "No compute image found using the given parameters."
                "Operation cancelled.")
        # If there is only one image, return it
        image = None
        if len(images) == 1 or use_latest_image or not interactive:
            image = images[0]
        else:
            # Let the user choose from the image list
            print(f"\nPlease choose a compute image from this list.\n")
            image = core.prompt_for_list_item(
                item_list=images, prompt_caption=(
                    "Please enter the name or index of the "
                    "compute image: "),
                item_name_property="display_name",
                given_value=image_caption,
                print_list=True)

        return core.return_oci_object(
            oci_object=image,
            return_formatted=return_formatted,
            return_python_object=return_python_object,
            format_function=format_compute_images)
    except Exception as e:
        if raise_exceptions:
            raise
        print(f"ERROR: {str(e)}")


@plugin_function('mds.get.computeImageId')
def get_image_id(operating_system=None, operating_system_version=None,
                 image_caption=None, shape=None, compartment_id=None,
                 config=None, interactive=True):
    """Gets a compute image id

    Args:
        operating_system (str): The name of the operating system
        operating_system_version (str): The version of the operating system
        image_caption (str): The caption of the compute image to use
        shape (str): The name of the shape to use.
        compartment_id (str): OCID of the parent compartment.
        config (object): An OCI config object or None.
        interactive (bool): Whether expections are raised

    Returns:
        an OCID
    """

    image = get_image(
        operating_system=operating_system,
        operating_system_version=operating_system_version,
        image_caption=operating_system_version, shape=shape,
        compartment_id=compartment_id, config=config,
        interactive=interactive)

    return None if image is None else image.id


def format_vnic_listing(vnics):
    """Returns a formatted list of vnics.

    Args:
        vnics (list): A list of vnics objects.

    Returns:
        The formatted list as string
    """
    import re

    out = ""
    i = 1
    for v in vnics:
        # Shorten to 24 chars max, remove linebreaks
        name = re.sub(r'[\n\r]', ' ',
                      v.display_name[:22] + '..'
                      if len(v.display_name) > 24
                      else v.display_name)

        private_ip = v.private_ip if v.private_ip else ""
        public_ip = v.public_ip if v.public_ip else ""

        out += (f"{i:>4} {name:24} {private_ip:15} {public_ip:15} "
                f"{v.lifecycle_state[:8]:8} {v.time_created:%Y-%m-%d %H:%M}\n")
        i += 1

    return out


@plugin_function('mds.list.computeInstanceVnics')
def list_vnics(**kwargs):
    """Lists all available vnics for the given compartment and
    availability_domain

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        instance_id (str): OCID of the compute instance
        availability_domain (str): The name of the availability_domain to use.
        ignore_current (bool): Whether the current instance should be ignored
        compartment_id (str): OCID of the parent compartment
        config (dict): An OCI config object or None
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised
        return_formatted (bool): If true a human readable string is returned
        return_python_object (bool): Used for internal plugin calls

    Returns:
        The list of shapes in either JSON or human readable format
    """

    instance_id = kwargs.get("instance_id")
    availability_domain = kwargs.get("availability_domain")
    ignore_current = kwargs.get("ignore_current", False)

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)
    return_python_object = kwargs.get("return_python_object", False)

    try:
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        current_instance_id = configuration.get_current_instance_id(
            config=config)
        if not ignore_current and not instance_id:
            instance_id = current_instance_id

        if not instance_id and interactive:
            instance_id = get_instance_id(
                compartment_id=compartment_id,
                config=config, interactive=interactive)
        if not instance_id:
            raise ValueError("No instance_id given."
                             "Cancelling operation")

        import oci.exceptions

        try:
            # Initialize the oci client
            compute = core.get_oci_compute_client(config=config)
            network = core.get_oci_virtual_network_client(config=config)

            vnic_attachments = compute.list_vnic_attachments(
                compartment_id=compartment_id,
                availability_domain=availability_domain,
                instance_id=instance_id).data

            vnics = []
            for vnic_att in vnic_attachments:
                vnics.append(network.get_vnic(vnic_att.vnic_id).data)

            return core.return_oci_object(
                oci_object=vnics,
                return_formatted=return_formatted,
                return_python_object=return_python_object,
                format_function=format_vnic_listing)

        except oci.exceptions.ServiceError as e:
            if raise_exceptions:
                raise
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
    except Exception as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')


@plugin_function('mds.create.computeInstance')
def create_instance(**kwargs):
    """Creates a new compute instance

    This function will create a new compartment.

    Args:
        **kwargs: Additional options

    Keyword Args:
        instance_name (str): The name used for the new compartment.
        availability_domain (str): The name of the availability_domain to use
        shape (str): The compute shape used for the instance
        cpu_count (int): The number of OCPUs
        memory_size (int): The amount of memory
        subnet_id (str): The OCID of the subnet to use
        public_subnet (bool): Whether the subnet should be public or private
        operating_system (str): The name of the operating system,
            e.g. "Oracle Linux"
        operating_system_version (str): The version of the operating system,
            e.g. 8
        use_latest_image (bool): Whether to use the latest compute image
        ssh_public_key_path (str): The path to the public ssh key,
            default is ~/.ssh/id_rsa.pub
        init_script (str): A string holding the commands to execute at first
            instance startup, starting with #!/bin/bash and separated by
            linebreaks
        init_script_file_path (str): The path to an init script to be
            executed at first instance startup. If specified, this file
            will be used instead of the script passed in the init_script
            parameter
        defined_tags (dict): The defined_tags of the dynamic group.
        freeform_tags (dict): The freeform_tags of the dynamic group
        compartment_id (str): OCID of the parent compartment.
        config (object): An OCI config object or None.
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised
        return_formatted (bool): If true a human readable string is returned
        return_python_object (bool): Used for internal plugin calls
    Returns:
        The new instance if interactive is set to false
    """

    instance_name = kwargs.get("instance_name")
    availability_domain = kwargs.get("availability_domain")
    shape = kwargs.get("shape")
    cpu_count = kwargs.get("cpu_count", 1)
    memory_size = kwargs.get("memory_size", 16)
    subnet_id = kwargs.get("subnet_id")
    public_subnet = kwargs.get("public_subnet")
    operating_system = kwargs.get("operating_system")
    operating_system_version = kwargs.get("operating_system_version")
    use_latest_image = kwargs.get("use_latest_image", False)
    ssh_public_key_path = kwargs.get(
        "ssh_public_key_path", "~/.ssh/id_rsa.pub")
    init_script = kwargs.get("init_script")
    init_script_file_path = kwargs.get("init_script_file_path")
    defined_tags = kwargs.get("defined_tags")
    # Manual conversion from Shell Dict type until this is automatically done
    if defined_tags:
        defined_tags = dict(defined_tags)
    freeform_tags = kwargs.get("freeform_tags")
    # Manual conversion from Shell Dict type until this is automatically done
    if freeform_tags:
        freeform_tags = dict(freeform_tags)

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)
    return_python_object = kwargs.get("return_python_object", False)

    # Get the active config and compartment
    try:
        # Get the active config and compartment
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        import oci.core.models
        import oci.exceptions
        import oci.pagination
        import os.path
        import pathlib
        import base64
        from pathlib import Path
        import mysqlsh
        from mds_plugin import compartment
        from mds_plugin import network

        try:
            if interactive:
                print("Creating a new compute instance ...\n")

            # Get a name
            if instance_name is None and interactive:
                instance_name = mysqlsh.globals.shell.prompt(
                    "Please enter the name for the new instance: ",
                    {'defaultValue': ''}).strip()
            if not instance_name:
                raise ValueError(
                    "No instance name given. Operation cancelled.")

            # Get the availability_domain name
            availability_domain_obj = compartment.get_availability_domain(
                compartment_id=compartment_id,
                availability_domain=availability_domain,
                random_selection=True,
                config=config,
                interactive=interactive,
                return_python_object=True)
            if availability_domain_obj is None:
                raise ValueError("No availability domain given. "
                                 "Operation cancelled.")
            else:
                availability_domain = availability_domain_obj.name
            if interactive:
                print(f"Using availability domain {availability_domain}.")

            # Get list of available shapes
            shape_name = get_shape_name(
                shape_name=shape, compartment_id=compartment_id,
                availability_domain=availability_domain, config=config,
                interactive=interactive)
            if not shape_name:
                print("Operation cancelled.")
                return
            if interactive:
                print(f"Using shape {shape_name}.")

            # Get id of compute image
            image = get_image(
                operating_system=operating_system,
                operating_system_version=operating_system_version,
                use_latest_image=use_latest_image,
                shape=shape_name, compartment_id=compartment_id, config=config,
                interactive=interactive,
                return_python_object=True)
            if image is None:
                print("Operation cancelled.")
                return
            image_id = image.id
            if interactive:
                print(f"Using image {image.display_name}.")

            # Convert Unix path to Windows
            ssh_public_key_path = os.path.abspath(
                os.path.expanduser(ssh_public_key_path))

            # Check if there is a key available
            if os.path.exists(ssh_public_key_path):
                with open(ssh_public_key_path, mode='r') as file:
                    public_key = file.read()
            else:
                from cryptography.hazmat.primitives import serialization
                from cryptography.hazmat.backends import default_backend
                from cryptography.hazmat.primitives.asymmetric import rsa
                import stat

                key = rsa.generate_private_key(
                    public_exponent=65537,
                    key_size=2048,
                    backend=default_backend()
                )
                # cSpell:ignore PKCS
                private_key = key.private_bytes(
                    serialization.Encoding.PEM,
                    serialization.PrivateFormat.PKCS8,
                    serialization.NoEncryption())

                public_key = key.public_key().public_bytes(
                    serialization.Encoding.OpenSSH,
                    serialization.PublicFormat.OpenSSH
                )

                # Build ssh_private_key_path from ssh_public_key_path by
                # removing extension
                ssh_private_key_path = os.path.splitext(ssh_public_key_path)[0]
                if ssh_private_key_path == ssh_public_key_path:
                    ssh_private_key_path = ssh_public_key_path + ".private"

                # Create path
                key_path = os.path.dirname(
                    os.path.abspath(ssh_private_key_path))
                Path(key_path).mkdir(parents=True, exist_ok=True)

                # Write out keys
                with open(ssh_private_key_path, mode='wb') as file:
                    file.write(private_key)
                with open(ssh_public_key_path, mode='wb') as file:
                    file.write(public_key)

                # Fix permissions
                # cSpell:ignore IRUSR IWUSR
                os.chmod(ssh_private_key_path, stat.S_IRUSR | stat.S_IWUSR)
                os.chmod(ssh_public_key_path, stat.S_IRUSR | stat.S_IWUSR)

                # Encode public_key to string
                public_key = public_key.decode("utf-8")

            # Set SSH key and creator metadata
            instance_metadata = {
                'ssh_authorized_keys': public_key,
                'creator': 'MySQL Shell MDS Plugin'
            }

            # Load init_script_file_path if given
            if init_script_file_path:
                init_script_file_path = os.path.abspath(
                    os.path.expanduser(init_script_file_path))

                if not os.path.exists(init_script_file_path):
                    print(f"Error: Init script file path '{init_script_file_path}' "
                          "not found.")
                    return
                instance_metadata['user_data'] = \
                    oci.util.file_content_as_launch_instance_user_data(
                    init_script_file_path)
            # Set the init_script if given
            elif init_script:
                instance_metadata['user_data'] = base64.b64encode(
                    init_script.encode('utf-8')).decode('utf-8')

            # Get a public subnet for the instance
            if not subnet_id and interactive:
                print("Selecting a subnet for the compute instance ...")
            subnet = network.get_subnet(
                subnet_id=subnet_id, public_subnet=public_subnet,
                availability_domain=availability_domain,
                compartment_id=compartment_id, config=config)
            if subnet is None and public_subnet == True and interactive:
                print("\nDo you want to select "
                      "a network with a private subnet instead?\n\n"
                      "Please note that access from the internet will "
                      "not be possible and a \njump host needs to be "
                      "used to access the resource\n")
                prompt = mysqlsh.globals.shell.prompt(
                    "Select a network with a private subnet [YES/no]: ",
                    {'defaultValue': 'yes'}).strip().lower()
                if prompt == "yes":
                    subnet = network.get_subnet(
                        subnet_id=subnet_id, public_subnet=False,
                        compartment_id=compartment_id, config=config)

            if subnet is None:
                print("Operation cancelled.")
                return

            if interactive:
                print(f"Using subnet {subnet.display_name}.")

            # Setup the instance details
            launch_instance_details = oci.core.models.LaunchInstanceDetails(
                display_name=instance_name,
                compartment_id=compartment_id,
                availability_domain=availability_domain,
                shape=shape_name,
                shape_config=oci.core.models.LaunchInstanceShapeConfigDetails(
                    ocpus=float(cpu_count),
                    memory_in_gbs=float(memory_size)
                ),
                metadata=instance_metadata,
                source_details=oci.core.models.InstanceSourceViaImageDetails(
                    image_id=image_id),
                create_vnic_details=oci.core.models.CreateVnicDetails(
                    subnet_id=subnet.id
                ),
                defined_tags=defined_tags,
                freeform_tags=freeform_tags,
                agent_config=oci.core.models.LaunchInstanceAgentConfigDetails(
                    plugins_config=[
                        oci.core.models.InstanceAgentPluginConfigDetails(
                            desired_state="ENABLED",
                            name="Bastion"
                        )
                    ]
                )
            )

            # Initialize the identity client
            compute = core.get_oci_compute_client(config=config)

            # Create the instance
            instance = compute.launch_instance(launch_instance_details).data

            if interactive:
                print(f"Compute instance {instance_name} is being created.\n"
                      f"Use mds.ls() to check it's provisioning state.\n")

            return core.return_oci_object(
                oci_object=instance,
                return_formatted=return_formatted,
                return_python_object=return_python_object,
                format_function=format_instance_listing)
        except oci.exceptions.ServiceError as e:
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
            return
    except Exception as e:
        if raise_exceptions:
            raise
        print(f"ERROR: {str(e)}")


@plugin_function('mds.delete.computeInstance', shell=True, cli=True, web=True)
def delete_instance(**kwargs):
    """Deletes the compute instance with the given name

    If no name is given, it will prompt the user for the name.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        instance_name (str): The name of the instance.
        instance_id (str): The OCID of the instance
        await_deletion (bool): Whether to wait till the bastion reaches
            lifecycle state DELETED
        compartment_id (str): OCID of the compartment.
        config (dict): An OCI config object or None.
        config_profile (str): The name of an OCI config profile
        ignore_current (bool): Whether the current instance should be ignored
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
       None
    """

    instance_name = kwargs.get("instance_name")
    instance_id = kwargs.get("instance_id")
    await_deletion = kwargs.get("await_deletion")

    compartment_id = kwargs.get("compartment_id")
    ignore_current = kwargs.get("ignore_current", False)
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        if not ignore_current and instance_name is None:
            instance_id = configuration.get_current_instance_id(
                instance_id=instance_id, config=config)

        import oci.exceptions

        try:
            # Initialize the compute client
            compute_client = core.get_oci_compute_client(config=config)

            if not instance_id:
                instance = get_instance(
                    instance_name=instance_name, compartment_id=compartment_id,
                    config=config, interactive=interactive,
                    raise_exceptions=raise_exceptions,
                    return_python_object=True)
            else:
                instance = get_instance_by_id(
                    instance_id=instance_id, config=config,
                    interactive=interactive,
                    raise_exceptions=raise_exceptions,
                    return_python_object=True)

            if interactive:
                # Prompt the user for confirmation
                prompt = core.prompt(
                    "Are you sure you want to delete the instance "
                    f"{instance.display_name} [yes/NO]: ",
                    {'defaultValue': 'no'}).strip().lower()

                if prompt != "yes":
                    raise Exception("Deletion aborted.")

            compute_client.terminate_instance(instance.id)

            # If the function should wait till the bastion reaches the DELETED
            # lifecycle state
            if await_deletion:
                import time
                if interactive:
                    print('Waiting for instance to be deleted...', end="")

                # Wait for the instance to be TERMINATED
                cycles = 0
                while cycles < 48:
                    instance = compute_client.get_instance(
                        instance_id=instance_id).data
                    if instance.lifecycle_state == "TERMINATED":
                        break
                    else:
                        time.sleep(5)
                        # s = "." * (cycles + 1)
                        if interactive:
                            print('.', end="")
                    cycles += 1

                if interactive:
                    print("")

                if instance.lifecycle_state != "TERMINATED":
                    raise Exception("Instance did not reach the TERMINATED "
                                    "state within 4 minutes.")
                if interactive:
                    print(f"Instance '{instance.display_name}' "
                          "was deleted successfully.")
            elif interactive:
                print(f"Instance '{instance.display_name}' is being deleted.")

        except oci.exceptions.ServiceError as e:
            if interactive:
                raise
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
    except (Exception) as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')


@plugin_function('mds.update.computeInstance')
def update_instance(instance_name=None, **kwargs):
    """Updates a compute instance with the new values

    If no name is given, it will prompt the user for the name.

    Args:
        instance_name (str): The name of the instance.
        **kwargs: Additional options.

    Keyword Args:
        instance_id (str): The OCID of the instance.
        name (str): The new name to use
        compartment_id (str): OCID of the compartment.
        config (dict): An OCI config object or None.
        interactive (bool): Whether user input is required.

    Returns:
       None
    """
    instance_id = kwargs.get("instance_id")
    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    new_name = kwargs.get("name")
    interactive = kwargs.get("interactive", True)

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        import oci.core.models
        import oci.exceptions
        import mysqlsh

        # Initialize the compute client
        compute = core.get_oci_compute_client(config=config)

        if instance_id is None or instance_id == "":
            instance = get_instance(
                instance_name=instance_name, compartment_id=compartment_id,
                config=config, interactive=interactive,
                return_python_object=True)
        else:
            instance = get_instance_by_id(
                instance_id=instance_id, config=config,
                interactive=interactive,
                return_python_object=True)

        if new_name is None and interactive:
            new_name = mysqlsh.globals.shell.prompt(
                "Please enter a new name for the instance "
                f"[{instance.display_name}]: ",
                {'defaultValue': instance.display_name}).strip()

        if new_name == instance.display_name:
            print("Operation cancelled.")
            return

        update_details = oci.core.models.UpdateInstanceDetails(
            display_name=new_name
        )
        compute.update_instance(instance_id=instance.id,
                                update_instance_details=update_details)

        print(f"Compute instance {instance.display_name} was updated.\n")
    except oci.exceptions.ServiceError as e:
        if e.code == "NotAuthorizedOrNotFound":
            print(f'You do not have privileges to delete this instance.\n')
        else:
            print(
                f'Could not delete the instance {instance.display_name}\n')
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
    except Exception as e:
        print(f"ERROR: {str(e)}")


@plugin_function('mds.execute.ssh')
def execute_ssh_command(command=None, **kwargs):
    """Execute the given command on the instance

    If no name is given, it will prompt the user for the name.

    Args:
        command (str): The command to execute.
        **kwargs: Additional options

    Keyword Args:
        instance_name (str): The name of the instance.
        instance_id (str): The OCID of the instance
        private_key_file_path (str): The path to the private key
        private_key_passphrase (str): The passphrase of the private key
        compartment_id (str): OCID of the compartment.
        config (object): An OCI config object or None.
        interactive (bool): Whether to prompt the user for input and
            throw exceptions

    Returns:
       None
    """

    instance_name = kwargs.get("instance_name")
    instance_id = kwargs.get("instance_id")
    private_key_file_path = kwargs.get(
        "private_key_file_path", "~/.ssh/id_rsa")
    private_key_passphrase = kwargs.get("private_key_passphrase")
    instance_id = kwargs.get("instance_id")
    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    interactive = kwargs.get("interactive", True)

    # Get the active config, compartment and instance
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        instance_id = configuration.get_current_instance_id(
            instance_id=instance_id, config=config)

        import oci.exceptions
        import mysqlsh

        if not interactive and command is None:
            raise ValueError("No command given.")

        instance = get_instance(
            instance_name=instance_name, instance_id=instance_id,
            compartment_id=compartment_id, config=config)
        if instance is None:
            print("Operation cancelled.")
            return

        public_ip = get_instance_public_ip(
            instance_name=instance_name, instance_id=instance.id,
            compartment_id=compartment_id, config=config,
            private_ip_fallback=True)
        if public_ip == "":
            print("ERROR: No public IP address found.\n")
            return

        # If no command was given and interactive is enabled, loop until
        # an empty command or exit is provided by the user input
        multi_command = command is None and interactive
        output = None

        with SshConnection(
                username="opc", host=public_ip,
                private_key_file_path=private_key_file_path,
                private_key_passphrase=private_key_passphrase) as conn:

            if multi_command:
                print(f"\nConnected to 'opc@{public_ip}' via SSH. "
                      "Type 'exit' to close the connection.")

            # Repeat command execution till the give command is empty or exit
            while command is None or \
                    (command != "" and command.lower() != "exit"):
                if multi_command:
                    command = mysqlsh.globals.shell.prompt(
                        f"{public_ip} opc$ ").strip()
                    if command == "" or command.lower() == "exit":
                        return
                # Execute the command
                output = conn.execute(command)

                # If there was an error, print it
                last_error = conn.get_last_error()
                if last_error != "":
                    output += f"ERROR: {last_error}"

                # If multi_command is not enabled, break after first execution
                if not multi_command:
                    return output
                else:
                    print(output)

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
