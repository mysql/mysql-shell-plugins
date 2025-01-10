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

"""Sub-Module for managing MRS content files"""

# cSpell:ignore mysqlsh, mrs

from mysqlsh.plugin_manager import plugin_function
import mrs_plugin.lib as lib
from .interactive import resolve_content_file, resolve_overwrite_file, resolve_file_path


def generate_create_statement(**kwargs) -> str:
    lib.core.convert_ids_to_binary(["service_id", "content_set_id", "content_file_id"], kwargs)
    service_id = kwargs.get("service_id")
    content_set_id = kwargs.get("content_set_id")
    content_file_id = kwargs.get("content_file_id")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        content_file = resolve_content_file(session, content_file_id, content_set_id, service_id)

        return lib.content_files.get_create_statement(session, content_file)


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


@plugin_function('mrs.get.contentFileCreateStatement', shell=True, cli=True, web=True)
def get_create_statement(**kwargs):
    """Returns the corresponding CREATE REST CONTENT FILE SQL statement of the given MRS service object.

    Args:
        **kwargs: Options to determine what should be generated.

    Keyword Args:
        content_set_id (str): The ID of the content set to generate.
        content_file_id (str): The ID of the content file to generate.
        service_id (str): The ID of the service where the schema belongs.
        session (object): The database session to use.

    Returns:
        The SQL that represents the create statement for the MRS content set
    """
    return generate_create_statement(**kwargs)


@plugin_function('mrs.dump.contentFileCreateStatement', shell=True, cli=True, web=True)
def store_create_statement(**kwargs):
    """Stores the corresponding CREATE REST CONTENT SET SQL statement of the given MRS service
    into a file.

    Args:
        **kwargs: Options to determine what should be generated.

    Keyword Args:
        content_file_id (str): The ID of the content file to dump.
        content_set_id (str): The ID of the content set to dump.
        service_id (str): The ID of the service where the schema belongs.
        file_path (str): The path where to store the file.
        overwrite (bool): Overwrite the file, if already exists.
        session (object): The database session to use.

    Returns:
        True if the file was saved.
    """
    file_path = kwargs.get("file_path")
    overwrite = kwargs.get("overwrite")

    file_path = resolve_file_path(file_path)
    resolve_overwrite_file(file_path, overwrite)

    sql = generate_create_statement(**kwargs)

    with open(file_path, "w") as f:
        f.write(sql)

    if lib.core.get_interactive_result():
        return f"File created in {file_path}."

    return True
