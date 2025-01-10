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

"""Sub-Module for managing MRS content sets"""

# cSpell:ignore mysqlsh, mrs

from mysqlsh.plugin_manager import plugin_function
import mrs_plugin.lib as lib
from .interactive import resolve_service, resolve_content_set, resolve_overwrite_file, resolve_file_path

import os
import mysqlsh
import json
import shutil
from pathlib import Path

# TODO (miguel): replace this with the one in interactive module


def resolve_content_set_id(**kwargs):
    request_path = kwargs.get("request_path")
    session = kwargs.get("session")
    content_set_id = kwargs.get("content_set_id")

    service_id = kwargs.pop("service_id", None)
    auto_select_single = kwargs.pop("auto_select_single", False)

    # if the supplied content set id is valid...
    if content_set_id:
        return kwargs

    # check if there is a current content set from the config
    mrs_config = lib.core.get_current_config()
    content_set_id = mrs_config.get('current_content_set_id')

    # if the current content set was found, return it
    if content_set_id:
        kwargs["content_set_id"] = content_set_id
        return kwargs

    # last choice is to use the request path
    lib.core.Validations.request_path(request_path)

    # get the service object specified by the service id or the default one
    service = lib.services.get_service(
        service_id=service_id, session=session, get_default=True)

    service_id = service.get("id")

    # get the list of existing content sets
    content_sets = lib.content_sets.get_content_sets(session=session,
                                                     service_id=service_id, request_path=request_path)

    # if no content sets were found, this will cancel the call
    if not content_sets:
        raise ValueError(
            "Unable to determine a unique content set for the operation.")

    # If there is exactly one service, set id to its id
    if len(content_sets) == 1 and auto_select_single:
        kwargs["content_set_id"] = content_sets[0]["id"]
        return kwargs

    if not lib.core.get_interactive_default():
        raise ValueError("Operation cancelled.")

    # allow the user to select from a list of content sets
    print(f"Content Set Listing for Service "
          f"{service.get('url_host_name')}"
          f"{service.get('url_context_root')}")

    selected_item = lib.core.prompt_for_list_item(
        item_list=content_sets,
        prompt_caption=("Please select an index or type "
                        "the content set name: "),
        item_name_property="request_path",
        given_value=None,
        print_list=True)

    if not selected_item:
        raise ValueError("Operation cancelled.")

    kwargs["content_set_id"] = selected_item
    return kwargs


def resolve_content_set_ids(**kwargs):
    include_enable_state = None
    session = kwargs.get("session")

    content_set_id = kwargs.pop("content_set_id", None)
    request_path = kwargs.pop("request_path", None)
    service_id = kwargs.pop("service_id", None)

    kwargs["content_set_ids"] = [content_set_id] if content_set_id else []

    if not content_set_id:
        # Check if given service_id exists or use the current service
        service = lib.services.get_service(
            service_id=service_id, session=session)

        if not request_path and lib.core.get_interactive_default():
            content_sets = lib.content_sets.get_content_sets(
                service_id=service.get("id"),
                include_enable_state=include_enable_state,
                session=session)
            caption = ("Please select an index, type "
                       "the request_path or type '*' "
                       "to select all: ")
            selection = lib.core.prompt_for_list_item(
                item_list=content_sets,
                prompt_caption=caption,
                item_name_property="request_path",
                given_value=None,
                print_list=True,
                allow_multi_select=True)
            if not selection:
                raise ValueError("Operation cancelled.")

            kwargs["content_set_ids"] = [item["id"] for item in selection]

        if request_path:
            # Lookup the content_set name
            res = session.run_sql(
                """
                SELECT id FROM `mysql_rest_service_metadata`.`content_set`
                WHERE request_path = ? AND service_id = ?
                """,
                [request_path, service.get("id")])
            row = res.fetch_one()
            if row:
                kwargs["content_set_ids"].append(row.get_field("id"))

    return kwargs


def generate_create_statement(**kwargs) -> str:
    lib.core.convert_ids_to_binary(["service_id", "content_set_id"], kwargs)
    service_id = kwargs.get("service_id")
    content_set_id = kwargs.get("content_set_id")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        content_set = resolve_content_set(session, content_set_id, service_id)

        return lib.content_sets.get_create_statement(session, content_set)


