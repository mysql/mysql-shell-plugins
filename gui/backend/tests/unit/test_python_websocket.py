# Copyright (c) 2022, Oracle and/or its affiliates.
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
import os
from tests.frontend.TestWebSocket import TWebSocket
from tests import get_logger, print_user_story_stack_trace
from pathlib import Path


def list_python_scripts():
    this_file = Path(__file__)
    user_stories = []
    root = Path(os.path.join(this_file.parent.parent, "websocket"))
    root_len = len(root.as_posix())
    for path in root.rglob("*"):
        if not path.as_posix().endswith('.py'):
            continue
        if path.is_file():
            user_stories.append(path.as_posix()[root_len + 1:])

    return user_stories

all_stories = list_python_scripts()
exclude_prefixes=["skip", "_"]
test_list = []
for test in all_stories:
    exclude = False
    for prefix in exclude_prefixes:
        if os.path.basename(test).startswith(prefix) and not os.path.basename(test).endswith('.py'):
            exclude = True
    if "single_user_mode" in test:
        exclude = True
    if "modules" in test:
        exclude = True

    if not exclude:
        test_list.append(test)

def read_script(path):
    this_file = Path(__file__)
    path_tokens = [this_file.parent.parent, "websocket"] + path.split("/")
    target_path = os.path.join(*path_tokens)
    target = Path(target_path)
    if target.is_file():
        return target.read_text(encoding='utf-8')
    else:
        raise Exception(f"The requested test does not exist: {path} in {target}")


@pytest.mark.usefixtures("shell_start_server", "create_users", "create_test_schema", "clear_module_data_tables")
@pytest.mark.parametrize("test", test_list)
def test_over_websocket(test):
    if Path(test).name.startswith('windows') and not os.name == 'nt':
        return

    if Path(test).name.startswith('posix') and not os.name == 'posix':
        return

    ws = TWebSocket(logger=get_logger(), script_reader=read_script) #pylint: disable=no-value-for-parameter, unexpected-keyword-arg
    try:
        ws.execute(test)
    except Exception as e:
        print_user_story_stack_trace(ws, e)
        raise
