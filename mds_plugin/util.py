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

"""Sub-Module with utilities for the MySQL Database Service"""

from mysqlsh.plugin_manager import plugin_function
from mds_plugin import core, configuration, mysql_database_service
from os import getenv

# cSpell:ignore SQLDB, Popen, bufsize, dryrun


@plugin_function('mds.util.heatWaveLoadData', shell=True, cli=True, web=True)
def mds_heat_wave_load_data(**kwargs):
    """Loads data to a HeatWave Cluster

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        schemas (list): The list of schemas
        mode (str): The mode to use, "normal"|"dryrun"
        output (str): The output mode to use, "normal"|"compact"|"silent"|"help"
        disable_unsupported_columns (bool): Whether to disable unsupported columns
        optimize_load_parallelism (bool): Whether to optimize parallelism
        enable_memory_check (bool): Whether to enable the memory check
        sql_mode (str): The sql_mode to use
        exclude_list (str): The database object list to exclude
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
       None in interactive mode, the result sets as string otherwise
    """
    schemas = kwargs.get("schemas")
    mode = kwargs.get("mode", "normal")
    output = kwargs.get("output", "normal")
    disable_unsupported_columns = kwargs.get(
        "disable_unsupported_columns", True)
    optimize_load_parallelism = kwargs.get("optimize_load_parallelism", True)
    enable_memory_check = kwargs.get("enable_memory_check", True)
    sql_mode = kwargs.get("sql_mode", "")
    exclude_list = kwargs.get("exclude_list", "")

    session = kwargs.get("session")
    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)

    try:
        if not schemas:
            raise ValueError("At least one schema needs to be specified.")

        session = core.get_current_session(session)

        policy = (
            "disable_unsupported_columns" if disable_unsupported_columns else "not_disable_unsupported_columns")
        set_load_parallelism = (
            "TRUE" if optimize_load_parallelism else "FALSE")

        schemasJson = "JSON_ARRAY(" + \
            ', '.join(f'"{s}"' for s in schemas) + ")"
        optionsJson = ("JSON_OBJECT("
                       f'"mode", "{mode}", '
                       f'"output", "{output}", '
                       f'"sql_mode", {sql_mode}, '
                       f'"policy", "{policy}", '
                       f'"set_load_parallelism", {set_load_parallelism}, '
                       f'"auto_enc", JSON_OBJECT("mode", "{"check" if enable_memory_check else "off"}")')
        if exclude_list:
            optionsJson += f', "exclude_list", JSON_ARRAY({exclude_list})'
        optionsJson += ")"

        if interactive:
            print(f"Loading Data to HeatWave Cluster Using Auto Parallel Load.\n")

        sql = f"CALL sys.heatwave_load({schemasJson}, {optionsJson})"
        if interactive:
            print(f"MySQL > {sql}\n")

        res = session.run_sql(sql)

        out_str = ""
        next_result = True
        while next_result:
            rows = res.fetch_all()

            if len(rows) == 0:
                next_result = res.next_result()
                continue

            if interactive:
                print(core.format_result_set(res, rows, addFooter=False))
            else:
                out_str += out_str + "\n"

            next_result = res.next_result()

        if not interactive:
            return out_str

    except Exception as e:
        if raise_exceptions:
            raise
        else:
            print(f"Error: {str(e)}")


