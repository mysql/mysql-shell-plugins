# Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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
import os
import os.path
import signal
import subprocess
import sys
import threading
from queue import Queue

import mysqlsh
from mysqlsh.plugin_manager import \
    plugin_function  # pylint: disable=no-name-in-module

import gui_plugin.core.Error as Error
import gui_plugin.core.Logger as logger
from gui_plugin.core import Filtering
from gui_plugin.core.BaseTask import CommandTask
from gui_plugin.core.Context import get_context
from gui_plugin.core.dbms.DbMySQLSession import DbMysqlSession
from gui_plugin.core.Error import MSGException
from gui_plugin.core.modules import ModuleSession


def remove_dict_useless_items(data):
    result = {}
    # remove empty entries
    for key, value in data.items():
        if isinstance(value, dict):
            value = remove_dict_useless_items(value)
        if not value in ('', None, {}):
            result[key] = value

    # is_production and ssl are only valid when connected to a MySQL server
    if 'host' not in result:
        if 'is_production' in result:
            del result['is_production']
        if 'ssl' in result:
            del result['ssl']
    return result


class ShellCommandTask(CommandTask):
    def __init__(self, task_id, command, params=None, result_queue=None, result_callback=None, options=None, skip_completion=False):
        super().__init__(task_id, command, params=params,  result_queue=result_queue,
                         result_callback=result_callback, options=options, skip_completion=skip_completion)
        self.dispatch_result("PENDING", message='Execution started...')

    def do_execute(self):
        pass

    def send_output(self, data):
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except json.decoder.JSONDecodeError:
                # Few errors in the shell may be reported as non JSON, usually initialization errors
                error = {"error": data}
                data = json.loads(json.dumps(error))
        self.dispatch_result(
            "PENDING", message='Executing...', data=data)

    def complete(self, message=None, data=None):
        self.dispatch_result("OK", message=message, data=data)

    def fail(self, message=None, data=None):
        self.dispatch_result("ERROR", message=message, data=data)

    def cancel(self):
        super().cancel()
        self.dispatch_result("CANCELLED")


class ShellQuitTask(ShellCommandTask):
    def __init__(self, task_id=None, params=None, result_queue=None, result_callback=None, options=None):
        super().__init__(task_id, {"execute": "\\quit"},
                         params, result_queue, result_callback, options, True)


class ShellDbSessionHandler(DbMysqlSession):
    def __init__(self, connection_options, message_callback=None):
        super().__init__(0, False, connection_options, message_callback=message_callback)

    def _do_open_database(self, notify_success=True):
        self._on_connect()
        return False


