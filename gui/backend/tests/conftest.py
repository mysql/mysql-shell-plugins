# Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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
import websocket
import json
import config
import os
import sys
import time
import subprocess
from subprocess import Popen, TimeoutExpired
import ssl
import uuid
import time
from contextlib import contextmanager
import types
import inspect
import logging
import mysqlsh
import signal
import threading
from queue import Queue, Empty
import gui_plugin.core.Logger as logger
from gui_plugin.users import backend as user_handler
from gui_plugin.core.Db import GuiBackendDb
import gui_plugin.debug_utils
from tests.tests_timeouts import server_timeout
import gui_plugin.core.Logger as logger


def signal_handler(sig, frame):
    logger.debug(f'2) Ctrl+C! captured: {sig}')


if os.name == 'nt':
    signal.signal(signal.SIGINT, signal_handler)


class UnableToConnect(Exception):
    def __init__(self):
        Exception.__init__(self, "Unable to connect to the backend")


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


def is_secure_server(token=None):
    if hasattr(is_secure_server, "result"):
        return is_secure_server.result

    try:
        # Attempt to connect to a secure socket
        url = f"wss://localhost:8000/ws1.ws?token={token}" if token else "wss://localhost:8000/ws1.ws"
        ws = websocket.create_connection(
            url, sslopt={"cert_reqs": ssl.CERT_NONE})
        ws.close()
        is_secure_server.result = True
    except ssl.SSLError as e:
        if e.reason == 'WRONG_VERSION_NUMBER':
            is_secure_server.result = False
    except ConnectionRefusedError as e:
        return None

    return is_secure_server.result


def create_socket_connection(cookie=None, token=None):
    ''' Create a socket to the backend. It first attempts to
    create a secure socket and on failure, attempts an
    insecure socket'''
    secure = is_secure_server(token)

    if secure is None:
        return None

    try:
        if is_secure_server():
            # Attempt to connect to a secure socket
            # cspell:ignore reqs
            url = f"wss://localhost:{port}/ws1.ws?token={token}" if token else f"wss://localhost:{port}/ws1.ws"
            return websocket.create_connection(url, cookie=cookie,
                                               sslopt={"cert_reqs": ssl.CERT_NONE})

        # Attempt to connect to an insecure socket
        url = f"ws://localhost:{port}/ws1.ws?token={token}" if token else f"ws://localhost:{port}/ws1.ws"
        return websocket.create_connection(url, cookie=cookie)
    except ConnectionRefusedError as e:
        if e.errno != 111:
            logger.exception(e,
                f"\n=========[EXCEPTION]=========\n{debug_info()}\n{str(e)}\n-----------------------------")
            raise

    except Exception as e:
        logger.exception(e,
            f"\n=========[EXCEPTION]=========\n{debug_info()}\n{str(e)}\n-----------------------------")
        raise

    return None


def connect_and_get_session(session_id=None, cookie=None, token=None):
    if session_id:
        if cookie:
            cookie = f"{cookie};SessionId={session_id}"
        else:
            cookie = f"SessionId={session_id}"

    ws = create_socket_connection(cookie, token)

    assert ws
    assert ws.connected

    queue = Queue()

    def receive_frame():
        try:
            data = json.loads(ws.recv())
            queue.put(data)
        except Exception as e:
            logger.error(
                f"connect_and_get_session.receive_frame exception - {str(e)}")

    threading.Thread(
        target=receive_frame).start()

    try:
        data = queue.get(block=True, timeout=10)
    except Empty:
        logger.error("Timeout waiting for a session start")
        raise
    # data = json.loads(ws.recv())

    assert data['request_state']['type'] == "OK"

    if session_id:
        assert data['session_uuid'] == session_id
        assert data['request_state']['msg'] == "Session recovered"
        assert data['active_profile']
    else:
        assert data['request_state']['msg'] == "A new session has been created"

    return (ws, data['session_uuid'])


def shell_authenticate(socket, user):
    # Authenticate
    request = {}
    request['request'] = "authenticate"
    request['username'] = user
    request['password'] = user
    request['request_id'] = str(uuid.uuid1())
    socket.send(json.dumps(request))
    data = json.loads(socket.recv())

    assert(data['request_id'] == request['request_id'])
    assert data['request_state']['type'] == "OK", data['request_state']['msg']
    assert data['request_state']['msg'] == f"User {user} was successfully authenticated."


