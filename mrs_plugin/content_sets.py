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

"""Sub-Module for managing MRS content sets"""

# cSpell:ignore mysqlsh, mrs

from mysqlsh.plugin_manager import plugin_function
from mrs_plugin import core, services as mrs_services

# Content_set operations
CONTENT_SET_DISABLE = 1
CONTENT_SET_ENABLE = 2
CONTENT_SET_DELETE = 3
# CONTENT_SET_REQUEST_PATH = 4
# CONTENT_SET_REQUIRES_AUTH = 5
# CONTENT_SET_COMMENTS = 6


def format_content_set_listing(content_sets, print_header=False):
    """Formats the listing of content_sets

    Args:
        content_sets (list): A list of content_sets as dicts
        print_header (bool): If set to true, a header is printed


    Returns:
        The formated list of services
    """

    if len(content_sets) == 0:
        return "No items available."

    if print_header:
        output = (f"{'ID':>3} {'PATH':96} {'ENABLED':8} "
                  f"{'AUTH':9}\n")
    else:
        output = ""

    i = 0
    for item in content_sets:
        i += 1
        url = (item['host_ctx'] + item['request_path'])
        output += (f"{item['id']:>3} {url[:95]:96} "
                   f"{'Yes' if item['enabled'] else '-':8} "
                   f"{'Yes' if item['requires_auth'] else '-':5}")
        if i < len(content_sets):
            output += "\n"

    return output


