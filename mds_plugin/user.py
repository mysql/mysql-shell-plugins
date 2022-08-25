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

"""Sub-Module to manage OCI Users, Groups and Policies"""

from mysqlsh.plugin_manager import plugin_function
from mds_plugin import core, configuration


def format_user_listing(data):
    import re

    out = ""
    i = 1
    for u in data:
        # Shorten to 40 chars max, remove linebreaks
        description = re.sub(r'[\n\r]', ' ',
                             u.description[:39] + '..'
                             if len(u.description) > 41
                             else u.description)
        # Shorten to 24 chars max, remove linebreaks
        name = re.sub(r'[\n\r]', ' ',
                      u.name[:22] + '..'
                      if len(u.name) > 24
                      else u.name)

        out += f"{i:>4} {name:24} {description:41} {u.lifecycle_state}\n"
        i += 1
    return out


def format_group_listing(data):
    import re

    out = ""
    i = 1
    for g in data:
        # Shorten to 40 chars max, remove linebreaks
        description = re.sub(r'[\n\r]', ' ',
                             g.description[:39] + '..'
                             if len(g.description) > 41
                             else g.description)
        # Shorten to 24 chars max, remove linebreaks
        name = re.sub(r'[\n\r]', ' ',
                      g.name[:22] + '..'
                      if len(g.name) > 24
                      else g.name)

        out += f"{i:>4} {name:24} {description:41} {g.lifecycle_state}\n"
        i += 1
    return out


def format_dynamic_group_listing(data):
    import re

    out = ""
    i = 1
    for g in data:
        # Shorten to 40 chars max, remove linebreaks
        description = re.sub(r'[\n\r]', ' ',
                             g.description[:39] + '..'
                             if len(g.description) > 41
                             else g.description)
        # Shorten to 24 chars max, remove linebreaks
        name = re.sub(r'[\n\r]', ' ',
                      g.name[:22] + '..'
                      if len(g.name) > 24
                      else g.name)

        out += f"{i:>4} {name:24} {description:41} "
        out += f"{g.time_created:%Y-%m-%d %H:%M} {g.lifecycle_state}\n"
        out += f"     {g.matching_rule}\n"
        i += 1
    return out


def format_policy_listing(data):
    """Formats a list of policies into human readable format

    Args:
        data (list): A list of policies

    Returns:
        The formatted string
    """
    import re
    import textwrap

    out = ""
    i = 1
    for p in data:
        # Shorten to max chars, remove linebreaks
        name = re.sub(r'[\n\r]', ' ',
                      p.name[:22] + '..'
                      if len(p.name) > 24
                      else p.name)
        # Shorten to 54 chars max, remove linebreaks
        desc = re.sub(r'[\n\r]', ' ',
                      p.description[:52] + '..'
                      if len(p.description) > 54
                      else p.description)
        time = f"{p.time_created:%Y-%m-%d %H:%M}" \
            if p.time_created is not None else ""
        statements = ""
        for s in p.statements:
            statements += textwrap.fill(
                re.sub(r'[\n\r]', ' ', s), width=93,
                initial_indent=' ' * 5 + '- ',
                subsequent_indent=' ' * 7) + "\n"

        out += (f"{i:>4} {name:24} {desc:54} {time:16} {p.lifecycle_state}\n"
                f"{statements}")
        i += 1
    return out


def get_fingerprint(key):
    from hashlib import md5
    from codecs import decode

    # There should be more error checking here, but to keep the example simple
    # the error checking has been omitted.
    m = md5()

    # Strip out the parts of the key that are not used in the fingerprint
    # computation.
    key = key.replace(b'-----BEGIN PUBLIC KEY-----\n', b'')
    key = key.replace(b'\n-----END PUBLIC KEY-----', b'')

    # The key is base64 encoded and needs to be decoded before getting the md5
    # hash
    decoded_key = decode(key, "base64")
    m.update(decoded_key)
    hash = m.hexdigest()

    # Break the hash into 2 character parts.
    length = 2
    parts = list(hash[0 + i:length + i] for i in range(0, len(hash), length))

    # Join the parts with a colon seperator
    fingerprint = ":".join(parts)

    return fingerprint


def is_key_already_uploaded(keys, fingerprint):
    for key in keys:
        if key.fingerprint == fingerprint:
            return True

    return False


@plugin_function('mds.create.user')
def create_user(**kwargs):
    """Creates a new user

    This function will create a new user.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        name (str): The name of the user.
        description (str): A description for the user.
        email (str): The email of the user
        config (dict): An OCI config dict
        return_object (bool): If the object should be returned

    Returns:
        The user object or None
    """

    name = kwargs.get("name")
    description = kwargs.get("description")
    email = kwargs.get("email")
    config = kwargs.get("config")
    return_object = kwargs.get("return_object", False)

    # Get the current config
    try:
        config = configuration.get_current_config(config=config)
    except ValueError as e:
        print(e)
        return

    import oci.identity
    import mysqlsh

    if name is None:
        name = mysqlsh.globals.shell.prompt(
            "Please enter a name for the new user account: ",
            {'defaultValue': ''}).strip()

        if name == '':
            print("User creation cancelled.")
            return

    if description is None:
        description = mysqlsh.globals.shell.prompt(
            "Please enter a description for the new user account [-]: ",
            {'defaultValue': '-'}).strip()

    # Initialize the identity client
    identity = core.get_oci_identity_client(config=config)

    # Setup the user details
    user_details = oci.identity.models.CreateUserDetails(
        compartment_id=config.get("tenancy"),
        name=name,
        description=description if description is not None else "-",
        email=email
    )

    # Create the compartment
    try:
        user = identity.create_user(user_details).data
    except oci.exceptions.ServiceError as e:
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except (ValueError, oci.exceptions.ClientError) as e:
        print(f'ERROR: {e}')

    # Return the response
    if return_object:
        return user
    else:
        print(f"User {name} created.")


