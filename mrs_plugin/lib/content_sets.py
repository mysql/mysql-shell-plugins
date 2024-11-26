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

from mrs_plugin.lib import core, content_files, services, schemas, db_objects
from mrs_plugin.lib.MrsDdlExecutor import MrsDdlExecutor

import os
import re
import json
import pathlib
import datetime
from urllib.request import urlopen
import tempfile
import zipfile
import ssl
import shutil

OPENAPI_UI_URL = "http://github.com/swagger-api/swagger-ui/archive/refs/tags/v5.17.14.zip"
OPENAPI_DARK_CSS_URL = "https://github.com/Amoenus/SwaggerDark/releases/download/v1.0.0/SwaggerDark.css"

# The regex below require that all comments and strings have been blanked before

# Regex to match 9 levels of matching curly brackets { }
MATCHING_CURLY_BRACKETS_REGEX = \
    r"({(?:(?:{(?:(?:{(?:(?:{(?:(?:{(?:(?:{(?:(?:{(?:(?:{(?:(?:{[^}{]*})|[^}{])*})|[^}{])*})|[^}{])*})|[^}{])*})|[^}{])*})|[^}{])*})|[^}{])*})|[^}{])*})"

# Regex to match MRS schema decorator and class content
TS_SCHEMA_DECORATOR_REGEX = \
    r"@Mrs\.(schema|module)\s*\(\s*{(.*?)}\)\s*class\s*([\w$]+)\s*" + \
    MATCHING_CURLY_BRACKETS_REGEX

# Regex to match decorator parameters represented as values in a dict with stripped curly brackets { }
# e.g. name: "mrs_notes_scripts", enabled: true, triggerType: MrsScriptFunctionType.BeforeUpdate,
TS_DECORATOR_PROPS_REGEX = \
    r"\s*(\w*)\s*:\s*((\"[^\"\\]*(?:\\.[^\"\\]*)*\")|(\'[^\'\\]*(?:\\.[^\'\\]*)*\')|(\`[^\`\\]*(?:\\.[^\`\\]*)*\`)|" + \
    MATCHING_CURLY_BRACKETS_REGEX + \
    r"|([\w\.]*))"

# Regex to match MRS script/trigger decorator and function content
TS_SCRIPT_DECORATOR_REGEX = \
    r"@Mrs\.(script|trigger)\s*\(\s*{(.*?)}\s*\)\s*public\s*static\s*(async)?\s*([\w\d_]+)\s*\((.*?)\)\s*:\s*(.*?)\s*" + \
    MATCHING_CURLY_BRACKETS_REGEX

# Regex to match each parameter + type
TS_SCRIPT_PARAMETERS_REGEX = \
    r"\s*(.*?)(\?)?\s*(:\s*(.*?)\s*)?(=\s*(.*?))?,"

# Regex to remove Promise<> from the result type
TS_SCRIPT_RESULT_REMOVE_PROMISE_REGEX = \
    r"Promise\s*<(.*?)>\s*$"

# Regex to match TS interface definitions
TS_INTERFACE_REGEX = \
    r"export\s+interface\s+(.+?)\s+(extends\s+(.+?))?\s*" + \
    MATCHING_CURLY_BRACKETS_REGEX

# Regex to match TS interface fields
TS_INTERFACE_FIELDS_REGEX = \
    r"\s*(readonly\s+)?(\[\s*(.+?)\s*:\s*(.+?)\s*\]|.+?)(\?)?\s*:\s*(.+?)\s*[,;]"


def format_content_set_listing(content_sets, print_header=False):
    """Formats the listing of content_sets

    Args:
        content_sets (list): A list of content_sets as dicts
        print_header (bool): If set to true, a header is printed


    Returns:
        The formatted list of services
    """

    if not content_sets:
        return "No items available."

    if print_header:
        output = (f"{'ID':>3} {'PATH':96} {'ENABLED':8} "
                  f"{'AUTH':9}\n")
    else:
        output = ""

    for i, item in enumerate(content_sets, start=1):
        url = (item['host_ctx'] + item['request_path'])
        output += (f"{i:>3} {url[:95]:96} "
                   f"{'Yes' if item['enabled'] else '-':8} "
                   f"{'Yes' if item['requires_auth'] else '-':5}")
        if i < len(content_sets):
            output += "\n"

    return output


def delete_content_set(session, content_set_ids: list):
    if not content_set_ids:
        raise ValueError("The specified content_set was not found.")

    for content_set_id in content_set_ids:
        content_set = get_content_set(
            session=session, content_set_id=content_set_id)

        # core.delete(table="content_file", where="content_set_id=?").exec(
        #     session, [content_set_id])
        if not core.delete(table="content_set", where="id=?").exec(session, [content_set_id]).success:
            raise Exception(
                f"The specified content_set with id {content_set_id} was "
                "not found.")

        # Perform cleanup of corresponding db_schema that is a SCRIPT_MODULE, if it has no scripts left
        if content_set.get("content_type") == "SCRIPTS":
            rows = core.MrsDbExec("""
                SELECT id FROM `mysql_rest_service_metadata`.`db_schema` AS s
                WHERE schema_type = 'SCRIPT_MODULE' AND (
                    SELECT COUNT(*) FROM `mysql_rest_service_metadata`.`db_object` AS o
                    WHERE o.db_schema_id = s.id) = 0
                """).exec(session).items
            for row in rows:
                core.delete(table="db_schema", where="id=?").exec(
                    session, [row["id"]])


def enable_content_set(session, content_set_ids: list, value: bool):
    """Makes a given change to a MRS content set

    Args:
        value (bool): Update value for the 'enabled' status
        content_set_ids (list): The list of content set ids to update
        session (object): The database session to use

    Returns:
        The result message as string
    """
    if not content_set_ids:
        raise ValueError("The specified content_set was not found.")

    # Update all given services
    for content_set_id in content_set_ids:
        result = core.update(table="content_set",
                             sets={"enabled": value},
                             where="id=?"
                             ).exec(session, [content_set_id])


def query_content_sets(session, content_set_id: bytes = None, service_id: bytes = None,
                       request_path=None, include_enable_state=None):
    """Gets a specific MRS content_set

    Args:
        session (object): The database session to use.
        service_id: The id of the service
        request_path (str): The request_path of the content_set
        content_set_id: The id of the content_set
        include_enable_state (bool): Only include items with the given
            enabled state

    Returns:
        The schema as dict or None on error in interactive mode
    """
    if request_path and not request_path.startswith('/'):
        raise Exception("The request_path has to start with '/'.")

    # Build SQL based on which input has been provided
    sql = """
        SELECT cs.id, cs.service_id, cs.request_path, cs.requires_auth,
            cs.enabled, cs.comments, cs.options,
            CONCAT(h.name, se.url_context_root) AS host_ctx,
            cs.content_type
        FROM `mysql_rest_service_metadata`.`content_set` cs
            LEFT OUTER JOIN `mysql_rest_service_metadata`.`service` se
                ON se.id = cs.service_id
            LEFT JOIN `mysql_rest_service_metadata`.`url_host` h
                ON se.url_host_id = h.id
        """
    params = []
    wheres = []
    if service_id:
        wheres.append("cs.service_id = ?")
        params.append(service_id)
    if request_path:
        wheres.append("cs.request_path = ?")
        params.append(request_path)
    if content_set_id:
        wheres.append("cs.id = ?")
        params.append(content_set_id)
    if include_enable_state is not None:
        wheres.append("cs.enabled = ?")
        params.append("TRUE" if content_set_id else "FALSE")

    sql += core._generate_where(wheres)

    return core.MrsDbExec(sql, params).exec(session).items


