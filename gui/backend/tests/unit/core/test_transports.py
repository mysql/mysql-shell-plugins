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

from contextlib import contextmanager
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import typing
from types import SimpleNamespace

import pytest
import mysqlsh
import gui_plugin.core.Logger as logger
import gui_plugin.core.ShellGuiStdioBridge as StdioBridgeModule

from gui_plugin.core.BackendDbLogger import BackendDbLogger
from gui_plugin.core.Protocols import Response
from gui_plugin.core.RequestHandler import RequestHandler
from gui_plugin.core.ShellGuiStdioBridge import ShellGuiStdioBridge
from gui_plugin.core.dbms.DbSession import DbSession
from gui_plugin.sql_editor.SqlEditorModuleSession import SqlEditorModuleSession
from gui_plugin.start import Start

_DESKTOP_BRIDGE_ENTRYPOINT = (
    "import gui_plugin as gui; import gui_plugin.start; gui.start.desktop_bridge()"
)


def _backend_root():
    return Path(__file__).resolve().parents[3]


def _repo_root():
    return Path(__file__).resolve().parents[5]


def _mysqlsh_command(entrypoint: str = _DESKTOP_BRIDGE_ENTRYPOINT):
    executable = getattr(mysqlsh, "executable", None)
    options = ["--disable-builtin-plugins", "--py", "-e", entrypoint]
    if executable:
        return [executable] + options

    bundled_mysqlsh = _repo_root() / "bld" / "bin" / "mysqlsh"
    if bundled_mysqlsh.exists():
        return [str(bundled_mysqlsh)] + options

    mysqlsh_path = shutil.which("mysqlsh")
    if mysqlsh_path:
        return [mysqlsh_path] + options

    if Path(sys.executable).name in ["mysqlsh", "mysqlsh.exe"]:
        return [sys.executable] + options

    raise RuntimeError(
        "Unable to locate a mysqlsh executable for desktop bridge tests."
    )


def _desktop_bridge_env(tmp_path, log_level=None):
    env = os.environ.copy()
    python_paths = [str(_backend_root()), str(_repo_root())]
    pythonpath = env.get("PYTHONPATH")
    if pythonpath:
        python_paths.append(pythonpath)

    env["PYTHONPATH"] = os.pathsep.join(python_paths)
    env["MYSQLSH_USER_CONFIG_HOME"] = str(tmp_path / "mysqlsh-home")
    Path(env["MYSQLSH_USER_CONFIG_HOME"]).mkdir(parents=True, exist_ok=True)

    if log_level is None:
        env.pop("LOG_LEVEL", None)
    else:
        env["LOG_LEVEL"] = log_level

    return env


def _run_desktop_bridge(tmp_path, input_text="", log_level=None):
    process = subprocess.Popen(
        _mysqlsh_command(),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=_desktop_bridge_env(tmp_path, log_level=log_level),
        cwd=_repo_root(),
    )

    try:
        stdout, stderr = process.communicate(input=input_text, timeout=30)
    except (
        subprocess.TimeoutExpired
    ) as exc:  # pragma: no cover - defensive timeout handling
        process.kill()
        stdout, stderr = process.communicate()
        raise AssertionError(
            f"desktop bridge subprocess timed out.\nstdout:\n{stdout}\nstderr:\n{stderr}"
        ) from exc

    return process.returncode, stdout, stderr


def test_gui_startup_defers_migration_step_implementations(tmp_path):
    entrypoint = """
import sys

import gui_plugin

assert "gui_plugin.migration.plan_step" not in sys.modules
assert "gui_plugin.migration.work_step" not in sys.modules
"""
    result = subprocess.run(
        _mysqlsh_command(entrypoint),
        capture_output=True,
        text=True,
        env=_desktop_bridge_env(tmp_path),
        cwd=_repo_root(),
        timeout=30,
    )

    assert result.returncode == 0, (
        f"MySQL Shell exited with {result.returncode}.\n"
        f"stdout:\n{result.stdout}\n"
        f"stderr:\n{result.stderr}"
    )


class _FakeCursor:
    def __init__(self, row=None):
        self.row = row

    def fetch_one(self):
        return self.row


class _FakeBootstrapDb:
    def execute(self, sql, *_args, **_kwargs):
        if "SELECT id FROM user" in sql:
            return _FakeCursor({"id": 42})

        return _FakeCursor()

    def get_last_row_id(self):
        return 123

    def close(self):
        return None


