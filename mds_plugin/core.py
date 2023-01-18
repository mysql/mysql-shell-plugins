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

"""Sub-Module for core functions"""

from mysqlsh.plugin_manager import plugin_function
import mysqlsh


RETURN_STR = "STR"
RETURN_DICT = "DICT"
RETURN_OBJ = "OBJ"


def get_interactive_default():
    """Returns the default of the interactive mode

    Returns:
        The global shell setting of options.useWizards
    """
    import mysqlsh

    return mysqlsh.globals.shell.options.useWizards


def prompt_for_list_item(item_list, prompt_caption, prompt_default_value='',
                         item_name_property=None, given_value=None,
                         print_list=False, allow_multi_select=False):
    """Lets the use choose and item from a list

    When prompted, the user can either provide the index of the item or the
    name of the item.

    If given_value is provided, it will be checked against the items in the list
    instead of prompting the user for a new value

    Args:
        item_list (list): The list of items to choose from
        prompt_caption (str): The caption of the prompt that will be displayed
        prompt_default_value (str): The default_value for the prompt
        item_name_property (str): The name of the property that is used to
            compare with the user input
        given_value (str): Value that the user provided beforehand.
        print_list (bool): Specifies whether the list of items should be printed
        allow_multi_select (bool): Whether multiple items can be entered, 
            separated by ',' and the string '*' is allowed

    Returns:
        The selected item or the selected item list when allow_multi_select is 
        True or None when the user cancelled the selection
    """

    import mysqlsh

    # If a given_value was provided, check this first instead of prompting the
    # user
    if given_value:
        given_value = given_value.lower()
        selected_item = None
        for item in item_list:
            if item_name_property is not None:
                if type(item) == dict:
                    item_name = item.get(item_name_property)
                else:
                    item_name = getattr(item, item_name_property)
            else:
                item_name = item

            if item_name.lower() == given_value:
                selected_item = item
                break

        return selected_item

    if print_list:
        i = 1
        for item in item_list:
            if item_name_property:
                if type(item) == dict:
                    item_caption = item.get(item_name_property)
                else:
                    item_caption = getattr(item, item_name_property)
            else:
                item_caption = item
            print(f"{i:>4} {item_caption}")
            i += 1
        print()

    selected_items = []

    # Let the user choose from the list
    while len(selected_items) == 0:
        # Prompt the user for specifying an item
        prompt = mysqlsh.globals.shell.prompt(
            prompt_caption, {'defaultValue': prompt_default_value}
        ).strip().lower()

        if prompt == '':
            return None
        # If the user typed '*', return full list
        if allow_multi_select and prompt == "*":
            return item_list

        if allow_multi_select:
            prompt_items = prompt.split(',')
        else:
            prompt_items = [prompt]

        try:
            for prompt in prompt_items:
                try:
                    # If the user provided an index, try to map that to an item
                    nr = int(prompt)
                    if nr > 0 and nr <= len(item_list):
                        selected_items.append(item_list[nr - 1])
                    else:
                        raise IndexError
                except ValueError:
                    # Search by name
                    selected_item = None
                    for item in item_list:
                        if item_name_property is not None:
                            if type(item) == dict:
                                item_name = item.get(item_name_property)
                            else:
                                item_name = getattr(item, item_name_property)
                        else:
                            item_name = item

                        if item_name.lower() == prompt:
                            selected_item = item
                            break

                    if selected_item is None:
                        raise ValueError
                    else:
                        selected_items.append(selected_item)

        except (ValueError, IndexError):
            msg = f'The item {prompt} was not found. Please try again'
            if prompt_default_value == "":
                msg += " or leave empty to cancel the operation.\n"
            else:
                msg += ".\n"
            print(msg)

    if allow_multi_select:
        return selected_items if len(selected_items) > 0 else None
    elif len(selected_items) > 0:
        return selected_items[0]


def prompt(message, options=None):
    """Prompts the user for input

    Args:
        message (str): A string with the message to be shown to the user.
        config (dict): Dictionary with options that change the function 
            behavior. The options dictionary may contain the following options:
            - defaultValue: a str value to be returned if the provides no data.
            - type: a str value to define the prompt type.
                The type option supports the following values:
                - password: the user input will not be echoed on the screen.

    Returns:
        A string value containing the input from the user.
    """
    import mysqlsh

    return mysqlsh.globals.shell.prompt(message, options)


