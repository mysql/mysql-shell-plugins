# Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

import shutil
from gui_plugin.core.Db import GuiBackendDb, BackendSqliteDbManager, convert_workbench_sql_file_to_sqlite, convert_all_workbench_sql_files_to_sqlite
import datetime
import os
import sqlite3
import tempfile
import contextlib
import difflib
import pytest
import re


def test_GuiBackendDb_init():
    backend_db = GuiBackendDb()
    backend_db.select("SELECT * FROM log")

    backend_db2 = GuiBackendDb()
    backend_db2.select("SELECT * FROM log")


def test_GuiBackendDb_commit():
    backend_db = GuiBackendDb()

    result = backend_db.execute('''SELECT COUNT(*) FROM log''').fetch_one()
    count_step_1 = result[0]

    backend_db.start_transaction()
    backend_db.execute('''INSERT INTO log(event_time, event_type,
            message) VALUES(?, ?, ?)''',
                       (datetime.datetime.now(), 'INFO', '__TEST MESSAGE__'))
    id = backend_db.get_last_row_id()
    backend_db.commit()

    result = backend_db.execute('''SELECT COUNT(*) FROM log''').fetch_one()
    count_step_2 = result[0]

    backend_db.start_transaction()
    backend_db.execute('''DELETE FROM log WHERE id=?''', (id,))

    result = backend_db.execute('''SELECT COUNT(*) FROM log''').fetch_one()
    count_step_3 = result[0]
    backend_db.commit()

    assert count_step_1 == count_step_2 - 1
    assert count_step_1 == count_step_3

    backend_db.close()


def test_GuiBackendDb_rollback():
    backend_db = GuiBackendDb()

    result = backend_db.execute('''SELECT COUNT(*) FROM log''').fetch_one()
    count_step_1 = result[0]

    backend_db.start_transaction()
    backend_db.execute('''INSERT INTO log(event_time, event_type,
            message) VALUES(?, ?, ?)''',
                       (datetime.datetime.now(), 'INFO', '__TEST MESSAGE__'))
    backend_db.rollback()

    result = backend_db.execute('''SELECT COUNT(*) FROM log''').fetch_one()
    count_step_2 = result[0]

    assert count_step_1 == count_step_2

    backend_db.close()


def test_GuiBackendDb_insert():
    backend_db = GuiBackendDb()

    result = backend_db.execute('''SELECT COUNT(*) FROM log''').fetch_one()
    count_step_1 = result[0]

    backend_db.start_transaction()
    backend_db.insert('''INSERT INTO log(event_time, event_type,
            message) VALUES(?, ?, ?)''',
                      (datetime.datetime.now(), 'INFO', '__TEST MESSAGE__'))
    id = backend_db.get_last_row_id()
    backend_db.commit()

    result = backend_db.execute('''SELECT COUNT(*) FROM log''').fetch_one()
    count_step_2 = result[0]

    backend_db.start_transaction()
    backend_db.execute('''DELETE FROM log WHERE id=?''', (id,))
    backend_db.commit()

    result = backend_db.execute('''SELECT COUNT(*) FROM log''').fetch_one()
    count_step_3 = result[0]

    assert count_step_2 == count_step_1 + 1
    assert count_step_1 == count_step_3

    backend_db.close()


def test_GuiBackendDb_select_rows():
    backend_db = GuiBackendDb()

    result = backend_db.select('''SELECT * FROM data_category''')

    assert len(result) > 0

    backend_db.close()


def test_GuiBackendDb_check_for_previous_version_and_upgrade():
    backend_db = BackendSqliteDbManager()

    result = backend_db.check_for_previous_version_and_upgrade()

    assert result == True


def test_GuiBackendDb_convert_workbench_sql_file_to_sqlite():
    original_file = os.path.join(
        'gui_plugin', 'internal', 'db_schema', 'mysqlsh_gui_backend_0.0.11.mysql.sql')
    source_file = os.path.join(
        'gui_plugin', 'core', 'db_schema', 'mysqlsh_gui_backend_0.0.99.test.mysql.sql')
    target_file = os.path.join(
        'gui_plugin', 'core', 'db_schema', 'mysqlsh_gui_backend_0.0.99.test.sqlite.sql')

    if os.path.exists(source_file):
        os.remove(source_file)

    if os.path.exists(target_file):
        os.remove(target_file)

    assert not os.path.exists(source_file)
    assert not os.path.exists(target_file)

    shutil.copyfile(original_file, source_file)

    assert os.path.exists(source_file)

    convert_workbench_sql_file_to_sqlite(source_file)

    assert os.path.exists(target_file)

    if os.path.exists(source_file):
        os.remove(source_file)

    if os.path.exists(target_file):
        os.remove(target_file)


