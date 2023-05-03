# Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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

from mrs_plugin import lib

# Define plugin version
VERSION = "1.10.2"

DB_VERSION = [2, 0, 1]
REQUIRED_ROUTER_VERSION = [8, 0, 33]

DB_VERSION_STR = '%d.%d.%d' % tuple(DB_VERSION)
DB_VERSION_NUM = DB_VERSION[0] * 100000 + DB_VERSION[1] * 1000 + DB_VERSION[2]
REQUIRED_ROUTER_VERSION_STR = '%d.%d.%d' % tuple(REQUIRED_ROUTER_VERSION)


def get_status(session):
    # Check if the MRS metadata schema already exists
    row = lib.database.get_schema(session, "mysql_rest_service_metadata")
    if row is None:
        return {
            'service_configured': False,
            'service_enabled': False,
            'service_count': 0,
            'service_upgradeable': 0,
            'major_upgrade_required': 0,
        }
    else:
        result = {'service_configured': True}

    # Check if MRS is enabled
    row = lib.core.select(table="config",
                          cols="service_enabled",
                          where="id=1"
                          ).exec(session).first
    result['service_enabled'] = row["service_enabled"]

    # Get the number of enabled services
    row = lib.core.select(table="service",
                          cols="SUM(enabled) as service_count"
                          ).exec(session).first
    result['service_count'] = 0 if row["service_count"] is None else int(
        row["service_count"])

    current_version = lib.core.get_mrs_schema_version(session)
    result["service_upgradeable"] = DB_VERSION > current_version
    result["major_upgrade_required"] = DB_VERSION[0] > current_version[0]
    result["current_metadata_version"] = '%d.%d.%d' % tuple(current_version)
    result["required_metadata_version"] = DB_VERSION_STR
    result["required_router_version"] = REQUIRED_ROUTER_VERSION_STR

    return result
