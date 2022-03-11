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

"""Sub-Module for supporting OCI config profile handling and current objects

    OCI Configuration profiles are stored in the ~/.oci/config file by default.

    OCIDs of the object used as current ones are stored in the cli_rc_file
    which is stored in the ~/.oci/oci_cli_rc file by default.

    When using the MDS plugin API the OCI config selected by the user is stored
    in getattr(mysqlsh.globals, 'mds_config')

"""

# cSpell:ignore saopaulo, Paulo, chuncheon, Vinhedo

from cryptography.hazmat.backends import interfaces
from mysqlsh.plugin_manager import plugin_function
from mds_plugin import core

OCI_REGION_LIST = [
    {"name": "Australia East (Sydney)", "id": "ap-sydney-1", "location": "Sydney, Australia",
     "region_key": "SYD", "key_realm": "OC1", "avail_domains": "1"},
    {"name": "Australia Southeast (Melbourne)", "id": "ap-melbourne-1", "location": "Melbourne, Australia",
     "region_key": "MEL", "key_realm": "OC1", "avail_domains": "1"},
    {"name": "Brazil East (Sao Paulo)", "id": "sa-saopaulo-1", "location": "Sao Paulo, Brazil",
     "region_key": "GRU", "key_realm": "OC1", "avail_domains": "1"},
    {"name": "Brazil Southeast (Vinhedo)", "id": "sa-vinhedo-1", "location": "Vinhedo, Brazil",
     "region_key": "VCP", "key_realm": "OC1", "avail_domains": "1"},
    {"name": "Canada Southeast (Montreal)", "id": "ca-montreal-1", "location": "Montreal, Canada",
     "region_key": "YUL", "key_realm": "OC1", "avail_domains": "1"},
    {"name": "Canada Southeast (Toronto)", "id": "ca-toronto-1", "location": "Toronto, Canada",
     "region_key": "YYZ", "key_realm": "OC1", "avail_domains": "1"},
    {"name": "Chile (Santiago)", "id": "sa-santiago-1", "location": "Santiago, Chile",
     "region_key": "SCL", "key_realm": "OC1", "avail_domains": "1"},
    {"name": "Germany Central (Frankfurt)", "id": "eu-frankfurt-1", "location": "Frankfurt, Germany",
     "region_key": "FRA", "key_realm": "OC1", "avail_domains": "3"},
    {"name": "India South (Hyderabad)", "id": "ap-hyderabad-1", "location": "Hyderabad, India",
     "region_key": "HYD", "key_realm": "OC1", "avail_domains": "1"},
    {"name": "India West (Mumbai)", "id": "ap-mumbai-1", "location": "Mumbai, India",
     "region_key": "BOM", "key_realm": "OC1", "avail_domains": "1"},
    {"name": "Japan Central (Osaka)", "id": "ap-osaka-1", "location": "Osaka, Japan",
     "region_key": "KIX", "key_realm": "OC1", "avail_domains": "1"},
    {"name": "Japan East (Tokyo)", "id": "ap-tokyo-1", "location": "Tokyo, Japan",
     "region_key": "NRT", "key_realm": "OC1", "avail_domains": "1"},
    {"name": "Netherlands Northwest (Amsterdam)", "id": "eu-amsterdam-1", "location": "Amsterdam, Netherlands",
     "region_key": "AMS", "key_realm": "OC1", "avail_domains": "1"},
    {"name": "Saudi Arabia West (Jeddah)", "id": "me-jeddah-1", "location": "Jeddah, Saudi Arabia",
     "region_key": "JED", "key_realm": "OC1", "avail_domains": "1"},
    {"name": "South Korea Central (Seoul)", "id": "ap-seoul-1", "location": "Seoul, South Korea",
     "region_key": "ICN", "key_realm": "OC1", "avail_domains": "1"},
    {"name": "South Korea North (Chuncheon)", "id": "ap-chuncheon-1", "location": "Chuncheon, South Korea",
     "region_key": "YNY", "key_realm": "OC1", "avail_domains": "1"},
    {"name": "Switzerland North (Zurich)", "id": "eu-zurich-1", "location": "Zurich, Switzerland",
     "region_key": "ZRH", "key_realm": "OC1", "avail_domains": "1"},
    {"name": "UAE East (Dubai)", "id": "me-dubai-1", "location": "Dubai, UAE",
     "region_key": "DXB", "key_realm": "OC1", "avail_domains": "1"},
    {"name": "UK South (London)", "id": "uk-london-1", "location": "London, United Kingdom",
     "region_key": "LHR", "key_realm": "OC1", "avail_domains": "3"},
    {"name": "UK West (Newport)", "id": "uk-cardiff-1", "location": "Newport, United Kingdom",
     "region_key": "CWL", "key_realm": "OC1", "avail_domains": "1"},
    {"name": "US East (Ashburn)", "id": "us-ashburn-1", "location": "Ashburn, VA",
     "region_key": "IAD", "key_realm": "OC1", "avail_domains": "3"},
    {"name": "US West (Phoenix)", "id": "us-phoenix-1", "location": "Phoenix, AZ",
     "region_key": "PHX", "key_realm": "OC1", "avail_domains": "3"},
    {"name": "US West (San Jose)", "id": "us-sanjose-1", "location": "San Jose, CA",
     "region_key": "SJC", "key_realm": "OC1", "avail_domains": "1"}
]


@plugin_function('mds.get.regions', shell=True, cli=True, web=True)
def get_regions():
    """Returns the list of available OCI regions

    Returns:
        A list of dicts
    """
    return OCI_REGION_LIST


