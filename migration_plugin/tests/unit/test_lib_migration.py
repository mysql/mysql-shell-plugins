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

from pathlib import Path
import tempfile
import pytest  # type: ignore
from unittest.mock import patch
from migration_plugin.lib.migration import *


@pytest.fixture
def lib_migration():
    assert not g_open_projects
    with tempfile.TemporaryDirectory() as temp_dir, patch('migration_plugin.lib.core.default_projects_directory') as mock_default_projects_directory:
        mock_default_projects_directory.return_value = str(temp_dir)
        yield {"projects_dir": temp_dir}
        close_all_projects()


def test_new_project_invalid_name(lib_migration):
    with pytest.raises(ValueError, match="The given project name must not be empty."):
        new_project("", "")


def test_new_project_invalid_source_url(lib_migration):
    with pytest.raises(ValueError, match="The given source url must not be empty."):
        new_project("Name", "")


def test_open_project_correct_project(lib_migration):
    project_name = "Project Test"

    project_context = new_project(
        project_name, "mysql://user@host:3306")
    project_id = project_context.project.id
    project_path = project_context.project.path

    # other, filler project
    new_project("test1", "mysql://user@host:3306")
    new_project("test2", "mysql://user@host:3306")

    close_all_projects()

    project_context = open_project(project_id)

    assert project_context is not None
    assert project_context.project is not None
    assert project_context.plan_step is not None
    assert project_context.work_step is not None
    assert project_id == project_context.project.id
    assert project_name == project_context.project.name
    assert project_path == project_context.project.path


def test_open_project_other_projects(lib_migration):
    # Currently, only one migration project is permitted
    # TODO: Correct test, when multiple projects are allowed
    assert not g_open_projects

    project_context1 = new_project(
        "Test1", "mysql://user@host:3306")
    project_context2 = new_project(
        "Test2", "mysql://user@host:3306")

    assert len(g_open_projects) == 1

    # force multiple projects
    g_open_projects[project_context1.project.id] = project_context1

    assert len(g_open_projects) == 2

    result_context = open_project(project_context2.project.id)

    assert result_context.project.id == project_context2.project.id
    assert result_context.project.name == project_context2.project.name
    assert result_context.project.path == project_context2.project.path


def test_get_project_no_id_single_project(lib_migration):
    project_context = new_project(
        "Test Project", "mysql://user@host:3306")

    result = get_project()

    assert isinstance(result, ProjectContext)
    assert result.project.id == project_context.project.id


def test_get_project_with_id(lib_migration):
    project_context = new_project(
        "Test Project", "mysql://user@host:3306")

    result = get_project(project_context.project.id)

    assert isinstance(result, ProjectContext)
    assert result.project.id == project_context.project.id


def test_get_project_no_id_multiple_projects(lib_migration):
    # Currently, only one migration project is permitted
    # TODO: Correct test, when multiple projects are allowed
    project_context1 = new_project(
        "Test Project 1", "mysql://user@host:3306")
    project_context2 = new_project(
        "Test Project 2", "mysql://user@host:3306")

    assert len(g_open_projects) == 1
    assert not project_context1.project.id in g_open_projects
    assert project_context2.project.id in g_open_projects

    # force multpile projects
    g_open_projects[project_context1.project.id] = project_context1

    # more than one project, no id - assert
    with pytest.raises(ValueError, match="Given project is not open"):
        get_project()


def test_get_project_invalid_id(lib_migration):
    new_project("Test Project", "mysql://user@host:3306")

    with pytest.raises(ValueError, match="Given project is not open"):
        get_project("invalid_id")


def test_get_project_no_projects(lib_migration):
    with pytest.raises(ValueError, match="You must open a migration project first"):
        get_project()


def test_list_projects_empty_dir(lib_migration):
    assert list_projects() == []


def test_list_projects_path_not_exists():
    with patch('migration_plugin.lib.core.default_projects_directory') as mock_default_projects_directory:
        mock_default_projects_directory.return_value = str("/not/existing/dir")
        assert list_projects() == []


def test_list_projects_no_data_json(lib_migration):
    # Create a directory that mimics a project without data.json
    project_dir = Path(lib_migration['projects_dir']) / 'project1'
    project_dir.mkdir()

    assert list_projects() == []


def test_list_projects_valid_project(lib_migration):
    project_name = 'Test Project 1'
    project_context = new_project(
        project_name, "mysql://user@host:3306")
    project_id = project_context.project.id
    project_path = project_context.project.path
    close_all_projects()

    projects = list_projects()

    assert len(projects) == 1
    assert projects[0]['id'] == project_id
    assert projects[0]['name'] == project_name
    assert projects[0]['path'] == str(project_path)


def test_list_projects_invalid_json_exception(lib_migration):
    project_context = new_project(
        'Test Project 1', "mysql://user@host:3306")
    project_path = project_context.project.path
    close_all_projects()

    data_json_path = Path(project_path) / 'data.json'
    with open(data_json_path, 'w') as file:
        file.write("Some Invalid JSON")

    with patch('migration_plugin.lib.logging.warning') as mock_warning:
        list_projects()
        mock_warning.assert_called_once()
        args, _ = mock_warning.call_args
        assert str(args[0]).startswith(
            f"Error parsing presumed migration project data from {data_json_path}")


def test_list_projects_list_exception(lib_migration):
    new_project('Test Project 1', "mysql://user@host:3306")
    close_all_projects()

    temp_dir = lib_migration["projects_dir"]
    with patch('os.listdir') as mock_listdir, patch('migration_plugin.lib.logging.warning') as mock_warning:
        mock_listdir.side_effect = Exception("Forced Exception")
        list_projects()
        mock_warning.assert_called_once()
        args, _ = mock_warning.call_args
        assert str(args[0]).startswith(
            f"Error looking for migration projects in {temp_dir}: Forced Exception")
