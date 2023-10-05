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

"""Sub-Module for managing MRS content sets"""

# cSpell:ignore mysqlsh, mrs

from mysqlsh.plugin_manager import plugin_function
import mrs_plugin.lib as lib
from .interactive import resolve_service

import os

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
        service_id=service_id,session=session, get_default=True)

    service_id = service.get("id")

    # get the list of existing content sets
    content_sets = lib.content_sets.get_content_sets(session=session,
        service_id=service_id, request_path=request_path)

    # if no content sets were found, this will cancel the call
    if not content_sets:
        raise ValueError("Unable to determine a unique content set for the operation.")

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
        enabled (bool): Whether to enable the content set after all files are uploaded
        options (dict): The options as JSON string
        replace_existing (bool): Whether to replace a content set that uses the same request_path
        session (object): The database session to use.

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
    options = lib.core.convert_json(kwargs.get("options"))
    if options:
        options = lib.core.convert_json(options)
    replace_existing = kwargs.get("replace_existing", False)
    interactive = lib.core.get_interactive_default()

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

        if not content_dir:
            if interactive:
                raise ValueError('Operation cancelled.')
            else:
                raise ValueError('No content directory path given.')

        # Convert Unix path to Windows
        content_dir = os.path.abspath(
            os.path.expanduser(content_dir))

        # If a content_dir has been provided, check if that directory exists
        if not os.path.isdir(content_dir):
            raise ValueError(
                f"The given content directory path '{content_dir}' "
                "does not exists.")

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

            lib.core.check_request_path(session, service["host_ctx"] + request_path)

            # Create the content_set, ensure it is created as "not enabled"
            content_set_id = lib.content_sets.add_content_set(session, service.get("id"),
                request_path,
                int(requires_auth),
                comments, options)

            file_list = lib.content_files.add_content_dir(session, content_set_id,
                content_dir, requires_auth)

            if interactive:
                print(f"{len(file_list)} files added.")
            
        if lib.core.get_interactive_result():
            return f"\nContent with the id {content_set_id} was added successfully."
        else:
            return {
                "content_set_id": content_set_id,
                "number_of_files_uploaded": len(file_list)
            }


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
            service_id=service.get("id"),
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

        return  f"The content sets have been enabled."


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

        return  f"The content sets have been disabled."


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

        return  f"The content sets have been deleted."

