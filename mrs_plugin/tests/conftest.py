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

def create_test_db(session):
    session.run_sql("DROP SCHEMA IF EXISTS `PhoneBook`;")
    session.run_sql("CREATE SCHEMA IF NOT EXISTS `PhoneBook` DEFAULT CHARACTER SET utf8;")


    session.run_sql("USE `PhoneBook`;")
    session.run_sql("""CREATE TABLE IF NOT EXISTS `PhoneBook`.`Contacts` (
                        `id` INT NOT NULL,
                        `f_name` VARCHAR(45) NULL,
                        `l_name` VARCHAR(45) NULL,
                        `number` VARCHAR(20) NULL,
                        `email` VARCHAR(45) NULL,
                        PRIMARY KEY (`id`))
                        ENGINE = InnoDB;""")
    session.run_sql("""CREATE TABLE IF NOT EXISTS `PhoneBook`.`Addresses` (
                        `id` INT NOT NULL,
                        `address_line` VARCHAR(256) NULL,
                        `city` VARCHAR(128) NULL,
                        PRIMARY KEY (`id`))
                        ENGINE = InnoDB;""")
    session.run_sql("""CREATE PROCEDURE `GetAllContacts` ()
                        BEGIN
                            SELECT * FROM Contacts;
                        END""")
    session.run_sql("""CREATE OR REPLACE VIEW `ContactsWithEmail` AS
                        SELECT * FROM `Contacts`
                        WHERE `email` is not NULL;""")
    session.run_sql("""CREATE OR REPLACE VIEW `ContactBasicInfo` AS
                        SELECT f_name, l_name, number FROM `Contacts`
                        WHERE `email` is not NULL;""")


def reset_mrs_database(session):
    session.run_sql("DELETE FROM mysql_rest_service_metadata.audit_log")
    session.run_sql("DELETE FROM mysql_rest_service_metadata.content_file")
    session.run_sql("DELETE FROM mysql_rest_service_metadata.content_set")
    session.run_sql("DELETE FROM mysql_rest_service_metadata.field")
    session.run_sql("DELETE FROM mysql_rest_service_metadata.db_object")
    session.run_sql("DELETE FROM mysql_rest_service_metadata.db_schema")
    session.run_sql("DELETE FROM mysql_rest_service_metadata.auth_app")
    session.run_sql("DELETE FROM mysql_rest_service_metadata.mrs_user_has_role")
    session.run_sql("DELETE FROM mysql_rest_service_metadata.mrs_user")
    session.run_sql("DELETE FROM mysql_rest_service_metadata.mrs_role WHERE id <> ?",
        [lib.roles.FULL_ACCESS_ROLE_ID])
    session.run_sql("DELETE FROM mysql_rest_service_metadata.service")
    session.run_sql("DELETE FROM mysql_rest_service_metadata.url_host_alias")
    session.run_sql("DELETE FROM mysql_rest_service_metadata.url_host")

    session.run_sql("DELETE FROM mysql_rest_service_metadata.config")
    session.run_sql("INSERT INTO mysql_rest_service_metadata.config (id, service_enabled, data) VALUES (1, 1, '{}')")


