# Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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

# cSpell:ignore mysqlsh, mrs
import traceback
from mrs_plugin.lib import services, content_sets, general, schemas
import mysqlsh
import os
import re
import json
from enum import IntEnum
import threading
import base64
import datetime
import pathlib

MRS_METADATA_LOCK_ERROR = "Failed to acquire MRS metadata lock. Please ensure no other metadata update is running, then try again."


class ConfigFile:
    def __init__(self) -> None:
        self._settings = {}

        self._filename = os.path.abspath(
            mysqlsh.plugin_manager.general.get_shell_user_dir(
                "plugin_data", "mrs_plugin", "config.json"
            )
        )
        try:
            with open(self._filename, "r") as f:
                self._settings = json.load(f)
                for item in self._settings.get("current_objects", []):
                    convert_ids_to_binary(["current_service_id"], item)
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


class Validations:
    @staticmethod
    def request_path(value, required=False, session=None):
        if required and value is None:
            raise Exception("The request_path is missing.")
        if value is None:
            return

        if not isinstance(value, str) or not value.startswith("/"):
            raise Exception("The request_path has to start with '/'.")


class LogLevel(IntEnum):
    NONE = 1
    INTERNAL_ERROR = 2
    ERROR = 3
    WARNING = 4
    INFO = 5
    DEBUG = 6
    DEBUG2 = 7
    DEBUG3 = 8


def get_local_config():
    return ConfigFile().settings


def script_path(*suffixes):
    return os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), *suffixes
    )


def print_exception(exc_type, exc_value, exc_traceback):
    # Exception handler for the MrsDbSession context manager, which should
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


def validate_service_path(session, path):
    """Ensures the given path is valid in any of the registered services.

    Args:
        session (object): The database session to use.
        path (str): The path to validate.

    Returns:
        service, schema, content_set as dict.
    """
    if not path:
        return None, None, None

    service = None
    schema = None
    content_set = None

    # Match path against services and schemas
    all_services = services.get_services(session)
    for item in all_services:
        host_ctx = item.get("host_ctx")
        if host_ctx == path[: len(host_ctx)]:
            service = item
            if len(path) > len(host_ctx):
                sub_path = path[len(host_ctx) :]

                db_schemas = schemas.get_schemas(
                    service_id=service.get("id"), session=session
                )

                if db_schemas:
                    for item in db_schemas:
                        request_path = item.get("request_path")
                        if request_path == sub_path[: len(request_path)]:
                            schema = item
                            break

                if not schema:
                    content_sets_local = content_sets.get_content_sets(
                        service_id=service.get("id"), session=session
                    )

                    if content_sets_local:
                        for item in content_sets_local:
                            request_path = item.get("request_path")
                            if request_path == sub_path[: len(request_path)]:
                                content_set = item
                            break

                if not schema and not content_set:
                    raise ValueError(f"The given schema or content set was not found.")
            break

    if not service:
        raise ValueError(f"The given MRS service was not found.")

    return service, schema, content_set


