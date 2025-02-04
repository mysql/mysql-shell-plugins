# Copyright (c) 2025, Oracle and/or its affiliates.
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

"""Sub-Module for core functions"""

# cSpell:ignore mysqlsh, msm
import base64
import datetime
from enum import IntEnum
import json
import os
import pathlib
import re
import threading
import traceback
import mysqlsh

SCHEMA_METADATA_LOCK_ERROR = "Failed to acquire schema metadata lock. Please ensure no other metadata update is running, then try again."


def get_msm_plugin_data_path() -> str:
    # Get msm plugin data folder, create if it does not exist yet
    msm_plugin_data_path = os.path.abspath(
        mysqlsh.plugin_manager.general.get_shell_user_dir(
            'plugin_data', 'msm_plugin'))
    pathlib.Path(msm_plugin_data_path).mkdir(parents=True, exist_ok=True)

    return msm_plugin_data_path


def write_to_msm_schema_update_log(type, message):
    # Create/Open the log file and append the message
    log_file_name = os.path.join(
        get_msm_plugin_data_path(), 'msm_schema_update_log.txt')
    with open(log_file_name, "a+") as file:
        file.write(f"{datetime.datetime.now()} - {type} - {message}\n")


class ConfigFile:
    def __new__(cls):
        if not hasattr(cls, 'instance'):
            cls.instance = super(ConfigFile, cls).__new__(cls)
        return cls.instance

    def __init__(self) -> None:
        self._settings = {}

        self._filename = os.path.join(
            get_msm_plugin_data_path(), "config.json")
        try:
            with open(self._filename, "r") as f:
                self._settings = json.load(f)
        except:
            pass

    def store(self):
        # create a copy because we're changing the dict data
        settings_copy = self._settings.copy()

        os.makedirs(os.path.dirname(self._filename), exist_ok=True)
        with open(self._filename, "w") as f:
            json.dump(self._serialize(settings_copy), f)

    @property
    def settings(self):
        return self._settings

    def _serialize(self, value):
        if isinstance(value, bytes):
            return f"0x{value.hex()}"
        if isinstance(value, dict) or "Dict" in type(value).__name__:
            result = {}
            for key, val in value.items():
                result[key] = self._serialize(val)
            return result
        if isinstance(value, list) or "List" in type(value).__name__:
            return [self._serialize(val) for val in value]
        return value


def get_working_dir():
    return os.path.expanduser(
        ConfigFile().settings.get("workingDirectory", "~"))


def get_interactive_default():
    """Returns the default of the interactive mode

    Returns:
        True if the interactive mode is enabled, False otherwise
    """
    if mysqlsh.globals.shell.options.useWizards:
        ct = threading.current_thread()
        if ct.__class__.__name__ == "_MainThread":
            return True
    return False


class LogLevel(IntEnum):
    NONE = 1
    INTERNAL_ERROR = 2
    ERROR = 3
    WARNING = 4
    INFO = 5
    DEBUG = 6
    DEBUG2 = 7
    DEBUG3 = 8


def print_exception(exc_type, exc_value, exc_traceback):
    # Exception handler for the MsmDbSession context manager, which should
    # be used only in interactive mode.
    # Returns True to signal the exception was dealt with
    if mysqlsh.globals.shell.options.verbose <= 1:
        print(f"{exc_value}")
    else:
        exc_str = "".join(
            [
                s.replace("\\n", "\n")
                for s in traceback.format_exception(exc_type, exc_value, exc_traceback)
            ]
        )
        print(exc_str)

    return True


def get_interactive_result():
    """
    To be used in plugin functions that may return pretty formatted result when
    called in an interactive Shell session
    """
    return get_interactive_default()


def script_path(*suffixes):
    return os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), *suffixes
    )


def get_current_session(session=None):
    """Returns the current database session

    If a session is provided, it will be returned instead of the current one.
    If there is no active session, then an exception will be raised.

    Returns:
        The current database session
    """
    if session is not None:
        return session

    # Check if the user provided a session or there is an active global session
    session = mysqlsh.globals.shell.get_session()
    if session is None or not session.is_open():
        raise Exception(
            "MySQL session not specified. Please either pass a session "
            "object when calling the function or open a database "
            "connection in the MySQL Shell first."
        )

    return session


