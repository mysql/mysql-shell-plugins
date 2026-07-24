# Copyright (c) 2021, 2026, Oracle and/or its affiliates.
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

import pathlib
import socket
import pytest  # type: ignore
import tempfile
import os
from unittest import mock

import gui_plugin.migration.tests.unit.helpers as helpers
import gui_plugin.migration.lib.migration as migration_lib

from gui_plugin.migration.migration import *

try:
    import pytest_mock  # type: ignore  # noqa: F401
except ImportError:

    class _PatchProxy:
        def __init__(self):
            self._patches = []

        def __call__(self, *args, **kwargs):
            patcher = mock.patch(*args, **kwargs)
            patched = patcher.start()
            self._patches.append(patcher)
            return patched

        def object(self, *args, **kwargs):
            patcher = mock.patch.object(*args, **kwargs)
            patched = patcher.start()
            self._patches.append(patcher)
            return patched

        def stopall(self):
            while self._patches:
                self._patches.pop().stop()

    class _Mocker:
        MagicMock = mock.MagicMock
        Mock = mock.Mock
        call = mock.call
        ANY = mock.ANY

        def __init__(self):
            self.patch = _PatchProxy()

        def stopall(self):
            self.patch.stopall()

    @pytest.fixture
    def mocker():
        fallback_mocker = _Mocker()
        yield fallback_mocker
        fallback_mocker.stopall()


import mysqlsh


@pytest.fixture(autouse=True)
def cleanup_migration_projects():
    try:
        yield
    finally:
        migration_lib.close_all_projects()


def pytest_addoption(parser):
    parser.addoption(
        "--reuse-sandbox",
        action="store_true",
        help="keep sandbox running when done and don't start a new one",
    )
    parser.addoption(
        "--interactive",
        action="store_true",
        help="allow tests that require user interaction",
    )
    parser.addoption(
        "--reset-project",
        action="store_true",
        help="reset migration project state before running migration test",
    )
    parser.addoption(
        "--site-to-site-vcn",
        help="Specify the ocid of the VCN supporting site-to-site VPN. Enables tests that require them.",
    )


def get_my_real_address():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("100.100.100.100", 80))
        ip = s.getsockname()[0]
    except socket.error:
        ip = None
    finally:
        s.close()
    return ip


def setup_sandbox(request, connection_data, enable_repl: bool):
    reuse_sandbox = request.config.getoption("--reuse-sandbox")

    shell = mysqlsh.globals.shell
    shell.options.set("useWizards", False)

    sandbox_dir = pathlib.Path(
        os.path.join(tempfile.gettempdir(), "migration-test-sandboxes")
    )
    os.makedirs(sandbox_dir, exist_ok=True)

    do_deploy = False
    if reuse_sandbox:
        if not (sandbox_dir / str(connection_data["port"])).exists():
            print(
                f"Deploying reusable sandbox {connection_data["port"]} at {sandbox_dir}"
            )
            do_deploy = True
            sandbox_path = str(sandbox_dir)
        else:
            print(f"Reusing sandbox {connection_data["port"]} at {sandbox_dir}")
    else:
        deployment_dir = tempfile.TemporaryDirectory()
        do_deploy = True
        sandbox_path = deployment_dir.name

    if do_deploy:
        mysqld_options = []
        if not enable_repl:
            mysqld_options.append("skip_log_bin")

        mysqlsh.globals.dba.deploy_sandbox_instance(
            connection_data["port"],
            {
                "password": connection_data["password"],
                "sandboxDir": sandbox_path,
                "mysqldOptions": mysqld_options,
            },
        )

    connection_data["host"] = get_my_real_address()

    session = helpers.create_shell_session(connection_data)
    assert session is not None

    if do_deploy:
        session.run_sql("set sql_log_bin=0")
        session.run_sql("create user if not exists admin@'%' identified by 'Sakila1!'")
        session.run_sql("grant all on *.* to admin@'%' with grant option")
        session.run_sql(
            f"INSTALL PLUGIN mysql_no_login SONAME 'mysql_no_login.{'dll' if 'nt' == os.name else 'so'}'"
        )
        session.run_sql("set sql_log_bin=1")

    def cleanup():
        session.close()

        if not reuse_sandbox:
            mysqlsh.globals.dba.kill_sandbox_instance(
                connection_data["port"], {"sandboxDir": deployment_dir.name}
            )

    return session, cleanup


@pytest.fixture(scope="session")
def sandbox_session(request):
    connection_data = helpers.get_connection_data()
    session, cleanup = setup_sandbox(request, connection_data, enable_repl=False)
    yield session
    cleanup()


@pytest.fixture(scope="session")
def sandbox_repl_session(request):
    connection_data = helpers.get_connection_data(1)
    session, cleanup = setup_sandbox(request, connection_data, enable_repl=True)
    yield session
    cleanup()


@pytest.fixture()
def temp_dir():
    with tempfile.TemporaryDirectory() as temp_dir:
        # temp_dir = os.path.join(os.path.expanduser("~"), "Documents", "temp")
        yield temp_dir


@pytest.fixture
def interactive(request):
    value = request.config.getoption("--interactive")
    if not value:
        pytest.skip("--interactive is not provided")
    return value


@pytest.fixture
def reset_project(request):
    return request.config.getoption("--reset-project")


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "requires_oci_tests_enabled: mark tests that would be skipped if MIGRATION_TEST_SKIP_OCI_TESTS is defined",
    )
    config.addinivalue_line(
        "markers",
        "requires_root_compartment_id: mark tests that require MIGRATION_TEST_ROOT_COMPARTMENT_ID",
    )


def pytest_collection_modifyitems(config, items):
    marker_conditions = {
        "requires_oci_tests_enabled": (
            os.environ.get("MIGRATION_TEST_SKIP_OCI_TESTS") is not None,
            "Requires MIGRATION_TEST_SKIP_OCI_TESTS to NOT be defined",
        ),
        "requires_root_compartment_id": (
            os.environ.get("MIGRATION_TEST_ROOT_COMPARTMENT_ID") is None,
            "Requires MIGRATION_TEST_ROOT_COMPARTMENT_ID",
        ),
    }

    for item in items:
        for marker, (condition, reason) in marker_conditions.items():
            if marker in item.keywords and condition:
                item.add_marker(pytest.mark.skip(reason))


@pytest.fixture
def site_to_site_vcn(request):
    return request.config.getoption("--site-to-site-vcn")
