# Copyright (c) 2021, Oracle and/or its affiliates.
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
from gui_plugin.debugger.Debugger import list_scripts
from tests.frontend.TestWebSocket import TWebSocket
from tests import get_logger, print_user_story_stack_trace
from pathlib import Path

all_stories = list_scripts()
exclude_prefixes=["skip", "_"]
story_list = []
for story in all_stories:
    exclude = False
    for prefix in exclude_prefixes:
        if os.path.basename(story).startswith(prefix):
            exclude = True
    if "single_user_mode" in story:
        exclude = True
    if "modules" in story:
        exclude = True

    if not exclude:
        story_list.append(story)

@pytest.mark.usefixtures("shell_start_server", "create_users", "create_test_schema", "clear_module_data_tables")
@pytest.mark.parametrize("story", story_list)
def test_user_stories(story):
    if Path(story).name.startswith('windows') and not os.name == 'nt':
        return

    if Path(story).name.startswith('posix') and not os.name == 'posix':
        return

    ws = TWebSocket(logger=get_logger()) #pylint: disable=no-value-for-parameter, unexpected-keyword-arg
    try:
        ws.execute(story)
    except Exception as e:
        print_user_story_stack_trace(ws, e)
        raise
