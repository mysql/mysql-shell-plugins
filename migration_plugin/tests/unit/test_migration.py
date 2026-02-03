# Copyright (c) 2025, 2026, Oracle and/or its affiliates.
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
import tempfile
import shutil
import pytest  # type: ignore
from unittest.mock import patch
import migration_plugin.lib.migration as migration_lib
from migration_plugin.migration import *


@pytest.fixture
def migration():
    assert not migration_lib.g_open_projects
    with tempfile.TemporaryDirectory() as temp_dir, patch('migration_plugin.lib.core.default_projects_directory') as mock_default_projects_directory:
        mock_default_projects_directory.return_value = str(temp_dir)
        yield {"projects_dir": temp_dir}
        migration_lib.close_all_projects()


def test_new_project(migration):
    project = new_project("Test", "mysql://user@host:3306")

    assert project["name"] == "Test"
    assert isinstance(project["id"], str)
    assert hasattr(project["path"], "__str__")


def test_get_migration_steps(migration):
    steps = get_migration_steps()

    assert isinstance(steps, list)
    assert (len(steps) == 5)


def test_open_project(migration):
    project_context = migration_lib.new_project(
        "Test_project", "mysql://user@host:3306")
    migration_lib.close_project(project_context.project.id)

    result_project = open_project(project_context.project.id)

    assert result_project["id"] == project_context.project.id
    assert result_project["name"] == project_context.project.name
    assert result_project["path"] == str(project_context.project.path)


def test_close_project(migration):
    project = new_project("Test", "mysql://user@host:3306")

    assert len(migration_lib.g_open_projects) == 1

    close_project(project["id"])

    assert not migration_lib.g_open_projects


def test_list_projects(migration):
    assert not list_projects()
    assert list_projects() == migration_lib.list_projects()

    new_project("test", "mysql://user@host:3306")
    new_project("test2", "mysql://user@host:3306")
    new_project("test3", "mysql://user@host:3306")
    migration_lib.close_all_projects()

    assert len(list_projects()) == 3
    assert list_projects() == migration_lib.list_projects()