@plugin_function('mrs.add.contentSet', shell=True, cli=True, web=True)
def add_content_set(service_id=None, content_dir=None, **kwargs):
    """Adds content to the given MRS service

    Args:
        service_id (str): The id of the service the schema should be added to
        content_dir (str): The path to the content directory
        **kwargs: Additional options

    Keyword Args:
        request_path (str): The request_path
        requires_auth (bool): Whether authentication is required to access
            the content
        comments (str): Comments about the content
        enabled (int): Whether to enable the content set after all files are uploaded
        options (dict): The options as JSON string
        replace_existing (bool): Whether to replace a content set that uses the same request_path
        ignore_list (str): List of files and directories to ignore, separated by comma
        session (object): The database session to use.
        send_gui_message (object): The function to send a message to he GUI.

    Returns:
        None in interactive mode, a dict with content_set_id and
            number_of_files_uploaded
    """
    if service_id is not None:
        service_id = lib.core.id_to_binary(service_id, "service_id")

    request_path = kwargs.get("request_path")
    requires_auth = kwargs.get("requires_auth")
    comments = kwargs.get("comments")
    enabled = kwargs.get("enabled", 1)
    options = lib.core.convert_json(kwargs.get("options", {}))
    replace_existing = kwargs.get("replace_existing", False)
    ignore_list = kwargs.get("ignore_list")

    interactive = lib.core.get_interactive_default()

    send_gui_message = kwargs.get("send_gui_message")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        kwargs["session"] = session
        kwargs["service_id"] = service_id
        service = resolve_service(session, service_id)

        # Get request_path
        if not request_path and interactive:
            request_path = lib.core.prompt(
                "Please enter the request path for this content set ["
                f"/content]: ",
                {'defaultValue': '/content'}).strip()

        lib.core.Validations.request_path(request_path, session=session)

        # Get the content_dir
        if not content_dir and interactive:
            content_dir = lib.core.prompt(
                message=('Please enter the file path to the directory '
                         'that contains the static content: '))


        # Get requires_auth
        if requires_auth is None:
            if interactive:
                requires_auth = lib.core.prompt(
                    "Should the content require authentication [y/N]: ",
                    {'defaultValue': 'n'}).strip().lower() == 'y'
            else:
                requires_auth = False

        # Get comments
        if not comments and interactive:
            comments = lib.core.prompt_for_comments()

        with lib.core.MrsDbTransaction(session):
            if replace_existing:
                content_set = lib.content_sets.get_content_set(session,
                                                               service.get("id"), request_path)
                if content_set:
                    lib.core.delete(table="content_set",
                                    where="id=?").exec(session, [content_set.get("id")])

            # Create the content_set
            content_set_id, files_added = lib.content_sets.add_content_set(
                session, service.get("id"),
                request_path,
                requires_auth,
                comments, options,
                enabled=enabled,
                content_dir=content_dir,
                service=service,
                send_gui_message=send_gui_message,
                ignore_list=ignore_list)

        if lib.core.get_interactive_result():
            return f"\nThe REST content set was added successfully."
        else:
            return {
                "content_set_id": content_set_id,
                "number_of_files_uploaded": files_added
            }

@plugin_function('mrs.get.contentSetCount', shell=False, cli=False, web=True)
def get_content_set_count(service_id=None, **kwargs):
    """Returns all content sets for the given MRS service

    Args:
        service_id (str): The id of the service to list the content sets from
        **kwargs: Additional options

    Keyword Args:
        session (object): The database session to use.

    Returns:
        The number of content sets of the given service
    """
    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        # Check the given service_id or get the default if none was given
        service = lib.services.get_service(
            service_id=service_id, session=session)

