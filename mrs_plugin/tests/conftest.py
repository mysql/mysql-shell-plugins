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

import os
import tempfile
from contextlib import ExitStack

import mysqlsh
import pytest

from mrs_plugin import lib
import mrs_plugin.tests.unit.helpers as helpers
from mrs_plugin import general

PHONE_BOOKS = {}


def start_mysql_session(connection_id=0):
    connection_data = helpers.get_connection_data()

    os.makedirs(os.path.join("tests", "mysql-sandboxes"), exist_ok=True)

    deployment_dir = tempfile.TemporaryDirectory()

    if not os.getenv("REUSE_MYSQLD"):
        mysqlsh.globals.dba.deploy_sandbox_instance(
            connection_data["port"],
            {
                "password": connection_data["password"],
                "sandboxDir": deployment_dir.name,
            },
        )

    session: mysqlsh.globals.session = helpers.create_shell_session()
    assert session is not None

    if os.getenv("REUSE_MYSQLD"):
        session.run_sql("drop schema if exists mysql_rest_service_metadata")

    phone_book_dbs = ["PhoneBook", "MobilePhoneBook", "AnalogPhoneBook"]

    session.run_sql("set sql_mode=''")

    helpers.create_test_db(session, "EmptyPhoneBook")
    for db in phone_book_dbs:
        helpers.create_test_db(session, db)

    general.configure(session=session)

    temp_dirs = []

    for db in phone_book_dbs:
        temp_dir = tempfile.TemporaryDirectory()
        temp_dirs.append(temp_dir)
        PHONE_BOOKS[db] = helpers.create_mrs_phonebook_schema(
            session, "/test", db, temp_dir
        )

    lib.services.set_current_service_id(session, PHONE_BOOKS["PhoneBook"]["service_id"])

    return {
        "session": session,
        "temp_dirs": temp_dirs,
        "deployment_dir": deployment_dir,
    }


def cleanup_mysql_session(session_data):
    for temp_dir in session_data["temp_dirs"]:
        temp_dir.cleanup()

    session_data["session"].close()
    # mysqlsh.globals.dba.stop_sandbox_instance(connection_data["port"], {
    #     "password": connection_data["password"],
    #     "sandboxDir": deployment_dir.name
    # })

    if not os.getenv("REUSE_MYSQLD"):
        mysqlsh.globals.dba.kill_sandbox_instance(
            session_data["connection_data"]["port"],
            {"sandboxDir": session_data["deployment_dir"].name},
        )


@pytest.fixture(scope="session")
def init_mrs(request):
    shell = mysqlsh.globals.shell
    shell.options.set("useWizards", False)

    connection_data = helpers.get_connection_data()
    os.makedirs(os.path.join("tests", "mysql-sandboxes"), exist_ok=True)

    component_e2e = request.config.getoption("--mrs-component")
    reuse_mysqld = bool(os.getenv("REUSE_MYSQLD"))

    if component_e2e and reuse_mysqld:
        pytest.fail(
            "--mrs-component requires a fresh sandbox and cannot be used "
            "with REUSE_MYSQLD"
        )

    def _component_e2e_log(message):
        if component_e2e:
            print(f"[component-e2e] {message}", flush=True)

    with ExitStack() as cleanups:
        if not reuse_mysqld:
            deployment_dir = tempfile.TemporaryDirectory()
            cleanups.callback(deployment_dir.cleanup)
            deployment_options = {
                "password": connection_data["password"],
                "sandboxDir": deployment_dir.name,
            }

            _component_e2e_log(
                f"Deploying MySQL sandbox on "
                f"{connection_data['host']}:{connection_data['port']}"
            )
            mysqlsh.globals.dba.deploy_sandbox_instance(
                connection_data["port"],
                deployment_options,
            )
            _component_e2e_log("MySQL sandbox deployed")

            def destroy_sandbox():
                _component_e2e_log("Destroying the MySQL sandbox")
                mysqlsh.globals.dba.kill_sandbox_instance(
                    connection_data["port"],
                    {"sandboxDir": deployment_dir.name},
                )
                _component_e2e_log("MySQL sandbox destroyed")

            cleanups.callback(destroy_sandbox)
        else:
            _component_e2e_log(
                f"Reusing MySQL instance on "
                f"{connection_data['host']}:{connection_data['port']}"
            )

        session: mysqlsh.globals.session = helpers.create_shell_session()
        assert session is not None
        _component_e2e_log("Connected to MySQL")

        def close_session():
            _component_e2e_log("Closing the MySQL session")
            session.close()

        cleanups.callback(close_session)

        if component_e2e:
            server = session.run_sql(
                "SELECT @@version, @@basedir, @@datadir"
            ).fetch_one()
            _component_e2e_log(
                f"MySQL Server {server[0]}; basedir={server[1]}; "
                f"datadir={server[2]}"
            )

        if reuse_mysqld:
            session.run_sql("drop schema if exists mysql_rest_service_metadata")

        phone_book_dbs = ["PhoneBook", "MobilePhoneBook", "AnalogPhoneBook"]

        session.run_sql("set sql_mode=''")

        helpers.create_test_db(session, "EmptyPhoneBook")
        for db in phone_book_dbs:
            helpers.create_test_db(session, db)

        _component_e2e_log("Configuring MRS metadata")
        general.configure(session=session)

        _component_e2e_log("Creating the /test REST service and test data")
        for db in phone_book_dbs:
            temp_dir = tempfile.TemporaryDirectory()
            cleanups.callback(temp_dir.cleanup)
            PHONE_BOOKS[db] = helpers.create_mrs_phonebook_schema(
                session, "/test", db, temp_dir
            )

        lib.services.set_current_service_id(
            session, PHONE_BOOKS["PhoneBook"]["service_id"]
        )

        _component_e2e_log("MySQL and MRS setup complete")
        yield session


@pytest.fixture(scope="session")
def phone_book(init_mrs):
    yield PHONE_BOOKS["PhoneBook"]


@pytest.fixture(scope="session")
def mobile_phone_book(init_mrs):
    yield PHONE_BOOKS["MobilePhoneBook"]


@pytest.fixture(scope="session")
def analog_phone_book(init_mrs):
    yield PHONE_BOOKS["AnalogPhoneBook"]


@pytest.fixture(scope="session")
def table_contents(phone_book):
    def create_table_content_object(
        table_name, schema=None, take_snapshot=True
    ) -> helpers.TableContents:
        schema = schema or phone_book
        return helpers.TableContents(schema["session"], table_name, take_snapshot)

    yield create_table_content_object


def pytest_addoption(parser):
    parser.addoption(
        "--mrs-component",
        action="store_true",
        default=False,
        help="run MRS component end-to-end tests",
    )
    parser.addoption(
        "--mdupgrade",
        action="store_true",
        dest="mdupgrade",
        default=False,
        help="enable metadata upgrade tests (slow)",
    )
