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
import mrs_plugin.lib as lib




@plugin_function('mrs.list.contentFiles', shell=True, cli=True, web=True)
def get_content_files(content_set_id, **kwargs):
    """Returns all files for the given content set

    Args:
        content_set_id (str): The id of the content_set to list the items from
        **kwargs: Additional options

    Keyword Args:
        include_enable_state (bool): Only include db_objects with the given
            enabled state
        session (object): The database session to use

    Returns:
        A list of dicts representing the files in the content set
    """
    if content_set_id is not None:
        content_set_id = lib.core.id_to_binary(content_set_id, "content_set_id")

    include_enable_state = kwargs.get("include_enable_state")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        if content_set_id:
            content_files = lib.content_files.get_content_files(session=session,
                content_set_id=content_set_id, include_enable_state=include_enable_state)

        if lib.core.get_interactive_result():
            return lib.content_files.format_content_file_listing(content_files, print_header=True)
        else:
            return content_files

