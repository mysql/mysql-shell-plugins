# Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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

import pytest
import tempfile
import os

import msm_plugin.tests.unit.helpers as helpers

from msm_plugin.management import *
from msm_plugin.tests.unit.test_management import SCHEMA_NAME, COPYRIGHT_HOLDER

import mysqlsh


@pytest.fixture(scope="session")
def sandbox_session() -> mysqlsh.globals.session:

    shell = mysqlsh.globals.shell
    shell.options.set("useWizards", False)

    connection_data = helpers.get_connection_data()

    os.makedirs(os.path.join("tests", "mysql-sandboxes"), exist_ok=True)

    deployment_dir = tempfile.TemporaryDirectory()

    mysqlsh.globals.dba.deploy_sandbox_instance(connection_data["port"], {
        "password": connection_data["password"],
        "sandboxDir": deployment_dir.name
    })

    session: mysqlsh.globals.session = helpers.create_shell_session()
    assert session is not None

    # This will now let all tests run
    yield session

    session.close()

    mysqlsh.globals.dba.kill_sandbox_instance(connection_data["port"], {
        "sandboxDir": deployment_dir.name
    })


@pytest.fixture(scope="session")
def temp_dir():
    with tempfile.TemporaryDirectory() as temp_dir:
        # temp_dir = os.path.join(os.path.expanduser("~"), "Documents", "temp")
        yield temp_dir


@pytest.fixture(scope="session")
def project_path(temp_dir):
    project_path = create_new_project_folder(
        schema_name=SCHEMA_NAME,
        target_path=temp_dir,
        copyright_holder=COPYRIGHT_HOLDER,
        overwrite_existing=True,
    )

    yield project_path
