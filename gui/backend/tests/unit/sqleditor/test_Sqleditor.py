# Copyright (c) 2020, 2026, Oracle and/or its affiliates.
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

import threading
import time
import uuid
from unittest.mock import Mock, call, patch

import pytest
import mysqlsh
from mysqlsh import mysql

import config
import gui_plugin.Meb as Meb
import gui_plugin.core.Error as Error
import gui_plugin.core.Logger as logger
from gui_plugin import db_connections, sql_editor
from gui_plugin.db import Metadata
from gui_plugin.db_connections import InternalData
import gui_plugin.sql_editor.SqlEditor as sql_editor_module
from gui_plugin.core.Error import MSGException
from gui_plugin.core.dbms.DbMySQLSession import DbMysqlSession
from gui_plugin.core.dbms import DbMySQLSessionSetupTasks as SetupTasks
from gui_plugin.core.dbms.DbSession import ReconnectionMode
from gui_plugin.core.modules.DbModuleSession import DbModuleSession
from gui_plugin.users import UserManagement
from gui_plugin.sql_editor.SqlEditorModuleSession import SqlEditorModuleSession
from tests.lib.MockWebSession import MockWebSession
from tests.lib.utils import backend_callback, backend_callback_with_pending


class MockContext:
    pass


class Parameters:
    _connection_id = None
    _web_session = None
    _module_session = None
    _module_session_id = None
    _db_connection_id = None
    _open_connection_info = None


def _password_cache_module_session():
    web_session = MockWebSession()
    module_session = DbModuleSession.__new__(DbModuleSession)
    module_session._module_session_id = "module-1"
    module_session._db_service_session = None
    module_session._connection_options = {}
    module_session._connection_passwords = {}
    module_session._password_prompt_factors = []
    module_session._current_request_id = "request-1"
    module_session._web_session = web_session
    module_session.send_prompt_response = lambda _request_id, _options, callback: callback()

    return module_session


def test_service_session_omits_sql_mode():
    module_session = _password_cache_module_session()
    module_session._db_type = "MySQL"
    module_session._connection_options = {"scheme": "mysql", "sql-mode": ["ANSI_QUOTES"]}
    module_session._reconnection_mode = None

    with patch("gui_plugin.core.modules.DbModuleSession.DbSessionFactory.create") as create:
        module_session.connect()

    assert create.call_args.args[3] == {"scheme": "mysql"}
    assert module_session._connection_options["sql-mode"] == ["ANSI_QUOTES"]


def test_service_session_activates_all_roles():
    service_session = DbMysqlSession.__new__(DbMysqlSession)
    service_session._mutex = threading.RLock()
    service_session.execute_thread = Mock()

    service_session.activate_all_roles()

    service_session.execute_thread.assert_called_once_with(
        "SET ROLE ALL", None
    )


def test_service_query_activates_all_roles_when_requested():
    service_session = DbMysqlSession.__new__(DbMysqlSession)
    service_session.session = Mock()
    service_session.activate_all_roles = Mock()
    options = {"activate_all_roles": True}

    service_session.do_execute("ALTER USER", options=options)

    service_session.activate_all_roles.assert_called_once_with()
    service_session.session.run_sql.assert_called_once_with("ALTER USER", None)
    assert options == {"activate_all_roles": True}


def _sql_editor_module_session():
    context = MockContext()
    context.web_handler = MockWebSession()

    with patch(
        "gui_plugin.core.modules.ModuleSession.get_context", return_value=context
    ):
        return SqlEditorModuleSession()


class _PromptingShell:
    def __init__(self, session, expected_options, replies):
        self._session = session
        self._expected_options = expected_options
        self._replies = replies
        self.open_options = None

    def open_session(self, options):
        self.open_options = options.copy()
        assert self.open_options == self._expected_options

        password_options = [key for key in ("password", "password2", "password3")
                            if key in options and options[key] is None]
        for option, reply in zip(password_options, self._replies):
            replied, value = self._session.on_shell_prompt(
                f"Please provide the {option} for 'user@localhost': ",
                {"type": "password"},
                {},
            )
            assert replied is True
            assert value == reply

        return Mock()


class _FailingWebAuthnShell:
    def __init__(self, session):
        self._session = session

    def open_session(self, _options):
        self._session.on_shell_print_error(
            "Registration failed. Challenge received might be corrupt.\n",
            {"auth": "authentication_webauthn"},
        )
        raise RuntimeError(
            'Failed to set "registration_challenge" for '
            "authentication_webauthn_client plugin"
        )


class _ExpiredPasswordShell:
    def __init__(self):
        self.open_options = []

    def open_session(self, options):
        self.open_options.append(options.copy())
        if len(self.open_options) == 1:
            raise _ExpiredPasswordError("Your password has expired")

        return Mock()