@contextmanager
def _fake_stdio_db_tx(self):
    yield self.db


def _patch_stdio_bootstrap(monkeypatch):
    monkeypatch.setattr(
        BackendDbLogger, "message", staticmethod(lambda *args, **kwargs: True)
    )
    monkeypatch.setattr(
        BackendDbLogger, "get_instance", staticmethod(lambda *args, **kwargs: object())
    )
    monkeypatch.setattr(BackendDbLogger, "close", staticmethod(lambda: None))
    monkeypatch.setattr(ShellGuiStdioBridge, "db_tx", _fake_stdio_db_tx)
    monkeypatch.setattr(
        StdioBridgeModule, "get_id_personal_user_group", lambda _db, _user_id: 84
    )
    monkeypatch.setattr(
        StdioBridgeModule.gui.users.backend, "create_local_user", lambda _db: None
    )
    monkeypatch.setattr(
        StdioBridgeModule.gui.users,
        "get_default_profile",
        lambda _user_id, _db: {
            "id": 21,
            "user_id": _user_id,
            "name": "Default",
            "description": "",
            "options": {},
        },
    )


def test_stdio_transport_emits_ready_and_session_messages(monkeypatch):
    _patch_stdio_bootstrap(monkeypatch)

    stdin = io.StringIO("")
    stdout = io.StringIO()

    bridge = ShellGuiStdioBridge(stdin=stdin, stdout=stdout)
    bridge._db = _FakeBootstrapDb()
    bridge.run()

    output_lines = [json.loads(line) for line in stdout.getvalue().splitlines()]

    assert output_lines[0]["event"] == "ready"
    assert output_lines[0]["data"]["transport"] == "stdio"
    assert output_lines[0]["data"]["local_user_mode"] is True
    assert output_lines[0]["data"]["active_profile"]["id"] == 21

    session_message = output_lines[1]
    assert session_message["request_state"]["type"] == "OK"
    assert session_message["request_state"]["msg"] == "A new session has been created"
    assert session_message["local_user_mode"] is True
    assert session_message["active_profile"]["id"] == 21
    assert session_message["session_uuid"] == output_lines[0]["data"]["session_uuid"]


def test_stdio_transport_decodes_real_stdin_protocol_as_utf8(monkeypatch):
    _patch_stdio_bootstrap(monkeypatch)

    request = {
        "request": "execute",
        "request_id": "utf8-request",
        "command": "gui.sqlEditor.execute",
        "args": {"sql": "select 'テスト%'"},
    }
    real_stdin = io.TextIOWrapper(
        io.BytesIO((json.dumps(request, ensure_ascii=False) + "\n").encode("utf-8")),
        encoding="cp932",
        errors="surrogateescape",
    )
    monkeypatch.setattr(StdioBridgeModule.sys, "stdin", SimpleNamespace())
    monkeypatch.setattr(
        StdioBridgeModule.sys, "real_stdin", real_stdin, raising=False
    )

    messages = []
    bridge = ShellGuiStdioBridge(stdout=io.StringIO())
    bridge._db = _FakeBootstrapDb()
    monkeypatch.setattr(bridge, "process_message", messages.append)

    bridge.run()

    assert messages == [request]


def test_stdio_transport_decodes_stdin_protocol_without_real_stdin(monkeypatch):
    _patch_stdio_bootstrap(monkeypatch)

    request = {
        "request": "execute",
        "request_id": "utf8-request",
        "command": "gui.sqlEditor.execute",
        "args": {"sql": "select 'テスト%'"},
    }
    stdin = io.TextIOWrapper(
        io.BytesIO((json.dumps(request, ensure_ascii=False) + "\n").encode("utf-8")),
        encoding="cp1252",
    )
    monkeypatch.delattr(StdioBridgeModule.sys, "real_stdin", raising=False)
    monkeypatch.setattr(StdioBridgeModule.sys, "stdin", stdin)

    messages = []
    bridge = ShellGuiStdioBridge(stdout=io.StringIO())
    bridge._db = _FakeBootstrapDb()
    monkeypatch.setattr(bridge, "process_message", messages.append)

    bridge.run()

    assert messages == [request]


