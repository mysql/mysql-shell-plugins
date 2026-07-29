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
# the GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

import threading
import urllib.error
from email.message import Message
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from types import SimpleNamespace

import pytest

from mrs_plugin.tests import conftest as test_fixtures
from mrs_plugin.tests.e2e.component import harness


class _RedirectHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/redirect":
            self.send_response(302)
            self.send_header("Location", "/target")
            self.end_headers()
        elif self.path == "/target":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"target")
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, _format, *_args):
        pass


@pytest.fixture
def redirect_server():
    server = ThreadingHTTPServer(("127.0.0.1", 0), _RedirectHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        thread.join()
        server.server_close()


def _response(status, body=b""):
    return harness.HttpResponse(status=status, headers=Message(), body=body)


def _component_harness():
    service = {
        "id": b"service-id",
        "host_ctx": "/test",
        "published": True,
    }
    return harness.MrsComponentTestHarness(object(), service, port=8443)


def test_http_client_does_not_follow_redirects_by_default(redirect_server):
    response = harness.MrsHttpClient(redirect_server).get("/redirect")

    assert response.status == 302
    assert response.headers["Location"] == "/target"


def test_http_client_can_follow_redirects_explicitly(redirect_server):
    response = harness.MrsHttpClient(
        redirect_server,
        follow_redirects=True,
    ).get("/redirect")

    assert response.status == 200
    assert response.body == b"target"


def test_request_json_encodes_body_and_headers(monkeypatch):
    client = harness.MrsHttpClient("https://127.0.0.1:8443")
    requests = []

    def request(*args, **kwargs):
        requests.append((args, kwargs))
        return _response(200)

    monkeypatch.setattr(client, "_request", request)

    response = client.request_json(
        "POST",
        "/test",
        {"value": 1},
        headers={"X-Test": "yes"},
    )

    assert response.status == 200
    assert requests == [
        (
            (
                "POST",
                "/test",
                b'{"value": 1}',
                {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "X-Test": "yes",
                },
            ),
            {"log_exchange": True},
        )
    ]


def test_login_sets_bearer_authorization(monkeypatch):
    client = harness.MrsHttpClient("https://127.0.0.1:8443")
    requests = []

    def request_json(method, path, value, headers=None):
        requests.append((method, path, value, headers))
        return _response(200, b'{"accessToken":"test-token"}')

    monkeypatch.setattr(client, "request_json", request_json)

    response = client.login(
        "/test/authentication/login",
        "user",
        "password",
        session_type="bearer",
        auth_app="MySQL",
    )

    assert response.status == 200
    assert requests == [
        (
            "POST",
            "/test/authentication/login",
            {
                "sessionType": "bearer",
                "username": "user",
                "password": "password",
                "authApp": "MySQL",
            },
            None,
        )
    ]
    assert client._default_headers == {
        "Authorization": "Bearer test-token"
    }


def test_login_does_not_create_bearer_session_on_failure(monkeypatch):
    client = harness.MrsHttpClient("https://127.0.0.1:8443")
    monkeypatch.setattr(
        client,
        "request_json",
        lambda *_args, **_kwargs: _response(401),
    )

    response = client.login(
        "/test/authentication/login",
        "user",
        "wrong-password",
        session_type="bearer",
    )

    assert response.status == 401
    assert client._default_headers == {}


def test_login_rejects_bearer_response_without_token(monkeypatch):
    client = harness.MrsHttpClient("https://127.0.0.1:8443")
    monkeypatch.setattr(
        client,
        "request_json",
        lambda *_args, **_kwargs: _response(200, b"{}"),
    )

    with pytest.raises(AssertionError, match="without an access token"):
        client.login(
            "/test/authentication/login",
            "user",
            "password",
            session_type="bearer",
        )


def test_login_rejects_unknown_session_type():
    client = harness.MrsHttpClient("https://127.0.0.1:8443")

    with pytest.raises(ValueError, match="session_type"):
        client.login(
            "/test/authentication/login",
            "user",
            "password",
            session_type="unknown",
        )


def test_wait_for_status_retries_not_found(monkeypatch):
    client = harness.MrsHttpClient("https://127.0.0.1:8443")
    responses = iter([_response(404), _response(200)])
    attempts = []

    def request(*args, **kwargs):
        attempts.append((args, kwargs))
        return next(responses)

    monkeypatch.setattr(client, "_request", request)
    monkeypatch.setattr(harness.time, "sleep", lambda _seconds: None)

    response = client.wait_for_status("/test", 200)

    assert response.status == 200
    assert len(attempts) == 2
    assert [args[0] for args, _kwargs in attempts] == ["GET", "GET"]


def test_wait_for_status_rejects_unexpected_server_error(monkeypatch):
    client = harness.MrsHttpClient("https://127.0.0.1:8443")
    monkeypatch.setattr(
        client,
        "_request",
        lambda *args, **kwargs: _response(500, b"unexpected"),
    )

    with pytest.raises(AssertionError, match="unexpected HTTP 500"):
        client.wait_for_status("/test", 200)


def test_wait_for_status_does_not_retry_transport_errors(monkeypatch):
    client = harness.MrsHttpClient("https://127.0.0.1:8443")
    attempts = 0

    def request(*_args, **_kwargs):
        nonlocal attempts
        attempts += 1
        raise urllib.error.URLError("listener unavailable")

    monkeypatch.setattr(client, "_request", request)

    with pytest.raises(urllib.error.URLError, match="listener unavailable"):
        client.wait_for_status("/test", 200)

    assert attempts == 1


def test_wait_for_state_returns_matching_state_and_port(monkeypatch):
    component = _component_harness()
    statuses = iter(
        [
            harness.ComponentStatus(state="STARTING", http_port=None),
            harness.ComponentStatus(state="READY", http_port=8443),
        ]
    )
    monkeypatch.setattr(component, "status", lambda: next(statuses))
    monkeypatch.setattr(harness.time, "sleep", lambda _seconds: None)

    status = component.wait_for_state("READY", http_port=8443)

    assert status == harness.ComponentStatus(state="READY", http_port=8443)


def test_wait_for_state_waits_for_matching_port(monkeypatch):
    component = _component_harness()
    statuses = iter(
        [
            harness.ComponentStatus(state="READY", http_port=8444),
            harness.ComponentStatus(state="READY", http_port=8443),
        ]
    )
    monkeypatch.setattr(component, "status", lambda: next(statuses))
    monkeypatch.setattr(harness.time, "sleep", lambda _seconds: None)

    status = component.wait_for_state("READY", http_port=8443)

    assert status.http_port == 8443


def test_wait_for_state_rejects_error_state(monkeypatch):
    component = _component_harness()
    monkeypatch.setattr(
        component,
        "status",
        lambda: harness.ComponentStatus(state="ERROR", http_port=None),
    )

    with pytest.raises(
        AssertionError,
        match="entered ERROR while waiting for READY",
    ):
        component.wait_for_state("READY")


def test_wait_for_state_timeout_reports_last_status(monkeypatch):
    component = _component_harness()
    last_status = harness.ComponentStatus(state="STARTING", http_port=None)
    monotonic_times = iter([10.0, 11.0])
    monkeypatch.setattr(component, "status", lambda: last_status)
    monkeypatch.setattr(harness.time, "monotonic", lambda: next(monotonic_times))

    with pytest.raises(AssertionError) as error:
        component.wait_for_state("READY", timeout=1)

    assert "did not reach READY within 1 seconds" in str(error.value)
    assert f"last status was {last_status}" in str(error.value)


def test_wait_for_error_log_returns_new_matching_entry(monkeypatch):
    class Result:
        def __init__(self, row):
            self._row = row

        def fetch_one(self):
            return self._row

    class Session:
        def __init__(self):
            self.counts = iter(["1", "2"])

        def run_sql(self, statement, parameters):
            assert parameters == ["unique diagnostic"]
            if "COUNT(*)" in statement:
                return Result((next(self.counts),))
            return Result(("new unique diagnostic",))

    component = harness.MrsComponentTestHarness(
        Session(),
        {
            "id": b"service-id",
            "host_ctx": "/test",
            "published": True,
        },
        port=8443,
    )
    monkeypatch.setattr(harness.time, "sleep", lambda _seconds: None)

    message = component.wait_for_error_log(
        "unique diagnostic",
        previous_count=1,
    )

    assert message == "new unique diagnostic"


def test_wait_for_error_log_timeout_reports_matching_count(monkeypatch):
    component = _component_harness()
    monotonic_times = iter([10.0, 11.0])
    monkeypatch.setattr(component, "error_log_count", lambda _text: 2)
    monkeypatch.setattr(harness.time, "monotonic", lambda: next(monotonic_times))

    with pytest.raises(AssertionError) as error:
        component.wait_for_error_log(
            "missing diagnostic",
            previous_count=2,
            timeout=1,
        )

    assert "did not receive a new entry" in str(error.value)
    assert "matching entry count remained 2" in str(error.value)


def test_cleanup_callbacks_run_in_reverse_order_before_uninstall(monkeypatch):
    service = {
        "id": b"service-id",
        "host_ctx": "/test",
        "published": True,
    }
    component = harness.MrsComponentTestHarness(object(), service, port=8443)
    events = []

    monkeypatch.setattr(component, "is_installed", lambda: True)
    monkeypatch.setattr(component, "uninstall", lambda: events.append("uninstall"))

    component.add_cleanup(events.append, "first")
    component.add_cleanup(events.append, "second")
    component.cleanup()

    assert events == ["second", "first", "uninstall"]


def test_persist_http_port_is_reset_before_uninstall(monkeypatch):
    service = {
        "id": b"service-id",
        "host_ctx": "/test",
        "published": True,
    }
    statements = []

    class Session:
        def run_sql(self, statement):
            statements.append(statement)

    component = harness.MrsComponentTestHarness(
        Session(),
        service,
        port=8443,
    )
    events = []

    monkeypatch.setattr(component, "is_installed", lambda: True)
    monkeypatch.setattr(component, "uninstall", lambda: events.append("uninstall"))

    component.persist_http_port(9443)
    component.cleanup()

    assert component.port == 9443
    assert statements == [
        "SET PERSIST mysql_rest_service.http_port = 9443",
        "RESET PERSIST mysql_rest_service.http_port",
    ]
    assert events == ["uninstall"]


def test_restart_server_adopts_reconnected_session_on_failure(monkeypatch):
    service = {
        "id": b"service-id",
        "host_ctx": "/test",
        "published": True,
    }
    old_statements = []
    new_statements = []

    class Session:
        def __init__(self, statements):
            self._statements = statements

        def run_sql(self, statement):
            self._statements.append(statement)

    old_session = Session(old_statements)
    new_session = Session(new_statements)

    class TestServer:
        session = old_session

        def restart(self):
            self.session = new_session
            raise RuntimeError("reconnect setup failed")

    component = harness.MrsComponentTestHarness(
        old_session,
        service,
        port=8443,
        test_server=TestServer(),
    )
    monkeypatch.setattr(component, "is_installed", lambda: False)

    component.persist_http_port(9443)
    with pytest.raises(RuntimeError, match="reconnect setup failed"):
        component.restart_server()
    component.cleanup()

    assert old_statements == ["SET PERSIST mysql_rest_service.http_port = 9443"]
    assert new_statements == ["RESET PERSIST mysql_rest_service.http_port"]


@pytest.mark.parametrize(
    ("failure_stage", "expected_error"),
    [
        ("start", "sandbox start failed"),
        ("connect", "sandbox reconnect failed"),
    ],
)
def test_restart_server_preserves_failure_without_reconnected_session(
    monkeypatch,
    failure_stage,
    expected_error,
):
    statements = []

    class Result:
        def fetch_one(self):
            return ("", "PhoneBook")

    class Session:
        def run_sql(self, statement):
            statements.append(statement)
            return Result()

    def start_sandbox(*_args):
        if failure_stage == "start":
            raise RuntimeError("sandbox start failed")

    old_session = Session()
    phone_book = {"session": old_session}
    dba = SimpleNamespace(
        stop_sandbox_instance=lambda *_args: None,
        start_sandbox_instance=start_sandbox,
    )
    monkeypatch.setattr(
        test_fixtures,
        "mysqlsh",
        SimpleNamespace(globals=SimpleNamespace(dba=dba)),
    )
    monkeypatch.setattr(
        test_fixtures,
        "PHONE_BOOKS",
        {"PhoneBook": phone_book},
    )

    def create_session():
        raise RuntimeError("sandbox reconnect failed")

    monkeypatch.setattr(
        test_fixtures.helpers,
        "create_shell_session",
        create_session,
    )

    server = test_fixtures._MysqlTestServer(
        {"port": 3388, "password": ""},
        SimpleNamespace(name="/tmp/component-test-sandbox"),
        old_session,
        lambda _message: None,
    )
    component = harness.MrsComponentTestHarness(
        old_session,
        {
            "id": b"service-id",
            "host_ctx": "/test",
            "published": True,
        },
        port=8443,
        test_server=server,
    )

    component.persist_http_port(9443)
    with pytest.raises(RuntimeError, match=expected_error):
        component.restart_server()

    component.cleanup()

    assert server.session is None
    assert phone_book["session"] is None
    assert statements == [
        "SET PERSIST mysql_rest_service.http_port = 9443",
        "SELECT @@SESSION.sql_mode, DATABASE()",
    ]


def test_cleanup_restores_publication_when_uninstall_fails(monkeypatch):
    service = {
        "id": b"service-id",
        "host_ctx": "/test",
        "published": False,
    }
    session = object()
    component = harness.MrsComponentTestHarness(session, service, port=8443)
    publication_updates = []

    def update_services(session, service_ids, values):
        publication_updates.append((session, service_ids, values))

    def fail_uninstall():
        raise RuntimeError("uninstall failed")

    monkeypatch.setattr(harness.lib.services, "update_services", update_services)
    monkeypatch.setattr(component, "is_installed", lambda: True)
    monkeypatch.setattr(component, "uninstall", fail_uninstall)

    component.publish_service()
    with pytest.raises(RuntimeError, match="uninstall failed"):
        component.cleanup()

    assert publication_updates == [
        (session, [service["id"]], {"published": True}),
        (session, [service["id"]], {"published": False}),
    ]
