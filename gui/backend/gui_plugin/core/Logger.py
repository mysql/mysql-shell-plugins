# Copyright (c) 2021, Oracle and/or its affiliates.
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
from gui_plugin.core.Error import MSGException

WebSocketHandler=None

@contextmanager
def log_database(log_rotation):
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

def message_logger(log_type, message, tags=[], context={}):
    now = datetime.datetime.now()

    if 'session' in tags:
        with log_database(True) as db:
            db.log(event_type=log_type, message=message)

    if 'communication' in tags:
        with log_database(False) as db:
            db.message(session_id=context['session_id'], is_response=context['is_response'],
                message=message, request_id=context['request_id'])

    if 'shell' in tags:
        mysqlsh.globals.shell.log(log_type, f"[MSG] {message}")

    if 'stdout' in tags:
        print(f"{now.hour}:{now.minute}:{now.second}.{now.microsecond} {log_type}: {message}")

def debug(message, tags=[]):
    # TODO: tweak these tags according the environment settings
    tags = tags + ['stdout']
    message_logger("DEBUG", message, tags)

def info(message, tags=[], context={}):
    # TODO: tweak these tags according the environment settings
    if 'session' not in tags:
        tags = tags + ['stdout', 'shell']
    message_logger("INFO", message, tags, context)

def warning(message, tags=[]):
    # TODO: tweak these tags according the environment settings
    tags = tags + ['stdout', 'shell']
    message_logger("WARNING", message, tags)

def error(message, tags=[]):
    # TODO: tweak these tags according the environment settings
    tags = tags + ['stdout', 'shell']
    # convert to string in case we're logging an exception
    message_logger("ERROR", str(message), tags)

def exception(e, tags=[]):
    error(e)
    if not isinstance(e, MSGException):
        exc_type, exc_value, exc_traceback = sys.exc_info()
        exception_info = "".join(traceback.format_exception(exc_type, exc_value,
                            exc_traceback))
        # the shell seems to be stripping initial spaces on every log line,
        # but I want indentation on exception reports
        exception_info = exception_info.strip().replace('\n', '\n-')
        error(f"Exception information:\n{exception_info}")