def get_content_set(session, service_id: bytes | None = None, request_path=None, content_set_id: bytes | None = None) -> dict | None:
    """Gets a specific MRS content_set

    Args:
        session (object): The database session to use.
        service_id: The id of the service
        request_path (str): The request_path of the content_set
        content_set_id: The id of the content_set

    Returns:
        The schema as dict or None on error in interactive mode
    """
    if request_path and not request_path.startswith('/'):
        raise Exception("The request_path has to start with '/'.")

    # Build SQL based on which input has been provided
    result = query_content_sets(session=session, content_set_id=content_set_id,
                                service_id=service_id, request_path=request_path)
    return result[0] if result else None


def get_content_sets(session, service_id: bytes, include_enable_state=None, request_path=None):
    """Returns all content sets for the given MRS service

    Args:
        session (object): The database session to use.
        service_id: The id of the service to list the schemas from
        include_enable_state (bool): Only include items with the given
            enabled state

    Returns:
        Either a string listing the content sets when interactive is set or list
        of dicts representing the content sets
    """

    return query_content_sets(session=session, service_id=service_id,
                              request_path=request_path, include_enable_state=include_enable_state)


def get_content_set_count(session, service_id: bytes):
    sql = "SELECT COUNT(*) FROM `mysql_rest_service_metadata`.`content_set` cs WHERE cs.service_id = ?"
    res = core.MrsDbExec(sql, [service_id]).exec(session).first

    return res[0]


def add_content_set(session, service_id, request_path, requires_auth=False, comments="", options=None, enabled=1,
                    content_dir=None, send_gui_message=None, service=None, ignore_list=None):

    core.Validations.request_path(request_path, session=session)

    if ignore_list is None:
        ignore_list = "*node_modules/*, */.*"

    contains_mrs_scripts = False
    if options is not None:
        contains_mrs_scripts = options.get("contains_mrs_scripts", False)
        mrs_script_language = options.get("mrs_scripting_language", None)
        if contains_mrs_scripts is True and mrs_script_language is None:
            mrs_script_language = get_folder_mrs_scripts_language(
                path=content_dir, ignore_list=ignore_list)
            if mrs_script_language is None:
                raise ValueError(
                    "The MRS scripting language has no been specified and cannot be detected.")

    # Check if the open_api_ui should be downloaded and if so, download it, extract and patch it and
    # update the content_dir to point to the temporary directory holding it
    open_api_ui = False
    if content_dir is not None:
        if content_dir.lower() == "open-api-ui":
            open_api_ui = True
            content_dir = prepare_open_api_ui(
                service=service, request_path=request_path, send_gui_message=send_gui_message)

        # Convert Unix path to Windows
        content_dir = os.path.abspath(
            os.path.expanduser(content_dir))

        # If a content_dir has been provided, check if that directory exists
        if not os.path.isdir(content_dir):
            raise ValueError(
                f"The given content directory path '{content_dir}' "
                "does not exist.")

    content_set_id = core.get_sequence_id(session)
    values = {
        "id": content_set_id,
        "service_id": service_id,
        "request_path": request_path,
        "requires_auth": int(requires_auth),
        "enabled": int(enabled),
        "comments": comments,
        "options": options,
        "content_type": "STATIC" if not contains_mrs_scripts else "SCRIPTS",
    }

    # Create the content_set, ensure it is created as "not enabled"
    core.insert(table="content_set", values=values).exec(session)

    file_list = None
    if content_dir is not None:
        file_list = content_files.add_content_dir(
            session, content_set_id,
            content_dir, requires_auth,
            ignore_list,
            send_gui_message=send_gui_message
        )

        if contains_mrs_scripts:
            # Update db_schemas/db_objects based on script definition
            script_def = update_scripts_from_content_set(
                session=session, content_set_id=content_set_id,
                language=mrs_script_language,
                content_dir=content_dir,
                ignore_list=ignore_list,
                send_gui_message=send_gui_message)

            if len(script_def["errors"]) > 0:
                raise ValueError(
                    "The following errors occurred when parsing the MRS Scripts:\n"
                    + json.dumps(script_def["errors"]))

        # Enable the content set if requested by the user
        enable_content_set(
            session=session, content_set_ids=[content_set_id], value=enabled)

    # In case the open_api_ui was downloaded, make sure to delete the temporary folder it used
    if open_api_ui == True:
        shutil.rmtree(content_dir)

    return values["id"], len(file_list) if file_list is not None else 0


def update_content_set(session, content_set_id, value, file_ignore_list=None, send_gui_message=None):
    if value is None:
        raise ValueError(
            "Failed to update REST content set. No values specified.")

    options = value.get("options", {})

    contains_mrs_scripts = options.get("contains_mrs_scripts", False)
    mrs_script_language = options.get("mrs_scripting_language", None)
    if contains_mrs_scripts is True and mrs_script_language is None:
        raise ValueError(
            "Failed to update REST content set. The options are missing the `mrs_scripting_language` setting.")

    if contains_mrs_scripts is True:
        value["content_type"] = "SCRIPTS"

    core.update(
        table="content_set",
        sets=value,
        where=["id=?"]
    ).exec(session, [content_set_id])

    if contains_mrs_scripts:
        # Update db_schemas/db_objects based on script definition
        script_def = update_scripts_from_content_set(
            session=session, content_set_id=content_set_id,
            language=mrs_script_language,
            ignore_list=file_ignore_list,
            send_gui_message=send_gui_message)

        if len(script_def["errors"]) > 0:
            raise ValueError(
                "The following errors occurred when parsing the MRS Scripts:\n"
                + json.dumps(script_def["errors"]))


def get_current_content_set(session):
    """Returns the current content_set

    This only applies to interactive sessions in the shell where the
    id of the current content_set is stored in the global config

    Args:
        session (object): The database session to use.

    Returns:
        The current content_set or None if no current content_set was set
    """

    # Get current_service_id from the global mrs_config
    mrs_config = core.get_current_config()
    current_content_set_id = mrs_config.get('current_content_set_id')

    current_content_set = None
    if current_content_set_id:
        current_content_set = get_content_set(
            content_set_id=current_content_set_id,
            session=session)

    return current_content_set


def blank_js_comments(s, blank_char=" "):
    pattern = r"(\".*?(?<!\\)\"|\'.*?(?<!\\)\')|(/\*.*?\*/|//[^\r\n]*$)"
    regex = re.compile(pattern, re.MULTILINE | re.DOTALL)
    cleaner_regex = re.compile(r"[^\n]*", re.MULTILINE | re.DOTALL)

    # def _replacer(match):
    #     if match.group(2) is not None:
    #         # Replace multi-line comments with an empty comment
    #         if match.group(2).count("\n") > 0:
    #             return "/*" + "\n" * match.group(2).count("\n") + "*/"
    #         return ""
    #     else:
    #         return match.group(1)

    def _replacer(match: re.Match):
        if match.group(2) is not None:
            # Blank single line comments
            if match.group(2).startswith("//"):
                return "//" + " " * (match.end(2) - match.start(2) - 2)

            # For multi-line strings, ensure to keep line breaks in place. Replace all other characters.
            def __replacer(match2: re.Match):
                blanked_string = blank_char * (match2.end() - match2.start())

                return blanked_string

            return "/*" + cleaner_regex.sub(__replacer, match.group())[2:-2] + "*/"
        else:
            return match.group(1)

    return regex.sub(_replacer, s)


