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

import os
import pytest
import tempfile

from msm_plugin.general import *

def test_plugin_info():
    assert info().startswith("MySQL Schema Management Plugin")

def test_plugin_version():
    assert version() == lib.general.VERSION

def test_mysql_session(sandbox_session):
    assert sandbox_session is not None

    result = sandbox_session.run_sql("SELECT 1;")
    row = result.fetch_one()

    assert row[0] == 1

def test_folder_navigation():
    cd("~")
    assert pwd() == os.path.expanduser("~")

    files = ls()
    assert len(files) > 0

    with tempfile.TemporaryDirectory() as temp_dir:
        files = ls(temp_dir)
        assert len(files) == 0

        new_path = os.path.join(temp_dir, ".msm_test_path")
        if not os.path.exists(new_path):
            os.makedirs(new_path)

        cd(temp_dir)

        files = ls(".msm_test_path")
        assert len(files) == 0

        cd(".msm_test_path")

        files = ls(new_path)
        assert len(files) == 0

        cd("..")
        assert pwd() == temp_dir

    with pytest.raises(Exception):
        cd("/some/non_existing/Path")
