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


class BastionHandler():
    def __init__(self, progress_cb=None):
        self._progress_cb = progress_cb
        pass

    def report_progress(self, msg):
        if not self._progress_cb is None:
            self._progress_cb(msg)

    def establish_connection(self, options):
        # cSpell:ignore timeit
        from timeit import default_timer as timer
        from datetime import datetime

        # Get OCID of the DB System and the Bastion and the profile_name
        self._mysql_db_system_id = options.pop('mysql-db-system-id')
        self._bastion_id = options.pop('bastion-id')
        self._profile_name = options.pop('profile-name')
        self._ssh_public_identity_file = options.pop(
            'ssh-public-identity-file', 'id_rsa.pub')
        if 'ssh-identity-file' not in options:
            options['ssh-identity-file'] = 'id_rsa'

        # Send message that the OCI Bastion Session is being created
        self.report_progress(
            'Creating OCI Bastion Session. Loading OCI Library...')

        start = timer()
        import oci.identity
        import oci.bastion
        end = timer()

        self.report_progress(f'OCI Library loaded in {end - start:.2f} seconds. '
                             'Loading OCI objects...')

        try:
            import time
            import os.path
            import hashlib

            # Get the right config
            config = self.get_config(profile_name=self._profile_name)

            # Initialize the Bastion and DB System client
            bastion_client = self.get_oci_bastion_client(config=config)
            db_sys_client = self.get_oci_db_system_client(config=config)

            # Get the DbSystems with the given db_system_id
            db_system = db_sys_client.get_db_system(
                db_system_id=self._mysql_db_system_id).data

            endpoint = db_system.endpoints[0]
            target_ip = endpoint.ip_address
            if options.get('scheme') == "mysql":
                target_port = endpoint.port
            else:
                target_port = endpoint.port_x

            # Set default key directory if no path is specified in key fields
            if not '/' in options['ssh-identity-file'] and \
                    not '\\' in options['ssh-identity-file']:
                # Set private key including full path
                options['ssh-identity-file'] = os.path.join(
                    os.path.abspath(os.path.expanduser("~/.ssh")),
                    options['ssh-identity-file'])

            if not '/' in self._ssh_public_identity_file and \
                    not '\\' in self._ssh_public_identity_file:
                self._ssh_public_identity_file = os.path.join(
                    os.path.abspath(os.path.expanduser("~/.ssh")),
                    self._ssh_public_identity_file)

            # If one of the keys exist but not the other, error out
            if os.path.exists(options['ssh-identity-file']) and \
                    not os.path.exists(self._ssh_public_identity_file):
                raise Exception(
                    f"Public SSH key file {self._ssh_public_identity_file} "
                    f"not found.")
            elif not os.path.exists(options['ssh-identity-file']) and \
                    os.path.exists(self._ssh_public_identity_file):
                raise Exception(
                    f"Private SSH key file {options['ssh-identity-file']} "
                    f"not found.")
            # If both keys do not exist yet, create them
            elif not os.path.exists(options['ssh-identity-file']) and \
                    not os.path.exists(self._ssh_public_identity_file):
                self.create_ssh_keys(
                    ssh_private_key_path=options['ssh-identity-file'],
                    ssh_public_key_path=self._ssh_public_identity_file)

            if not os.path.exists(options['ssh-identity-file']):
                raise Exception(
                    f"Private SSH key file {options['ssh-identity-file']} "
                    f"not found.")

            if not os.path.exists(self._ssh_public_identity_file):
                raise Exception(
                    f"Public SSH key file {self._ssh_public_identity_file} "
                    f"not found.")

            # Get public_key_content
            with open(self._ssh_public_identity_file, 'r') as file:
                public_key_content = file.read()

            # Calculate unique fingerprint based on all params
            params = (
                self._mysql_db_system_id + self._bastion_id +
                self._profile_name + public_key_content +
                f'{target_ip}:{target_port}')

            fingerprint = hashlib.md5(params.encode('utf-8')).hexdigest()
            session_name = f'MDS-{fingerprint}'

            # Check if a session with this fingerprinted name already exists
            sessions = bastion_client.list_sessions(
                bastion_id=self._bastion_id,
                display_name=session_name,
                session_lifecycle_state='ACTIVE').data
            if len(sessions) == 1:
                self.report_progress('Reusing existing Bastion Session.')
                self._bastion_session_id = sessions[0].id
            else:
                target_details = oci.bastion.models.\
                    CreatePortForwardingSessionTargetResourceDetails(
                        target_resource_port=target_port,
                        target_resource_private_ip_address=target_ip)

                session_details = oci.bastion.models.CreateSessionDetails(
                    bastion_id=self._bastion_id,
                    display_name=session_name,
                    key_details=oci.bastion.models.PublicKeyDetails(
                        public_key_content=public_key_content),
                    key_type="PUB",
                    session_ttl_in_seconds=10800,
                    target_resource_details=target_details
                )

                self.report_progress('Creating Bastion Session...')

                # Create the Bastion Session
                self._bastion_session = bastion_client.create_session(
                    session_details).data

                self.report_progress(
                    'Waiting for Bastion Session to become active...')

                # Wait for the Bastion Session to be ACTIVE
                cycles = 0
                while cycles < 24:
                    bastion_session = bastion_client.get_session(
                        session_id=self._bastion_session.id).data
                    if bastion_session.lifecycle_state == "ACTIVE":
                        # TODO: Report bug to the Bastion dev team.
                        # Ask them to only switch lifecycle_state to ACTIVE
                        # if the Bastion Session can actually accept connections
                        time.sleep(5)
                        break
                    else:
                        time.sleep(5)
                        s = "." * (cycles + 1)
                        self.report_progress(f'Waiting for Bastion Session to become '
                                             f'active...{s}')
                    cycles += 1

                self._bastion_session = bastion_client.get_session(
                    session_id=self._bastion_session.id).data
                if self._bastion_session.lifecycle_state != "ACTIVE":
                    raise Exception("Bastion Session did not reach ACTIVE "
                                    "state within 2 minutes.")

                self.report_progress('Bastion Session created successfully.')

                self._bastion_session_id = self._bastion_session.id

            options['host'] = target_ip
            options['port'] = target_port

            options['ssh'] = (f'{self._bastion_session_id}@host.bastion.'
                              f'{config.get("region")}.oci.oraclecloud.com:22')
            options['ssh-identity-file'] = options.get('ssh-identity-file')

            return options

        except oci.exceptions.ServiceError as e:
            raise Exception(
                f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        except (Exception, ValueError, oci.exceptions.ClientError) as e:
            raise Exception(str(e))

    def create_ssh_keys(self, ssh_private_key_path, ssh_public_key_path):
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.backends import default_backend
        from cryptography.hazmat.primitives.asymmetric import rsa
        from pathlib import Path
        import os
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

        # Create paths
        Path(os.path.dirname(os.path.abspath(ssh_private_key_path))).mkdir(
            parents=True, exist_ok=True)
        Path(os.path.dirname(os.path.abspath(ssh_public_key_path))).mkdir(
            parents=True, exist_ok=True)

        # Write out keys
        with open(ssh_private_key_path, mode='wb') as file:
            file.write(private_key)
        with open(ssh_public_key_path, mode='wb') as file:
            file.write(public_key)

        # Fix permissions
        # cSpell:ignore IRUSR IWUSR
        os.chmod(ssh_private_key_path, stat.S_IRUSR | stat.S_IWUSR)
        os.chmod(ssh_public_key_path, stat.S_IRUSR | stat.S_IWUSR)

    def get_oci_bastion_client(self, config):
        import oci.bastion

        bastion_client = oci.bastion.BastionClient(
            config=config, retry_strategy=oci.retry.DEFAULT_RETRY_STRATEGY,
            signer=config.get("signer"))

        # Set a custom endpoint if given
        endpoint = config.get("endpoint")
        if endpoint:
            bastion_client.base_client.endpoint = endpoint

        return bastion_client

    def get_oci_db_system_client(self, config):
        import oci.mysql

        db_sys = oci.mysql.DbSystemClient(
            config=config, retry_strategy=oci.retry.DEFAULT_RETRY_STRATEGY,
            signer=config.get("signer"))

        # Set a custom endpoint if given
        endpoint = config.get("endpoint")
        if endpoint:
            db_sys.base_client.endpoint = endpoint

        return db_sys

    def get_config(self, profile_name, config_file_path="~/.oci/config"):
        """Loads an oci config

        This function will list all sub-compartments of the compartment with the
        given parent_id. If parent_id is omitted, all compartments are listed.

        Args:
            profile (str): The name of the OCI profile
            config_file_path (str): The file location of the OCI config file
            cli_rc_file_path (str): The location of the OCI CLI config file

        Returns:
            The config dict or None
        """

        import oci.config
        import oci.auth
        import oci.signer

        # If the profile_name matches instanceprincipal, use an Instance Principals
        # instead of an actual config
        if profile_name.lower() == "instanceprincipal":
            signer = oci.auth.signers.InstancePrincipalsSecurityTokenSigner()
            config = {
                "signer": signer,
                "tenancy": signer.tenancy_id,
                "region": signer.initialize_and_return_region()}
        else:
            # Load config from file
            try:
                config = oci.config.from_file(
                    file_location=config_file_path, profile_name=profile_name)

                if profile_name == "DEFAULT" and config.get('tenancy') == None:
                    profile_name = None
                    raise oci.exceptions.ProfileNotFound()

                oci.config.validate_config(config)
            except (oci.exceptions.ConfigFileNotFound,
                    oci.exceptions.ProfileNotFound) as e:
                raise
            except oci.exceptions.InvalidConfig as e:
                raise ValueError(f"The configuration profile '{profile_name}' "
                                 f"is invalid.\n{str(e)}")

            # Create default signer based on the config values. This is required
            # since the OCI clients use if 'signer' in kwargs: and don't check
            # for None
            try:
                config["signer"] = oci.signer.Signer(
                    tenancy=config.get("tenancy"),
                    user=config.get("user"),
                    fingerprint=config.get("fingerprint"),
                    private_key_file_location=config.get("key_file"),
                    pass_phrase=config.get("pass_phrase"))
            except oci.exceptions.MissingPrivateKeyPassphrase:
                raise Exception(
                    'OCI API Keys with passphrase are not supported')
                # # If there is a passphrase required, ask for it
                # pass_phrase = mysqlsh.globals.shell.prompt(
                #     f"Please enter the passphrase for the API key: ",
                #     {'defaultValue': '', 'type': 'password'})
                # if not pass_phrase:
                #     raise Exception("No or invalid passphrase for API key.")

                # # Store the passphrase in the config
                # config["pass_phrase"] = pass_phrase

                # try:
                #     config["signer"] = oci.signer.Signer(
                #         tenancy=config.get("tenancy"),
                #         user=config.get("user"),
                #         fingerprint=config.get("fingerprint"),
                #         private_key_file_location=config.get("key_file"),
                #         pass_phrase=config.get("pass_phrase"),
                #         private_key_content=config.get("key_content"))
                # except oci.exceptions.MissingPrivateKeyPassphrase:
                #     raise Exception("No or invalid passphrase for API key.")

        # Add profile name to the config so it can be used later
        config["profile"] = profile_name

        return config
