# Copyright (c) 2026, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is designed to work with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms,
# as designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link your program and your derivative works with the
# separately licensed software that they have either included with
# the program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
# General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation,
# Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

import os
import stat

import pytest

from gui_plugin.core.Files import (
    ensure_private_directory,
    ensure_private_file,
    secure_existing_file,
)


@pytest.mark.skipif(os.name == "nt", reason="POSIX permission bits are not supported")
def test_private_directory_and_file_permissions(tmp_path):
    tmp_path = tmp_path.resolve()
    private_directory = tmp_path / "private"
    assert ensure_private_directory(private_directory) is True
    assert stat.S_IMODE(private_directory.stat().st_mode) == 0o700

    os.chmod(private_directory, 0o755)
    assert ensure_private_directory(private_directory) is False
    assert stat.S_IMODE(private_directory.stat().st_mode) == 0o755

    private_file = private_directory / "state"
    assert ensure_private_file(private_file) is True
    assert stat.S_IMODE(private_file.stat().st_mode) == 0o600

    os.chmod(private_file, 0o644)
    assert ensure_private_file(private_file) is False
    assert stat.S_IMODE(private_file.stat().st_mode) == 0o644


@pytest.mark.skipif(os.name == "nt", reason="POSIX symlink semantics are not supported")
def test_private_paths_reject_symlinks(tmp_path):
    tmp_path = tmp_path.resolve()
    target_directory = tmp_path / "target-directory"
    target_directory.mkdir()
    directory_link = tmp_path / "directory-link"
    directory_link.symlink_to(target_directory, target_is_directory=True)

    with pytest.raises(ValueError):
        ensure_private_directory(directory_link)

    target_file = tmp_path / "target-file"
    target_file.touch()
    file_link = tmp_path / "file-link"
    file_link.symlink_to(target_file)

    with pytest.raises(ValueError):
        ensure_private_file(file_link)

    with pytest.raises(ValueError):
        secure_existing_file(file_link)