@plugin_function('mds.util.createComputeInstanceForEndpoint')
def create_compute_instance_for_endpoint(**kwargs):
    """Returns a public compute instance

    If the instance does not yet exists in the compartment, create it

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        instance_name (str): The name of the compute instance
        db_system_name (str): The new name of the DB System.
        db_system_id (str): The OCID of the db_system
        private_key_file_path (str): The file path to an SSH private key
        subnet_id (str): The OCID of the subnet to use
        public_ip (bool): If set to false, no public IP will be assigned
        shape (str): The name of the shape to use
        cpu_count (int): The number of OCPUs
        memory_size (int): The amount of memory
        dns_a_record_notification (bool): Whether to print a message to setup the DNS A record for this instance
        domain_name (str): The domain name of the compute instance
        compartment_id (str): The OCID of the compartment
        config (object): An OCI config object or None.
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised
        return_formatted (bool): If set to true, a list object is returned
        return_python_object (bool): Used for internal plugin calls

    Returns:
       None
    """
    instance_name = kwargs.get("instance_name", "MDSJumpHost")
    db_system_name = kwargs.get("db_system_name")
    db_system_id = kwargs.get("db_system_id")
    private_key_file_path = kwargs.get(
        "private_key_file_path", "~/.ssh/id_rsa")
    public_ip = kwargs.get("public_ip", True)
    subnet_id = kwargs.get("subnet_id")
    shape = kwargs.get("shape", "VM.Standard.E4.Flex")
    cpu_count = kwargs.get("cpu_count", 1)
    memory_size = kwargs.get("memory_size", 16)
    dns_a_record_notification = kwargs.get("dns_a_record_notification", False)
    domain_name = kwargs.get("domain_name")

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)
    return_python_object = kwargs.get("return_python_object", False)

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        import oci.mysql
        from pathlib import Path
        import os.path
        from mds_plugin import compartment, compute, network
        import time

        db_system = mysql_database_service.get_db_system(
            db_system_name=db_system_name, db_system_id=db_system_id,
            compartment_id=compartment_id, config=config,
            interactive=interactive, raise_exceptions=True,
            return_python_object=True)
        if db_system is None:
            raise ValueError("DB System not specified or found.")

        # Get compartment and public subnet_id from MDS
        if not compartment_id:
            compartment_id = db_system.compartment_id
        if not subnet_id:
            mds_subnet = network.get_subnet(
                subnet_id=db_system.subnet_id,
                config=config, interactive=False)
            subnet = network.get_subnet(
                network_id=mds_subnet.vcn_id,
                public_subnet=public_ip,
                config=config,
                interactive=False)
            if subnet:
                subnet_id = subnet.id

        if not subnet_id:
            if public_ip:
                raise ValueError(
                    'The network used by the MDS instance does not have public subnet.'
                    'Please add a public subnet first')
            else:
                raise ValueError('No subnet specified.')

        # Try to get the Compute Instance with the given name
        mds_jump_host = compute.get_instance(
            instance_name=instance_name,
            compartment_id=compartment_id,
            config=config, interactive=False,
            raise_exceptions=True,
            return_python_object=True)

        # If it already exists, return it
        if mds_jump_host:
            return mds_jump_host

        # if interactive:
        #     # If there is no MySQL DBSystemProxy instance yet, ask the user
        #     print(f"In order to perform the requested operation for the MySQL "
        #           f"DB System\na compute instance named 'MDSJumpHost' "
        #           f"needs to be created.\n")
        #     prompt = core.prompt(
        #         "Do you want to create a new compute instance to be used as "
        #         "bastion host? [YES/no]: ",
        #         {'defaultValue': 'yes'}).strip().lower()
        #     if prompt != "yes":
        #         print("Operation cancelled.\n")
        #         return

        if interactive:
            print(f"Creating Compute Instance '{instance_name}'...")

        new_jump_host = compute.create_instance(
            instance_name=instance_name,
            shape=shape,
            cpu_count=cpu_count, memory_size=memory_size,
            operating_system="Oracle Linux",
            operating_system_version="9",
            use_latest_image=True,
            subnet_id=subnet_id,
            public_subnet=public_ip,
            init_script_file_path=os.path.join(
                os.path.join(Path(__file__).parent.absolute(), "internal"), "init_router_script.sh"),
            interactive=False,
            return_python_object=True)
        if new_jump_host is None:
            print("Compute instance could not be created.")
            return

        # Initialize the identity client
        compute_client = core.get_oci_compute_client(config=config)

        print(f"Waiting for Compute Instance '{instance_name}' to become "
              "available.\nThis can take up to 5 minutes or more.", end="")

        # Wait until the lifecycle_state == RUNNING, 5 minutes max
        try:
            cycles = 0
            while cycles < 60:
                mds_jump_host = compute_client.get_instance(
                    new_jump_host.id).data
                if mds_jump_host.lifecycle_state == "RUNNING":
                    break
                else:
                    time.sleep(5)
                    print(".", end="")
                cycles += 1
            print("")
        except oci.exceptions.ServiceError as e:
            print(f'Could not fetch the compute instances state.\n'
                  f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
            return
        if mds_jump_host.lifecycle_state != "RUNNING":
            print(f"Compute Instance '{instance_name}' did not become available "
                  f"within 5 minutes. Please check the state manually.")
            return None if interactive else mds_jump_host

        if interactive:
            print(f"Compute Instance '{instance_name}' became available.")

        # Get the public IP of the instance
        public_ip = compute.get_instance_public_ip(
            instance_id=mds_jump_host.id, compartment_id=compartment_id,
            config=config, private_ip_fallback=True)
        if public_ip is None or public_ip == "":
            raise Exception(
                f"The public IP of the {instance_name} instance could not be "
                "fetched.")

        if dns_a_record_notification and interactive:
            print("\nATTENTION: Please create a DNS A record using the following values.\n"
                  f"Domain: {domain_name}\n"
                  f"Destination TCP/IP address: {public_ip}")

            answered = False
            while not answered:
                try:
                    result = core.prompt(
                        f"Please click OK once the DNS A record has been created. [OK/Cancel]: ",
                        {"defaultValue": "OK"})
                    answered = True
                except:
                    print(
                        "Please select OK or Cancel on the confirmation notification.")
                    pass

            if result != "OK":
                raise Exception(
                    "Endpoint creation cancelled. Please delete the compute instance that has been created.")

        if interactive:
            print("\nPerforming base configuration.\n"
                  f"Connecting to {instance_name} instance at {public_ip}...",
                  end="")

        setup_complete = False
        connected = False
        cycles = 0
        while not setup_complete and cycles < 10:
            cycles += 1
            try:
                with compute.SshConnection(
                        username="opc", host=public_ip,
                        private_key_file_path=private_key_file_path) as conn:

                    connected = True
                    if interactive:
                        print(f"\nConnected to {instance_name} instance at "
                              f"{public_ip}.")

                    # Get MySQL Router configuration from remote instance
                    output = ""
                    output = conn.execute('mysqlsh --js -e "mds.info()"').strip()
                    if "MySQL Shell MDS Plugin" not in output:
                        # If the config is not available yet, give the instance
                        # time to complete setup
                        if interactive:
                            print(f"Waiting for {instance_name} setup to be "
                                  f"completed.\nThis can take up to 2 minutes.",
                                  end="")
                        try:
                            i = 0
                            while ("MySQL Shell MDS Plugin" not in output
                                   and i < 25):
                                output = conn.execute(
                                    'mysqlsh --js -e "mds.info()"').strip()
                                if "MySQL Shell MDS Plugin" not in output:
                                    time.sleep(5)
                                    if interactive:
                                        print(".", end="")
                                i += 1
                        except:
                            pass

                        if interactive:
                            print("")

                    if "MySQL Shell MDS Plugin" not in output:
                        raise Exception(
                            f"\nCould not finish the '{instance_name}' setup "
                            f"at {public_ip}.\n")
                    else:
                        setup_complete = True

            except Exception as e:
                if cycles < 10 and not connected:
                    time.sleep(5)
                    if interactive:
                        print(".", end="")
                else:
                    raise Exception(
                        f"Could not connect to compute instance "
                        f"'{instance_name}' at {public_ip}.\n"
                        f"ERROR: {str(e)}")

        if interactive:
            print(f"Compute Instance '{instance_name}' successfully created.")

        return core.return_oci_object(
            oci_object=new_jump_host,
            return_formatted=return_formatted,
            return_python_object=return_python_object,
            format_function=compute.format_instance_listing)
    except Exception as e:
        if raise_exceptions:
            raise
        print(f"ERROR: {str(e)}")


@plugin_function('mds.util.createEndpoint', shell=True, cli=True, web=True)
def add_public_endpoint(**kwargs):
    """Creates a public endpoint using MySQL Router on a compute instance

    If no id is given, it will prompt the user for the id.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        instance_name (str): Name of the compute instance
        db_system_name (str): The new name of the DB System.
        db_system_id (str): The OCID of the db_system
        private_key_file_path (str): The file path to an SSH private key
        shape (str): The name of the shape to use
        cpu_count (int): The number of OCPUs
        memory_size (int): The amount of memory
        mysql_user_name (str): The MySQL user name to use for bootstrapping
        public_ip (bool): If set to true, a public IP will be assigned to the compute instance
        domain_name (str): The domain name of the compute instance
        port_forwarding (bool): Whether port forwarding of MySQL ports should be enabled
        mrs (bool): Whether the MySQL REST Service (MRS) should be enabled
        ssl_cert (bool): Whether SSL Certificates should be managed
        jwt_secret (str): The JWT secret for MRS
        compartment_id (str): The OCID of the compartment
        config (object): An OCI config object or None.
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised
        return_formatted (bool): If set to true, a list object is returned

    Returns:
       None
    """

    # cSpell:ignore OCPU
    instance_name = kwargs.get("instance_name")
    db_system_name = kwargs.get("db_system_name")
    db_system_id = kwargs.get("db_system_id")
    private_key_file_path = kwargs.get(
        "private_key_file_path", "~/.ssh/id_rsa")
    shape = kwargs.get("shape", "VM.Standard.E4.Flex")
    cpu_count = kwargs.get("cpu_count", 1)
    memory_size = kwargs.get("memory_size", 16)

    mysql_user_name = kwargs.get("mysql_user_name", "dba")
    mysql_user_password = core.prompt(
        f"Please enter the password for {mysql_user_name}",
        {"type": "password"})

    public_ip = kwargs.get("public_ip", True)
    domain_name = kwargs.get("domain_name")

    port_forwarding = kwargs.get("port_forwarding", True)
    mrs = kwargs.get("mrs", True)
    ssl_cert = kwargs.get("ssl_cert", False)
    jwt_secret = kwargs.get("jwt_secret")

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        db_system_id = configuration.get_current_db_system_id(
            db_system_id=db_system_id, config=config)

        from mds_plugin import compute
        import configparser
        import io
        import time
        import hashlib

        db_system = mysql_database_service.get_db_system(
            db_system_name=db_system_name, db_system_id=db_system_id,
            compartment_id=compartment_id, config=config,
            interactive=interactive,
            return_python_object=True)
        if db_system is None:
            raise ValueError("No DB System selected."
                             "Cancelling operation")

        if not jwt_secret:
            md5 = hashlib.md5()
            md5.update(db_system.id.encode())
            jwt_secret = md5.hexdigest()

        # Get the first active endpoint
        endpoints = [e for e in db_system.endpoints if e.status == 'ACTIVE']
        if len(endpoints) < 1:
            raise Exception(
                "This MySQL DB System has no active endpoints assigned.")
        endpoint = endpoints[0]

        # Get the compute instance (let the user create it
        # if it does not exist yet)
        jump_host = create_compute_instance_for_endpoint(
            instance_name=instance_name,
            private_key_file_path=private_key_file_path,
            db_system_id=db_system_id,
            shape=shape, memory_size=memory_size,
            cpu_count=cpu_count,
            dns_a_record_notification=ssl_cert,
            domain_name=domain_name,
            compartment_id=db_system.compartment_id, config=config,
            interactive=interactive,
            return_python_object=True)
        if not jump_host:
            raise Exception(f"Compute instance {instance_name} not available."
                            "Operation cancelled.")

        # Get the public IP of the instance
        public_ip = compute.get_instance_public_ip(
            instance_id=jump_host.id, compartment_id=db_system.compartment_id,
            config=config)
        if not public_ip:
            raise Exception(f"The public IP of the instance {instance_name} "
                            "could not be fetched.")

        sec_lists = compute.get_instance_vcn_security_lists(
            instance_id=jump_host.id,
            compartment_id=db_system.compartment_id,
            config=config, interactive=interactive,
            raise_exceptions=raise_exceptions,
            return_python_object=True)
        if sec_lists is None:
            raise Exception(
                "The network security lists could not be fetched.")

        # Allow traffic on port 80 in order to fetch the certs
        if mrs and public_ip:
            compute.add_ingress_port_to_security_lists(
                security_lists=sec_lists, port=80,
                description="MRS HTTP via Router",
                compartment_id=compartment_id, config=config,
                interactive=interactive,
                raise_exceptions=raise_exceptions)

        # Open an SSH connection to the instance
        if interactive:
            print("\nBootstrapping the MySQL Router.\n"
                  f"Connecting to {instance_name} instance at {public_ip}...")
        try:
            with compute.SshConnection(
                    username="opc", host=public_ip,
                    private_key_file_path=private_key_file_path) as conn:

                if interactive:
                    print(f"Connected to {instance_name} instance at "
                          f"{public_ip}.")

                # Get MySQL Router configuration from remote instance
                output = ""
                output = conn.execute(
                    'test -f /etc/mysqlrouter/'
                    'mysqlrouter.conf && echo "Available"').strip()
                if output != "Available":
                    # If the config is not available yet, give the instance time
                    # to complete setup
                    if interactive:
                        print(
                            f"Waiting for MySQL Router Configuration to become "
                            f"available.\nThis can take up to 2 minutes.",
                            end="")
                    try:
                        i = 0
                        while output != "Available" and i < 25:
                            output = conn.execute(
                                'test -f /etc/mysqlrouter/'
                                'mysqlrouter.conf && echo "Available"').strip()
                            if output != "Available":
                                time.sleep(5)
                                if interactive:
                                    print(".", end="")
                            i += 1
                    except:
                        pass

                if output == "":
                    raise Exception(
                        "Could not fetch MySQL Router configuration from remote instance.")

                if interactive:
                    print("Bootstrapping MySQL Router against "
                          f"{mysql_user_name}@{endpoint.ip_address}:{endpoint.port} "
                          f"using JWT secret {jwt_secret} ...")

                (success, output) = conn.executeAndSendOnStdin(
                    f"sudo mysqlrouter_bootstrap {mysql_user_name}@{endpoint.ip_address}:{endpoint.port} "
                    f"-u mysqlrouter "
                    f"--mrs --mrs-global-secret {jwt_secret} " if mrs else ""
                    "--https-port 8446 "
                    "--conf-set-option=http_server.ssl=0 "
                    "--conf-set-option=http_server.port=8446 ",
                    mysql_user_password)

                if not success:
                    if output:
                        print(output)
                    raise Exception("Bootstrap operation failed.")

                # Manually fix the MySQL Router config till bootstrap allows to disable SSL
                # Load config to in-memory stream
                conn.execute(
                    "sudo cp /etc/mysqlrouter/mysqlrouter.conf /home/opc/mysqlrouter.conf")
                conn.execute("sudo chown opc:opc /home/opc/mysqlrouter.conf")
                with io.BytesIO() as router_config_stream:
                    # Get the remote config file
                    try:
                        conn.get_remote_file_as_file_object(
                            "/home/opc/mysqlrouter.conf",
                            router_config_stream)
                    except Exception as e:
                        raise Exception("Could not get router config file. "
                                        f"{str(e)}")

                    # If there was an error, print it
                    last_error = conn.get_last_error()
                    if last_error != "":
                        raise Exception(f"Could not read router config file. "
                                        f"{last_error}")

                    # Load CLI config file
                    router_config = configparser.ConfigParser()
                    router_config.read_string(
                        router_config_stream.getvalue().decode("utf-8"))
                    router_config_stream.close()

                # # # Ensure that there is a section with the name of
                # # # "routing:classic"
                # # if "routing:classic" not in router_config.sections():
                # #     router_config["routing:classic"] = {}

                # # cnf = router_config["routing:classic"]
                # # cnf["routing_strategy"] = "round-robin"
                # # cnf["bind_address"] = "0.0.0.0"
                # # cnf["bind_port"] = "6446"
                # # cnf["destinations"] = f"{endpoint.ip_address}:{endpoint.port}"

                # # Ensure that there is a section with the name of "http_server"
                # if "http_server" not in router_config.sections():
                #     router_config["http_server"] = {}

                cnf = router_config["http_server"]
                cnf["port"] = "8446"
                cnf["ssl"] = "0"
                # cnf["ssl_cert"] = ""
                # cnf["ssl_key"] = ""
                # cnf["static_folder"] = "/var/run/mysqlrouter/www/"

                # # # Ensure that there is a section with the name of "routing:x"
                # # if "routing:x" not in router_config.sections():
                # #     router_config["routing:x"] = {}

                # # cnf = router_config["routing:x"]
                # # cnf["routing_strategy"] = "round-robin"
                # # cnf["bind_address"] = "0.0.0.0"
                # # cnf["bind_port"] = "6447"
                # # cnf["destinations"] = f"{endpoint.ip_address}:{endpoint.port_x}"

                # # # cSpell:ignore mrds SQLR
                # # # Ensure that there is a section with the name of
                # # # "mysql_rest_service"
                # # if "mysql_rest_service" not in router_config.sections():
                # #     router_config["mysql_rest_service"] = {}

                # # cnf = router_config["mysql_rest_service"]
                # # cnf["mysql_user"] = "dba"
                # # cnf["mysql_password"] = "MySQLR0cks!"
                # # cnf["mysql_read_only_route"] = "classic"
                # # cnf["mysql_read_write_route"] = "classic"

                if interactive:
                    print("Writing updated MySQL Router configuration file...")

                # Write config to in-memory stream
                with io.BytesIO() as router_config_bytes_stream:
                    with io.StringIO() as router_config_stream:
                        router_config.write(router_config_stream)

                        # Seek to the beginning of the text stream
                        router_config_bytes_stream.write(
                            router_config_stream.getvalue().encode("utf-8"))
                        router_config_bytes_stream.seek(0)

                        # Write out new config file to remote instance
                        try:
                            conn.put_local_file_object(
                                router_config_bytes_stream,
                                "/home/opc/mysqlrouter.conf")
                        except Exception as e:
                            raise Exception(
                                "Could not upload router config file. "
                                f"{str(e)}")

                # Move config to final place and fix privileges
                conn.execute(
                    "sudo cp /home/opc/mysqlrouter.conf /etc/mysqlrouter/mysqlrouter.conf")
                conn.execute(
                    "sudo chown mysqlrouter:mysqlrouter /etc/mysqlrouter/mysqlrouter.conf")
                conn.execute("sudo rm /home/opc/mysqlrouter.conf")

                # # If there was an error, print it
                # last_error = conn.get_last_error()
                # if last_error != "":
                #     raise Exception(
                #         "Could not upload router config file. "
                #         f"ERROR: {last_error}")

                # Install the SSL certificate
                if ssl_cert:
                    # Restart NGINX
                    conn.execute("sudo systemctl restart nginx.service")

                    ssl_cert_created = False
                    while not ssl_cert_created and domain_name != "":
                        # Check for one minute if the domain name points to the instance's ip address
                        if interactive:
                            print(
                                f"\nCreating the SSL certificate for {domain_name} ...")

                        try:
                            i = 0
                            while not ssl_cert_created and i < 5:
                                # cSpell:ignore certbot certonly webroot
                                # conn.execute(
                                #     f"sudo certbot certonly --webroot -w /usr/share/nginx/html -d {domain_name} --agree-tos "
                                #     "--register-unsafely-without-email --key-type rsa")
                                output = conn.execute(f"sudo /home/opc/.acme.sh/acme.sh --issue -d {domain_name} "
                                                      "--webroot /usr/share/nginx/html "
                                                      "--force --server letsencrypt --home /home/opc/.acme.sh")
                                last_error = conn.get_last_error()
                                if last_error != "":
                                    if i == 0 and interactive:
                                        print("\nATTENTION: Please create a DNS A record using the following values.\n"
                                              f"Domain: {domain_name}\n"
                                              f"Destination TCP/IP address: {public_ip}")
                                        print(
                                            f"\nWaiting for DNS A record creation ...", end="")
                                    time.sleep(10)
                                    if interactive:
                                        print(".", end="")
                                else:
                                    ssl_cert_created = True
                                i += 1
                        except:
                            pass

                        if not ssl_cert_created:
                            if interactive:
                                print(f"Failed to create the SSL certificate for {domain_name}. {output} {last_error}\n"
                                      "Please correct the domain name or leave empty to cancel.")

                            try:
                                domain_name = core.prompt(
                                    f"Domain Name for {public_ip}: ")
                                if not domain_name:
                                    if interactive:
                                        print(
                                            "Skipping SSL certificate generation.")
                                    domain_name = ""
                                    continue
                            except:
                                domain_name = ""
                                continue

                    if ssl_cert_created:
                        # Install Certificate
                        conn.execute("sudo mkdir -p /etc/pki/nginx/private")
                        # cSpell:ignore reloadcmd
                        output = conn.execute(f"sudo /home/opc/.acme.sh/acme.sh --install-cert -d {domain_name} "
                                              "--key-file /etc/pki/nginx/private/key.pem "
                                              "--fullchain-file /etc/pki/nginx/cert.pem "
                                              '--reloadcmd "sudo systemctl restart nginx.service" '
                                              "--force --home /home/opc/.acme.sh")
                        last_error = conn.get_last_error()
                        if last_error != "":
                            raise Exception(
                                f"Failed to install SSL certificate. {output} {last_error}")

                if interactive:
                    print("Writing web server configuration...")

                # cSpell:ignore letsencrypt fullchain privkey
                if domain_name != "":
                    ssl_cert_path = "/etc/pki/nginx/cert.pem"
                    ssl_cert_key_path = "/etc/pki/nginx/private/key.pem"
                    # ssl_cert_path = f"/etc/letsencrypt/live/{domain_name}/fullchain.pem"
                    # ssl_cert_key_path = f"/etc/letsencrypt/live/{domain_name}/privkey.pem"
                else:
                    ssl_cert_path = "/var/lib/mysqlrouter/router-cert.pem"
                    ssl_cert_key_path = "/var/lib/mysqlrouter/router-key.pem"

                nginx_config = f"""server {{
    listen 443 ssl http2;

    {f"server_name {domain_name};" if domain_name != "" else ""}

    ssl_certificate {ssl_cert_path};
    ssl_certificate_key {ssl_cert_key_path};

    # Allow large attachments
    client_max_body_size 128M;

    location / {{
        proxy_pass http://127.0.0.1:8446;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}
}}
"""

                # Write config to in-memory stream
                with io.BytesIO() as nginx_config_bytes_stream:
                    with io.StringIO() as nginx_config_stream:
                        nginx_config_stream.write(nginx_config)

                        # Seek to the beginning of the text stream
                        nginx_config_bytes_stream.write(
                            nginx_config_stream.getvalue().encode("utf-8"))
                        nginx_config_bytes_stream.seek(0)

                        # Write out new config file to remote instance
                        try:
                            conn.put_local_file_object(
                                nginx_config_bytes_stream,
                                "/home/opc/mrs.nginx.conf")
                        except Exception as e:
                            raise Exception(
                                "Could not upload router config file. "
                                f"{str(e)}")

                # Move config to final place and fix privileges
                conn.execute(
                    "sudo cp /home/opc/mrs.nginx.conf /etc/nginx/conf.d/mrs.nginx.conf")
                conn.execute(
                    "sudo chown root:root /etc/nginx/conf.d/mrs.nginx.conf")
                conn.execute("sudo rm /home/opc/mrs.nginx.conf")

                # If there was an error, print it
                last_error = conn.get_last_error()
                if last_error != "":
                    raise Exception(
                        "Could not upload web server config file. "
                        f"ERROR: {last_error}")

                if interactive:
                    print("Opening Firewall ports...")

                # Open MySQL Router ports on the firewall
                if port_forwarding:
                    conn.execute(
                        "sudo firewall-cmd --zone=public --permanent --add-port=6446-6449/tcp")
                # If mrs was requested but no public_ip, open the port for a Load Balancer
                if mrs and not public_ip:
                    conn.execute(
                        "sudo firewall-cmd --zone=public --permanent --add-port=8446/tcp")
                conn.execute("sudo firewall-cmd --reload")

                # If mrs was requested but no public_ip, open the port for a Load Balancer
                # cSpell:ignore semanage mysqld
                if mrs and not public_ip:
                    conn.execute(
                        "sudo semanage port -a -t mysqld_port_t -p tcp 8446")

                if interactive:
                    print("Restarting MySQL Router...")

                # Restart mysqlrouter.service
                conn.execute("sudo systemctl restart mysqlrouter.service")

                if interactive:
                    print("Restarting web server...")

                # Restart NGINX
                conn.execute("sudo systemctl restart nginx.service")

            # Add ingress rules for MySQL ports to security list
            compute.add_ingress_port_to_security_lists(
                security_lists=sec_lists, port=6446,
                description="Classic MySQL Protocol RW via Router",
                compartment_id=compartment_id, config=config,
                interactive=interactive,
                raise_exceptions=raise_exceptions)
            compute.add_ingress_port_to_security_lists(
                security_lists=sec_lists, port=6447,
                description="Classic MySQL Protocol RO via Router",
                compartment_id=compartment_id, config=config,
                interactive=interactive,
                raise_exceptions=raise_exceptions)
            compute.add_ingress_port_to_security_lists(
                security_lists=sec_lists, port=6448,
                description="MySQL X Protocol RW via Router",
                compartment_id=compartment_id, config=config,
                interactive=interactive,
                raise_exceptions=raise_exceptions)
            compute.add_ingress_port_to_security_lists(
                security_lists=sec_lists, port=6449,
                description="MySQL X Protocol RO via Router",
                compartment_id=compartment_id, config=config,
                interactive=interactive,
                raise_exceptions=raise_exceptions)
            if mrs and not public_ip:
                compute.add_ingress_port_to_security_lists(
                    security_lists=sec_lists, port=8446,
                    description="MRS HTTP via Router",
                    compartment_id=compartment_id, config=config,
                    interactive=interactive,
                    raise_exceptions=raise_exceptions)
            elif mrs:
                compute.add_ingress_port_to_security_lists(
                    security_lists=sec_lists, port=443,
                    description="MRS HTTPS via Router",
                    compartment_id=compartment_id, config=config,
                    interactive=interactive,
                    raise_exceptions=raise_exceptions)
                compute.add_ingress_port_to_security_lists(
                    security_lists=sec_lists, port=80,
                    description="MRS HTTP via Router",
                    compartment_id=compartment_id, config=config,
                    interactive=interactive,
                    raise_exceptions=raise_exceptions)

            if interactive:
                endpoint_address = domain_name if domain_name != "" else public_ip
                print("\nNew endpoint successfully created.\n")
                if port_forwarding:
                    print(f"    Classic MySQL Protocol: {endpoint_address}:6446\n"
                          f"    MySQL X Protocol: {endpoint_address}:6448\n")
                if mrs:
                    print(
                        f"    MySQL REST Service HTTPS: https://{endpoint_address}/\n")
                if port_forwarding:
                    print(
                        f"Example:\n    mysqlsh mysql://{mysql_user_name}@{endpoint_address}:6446")

            if not return_formatted:
                return {
                    "ip": public_ip,
                    "domainName": domain_name,
                    "port": 6446,
                    "port_x": 6447,
                    "rest_http": 443
                }
        except Exception as e:
            raise Exception(
                f"Could not configure the compute instance '{instance_name}' "
                f"at {public_ip}.\n{str(e)}")
    except Exception as e:
        if raise_exceptions:
            raise
        print(f"ERROR: {str(e)}")


def create_bucket_import_pars(object_name_prefix, bucket_name, db_system_name,
                              compartment_id, config):
    """Creates the PARs needed for an import from a bucket

    Args:
        object_name_prefix (str): The prefix used for the object names
        bucket_name (str): The name of the bucket
        db_system_name (str): The name of the MySQL DB System
        compartment_id (str): The OCID of the compartment
        config (object): An OCI config object or None.
    """
    from mds_plugin import object_store

    par = object_store.create_bucket_object_par(
        bucket_object_name=f'{object_name_prefix}@.manifest.json',
        bucket_name=bucket_name,
        access_type="r",
        compartment_id=compartment_id,
        config=config,
        return_object=True)
    if par is None:
        print(f"Could not create PAR for manifest file. Operation cancelled.\n")

    progress_par = object_store.create_bucket_object_par(
        bucket_object_name=f'{object_name_prefix}@.{db_system_name}.progress',
        bucket_name=bucket_name,
        access_type="rw",
        compartment_id=compartment_id,
        config=config,
        return_object=True)
    if progress_par is None:
        print(f"Could not create PAR for progress file. Operation cancelled.\n")

    return par, progress_par


@plugin_function('mds.util.importDumpFromBucket')
def import_from_bucket(**kwargs):
    """Imports a dump from a bucket on a DB System

    Args:
        **kwargs: Additional options

    Keyword Args:
        bucket_name (str): The name of the bucket
        object_name_prefix (str): The prefix used for the object names
        db_system_name (str): The name of the MySQL DB System
        db_system_id (str): The OCID of the db_system
        db_system_ip (str): The IP to use for the import, overwriting the
                one from the db_system if given
        db_system_port (str): The Port to use for the import, overwriting
                the one from the db_system if given
        admin_username (str): The name of the administrator user account
        admin_password (str): The password of the administrator account
        private_key_file_path (str): The file path to an SSH private key
        perform_cleanup (bool): Whether the PARs and bucket should be deleted
        compartment_id (str): The OCID of the compartment
        config (object): An OCI config object or None.
        interactive (bool): Whether user input is considered
    Returns:
       None
    """

    bucket_name = kwargs.get('bucket_name')
    db_system_name = kwargs.get('db_system_name')
    private_key_file_path = kwargs.get(
        "private_key_file_path", "~/.ssh/id_rsa")
    object_name_prefix = kwargs.get("object_name_prefix", "")
    admin_username = kwargs.get('admin_username')
    admin_password = kwargs.get('admin_password')
    db_system_id = kwargs.get("db_system_id")
    db_system_ip = kwargs.get("db_system_ip")
    db_system_port = kwargs.get("db_system_port")
    perform_cleanup = kwargs.get("perform_cleanup")
    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    interactive = kwargs.get("interactive", True)

    # Get the active config, compartment and db_system
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        db_system_id = configuration.get_current_db_system_id(
            db_system_id=db_system_id, config=config)
        bucket_name = configuration.get_current_bucket_name(
            bucket_name=bucket_name, config=config)
    except ValueError as e:
        if not interactive:
            raise
        print(f"ERROR: {str(e)}")
        return

    from mds_plugin import compute, user, object_store
    import datetime
    import time
    import base64
    import json
    import mysqlsh

    # If no explicit IP is given, get DB System
    if not db_system_ip:
        db_system = mysql_database_service.get_db_system(
            db_system_name=db_system_name, db_system_id=db_system_id,
            compartment_id=compartment_id, config=config,
            interactive=interactive)
        if db_system is None:
            print("No MySQL DB System given. Operation cancelled.\n")
            return

        # Get the first active endpoint
        endpoints = [e for e in db_system.endpoints if e.status == 'ACTIVE']
        if len(endpoints) < 1:
            print("ERROR: This MySQL DB System has no active endpoints "
                  "assigned.")
            return
        endpoint = endpoints[0]

        db_system_name = db_system.display_name
        db_system_ip = endpoint.ip_address
        db_system_port = endpoint.port

    if not db_system_port:
        db_system_port = '3306'

    if not db_system_name:
        db_system_name = 'DbSystem'

    # Get ObjectStorage namespace
    os_namespace = object_store.get_object_store_namespace(config=config)

    # Get bucket
    bucket = object_store.get_bucket(
        bucket_name=bucket_name,
        compartment_id=compartment_id,
        config=config,
        ignore_current=False,
        interactive=interactive)
    if bucket is None:
        print("No bucket given. Operation cancelled.\n")
        return

    # Check if manifest is available on this bucket
    obj = object_store.get_bucket_object(
        name=object_name_prefix + '@.manifest.json',
        bucket_name=bucket.name,
        compartment_id=None,
        config=None,
        no_error_on_not_found=False)
    if obj is None:
        print(f"Manifest file '{object_name_prefix}@.manifest.json' not "
              f"found on bucket '{bucket.name}'. Operation cancelled.\n")
        return

    # Get an admin_username
    if interactive and not admin_username:
        admin_username = mysqlsh.globals.shell.prompt(
            "MySQL Administrator account name [admin]: ",
            {'defaultValue': 'admin'}).strip()
    if not admin_username:
        print("Operation cancelled.")
        return

    # Get an admin_password
    if interactive and admin_password is None:
        admin_password = mysqlsh.globals.shell.prompt(
            "MySQL Administrator account password: ",
            {'defaultValue': '', 'type': 'password'}).strip()
    if not admin_password:
        print("Operation cancelled.")
        return

    # Create PAR for manifest and progress files
    par, progress_par = create_bucket_import_pars(
        object_name_prefix=object_name_prefix,
        bucket_name=bucket.name,
        db_system_name=db_system_name,
        compartment_id=compartment_id,
        config=config)
    if par is None or progress_par is None:
        print("Could not create pre-authenticated requests. "
              "Operation cancelled.")
        return

    # Build URLs
    par_url_prefix = object_store.get_par_url_prefix(config=config)
    par_url = par_url_prefix + par.access_uri
    progress_par_url = par_url_prefix + progress_par.access_uri

    try:
        # Get the 'MySQLDBBastionHost' compute instance (let the user create it
        # if it does not exist yet)
        mds_proxy = create_compute_instance_for_endpoint(
            private_key_file_path=private_key_file_path,
            compartment_id=compartment_id, config=config,
            interactive=False)
        if mds_proxy is None:
            print("Could not get a compute instance. Operation cancelled.")
            return

        # Get the public IP of the instance
        public_ip = compute.get_instance_public_ip(
            instance_id=mds_proxy.id, compartment_id=compartment_id,
            config=config, private_ip_fallback=True)
        if public_ip is None or public_ip == "":
            print("The public IP of the MySQLDBBastionHost instance could not "
                  "be fetched.")
            return

        # Open an SSH connection to the instance
        print(f"Connecting to MySQLDBBastionHost instance at {public_ip}...")
        try:
            success = None
            with compute.SshConnection(
                    username="opc", host=public_ip,
                    private_key_file_path=private_key_file_path) as conn:

                print(f"Connected to MySQLDBBastionHost instance at "
                      f"{public_ip}.\n"
                      f"Starting import...")

                # Build command string to execute
                cmd = ['mysqlsh',
                       (f'{admin_username}@'
                        f'{endpoint.ip_address}:{endpoint.port}'),
                       '--passwords-from-stdin',
                       '--save-passwords=never',
                       '--',
                       'util',
                       'load-dump',
                       f'{par_url}',
                       f'--osBucketName={bucket.name}',
                       f'--osNamespace={os_namespace}',
                       f'--progress-file={progress_par_url}',
                       '--loadUsers=true',
                       '--showProgress=true',
                       '--ignoreVersion=true']
                cmd = " ".join(cmd)

                # Open channel
                chan = conn.client.get_transport().open_session()
                try:
                    chan.settimeout(timeout=None)
                    chan.set_combine_stderr(combine=True)

                    # Execute shell and call import function
                    chan.exec_command(cmd)

                    # Send password to stdin
                    chan.sendall(f"{admin_password}\n".encode('utf-8'))
                    chan.shutdown_write()

                    def print_lines(buffer, no_line_break=False):
                        for line in buffer:
                            if "Please provide the password for" \
                                    in line:
                                line = line.replace(
                                    "Please provide the password for",
                                    "Importing dump on")
                            if 'Worker' in line:
                                line += ''
                            if line.strip() != "":
                                if no_line_break:
                                    print(line, end='\r')
                                else:
                                    print(f'>> {line}')

                    # While the command didn't return an exit code yet
                    read_buffer_size = 1024
                    buffer = ""
                    while not chan.exit_status_ready():
                        # Update every 0.1 seconds
                        time.sleep(0.1)

                        if chan.recv_ready():
                            buffer += chan.recv(
                                read_buffer_size).decode('utf-8')
                            # Check if a line break was in the buffer
                            if "\n" in buffer:
                                end = buffer.rfind("\n")+1
                                ready = buffer[:end]
                                buffer = buffer[end:]
                                # Print the lines that are ready
                                print_lines(ready.split("\n"))
                            elif "\r" in buffer:
                                end = buffer.rfind("\r")+1
                                ready = buffer[:end]
                                buffer = buffer[end:]
                                # Print the lines that are ready
                                print_lines(
                                    ready.split("\r"), no_line_break=True)

                    # Ensure we gobble up all remaining data
                    while True:
                        try:
                            output = chan.recv(
                                read_buffer_size).decode('utf-8')
                            if not output and not chan.recv_ready():
                                break
                            else:
                                buffer += output
                                # Check if a line break was in the buffer
                                if "\n" in buffer:
                                    end = buffer.rfind("\n")+1
                                    ready = buffer[:end]
                                    buffer = buffer[end:]
                                    # Print the lines that are ready
                                    print_lines(ready.split("\n"))
                        except Exception:
                            continue

                    # If there is still something in the buffer, print it
                    if buffer:
                        print(buffer)

                    success = chan.recv_exit_status() == 0
                finally:
                    chan.close()

            if success is not None:
                print(f"Connection to MySQLDBBastionHost instance closed.\n"
                      f"Import completed "
                      f"{'successfully' if success else 'with errors'}.")

        except Exception as e:
            print("Could not execute the import on compute instance "
                  f"'MySQLDBBastionHost' at {public_ip}.\nERROR: {str(e)}")
    finally:
        # Delete the PARs created especially for this import
        object_store.delete_par(
            bucket_name=bucket.name,
            par_id=par.id,
            compartment_id=compartment_id,
            config=config,
            interactive=False)
        object_store.delete_par(
            bucket_name=bucket.name,
            par_id=progress_par.id,
            compartment_id=compartment_id,
            config=config,
            interactive=False)

        if perform_cleanup:
            print("Performing cleanup...")

            if object_name_prefix:
                # Delete all PARs created by dump
                object_store.delete_par(
                    bucket_name=bucket.name,
                    name=f'shell-dump-{object_name_prefix}*',
                    compartment_id=compartment_id,
                    config=config,
                    interactive=False)

                # Delete all bucket objects
                object_store.delete_bucket_object(
                    name=f"{object_name_prefix}*",
                    bucket_name=bucket.name,
                    compartment_id=compartment_id,
                    config=config,
                    interactive=False)
            else:
                # If no object_name_prefix was used, also delete the bucket
                object_store.delete_bucket(
                    bucket_name=bucket.name,
                    compartment_id=compartment_id,
                    config=config,
                    interactive=False)

    print("Operation completed.")


@plugin_function('mds.util.importDumpFromLocalDir')
def import_from_local_dir(local_dump_dir=None, db_system_name=None,
                          options=None):
    """Imports a local dump on a DB System

    Args:
        local_dump_dir (str): The directory that holds the local dump
        db_system_name (str): The new name of the DB System.
        options (dict): A dict with various options
            object_name_prefix (str): The prefix used for the object names
            db_system_id (str): The OCID of the db_system
            admin_username (str): The name of the administrator user account
            admin_password (str): The password of the administrator user account
            private_key_file_path (str): The file path to an SSH private key
            compartment_id (str): The OCID of the compartment
            config (object): An OCI config object or None.
            interactive (bool): Whether user input is considered

    Returns:
       None
    """
    if options is None:
        options = {}

    object_name_prefix = options.get("object_name_prefix")
    db_system_id = options.get("db_system_id")
    admin_username = options.get("admin_username")
    admin_password = options.get("admin_password")
    private_key_file_path = options.get(
        "private_key_file_path", "~/.ssh/id_rsa")
    compartment_id = options.get("compartment_id")
    config = options.get("config")
    interactive = options.get("interactive", True)

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        import oci.mysql
        from pathlib import Path
        from os import listdir
        import os.path
        import datetime
        import mysqlsh
        import object_store

        if interactive:
            print("Preparing for data import from a local directory...\n")

        if interactive and local_dump_dir is None:
            local_dump_dir = mysqlsh.globals.shell.prompt(
                "Please specify the directory path that contains the dump: ",
                {'defaultValue': ''}).strip()
            if local_dump_dir == "":
                print("Operation cancelled.")
                return
        elif local_dump_dir is None:
            print("No directory path given. Operation cancelled.")
            return

        # Get an admin_username
        if interactive and admin_username is None:
            admin_username = mysqlsh.globals.shell.prompt(
                "MySQL Administrator account name [admin]: ",
                {'defaultValue': 'admin'}).strip()
            if admin_username == "":
                print("Operation cancelled.")
                return
        elif admin_username is None:
            admin_username = "admin"

        # Get an admin_password
        if interactive and admin_password is None:
            admin_password = mysqlsh.globals.shell.prompt(
                "MySQL Administrator account password: ",
                {'defaultValue': '', 'type': 'password'}).strip()
            if admin_password == "":
                print("Operation cancelled.")
                return
        elif admin_password is None:
            raise ValueError("The argument admin_password must be set.")

        # Get DB System
        db_system = mysql_database_service.get_db_system(
            db_system_name=db_system_name, db_system_id=db_system_id,
            compartment_id=compartment_id, config=config)
        if db_system is None:
            print("Operation cancelled.\n")
            return

        options["db_system_id"] = db_system.id

        # Make sure there is a 'MySQLDBBastionHost' compute instance (let the user
        # create it if it does not exist yet)
        mds_proxy = create_compute_instance_for_endpoint(
            private_key_file_path=private_key_file_path,
            compartment_id=db_system.compartment_id, config=config,
            interactive=False)
        if mds_proxy is None:
            print("Operation cancelled.")
            return

        # Take all alphanumeric chars from the DB System display_name
        # to create the bucket_name
        bucket_name = (
            f"{''.join(e for e in db_system.display_name if e.isalnum())}"
            f"_import_{datetime.datetime.now():%Y%m%d%H%M%S}")

        print(f"\nCreating bucket {bucket_name}...")

        bucket = object_store.create_bucket(
            bucket_name=bucket_name, compartment_id=compartment_id,
            config=config, return_object=True)
        if bucket is None:
            print("Cancelling operation")
            return

        # Upload the files from the given directory to the bucket
        file_count = object_store.create_bucket_objects_from_local_dir(
            local_dir_path=local_dump_dir, bucket_name=bucket.name,
            object_name_prefix=object_name_prefix,
            compartment_id=compartment_id, config=config, interactive=False)
        if file_count is None:
            print("Cancelling operation")
            return

        # Start the import from the bucket
        import_from_bucket(
            bucket_name=bucket.name,
            options=options)

        # if not object_store.delete_bucket_object(
        #         bucket_object_name="*", bucket_name=bucket.name,
        #         compartment_id=compartment_id, config=config,
        #         interactive=False):
        #     print("Could not delete files from buckets.")

        if not object_store.delete_bucket(
                bucket_name=bucket.name,
                compartment_id=compartment_id, config=config,
                interactive=False):
            print("Could not delete the bucket.")

        if interactive:
            print("Operation completed.")
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


@plugin_function('mds.util.dumpToBucket')
def dump_to_bucket(**kwargs):
    """Imports a dump on a DB System using a PAR

    Args:
        **kwargs: Additional options

    Keyword Args:
        bucket_name (str): The name of the bucket
        create_bucket_if_not_exists (bool): Will create the bucket if set
        object_name_prefix (str): The prefix used for the object names
        connection_uri (str): The URI to the MySQL Server
        connection_password (str): The password of the MySQL
            user account
        compartment_id (str): The OCID of the compartment
        config (object): An OCI config object or None.
        config_file_path (str): The path to the config file.
        interactive (bool): Enables interactive input.
        return_true_on_success (bool): Whether to return true on success

    Returns:
       None or true on success if return_true_on_success is set to true
    """
    # Handle kwargs
    bucket_name = kwargs.get("bucket_name")
    create_bucket_if_not_exists = kwargs.get(
        "create_bucket_if_not_exists", False)
    object_name_prefix = kwargs.get("object_name_prefix")
    connection_uri = kwargs.get("connection_uri")
    connection_password = kwargs.get("connection_password")
    # If no config_file_path is given, first check the MYSQLSH_OCI_CONFIG_FILE env_var and only then fall back to
    # default
    config_file_path = kwargs.get(
        "config_file_path", getenv("MYSQLSH_OCI_CONFIG_FILE"))
    if config_file_path is None:
        config_file_path = "~/.oci/config"
    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    interactive = kwargs.get("interactive", True)
    return_true_on_success = kwargs.get("return_true_on_success")

    # Get the active config, compartment and db_system
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        bucket_name = configuration.get_current_bucket_name(
            bucket_name=bucket_name, config=config)

        from mds_plugin import object_store
        import os.path
        import json
        import base64
        import subprocess
        from pathlib import Path
        import time
        import mysqlsh
        import oci.exceptions

        # If no connection_uri was given, try to use the one from the current
        # connection if this one uses the classic protocol
        if connection_uri is None:
            session = mysqlsh.globals.shell.get_session()
            if session is not None:
                if "mysql://" in session.get_uri():
                    connection_uri = session.get_uri()

        # If no connection_uri was given but interactive is True, ask the user
        if connection_uri is None and interactive:
            print("Please enter the MySQL Server connection URI for the MySQL "
                  "Server serving as data source.\nTo get more information about "
                  "the URI format type '\\? connection' in the MySQL Shell.\n"
                  "Example: admin@localhost:3306\n")
            connection_uri = mysqlsh.globals.shell.prompt(
                "MySQL Server connection URI: ")
            if connection_uri == "":
                print("Operation Cancelled.\n")
                return

        # Get an admin_password
        if connection_password is None:
            connection_password = mysqlsh.globals.shell.prompt(
                f"Password for {connection_uri}: ",
                {'defaultValue': '', 'type': 'password'}).strip()
            if connection_password == "":
                print("Operation cancelled.")
                return

        # Get object_name_prefix
        if interactive and object_name_prefix is None:
            print("\nIf needed, a prefix for the dumped object names can be set.\n"
                  "Default is to use no prefix.")
            object_name_prefix = mysqlsh.globals.shell.prompt(
                "\nPlease enter the object name prefix []: ",
                {'defaultValue': ''}).strip()
        elif object_name_prefix is None:
            object_name_prefix = ""

        # Get bucket or create one
        bucket_created = False
        try:
            bucket = object_store.get_bucket(
                bucket_name=bucket_name, compartment_id=compartment_id,
                config=config, interactive=False)
        except oci.exceptions.ServiceError as e:
            if create_bucket_if_not_exists:
                bucket = object_store.create_bucket(
                    bucket_name=bucket_name, compartment_id=compartment_id,
                    config=config, interactive=False, return_object=True)
            else:
                if not interactive:
                    raise
                print(f"The bucket {bucket_name} does not exist.")
                return

        os_namespace = object_store.get_object_store_namespace(config)

        # Convert Unix path to Windows
        config_file_path = os.path.abspath(
            os.path.expanduser(config_file_path))

        # Get the current profile
        profile_name = configuration.get_current_profile()

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

    # cSpell:ignore ocimds, innodb
    # Setup command
    cmd = [f'mysqlsh',
           (f'{connection_uri}'),
           f'--passwords-from-stdin',
           f'--save-passwords=never',
           # f'--json',
           f'--',
           f'util',
           f'dump-instance',
           f'{object_name_prefix}',
           f'--osBucketName={bucket.name}',
           f'--osNamespace={os_namespace}',
           f'--ociConfigFile={config_file_path}',
           f'--ociProfile={profile_name}',
           '--showProgress=true',
           '--consistent=true',
           '--ociParManifest=true',
           '--ocimds=true']
    #    ('--compatibility=[force_innodb, strip_definers, '
    #    'strip_restricted_grants, strip_tablespaces]')]

    # Workaround till shell supports array arguments in command line API mode
    cmd = ('mysqlsh '
           f'{connection_uri} '
           f'--passwords-from-stdin '
           f'--save-passwords=never '
           f'-e "util.dumpInstance(\'{object_name_prefix}\', '
           '{'
           f'osBucketName: \'{bucket.name}\', '
           f'osNamespace: \'{os_namespace}\', '
           f'ociConfigFile: \'{config_file_path}\', '
           f'ociProfile: \'{profile_name}\', '
           'showProgress: true, '
           'consistent: true, '
           'ociParManifest: true, '
           'ocimds: true, '
           'compatibility: [\'force_innodb\', \'strip_definers\', '
           '\'strip_restricted_grants\', \'strip_tablespaces\']'
           '})"'
           )

    # Run command
    print(f'Starting dump from {connection_uri} to bucket {bucket.name} ...')
    try:
        with subprocess.Popen(
                cmd, shell=True,
                stdout=subprocess.PIPE,
                stdin=subprocess.PIPE, stderr=subprocess.STDOUT,
                universal_newlines=True, bufsize=1) as proc:
            try:
                # Give the process some startup time
                time.sleep(0.2)

                # Provide the password to stdin
                proc.stdin.write(connection_password + "\n")
                proc.stdin.flush()

                # Mirror the output TODO: fix hang on Windows
                for line in iter(proc.stdout.readline, ''):
                    if "Please provide the password for" in line:
                        line = line.replace(
                            "Please provide the password for ",
                            "Performing dump from ")

                    if line.strip() != "":
                        print(f'<< {line}', end='')

                # for line in iter(proc.stderr.readline, ''):
                #     print(f'<< ERROR: {line}', end='')

                proc.stdout.close()
                # proc.stderr.close()
                proc.stdin.close()
                return_code = proc.wait()
                if return_code:
                    # If a bucket has been created, delete it
                    if bucket_created:
                        object_store.delete_bucket(
                            bucket_name=bucket_name,
                            compartment_id=compartment_id, config=config,
                            interactive=False)
                    print("Dump has failed.")
                    if return_true_on_success:
                        return False
                else:
                    print("Dump has finished.")
                    if return_true_on_success:
                        return True
            except subprocess.TimeoutExpired as e:
                proc.kill()

    except OSError as e:
        if not interactive:
            raise e
        print(f"Error when starting shell import. {str(e)}")
    except ValueError as e:
        if not interactive:
            raise
        print(f"Invalid arguments passed to the shell import. {str(e)}")
