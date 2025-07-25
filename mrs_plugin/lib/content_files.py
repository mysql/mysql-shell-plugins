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
from mrs_plugin.lib import core, content_sets
from mrs_plugin.lib.MrsDdlExecutor import MrsDdlExecutor
import os
import re
import pathlib
import datetime
import base64

def sizeof_fmt(num, suffix="B"):
    for unit in ["", "K", "M", "G", "T", "P", "E", "Z"]:
        if abs(num) < 1024.0:
            return f"{num:3.1f}{unit+suffix:2}"
        num /= 1024.0
    return f"{num:.1f}Yi{suffix}"


def format_content_file_listing(content_files, print_header=True):
    """Formats the listing of content files

    Args:
        content_files (list): A list of content files as dicts
        print_header (bool): If set to true, a header is printed


    Returns:
        The formatted list of file
    """

    if print_header:
        output = (f"{'ID':>3} {'PATH':65} {'ENABLED':7} {'AUTH':4} "
                  f"{'LAST META CHANGE':16} {'SIZE':9}\n")
    else:
        output = ""

    i = 0
    for item in content_files:
        i += 1
        path = (item['host_ctx'] + item['content_set_request_path'] +
                item['request_path'])
        changed_at = str(item['changed_at']) if item['changed_at'] else ""
        file_size = sizeof_fmt(item['size'])

        output += (f"{i:>3} {path[:65]:65} "
                   f"{'Yes' if item['enabled'] else '-':7} "
                   f"{'Yes' if item['requires_auth'] else '-':4} "
                   f"{changed_at[:16]:16} {file_size[:9]:>9}")
        if i < len(content_files):
            output += "\n"

    return output


def get_content_file(session, content_file_id: bytes | None = None, content_set_id: bytes | None = None,
                     request_path: str | None = None, include_file_content: bool = False):
    sql = f"""
        SELECT f.id, f.content_set_id, f.request_path,
            f.requires_auth, f.enabled, f.size,
            cs.request_path AS content_set_request_path,
            CONCAT(h.name, se.url_context_root) AS host_ctx,
            f.options,
            MAX(al.changed_at) as changed_at{", f.content" if include_file_content else ""}
        FROM mysql_rest_service_metadata.content_file f
            LEFT OUTER JOIN mysql_rest_service_metadata.content_set cs
                ON cs.id = f.content_set_id
            LEFT OUTER JOIN mysql_rest_service_metadata.service se
                ON se.id = cs.service_id
            LEFT JOIN mysql_rest_service_metadata.url_host h
                ON se.url_host_id = h.id
            LEFT OUTER JOIN (
                SELECT new_row_id AS id, MAX(changed_at) as changed_at
                FROM mysql_rest_service_metadata.audit_log
                WHERE table_name = 'content_file'
                GROUP BY new_row_id) al
            ON al.id = f.id
        """

    wheres = []
    params = []
    if content_file_id:
        wheres.append("f.id = ?")
        params.append(content_file_id)
    elif content_set_id and request_path:
        wheres.append("f.content_set_id = ?")
        wheres.append("f.request_path = ?")
        params.append(content_set_id)
        params.append(request_path)

    sql += core._generate_where(wheres)
    sql += " GROUP BY f.id"

    result = core.MrsDbExec(sql, params).exec(session).items

    return result[0] if len(result) == 1 else None


def get_content_files(session, content_set_id: bytes, include_enable_state: bool | None = False, include_file_content=False):
    """Returns all files for the given content set

    Args:
        content_set_id: The id of the content_set to list the items from
        include_enable_state (bool): Only include db_objects with the given
            enabled state
        session (object): The database session to use

    Returns:
        A list of dicts representing the files of the content set
    """
    if not content_set_id:
        raise ValueError("No content set specified.")

    sql = f"""
        SELECT f.id, f.content_set_id, f.request_path,
            f.requires_auth, f.enabled, f.size,
            cs.request_path AS content_set_request_path,
            CONCAT(h.name, se.url_context_root) AS host_ctx,
            f.options,
            MAX(al.changed_at) as changed_at{", f.content" if include_file_content else ""}
        FROM mysql_rest_service_metadata.content_file f
            LEFT OUTER JOIN mysql_rest_service_metadata.content_set cs
                ON cs.id = f.content_set_id
            LEFT OUTER JOIN mysql_rest_service_metadata.service se
                ON se.id = cs.service_id
            LEFT JOIN mysql_rest_service_metadata.url_host h
                ON se.url_host_id = h.id
            LEFT OUTER JOIN (
                SELECT new_row_id AS id, MAX(changed_at) as changed_at
                FROM mysql_rest_service_metadata.audit_log
                WHERE table_name = 'content_file'
                GROUP BY new_row_id) al
            ON al.id = f.id
        WHERE f.content_set_id = ? /*=3*/
        """

    if include_enable_state is not None:
        sql += ("AND f.enabled = "
                f"{'TRUE' if include_enable_state else 'FALSE'} ")

    sql += "GROUP BY f.id"

    return core.MrsDbExec(sql, [content_set_id]).exec(session).items


