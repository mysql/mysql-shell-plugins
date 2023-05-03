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
from mrs_plugin.lib import core
import os


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
        The formated list of file
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


def get_content_files(session, content_set_id: bytes, include_enable_state=False):
    """Returns all db_objects for the given schema

    Args:
        content_set_id: The id of the content_set to list the items from
        include_enable_state (bool): Only include db_objects with the given
            enabled state
        session (object): The database session to use

    Returns:
        A list of dicts representing the db_objects of the schema
    """
    if not content_set_id:
        raise ValueError("No content set specified.")

    sql = """
        SELECT f.id, f.content_set_id, f.request_path,
            f.requires_auth, f.enabled, f.size,
            cs.request_path AS content_set_request_path,
            CONCAT(h.name, se.url_context_root) AS host_ctx,
            MAX(al.changed_at) as changed_at
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

    return core.MrsDbExec(sql).exec(session, [content_set_id]).items


def add_content_dir(session, content_set_id, content_dir, requires_auth):
    file_list = []
    for root, dirs, files in os.walk(content_dir):
        for file in files:
            fullname = os.path.join(root, file)
            file_list.append(fullname)
            # Read the file content
            with open(fullname, 'rb') as f:
                data = f.read()

            request_path = fullname[len(content_dir):]
            if os.name == 'nt':
                request_path = request_path.replace("\\", "/")

            print(f"Adding file {file} ...")
            add_content_file(session, content_set_id,
                             request_path, requires_auth, data)

    return file_list


def add_content_file(session, content_set_id, request_path, requires_auth, data, enabled=1):
    # Upload it to the content table
    id = core.get_sequence_id(session)
    core.insert(table="content_file", values={
        "id": id,
        "content_set_id": content_set_id,
        "request_path": request_path,
        "requires_auth": int(requires_auth),
        "enabled": enabled,
        "content": data
    }).exec(session)

    return id