@plugin_function('mrs.list.contentSets', shell=True, cli=True, web=True)
def get_content_sets(service_id=None, **kwargs):
    """Returns all content sets for the given MRS service

    Args:
        service_id (str): The id of the service to list the content sets from
        **kwargs: Additional options

    Keyword Args:
        include_enable_state (bool): Only include items with the given
            enabled state
        request_path (str): The request_path of the content_set
        session (object): The database session to use.

    Returns:
        Either a string listing the content sets when interactive is set or list
        of dicts representing the content sets
    """
    if service_id is not None:
        service_id = lib.core.id_to_binary(service_id, "service_id")

    include_enable_state = kwargs.get("include_enable_state")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        # Check the given service_id or get the default if none was given
        service = lib.services.get_service(
            service_id=service_id, session=session)
        content_sets = lib.content_sets.get_content_sets(session=session,
                                                         service_id=service.get(
                                                             "id"),
                                                         include_enable_state=include_enable_state)

        if lib.core.get_interactive_result():
            return lib.content_sets.format_content_set_listing(
                content_sets=content_sets, print_header=True)

        return content_sets


@plugin_function('mrs.get.contentSet', shell=True, cli=True, web=True)
def get_content_set(**kwargs):
    """Gets a specific MRS content_set

    Args:
        **kwargs: Additional options

    Keyword Args:
        content_set_id (str): The id of the content_set
        service_id (str): The id of the service
        request_path (str): The request_path of the content_set
        auto_select_single (bool): If there is a single service only, use that
        session (object): The database session to use.

    Returns:
        The schema as dict or None on error in interactive mode
    """
    lib.core.convert_ids_to_binary(["content_set_id", "service_id"], kwargs)

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        kwargs["session"] = session
        return lib.content_sets.get_content_set(**resolve_content_set_id(**kwargs))


@plugin_function('mrs.enable.contentSet', shell=True, cli=True, web=True)
def enable_content_set(**kwargs):
    """Enables a content set of the given service

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (str): The id of the service
        content_set_id (str): The id of the content_set
        session (object): The database session to use.

    Returns:
        The result message as string
    """

    lib.core.convert_ids_to_binary(["content_set_id", "service_id"], kwargs)

    kwargs["value"] = True

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        kwargs["session"] = session
        kwargs = resolve_content_set_ids(**kwargs)
        with lib.core.MrsDbTransaction(session):
            lib.content_sets.enable_content_set(**kwargs)

        if len(kwargs['content_set_ids']) == 1:
            return f"The content set has been enabled."

        return f"The content sets have been enabled."