def get_config(profile_name=None, config_file_path="~/.oci/config",
               cli_rc_file_path="~/.oci/oci_cli_rc", interactive=True,
               raise_exceptions=False):
    """Loads an oci config

    This function loads an oci config

    Args:
        profile (str): The name of the OCI profile
        config_file_path (str): The file location of the OCI config file
        cli_rc_file_path (str): The location of the OCI CLI config file
        raise_exceptions (bool): Whether to raise exceptions

    Returns:
        The config dict or None
    """

    import oci.config
    import oci.auth
    import oci.signer
    import oci.exceptions
    import mysqlsh

    # If no profile is given, look it up in the CLI config file
    if profile_name is None:
        default_profile_name = get_default_profile()
        profile_name = default_profile_name \
            if default_profile_name else "DEFAULT"

    # If the profile_name matches instanceprincipal, use an Instance Principals
    # instead of an actual config
    set_global_config = False
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

            # If running in interactive mode and there is no global
            # config set yet, ensure it gets set
            if interactive and not 'mds_config' in dir(mysqlsh.globals):
                set_global_config = True
        except (oci.exceptions.ConfigFileNotFound,
                oci.exceptions.ProfileNotFound) as e:
            if raise_exceptions:
                raise

            if interactive:
                if profile_name:
                    print(f"OCI configuration profile '{profile_name}' "
                          "was not found.")
                else:
                    print("OCI configuration profile not found.")

                # Start wizard for new profiles
                config = create_config(
                    profile_name=profile_name, 
                    config_file_path=config_file_path)
                if config is None:
                    return
                set_global_config = True

        except oci.exceptions.InvalidConfig as e:
            raise ValueError(f"The configuration profile '{profile_name}' is "
                             f"invalid.\n{str(e)}")

        # Create default signer based on the config values. This is required
        # since the OCI clients use if 'signer' in kwargs: and don't check for
        # None
        try:
            config["signer"] = oci.signer.Signer(
                tenancy=config.get("tenancy"),
                user=config.get("user"),
                fingerprint=config.get("fingerprint"),
                private_key_file_location=config.get("key_file"),
                pass_phrase=config.get("pass_phrase"),
                private_key_content=config.get("key_content"))
        except oci.exceptions.MissingPrivateKeyPassphrase:
            # If there is a passphrase required, ask for it
            pass_phrase = mysqlsh.globals.shell.prompt(
                f"Please enter the passphrase for the API key: ",
                {'defaultValue': '', 'type': 'password'})
            if not pass_phrase:
                if raise_exceptions:
                    raise Exception("No or invalid passphrase for API key.")
                return None

            # Store the passphrase in the config
            config["pass_phrase"] = pass_phrase

            try:
                config["signer"] = oci.signer.Signer(
                    tenancy=config.get("tenancy"),
                    user=config.get("user"),
                    fingerprint=config.get("fingerprint"),
                    private_key_file_location=config.get("key_file"),
                    pass_phrase=config.get("pass_phrase"),
                    private_key_content=config.get("key_content"))
            except oci.exceptions.MissingPrivateKeyPassphrase:
                if raise_exceptions:
                    raise Exception("No or invalid passphrase for API key.")
                print("No or invalid passphrase for API key.")
                return None

    # Set additional config values like profile and current objects

    # Add profile name to the config so it can be used later
    config["profile"] = profile_name

    # Set it as global config object
    if set_global_config:
        setattr(mysqlsh.globals, 'mds_config', config)

    # Load current compartment_id
    current_compartment_id = get_current_compartment_id(
        profile_name=profile_name,
        cli_rc_file_path=cli_rc_file_path)

    # If there is no current compartment yet, use the tenancy
    if not current_compartment_id:
        if "tenancy" in config:
            current_compartment_id = config["tenancy"]

    # Initialize current compartment in the global config
    config["compartment-id"] = current_compartment_id

    # Load current instance_id
    current_instance_id = get_current_instance_id(
        profile_name=profile_name,
        cli_rc_file_path=cli_rc_file_path)
    if current_instance_id is not None:
        # Initialize current compartment in the global config
        config["instance-id"] = current_instance_id

    # Load current db_system_id
    current_db_system_id = get_current_db_system_id(
        profile_name=profile_name,
        cli_rc_file_path=cli_rc_file_path)
    if current_db_system_id is not None:
        # Initialize current compartment in the global config
        config["db-system-id"] = current_db_system_id

    # Load current bucket_name
    current_bucket_name = get_current_bucket_name(
        profile_name=profile_name,
        cli_rc_file_path=cli_rc_file_path)
    if current_bucket_name is not None:
        # Initialize current compartment in the global config
        config["bucket-name"] = current_bucket_name

    # Load current network
    current_network_id = get_current_network_id(
        profile_name=profile_name,
        cli_rc_file_path=cli_rc_file_path)
    if current_network_id is not None:
        # Initialize current compartment in the global config
        config["network-id"] = current_network_id

    # Load current endpoint
    current_endpoint = get_current_endpoint(
        profile_name=profile_name,
        cli_rc_file_path=cli_rc_file_path)
    if current_endpoint is not None:
        # Initialize current compartment in the global config
        config["endpoint"] = current_endpoint

    # Load current bastion_id
    current_bastion_id = get_current_bastion_id(
        profile_name=profile_name,
        cli_rc_file_path=cli_rc_file_path)
    if current_bastion_id:
        # Initialize current compartment in the global config
        config["bastion-id"] = current_bastion_id

    # Update global config object
    if set_global_config:
        setattr(mysqlsh.globals, 'mds_config', config)

    return config


def get_config_profile_dict_from_parser(config, profile):
    """Returns the given profile as a dict

    Args:
        config (object): The configparser.ConfigParser() instance with the 
            config loaded
        profile (str): The name of the profile

    Returns:
        The profile as Dict
    """

    return {
        'profile': profile,
        'user': config[profile]['user'],
        'fingerprint': config[profile]['fingerprint'],
        'key_file': config[profile]['key_file'],
        'tenancy': config[profile]['tenancy'],
        'region': config[profile]['region'],
        'is_current': profile == get_default_profile()
    }


@plugin_function('mds.list.configProfiles', shell=True, cli=True, web=True)
def list_config_profiles(**kwargs):
    """Lists all available profiles

    Args:
        **kwargs: Additional options

    Keyword Args:
        config_file_path (str): The file location of the OCI config file
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised
        return_formatted (bool): If set to true, a list object is returned

    Returns:
        None
    """
    config_file_path = kwargs.get("config_file_path", "~/.oci/config")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)
    try:
        import configparser
        import os.path

        # Convert Unix path to Windows
        config_file_path = os.path.abspath(
            os.path.expanduser(config_file_path))

        # Read config
        config = configparser.ConfigParser()
        config.read(config_file_path)

        # Add special handling for the DEFAULT section that is not listed
        # in the config.sections() call
        config_profiles = [
            get_config_profile_dict_from_parser(config, 'DEFAULT')] \
            if 'user' in config['DEFAULT'] else []
        for section in config.sections():
            try:
                config_profiles.append(
                    get_config_profile_dict_from_parser(config, section))
            except Exception as e:
                raise Exception(
                    f"The OCI configuration file is corrupted. {e}")

        if interactive:
            print("The following configuration profiles are available:\n")

        if return_formatted:
            result = ""
            i = 1
            for p in config_profiles:
                result += f"{i:>4} {p.get('profile'):25} {p.get('region')}\n"
                i += 1
            return result
        else:
            return config_profiles

    except Exception as e:
        if raise_exceptions:
            raise
        print(f"Error: {str(e)}")


