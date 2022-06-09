# Copyright (c) 2022, Oracle and/or its affiliates.
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

from threading import Lock

class BackendDbLogger:
    __instance = None
    __gui_backend_db = None
    lock = Lock()

    @staticmethod
    def get_instance(log_rotation=False) -> 'BackendDbLogger':
        if BackendDbLogger.__instance is None:
            BackendDbLogger(log_rotation)
        return BackendDbLogger.__instance

    def __init__(self, log_rotation):
        if BackendDbLogger.__instance is not None:
            raise Exception(
                "This class is a singleton, use get_instance function to get an instance.")
        else:
            from gui_plugin.core.Db import GuiBackendDb
            BackendDbLogger.__instance = self
            self.__gui_backend_db = GuiBackendDb(log_rotation=log_rotation)

    def _close(self):
        if self.__gui_backend_db:
            self.__gui_backend_db.close()
            self.__gui_backend_db = None
            self.__instance = None

    @staticmethod
    def close():
        BackendDbLogger.get_instance()._close()

    def _message(self, session_id, message, is_response, request_id):
        with self.lock:
            try:
                self.__gui_backend_db.start_transaction()
                self.__gui_backend_db.message(session_id, is_response, message, request_id)
                self.__gui_backend_db.commit()
            except Exception:
                self.__gui_backend_db.rollback()
                return False
            return True

    @staticmethod
    def message(session_id, message, is_response, request_id=None):
        return BackendDbLogger.get_instance()._message(session_id, message, is_response, request_id)

    def _log(self, event_type, message):
        with self.lock:
            try:
                self.__gui_backend_db.start_transaction()
                self.__gui_backend_db.log(event_type, message)
                self.__gui_backend_db.commit()
            except Exception:
                self.__gui_backend_db.rollback()
                return False
            return True

    @staticmethod
    def log(event_type, message):
        return BackendDbLogger.get_instance()._log(event_type, message)