@plugin_function('mrs.disable.contentSet', shell=True, cli=True, web=True)
def disable_content_set(**kwargs):
    """Enables a content_set of the given service

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (str): The id of the service
        content_set_id (str): The id of the content_set
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    lib.core.convert_ids_to_binary(["content_set_id", "service_id"], kwargs)

    kwargs["value"] = False

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        kwargs["session"] = session
        kwargs = resolve_content_set_ids(**kwargs)
        with lib.core.MrsDbTransaction(session):
            lib.content_sets.enable_content_set(**kwargs)

        if len(kwargs['content_set_ids']) == 1:
            return f"The content set has been disabled."

        return f"The content sets have been disabled."


@plugin_function('mrs.delete.contentSet', shell=True, cli=True, web=True)
def delete_content_set(**kwargs):
    """Delete a content_set of the given service

    Args:
        **kwargs: Additional options

    Keyword Args:
        content_set_id (str): The id of the content_set
        service_id (str): The id of the service
        request_path (str): The request_path of the content_set
        session (object): The database session to use.

    Returns:
        The result message as string
    """
    lib.core.convert_ids_to_binary(["content_set_id", "service_id"], kwargs)

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        kwargs["session"] = session
        kwargs = resolve_content_set_ids(**kwargs)
        with lib.core.MrsDbTransaction(session):
            lib.content_sets.delete_content_set(**kwargs)

        if len(kwargs['content_set_ids']) == 1:
            return f"The content set has been deleted."

        return f"The content sets have been deleted."


@plugin_function('mrs.get.fileMrsScriptDefinitions', shell=True, cli=True, web=True)
def get_file_mrs_script_definitions(path, **kwargs):
    """Returns the MRS Scripts definitions for the given file

    Args:
        path (str): The path to check
        **kwargs: Additional options

    Keyword Args:
        language (str): The language the MRS Scripts are written in

    Returns:
        A Dict with the MRS Scripts definitions or None if the lastModification matches the one of the file
    """

    language = kwargs.get("language")
    if language is None:
        raise ValueError("No language given.")

    script_def = lib.content_sets.get_file_mrs_script_definitions(
        path=path, language=language)

    return script_def


@plugin_function('mrs.get.folderMrsScriptLanguage', shell=True, cli=True, web=True)
def get_folder_mrs_scripts_language(path, **kwargs):
    """Checks if the given path contains MRS Scripts

    Args:
        path (str): The path to check
        **kwargs: Additional options

    Keyword Args:
        ignore_list (str): The list of file patterns to ignore, separated by comma

    Returns:
        "TypeScript" or None
    """

    ignore_list = kwargs.get("ignore_list", "*node_modules/*")

    mrs_scripts_language = lib.content_sets.get_folder_mrs_scripts_language(
        path, ignore_list)

    if lib.core.get_interactive_default():
        if mrs_scripts_language is not None:
            print(f"This folder contains MRS Scripts written in {mrs_scripts_language}.")
        else:
            print("This folder does not contain MRS Scripts.")
    else:
        return mrs_scripts_language


@plugin_function('mrs.get.folderMrsScriptDefinitions', shell=True, cli=True, web=True)
def get_folder_mrs_script_definitions(path, **kwargs):
    """Returns the MRS Scripts definitions for the given folder

    Args:
        path (str): The path to check
        **kwargs: Additional options

    Keyword Args:
        ignore_list (str): The list of file patterns to ignore, separated by comma
        language (str): The language the MRS Scripts are written in
        send_gui_message (object): The function to send a message to he GUI.

    Returns:
        A Dict with the MRS Scripts definitions
    """

    ignore_list = kwargs.get("ignore_list", "*node_modules/*")
    language = kwargs.get(
        "language", lib.content_sets.get_folder_mrs_scripts_language(path, ignore_list))
    send_gui_message = kwargs.get("send_gui_message")

    if language is None:
        raise ValueError(
            "The given file path does not contain any MRS Scripts.")

    script_def = lib.content_sets.get_folder_mrs_script_definitions(
        path=path, ignore_list=ignore_list, language=language, send_gui_message=send_gui_message)

    if lib.core.get_interactive_default():
        print(json.dumps(script_def, indent=4))
    else:
        return script_def


@plugin_function('mrs.update.mrsScriptsFromContentSet', shell=True, cli=True, web=True)
def update_scripts_from_content_set(**kwargs):
    """Updates db_schemas and db_objects based on script definitions of the content set

    Args:
        **kwargs: Additional options

    Keyword Args:
        content_set_id (str): The id of the content_set
        ignore_list (str): The list of file patterns to ignore, separated by comma
        language (str): The MRS Scripting language used
        session (object): The database session to use.
        send_gui_message (object): The function to send a message to he GUI.

    Returns:
        The result message as string
    """
    lib.core.convert_ids_to_binary(["content_set_id"], kwargs)

    language = kwargs.get("language")
    send_gui_message = kwargs.get("send_gui_message")

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, **kwargs) as session:
        kwargs["session"] = session
        kwargs = resolve_content_set_ids(**kwargs)

        if len(kwargs['content_set_ids']) >= 1:
            content_set_id = kwargs['content_set_ids'][0]

        with lib.core.MrsDbTransaction(session):
            lib.content_sets.update_scripts_from_content_set(
                session=session, content_set_id=content_set_id, language=language,
                send_gui_message=send_gui_message)


@plugin_function('mrs.get.contentSetCreateStatement', shell=True, cli=True, web=True)
def get_create_statement(**kwargs):
    """Returns the corresponding CREATE REST CONTENT SET SQL statement of the given MRS service object.

    Args:
        **kwargs: Options to determine what should be generated.

    Keyword Args:
        service_id (str): The ID of the service where the schema belongs.
        content_set_id (str): The ID of the content set to generate.
        session (object): The database session to use.

    Returns:
        The SQL that represents the create statement for the MRS content set
    """
    return generate_create_statement(**kwargs)


@plugin_function('mrs.dump.contentSetCreateStatement', shell=True, cli=True, web=True)
def store_create_statement(**kwargs):
    """Stores the corresponding CREATE REST CONTENT SET SQL statement of the given MRS service
    into a file.

    Args:
        **kwargs: Options to determine what should be generated.

    Keyword Args:
        service_id (str): The ID of the service where the schema belongs.
        content_set_id (str): The ID of the content set to dump.
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
