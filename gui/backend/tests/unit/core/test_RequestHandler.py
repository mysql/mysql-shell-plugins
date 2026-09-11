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
# This program is distributed in the hope that it will be useful, but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

from types import SimpleNamespace
from typing import Any

import pytest

from gui_plugin.core.CompletionEvent import CompletionEvent
from gui_plugin.core.RequestHandler import RequestHandler


@pytest.mark.parametrize("provisional_result", [None, {"module_session_id": "test-session"}])
@pytest.mark.parametrize("outcome", ["error", "cancelled", "success"])
def test_request_handler_checks_completion_before_result(
    provisional_result: dict[str, str] | None, outcome: str
) -> None:
    completion = CompletionEvent()
    responses: list[dict[str, Any]] = []
    completed: list[str] = []

    def execute() -> dict[str, str] | None:
        if outcome == "error":
            completion.add_error(RuntimeError("PQC negotiation failed"))
        elif outcome == "cancelled":
            completion.set_cancelled()
        else:
            completion.set()

        return provisional_result

    def send_response(
        request_id: str, response: dict[str, Any], completed: bool = False
    ) -> None:
        responses.append(response)

    handler = RequestHandler(
        "test-pqc",
        execute,
        {},
        SimpleNamespace(send_command_response=send_response, send_command_done=completed.append),
    )
    handler._thread_context = SimpleNamespace(completion_event=completion)
    handler._do_execute()

    states = [response["request_state"]["type"] for response in responses]
    if outcome == "error":
        assert states == ["ERROR"]
        assert "PQC negotiation failed" in str(responses[0])
        assert completed == []
    elif outcome == "cancelled":
        assert states == ["CANCELLED"]
        assert completed == []
    else:
        assert states == (["PENDING"] if provisional_result else [])
        assert completed == ["test-pqc"]

        if provisional_result:
            assert responses[0]["result"] == provisional_result