@plugin_function('mrs.add.contentSet', shell=True, cli=True, web=True)
def add_content_set(content_dir=None, service_id=None, **kwargs):
    """Adds content to the given MRS service

    Args:
        content_dir (str): The path to the content directory
        service_id (int): The id of the service the schema should be added to
        **kwargs: Additional options

    Keyword Args:
        request_path (str): The request_path
        requires_auth (bool): Whether authentication is required to access
            the content
        comments (str): Comments about the content
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised

    Returns:
        None in interactive mode, a dict with content_set_id and
            number_of_files_uploaded
    """

    import os

    request_path = kwargs.get("request_path")
    requires_auth = kwargs.get("requires_auth")
    comments = kwargs.get("comments")
    session = kwargs.get("session")
    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)

    try:
        session = core.get_current_session(session)

        service = mrs_services.get_service(
            service_id=service_id, auto_select_single=True,
            session=session, interactive=interactive,
            return_formatted=False)

        # Get request_path
        if not request_path and interactive:
            request_path = core.prompt(
                "Please enter the request path for this content set ["
                f"/content]: ",
                {'defaultValue': '/content'}).strip()

        if not request_path.startswith('/'):
            raise Exception("The request_path has to start with '/'.")

        core.check_request_path(
            service.get('url_host_name') + service.get('url_context_root') +
            request_path,
            session=session)

        # Get the content_dir
        if not content_dir and interactive:
            content_dir = core.prompt(
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
        if not requires_auth:
            if interactive:
                requires_auth = core.prompt(
                    "Should the content require authentication [y/N]: ",
                    {'defaultValue': 'n'}).strip().lower() == 'y'
            else:
                requires_auth = False

        # Get comments
        if not comments and interactive:
            comments = core.prompt_for_comments()

        # Create the content_set, ensure it is created as "not enabled"
        res = session.run_sql("""
            INSERT INTO `mysql_rest_service_metadata`.`content_set`(
                service_id, request_path, requires_auth, enabled, comments)
            VALUES(?, ?, ?, ?, ?)
            """, [service.get("id"),
                  request_path,
                  1 if requires_auth else 0,
                  0,
                  comments])
        content_set_id = res.auto_increment_value

        file_list = []
        for root, dirs, files in os.walk(content_dir):
            for file in files:
                file_list.append(os.path.join(root, file))

        for file in file_list:
            # Read the file content
            with open(file, 'rb') as f:
                data = f.read()

            # Upload it to the content table
            res = session.run_sql("""
                INSERT INTO `mysql_rest_service_metadata`.`content_file`(
                    content_set_id, request_path, requires_auth, enabled,
                    content)
                VALUES(?, ?, ?, ?, ?)
                """, [content_set_id,
                      file[len(content_dir):],
                      1 if requires_auth else 0,
                      1,
                      data])

        if interactive:
            print(f"{len(file_list)} files added.")

        # Enable the content_set after all content has been uploaded
        res = session.run_sql("""
            UPDATE `mysql_rest_service_metadata`.`content_set`
            SET enabled = 1
            WHERE id = ?
            """, [content_set_id])

        if interactive:
            return "\n" + "Content added successfully."
        else:
            return {
                "content_set_id": content_set_id,
                "number_of_files_uploaded": len(file_list)
            }

    except Exception as e:
        if raise_exceptions:
            raise
        print(f"Error: {str(e)}")


@plugin_function('mrs.list.contentSets', shell=True, cli=True, web=True)
def get_content_sets(service_id=None, **kwargs):
    """Returns all content sets for the given MRS service

    Args:
        service_id (int): The id of the service to list the schemas from
        **kwargs: Additional options

    Keyword Args:
        include_enable_state (bool): Only include items with the given
            enabled state
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised
        return_formatted (bool): If set to true, a list object is returned

    Returns:
        Either a string listing the content sets when interactive is set or list
        of dicts representing the content sets
    """

    include_enable_state = kwargs.get("include_enable_state")
    session = kwargs.get("session")
    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)

    try:
        session = core.get_current_session(session)

        # Make sure the MRS metadata schema exists and has the right version
        core.ensure_rds_metadata_schema(session)

        # Check the given service_id or get the default if none was given
        service = mrs_services.get_service(
            service_id=service_id, auto_select_single=True,
            session=session, interactive=interactive,
            return_formatted=False)

        sql = """
            SELECT cs.id, cs.request_path, cs.requires_auth,
                cs.enabled, cs.comments,
                CONCAT(h.name, se.url_context_root) AS host_ctx
            FROM `mysql_rest_service_metadata`.`content_set` cs
                LEFT OUTER JOIN `mysql_rest_service_metadata`.`service` se
                    ON se.id = cs.service_id
                LEFT JOIN `mysql_rest_service_metadata`.`url_host` h
				    ON se.url_host_id = h.id
            WHERE cs.service_id = ? /*=1*/
            """
        if include_enable_state is not None:
            sql += ("AND cs.enabled = "
                    f"{'TRUE' if include_enable_state else 'FALSE'} ")

        sql += "ORDER BY cs.request_path"

        res = session.run_sql(sql, [service.get("id")])

        content_sets = core.get_sql_result_as_dict_list(res)

        if return_formatted:
            return format_content_set_listing(
                content_sets=content_sets, print_header=True)
        else:
            return content_sets

    except Exception as e:
        if raise_exceptions:
            raise
        print(f"Error: {str(e)}")