@plugin_function('mds.list.users')
def list_users(config=None, interactive=True, return_formatted=True):
    """Lists users

    Lists all users of a given compartment.

    Args:
        config (object): An OCI config object or None.
        interactive (bool): If set to false exceptions are raised
        return_formatted (bool): If set to true, a list object is returned.

    Returns:
        A list of users
    """

    # Get the current config
    try:
        config = configuration.get_current_config(config=config)
    except ValueError as e:
        print(e)
        return

    import oci.identity

    # Initialize the identity client
    identity = core.get_oci_identity_client(config=config)

    # List the users
    try:
        # Users are always on the tenancy level
        data = identity.list_users(compartment_id=config.get("tenancy")).data

    except oci.exceptions.ServiceError as e:
        if not interactive:
            raise
        if e.code == "NotAuthorizedOrNotFound":
            print(f'You do not have privileges to list users.')
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except (ValueError, oci.exceptions.ClientError) as e:
        if not interactive:
            raise
        print(f'ERROR: {e}')
        return

    if return_formatted:
        return format_user_listing(data)
    else:
        return oci.util.to_dict(data)


@plugin_function('mds.get.user')
def get_user(user_name=None, user_id=None, config=None):
    """Get user object

    Gets user details of a given user account.

    Args:
        user_name (str): The name of the user
        user_id (str): The OCID of the user.
        config (object): An OCI config object or None.

    Returns:
        The user object or None
    """

    # Get the current config
    try:
        config = configuration.get_current_config(config=config)
    except ValueError as e:
        print(e)
        return

    import oci.identity
    import mysqlsh

    # Initialize the identity client
    identity = core.get_oci_identity_client(config=config)

    # If an user_id is given, look up the user directly
    if user_id is not None:
        data = identity.get_user(user_id=user_id).data
        return data

    try:
        # List the users
        data = identity.list_users(compartment_id=config.get("tenancy")).data
    except oci.exceptions.ServiceError as e:
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except Exception as e:
        print(f'ERROR: {e}')
        return

    # Filter out all deleted compartments
    data = [u for u in data if u.lifecycle_state != "DELETED"]

    # If an user_name was given not given, print the user list
    if user_name is None:
        user_list = format_user_listing(data)
        print(f"Users:\n{user_list}")

    # Let the user choose from the list
    user = core.prompt_for_list_item(
        item_list=data, prompt_caption=("Please enter the name or index "
                                        "of the user: "),
        item_name_property="name", given_value=user_name)

    return user


@plugin_function('mds.get.userId')
def get_user_id(user_name=None, config=None):
    """Get user id

    Args:
        user_name (str): The name of the user.
        config (object): An OCI config object or None.

    Returns:
        The OCID of the user
    """

    # Get the current config
    try:
        config = configuration.get_current_config(config=config)
    except ValueError as e:
        print(e)
        return

    # Get user
    user = get_user(user_name=user_name, config=config)

    return None if user is None else user.id


@plugin_function('mds.delete.user')
def delete_user(user_name=None, user_id=None, config=None, interactive=True):
    """Deletes a user

    Args:
        user_name (str): The name of the user.
        user_id (str): The OCID of the user.
        config (object): An OCI config object or None.
        interactive (bool): If set to false, function returns true on success

    Returns:
        None
    """

    # Get the current config
    try:
        config = configuration.get_current_config(config=config)
    except ValueError as e:
        print(e)
        return

    import oci.identity
    import re
    import mysqlsh

    # Get user
    user = get_user(user_name=user_name, user_id=user_id, config=config)
    if user is None:
        print("The user was not found.")
        return

    if interactive:
        # Prompt the user for confirmation
        prompt = mysqlsh.globals.shell.prompt(
            f"Are you sure you want to delete the user {user.name} "
            f"[yes/NO]: ",
            {'defaultValue': 'no'}).strip().lower()
        if prompt != "yes":
            print("Deletion aborted.\n")
            return

    # Initialize the identity client
    identity = core.get_oci_identity_client(config=config)

    # Delete API keys if there are any
    # api_keys = identity.list_api_keys(user.id).data

    try:
        # Remove the user from all groups
        data = identity.list_user_group_memberships(
            compartment_id=config.get("tenancy"), user_id=user.id).data
        for m in data:
            identity.remove_user_from_group(m.id).data

        # Delete the user
        identity.delete_user(user.id)
    except oci.exceptions.ServiceError as e:
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except Exception as e:
        print(f'ERROR: {e}')
        return

    if interactive:
        print("User deleted")
    else:
        return True


@plugin_function('mds.get.group')
def get_group(name=None, group_id=None, config=None):
    """Get group object

    Args:
        name (str): The name of the group
        group_id (str): The OCID of the group
        config (object): An OCI config object or None

    Returns:
        The group object or None
    """

    # Get the current config
    try:
        config = configuration.get_current_config(config=config)

        import oci.identity
        import mysqlsh

        # Initialize the identity client
        identity = core.get_oci_identity_client(config=config)

        # If an user_id is given, look up the user directly
        if group_id is not None:
            data = identity.get_group(group_id=group_id).data
            return data

        # List the groups
        data = identity.list_groups(compartment_id=config.get("tenancy")).data

        # Filter out all deleted compartments
        data = [u for u in data if u.lifecycle_state != "DELETED"]

        # If an name was given not given, print the user list
        if name is None:
            group_list = format_group_listing(data)
            print(f"Groups:\n{group_list}")

        # Let the user choose from the list
        group = core.prompt_for_list_item(
            item_list=data, prompt_caption=("Please enter the name or index "
                                            "of the group: "),
            item_name_property="name", given_value=name)

        return group
    except oci.exceptions.ServiceError as e:
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except Exception as e:
        print(f'ERROR: {e}')
        return


