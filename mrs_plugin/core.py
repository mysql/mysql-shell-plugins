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

"""Sub-Module for core functions"""

# cSpell:ignore mysqlsh, mrs

from mysqlsh.plugin_manager import plugin_function
from mrs_plugin import general, services as mrs_services
from mrs_plugin import schemas as mrs_schemas
from mrs_plugin import content_sets as mrs_content_sets


def analyze_service_path(path=None, session=None):
    """Analyzes the given path

    Args:
        path (str): The path to use.
        session (object): The database session to use.

    Returns:
        service, schema, content_set as dict.
    """

    if not path:
        return None, None, None

    service = None
    schema = None
    content_set = None

    # Match path against services and schemas
    services = mrs_services.get_services(session=session, interactive=False)
    for item in services:
        host_ctx = item.get("host_ctx")
        if host_ctx == path[:len(host_ctx)]:
            service = item
            if len(path) > len(host_ctx):
                sub_path = path[len(host_ctx):]

                schemas = mrs_schemas.get_schemas(
                    service_id=service.get("id"), session=session,
                    interactive=False, return_formatted=False)

                if schemas:
                    for item in schemas:
                        request_path = item.get("request_path")
                        if request_path == sub_path[:len(request_path)]:
                            schema = item
                        break

                if not schema:
                    content_sets = mrs_content_sets.get_content_sets(
                        service_id=service.get("id"), session=session,
                        interactive=False)

                    if content_sets:
                        for item in content_sets:
                            request_path = item.get("request_path")
                            if request_path == sub_path[:len(request_path)]:
                                content_set = item
                            break

                if not schema and not content_set:
                    raise ValueError(
                        f"The given schema or content set was not found.")
            break

    if not service:
        raise ValueError(f"The given MRS service was not found.")

    return service, schema, content_set


def set_current_objects(service_id=None, service=None, schema_id=None,
                        schema=None, content_set_id=None, content_set=None,
                        db_object_id=None, db_object=None):
    """Sets the current objects to the given ones

    Note that if no service or no schema or no db_object are specified,
    they are reset

    Args:
        service_id (int): The id of the service to set as the current service
        service (dict): The service to set as the current service
        schema_id (int): The id of the schema to set as the current schema
        schema (dict): The schema to set as the current schema
        content_set_id (int): The id of the content_set to set as the current
        content_set (dict): The content_set to set as the current
        db_object_id (int): The id of the db_object to set as the current
            db_object
        db_object (dict): The db_object to set as the current db_object

    Returns:
        The current or default service or None if no default is set
    """

    # Get current_service_id from the global mrs_config
    mrs_config = get_current_config()

    if service_id:
        mrs_config['current_service_id'] = service_id
    if service:
        mrs_config['current_service_id'] = service.get("id")
    # If current_service_id is current set but not passed in, clear it
    if mrs_config.get('current_service_id') and not (service_id or service):
        mrs_config['current_service_id'] = None

    if schema_id:
        mrs_config['current_schema_id'] = schema_id
    if schema:
        mrs_config['current_schema_id'] = schema.get("id")
    # If current_schema_id is current set but not passed in, clear it
    if mrs_config.get('current_schema_id') and not (schema_id or schema):
        mrs_config['current_schema_id'] = None

    if db_object_id:
        mrs_config['current_db_object_id'] = db_object_id
    if db_object:
        mrs_config['current_db_object_id'] = db_object.get("id")
    # If current_db_object_id is current set but not passed in, clear it
    if mrs_config.get('current_db_object_id') and not (db_object_id or
                                                       db_object):
        mrs_config['current_db_object_id'] = None

    if content_set_id:
        mrs_config['current_content_set_id'] = content_set_id
    if content_set:
        mrs_config['current_content_set_id'] = content_set.get("id")
    # If current_db_object_id is current set but not passed in, clear it
    if mrs_config.get('current_content_set_id') and not (content_set_id or
                                                         content_set):
        mrs_config['current_content_set_id'] = None


def get_current_service(session=None):
    """Returns the current service

    This only applies to interactive sessions in the shell where the
    id of the current service is stored in the global config

    Args:
        session (object): The database session to use.

    Returns:
        The current or default service or None if no default is set
    """

    # Get current_service_id from the global mrs_config
    mrs_config = get_current_config()
    current_service_id = mrs_config.get('current_service_id')

    current_service = None
    if current_service_id:
        current_service = mrs_services.get_service(
            service_id=current_service_id,
            session=session, interactive=False)

    return current_service