class _ExpiredPasswordSandboxShell:
    def __init__(self):
        self.open_options = []

    def open_session(self, options):
        self.open_options.append(options.copy())
        return Mock()


class _ExpiredPasswordError(RuntimeError):
    code = mysql.ErrorCode.ER_MUST_CHANGE_PASSWORD_LOGIN


class _MustChangePasswordError(RuntimeError):
    code = mysql.ErrorCode.ER_MUST_CHANGE_PASSWORD


class _AccessDeniedError(RuntimeError):
    code = mysql.ErrorCode.ER_ACCESS_DENIED_ERROR


class _CachedPasswordShell:
    def __init__(self):
        self.open_options = []

    def open_session(self, options):
        self.open_options.append(options.copy())
        if len(self.open_options) == 1:
            raise _AccessDeniedError("Access denied")

        return Mock()


class _AccessDeniedShell:
    def open_session(self, _options):
        raise _AccessDeniedError("Access denied")


class _RetryingPromptShell:
    def __init__(self, session):
        self._session = session
        self._attempts = 0

    def open_session(self, _options):
        replied, _value = self._session.on_shell_prompt(
            "Please provide the password for 'user@localhost': ", {"type": "password"}, {}
        )
        assert replied is True
        self._attempts += 1
        if self._attempts == 1:
            raise _AccessDeniedError("Access denied")

        return Mock()


def _open_mocked_mysql_connection(module_session, options, replies):
    db_session = DbMysqlSession.__new__(DbMysqlSession)
    db_session._connection_options = options.copy()
    db_session._on_connect = lambda: None
    db_session._on_failed_connection = lambda: None
    db_session._prompt_cb = module_session.on_shell_prompt
    db_session._data = {}
    db_session._shell = _PromptingShell(db_session, options, replies)
    module_session._db_service_session = Mock(
        connection_options=db_session._connection_options,
    )

    replies_iter = iter(replies)

    def respond_to_prompt(_request_id, _options, callback):
        module_session._prompt_replied = True
        module_session._prompt_reply = next(replies_iter)
        callback()

    module_session.send_prompt_response = respond_to_prompt

    assert db_session._do_connect() is True

    return db_session


def test_webauthn_registration_surfaces_plugin_error():
    db_session = DbMysqlSession.__new__(DbMysqlSession)
    db_session._connection_options = {}
    db_session._on_connect = lambda: None
    db_session._on_failed_connection = lambda: None
    db_session._message_callback = lambda *_args: None
    db_session._failed_cb = None
    db_session._data = {}
    db_session._shell = _FailingWebAuthnShell(db_session)

    with pytest.raises(
        RuntimeError,
        match="Registration failed. Challenge received might be corrupt.",
    ):
        db_session._do_connect()


def test_expired_password_connection_enables_password_change():
    db_session = DbMysqlSession.__new__(DbMysqlSession)
    db_session._connection_options = {"scheme": "mysql"}
    db_session._on_connect = lambda: None
    db_session._on_failed_connection = lambda: None
    db_session._data = {}
    db_session._shell = _ExpiredPasswordShell()
    failures = []

    with patch(
        "gui_plugin.core.dbms.DbMySQLSession.mysqlsh.DBError",
        _ExpiredPasswordError,
    ):
        assert db_session._do_connect(failures.append) is False
    assert db_session._shell.open_options == [
        {"scheme": "mysql"},
        {"scheme": "mysql", "can-handle-expired-passwords": True},
    ]
    assert str(failures[0]) == "Your password has expired"


@pytest.mark.parametrize(
    "error_class",
    [_ExpiredPasswordError, _MustChangePasswordError],
)
def test_expired_password_during_setup_keeps_the_session_for_password_change(
    error_class,
):
    db_session = DbMysqlSession.__new__(DbMysqlSession)
    db_session._data = {}
    setup_task = Mock()
    setup_task.on_connected.side_effect = error_class("Your password has expired")
    db_session._setup_tasks = [setup_task]
    db_session._failed_cb = Mock()
    db_session._connected_cb = Mock()

    with patch(
        "gui_plugin.core.dbms.DbMySQLSession.mysqlsh.DBError",
        error_class,
    ):
        db_session._on_connected(True)

    setup_task.on_failed_connection.assert_called_once()
    db_session._failed_cb.assert_called_once_with(setup_task.on_connected.side_effect)
    db_session._connected_cb.assert_not_called()