def test_stdio_transport_exposes_local_backend_context_identity(monkeypatch):
    _patch_stdio_bootstrap(monkeypatch)

    bridge = ShellGuiStdioBridge(stdin=io.StringIO(""), stdout=io.StringIO())
    bridge._db = _FakeBootstrapDb()

    bridge.run()

    assert bridge.session_user_id == 42
    assert bridge.user_personal_group_id == 84
    assert bridge.session_active_profile_id == 21


def test_stdio_transport_close_drains_teardown_responses(monkeypatch):
    _patch_stdio_bootstrap(monkeypatch)

    stdin = io.StringIO("")
    stdout = io.StringIO()

    bridge = ShellGuiStdioBridge(stdin=stdin, stdout=stdout)
    bridge._db = _FakeBootstrapDb()

    original_teardown = ShellGuiStdioBridge._teardown

    def fake_teardown(self):
        self.send_response_message(
            "OK", "teardown-complete", request_id="cleanup", completed=True
        )
        original_teardown(self)

    monkeypatch.setattr(ShellGuiStdioBridge, "_teardown", fake_teardown)

    bridge.run()

    output_lines = [json.loads(line) for line in stdout.getvalue().splitlines()]

    assert output_lines[-1]["request_state"]["msg"] == "teardown-complete"
    assert output_lines[-1]["request_id"] == "cleanup"


def test_stdio_transport_context_manager_closes_db_after_start_failure(monkeypatch):
    class FailingBootstrapDb(_FakeBootstrapDb):
        def __init__(self):
            self.closed = False

        def execute(self, *_args, **_kwargs):
            raise RuntimeError("session insert failed")

        def close(self):
            self.closed = True

    _patch_stdio_bootstrap(monkeypatch)

    db = FailingBootstrapDb()
    bridge = ShellGuiStdioBridge(stdin=io.StringIO(""), stdout=io.StringIO())
    bridge._db = db

    with pytest.raises(RuntimeError, match="session insert failed"):
        with bridge:
            bridge.run()

    assert db.closed is True


def test_stdio_transport_close_cancels_pending_prompts(monkeypatch):
    class CloseDb(_FakeBootstrapDb):
        def __init__(self):
            self.closed = False

        def close(self):
            self.closed = True

    class PromptHandler:
        def __init__(self):
            self.replies = []

        def process_prompt_reply(self, reply):
            self.replies.append(reply)

    monkeypatch.setattr(BackendDbLogger, "close", staticmethod(lambda: None))

    db = CloseDb()
    prompt_handler = PromptHandler()
    bridge = ShellGuiStdioBridge(stdin=io.StringIO(""), stdout=io.StringIO())
    bridge._db = db
    bridge.connected = True
    bridge.session_uuid = "stdio-session"
    bridge.session_id = 123
    bridge._prompt_handlers["prompt-1"] = prompt_handler

    bridge.close()

    assert prompt_handler.replies == [
        {"request_id": "prompt-1", "type": "CANCEL", "reply": ""}
    ]
    assert bridge._prompt_handlers == {}
    assert db.closed is True


def test_stdio_transport_close_cancels_active_module_requests(monkeypatch):
    class CloseDb(_FakeBootstrapDb):
        def close(self):
            return None

    class ModuleSession:
        module_session_id = "module-1"

        def __init__(self):
            self.cancelled_requests = []
            self.closed = False

        def cancel_request(self, request_id):
            self.cancelled_requests.append(request_id)

        def close(self):
            self.closed = True

    monkeypatch.setattr(BackendDbLogger, "close", staticmethod(lambda: None))

    module_session = ModuleSession()
    bridge = ShellGuiStdioBridge(stdin=io.StringIO(""), stdout=io.StringIO())
    bridge._db = CloseDb()
    bridge.connected = True
    bridge.session_uuid = "stdio-session"
    bridge.session_id = 123
    bridge._module_sessions[module_session.module_session_id] = module_session
    bridge._requests["request-1"] = module_session.module_session_id

    bridge.close()

    assert module_session.cancelled_requests == ["request-1"]
    assert module_session.closed is True