@plugin_function('mds.create.configProfile')
def create_config(**kwargs):
    """Creates and stores a new OCI config

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        profile_name (str): The name of the OCI profile
        config_file_path (str): The file path of the OCI config file
        tenancy (str): OCID of the tenancy
        region (str): The name of the region
        user_id (str): OCID of the user
        key_file (str): The filename of the OCI API key
        fingerprint (str): The fingerprint of the OCI API key
        interactive (bool): Whether user interaction should be performed

    Returns:
        The new config or None

    If profile_name is omitted, the DEFAULT profile is used.

    If the config_file_path is omitted, ~/.oci/config is used.
    """
    import os.path
    import pathlib
    import configparser
    import oci.config
    import mysqlsh
    from mds_plugin import user

    profile_name = kwargs.get("profile_name")
    config_file_path = kwargs.get("config_file_path", "~/.oci/config")
    tenancy = kwargs.get("tenancy")
    region = kwargs.get("region")
    user_id = kwargs.get("user_id")
    key_file = kwargs.get("key_file")
    fingerprint = kwargs.get("fingerprint")
    interactive = kwargs.get("interactive", True)

    # Get full path
    config_file_path = os.path.expanduser(config_file_path)
    if key_file:
        key_file = os.path.expanduser(key_file)

    parser = configparser.ConfigParser(interpolation=None)
    if os.path.isfile(config_file_path):
        parser.read(config_file_path)

    # If no profile name was given, query the user for one
    if profile_name is None and interactive:
        profile_name = mysqlsh.globals.shell.prompt(
            "Please enter a name for the new OCI profile: ").strip()
    if not profile_name:
        print("Operation cancelled.")
        return None

    # Ensure profile_name only uses alphanumeric chars
    profile_name = ''.join(e for e in profile_name if e.isalnum())

    if profile_name in parser and profile_name.upper() != 'DEFAULT':
        print(f"The profile '{profile_name}' already exists.")
        return

    # cSpell:ignore OCIDs, sdkconfig
    print(f"Creating a new OCI API configuration profile '{profile_name}'..."
          "\n\nThe creation of a new OCI API configuration profile requires\n"
          "the following steps.\n"
          "1. Identify the geographical OCI region to use. Each region has\n"
          "   its own end point and therefore it is important to chose the\n"
          "   right one for the OCI API \n"
          "2. The Oracle Cloud Identifier (OCID) of the OCI tenancy and\n"
          "   OCI user account need to be looked up on the OCI web console.\n"
          "3. An API Signing Key needs to be generated or an existing key file"
          "\n   needs to be reused.\n"
          "4. The API Signing Key needs to be uploaded to the OCI web console."
          "\n\nPlease follow the instructions outlined by this wizard or read\n"
          "about the details of how to get the recquired OCIDs here:\n"
          "-  https://docs.cloud.oracle.com/en-us/iaas/Content/API/Concepts/"
          "sdkconfig.htm\n")

    # Wait for enter
    mysqlsh.globals.shell.prompt(
        "Please hit the enter key to continue...\n")

    if region is None or region == '':
        print("OCI Region\n"
              "==========\n"
              "Please select a region from this list or provide the exact name "
              "of a new region.")
        region_list = []
        for r in OCI_REGION_LIST:
            region_list.append(f"{r.get('id'):20} {r.get('location')}")
        region = core.prompt_for_list_item(
            item_list=region_list,
            prompt_caption="Please enter the index or name of a region: ",
            prompt_default_value='',
            print_list=True)
        if not region:
            print("Operation cancelled.")
            return None
        # Remove the trailing caption
        region = region.split(' ')[0]

    # If no tenancy or user was given, query the user for one
    if not tenancy or not user_id:
        print("\nOCID of the OCI Tenancy and User Account\n"
              "========================================\n"
              "Please open the OCI web console by following the link below.\n"
              "Enter the name of the tenancy and then log in using your\n"
              "OCI user name and web console password or identity provider.\n"
              f"-  https://console.{region}.oraclecloud.com/\n\n"
              "In the OCI web console please click on the user profile icon\n"
              "top right and choose 'Tenancy'. On the Tenancy page find the\n"
              "<Copy> link next to the Tenancy OCID value and use it to copy\n"
              "the value to the clipboard.\n\n"
              "For the User OCID value click the user profile icon top right\n"
              "and choose 'User Settings'. Again, locate the User OCID value\n"
              "click the <Copy> link to copy the value to the clipboard.\n")
        if not tenancy:
            tenancy = mysqlsh.globals.shell.prompt(
                "Please enter the OCID of the tenancy: ").strip()
        if not tenancy:
            return None
        # Check if the user actually entered the tenancy OCID
        if not tenancy.startswith('ocid1.tenancy.oc1..'):
            # If not, give him another chance to enter the right one
            print("ERROR: The OCID of the tenancy needs to start with "
                  "'ocid1.tenancy.oc1..'.")
            tenancy = mysqlsh.globals.shell.prompt(
                "Please enter the OCID of the tenancy: ").strip()
            if not tenancy:
                return None
        if not user_id:
            user_id = mysqlsh.globals.shell.prompt(
                "Please enter the OCID of the user account: ").strip()
        if not user_id:
            return None
        # Check if the user actually entered the user OCID
        if not user_id.startswith('ocid1.user.oc1..'):
            # If not, give him another chance to enter the right one
            print("ERROR: The OCID of the user needs to start with "
                  "'ocid1.user.oc1..'.")
            user_id = mysqlsh.globals.shell.prompt(
                "Please enter the OCID of the user account: ").strip()
            if not user_id:
                return None

    def get_public_key_file(key_file):
        """Get the public key based on the private key file path

        Try to locate public_key_file by appending _public.pem to the
        path + basename of the private key file

        Args:
            key_file (str): The private key file path

        Returns:
            The public key file path or None
        """
        public_key_file = None
        if '.' in key_file:
            public_key_file = os.path.splitext(key_file)[0] + "_public.pem"
        if not public_key_file or not os.path.isfile(public_key_file):
            public_key_file = mysqlsh.globals.shell.prompt(
                "Please enter the full path to the private key file "
                "[~/.oci/oci_api_key.pem]: ").strip()
            if not os.path.isfile(public_key_file):
                print(f"Key file '{public_key_file}' not found.\n"
                      "Operation cancelled.")
                return None
        return public_key_file

    # If no key_file was given, let the user choose
    if interactive and (key_file is None or not os.path.isfile(key_file)):
        print("\nAPI Signing Key\n"
              "===============\n"
              "In order to access the OCI APIs an API Signing Key is required.\n"
              "The API Signing Key is a special RSA key in PEM format.\n\n"
              "Please select one of the following options.")
        key_option = core.prompt_for_list_item(
            item_list=[
                "Create a new API Signing Key",
                "Reuse an existing API Signing Key"],
            prompt_caption="Please enter the index of the key option to use: ",
            prompt_default_value='',
            print_list=True)
        if key_option == '':
            print("Operation cancelled.")
            return None

        if key_option.startswith('Reuse'):
            key_file = mysqlsh.globals.shell.prompt(
                "Please enter the full path to the private key file "
                "[~/.oci/oci_api_key.pem]: ",
                options={
                    'defaultValue': '~/.oci/oci_api_key.pem'}).strip()
            if not key_file:
                print("Operation cancelled.")
                return None

            key_file = os.path.expanduser(key_file)
            if not os.path.isfile(key_file):
                print(f"Key file '{key_file}' not found. Operation cancelled.")
                return None

            # Get public key based on key_file
            public_key_file = get_public_key_file(key_file)
            if not public_key_file:
                return None
        else:
            print("Generating API key files...")
            key_info = user.create_user_api_key(
                key_path="~/.oci/",
                key_file_prefix=f"oci_api_key_{profile_name}",
                write_to_disk=True,
                return_object=True,
                interactive=False)

            fingerprint = key_info["fingerprint"]
            key_file = os.path.expanduser(
                f"~/.oci/oci_api_key_{profile_name}.pem")
            public_key_file = os.path.splitext(key_file)[0] + "_public.pem"

    if interactive:
        print("\nUploading the API Signing Key to the OCI web console\n"
              "====================================================\n"
              "In the OCI web console please click on the user profile "
              "icon\ntop right and choose 'User Settings'.\n\n"
              "On the lower left side in the Resources list select "
              "'API Keys'.\n"
              "Click on [Add Public Key] and choose the public key file \n"
              f"\n  {public_key_file}\n\n"
              "and click [Add] to complete the upload.\n")

        # Wait for enter
        mysqlsh.globals.shell.prompt(
            "Please hit the enter key once the public key file has been "
            "uploaded...\n")

    if not key_file or not os.path.isfile(key_file):
        print("No API Signing Key file given or found. Operation cancelled.")
        return None

    if not fingerprint:
        # Get public key based on key_file
        public_key_file = get_public_key_file(key_file)
        if not public_key_file:
            return None

        # Read the public key
        with open(public_key_file, mode='rb') as binary_file:
            public_key = binary_file.read()

        # Generate fingerprint
        fingerprint = user.get_fingerprint(public_key)

    # Setup Config
    config = {
        "user": user_id,
        "fingerprint": fingerprint,
        "key_file": key_file,
        "tenancy": tenancy,
        "region": region
    }

    try:
        oci.config.validate_config(config)
    except oci.exceptions.InvalidConfig as e:
        print(f"ERROR: The config is invalid: {str(e)}")
        return

    # Update config parser
    parser[profile_name] = config

    print(f"Storing profile '{profile_name}' in config file ...")

    # Ensure path exists
    pathlib.Path(os.path.dirname(config_file_path)).mkdir(
        parents=True, exist_ok=True)

    # Write the change to disk
    with open(config_file_path, 'w') as configfile:
        parser.write(configfile)

    # Add profile name and default values
    config["profile"] = profile_name
    config = {**oci.config.DEFAULT_CONFIG, **config}

    # Set it as global config object
    setattr(mysqlsh.globals, 'mds_config', config)

    # Set the new profile as the default profile
    load_profile_as_current(profile_name)

    if not interactive:
        return config


