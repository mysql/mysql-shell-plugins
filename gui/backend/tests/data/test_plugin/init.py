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

from mysqlsh.plugin_manager import plugin, plugin_function
import mysqlsh


@plugin
class guitest:
    """
    Simple plugin to exercise the Shell callbacks for print and prompt
    """


@plugin_function("guitest.doPrint")
def do_print(data):
    """Test the print callback.

    Args:
      data (str): the data to be printed

    This function tests the print callback when an exception is thrown.
    """
    print(data)


@plugin_function("guitest.doFail")
def do_fail():
    """Tests the print error callback.

    This function tests the print callback when an exception is thrown.
    """
    raise mysqlsh.Error("Something failed")


@plugin_function("guitest.doPrompt")
def do_prompt(prompt):
    """Function to test the prompt callback.

    Args:
      prompt (str): the data to be prompted
    """
    result = shell.prompt(prompt)

    print(result)


@plugin_function("guitest.doPromptPassword")
def do_prompt_password(prompt):
    """Function to test the prompt password callback.

    Args:
      prompt (str): the data to be prompted
    """
    result = shell.prompt(prompt, {"type": "password"})

    print(result)
