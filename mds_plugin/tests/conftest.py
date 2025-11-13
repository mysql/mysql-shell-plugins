# Copyright (c) 2025, Oracle and/or its affiliates.
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

import threading
import functools
import pytest
import mysqlsh
import tempfile
import os


class MyShellContext():
    """
    The purpose of this class is to create a shell context that can be used to run
    code that requires user interaction (prompts) in a separate thread.

    It will intercept the prompts and provide the expected responses.

    There'e no need to use it directly, all what's beeded is that tests requiring
    interaction, use the testutil fixture.

    This is needed by the testutil fixture below.
    """

    def __init__(self):
        self._expected_prompts = []
        self._prompt_count = 0
        self._stdout = []
        self._stderr = []
        self._shell_ctx = mysqlsh.globals.shell.create_context({"printDelegate": lambda x: self.on_shell_print(x),
                                                                "diagDelegate": lambda x: self.on_shell_print_diag(x),
                                                                "errorDelegate": lambda x: self.on_shell_print_error(x),
                                                                "promptDelegate": lambda x, y: self.on_shell_prompt(x, y), })

    def on_shell_prompt(self, text, options):
        self._prompt_count += 1
        assert self._expected_prompts, f"Unexpected prompt received (#{self._prompt_count}): {text}"
        expected_message, expected_response, expected_options = self._expected_prompts.pop(
            0)
        assert expected_message == text, f"Unexpected prompt received (#{self._prompt_count})"

        if expected_options is not None:
            assert expected_options == options, f"Unexpected prompt options received (#{self._prompt_count})"

        # Hack to mimic the standard shell behavior
        if expected_response.strip() == "" and "defaultValue" in options and (not "type" in options or options["type"] == "text"):
            expected_response = options["defaultValue"]

        # return [self._prompt_replied, self._prompt_reply]
        return [expected_response is not None, expected_response]

    def handle_print(self, type, text):
        if type == "error":
            self._stderr.append(text)
        else:
            self._stdout.append(text)

    def on_shell_print(self, text):
        self.handle_print("info", text)

    def on_shell_print_diag(self, text):
        self.handle_print("info", text)

    def on_shell_print_error(self, text):
        self.handle_print("error", text)

    def expect_prompt(self, text, response, options=None):
        self._expected_prompts.append((text, response, options))

    def ensure_no_missing_prompts(self):
        assert len(
            self._expected_prompts) == 0, f"Missing expected prompts {self._expected_prompts}"

    def finalize(self):
        self._shell_ctx.finalize()


def run_in_thread(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        result = {}

        def target():
            shell_context = MyShellContext()
            wrapper.expect_prompt = shell_context.expect_prompt
            try:
                result['value'] = func(*args, **kwargs)
                shell_context.ensure_no_missing_prompts()
            except Exception as e:
                result['exception'] = e
            finally:
                shell_context.finalize()
        t = threading.Thread(target=target)
        t.start()
        t.join()
        if 'exception' in result:
            raise result['exception']
        return result.get('value')
    return wrapper


@pytest.fixture(autouse=False)
def testutil(request):
    """
    Use this fixture for interactive tests.

    The testutil fixture will expose this function:
        testutil.expect_prompt(text, response[, options=None])

    It can be used to define the expected prompts and the responses to
    be given. Giving options is optional, if given, a validation will ensure that
    the prompt options match exactly the expected prompt options.

    i.e.

    def test_something(testutil):
        testutil.expect_prompt("Are you sure?", "y")
        testutil.expect_prompt("Enter your name:", "John Doe")
        result = shell.prompt("Are you sure?", {"type": "confirm"})
        assert result == "&Yes"

        result = shell.prompt("Enter your name:")
        assert result == "John Doe"    
    """
    request.node.obj = run_in_thread(request.node.obj)
    return request.node.obj


@pytest.fixture
def temp_dir():
    """
    Use this fixture if a temporary directory is needed to execute the test.
    """
    with tempfile.TemporaryDirectory() as temp_dir:
        yield temp_dir


@pytest.fixture
def temp_oci_config():
    """
    Use this fixture to execute the test using a temporary OCI configuration
    location.
    """
    with tempfile.TemporaryDirectory() as temp_dir:
        backup = None
        if 'OCI_CLI_CONFIG_FILE' in os.environ:
            backup = os.environ['OCI_CLI_CONFIG_FILE']

        os.environ['OCI_CLI_CONFIG_FILE'] = os.path.join(temp_dir, 'config')
        yield os.environ['OCI_CLI_CONFIG_FILE']

        if backup is not None:
            os.environ['OCI_CLI_CONFIG_FILE'] = backup
        else:
            del os.environ['OCI_CLI_CONFIG_FILE']
