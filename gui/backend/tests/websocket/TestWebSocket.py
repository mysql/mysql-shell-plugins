# Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

import json
import subprocess
import uuid
import re
import time
from gui_plugin.debugger.Debugger import read_script
import gui_plugin.core.Logger as logger
from tests.lib.utils import *
import threading
from queue import Queue, Empty
import copy
import config
from tests.tests_timeouts import response_timeout
import tempfile
from pathlib import Path
import sys
import mysqlsh

# To support null as value for JSON
null = None
true = True
false = False
DEBUGGER_IGNORE = "DEBUGGER_IGNORE"
DEBUGGER_REGEXP = "DEBUGGER_REGEXP"
DEBUGGER_LIST_SUBSET = "DEBUGGER_LIST_SUBSET"
DEBUGGER_LIST_EXACT = "DEBUGGER_LIST_EXACT"
DEBUGGER_LAST_GENERATED_ID = "DEBUGGER_LAST_GENERATED_ID"
DEBUGGER_LAST_MODULE_ID = "DEBUGGER_LAST_MODULE_ID"
DEBUGGER_GENERATE_REQUEST_ID = "DEBUGGER_GENERATE_REQUEST_ID"
FORMAT = "[%(asctime)-15s] %(message)s"


def diff(actual, expected, prefix=""):
    return f"\n-----------\nExpected {prefix}: '{expected}'\nActual {prefix}: '{actual}'"


class Object():
    def __init__(self, props=None):
        self.__frozen = False
        if props is not None:
            Object.assign(self, props)

    def __getitem__(self, key):
        return getattr(self, key)

    def __setitem__(self, key, value):
        if self.__frozen:
            raise Exception("Unable to change frozen object.")
        setattr(self, key, value)

    def __str__(self):
        return f"Object: {self.as_dict()}"

    def __repr__(self) -> str:
        return str(self.as_dict())

    def as_dict(self) -> dict:
        result = {}
        for key in Object.keys(self):
            value = getattr(self, key)
            if isinstance(value, Object):
                value = value.as_dict()
            result[key] = value
        return result

    def get(self, key, default=None):
        return getattr(self, key, default)

    @staticmethod
    def freeze(target):
        if not isinstance(target, Object):
            raise Exception("The supplied target is not of Object type")
        target.__frozen = True

        for key in Object.keys(target):
            value = getattr(target, key)
            if isinstance(value, Object):
                Object.freeze(value)

        return target

    @staticmethod
    def isFrozen(target):
        return target.__frozen

    @staticmethod
    def entries(target):
        if not isinstance(target, Object) and not isinstance(target, dict):
            raise Exception("The supplied target is not of Object type")

        result = []
        for key in Object.keys(target):
            result.append((key, target[key]))
        return result

    @staticmethod
    def keys(target):
        if not isinstance(target, Object) and not isinstance(target, dict):
            raise Exception("The supplied target is not of Object type")
        if isinstance(target, Object):
            target = target.__dict__
        return list(filter(lambda item: not callable(item) and not item.startswith("__") and not item.startswith('_Object'), target.keys()))

    @staticmethod
    def assign(target, *sources):
        for source in sources:
            Object.defineProperties(target, source)
        return target

    @staticmethod
    def defineProperties(target, props):
        if not isinstance(target, Object):
            raise Exception("The supplied target is not of Object type")

        if Object.isFrozen(target):
            raise Exception("Unable to define properties to frozen object.")

        if not isinstance(props, dict) and not isinstance(props, Object):
            raise Exception("Defining an invalid property type to Object")

        for (key, value) in Object.entries(props):
            target_value = target.get(key, {})

            if isinstance(target_value, Object):
                target_value = target_value.as_dict()
            if isinstance(value, Object):
                value = value.as_dict()

            if isinstance(value, dict):
                value = Object({**target_value, **value})
            elif isinstance(value, list):
                list_value = []
                for item in value:
                    if isinstance(item, dict):
                        item = Object(item)
                    list_value.append(item)
                value = list_value
            target.__setitem__(key, value)

        return target


class ObjectEncoder(json.JSONEncoder):
    def default(self, o):
        return o.as_dict()