@plugin_function('mds.get.groupId')
def get_group_id(name=None, config=None):
    """Get group id

    Args:
        name (str): The name of the group.
        config (object): An OCI config object or None.

    Returns:
        The OCID of the user
    """

    # Get the current config
    try:
        config = configuration.get_current_config(config=config)
    except ValueError as e:
        print(e)
        return

    # Get user
    group = get_group(name=name, config=config)

    return None if group is None else group.id


@plugin_function('mds.list.groupUsers')
def list_group_users(name=None, group_id=None, config=None,
                     interactive=True, return_formatted=True):
    """lists the members of a given group
    Args:
        name (str): The name of the group
        group_id (str): The OCID of the group
        config (object): An OCI config object or None.
        interactive (bool): If set to false exceptions are raised
        return_formatted (bool): If set to true, a list object is returned.

    Returns:
        The user account details
    """

    # Get the current config
    try:
        config = configuration.get_current_config(config=config)
    except ValueError as e:
        print(e)
        return

    import oci.identity
    import re

    group = get_group(name=name, group_id=group_id, config=config)
    if group is None:
        print("Operation cancelled.")
        return

    # Initialize the identity client
    identity = core.get_oci_identity_client(config=config)

    try:
        # List the users of the given group
        data = identity.list_user_group_memberships(
            compartment_id=config.get("tenancy"), group_id=group.id).data

        users = []
        for m in data:
            if return_formatted:
                users.append(identity.get_user(user_id=m.user_id).data)
            else:
                users.append(oci.util.to_dict(
                    identity.get_user(user_id=m.user_id).data))

        if return_formatted:
            if len(users) > 0:
                print(f"Users in group {group.name}:")
                print(format_user_listing(users))
            else:
                print("No users in this group.")
        else:
            return users
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


@plugin_function('mds.list.groups')
def list_groups(config=None, interactive=True, return_formatted=True):
    """Lists groups

    Lists all groups of the tenancy

    Args:
        config (object): An OCI config object or None.
        interactive (bool): If set to false exceptions are raised
        return_formatted (bool): If set to true, a list object is returned.

    Returns:
        A list of groups
    """

    # Get the current config
    try:
        config = configuration.get_current_config(config=config)

        import oci.identity

        # Initialize the identity client
        identity = core.get_oci_identity_client(config=config)

        # List the groups
        data = identity.list_groups(compartment_id=config.get("tenancy")).data

        if return_formatted:
            return format_group_listing(data)
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


@plugin_function('mds.delete.group')
def delete_group(name=None, group_id=None, config=None, interactive=True):
    """Deletes a user

    Args:
        name (str): The name of the group.
        group_id (str): The OCID of the group.
        config (object): An OCI config object or None.
        interactive (bool): If set to false, function returns true on success

    Returns:
        None
    """

    # Get the current config
    try:
        config = configuration.get_current_config(config=config)
    except ValueError as e:
        print(e)
        return

    import oci.identity
    import re
    import mysqlsh

    # Get user
    group = get_group(name=name, group_id=group_id, config=config)
    if group is None:
        print("The group was not found.")
        return

    if interactive:
        # Prompt the user for confirmation
        prompt = mysqlsh.globals.shell.prompt(
            f"Are you sure you want to delete the Group {group.name} "
            f"[yes/NO]: ",
            {'defaultValue': 'no'}).strip().lower()
        if prompt != "yes":
            print("Deletion aborted.\n")
            return

    # Initialize the identity client
    identity = core.get_oci_identity_client(config=config)

    try:
        identity.delete_group(group.id)
    except oci.exceptions.ServiceError as e:
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except Exception as e:
        print(f'ERROR: {e}')
        return

    if interactive:
        print("Group deleted")
    else:
        return True


@plugin_function('mds.create.userUiPassword')
def create_user_ui_password(user_name=None, user_id=None, config=None,
                            raise_exceptions=True):
    """Creates or resets the UI password of the user

    Args:
        user_name (str): The name of the user
        user_id (str): The OCID of the user
        config (object): An OCI config object or None.
        raise_exceptions (bool): If set to false exceptions are raised

    Returns:
        The API Keys of the user
    """
    # Get the current config
    try:
        config = configuration.get_current_config(config=config)

        import oci.identity

        # Get the user object
        user = get_user(user_name=user_name, user_id=user_id, config=config)
        if user is None:
            print("User not found. Operation cancelled.")
            return

        # Initialize the identity client
        identity = core.get_oci_identity_client(config=config)

        ui_password = identity.create_or_reset_ui_password(
            user_id=user.id).data

        tenancy = identity.get_tenancy(config.get("tenancy")).data

        print("\nThe OCI UI Console one-time password for user "
              f"'{user.name}' has been created.\n"
              "The user can now log in at the following URL:\n"
              f"    https://console.{config.get('region')}.oraclecloud.com/?"
              f"tenant={tenancy.name}\n\n"
              "Oracle Cloud Infrastructure Login Information:\n\n"
              f"TENANT\n{tenancy.name}\n\n"
              f"USER NAME\n{user.name}\n\n"
              "PASSWORD")

        return ui_password.password

    except oci.exceptions.ServiceError as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except (ValueError, oci.exceptions.ClientError) as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')