def get_current_content_set(session=None):
    """Returns the current content_set

    This only applies to interactive sessions in the shell where the
    id of the current content_set is stored in the global config

    Args:
        session (object): The database session to use.

    Returns:
        The current content_set or None if no current content_set was set
    """

    # Get current_service_id from the global mrs_config
    mrs_config = get_current_config()
    current_content_set_id = mrs_config.get('current_content_set_id')

    current_content_set = None
    if current_content_set_id:
        current_content_set = mrs_content_sets.get_content_set(
            content_set_id=current_content_set_id,
            session=session, interactive=False)

    return current_content_set


def get_current_schema(session=None):
    """Returns the current schema

    Args:
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode

    Returns:
        The current or default service or None if no default is set
    """

    # Get current_service_id from the global mrs_config
    mrs_config = get_current_config()
    current_schema_id = mrs_config.get('current_schema_id')

    current_schema = None
    if current_schema_id:
        current_schema = mrs_schemas.get_schema(
            schema_id=current_schema_id, session=session,
            interactive=False, return_formatted=False)

    return current_schema


def get_interactive_default():
    """Returns the default of the interactive mode

    Returns:
        The current database session
    """
    import mysqlsh

    return mysqlsh.globals.shell.options.useWizards


def get_current_session(session=None):
    """Returns the current database session

    If a session is provided, it will be returned instead of the current one.
    If there is no active session an exception will be raised.

    Returns:
        The current database session
    """
    import mysqlsh

    shell = mysqlsh.globals.shell

    # Check if the user provided a session or there is an active global session
    if session is None:
        session = shell.get_session()
        if session is None:
            raise Exception(
                "No MySQL session specified. Please either pass a session "
                "object when calling the function or open a database "
                "connection in the MySQL Shell first.")
    return session


def ensure_rds_metadata_schema(session=None, auto_create_and_update=False,
                               interactive=True):
    """Creates or updates the MRS metadata schema

    Raises exception on failure

    Args:
        session (object): The database session to use
        auto_create_and_update (bool): Whether the metadata schema should be
            automatically created and updated if needed
        interactive (bool): Indicates whether to execute in interactive mode

    Returns:
        True if the metadata schema has been changed
    """
    session = get_current_session(session)

    # Check if the MRS metadata schema already exists
    res = session.run_sql("""
        SELECT COUNT(*) AS schema_exists FROM INFORMATION_SCHEMA.SCHEMATA
        WHERE SCHEMA_NAME = 'mysql_rest_service_metadata'
        """)
    row = res.fetch_one()
    if not row or (row and row.get_field("schema_exists") == 0):
        if auto_create_and_update:
            create_rds_metadata_schema(session, interactive)
            return True
        else:
            raise Exception("The MRS metadata schema has not yet been "
                            "created. Please run mrs.configure() first.")
    else:
        # If it exists, check the version number
        res = session.run_sql("""
            SELECT major, minor, patch,
                CONCAT(major, '.', minor, '.', patch) AS version
            FROM `mysql_rest_service_metadata`.schema_version
            """)
        row = res.fetch_one()
        if not row:
            raise Exception(
                "Unable to fetch MRS metadata database schema version.")

        db_version_str = row.get_field("version")
        if db_version_str != general.DB_VERSION_STR:
            db_version_num = (100000 * row.get_field("major") +
                              1000 * row.get_field("minor") +
                              row.get_field("patch"))

            if db_version_num > general.DB_VERSION_NUM:
                raise Exception(
                    "Unsupported MRS metadata database schema "
                    f"version {db_version_str}. "
                    "Please update your MRS Shell Plugin.")
            else:
                if auto_create_and_update:
                    update_rds_metadata_schema(session, db_version_str)
                    return True
                else:
                    raise Exception(
                        "The MRS metadata schema needs to be updated. "
                        "Please run mrs.configure() first.")

    return False


