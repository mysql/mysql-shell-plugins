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

import socket
import urllib.error
from contextlib import contextmanager

import pytest


_SERVICE_PATH = "/test/authentication/authApps"
_METADATA_VERSION_VIEW = "mysql_rest_service_metadata.msm_schema_version"
_HIDDEN_METADATA_VERSION_VIEW = (
    "mysql_rest_service_metadata.msm_schema_version_component_e2e"
)


@contextmanager
def _occupied_tcp_port(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("0.0.0.0", port))
        yield


@contextmanager
def _hidden_metadata_version_view(session):
    # This view is the component's metadata-readiness contract. Renaming it
    # preserves the session-scoped metadata while exercising recovery.
    session.run_sql(
        f"RENAME TABLE {_METADATA_VERSION_VIEW} "
        f"TO {_HIDDEN_METADATA_VERSION_VIEW}"
    )
    try:
        yield
    finally:
        session.run_sql(
            f"RENAME TABLE {_HIDDEN_METADATA_VERSION_VIEW} "
            f"TO {_METADATA_VERSION_VIEW}"
        )


def _assert_classic_sql_available(phone_book):
    result = phone_book["session"].run_sql("SELECT 1").fetch_one()
    assert result[0] == 1


def _assert_listener_unavailable(component):
    with pytest.raises(urllib.error.URLError):
        component.http.get(_SERVICE_PATH)


def _assert_service_available(component):
    response = component.http.wait_for_status(_SERVICE_PATH, 200)
    assert response.status == 200, response.text


def _set_tls_certificate(phone_book, certificate):
    phone_book["session"].run_sql(
        "SET GLOBAL mysql_rest_service.ssl_cert = ?",
        [certificate],
    )


def test_component_recovers_when_metadata_becomes_available(
    mrs_component,
    phone_book,
):
    component = mrs_component
    component.publish_service()
    diagnostic = "Waiting for MySQL REST Service metadata schema."
    previous_log_count = component.error_log_count(diagnostic)

    with _hidden_metadata_version_view(phone_book["session"]):
        component.install()

        waiting = component.wait_for_state("WAITING_FOR_METADATA")
        assert waiting.http_port == 0
        assert component.is_installed()
        _assert_listener_unavailable(component)
        _assert_classic_sql_available(phone_book)

        message = component.wait_for_error_log(
            diagnostic,
            previous_count=previous_log_count,
        )
        assert message == f"MySQL Rest Service Component: {diagnostic}"

    # Metadata availability is polled every 30 seconds.
    recovered = component.wait_until_ready(timeout=60)
    assert recovered.http_port == component.port
    _assert_service_available(component)
    _assert_classic_sql_available(phone_book)


def test_component_recovers_from_port_conflict(mrs_component, phone_book):
    component = mrs_component
    component.publish_service()
    diagnostic = (
        "Backend startup failed in background thread: "
        f"bind(0.0.0.0:{component.port}) failed:"
    )
    previous_log_count = component.error_log_count(diagnostic)

    with _occupied_tcp_port(component.port):
        component.install()
        component.grant_lifecycle_admin()

        failed = component.wait_for_state("ERROR")
        assert failed.http_port == 0
        assert component.is_installed()
        _assert_listener_unavailable(component)
        _assert_classic_sql_available(phone_book)

        message = component.wait_for_error_log(
            diagnostic,
            previous_count=previous_log_count,
        )
        assert message.startswith(f"MySQL Rest Service Component: {diagnostic}")
        assert message.endswith("; MySQL REST Service remains inactive.")

    assert component.restart() == 0
    recovered = component.wait_until_ready()
    assert recovered.http_port == component.port
    _assert_service_available(component)
    _assert_classic_sql_available(phone_book)


def test_component_recovers_from_invalid_tls_configuration(
    ready_mrs_component,
    phone_book,
    tmp_path,
):
    component = ready_mrs_component
    component.grant_lifecycle_admin()
    original_certificate = phone_book["session"].run_sql(
        "SELECT @@GLOBAL.mysql_rest_service.ssl_cert"
    ).fetch_one()[0]
    component.add_cleanup(
        _set_tls_certificate,
        phone_book,
        original_certificate,
    )

    invalid_certificate = str(tmp_path / "missing-cert.pem")
    diagnostic = (
        "MySQL Rest Service Component: Backend startup failed in background "
        "thread: TLS initialization failed because the configured SSL "
        f"certificate file '{invalid_certificate}' does not exist, is not a "
        "regular file, or cannot be accessed. Configure "
        "mysql_rest_service.ssl_cert and mysql_rest_service.ssl_key, then "
        "restart the service; MySQL REST Service remains inactive."
    )
    previous_log_count = component.error_log_count(diagnostic)
    _set_tls_certificate(phone_book, invalid_certificate)

    assert component.restart() == 0
    failed = component.wait_for_state("ERROR")
    assert failed.http_port == 0
    assert component.is_installed()
    _assert_listener_unavailable(component)
    _assert_classic_sql_available(phone_book)

    message = component.wait_for_error_log(
        diagnostic,
        previous_count=previous_log_count,
    )
    assert message == diagnostic

    _set_tls_certificate(phone_book, original_certificate)
    assert component.restart() == 0
    recovered = component.wait_until_ready()
    assert recovered.http_port == component.port
    _assert_service_available(component)
    _assert_classic_sql_available(phone_book)