@plugin_function('mds.list.userApiKeys')
def list_user_api_keys(user_name=None, user_id=None, config=None,
                       interactive=True, return_formatted=True):
    """Lists the API Keys of the user

    Args:
        user_name (str): The name of the user
        user_id (str): The OCID of the user
        config (object): An OCI config object or None.
        interactive (bool): If set to false exceptions are raised
        return_formatted (bool): If set to true, a list object is returned.

    Returns:
        The API Keys of the user
    """

    # Get the current config
    try:
        config = configuration.get_current_config(config=config)
    except ValueError as e:
        print(e)
        return

    import oci.identity

    user = get_user(user_name=user_name, user_id=user_id, config=config)
    if user is None:
        print("Operation cancelled.")
        return

    # Initialize the identity client
    identity = core.get_oci_identity_client(config=config)

    # List the users
    try:
        api_keys = identity.list_api_keys(user.id).data
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

    if return_formatted:
        out = ""
        i = 1
        for k in api_keys:
            out += (f"{i:>4} {k.fingerprint:49} "
                    f"{k.time_created:%Y-%m-%d %H:%M} {k.lifecycle_state}\n")
            i += 1

        return out
    else:
        return oci.util.to_dict(api_keys)


@plugin_function('mds.create.userApiKey')
def create_user_api_key(user_name=None, key_path="~/.oci/", user_id=None,
                        key_file_prefix="oci_api_key",
                        config=None, write_to_disk=True, return_object=False,
                        interactive=True):
    """Creates an API key for a user

    Args:
        user_name (str): The name of the user
        key_path (str): The path where the key files should be created
        user_id (str): The OCID of the user.
        key_file_prefix (str): A key_file_prefix to use
        config (dict): An OCI config object or None.
        write_to_disk (bool): Whether the keys should be written to disk
        return_object (bool): Whether the keys should be returned
        interactive (bool): Whether to query the user for input

    Returns:
        The user account details
    """

    # Get the current config
    try:
        if interactive or user_name is not None or user_id is not None:
            config = configuration.get_current_config(config=config)
    except ValueError as e:
        print(e)
        return

    import oci.identity
    import time
    import os.path
    from pathlib import Path

    # Get the user object
    user = None
    if interactive or user_name is not None or user_id is not None:
        user = get_user(user_name=user_name, user_id=user_id, config=config)
        if user is None:
            print("User not found.")
            return

    # Generate the API Keys
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives.asymmetric import rsa

    key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )

    private_key = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption())

    public_key = key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo
    )

    # Create path
    # Convert Unix path to Windows
    key_path = os.path.abspath(os.path.expanduser(key_path))
    Path(key_path).mkdir(parents=True, exist_ok=True)

    # Create filenames for keys
    user_key_file_caption = f'_{user.name}' if user else ''
    private_key_path = os.path.join(
        key_path, f"{key_file_prefix}{user_key_file_caption}.pem")
    public_key_path = os.path.join(
        key_path, f"{key_file_prefix}{user_key_file_caption}_public.pem")

    # Write out keys
    if write_to_disk is True:
        with open(private_key_path, mode='wb') as file:
            file.write(private_key)
        with open(public_key_path, mode='wb') as file:
            file.write(public_key)

    # Get the fingerprint for the key
    fingerprint = get_fingerprint(public_key)

    # If a use was selected, upload the key
    if user:
        # Initialize the identity client
        identity = core.get_oci_identity_client(config=config)

        # Check to see if this key is already associated with the user.
        if is_key_already_uploaded(identity.list_api_keys(
                user.id).data, fingerprint):
            print(f"Key with fingerprint {fingerprint} has already been "
                  f"added to the user")
            return

        # Initialize the CreateApiKeyDetails model
        key_details = oci.identity.models.CreateApiKeyDetails(
            key=public_key.decode())

        # Upload the key
        identity.upload_api_key(user.id, key_details)

        i = 0
        key_uploaded = False
        while not key_uploaded and i < 30:
            key_uploaded = is_key_already_uploaded(identity.list_api_keys(
                user.id).data, fingerprint)
            if key_uploaded:
                break
            time.sleep(2)
            i += 1

        if not key_uploaded:
            print("The key uploaded failed.")
            return

    if return_object:
        return {
            "private_key": private_key,
            "public_key": public_key,
            "fingerprint": fingerprint}