def test_upgrade_db():
    current_create_script = os.path.join(
        'gui_plugin', 'core', 'db_schema', f'mysqlsh_gui_backend.sqlite.sql')
    assert os.path.exists(current_create_script)

    old_db_create_script = os.path.join(
        'gui_plugin', 'internal', 'db_schema', f'mysqlsh_gui_backend_0.0.11.sqlite.sql')
    assert os.path.exists(old_db_create_script)

    with tempfile.TemporaryDirectory() as tmpdirname:
        current_dump_file = os.path.join(tmpdirname, "current.sql")
        upgraded_dump_file = os.path.join(tmpdirname, "upgraded.sql")
        conn = sqlite3.connect(os.path.join(tmpdirname, "mysqlsh_gui_backend.sqlite3"))
        cur = conn.cursor()
        with open(current_create_script, 'r') as sql_file:
            sql_create = sql_file.read()

        try:
            cur.executescript(sql_create)
        except Exception as e:
            pytest.fail(str(e))

        with open(current_dump_file, 'w') as f:
            for line in conn.iterdump():
                f.write(f"{line}\n")

        conn.close()

        os.remove(os.path.join(tmpdirname, "mysqlsh_gui_backend.sqlite3"))
        with contextlib.suppress(FileNotFoundError):
            os.remove(os.path.join(tmpdirname, "mysqlsh_gui_backend_log.sqlite3"))

        conn = sqlite3.connect(os.path.join(tmpdirname, "mysqlsh_gui_backend_0.0.11.sqlite3"))
        cur = conn.cursor()
        with open(old_db_create_script, 'r') as sql_file:
            sql_create = sql_file.read()

        try:
            cur.executescript(sql_create)
        except Exception as e:
            pytest.fail(str(e))

        conn.close()

        connection_options = {"db_dir": tmpdirname,
                             "database_name": "main",
                             "db_file": os.path.join(tmpdirname, f'mysqlsh_gui_backend.sqlite3')}
        BackendSqliteDbManager(log_rotation=False,
                               session_uuid=None,
                               connection_options=connection_options)

        conn = sqlite3.connect(os.path.join(tmpdirname, "mysqlsh_gui_backend.sqlite3"))
        with open(upgraded_dump_file, 'w') as f:
            for line in conn.iterdump():
                f.write(f"{line}\n")

        conn.close()
        normalize_sql_file(current_dump_file)
        normalize_sql_file(upgraded_dump_file)
        with open(upgraded_dump_file, 'r') as f1, open(current_dump_file, 'r') as f2:
            diff = difflib.context_diff(f1.readlines(), f2.readlines())
            assert ''.join(diff) == ''



def normalize_sql_file(file):
    normalized = []
    indexes = []
    with open(file, 'r') as f:
        lines = f.readlines()
        for line in lines:
            if line.startswith("CREATE TABLE \""):
                line = line.replace("\"", "`")
            if re.match(r'CREATE .*INDEX ', line):
                indexes.append(line)
            else:
                normalized.append(line)

    with open(file, 'w') as f:
        for line in normalized:
            # Put sorted indexes before COMMIT line
            if line.startswith("COMMIT"):
                indexes = sorted(indexes, key=str.lower)
                for l in indexes:
                    f.write(l)
            f.write(line)


def test_backup_logs():
    current_dir = os.getcwd()
    current_create_script = os.path.join(
        current_dir, 'gui_plugin', 'core', 'db_schema', f'mysqlsh_gui_backend.sqlite.sql')
    assert os.path.exists(current_create_script)

    with tempfile.TemporaryDirectory() as tmpdirname:
        os.chdir(tmpdirname)
        conn = sqlite3.connect(os.path.join(tmpdirname, "mysqlsh_gui_backend.sqlite3"))
        cur = conn.cursor()
        with open(current_create_script, 'r') as sql_file:
            sql_create = sql_file.read()

        try:
            cur.executescript(sql_create)
        except Exception as e:
            pytest.fail(str(e))
        conn.close()

        assert os.path.exists(os.path.join(tmpdirname, "mysqlsh_gui_backend_log.sqlite3"))
        connection_options = {"db_dir": tmpdirname,
                             "database_name": "main",
                             "db_file": os.path.join(tmpdirname, f'mysqlsh_gui_backend.sqlite3'),
                             "attach": [
                                    {
                                        "database_name": "gui_log",
                                        "db_file": os.path.join(tmpdirname, f'mysqlsh_gui_backend_log.sqlite3')
                                    }]}
        db_manager = BackendSqliteDbManager(log_rotation=False,
                                            session_uuid=None,
                                            connection_options=connection_options)

        db = db_manager.open_database()
        try:
            db_manager.backup_logs(db)
        finally:
            db.close()

        backup_file = os.path.join(tmpdirname,
                                     f"mysqlsh_gui_backend_log_{datetime.date.today().strftime('%Y.%m.%d')}.sqlite3")

        os.chdir(current_dir)
        assert os.path.exists(backup_file)
