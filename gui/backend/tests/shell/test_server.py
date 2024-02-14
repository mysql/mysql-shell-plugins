# Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

import json
import uuid
import pytest
import types
from tests.lib.utils import *
import signal

port, nossl = config.Config.get_instance().get_server_params()
server_params = [(port, nossl)]


@pytest.fixture(scope="module", params=server_params)
def shell_start_server(request):
    p = start_server(request)

    yield p

    logger.info("sending sigint to the shell subprocess")
    os.kill(p.pid,
            signal.CTRL_BREAK_EVENT if hasattr(signal, 'CTRL_BREAK_EVENT') else signal.SIGINT)

    logger.info(f"Waiting for server to shutdown")
    p.wait()
    logger.info(f"Done waiting for server shutdown")


@pytest.fixture(scope="module")
def shell_connect(shell_start_server):
    ws, session_id = connect_and_get_session()

    ws.headers['Cookie'] = "SessionId=%s" % session_id

    def send_json(self, request):
        self.send(request.dumps(request))

    def receive_json(self):
        return json.loads(self.recv())

    ws.send_json = types.MethodType(send_json, ws)
    ws.receive_json = types.MethodType(receive_json, ws)

    yield (ws, session_id)

    ws.close()


@pytest.mark.usefixtures("shell_connect")
def test_new_session(shell_connect):
    # Test to verify if the session id is properly created
    _, session_id = shell_connect
    ws2, session_id2 = connect_and_get_session()

    assert ws2.connected
    assert session_id2
    assert session_id != session_id2

    ws2.close()


@pytest.fixture(scope='function')
def authenticate_user1(shell_start_server, create_users):
    with authenticated_user("user1") as (ws, session_id):
        yield (ws, session_id)


@pytest.mark.usefixtures("authenticate_user1")
def test_recover_session(authenticate_user1):
    # To do this test, we need to connect and authenticate. This will properly
    # create a new session in the backend, so it can be reused

    # Restart the connection and keep the same session
    _, session_id = authenticate_user1

    ws2, session_id = connect_and_get_session(session_id)

    assert ws2.connected

    ws2.close()
