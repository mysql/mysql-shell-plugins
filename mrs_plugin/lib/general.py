# Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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

from mrs_plugin import lib
import msm_plugin.lib.management as schema_management

# Define plugin version
VERSION = "1.19.15"

DB_VERSION = [4, 1, 3]
REQUIRED_ROUTER_VERSION = [8, 1, 0]
SUPPORTED_MAJOR_VERSION = 3

DB_VERSION_STR = '%d.%d.%d' % tuple(DB_VERSION)
DB_VERSION_NUM = DB_VERSION[0] * 100000 + DB_VERSION[1] * 1000 + DB_VERSION[2]
REQUIRED_ROUTER_VERSION_STR = '%d.%d.%d' % tuple(REQUIRED_ROUTER_VERSION)

HEATWAVE_DEFAULT_ENDPOINTS_SCRIPT_VERSION = "1.1.0"

def get_status(session):
    # Check if the MRS metadata schema already exists
    row = lib.database.get_schema(session, "mysql_rest_service_metadata")
    if row is None:
        return {
            'service_configured': False,
            'service_enabled': False,
            'service_count': 0,
            'service_upgradeable': False,
            'service_upgrade_ignored': False,
            'major_upgrade_required': False,
            'service_being_upgraded': False,
        }
    # Check if the msm_schema_version VIEW already exists
    row = lib.database.get_db_object(
        session, "mysql_rest_service_metadata", "msm_schema_version", "VIEW")
    if row is None:
        # Also check the schema_version VIEW that was used for versions <= 3.1.0
        row = lib.database.get_db_object(
            session, "mysql_rest_service_metadata", "schema_version", "VIEW")
    if row is None:
        return {
            'service_configured': False,
            'service_enabled': False,
            'service_count': 0,
            'service_upgradeable': False,
            'service_upgrade_ignored': False,
            'major_upgrade_required': False,
            'service_being_upgraded': True,
        }

    # Get current version of metadata schema
    current_version = lib.core.get_mrs_schema_version(session)

    result = {
        'service_configured': True,
        'service_enabled': False,
        'service_upgradeable': DB_VERSION > current_version,
        'service_upgrade_ignored': False,
        'service_count': 0,
        'service_being_upgraded': current_version[0] == 0 and current_version[1] == 0 and current_version[2] == 0,
        'major_upgrade_required': current_version[0] == 1,
        'current_metadata_version': '%d.%d.%d' % tuple(current_version),
        'available_metadata_version': DB_VERSION_STR,
        'required_router_version': REQUIRED_ROUTER_VERSION_STR,
    }

    if result["service_being_upgraded"] == True:
        return result

    # Check if MRS is enabled
    row = lib.core.select(table="config",
                          cols=[
                              "service_enabled", "JSON_VALUE(data, '$.ignore_service_upgrades_till') as ignore_till"],
                          where="id=1"
                          ).exec(session).first
    result['service_enabled'] = row["service_enabled"] == 1

    ignore_till = row["ignore_till"]
    if ignore_till != None:
        result['service_upgrade_ignored'] = [
            int(i) for i in ignore_till.split(".")] >= current_version

    # Get the number of enabled services
    row = lib.core.select(table="service",
                          cols="SUM(enabled) as service_count"
                          ).exec(session).first
    result['service_count'] = 0 if row["service_count"] is None else int(
        row["service_count"])

    return result


