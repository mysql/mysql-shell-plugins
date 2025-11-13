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

import functools
import os
import mysqlsh
import sys
import traceback
import time

shell = mysqlsh.globals.shell


class InternalError(BaseException):
    pass


def _fmt_msg(s):
    return "\t".join(s.split("\n"))


def exception(msg: str):
    shell.log(
        "error",
        f"{_fmt_msg(msg)}: {'\n'.join(traceback.format_exception(sys.exception()))}",
    )


class CoalesceLogs:
    last_level = None
    last_msg = ""
    count = 0
    last_time = 0
    time_limit = 30
    max_time_without_flush = 60*15

    def __call__(self, level: str, msg: str):
        # buffer the message if its the same as the previous one
        if self.last_level == level and self.last_msg == msg:
            if self.last_time == 0 or time.monotonic() - self.last_time < self.time_limit:
                # repeat same msg, skip it
                self.count += 1
                return
            self.flush()

            self.time_limit = min(self.time_limit+60,
                                  self.max_time_without_flush)
        else:
            omsg = self.last_msg
            if self.count > 0:
                self.flush()

            # msg is different, flush old msg and print new msg
            self.time_limit = 30

            shell.log(level, msg)
            self.last_level = level
            self.last_msg = msg

    def flush(self):
        if self.last_level:
            if self.count > 1:
                shell.log(self.last_level, self.last_msg +
                          f" (repeated {self.count} times)")
            else:
                shell.log(self.last_level, self.last_msg)

        self.last_level = None
        self.last_msg = ""
        self.last_time = time.monotonic()
        self.count = 0


_log = CoalesceLogs()


def flush():
    _log.flush()


def info(msg: str):
    _log("info", _fmt_msg(msg))


def error(msg: str):
    _log("error", _fmt_msg(msg))


def warning(msg: str):
    _log("warning", _fmt_msg(msg))


def note(msg: str):
    _log("info", _fmt_msg(msg))


def debug(msg: str):
    _log("debug", _fmt_msg(msg))


def debug2(msg: str):
    _log("debug2", _fmt_msg(msg))


def devdebug(devmsg: str, msg: str = "", iftag: str = "", abort: bool = False):
    debug = os.getenv("DEBUG_MIGRATION", "")
    debug_pattern = ","+debug+","

    if debug:
        if (not iftag or ","+iftag+"," in debug_pattern
                or ("*" in debug and ",-"+iftag+"," not in debug_pattern)):
            shell.log(
                "debug", f"\033[91m{_fmt_msg(devmsg)}\033[0m" + (f"({iftag})" if iftag else ""))
            if abort:
                raise InternalError(f"Internal error: {devmsg}")
            return

    if msg:
        _log("debug", _fmt_msg(msg))


def resource_created(ocid: str, name: str):
    _log("info", f"RESOURCE CREATED: {name} ({ocid})")


def resource_deleted(ocid: str, name: str):
    _log("info", f"RESOURCE DELETED: {name} ({ocid})")


def plugin_log(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            devdebug(f"begin call {func.__name__}(args={args} kwargs={kwargs})",
                     f"begin call {func.__name__}(...)")

            result = func(*args, **kwargs)

            devdebug(f"end call {func.__name__}() => {result}",
                     f"end call {func.__name__}()")

            return result
        except Exception as e:
            error(f"Exception in {func.__name__}: {e}")
            raise

    return wrapper