def get_oci_compute_client(config):
    import oci.core

    compute = oci.core.ComputeClient(
        config=config, retry_strategy=oci.retry.DEFAULT_RETRY_STRATEGY,
        signer=config.get("signer"))

    # Set a custom endpoint if given
    endpoint = config.get("endpoint")
    if endpoint:
        compute.base_client.endpoint = endpoint

    return compute


def get_oci_identity_client(config):
    import oci.identity

    identity = oci.identity.IdentityClient(
        config=config, retry_strategy=oci.retry.DEFAULT_RETRY_STRATEGY,
        signer=config.get("signer"))

    # Set a custom endpoint if given
    endpoint = config.get("endpoint")
    if endpoint:
        identity.base_client.endpoint = endpoint

    return identity


def get_oci_object_storage_client(config):
    import oci.mysql

    os_client = oci.object_storage.ObjectStorageClient(
        config=config, retry_strategy=oci.retry.DEFAULT_RETRY_STRATEGY,
        signer=config.get("signer"))

    # Set a custom endpoint if given
    endpoint = config.get("endpoint")
    if endpoint:
        os_client.base_client.endpoint = endpoint

    return os_client


def get_oci_virtual_network_client(config):
    import oci.core

    virtual_network = oci.core.VirtualNetworkClient(
        config=config, retry_strategy=oci.retry.DEFAULT_RETRY_STRATEGY,
        signer=config.get("signer"))

    # Set a custom endpoint if given
    endpoint = config.get("endpoint")
    if endpoint:
        virtual_network.base_client.endpoint = endpoint

    return virtual_network


def get_oci_load_balancer_client(config):
    import oci.load_balancer

    load_balancer_cl = oci.load_balancer.LoadBalancerClient(
        config=config, retry_strategy=oci.retry.DEFAULT_RETRY_STRATEGY,
        signer=config.get("signer"))

    # Set a custom endpoint if given
    endpoint = config.get("endpoint")
    if endpoint:
        load_balancer_cl.base_client.endpoint = endpoint

    return load_balancer_cl


def get_oci_mds_client(config):
    import oci.mysql

    # cSpell:ignore Mysqlaas
    mds_client = oci.mysql.MysqlaasClient(
        config=config, retry_strategy=oci.retry.DEFAULT_RETRY_STRATEGY,
        signer=config.get("signer"))

    # Set a custom endpoint if given
    endpoint = config.get("endpoint")
    if endpoint:
        mds_client.base_client.endpoint = endpoint

    return mds_client


def get_oci_db_system_client(config):
    import oci.mysql

    db_sys = oci.mysql.DbSystemClient(
        config=config, retry_strategy=oci.retry.DEFAULT_RETRY_STRATEGY,
        signer=config.get("signer"))

    # Set a custom endpoint if given
    endpoint = config.get("endpoint")
    if endpoint:
        db_sys.base_client.endpoint = endpoint

    return db_sys


def get_oci_work_requests_client(config):
    import oci.mysql

    req_client = oci.mysql.WorkRequestsClient(
        config=config, retry_strategy=oci.retry.DEFAULT_RETRY_STRATEGY,
        signer=config.get("signer"))

    # Set a custom endpoint if given
    endpoint = config.get("endpoint")
    if endpoint:
        req_client.base_client.endpoint = endpoint

    return req_client



def get_oci_bastion_client(config):
    import oci.bastion

    bastion_client = oci.bastion.BastionClient(
        config=config, retry_strategy=oci.retry.DEFAULT_RETRY_STRATEGY,
        signer=config.get("signer"))

    # Set a custom endpoint if given
    endpoint = config.get("endpoint")
    if endpoint:
        bastion_client.base_client.endpoint = endpoint

    return bastion_client


def get_oci_instance_agent_client(config):
    import oci.compute_instance_agent

    instance_agent_client = oci.compute_instance_agent.PluginClient(
        config=config, retry_strategy=oci.retry.DEFAULT_RETRY_STRATEGY,
        signer=config.get("signer"))

    # Set a custom endpoint if given
    endpoint = config.get("endpoint")
    if endpoint:
        instance_agent_client.base_client.endpoint = endpoint

    return instance_agent_client


def get_oci_instance_agent_client(config):
    import oci.compute_instance_agent

    instance_agent_client = oci.compute_instance_agent.PluginClient(
        config=config, retry_strategy=oci.retry.DEFAULT_RETRY_STRATEGY,
        signer=config.get("signer"))

    # Set a custom endpoint if given
    endpoint = config.get("endpoint")
    if endpoint:
        instance_agent_client.base_client.endpoint = endpoint

    return instance_agent_client


