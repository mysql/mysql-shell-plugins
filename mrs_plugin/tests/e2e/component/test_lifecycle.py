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


_LIFECYCLE_UDFS = {
    "mysql_rest_service_restart",
    "mysql_rest_service_start",
    "mysql_rest_service_stop",
}


def _assert_service_available(component):
    response = component.http.wait_for_status(
        "/test/authentication/authApps",
        200,
    )
    assert response.status == 200, response.text


def test_component_install_and_uninstall(mrs_component, phone_book):
    session = phone_book["session"]

    mrs_component.publish_service()
    mrs_component.install()

    status = mrs_component.wait_until_ready()
    assert status.state == "READY"
    assert status.http_port == mrs_component.port

    _assert_service_available(mrs_component)

    udf_names = {
        row[0]
        for row in session.run_sql(
            """
            SELECT UDF_NAME
            FROM performance_schema.user_defined_functions
            WHERE UDF_NAME REGEXP '^mysql_rest_service_'
            """
        ).fetch_all()
    }
    assert udf_names == _LIFECYCLE_UDFS

    system_variable_names = {
        row[0].lower()
        for row in session.run_sql(
            """
            SELECT VARIABLE_NAME
            FROM performance_schema.global_variables
            WHERE VARIABLE_NAME REGEXP '^mysql_rest_service[.]'
            """
        ).fetch_all()
    }
    assert "mysql_rest_service.http_port" in system_variable_names

    mrs_component.uninstall()

    assert not mrs_component.is_installed()

    remaining_status_variables = session.run_sql(
        """
        SELECT VARIABLE_NAME
        FROM performance_schema.global_status
        WHERE VARIABLE_NAME REGEXP '^mysql_rest_service[.]'
        """
    ).fetch_all()
    assert remaining_status_variables == []

    with pytest.raises(urllib.error.URLError):
        mrs_component.http.get("/test/authentication/authApps")

    remaining_udfs = session.run_sql(
        """
        SELECT UDF_NAME
        FROM performance_schema.user_defined_functions
        WHERE UDF_NAME REGEXP '^mysql_rest_service_'
        """
    ).fetch_all()
    assert remaining_udfs == []

    remaining_system_variables = session.run_sql(
        """
        SELECT VARIABLE_NAME
        FROM performance_schema.global_variables
        WHERE VARIABLE_NAME REGEXP '^mysql_rest_service[.]'
        """
    ).fetch_all()
    assert remaining_system_variables == []

    service = lib.services.get_service(
        session,
        service_id=phone_book["service_id"],
    )
    assert service is not None
    assert bool(service["published"])


def test_component_start_stop_restart(ready_mrs_component, phone_book):
    component = ready_mrs_component
    component.grant_lifecycle_admin()
    _assert_service_available(component)

    assert component.stop() == 0
    stopped = component.status()
    assert stopped.state == "STOPPED"
    assert stopped.http_port == 0

    with pytest.raises(urllib.error.URLError):
        component.http.get("/test/authentication/authApps")

    assert component.start() == 0
    component.wait_until_ready()
    _assert_service_available(component)

    # Restart must apply the new port and retire the old listener.
    old_port = component.port
    old_http = component.http
    new_port = component.configure_http_port()

    configured = component.status()
    assert configured.state == "READY"
    assert configured.http_port == old_port
    assert new_port != old_port

    assert component.restart() == 0
    restarted = component.wait_until_ready()
    assert restarted.http_port == new_port

    with pytest.raises(urllib.error.URLError):
        old_http.get("/test/authentication/authApps")

    _assert_service_available(component)

    service = lib.services.get_service(
        phone_book["session"],
        service_id=phone_book["service_id"],
    )
    assert service is not None
    assert bool(service["published"])
