# Copyright (c) 2021, 2023, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is also distributed with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms, as
# designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have included with MySQL.
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


@pytest.fixture(scope="session")
def init_mrs():

    shell = mysqlsh.globals.shell
    shell.options.set("useWizards", False)
    session: mysqlsh.globals.session = shell.connect("root:@localhost:3306")
    assert session is not None

    session.run_sql("set sql_mode=''")

    if "MRS_TESTS_QUICK" in os.environ:
        helpers.reset_mrs_database(session)
        helpers.reset_privileges(session)
    else:
        helpers.reset_privileges(session)
        session.run_sql("DROP DATABASE IF EXISTS mysql_rest_service_metadata;")
        session.run_sql("DROP DATABASE IF EXISTS PhoneBook;")
        session.run_sql("DROP DATABASE IF EXISTS MobilePhoneBook;")
        session.run_sql("DROP DATABASE IF EXISTS AnalogPhoneBook;")
        session.run_sql("DROP DATABASE IF EXISTS EmptyPhoneBook;")


    helpers.create_test_db(session, "PhoneBook")
    helpers.create_test_db(session, "MobilePhoneBook")
    helpers.create_test_db(session, "AnalogPhoneBook")
    helpers.create_test_db(session, "EmptyPhoneBook")

    general.configure(session=session)

    yield session

    session.close()

@pytest.fixture(scope="session")
def phone_book(init_mrs):
    session = init_mrs
    temp_dir = tempfile.TemporaryDirectory()

    yield helpers.create_mrs_phonebook_schema(session, "/test", "PhoneBook", temp_dir)

    temp_dir.cleanup()

@pytest.fixture(scope="session")
def mobile_phone_book(init_mrs):
    session = init_mrs
    temp_dir = tempfile.TemporaryDirectory()

    yield helpers.create_mrs_phonebook_schema(session, "/test", "MobilePhoneBook", temp_dir)

    temp_dir.cleanup()

@pytest.fixture(scope="session")
def analog_phone_book(init_mrs):
    session = init_mrs
    temp_dir = tempfile.TemporaryDirectory()

    yield helpers.create_mrs_phonebook_schema(session, "/analog", "AnalogPhoneBook", temp_dir)

    temp_dir.cleanup()


@pytest.fixture(scope="session")
def table_contents(phone_book) -> helpers.TableContents:
    def create_table_content_object(table_name, schema=None, take_snapshot=True):
        schema = schema or phone_book
        tc = helpers.TableContents(schema["session"], table_name)
        if take_snapshot:
            tc.take_snapshot()
        return tc
    yield create_table_content_object
