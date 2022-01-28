# Copyright (c) 2020, 2021, Oracle and/or its affiliates.
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
from gui_plugin.dbconnections import DbConnections
import config

def validate_response(response):
    assert not response is None
    assert "request_state" in response

    request_state = response['request_state']

    assert "type" in request_state
    assert "msg" in request_state
    assert isinstance(request_state['type'], str)
    assert isinstance(request_state['msg'], str)
    assert request_state['type'] == "OK"


def validate_rows(rows, validate_function):
    assert len(rows) > 0

    for row in rows:
        validate_function(row)


def validate_connection_row(row):
    assert "id" in row
    assert "folder_path" in row
    assert "caption" in row
    assert "description" in row
    assert "db_type" in row

    assert isinstance(row["id"], int)
    assert row["id"] > 0

    assert isinstance(row["folder_path"], str)
    assert isinstance(row["caption"], str)
    assert isinstance(row["caption"], str)
    assert isinstance(row["description"], str)

    assert isinstance(row["db_type"], str)
    assert row["db_type"] in ['MySQL', 'Sqlite']


def validate_db_type_row(type):
    assert isinstance(type, str)
    assert type in ('MySQL', 'Sqlite')


def test_db_types():
    results = DbConnections.get_db_types()

    validate_response(results)
    validate_rows(results['db_type'], validate_db_type_row)


# def test_list():
#     results = DbConnections.list_db_connections(1)

#     validate_response(results)
#     validate_rows(results['rows'], validate_connection_row)

# def test_get_db_connection():
#     connection_id = 1
#     connection = DbConnections.get_db_connection(connection_id)

#     assert connection
#     assert 'rows' in connection
#     assert len(connection['rows']) > 0
#     assert len(connection['rows'][0]) > 0
#     assert connection['rows'][0]['id'] == connection_id


class TestDbConnectionsSqlite:
    def test_add_db_connection(self):
        results1 = DbConnections.list_db_connections(1, 'tests')

        result = DbConnections.add_db_connection(1, {
            "db_type": 'Sqlite',
            "caption": "This is a test sqlite3 database",
            "description": "This is a test sqlite3 database description",
            "options": {
                "db_file": "tests.sqlite3",
                "attach": {
                    "database_name": "testdb1",
                    "db_file": "tests.attachment.sqlite3"
                }
            }
        }, 'tests')

        results2 = DbConnections.list_db_connections(1, 'tests')

        validate_response(results2)
        validate_rows(results2['rows'], validate_connection_row)

        assert len(results2['rows']) == len(results1['rows']) + 1

        DbConnections.remove_db_connection(1, result['result']['db_connection_id'])
        results3 = DbConnections.list_db_connections(1, 'tests')

        assert len(results3['rows']) == len(results1['rows'])

    def test_update_db_connection(self):
        result = DbConnections.add_db_connection(1, {
            "db_type": 'Sqlite',
            "caption": "This is a test sqlite3 database",
            "description": "This is a test sqlite3 database description",
            "options": {
                "db_file": "tests.sqlite3"
            }
        }, 'tests')

        connection_id = result['result']['db_connection_id']

        DbConnections.update_db_connection(1, connection_id, {"caption": "Altered caption"})
        latest = DbConnections.get_db_connection(connection_id)['rows'][0]

        assert latest['caption'] == "Altered caption"
        assert latest['description'] == "This is a test sqlite3 database description"
        assert latest['options'] == {
                "db_file": "tests.sqlite3"
            }

        DbConnections.update_db_connection(1, connection_id, {"description": "Altered description"})
        latest = DbConnections.get_db_connection(connection_id)['rows'][0]

        assert latest['caption'] == "Altered caption"
        assert latest['description'] == "Altered description"
        assert latest['options'] == {
                "db_file": "tests.sqlite3"
            }

        DbConnections.update_db_connection(1, connection_id, {"options": {"item": "empty"}})
        latest = DbConnections.get_db_connection(connection_id)['rows'][0]

        assert latest['caption'] == "Altered caption"
        assert latest['description'] == "Altered description"
        assert latest['options'] == {"item": "empty"}


class TestDbConnectionMySQL:

    def test_add_db_connection_mysql(self):
        results1 = DbConnections.list_db_connections(1, 'tests')
        default_root_config = config.Config.get_instance().database_connections[0]

        result = DbConnections.add_db_connection(1, {
            "db_type": default_root_config['type'],
            "caption": "This is a test MySQL database",
            "description": "This is a test MySQL database description",
            "options": {
                'host': default_root_config['options']['host'],
                'port': default_root_config['options']['port'],
                'user': default_root_config['options']['user'],
                'password': default_root_config['options']['password'],
                'scheme': default_root_config['options']['scheme']
            }
        }, 'tests')

        results2 = DbConnections.list_db_connections(1, 'tests')

        validate_response(results2)
        validate_rows(results2['rows'], validate_connection_row)

        assert len(results2['rows']) == len(results1['rows']) + 1

        DbConnections.remove_db_connection(1, result['result']['db_connection_id'])
        results3 = DbConnections.list_db_connections(1, 'tests')

        assert len(results3['rows']) == len(results1['rows'])