def configure(session=None, enable_mrs: bool = None, options: str = None,
              update_if_available=False, edition: str = None, version: str = None,
              merge_options=False):
    """Initializes and configures the MySQL REST Data Service

    Args:
        session (object): The database session to use
        enable_mrs (bool): Whether MRS should be enabled or disabled
        options (str): a JSON string containing the MRS options
        update_if_available (bool): Whether the MRS metadata schema should be updated
        edition (str): If set to HeatWave or MySQLAi, special handling for those edition is triggered.
        version (str): The exact version to upgrade the metadata schema to.
        merge_options (bool): If set to True, specified options will be merged rather than overwritten

    Returns:
        A dict with status information
    """
    skip_update = False

    with lib.core.MrsDbSession(session=session, check_version=False) as session:
        if lib.core.mrs_metadata_schema_exists(session):
            current_db_version = lib.core.get_mrs_schema_version(session)
            current_version_str = '%d.%d.%d' % tuple(current_db_version)

            last_deployment_version = schema_management.get_last_deployment_script_version(
                schema_project_path=lib.core.script_path(
                    "db_schema", "mysql_rest_service_metadata.msm.project"))

            if current_db_version[0] > lib.general.DB_VERSION[0]:
                raise Exception(
                    "This version of MySQL Shell does not support the MRS "
                    "metadata database schema version "
                    f"{current_version_str}. Please update "
                    "MySQL Shell to work with this MRS version.")

            if current_db_version[0] < lib.general.SUPPORTED_MAJOR_VERSION and not update_if_available:
                raise Exception(
                    f"The MRS metadata version {current_version_str} is "
                    "too old to be managed by this version of MySQL Shell. "
                    "Please update the MRS metadata version, e.g. run "
                    "`mrs.configure(update_if_available=True)` to update.")

            if current_db_version < last_deployment_version and not update_if_available:
                skip_update = True

            # When upgrading from major version 3, make sure to create the
            # msm_schema_version view in order to allow the msm_plugin to update it
            if current_db_version[0] == 3:
                session.run_sql("""
                    CREATE OR REPLACE
                    VIEW mysql_rest_service_metadata.msm_schema_version AS
                    SELECT * FROM mysql_rest_service_metadata.schema_version""")

        if edition is None or edition.lower() != "heatwave":
            # For now, let's remove any previous version of the mysql_tasks schema
            session.run_sql("DROP SCHEMA IF EXISTS mysql_tasks")

            # For all editions except heatwave, also deploy the mysql_tasks
            # database schema
            if not skip_update:
                schema_management.deploy_schema(
                    session=session,
                    schema_project_path=lib.core.script_path(
                        "db_schema", "mysql_tasks.msm.project"))

        # Start the MRS metadata schema deployment which will either create
        # or update an existing schema to the given version
        if not skip_update:
            info_msg = schema_management.deploy_schema(
                session=session,
                schema_project_path=lib.core.script_path(
                    "db_schema", "mysql_rest_service_metadata.msm.project"),
                version=version)

            schema_changed = not ("No changes" in info_msg)

            # Check if the HeatWave default endpoints have already been deployed
            if edition is not None and (
                edition.lower() == "heatwave" or edition.lower() == "mysqlai"):
                # Script 1.0.0 used CREATE OR REPLACE REST SERVICE
                # which must not be re-executed or any service references
                # (like auth apps) will be lost. Newer scripts use
                # CREATE REST SERVICE IF NOT EXISTS which we can re-execute to
                # handle upgrades.
                assert "1.0.0" not in HEATWAVE_DEFAULT_ENDPOINTS_SCRIPT_VERSION

                schema_management.execute_msm_sql_script(
                    session=session,
                    script_name="HeatWave Default Endpoints",
                    sql_file_path=lib.core.script_path(
                        "scripts", "default_heatwave_endpoints",
                        f"heatwave_rest_service_{HEATWAVE_DEFAULT_ENDPOINTS_SCRIPT_VERSION}.sql"))
        else:
            schema_changed = False
            info_msg = (
                "MRS metadata version update available, but update skipped.")

        if enable_mrs is not None:
            lib.core.update(
                table="config", sets="service_enabled=?", where="id=1"
            ).exec(session, [1 if enable_mrs else 0])
        else:
            row = lib.core.select(
                table="config", cols="service_enabled", where="id=1"
            ).exec(session).first
            enable_mrs = row["service_enabled"] if row else 0

        if options is not None:
            if merge_options:
                session.run_sql("""
                    UPDATE `mysql_rest_service_metadata`.`config`
                    SET data = JSON_MERGE_PATCH(data, ?)
                    WHERE id = 1""", [options])
            else:
                session.run_sql("""
                    UPDATE `mysql_rest_service_metadata`.`config`
                    SET data = ?
                    WHERE id = 1""", [options])

        return {
            "schema_changed": schema_changed,
            "info_msg": info_msg,
            "mrs_enabled": True if enable_mrs else False
        }


def ignore_version_upgrade(session):
    lib.core.update(
        table="`mysql_rest_service_metadata`.`config`",
        sets=f"data = JSON_SET(data, '$.ignore_service_upgrades_till', '{DB_VERSION_STR}')",
        where="id = 1"
    ).exec(session)


def get_available_metadata_versions(session):
    return schema_management.get_released_versions(
        schema_project_path=lib.core.script_path(
            "db_schema", "mysql_rest_service_metadata.msm.project"))


def get_config_options(session):
    # Check if the msm_schema_version VIEW already exists
    row = lib.database.get_db_object(
        session, "mysql_rest_service_metadata", "config", "TABLE")
    if row:
        row = lib.core.select(
            table="config",
            cols=["data"],
            where="id=1"
        ).exec(session).first

        return row["data"]
    else:
        return {}