def test_expired_password_sandbox_connection_is_kept_for_password_change():
    db_session = DbMysqlSession.__new__(DbMysqlSession)
    db_session._connection_options = {
        "scheme": "mysql",
        "can-handle-expired-passwords": True,
    }
    db_session._on_connect = lambda: None
    db_session._on_failed_connection = Mock()
    db_session._data = {}
    db_session._shell = _ExpiredPasswordSandboxShell()
    db_session._failed_cb = Mock()
    db_session._connected_cb = Mock()
    setup_task = Mock()
    setup_task.on_connected.side_effect = _MustChangePasswordError(
        "Your password has expired"
    )
    db_session._setup_tasks = [setup_task]

    with patch(
        "gui_plugin.core.dbms.DbMySQLSession.mysqlsh.DBError",
        _MustChangePasswordError,
    ):
        assert db_session._do_connect(db_session._failed_cb) is True
        db_session._on_connected(True)

    assert db_session._shell.open_options == [
        {"scheme": "mysql", "can-handle-expired-passwords": True},
    ]
    db_session._on_failed_connection.assert_called_once()
    db_session._failed_cb.assert_called_once_with(setup_task.on_connected.side_effect)
    db_session._connected_cb.assert_not_called()


def test_expired_password_setup_failure_does_not_close_the_module_session():
    module_session = _password_cache_module_session()
    module_session.close_connection = Mock()
    module_session.completion_event = Mock()
    error = _MustChangePasswordError("Your password has expired")

    with patch(
        "gui_plugin.core.modules.DbModuleSession.mysqlsh.DBError",
        _MustChangePasswordError,
    ):
        module_session.on_fail_connecting(error)

    module_session.close_connection.assert_not_called()
    module_session.completion_event.add_error.assert_called_once_with(error)
    module_session.completion_event.set.assert_called_once()


def test_access_denied_retries_without_cached_passwords():
    db_session = DbMysqlSession.__new__(DbMysqlSession)
    db_session._connection_options = {
        "scheme": "mysql",
        "password": "first-secret",
        "password2": "second-secret",
    }
    db_session._on_connect = lambda: None
    db_session._on_failed_connection = lambda: None
    db_session._data = {}
    db_session._shell = _CachedPasswordShell()

    with patch(
        "gui_plugin.core.dbms.DbMySQLSession.mysqlsh.DBError",
        _AccessDeniedError,
    ):
        assert db_session._do_connect() is True

    assert db_session._shell.open_options == [
        {"scheme": "mysql", "password": "first-secret", "password2": "second-secret"},
        {"scheme": "mysql", "password": None, "password2": None},
    ]


def test_access_denied_clears_extra_option_passwords_before_retry():
    db_session = DbMysqlSession.__new__(DbMysqlSession)
    db_session._connection_options = {
        "scheme": "mysql",
        "extra-options": {"password": "first-secret", "password2": "second-secret"},
    }
    db_session._setup_tasks = [SetupTasks.RemoveExternalOptionsTask(db_session)]
    db_session._on_failed_connection = lambda: None
    db_session._data = {}
    db_session._shell = _CachedPasswordShell()

    with patch(
        "gui_plugin.core.dbms.DbMySQLSession.mysqlsh.DBError",
        _AccessDeniedError,
    ):
        assert db_session._do_connect() is True

    assert db_session._shell.open_options == [
        {"scheme": "mysql", "password": "first-secret", "password2": "second-secret"},
        {"scheme": "mysql", "password": None, "password2": None},
    ]


def test_access_denied_reports_failure_after_retries_are_exhausted():
    db_session = DbMysqlSession.__new__(DbMysqlSession)
    db_session._connection_options = {"scheme": "mysql", "password": "incorrect"}
    db_session._on_connect = lambda: None
    db_session._on_failed_connection = Mock()
    db_session._passwords_rejected_cb = None
    db_session._data = {}
    db_session._shell = _AccessDeniedShell()
    failures = []

    with patch(
        "gui_plugin.core.dbms.DbMySQLSession.mysqlsh.DBError",
        _AccessDeniedError,
    ):
        assert db_session._do_connect(failures.append) is False

    assert len(failures) == 1
    assert failures[0].code == mysql.ErrorCode.ER_ACCESS_DENIED_ERROR
    db_session._on_failed_connection.assert_called_once()


def test_automatic_reconnect_does_not_prompt():
    db_session = DbMysqlSession.__new__(DbMysqlSession)
    db_session._mutex = threading.RLock()
    db_session._id = "test-session"
    db_session._auto_reconnect = ReconnectionMode.EXTENDED
    db_session._close_database = Mock()
    db_session._on_connected = Mock()
    db_session._on_failed_connection = Mock()
    db_session._prompt_cb = Mock(return_value=(True, "secret"))
    db_session._allow_prompts = True
    db_session._data = {}
    prompt_results = []

    def reconnect():
        prompt_results.append(
            db_session.on_shell_prompt(
                "Please provide the password for 'user@localhost': ", {"type": "password"}, {}
            )
        )
        return False

    db_session._do_connect = reconnect

    assert db_session._reconnect(True) is False
    assert prompt_results == [(False, "")] * 3
    db_session._prompt_cb.assert_not_called()


