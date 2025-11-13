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

from mds_plugin.bootstrap.cli_setup import prompt_for_passphrase
import pytest


def test_prompt_for_passphrase_match(testutil):
    testutil.expect_prompt("Enter a passphrase for the private key: ",
                           "test_passphrase", {"type": "password"}, )
    testutil.expect_prompt("Please confirm the passphrase: ",
                           "test_passphrase", {"type": "password"})
    result = prompt_for_passphrase()
    assert result == "test_passphrase"


def test_prompt_for_passphrase_mismatch_once(testutil):
    testutil.expect_prompt("Enter a passphrase for the private key: ",
                           "test_passphrase", {"type": "password"})
    testutil.expect_prompt("Please confirm the passphrase: ",
                           "wrong_passphrase", {"type": "password"})
    testutil.expect_prompt("Mismatched passphrase, enter a passphrase for the private key: ",
                           "test_passphrase2", {"type": "password"})
    testutil.expect_prompt("Please confirm the passphrase: ",
                           "test_passphrase2", {"type": "password"})
    result = prompt_for_passphrase()
    assert result == "test_passphrase2"


def test_prompt_for_passphrase_mismatch_three_times(testutil):
    testutil.expect_prompt("Enter a passphrase for the private key: ",
                           "test_passphrase", {"type": "password"})
    testutil.expect_prompt("Please confirm the passphrase: ",
                           "wrong_passphrase", {"type": "password"})
    testutil.expect_prompt("Mismatched passphrase, enter a passphrase for the private key: ",
                           "test_passphrase2", {"type": "password"})
    testutil.expect_prompt("Please confirm the passphrase: ",
                           "wrong_passphrase2", {"type": "password"})
    testutil.expect_prompt("Mismatched passphrase, enter a passphrase for the private key: ",
                           "test_passphrase3", {"type": "password"})
    testutil.expect_prompt("Please confirm the passphrase: ",
                           "wrong_passphrase3", {"type": "password"})
    with pytest.raises(RuntimeError):
        prompt_for_passphrase()


def test_prompt_for_passphrase_strip(testutil):
    testutil.expect_prompt("Enter a passphrase for the private key: ",
                           "test_passphrase", {"type": "password"})
    testutil.expect_prompt("Please confirm the passphrase: ",
                           "test_passphrase", {"type": "password"})
    result = prompt_for_passphrase()
    assert result == "test_passphrase"
