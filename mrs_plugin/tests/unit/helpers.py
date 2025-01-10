# Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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
import os

import mysqlsh
from mrs_plugin import lib
from mrs_plugin.schemas import add_schema, delete_schema
from mrs_plugin.services import add_service, delete_service, get_service
from mrs_plugin.db_objects import add_db_object, delete_db_object


def get_default_db_object_init(
    session,
    schema_id,
    name=None,
    request_path=None,
    db_object_type=None,
    object_options=None,
):
    object_id = lib.core.get_sequence_id(session)
    return {
        "schema_id": schema_id,
        "db_object_name": name or "ContactBasicInfo",
        "db_object_type": db_object_type or "VIEW",
        "request_path": request_path or "/view_contact_basic_info",
        "crud_operation_format": "FEED",
        "requires_auth": False,
        "items_per_page": 10,
        "comments": "Object that will be removed",
        "enabled": True,
        "media_type": "application/json",
        "auto_detect_media_type": True,
        "auth_stored_procedure": None,
        "options": {"aaa": "val aaa", "bbb": "val bbb"},
        "metadata": None,
        "objects": [
            {
                "id": object_id,
                "name": "MyServicePhoneBookContactsWithEmail",
                "position": 0,
                "kind": "RESULT",
                "comments": "Comment for object",
                "options": object_options
                or {
                    "duality_view_insert": True,
                    "duality_view_update": True,
                    "duality_view_delete": True,
                },
                "sdk_options": {
                    "option1": "value 1",
                    "option2": "value 2",
                },
                "fields": [
                    {
                        "id": lib.core.get_sequence_id(session),
                        "object_id": object_id,
                        "name": "id",
                        "position": 1,
                        "db_column": {
                            "comment": "",
                            "datatype": "int",
                            "id_generation": None,
                            "is_generated": False,
                            "is_primary": False,
                            "is_unique": False,
                            "name": "id",
                            "not_null": True,
                            "srid": None,
                        },
                        "enabled": True,
                        "allow_filtering": True,
                        "allow_sorting": False,
                        "no_check": False,
                        "no_update": False,
                        "options": None,
                    }
                ],
            }
        ],
    }


def get_default_user_init(
    auth_app_id,
    name="Temp User",
    email="tempuser@domain.com",
    auth_string="SomeAuthString",
):
    return {
        "auth_app_id": auth_app_id,
        "name": name,
        "email": email,
        "vendor_user_id": None,
        "login_permitted": True,
        "mapped_user_id": None,
        "app_options": {},
        "auth_string": auth_string,
    }


def get_default_role_init(
    caption=None, description=None, derived_from=None, specific_service_id=None
):
    return {
        "caption": caption or "Test role",
        "description": description or "Test role description",
        "derived_from_role_id": derived_from,
        "specific_to_service_id": specific_service_id,
    }


def get_default_content_set_init(
    service_id,
    content_dir=None,
    request_path=None,
    options={},
    comments=None,
    requires_auth=False,
):
    return {
        "service_id": service_id,
        "request_path": request_path or "/tempContentSet",
        "requires_auth": requires_auth,
        "comments": comments or "Content set comment",
        "options": options
        or {
            "option_1": "value 1",
            "option_2": "value 2",
            "option_3": "value 3",
        },
        "content_dir": content_dir,
    }


class SchemaCT(object):
    def __init__(self, session, service_id, schema_name, request_path, **kwargs):
        self._session = session
        self._schema_id = add_schema(
            service_id=service_id,
            schema_name=schema_name,
            request_path=request_path,
            requires_auth=False,
            items_per_page=25,
            **kwargs,
        )

    def __enter__(self):
        return self._schema_id

    def __exit__(self, type, value, traceback):
        delete_schema(session=self._session, schema_id=self._schema_id)


class ServiceCT(object):
    def __init__(self, session, url_context_root, url_host_name, **kwargs):
        self._session = session
        self._args = kwargs
        self._args["url_context_root"] = url_context_root
        self._args["url_protocol"] = ["HTTP"]
        self._args["enabled"] = 1
        self._args["auth_path"] = "/authentication"
        self._args["comments"] = kwargs.get("comments", "")

        self._service_id = lib.services.add_service(session, url_host_name, self._args)
        assert self._service_id is not None

    def __enter__(self):
        return self._service_id

    def __exit__(self, type, value, traceback):
        assert delete_service(session=self._session, service_id=self._service_id) == True