def test_reconnect_releases_session_lock_before_connected_callback():
    db_session = DbMysqlSession.__new__(DbMysqlSession)
    db_session._mutex = threading.Lock()
    phases = []

    def reconnect(is_auto_reconnect):
        phases.append(("reconnect", db_session._mutex.locked()))
        return True

    def connected(session):
        phases.append(("callback", session._mutex.locked()))

    db_session._reconnect_session = reconnect
    db_session._connected_cb = connected

    assert db_session._reconnect(False) is True
    assert phases == [("reconnect", True), ("callback", False)]


def test_prompt_reply_preserves_the_next_factor_prompt():
    module_session = _sql_editor_module_session()
    module_session._web_session.send_prompt_response = Mock()
    next_factor_ready = Mock()

    def request_next_factor():
        module_session.send_prompt_response("connect", {"type": "password"}, next_factor_ready)

    module_session.send_prompt_response("connect", {"type": "password"}, request_next_factor)
    module_session.process_prompt_reply({"request_id": "connect", "type": "OK", "reply": "first"})
    module_session.process_prompt_reply({"request_id": "connect", "type": "OK", "reply": "second"})

    next_factor_ready.assert_called_once_with()
    assert module_session._prompt_reply == "second"


def test_access_denied_prompts_for_and_caches_the_corrected_password():
    module_session = DbModuleSession.__new__(DbModuleSession)
    module_session._connection_options = {}
    module_session._connection_passwords = {}
    module_session._password_prompt_factors = [0]
    module_session._db_service_session = None
    module_session._current_request_id = "request-1"
    module_session._web_session = Mock()
    replies = iter(["incorrect", "correct"])

    def respond_to_prompt(_request_id, _options, callback):
        module_session._prompt_replied = True
        module_session._prompt_reply = next(replies)
        callback()

    module_session.send_prompt_response = respond_to_prompt

    db_session = DbMysqlSession.__new__(DbMysqlSession)
    db_session._connection_options = {"scheme": "mysql", "password": None}
    db_session._on_connect = lambda: None
    db_session._on_failed_connection = lambda: None
    db_session._prompt_cb = module_session.on_shell_prompt
    db_session._passwords_rejected_cb = module_session._reset_password_prompt_factors
    db_session._data = {}
    db_session._shell = _RetryingPromptShell(db_session)
    module_session._db_service_session = Mock(
        connection_options=db_session._connection_options,
    )

    with patch(
        "gui_plugin.core.dbms.DbMySQLSession.mysqlsh.DBError",
        _AccessDeniedError,
    ):
        assert db_session._do_connect() is True

    assert module_session._connection_options["password"] == "correct"
    assert module_session._connection_passwords == {0: "correct"}


def test_plugin_password_prompt_does_not_consume_account_factor():
    module_session = _password_cache_module_session()
    module_session._password_prompt_factors = [1]
    module_session._db_service_session = Mock(connection_options={})
    replies = iter(["device-pin", "pam-password"])

    def respond_to_prompt(_request_id, _options, callback):
        module_session._prompt_replied = True
        module_session._prompt_reply = next(replies)
        callback()

    module_session.send_prompt_response = respond_to_prompt

    assert module_session.on_shell_prompt(
        "Enter PIN",
        {"type": "password"},
        {"auth": "authentication_webauthn"},
    ) == (True, "device-pin")
    assert module_session._password_prompt_factors == [1]

    assert module_session.on_shell_prompt(
        "Please provide the password2 for 'user@localhost': ",
        {"type": "password"},
        {},
    ) == (True, "pam-password")
    assert module_session._connection_options == {"password2": "pam-password"}