def blank_quoted_js_strings(s, blank_char=" "):
    # Blank strings with all allowed string quotes in JS
    s = blank_quoted_strings(s, '"', r'\"', blank_char)
    s = blank_quoted_strings(s, "'", r"\'", blank_char)
    s = blank_quoted_strings(s, "`", r"\`", blank_char)

    return s


def blank_quoted_strings(s, quote_char, quote_r_char, blank_char=" "):
    # Build the pattern like this, showcasing it for \": r"\"[^\"\\]*(?:\\.[^\"\\]*)*\""
    pattern = quote_r_char + \
        r"[^" + quote_r_char + \
        r"\\]*(?:\\.[^" + quote_r_char + r"\\]*)*" + quote_r_char
    regex = re.compile(pattern, re.MULTILINE | re.DOTALL)
    cleaner_regex = re.compile(r"[^\n]*", re.MULTILINE | re.DOTALL)

    def _replacer(match: re.Match):
        def __replacer(match2: re.Match):
            blanked_string = blank_char * (match2.end() - match2.start())

            return blanked_string

        return quote_char + cleaner_regex.sub(__replacer, match.group())[1:-1] + quote_char

    # def _replacer(match: re.Match):
    #     print(f"{match.group()=}")

    #     if "\n" in match.group():
    #         linebreaks = match.group().count("\n")
    #         replace_with = quote_char + " " * (match.end() - match.start() - 2 - linebreaks) + "\n" * linebreaks + quote_char
    #     else:
    #         replace_with = quote_char + " " * (match.end() - match.start() - 2) + quote_char

    #     print(f"{replace_with=}")
    #     return replace_with

    return regex.sub(_replacer, s)


def convert_ignore_list_to_regex_pattern(ignore_list):
    ignore_patterns = []
    for pattern in ignore_list.split(","):
        ignore_patterns.append(pattern.strip().replace("\\", "/").replace(".", "\\.").replace(
            "*", ".*").replace("?", "."))
    if len(pattern) > 0:
        return re.compile(
            "(" + ")|(".join(ignore_patterns) + ")", flags=re.MULTILINE | re.DOTALL)
    return None


def get_folder_mrs_scripts_language(path, ignore_list):
    full_ignore_pattern = convert_ignore_list_to_regex_pattern(ignore_list)

    path = os.path.expanduser(path)

    for root, dirs, files in os.walk(path):
        for file in files:
            fullname = os.path.join(root, file)

            # If the filename matches the ignore list, ignore the file
            if full_ignore_pattern is not None and re.match(full_ignore_pattern, fullname.replace("\\", "/")):
                continue

            # Detect TypeScript
            if ((fullname.endswith(".mts") or fullname.endswith(".ts"))
                and not (fullname.endswith(".spec.mts")
                         or fullname.endswith(".spec.ts")
                         or fullname.endswith(".d.ts"))):

                # Read the file content
                with open(fullname, 'r') as f:
                    code = f.read()

                    # Clear TypeScript comments and strings for regex matching
                    code_cleared = blank_quoted_js_strings(
                        blank_js_comments(code))

                    # Search for SCHEMA_DECORATOR
                    match = re.search(
                        TS_SCHEMA_DECORATOR_REGEX, code_cleared, re.MULTILINE | re.DOTALL)

                    if match is not None:
                        return "TypeScript"

    return None


def get_decorator_param_value(param_value):
    if param_value.startswith('"') or param_value.startswith("'") or param_value.startswith("`"):
        param_value = param_value[1:-1]
    elif param_value.startswith("{"):
        # Make sure to match on a version of param_value with blanked out strings
        param_value_blanked = blank_quoted_js_strings(param_value)

        # Remove comma on last item if present

        # Instead of a simple re.sub() perform the replacement on the original param_value, not the one with
        # blanked strings. Also, do the replacement from bottom up, since the chars are removed and the matched
        # positions would get out of sync with the original param_value
        matches = re.finditer(r",\s*}", param_value_blanked,
                              re.MULTILINE | re.DOTALL)
        for match in reversed(list(matches)):
            param_value = param_value[0:match.start(
            )] + "}" + param_value[match.end():]

        # since the original param_value was changed, get a new blanked version
        param_value_blanked = blank_quoted_js_strings(param_value)

        # Add quotes to keys
        matches = re.finditer(
            r"(?<={|,)\s*([a-zA-Z][a-zA-Z0-9]*)(?=:)", param_value_blanked, re.MULTILINE | re.DOTALL)
        for match in reversed(list(matches)):
            param_value = param_value[0:match.start(1)] + \
                '"' + \
                param_value[match.start(1):match.end(
                    1)] + '"' + param_value[match.end(1):]

        try:
            param_value = json.loads(param_value)
        except:
            pass
    else:
        param_value = param_value.strip()
        if param_value.lower() == "true":
            param_value = True
        elif param_value.lower() == "false":
            param_value = False
        else:
            try:
                param_value = float(param_value)
            except:
                pass

    return param_value


def get_decorator_properties(code, code_cleared, start, end):
    props = []
    matches = re.finditer(
        TS_DECORATOR_PROPS_REGEX, code_cleared[start:end], re.MULTILINE | re.DOTALL)

    # for match_id, match in enumerate(matches, start=1):
    # print("Match {matchNum} was found at {start}-{end}: {match}".format(
    #     matchNum=match_id, start=match.start(), end=match.end(), match=match.group()))
    # for groupNum in range(0, len(match.groups())):
    #     groupNum = groupNum + 1
    #     print("Group {groupNum} found at {start}-{end}: {group}".format(groupNum=groupNum, start=match.start(
    #         groupNum), end=match.end(groupNum), group=match.group(groupNum)))

    for match in matches:
        prop_value = code[
            start + match.start(2):start + match.end(2)]
        props.append({
            "name": match.group(1),
            "value": get_decorator_param_value(prop_value),
        })

    return props


