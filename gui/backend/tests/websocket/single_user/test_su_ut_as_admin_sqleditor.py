# Copyright (c) 2023, Oracle and/or its affiliates.
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


import pytest

from tests import get_logger
from tests.websocket import TestWebSocket, utils
from tests.websocket.utils import print_user_story_stack_trace

unit_tests = utils.get_unit_tests(True, True, True)


@pytest.fixture(scope="module")
def ws(shell_start_local_user_mode_server, create_users):
    _, token = shell_start_local_user_mode_server
    ws = TestWebSocket.TWebSocket(
        token=token, logger=get_logger(), script_reader=utils.unit_test_reader)

    ws.send({
        "request": "authenticate",
        "username": "LocalAdministrator",
        "request_id": ws.generateRequestId()
    })

    ws.validateLastResponse({
        "request_state": {
            "type": "OK",
            "msg": "User LocalAdministrator was successfully authenticated."
        },
        "request_id": ws.lastGeneratedRequestId,
        "active_profile": {
            "id": ws.matchRegexp("\\d+"),
            "user_id": ws.matchRegexp("\\d+"),
            "name": "Default",
            "description": "Default Profile",
            "options": {}
        }
    })

    ws.tokens["active_profile"] = ws.lastResponse["active_profile"]

    yield ws

    ws.close()


@pytest.fixture(scope="module")
def add_connection(ws):
    test_session_id = ws.generateRequestId()
    ws.tokens['test_session_id'] = test_session_id

    default_mysql_options = ws.tokens.defaults.database_connections.mysql[0].options

    connection_options = {
        "host": default_mysql_options.host,
        "port": default_mysql_options.port,
        "user": default_mysql_options.user,
        "password": default_mysql_options.password,
        "scheme": default_mysql_options.scheme,
        "schema": "information_schema"
    }

    params = {
        "connection": {
            "db_type": "MySQL",
            "caption": "This is a test database",
            "description": "This is a test database description",
            "options": {
                **connection_options,
                "connection-attributes": [f"test_session_id={test_session_id}"]
            }
        },
        "folder_path": "",
        "profile_id": 1,
    }

    ws.sendAndValidate({
        "request": "execute",
        "request_id": ws.generateRequestId(),
        "command": "gui.dbconnections.add_db_connection",
        "args": {
            "profile_id": params["profile_id"],
            "connection": params["connection"],
            "folder_path": params["folder_path"]
        }
    }, [
        {
            "request_id": ws.lastGeneratedRequestId,
            "request_state": {"type": "OK", "msg": ws.ignore},
            "result": ws.matchRegexp("\\d+")
        }
    ])

    connection_id = ws.lastResponse["result"]

    yield connection_id

    ws.sendAndValidate({
        "request": "execute",
        "request_id": ws.generateRequestId(),
        "command": "gui.dbconnections.remove_db_connection",
        "args": {
            "profile_id": 1,
            "connection_id": connection_id
        }
    }, [
        {
            "request_id": ws.lastGeneratedRequestId,
            "request_state": {
                "type": "OK",
                "msg": ws.ignore
            }
        }
    ])


@pytest.fixture(scope="function")
def sqlide_session(ws, add_connection):
    connection_id = add_connection

    ws.sendAndValidate({
        "request": "execute",
        "request_id": ws.generateRequestId(),
        "command": "gui.sqleditor.start_session",
        "args": {}
    }, [
        {
            "request_id": ws.lastGeneratedRequestId,
            "request_state": {"type": "OK", "msg": ""},
            "result": {
                "module_session_id": ws.matchRegexp("[a-f0-9]{8}-[a-f0-9]{4}-1[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$")
            }
        }
    ])

    module_session_id = ws.lastResponse['result']['module_session_id']

    ws.sendAndValidate({
        "request": "execute",
        "request_id": ws.generateRequestId(),
        "command": "gui.sqleditor.open_connection",
        "args": {
            "db_connection_id": connection_id,
            "module_session_id": module_session_id,
        }
    }, [{
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {"type": "OK", "msg": "Connection was successfully opened."},
        "module_session_id": module_session_id,
        "info": {
            "version": ws.matchRegexp("8.0.[0-9][0-9]"),
            "edition": ws.ignore,
            "sql_mode": ws.ignore
        },
        "default_schema": "information_schema"
    }
    ])

    yield module_session_id

    ws.sendAndValidate({
        "request": "execute",
        "request_id": ws.generateRequestId(),
        "command": "gui.sqleditor.close_session",
        "args": {
            "module_session_id": module_session_id
        }
    },
        [{
            "request_id": ws.lastGeneratedRequestId,
            "request_state": {
                "type": "OK",
                "msg": ""
            },
            "result": "Completed"
        }
    ])


@pytest.mark.usefixtures("sqlide_session")
@pytest.mark.parametrize("test", unit_tests)
def test_over_websocket(test, ws, sqlide_session):
    try:
        ws.tokens['module_session_id'] = sqlide_session
        print("===== STARTING EXECUTION =====")
        ws.execute(test)
        print("====== ENDING EXECUTION =====")
    except Exception as e:
        print_user_story_stack_trace(ws, e)
        raise
