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
import os
from pathlib import Path

import gui_plugin.core.Logger as logger
from gui_plugin.debugger import Debugger


def get_user_stories(single_user_mode: bool, authenticated_mode: bool):
    """
    Returns the list of tests that correspond to the provided criteria.

    single_user_mode: determines if the tests to be returned are to be executed
    in a server running in single user mode (True) or multi user mode (False).

    authenticated_mode: determines if the tests to be returned require already
    authenticated web session or not.
    """
    # Gets the user stories from the Debugger and filters accordingly
    all_scripts = Debugger.list_scripts()
    exclude_prefixes = ["skip", "_",
                        "windows" if os.name == "posix" else "posix"]

    script_list = []

    for script in all_scripts:
        exclude = False

        # Checks if script should be excluded
        for prefix in exclude_prefixes:
            if os.path.basename(script).startswith(prefix):
                exclude = True

        if exclude:
            continue

        if single_user_mode and not "single_user_mode" in script:
            continue
        elif not single_user_mode and "single_user_mode" in script:
            continue
        elif authenticated_mode and script.startswith("unit/authenticate"):
            continue
        elif not authenticated_mode and not script.startswith("unit/authenticate"):
            continue

        script_list.append(script)

    return script_list


def get_unit_tests(single_user_mode: bool, authenticated_mode: bool, only_sqleditor: bool):
    this_file = Path(__file__)
    all_scripts = []
    test_list = []
    root = Path(os.path.join(this_file.parent,
                "single_user" if single_user_mode else "multi_user",
                             "as_admin" if authenticated_mode else "not_authenticated"))

    if root.exists:
        for path in root.rglob("*"):
            if not path.as_posix().endswith('.py'):
                continue

            if only_sqleditor ^ path.parents[0].as_posix().endswith('sqleditor'):
                continue

            if path.is_file():
                all_scripts.append(path.as_posix())

        exclude_prefixes = ["skip", "_",
                            "windows" if os.name == "posix" else "posix"]
        for test in all_scripts:
            exclude = False
            for prefix in exclude_prefixes:
                if os.path.basename(test).startswith(prefix):
                    exclude = True

            if not exclude:
                test_list.append(test)

    return test_list


def unit_test_reader(path):
    target = Path(path)
    if target.is_file():
        return target.read_text(encoding='utf-8')
    else:
        raise Exception(
            f"The requested test does not exist: {path} in {target}")


def print_user_story_stack_trace(ws, exc):
    import sys
    import traceback
    _, _, exc_traceback = sys.exc_info()
    stack = traceback.format_exception(Exception, exc, exc_traceback)
    logger.debug(
        "----------------------------------------------------------------------------------------------")
    logger.debug("User story stack trace")
    logger.debug(
        "----------------------------------------------------------------------------------------------")
    for line in stack:
        if line.find('  File "<string>"') > -1:
            importanat_parts = line.replace(
                '  File "<string>"', f'File: "{ws._story_stack[0]}"').split(", ")
            logger.debug(f"{importanat_parts[0]}: {importanat_parts[1]}")
            ws._story_stack = ws._story_stack[1:]
    logger.debug(
        "----------------------------------------------------------------------------------------------")
