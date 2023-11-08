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

from asyncio import current_task
import gui_plugin.core.dbms.DbMySQLSessionCommon as common
from gui_plugin.core.dbms.DbSessionSetupTask import DbSessionSetupTask
from gui_plugin.core.dbms.DbSessionUtils import DbSessionData
from gui_plugin.core.lib.OciUtils import BastionSessionRegistry, BASTION_SETUP_OPTIONS


class SessionInfoTask(DbSessionSetupTask):
    def __init__(self, session, progress_cb=None) -> None:
        super().__init__(session, progress_cb)

    def on_connected(self):
        result = self.execute(
            """SELECT connection_id(),
                        @@version,
                        @@SESSION.sql_mode""").fetch_all()[0]

        self.define_data(common.MySQLData.CONNECTION_ID, result[0])
        self.define_data(common.MySQLData.VERSION_INFO, result[1])
        self.define_data(common.MySQLData.SQL_MODE, result[2])


class HeatWaveCheckTask(DbSessionSetupTask):
    _OPT = 'disable-heat-wave-check'

    def __init__(self, session) -> None:
        super().__init__(session)

        # The check is enabled if the value is not known
        self._already_known = self.has_data(
            common.MySQLData.HEATWAVE_AVAILABLE)

        self._skip_hw_check = self._already_known

    def on_connect(self):
        # No matter what, the option should be removed if exists
        skip_hw_check = self.extract_option(self._OPT, False)

        # If check is enabled, verify if it was not disabled by user settings
        if not self._already_known and skip_hw_check:
            self._skip_hw_check = True

            # Since check was explicitly disabled, mark it as unavailable
            self.define_data(
                common.MySQLData.HEATWAVE_AVAILABLE, False)

    def on_connected(self):
        if not self._skip_hw_check:
            result = self.execute("""
                SELECT TABLE_NAME FROM `information_schema`.`TABLES`
                    WHERE TABLE_SCHEMA = 'performance_schema'
                        AND TABLE_NAME = 'rpd_nodes'
                """).fetch_all()

            self.define_data(
                common.MySQLData.HEATWAVE_AVAILABLE, len(result) == 1)


class BastionHandlerTask(DbSessionSetupTask):
    _OPT = 'mysql-db-system-id'

    def __init__(self, session, progress_cb=None) -> None:
        super().__init__(session, progress_cb=progress_cb)
        # The check is enabled if the value is not known
        self._setup_bastion = self.has_option(self._OPT)

    def on_connect(self):
        # If check is enabled, verify if it was not disabled by user settings
        if self._setup_bastion:
            # Adds timer for ping interval if not already defined
            if not self.has_data(DbSessionData.PING_INTERVAL):
                self.define_data(DbSessionData.PING_INTERVAL, 60)

            bastion_session = None
            # If the bastion session was previously registered, reuses it
            if self.has_data(common.MySQLData.BASTION_SESSION):
                bastion_session = BastionSessionRegistry().get_bastion_session(
                    self.get_data(common.MySQLData.BASTION_SESSION))

            else:
                bastion_session = BastionSessionRegistry(
                ).create_bastion_session(self.connection_options)

            bastion_session.ensure_active(self.report_progress)

            for option in BASTION_SETUP_OPTIONS:
                self.extract_option(option)

            for option in bastion_session.options.keys():
                self.define_option(option, bastion_session.options[option])

            # Adds metadata the Bastion Session ID to the Session metadata
            self.define_data(
                common.MySQLData.BASTION_SESSION, bastion_session.id)

    def on_connected(self):
        # Restores to restore the original connection options but excludes
        # the data as it is needed by the DB Ping Handler
        self.reset(include_data=False)

    def on_failed_connection(self):
        self.reset(include_data=False)

class RemoveExternalOptionsTask(DbSessionSetupTask):
    def __init__(self, session) -> None:
        super().__init__(session)

    def on_connect(self):
        self.extract_option("mrs-service-host", False)