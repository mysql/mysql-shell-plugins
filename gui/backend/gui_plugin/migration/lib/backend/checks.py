# Copyright (c) 2025, 2026, Oracle and/or its affiliates.
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

from ..errors import Aborted

from ..dbsession import MigrationSession, version_to_nversion
from . import schema_checks
from .. import logging
from . import submysqlsh
from . import replication
from . import model, model_utils
from .model import ServerType

from typing import Callable, Optional
import sys
import socket
import subprocess

kMinBinlogExpirationHours = 24  # hours

# from modules/util/common/dump/constants.h
k_excluded_users = [
    "mysql.infoschema",
    "mysql.session",
    "mysql.sys",
]

k_mhs_excluded_users = [
    "administrator",
    "mysql_option_tracker_persister",
    "mysql_rest_service_admin",
    "mysql_rest_service_data_provider",
    "mysql_rest_service_dev",
    "mysql_rest_service_meta_provider",
    "mysql_rest_service_schema_admin",
    "mysql_rest_service_user",
    "mysql_task_admin",
    "mysql_task_user",
    "ociadmin",
    "ocidbm",
    "ocimonitor",
    "ocirest",
    "ocirpl",
    "oracle-cloud-agent",
    "rrhhuser",
]

k_excluded_schemas = [
    "information_schema",
    "mysql",
    "ndbinfo",
    "performance_schema",
    "sys",
]

k_mhs_excluded_schemas = [
    "mysql_audit",
    "mysql_autopilot",
    "mysql_firewall",
    "mysql_option",
    "mysql_rest_service_metadata",
    "mysql_tasks",
]


def mysqlsh_nversion():
    import mysqlsh  # type: ignore

    return version_to_nversion(mysqlsh.globals.shell.version.split()[1])


def _pick_target_version(source: MigrationSession) -> str:
    if source.server_type in (
        ServerType.MySQL,
        ServerType.HeatWave,
        ServerType.Percona,
        ServerType.RDS,
        ServerType.Aurora,
    ):
        if source.nversion / 100 <= 800:
            return "8.0"
        if source.nversion / 100 <= 804:
            return "8.4"
        return "9.4"
    return "8.4"


def validate_source(
    session: MigrationSession, options: model.MigrationOptions
) -> tuple[list[model.MigrationError], model.SourceCheckResult]:

    result = model.SourceCheckResult(serverInfo=collect_server_info(session))

    errors = check_version_compatibility(session, options)
    errors.extend(check_ssl(session, result.serverInfo))

    if ServerType.RDS == session.server_type:
        errors.extend(check_rds(session))

    if ServerType.Aurora == session.server_type:
        errors.extend(check_aurora(session))

    return errors, result


def validate_target(
    session: MigrationSession,
) -> tuple[list[model.MigrationError], model.TargetCheckResult]:
    result = model.TargetCheckResult(targetInfo=collect_server_info(session))

    errors = check_ssl(session, result.targetInfo)

    system_schemas = ",".join(
        [f"'{s}'" for s in k_excluded_schemas + k_mhs_excluded_schemas]
    )
    result.userSchemaCount = session.run_sql(
        f"select count(*) from information_schema.schemata where schema_name not in ({system_schemas})"
    ).fetch_one()[0]

    system_users = ",".join([f"'{s}'" for s in k_excluded_users + k_mhs_excluded_users])
    result.userAccountCount = session.run_sql(
        f"select count(*) from mysql.user where user not in ({system_users})"
    ).fetch_one()[0]

    return errors, result


def check_version_compatibility(
    session: MigrationSession, options: model.MigrationOptions
) -> list[model.MigrationError]:
    errors: list[model.MigrationError] = []

    if session.nversion < 50600:
        err = model.MigrationError(
            model.MessageLevel.WARNING,
            title="Unsupported MySQL Server Version",
            message=f"Source instance has MySQL version {session.version} which is currently not supported by this tool. You may proceed anyway, but results may vary.",
        )
        errors.append(err)

    if session.nversion / 100 > mysqlsh_nversion() / 100:  # ignore patch level
        err = model.MigrationError(
            model.MessageLevel.WARNING,
            title="Unsupported MySQL Server Version",
            message=f"Source instance has MySQL version {session.version} which is currently not supported by this tool. Please upgrade this Migration Assistant to the latest version. You may proceed anyway, but results may vary.",
        )
        errors.append(err)

    if model.ServerType.MariaDB == session.server_type:
        err = model.MigrationError(
            model.MessageLevel.WARNING,
            title="Unsupported MySQL Server",
            message=f"Source instance is a MariaDB server, migration of user accounts from MariaDB is currently not supported by this tool. Migration of user accounts has been disabled.",
        )
        errors.append(err)

        options.schemaSelection.migrateUsers = False

    return errors


