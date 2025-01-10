# Copyright (c) 2023, 2025, Oracle and/or its affiliates.
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

from mrs_plugin.lib import core


def get_router_ids(session, seen_within=None):
    sql = """
    SELECT id FROM `mysql_rest_service_metadata`.`router`
    """

    if seen_within:
        sql += f"WHERE last_check_in > CURRENT_TIMESTAMP - INTERVAL {seen_within} SECOND"

    return core.MrsDbExec(sql).exec(session).items


def get_routers(session, router_id=None, active_when_seen_within=10):
    sql = f"""
    SELECT
        *,
        last_check_in > CURRENT_TIMESTAMP - INTERVAL {active_when_seen_within} SECOND as active,
        options->>'$.developer' AS developer
    FROM `mysql_rest_service_metadata`.`router`
    """
    params = []

    if router_id:
        sql += "WHERE id = ?"
        params.append(router_id)

    return core.MrsDbExec(sql, params).exec(session).items


def get_router(session, router_id, active_when_seen_within=10):
    result = get_routers(session, router_id, active_when_seen_within)

    if result:
        return result[0]

    return None


def delete_router(session, router_id):
    sql = """
        DELETE
        FROM `mysql_rest_service_metadata`.`router`
        WHERE id = ?
    """
    core.MrsDbExec(sql, [router_id]).exec(session)


def get_router_services(session, router_id=None):
    current_version = core.get_mrs_schema_version(session)
    if current_version[0] <= 2:
        return []

    sql = """
        SELECT * FROM `mysql_rest_service_metadata`.`router_services` AS r
        """

    params = []
    if router_id is not None:
        sql += "\nWHERE r.router_id = ?"
        params.append(router_id)

    return core.MrsDbExec(sql).exec(session, params).items
