# Copyright (c) 2026, Oracle and/or its affiliates.
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

from gui_plugin.core import PluginCommandMocks
from gui_plugin.core.ShellGuiStdioBridge import ShellGuiStdioBridge


class MockWebSession:
    def __init__(self):
        self.command_responses = []
        self.json_responses = []
        self.done_requests = []

    def send_command_response(self, request_id, values, completed=False):
        self.command_responses.append((request_id, values, completed))

    def send_json_response(self, json_message):
        self.json_responses.append(json_message)

    def send_command_done(self, request_id):
        self.done_requests.append(request_id)


@pytest.fixture(autouse=True)
def clear_plugin_command_mocks(monkeypatch):
    monkeypatch.delenv(PluginCommandMocks.ENABLE_ENVIRONMENT_VARIABLE, raising=False)
    PluginCommandMocks._mock_rules.clear()
    yield
    PluginCommandMocks._mock_rules.clear()


def enable_plugin_command_mocks(monkeypatch):
    monkeypatch.setenv(PluginCommandMocks.ENABLE_ENVIRONMENT_VARIABLE, "1")


def assert_pending_mock_response(execute_request):
    web_session = MockWebSession()
    execute_request(web_session)

    assert web_session.json_responses == [
        {"request_state": {"type": "PENDING", "msg": ""}, "request_id": "request-1"}
    ]
    assert web_session.done_requests == ["request-1"]
    assert web_session.command_responses == []


def test_plugin_command_mocks_are_disabled_by_default():
    with pytest.raises(Exception, match="Plugin command mocks are disabled"):
        PluginCommandMocks.set_plugin_command_mocks({})

    assert (
        PluginCommandMocks.send_plugin_command_mock_response(
            "gui.migration.work_status", "request-1", MockWebSession()
        )
        is False
    )


def test_plugin_command_mock_result_response(monkeypatch):
    enable_plugin_command_mocks(monkeypatch)
    PluginCommandMocks.set_plugin_command_mocks(
        {"gui.migration.work_status": {"result": {"state": "ok"}}}
    )

    web_session = MockWebSession()
    handled = PluginCommandMocks.send_plugin_command_mock_response(
        "gui.migration.work_status", "request-1", web_session
    )

    assert handled is True
    assert web_session.command_responses == [
        ("request-1", {"state": "ok"}, True),
    ]
    assert web_session.json_responses == []
    assert web_session.done_requests == []


def test_plugin_command_mock_raw_responses_rewrite_request_id(monkeypatch):
    enable_plugin_command_mocks(monkeypatch)
    PluginCommandMocks.set_plugin_command_mocks(
        {
            "gui.migration.work_status": {
                "responses": [
                    {
                        "request_state": {"type": "OK", "msg": ""},
                        "request_id": "old-request",
                        "value": 1,
                    }
                ],
            }
        }
    )

    web_session = MockWebSession()
    handled = PluginCommandMocks.send_plugin_command_mock_response(
        "gui.migration.work_status", "request-1", web_session
    )

    assert handled is True
    assert web_session.json_responses == [
        {
            "request_state": {"type": "OK", "msg": ""},
            "request_id": "request-1",
            "value": 1,
        }
    ]
    assert web_session.done_requests == ["request-1"]


def test_plugin_command_mock_sequence_and_repeat_last(monkeypatch):
    enable_plugin_command_mocks(monkeypatch)
    PluginCommandMocks.set_plugin_command_mocks(
        {
            "gui.migration.work_status": {
                "sequence": [{"result": 1}, {"result": 2}],
                "repeatLast": False,
            }
        }
    )

    web_session = MockWebSession()
    assert (
        PluginCommandMocks.send_plugin_command_mock_response(
            "gui.migration.work_status", "request-1", web_session
        )
        is True
    )
    assert (
        PluginCommandMocks.send_plugin_command_mock_response(
            "gui.migration.work_status", "request-2", web_session
        )
        is True
    )
    assert (
        PluginCommandMocks.send_plugin_command_mock_response(
            "gui.migration.work_status", "request-3", web_session
        )
        is False
    )
    assert web_session.command_responses == [
        ("request-1", 1, True),
        ("request-2", 2, True),
    ]


def test_plugin_command_mock_control_commands_cannot_be_mocked(monkeypatch):
    enable_plugin_command_mocks(monkeypatch)

    with pytest.raises(Exception, match="cannot be mocked"):
        PluginCommandMocks.set_plugin_command_mocks(
            {"gui.core.setPluginCommandMocks": {"result": True}}
        )


def test_stdio_bridge_sends_plugin_command_mock_without_invoking_plugin(monkeypatch):
    enable_plugin_command_mocks(monkeypatch)
    PluginCommandMocks.set_plugin_command_mocks(
        {
            "gui.migration.work_status": {
                "responses": [{"request_state": {"type": "PENDING", "msg": ""}}]
            }
        }
    )

    def execute_request(web_session):
        bridge = ShellGuiStdioBridge.__new__(ShellGuiStdioBridge)
        bridge.send_json_response = web_session.send_json_response
        bridge.send_command_done = web_session.send_command_done
        bridge.send_command_response = web_session.send_command_response
        bridge.execute_command_request(
            {"request_id": "request-1", "command": "gui.migration.work_status"}
        )

    assert_pending_mock_response(execute_request)