def return_oci_object(oci_object, return_formatted=False,
                      return_python_object=False, format_function=None,
                      current=None):
    """Returns the given OCI object in various formats

    Args:
        oci_object (obj): The oci_object to return
        return_formatted (bool): If true a human readable string is returned
        return_python_object (bool): The OCI object itself is returned
        format_function (func): The function to format the OCI object

    Returns:
       Either the object data formatted as a string or the object itself
    """

    import oci.util

    if return_python_object:
        return oci_object
    elif return_formatted and format_function:
        if current:
            return format_function(oci_object, current)
        else:
            return format_function(oci_object)
    else:
        return oci.util.to_dict(oci_object)


def oci_object(oci_object, return_type=RETURN_DICT, format_function=None,
               current=None):
    """Returns the given OCI object in various formats

    Args:
        oci_object (obj): The oci_object to return
        return_formatted (bool): If true a human readable string is returned
        return_python_object (bool): The OCI object itself is returned
        format_function (func): The function to format the OCI object

    Returns:
       Either the object data formatted as a string or the object itself
    """

    import oci.util

    if oci_object == None:
        return None

    if return_type == RETURN_OBJ:
        return oci_object

    if return_type == RETURN_DICT:
        return oci.util.to_dict(oci_object)

    if return_type == RETURN_STR and format_function:
        if current:
            return format_function(oci_object, current)
        else:
            return format_function(oci_object)
    else:
        return str(oci_object)


def fixed_len(s, length, append=None, no_linebreaks=False, align_right=False):
    """Returns the given string with a new length of len

    If the given string is too long, it is truncated and ellipsis are added.
    If it is too short, spaces are added. Linebreaks are removed.

    Args:
        s (str): The string to 
        length (int): The new length of the string
        append (str): The string to append
        no_linebreaks (bool): Whether line breaks should be filtered out

    Returns:
       The string with a fixed length plus the append string
    """

    if not s:
        return " " * length + append if append else ''

    if no_linebreaks:
        s = s.replace('\n', ' ').replace('\r', '')

    s = f"{s[:length-2]}.." if len(s) > length else \
        s.rjust(length, ' ') if align_right else s.ljust(length, ' ')

    return s + append if append else ''


def get_current_session(session=None):
    """Returns the current database session

    If a session is provided, it will be returned instead of the current one.
    If there is no active session, then an exception will be raised.

    Returns:
        The current database session
    """
    shell = mysqlsh.globals.shell

    # Check if the user provided a session or there is an active global session
    if session is None:
        session = shell.get_session()
        if session is None:
            raise Exception(
                "MySQL session not specified. Please either pass a session "
                "object when calling the function or open a database "
                "connection in the MySQL Shell first.")
    return session


def format_result_set(res, rows, addColumnHeader=True, addFooter=True):
    """Formats a MySQL Shell result set in table format

    Args:
        res: The result set to use
        rows: The rows to format

    Returns:
       A string representing the formatted result set
    """

    if not res:
        raise ValueError("No result set given.")
    if not rows:
        raise ValueError("No rows given.")

    # Get column lengths
    colLengths = []
    for column in res.column_names:
        colLengths.append(len(column))

    # Update column lengths with row lengths
    for row in rows:
        i = 0
        for field in row:
            fieldLength = len(f"{field}")
            if fieldLength > colLengths[i]:
                colLengths[i] = fieldLength
            i += 1

    # Format column header and separator string
    colStr = "|"
    sepStr = "+"
    i = 0
    for col in res.column_names:
        colStr += " " + fixed_len(col, colLengths[i] + 1, "|", True)
        sepStr += "-" * (colLengths[i] + 2) + "+"
        i += 1

    # Format rows
    rowStr = ""
    for row in rows:
        i = 0
        rowStr += "|"
        for field in row:
            rowStr += " " + fixed_len(f"{field}", colLengths[i] + 1, "|", True)
            i += 1

        rowStr += "\n"

    # Build result string
    if addColumnHeader:
        resultStr = sepStr + "\n" + colStr + "\n" + sepStr + "\n"
    else:
        resultStr = sepStr + "\n"

    resultStr += rowStr + sepStr + "\n"

    if addFooter:
        resultStr += f"{len(rows)} row{'s' if len(rows) != 1 else ''} in set.\n"

    return resultStr
