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
import os
import threading
import time
import os.path
from os import getenv
import hashlib
from enum import Enum
import gui_plugin.core.Logger as logger
# cSpell:ignore timeit
from timeit import default_timer as timer

MYSQL_DB_SYSTEM_ID_OPT = 'mysql-db-system-id'
BASTION_ID_OPT = 'bastion-id'
PROFILE_NAME_OPT = 'profile-name'
SSH_IDENTITY_FILE_OPT = 'ssh-identity-file'
SSH_PUBLIC_IDENTITY_FILE_OPT = 'ssh-public-identity-file'
SSH_OPT = 'ssh'

BASTION_SETUP_OPTIONS = [MYSQL_DB_SYSTEM_ID_OPT, BASTION_ID_OPT, PROFILE_NAME_OPT,
                         SSH_IDENTITY_FILE_OPT, SSH_PUBLIC_IDENTITY_FILE_OPT]


class BastionSessionState(Enum):
    NEW = 0
    CONNECTING = 1
    ACTIVE = 2
    EXPIRED = 3


class BastionSession():
    """
    Handler for a BastionSession, among other things it handles:
    - Usage of the same BastionSession across threads
    - States: whether the session is new, active, expired or connecting
    """

    def __init__(self, options):
        self._lock = threading.RLock()
        self.state = BastionSessionState.NEW
        self.setup_options = {}
        self.is_new = False
        for opt in BASTION_SETUP_OPTIONS:
            self.setup_options[opt] = options.get(opt)

        self.target_ip = options.get('host')
        self.target_port = options.get('port')

        params = "".join([self.setup_options[v] for v in [
                         MYSQL_DB_SYSTEM_ID_OPT, BASTION_ID_OPT, PROFILE_NAME_OPT]])
        # Get public_key_content
        with open(self.setup_options[SSH_PUBLIC_IDENTITY_FILE_OPT], 'r') as file:
            self.public_key_content = file.read()

        params += self.public_key_content
        params += f"{options.get('host')}:{options.get('port')}"
        fingerprint = hashlib.md5(params.encode('utf-8')).hexdigest()
        self.id = f'MDS-{fingerprint}'

        self.options = {}
        self.options[SSH_IDENTITY_FILE_OPT] = self.setup_options[SSH_IDENTITY_FILE_OPT]

    def expire(self):
        with self._lock:
            self.state = BastionSessionState.EXPIRED

    def ensure_active(self, progress_callback):
        with self._lock:
            if self.state != BastionSessionState.ACTIVE and self.state != BastionSessionState.CONNECTING:
                self._establish_connection(progress_callback)

    def _establish_connection(self, progress_callback):
        self.state = BastionSessionState.CONNECTING

        # Send message that the OCI Bastion Session is being created
        progress_callback(
            'Creating OCI Bastion Session. Loading OCI Library...')

        start = timer()
        import oci.identity
        import oci.bastion
        end = timer()

        progress_callback(f'OCI Library loaded in {end - start:.2f} seconds. '
                          'Loading OCI objects...')

        try:
            # Get the right config
            config = self.get_config(
                profile_name=self.setup_options[PROFILE_NAME_OPT])

            # Initialize the Bastion and DB System client
            bastion_client = self.get_oci_bastion_client(config=config)
            session_name = self.id

            # Check if a session with this fingerprinted name already exists
            sessions = bastion_client.list_sessions(
                bastion_id=self.setup_options[BASTION_ID_OPT],
                display_name=session_name,
                session_lifecycle_state='ACTIVE').data
            if len(sessions) == 1:
                progress_callback('Reusing existing Bastion Session.')
                bastion_session_id = sessions[0].id
            else:
                # Get public_key_content
                with open(self.setup_options[SSH_PUBLIC_IDENTITY_FILE_OPT], 'r') as file:
                    public_key_content = file.read()

                target_details = oci.bastion.models.\
                    CreatePortForwardingSessionTargetResourceDetails(
                        target_resource_port=self.target_port,
                        target_resource_private_ip_address=self.target_ip)

                session_details = oci.bastion.models.CreateSessionDetails(
                    bastion_id=self.setup_options[BASTION_ID_OPT],
                    display_name=session_name,
                    key_details=oci.bastion.models.PublicKeyDetails(
                        public_key_content=self.public_key_content),
                    key_type="PUB",
                    session_ttl_in_seconds=10800,
                    target_resource_details=target_details
                )

                progress_callback('Creating Bastion Session...')
                self.is_new = True

                # Create the Bastion Session
                self._bastion_session = bastion_client.create_session(
                    session_details).data

                progress_callback(
                    'Waiting for Bastion Session to become active...')

                # Wait for the Bastion Session to be ACTIVE
                cycles = 0
                while cycles < 24:
                    bastion_session_obj = bastion_client.get_session(
                        session_id=self._bastion_session.id).data
                    if bastion_session_obj.lifecycle_state == "ACTIVE":
                        # TODO: Report bug to the Bastion dev team.
                        # Ask them to only switch lifecycle_state to ACTIVE
                        # if the Bastion Session can actually accept connections
                        time.sleep(5)
                        break
                    else:
                        time.sleep(5)
                        s = "." * (cycles + 1)
                        progress_callback(
                            f'Waiting for Bastion Session to become active...{s}')
                    cycles += 1

                self._bastion_session = bastion_client.get_session(
                    session_id=self._bastion_session.id).data
                if self._bastion_session.lifecycle_state != "ACTIVE":
                    raise Exception("Bastion Session did not reach ACTIVE "
                                    "state within 2 minutes.")

                progress_callback('Bastion Session created successfully.')

                bastion_session_id = self._bastion_session.id
            self.options[SSH_OPT] = (f'{bastion_session_id}@host.bastion.'
                                     f'{config.get("region")}.oci.oraclecloud.com:22')

            self.state = BastionSessionState.ACTIVE

        except oci.exceptions.ServiceError as e:
            raise Exception(
                f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        except (Exception, ValueError, oci.exceptions.ClientError) as e:
            raise Exception(str(e))

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

    def get_config(self, profile_name, config_file_path=None):
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
            # If no config_file_path is given, first check the MYSQLSH_OCI_CONFIG_FILE env_var and only then fall back
            # to default
            if config_file_path is None:
                config_file_path = getenv("MYSQLSH_OCI_CONFIG_FILE")
                if config_file_path is None:
                    config_file_path = "~/.oci/config"

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


class BastionSessionRegistry(object):
    """
    Registry of BastionSession objects

    Enables registering a new bastion session based on specific connection options
    or retrieving a previously registered BastionSession given an ID
    """
    _instance = None
    _lock = threading.RLock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(BastionSessionRegistry, cls).__new__(cls)

            return cls._instance

    def __init__(self):
        if not hasattr(self, "_registry"):
            self._registry = {}

    def create_bastion_session(self, options) -> BastionSession:
        updated_options = options.copy()

        # Gets the full path to the identity files
        ssh_identity_file = self._get_identity_file_name(
            options, SSH_IDENTITY_FILE_OPT, 'id_rsa_mysql_shell')
        ssh_public_identity_file = self._get_identity_file_name(
            options, SSH_PUBLIC_IDENTITY_FILE_OPT, 'id_rsa_mysql_shell.pub')

        # Ensures the identity files exist
        if not os.path.exists(ssh_identity_file) or not os.path.exists(ssh_public_identity_file):
            self._create_ssh_keys(ssh_identity_file, ssh_public_identity_file)

            if not os.path.exists(ssh_identity_file):
                raise Exception(
                    f"Private SSH key file {ssh_identity_file} not found.")

            if not os.path.exists(ssh_public_identity_file):
                raise Exception(
                    f"Public SSH key file {ssh_public_identity_file} not found.")

        # updates the identity files
        updated_options[SSH_IDENTITY_FILE_OPT] = ssh_identity_file
        updated_options[SSH_PUBLIC_IDENTITY_FILE_OPT] = ssh_public_identity_file

        with self._lock:
            bastion_session = BastionSession(updated_options)
            id = bastion_session.id
            if id not in self._registry:
                logger.debug3(f"Registering new bastion session: {id}")
                self._registry[id] = bastion_session
                return self._registry[id]
            else:
                return self.get_bastion_session(id)

    def get_bastion_session(self, id) -> BastionSession:
        with self._lock:
            logger.debug3(f"Reusing registered bastion session: {id}")
            return self._registry.get(id, None)

    def _get_identity_file_name(self, options, option, default):
        file = options.get(option, default)

        # Set default key directory if no path is specified in key fields
        if not '/' in file and not '\\' in file:
            # Set private key including full path
            file = os.path.join(os.path.abspath(
                os.path.expanduser("~/.ssh")), file)

        return file

    def _create_ssh_keys(self, ssh_private_key_path, ssh_public_key_path):
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
