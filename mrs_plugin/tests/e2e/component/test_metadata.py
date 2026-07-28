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


def test_component_observes_metadata_updates(ready_mrs_component):
    component = ready_mrs_component
    endpoint = "/test/authentication/authApps"

    response = component.http.wait_for_status(endpoint, 200)
    assert response.status == 200, response.text

    component.set_service_published(False)

    response = component.http.wait_for_status(
        endpoint,
        404,
        retry_statuses=(200,),
    )
    assert response.status == 404, response.text

    unpublished = component.status()
    assert unpublished.state == "READY"
    assert unpublished.http_port == component.port

    component.publish_service()

    response = component.http.wait_for_status(endpoint, 200)
    assert response.status == 200, response.text

    republished = component.status()
    assert republished.state == "READY"
    assert republished.http_port == component.port
