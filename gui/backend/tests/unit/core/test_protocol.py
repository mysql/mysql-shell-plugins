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

from gui_plugin.core.Protocols import Protocol
import pytest
import uuid
import json

test_messages = [
    ("OK", "Operation successfull"),
    ('ERROR', 'Operation failed'),
    ('PENDING', 'Operation pending')
]

test_values = [
    ({"option1": True}),
    ("Result OK"),
    (None)
]

@pytest.mark.parametrize("type, msg", test_messages)
def test_get_message(type, msg):
    req_id = str(uuid.uuid1())
    result = json.loads(Protocol.get_message(type, msg, req_id))

    assert result['request_id'] == req_id
    assert result['request_state']['type'] == type
    assert result['request_state']['msg'] == msg

@pytest.mark.parametrize("type, msg", test_messages)
@pytest.mark.parametrize("values", test_values)
def test_get_response(type, msg, values):
    req_id = str(uuid.uuid1())

    result = json.loads(Protocol.get_response(type, msg, req_id, values))

    assert result['request_id'] == req_id
    assert result['response'] == type
    assert result['message'] == msg