def split_sql_script(sql_script):
    """Splits an SQL script into individual SQL commands

    Args:
        script (string): The script to split

    Returns:
        A list of commands as strings
    """

    import re

    # Remove comments and split by command
    sql_script = re.sub(r".*--.*\n?", "", sql_script)

    # cSpell:ignore cmds
    cmds = []

    # Deal with DELIMITER blocks
    leftover_start = 0
    ms = re.finditer(r'(.*?)(DELIMITER (.*?)\n)(.*?)(DELIMITER ;)',
                     sql_script, re.DOTALL)
    if ms:
        for m in ms:
            # Split the beginning of the script based on ; as DELIMITER
            cmds.extend(m.group(1).split(";"))

            # Split the delimiter section based on the other DELIMITER
            cmds.extend(m.group(4).split(m.group(3)))

            # Store where the match ends, to be able to deal with the rest
            leftover_start = m.end(5)

        # Split the rest of the script based on ; as DELIMITER
        cmds.extend(sql_script[leftover_start:].split(";"))

    return cmds


def update_rds_metadata_schema(session, current_db_version_str,
                               interactive=True):
    """Creates or updates the MRS metadata schema

    Raises exception on failure

    Args:
        session (object): The database session to use
        current_db_version_str (string): Current version of the metadata schema
        interactive (bool): Indicates whether to execute in interactive mode

    Returns:
        None
    """

    import mysqlsh
    import os
    import re

    if interactive:
        print("Updating MRS metadata schema...")

    script_dir_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
        'db_schema')

    version_to_update = current_db_version_str

    # run updates until ending up at current version
    upgrade_file_found = True

    while general.DB_VERSION_STR != version_to_update and upgrade_file_found:
        # set upgrade_file_found to False to ensure execution will not be
        # stuck in this loop forever
        upgrade_file_found = False

        for f in os.listdir(script_dir_path):
            m = re.match(
                r'mrs_metadata_schema_(\d+\.\d+\.\d+)_to_'
                r'(\d+\.\d+\.\d+)\.sql', f)
            if m:
                g = m.groups()

                update_from_version = g[0]
                update_to_version = g[1]

                if version_to_update == update_from_version:
                    upgrade_file_found = True

                    try:
                        with open(os.path.join(script_dir_path, f),
                                  'r') as sql_file:
                            sql_script = sql_file.read()

                        if interactive:
                            print(f"Update from version {update_from_version} "
                                  f"to version {update_to_version} ...")

                        for cmd in split_sql_script(sql_script):
                            current_cmd = cmd.strip()
                            if current_cmd:
                                session.run_sql(current_cmd)

                        version_to_update = update_to_version
                    except (mysqlsh.DBError, Exception) as e:
                        raise Exception(
                            "The MRS metadata database schema could not "
                            f"be updated.\n{current_cmd}\n{e}")

        if general.DB_VERSION_STR != version_to_update and not upgrade_file_found:
            raise Exception("The file to update the metadata "
                            f"schema from version {version_to_update} to "
                            f"version {general.DB_VERSION_STR} was not found.")
        else:
            if interactive:
                print(f"The MRS metadata schema was successfully update "
                      f"to version {general.DB_VERSION_STR}.")


def create_rds_metadata_schema(session=None, interactive=True):
    """Creates or updates the MRS metadata schema

    Raises exception on failure

    Args:
        session (object): The database session to use
        interactive (bool): Indicates whether to execute in interactive mode

    Returns:
        None
    """

    import mysqlsh
    import os
    import re

    shell = mysqlsh.globals.shell
    session = get_current_session(session)

    if interactive:
        print("Creating MRS metadata schema...")

    latest_version_val = [0, 0, 0]

    script_dir = sql_file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'db_schema')

    # find the latest version of the database file available
    for f in os.listdir(script_dir):
        m = re.match(
            r'mrs_metadata_schema_(\d+)\.(\d+)\.(\d+)\.sql', f)
        if m:
            g = [int(group) for group in m.groups()]
            if g > latest_version_val or latest_version_val == [0, 0, 0]:
                latest_version_val = g

    if latest_version_val == [0, 0, 0]:
        return

    sql_file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
    'db_schema', f'mrs_metadata_schema_{".".join(map(str, latest_version_val))}.sql')


    with open(sql_file_path) as f:
        sql_script = f.read()

    cmds = split_sql_script(sql_script)

    # Execute all commands
    current_cmd = ""
    try:
        for cmd in cmds:
            current_cmd = cmd.strip()
            if current_cmd:
                session.run_sql(current_cmd)
    except mysqlsh.DBError as e:
        # On exception, drop the schema and re-raise
        session.run_sql("DROP SCHEMA IF EXISTS `mysql_rest_service_metadata`")
        raise Exception(f"Failed to create the MRS metadata schema.\n"
                        f"{current_cmd}\n{e}")


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