@pytest.mark.parametrize(
    "factors,replies,expected_service_options,expected_user_options",
    [
        (
            ["authentication_webauthn"],
            [],
            {"no-password": True},
            {"no-password": True},
        ),
        (
            ["password"],
            ["first-secret"],
            {"password": None},
            {"password": "first-secret"},
        ),
        (
            ["authentication_ldap_sasl"],
            ["ldap-secret"],
            {"password": None},
            {"password": "ldap-secret"},
        ),
        (
            ["password", "authentication_ldap_sasl"],
            ["first-secret", "ldap-secret"],
            {"password": None, "password2": None},
            {"password": "first-secret", "password2": "ldap-secret"},
        ),
        (
            ["password", "authentication_pam"],
            ["first-secret", "second-secret"],
            {"password": None, "password2": None},
            {"password": "first-secret", "password2": "second-secret"},
        ),
        (
            ["authentication_webauthn", "authentication_pam"],
            ["second-secret"],
            {"no-password": True, "password2": None},
            {"no-password": True, "password2": "second-secret"},
        ),
    ],
)
def test_mocked_mysql_connection_prompts_for_declared_password_factors(
    factors, replies, expected_service_options, expected_user_options,
):
    module_session = _password_cache_module_session()
    service_options = {}
    authentication_hints = {"factors": factors}

    module_session._configure_authentication_passwords(service_options, authentication_hints)
    assert service_options == expected_service_options
    module_session._connection_options = service_options

    db_session = _open_mocked_mysql_connection(
        module_session,
        service_options,
        replies,
    )
    assert db_session._shell.open_options == expected_service_options
    assert db_session.connection_options == expected_user_options

    user_options = {}
    module_session._configure_authentication_passwords(user_options, authentication_hints)
    assert user_options == expected_user_options


@pytest.mark.parametrize(
    "factors,expected_options",
    [
        (["authentication_webauthn"], {"no-password": True}),
        (["auth_socket"], {"no-password": True}),
        (["authentication_ldap_sasl"], {"password": "provided-secret"}),
        (
            ["authentication_webauthn", "authentication_ldap_sasl"],
            {"no-password": True, "password2": "provided-secret"},
        ),
        (
            ["authentication_webauthn", "authentication_pam"],
            {"no-password": True, "password2": "provided-secret"},
        ),
        (["authentication_pam", "authentication_webauthn"], {"password": "provided-secret"}),
    ],
)
def test_supplied_password_is_assigned_to_the_first_password_factor(factors, expected_options):
    module_session = _password_cache_module_session()
    options = {}

    module_session._configure_authentication_passwords(
        options,
        {"factors": factors},
        "provided-secret",
    )

    assert options == expected_options


@pytest.mark.parametrize("plugin", [
    "auth_socket", "authentication_oci", "authentication_kerberos", "authentication_windows",
])
def test_non_password_first_factor_keeps_later_password_prompt(plugin):
    module_session = _password_cache_module_session()
    options = {}
    module_session._configure_authentication_passwords(
        options, {"factors": [plugin, "authentication_pam"]},
    )
    assert options == {"no-password": True, "password2": None}
    assert module_session._password_prompt_factors == [1]


@pytest.mark.parametrize("factor", [1, 2])
def test_password_prompt_identifies_factor_after_stored_credentials(factor):
    module_session = _password_cache_module_session()
    module_session._configure_authentication_passwords(
        module_session._connection_options,
        {"factors": ["password", "authentication_pam", "authentication_ldap_simple"]},
    )
    module_session._db_service_session = Mock(connection_options={})

    def respond(_request_id, _options, callback):
        module_session._prompt_replied = True
        module_session._prompt_reply = "factor-secret"
        callback()

    module_session.send_prompt_response = respond
    module_session.on_shell_prompt(
        f"Please provide the password{factor + 1} for 'user@localhost': ",
        {"type": "password"}, {},
    )
    assert module_session._connection_passwords == {factor: "factor-secret"}
    assert module_session._db_service_session.connection_options == {
        f"password{factor + 1}": "factor-secret",
    }
    assert module_session._password_prompt_factors == [index for index in range(3) if index != factor]


def test_webauthn_registration_prompts_for_the_initial_password():
    module_session = _password_cache_module_session()
    options = {"register-factor": "2"}

    module_session._configure_authentication_passwords(
        options,
        {"factors": ["authentication_webauthn"]},
    )
    assert options == {"register-factor": "2", "password": None}
    module_session._connection_options = options

    db_session = _open_mocked_mysql_connection(
        module_session,
        options,
        ["initial-secret"],
    )
    assert db_session.connection_options == {
        "register-factor": "2",
        "password": "initial-secret",
    }


def test_open_connection_uses_backend_authentication_hints():
    module_session = _password_cache_module_session()
    captured_options = []
    module_session.close_connection = lambda: None
    module_session.connect = lambda: captured_options.append(
        module_session._connection_options.copy()
    )

    method_globals = DbModuleSession.open_connection.__globals__
    original_ctx = method_globals["ctx"]
    original_get_context = method_globals["get_context"]
    original_sleep = method_globals["sleep"]
    method_globals["ctx"] = type(
        "Context", (), {"set_completion_event": staticmethod(lambda: object())}
    )
    method_globals["get_context"] = lambda: None
    method_globals["sleep"] = lambda _seconds: None
    try:
        module_session.open_connection(
            {
                "db_type": "MySQL",
                "options": {},
                "settings": {
                    "authentication_hints": {
                        "factors": ["password", "authentication_pam"],
                    },
                },
            },
            None,
        )
    finally:
        method_globals["ctx"] = original_ctx
        method_globals["get_context"] = original_get_context
        method_globals["sleep"] = original_sleep

    assert captured_options == [
        {
            "authentication_hints": {
                "factors": ["password", "authentication_pam"],
            },
            "password": None,
            "password2": None,
        },
    ]