def check_inbound_replication_requirements(
    session: MigrationSession, server_info: model.ServerInfo
) -> Optional[model.MigrationError]:
    format, gtid_mode, expiration = replication.get_binlog_info(session)
    logging.info(
        f"{session}: binlog_format={format} gtid_mode={gtid_mode} expiration={expiration}"
    )

    # TODO add check for mariadb, older mariadb versions might be ok, but replication
    # from newer ones will not work

    if not format:
        return model.MigrationError(
            model.MessageLevel.ERROR,
            title="Hot Migration not possible because Binary logging (<code>log_bin</code>) is disabled",
            message="""Binary logging must be enabled in order to setup
inbound replication between your source MySQL instance and the new HeatWave
instance.
<br/>
You may:
<ul>
<li> enable Row Based Replication at the source MySQL instance and restart the Migration Assistant
<li> switch to a Cold Migration, which will require some downtime when switching applications to the new MySQL server
</ul>
""",
        )

    if format != "ROW":
        return model.MigrationError(
            model.MessageLevel.ERROR,
            title=f"Hot Migration not possible configured binary log format (<code>binlog_format</code>) is set to {format}",
            message=f"""The <code>binlog_format</code> is currently set to {format},
but the HeatWave service requires it to be `ROW`.
<br/>
You may:
<ul>
<li> change <code>binlog_format</code> at the source MySQL instance to <code>ROW</code> format and restart the Migration Assistant
<li> switch to a Cold Migration, which will require some downtime when switching applications to the new MySQL server
</ul>
""",
        )

    if not server_info.sslSupported:
        return model.MigrationError(
            model.MessageLevel.ERROR,
            title=f"Source MySQL server does not support SSL connections",
            message=f"""The source MySQL server does not support SSL connections, which are
required by the MySQL HeatWave Service to create secure, encrypted replication channels. A Hot Migration will not be
possible unless SSL is enabled at the source MySQL server.
<br/>
You may:
<ul>
<li> enable SSL connections at the source MySQL server and restart the Migration Assistant
<li> switch to a Cold Migration, which will require some downtime when switching applications to the new MySQL server
</ul>
""",
        )

    if expiration is not None and expiration < kMinBinlogExpirationHours * 3600:
        if expiration // 60 < 30:
            return model.MigrationError(
                model.MessageLevel.ERROR,
                title="Binary log expiration period is too short",
                message=f"""The source MySQL binary log is configured to automatically
expire and purge in less than 30 minutes.""",
            )

        hours = expiration // 3600
        if hours < 1:
            expire = "less than one hour"
        elif hours == 1:
            expire = "one hour"
        else:
            expire = f"{hours} hours"
        return model.MigrationError(
            model.MessageLevel.WARNING,
            title="Binary log expiration period is short",
            message=f"""The source MySQL binary log is configured to automatically
expire and purge in {expire}.
If the migration process takes longer than that, the target instance may be
unable to catch up to the source before transactions are purged from the binary log.""",
        )

    return None


def check_ssl(
    session: MigrationSession, info: model.ServerInfo
) -> list[model.MigrationError]:
    errors: list[model.MigrationError] = []

    # BUG#38879030 - fail early if source instance does not support SSL connections
    # TODO: allow migration if connection is secure (BUG#38891672)
    if not info.sslSupported:
        err = model.MigrationError(
            model.MessageLevel.ERROR,
            title="Source does not support SSL",
            message=f"The MySQL instance does not support SSL connections.",
        )
        errors.append(err)

    ssl_cipher = ""

    if row := session.run_sql("SHOW SESSION STATUS LIKE 'Ssl_cipher'").fetch_one():
        ssl_cipher = row[1]

    if not ssl_cipher and info.sslSupported:
        err = model.MigrationError(
            model.MessageLevel.ERROR,
            title="Session is not using SSL",
            message=f"The MySQL instance supports SSL connections, however current session is not encrypted.",
        )
        errors.append(err)

    return errors


def __check_bool_sysvar(session: MigrationSession, name: str) -> bool:
    value = False

    if row := session.run_sql(f"select @@{name}").fetch_one():
        value = bool(row[0])

    return value