def get_db_schema_version(session, schema_name):
    row = (
        select(
            table=f"`{schema_name}`.`msm_schema_version`",
            cols=[
                "major",
                "minor",
                "patch",
            ],
        )
        .exec(session)
        .first
    )

    if not row:
        raise Exception(
            "Unable to fetch the MSM database schema version.")

    return [row["major"], row["minor"], row["patch"]]


def get_db_schema_version_int(session):
    row = get_db_schema_version(session)
    return row[0] * 10000 + row[1] * 100 + row[2]


def db_schema_exists(session, schema_name):
    row = (
        MsmDbExec("""
        SELECT COUNT(*) > 0 AS schema_exists
        FROM INFORMATION_SCHEMA.SCHEMATA
        WHERE SCHEMA_NAME = ?
    """)
        .exec(session, [schema_name]).first
    )
    return row["schema_exists"]


def prompt_for_list_item(
    item_list,
    prompt_caption,
    prompt_default_value="",
    item_name_property=None,
    given_value=None,
    print_list=False,
    allow_multi_select=False,
):
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

    # If a given_value was provided, check this first instead of prompting the
    # user
    if given_value:
        given_value = given_value.lower()
        selected_item = None
        for item in item_list:
            if item_name_property is not None:
                if isinstance(item, dict):
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
                if isinstance(item, dict):
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
        prompt = (
            mysqlsh.globals.shell.prompt(
                prompt_caption, {"defaultValue": prompt_default_value}
            )
            .strip()
            .lower()
        )

        if prompt == "":
            return None
        # If the user typed '*', return full list
        if allow_multi_select and prompt == "*":
            return item_list

        if allow_multi_select:
            prompt_items = prompt.split(",")
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
                            if isinstance(item, dict):
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
            msg = f"The item {prompt} was not found. Please try again"
            if prompt_default_value == "":
                msg += " or leave empty to cancel the operation.\n"
            else:
                msg += ".\n"
            print(msg)

    if allow_multi_select:
        return selected_items if len(selected_items) > 0 else None
    elif len(selected_items) > 0:
        return selected_items[0]


def get_sql_result_as_dict_list(res, binary_formatter=None):
    """Returns the result set as a list of dicts

    Args:
        res: (object): The sql result set
        binary_formatter (callback): function receiving binary data and returning formatted value

    Returns:
        A list of dicts
    """
    if not res:
        return []

    cols = res.get_columns()
    rows = res.fetch_all()
    dict_list = []

    for row in rows:
        item = {}
        for col in cols:
            col_name = col.get_column_label()
            field_val = row.get_field(col_name)
            # The right way to get the column type is with "get_type().data". Using
            # get_type() may return "Constant" or the data type depending if the shell
            # is started in with --json or not.
            col_type = col.get_type().data
            if col_type == "BIT" and col.get_length() == 1:
                item[col_name] = field_val == 1
            elif col_type == "SET":
                item[col_name] = field_val.split(",") if field_val else []
            elif col_type == "JSON":
                item[col_name] = json.loads(field_val) if field_val else None
            elif binary_formatter is not None and isinstance(field_val, bytes):
                item[col_name] = binary_formatter(field_val)
            else:
                item[col_name] = field_val

        dict_list.append(item)

    return dict_list


def prompt(message, options=None) -> str:
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
    return mysqlsh.globals.shell.prompt(message, options)


def convert_json(value) -> dict:
    try:
        value_str = json.dumps(value)
    except:
        value_str = str(value)
        value_str = value_str.replace("{'", '{"')
        value_str = value_str.replace("'}'", '"}')
        value_str = value_str.replace("', '", '", "')
        value_str = value_str.replace("': '", '": "')
        value_str = value_str.replace("': [", '": [')
        value_str = value_str.replace("], '", '], "')
        value_str = value_str.replace("['", '["')
        value_str = value_str.replace("']", '"]')
        value_str = value_str.replace("': ", '": ')
        value_str = value_str.replace(", '", ', "')
        value_str = value_str.replace(": b'", ': "')
    return json.loads(value_str)