@plugin_function('mds.delete.userApiKey')
def delete_user_api_key(user_name=None, user_id=None,
                        key_path="~/.oci/",
                        key_file_prefix="oci_api_key",
                        key_id=None,
                        fingerprint=None,
                        delete_from_disk=False,
                        config=None,
                        interactive=True):
    """Deletes an API key for a user

    Args:
        user_name (str): The name of the user
        user_id (str): The OCID of the user.
        key_path (str): The path where the key files should be created
        key_file_prefix (str): A key_file_prefix to use
        key_id (str): The key identifier to delete
        fingerprint (str): The fingerprint of the key to delete
        delete_from_disk (bool): Wether to delete the key files from disk
        config (dict): An OCI config object or None.
        interactive (bool): Whether to query the user for input

    Returns:
        True if the key was delete, else False
    """

    # Get the current config
    try:
        if interactive or user_name is not None or user_id is not None:
            config = configuration.get_current_config(config=config)
    except ValueError as e:
        print(e)
        return False

    import os.path
    import os
    from pathlib import Path

    # Get the user object
    user = None
    if interactive or user_name is not None or user_id is not None:
        user = get_user(user_name=user_name, user_id=user_id, config=config)

    if user is None:
        print("User not found.")
        return False

    fingerprint_to_delete=fingerprint
    if fingerprint_to_delete is None:
        keys = list_user_api_keys(user_name=user.name, interactive=interactive, return_formatted=False)

        if interactive:
            keys_formatted = list_user_api_keys(user_name=user.name, interactive=interactive, return_formatted=True)
            print(keys_formatted)
            selected_key = core.prompt_for_list_item(
                item_list=keys, prompt_caption=("Please enter the name or index "
                                                "of the key to delete: "),
                item_name_property="key")

            print(selected_key)

            fingerprint_to_delete = selected_key['fingerprint']
        elif key_id is not None:
            for key in keys:
                if key['id'] == key_id:
                    fingerprint_to_delete = key['fingerprint']

    if fingerprint_to_delete is None:
        print('Invalid key fingerprint')
        return False


    # Create path
    # Convert Unix path to Windows
    key_path = os.path.abspath(os.path.expanduser(key_path))
    Path(key_path).mkdir(parents=True, exist_ok=True)

    # Create filenames for keys
    # user_key_file_caption = f'_{user.name}' if user else ''
    # private_key_path = os.path.join(
    #     key_path, f"{key_file_prefix}{user_key_file_caption}.pem")
    # public_key_path = os.path.join(
    #     key_path, f"{key_file_prefix}{user_key_file_caption}_public.pem")

    # from cryptography.hazmat.primitives import serialization
    # from cryptography.hazmat.backends import default_backend

    # with open(public_key_path, mode='r') as file:
    #     key = file.read().encode()

    # public_key = serialization.load_pem_public_key(data=key) # , backend=default_backend()

    # Get the fingerprint for the key
    # fingerprint = get_fingerprint(public_key.public_bytes(
    #     serialization.Encoding.PEM,
    #     serialization.PublicFormat.SubjectPublicKeyInfo
    # ))

    if delete_from_disk:
        user_key_file_caption = f'_{user.name}' if user else ''
        private_key_path = os.path.join(
            key_path, f"{key_file_prefix}{user_key_file_caption}.pem")
        public_key_path = os.path.join(
            key_path, f"{key_file_prefix}{user_key_file_caption}_public.pem")
        os.remove(private_key_path)
        os.remove(public_key_path)

    # Initialize the identity client
    identity = core.get_oci_identity_client(config=config)

    print(identity.list_api_keys(user.id).data)

    key_uploaded = is_key_already_uploaded(identity.list_api_keys(
                user.id).data, fingerprint_to_delete)

    print(f"key uploaded: {key_uploaded}")

    if not key_uploaded:
        print("key not uploaded")
        return False

    identity.delete_api_key(user_id=user.id, fingerprint=fingerprint_to_delete)

    return True

@plugin_function('mds.create.group')
def create_group(group_name=None, description=None, config=None,
                 return_object=False):
    """Creates a new group

    Args:
        group_name (str): The name of the group.
        description (str): A description used for the new compartment.
        config (dict): An OCI config dict
        return_object (bool): If the object should be returned

    Returns:
        The group object or None
    """

    # Get the current config
    try:
        config = configuration.get_current_config(config=config)
    except ValueError as e:
        print(e)
        return

    import oci.identity
    import mysqlsh

    # Initialize the identity client
    identity = core.get_oci_identity_client(config=config)

    if group_name is None:
        group_name = mysqlsh.globals.shell.prompt(
            "Please enter a name for the new group: ",
            {'defaultValue': ''}).strip()

        if group_name == '':
            print("Operation cancelled.")
            return

    if description is None:
        description = mysqlsh.globals.shell.prompt(
            "Please enter a description for the new group [-]: ",
            {'defaultValue': '-'}).strip()

    # Setup the user details
    group_details = oci.identity.models.CreateGroupDetails(
        compartment_id=config.get("tenancy"),
        name=group_name,
        description=description if description is not None else "-"
    )

    # Create the group
    try:
        group = identity.create_group(group_details).data
    except oci.exceptions.ServiceError as e:
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except (ValueError, oci.exceptions.ClientError) as e:
        print(f'ERROR: {e}')

    # Return the response
    if return_object:
        return group
    else:
        print(f"Group {group_name} created.")


@plugin_function('mds.create.userGroupMembership')
def add_user_to_group(user_name=None, group_name=None, user_id=None,
                      group_id=None, config=None, return_object=False):
    """Adds a user to a group

    Args:
        user_name (str): The name of the user.
        group_name (str): The name of the group.
        user_id (str): The OCID of the user
        group_id (str): The OCID of the group
        config (object): An OCI config object or None.
        return_object (bool): If the object should be returned

    Returns:
        The membership object or None
    """

    # Get the current config
    try:
        config = configuration.get_current_config(config=config)
    except ValueError as e:
        print(e)
        return

    import oci.identity

    # Get user
    user = get_user(user_name=user_name, user_id=user_id, config=config)
    if user is None:
        print("Operation cancelled.")
        return
    user_name = user.name

    # Get user
    group = get_group(name=group_name, group_id=group_id, config=config)
    if group is None:
        print("Operation cancelled.")
        return

    # Create Details
    details = oci.identity.models.AddUserToGroupDetails(
        group_id=group.id,
        user_id=user.id
    )
    group_name = group.name

    # Initialize the identity client
    identity = core.get_oci_identity_client(config=config)

    # Add the user to the group
    try:
        membership = identity.add_user_to_group(details).data
    except oci.exceptions.ServiceError as e:
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except (ValueError, oci.exceptions.ClientError) as e:
        print(f'ERROR: {e}')

    # Return the response
    if return_object:
        return membership
    else:
        print(f"User {user_name} was added to {group_name}.")