def test_stdio_transport_close_uses_bounded_request_thread_join(monkeypatch):
    class CloseDb(_FakeBootstrapDb):
        def close(self):
            return None

    class HangingThread:
        def __init__(self):
            self.join_timeouts = []

        def join(self, timeout=None):
            self.join_timeouts.append(timeout)

        def is_alive(self):
            return True

    monkeypatch.setattr(BackendDbLogger, "close", staticmethod(lambda: None))

    hanging_thread = HangingThread()
    bridge = ShellGuiStdioBridge(stdin=io.StringIO(""), stdout=io.StringIO())
    bridge._db = CloseDb()
    bridge.connected = True
    bridge.session_uuid = "stdio-session"
    bridge.session_id = 123
    bridge._request_threads.append(hanging_thread)

    bridge.close()

    assert hanging_thread.join_timeouts == [
        ShellGuiStdioBridge.REQUEST_THREAD_CLOSE_TIMEOUT_SECONDS
    ]
    assert bridge._request_threads == [hanging_thread]


def test_stdio_transport_constructor_does_not_create_response_thread(monkeypatch):
    created_threads = []

    class FakeThread:
        def __init__(self, *args, **kwargs):
            created_threads.append((args, kwargs))

    monkeypatch.setattr(StdioBridgeModule.threading, "Thread", FakeThread)

    ShellGuiStdioBridge(stdin=io.StringIO(""), stdout=io.StringIO())

    assert created_threads == []


def test_stdio_transport_cancels_response_when_response_logging_fails(monkeypatch):
    monkeypatch.setattr(
        BackendDbLogger, "message", staticmethod(lambda *args, **kwargs: False)
    )
    monkeypatch.setattr(logger, "error", lambda *_args, **_kwargs: None)

    stdout = io.StringIO()
    bridge = ShellGuiStdioBridge(stdin=io.StringIO(""), stdout=stdout)
    bridge.session_id = 123
    bridge.send_json_response(
        Response.standard("OK", "original", {"request_id": "req-1"})
    )

    bridge._process_responses()

    output_lines = [json.loads(line) for line in stdout.getvalue().splitlines()]

    assert output_lines == [
        Response.error(
            "Response cancelled by the application.", {"request_id": "req-1"}
        )
    ]


def test_stdio_transport_response_loop_continues_after_unexpected_error(monkeypatch):
    monkeypatch.setattr(
        BackendDbLogger, "message", staticmethod(lambda *args, **kwargs: True)
    )
    logged_errors = []
    monkeypatch.setattr(
        logger, "exception", lambda exc, *args: logged_errors.append(exc)
    )

    class FlakyBridge(ShellGuiStdioBridge):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.fail_next_emit = True

        def _emit_json_line(self, payload):
            if self.fail_next_emit:
                self.fail_next_emit = False
                raise RuntimeError("write failed")

            super()._emit_json_line(payload)

    stdout = io.StringIO()
    bridge = FlakyBridge(stdin=io.StringIO(""), stdout=stdout)
    bridge.session_id = 123
    bridge.send_json_response(Response.standard("OK", "first", {"request_id": "req-1"}))
    bridge.send_json_response(
        Response.standard("OK", "second", {"request_id": "req-2"})
    )

    bridge._process_responses()

    output_lines = [json.loads(line) for line in stdout.getvalue().splitlines()]

    assert logged_errors
    assert output_lines == [Response.standard("OK", "second", {"request_id": "req-2"})]


def test_stdio_transport_execute_bypasses_backend_command_privileges(monkeypatch):
    class NoPrivilegeDb:
        def execute(self, *_args, **_kwargs):
            raise AssertionError(
                "stdio execute should not query backend command privileges"
            )

    started_requests = []

    class FakeRequestHandler:
        def __init__(self, request_id, func, kwargs, web_handler, lock_session=False):
            self.request_id = request_id
            self.func = func
            self.kwargs = kwargs
            self.web_handler = web_handler
            self.lock_session = lock_session

        def run(self):
            return None

        def start(self):
            started_requests.append(self)

    monkeypatch.setattr(StdioBridgeModule, "RequestHandler", FakeRequestHandler)
    monkeypatch.setattr(logger, "debug2", lambda *_args, **_kwargs: None)

    bridge = ShellGuiStdioBridge(stdin=io.StringIO(""), stdout=io.StringIO())
    bridge._db = NoPrivilegeDb()

    bridge.process_message(
        {
            "request": "execute",
            "request_id": "stdio-bypass",
            "command": "gui.core.get_log_level",
        }
    )

    assert len(started_requests) == 1
    assert started_requests[0].request_id == "stdio-bypass"


