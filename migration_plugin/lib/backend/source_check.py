# Copyright (c) 2025, Oracle and/or its affiliates.
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


from ..util import sanitize_dict, k_san_dict_connection
from . import model, checks
from .. import dbsession, logging
from typing import Optional
import mysqlsh  # type: ignore
from mysqlsh import mysql  # type: ignore

k_dbsystem_online_timeout = 15 * 60
k_storage_available_timeout = 5 * 60


class MySQLSourceCheck:
    session = None
    ssl_supported = False
    uuid: str = ""

    def __init__(self, options: model.MigrationOptions) -> None:
        self.options = options

    def __del__(self):
        if self.session:
            self.session.close()

    @classmethod
    def try_connect(
        cls, connection_options: dict
    ) -> tuple[model.ConnectionCheckResult, bool, dbsession.MigrationSession | None]:
        # ensure source supports SSL, as we'll require it by default for IBR
        # (older MySQL servers don't enable it by default)
        error, session = cls._do_try_connect(
            connection_options, ssl_required=True)
        if session:
            return error, True, session
        if error.connectErrno == mysql.ErrorCode.CR_SSL_CONNECTION_ERROR:
            # try again without SSL
            error, session = cls._do_try_connect(
                connection_options, ssl_required=False)
            if session:
                logging.warning(
                    f"Could not connect to source MySQL using SSL. Connections to source DB will not be encrypted and inbound replication will not be possible.")
                return error, False, session

        return error, False, session

    @classmethod
    def _do_try_connect(
        cls, connection_options: dict, ssl_required: bool
    ) -> tuple[model.ConnectionCheckResult, dbsession.MigrationSession | None]:
        try:
            session = dbsession.MigrationSession(
                connection_options | {"ssl-mode": "REQUIRED" if ssl_required else "PREFERRED"})
        except mysqlsh.DBError as e:
            logging.error(f"source_check: connection check: {e}")

            result = model.ConnectionCheckResult()
            result.connectError = e.msg
            result.connectErrno = e.code
            if e.code and (e.code < 2000 or e.code >= 3000):
                result.reachable = True
            else:
                result.resolvable = checks.address_resolvable(
                    connection_options)
                if checks.ping(connection_options):
                    result.reachable = True
            return result, None
        except Exception as e:
            logging.exception(f"source_check: connection check")
            result = model.ConnectionCheckResult()
            result.connectError = str(e)
            return result, None

        result = model.ConnectionCheckResult()
        return result, session

    def check_connection(self) -> model.ConnectionCheckResult:
        assert self.options.sourceConnectionOptions

        conn_clean = sanitize_dict(
            self.options.sourceConnectionOptions.copy(), k_san_dict_connection
        )
        logging.info(f"source_check: starting readiness check of {conn_clean}")
        check_result, self.ssl_supported, self.session = self.try_connect(
            self.options.sourceConnectionOptions
        )
        if check_result.connectError:
            logging.error(
                f"source_check: can't connect to {conn_clean}: {check_result}"
            )
            return check_result

        assert self.session
        logging.info(f"source_check: is ok")

        self.uuid = self.session.run_sql("SELECT @@server_uuid").fetch_one()[0]
        logging.info(f"Source server UUID is {self.uuid}")

        return check_result

    def check_source(self) -> tuple[list[model.MigrationError], model.SourceCheckResult]:
        assert self.session
        logging.debug(f"source_check: running basic source checks")
        errors, check_results = checks.validate_source(
            self.session, self.options)

        if errors:
            for error in errors:
                logging.error(
                    f"source_check: basic source checks failed: error={error} info={check_results}"
                )
        else:
            logging.info(f"source_check: basic source checks succeeded")

        return errors, check_results

    def check_replication(self, server_info: model.ServerInfo) -> Optional[model.MigrationError]:
        assert self.session
        logging.debug(f"source_check: running source replication checks")
        error = checks.check_inbound_replication_requirements(
            self.session, server_info)
        if error:
            logging.error(
                f"source_check: source replication checks failed: error={error}"
            )
        else:
            logging.info(f"source_check: source replication checks succeeded")

        return error

    def check_compatibility(
        self, compatibility_flags: list[model.CompatibilityFlags], filters: model.MigrationFilters
    ) -> model.MigrationCheckResults:
        assert self.session
        assert self.options.sourceConnectionOptions
        assert self.options.targetMySQLOptions

        logging.debug(f"source_check: running compatibility checks")
        check_results = checks.check_service_compatibility(
            self.session, compatibility_flags, filters,
            self.options.targetMySQLOptions.mysqlVersion,
            self.options.migrateUsers
        )
        logging.debug(
            f"source_check: compatibility checks done: results={check_results}"
        )

        return check_results

    def check_upgrade(
        self, filters: model.MigrationFilters
    ) -> model.MigrationCheckResults:
        assert self.session
        assert self.options.targetMySQLOptions

        logging.debug(f"source_check: running schema checks")
        check_results = checks.check_upgrade(
            self.session, filters,
            target_version=self.options.targetMySQLOptions.mysqlVersion
        )
        logging.debug(
            f"source_check: upgrade checks done: results={check_results}")

        return check_results
