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

import urllib.error

import pytest

from mrs_plugin import lib


def _configured_http_port(session):
    return int(
        session.run_sql(
            "SELECT @@GLOBAL.mysql_rest_service.http_port"
        ).fetch_one()[0]
    )


def _assert_service_available(component):
    response = component.http.wait_for_status(
        "/test/authentication/authApps",
        200,
    )
    assert response.status == 200, response.text


def _session_state(session):
    return tuple(
        session.run_sql(
            "SELECT @@SESSION.sql_mode, DATABASE()"
        ).fetch_one()
    )


def test_component_configuration_persists_across_restart(
    ready_mrs_component,
    phone_book,
):
    component = ready_mrs_component
    _assert_service_available(component)

    old_port = component.port
    old_http = component.http
    session_state = _session_state(phone_book["session"])
    new_port = component.persist_http_port()

    assert new_port != old_port
    assert _configured_http_port(phone_book["session"]) == new_port

    before_restart = component.status()
    assert before_restart.state == "READY"
    assert before_restart.http_port == old_port

    component.restart_server()

    restarted = component.wait_until_ready()
    assert restarted.http_port == new_port
    assert _configured_http_port(phone_book["session"]) == new_port
    assert _session_state(phone_book["session"]) == session_state

    with pytest.raises(urllib.error.URLError):
        old_http.get("/test/authentication/authApps")

    _assert_service_available(component)

    service = lib.services.get_service(
        phone_book["session"],
        service_id=phone_book["service_id"],
    )
    assert service is not None
    assert bool(service["published"])
