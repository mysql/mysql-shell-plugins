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

import http.cookiejar
import json
import socket
import ssl
import time
import urllib.error
import urllib.request
from contextlib import ExitStack
from dataclasses import dataclass
from email.message import Message
from typing import Any

from mrs_plugin import lib


COMPONENT_URN = "file://component_mysql_rest_service"
DEFAULT_WAIT_TIMEOUT = 30
DEFAULT_HTTP_TIMEOUT = 10
POLL_INTERVAL = 0.1


def log(message):
    print(f"[component-e2e] {message}", flush=True)


def _get_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


@dataclass(frozen=True)
class ComponentStatus:
    state: str | None
    http_port: int | None


@dataclass(frozen=True)
class HttpResponse:
    status: int
    headers: Message
    body: bytes

    @property
    def text(self):
        return self.body.decode("utf-8", errors="replace")

    def json(self) -> Any:
        return json.loads(self.body)


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(
        self,
        request,
        response,
        code,
        message,
        headers,
        new_url,
    ):
        return None


class MrsHttpClient:
    """Minimal HTTP client which preserves responses for negative tests."""

    def __init__(
        self,
        base_url,
        timeout=DEFAULT_HTTP_TIMEOUT,
        ssl_context=None,
        follow_redirects=False,
    ):
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

        if ssl_context is None:
            # Sandboxes use a generated, self-signed TLS certificate.
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE

        self.cookies = http.cookiejar.CookieJar()
        handlers = [
            urllib.request.HTTPSHandler(context=ssl_context),
            urllib.request.HTTPCookieProcessor(self.cookies),
        ]
        if not follow_redirects:
            handlers.append(_NoRedirectHandler())

        self._opener = urllib.request.build_opener(*handlers)

    def get(self, path, headers=None):
        return self.request("GET", path, headers=headers)

    def request(self, method, path, body=None, headers=None):
        return self._request(method, path, body, headers, log_exchange=True)

    def wait_for_status(
        self,
        path,
        expected_status,
        headers=None,
        timeout=DEFAULT_WAIT_TIMEOUT,
        retry_statuses=(404,),
    ):
        """Poll a GET request through selected transient HTTP statuses."""
        url = self._url(path)
        log(f"Waiting for GET {url} to return HTTP {expected_status}")
        deadline = time.monotonic() + timeout
        attempts = 0

        while True:
            attempts += 1
            response = self._request(
                "GET",
                path,
                None,
                headers,
                log_exchange=False,
            )
            if response.status == expected_status:
                log(
                    f"GET {url} returned HTTP {response.status} "
                    f"after {attempts} attempt(s)"
                )
                return response
            if response.status not in retry_statuses:
                raise AssertionError(
                    f"GET {url} returned unexpected HTTP "
                    f"{response.status}: {response.text[:1000]}"
                )

            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise AssertionError(
                    f"GET {url} did not return HTTP {expected_status} "
                    f"within {timeout} seconds; last response was HTTP "
                    f"{response.status}: {response.text[:1000]}"
                )

            time.sleep(min(POLL_INTERVAL, remaining))

    def _request(self, method, path, body, headers, log_exchange):
        url = self._url(path)
        request = urllib.request.Request(
            url,
            data=body,
            headers=headers or {},
            method=method,
        )

        if log_exchange:
            log(f"{method} {url}")

        try:
            with self._opener.open(
                request,
                timeout=self._timeout,
            ) as response:
                result = self._read_response(response)
        except urllib.error.HTTPError as error:
            try:
                result = self._read_response(error)
            finally:
                error.close()

        if log_exchange:
            log(f"Received HTTP {result.status}")
        return result

    def _url(self, path):
        if not path.startswith("/"):
            raise ValueError("HTTP request paths must start with '/'")

        return self._base_url + path

    @staticmethod
    def _read_response(response):
        return HttpResponse(
            status=response.getcode(),
            headers=response.headers,
            body=response.read(),
        )


class MrsComponentTestHarness:
    """Test-facing control of one MRS component and one published service."""

    def __init__(self, session, service, port=None):
        self._session = session
        self._service_id = service["id"]
        self._service_path = service["host_ctx"]
        self._original_published = bool(service["published"])
        self._published = self._original_published
        self._cleanups = ExitStack()

        self.port = _get_free_port() if port is None else int(port)
        self.base_url = f"https://127.0.0.1:{self.port}"
        self.http = MrsHttpClient(self.base_url)

    def add_cleanup(self, callback, *args, **kwargs):
        """Register LIFO cleanup to run before component uninstall."""
        return self._cleanups.callback(callback, *args, **kwargs)

    def is_installed(self):
        return bool(
            self._session.run_sql(
                "SELECT COUNT(*) FROM mysql.component WHERE component_urn = ?",
                [COMPONENT_URN],
            ).fetch_one()[0]
        )

    def publish_service(self):
        self.set_service_published(True)

    def set_service_published(self, published):
        published = bool(published)
        if published == self._published:
            return

        action = "Publishing" if published else "Unpublishing"
        log(f"{action} MRS service {self._service_path}")
        lib.services.update_services(
            self._session,
            [self._service_id],
            {"published": published},
        )
        self._published = published

    def install(self):
        log(f"Installing the MRS component on HTTPS port {self.port}")
        self._session.run_sql(
            f'INSTALL COMPONENT "{COMPONENT_URN}" '
            f"SET GLOBAL mysql_rest_service.http_port = {self.port}"
        )

    def uninstall(self):
        log("Uninstalling the MRS component")
        self._session.run_sql(f'UNINSTALL COMPONENT "{COMPONENT_URN}"')

    def status(self):
        rows = self._session.run_sql(
            """
            SELECT VARIABLE_NAME, VARIABLE_VALUE
            FROM performance_schema.global_status
            WHERE VARIABLE_NAME IN (
                'mysql_rest_service.state',
                'mysql_rest_service.current_http_port'
            )
            """
        ).fetch_all()
        values = {row[0].lower(): row[1] for row in rows}
        current_port = values.get("mysql_rest_service.current_http_port")

        return ComponentStatus(
            state=values.get("mysql_rest_service.state"),
            http_port=int(current_port) if current_port is not None else None,
        )

    def wait_until_ready(self, timeout=DEFAULT_WAIT_TIMEOUT):
        log("Waiting for the MRS component to become READY")
        status = self.wait_for_state("READY", timeout=timeout, http_port=self.port)
        log(f"MRS component is READY at {self.base_url}")
        return status

    def wait_for_state(
        self,
        expected_state,
        timeout=DEFAULT_WAIT_TIMEOUT,
        http_port=None,
    ):
        deadline = time.monotonic() + timeout
        status = self.status()

        while (
            status.state != expected_state
            or (http_port is not None and status.http_port != http_port)
        ):
            if status.state == "ERROR" and expected_state != "ERROR":
                raise AssertionError(
                    f"MRS component entered ERROR while waiting for "
                    f"{expected_state}; current HTTP port is {status.http_port}"
                )

            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise AssertionError(
                    f"MRS component did not reach {expected_state} within "
                    f"{timeout} seconds; last status was {status}"
                )

            time.sleep(min(POLL_INTERVAL, remaining))
            status = self.status()

        return status

    def cleanup(self):
        try:
            self._cleanups.close()
        finally:
            try:
                if self.is_installed():
                    self.uninstall()
            finally:
                if self._published != self._original_published:
                    log(
                        f"Restoring the publication state of "
                        f"{self._service_path}"
                    )
                    lib.services.update_services(
                        self._session,
                        [self._service_id],
                        {"published": self._original_published},
                    )
                    self._published = self._original_published