def test_request_handler_passes_gui_callback_through_plugin_validation() -> None:
    class RecordingWebHandler:
        def __init__(self) -> None:
            self.pending_messages: list[
                tuple[str, str, dict[str, typing.Any]]
            ] = []
            self.command_responses: list[
                tuple[tuple[typing.Any, ...], dict[str, typing.Any]]
            ] = []
            self.completed_requests: list[str] = []

        def send_response_message(
            self, state: str, message: str, **kwargs: typing.Any
        ) -> None:
            self.pending_messages.append((state, message, kwargs))

        def send_command_response(
            self, *args: typing.Any, **kwargs: typing.Any
        ) -> None:
            self.command_responses.append((args, kwargs))

        def send_command_done(self, request_id: str) -> None:
            self.completed_requests.append(request_id)

    web_handler = RecordingWebHandler()
    handler = RequestHandler(
        "gui-message",
        mysqlsh.globals.guitest.do_send_gui_message,
        {"send_gui_message": True},
        web_handler,
    )

    handler._do_execute()

    assert web_handler.pending_messages == [
        (
            "PENDING",
            "",
            {
                "request_id": "gui-message",
                "values": {"data": {"info": "Callback invoked."}},
                "api": True,
            },
        )
    ]
    assert web_handler.command_responses == []
    assert web_handler.completed_requests == ["gui-message"]


@pytest.mark.parametrize(
    "command_prefix",
    [
        "gui.migration.",
        "gui.legacy.",
    ],
)
def test_stdio_transport_resolves_migration_and_configuration_import_commands(
    monkeypatch,
    command_prefix,
):
    started_requests = []

    class FakeRequestHandler:
        def __init__(self, request_id, func, kwargs, web_handler, lock_session=False):
            self.request_id = request_id
            self.func = func
            self.kwargs = kwargs
            self.web_handler = web_handler
            self.lock_session = lock_session

        def run(self):
            return None

        def start(self):
            started_requests.append(self)

    monkeypatch.setattr(StdioBridgeModule, "RequestHandler", FakeRequestHandler)
    monkeypatch.setattr(logger, "debug2", lambda *_args, **_kwargs: None)

    bridge = ShellGuiStdioBridge(stdin=io.StringIO(""), stdout=io.StringIO())
    commands = sorted(
        command
        for command in bridge._web_functions
        if command.startswith(command_prefix)
    )

    expected_commands = {
        "gui.migration.": {
            "gui.migration.info",
            "gui.migration.version",
            "gui.migration.work_start",
            "gui.migration.work_abort",
            "gui.migration.work_clean",
            "gui.migration.work_status",
            "gui.migration.work_retry",
            "gui.migration.skip_transactions",
            "gui.migration.fetch_logs",
            "gui.migration.get_steps",
            "gui.migration.new_project",
            "gui.migration.open_project",
            "gui.migration.close_project",
            "gui.migration.list_projects",
            "gui.migration.plan_update",
            "gui.migration.plan_get_data_item",
            "gui.migration.plan_update_sub_step",
            "gui.migration.plan_commit",
            "gui.migration.oci_sign_in",
        },
        "gui.legacy.": {
            "gui.legacy.discover",
            "gui.legacy.import_discovered_workbench_connections",
            "gui.legacy.import_migration_assistant_projects",
            "gui.legacy.import_vs_code",
        },
    }

    assert set(commands) == expected_commands[command_prefix]

    for index, command in enumerate(commands):
        bridge.execute_command_request(
            {
                "request": "execute",
                "request_id": f"migration-{index}",
                "command": command,
            }
        )

        assert len(started_requests) == index + 1, command
        assert started_requests[-1].func.__name__ == command.rsplit(".", 1)[-1]