def check_binlog(session: MigrationSession) -> bool:
    return __check_bool_sysvar(session, "log_bin")


def check_rds(session: MigrationSession) -> list[model.MigrationError]:
    errors: list[model.MigrationError] = []

    if not check_binlog(session):
        err = model.MigrationError(
            model.MessageLevel.ERROR,
            title="Binary logging is disabled in the RDS instance",
            message="""Migration from an RDS instance requires binary logging to be enabled.

To enable binary logging, automated backups must be turned on. For more
information, please consult the AWS documentation.""",
        )
        errors.append(err)

    return errors


def check_innodb_read_only(session: MigrationSession) -> bool:
    return __check_bool_sysvar(session, "innodb_read_only")


def check_aurora(session: MigrationSession) -> list[model.MigrationError]:
    errors: list[model.MigrationError] = []
    read_only = check_innodb_read_only(session)

    if read_only:
        err = model.MigrationError(
            model.MessageLevel.ERROR,
            title="Connected to the reader endpoint of an Aurora cluster",
            message="""Migration from an Aurora cluster requires access to the binary logs.

When binary logging is enabled in an Aurora cluster, only the writer endpoint or
the writer instance provides access to the binary logs.""",
        )
        errors.append(err)

    # reader endpoints/instances always have the binlog disabled
    if not read_only and not check_binlog(session):
        err = model.MigrationError(
            model.MessageLevel.ERROR,
            title="Binary logging is disabled in the Aurora cluster",
            message="""Migration from an Aurora cluster requires binary logging to be enabled.

To enable binary logging, edit the DB cluster parameter group and set
'binlog_format' parameter to 'ROW'. For more information, please consult the AWS
documentation.""",
        )
        errors.append(err)

    return errors


def make_default_schema_check_exclude_list():
    checks = submysqlsh.list_upgrade_checks()
    exclude = []
    for check in checks:
        if check["id"] in [
            "authMethodUsage",  # this is also reported by the dumper, though UC's is more thorough
            # this issue only applies to in-place upgrades
            "changedFunctionsInGeneratedColumns",
            "checkTableCommand",  # checks for issues with in-place upgrade
            "circularDirectory",  # checks tablespaces, these are removed by the dumper
            "deprecatedDefaultAuth",  # checks only sysvars
            "deprecatedRouterAuthMethod",  # similar to authMethodUsage
            "mysqlSchema",  # checks tables in mysql schema, we don't migrate this schema
            # checks for partitioned tables in tablespaces, tablespaces are removed by the dumper
            "partitionedTablesInSharedTablespaces",
            "pluginUsage",  # checks for installed plugins
            "sysVars",  # checks only sysvars
        ]:
            exclude.append(check["id"])
    return exclude


def check_upgrade(
    session: MigrationSession,
    schema_selection: model.SchemaSelectionOptions,
    target_version: str,
    on_progress: Callable[[model.MigrationCheckProgress], bool],
) -> model.MigrationCheckResults:
    if session.nversion >= version_to_nversion(target_version):
        logging.info(
            f"skipping upgrade checks: source_mysql_version={session.nversion}, target_version={version_to_nversion(target_version)}"
        )
        return model.MigrationCheckResults()

    logging.info(
        f"filtering upgrade checks: source_mysql_version={session.nversion}, target_version={version_to_nversion(target_version)}"
    )

    exclude_checks = make_default_schema_check_exclude_list()

    logging.info(
        f"running upgrade checks: source_mysql_version={session.nversion}, target_version={version_to_nversion(target_version)}"
    )

    def on_output(j: dict) -> bool:
        if "progress" in j:
            progress = j["progress"]
            return on_progress(
                model.MigrationCheckProgress(
                    detail=progress.get("detail", ""),
                    completed=progress.get("completed", 0),
                    total=progress.get("total", 0),
                    currentCheckTitle=progress.get("check", ""),
                    currentCheck=progress["currentCheck"],
                    totalChecks=progress["totalChecks"],
                )
            )
        return False

    output = submysqlsh.check_for_server_upgrade(
        on_output,
        session.connection_options,
        [],
        targetVersion=target_version,
        exclude=exclude_checks,
    )

    if output["aborted"]:
        raise Aborted("Upgrade checks aborted by the user")

    result = model.MigrationCheckResults()

    schema_checks.process_upgrade_issues(output, result, schema_selection)

    return result


