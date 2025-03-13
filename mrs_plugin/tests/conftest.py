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

import mysqlsh

from mrs_plugin import lib
import mrs_plugin.tests.unit.helpers as helpers
from mrs_plugin import general

PHONE_BOOKS = {}

@pytest.fixture(scope="session")
def init_mrs():

    shell = mysqlsh.globals.shell
    shell.options.set("useWizards", False)

    connection_data = helpers.get_connection_data()

    os.makedirs(os.path.join("tests", "mysql-sandboxes"), exist_ok=True)

    deployment_dir = tempfile.TemporaryDirectory()

    if not os.getenv("REUSE_MYSQLD"):
        mysqlsh.globals.dba.deploy_sandbox_instance(connection_data["port"], {
            "password": connection_data["password"],
            "sandboxDir": deployment_dir.name
        })

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
        PHONE_BOOKS[db] = helpers.create_mrs_phonebook_schema(session, "/test", db, temp_dir)

    lib.services.set_current_service_id(session, PHONE_BOOKS["PhoneBook"]["service_id"])

    yield session

    for temp_dir in temp_dirs:
        temp_dir.cleanup()

    session.close()
    # mysqlsh.globals.dba.stop_sandbox_instance(connection_data["port"], {
    #     "password": connection_data["password"],
    #     "sandboxDir": deployment_dir.name
    # })

    if not os.getenv("REUSE_MYSQLD"):
        mysqlsh.globals.dba.kill_sandbox_instance(connection_data["port"], {
            "sandboxDir": deployment_dir.name
        })

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
    def create_table_content_object(table_name, schema=None, take_snapshot=True) -> helpers.TableContents:
        schema = schema or phone_book
        return helpers.TableContents(schema["session"], table_name, take_snapshot)
    yield create_table_content_object