def get_function_params(code, code_cleared, start, end):
    params = []
    # Add a trailing , to allow for an easier regex
    params_string = code_cleared[start:end] + ","
    matches = re.finditer(
        TS_SCRIPT_PARAMETERS_REGEX, params_string, re.MULTILINE | re.DOTALL)

    # for match_id, match in enumerate(matches, start=1):
    #     print("Match {match_id} was found at {start}-{end}: {match}".format(
    #         match_id=match_id, start=match.start(), end=match.end(), match=match.group()))
    #     for group_id in range(0, len(match.groups())):
    #         group_id = group_id + 1
    #         print("Group {group_id} found at {start}-{end}: {group}".format(group_id=group_id,
    #               start=match.start(group_id), end=match.end(group_id), group=match.group(group_id)))

    for match in matches:
        # Ignore additional match caused by adding the "," above
        if match.group(1) == "":
            continue

        # If a default value is given for the parameter, also get its type
        optional = match.group(2) is not None
        if match.group(6) is not None:
            optional = True
            default_value = code[start + match.start(6):start + match.end(6)]
            if core.is_number(default_value):
                default_value = float(default_value)
                default_type = "number"
            elif default_value == "true" or default_value == "false":
                default_value = default_value == "true"
                default_type = "boolean"
            else:
                if default_value[0] == "'" or default_value[0] == '"':
                    default_value = default_value[1:-1]
                    default_type = "string"
        else:
            default_value = None
            default_type = "unknown"

        param_type = match.group(4) if match.group(
            4) is not None else default_type
        param_type_array = False
        if param_type.endswith("[]"):
            param_type = param_type[:-2]
            param_type_array = True

        param = {
            "name": match.group(1),
            "type": param_type,
            "optional": optional,
            "is_array": param_type_array,
        }

        if default_value is not None:
            param["default"] = default_value

        params.append(param)

    return params


def get_function_return_type_no_promise(code):
    result = re.findall(
        TS_SCRIPT_RESULT_REMOVE_PROMISE_REGEX, code, re.MULTILINE | re.DOTALL)

    return result[0] if len(result) > 0 else "void"


def get_typescript_interface_props(code, code_cleared, start, end):
    props = []
    # Add a trailing ; to allow for an easier regex
    props_string = code_cleared[start+1:end-1] + ";"
    matches = re.finditer(
        TS_INTERFACE_FIELDS_REGEX, props_string, re.MULTILINE | re.DOTALL)

    for match in matches:
        prop = {
            "name": match.group(2) if match.group(3) is None else match.group(3),
            "type": match.group(6),
            "optional": match.group(5) is not None,
            "readOnly": match.group(1) is not None,
        }
        if match.group(4) is not None:
            prop["indexSignatureType"] = match.group(4)
        props.append(prop)

    return props


def get_mrs_typescript_interface_definitions(file, interfaces_def):

    # Find the TS interface definitions
    matches = re.finditer(
        TS_INTERFACE_REGEX, file["code_cleared"], re.MULTILINE | re.DOTALL)

    for match in matches:
        # Get the starting line number of the class definition
        ln_number_start = file["code"].count("\n", 0, match.start()) + 1
        ln_number_end = file["code"].count("\n", 0, match.end()) + 1
        ts_interface = {
            "file_info": {
                "full_file_name": file["full_file_name"],
                "relative_file_name": file["relative_file_name"],
                "file_name": file["file_name"],
                "last_modification": file["last_modification"],
            },
            "name": match.group(1),
            "code_position": {
                "line_number_start": ln_number_start,
                "line_number_end": ln_number_end,
                "character_start": match.start(),
                "character_end": match.end(),
            },
            "properties": get_typescript_interface_props(file["code"], file["code_cleared"], match.start(4), match.end(4)),
        }
        if match.group(3) is not None:
            ts_interface["extends"] = match.group(3)

        interfaces_def.append(ts_interface)


def get_mrs_typescript_definitions(file, mrs_script_def):
    # Find the MRS Schema definitions, which map to TS classes
    matches = re.finditer(
        TS_SCHEMA_DECORATOR_REGEX, file["code_cleared"], re.MULTILINE | re.DOTALL)

    # for match_id, match in enumerate(matches, start=1):
    #     print("Match {match_id} was found at {start}-{end}: {match}".format(
    #         match_id=match_id, start=match.start(), end=match.end(), match=match.group()))
    #     for group_id in range(0, len(match.groups())):
    #         group_id = group_id + 1
    #         print("Group {group_id} found at {start}-{end}: {group}".format(group_id=group_id,
    #               start=match.start(group_id), end=match.end(group_id), group=match.group(group_id)))

    for match in matches:
        # Group 1 holds the decorator properties
        props = get_decorator_properties(
            file["code"], file["code_cleared"], match.start(2), match.end(2))

        # Get the starting line number of the class definition
        ln_number_start = file["code"].count("\n", 0, match.start()) + 1
        ln_number_end = file["code"].count("\n", 0, match.end()) + 1
        schema_def = {
            "file_info": {
                "full_file_name": file["full_file_name"],
                "relative_file_name": file["relative_file_name"],
                "file_name": file["file_name"],
                "last_modification": file["last_modification"],
            },
            "class_name": file["code"][match.start(3):match.end(3)],
            "schema_type": "SCRIPT_MODULE" if match.group(1) == "module" else "DATABASE_SCHEMA",
            "code_position": {
                "line_number_start": ln_number_start,
                "line_number_end": ln_number_end,
                "character_start": match.start(),
                "character_end": match.end(),
            },
            "properties": props,
            "scripts": [],
            "triggers": [],
        }
        mrs_script_def.append(schema_def)
        class_content = match.group(4)
        class_content_offset = match.start(4)

        script_matches = re.finditer(
            TS_SCRIPT_DECORATOR_REGEX, class_content, re.MULTILINE | re.DOTALL)

        # for script_match_id, script_match in enumerate(script_matches, start=1):
        #     print("Match {script_match_id} was found at {start}-{end}: {match}".format(
        #         script_match_id=script_match_id, start=script_match.start(), end=script_match.end(), match=script_match.group()))
        #     for group_id in range(0, len(script_match.groups())):
        #         group_id = group_id + 1
        #         print("Group {group_id} found at {start}-{end}: {group}".format(group_id=group_id, start=script_match.start(
        #             group_id), end=script_match.end(group_id), group=script_match.group(group_id)))

        for script_match in script_matches:
            ln_number_start = file["code"].count(
                "\n", 0, class_content_offset+script_match.start()) + 1
            ln_number_end = file["code"].count(
                "\n", 0, class_content_offset+script_match.end()) + 1

            # Group 2 holds the decorator params
            props = get_decorator_properties(
                file["code"], file["code_cleared"],
                class_content_offset+script_match.start(2), class_content_offset+script_match.end(2))

            params = get_function_params(
                file["code"], file["code_cleared"],
                class_content_offset+script_match.start(5), class_content_offset+script_match.end(5))

            return_type = get_function_return_type_no_promise(
                file["code"][class_content_offset+script_match.start(6):class_content_offset+script_match.end(6)])
            returns_array = False
            if return_type.endswith("[]"):
                return_type = return_type[:-2]
                returns_array = True

            script_def = {
                "function_name": file["code"][
                    class_content_offset+script_match.start(4):class_content_offset+script_match.end(4)],
                "code_position": {
                    "line_number_start": ln_number_start,
                    "line_number_end": ln_number_end,
                    "character_start": class_content_offset+script_match.start(),
                    "character_end": class_content_offset+script_match.end(),
                },
                "parameters": params,
                "return_type": {
                    "type": return_type,
                    "is_array": returns_array,
                },
                "properties": props
            }

            if script_match.group(1) == "trigger":
                schema_def["triggers"].append(script_def)
            else:
                schema_def["scripts"].append(script_def)


def is_simple_typescript_type(typeName):
    return typeName == "boolean" or typeName == "number" or typeName == "string"