@plugin_function('mds.delete.userGroupMembership')
def delete_user_group_membership(user_name=None, group_name=None, user_id=None,
                                 group_id=None, config=None, interactive=True):
    """Removes a user from a group

    Args:
        user_name (str): The name of the user.
        group_name (str): The name of the group.
        user_id (str): The OCID of the user
        group_id (str): The OCID of the group
        config (object): An OCI config object or None.
        interactive (bool): If the True should be returned on success

    Returns:
        The membership object or None
    """

    # Get the current config
    try:
        config = configuration.get_current_config(config=config)
    except ValueError as e:
        print(e)
        return

    import oci.identity

    # Get user
    user = get_user(user_name=user_name, user_id=user_id, config=config)
    if user is None:
        print("Operation cancelled.")
        return

    # Get user
    group = get_group(name=group_name, group_id=group_id, config=config)
    if group is None:
        print("Operation cancelled.")
        return

    # Initialize the identity client
    identity = core.get_oci_identity_client(config=config)

    try:
        # List the groups of the given user
        data = identity.list_user_group_memberships(
            compartment_id=config.get("tenancy"), user_id=user.id).data

        group_found = False

        for m in data:
            # If the right group was found, remove the membership
            if m.group_id == group.id:
                identity.remove_user_from_group(m.id).data
                group_found = True
                break

        if not group_found:
            if interactive:
                print(f"User {user.name} is not a member of {group.name}.")
            return

    except oci.exceptions.ServiceError as e:
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except (ValueError, oci.exceptions.ClientError) as e:
        print(f'ERROR: {e}')

    # Return the response
    if interactive:
        print(f"User {user.name} was removed from {group.name}.")
    else:
        return True


@plugin_function('mds.create.policy')
def create_policy(policy_name=None, description=None, statements=None,
                  compartment_id=None, config=None, return_object=False):
    """Creates a new policy

    Args:
        policy_name (str): The name of the policy.
        statements (str): A list of statements separated by
        description (str): A description used for the new compartment.
        compartment_id (str): The OCID of the compartment
        config (dict): An OCI config dict
        return_object (bool): If the object should be returned

    Returns:
        The group object or None
    """

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
    except ValueError as e:
        print(f"ERROR: {str(e)}")
        return

    import oci.identity
    import mysqlsh

    if policy_name is None:
        policy_name = mysqlsh.globals.shell.prompt(
            "Please enter a name for the new policy: ",
            {'defaultValue': ''}).strip()

        if policy_name == '':
            print("Operation cancelled.")
            return

    if description is None:
        description = mysqlsh.globals.shell.prompt(
            "Please enter a description for the new policy [-]: ",
            {'defaultValue': '-'}).strip()

    if statements is None:
        statements = ""
        print("Please enter the policy statements.\nPress [Enter] after each "
              "statement and leave a statement empty to finish the input.\n")
        stmt = "-"
        while stmt:
            stmt = mysqlsh.globals.shell.prompt(
                "Statement: ",
                {'defaultValue': ''}).strip()
            if stmt:
                statements += stmt + '\n'

        if statements == '':
            print("Operation cancelled.")
            return

    statement_list = statements.split("\n")
    # Remove the empty statement at the end
    del statement_list[-1]

    # Initialize the identity client
    identity = core.get_oci_identity_client(config=config)

    # Setup the policy details
    policy_details = oci.identity.models.CreatePolicyDetails(
        compartment_id=compartment_id,
        name=policy_name,
        description=description if description is not None else "-",
        statements=statement_list
    )

    # Create the policy
    try:
        group = identity.create_policy(policy_details).data
    except oci.exceptions.ServiceError as e:
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except (ValueError, oci.exceptions.ClientError) as e:
        print(f'ERROR: {e}')

    # Return the response
    if return_object:
        return group
    else:
        print(f"Policy {policy_name} created.")


@plugin_function('mds.list.policies')
def list_policies(compartment_id=None, config=None, interactive=True,
                  return_formatted=True):
    """Lists policies

    Lists all policies of the given compartment

    Args:
        compartment_id (str): OCID of the compartment
        config (object): An OCI config object or None.
        interactive (bool): If set to false exceptions are raised
        return_formatted (bool): If set to true, a list object is returned.

    Returns:
        A list of groups
    """

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
    except ValueError as e:
        print(f"ERROR: {str(e)}")
        return

    import oci.identity
    import mysqlsh

    # Initialize the identity client
    identity = core.get_oci_identity_client(config=config)

    try:
        # List the policies
        data = identity.list_policies(compartment_id=compartment_id).data
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

    if return_formatted:
        return format_policy_listing(data)
    else:
        return oci.util.to_dict(data)


@plugin_function('mds.get.policy')
def get_policy(policy_name=None, policy_id=None, compartment_id=None,
               config=None):
    """Get policy object

    Args:
        policy_name (str): The name of the policy
        policy_id (str): The OCID of the policy.
        compartment_id (str): The OCID of the compartment.
        config (object): An OCI config object or None.

    Returns:
        The policy object or None
    """

    # Get the current config
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
    except ValueError as e:
        print(e)
        return

    import oci.identity
    import mysqlsh

    # Initialize the identity client
    identity = core.get_oci_identity_client(config=config)

    # If an policy_id is given, look up the user directly
    if policy_id is not None:
        data = identity.get_policy(policy_id=policy_id).data
        return data

    try:
        # List the users
        data = identity.list_policies(compartment_id=compartment_id).data
    except oci.exceptions.ServiceError as e:
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except Exception as e:
        print(f'ERROR: {e}')
        return

    # Filter out all deleted compartments
    data = [u for u in data if u.lifecycle_state != "DELETED"]

    # If an name was given not given, print the user list
    if policy_name is None:
        item_list = format_policy_listing(data)
        print(f"Policies:\n{item_list}")

    # Let the user choose from the list
    policy = core.prompt_for_list_item(
        item_list=data, prompt_caption=("Please enter the name or index "
                                        "of the policy: "),
        item_name_property="name", given_value=policy_name)

    return policy