class AuthAppCT:
    def __init__(self, session, **kwargs):
        self._session = session
        self.service_id = kwargs.get("service_id")
        params = {
            "service_id": kwargs.get("service_id"),
            "auth_vendor_id": kwargs.get("auth_vendor_id"),
            "name": kwargs.get("name"),
            "description": kwargs.get("description"),
            "url": kwargs.get("url"),
            "url_direct_auth": kwargs.get("url_direct_auth"),
            "access_token": kwargs.get("access_token"),
            "app_id": kwargs.get("app_id"),
            "limit_to_reg_users": kwargs.get("limit_to_reg_users"),
            "default_role_id": kwargs.get("default_role_id"),
        }
        self._auth_app_id = lib.auth_apps.add_auth_app(
            session,
            params["service_id"],
            params["auth_vendor_id"],
            params["name"],
            params["description"],
            params["url"],
            params["url_direct_auth"],
            params["access_token"],
            params["app_id"],
            params["limit_to_reg_users"],
            params["default_role_id"],
        )

    def __enter__(self):
        return self._auth_app_id

    def __exit__(self, type, value, traceback):
        lib.auth_apps.delete_auth_app(
            self._session, service_id=self.service_id, app_id=self._auth_app_id
        )


class DbObjectCT:
    def __init__(self, session, **kwargs) -> None:
        self._session = session
        self._db_object_id, grants = lib.db_objects.add_db_object(session, **kwargs)
        for grant in grants:
            lib.core.MrsDbExec(grant).exec(session)

    def __enter__(self):
        return self._db_object_id

    def __exit__(self, type, value, traceback):
        lib.db_objects.delete_db_object(self._session, db_object_id=self._db_object_id)


class ContentSetCT:
    def __init__(self, session, **kwargs) -> None:
        self._session = session
        self._content_set_id, self.file_list_count = lib.content_sets.add_content_set(
            session, **kwargs
        )

    def __enter__(self):
        return self._content_set_id

    def __exit__(self, type, value, traceback):
        lib.content_sets.delete_content_set(self._session, [self._content_set_id])


class UserCT:
    def __init__(self, session, **kwargs) -> None:
        self._session = session
        self._user_id = lib.users.add_user(session, **kwargs)

    def __enter__(self):
        return self._user_id

    def __exit__(self, type, value, traceback):
        lib.users.delete_user_by_id(self._session, self._user_id)


class RoleCT:
    def __init__(self, session, **kwargs) -> None:
        self._session = session
        self._role_id = lib.roles.add_role(session, **kwargs)

    def __enter__(self):
        return self._role_id

    def __exit__(self, type, value, traceback):
        lib.roles.delete_role(self._session, self._role_id)


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

    def __init__(self, session, table_name, take_snapshot=True):
        self._session = session
        self._table_name = table_name
        self._snapshot = None
        self._diff = set()

        if take_snapshot:
            self.take_snapshot()

    @property
    def items(self):
        return lib.core.select(table=self._table_name).exec(self._session).items

    @property
    def count(self):
        return (
            lib.core.select(table=self._table_name, cols="COUNT(*) as CNT")
            .exec(self._session)
            .first["CNT"]
        )

    def get(self, column_name, value):
        return (
            lib.core.select(table=self._table_name, where=[f"{column_name}=?"])
            .exec(self._session, [value])
            .first
        )

    def filter(self, column_name, value):
        return (
            lib.core.select(table=self._table_name, where=f"{column_name}=?")
            .exec(self._session, [value])
            .items
        )

    def exists(self, column_name, value):
        return self.get(column_name, value) is not None

    def take_snapshot(self):
        self._snapshot = TableContents.TableSnapshot(
            lib.core.select(table=self._table_name).exec(self._session).items
        )

    @property
    def snapshot(self) -> TableSnapshot:
        assert self._snapshot is not None
        return self._snapshot

    @property
    def same_as_snapshot(self):
        assert self._snapshot is not None

        current = lib.core.select(table=self._table_name).exec(self._session).items
        if len(current) != len(self._snapshot):
            return False

        for index in range(0, len(self._snapshot)):
            if self._snapshot[index] != current[index]:
                return False

        return True

    def assert_same(self):
        assert self._snapshot is not None

        current = lib.core.select(table=self._table_name).exec(self._session).items
        if len(current) != len(self._snapshot):
            return False

        for index in range(0, len(self._snapshot)):
            assert self._snapshot[index] == current[index]

    @property
    def diff_text(self):
        assert self._snapshot is not None

        current = lib.core.select(table=self._table_name).exec(self._session).items
        if len(self._snapshot._data) != len(current):
            return f"\nCurrent:\n  {current}\nExpected:\n  {self._snapshot._data}"

        for index in range(0, len(current)):
            if current[index] != self._snapshot._data[index]:
                return f"\nCurrent:\n  {current[index]}\nExpected:\n  {self._snapshot._data[index]}"
        return ""


