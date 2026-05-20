# Copyright (c) 2026, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is designed to work with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms,
# as designated in a particular file or component or in included license
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

from types import ModuleType
import sys

import gui_plugin.core.dbms.DbMySQLSessionCommon as common
from gui_plugin.core.dbms.DbMySQLSessionTasks import MySQLVisualExplainTask


class MockSession:
    def __init__(self, expected_queries=None):
        self.expected_queries = expected_queries or []
        self.next_query = 0
        self.data = {common.MySQLData.VERSION_INFO: "8.3.0"}

    def clear_stats(self):
        pass

    def task_state_cb(self, state, message, task_id, data):
        pass

    def execute_thread(self, sql, params, options=None):
        assert self.next_query < len(self.expected_queries), (
            f"Unexpected query received, no more expected: {sql}")

        expected_sql, expected_params, result = self.expected_queries[self.next_query]
        assert sql == expected_sql
        assert params == expected_params
        self.next_query += 1

        return result


class MockResult:
    def __init__(self, row):
        self.row = row

    def fetch_one(self):
        return self.row


def test_visual_explain_uses_scheduler_converted_options(monkeypatch):
    actual_options = {}

    def render_explain_plan(plan, path, **options):
        actual_options.update(options)
        return "<svg/>"

    util_plugin = ModuleType("util_plugin")
    visual = ModuleType("util_plugin.visual")
    exported = ModuleType("util_plugin.visual.exported")
    exported.render_explain_plan = render_explain_plan
    monkeypatch.setitem(sys.modules, "util_plugin", util_plugin)
    monkeypatch.setitem(sys.modules, "util_plugin.visual", visual)
    monkeypatch.setitem(sys.modules, "util_plugin.visual.exported", exported)

    task = MySQLVisualExplainTask(
        MockSession(),
        options={
            "plan": "{}",
            "compact": False,
            "compact_joins": True,
            "dark_mode": True,
            "show_description": True,
            "show_query": False,
            "layout": "bottomUp",
        },
    )

    result = task.run()

    assert result["svg"] == "<svg/>"
    assert actual_options["compact_joins"] is True
    assert actual_options["dark_mode"] is True
    assert actual_options["show_description"] is True
    assert actual_options["show_query"] is False


def test_visual_explain_does_not_set_explain_json_format_version(monkeypatch):
    def render_explain_plan(plan, path, **options):
        return "<svg/>"

    util_plugin = ModuleType("util_plugin")
    visual = ModuleType("util_plugin.visual")
    exported = ModuleType("util_plugin.visual.exported")
    exported.render_explain_plan = render_explain_plan
    monkeypatch.setitem(sys.modules, "util_plugin", util_plugin)
    monkeypatch.setitem(sys.modules, "util_plugin.visual", visual)
    monkeypatch.setitem(sys.modules, "util_plugin.visual.exported", exported)

    session = MockSession([
        ("EXPLAIN FORMAT=JSON SELECT 1", None, MockResult(["{}"])),
    ])
    task = MySQLVisualExplainTask(session, sql="SELECT 1", options={})

    result = task.run()

    assert result["svg"] == "<svg/>"
    assert session.next_query == len(session.expected_queries)
