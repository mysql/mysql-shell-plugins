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


import pytest
from tests.websocket import TestWebSocket, utils
from tests import get_logger
from tests.websocket.utils import print_user_story_stack_trace

script_list = utils.get_user_stories(True, True)


@pytest.fixture(scope="module")
def ws(shell_start_local_user_mode_server, create_users):
    _, token = shell_start_local_user_mode_server
    ws = TestWebSocket.TWebSocket(token=token, logger=get_logger())
    ws.execute("__lib/_init.js")
    ws.execute("unit/authenticate/success_single_user_mode.js")
    ws.tokens["active_profile"] = ws.lastResponse["active_profile"]

    yield ws

    ws.close()


@pytest.mark.parametrize("story", script_list)
def test_user_stories_for_single_user_mode(story, ws):
    try:
        print("===== STARTING EXECUTION =====")
        ws.execute(story)
        print("====== ENDING EXECUTION =====")
    except Exception as e:
        print_user_story_stack_trace(ws, e)
        raise