def set_current_objects(
    service_id: bytes = None,
    service=None,
    schema_id: bytes = None,
    schema=None,
    content_set_id: bytes = None,
    content_set=None,
    db_object_id: bytes = None,
    db_object=None,
):
    """Sets the current objects to the given ones

    Note that if no service or no schema or no db_object are specified,
    they are reset

    Args:
        service_id: The id of the service to set as the current service
        service (dict): The service to set as the current service
        schema_id: The id of the schema to set as the current schema
        schema (dict): The schema to set as the current schema
        content_set_id: The id of the content_set to set as the current
        content_set (dict): The content_set to set as the current
        db_object_id: The id of the db_object to set as the current
            db_object
        db_object (dict): The db_object to set as the current db_object

    Returns:
        The current or default service or None if no default is set
    """

    # Get current_service_id from the global mrs_config
    mrs_config = get_current_config()

    if service_id:
        mrs_config["current_service_id"] = service_id
    if service:
        mrs_config["current_service_id"] = service.get("id")
    # If current_service_id is current set but not passed in, clear it
    if mrs_config.get("current_service_id") and not (service_id or service):
        mrs_config["current_service_id"] = None

    if schema_id:
        mrs_config["current_schema_id"] = schema_id
    if schema:
        mrs_config["current_schema_id"] = schema.get("id")
    # If current_schema_id is current set but not passed in, clear it
    if mrs_config.get("current_schema_id") and not (schema_id or schema):
        mrs_config["current_schema_id"] = None

    if db_object_id:
        mrs_config["current_db_object_id"] = db_object_id
    if db_object:
        mrs_config["current_db_object_id"] = db_object.get("id")
    # If current_db_object_id is current set but not passed in, clear it
    if mrs_config.get("current_db_object_id") and not (db_object_id or db_object):
        mrs_config["current_db_object_id"] = None

    if content_set_id:
        mrs_config["current_content_set_id"] = content_set_id
    if content_set:
        mrs_config["current_content_set_id"] = content_set.get("id")
    # If current_db_object_id is current set but not passed in, clear it
    if mrs_config.get("current_content_set_id") and not (content_set_id or content_set):
        mrs_config["current_content_set_id"] = None


def get_interactive_default():
    """Returns the default of the interactive mode

    Returns:
        The current database session
    """
    if mysqlsh.globals.shell.options.useWizards:
        ct = threading.current_thread()
        if ct.__class__.__name__ == "_MainThread":
            return True
    return False


def get_interactive_result():
    """
    To be used in plugin functions that may return pretty formatted result when
    called in an interactive Shell session
    """
    return get_interactive_default()


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


def get_mrs_schema_version(session):
    try:
        # As of MRS metadata schema version 4.0.0 the version VIEW has been
        # renamed to msm_schema_version, so try that one first
        row = (
            select(
                table="msm_schema_version",
                cols=[
                    "major",
                    "minor",
                    "patch",
                    "CONCAT(major, '.', minor, '.', patch) AS version",
                ],
            )
            .exec(session)
            .first
        )
    except:
        row = (
            select(
                table="schema_version",
                cols=[
                    "major",
                    "minor",
                    "patch",
                    "CONCAT(major, '.', minor, '.', patch) AS version",
                ],
            )
            .exec(session)
            .first
        )

    if not row:
        raise Exception("Unable to fetch MRS metadata database schema version.")

    return [row["major"], row["minor"], row["patch"]]


def get_mrs_schema_version_int(session):
    row = get_mrs_schema_version(session)
    return row[0] * 10000 + row[1] * 100 + row[2]


def mrs_metadata_schema_exists(session):
    row = (
        MrsDbExec(
            """
        SELECT COUNT(*) AS schema_exists
        FROM INFORMATION_SCHEMA.SCHEMATA
        WHERE SCHEMA_NAME = 'mysql_rest_service_metadata'
    """
        )
        .exec(session)
        .first
    )
    return row["schema_exists"]


def get_mrs_enabled(session):
    try:
        row = (
            select(
                table="config",
                cols=[
                    "service_enabled",
                ],
            )
            .exec(session)
            .first
        )
        if not row:
            return False

        return int(row["service_enabled"]) == 1
    except:
        return False

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


def prompt_for_comments():
    """Prompts the user for comments

    Returns:
        The comments as str
    """

    return prompt("Comments: ").strip()


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


def get_current_config(mrs_config=None):
    """Gets the active config dict

    If no config dict is given as parameter, the global config dict will be used

    Args:
        config (dict): The config to be used or None

    Returns:
        The active config dict
    """
    if mrs_config is None:
        # Check if global object 'mrs_config' has already been registered
        if "mrs_config" in dir(mysqlsh.globals):
            mrs_config = getattr(mysqlsh.globals, "mrs_config")
        else:
            mrs_config = {}
            setattr(mysqlsh.globals, "mrs_config", mrs_config)

    return mrs_config


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