def get_current_config(config=None, config_profile=None, interactive=None):
    """Gets the active config dict

    If no config dict is given as parameter, the global config dict will be used

    Args:
        config (dict): The config to be used or None
        config_profile (str): The name of a config profile
        interactive (bool): Indicates whether to execute in interactive mode

    Returns:
        The active config dict
    """
    import mysqlsh

    if config_profile:
        try:
            # Check if the current global config matches the config profile
            # name passed in
            global_config = None
            if 'mds_config' in dir(mysqlsh.globals):
                global_config = getattr(mysqlsh.globals, 'mds_config')

            if global_config and global_config.get('profile') == config_profile:
                config = global_config
            else:
                # If there is no global config yet or a different config
                # profile name was passed in, load that
                load_profile_as_current(
                    profile_name=config_profile,
                    print_current_objects=False,
                    interactive=interactive)

                # Check if global object 'mds_config' now has been registered
                if 'mds_config' in dir(mysqlsh.globals):
                    config = getattr(mysqlsh.globals, 'mds_config')
                else:
                    raise Exception("No OCI configuration set.")
        except Exception as e:
            raise e
    elif config is None:
        # Check if global object 'mds_config' has already been registered
        if 'mds_config' in dir(mysqlsh.globals):
            config = getattr(mysqlsh.globals, 'mds_config')
        else:
            try:
                # Load the config profile
                load_profile_as_current(
                    profile_name=config_profile,
                    print_current_objects=False)

                # Check if global object 'mds_config' now has been registered
                if 'mds_config' in dir(mysqlsh.globals):
                    config = getattr(mysqlsh.globals, 'mds_config')
                else:
                    raise Exception("No OCI configuration set.")
            except Exception as e:
                raise ValueError(str(e))

    return config


def load_profile_as_current(profile_name=None, config_file_path="~/.oci/config",
                            print_current_objects=True, interactive=True):
    """Loads an oci config

    If profile_name is omitted, the DEFAULT profile is used.
    If the config_file_path is omitted, ~/.oci/config is used.

    Args:
        profile_name (str): The name of the OCI profile or InstancePrincipal
            when running on a compute instance that is part of a dynamic group.
        config_file_path (str): The file path of the OCI config file
        print_current_objects (bool): Whether to print information about current 
            objects and core cloud functions
        interactive (bool): Whether information should be printed

    Returns:
        None
    """
    # cSpell:ignore timeit
    from timeit import default_timer as timer

    # Take the time it takes to load the OCI module
    if interactive:
        print("Loading OCI library... ", end="")
        start = timer()

    import oci.identity

    if interactive:
        end = timer()
        print(f'(Loaded in {end - start:.2f} seconds)')

    import mysqlsh

    # If the config file exists, load the requested profile_name
    try:
        if interactive:
            print("Loading OCI configuration ...")

        try:
            delattr(mysqlsh.globals, 'mds_config')
        except:
            pass

        # Try to load config with the given profile name
        config = get_config(
            profile_name=profile_name, config_file_path=config_file_path,
            interactive=interactive, raise_exceptions=not interactive)
        if not config:
            return

        # Set it as global config object
        setattr(mysqlsh.globals, 'mds_config', config)

        if interactive:
            print(f"\nOCI profile '{config.get('profile')}' loaded.\n")
    except (oci.exceptions.ConfigFileNotFound,
            oci.exceptions.ProfileNotFound,
            oci.exceptions.InvalidConfig) as e:
        if interactive:
            print("OCI configuration profile not found. Starting OCI "
                  "Configuration Profile Wizard...\n")

            # Start wizard for new profiles
            # config = configuration.create_config(
            #     profile_name=profile_name, config_file_path=config_file_path)
            # if config is None:
            #     return

            # # Try to load config with the given profile name
            # config = configuration.get_config(
            #     profile_name=profile_name, config_file_path=config_file_path)

    # List the current objects
    if interactive and print_current_objects:
        list_current_objects(config=config, profile_name=profile_name)


