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
import config
import mysqlsh
import pytest

@pytest.fixture(scope="module")
def shell_session():
    conn = config.Config.get_instance().database_connections[0]['options'].copy()
    conn_str = f"{conn['user']}:{conn['password']}@{conn['host']}:{conn['port']}"
    mysqlsh.globals.shell.connect(conn_str)
    session = mysqlsh.globals.session

    yield session

    session.close()

@pytest.mark.usefixtures("shell_session")
def test_get_object_types_by_shell(shell_session):
    result = mysqlsh.globals.gui.db.get_objects_types(shell_session)
    assert result == [{"name": "Schema", "type": "CATALOG_OBJECT"},
                        {"name": "User Variable", "type": "CATALOG_OBJECT"},
                        {"name": "User", "type": "CATALOG_OBJECT"},
                        {"name": "Engine", "type": "CATALOG_OBJECT"},
                        {"name": "Plugin", "type": "CATALOG_OBJECT"},
                        {"name": "Character Set", "type": "CATALOG_OBJECT"},
                        {"name": "Table", "type": "SCHEMA_OBJECT"},
                        {"name": "View", "type": "SCHEMA_OBJECT"},
                        {"name": "Routine", "type": "SCHEMA_OBJECT"},
                        {"name": "Event", "type": "SCHEMA_OBJECT"},
                        {"name": "Trigger", "type": "TABLE_OBJECT"},
                        {"name": "Foreign Key", "type": "TABLE_OBJECT"},
                        {"name": "Primary Key", "type": "TABLE_OBJECT"},
                        {"name": "Index", "type": "TABLE_OBJECT"},
                        {"name": "Column", "type": "TABLE_OBJECT"}]


@pytest.mark.usefixtures("shell_session")
def test_get_catalog_object_names_by_shell(shell_session):
    result = mysqlsh.globals.gui.db.get_catalog_object_names(shell_session, "Schema")
    schemas = [row[0] for row in result.fetch_all()]
    assert all(schema in schemas for schema in ['information_schema', 'performance_schema'])

    result = mysqlsh.globals.gui.db.get_catalog_object_names(shell_session, "Character Set")
    assert 'utf8mb4' in [row[0] for row in result.fetch_all()]


@pytest.mark.usefixtures("shell_session")
def test_get_catalog_object_by_shell(shell_session):
    result = mysqlsh.globals.gui.db.get_catalog_object(shell_session, "Schema", "information_schema")
    assert "name" in result
    assert result["name"] == "information_schema"

    result = mysqlsh.globals.gui.db.get_catalog_object(shell_session, "Character Set", "ascii")
    assert "name" in result
    assert result["name"] == "ascii"


@pytest.mark.usefixtures("shell_session")
def test_get_schema_object_names_by_shell(shell_session):
    result = mysqlsh.globals.gui.db.get_schema_object_names(shell_session, "Table", "mysql")
    tables = [row[0] for row in result.fetch_all()]
    assert all(table in tables for table in ['db', 'user'])


@pytest.mark.usefixtures("shell_session")
def test_get_schema_object_by_shell(shell_session):
    result = mysqlsh.globals.gui.db.get_schema_object(shell_session, "Table", "mysql", "user")
    assert "name" in result
    assert "columns" in result
    assert result["name"] == "user"
    assert all(col in result["columns"] for col in ['Host', 'User'])


@pytest.mark.usefixtures("shell_session")
def test_get_table_object_names_by_shell(shell_session):
    result = mysqlsh.globals.gui.db.get_table_object_names(shell_session, "Index", "mysql", "user")
    indexes = [row[0] for row in result.fetch_all()]
    assert 'PRIMARY' in indexes


@pytest.mark.usefixtures("shell_session")
def test_get_table_object_by_shell(shell_session):
    result = mysqlsh.globals.gui.db.get_table_object(shell_session, "Index", "mysql", "user", "PRIMARY")
    assert "name" in result
    assert result["name"] == "PRIMARY"


@pytest.mark.usefixtures("shell_session")
def test_get_schema_object_names_by_shell(shell_session):
    # Test tables in mysql schema
    result = mysqlsh.globals.gui.db.get_schema_object_names(shell_session, "Table", "mysql")
    tables = [row[0] for row in result.fetch_all()]
    assert len(tables) > 0
    assert "user" in tables
    assert "db" in tables
