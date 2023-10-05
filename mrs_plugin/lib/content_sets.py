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

from mrs_plugin.lib import core, services
import os

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
        core.delete(table="content_file", where="content_set_id=?").exec(session, [content_set_id])
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


def query_content_sets(session, content_set_id: bytes=None, service_id: bytes=None,
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
        SELECT cs.id, cs.request_path, cs.requires_auth,
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

    sql +=  core._generate_where(wheres)

    return core.MrsDbExec(sql, params).exec(session).items

def get_content_set(session, service_id: bytes=None, request_path=None, content_set_id: bytes=None):
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


def add_content_set(session, service_id, request_path, requires_auth=False, comments="", options=None, enabled=True):
    values = {
        "id": core.get_sequence_id(session),
        "service_id": service_id,
        "request_path": request_path,
        "requires_auth": int(requires_auth),
        "enabled": int(enabled),
        "comments": comments,
        "options": options
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