@plugin_function('mds.list.currentObjects')
def list_current_objects(config=None, profile_name=None,
                         cli_rc_file_path="~/.oci/oci_cli_rc"):
    """Lists the current objects

    Args:
        config (dict): The config to be used, None defaults to global config
        profile_name (str): The profile_name is already defined
        cli_rc_file_path (str): The location of the OCI CLI config file

    Returns:
        None
    """
    config = get_current_config(config=config)

    import oci.exceptions
    from mds_plugin import compartment, compute, network
    from mds_plugin import mysql_database_service, bastion

    # Get current compartment information
    try:
        comp_id = get_current_compartment_id(
            config=config, profile_name=profile_name,
            cli_rc_file_path=cli_rc_file_path)

        if comp_id == config.get('tenancy'):
            # Initialize the identity client
            identity = core.get_oci_identity_client(config=config)

            # Get tenancy name
            comp_name = identity.get_tenancy(config.get("tenancy")).data.name
        else:
            comp_name = compartment.get_compartment_full_path(
                compartment_id=comp_id, config=config)

        print(f"Current compartment set to '{comp_name}'.")
    except oci.exceptions.ServiceError as e:
        if e.status == 404:
            set_current_compartment(
                compartment_path='/', config=config)
        else:
            print(f"Could not fetch information about the compartment "
                  f"'{comp_id}'.\n"
                  f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')

    # Get current instance information
    try:
        instance_id = get_current_instance_id(
            config=config, profile_name=profile_name,
            cli_rc_file_path=cli_rc_file_path)

        if instance_id is not None:
            instance = compute.get_instance_by_id(instance_id=instance_id,
                                                  config=config)
            if instance is None or instance.lifecycle_state == "TERMINATED":
                config.pop("instance-id", None)
            else:
                print(f"Current Compute Instance set to "
                      f"'{instance.display_name}'.")
    except oci.exceptions.ServiceError as e:
        if e.status == 404:
            # Remove current instance
            set_current_instance(
                instance_id="", config=config, interactive=False)
        else:
            print(f"Could not fetch information about the instance {comp_id}.\n"
                  f'ERROR: {e.message}.\n(Code: {e.code}; Status: {e.status})')

    # Get current DB System information
    try:
        db_system_id = get_current_db_system_id(
            config=config, profile_name=profile_name,
            cli_rc_file_path=cli_rc_file_path)

        if db_system_id is not None:
            db_system = mysql_database_service.get_db_system_by_id(
                db_system_id=db_system_id, config=config)
            if db_system is None:
                config.pop("db-system-id", None)
            else:
                print(f"Current MySQL DB System set to "
                      f"'{db_system.display_name}'.")
    except oci.exceptions.ServiceError as e:
        if e.status == 404:
            # Remove current db_system
            set_current_db_system(
                db_system_id='', config=config, interactive=False)
        else:
            print(f"Could not fetch information about the DB System {comp_id}."
                  f'\nERROR: {e.message}. (Code: {e.code}; Status: {e.status})')

    # TODO check if bucket actually exists
    # Get current bucket_name
    current_bucket_name = get_current_bucket_name(
        config=config, profile_name=profile_name,
        cli_rc_file_path=cli_rc_file_path)

    if current_bucket_name is not None:
        print(f"Current Object Store bucket set to "
              f"'{current_bucket_name}'.")

    # Get current bastion information
    try:
        bastion_id = get_current_bastion_id(
            config=config, profile_name=profile_name,
            cli_rc_file_path=cli_rc_file_path)

        if bastion_id is not None:
            bastion = bastion.get_bastion(
                bastion_id=bastion_id, config=config,
                interactive=False, return_type=core.RETURN_OBJ)
            if bastion is None or bastion.lifecycle_state == "DELETED":
                config.pop("bastion-id", None)
            else:
                print(f"Current Bastion set to "
                      f"'{bastion.name}'.")
    except oci.exceptions.ServiceError as e:
        if e.status == 404:
            # Remove current bastion
            set_current_bastion(
                bastion_id="", config=config, interactive=False)
        else:
            print(
                f"Could not fetch information about the bastion {bastion_id}.\n"
                f'ERROR: {e.message}.\n(Code: {e.code}; Status: {e.status})')

    # Get current network information
    try:
        network_id = get_current_network_id(
            config=config, profile_name=profile_name,
            cli_rc_file_path=cli_rc_file_path)

        if network_id is not None:
            network = network.get_network(
                network_id=network_id, config=config)
            if network is None or network.lifecycle_state == "DELETED":
                config.pop("network-id", None)
            else:
                print(f"Current Bastion set to "
                      f"'{bastion.name}'.")
    except oci.exceptions.ServiceError as e:
        if e.status == 404:
            # Remove current instance
            set_current_network(
                network_id="", config=config, interactive=False)
        else:
            print(
                f"Could not fetch information about the network {network_id}.\n"
                f'ERROR: {e.message}.\n(Code: {e.code}; Status: {e.status})')


@plugin_function('mds.set.currentConfigProfile')
def set_current_profile(profile_name=None, config_file_path="~/.oci/config",
                        interactive=True):
    """Sets the current OCI config Profile

    If the config_file_path is omitted, ~/.oci/config is used.

    Args:
        profile_name (str): The name of the OCI profile or InstancePrincipal
            when running on a compute instance that is part of a dynamic group.
        config_file_path (str): The file path of the OCI config file
        interactive (bool): Whether information should be printed

    Returns:
        None
    """

    if not profile_name and interactive:
        import configparser
        import os.path

        # Convert Unix path to Windows
        config_file_path = os.path.abspath(
            os.path.expanduser(config_file_path))

        # Read config
        configs = configparser.ConfigParser()
        configs.read(config_file_path)

        profile_name = core.prompt_for_list_item(
            item_list=configs.sections(),
            prompt_caption="Please select a config profile to activate it: ",
            print_list=True)
        if not profile_name:
            print("Operation cancelled.")
        else:
            load_profile_as_current(profile_name=profile_name,
                                    config_file_path=config_file_path)


@plugin_function('mds.set.defaultConfigProfile', cli=True, web=True)
def set_default_profile(profile_name=None,
                        config_file_location="~/.oci/config",
                        cli_rc_file_location="~/.oci/oci_cli_rc"):
    """Sets the default profile

    Args:
        profile_name (str): The name of the profile currently in use
        config_file_location (str): The location of the OCI config file
        cli_rc_file_location (str): The location of the OCI CLI config file
    Returns:
       None
    """
    import configparser
    import os.path
    import pathlib
    from mds_plugin import general

    # Convert Unix path to Windows
    config_file_location = os.path.abspath(
        os.path.expanduser(config_file_location))

    if not os.path.exists(config_file_location):
        # TODO Start the wizard to create a new OCI profile
        print(f"No OCI config file found at {config_file_location}")
        return

    # Read config
    configs = configparser.ConfigParser()
    if os.path.exists(config_file_location):
        configs.read(config_file_location)

    # If no profile was given, let the user select one
    if profile_name is None or profile_name == "":
        print("The following configuration profiles are available:\n")

        profile_name = core.prompt_for_list_item(
            item_list=configs.sections(),
            prompt_caption="Please enter the profile name or index: ",
            print_list=True)
        if profile_name is None or profile_name == "":
            print("Operation cancelled.")
            return

    # Convert Unix path to Windows
    cli_rc_file_location = os.path.abspath(
        os.path.expanduser(cli_rc_file_location))

    cli_config = configparser.ConfigParser()

    # Load CLI config file
    if os.path.exists(cli_rc_file_location):
        cli_config.read(cli_rc_file_location)

    # Ensure that there is a section with the name of profile_name
    if "DEFAULT" not in cli_config.sections():
        cli_config["DEFAULT"] = {}

    # Set the default profile
    cli_config["DEFAULT"]["profile"] = profile_name

    # Ensure path exists
    pathlib.Path(os.path.dirname(cli_rc_file_location)).mkdir(
        parents=True, exist_ok=True)

    # Write the change to disk
    with open(cli_rc_file_location, 'w') as configfile:
        cli_config.write(configfile)

    # Print out that the current compartment was changed
    print(f"Default profile changed to '{profile_name}'.\n")


@plugin_function('mds.get.defaultConfigProfile', shell=True, cli=True, web=True)
def get_default_profile(cli_rc_file_location="~/.oci/oci_cli_rc"):
    """Gets the default profile if stored in the CLI config file

    Args:
        cli_rc_file_location (str): The location of the OCI CLI config file

    Returns:
        None
    """
    import configparser
    import os.path

    # Convert Unix path to Windows
    cli_rc_file_location = os.path.abspath(
        os.path.expanduser(cli_rc_file_location))

    config = configparser.ConfigParser()
    if os.path.exists(cli_rc_file_location):
        config.read(cli_rc_file_location)

    if "DEFAULT" in config and "profile" in config["DEFAULT"]:
        return config["DEFAULT"]["profile"]
    else:
        return None


@plugin_function('mds.get.currentConfigProfile')
def get_current_profile(profile_name=None):
    """Returns the current profile_name

    Args:
        profile_name (str): If specified it will be returned as is, otherwise
            the profile_name from the current config will be returned

    Returns:
        None
    """
    import mysqlsh

    # If profile_name was not given, check if there is a config global
    if profile_name is None and 'mds_config' in dir(mysqlsh.globals):
        config = getattr(mysqlsh.globals, 'mds_config')
        # Take the profile from the global config
        profile_name = config.get("profile")

    return profile_name


def get_current_value(
    value_name, passthrough_value=None, config=None,
    profile_name=None, cli_rc_file_path="~/.oci/oci_cli_rc"):
    """Gets the current value

    Either from the global config or the OCI CLI config file

    Args:
        value_name (str): The current value to get
        passthrough_value (str): If specified, returned instead of the current
        config (dict): The config to be used or None, then global config dict
            will be used
        profile_name (str): The profile_name
        cli_rc_file_path (str): The location of the OCI CLI config file

    Returns:
        The current value
    """
    import configparser
    import os.path
    import mysqlsh

    # If passthrough_value is specified, returned it instead of the current
    if passthrough_value:
        return passthrough_value

    # If no config is given, check the global one
    if not config:
        if 'mds_config' in dir(mysqlsh.globals):
            config = getattr(mysqlsh.globals, 'mds_config')
        else:
            config = get_config(profile_name=profile_name)

    # Check if current value is already in the config, if so, return that
    if config and value_name in config:
        return config[value_name]

    # Convert Unix path to Windows
    cli_rc_file_path = os.path.abspath(os.path.expanduser(cli_rc_file_path))

    config = configparser.ConfigParser()
    if os.path.exists(cli_rc_file_path):
        config.read(cli_rc_file_path)

    # Get the current profile_name
    profile_name = get_current_profile(profile_name=profile_name)

    if profile_name in config and value_name in config[profile_name] and \
            config[profile_name][value_name] != "":
        return config[profile_name][value_name]
    else:
        return None


def set_current_value(value_name, value, profile_name=None,
                      cli_rc_file_path="~/.oci/oci_cli_rc"):
    """Sets the current value for a given value_name 

    It is set in the global config and stored in the OCI CLI rc file

    Args:
        value_name (str): The name of the value to set, e.g. compartment-id
        value (str): The value to set
        profile_name (str): The name of the profile currently in use
        cli_rc_file_path (str): The location of the OCI CLI config file
    Returns:
       None
    """
    import configparser
    import os.path
    import pathlib
    import mysqlsh

    # Get the current profile_name
    profile_name = get_current_profile(profile_name=profile_name)

    # Convert Unix path to Windows
    cli_rc_file_path = os.path.abspath(os.path.expanduser(cli_rc_file_path))

    # Load CLI config file
    cli_config = configparser.ConfigParser()
    if os.path.exists(cli_rc_file_path):
        cli_config.read(cli_rc_file_path)

    # Ensure that there is a section with the name of profile_name
    if profile_name not in cli_config.sections():
        cli_config[profile_name] = {}

    # Set the db-system-id property that this plugin uses as current object
    cli_config[profile_name][value_name] = value

    # Ensure path exists
    pathlib.Path(os.path.dirname(cli_rc_file_path)).mkdir(
        parents=True, exist_ok=True)

    with open(cli_rc_file_path, 'w') as configfile:
        cli_config.write(configfile)

    # Update the global config
    if 'mds_config' in dir(mysqlsh.globals):
        config = getattr(mysqlsh.globals, 'mds_config')
        config[value_name] = value


@plugin_function('mds.set.currentCompartment', shell=True, cli=True, web=True)
def set_current_compartment(**kwargs):
    """Sets the current compartment

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        compartment_path (str): The path of the compartment
        compartment_id (str): The OCID of the compartment
        config (dict): The config dict to use
        config_profile (str): The name of the profile currently
        profile_name (str): The profile_name is already defined
        cli_rc_file_path (str): The location of the OCI CLI config file
        interactive (bool): Whether information should be printed
        raise_exceptions (bool): Whether exceptions should be raised

    Returns:
        None
    """

    compartment_path = kwargs.get('compartment_path')
    compartment_id = kwargs.get('compartment_id')
    config = kwargs.get('config')
    config_profile = kwargs.get('config_profile')
    profile_name = kwargs.get('profile_name')
    cli_rc_file_path = kwargs.get('cli_rc_file_path', "~/.oci/oci_cli_rc")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)

    # Get the active config
    try:
        config = get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)

        from mds_plugin import compartment

        if compartment_id is None and interactive:
            if compartment_path is None:
                print("Please specify the compartment to be used as current.\n")
            try:
                compartment_id = compartment.get_compartment_id(
                    compartment_path=compartment_path,
                    compartment_id=compartment_id,
                    config=config)
            except Exception as e:
                if raise_exceptions:
                    raise Exception(
                        f"ERROR: Could not get compartment_id. ({e})")
                print(f"ERROR: Could not get compartment_id. ({e})")
                return
        if compartment_id is None:
            print("Operation cancelled.")
            return

        # Store the new current value in the global config and in the conf file
        set_current_value(
            value_name="compartment-id", value=compartment_id,
            profile_name=profile_name, cli_rc_file_path=cli_rc_file_path)

        # Print out that the current compartment was changed
        if interactive:
            if compartment_path is not None:
                print(f"Current compartment changed to {compartment_path}\n")
            else:
                try:
                    path = compartment.get_compartment_full_path(
                        compartment_id=compartment_id,
                        config=config, interactive=False)
                    print(f"Current compartment changed to {path}\n")
                except:
                    print(f"Current compartment changed to {compartment_id}\n")
    except Exception as e:
        if raise_exceptions:
            raise
        print(f"ERROR: {str(e)}")


