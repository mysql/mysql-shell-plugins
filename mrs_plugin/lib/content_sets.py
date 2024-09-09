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

from mrs_plugin.lib import core, content_files
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
    r"\s*(.*?)\s*:\s*(.*?)\s*,"

# Regex to remove Promise<> from the result type
TS_SCRIPT_RESULT_REMOVE_PROMISE_REGEX = \
    r"Promise\s*<(.*?)>\s*$"


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
        core.delete(table="content_file", where="content_set_id=?").exec(
            session, [content_set_id])
        if not core.delete(table="content_set", where="id=?").exec(session, [content_set_id]).success:
            raise Exception(
                f"The specified content_set with id {content_set_id} was "
                "not found.")


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

        if not result.success:
            raise Exception(f"The specified content_set was not found.")


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
            CONCAT(h.name, se.url_context_root) AS host_ctx
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


def add_content_set(session, service_id, request_path, requires_auth=False, comments="", options=None, enabled=True,
                    content_type="STATIC"):
    values = {
        "id": core.get_sequence_id(session),
        "service_id": service_id,
        "request_path": request_path,
        "requires_auth": int(requires_auth),
        "enabled": int(enabled),
        "comments": comments,
        "options": options,
        "content_type": content_type,
    }

    # Create the content_set, ensure it is created as "not enabled"
    core.insert(table="content_set", values=values).exec(session)

    return values["id"]


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
        ignore_patterns.append(pattern.strip().replace(
            "*", ".*").replace("?", ".").replace("\\", "/"))
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

    for match in matches:
        params.append({
            "name": match.group(1),
            "type": match.group(2),
        })

    return params


def get_function_return_type_no_promise(code):
    result = re.findall(
        TS_SCRIPT_RESULT_REMOVE_PROMISE_REGEX, code, re.MULTILINE | re.DOTALL)

    return result[0] if len(result) > 0 else "void"


def get_mrs_typescript_definitions(path, fullname, code, mrs_script_def):
    # Clear TypeScript comments and strings for regex matching
    code_cleared = blank_quoted_js_strings(
        blank_js_comments(code))

    matches = re.finditer(
        TS_SCHEMA_DECORATOR_REGEX, code_cleared, re.MULTILINE | re.DOTALL)

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
            code, code_cleared, match.start(2), match.end(2))

        # Get the starting line number of the class definition
        ln_number_start = code.count("\n", 0, match.start()) + 1
        ln_number_end = code.count("\n", 0, match.end()) + 1
        schema_def = {
            "full_file_name": fullname,
            "relative_file_name": fullname[len(path):],
            "file_name": os.path.basename(fullname),
            "last_modification": datetime.datetime.fromtimestamp(
                pathlib.Path(fullname).stat().st_mtime, tz=datetime.timezone.utc).strftime("%F %T.%f")[:-3],
            "class_name": code[match.start(3):match.end(3)],
            "schema_type": "SCRIPT_MODULE" if match.group(1) == "module" else "DATABASE_SCHEMA",
            "line_number": ln_number_start,
            "line_number_end": ln_number_end,
            "character_start": match.start(),
            "character_end": match.end(),
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
            ln_number_start = code.count(
                "\n", 0, class_content_offset+script_match.start()) + 1
            ln_number_end = code.count(
                "\n", 0, class_content_offset+script_match.end()) + 1

            # Group 2 holds the decorator params
            props = get_decorator_properties(
                code, code_cleared,
                class_content_offset+script_match.start(2), class_content_offset+script_match.end(2))

            params = get_function_params(
                code, code_cleared,
                class_content_offset+script_match.start(5), class_content_offset+script_match.end(5))

            return_type = get_function_return_type_no_promise(
                code[class_content_offset+script_match.start(6):class_content_offset+script_match.end(6)])

            script_def = {
                "function_name": code[
                    class_content_offset+script_match.start(4):class_content_offset+script_match.end(4)],
                "line_number": ln_number_start,
                "line_number_end": ln_number_end,
                "character_start": class_content_offset+script_match.start(),
                "character_end": class_content_offset+script_match.end(),
                "parameters": params,
                "return_type": return_type,
                "properties": props
            }

            if script_match.group(1) == "trigger":
                schema_def["triggers"].append(script_def)
            else:
                schema_def["scripts"].append(script_def)


def get_file_mrs_scripts_definitions(path, language):
    mrs_script_def = []

    path = os.path.expanduser(path)

    # Read the file content
    with open(path, 'r') as f:
        code = f.read()

    # Progress TypeScript
    if language == "TypeScript":
        get_mrs_typescript_definitions(
            path, path, code, mrs_script_def)

    return mrs_script_def


def get_folder_mrs_scripts_definitions(path, ignore_list, language):
    full_ignore_pattern = convert_ignore_list_to_regex_pattern(ignore_list)

    mrs_script_def = []

    path = os.path.expanduser(path)

    for root, dirs, files in os.walk(path):
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

                    get_mrs_typescript_definitions(
                        path, fullname, code, mrs_script_def)

    return mrs_script_def


def update_scripts_from_content_set(session, content_set_id, send_gui_message):

    files = content_files.get_content_files(
        session=session, content_set_id=content_set_id,
        include_enable_state=True, include_file_content=True)


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
    with open(file_path, 'r' ) as f:
        content = f.read()

    # Get new content
    new_content = re.sub(reg_ex, substitute, content, 0, re.MULTILINE)

    # Save to file
    with open(file_path, 'w' ) as f:
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

    # Patch UI to redirect to MRS authentication
    redirect_url = f'/?service={service["url_context_root"]}&redirectUrl={service["url_context_root"]+request_path}/'
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