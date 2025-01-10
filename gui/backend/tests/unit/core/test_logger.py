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

from gui_plugin.core import Logger
from gui_plugin.core import Filtering
import json

allowed_levels = ['NONE', 'INTERNAL_ERROR', 'ERROR', 'WARNING',
                  'INFO', 'DEBUG', 'DEBUG2', 'DEBUG3']

def test_log_level():
    current_level = Logger.get_log_level()
    assert current_level in allowed_levels

    ret = Logger.set_log_level(allowed_levels[1])
    assert ret is None

    level = Logger.get_log_level()
    assert level == allowed_levels[1]

    ret = Logger.set_log_level(allowed_levels[2])
    assert ret is None

    level = Logger.get_log_level()
    assert level == allowed_levels[2]

    ret = Logger.set_log_level(current_level)
    assert ret is None

    level = Logger.get_log_level()
    assert level == current_level


def test_filter_sensitivity_data():
    message = {
                "request": "authenticate",
                "username": "admin1",
                "password": "admin1"
            }

    expected = {
                "request": "authenticate",
                "username": "admin1",
                "password": "****"
            }

    output = Logger.BackendLogger.get_instance()._filter(json.dumps(message))
    assert output == json.dumps(expected)

    message = {
                    "request": "execute",
                    "command": "gui.db_connections.add_db_connection",
                    "args": {
                        "profile_id": 1,
                        "connection": {
                            "db_type":
                            "MySQL",
                            "caption": "This is a test database",
                            "description": "This is a test database description",
                            "options": {
                                "host": "localhost",
                                "port":3306,
                                "user": "root",
                                "password": "password",
                                "scheme": "mysql",
                                "schema": "information_schema"
                            }
                        },
                    }
                }

    expected = {
                    "request": "execute",
                    "command": "gui.db_connections.add_db_connection",
                    "args": {
                        "profile_id": 1,
                        "connection": {
                            "db_type": "MySQL",
                            "caption": "This is a test database",
                            "description": "This is a test database description",
                            "options": {
                                "host": "localhost",
                                "port": 3306,
                                "user": "root",
                                "password": "****",
                                "scheme": "mysql",
                                "schema": "information_schema"
                            }
                        },
                    }
                }

    output = Logger.BackendLogger.get_instance()._filter(json.dumps(message))
    assert output == json.dumps(expected)

    message = """{{ "password": "****", """
    output = Logger.BackendLogger.get_instance()._filter(message)
    assert output == message

    message = {
                "request": "execute",
                "command": "gui.db_connections.remove_db_connection",
                "args": {
                    "profile_id": 1,
                    "connection_id": 1
                }
            }

    output = Logger.BackendLogger.get_instance()._filter(json.dumps(message))
    assert output == json.dumps(message)

    message = "GET token=1234-5678-1234 HTTP"
    output = Logger.BackendLogger.get_instance()._filter(message)
    assert output == message

    Logger.BackendLogger.get_instance().add_filter({
                "type": "substring",
                "start": "token=",
                "end": " HTTP",
                "expire": Filtering.FilterExpire.OnUse,
            })

    message = "GET 1.1 HTTP"
    output = Logger.BackendLogger.get_instance()._filter(message)
    assert output == message

    message = "GET token=1234-5678-1234 HTTP"
    expected = "GET token=**** HTTP"
    output = Logger.BackendLogger.get_instance()._filter(message)
    assert output == expected

    output = Logger.BackendLogger.get_instance()._filter(message)
    assert output == message