@plugin_function('mds.get.currentCompartmentId', shell=True, cli=True, web=True)
def get_current_compartment_id(
    compartment_id=None, config=None,
    profile_name=None, cli_rc_file_path="~/.oci/oci_cli_rc"):
    """Gets the current compartment_id

    Args:
        compartment_id (str): If specified, returned instead of the current
        config (dict): The config to be used, None defaults to global config
        profile_name (str): Name of the config profile
        cli_rc_file_path (str): The location of the OCI CLI config file

    Returns:
        The current compartment_id
    """
    return get_current_value(
        value_name="compartment-id", passthrough_value=compartment_id,
        config=config, profile_name=profile_name,
        cli_rc_file_path=cli_rc_file_path)


@plugin_function('mds.set.currentComputeInstance')
def set_current_instance(**kwargs):
    """Makes the given compute instance the current object

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        instance_name (str): The name of the instance.
        instance_id (str): The OCID of the instance
        compartment_id (str): OCID of the compartment.
        config (object): An OCI config object or None.
        profile_name (str): The name of the profile currently in use
        cli_rc_file_path (str): The location of the OCI CLI config file
        raise_exceptions (bool): Whether exceptions should be raised
        interactive (bool): Whether information should be printed
    Returns:
       None
    """
    instance_name = kwargs.get('instance_name')
    instance_id = kwargs.get('instance_id')
    compartment_id = kwargs.get('compartment_id')
    config = kwargs.get('config')
    profile_name = kwargs.get('profile_name')
    cli_rc_file_path = kwargs.get('cli_rc_file_path', "~/.oci/oci_cli_rc")
    raise_exceptions = kwargs.get('raise_exceptions', False)
    interactive = kwargs.get('interactive', True)

    # Get the active config and compartment
    try:
        config = get_current_config(config=config)
        compartment_id = get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        from mds_plugin import compute

        # Get instance, but also allow setting of an empty instance_id to clean
        # the current instance
        instance = None
        if instance_id != "":
            instance = compute.get_instance(
                instance_name=instance_name, instance_id=instance_id,
                compartment_id=compartment_id, config=config,
                ignore_current=True,
                interactive=False)
            instance_id = instance.id if instance else ""

        # Store the new current value in the global config and the config file
        set_current_value(
            value_name="instance-id", value=instance_id,
            profile_name=profile_name, cli_rc_file_path=cli_rc_file_path)

        if interactive:
            if instance:
                # Print out that the current compartment was changed
                print(f"Current compute instance changed to "
                      f"{instance.display_name}.\n")
            else:
                print(f"Current compute instance cleared.\n")
    except Exception as e:
        if raise_exceptions:
            raise
        print(f"ERROR: {str(e)}")


