# Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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
import config
import os
import sys
import subprocess
import uuid
from contextlib import contextmanager
import inspect
import logging
import mysqlsh
import signal
import gui_plugin.core.Logger as logger
from gui_plugin.users import backend as user_handler
from gui_plugin.core.Db import GuiBackendDb
from tests.tests_timeouts import server_timeout
import gui_plugin.core.Logger as logger


def signal_handler(sig, frame):
    logger.debug(f'2) Ctrl+C! captured: {sig}')


if os.name == 'nt':
    signal.signal(signal.SIGINT, signal_handler)


def debug_info():
    frame = inspect.stack()[1]
    return f"{frame[0].f_code.co_name}:{frame[2]}"


server_token = str(uuid.uuid1())
port, nossl = config.Config.get_instance().get_server_params()
server_params = [(port, nossl)]
default_server_connection_string = config.Config.get_instance(
).get_default_mysql_connection_string()

FORMAT = "[%(asctime)-15s][%(levelname)s] %(message)s"
logging.basicConfig(level=logging.DEBUG, format=FORMAT,
                    filename=("./TestWebSocket.log"))
file_logger = logging.getLogger("TestWebSocket")


@pytest.fixture(scope="session")
def create_users():
    db = GuiBackendDb()
    users = {
        "admin1": {
            "password": "admin1",
            "role": "Administrator"
        },
        "admin2": {
            "password": "admin2",
            "role": "Administrator"
        },
        "power1": {
            "password": "power1",
            "role": "Poweruser"
        },
        "power2": {
            "password": "power2",
            "role": "Poweruser"
        },
        "user1": {
            "password": "user1",
            "role": "User"
        },
        "user2": {
            "password": "user2",
            "role": "User"
        },
        "user3": {
            "password": "user3",
            "role": "User"
        },
    }

    def user_exists(user, user_list):
        for stock_user in user_list:
            if stock_user['name'] == user:
                return True
        return False

    user_list = user_handler.list_users(db)

    try:
        db.start_transaction()
        for key, value in users.items():
            if not user_exists(key, user_list):
                user_id = user_handler.create_user(db,
                                                   key, value['password'], value['role'])

                if key == "admin1":
                    user_dir = mysqlsh.plugin_manager.general.get_shell_user_dir(  # pylint: disable=no-member
                        'plugin_data', 'gui_plugin', f'user_{user_id}')
                    os.makedirs(os.path.join(
                        user_dir, "directory1", "subdirectory1"))
                    os.makedirs(os.path.join(user_dir, "inaccessible"))
                    os.chmod(os.path.join(user_dir, "inaccessible"), 0o077)

                    with open(os.path.join(user_dir, "some_file"), "w+") as f:
                        f.write("some text")
                    with open(os.path.join(user_dir, "directory1", "subdirectory1", "file1"), "w+") as f:
                        f.write("some text")
                    with open(os.path.join(user_dir, "directory1", "subdirectory1", "file2"), "w+") as f:
                        f.write("some text")
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


@pytest.fixture(scope="session")
def create_test_schema():
    path, _ = os.path.split(os.path.abspath(__file__))
    sql_script_create_path = os.path.join(
        path, "data", "create_test_schema.sql")

    executable = sys.executable
    if 'executable' in dir(mysqlsh):
        executable = mysqlsh.executable

    command = executable if executable.endswith(
        "mysqlsh") or executable.endswith("mysqlsh.exe") else "mysqlsh"

    subprocess.run([command, default_server_connection_string, '-f',
                    f'{sql_script_create_path}'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    yield

    sql_script_drop_path = os.path.join(path, "data", "drop_test_schema.sql")
    subprocess.run([command, default_server_connection_string, '-f',
                    f'{sql_script_drop_path}'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def get_logger():
    global file_logger
    return file_logger


@pytest.fixture(scope="class")
def clear_module_data_tables():
    db = GuiBackendDb()
    try:
        db.start_transaction()
        db.execute("""DELETE FROM data_user_group_tree;""")
        db.execute("""DELETE FROM data_profile_tree;""")
        db.execute("""DELETE FROM data;""")
        db.execute("""DELETE FROM data_category WHERE id > 100;""")
        db.execute("""DELETE FROM data_folder_has_data;""")
        db.execute("""DELETE FROM data_folder;""")
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()