class MsmDbExec:
    def __init__(self, sql: str, params=[], binary_formatter=None) -> None:
        self._sql = sql
        self._result = None
        self._params = params
        self._binary_formatter = binary_formatter

    def _convert_to_database(self, var):
        if isinstance(var, list):
            return ",".join(var)
        if isinstance(var, dict):
            return json.dumps(dict(var))
        return var

    @property
    def dump(self) -> "MsmDbExec":
        print(f"sql: {self._sql}\nparams: {self._params}")
        return self

    def exec(self, session, params=[]) -> "MsmDbExec":
        self._params = self._params + params
        try:
            # convert lists and dicts to store in the database
            self._params = [self._convert_to_database(
                param) for param in self._params]

            self._result = session.run_sql(self._sql, self._params)
        except Exception as e:
            mysqlsh.globals.shell.log(
                LogLevel.WARNING.name, f"[{e}\nsql: {
                    self._sql}\nparams: {self._params}"
            )
            raise
        return self

    def __str__(self):
        return self._sql

    @property
    def items(self):
        return get_sql_result_as_dict_list(self._result, self._binary_formatter)

    @property
    def first(self):
        result = get_sql_result_as_dict_list(
            self._result, self._binary_formatter)
        if not result:
            return None
        return result[0]

    @property
    def success(self):
        return self._result.get_affected_items_count() > 0

    @property
    def id(self):
        return self._result.auto_increment_value

    @property
    def affected_count(self):
        return self._result.get_affected_items_count()


def _generate_where(where):
    if where:
        if isinstance(where, list):
            return " WHERE " + " AND ".join(where)
        else:
            return " WHERE " + where
    return ""


def select(
    table: str, cols=["*"], where=[], order=None, binary_formatter=None
) -> MsmDbExec:
    if not isinstance(cols, str):
        cols = ",".join(cols)
    if order is not None and not isinstance(order, str):
        order = ",".join(order)
    sql = f"""
        SELECT {cols}
        FROM {table}
        {_generate_where(where)}"""
    if order:
        sql = f"{sql} ORDER BY {order}"

    return MsmDbExec(sql, binary_formatter=binary_formatter)


def update(table: str, sets, where=[]) -> MsmDbExec:
    params = []
    if isinstance(sets, list):
        sets = ",".join(sets)
    elif isinstance(sets, dict):
        params = [value for value in sets.values()]
        sets = ",".join([f"{key}=?" for key in sets.keys()])

    sql = f"""
        UPDATE {table}
        SET {sets}
        {_generate_where(where)}"""

    return MsmDbExec(sql, params)


def delete(table: str, where=[]) -> MsmDbExec:
    sql = f"""
        DELETE FROM {table}
        {_generate_where(where)}"""

    return MsmDbExec(sql)


def insert(table, values={}):
    params = []
    place_holders = []
    cols = []
    if isinstance(values, list):
        cols = ",".join(values)
        place_holders = ",".join(["?" for val in values])
    elif isinstance(values, dict):
        cols = ",".join([str(col) for col in values.keys()])
        place_holders = ",".join(["?" for val in values.values()])
        params = [val for val in values.values()]

    sql = f"""
        INSERT INTO {table}
        ({cols})
        VALUES
        ({place_holders})
    """
    return MsmDbExec(sql, params)


class MsmDbTransaction:
    def __init__(self, session) -> None:
        self._session = session

    def __enter__(self) -> "MsmDbTransaction":
        self._session.run_sql("START TRANSACTION")
        return self

    def __exit__(self, exc_type, exc_value, exc_traceback) -> bool:
        if exc_type is None:
            self._session.run_sql("COMMIT")
            return

        self._session.run_sql("ROLLBACK")
        return False


def uppercase_first_char(s):
    if len(s) > 0:
        return s[0].upper() + s[1:]
    return ""


def convert_path_to_camel_case(path):
    if path.startswith("/"):
        path = path[1:]
    parts = path.replace("/", "_").split("_")
    s = parts[0] + "".join(uppercase_first_char(x) for x in parts[1:])
    # Only return alphanumeric characters
    return "".join(e for e in s if e.isalnum())


def convert_path_to_pascal_case(path):
    return uppercase_first_char(convert_path_to_camel_case(path))


def convert_snake_to_camel_case(snake_str):
    snake_str = "".join(x.capitalize() for x in snake_str.lower().split("_"))

    return snake_str[0].lower() + snake_str[1:]


def convert_to_snake_case(str):
    return re.sub(r"(?<!^)(?=[A-Z])", "_", str).lower()