@plugin_function('mds.get.currentComputeInstanceId')
def get_current_instance_id(instance_id=None, config=None, profile_name=None,
                            cli_rc_file_path="~/.oci/oci_cli_rc"):
    """Gets the current instance_id

    Args:
        instance_id (str): If specified, returned instead of the current
        config (dict): The config to be used, None defaults to global config
        profile_name (str): The profile_name is already defined
        cli_rc_file_path (str): The location of the OCI CLI config file

    Returns:
        None
    """
    return get_current_value(
        value_name="instance-id", passthrough_value=instance_id,
        config=config, profile_name=profile_name,
        cli_rc_file_path=cli_rc_file_path)


@plugin_function('mds.set.currentMysqlDbSystem')
def set_current_db_system(**kwargs):
    """Makes the given DB System the current object

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        db_system_name (str): The name of the DB System.
        db_system_id (str): The OCID of the DB System
        compartment_id (str): OCID of the compartment.
        config (object): An OCI config object or None.
        profile_name (str): The name of the profile currently in use
        cli_rc_file_path (str): The location of the OCI CLI config file
        raise_exceptions (bool): Whether exceptions should be raised
        interactive (bool): Whether information should be printed
    Returns:
       None
    """

    db_system_name = kwargs.get('db_system_name')
    db_system_id = kwargs.get('db_system_id')
    compartment_id = kwargs.get('compartment_id')
    config = kwargs.get('config')
    profile_name = kwargs.get('profile_name')
    cli_rc_file_path = kwargs.get('cli_rc_file_path', "~/.oci/oci_cli_rc")
    raise_exceptions = kwargs.get('raise_exceptions', False)
    interactive = kwargs.get('interactive', True)

    # Get the active config and compartment
    try:
        config = get_current_config(config=config)
        compartment_id = get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        from mds_plugin import mysql_database_service

        # Get db_system, but also allow setting of an empty db_system_id to
        # clean the current db_system
        if db_system_id != '':
            db_system = mysql_database_service.get_db_system(
                db_system_name=db_system_name, db_system_id=db_system_id,
                compartment_id=compartment_id, config=config,
                ignore_current=True, interactive=interactive,
                return_python_object=True)
            db_system_id = db_system.id if db_system is not None else ""

        # Store the new current value in the global config and the config file
        set_current_value(
            value_name="db-system-id", value=db_system_id,
            profile_name=profile_name, cli_rc_file_path=cli_rc_file_path)

        # Print out that the current DB System was changed
        if interactive:
            if db_system is not None:
                print(f"Current MySQL DB System changed to "
                      f"{db_system.display_name}.\n")
            else:
                print(f"Current MySQL DB System cleared.\n")
    except Exception as e:
        if raise_exceptions:
            raise
        print(f"ERROR: {str(e)}")


@plugin_function('mds.get.currentMysqlDbSystemId')
def get_current_db_system_id(db_system_id=None, config=None, profile_name=None,
                             cli_rc_file_path="~/.oci/oci_cli_rc"):
    """Gets the current db_system_id

    Args:
        db_system_id (str): If specified, returned instead of the current
        config (dict): The config to be used, None defaults to global config
        profile_name (str): The profile_name is already defined
        cli_rc_file_path (str): The location of the OCI CLI config file

    Returns:
        The current DB System ID
    """
    return get_current_value(
        value_name="db-system-id", passthrough_value=db_system_id,
        config=config, profile_name=profile_name,
        cli_rc_file_path=cli_rc_file_path)


@plugin_function('mds.set.currentBastion', shell=True, cli=True, web=True)
def set_current_bastion(**kwargs):
    """Makes the given Bastion the current object

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        bastion_name (str): The name of the bastion
        bastion_id (str): The OCID of the bastion
        compartment_id (str): OCID of the compartment.
        config (object): An OCI config object or None.
        config_profile (str): The name of the profile currently
        profile_name (str): The name of the profile currently in use
        cli_rc_file_path (str): The location of the OCI CLI config file
        raise_exceptions (bool): Whether exceptions should be raised
        interactive (bool): Whether information should be printed
    Returns:
       None
    """

    bastion_name = kwargs.get('bastion_name')
    bastion_id = kwargs.get('bastion_id')
    compartment_id = kwargs.get('compartment_id')
    config = kwargs.get('config')
    config_profile = kwargs.get('config_profile')
    profile_name = kwargs.get('profile_name')
    cli_rc_file_path = kwargs.get('cli_rc_file_path', "~/.oci/oci_cli_rc")
    raise_exceptions = kwargs.get('raise_exceptions', False)
    interactive = kwargs.get("interactive", core.get_interactive_default())

    # Get the active config and compartment
    try:
        config = get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        from mds_plugin import bastion

        # Get bastion, but also allow setting of an empty bastion_id to
        # clean the current bastion
        current_bastion = None
        if bastion_id != '':
            current_bastion = bastion.get_bastion(
                bastion_name=bastion_name, bastion_id=bastion_id,
                compartment_id=compartment_id, config=config,
                ignore_current=True, interactive=interactive,
                return_type=core.RETURN_OBJ)
            bastion_id = current_bastion.id if current_bastion else ""

        # Store the new current value in the global config and the config file
        set_current_value(
            value_name="bastion-id", value=bastion_id,
            profile_name=profile_name, cli_rc_file_path=cli_rc_file_path)

        # Print out that the current bastion was changed
        if interactive:
            if current_bastion:
                print(f"Current Bastion changed to "
                      f"{current_bastion.name}.\n")
            else:
                print(f"Current Bastion cleared.\n")
    except Exception as e:
        if raise_exceptions:
            raise
        print(f"ERROR: {str(e)}")


