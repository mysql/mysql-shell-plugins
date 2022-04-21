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

from gui_plugin.core import Logger

allowed_levels = ['NONE', 'INTERNAL_ERROR', 'ERROR', 'WARNING',
                  'INFO', 'DEBUG', 'DEBUG2', 'DEBUG3']

def test_log_level():
    current_level = Logger.get_log_level()
    assert current_level in allowed_levels

    ret = Logger.set_log_level(allowed_levels[1])
    assert ret is not None
    assert ret['request_state']['type'] == 'OK'
    assert ret['request_state']['msg'] == 'Log level set successfully.'

    level = Logger.get_log_level()
    assert level == allowed_levels[1]

    ret = Logger.set_log_level(allowed_levels[2])
    assert ret is not None
    assert ret['request_state']['type'] == 'OK'
    assert ret['request_state']['msg'] == 'Log level set successfully.'

    level = Logger.get_log_level()
    assert level == allowed_levels[2]

    ret = Logger.set_log_level(current_level)
    assert ret is not None
    assert ret['request_state']['type'] == 'OK'
    assert ret['request_state']['msg'] == 'Log level set successfully.'

    level = Logger.get_log_level()
    assert level == current_level


def test_filter_sensitivity_data():
    message = '{"request": "authenticate", "username": "admin1", "password": "admin1"}'
    output = Logger.BackendLogger.get_instance()._filter(message)
    assert output == '{"request": "authenticate", "username": "admin1", "password": "****"}'

    message = '{"request": "execute", "command": "gui.dbconnections.add_db_connection", "args": {"profile_id": 1, "connection": {"db_type": "MySQL", "caption": "This is a test database", "description": "This is a test database description", "options": {"host": "localhost", "port":3306, "user": "root", "password": "password", "scheme": "mysql", "schema": "information_schema"}}, "folder_path": ""}}'

    output = Logger.BackendLogger.get_instance()._filter(message)
    assert output == '{"request": "execute", "command": "gui.dbconnections.add_db_connection", "args": {"profile_id": 1, "connection": {"db_type": "MySQL", "caption": "This is a test database", "description": "This is a test database description", "options": {"host": "localhost", "port": 3306, "user": "root", "password": "****", "scheme": "mysql", "schema": "information_schema"}}, "folder_path": ""}}'
