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


_TABLE_NAME = "component_e2e_contacts"
_PROCEDURE_NAME = "component_e2e_list_contacts"
_TABLE_PATH = "/componentE2EContacts"
_PROCEDURE_PATH = "/componentE2EListContacts"


def _run_sql(phone_book, statement):
    phone_book["session"].run_sql(statement)


def _delete_db_object(phone_book, db_object_id):
    lib.db_objects.delete_db_object(phone_book["session"], db_object_id)


def _add_rest_object(component, phone_book, statement, request_path):
    results = lib.script.run_mrs_script(
        mrs_script=statement,
        session=phone_book["session"],
    )
    assert results
    assert all(result["type"] == "success" for result in results), results

    db_object = lib.db_objects.get_db_object(
        phone_book["session"],
        schema_id=phone_book["schema_id"],
        request_path=request_path,
    )
    assert db_object is not None
    component.add_cleanup(_delete_db_object, phone_book, db_object["id"])


@pytest.fixture
def rest_workflow_component(mrs_component, phone_book):
    session = phone_book["session"]

    session.run_sql(
        f"""
        CREATE TABLE `PhoneBook`.`{_TABLE_NAME}` (
            id INT NOT NULL,
            name VARCHAR(64) NOT NULL,
            PRIMARY KEY (id)
        )
        """
    )
    mrs_component.add_cleanup(
        _run_sql,
        phone_book,
        f"DROP TABLE IF EXISTS `PhoneBook`.`{_TABLE_NAME}`",
    )

    session.run_sql(
        f"""
        CREATE PROCEDURE `PhoneBook`.`{_PROCEDURE_NAME}` ()
        SELECT id, name
        FROM `PhoneBook`.`{_TABLE_NAME}`
        ORDER BY id
        """
    )
    mrs_component.add_cleanup(
        _run_sql,
        phone_book,
        f"DROP PROCEDURE IF EXISTS `PhoneBook`.`{_PROCEDURE_NAME}`",
    )

    _add_rest_object(
        mrs_component,
        phone_book,
        f"""
        CREATE OR REPLACE REST VIEW {_TABLE_PATH}
            ON SERVICE /test SCHEMA /PhoneBook
            AS `PhoneBook`.`{_TABLE_NAME}`
            CLASS ComponentE2EContact @INSERT @UPDATE @DELETE {{
                id: id @KEY,
                name: name
            }}
            AUTHENTICATION NOT REQUIRED;
        """,
        _TABLE_PATH,
    )
    _add_rest_object(
        mrs_component,
        phone_book,
        f"""
        CREATE OR REPLACE REST PROCEDURE {_PROCEDURE_PATH}
            ON SERVICE /test SCHEMA /PhoneBook
            AS `PhoneBook`.`{_PROCEDURE_NAME}`
            AUTHENTICATION NOT REQUIRED;
        """,
        _PROCEDURE_PATH,
    )

    mrs_component.publish_service()
    mrs_component.install()
    mrs_component.wait_until_ready()
    return mrs_component


def test_shell_published_crud_is_served(
    rest_workflow_component,
    phone_book,
):
    component = rest_workflow_component
    table_path = f"/test/PhoneBook{_TABLE_PATH}"
    procedure_path = f"/test/PhoneBook{_PROCEDURE_PATH}"

    response = component.http.wait_for_status(table_path, 200)
    assert response.json()["items"] == []

    response = component.http.request_json(
        "POST",
        table_path,
        {"id": 101, "name": "first"},
    )
    assert response.status == 200, response.text
    assert response.json()["id"] == 101
    assert response.json()["name"] == "first"

    response = component.http.get(f"{table_path}/101")
    assert response.status == 200, response.text
    assert response.json()["name"] == "first"

    response = component.http.request_json(
        "PUT",
        f"{table_path}/101",
        {"id": 101, "name": "updated"},
    )
    assert response.status == 200, response.text
    assert response.json()["name"] == "updated"

    response = component.http.request_json("POST", procedure_path, {})
    assert response.status == 200, response.text
    assert response.json()["resultSets"][0]["items"] == [
        {"id": 101, "name": "updated"}
    ]

    response = component.http.request("DELETE", f"{table_path}/101")
    assert response.status == 200, response.text
    assert response.json()["itemsDeleted"] == 1

    response = component.http.get(f"{table_path}/101")
    assert response.status == 404, response.text

    remaining = phone_book["session"].run_sql(
        f"SELECT COUNT(*) FROM `PhoneBook`.`{_TABLE_NAME}`"
    ).fetch_one()[0]
    assert remaining == 0