@plugin_function('mds.get.policyId')
def get_policy_id(policy_name=None, compartment_id=None, config=None):
    """Get the policy id

    Args:
        policy_name (str): The name of the user.
        compartment_id (str): The OCID of the compartment
        config (object): An OCI config object or None.

    Returns:
        The OCID of the policy
    """

    # Get the current config
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
    except ValueError as e:
        print(e)
        return

    # Get user
    policy = get_policy(
        policy_name=policy_name, compartment_id=compartment_id, config=config)

    return None if policy is None else policy.id


@plugin_function('mds.delete.policy')
def delete_policy(policy_name=None, policy_id=None, compartment_id=None,
                  config=None, interactive=True):
    """Deletes a policy

    Args:
        policy_name (str): The name of the policy.
        policy_id (str): The OCID of the policy.
        compartment_id (str): The OCID of the compartment
        config (object): An OCI config object or None.
        interactive (bool): If set to false, function returns true on success

    Returns:
        None
    """

    # Get the current config
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        import oci.identity
        import re
        import mysqlsh

        # Get policy
        if policy_name != "*":
            policy = get_policy(policy_name=policy_name, policy_id=policy_id,
                                config=config)
            if policy is None:
                print("The policy was not found.")
                return

        if interactive:
            if policy_name != "*":
                what_to_delete = f"the policy {policy.name}"
            else:
                what_to_delete = "all policies"
            prompt = mysqlsh.globals.shell.prompt(
                f"Are you sure you want to delete {what_to_delete} "
                f"[yes/NO]: ",
                {'defaultValue': 'no'}).strip().lower()
            if prompt != "yes":
                print("Deletion aborted.\n")
                return

        # Initialize the identity client
        identity = core.get_oci_identity_client(config=config)

        if policy_name == "*":
            # List the policies
            data = identity.list_policies(compartment_id=compartment_id).data
            for p in data:
                identity.delete_policy(p.id)
        else:
            identity.delete_policy(policy.id)

        if interactive:
            # cSpell:ignore Polic
            print(f"Polic{'y' if policy_name != '*' else 'ies'} deleted.")
        else:
            return True
    except oci.exceptions.ServiceError as e:
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except Exception as e:
        print(f'ERROR: {e}')
        return


@plugin_function('mds.create.dynamicGroup')
def create_dynamic_group(name=None, **kwargs):
    """Creates a new dynamic group

    Args:
        name (str): The name of the dynamic group.
        **kwargs: Additional options

    Keyword Args:
        description (str): A description used for the new dynamic group.
        defined_tags (dict): The defined_tags of the dynamic group.
        freeform_tags (dict): The freeform_tags of the dynamic group
        config (dict): An OCI config dict.
        compartment_id (str): An OCID of the compartment to use.
        interactive (bool): Whether user interaction should be performed.
        raise_exceptions (bool): If set to true exceptions are raised.
        return_object (bool): If the object should be returned.

    Returns:
        The group object or None
    """

    description = kwargs.get("description")
    matching_rule = kwargs.get("matching_rule")
    defined_tags = kwargs.get("defined_tags")
    # Manual conversion from Shell Dict type until this is automatically done
    if defined_tags:
        defined_tags = dict(defined_tags)
    freeform_tags = kwargs.get("freeform_tags")
    # Manual conversion from Shell Dict type until this is automatically done
    if freeform_tags:
        freeform_tags = dict(freeform_tags)
    config = kwargs.get("config")
    compartment_id = kwargs.get("compartment_id")
    interactive = kwargs.get("interactive", True)
    raise_exceptions = kwargs.get("raise_exceptions", False)
    return_object = kwargs.get("return_object", False)

    # Get the current config
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        import oci.identity
        import mysqlsh
        from mds_plugin import compartment, compute

        # Initialize the identity client
        identity = core.get_oci_identity_client(config=config)

        if name is None and interactive:
            name = mysqlsh.globals.shell.prompt(
                "Please enter a name for the new dynamic group: ",
                {'defaultValue': ''}).strip()
        if name == '':
            print("No name given. Operation cancelled.")
            return

        if description is None and interactive:
            description = mysqlsh.globals.shell.prompt(
                "Please enter a description for the new dynamic group [-]: ",
                {'defaultValue': '-'}).strip()

        # If no matching_rule was given, start a simple rule builder
        if matching_rule is None and interactive:
            current_path = compartment.get_compartment_full_path(
                compartment_id=compartment_id,
                config=config,
                interactive=interactive)
            print("Please specify which compute instances should be included "
                  "in this dynamic group.\n")
            match_list = [
                f"All instances of the current compartment '{current_path}'",
                "All instances of the current compartment with a special tag",
                "All instances of the tenancy with a special tag",
                "One specific instance"
            ]
            matching_rule = core.prompt_for_list_item(
                item_list=match_list,
                prompt_caption="Please enter an index or a custom matching rule: ",
                prompt_default_value='',
                print_list=True)
            if not matching_rule:
                print("Operation cancelled.")
                return

            if matching_rule == match_list[1] or matching_rule == match_list[2]:
                print("Please use the following format to specify the tag to "
                      "match against.\n"
                      "    <tagnamespace>.<tagkey>            "
                      "Example:department.operations\nor\n"
                      "    <tagnamespace>.<tagkey>=<value>    "
                      "Example:department.operations=45\n")
                prompt = mysqlsh.globals.shell.prompt(
                    "Please enter the tag to match against: ",
                    {'defaultValue': ''}).strip().lower()

                # Get tag into proper format
                if "=" in prompt:
                    tag = "tag." + prompt.replace("=", ".value='") + "'"
                else:
                    tag = f"tag.{prompt}.value"

                if matching_rule == match_list[1]:
                    matching_rule = ("All {"
                                     f"instance.compartment.id = '{compartment_id}', {tag}"
                                     "}")
                else:
                    matching_rule = tag

            elif matching_rule == match_list[0]:
                # Match the current compartment
                matching_rule = f"instance.compartment.id = '{compartment_id}'"
            elif matching_rule == match_list[3]:
                # Match a specific instance
                instance_id = compute.get_instance_id(
                    compartment_id=compartment_id, config=config,
                    interactive=interactive)
                if not instance_id:
                    print("Operation cancelled.")
                    return
                matching_rule = f"instance.id = '{instance_id}'"

        if matching_rule is None:
            print("No matching_rule given. Operation cancelled.")
            return

        # Setup the details
        details = oci.identity.models.CreateDynamicGroupDetails(
            compartment_id=config.get("tenancy"),
            name=name,
            description=description if description else "-",
            matching_rule=matching_rule,
            defined_tags=defined_tags,
            freeform_tags=freeform_tags
        )

        # Create the group
        group = identity.create_dynamic_group(details).data

        # Return the response
        if return_object:
            return group
        else:
            print(f"Dynamic group {name} created.")

    except oci.exceptions.ServiceError as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except (ValueError, oci.exceptions.ClientError) as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')