def check_service_compatibility(
    session: MigrationSession,
    compatibility_flags: list[model.CompatibilityFlags],
    schema_selection: model.SchemaSelectionOptions,
    target_version: str,
    on_progress: Callable[[model.MigrationCheckProgress], bool],
) -> model.MigrationCheckResults:
    args = model_utils.build_dump_exclude_list(schema_selection)

    compat_flags = [flag.value for flag in compatibility_flags]
    logging.info(
        f"running dump checks with compatibilityFlags={compat_flags}, selection={schema_selection}"
    )

    def on_output(j: dict) -> bool:
        if "numericProgressUpdate" in j:
            progress = j["numericProgressUpdate"]
            description = progress.get("description", "")

            if description and "compatibility" in description:
                return on_progress(
                    model.MigrationCheckProgress(
                        detail=description,
                        completed=progress.get("current", 0),
                        total=progress.get("total", 0),
                    )
                )
        return False

    output = submysqlsh.dump_instance_dry_run(
        on_output,
        session.connection_options,
        args=args,
        compatibility=compat_flags,
        targetVersion=target_version,
    )

    logging.devdebug(f"dumpInstanceDryRun output={output}")

    if output["aborted"]:
        raise Aborted("Compatibility checks aborted by the user")

    if output["status"] and "MYSQLSH 52004" != output["errorCode"]:
        raise Exception(output["errors"][-1])

    result = model.MigrationCheckResults()
    schema_checks.process_ocimds_issues(output, result)

    return result


def estimate_database_size(session: MigrationSession) -> tuple[int, int]:
    # TODO - filter to just account for what will be migrated

    data_size, index_size = session.run_sql(
        "select sum(data_length), sum(index_length) from information_schema.tables"
    ).fetch_one()

    if data_size is not None:
        data_size = int(data_size)
    else:
        data_size = 0

    if index_size is not None:
        index_size = int(index_size)
    else:
        index_size = 0

    return data_size, index_size


def collect_server_info(session: MigrationSession) -> model.ServerInfo:
    data_size, index_size = estimate_database_size(session)

    hostname, serverUuid = session.run_sql(
        "select @@hostname, @@server_uuid"
    ).fetch_one()

    hasMRS = session.run_sql(
        "select count(*) from information_schema.schemata where schema_name='mysql_rest_service_metadata'"
    ).fetch_one()[0]

    num_native, num_old = session.run_sql(
        "select cast(sum(if(plugin = 'mysql_native_password', 1, 0)) as signed), cast(sum(if(plugin = 'mysql_old_password', 1, 0)) as signed) from mysql.user"
    ).fetch_one()

    # assume ssl is not supported
    sslSupported = False
    if session.nversion >= 80400:
        sslSupported = True
    else:
        row = session.run_sql("show variables like 'have_ssl'").fetch_one()
        if row:
            sslSupported = row[1] != "DISABLED"
        else:
            logging.error(
                f"have_ssl unexpectedly doesn't exist (version={session.nversion})"
            )

    gtidMode = ""
    if session.server_type != model.ServerType.MariaDB:
        if session.nversion >= 50605:
            try:
                gtidMode = session.run_sql("select @@gtid_mode").fetch_one()[0]
            except Exception as e:
                logging.info(f"select @@gtid_mode: {e}")

    schemaCount = session.run_sql(
        "select count(*) from information_schema.schemata"
    ).fetch_one()[0]

    return model.ServerInfo(
        hostname=hostname,
        serverUuid=serverUuid,
        schemaCount=schemaCount,
        dataSize=data_size + index_size,
        hasMRS=hasMRS,
        numAccountsOnMysqlNativePassword=num_native,
        numAccountsOnOldPassword=num_old,
        sslSupported=sslSupported,
        version=session.version,
        versionComment=session.version_comment,
        license=session.license,
        serverType=session.server_type,
        gtidMode=gtidMode,
    )


def address_resolvable(connect_info: dict):
    try:
        socket.getaddrinfo(connect_info["host"], None)
        return True
    except socket.gaierror as e:
        return False


def ping(connect_info: dict):
    if sys.platform == "darwin":
        cmd = ["ping", "-o", "-t5", connect_info["host"]]
    elif sys.platform == "linux":
        cmd = ["ping", "-c1", "-w5", connect_info["host"]]
    else:
        return None
    logging.info(" ".join(cmd))
    try:
        output = subprocess.check_output(cmd, stderr=subprocess.STDOUT)
        logging.info(output.decode("utf-8"))
        return True
    except subprocess.CalledProcessError as e:
        logging.info(str(e))
        return False