def interface_derives_from(interface_name, master_interface_name, interfaces):
    if interface_name == master_interface_name:
        return True

    # Lookup the interface by name. If the interface cannot be found in the interface
    # definition list, return false
    interface = next(
        (item for item in interfaces if item["name"] == interface_name), None)
    if interface is None:
        return False

    # Check if the interface extends another interface, if not return False.
    # If it extends the desired interface, return True
    interface_extends = interface.get("extends")
    if interface_extends is None:
        return False
    if interface_extends == master_interface_name:
        return True

    # Check if the parent interface derives from the requested interface recursively and return that value
    return interface_derives_from(interface_extends, master_interface_name, interfaces)


def get_typescript_interface_from_list(type_name, interface_list):
    for interface_def in interface_list:
        if interface_def["name"] == type_name:
            return interface_def

    return None


def add_typescript_interface_to_list(type_name, interface_list, interfaces_def):
    # If the name of the type matches a simple type, do not add it
    if is_simple_typescript_type(type_name):
        return True

    # If the name is already in the list, do not add it again
    for interface_def in interface_list:
        if interface_def["name"] == type_name:
            return True

    # Look the type_name up in the list of know interface definitions
    for interface_def in interfaces_def:
        if interface_def["name"] == type_name:
            interface_list.append(interface_def)

            # If the interface extends another interface, make sure to add that interface as well, recursively
            extends = interface_def.get("extends")
            if extends is not None:  # and extends != "IMrsInterface":
                add_typescript_interface_to_list(
                    extends, interface_list, interfaces_def)
            return True

    return False


