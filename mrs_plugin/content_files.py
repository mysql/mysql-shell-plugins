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

"""Sub-Module for managing MRS content files"""

# cSpell:ignore mysqlsh, mrs

from mysqlsh.plugin_manager import plugin_function
from mrs_plugin import core, content_sets


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
        The formated list of services
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

        output += (f"{item['id']:>3} {path[:65]:65} "
                   f"{'Yes' if item['enabled'] else '-':7} "
                   f"{'Yes' if item['requires_auth'] else '-':4} "
                   f"{changed_at[:16]:16} {file_size[:9]:>9}")
        if i < len(content_files):
            output += "\n"

    return output


@plugin_function('mrs.list.contentFiles', shell=True, cli=True, web=True)
def get_content_files(**kwargs):
    """Returns all db_objects for the given schema

    Args:
        **kwargs: Additional options

    Keyword Args:
        content_set_id (int): The id of the content_set to list the items from
        include_enable_state (bool): Only include db_objects with the given
            enabled state
        session (object): The database session to use
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised
        return_formatted (bool): If set to true, a list object is returned

    Returns:
        A list of dicts representing the db_objects of the schema
    """

    content_set_id = kwargs.get("content_set_id")

    include_enable_state = kwargs.get("include_enable_state")
    session = kwargs.get("session")
    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)

    try:
        session = core.get_current_session(session)

        if not content_set_id:
            content_set = content_sets.get_content_set(
                interactive=interactive, raise_exceptions=raise_exceptions,
                session=session)

            if not content_set:
                raise ValueError("No content set specified.")

            content_set_id = content_set.get("id")

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

        res = session.run_sql(sql, [content_set_id])

        content_files = core.get_sql_result_as_dict_list(res)

        if return_formatted:
            return format_content_file_listing(content_files, print_header=True)
        else:
            return content_files

    except Exception as e:
        if raise_exceptions:
            raise
        print(f"Error: {str(e)}")