class QueryResults(object):
    def __init__(self, query_fn):
        self.query_fn = query_fn

        self.orig_results = None
        self.new_results = None

    def __enter__(self):
        self.orig_results = [r for r in iter(self.query_fn().fetch_one_object, None)]
        return self

    def __exit__(self, type, value, traceback):
        pass

    def run(self, rerun=True):
        if self.new_results is None or rerun:
            self.new_results = [r for r in iter(self.query_fn().fetch_one_object, None)]

    def expect_unchanged(self):
        self.run(rerun=True)
        assert self.orig_results == self.new_results

    def expect_rows(self, rows):
        self.run(rerun=True)
        assert self.new_results == rows

    def expect_added(self, added_rows):
        self.run(rerun=True)
        orig_results = self.orig_results.copy()
        for r in self.new_results:
            if r in orig_results:
                orig_results.remove(r)
            else:
                assert (
                    r in added_rows
                ), f"unexpected new row:{r}\nold={self.orig_results}\nnew={self.new_results}"
                added_rows.remove(r)
        assert (
            added_rows == []
        ), f"{added_rows} not added as expected\nold={self.orig_results}\nnew={self.new_results}"

    def expect_removed(self, removed_rows):
        self.run(rerun=True)
        new_results = self.new_results.copy()
        for r in self.orig_results:
            if r in new_results:
                new_results.remove(r)
            else:
                assert (
                    r in removed_rows
                ), f"old={self.orig_results}\nnew={self.new_results}"
                removed_rows.remove(r)
        assert removed_rows == [], f"{removed_rows} not removed as expected"


def create_test_db(session, schema_name):
    session.run_sql(f"DROP SCHEMA IF EXISTS `{schema_name}`;")
    session.run_sql(
        f"CREATE SCHEMA IF NOT EXISTS `{schema_name}` DEFAULT CHARACTER SET utf8;"
    )

    session.run_sql(f"USE `{schema_name}`;")
    session.run_sql(
        f"""CREATE TABLE IF NOT EXISTS `{schema_name}`.`Contacts` (
                        `id` INT NOT NULL,
                        `f_name` VARCHAR(45) NULL,
                        `l_name` VARCHAR(45) NULL,
                        `number` VARCHAR(20) NULL,
                        `email` VARCHAR(45) NULL,
                        PRIMARY KEY (`id`))
                        ENGINE = InnoDB;"""
    )
    session.run_sql(
        f"""CREATE TABLE IF NOT EXISTS `{schema_name}`.`Addresses` (
                        `id` INT NOT NULL,
                        `address_line` VARCHAR(256) NULL,
                        `city` VARCHAR(128) NULL,
                        PRIMARY KEY (`id`))
                        ENGINE = InnoDB;"""
    )
    session.run_sql(
        """CREATE PROCEDURE `GetAllContacts` ()
                        BEGIN
                            SELECT * FROM Contacts;
                        END"""
    )
    session.run_sql(
        """CREATE OR REPLACE VIEW `ContactsWithEmail` AS
                        SELECT * FROM `Contacts`
                        WHERE `email` is not NULL;"""
    )
    session.run_sql(
        """CREATE OR REPLACE VIEW `ContactBasicInfo` AS
                        SELECT f_name, l_name, number FROM `Contacts`
                        WHERE `email` is not NULL;"""
    )
    session.run_sql(
        f"""CREATE TABLE IF NOT EXISTS `{schema_name}`.`Notes` (
                        `id` INT NOT NULL,
                        `contact_id` INT NOT NULL,
                        `title` VARCHAR(50) NOT NULL,
                        `content` VARCHAR(255),
                        PRIMARY KEY (`id`),
                        FOREIGN KEY (`contact_id`) REFERENCES `{schema_name}`.`Contacts`(`id`));"""
    )
    session.run_sql(
        f"""CREATE FUNCTION `format_name` (first_name VARCHAR(45), last_name VARCHAR(45))
                        RETURNS VARCHAR(91) DETERMINISTIC
                        RETURN CONCAT(first_name, ' ', last_name);"""
    )
    session.run_sql(
        f"""CREATE OR REPLACE SQL SECURITY INVOKER VIEW `ContactNotes` AS
                        SELECT `format_name`(t1.`f_name`, t1.`l_name`), t1.`number`, t2.`title`, t2.`content` FROM `Contacts` t1
                        JOIN `Notes` t2 ON t1.`id` = t2.`contact_id`;"""
    )


