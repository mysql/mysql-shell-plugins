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
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

import uuid

import pytest

from gui_plugin.core.Db import BackendDatabase
from gui_plugin.db_connections import DbConnections
from gui_plugin.db_connections.WorkbenchImport import (
    WorkbenchImportError,
    parse_workbench_document,
)
from gui_plugin.users import UserManagement


@pytest.fixture
def profile_id():
    user_name = f"workbench_import_{uuid.uuid4().hex}"
    user_id = UserManagement.create_user(user_name, "unused", role="User")
    created_profile_id = UserManagement.add_profile(
        user_id,
        {
            "name": "Workbench import test profile",
            "description": "",
            "options": {},
        },
    )
    try:
        yield created_profile_id
    finally:
        with BackendDatabase() as db:
            connection_rows = db.select(
                """SELECT db_connection_id
                FROM profile_has_db_connection
                WHERE profile_id=?""",
                (created_profile_id,),
            )
        for row in connection_rows:
            DbConnections.remove_db_connection(
                created_profile_id,
                row["db_connection_id"],
            )
        UserManagement.delete_profile(user_id, created_profile_id)
        DbConnections.remove_empty_folders()
        groups = UserManagement.list_user_groups(user_id)
        for group in groups:
            group_id = group["id"]
            if group["name"] != user_name:
                UserManagement.remove_user_from_group(user_id, group_id)
                if group_id != 1:
                    UserManagement.remove_user_group(group_id)
        UserManagement.delete_user(user_name)


def workbench_xml(*records):
    return """<?xml version="1.0"?>
<data grt_format="2.0">
  <value type="list" content-type="object"
      content-struct-name="db.mgmt.Connection">
    {}
  </value>
</data>""".format("\n".join(records))


def connection_record(
    *,
    name="Production",
    driver="native",
    host_identifier="Mysql@db.example:3307",
    parameters=None,
):
    parameter_values = {
        "hostName": "db.example",
        "port": "3307",
        "userName": "scott",
        **(parameters or {}),
    }
    parameters_xml = "\n".join(
        f'<value type="string" key="{key}">{value}</value>'
        for key, value in parameter_values.items()
    )

    return f"""
    <value type="object" struct-name="db.mgmt.Connection">
      <link type="object" struct-name="db.mgmt.Driver"
          key="driver">com.mysql.rdbms.mysql.driver.{driver}</link>
      <value type="string" key="hostIdentifier">{host_identifier}</value>
      <value type="dict" key="parameterValues">{parameters_xml}</value>
      <value type="string" key="name">{name}</value>
    </value>"""


def test_parse_preserves_supported_tcp_fields_and_ignores_secrets():
    xml = workbench_xml(
        connection_record(
            name="Group / Production",
            parameters={
                "schema": "employees",
                "SQL_MODE": (
                    "ANSI,INVALID,STRICT_TRANS_TABLES,VALID_2026,"
                    "BAD-MODE,WITH SPACE,vendor_mode1"
                ),
                "sslCA": "/certs/ca.pem",
                "sslCert": "/certs/client.pem",
                "sslKey": "/certs/client-key.pem",
                "sslCipher": "HIGH",
                "useSSL": "3",
                "CLIENT_COMPRESS": "1",
                "password": "do-not-import",
                "sshPassword": "also-do-not-import",
            },
        )
    )

    connections, issues = parse_workbench_document(xml)

    assert connections == [
        {
            "db_type": "MySQL",
            "caption": "Group / Production",
            "description": "scott@db.example:3307",
            "options": {
                "scheme": "mysql",
                "host": "db.example",
                "port": 3307,
                "user": "scott",
                "schema": "employees",
                "sql-mode": [
                    "ANSI",
                    "INVALID",
                    "STRICT_TRANS_TABLES",
                    "VALID_2026",
                    "vendor_mode1",
                ],
                "ssl-ca": "/certs/ca.pem",
                "ssl-cert": "/certs/client.pem",
                "ssl-key": "/certs/client-key.pem",
                "ssl-cipher": "HIGH",
                "ssl-mode": "VERIFY_CA",
                "compression": "PREFERRED",
            },
            "settings": {},
        }
    ]
    assert issues == []
    serialized = repr(connections)
    assert "do-not-import" not in serialized
    assert "also-do-not-import" not in serialized