@pytest.fixture(scope="session")
def init_mrs():
    shell = mysqlsh.globals.shell
    shell.options.set("useWizards", False)
    session: mysqlsh.globals.session = shell.connect("root:@localhost:3306")
    assert session is not None

    if "MRS_TESTS_QUICK" in os.environ:
        reset_mrs_database(session)
    else:
        session.run_sql("DROP DATABASE IF EXISTS mysql_rest_service_metadata;")

    create_test_db(session)

    from .. general import configure
    configure(session=session)

    service = {
        "url_protocol": ["HTTP"],
        "comments": "Test service",
        "session": session
    }
    from .. services import add_service
    service = add_service(url_context_root="/test", url_host_name="localhost", enabled=True, **service)

    assert service is not None, f"Unable to add the /test service: {service}"

    assert service is not None
    assert isinstance(service, dict)
    assert service == {
        'id': service["id"],
        'enabled': 1,
        'url_protocol': ['HTTP'],
        'url_host_name': 'localhost',
        'url_context_root': '/test',
        'comments': 'Test service',
        'options': None,
        'host_ctx': 'localhost/test',
        'url_host_id': service["url_host_id"],
        'auth_path': '/authentication',
        'auth_completed_url': None,
        'auth_completed_url_validation': None,
        'auth_completed_page_content': None,
        'is_current': 0,
    }

    schema = {
        "service_id": service["id"],
        "schema_name": "PhoneBook",
        "request_path": "/PhoneBook",
        "requires_auth": False,
        "enabled": True,
        "items_per_page" : 20,
        "comments": "test schema",
        "session": session
    }
    from .. schemas import add_schema
    schema_id = add_schema(**schema)

    tmp_dir = tempfile.TemporaryDirectory()
    tmpdir_path = tmp_dir.name
    open(os.path.join(tmpdir_path, "file.sh"), 'w+').close()
    open(os.path.join(tmpdir_path, "readme.txt"), 'w+').close()
    content_set = {
        "request_path": "/test_content_set",
        "requires_auth": False,
        "comments": "Content Set",
        "content_dir": tmpdir_path,
        "session": session
    }

    from .. content_sets import add_content_set
    content_set_result = add_content_set(service["id"], **content_set)

    db_object = {
        "service_id": service["id"],
        "db_object_name": "Contacts",
        "db_object_type": "TABLE",
        "schema_id": schema_id,
        "schema_name": "PhoneBook",
        "auto_add_schema": False,
        "request_path": "/test_table",
        "crud_operations": ['READ'],
        "crud_operation_format": "ITEM",
        "requires_auth": False,
        "items_per_page": 10,
        "row_user_ownership_enforced": False,
        "row_user_ownership_column": "",
        "row_ownership_parameter": "",
        "comments": "Test table",
        "session": session,
        "media_type": None,
        "auto_detect_media_type": True,
        "auth_stored_procedure": '0',
        "options": None,
        "fields": None
    }
    from .. db_objects import add_db_object
    db_object_id = add_db_object(**db_object)
    assert id is not None

    args = {
        "auth_vendor_id": "0x30000000000000000000000000000000",
        "description": "Authentication via MySQL accounts",
        "url": "/mrs_auth_app",
        "access_token": "test_token",
        "limit_to_registered_users": False,
        "registered_users": None,
        "app_id": "some app id",
        "session": session
    }
    from .. auth_apps import add_auth_app
    auth_app = add_auth_app(app_name="MRS Auth App", service_id=service["id"], **args)
    assert auth_app is not None
    assert "auth_app_id" in auth_app

    user = {
        "name": "User 1",
        "email": "user1@host.com",
        "auth_app_id": auth_app["auth_app_id"],
        "vendor_user_id": None,
        "login_permitted": True,
        "mapped_user_id": None,
        "app_options": {},
        "auth_string": "user1password",
        "session": session,
    }

    from .. users import update_user, add_user
    user = add_user(**user)
    assert user is not None

    roles = {
        "Full Access": lib.roles.FULL_ACCESS_ROLE_ID
    }
    role_id = lib.roles.add_role(session, None, None, "DBA", "Database administrator.")
    roles["DBA"] = role_id
    role_id = lib.roles.add_role(session, role_id, None, "Maintenance Admin", "Maintenance administrator.")
    roles["Maintenance Admin"] = role_id
    role_id = lib.roles.add_role(session, role_id, service["id"], "Process Admin", "Process administrator.")
    roles["Process Admin"] = role_id

    yield {
        "session": session,
        "service_id": service["id"],
        "schema_id": schema_id,
        "db_object_id": db_object_id,
        "content_set_id": content_set_result["content_set_id"],
        "url_host_id": service["url_host_id"],
        "auth_app_id": auth_app["auth_app_id"],
        "mrs_user1": user["id"],
        "roles": roles,
    }

    tmp_dir.cleanup()
    session.close()



class TableContents(object):
    class TableSnapshot(object):
        def __init__(self, snapshot):
            self._data = snapshot

        def __getitem__(self, key):
            return self._data[key]

        def __len__(self):
            return len(self._data)

        def __str__(self) -> str:
            return str(self._data)

        def __eq__(self, value) -> bool:
            if isinstance(value, dict):
                value = [value]
            return self._data == value

        @property
        def count(self):
            return len(self._data)

        @property
        def items(self):
            return self._data

        def get(self, column_name, value):
            for item in self._data:
                if item.get(column_name) == value:
                    return item
            return None

        def exists(self, column_name, value):
            return self.get(column_name, value) is not None

    def __init__(self, session, table_name):
        self._session = session
        self._table_name = table_name
        self._snapshot = None
        self._diff = set()

    @property
    def items(self):
        return lib.core.select(table=self._table_name).exec(self._session).items

    @property
    def count(self):
        return lib.core.select(table=self._table_name, cols="COUNT(*) as CNT").exec(self._session).first["CNT"]

    def get(self, column_name, value):
        return lib.core.select(table=self._table_name,
            where=[f"{column_name}=?"]
        ).exec(self._session, [value]).first

    def filter(self, column_name, value):
        return lib.core.select(table=self._table_name,
            where=f"{column_name}=?"
        ).exec(self._session, [value]).items

    def exists(self, column_name, value):
        return self.get(column_name, value) is not None

    def take_snapshot(self):
        self._snapshot = TableContents.TableSnapshot(lib.core.select(table=self._table_name).exec(self._session).items)

    @property
    def snapshot(self):
        return self._snapshot

    @property
    def same_as_snapshot(self):
        current = lib.core.select(table=self._table_name).exec(self._session).items
        if len(current) != len(self._snapshot):
            return False

        for index in range(0, len(self._snapshot)):
            if self._snapshot[index] != current[index]:
                return False

        return True

    def assert_same(self):
        current = lib.core.select(table=self._table_name).exec(self._session).items
        if len(current) != len(self._snapshot):
            return False

        for index in range(0, len(self._snapshot)):
            assert self._snapshot[index] == current[index]

    @property
    def diff_text(self):
        current = lib.core.select(table=self._table_name).exec(self._session).items
        if len(self._snapshot._data) != len(current):
            return f"\nCurrent:\n  {current}\nExpected:\n  {self._snapshot._data}"

        for index in range(0, len(current)):
            if current[index] != self._snapshot._data[index]:
                return f"\nCurrent:\n  {current[index]}\nExpected:\n  {self._snapshot._data[index]}"
        return ""

@pytest.fixture(scope="session")
@pytest.mark.usefixtures("init_mrs")
def table_contents(init_mrs) -> TableContents:
    def create_table_content_object(table_name, take_snapshot=True):
        tc = TableContents(init_mrs["session"], table_name)
        if take_snapshot:
            tc.take_snapshot()
        return tc
    yield create_table_content_object