class ShellModuleSession(ModuleSession):
    def __init__(self, options=None, settings=None, shell_args=None):
        context = get_context()
        request_id = context.request_id if context else None
        super().__init__()

        EXTENSION_SHELL_USER_CONFIG_FOLDER_BASENAME = "mysqlsh-gui"

        # Symlinks the plugins on the master shell as we want them available
        # on the Shell Console
        self._subprocess_home = mysqlsh.plugin_manager.general.get_shell_user_dir(  # pylint: disable=no-member
            'plugin_data', 'gui_plugin', 'shell_instance_home')
        if not os.path.exists(self._subprocess_home):
            os.makedirs(self._subprocess_home)

        subprocess_plugins = os.path.join(self._subprocess_home, 'plugins')

        # Get the actual plugin path that this gui_plugin is in
        module_file_path = os.path.dirname(__file__)
        plugins_path = os.path.dirname(os.path.dirname(module_file_path))

        # If this is a development setup using the global shell user config dir,
        # setup a symlink if it does not exist yet
        if (not mysqlsh.plugin_manager.general.get_shell_user_dir().endswith(
            EXTENSION_SHELL_USER_CONFIG_FOLDER_BASENAME)
                and not os.path.exists(subprocess_plugins)):
            if os.name == 'nt':
                p = subprocess.run(
                    f'mklink /J "{subprocess_plugins}" "{plugins_path}"',
                    shell=True)
                p.check_returncode()
            else:
                os.symlink(plugins_path, subprocess_plugins)

        # Check if MDS options have been specified
        connection_args = []

        if not options is None:
            session_handler = ShellDbSessionHandler(options,
                                                    message_callback=lambda msg_type, msg, result: self._web_session.send_response_message(
                                                        msg_type=msg_type,
                                                        msg=msg,
                                                        request_id=request_id,
                                                        values=result, api=False))

            session_handler.open()
            options = session_handler.connection_options

            if settings is not None:
                if 'ssh' in settings.keys():
                    connection_args.append('--ssh')
                    connection_args.append(settings.pop('ssh'))

                if 'ssh-identity-file' in settings.keys():
                    connection_args.append('--ssh-identity-file')
                    connection_args.append(
                        settings.pop('ssh-identity-file'))

            connection_args.append(
                mysqlsh.globals.shell.unparse_uri(options))

        self._last_prompt = {}
        # Empty command to keep track of the shell initialization
        self._pending_request = ShellCommandTask(
            request_id, "", result_callback=self._handle_api_response)
        self._last_info = None
        self._shell_exited = False
        self._shell = None  # start a new shell process here...
        self._thread = None  # create a new thread to do the async processing
        self._response_thread = None  # thread that handles the shell response messages
        self._initialize_complete = threading.Event()
        self._terminate_complete = threading.Event()
        self._command_complete = threading.Event()
        self._cancel_requests = []

        self.command_blacklist = [
            '\\',
            '\\edit', '\\e',
            '\\exit',
            '\\history',
            '\\nopager',
            '\\pager', '\\P',
            '\\quit', '\\q',
            '\\rehash',
            '\\source', '\\.',
            '\\system', '\\!'
        ]

        env = os.environ.copy()

        # TODO: Workaround for Bug #33164726
        env['MYSQLSH_USER_CONFIG_HOME'] = self._subprocess_home + "/"
        env["MYSQLSH_JSON_SHELL"] = "1"

        if "MYSQLSH_PROMPT_THEME" in env:
            del env["MYSQLSH_PROMPT_THEME"]
        if 'ATTACH_DEBUGGER' in env:
            del env['ATTACH_DEBUGGER']
        if not 'TERM' in env:
            env['TERM'] = 'xterm-256color'

        with open(os.path.join(self._subprocess_home, 'options.json'), 'w') as options_file:
            json.dump({
                "history.autoSave": "true"
            }, options_file)

        with open(os.path.join(self._subprocess_home, 'prompt.json'), 'w') as prompt_file:
            json.dump({
                "variables": {
                    "is_production": {
                        "match": {
                            "pattern": "*;host;*[*?*]",
                            "value": ";%env:PRODUCTION_SERVERS;[%host%]"
                        },
                        "if_true": "true",
                        "if_false": "false"
                    },
                    "is_ssl": {
                        "match": {
                            "pattern": "%ssl%",
                            "value": "SSL"
                        },
                        "if_true": "true",
                        "if_false": "false"
                    }
                },
                "prompt": {
                    "text": "\n",
                    "cont_text": "-> "
                },
                "segments": [
                    {
                        "text": "{ \"prompt_descriptor\": { "
                    },
                    {
                        "text": "\"user\": \"%user%\", "
                    },
                    {
                        "text": "\"host\": \"%host%\", \"port\": \"%port%\", \"socket\": \"%socket%\", "
                    },
                    {
                        "text": "\"schema\": \"%schema%\", \"mode\": \"%Mode%\", \"session\": \"%session%\","
                    },
                    {
                        "text": "\"ssl\": %is_ssl%, \"is_production\": %is_production%"
                    },
                    {
                        "text": " } }"
                    }
                ]
            },
                prompt_file,
                indent=4)

        executable = sys.executable
        if 'executable' in dir(mysqlsh):
            executable = mysqlsh.executable

        exec_name = executable if executable.endswith(
            "mysqlsh") or executable.endswith("mysqlsh.exe") else "mysqlsh"

        # Temporarily passing --no-defaults until it is a configurable option in FE and is received as parameter in the BE
        popen_args = ["--no-defaults", "--interactive=full", "--passwords-from-stdin",
                      "--py", "--json=raw", "--quiet-start=2", "--column-type-info"]

        # Adds the connection data to the call arguments
        if len(connection_args) > 0:
            popen_args = popen_args + connection_args

        # Adds the shell command args to the call arguments
        if shell_args is not None:
            popen_args = popen_args + shell_args

        popen_args.insert(0, exec_name)

        self._shell = subprocess.Popen(popen_args,
                                       stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                       encoding='utf-8', env=env, text=True,
                                       creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0)
        self._request_queue: "Queue[ShellCommandTask]" = Queue()

        self._thread = threading.Thread(target=self.handle_frontend_command)
        self._response_thread = threading.Thread(
            target=self.handle_shell_output)

        # shell_args is None when it is an interactive session, otherwise it is meant to be an operation to be executed as a CLI call so the frontend processing thread is not needed
        if shell_args is None:
            self._thread.start()

        self._response_thread.start()

    def __del__(self):
        self.close()
        super().__del__()

    def terminate_complete(self, type, message, request_id, result=None):
        if type == 'OK':
            self._terminate_complete.set()

    def close(self):
        # do cleanup,  a \q to terminate the shell, overriding the command black list
        self._request_queue.put(ShellQuitTask(
            result_callback=self.terminate_complete, options=None))

        self._terminate_complete.wait()

        super().close()

    def execute(self, command: str, callback=None, options=None):
        if callback is None:
            callback = self._handle_api_response

        command = command.strip()

        if command.startswith('\\'):
            if command.split(' ')[0] in self.command_blacklist:
                raise MSGException(Error.SHELL_COMMAND_NOT_SUPPORTED,
                                   "The requested command is not supported.")
        # Formats the command as expected by the shell
        command = {"execute": command}

        self.add_task(command, callback, options)

    def complete(self, data: str, offset=None, callback=None, options=None):
        if callback is None:
            callback = self._handle_api_response

        command = {"complete": {"data": data,
                                "offset": 0 if offset is None else offset}}

        self.add_task(command, callback, options)

    def add_task(self, command, callback, options):
        context = get_context()
        task_id = context.request_id if context else None
        self._request_queue.put(ShellCommandTask(
            task_id, command, result_callback=callback, options=options))

    def handle_shell_output(self):
        # Read characters from the shell stdout and build responses
        # to deliver to the handle_frontend_command method
        reply_line = ""
        error_buffer = ""
        while not self._shell_exited:
            reply_json = None
            char = self._shell.stdout.read(1)

            if len(char) == 0:
                break

            if not char == '\n':
                reply_line += char
                continue
            # when running on windows, remove the \r (from \r\n sequence)
            if reply_line.endswith('\r'):
                reply_line = reply_line[:-1]

            if reply_line.startswith("["):
                reply_line = f"{{ \"rows\": {reply_line} }}"

            if reply_line.startswith("{"):
                reply_json = json.loads(reply_line)

                # While in python mode, the python engine produces errors by
                # calling the print callback lots of times, to avoid sending a
                # lot of replies to the frontend we will cache consecutive errors
                # and send them in one call to the frontend as soon as a non
                # error response is received from the shell
                if 'error' in reply_json and isinstance(reply_json['error'], str):
                    error_buffer += reply_json["error"]
                else:
                    if len(error_buffer) > 0:
                        self._pending_request.send_output(
                            {"error": error_buffer})
                        error_buffer = ""

                    if 'prompt_descriptor' in reply_json:
                        # remove empty strings
                        reply_json = remove_dict_useless_items(reply_json)

                        # command complete
                        if not self._initialize_complete.is_set():
                            data = {"last_prompt": self._last_prompt,
                                    "module_session_id": self.module_session_id}
                            if self._last_prompt != reply_json:
                                data.update(reply_json)
                            self._pending_request.complete(message="New Shell Interactive session created successfully.",
                                                           data=data)
                            self._initialize_complete.set()
                        else:
                            self._pending_request.complete(
                                data=None if self._last_prompt == reply_json else reply_json)
                            self._command_complete.set()
                        self._last_prompt = reply_json
                    elif 'prompt' in reply_json:
                        # request for a client prompt
                        prompt_event = threading.Event()

                        if 'type' in reply_json and reply_json['type'] == 'password':
                            logger.add_filter({
                                "type": "key",
                                "key": "reply",
                                "expire": Filtering.FilterExpire.OnUse
                            })

                        reply_json.update(
                            {"module_session_id": self.module_session_id})
                        self.send_prompt_response(
                            self._pending_request.task_id, reply_json, lambda: prompt_event.set())

                        # Locks until the prompt is handled
                        prompt_event.wait()

                        if self._prompt_replied:
                            self._shell.stdin.write(self._prompt_reply + "\n")
                            self._shell.stdin.flush()
                        else:
                            self.kill_command()

                    elif 'value' in reply_json:
                        # generic response to send to the client
                        send_response = True
                        if isinstance(reply_json['value'], str) and reply_json['value'].endswith('\r'):
                            reply_json['value'] = reply_json['value'][:-1]
                            if len(reply_json['value']) == 0:
                                send_response = False

                        if send_response:
                            self._pending_request.send_output(reply_json)
                    else:
                        # Shell commands are stored as JSON and sent to the Shell
                        # Then the shell will print them as JSON because of interactive=full
                        # We do not need to reply back the original command to the frontend
                        if self._pending_request.command != reply_json:
                            if 'complete' in self._pending_request.command:
                                self._pending_request.send_output(
                                    reply_json['info'])
                            else:
                                self._pending_request.send_output(reply_json)
            elif reply_line == "Bye!":
                self._shell_exited = True
            else:
                # Some shell errors are not reported as JSON, i.e. initialization errors
                error_buffer += reply_line

            reply_line = ''

        # A pending request is expected to be present in 3 cases:
        # - When the initialization of the session failed
        # - When a CLI call was done
        # - When the Shell session is closed
        if not self._pending_request is None:
            exit_status = None
            attempts = 3
            while exit_status is None and attempts > 0:
                try:
                    exit_status = self._shell.wait(5)
                except subprocess.TimeoutExpired:
                    attempts = attempts - 1

            if exit_status != 0:
                self._pending_request.fail(message=error_buffer, data={
                                           "exit_status": exit_status})
            else:
                data = {"module_session_id": self.module_session_id,
                        "exit_status": exit_status}
                self._pending_request.complete(
                    data=data)

            self._command_complete.set()

            # Finally closes the module session if not already being closed
            if not isinstance(self._pending_request, ShellQuitTask):
                self.close()

        # On error conditions no processing will take place, still the frontend handler thread is waiting, we need to let it go
        self._shell_exited = True
        if not self._initialize_complete.is_set():
            self._initialize_complete.set()

    def handle_frontend_command(self):
        self._initialize_complete.wait()
        # Make the actual communication with the interactive shell
        while not self._shell_exited:
            # check if there is a command request to send to
            # the shell and handle it
            command = self._request_queue.get()
            if command.task_id in self._cancel_requests:
                command.cancel()
                self._cancel_requests.remove(command.task_id)
                continue

            self._pending_request = command
            self._shell.stdin.write(json.dumps(command.command) + "\n")
            self._shell.stdin.flush()

            # The command has been sent to the shell, now we wait until it completes
            self._command_complete.wait()
            self._command_complete.clear()
            self._pending_request = None

    def kill_command(self):
        # windows. Need CTRL_BREAK_EVENT to raise the signal in the whole process group
        os.kill(self._shell.pid,
                signal.CTRL_BREAK_EVENT if hasattr(signal, 'CTRL_BREAK_EVENT') else signal.SIGINT)  # pylint: disable=no-member

    def cancel_request(self, request_id):
        self._cancel_requests.append(request_id)

    def kill_shell_task(self):
        context = get_context()
        request_id = context.request_id if context else None
        if not self._command_complete.is_set() and self._pending_request is not None:
            self.kill_command()
            self.send_command_response(request_id, 'Command killed')
        else:
            self.send_command_response(request_id, 'Nothing to kill')