def test_reconnected_user_session_uses_cached_authentication_passwords():
    module_session = _sql_editor_module_session()
    module_session._db_user_session = Mock()
    module_session._connection_options = {
        "password": "first-secret",
        "password2": "second-secret",
    }

    module_session.on_connected(Mock())

    module_session._db_user_session.reconnect.assert_called_once_with({
        "password": "first-secret",
        "password2": "second-secret",
    })


def test_sqlite_user_session_accepts_password_callback():
    module_session = _sql_editor_module_session()
    module_session._db_type = "Sqlite"
    module_session._connection_options = {"db_file": "test.sqlite3"}

    with patch(
        "gui_plugin.sql_editor.SqlEditorModuleSession.DbSessionFactory.create"
    ) as create:
        module_session.on_connected(Mock())

    assert (
        create.call_args.kwargs["passwords_rejected_cb"]
        == module_session._reset_password_prompt_factors
    )


def test_failed_user_connection_does_not_wait_for_its_own_thread():
    module_session = _sql_editor_module_session()
    user_session = Mock()
    module_session._db_user_session = user_session

    with patch.object(DbModuleSession, "close_connection"):
        module_session.close_connection(after_fail=True)

    user_session.close.assert_called_once_with(True)
    user_session.lock.assert_not_called()


def test_close_connection_queues_service_session_close_without_locking():
    module_session = _password_cache_module_session()
    service_session = Mock()
    module_session._db_service_session = service_session

    module_session.close_connection()

    service_session.close.assert_called_once_with(False)
    service_session.lock.assert_not_called()


def test_close_connection_handles_a_partially_initialized_module_session():
    module_session = SqlEditorModuleSession.__new__(SqlEditorModuleSession)
    module_session._web_session = Mock()

    module_session.close_connection()


@pytest.fixture(scope="module")
def params():
    parameters = Parameters()
    parameters._connection_id = None
    parameters._web_session = MockWebSession()
    user_id = UserManagement.create_user(
        f"sqleditor_{uuid.uuid4().hex}", "unused", role="User",
        be_session=parameters._web_session.db,
    )
    profile_id = UserManagement.add_profile(
        user_id,
        {
            "name": "SQL editor test profile",
            "description": "",
            "options": {},
        },
        be_session=parameters._web_session.db,
    )
    parameters._web_session.user_id = user_id
    parameters._web_session.session_user_id = user_id
    parameters._web_session.session_active_profile_id = profile_id

    @backend_callback(1)
    def open_connection_cb(msg_type, msg, request_id, values):
        if (
            values["request_state"]["type"] != "PENDING"
            or values["request_state"]["msg"] != "Connection was successfully opened."
        ):
            raise Exception("Failed opening connection.")
        parameters._open_connection_info = values["result"]["info"]

    parameters._web_session.register_callback(
        open_connection_cb.request_id, open_connection_cb
    )

    _thread = threading.current_thread()

    _context = MockContext()
    setattr(_context, "web_handler", parameters._web_session)
    setattr(_context, "request_id", None)
    setattr(_thread, "get_context", lambda: _context)

    result = sql_editor.start_session()
    parameters._module_session_id = result["module_session_id"]
    parameters._module_session = parameters._web_session.module_sessions[
        parameters._module_session_id
    ]
    connection_options = (
        config.Config.get_instance().database_connections[0]["options"].copy()
    )
    del connection_options["portStr"]

    user_id = UserManagement.create_user(
        f"sqleditor_profile_{uuid.uuid4()}", "password", role="User"
    )
    profile_id = UserManagement.add_profile(user_id, {
        "name": "SQL editor test profile",
        "description": "Owns the SQL editor test connection.",
        "options": {},
    })
    result = db_connections.add_db_connection(
        profile_id,
        {
            "db_type": "MySQL",
            "caption": "This is a test MySQL database",
            "description": "This is a test MySQL database description",
            "options": connection_options,
        },
        "",
        parameters._web_session.db,
    )

    parameters._web_session.session_active_profile_id = profile_id
    parameters._web_session.session_user_id = user_id
    parameters._web_session.request_id = open_connection_cb.request_id
    parameters._db_connection_id = result[0]
    sql_editor.open_connection(parameters._db_connection_id, parameters._module_session)

    open_connection_cb.join_and_validate()

    parameters._web_session.request_id = None

    yield parameters

    db_connections.remove_db_connection(profile_id, parameters._db_connection_id)
    parameters._web_session.db.close()
    result = sql_editor.close_session(parameters._module_session)
    # del parameters._web_session.module_sessions[parameters._module_session_id]