@contextmanager
def open_backend_socket(cookie=None, token=None):
    socket = create_socket_connection(cookie, token)

    if socket is None:
        raise UnableToConnect

    try:
        yield socket
    finally:
        if socket and socket.connected:
            socket.close()


@contextmanager
def open_backend_session(session_id=None, cookie=None):
    socket, session_id = connect_and_get_session(session_id, cookie)

    try:
        yield (socket, session_id)
    finally:
        socket.close()


@contextmanager
def authenticated_user(user):
    with open_backend_session() as (ws, session_id):
        shell_authenticate(ws, user)
        yield (ws, session_id)


def start_server(request, server_token=None):
    logger.info(f"Request to start a new shell with web server")
    p = None
    # if we can connect a socket, then we already have a server
    # running, maybe a debug server.
    try:
        with open_backend_socket():
            if 'COV_CORE_DATAFILE' in os.environ:
                pytest.exit(
                    'A server is already running while doing coverage. Stopping the tests.')
            logger.info("A server is already running. The tests will use that one.")

            # yield None

            return None
    except UnableToConnect as e:
        # Don't do anything. The server is down so we just need to launch it.
        pass
    except Exception as e:
        if 'Stopping the tests' in str(e):
            # A running server exists while we're trying to do coverage. We can't connect to the server
            # for coverage report.
            raise e
        logger.exception(e,
            f"\n=========[EXCEPTION]=========\n{debug_info()}\n{str(e)}\n-----------------------------")

    port, nossl = request.param
    parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    logger.debug(f"conftest - parent_dir: {parent_dir}")
    webroot_path = "'" + os.path.join(
        parent_dir, 'gui_plugin', 'core', 'webroot') + "'"

    logger.debug(f"conftest - webroot_path: {webroot_path}")
    server_token_param = 'None' if server_token is None else f"'{server_token}'"

    command_script = f'import gui_plugin.debug_utils; import gui_plugin.start; gui_plugin.start.web_server(port={port}, webrootpath={webroot_path}, single_instance_token={server_token_param})'
    from pathlib import Path
    command_script = Path(command_script).as_posix()
    logger.debug(f"conftest - command_script: {command_script}")
    command_args = [sys.executable, '--py', '-e', command_script]
    logger.debug(command_args)
    p = None
    try:
        p = subprocess.Popen(command_args, env=os.environ,
                             creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0)
    except Exception as e:
        logger.exception(e)

    for sec in range(server_timeout()):
        try:
            with open_backend_socket(token=server_token):
                break
        except:
            # if the websocket is not available, then the server might not
            # be running. Assert if can't connect after 10 seconds
            assert sec < server_timeout() - \
                1, f"Could not connect to the backend server, is it running?\n{p.stdout}"
            time.sleep(1)

    return p


@pytest.fixture(scope="module", params=server_params)
def shell_start_server(request):
    p = start_server(request)

    yield p

    logger.info("sending sigint to the shell subprocess")
    os.kill(p.pid,
    signal.CTRL_BREAK_EVENT if hasattr(signal, 'CTRL_BREAK_EVENT') else signal.SIGINT)

    logger.info(f"Waiting for server to shutdown")
    p.wait()
    logger.info(f"Done waiting for server shutdown")


@pytest.fixture(scope="module")
def shell_connect(shell_start_server):
    ws, session_id = connect_and_get_session()

    ws.headers['Cookie'] = "SessionId=%s" % session_id

    def send_json(self, request):
        self.send(request.dumps(request))

    def receive_json(self):
        return json.loads(self.recv())

    ws.send_json = types.MethodType(send_json, ws)
    ws.receive_json = types.MethodType(receive_json, ws)

    yield (ws, session_id)

    ws.close()


@pytest.fixture(scope="module", params=server_params)
def shell_start_local_user_mode_server(request):
    p = start_server(request, server_token)

    yield (p, server_token)

    if hasattr(signal, 'CTRL_C_EVENT'):
        # windows. Need CTRL_C_EVENT to raise the signal in the whole process group
        os.kill(p.pid, signal.CTRL_C_EVENT) # pylint: disable=no-member
    else:
        p.send_signal(signal.SIGINT)
    logger.info(f"Waiting for server to shutdown")
    p.wait()
    logger.info(f"Done waiting for server shutdown")