@plugin_function('mrs.get.contentSet', shell=True, cli=True, web=True)
def get_content_set(request_path=None, **kwargs):
    """Gets a specific MRS content_set

    Args:
        request_path (str): The request_path of the content_set
        **kwargs: Additional options

    Keyword Args:
        content_set_id (int): The id of the content_set
        service_id (int): The id of the service
        auto_select_single (bool): If there is a single service only, use that
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode

    Returns:
        The schema as dict or None on error in interactive mode
    """

    content_set_id = kwargs.get("content_set_id")
    service_id = kwargs.get("service_id")
    auto_select_single = kwargs.get("auto_select_single", False)
    session = kwargs.get("session")
    interactive = kwargs.get("interactive", True)

    try:
        session = core.get_current_session(session)

        # Make sure the MRS metadata schema exists and has the right version
        core.ensure_rds_metadata_schema(session)

        # If there are no selective parameters given
        if (not request_path and not content_set_id and interactive):
            # See if there is a current content_set, if so, return that one
            content_set = core.get_current_content_set(session=session)
            if content_set:
                return content_set

            # Get the service_id
            service = mrs_services.get_service(
                service_id=service_id, auto_select_single=auto_select_single,
                session=session, interactive=interactive,
                return_formatted=False)
            if not service:
                return
            service_id = service.get("id")

            # Check if there already is at least one content_set
            sql = """
                SELECT COUNT(*) as content_set_count, MIN(id) AS id
                FROM `mysql_rest_service_metadata`.`content_set`
                WHERE service_id = ?
                """
            res = session.run_sql(sql, [service_id])
            row = res.fetch_one()
            content_set_count = row.get_field(
                "content_set_count") if row else 0

            # If there is exactly one service, set id to its id
            if content_set_count == 0:
                raise ValueError("No content_set available.")
            if auto_select_single and content_set_count == 1:
                content_set_id = row.get_field("id")

            # If there are more services, let the user select one or all
            if not content_set_id and interactive:
                content_sets = get_content_sets(
                    service_id=service_id, session=session,
                    interactive=False)
                print(f"Content Set Listing for Service "
                      f"{service.get('url_host_name')}"
                      f"{service.get('url_context_root')}")
                item = core.prompt_for_list_item(
                    item_list=content_sets,
                    prompt_caption=("Please select an index or type "
                                    "the content set name: "),
                    item_name_property="request_path",
                    given_value=None,
                    print_list=True)
                if not item:
                    raise ValueError("Operation cancelled.")
                else:
                    return item

        if request_path and not request_path.startswith('/'):
            raise Exception("The request_path has to start with '/'.")

        # Build SQL based on which input has been provided
        sql = """
            SELECT cs.id, cs.request_path, cs.requires_auth,
                cs.enabled, cs.comments,
                CONCAT(h.name, se.url_context_root) AS host_ctx
            FROM `mysql_rest_service_metadata`.`content_set` cs
                LEFT OUTER JOIN `mysql_rest_service_metadata`.`service` se
                    ON se.id = cs.service_id
                LEFT JOIN `mysql_rest_service_metadata`.`url_host` h
				    ON se.url_host_id = h.id
            WHERE 1 = 1
            """
        params = []
        if service_id:
            sql += "AND cs.service_id = ? "
            params = [service_id]
        if request_path:
            sql += "AND cs.request_path = ? "
            params.append(request_path)
        if content_set_id:
            sql += "AND cs.id = ? "
            params.append(content_set_id)

        res = session.run_sql(sql, params)

        content_sets = core.get_sql_result_as_dict_list(res)

        if len(content_sets) != 1:
            raise Exception("The given content set was not found.")
        else:
            return content_sets[0]

    except Exception as e:
        if interactive:
            print(f"Error: {str(e)}")
        else:
            raise


@plugin_function('mrs.enable.contentSet', shell=True, cli=True, web=True)
def enable_content_set(**kwargs):
    """Enables a content set of the given service

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (int): The id of the service
        content_set_id (int): The id of the content_set
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode

    Returns:
        The result message as string
    """

    service_id = kwargs.get("service_id")
    content_set_id = kwargs.get("content_set_id")
    session = kwargs.get("session")
    interactive = kwargs.get("interactive", True)

    return change_content_set(change_type=CONTENT_SET_ENABLE,
                              service_id=service_id,
                              content_set_id=content_set_id,
                              session=session,
                              interactive=interactive)


@plugin_function('mrs.disable.contentSet', shell=True, cli=True, web=True)
def disable_content_set(**kwargs):
    """Enables a content_set of the given service

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (int): The id of the service
        content_set_id (int): The id of the content_set
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode

    Returns:
        The result message as string
    """

    service_id = kwargs.get("service_id")
    content_set_id = kwargs.get("content_set_id")
    session = kwargs.get("session")
    interactive = kwargs.get("interactive", True)

    return change_content_set(change_type=CONTENT_SET_DISABLE,
                              service_id=service_id,
                              content_set_id=content_set_id,
                              session=session,
                              interactive=interactive)


