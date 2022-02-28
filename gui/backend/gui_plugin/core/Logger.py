# Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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
import mysqlsh
import datetime
from contextlib import contextmanager
import traceback
import sys
import os
from enum import IntEnum
from gui_plugin.core.Error import MSGException
from mysqlsh.plugin_manager import plugin_function  # pylint: disable=no-name-in-module
from gui_plugin.core.Protocols import Response

class LogLevel(IntEnum):
    NONE = 1
    INTERNAL_ERROR = 2
    ERROR = 3
    WARNING = 4
    INFO = 5
    DEBUG = 6
    DEBUG2 = 7
    DEBUG3 = 8
    MAX_LEVEL = 8

class BackendLogger:
    __instance = None
    __log_level = None

    @staticmethod
    def get_instance() -> 'BackendLogger':
        if BackendLogger.__instance == None:
            BackendLogger()
        return BackendLogger.__instance

    def __init__(self):
        if BackendLogger.__instance != None:
            raise Exception(
                "This class is a singleton, use get_instance function to get an instance.")
        else:
            BackendLogger.__instance = self
            self.set_log_level(LogLevel[os.environ.get('LOG_LEVEL', LogLevel.INFO.name)])

    @contextmanager
    def log_database(self, log_rotation):
        from gui_plugin.core.Db import GuiBackendDb
        db = None
        try:
            db = GuiBackendDb(log_rotation=log_rotation)

            db.start_transaction()
            yield db
            db.commit()
        except Exception as e:
            error(f"Exception while attempting to log to the database: {e}")
            if db is not None:
                db.rollback()
        finally:
            if db is not None:
                db.close()

    def message_logger(self, log_type, message, tags=[], context={}):
        now = datetime.datetime.now()

        if 'session' in tags:
            with self.log_database(True) as db:
                db.log(event_type=log_type.name, message=message)

        if 'shell' in tags:
            mysqlsh.globals.shell.log(log_type.name, f"[MSG] {message}") # pylint: disable=no-member

        if 'stdout' in tags:
            if self.__log_level >= log_type:
                print(f"{now.hour}:{now.minute}:{now.second}.{now.microsecond} {log_type.name}: {message}")

    def set_log_level(self, log_level: LogLevel):
        BackendLogger.__log_level = log_level

    def get_log_level(self):
        return BackendLogger.__log_level


def debug(message, tags=[]):
    # TODO: tweak these tags according the environment settings
    tags = tags + ['stdout']
    BackendLogger.get_instance().message_logger(LogLevel.DEBUG, message, tags)

def info(message, tags=[], context={}):
    # TODO: tweak these tags according the environment settings
    if 'session' not in tags:
        tags = tags + ['stdout', 'shell']
    BackendLogger.get_instance().message_logger(LogLevel.INFO, message, tags, context)

def warning(message, tags=[]):
    # TODO: tweak these tags according the environment settings
    tags = tags + ['stdout', 'shell']
    BackendLogger.get_instance().message_logger(LogLevel.WARNING, message, tags)

def error(message, tags=[]):
    # TODO: tweak these tags according the environment settings
    tags = tags + ['stdout', 'shell']
    # convert to string in case we're logging an exception
    BackendLogger.get_instance().message_logger(LogLevel.ERROR, str(message), tags)

def exception(e, msg=None, tags=[]):
    if msg:
        error(msg, tags)
    if isinstance(e, MSGException):
        error(e, tags)
    else:
        exc_type, exc_value, exc_traceback = sys.exc_info()
        exception_info = "".join(traceback.format_exception(exc_type, exc_value,
                            exc_traceback))
        # the shell seems to be stripping initial spaces on every log line,
        # but I want indentation on exception reports
        exception_info = exception_info.strip().replace('\n', '\n-')
        error(f"Exception information:\n{exception_info}")

def debug2(message, tags=[]):
    tags = tags + ['stdout']
    BackendLogger.get_instance().message_logger(LogLevel.DEBUG2, message, tags)

def debug3(message, tags=[]):
    tags = tags + ['stdout']
    BackendLogger.get_instance().message_logger(LogLevel.DEBUG3, message, tags)

def internal_error(message, tags=[]):
    tags = tags + ['stdout']
    BackendLogger.get_instance().message_logger(LogLevel.INTERNAL_ERROR, message, tags)

@plugin_function('gui.core.setLogLevel', shell=False, web=True)
def set_log_level(log_level=LogLevel.INFO.name):
    """Sets the log level

    Change the logging level for the Backend Server, or disable logging.
    The 'log_level' argument can be one of:
        - none,
        - internal_error,
        - error,
        - warning,
        - info,
        - debug,
        - debug2,
        - debug3
    Specifying 'none' disables logging. Level `info` is the default if you do not specify this option.

    Args:
        log_level (str): Level of logging

    Returns:
        The generated shell request record.
    """
    BackendLogger.get_instance().set_log_level(LogLevel[log_level.upper()])

    return Response.ok("Log level set successfully.")

@plugin_function('gui.core.getLogLevel', shell=False, web=True)
def get_log_level():
    """Gets the current log level

    Returns:
        The generated shell request record.
    """
    return BackendLogger.get_instance().get_log_level().name