def test_parse_socket_and_ssh_connections():
    xml = workbench_xml(
        connection_record(
            name="Socket",
            driver="native_socket",
            host_identifier="",
            parameters={
                "hostName": "",
                "port": "",
                "socket": "/tmp/mysql.sock",
                "userName": "root",
            },
        ),
        connection_record(
            name="SSH",
            driver="native_sshtun",
            host_identifier="",
            parameters={
                "sshHost": "jump.example:2200",
                "sshUserName": "tunnel",
                "hostName": "127.0.0.1",
                "port": "3306",
            },
        ),
    )

    connections, issues = parse_workbench_document(xml)

    assert connections[0]["options"] == {
        "scheme": "mysql",
        "host": "",
        "socket": "/tmp/mysql.sock",
        "user": "root",
    }
    assert connections[0]["description"] == "root via /tmp/mysql.sock"
    assert connections[1]["options"]["ssh"] == "tunnel@jump.example:2200"
    assert connections[1]["description"] == (
        "scott@127.0.0.1:3306 via tunnel@jump.example:2200"
    )
    assert issues == []


def test_parse_rejects_malformed_or_unsafe_documents():
    with pytest.raises(WorkbenchImportError, match="Malformed"):
        parse_workbench_document("<data>")

    with pytest.raises(WorkbenchImportError, match="DOCTYPE"):
        parse_workbench_document(
            '<!DOCTYPE data [<!ENTITY x "unsafe">]><data>&x;</data>'
        )

    with pytest.raises(WorkbenchImportError, match="too large"):
        parse_workbench_document(" " * (8 * 1024 * 1024 + 1))


def test_parse_skips_unsupported_drivers():
    xml = workbench_xml(connection_record(driver="unsupported"))

    connections, issues = parse_workbench_document(xml)

    assert connections == []
    assert issues == [{
        "item": "connection 1",
        "message": "Unsupported MySQL Workbench driver unsupported",
    }]


def test_manual_import_is_atomic_and_idempotent(profile_id, monkeypatch):
    def profile_connection_rows():
        with BackendDatabase() as db:
            return db.select(
                """SELECT db_connection_id, folder_path_id, `index`
                FROM profile_has_db_connection
                WHERE profile_id=?
                ORDER BY db_connection_id""",
                (profile_id,),
            )

    xml = workbench_xml(
        connection_record(name="First", parameters={"hostName": "one.example"}),
        connection_record(name="Second", parameters={"hostName": "two.example"}),
    )
    original_connections = DbConnections.list_all(profile_id)
    original_connection_rows = profile_connection_rows()
    original_insert = DbConnections.insert_db_connection
    insert_calls = 0

    def fail_second_insert(db, target_profile_id, connection, folder_path_id):
        nonlocal insert_calls
        insert_calls += 1
        if insert_calls == 2:
            raise RuntimeError("injected insertion failure")

        return original_insert(
            db,
            target_profile_id,
            connection,
            folder_path_id,
        )

    monkeypatch.setattr(
        DbConnections,
        "insert_db_connection",
        fail_second_insert,
    )
    with pytest.raises(RuntimeError, match="injected insertion"):
        DbConnections.import_workbench_connections(profile_id, xml)

    assert DbConnections.list_all(profile_id) == original_connections
    assert profile_connection_rows() == original_connection_rows

    monkeypatch.setattr(
        DbConnections,
        "insert_db_connection",
        original_insert,
    )
    first_report = DbConnections.import_workbench_connections(profile_id, xml)
    second_report = DbConnections.import_workbench_connections(profile_id, xml)

    assert first_report["imported"] == 2
    assert second_report["merged"] == 2
    imported_rows = profile_connection_rows()
    assert len(imported_rows) == len(original_connection_rows) + 2