def escape_str(s):
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("'", "\\'")


def quote_str(s):
    return '"' + escape_str(s) + '"'


def unescape_str(s):
    return s.replace("\\'", "'").replace('\\"', '"').replace("\\\\", "\\")


def unquote_str(s):
    if (s.startswith("'") and s.endswith("'")) or (
        s.startswith('"') and s.endswith('"')
    ):
        return unescape_str(s[1:-1])
    return s


def quote_ident(s):
    return mysqlsh.mysql.quote_identifier(s)


def unquote_ident(s):
    return mysqlsh.mysql.unquote_identifier(s)


def convert_version_str_to_list(version: str) -> list[int]:
    version_match = re.match(r"(\d+)\.(\d+)\.(\d+)", version)
    if version_match is None:
        raise ValueError(
            "The version needs to be specified using the following format: major.minor.patch")

    return [int(version_match.group(1)), int(version_match.group(2)), int(version_match.group(3))]


class MsmDbExec:
    def __init__(self, sql: str, params=[], binary_formatter=None) -> None:
        self._sql = sql
        self._result = None
        self._params = params
        self._binary_formatter = binary_formatter

    def _convert_to_database(self, var):
        if isinstance(var, list):
            return ",".join(var)
        if isinstance(var, dict):
            return json.dumps(dict(var))
        return var

    @property
    def dump(self) -> "MsmDbExec":
        print(f"sql: {self._sql}\nparams: {self._params}")
        return self

    def exec(self, session, params=[]) -> "MsmDbExec":
        self._params = self._params + params
        try:
            # convert lists and dicts to store in the database
            self._params = [self._convert_to_database(
                param) for param in self._params]

            self._result = session.run_sql(self._sql, self._params)
        except Exception as e:
            mysqlsh.globals.shell.log(
                LogLevel.WARNING.name, f"[{e}\nsql: {self._sql}\nparams: {self._params}"
            )
            raise
        return self

    def __str__(self):
        return self._sql

    @property
    def items(self):
        return get_sql_result_as_dict_list(self._result, self._binary_formatter)

    @property
    def first(self):
        result = get_sql_result_as_dict_list(
            self._result, self._binary_formatter)
        if not result:
            return None
        return result[0]

    @property
    def success(self):
        return self._result.get_affected_items_count() > 0

    @property
    def id(self):
        return self._result.auto_increment_value

    @property
    def affected_count(self):
        return self._result.get_affected_items_count()


def execute_msm_sql_script(
        session, sql_script: str = None, script_name: str = None,
        sql_file_path: str = None):
    if sql_script is None and sql_file_path is None:
        raise ValueError("No script or sql_file_path specified.")
    if sql_script is not None and script_name is None:
        raise ValueError("No script_name specified.")
    if script_name is None and sql_file_path is not None:
        script_name = sql_file_path

    write_to_msm_schema_update_log(
        "INFO", f"Running SQL script `{script_name}` ...")

    if sql_file_path is not None:
        with open(sql_file_path) as f:
            sql_script = f.read()

    commands = mysqlsh.mysql.split_script(sql_script)

    msm_lock = 0
    try:
        # Acquire MSM_METADATA_LOCK
        msm_lock = (
            MsmDbExec('SELECT GET_LOCK("MSM_METADATA_LOCK", 1) AS msm_lock')
            .exec(session)
            .first["msm_lock"]
        )
        if msm_lock == 0:
            raise Exception(
                "Failed to acquire MSM schema update lock. Please ensure no "
                "other MSM schema update is running, then try again.")

        # Execute all commands
        current_cmd = ""
        try:
            for cmd in commands:
                current_cmd = cmd.strip()
                if current_cmd:
                    session.run_sql(current_cmd)

            write_to_msm_schema_update_log(
                "INFO", f"SQL script {script_name} executed successfully.")
        except mysqlsh.DBError as e:
            # On exception, drop the schema and re-raise
            write_to_msm_schema_update_log(
                "ERROR", f"Failed to run the the SQL script `{script_name}`.\n{current_cmd}\n{e}")
            raise Exception(
                f"Failed to run the SQL script.\n{current_cmd}\n{e}"
            )
    finally:
        if msm_lock == 1:
            MsmDbExec('SELECT RELEASE_LOCK("MSM_METADATA_LOCK")').exec(session)
