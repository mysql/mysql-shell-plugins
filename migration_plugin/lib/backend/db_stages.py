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
from . import model
from .. import logging, errors
from .model import WorkStatusEvent
from .stage import ThreadedStage
from .remote_helper import RemoteHelperClient
from typing import Optional
import time


k_dbsystem_online_timeout = 15 * 60
k_storage_available_timeout = 5 * 60


class MySQLTargetReadiness(ThreadedStage):
    """
    Check whether target MySQL instance is connectable (through the jump host)
    """
    _last_check_result: Optional[model.ConnectionCheckResult] = None

    def __init__(self, owner) -> None:
        super().__init__(model.SubStepId.CONNECT_DBSYSTEM, owner, work_fn=self.do_run)

    @property
    def _connection_options(self):
        return self._owner.target_connection_options

    def try_connect_remote(
        self, helper: RemoteHelperClient, connection_options: dict
    ) -> model.ConnectionCheckResult:
        return helper.connect_mysql(connection_options)

    def do_run(self):
        logging.info(
            f"starting readiness check of {sanitize_dict(self._connection_options, k_san_dict_connection)}")
        self.push_status(WorkStatusEvent.BEGIN,
                         message=f'Checking if we can connect to {self._connection_options["user"]}@{self._connection_options["host"]}:{self._connection_options["port"]}')

        while True:
            try:
                with self._owner.connect_remote_helper() as helper:
                    self.push_progress(
                        f'Connected to jump host, checking connection to DB System at {self._connection_options["host"]}:{self._connection_options["port"]}')
                    while True:
                        self._last_check_result = self.try_connect_remote(
                            helper, self._connection_options
                        )
                        # TODO if connect failed on mysql error, then report the mysql error.., add more detail
                        if not self._last_check_result.connectError:
                            break
                        self.push_message(self._last_check_result._json())
                        logging.info(
                            f"{self._name} is not ready: {self._last_check_result}"
                        )
                        time.sleep(5)
                        self.check_stop()

                    logging.info(f"{self._name} is ready")
                    break
                break
            except errors.Aborted:
                raise
            except Exception as e:
                self.push_progress(
                    "Error opening SSH session to jump host, retrying after 5s...")
                logging.warning(
                    f"Error opening SSH session to jump host: {e}, retrying...")
                time.sleep(5)
                self.check_stop()
                continue

        self.push_status(WorkStatusEvent.END,
                         message="DB System is online and accepting connections")
