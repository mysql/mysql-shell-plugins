# Copyright (c) 2023, Oracle and/or its affiliates.
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

from mrs_plugin.lib import *

FULL_ACCESS_ROLE_ID = bytes.fromhex("31000000000000000000000000000000")


def get_roles(session, service_id=None):
    sql = """
    SELECT *
        FROM `mysql_rest_service_metadata`.mrs_role
        WHERE specific_to_service_id IS NULL
    """
    params = []
    if service_id:
        sql += "OR specific_to_service_id = ?"
        params.append(service_id)

    return core.MrsDbExec(sql, params).exec(session).items


def get_role(session, role_id=None, service_id=None, caption=None):
    # If a role_id is given, look that one up
    if role_id is not None:
        sql = """
            SELECT * FROM `mysql_rest_service_metadata`.mrs_role
            WHERE id = ?
        """

        return core.MrsDbExec(sql, [role_id]).exec(session).first

    if service_id is not None and caption is not None:
        sql = """
            SELECT * FROM `mysql_rest_service_metadata`.mrs_role
            WHERE caption = ? AND
                (specific_to_service_id IS NULL OR specific_to_service_id = ?)
        """

        return core.MrsDbExec(sql, [caption, service_id]).exec(session).first

    return None


def add_role(session, derived_from_role_id, specific_to_service_id, caption, description):
    sql = """
    INSERT INTO `mysql_rest_service_metadata`.mrs_role
        (id, derived_from_role_id, specific_to_service_id, caption, description)
    VALUES
        (?, ?, ?, ?, ?)
    """

    id = core.get_sequence_id(session)

    params = [
        id,
        derived_from_role_id,
        specific_to_service_id,
        caption,
        description,
    ]

    core.MrsDbExec(sql, params).exec(session)

    return id


def delete_role(session, role_id):
    sql = """
    DELETE FROM `mysql_rest_service_metadata`.mrs_role
    WHERE id = ?
    """

    core.MrsDbExec(sql, [role_id]).exec(session)

