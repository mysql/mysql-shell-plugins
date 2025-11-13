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

import pytest  # type: ignore

import migration_plugin.lib as lib
from migration_plugin.general import info, version


def test_plugin_info():
    assert info().startswith("Migration Plugin")


def test_plugin_version():
    assert version() == lib.general.VERSION


def test_mysql_session(sandbox_session):
    assert sandbox_session is not None


class TestInfo:

    def test_info(self):
        result = info()

        assert isinstance(result, str)
        assert len(result) > 0

        assert "Migration Plugin" in result
        assert "Version" in result
        assert "Warning! For testing purposes only!" in result


class TestVersion:

    def test_version(self):
        result = version()

        assert isinstance(result, str)
        assert len(result) > 0

        expected_version = lib.general.VERSION
        assert result == expected_version