def check_request_path(session, request_path):
    """Checks if the given request_path is valid and unique

    Args:
        request_path (str): The request_path to check
        **kwargs: Additional options

    Keyword Args:
        session (object): The database session to use

    Returns:
        None
    """
    if not request_path:
        raise Exception("No request_path specified.")

    # Check if the request_path already exists for another db_object of that
    # schema
    res = session.run_sql(
        """
        SELECT CONCAT(COALESCE(se.in_development->>'$.developers', ''), h.name,
            se.url_context_root) as full_request_path
        FROM `mysql_rest_service_metadata`.service se
            LEFT JOIN `mysql_rest_service_metadata`.url_host h
                ON se.url_host_id = h.id
        WHERE CONCAT(h.name, se.url_context_root) = ?
        UNION
        SELECT CONCAT(COALESCE(se.in_development->>'$.developers', ''), h.name, se.url_context_root,
            sc.request_path) as full_request_path
        FROM `mysql_rest_service_metadata`.db_schema sc
            LEFT OUTER JOIN `mysql_rest_service_metadata`.service se
                ON se.id = sc.service_id
            LEFT JOIN `mysql_rest_service_metadata`.url_host h
                ON se.url_host_id = h.id
        WHERE CONCAT(h.name, se.url_context_root,
                sc.request_path) = ?
        UNION
        SELECT CONCAT(COALESCE(se.in_development->>'$.developers', ''), h.name, se.url_context_root,
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
        SELECT CONCAT(COALESCE(se.in_development->>'$.developers', ''), h.name, se.url_context_root,
            co.request_path) as full_request_path
        FROM `mysql_rest_service_metadata`.content_set co
            LEFT OUTER JOIN `mysql_rest_service_metadata`.service se
                ON se.id = co.service_id
            LEFT JOIN `mysql_rest_service_metadata`.url_host h
                ON se.url_host_id = h.id
        WHERE CONCAT(h.name, se.url_context_root,
                co.request_path) = ?
        """,
        [request_path, request_path, request_path, request_path],
    )

    row = res.fetch_one()

    if row and row.get_field("full_request_path") != "":
        raise Exception(f"The request_path {request_path} is already " "in use.")


def check_mrs_object_name(session, db_schema_id, obj_id, obj_name):
    """Checks if the given mrs object name is valid and unique"""
    res = session.run_sql(
        """
            SELECT o.name
            FROM mysql_rest_service_metadata.object o LEFT JOIN
                mysql_rest_service_metadata.db_object dbo ON
                o.db_object_id = dbo.id
            WHERE dbo.db_schema_id = ? AND UPPER(o.name) = UPPER(?) AND o.id <> ?
        """,
        [
            id_to_binary(db_schema_id, "db_schema_id"),
            obj_name,
            id_to_binary(obj_id, "object.id"),
        ],
    )

    row = res.fetch_one()

    if row and row.get_field("name") != "":
        raise Exception(
            f"The object name {obj_name} is already " "in use on this REST schema."
        )


def check_mrs_object_names(session, db_schema_id, objects):
    """Checks if the given mrs object names are valid and unique"""
    if objects is None:
        return

    assigned_names = []
    for obj in objects:
        if obj.get("name") in assigned_names:
            raise Exception(
                f'The object name {obj.get("name")} has been used more than once.'
            )
        check_mrs_object_name(
            session=session,
            db_schema_id=db_schema_id,
            obj_id=obj.get("id"),
            obj_name=obj.get("name"),
        )
        assigned_names.append(obj.get("name"))


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


def id_to_binary(id: str, context: str, allowNone=False):
    if allowNone and id is None:
        return None
    if isinstance(id, bytes):
        return id
    elif isinstance(id, str):
        if id.startswith("0x"):
            try:
                result = bytes.fromhex(id[2:])
            except Exception:
                raise RuntimeError(f"Invalid hexadecimal string '{id}' for '{context}'.")
        elif id.endswith("=="):
            try:
                result = base64.b64decode(id, validate=True)
            except Exception:
                raise RuntimeError(f"Invalid base64 string '{id}' for '{context}'.")
        else:
            raise RuntimeError(f"Invalid id format '{id}' for '{context}'.")


        if len(result) != 16:
            raise RuntimeError(f"The '{context}' has an invalid size.")
        return result

    raise RuntimeError(f"Invalid id type for '{context}'.")


