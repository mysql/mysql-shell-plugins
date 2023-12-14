# Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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

import websocket
import ssl
import inspect
import gui_plugin.core.Logger as logger
import config
import threading
from queue import Queue, Empty
import json
from contextlib import contextmanager
import uuid
import subprocess
import pytest
import os
from tests.tests_timeouts import server_timeout
import time
import sys
import types
import tempfile
import mysqlsh

port, nossl = config.Config.get_instance().get_server_params()


class UnableToConnect(Exception):
    def __init__(self):
        Exception.__init__(self, "Unable to connect to the backend")


def debug_info():
    frame = inspect.stack()[1]
    return f"{frame[0].f_code.co_name}:{frame[2]}"


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

    assert (data['request_id'] == request['request_id'])
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
            logger.info(
                "A server is already running. The tests will use that one.")

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
    parent_dir = os.path.dirname(os.path.dirname(
        os.path.dirname(os.path.abspath(__file__))))
    logger.debug(f"conftest - parent_dir: {parent_dir}")
    webroot_path = "'" + os.path.join(
        parent_dir, 'gui_plugin', 'core', 'webroot') + "'"

    # if the default path does not exist, we create a temporary one
    if not os.path.exists(webroot_path):
        webroot_path = tempfile.mkdtemp()
        with open(os.path.join(webroot_path, 'index.html'), 'w') as f:
            f.writelines(['<html>', '<head></head>', '<body></body>'])

    logger.debug(f"conftest - webroot_path: {webroot_path}")
    server_token_param = 'None' if server_token is None else f"'{server_token}'"

    command_script = f'import gui_plugin.debug_utils; import gui_plugin.start; gui_plugin.start.web_server(port={port}, webrootpath="{webroot_path}", single_instance_token={server_token_param})'
    from pathlib import Path
    command_script = Path(command_script).as_posix()
    logger.debug(f"conftest - command_script: {command_script}")

    executable = sys.executable
    if 'executable' in dir(mysqlsh):
        executable = mysqlsh.executable

    command_args = [executable, '--py', '-e', command_script]
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
                assert response["request_id"] == wrapper.request_id  # pylint: disable=no-member

                function(response["state"], response["message"],
                         response["request_id"], response["values"])
                self.current_response += 1

        def wrapper(state, message, request_id, values):
            wrapper.responses.append({  # pylint: disable=no-member
                "state": state,
                "message": message,
                "request_id": request_id,
                "values": values
            })
            wrapper.total_responses += 1  # pylint: disable=no-member
            if wrapper.total_responses == expected_response_count:  # pylint: disable=no-member
                wrapper.finished.set()  # pylint: disable=no-member

        wrapper.reset = types.MethodType(reset, wrapper)
        wrapper.join = types.MethodType(join, wrapper)
        wrapper.join_and_validate = types.MethodType(
            join_and_validate, wrapper)

        wrapper.reset()  # pylint: disable=not-callable

        return wrapper
    return decorator


def backend_callback_with_pending(expected_response_count=1, options=None):
    def decorator(function):
        wrapper = backend_callback(
            expected_response_count + 1, options)(function)

        def join_and_validate(self, timeout=5):
            self.join(timeout)

            # Validate 'PENDING' message
            assert self.responses[0]["request_id"] == wrapper.request_id  # pylint: disable=no-member

            assert self.responses[0]["state"] == "PENDING"
            assert self.responses[0]["message"] == "Execution started..."
            assert self.responses[0]["values"] is None

            self.current_response = 1
            for response in self.responses[1:]:
                assert response["request_id"] == wrapper.request_id  # pylint: disable=no-member

                function(response["state"], response["message"],
                         response["request_id"], response["values"])

                self.current_response += 1

        wrapper.join_and_validate = types.MethodType(
            join_and_validate, wrapper)
        return wrapper
    return decorator