def reset_mrs_database(session):
    session.run_sql("DELETE FROM mysql_rest_service_metadata.audit_log")
    session.run_sql("DELETE FROM mysql_rest_service_metadata.content_file")
    session.run_sql("DELETE FROM mysql_rest_service_metadata.content_set")
    session.run_sql("DELETE FROM mysql_rest_service_metadata.db_object")
    session.run_sql("DELETE FROM mysql_rest_service_metadata.db_schema")
    session.run_sql("DELETE FROM mysql_rest_service_metadata.auth_app")
    session.run_sql("DELETE FROM mysql_rest_service_metadata.mrs_user_has_role")
    session.run_sql("DELETE FROM mysql_rest_service_metadata.mrs_user")

    roles = (
        lib.core.MrsDbExec(
            "SELECT * FROM mysql_rest_service_metadata.mrs_role WHERE id <> ?",
            [lib.roles.FULL_ACCESS_ROLE_ID],
        )
        .exec(session)
        .items
    )

    roles: list = [role["id"] for role in roles]

    while roles:
        for role in roles:
            try:
                session.run_sql(
                    "DELETE FROM mysql_rest_service_metadata.mrs_role WHERE id = ?",
                    [role],
                )
                roles.remove(role)
            except Exception as e:
                pass

    session.run_sql("DELETE FROM mysql_rest_service_metadata.service")
    session.run_sql("DELETE FROM mysql_rest_service_metadata.url_host_alias")
    session.run_sql("DELETE FROM mysql_rest_service_metadata.url_host")

    session.run_sql("DELETE FROM mysql_rest_service_metadata.config")
    session.run_sql(
        "INSERT INTO mysql_rest_service_metadata.config (id, service_enabled, data) VALUES (1, 1, '{}')"
    )


def reset_privileges(session):
    session.run_sql(
        "REVOKE ALL PRIVILEGES ON *.* FROM 'mysql_rest_service_data_provider'@'%' IGNORE UNKNOWN USER"
    )
    session.run_sql(
        "REVOKE ALL PRIVILEGES ON *.* FROM 'mysql_rest_service_admin'@'%' IGNORE UNKNOWN USER"
    )
    session.run_sql(
        "REVOKE ALL PRIVILEGES ON *.* FROM 'mysql_rest_service_schema_admin'@'%' IGNORE UNKNOWN USER"
    )

    entries = (
        lib.core.MrsDbExec(
            f"""
        SELECT *
        FROM INFORMATION_SCHEMA.TABLE_PRIVILEGES
        WHERE GRANTEE LIKE '%mysql_rest_service_data_provider%'
        """
        )
        .exec(session)
        .items
    )

    assert len(entries) == 0