def convert_id_to_base64_string(id) -> str:
    return base64.b64encode(id).decode('ascii')


def convert_ids_to_binary(id_options, kwargs):
    for id_option in id_options:
        id = kwargs.get(id_option)
        if id is not None:
            kwargs[id_option] = id_to_binary(id, id_option)

def try_convert_ids_to_binary(id_options, kwargs):
    """
    Try to convert the kwargs ID entries, but don't fail if it's an invalid ID type.

    The entry may or may not be an ID, but it needs not to fail if it's not.
    An use case for this is when we want a parameter, for example 'service',
    that can be one of the following:
      - 'localhost@myService'
      - '0x11EF8496143CFDEC969C7413EA499D96'
      - 'Ee+ElhQ8/eyWnHQT6kmdlg=='
    """
    for id_option in id_options:
        id = kwargs.get(id_option)
        if id is not None:
            try:
                kwargs[id_option] = id_to_binary(id, id_option)
            except RuntimeError as e:
                if str(e) in [f"Invalid id type for '{id_option}'.", f"Invalid id format '{kwargs[id_option]}' for '{id_option}'."]:
                    continue
                raise

def convert_id_to_string(id) -> str:
    return f"0x{id.hex()}"


def convert_dict_to_json_string(dic) -> str:
    if dic is None:
        return None
    return json.dumps(dict(dic))


def _generate_where(where):
    if where:
        if isinstance(where, list):
            return " WHERE " + " AND ".join(where)
        else:
            return " WHERE " + where
    return ""


def _generate_table(table):
    if "." in table:
        return table
    return f"`mysql_rest_service_metadata`.`{table}`"


def _generate_qualified_name(name):
    if "." in name:
        return name
    parts = name.split("(")
    result = f"`mysql_rest_service_metadata`.`{parts[0]}`"
    if len(parts) == 2:  # it's a function call so add the parameters
        result = f"{result}({parts[1]}"

    return result


class MrsDbExec:
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
    def dump(self) -> "MrsDbExec":
        print(f"sql: {self._sql}\nparams: {self._params}")
        return self

    def exec(self, session, params=[]) -> "MrsDbExec":
        self._params = self._params + params
        try:
            # convert lists and dicts to store in the database
            self._params = [self._convert_to_database(param) for param in self._params]

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
        result = get_sql_result_as_dict_list(self._result, self._binary_formatter)
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


def select(
    table: str, cols=["*"], where=[], order=None, binary_formatter=None
) -> MrsDbExec:
    if not isinstance(cols, str):
        cols = ",".join(cols)
    if order is not None and not isinstance(order, str):
        order = ",".join(order)
    sql = f"""
        SELECT {cols}
        FROM {_generate_table(table)}
        {_generate_where(where)}"""
    if order:
        sql = f"{sql} ORDER BY {order}"

    return MrsDbExec(sql, binary_formatter=binary_formatter)


def update(table: str, sets, where=[]) -> MrsDbExec:
    params = []
    if isinstance(sets, list):
        sets = ",".join(sets)
    elif isinstance(sets, dict):
        params = [value for value in sets.values()]
        sets = ",".join([f"{key}=?" for key in sets.keys()])

    sql = f"""
        UPDATE {_generate_table(table)}
        SET {sets}
        {_generate_where(where)}"""

    return MrsDbExec(sql, params)


