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

import pytest

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