def create_mrs_phonebook_schema(session, service_context_root, schema_name, temp_dir):

    entries = (
        lib.core.MrsDbExec(
            f"""
        SELECT *
        FROM INFORMATION_SCHEMA.TABLE_PRIVILEGES
        WHERE GRANTEE LIKE '%mysql_rest_service_data_provider%'
        """
        )
        .exec(session)
        .items
    )

    service = lib.services.get_service(
        session, url_context_root=service_context_root, url_host_name="localhost"
    )

    if not service:
        url_host = (
            lib.core.select("url_host", where="name = ?")
            .exec(session, ["localhost"])
            .first
        )

        service_data = {
            "url_context_root": service_context_root,
            "url_protocol": ["HTTP"],
            "url_host_id": None,
            "enabled": 1,
            "comments": "Test service",
            "options": None,
            "auth_path": "/authentication",
            "auth_completed_url": None,
            "auth_completed_url_validation": None,
            "auth_completed_page_content": None,
        }

        service_id = lib.services.add_service(session, "localhost", service_data)
        service = lib.services.get_service(session, service_id=service_id)

    assert service is not None, f"Unable to add the /test service: {service}"

    assert service is not None
    assert isinstance(service, dict)
    expected = {
        "id": service["id"],
        "parent_id": None,
        "enabled": 1,
        "url_protocol": ["HTTP"],
        "url_host_name": "localhost",
        "url_context_root": service_context_root,
        "comments": "Test service",
        "options": None,
        "metadata": None,
        "host_ctx": f"localhost{service_context_root}",
        "url_host_id": service["url_host_id"],
        "auth_path": "/authentication",
        "auth_completed_url": None,
        "auth_completed_url_validation": None,
        "auth_completed_page_content": None,
        "is_current": 0,
        "in_development": None,
        "full_service_path": f"localhost{service_context_root}",
        "published": 0,
        "sorted_developers": None,
        "name": "mrs",
    }
    assert service == expected, f"{service}\n{expected}"

    schema_data = {
        "service_id": service["id"],
        "schema_name": schema_name,
        "request_path": f"/{schema_name}",
        "requires_auth": False,
        "enabled": True,
        "items_per_page": 20,
        "comments": "test schema",
        "session": session,
    }
    from ...schemas import add_schema

    schema_id = add_schema(**schema_data)
    schema = lib.schemas.get_schema(
        session, schema_id=lib.core.id_to_binary(schema_id, "schema_id")
    )

    content_set = lib.content_sets.get_content_set(
        session, service_id=service["id"], request_path="/test_content_set"
    )

    if not content_set:
        tmpdir_path = temp_dir.name
        with open(os.path.join(tmpdir_path, "somebinaryfile.bin"), "w+") as f:
            f.write("\0\1\2\3\4\5\6\7")
        with open(os.path.join(tmpdir_path, "readme.txt"), "w+") as f:
            f.write("Line '1'\nLine \"2\"\nLine \\3\\")
        content_set = {
            "request_path": "/test_content_set",
            "requires_auth": False,
            "comments": "Content Set",
            "content_dir": tmpdir_path,
            "session": session,
        }

        from ...content_sets import add_content_set

        content_set_result = add_content_set(service["id"], **content_set)

        content_set = lib.content_sets.get_content_set(
            session, content_set_id=content_set_result["content_set_id"]
        )

    object_key = lib.core.convert_id_to_string(lib.core.get_sequence_id(session))
    db_object = {
        "db_object_name": "Contacts",
        "db_object_type": "TABLE",
        "schema_id": schema_id,
        "auto_add_schema": False,
        "request_path": "/Contacts",
        "enabled": True,
        "crud_operations": ["READ"],
        "crud_operation_format": "FEED",
        "requires_auth": True,
        "row_user_ownership_enforced": False,
        "comments": "",
        "auto_detect_media_type": False,
        "auth_stored_procedure": "",
        "options": None,
        "objects": [
            {
                "id": object_key,
                "db_object_id": "",
                "name": "MyServiceAnalogPhoneBookContacts",
                "position": 0,
                "kind": "RESULT",
                "fields": [
                    {
                        "id": lib.core.convert_id_to_string(
                            lib.core.get_sequence_id(session)
                        ),
                        "object_id": object_key,
                        "name": "id",
                        "position": 1,
                        "db_column": {
                            "comment": "",
                            "datatype": "int",
                            "id_generation": None,
                            "is_generated": False,
                            "is_primary": True,
                            "is_unique": False,
                            "name": "id",
                            "not_null": True,
                            "srid": None,
                        },
                        "enabled": True,
                        "allow_filtering": True,
                        "allow_sorting": True,
                        "no_check": False,
                        "no_update": False,
                    },
                    {
                        "id": lib.core.convert_id_to_string(
                            lib.core.get_sequence_id(session)
                        ),
                        "object_id": object_key,
                        "name": "fName",
                        "position": 2,
                        "db_column": {
                            "comment": "",
                            "datatype": "varchar(45)",
                            "id_generation": None,
                            "is_generated": False,
                            "is_primary": False,
                            "is_unique": False,
                            "name": "f_name",
                            "not_null": False,
                            "srid": None,
                        },
                        "enabled": True,
                        "allow_filtering": True,
                        "allow_sorting": False,
                        "no_check": False,
                        "no_update": False,
                    },
                    {
                        "id": lib.core.convert_id_to_string(
                            lib.core.get_sequence_id(session)
                        ),
                        "object_id": object_key,
                        "name": "lName",
                        "position": 3,
                        "db_column": {
                            "comment": "",
                            "datatype": "varchar(45)",
                            "id_generation": None,
                            "is_generated": False,
                            "is_primary": False,
                            "is_unique": False,
                            "name": "l_name",
                            "not_null": False,
                            "srid": None,
                        },
                        "enabled": True,
                        "allow_filtering": True,
                        "allow_sorting": False,
                        "no_check": False,
                        "no_update": False,
                    },
                    {
                        "id": lib.core.convert_id_to_string(
                            lib.core.get_sequence_id(session)
                        ),
                        "object_id": object_key,
                        "name": "number",
                        "position": 4,
                        "db_column": {
                            "comment": "",
                            "datatype": "varchar(20)",
                            "id_generation": None,
                            "is_generated": False,
                            "is_primary": False,
                            "is_unique": False,
                            "name": "number",
                            "not_null": False,
                            "srid": None,
                        },
                        "enabled": True,
                        "allow_filtering": True,
                        "allow_sorting": False,
                        "no_check": False,
                        "no_update": False,
                    },
                    {
                        "id": lib.core.convert_id_to_string(
                            lib.core.get_sequence_id(session)
                        ),
                        "object_id": object_key,
                        "name": "email",
                        "position": 5,
                        "db_column": {
                            "comment": "",
                            "datatype": "varchar(45)",
                            "id_generation": None,
                            "is_generated": False,
                            "is_primary": False,
                            "is_unique": False,
                            "name": "email",
                            "not_null": False,
                            "srid": None,
                        },
                        "enabled": True,
                        "allow_filtering": True,
                        "allow_sorting": False,
                        "no_check": False,
                        "no_update": False,
                    },
                ],
            }
        ],
    }

    from ...db_objects import add_db_object

    db_object_id = add_db_object(**db_object)
    assert id is not None

    db_object = lib.db_objects.get_db_object(session, db_object_id)
    assert db_object is not None

    entries = (
        lib.core.MrsDbExec(
            f"""
        SELECT *
        FROM INFORMATION_SCHEMA.TABLE_PRIVILEGES
        WHERE GRANTEE LIKE '%mysql_rest_service_data_provider%'
        """
        )
        .exec(session)
        .items
    )

    grants = (
        lib.core.MrsDbExec(
            f"""
        SELECT *
        FROM INFORMATION_SCHEMA.TABLE_PRIVILEGES
        WHERE TABLE_SCHEMA = '{db_object['schema_name']}'
            AND TABLE_NAME = '{db_object['name']}'
        """
        )
        .exec(session)
        .items
    )

    grants = [g["PRIVILEGE_TYPE"] for g in grants]
    assert sorted(grants) == ["SELECT"], f"{sorted(grants)}"

    args = {
        "auth_vendor_id": "0x30000000000000000000000000000000",
        "description": "Authentication via MySQL accounts",
        "url": "/mrs_auth_app",
        "access_token": "test_token",
        "limit_to_registered_users": False,
        "registered_users": None,
        "app_id": "some app id",
        "session": session,
    }

    auth_apps = lib.auth_apps.get_auth_apps(session, service["id"])

    if not auth_apps:
        from ...auth_apps import add_auth_app

        auth_app = add_auth_app(
            app_name="MRS Auth App", service_id=service["id"], **args
        )
        assert auth_app is not None
        assert "auth_app_id" in auth_app

        auth_app = lib.auth_apps.get_auth_app(session, auth_app["auth_app_id"])

        auth_apps = [auth_app]

    auth_app = auth_apps[0]

    users = lib.users.get_users(session, service["id"], auth_app["id"])

    if not users:
        user = {
            "name": "User 1",
            "email": "user1@host.com",
            "auth_app_id": auth_app["id"],
            "vendor_user_id": None,
            "login_permitted": True,
            "mapped_user_id": None,
            "app_options": {},
            "auth_string": "user1password",
            "session": session,
        }

        from ...users import update_user, add_user

        user = add_user(**user)
        assert user is not None

        users = [user]

    user = users[0]

    roles = {"Full Access": lib.roles.FULL_ACCESS_ROLE_ID}
    service_roles = lib.roles.get_roles(session, service["id"])
    if len(service_roles) == 1:
        role_id = lib.roles.add_role(
            session, None, None, "DBA", "Database administrator."
        )
        role_id = lib.roles.add_role(
            session, role_id, None, "Maintenance Admin", "Maintenance administrator."
        )
        role_id = lib.roles.add_role(
            session, role_id, service["id"], "Process Admin", "Process administrator."
        )

        service_roles = lib.roles.get_roles(session, service["id"])

    for role in service_roles:
        roles[role["caption"]] = role["id"]

    return {
        "session": session,
        "service_id": service["id"],
        "schema_id": schema_id,
        "db_object_id": db_object_id,
        "content_set_id": content_set["id"],
        "url_host_id": service["url_host_id"],
        "auth_app_id": auth_app["id"],
        "mrs_user1": user["id"],
        "roles": roles,
        "temp_dir": temp_dir.name,
    }


