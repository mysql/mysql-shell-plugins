# Copyright (c) 2022, 2024, Oracle and/or its affiliates.
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


import pytest

from tests import get_logger
from tests.websocket import TestWebSocket, utils
from tests.websocket.utils import print_user_story_stack_trace

unit_tests = utils.get_unit_tests(True, True, False)


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


@pytest.mark.parametrize("test", unit_tests)
def test_over_websocket(test, ws):
    try:
        print("===== STARTING EXECUTION =====")
        ws.execute(test)
        print("====== ENDING EXECUTION =====")
    except Exception as e:
        print_user_story_stack_trace(ws, e)
        raise