def add_content_dir(session, content_set_id, content_dir, requires_auth, ignore_list, send_gui_message=None):
    file_list = []
    full_ignore_pattern = content_sets.convert_ignore_list_to_regex_pattern(ignore_list)

    content_dir = os.path.expanduser(content_dir)

    for root, dirs, files in os.walk(content_dir):
        for file in sorted(files):
            fullname = os.path.join(root, file)

            # If the filename matches the ignore list, ignore the file
            if full_ignore_pattern is not None and re.match(full_ignore_pattern, fullname.replace("\\", "/")):
                continue

            file_list.append(fullname)
            # Read the file content
            with open(fullname, 'rb') as f:
                data = f.read()

            request_path = fullname[len(content_dir):]
            if os.name == 'nt':
                request_path = request_path.replace("\\", "/")

            if send_gui_message is not None:
                send_gui_message("info", f"Adding file {file} ...")

            options = {
                "last_modification": datetime.datetime.fromtimestamp(
                    pathlib.Path(fullname).stat().st_mtime, tz=datetime.timezone.utc).strftime("%F %T.%f")[:-3],
            }

            add_content_file(session, content_set_id,
                             request_path, requires_auth, options=options, data=data)


    if len(file_list) == 0:
        # if the content dir is empty, raise an error. This should only
        # happen in the root of the content dir and not in sub directories.
        raise Exception(f"There are no files in '{root}' or it's not accessible.")

    return file_list


def add_content_file(session, content_set_id, request_path, requires_auth, data, enabled=1, options=None):
    # Upload it to the content table
    id = core.get_sequence_id(session)
    core.insert(table="content_file", values={
        "id": id,
        "content_set_id": content_set_id,
        "request_path": request_path,
        "requires_auth": int(requires_auth),
        "enabled": enabled,
        "content": data,
        "options": options,
    }).exec(session)

    return id


def delete_content_file(session, content_file_id):
    if not content_file_id:
        raise ValueError("No REST content file id specified.")

    res = core.delete(table="content_file", where=["id=?"]).exec(
        session, params=[content_file_id])

    if not res.success:
        raise Exception(
            f"The specified REST content file with id {content_file_id} was not found.")


def get_content_file_create_statement(session, content_file: dict) -> str:
    if "content" not in content_file:
        content_file = get_content_file(session, content_file_id=content_file["id"], include_file_content=True)

    output = []
    output.append(f"CREATE OR REPLACE REST CONTENT FILE {core.quote_rpath(content_file.get('request_path'))}")
    output.append(f"    ON SERVICE {core.quote_rpath(content_file.get('host_ctx'))} CONTENT SET {core.quote_rpath(content_file.get('content_set_request_path'))}")

    if core.is_text(content_file["content"]):
        content_type = "CONTENT"
        contents = content_file["content"].decode()
    else:
        content_type = "BINARY CONTENT"
        contents = base64.b64encode(
            content_file["content"]).decode("ascii")

    output.append(f"    {content_type} {core.squote_str(contents)}")

    if content_file["enabled"] == 2:
        output.append("    PRIVATE")
    elif content_file["enabled"] is False or content_file["enabled"] == 0:
        output.append("    DISABLED")

    output.append(core.format_json_entry("OPTIONS",
                                    content_file.get("options")))

    auth = "    AUTHENTICATION REQUIRED" if content_file["requires_auth"] in [True, 1] \
        else "    AUTHENTICATION NOT REQUIRED"

    output.append(auth)

    return "\n".join(output) + ";"


def clone_content_file(session, content_file, new_content_set):
    add_content_file(session, new_content_set,
                    request_path=content_file["request_path"],
                    requires_auth=content_file["requires_auth"],
                    enabled=content_file["enabled"],
                    options=content_file["options"],
                    data=content_file["content"])
