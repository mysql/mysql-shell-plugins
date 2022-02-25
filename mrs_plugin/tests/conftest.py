# Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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


@pytest.fixture(scope="session")
def init_mrs():
    shell = mysqlsh.globals.shell
    session = shell.connect("root:@localhost:3306")
    assert session is not None

    session.run_sql("DROP DATABASE IF EXISTS mysql_rest_service_metadata;")
    create_test_db(session)

    config = {
        "enable_mrs": True,
        "session": session,
        "interactive": False
    }
    from .. general import configure
    configure(**config)

    service = {
        "url_protocol": "HTTP",
        "is_default": True,
        "comments": "Test service",
        "session": session,
        "interactive": False,
        "raise_exceptions": False
    }
    from .. services import add_service
    result = add_service("/test", "localhost", True, **service)

    schema = {
        "schema_name": "PhoneBook",
        "service_id": 1,
        "request_path": "/test_schema",
        "requires_auth": False,
        "enabled": True,
        "items_per_page" : 20,
        "comments": "test schema",
        "session": session,
        "interactive": False

    }
    from .. schemas import add_schema
    add_schema(**schema)

    tmp_dir = tempfile.TemporaryDirectory()
    tmpdir_path = tmp_dir.name
    open(os.path.join(tmpdir_path, "file.sh"), 'w+').close()
    open(os.path.join(tmpdir_path, "readme.txt"), 'w+').close()
    content_set = {
        "request_path": "/test_content_set",
        "requires_auth": False,
        "comments": "Content Set",
        "session": session,
        "interactive": False,
        "raise_exceptions": False
    }
    from .. content_sets import add_content_set
    add_content_set(content_dir=tmpdir_path, service_id=1, **content_set)

    db_object = {
        "db_object_name": "Contacts",
        "db_object_type": "TABLE",
        "schema_id": 1,
        "schema_name": "PhoneBook",
        "auto_add_schema": False,
        "request_path": "/test_table",
        "crud_operations": ['READ'],
        "crud_operation_format": "ITEM",
        "requires_auth": False,
        "items_per_page": 10,
        "row_ownership_enforced": False,
        "row_ownership_column": "",
        "row_ownership_parameter": "",
        "comments": "Test table",
        "session": session,
        "interactive": False,
        "raise_exceptions": False,
        "return_formatted": False
    }
    from .. db_objects import add_db_object
    id = add_db_object(**db_object)
    assert id is not None

    yield session

    tmp_dir.cleanup()
    session.close()