def match_typescript_script_types_to_interface_list(interfaces_def, mrs_script_def, errors):
    used_interfaces = []

    for script_module in mrs_script_def:
        for script in script_module["scripts"]:
            # Handle return type
            return_type = script["return_type"]["type"]
            if not add_typescript_interface_to_list(return_type, used_interfaces, interfaces_def):
                errors.append({
                    "kind": "TypeError",
                    "message": f"The script {script["function_name"]} returns an unknown datatype `{return_type}`.",
                    "script": script,
                    "file_info": script_module["file_info"],
                })

            # Handle parameters
            for parameter in script["parameters"]:
                param_type = parameter["type"]
                if param_type.endswith("[]"):
                    errors.append({
                        "kind": "TypeError",
                        "message": "A script parameter must not be an array. " +
                        f"The script {script["function_name"]} used `{parameter["type"]}` " +
                        f"as parameter type for `{parameter["name"]}`.",
                        "script": script,
                        "file_info": script_module["file_info"],
                    })
                elif not add_typescript_interface_to_list(param_type, used_interfaces, interfaces_def):
                    errors.append({
                        "kind": "TypeError",
                        "message":
                            f'Unknown datatype `{param_type}` used for script parameter `{
                                parameter["name"]}`.',
                        "script": script,
                        "file_info": script_module["file_info"],
                    })

    # Use a while loop here, since the used_interfaces list can grow while the looping over the list
    i = 0
    while i < len(used_interfaces):
        interface = used_interfaces[i]
        for property in interface["properties"]:
            property_type = property["type"]
            # If the property uses an array, only match the type of the array
            if property_type.endswith("[]"):
                property_type = property_type[:-2]
            if not add_typescript_interface_to_list(property_type, used_interfaces, interfaces_def):
                errors.append({
                    "kind": "TypeError",
                    "message":
                        f'Unknown datatype `{property_type}` used for interface property `{
                            property["name"]}`.',
                    "interface": interface,
                    "file_info": interface["file_info"],
                })
        i += 1

    # Check that the return_type is a simple type or derives from IMrsInterface
    # for script_module in mrs_script_def:
    #     for script in script_module["scripts"]:
    #         # Handle return type
    #         return_type = script["return_type"]["type"]

    #         if not (is_simple_typescript_type(return_type) or interface_derives_from(
    #                 return_type, "IMrsInterface", used_interfaces)):
    #             errors.append({
    #                 "kind": "TypeError",
    #                 "message": f"The datatype `{return_type}` returned by the MRS script does not derive from "
    #                 + "IMrsInterface nor is a simple type.",
    #                 "script": script,
    #                 "file_info": script_module["file_info"],
    #             })

    return used_interfaces


def get_file_mrs_script_definitions(path, language):
    path = os.path.expanduser(path)

    # Read the file content
    with open(path, 'r') as f:
        code = f.read()
        # Clear TypeScript comments and strings for regex matching
        code_cleared = blank_quoted_js_strings(
            blank_js_comments(code))
        codeFile = {
            "full_file_name": path,
            "relative_file_name": path,
            "file_name": os.path.basename(path),
            "last_modification": datetime.datetime.fromtimestamp(
                pathlib.Path(path).stat().st_mtime, tz=datetime.timezone.utc).strftime("%F %T.%f")[:-3],
            "code": code,
            "code_cleared": code_cleared,
        }

    # Progress TypeScript
    mrs_script_def = []
    if language == "TypeScript":
        get_mrs_typescript_definitions(
            file=codeFile, mrs_script_def=mrs_script_def)

    return mrs_script_def


def get_mrs_script_definitions_from_code_file_list(code_files, language, send_gui_message=None):
    # Get both, interface and script definitions
    mrs_script_modules_def = []
    interfaces_def = []
    errors = []

    if language == "TypeScript":
        for stage in ["interfaces", "scripts"]:
            for file in code_files:
                if stage == "interfaces":
                    if send_gui_message is not None:
                        send_gui_message(
                            "info", f"Parsing MRS Scripts file {file["relative_file_name"]} ...")
                    get_mrs_typescript_interface_definitions(
                        file, interfaces_def)
                elif stage == "scripts":
                    get_mrs_typescript_definitions(
                        file, mrs_script_modules_def)

        # Limit the interface list to interfaces used in scripts and check for missing interface definitions
        used_interfaces = match_typescript_script_types_to_interface_list(
            interfaces_def, mrs_script_modules_def, errors)

    mrs_script_def = {
        "script_modules": mrs_script_modules_def,
        "interfaces": used_interfaces,
        "errors": errors,
        "language": language,
    }

    return mrs_script_def


def is_common_build_folder(dir):
    if (dir.lower() == "build" or dir.lower() == "output" or dir.lower() == "out" or dir.lower() == "dist"):
        return True

    return False


def is_common_static_content_folder(dir):
    if (dir.lower() == "static" or dir.lower() == "assets" or dir.lower() == "media" or dir.lower() == "web"
        or dir.lower() == "js" or dir.lower() == "css" or dir.lower() == "images"):
        return True

    return False


def get_code_files_from_folder(path, ignore_list, language):
    full_ignore_pattern = convert_ignore_list_to_regex_pattern(ignore_list)
    path = os.path.expanduser(path)

    code_files = []
    build_folder = None
    static_content_folders = []

    for root, dirs, files in os.walk(path):
        # Check if there is a build directory with a common name in the root dir
        if path == root:
            for dir in dirs:
                if is_common_build_folder(dir):
                    build_folder = dir
                if is_common_static_content_folder(dir):
                    static_content_folders.append(dir)

        for file in files:
            fullname = os.path.join(root, file)

            # If the filename matches the ignore list, ignore the file
            if full_ignore_pattern is not None and re.match(full_ignore_pattern, fullname.replace("\\", "/")):
                continue

            # Progress TypeScript
            if language == "TypeScript" and (
                (fullname.endswith(".mts") or fullname.endswith(".ts"))
                and not (fullname.endswith(".spec.mts")
                         or fullname.endswith(".spec.ts")
                         or fullname.endswith(".d.ts"))):

                # Read the file content
                with open(fullname, 'r') as f:
                    code = f.read()
                    # Clear TypeScript comments and strings for regex matching
                    code_cleared = blank_quoted_js_strings(
                        blank_js_comments(code))

                    code_files.append({
                        "full_file_name": fullname,
                        "relative_file_name": fullname[len(path):],
                        "file_name": os.path.basename(fullname),
                        "last_modification": datetime.datetime.fromtimestamp(
                            pathlib.Path(fullname).stat().st_mtime, tz=datetime.timezone.utc).strftime("%F %T.%f")[:-3],
                        "code": code,
                        "code_cleared": code_cleared,
                    })

    return code_files, build_folder, static_content_folders


def get_folder_mrs_script_definitions(path, ignore_list, language, send_gui_message=None):
    code_files, build_folder, static_content_folders = get_code_files_from_folder(
        path=path, ignore_list=ignore_list, language=language)

    mrs_script_def = get_mrs_script_definitions_from_code_file_list(
        code_files, language, send_gui_message=send_gui_message)

    if build_folder is not None:
        mrs_script_def["build_folder"] = build_folder

    if len(static_content_folders) > 0:
        mrs_script_def["static_content_folders"] = static_content_folders

    if language == "TypeScript" and build_folder is None:
        mrs_script_def["errors"].append({
            "kind": "BuildError",
            "message": f"No build folder found for this TypeScript project. Please build the project before adding it.",
        })

    return mrs_script_def


def get_mrs_script_property(properties, name, default=None):
    if not properties:
        return default

    for property in properties:
        if property.get("name") == name:
            return property.get("value")

    return default


def print_gui_message(type, msg):
    print(f"{type.upper()}: {msg}")


def map_ts_type_to_database_type(type: str):
    match type.lower():
        case "string":
            return "text"
        case "number":
            return "decimal"
        case "boolean":
            return "bit(1)"

    return "json"


def map_ts_type_to_interface(type: str):
    match type.lower():
        case "string" | "number" | "boolean":
            return None

    return type


def update_scripts_from_content_set(session, content_set_id, language, content_dir=None, ignore_list=None,
                                    send_gui_message=None):
    if send_gui_message is None:
        send_gui_message = print_gui_message

    content_set = get_content_set(
        session=session, content_set_id=content_set_id)
    if content_set is None:
        raise ValueError(
            "Could load the MRS scripts. The given content set was not found.")

    service = services.get_service(
        session=session, service_id=content_set["service_id"])
    if service is None:
        raise ValueError(
            "Could load the MRS scripts. The content set's service was not found.")

    code_files = []
    static_content_folders = []
    if content_dir is not None:
        code_files, build_folder, static_content_folders = get_code_files_from_folder(
            path=content_dir, ignore_list=ignore_list, language=language)
    else:
        files = content_files.get_content_files(
            session=session, content_set_id=content_set_id,
            include_enable_state=True, include_file_content=True)

        for content_file in files:
            dirs = pathlib.Path(content_file["request_path"])

            if len(dirs.parts) > 0:
                if is_common_build_folder(dirs.parts[0]):
                    build_folder = dirs.parts[0]
                elif len(dirs.parts) > 1 and is_common_build_folder(dirs.parts[1]):
                    build_folder = dirs.parts[1]

                if is_common_static_content_folder(dirs.parts[0]):
                    static_content_folders.append(dirs.parts[0])
                elif len(dirs.parts) > 1 and is_common_static_content_folder(dirs.parts[1]):
                    static_content_folders.append(dirs.parts[1])

            fullname = "." + \
                content_file["content_set_request_path"] + \
                content_file["request_path"]

            # Progress TypeScript
            if language == "TypeScript" and (
                (fullname.endswith(".mts") or fullname.endswith(".ts"))
                and not (fullname.endswith(".spec.mts")
                         or fullname.endswith(".spec.ts")
                         or fullname.endswith(".d.ts"))):

                if core.is_text(content_file["content"]):
                    code = content_file["content"].decode()
                else:
                    raise ValueError(f"The content of file {
                                     fullname} is binary data, not text.")

                # Clear TypeScript comments and strings for regex matching
                code_cleared = blank_quoted_js_strings(
                    blank_js_comments(code))

                options = content_file.get("options")
                last_modification = ""
                if options is not None:
                    last_modification = options.get("last_modification", "")

                code_files.append({
                    "full_file_name": fullname,
                    "relative_file_name": fullname[len("." + content_file["content_set_request_path"]):],
                    "file_name": os.path.basename(fullname),
                    "last_modification": last_modification,
                    "code": code,
                    "code_cleared": code_cleared,
                })

    if len(code_files) == 0:
        if send_gui_message is not None:
            send_gui_message(
                "info", f"None of the files matches the specified MRS scripting language.")
        return

    if send_gui_message is not None:
        send_gui_message(
            "info", f"Parsing {len(code_files)} MRS Script files ...")

    script_def = get_mrs_script_definitions_from_code_file_list(
        code_files, language=language, send_gui_message=send_gui_message)
    if build_folder:
        script_def["build_folder"] = build_folder
    if len(static_content_folders) > 0:
        script_def["static_content_folders"] = static_content_folders

    if language == "TypeScript" and build_folder is None:
        script_def["errors"].append({
            "kind": "BuildError",
            "message": f"No build folder found for this TypeScript project. Please build the project before adding it.",
        })

    error_count = len(script_def["errors"])
    if error_count > 0:
        return script_def

    script_module_files = []
    for script_module in script_def["script_modules"]:
        properties = script_module["properties"]

        # Add script_module_files information for this module
        outputFilePath = get_mrs_script_property(properties, "outputFilePath")
        # If an explicit outputFilePath has been given, ensure that / are used and the path starts with /
        if outputFilePath is not None:
            file_to_load = outputFilePath
            if file_to_load.count("\\") > 0 and file_to_load.count("/") == 0:
                file_to_load = file_to_load.replace("\\", "/")
            if not file_to_load.startswith("/"):
                file_to_load = "/" + file_to_load
        else:
            # Otherwise, use /<build_folder>/<file_name>
            file_to_load = "/" + build_folder + "/" + \
                script_module["file_info"]["file_name"]
            if language == "TypeScript":
                file_to_load = file_to_load.replace(
                    ".mts", ".mjs").replace(".ts", ".js")
        script_module_files.append({
            "file_info": script_module["file_info"],
            "file_to_load": file_to_load,
            "class_name": script_module["class_name"],
        })

        request_path = get_mrs_script_property(
            properties, "requestPath", "/" + script_module["class_name"])

        schema = schemas.get_schema(
            session=session, request_path=request_path)
        if schema is None:
            name = get_mrs_script_property(
                properties, "name", core.convert_path_to_camel_case(request_path))

            send_gui_message(
                "info", f"Creating new REST schema `{name}` at {request_path} ...")

            schema_id = schemas.add_schema(
                session=session, schema_name=name,
                service_id=content_set["service_id"], request_path=request_path,
                enabled=get_mrs_script_property(properties, "enabled", True),
                internal=get_mrs_script_property(properties, "internal", True),
                requires_auth=get_mrs_script_property(
                    properties, "requiresAuth", False),
                options=get_mrs_script_property(properties, "options", None),
                metadata=get_mrs_script_property(properties, "metadata", None),
                comments=get_mrs_script_property(properties, "comments", None),
                schema_type="SCRIPT_MODULE",
            )

            schema = schemas.get_schema(session=session, schema_id=schema_id)

        send_gui_message(
            "info", f"Adding MRS scripts to REST schema {schema.get("name")} at {request_path} ...")

        # Add a db_object for each script
        interface_list = script_def["interfaces"]
        for script in script_module["scripts"]:
            func_props = script["properties"]
            func_request_path = get_mrs_script_property(
                func_props, "requestPath", "/" + script["function_name"])
            full_path = service["url_context_root"] + \
                schema["request_path"] + func_request_path
            row_ownership_param = get_mrs_script_property(
                func_props, "rowOwnershipParameter")
            row_ownership_field_id = None

            send_gui_message(
                "info", f"Adding MRS script {script["function_name"]} at {func_request_path} ...")

            db_object_id = core.get_sequence_id(session=session)
            objects = []

            # Build parameters object with all parameter as object_fields
            object_id = core.get_sequence_id(session=session)
            object_fields = []
            pos = 0
            for param in script["parameters"]:
                object_field_id = core.get_sequence_id(session=session)
                if param["name"] == row_ownership_param:
                    row_ownership_field_id = object_field_id

                object_field = {
                    "id": object_field_id,
                    "object_id": object_id,
                    "name": param["name"],
                    "position": pos,
                    "db_column": {
                        "name": param["name"],
                        "not_null": not param["optional"],
                        "in": True,
                        "datatype": map_ts_type_to_database_type(param["type"]),
                        "is_array": param["is_array"],
                    },
                    "enabled": True,
                    "allow_filtering": True,
                    "allow_sorting": False,
                    "no_check": False,
                    "no_update": False,
                }
                if param.get("default", None) is not None:
                    object_field["db_column"]["default"] = param["default"]
                # Store interface name
                type_interface = map_ts_type_to_interface(param["type"])
                if type_interface is not None:
                    object_field["db_column"]["interface"] = type_interface

                object_fields.append(object_field)
                pos += 1

            obj = {
                "id": object_id,
                "db_object_id": db_object_id,
                "name": core.convert_path_to_pascal_case(full_path) + "Params",
                "kind": "PARAMETERS",
                "position": 0,
                "fields": object_fields,
            }
            if row_ownership_field_id is not None:
                obj["row_ownership_field_id"] = row_ownership_field_id
            objects.append(obj)

            # Build result object
            object_id = core.get_sequence_id(session=session)
            object_fields = []
            returns_array = False
            return_type = script["return_type"]["type"]
            returns_array = script["return_type"]["is_array"]
            if is_simple_typescript_type(return_type):
                object_field = {
                    "id": core.get_sequence_id(session=session),
                    "object_id": object_id,
                    "name": "result",
                    "position": 0,
                    "db_column": {
                        "name": "result",
                        "not_null": True,
                        "datatype": map_ts_type_to_database_type(return_type),
                        "is_array": returns_array,
                    },
                    "enabled": True,
                    "allow_filtering": True,
                    "allow_sorting": False,
                    "no_check": False,
                    "no_update": False,
                }
                # Store interface name
                type_interface = map_ts_type_to_interface(return_type)
                if type_interface is not None:
                    object_field["db_column"]["interface"] = type_interface

                object_fields.append(object_field)
            else:
                add_object_fields_from_interface(
                    session=session, interface_name=return_type,
                    interface_list=interface_list,
                    object_id=object_id, object_fields=object_fields)

            objects.append({
                "id": object_id,
                "db_object_id": db_object_id,
                "name": core.convert_path_to_pascal_case(full_path) + "Result",
                "kind": "RESULT",
                "position": 1,
                "fields": object_fields,
                "sdk_options": {
                    "language_options": [
                        {
                            "language": "TypeScript",
                            "class_name": return_type,
                        }
                    ],
                    "class_name": return_type,
                    "returns_array": returns_array,
                }
            })

            db_object_id = db_objects.add_db_object(
                session=session,
                schema_id=schema["id"],
                db_object_id=db_object_id,
                db_object_name=get_mrs_script_property(
                    func_props, "name", script["function_name"]),
                request_path=func_request_path,
                db_object_type="SCRIPT",
                enabled=get_mrs_script_property(func_props, "enabled", True),
                internal=get_mrs_script_property(func_props, "internal", True),
                requires_auth=get_mrs_script_property(
                    func_props, "requiresAuth", True),
                options=get_mrs_script_property(func_props, "options", None),
                metadata=get_mrs_script_property(func_props, "metadata", None),
                comments=get_mrs_script_property(func_props, "comments", None),
                crud_operation_format=get_mrs_script_property(
                    func_props, "format", "FEED"),
                media_type=get_mrs_script_property(
                    func_props, "mediaType", None),
                items_per_page=None,
                auto_detect_media_type=None,
                auth_stored_procedure=None,
                objects=objects,
            )

            core.insert(table="content_set_has_obj_def", values={
                "content_set_id": content_set_id,
                "db_object_id": db_object_id,
                "kind": "Script",
                "priority": 0,
                "language": language,
                "name": script["function_name"],
                "class_name": script_module["class_name"],
                "options": {
                    "file_to_load": file_to_load
                }
            }).exec(session)

            # Insert interfaces as object/object_field/object_reference

        for trigger in script_module["triggers"]:
            print(f"{trigger["function_name"]=}")
        # for interface in script_def["interfaces"]:
        #     print(f"{interface["name"]=}")

    # Add the list of MRS script files to load, as well as the script definition
    options = content_set["options"]
    options["script_module_files"] = script_module_files
    options["script_definitions"] = script_def

    core.update(
        table="content_set",
        sets={"options": options},
        where=["id=?"]
    ).exec(session, [content_set_id])

    # Update content files, make all files private that are not in static folders
    where = []
    params = [content_set_id]
    for folder in static_content_folders:
        if not folder.startswith("/"):
            folder = "/" + folder
        folder += "%"
        where.append(f"request_path LIKE ?")
        params.append(folder)

    core.update(
        table="content_file",
        sets={"enabled": 2},
        where=["content_set_id=?",
               "NOT (" + " OR ".join(where) + ")"]
    ).exec(session, params)

    return script_def


def get_extended_interface_properties(interface, interface_list):
    if interface.get("extends") is None or interface["extends"] == "":
        return interface["properties"]

    parent_interface = get_typescript_interface_from_list(
        type_name=interface["extends"], interface_list=interface_list)

    props = interface["properties"].copy()
    props.extend(get_extended_interface_properties(
        parent_interface, interface_list))

    return props


def add_object_fields_from_interface(
        session, interface_name, interface_list, object_id, object_fields: list, parent_reference_id=None):
    interface = get_typescript_interface_from_list(
        type_name=interface_name, interface_list=interface_list)

    interface_properties = get_extended_interface_properties(
        interface=interface,
        interface_list=interface_list)

    for field in interface_properties:
        field_type = field["type"]
        field_array = False
        if field_type.endswith("[]"):
            field_type = field_type[:-2]
            field_array = True

        object_field = {
            "id": core.get_sequence_id(session=session),
            "object_id": object_id,
            "name": field["name"],
            "position": len(object_fields),
            "db_column": {
                "name": field["name"],
                "not_null": not field["optional"],
                "datatype": map_ts_type_to_database_type(field_type),
                "is_array": field_array,
                "read_only": field["readOnly"],
            },
            "enabled": True,
            "allow_filtering": True,
            "allow_sorting": False,
            "no_check": False,
            "no_update": False,
        }
        if parent_reference_id is not None:
            object_field["parent_reference_id"] = parent_reference_id

        # Store interface name
        type_interface = map_ts_type_to_interface(field_type)
        if type_interface is not None:
            object_field["db_column"]["interface"] = type_interface

        if is_simple_typescript_type(field_type):
            object_fields.append(object_field)
        else:
            object_ref_id = core.get_sequence_id(session=session)
            object_ref = {
                "id": object_ref_id,
                "unnest": False,
                "reference_mapping": {
                    "kind": "1:n" if field_array else "1:1",
                    "constraint": "interface",
                    "referenced_schema": field_type,
                    "referenced_table": "",
                    "column_mapping": [{"base": "n/a", "ref": "n/a"}]
                },
                "sdk_options": {
                    "language_options": [
                        {
                            "language": "TypeScript",
                            "class_name": field_type,
                        }
                    ],
                    "class_name": field_type,
                }
            }
            object_field["represents_reference_id"] = object_ref_id
            object_field["object_reference"] = object_ref

            # No recursive call to add other interfaces
            object_fields.append(object_field)


def get_create_statement(session, content_set) -> str:
    executor = MrsDdlExecutor(
        session=session,

        current_service_id=content_set["service_id"])

    executor.showCreateRestContentSet({
        "current_operation": "SHOW CREATE REST CONTENT SET",
        **content_set
    })

    if executor.results[0]["type"] == "error":
        raise Exception(executor.results[0]['message'])

    result = [executor.results[0]['result'][0]['CREATE REST CONTENT SET']]

    content_set_files = content_files.get_content_files(
        session, content_set["id"], None, False)

    for service_content_file in content_set_files:
        result.append(content_files.get_create_statement(
            session, service_content_file))

    return "\n".join(result)


def update_file_content_via_regex(file_path, reg_ex, substitute):
    # Open file and get content
    with open(file_path, 'r') as f:
        content = f.read()

    # Get new content
    new_content = re.sub(reg_ex, substitute, content, 0, re.MULTILINE)

    # Save to file
    with open(file_path, 'w') as f:
        f.write(new_content)


def prepare_open_api_ui(service, request_path, send_gui_message=None) -> str:
    # Get tempdir
    temp_dir = tempfile.gettempdir()

    # Download SwaggerUI
    if send_gui_message is not None:
        send_gui_message("info", "Downloading OpenAPI UI package ...")
    ssl._create_default_https_context = ssl._create_unverified_context
    swagger_ui_zip_path = os.path.join(temp_dir, "swagger-ui.zip")
    with urlopen(OPENAPI_UI_URL) as zip_web_file:
        with open(swagger_ui_zip_path, 'wb') as zip_disk_file:
            zip_disk_file.write(zip_web_file.read())

    # Download Dark CSS
    if send_gui_message is not None:
        send_gui_message("info", "Downloading dark CSS file ...")
    swagger_ui_dark_css_path = os.path.join(temp_dir, "swagger-ui-dark.css")
    with urlopen(OPENAPI_DARK_CSS_URL) as dark_css_web_file:
        with open(swagger_ui_dark_css_path, 'wb') as dark_css_disk_file:
            dark_css_disk_file.write(dark_css_web_file.read())

    # Extract zip
    if send_gui_message is not None:
        send_gui_message("info", "Extracting package ...")
    swagger_ui_path = os.path.join(temp_dir, "swagger-ui")
    if not os.path.exists(swagger_ui_path):
        os.makedirs(swagger_ui_path)
    else:
        shutil.rmtree(swagger_ui_path)
        os.makedirs(swagger_ui_path)

    with zipfile.ZipFile(swagger_ui_zip_path, 'r') as zip_ref:
        for zip_info in zip_ref.infolist():
            if (not zip_info.is_dir()
                and os.sep + "dist" + os.sep in zip_info.filename
                and not os.path.basename(zip_info.filename).startswith(".")
                and not os.path.basename(zip_info.filename).endswith(".map")
                    and not "-es-" in os.path.basename(zip_info.filename)):
                zip_info.filename = os.path.basename(zip_info.filename)
                zip_ref.extract(zip_info, swagger_ui_path)

    # Delete zip file
    pathlib.Path.unlink(swagger_ui_zip_path)

    # Update the config file
    if send_gui_message is not None:
        send_gui_message("info", "Customizing files ...")
    update_file_content_via_regex(
        os.path.join(swagger_ui_path, "swagger-initializer.js"),
        r"(url: \".*?\")",
        f'url: "{service["url_context_root"]}/open-api-catalog/"')

    # Add dark css
    with open(swagger_ui_dark_css_path, 'r') as file1:
        with open(os.path.join(swagger_ui_path, "index.css"), 'a') as file2:
            shutil.copyfileobj(file1, file2)
            file2.write("\n#swagger-ui {\npadding-top: 20px;\n}\n")
            # Authorize Btn
            file2.write("\n.swagger-ui .scheme-container {\nposition: absolute;\nright: 0px;\ntop: 0px;\n"
                "height: 58px;\npadding: 10px 0px;\nbackground: unset;\nbox-shadow: unset;\n}\n")
            file2.write(
                "\n.swagger-ui .btn.authorize span {\npadding: 4px 10px 0 0;\n}\n")
            # Explore Area
            file2.write("\n.swagger-ui .topbar {\nbackground-color: unset;\npadding: 10px 0;\n"
                "position: absolute;\ntop: 0px;\nright: 170px;\nwidth: 300px;\nfont-size: 0.75em;\n}\n")
            file2.write("\n.swagger-ui .topbar .download-url-wrapper .download-url-button {\n"
                "padding: 3px 10px 0px 10px;\nfont-size: 1.2em;\n}\n")
            file2.write("\n.swagger-ui .topbar .wrapper {\npadding: 0;\n}\n")
    # Delete dark css file
    pathlib.Path.unlink(swagger_ui_dark_css_path)

    # Patch UI to redirect to MRS authentication
    redirect_url = f'/?service={service["url_context_root"]
                                }&redirectUrl={service["url_context_root"]+request_path}/index.html'
    authorize_btn_on_click = f'()=>{{window.location.href="{redirect_url}";}}'
    update_file_content_via_regex(
        os.path.join(swagger_ui_path, "swagger-ui-bundle.js"),
        r'("btn authorize unlocked",onClick:i})',
        f'"btn authorize unlocked",onClick:{authorize_btn_on_click}}}')

    # cspell:ignore topbar
    update_file_content_via_regex(
        os.path.join(swagger_ui_path, "swagger-ui.css"),
        r"(\.swagger-ui \.topbar a{align-items:center;color:#fff;display:flex;)",
        '.swagger-ui .topbar a{align-items:center;color:#fff;display:none;')

    return swagger_ui_path