@plugin_function('mds.get.currentBastionId')
def get_current_bastion_id(bastion_id=None, config=None, profile_name=None,
                           cli_rc_file_path="~/.oci/oci_cli_rc"):
    """Gets the current bastion_id

    Args:
        bastion_id (str): If specified, returned instead of the current
        config (dict): The config to be used, None defaults to global config
        profile_name (str): Name of the config profile
        cli_rc_file_path (str): The location of the OCI CLI config file

    Returns:
        The active bastion_id
    """

    return get_current_value(
        value_name="bastion-id", passthrough_value=bastion_id,
        config=config, profile_name=profile_name,
        cli_rc_file_path=cli_rc_file_path)


@plugin_function('mds.set.currentBucket')
def set_current_bucket(**kwargs):
    """Makes the given DB System the current object

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        bucket_name (str): The name of the bucket
        compartment_id (str): OCID of the compartment
        config (object): An OCI config object or None
        profile_name (str): The name of the profile currently in use
        cli_rc_file_path (str): The location of the OCI CLI config file
        raise_exceptions (bool): Whether exceptions should be raised
        interactive (bool): Whether information should be printed
    Returns:
       None
    """

    bucket_name = kwargs.get('bucket_name')
    compartment_id = kwargs.get('compartment_id')
    config = kwargs.get('config')
    profile_name = kwargs.get('profile_name')
    cli_rc_file_path = kwargs.get('cli_rc_file_path', "~/.oci/oci_cli_rc")
    raise_exceptions = kwargs.get('raise_exceptions', False)
    interactive = kwargs.get('interactive', True)

    # Get the active config and compartment
    try:
        config = get_current_config(config=config)
        compartment_id = get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        from mds_plugin import object_store

        # Get bucket
        bucket = object_store.get_bucket(
            bucket_name=bucket_name,
            compartment_id=compartment_id, config=config,
            ignore_current=True)
        bucket_name = bucket.name if bucket is not None else ""

        # Store the new current value in the global config and in the conf file
        set_current_value(
            value_name="bucket-name", value=bucket_name,
            profile_name=profile_name, cli_rc_file_path=cli_rc_file_path)

        # Print out that the current DB System was changed
        if interactive:
            if bucket_name != "":
                print(
                    f"Current object store bucket changed to {bucket_name}.\n")
            else:
                print(f"Current object store bucket cleared.\n")
    except ValueError as e:
        if raise_exceptions:
            raise
        print(f"ERROR: {str(e)}")


@plugin_function('mds.get.currentBucket')
def get_current_bucket_name(bucket_name=None, config=None, profile_name=None,
                            cli_rc_file_path="~/.oci/oci_cli_rc"):
    """Gets the current bucket

    Args:
        bucket_name (str): If specified, returned instead of the current
        config (dict): The config to be used, None defaults to global config
        profile_name (str): The profile_name is already defined
        cli_rc_file_path (str): The location of the OCI CLI config file

    Returns:
        The current bucket
    """
    return get_current_value(
        value_name="bucket-name", passthrough_value=bucket_name,
        config=config, profile_name=profile_name,
        cli_rc_file_path=cli_rc_file_path)


@plugin_function('mds.set.currentNetwork')
def set_current_network(**kwargs):
    """Makes the given Network the current object

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        network_name (str): The name of the network
        compartment_id (str): OCID of the compartment
        config (object): An OCI config object or None
        profile_name (str): The name of the profile currently in use
        cli_rc_file_path (str): The location of the OCI CLI config file
        raise_exceptions (bool): Whether exceptions should be raised
        interactive (bool): Whether information should be printed
    Returns:
       None
    """

    network_name = kwargs.get('network_name')
    compartment_id = kwargs.get('compartment_id')
    config = kwargs.get('config')
    profile_name = kwargs.get('profile_name')
    cli_rc_file_path = kwargs.get('cli_rc_file_path', "~/.oci/oci_cli_rc")
    raise_exceptions = kwargs.get('raise_exceptions', False)
    interactive = kwargs.get('interactive', True)

    # Get the active config and compartment
    try:
        config = get_current_config(config=config)
        compartment_id = get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        from mds_plugin import network

        # Get bucket
        network = network.get_network(
            network_name=network_name,
            compartment_id=compartment_id, config=config,
            ignore_current=True)
        network_id = network.id if network else ""
        network_name = network.display_name if network and network.display_name \
            else network_id

        # Store the new current value in the global config and in the config file
        set_current_value(
            value_name="network-id", value=network_id,
            profile_name=profile_name, cli_rc_file_path=cli_rc_file_path)

        # Print out that the current DB System was changed
        if interactive:
            if network_id != "":
                print(f"Current network changed to {network_name}.\n")
            else:
                print(f"Current network cleared.\n")
    except Exception as e:
        if raise_exceptions:
            raise
        print(f"ERROR: {str(e)}")


@plugin_function('mds.get.currentNetworkId')
def get_current_network_id(network_id=None, config=None, profile_name=None,
                           cli_rc_file_path="~/.oci/oci_cli_rc"):
    """Gets the current network id

    Args:
        network_id (str): If specified, returned instead of the current
        config (dict): The config to be used, None defaults to global config
        profile_name (str): The profile_name is already defined
        cli_rc_file_path (str): The location of the OCI CLI config file

    Returns:
        The current network_id
    """
    return get_current_value(
        value_name="network-id", passthrough_value=network_id,
        config=config, profile_name=profile_name,
        cli_rc_file_path=cli_rc_file_path)


@plugin_function('mds.set.currentEndpoint')
def set_current_endpoint(endpoint='', **kwargs):
    """Makes the given url the current endpoint

    Args:
        endpoint (str): The URI of the endpoint
        **kwargs: Optional parameters

    Keyword Args:
        config (object): An OCI config object or None
        profile_name (str): The name of the profile currently in use
        cli_rc_file_path (str): The location of the OCI CLI config file
        raise_exceptions (bool): Whether exceptions should be raised
        interactive (bool): Whether information should be printed
    Returns:
       None
    """

    config = kwargs.get('config')
    profile_name = kwargs.get('profile_name')
    cli_rc_file_path = kwargs.get('cli_rc_file_path', "~/.oci/oci_cli_rc")
    raise_exceptions = kwargs.get('raise_exceptions', False)
    interactive = kwargs.get('interactive', True)

    # Get the active config and compartment
    try:
        config = get_current_config(config=config)

        # Store the new current value in the global config and in the config file
        set_current_value(
            value_name="endpoint", value=endpoint,
            profile_name=profile_name, cli_rc_file_path=cli_rc_file_path)

        # Print out that the current DB System was changed
        if interactive:
            if endpoint != "":
                print(f"Current endpoint changed to {endpoint}.\n")
            else:
                print(f"Current endpoint cleared.\n")
    except Exception as e:
        if raise_exceptions:
            raise
        print(f"ERROR: {str(e)}")


@plugin_function('mds.get.currentEndpoint')
def get_current_endpoint(endpoint=None, config=None, profile_name=None,
                         cli_rc_file_path="~/.oci/oci_cli_rc"):
    """Gets the current endpoint

    Args:
        endpoint (str): If specified, returned instead of the current
        config (dict): The config to be used, None defaults to global config
        profile_name (str): The profile_name is already defined
        cli_rc_file_path (str): The location of the OCI CLI config file

    Returns:
        The current endpoint
    """
    return get_current_value(
        value_name="endpoint", passthrough_value=endpoint,
        config=config, profile_name=profile_name,
        cli_rc_file_path=cli_rc_file_path)
