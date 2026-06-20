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

"""Test-only command mock support for GUI backend plugin calls."""

from copy import deepcopy
from os import environ
from typing import Any, Optional

from mysqlsh.plugin_manager import plugin_function  # pylint: disable=no-name-in-module


ENABLE_ENVIRONMENT_VARIABLE = "MYSQLSH_GUI_ENABLE_PLUGIN_MOCKS"
CONTROL_COMMANDS = {
    "gui.core.setPluginCommandMocks",
    "gui.core.set_plugin_command_mocks",
    "gui.core.clearPluginCommandMocks",
    "gui.core.clear_plugin_command_mocks",
}

_mock_rules: dict[str, dict[str, Any]] = {}


def plugin_command_mocks_enabled() -> bool:
    return environ.get(ENABLE_ENVIRONMENT_VARIABLE) == "1"


def _ensure_enabled() -> None:
    if not plugin_command_mocks_enabled():
        raise Exception(
            "Plugin command mocks are disabled. Set "
            f"{ENABLE_ENVIRONMENT_VARIABLE}=1 to enable them."
        )


def _normalize_rule(command: str, rule: dict[str, Any]) -> dict[str, Any]:
    if command in CONTROL_COMMANDS:
        raise Exception(f"The command {command} cannot be mocked.")

    sequence = rule.get("sequence")
    if sequence is None:
        sequence = [rule]

    if not isinstance(sequence, list) or not sequence:
        raise Exception(f"Mock rule for {command} must define a non-empty sequence.")

    for entry in sequence:
        if not isinstance(entry, dict):
            raise Exception(f"Mock sequence entries for {command} must be objects.")

        if "result" not in entry and "responses" not in entry:
            raise Exception(
                f"Mock sequence entries for {command} must define result or responses."
            )

        responses = entry.get("responses")
        if responses is not None and not isinstance(responses, list):
            raise Exception(f"Mock responses for {command} must be a list.")

    return {
        "sequence": deepcopy(sequence),
        "index": 0,
        "repeat_last": rule.get("repeatLast", True),
    }


@plugin_function("gui.core.setPluginCommandMocks", shell=False, web=True)
def set_plugin_command_mocks(rules: dict[str, Any]) -> bool:
    """Sets test-only plugin command mock rules.

    Args:
        rules (dict): Mock rules keyed by plugin command.
    """

    _ensure_enabled()
    if not isinstance(rules, dict):
        raise Exception("Plugin command mock rules must be an object.")

    _mock_rules.clear()
    for command, rule in rules.items():
        if not isinstance(command, str) or not command:
            raise Exception("Plugin command mock names must be non-empty strings.")

        if not isinstance(rule, dict):
            raise Exception(f"Mock rule for {command} must be an object.")

        _mock_rules[command] = _normalize_rule(command, rule)

    return True


@plugin_function("gui.core.clearPluginCommandMocks", shell=False, web=True)
def clear_plugin_command_mocks() -> bool:
    """Clears test-only plugin command mock rules."""

    _ensure_enabled()
    _mock_rules.clear()

    return True


def _next_mock_entry(command: str) -> dict[str, Any] | None:
    if not plugin_command_mocks_enabled() or command in CONTROL_COMMANDS:
        return None

    rule = _mock_rules.get(command)
    if rule is None:
        return None

    sequence = rule["sequence"]
    index = rule["index"]
    repeat_last = rule["repeat_last"]

    if index >= len(sequence):
        if repeat_last:
            index = len(sequence) - 1
        else:
            del _mock_rules[command]

            return None

    entry = deepcopy(sequence[index])
    if index < len(sequence) - 1:
        rule["index"] = index + 1
    elif not repeat_last:
        rule["index"] = index + 1

    return entry


def send_plugin_command_mock_response(
    command: str, request_id: Optional[str], web_session
) -> bool:
    entry = _next_mock_entry(command)
    if entry is None:
        return False

    if "responses" in entry:
        for response in entry["responses"]:
            response = deepcopy(response)
            response["request_id"] = request_id
            web_session.send_json_response(response)

        if entry.get("done", True):
            web_session.send_command_done(request_id)
    else:
        web_session.send_command_response(request_id, entry.get("result"), completed=True)

    return True
