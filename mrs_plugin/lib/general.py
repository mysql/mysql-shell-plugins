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
VERSION = "1.14.2"

DB_VERSION = [2, 2, 0]
REQUIRED_ROUTER_VERSION = [8, 1, 0]

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
            'service_upgradeable': False,
            'major_upgrade_required': False,
        }
    else:
        result = {'service_configured': True}

    # Check if MRS is enabled
    row = lib.core.select(table="config",
                          cols="service_enabled",
                          where="id=1"
                          ).exec(session).first
    result['service_enabled'] = row["service_enabled"] == 1

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


def configure(session=None, enable_mrs=None, options=None,
              update_if_available=False, allow_recreation_on_major_upgrade=False):
    """Initializes and configures the MySQL REST Data Service

    Args:
        session (object): The database session to use
        enable_mrs (bool): Whether MRS should be enabled or disabled
        options (str): a JSON string containing the MRS options
        update_if_available (bool): Whether the MRS metadata schema should be updated
        allow_recreation_on_major_upgrade (bool): Whether the MRS metadata schema can be dropped and recreated if needed

    Returns:
        A dict with status information
    """

    with lib.core.MrsDbSession(session=session, check_version=False) as session:
        schema_changed = False
        if lib.core.mrs_metadata_schema_exists(session):
            current_db_version = lib.core.get_mrs_schema_version(session)

            if lib.general.DB_VERSION < current_db_version:
                raise Exception(
                    "Unsupported MRS metadata database schema "
                    f"version {lib.general.DB_VERSION_STR}. "
                    "Please update your MRS Shell Plugin.")

            # Major upgrade available
            if current_db_version[0] < lib.general.DB_VERSION[0]:
                # this is a major version upgrade, so allow_recreation_on_major_upgrade
                # must be set to true
                if not allow_recreation_on_major_upgrade:
                    raise Exception(
                        "This MRS Shell Plugin version requires a new major version of the MRS "
                        "metadata schema. To drop and recreate the MRS metadata schema please "
                        "run `mrs.configure(allow_recreation_on_major_upgrade=True)` to upgrade.")

                lib.core.create_mrs_metadata_schema(
                    session, drop_existing=True)
                schema_changed = True

            elif current_db_version < lib.general.DB_VERSION:
                if not update_if_available:
                    raise Exception(
                        "The MRS metadata is outdated. Please reconfigure the instance, "
                        "e.g. run `mrs.configure(update_if_available=True)` to update.")

                # if the major upgrade was accepted or it's a minor upgrade,
                # proceed to execute it
                current_db_version = [str(ver) for ver in current_db_version]

                lib.core.update_mrs_metadata_schema(
                    session, ".".join(current_db_version))
                schema_changed = True
        else:
            lib.core.create_mrs_metadata_schema(session)

        if enable_mrs is not None:
            lib.core.update(
                table="config", sets="service_enabled=?", where="id=1"
            ).exec(session, [1 if enable_mrs else 0])
        else:
            row = lib.core.select(table="config", cols="service_enabled", where="id=1"
                                  ).exec(session).first
            enable_mrs = row["service_enabled"] if row else 0

        if options is not None:
            lib.core.update(
                table="config", sets="data=?", where="id=1"
            ).exec(session, [options])

        return {
            "schema_changed": schema_changed,
            "mrs_enabled": True if enable_mrs else False
        }
