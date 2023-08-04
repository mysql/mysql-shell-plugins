# Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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
import json
from enum import IntEnum
from gui_plugin.core.Error import MSGException
from mysqlsh.plugin_manager import plugin_function  # pylint: disable=no-name-in-module
from gui_plugin.core.Protocols import Response
from gui_plugin.core.BackendDbLogger import BackendDbLogger
from gui_plugin.core import Filtering

_db_files_count = 0
_files_count = 0
_process_count = 0
_thread_count = 0

SENSITIVE_KEYWORDS = ["password"]
SENSITIVE_DATA_REPLACEMENT = "****"


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

    @staticmethod
    def from_string(log_level: str) -> 'LogLevel':
        try:
            return LogLevel[log_level]
        except KeyError:
            return LogLevel.INFO


class BackendLogger:
    __instance = None
    __log_level = None
    __log_filters = []

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
            log_level = os.environ.get('LOG_LEVEL', LogLevel.INFO.name)
            self.set_log_level(LogLevel.from_string(log_level))
            self.add_filter({
                "type": "key",
                "key": "password",
                "expire": Filtering.FilterExpire.Never
            })

    def message_logger(self, log_type, message, tags=[], sensitive=False, prefix=""):
        now = datetime.datetime.now()
        message = prefix + str(self._filter(message) if sensitive else message)

        if 'session' in tags:
            BackendDbLogger.log(event_type=log_type.name, message=message)

        if 'shell' in tags:
            mysqlsh.globals.shell.log(
                log_type.name, f"[MSG] {message}")  # pylint: disable=no-member

        if 'stdout' in tags:
            if self.__log_level >= log_type:
                print(
                    f"{now.hour}:{now.minute}:{now.second}.{now.microsecond} {log_type.name}: {message}", file=sys.real_stdout, flush=True)

    def add_filter(self, options):
        if "type" in options:
            if options["type"] == "key":
                self.__log_filters.append(Filtering.KeyFilter(options["key"],
                                                              options["expire"]))
            elif options["type"] == "substring":
                self.__log_filters.append(Filtering.SubstringFilter(options["start"],
                                                                    options["end"], options["expire"]))

    def set_log_level(self, log_level: LogLevel):
        BackendLogger.__log_level = log_level

    def get_log_level(self):
        return BackendLogger.__log_level

    def _filter(self, data):
        for filter in self.__log_filters:
            if not filter.expired():
                data = filter.apply(data)

        self.__log_filters = [
            filter for filter in self.__log_filters if not filter.expired()]
        return data


def debug(message, tags=[], sensitive=False, prefix=""):
    # TODO: tweak these tags according the environment settings
    tags = tags + ['stdout']
    BackendLogger.get_instance().message_logger(
        LogLevel.DEBUG, message, tags, sensitive, prefix)


def info(message, tags=[], sensitive=False, prefix=""):
    # TODO: tweak these tags according the environment settings
    if 'session' not in tags:
        tags = tags + ['stdout', 'shell']
    BackendLogger.get_instance().message_logger(
        LogLevel.INFO, message, tags, sensitive, prefix)


def warning(message, tags=[], sensitive=False, prefix=""):
    # TODO: tweak these tags according the environment settings
    tags = tags + ['stdout', 'shell']
    BackendLogger.get_instance().message_logger(
        LogLevel.WARNING, message, tags, sensitive, prefix)


def error(message, tags=[], sensitive=False, prefix=""):
    # TODO: tweak these tags according the environment settings
    tags = tags + ['stdout', 'shell']
    # convert to string in case we're logging an exception
    BackendLogger.get_instance().message_logger(
        LogLevel.ERROR, str(message), tags, sensitive, prefix)


def exception(e, msg=None, tags=[]):
    if msg:
        error(msg, tags)
    if isinstance(e, MSGException):
        error(e, tags)
    else:
        exc_type, exc_value, exc_traceback = sys.exc_info()
        if exc_type is not None:
            exception_info = "".join(traceback.format_exception(exc_type, exc_value,
                                                                exc_traceback))
            # the shell seems to be stripping initial spaces on every log line,
            # but I want indentation on exception reports
            exception_info = exception_info.strip().replace('\n', '\n-')
            error(f"Exception information:\n{exception_info}")
        else:
            error(e, tags)


def debug2(message, tags=[], sensitive=False, prefix=""):
    tags = tags + ['stdout']
    BackendLogger.get_instance().message_logger(
        LogLevel.DEBUG2, message, tags, sensitive, prefix)


def debug3(message, tags=[], sensitive=False, prefix=""):
    tags = tags + ['stdout']
    BackendLogger.get_instance().message_logger(
        LogLevel.DEBUG3, message, tags, sensitive, prefix)


def internal_error(message, tags=[], sensitive=False, prefix=""):
    tags = tags + ['stdout']
    BackendLogger.get_instance().message_logger(
        LogLevel.INTERNAL_ERROR, message, tags, sensitive, prefix)


def add_filter(options):
    BackendLogger.get_instance().add_filter(options)


def track_print(type):
    pass
    # import psutil
    # import threading
    # debug3(
    #     f"{type} opened, open db files: {_db_files_count}, open files: {_files_count}, open processes: {_process_count}, handles: {len(psutil.Process().open_files())}, threads: {threading.active_count()} [{_thread_count}]")
    # for f in psutil.Process().open_files():
    #     debug3(f"--> {f}")


def track_open(type):
    global _db_files_count
    global _files_count
    global _process_count
    global _thread_count

    if type == "db":
        _db_files_count += 1
        # traceback.print_stack(limit=10)
    elif type == "file":
        _files_count += 1
    elif type == "process":
        _process_count += 1
    elif type == "thread":
        _thread_count += 1
        # traceback.print_stack(limit=10)
    track_print(type)


def track_close(type):
    global _db_files_count
    global _files_count
    global _process_count
    global _thread_count

    if type == "db":
        _db_files_count -= 1
        if _db_files_count < 0:
            debug3("Trying closing db file that is already closed.")
            # traceback.print_stack(limit=10)
    elif type == "file":
        _files_count -= 1
        if _files_count < 0:
            debug3("Trying closing file that is already closed.")
            traceback.print_stack(limit=10)
    elif type == "process":
        _process_count -= 1
        if _process_count < 0:
            debug3("Trying closing process that is already closed.")
            # traceback.print_stack(limit=10)
    elif type == "thread":
        _thread_count -= 1
    track_print(type)


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
       None
    """
    BackendLogger.get_instance().set_log_level(LogLevel[log_level.upper()])


@plugin_function('gui.core.getLogLevel', shell=False, web=True)
def get_log_level():
    """Gets the current log level

    Returns:
       str: log level
    """
    return BackendLogger.get_instance().get_log_level().name
