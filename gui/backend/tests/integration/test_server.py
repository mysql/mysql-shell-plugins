# Copyright (c) 2020, 2021, Oracle and/or its affiliates.
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

import json
import uuid
import pytest
from ..conftest import connect_and_get_session


@pytest.mark.usefixtures("shell_connect")
def test_new_session(shell_connect):
    # Test to verify if the session id is properly created
    _, session_id = shell_connect
    ws2, session_id2 = connect_and_get_session()

    assert ws2.connected
    assert session_id2
    assert session_id != session_id2

    ws2.close()

@pytest.mark.usefixtures("authenticate_user1")
def test_recover_session(authenticate_user1):
    # To do this test, we need to connect and authenticate. This will properly
    # create a new session in the backend, so it can be reused

    # Restart the connection and keep the same session
    _, session_id = authenticate_user1

    ws2, session_id = connect_and_get_session(session_id)

    assert ws2.connected

    ws2.close()