def prompt_for_comments():
    """Prompts the user for comments

    Returns:
        The comments as str
    """

    return prompt("Comments: ").strip()


def get_sql_result_as_dict_list(res):
    """Returns the result set as a list of dicts

    Args:
        res: (object): The sql result set

    Returns:
        A list of dicts
    """

    if not res:
        return []

    col_names = res.get_column_names()
    rows = res.fetch_all()
    dict_list = []

    for row in rows:
        item = {}
        for col_name in col_names:
            item[col_name] = row.get_field(col_name)
        dict_list.append(item)

    return dict_list


def get_current_config(mrs_config=None):
    """Gets the active config dict

    If no config dict is given as parameter, the global config dict will be used

    Args:
        config (dict): The config to be used or None

    Returns:
        The active config dict
    """
    import mysqlsh

    if mrs_config is None:
        # Check if global object 'mrs_config' has already been registered
        if 'mrs_config' in dir(mysqlsh.globals):
            mrs_config = getattr(mysqlsh.globals, 'mrs_config')
        else:
            mrs_config = {}
            setattr(mysqlsh.globals, 'mrs_config', mrs_config)

    return mrs_config


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


def check_request_path(request_path=None, **kwargs):
    """Checks if the given request_path is valid and unique

    Args:
        request_path (str): The request_path to check
        **kwargs: Additional options

    Keyword Args:
        session (object): The database session to use

    Returns:
        None
    """

    session = kwargs.get("session")

    if not request_path:
        raise Exception("No request_path specified.")

    session = get_current_session(session)

    # Check if the request_path already exists for another db_object of that
    # schema
    res = session.run_sql("""
        SELECT CONCAT(h.name,
            se.url_context_root) as full_request_path
        FROM `mysql_rest_service_metadata`.service se
			LEFT JOIN `mysql_rest_service_metadata`.url_host h
				ON se.url_host_id = h.id
        WHERE CONCAT(h.name, se.url_context_root) = ?
        UNION
        SELECT CONCAT(h.name, se.url_context_root,
            sc.request_path) as full_request_path
        FROM `mysql_rest_service_metadata`.db_schema sc
			LEFT OUTER JOIN `mysql_rest_service_metadata`.service se
                ON se.id = sc.service_id
			LEFT JOIN `mysql_rest_service_metadata`.url_host h
				ON se.url_host_id = h.id
        WHERE CONCAT(h.name, se.url_context_root,
                sc.request_path) = ?
        UNION
        SELECT CONCAT(h.name, se.url_context_root,
            sc.request_path, o.request_path) as full_request_path
        FROM `mysql_rest_service_metadata`.db_object o
			LEFT OUTER JOIN `mysql_rest_service_metadata`.db_schema sc
                ON sc.id = o.db_schema_id
            LEFT OUTER JOIN `mysql_rest_service_metadata`.service se
                ON se.id = sc.service_id
			 LEFT JOIN `mysql_rest_service_metadata`.url_host h
				ON se.url_host_id = h.id
        WHERE CONCAT(h.name, se.url_context_root,
                sc.request_path, o.request_path) = ?
        UNION
        SELECT CONCAT(h.name, se.url_context_root,
            co.request_path) as full_request_path
        FROM `mysql_rest_service_metadata`.content_set co
			LEFT OUTER JOIN `mysql_rest_service_metadata`.service se
                ON se.id = co.service_id
			LEFT JOIN `mysql_rest_service_metadata`.url_host h
				ON se.url_host_id = h.id
        WHERE CONCAT(h.name, se.url_context_root,
                co.request_path) = ?
        """, [request_path, request_path, request_path, request_path])
    row = res.fetch_one()
    if row and row.get_field("full_request_path") != "":
        raise Exception(f"The request_path {request_path} is already "
                        "in use.")