@plugin_function('mrs.delete.contentSet', shell=True, cli=True, web=True)
def delete_content_set(**kwargs):
    """Enables a content_set of the given service

    Args:
        **kwargs: Additional options

    Keyword Args:
        service_id (int): The id of the service
        content_set_id (int): The id of the content_set
        session (object): The database session to use.
        interactive (bool): Indicates whether to execute in interactive mode

    Returns:
        The result message as string
    """

    service_id = kwargs.get("service_id")
    content_set_id = kwargs.get("content_set_id")
    session = kwargs.get("session")
    interactive = kwargs.get("interactive", True)

    return change_content_set(change_type=CONTENT_SET_DELETE,
                              service_id=service_id,
                              content_set_id=content_set_id,
                              session=session,
                              interactive=interactive)


def change_content_set(change_type=None, request_path=None, service_id=None,
                       **kwargs):
    """Makes a given change to a MRS content set

    Args:
        change_type (int): Type of change
        request_path (str): The request_path of the content_set
        service_id (int): The id of the service
        **kwargs: Additional options

    Keyword Args:
        content_set_id (int): The id of the content_set
        session (object): The database session to use
        interactive (bool): Indicates whether to execute in interactive mode

    Returns:
        The result message as string
    """

    content_set_id = kwargs.get("content_set_id")
    session = kwargs.get("session")
    interactive = kwargs.get("interactive", True)

    try:
        session = core.get_current_session(session)

        # Make sure the MRS metadata content_set exists and has the right version
        core.ensure_rds_metadata_schema(session)

        # The list of content_sets to be changed
        content_set_ids = [content_set_id] if content_set_id else []
        include_enable_state = None

        if not content_set_id:
            # Check if given service_id exists or use the current service
            service = mrs_services.get_service(
                service_id=service_id, session=session, interactive=interactive,
                return_formatted=False)

            if not request_path and interactive:
                content_sets = get_content_sets(
                    service_id=service.get("id"),
                    include_enable_state=include_enable_state,
                    session=session, interactive=False)
                caption = ("Please select an index, type "
                           "the request_path or type '*' "
                           "to select all: ")
                selection = core.prompt_for_list_item(
                    item_list=content_sets,
                    prompt_caption=caption,
                    item_name_property="request_path",
                    given_value=None,
                    print_list=True,
                    allow_multi_select=True)
                if not selection:
                    raise ValueError("Operation cancelled.")

                content_set_ids = [item["id"] for item in selection]

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
                    content_set_ids.append(row.get_field("id"))

        if len(content_set_ids) == 0:
            raise ValueError("The specified content_set was not found.")

        # Update all given services
        for content_set_id in content_set_ids:
            if change_type == CONTENT_SET_DISABLE:
                sql = """
                    UPDATE `mysql_rest_service_metadata`.`content_set`
                    SET enabled = FALSE
                    WHERE id = ?
                    """
            elif change_type == CONTENT_SET_ENABLE:
                sql = """
                    UPDATE `mysql_rest_service_metadata`.`content_set`
                    SET enabled = TRUE
                    WHERE id = ?
                    """
            elif change_type == CONTENT_SET_DELETE:
                res = session.run_sql("""
                    DELETE FROM `mysql_rest_service_metadata`.`content_file`
                    WHERE content_set_id = ?
                    """, [content_set_id])
                sql = """
                    DELETE FROM `mysql_rest_service_metadata`.`content_set`
                    WHERE id = ?
                    """
            else:
                raise Exception("Operation not supported")

            res = session.run_sql(sql, [content_set_id])
            if res.get_affected_row_count() == 0:
                raise Exception(
                    f"The specified content_set with id {content_set_id} was "
                    "not found.")

        if len(content_set_ids) == 1:
            msg = "The content set has been "
        else:
            msg = "The content sets have been "

        if change_type == CONTENT_SET_DISABLE:
            msg += "disabled."
        if change_type == CONTENT_SET_ENABLE:
            msg += "enabled."
        elif change_type == CONTENT_SET_DELETE:
            msg += "deleted."

        return msg

    except Exception as e:
        if interactive:
            print(f"Error: {str(e)}")
        else:
            raise