class Test_sql_editor:

    @pytest.mark.parametrize("options", [[], "keywordCase=upper", 1])
    def test_reformat_rejects_non_dictionary_options(
        self, options: object
    ) -> None:
        with pytest.raises(ValueError, match="options must be a dictionary"):
            sql_editor_module.reformat("select 1", options)

    def test_reformat_passes_camel_case_options_unchanged(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        received_options: dict[str, object] | None = None

        def fake_reformat_sql(sql: str, **options: object) -> str:
            nonlocal received_options
            received_options = options
            return sql

        monkeypatch.setattr(
            sql_editor_module,
            "_import_reformat_sql",
            lambda: fake_reformat_sql,
        )

        assert sql_editor_module.reformat(
            "select 1",
            {
                "indentWidth": 2,
                "keywordCase": "lower",
            },
        ) == "select 1"
        assert received_options == {
            "indentWidth": 2,
            "keywordCase": "lower",
        }

    def test_open_connection_returns_cached_connection_ids(self, params):
        assert isinstance(params._open_connection_info["connection_id"], int)
        assert isinstance(params._open_connection_info["service_connection_id"], int)
        assert (
            params._open_connection_info["connection_id"]
            != params._open_connection_info["service_connection_id"]
        )

        cache = InternalData.get_server_status_cache(params._db_connection_id)
        assert cache is not None
        assert cache["sysvars"]
        assert params._module_session.get_bound_connection_id() == params._db_connection_id

    def test_bound_connection_rejects_a_profile_switch(self, params):
        original_profile_id = params._web_session.session_active_profile_id
        params._web_session.session_active_profile_id = original_profile_id + 1
        try:
            with pytest.raises(MSGException) as exc_info:
                params._module_session.get_bound_connection_id()
        finally:
            params._web_session.session_active_profile_id = original_profile_id

        assert exc_info.value.code == Error.CORE_PERMISSION_DENIED

    def test_bound_connection_rejects_a_user_switch(self, params):
        original_user_id = params._web_session.session_user_id
        params._web_session.session_user_id = original_user_id + 1
        try:
            with pytest.raises(MSGException) as exc_info:
                params._module_session.get_bound_connection_id()
        finally:
            params._web_session.session_user_id = original_user_id

        assert exc_info.value.code == Error.CORE_PERMISSION_DENIED

    def test_start_offline_session_binds_the_active_profile_connection(self, params, monkeypatch):
        result = Metadata.start_offline_session(params._db_connection_id)
        offline_session = params._web_session.module_sessions[
            result["module_session_id"]
        ]
        status = object()
        monkeypatch.setattr(Meb, "get_backup_home_status", lambda _path: status)

        try:
            assert offline_session.get_offline_connection_id() == params._db_connection_id
            assert offline_session._db_service_session is None
            assert Meb.get_status(
                module_session=offline_session,
                backup_home_path="/backups",
            ) is status
        finally:
            offline_session.close()

    def test_should_ignore_history_entry_honors_sql_ignore_pattern(self):
        original_pattern = mysqlsh.globals.shell.options["history.sql.ignorePattern"]

        try:
            mysqlsh.globals.shell.options["history.sql.ignorePattern"] = (
                "*SECRET*:*PASSWORD*"
            )

            assert sql_editor_module._should_ignore_history_entry("select 'secret';")
            assert sql_editor_module._should_ignore_history_entry(
                "set password = 'secret';"
            )

            mysqlsh.globals.shell.options["history.sql.ignorePattern"] = ""

            assert not sql_editor_module._should_ignore_history_entry(
                "select 'secret';"
            )
        finally:
            mysqlsh.globals.shell.options["history.sql.ignorePattern"] = (
                original_pattern
            )

    def test_add_execution_history_entry_ignores_uppercase_sql_language_id(self):
        original_pattern = mysqlsh.globals.shell.options["history.sql.ignorePattern"]

        try:
            mysqlsh.globals.shell.options["history.sql.ignorePattern"] = "*SECRET*"

            assert (
                sql_editor.add_execution_history_entry(1, "select 'secret';", "SQL")
                == 0
            )
        finally:
            mysqlsh.globals.shell.options["history.sql.ignorePattern"] = (
                original_pattern
            )

    @pytest.mark.parametrize(
        "pattern, code, matches",
        [
            ("*ble*", "select 'aaBLEaa';", True),
            ("*bla*", "select 'bgi';", False),
            ("?", "a", True),
            ("?", "aa", False),
            ("?*", "aa", True),
            ("a?b?c*", "axbxcdddeefg;", True),
            ("a?b?c*", "abxc;", False),
            (r"\*", "*", True),
            (r"\?", "?", True),
        ],
    )
    def test_history_ignore_glob_matches_shell_semantics(self, pattern, code, matches):
        assert sql_editor_module._match_history_glob(pattern, code) == matches

    def test_service_connection(self, params):
        @backend_callback_with_pending()
        def callback_request1(msg_type, msg, request_id, values):
            logger.debug("callback_request1")

        @backend_callback_with_pending()
        def callback_schemas(msg_type, msg, request_id, values):
            logger.debug("callback_schemas")

        params._web_session.register_callback(
            callback_request1.request_id, callback_request1
        )
        params._web_session.register_callback(
            callback_schemas.request_id, callback_schemas
        )

        params._web_session.request_id = callback_schemas.request_id
        sql_editor.execute(
            sql="SELECT SLEEP(3)", session=params._module_session._db_user_session
        )
        callback_schemas.join_and_validate()
        params._web_session.request_id = callback_request1.request_id
        sql_editor.get_current_schema(session=params._module_session._db_user_session)
        callback_request1.join_and_validate()

        params._web_session.request_id = None

    def test_close_session(self, params):
        request_id1 = str(uuid.uuid1())
        sql_editor.close_session(params._module_session)

        with pytest.raises(MSGException) as e:
            sql_editor.execute(
                session=params._module_session._db_user_session, sql="SELECT SLEEP(1)"
            )
        assert (
            e.value.args[0] == "Error[MSG-1012]: Session required for this operation."
        )

        @backend_callback(1)
        def open_connection_cb(msg_type, msg, request_id, values):
            if (
                values["request_state"]["type"] != "PENDING"
                or values["request_state"]["msg"]
                != "Connection was successfully opened."
            ):
                raise Exception("Failed opening connection.")

        params._web_session.register_callback(
            open_connection_cb.request_id, open_connection_cb
        )

        params._web_session.request_id = open_connection_cb.request_id
        sql_editor.open_connection(params._db_connection_id, params._module_session)

        open_connection_cb.join_and_validate()
        params._web_session.request_id = None

    def test_execute_query_with_params(self, params):
        @backend_callback_with_pending()
        def callback_execute(msg_type, msg, request_id=None, values=None):
            assert "columns" in values
            assert "rows" in values

        params._web_session.register_callback(
            callback_execute.request_id, callback_execute
        )

        params._web_session.request_id = callback_execute.request_id
        result = sql_editor.execute(
            session=params._module_session._db_user_session,
            sql="SHOW DATABASES LIKE ?",
            params=["mysql"],
        )

        callback_execute.join_and_validate()
        params._web_session.request_id = None


@pytest.mark.parametrize("target", [None, "app", "other"])
@pytest.mark.parametrize("retain", [False, True])
@pytest.mark.parametrize("expired", [False, True])
@pytest.mark.parametrize("rejected", [False, True])
def test_password_reset_executes_on_service_session(target, retain, rejected, expired):
    module = SqlEditorModuleSession.__new__(SqlEditorModuleSession)
    module._web_session = Mock()
    service = Mock(database_type="MySQL", connection_options={
        "password": "old", "ssl-mode": "REQUIRED", "extra-options": {"password": "old"},
    })
    module._db_service_session = service

    if rejected:
        service.execute_thread.side_effect = ValueError("Password rejected")
        with pytest.raises(ValueError, match="Password rejected"):
            module.reset_password("new", "", retain, expired, target, "localhost" if target else None)
    else:
        module.reset_password("new", "", retain, expired, target, "localhost" if target else None)
    service.release.assert_called_once()
    sql = "ALTER USER USER()" if target is None else "ALTER USER ?@?"
    sql += " IDENTIFIED BY /*((*/ ? /*))*/"
    sql += " /*((*/ /*!80013 REPLACE ? */ /*))*/" if expired else " REPLACE /*((*/ ? /*))*/"
    if retain:
        sql += " RETAIN CURRENT PASSWORD"
    params = [] if target is None else [target, "localhost"]
    service.execute_thread.assert_called_with(sql, params + ["new", ""])
    if not expired:
        service.activate_all_roles.assert_called_once_with()
        assert service.mock_calls[:2] == [call.lock(), call.activate_all_roles()]