def delete(table: str, where=[]) -> MrsDbExec:
    sql = f"""
        DELETE FROM {_generate_table(table)}
        {_generate_where(where)}"""

    return MrsDbExec(sql)


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
        INSERT INTO {_generate_table(table)}
        ({cols})
        VALUES
        ({place_holders})
    """
    return MrsDbExec(sql, params)


def get_sequence_id(session):
    return (
        MrsDbExec(f"SELECT {_generate_qualified_name('get_sequence_id()')} as id")
        .exec(session)
        .first["id"]
    )


class MrsDbSession:
    def __init__(self, **kwargs) -> None:
        self._session = get_current_session(kwargs.get("session"))
        self._exception_handler = kwargs.get("exception_handler")
        check_version = kwargs.get("check_version", True)
        if mrs_metadata_schema_exists(self._session) and check_version:
            current_db_version = get_mrs_schema_version(self._session)
            if current_db_version[0] < 2:
                raise Exception(
                    "This MySQL Shell version requires a new major version of the MRS metadata schema, "
                    f"{general.DB_VERSION_STR}. The currently deployed schema version is "
                    f"{'%d.%d.%d' % tuple(current_db_version)}. Please downgrade the MySQL Shell version "
                    "or drop the MRS metadata schema and run `mrs.configure()`."
                )

    def __enter__(self):
        return self._session

    def __exit__(self, exc_type, exc_value, exc_traceback):
        if exc_type is None:
            return

        if get_interactive_default() and self._exception_handler:
            return self._exception_handler(exc_type, exc_value, exc_traceback)
        return False

    @property
    def session(self):
        return self._session


class MrsDbTransaction:
    def __init__(self, session) -> None:
        self._session = session

    def __enter__(self) -> "MrsDbTransaction":
        self._session.run_sql("START TRANSACTION")
        return self

    def __exit__(self, exc_type, exc_value, exc_traceback) -> bool:
        if exc_type is None:
            self._session.run_sql("COMMIT")
            return

        self._session.run_sql("ROLLBACK")
        return False


def create_identification_conditions(id, name, id_context, name_col):
    """
    Creates the necessary SQL WHERE conditions to identify an MRS object based given
    id and identification string.
    """
    conditions = {}

    if id is not None:
        conditions["id"] = id
    if name is not None:
        conditions[name_col] = name

    return conditions


def identify_target_object(
    session, service_conditions, schema_conditions, object_conditions
):
    """
    Uses the given identification conditions for service, schema and object to uniquely
    identify a specific object, either service, schema or object.

    The function throws an error if either:
    - The conditions identify no object.
    - The conditions identify more than one object.

    Returns the type of identified object and its id.
    """
    tables = []
    target_object = ""
    id_field = ""
    conditions = []
    params = []

    # service table is included in the query either when service conditions are given
    # or when no conditions are given
    if service_conditions or (not schema_conditions and not object_conditions):
        tables.append("mysql_rest_service_metadata.service se")
        target_object = "service"
        id_field = "se.id"

    # schema table is included in the query whenever schema or object conditions are
    # given
    if schema_conditions or object_conditions:
        tables.append("mysql_rest_service_metadata.db_schema sc")
        if service_conditions:
            conditions.append("sc.service_id = se.id")
        target_object = "schema"
        id_field = "sc.id"

    # object table is included on the query when object conditions are given
    if object_conditions:
        tables.append("mysql_rest_service_metadata.db_object ob")
        if service_conditions or schema_conditions:
            conditions.append("ob.db_schema_id = sc.id")
        target_object = "object"
        id_field = "ob.id"

    if service_conditions:
        for column, value in service_conditions.items():
            conditions.append(f"se.{column}=?")
            params.append(value)

    if schema_conditions:
        for column, value in schema_conditions.items():
            conditions.append(f"sc.{column}=?")
            params.append(value)

    if object_conditions:
        for column, value in object_conditions.items():
            conditions.append(f"ob.{column}=?")
            params.append(value)

    where = ""
    if conditions:
        cond_string = " AND ".join(conditions)
        where = f"WHERE {cond_string}"

    sql = f"""SELECT {id_field} FROM {" INNER JOIN ".join(tables)} {
        where} LIMIT 2"""

    result = session.run_sql(sql, params)

    rows = result.fetch_all()

    if len(rows) != 1:
        raise RuntimeError(
            f"Unable to identify a unique {target_object} for the operation."
        )

    return target_object, rows[0][0]


def get_session_uri(session):
    if "shell.Object" in str(type(session)):
        uri = session.get_uri()
    else:
        uri = session.session.get_uri()

    uri = uri.split("?")[0]

    return uri


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


def unquote(name):
    # TODO- remove this, it doesn't work
    if name.startswith("`"):
        return name.strip("`")
    elif name.startswith('"'):
        return name.strip('"')

    return name


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


def escape_wildcards(text: str) -> str:
    "escape * and ? wildcards with \\"
    return text.replace("\\", "\\\\").replace("*", "\\*").replace("?", "\\?")


def unescape_wildcards(text: str) -> str:
    return text.replace("\\*", "*").replace("\\?", "?").replace("\\\\", "\\")


def contains_wildcards(text: str) -> str:
    stripped = text.replace("\\\\", "").replace("\\?", "").replace("\\*", "")
    return "?" in stripped or "*" in stripped


def format_result(result):
    if len(result) > 0:
        columns = list(result[0].keys())

        # Get max_col_lengths
        max_lengths = {}
        # Initialize with column name lengths
        for col in columns:
            max_lengths[col] = len(col)
        # Loop over all rows and check if a field length is bigger
        for row in result:
            for col in columns:
                field = str(row.get(col))
                current_length = max_lengths.get(col, 0)
                length = len(field)

                # If the field contains linebreaks, consider the longest line
                if "\n" in field:
                    length = 0
                    for ln in field.split("\n"):
                        if len(ln) > length:
                            length = len(ln)

                if length > current_length:
                    max_lengths[col] = length

        h_sep = "+"
        for col in columns:
            h_sep += "-" * (max_lengths[col] + 2) + "+"

        formatted_res = h_sep + "\n" + "|"
        for col in columns:
            formatted_res += f' {col}{" " * (max_lengths[col] - len(col))} |'
        formatted_res += "\n" + h_sep + "\n"

        for row in result:
            formatted_res += "|"
            for index, col in enumerate(columns):
                f = str(row.get(col))

                # If there are linebreaks in the field, add each line and extend the grid
                if "\n" in f:
                    pre = "| "
                    post = " "
                    for i, c in enumerate(columns):
                        if i < index:
                            pre += f'{" " * max_lengths[c]} | '
                        elif i > index:
                            post += f'{" " * max_lengths[c]} | '
                    pre = pre[:-1]
                    post = post[:-1]

                    lines = f.split("\n")
                    for ln_i, ln in enumerate(lines):
                        if ln_i > 0:
                            formatted_res += pre
                        formatted_res += f' {ln}{" " *
                                                 (max_lengths[col] - len(ln))} |'
                        if ln_i < len(lines) - 1:
                            formatted_res += post + "\n"
                else:
                    formatted_res += f' {f}{" " *
                                            (max_lengths[col] - len(f))} |'

            formatted_res += "\n"

        return formatted_res + h_sep

    # To make handling easier, return an empty string if there are no rows so
    # the result does not have to be checked for None
    return ""


def is_text(data: bytes) -> bool:
    if isinstance(data, str):
        data = data.encode()

    valid_text__chars = "".join(
        list(map(chr, range(32, 127))) + list("\n\r\t\b"))

    data_without_text = data.translate(None, valid_text__chars.encode())

    # If there's a null character, then it's not a text string
    if 0 in data_without_text:
        return False

    # Check how many bytes are available after removing the ones that
    # are considered as text.
    if len(data_without_text) >= len(data) * 0.3:
        # if more then 30% if the characters are binary, then
        # take the data as binary
        return False

    return True


def is_number(s):
    try:
        float(s)
    except ValueError:
        return False

    return True


class _NotSet: # used to differentiate None (NULL) vs argument not set
    def __bool__(self):
        return False

NotSet = _NotSet()