class TWebSocket:
    '''Web Socket Wrapper with the API required to test user stories'''
    session_scripts = {}

    def __init__(self, token=None, logger=None, script_reader=read_script):
        # Cleanup the user table
        self._last_module_session_id = None
        self.token = token
        self.ws, self.session_id = connect_and_get_session(token=token)
        self.logger = logger
        self.validation_trace = []
        self.module_scripts = {}
        self._script_reader = script_reader

        temp_dir = tempfile.mkdtemp()

        executable = sys.executable
        if 'executable' in dir(mysqlsh):
            executable = mysqlsh.executable

        command = executable if executable.endswith(
            "mysqlsh") or executable.endswith("mysqlsh.exe") else "mysqlsh"

        # Lets see if we have a credentials manager available
        credential_manager = subprocess.run(
            [command, "-e", "shell.listCredentials()"])

        self.tokens = Object({
            "defaults": {
                "database_connections": {
                    "mysql": config.Config.get_instance().database_connections
                }
            },
            "lib": {
                "name": "__lib"
            },
            "testTempDir": temp_dir,
            "testTempDirPosix": Path(temp_dir).as_posix(),
            "hasCredentialManager": credential_manager.returncode == 0
        })
        self._last_response = None

        self._story_stack = []

        self._response_queue = Queue()

        self._reading_thread = threading.Thread(
            target=self._read_responses_thread)
        self._reading_thread.start()

    def close(self):
        self.ws.close()

    def doSend(self, request):
        while True:
            try:
                logger.info(
                    f"PENDING IN WS: {self._response_queue.get_nowait()}")
            except Empty:
                break

        self._last_response = None

        if isinstance(request, dict) or isinstance(request, Object):
            if request.get('request_id') == DEBUGGER_GENERATE_REQUEST_ID:
                request['request_id'] = self.generateRequestId()
            if request.get('args', {}).get('module_session_id') == DEBUGGER_LAST_MODULE_ID:
                request['args']['module_session_id'] = self._last_module_session_id
            if request.get('module_session_id') == DEBUGGER_LAST_MODULE_ID:
                request['module_session_id'] = self._last_module_session_id

            self.ws.send(json.dumps(
                request, separators=(',', ':'), cls=ObjectEncoder).encode('utf8'))
        else:
            self.ws.send(request)

    def send(self, request):

        self.doSend(request)

    @property
    def lastResponse(self):
        return self._last_response

    def validateResponse(self, actual, expected):
        self.validation_trace.clear()
        self._validateResponse(actual, expected)

    def _validateResponse(self, actual, expected, prefix=""):
        if isinstance(expected, Object):
            expected = expected.as_dict()
        if isinstance(expected, dict):
            assert isinstance(actual, dict)
            self.validation_trace.insert(
                0, diff(str(actual), str(expected), prefix))
            for key in expected.keys():
                self._validateResponse(actual[key], expected[key], key)
            self.validation_trace.remove(self.validation_trace[0])
        elif isinstance(expected, list):
            self._validateList(actual, expected, True, prefix)
        elif self.__is_list(expected):
            self._validateList(actual, expected[1], False, prefix)
        elif self.__is_list_full(expected):
            assert len(actual) == len(expected[1])
            self._validateList(actual, expected[1], True, prefix)
        elif self.__is_regex(expected):
            self.validation_trace.insert(
                0, diff(str(actual), expected[1], prefix))
            assert re.search(expected[1], str(actual))
            self.validation_trace.remove(self.validation_trace[0])
        elif expected == self.ignore:
            pass
        elif isinstance(expected, str):
            if expected == DEBUGGER_LAST_GENERATED_ID:
                self.validation_trace.insert(
                    0, diff(actual, self._last_generated_request_id, prefix))
                assert self._last_generated_request_id == actual, "".join(
                    self.validation_trace)
                self.validation_trace.remove(self.validation_trace[0])
            elif expected == DEBUGGER_LAST_MODULE_ID:
                self.validation_trace.insert(
                    0, diff(actual, self._last_module_session_id, prefix))
                assert self._last_module_session_id == actual, "".join(
                    self.validation_trace)
                self.validation_trace.remove(self.validation_trace[0])
            else:
                self.validation_trace.insert(0, diff(actual, expected, prefix))
                assert expected == actual, "".join(self.validation_trace)
                self.validation_trace.remove(self.validation_trace[0])
        else:
            self.validation_trace.insert(0, diff(actual, expected, prefix))
            assert expected == actual, "".join(self.validation_trace)
            self.validation_trace.remove(self.validation_trace[0])

    def _validateList(self, actual, expected, ordered, prefix=""):
        iterator = iter(actual)
        expected_copy = copy.copy(expected)
        self.validation_trace.insert(
            0, diff(str(actual), str(expected), prefix))

        while len(expected_copy) > 0:
            try:
                actual_item = next(iterator)
            except StopIteration:
                break

            if ordered:
                expected_item = expected_copy[0]
                if isinstance(expected_item, Object):
                    self._validateResponse(
                        actual_item, expected_item.as_dict(), prefix)
                elif isinstance(expected_item, dict) or isinstance(expected_item, list):
                    self._validateResponse(actual_item, expected_item, prefix)
                elif expected_item == self.ignore:
                    pass
                else:
                    if hasattr(expected_item, '__iter__'):
                        self.validation_trace.insert(
                            0, "Missing expected item" + str(actual_item))
                        assert actual_item in expected_item, "".join(
                            self.validation_trace)
                        self.validation_trace.remove(self.validation_trace[0])
                    else:
                        self.validation_trace.insert(
                            0, diff(actual_item, expected_item, prefix))
                        assert expected_item == actual_item, "".join(
                            self.validation_trace)
                        self.validation_trace.remove(self.validation_trace[0])
                expected_copy.remove(expected_item)
            else:
                for expected_item in expected_copy:
                    found = False
                    try:
                        if isinstance(expected_item, Object):
                            self._validateResponse(
                                actual_item, expected_item.as_dict(), prefix)
                        elif isinstance(expected_item, dict) or isinstance(expected_item, list):
                            self._validateResponse(
                                actual_item, expected_item, prefix)
                        elif expected_item == self.ignore:
                            pass
                        else:
                            if hasattr(expected_item, '__iter__'):
                                self.validation_trace.insert(
                                    0, "Missing expected item" + str(actual_item))
                                assert actual_item in expected_item, "".join(
                                    self.validation_trace)
                                self.validation_trace.remove(
                                    self.validation_trace[0])
                            else:
                                self.validation_trace.insert(
                                    0, diff(actual_item, expected_item, prefix))
                                assert expected_item == actual_item, "".join(
                                    self.validation_trace)
                                self.validation_trace.remove(
                                    self.validation_trace[0])
                        found = True
                    except Exception as e:
                        continue
                    assert found, f"part not found {actual_item}"

                    expected_copy.remove(expected_item)
                    break

        self.validation_trace.remove(self.validation_trace[0])

        assert len(expected_copy) == 0, f"Missed: {expected_copy}"

    def generateRequestId(self, lazy=False):
        if lazy:
            return DEBUGGER_GENERATE_REQUEST_ID
        self._last_generated_request_id = str(uuid.uuid1())
        return self._last_generated_request_id

    @property
    def lastGeneratedRequestId(self):
        return "DEBUGGER_LAST_GENERATED_ID"

    def pythonize_script(self, script):
        new_script = script.replace("} // endif", "").replace(
            "} else {", "else:").replace("await ", "").replace("//", "#").replace("var ", "")
        lines = new_script.split("\n")
        new_lines = []
        for line in lines:
            new_lines.append(re.sub(r"if \((.*)\) {", "if \\1:", line))

        new_script = "\n".join(new_lines)
        return new_script

    def set_script_mode(self, script, mode):
        if script in TWebSocket.session_scripts:
            del TWebSocket.session_scripts[script]

        if script in self.module_scripts:
            del self.module_scripts[script]

        if mode == "session":
            TWebSocket.session_scripts[script] = False
        elif mode == "module":
            self.module_scripts[script] = False

    def execute(self, story):
        if story in TWebSocket.session_scripts:
            if TWebSocket.session_scripts[story]:
                return
            else:
                TWebSocket.session_scripts[story] = True

        if story in self.module_scripts:
            if self.module_scripts[story]:
                return
            else:
                self.module_scripts[story] = True

        pre_script = None
        post_script = None
        try:
            pre_script = self._script_reader(story[:-3] + ".pre")
        except:
            pass
        try:
            post_script = self._script_reader(story[:-3] + ".post")
        except:
            pass

        if story.endswith(".py"):
            script = self._script_reader(story)
        else:
            script = self.pythonize_script(self._script_reader(story))

        ws = self  # pylint: disable=unused-variable

        if not pre_script is None:
            self._story_stack.append(story[:-3] + ".pre")
            exec(pre_script)
            self._story_stack = self._story_stack[:-1]

        script = self.pythonize_script(self._script_reader(story))

        self._story_stack.append(story)
        exec(script)
        self._story_stack = self._story_stack[:-1]

        if not post_script is None:
            self._story_stack.append(story[:-3] + ".post")
            exec(post_script)
            self._story_stack = self._story_stack[:-1]

    @property
    def ignore(self):
        return DEBUGGER_IGNORE

    def matchRegexp(self, regexp):
        return (DEBUGGER_REGEXP, regexp)

    def __is_regex(self, value):
        return type(value) is tuple and len(value) == 2 and value[0] == DEBUGGER_REGEXP

    def __is_list(self, value):
        return type(value) is tuple and len(value) == 2 and value[0] == DEBUGGER_LIST_SUBSET

    def __is_list_full(self, value):
        return type(value) is tuple and len(value) == 2 and value[0] == DEBUGGER_LIST_EXACT

    def matchList(self, value, exact_match=True):
        return (DEBUGGER_LIST_EXACT, value) if exact_match else (DEBUGGER_LIST_SUBSET, value)

    @property
    def lastModuleSessionId(self):
        return DEBUGGER_LAST_MODULE_ID

    @property
    def isConnected(self):
        return self.ws and self.ws.connected

    def connect(self, token=None):
        try:
            self.ws, self.session_id = connect_and_get_session(token=token)
        except Exception as e:
            self._last_response = {"exception": str(e)}

    def disconnect(self):
        self.ws.close()

    def response_generator(self):
        while True:
            response = self._wait_response()
            if response is None:
                break
            yield response

    def sendAndValidate(self, message, expectedResponses):
        self.doSend(message)
        if isinstance(expectedResponses, tuple) and expectedResponses[0] == DEBUGGER_LIST_SUBSET:
            self.validateResponse(self.response_generator(), expectedResponses)
        else:
            for expected in expectedResponses:
                actual = self._wait_response()
                assert actual is not None, f"Not all expected responses were retrieved, missing {expected}"

                if not expected == self.ignore:
                    self.validateResponse(actual, expected)

    def getNextSequentialResponse(self, delay=0.3):
        time.sleep(delay)
        return self._wait_response()

    def _wait_response(self, timeout=None):
        if timeout is None:
            timeout = response_timeout()
        try:
            self._last_response = self._response_queue.get(
                block=True, timeout=timeout)
        except Empty:
            logger.info("Timeout waiting for a backend response")
            return None

        return self._last_response

    def log(self, text):
        if self.logger:
            self.logger.info(text)

    def _check_module_session_id(self, message):
        if "result" in message \
                and isinstance(message["result"], dict) \
                and "module_session_id" in message["result"] \
                and not "prompt" in message["result"]:
            self._last_module_session_id = message["result"]["module_session_id"]

    def validateLastResponse(self, expected):
        self._wait_response()
        self.validateResponse(self._last_response, expected)

    def _read_responses_thread(self):
        while True:
            try:
                response = json.loads(self.ws.recv())
                self._check_module_session_id(response)
                self._response_queue.put(response)
            except Exception:
                return

    def reset(self):
        self._last_module_session_id = None
        self.ws.close()
        self.ws, self.session_id = connect_and_get_session(token=self.token)
        self._last_response = None
        self._story_stack = []
        self._response_queue = Queue()
        self._reading_thread = threading.Thread(
            target=self._read_responses_thread)
        self._reading_thread.start()