def get_db_object_privileges(session, schema_name, db_object_name):
    grants = (
        lib.core.MrsDbExec(
            f"""
        SELECT PRIVILEGE_TYPE
        FROM INFORMATION_SCHEMA.TABLE_PRIVILEGES
        WHERE TABLE_SCHEMA = '{schema_name}'
            AND TABLE_NAME = '{db_object_name}'
        """
        )
        .exec(session)
        .items
    )

    # The Db and Routine_name column values are identifier names, which on mysql.* tables are bound to some
    # case-sensitivity constraints (https://dev.mysql.com/doc/refman/8.4/en/identifier-case-sensitivity.html).
    # In order to allow the tests to use case sensitive Procedure names, we must ensure the lookup works around these
    # constraints on every platform, regardless of the value of the `lower_case_table_names` system variable.
    # One way to do that is by using case-insensitive pattern matching with REGEXP_LIKE (
    # https://dev.mysql.com/doc/refman/8.4/en/pattern-matching.html).
    grants2 = lib.core.MrsDbExec(f"""
        SELECT PROC_PRIV
        FROM mysql.procs_priv
        WHERE REGEXP_LIKE(DB, ?, 'i')
            AND REGEXP_LIKE(ROUTINE_NAME, ?, 'i')
        """).exec(session, [schema_name, db_object_name]).items

    if grants2:
        grants2 = [g.upper() for g in grants2[0]["PROC_PRIV"]]

    grants = [g["PRIVILEGE_TYPE"] for g in grants]
    grants = grants + [g.upper() for g in grants2]

    return grants


def get_connection_data():
    return {
        "user": os.environ.get("MYSQL_USER", "root"),
        "host": os.environ.get("MYSQL_HOST", "localhost"),
        "port": os.environ.get("MYSQL_PORT", "3388"),
        "password": os.environ.get("MYSQL_PASSWORD", ""),
    }


def create_shell_session() -> mysqlsh.globals.session:
    connection_data = get_connection_data()
    shell = mysqlsh.globals.shell

    return shell.connect(
        f"{connection_data['user']}:{connection_data['password']}@{connection_data['host']}:{connection_data['port']}"
    )


def string_replace(text: str, replacers: dict) -> str:
    for key, value in replacers.items():
        text = text.replace(key, value)
    return text