@pytest.fixture(scope="module")
def shell_connect_local_user_mode(shell_start_local_user_mode_server):
    ws, session_id = connect_and_get_session(token=server_token)

    ws.headers['Cookie'] = "SessionId=%s" % session_id

    yield (ws, session_id, server_token)

    ws.close()


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
        for stock_user in user_list['rows']:
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
                    user_dir = mysqlsh.plugin_manager.general.get_shell_user_dir( # pylint: disable=no-member
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
    command = sys.executable if sys.executable else "mysqlsh"
    subprocess.run([command, default_server_connection_string, '-f',
                    f'{sql_script_create_path}'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    yield

    sql_script_drop_path = os.path.join(path, "data", "drop_test_schema.sql")
    subprocess.run([command, default_server_connection_string, '-f',
                    f'{sql_script_drop_path}'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)


@pytest.fixture(scope='function')
def authenticate_admin1(shell_start_server, create_users):
    with authenticated_user("admin1") as (ws, session_id):
        yield (ws, session_id)


@pytest.fixture(scope='function')
def authenticate_user1(shell_start_server, create_users):
    with authenticated_user("user1") as (ws, session_id):
        yield (ws, session_id)


def get_logger():
    global file_logger
    return file_logger


def print_user_story_stack_trace(ws, exc):
    import traceback
    import sys
    _, _, exc_traceback = sys.exc_info()
    stack = traceback.format_exception(Exception, exc, exc_traceback)
    logger.debug("----------------------------------------------------------------------------------------------")
    logger.debug("User story stack trace")
    logger.debug("----------------------------------------------------------------------------------------------")
    for line in stack:
        if line.find('  File "<string>"') > -1:
            importanat_parts = line.replace(
                '  File "<string>"', f'File: "{ws._story_stack[0]}"').split(", ")
            logger.debug(f"{importanat_parts[0]}: {importanat_parts[1]}")
            ws._story_stack = ws._story_stack[1:]
    logger.debug("----------------------------------------------------------------------------------------------")


# This decorator changes a callback to validate the basic
# things to check responses from the DbSession.
# This also allows for the caller test to set the expected amount
# of times the callback should be called and wait for it by
# specifying a timeout. This makes sure the test won't dead lock.
# The checks in the callback are made in a later stage, so that the
# asserts won't raise exceptions in DbSession, but in the test.
def backend_callback(expected_response_count=2, options=None):
    def decorator(function):
        def reset(self):
            self.current_response = 0
            self.total_responses = 0
            self.responses = []
            self.request_id = str(uuid.uuid1())
            self.finished = threading.Event()
            self.options = options if not options is None else {
                "row_packet_size": 25
            }

        def join(self, timeout=server_timeout()):
            if not self.finished.wait(timeout):
                raise Exception("Timeout waiting for operation to finish")

        def join_and_validate(self, timeout=server_timeout()):
            self.join(timeout)

            self.current_response = 0
            for response in self.responses:
                assert response["request_id"] == wrapper.request_id # pylint: disable=no-member

                function(response["state"], response["message"],
                         response["request_id"], response["values"])
                self.current_response += 1

        def wrapper(state, message, request_id, values):
            wrapper.responses.append({ # pylint: disable=no-member
                "state": state,
                "message": message,
                "request_id": request_id,
                "values": values
            })
            wrapper.total_responses += 1 # pylint: disable=no-member
            if wrapper.total_responses == expected_response_count: # pylint: disable=no-member
                wrapper.finished.set() # pylint: disable=no-member

        wrapper.reset = types.MethodType(reset, wrapper)
        wrapper.join = types.MethodType(join, wrapper)
        wrapper.join_and_validate = types.MethodType(
            join_and_validate, wrapper)

        wrapper.reset() # pylint: disable=not-callable

        return wrapper
    return decorator

# Same as the backend_callback, but expects a first "PENDING" response
# and validates it.


def backend_callback_with_pending(expected_response_count=1, options=None):
    def decorator(function):
        wrapper = backend_callback(
            expected_response_count + 1, options)(function)

        def join_and_validate(self, timeout=5):
            self.join(timeout)

            # Validate 'PENDING' message
            assert self.responses[0]["request_id"] == wrapper.request_id # pylint: disable=no-member

            assert self.responses[0]["state"] == "PENDING"
            assert self.responses[0]["message"] == "Execution started..."
            assert self.responses[0]["values"] is None

            self.current_response = 1
            for response in self.responses[1:]:
                assert response["request_id"] == wrapper.request_id # pylint: disable=no-member

                function(response["state"], response["message"],
                         response["request_id"], response["values"])

                self.current_response += 1

        wrapper.join_and_validate = types.MethodType(
            join_and_validate, wrapper)
        return wrapper
    return decorator


@pytest.fixture(scope="function")
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