def test_stdio_transport_execute_injects_local_profile(monkeypatch):
    started_requests = []

    class FakeRequestHandler:
        def __init__(self, request_id, func, kwargs, web_handler, lock_session=False):
            self.request_id = request_id
            self.func = func
            self.kwargs = kwargs
            self.web_handler = web_handler
            self.lock_session = lock_session

        def run(self):
            return None

        def start(self):
            started_requests.append(self)

    class FakeModule:
        def with_profile(self, profile_id=None):
            return profile_id

    monkeypatch.setattr(StdioBridgeModule, "RequestHandler", FakeRequestHandler)
    monkeypatch.setattr(logger, "debug2", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(
        StdioBridgeModule.gui, "stdio_test", FakeModule(), raising=False
    )

    bridge = ShellGuiStdioBridge(stdin=io.StringIO(""), stdout=io.StringIO())
    bridge.set_active_profile_id(21)

    bridge.process_message(
        {
            "request": "execute",
            "request_id": "stdio-profile",
            "command": "gui.stdioTest.with_profile",
        }
    )

    assert len(started_requests) == 1
    assert started_requests[0].kwargs["profile_id"] == 21


def test_stdio_transport_routes_sql_editor_execute_to_user_session(monkeypatch):
    started_requests = []

    class FakeRequestHandler:
        def __init__(self, request_id, func, kwargs, web_handler, lock_session=False):
            self.request_id = request_id
            self.func = func
            self.kwargs = kwargs
            self.web_handler = web_handler
            self.lock_session = lock_session

        def run(self):
            return None

        def start(self):
            started_requests.append(self)

    class FakeSqlEditorModuleSession(SqlEditorModuleSession):
        def __del__(self):
            pass

    monkeypatch.setattr(StdioBridgeModule, "RequestHandler", FakeRequestHandler)
    monkeypatch.setattr(logger, "debug2", lambda *_args, **_kwargs: None)

    bridge = ShellGuiStdioBridge(stdin=io.StringIO(""), stdout=io.StringIO())
    module_session = object.__new__(FakeSqlEditorModuleSession)
    user_session = DbSession("user", False, {})
    service_session = DbSession("service", False, {})
    module_session._db_user_session = user_session
    module_session._db_service_session = service_session
    bridge._module_sessions["module"] = module_session

    bridge.process_message(
        {
            "request": "execute",
            "request_id": "sql-editor-execute",
            "command": "gui.sqlEditor.execute",
            "args": {
                "module_session_id": "module",
                "sql": "select sleep(30)",
            },
        }
    )

    assert len(started_requests) == 1
    assert started_requests[0].kwargs["session"] is user_session
    assert started_requests[0].kwargs["session"] is not service_session


def test_stdio_transport_routes_mysql_commands_to_service_session(monkeypatch):
    started_requests = []

    class FakeRequestHandler:
        def __init__(self, request_id, func, kwargs, web_handler, lock_session=False):
            self.request_id = request_id
            self.func = func
            self.kwargs = kwargs
            self.web_handler = web_handler
            self.lock_session = lock_session

        def run(self):
            return None

        def start(self):
            started_requests.append(self)

    class FakeSqlEditorModuleSession(SqlEditorModuleSession):
        def __del__(self):
            pass

    def mysql_list_users(session):
        return []

    def mysql_get_password_reset_info(password_expired=False, session=None):
        return {}

    monkeypatch.setattr(StdioBridgeModule, "RequestHandler", FakeRequestHandler)
    monkeypatch.setattr(logger, "debug2", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(
        StdioBridgeModule.gui,
        "mysql",
        SimpleNamespace(
            list_users=mysql_list_users,
            get_password_reset_info=mysql_get_password_reset_info,
        ),
        raising=False,
    )

    bridge = ShellGuiStdioBridge(stdin=io.StringIO(""), stdout=io.StringIO())
    module_session = object.__new__(FakeSqlEditorModuleSession)
    user_session = DbSession("user", False, {})
    service_session = DbSession("service", False, {})
    module_session._db_user_session = user_session
    module_session._db_service_session = service_session
    bridge._module_sessions["module"] = module_session

    bridge.process_message(
        {
            "request": "execute",
            "request_id": "mysql-list-users",
            "command": "gui.mysql.list_users",
            "args": {
                "module_session_id": "module",
            },
        }
    )

    assert len(started_requests) == 1
    assert started_requests[0].kwargs["session"] is service_session

    bridge.process_message(
        {
            "request": "execute",
            "request_id": "mysql-password-reset-info",
            "command": "gui.mysql.get_password_reset_info",
            "args": {
                "module_session_id": "module",
            },
        }
    )

    assert len(started_requests) == 2
    assert started_requests[1].kwargs["session"] is service_session
    assert started_requests[1].lock_session is False

    bridge.process_message(
        {
            "request": "execute",
            "request_id": "expired-password-reset-info",
            "command": "gui.mysql.get_password_reset_info",
            "args": {
                "module_session_id": "module",
                "password_expired": True,
            },
        }
    )

    assert len(started_requests) == 3
    assert started_requests[2].kwargs["session"] is service_session
    assert started_requests[2].lock_session is False


def test_stdio_transport_injects_module_session_for_error_log_export(monkeypatch):
    started_requests = []

    class FakeRequestHandler:
        def __init__(self, request_id, func, kwargs, web_handler, lock_session=False):
            self.request_id = request_id
            self.func = func
            self.kwargs = kwargs
            self.web_handler = web_handler
            self.lock_session = lock_session

        def run(self):
            return None

        def start(self):
            started_requests.append(self)

    class FakeSqlEditorModuleSession(SqlEditorModuleSession):
        def __del__(self):
            pass

    def export_error_logs(target_path, module_session):
        return None

    monkeypatch.setattr(StdioBridgeModule, "RequestHandler", FakeRequestHandler)
    monkeypatch.setattr(logger, "debug2", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(
        StdioBridgeModule.gui,
        "mysql",
        SimpleNamespace(export_error_logs=export_error_logs),
        raising=False,
    )

    bridge = ShellGuiStdioBridge(stdin=io.StringIO(""), stdout=io.StringIO())
    module_session = object.__new__(FakeSqlEditorModuleSession)
    user_session = DbSession("user", False, {})
    service_session = DbSession("service", False, {})
    module_session._db_user_session = user_session
    module_session._db_service_session = service_session
    bridge._module_sessions["module"] = module_session

    bridge.process_message(
        {
            "request": "execute",
            "request_id": "mysql-export-error-logs",
            "command": "gui.mysql.export_error_logs",
            "args": {
                "module_session_id": "module",
                "target_path": "/tmp/error.log",
            },
        }
    )

    assert len(started_requests) == 1
    assert started_requests[0].kwargs["module_session"] is module_session


def test_stdio_transport_keeps_db_execute_on_service_session(monkeypatch):
    started_requests = []

    class FakeRequestHandler:
        def __init__(self, request_id, func, kwargs, web_handler, lock_session=False):
            self.request_id = request_id
            self.func = func
            self.kwargs = kwargs
            self.web_handler = web_handler
            self.lock_session = lock_session

        def run(self):
            return None

        def start(self):
            started_requests.append(self)

    class FakeSqlEditorModuleSession(SqlEditorModuleSession):
        def __del__(self):
            pass

    monkeypatch.setattr(StdioBridgeModule, "RequestHandler", FakeRequestHandler)
    monkeypatch.setattr(logger, "debug2", lambda *_args, **_kwargs: None)

    bridge = ShellGuiStdioBridge(stdin=io.StringIO(""), stdout=io.StringIO())
    module_session = object.__new__(FakeSqlEditorModuleSession)
    user_session = DbSession("user", False, {})
    service_session = DbSession("service", False, {})
    module_session._db_user_session = user_session
    module_session._db_service_session = service_session
    bridge._module_sessions["module"] = module_session

    bridge.process_message(
        {
            "request": "execute",
            "request_id": "db-execute",
            "command": "gui.db.execute",
            "args": {
                "module_session_id": "module",
                "sql": "select 1",
            },
        }
    )

    assert len(started_requests) == 1
    assert started_requests[0].kwargs["session"] is service_session
    assert started_requests[0].kwargs["session"] is not user_session


def test_stdio_transport_routes_offline_meb_commands_to_module_session(monkeypatch):
    started_requests = []

    class FakeRequestHandler:
        def __init__(self, request_id, func, kwargs, web_handler, lock_session=False):
            self.request_id = request_id
            self.func = func
            self.kwargs = kwargs
            self.web_handler = web_handler
            self.lock_session = lock_session

        def run(self):
            return None

        def start(self):
            started_requests.append(self)

    class FakeOfflineModuleSession(SqlEditorModuleSession):
        def __del__(self):
            pass

    monkeypatch.setattr(StdioBridgeModule, "RequestHandler", FakeRequestHandler)
    monkeypatch.setattr(logger, "debug2", lambda *_args, **_kwargs: None)

    bridge = ShellGuiStdioBridge(stdin=io.StringIO(""), stdout=io.StringIO())
    module_session = object.__new__(FakeOfflineModuleSession)
    module_session._db_service_session = None
    bridge._module_sessions["module"] = module_session

    bridge.process_message(
        {
            "request": "execute",
            "request_id": "meb-get-status",
            "command": "gui.meb.get_status",
            "args": {
                "module_session_id": "module",
                "backup_home_path": "/backups",
            },
        }
    )

    assert len(started_requests) == 1
    assert started_requests[0].kwargs.get("module_session") is module_session
    assert started_requests[0].kwargs["backup_home_path"] == "/backups"


def test_stdio_transport_forgets_completed_request_threads(monkeypatch):
    class ImmediateRequestHandler:
        def __init__(self, request_id, func, kwargs, web_handler, lock_session=False):
            self.request_id = request_id
            self.func = func
            self.kwargs = kwargs
            self.web_handler = web_handler
            self.lock_session = lock_session
            self.daemon = False

        def run(self):
            return None

        def start(self):
            self.run()

        def is_alive(self):
            return False

    monkeypatch.setattr(StdioBridgeModule, "RequestHandler", ImmediateRequestHandler)
    monkeypatch.setattr(logger, "debug2", lambda *_args, **_kwargs: None)

    bridge = ShellGuiStdioBridge(stdin=io.StringIO(""), stdout=io.StringIO())

    bridge.process_message(
        {
            "request": "execute",
            "request_id": "completed-thread",
            "command": "gui.core.get_log_level",
        }
    )

    assert bridge._request_threads == []


def test_desktop_bridge_starts_stdio_bridge_without_extra_options(monkeypatch):
    created_bridge = {}

    class FakeBridge:
        def __init__(self, **kwargs):
            created_bridge["kwargs"] = kwargs

        def __enter__(self):
            created_bridge["entered"] = True
            return self

        def __exit__(self, exc_type, exc_value, traceback):
            created_bridge["exited"] = (exc_type, exc_value, traceback)
            return False

        def run(self):
            created_bridge["ran"] = True

    monkeypatch.setattr(Start, "ShellGuiStdioBridge", FakeBridge)

    Start.desktop_bridge()

    assert created_bridge["kwargs"] == {}
    assert created_bridge["entered"] is True
    assert created_bridge["ran"] is True
    assert created_bridge["exited"] == (None, None, None)


def test_desktop_bridge_context_manager_closes_after_run_failure(monkeypatch):
    created_bridge = {}

    class FakeBridge:
        def __enter__(self):
            created_bridge["entered"] = True
            return self

        def __exit__(self, exc_type, exc_value, traceback):
            created_bridge["exited"] = (
                exc_type,
                type(exc_value),
                traceback is not None,
            )
            return False

        def run(self):
            raise RuntimeError("run failed")

    monkeypatch.setattr(Start, "ShellGuiStdioBridge", FakeBridge)

    with pytest.raises(RuntimeError, match="run failed"):
        Start.desktop_bridge()

    assert created_bridge["entered"] is True
    assert created_bridge["exited"] == (RuntimeError, RuntimeError, True)


def test_desktop_bridge_stdout_is_json_only_with_default_logging(tmp_path):
    returncode, stdout, stderr = _run_desktop_bridge(tmp_path)

    assert returncode == 0, stderr

    output_lines = stdout.splitlines()
    assert output_lines

    parsed_lines = []
    for line in output_lines:
        parsed_lines.append(json.loads(line))

    assert len(parsed_lines) >= 2
    assert parsed_lines[0]["event"] == "ready"
    assert parsed_lines[1]["request_state"]["msg"] == "A new session has been created"
    assert "Traceback" not in stderr


def test_desktop_bridge_handles_immediate_execute_requests(tmp_path):
    request_id = "immediate-execute"
    request = (
        json.dumps(
            {
                "request": "execute",
                "request_id": request_id,
                "command": "gui.core.get_log_level",
            }
        )
        + "\n"
    )

    returncode, stdout, stderr = _run_desktop_bridge(
        tmp_path, input_text=request, log_level="NONE"
    )

    assert returncode == 0, stderr

    output_lines = [json.loads(line) for line in stdout.splitlines()]

    assert output_lines[0]["event"] == "ready"
    assert any(
        line.get("request_state", {}).get("msg") == "A new session has been created"
        for line in output_lines
    )
    assert any(
        line.get("request_id") == request_id
        and line.get("request_state", {}).get("type") == "PENDING"
        and line.get("result") == "NONE"
        for line in output_lines
    ), output_lines
    assert any(
        line.get("request_id") == request_id
        and line.get("request_state", {}).get("type") == "OK"
        and line.get("done") is True
        for line in output_lines
    )
    assert "Traceback" not in stderr