@plugin_function('mds.list.dynamicGroups')
def list_dynamic_groups(compartment_id=None, config=None,
                        raise_exceptions=False, return_formatted=True):
    """Lists dynamic groups

    Lists all dynamic groups of the compartment

    Args:
        compartment_id (str): An OCID of the compartment to use.
        config (object): An OCI config object or None.
        raise_exceptions (bool): If set to true exceptions are raised.
        return_formatted (bool): If set to true a list object is returned.

    Returns:
        A list of groups
    """

    # Get the current config
    try:
        config = configuration.get_current_config(config=config)

        import oci.identity

        # Initialize the identity client
        identity = core.get_oci_identity_client(config=config)

        # List the groups
        data = identity.list_dynamic_groups(
            compartment_id=config.get("tenancy")).data

        if return_formatted:
            return format_dynamic_group_listing(data)
        else:
            return oci.util.to_dict(data)
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


@plugin_function('mds.get.dynamicGroup')
def get_dynamic_group(name=None, dynamic_group_id=None, config=None):
    """Get dynamic group

    Gets a dynamic group

    Args:
        name (str): The name of the dynamic group
        dynamic_group_id (str): The OCID of the dynamic group
        config (object): An OCI config object or None

    Returns:
        The user object or None
    """

    # Get the current config
    try:
        config = configuration.get_current_config(config=config)

        import oci.identity
        import mysqlsh

        # Initialize the identity client
        identity = core.get_oci_identity_client(config=config)

        # If an dynamic_group_id is given, look up the dynamic_group directly
        if dynamic_group_id is not None:
            data = identity.get_dynamic_group(
                dynamic_group_id=dynamic_group_id).data
            return data

        # List the groups
        data = identity.list_dynamic_groups(
            compartment_id=config.get("tenancy")).data

        # Filter out all deleted compartments
        data = [u for u in data if u.lifecycle_state != "DELETED"]

        # If an name was given not given, print the list
        if name is None:
            group_list = format_dynamic_group_listing(data)
            print(f"Groups:\n{group_list}")

        # Let the user choose from the list
        group = core.prompt_for_list_item(
            item_list=data, prompt_caption=("Please enter the name or index "
                                            "of the dynamic group: "),
            item_name_property="name", given_value=name)

        return group
    except oci.exceptions.ServiceError as e:
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except Exception as e:
        print(f'ERROR: {e}')
        return


@plugin_function('mds.get.dynamicGroupId')
def get_dynamic_group_id(name=None, config=None):
    """Get group id

    Args:
        name (str): The name of the group.
        config (object): An OCI config object or None.

    Returns:
        The OCID of the user
    """

    # Get the current config
    try:
        config = configuration.get_current_config(config=config)

        # Get group
        group = get_dynamic_group(name=name, config=config)

        return None if group is None else group.id
    except ValueError as e:
        print(e)
        return


@plugin_function('mds.delete.dynamicGroup')
def delete_dynamic_group(name=None, dynamic_group_id=None, config=None,
                         interactive=True):
    """Deletes a user

    Args:
        name (str): The name of the group.
        dynamic_group_id (str): The OCID of the group.
        config (object): An OCI config object or None.
        interactive (bool): If set to false, function returns true on success

    Returns:
        None
    """

    # Get the current config
    try:
        config = configuration.get_current_config(config=config)
    except ValueError as e:
        print(e)
        return

    import oci.identity
    import re
    import mysqlsh

    # Get user
    group = get_dynamic_group(
        name=name, dynamic_group_id=dynamic_group_id, config=config)
    if group is None:
        print("The group was not found.")
        return

    if interactive:
        # Prompt the user for confirmation
        prompt = mysqlsh.globals.shell.prompt(
            f"Are you sure you want to delete the dynamic group '{group.name}' "
            f"[yes/NO]: ",
            {'defaultValue': 'no'}).strip().lower()
        if prompt != "yes":
            print("Deletion aborted.\n")
            return

    # Initialize the identity client
    identity = core.get_oci_identity_client(config=config)

    try:
        identity.delete_dynamic_group(group.id)
    except oci.exceptions.ServiceError as e:
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except Exception as e:
        print(f'ERROR: {e}')
        return

    if interactive:
        print("Dynamic group deleted.")
    else:
        return True
