# Copyright (c) 2026, Oracle and/or its affiliates.
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
# This program is distributed in the hope that it will be useful, but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

import zipfile
from unittest.mock import MagicMock

from gui_plugin.migration.lib.backend.remote_helper import RemoteHelperClient


def test_remote_helper_archive_preserves_gui_migration_package():
    with RemoteHelperClient(MagicMock(), "token") as client:
        archive = client.create_zip()

        with zipfile.ZipFile(archive) as helper_zip:
            files = set(helper_zip.namelist())

        assert "gui_plugin/__init__.py" in files
        assert "gui_plugin/migration/lib/backend/submysqlsh.py" in files
        assert "mds_plugin/__init__.py" in files
