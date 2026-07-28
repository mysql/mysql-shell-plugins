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

import pytest

from mrs_plugin import lib
from mrs_plugin.tests.e2e.component.harness import MrsComponentTestHarness


@pytest.fixture(scope="session")
def require_component_e2e(request):
    if not request.config.getoption("--mrs-component"):
        pytest.skip("pass --mrs-component to run component end-to-end tests")


@pytest.fixture
def mrs_component(require_component_e2e, phone_book, init_mrs):
    session = phone_book["session"]
    service_id = phone_book["service_id"]
    service = lib.services.get_service(session, service_id=service_id)
    if service is None:
        pytest.fail("The MRS test service was not found")

    component = MrsComponentTestHarness(
        session,
        service,
        test_server=init_mrs,
    )

    if component.is_installed():
        pytest.fail("The MRS component is already installed on the test instance")

    try:
        yield component
    finally:
        component.cleanup()


@pytest.fixture
def ready_mrs_component(mrs_component):
    mrs_component.publish_service()
    mrs_component.install()
    mrs_component.wait_until_ready()
    return mrs_component
