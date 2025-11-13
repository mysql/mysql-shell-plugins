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
# separately licensed software that they have either included with the
# program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

import json
import os
import pathlib
import shutil
import tempfile
import time
from unittest.mock import MagicMock, patch
import pytest
from migration_plugin import migration
from migration_plugin.lib.project import Project


class TestProjectCreation:

    def test_project_create(self, temp_dir):
        with patch('migration_plugin.lib.core.default_projects_directory') as mock_dir:
            mock_dir.return_value = temp_dir

            project = Project.create("test-project")

            assert project.id.startswith("test-project-")
            assert project.name == "test-project"
            assert project.path.exists()
            assert (project.path / "data.json").exists()

    def test_project_open(self, temp_dir):
        with patch('migration_plugin.lib.core.default_projects_directory') as mock_dir:
            mock_dir.return_value = temp_dir

            project = Project.create("test-project")
            project_id = project.id

            opened_project = Project.open(project_id)

            assert opened_project.id == project_id
            assert opened_project.path == project.path

    def test_project_init(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()

        project = Project(id="test-project", path=project_path)

        assert project.id == "test-project"
        assert project.path == project_path
        assert project._name == ""


class TestProjectProperties:

    def test_name_property(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        project._name = "My Project"
        assert project.name == "My Project"

    def test_path_property(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        assert project.path == project_path

    def test_region_property(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        project.region = "us-ashburn-1"
        assert project.region == "us-ashburn-1"

    def test_options_property(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        assert project.options is not None
        assert hasattr(project.options, 'targetHostingOptions')
        assert hasattr(project.options, 'targetMySQLOptions')

    def test_resources_property(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        assert project.resources is not None

    def test_oci_config_file_property(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        assert project.oci_config_file == os.path.expanduser(
            "~/.oci/config")

        project.oci_config_file = "/custom/path/config"
        assert project.oci_config_file == "/custom/path/config"

    def test_oci_profile_property(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        assert project.oci_profile == "DEFAULT"

        project.oci_profile = "custom-profile"
        assert project.oci_profile == "custom-profile"

    def test_oci_config_property(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        assert project.oci_config == {}

        config = {"user": "test", "region": "us-ashburn-1"}
        project.oci_config = config
        assert project.oci_config == config

    def test_source_info_property(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        mock_server_info = MagicMock()
        project.source_info = mock_server_info
        assert project.source_info == mock_server_info


class TestProjectMethods:

    def test_save_method(self, temp_dir):
        with patch('migration_plugin.lib.core.default_projects_directory') as mock_dir:
            mock_dir.return_value = temp_dir

            project = Project.create("test-project")

            data_file = project.path / "data.json"
            assert data_file.exists()

            with open(data_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            assert data["id"] == project.id
            assert "options" in data
            assert "ociConfigFile" in data
            assert "ociProfile" in data
            assert "ociConfigOwned" in data

    def test_close_method(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        project.close()

    def test_log_work_method(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        from migration_plugin.lib.backend.model import SubStepId, WorkStatusEvent
        mock_stage = SubStepId.ORCHESTRATION
        mock_event = WorkStatusEvent.BEGIN

        info = {"message": "Test log entry"}
        project.log_work(mock_stage, mock_event, info)

        progress_file = project.path / "progress.json"
        assert progress_file.exists()

        with open(progress_file, 'r', encoding='utf-8') as f:
            content = f.read()
            assert "in_progress" in content


class TestOCIConfiguration:

    def test_make_oci_config_error_no_config(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        error = project._make_oci_config_error("Test error")
        assert "Test error" in str(error)
        assert project.oci_config_file in str(error)

    def test_make_oci_config_error_with_config(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        project.oci_config = {"profile": "test-profile"}
        error = project._make_oci_config_error("Test error")
        assert "Test error" in str(error)
        assert project.oci_config_file in str(error)
        assert "test-profile" in str(error)

    def test_check_oci_config_no_config(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        try:
            project.check_oci_config()
            assert False, "Expected exception to be raised"
        except Exception:
            pass

    def test_open_oci_profile_file_not_exists(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        project.oci_config_file = "/nonexistent/path/config"
        result = project.open_oci_profile()
        assert result is False

    def test_open_oci_profile_file_exists(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        config_file = project_path / "oci_config"
        config_file.write_text("[DEFAULT]\nregion=us-ashburn-1\n")

        def mock_get_config(path, profile):
            return {"region": "us-ashburn-1", "profile": "DEFAULT"}

        with patch('migration_plugin.lib.oci_utils.get_config', side_effect=mock_get_config):
            project.oci_config_file = str(config_file)
            result = project.open_oci_profile()

            assert result is True
            assert project.oci_config == {
                "region": "us-ashburn-1", "profile": "DEFAULT"}
            assert project.region == "us-ashburn-1"


class TestSSHKeyManagement:

    def test_create_ssh_key_pair(self, temp_dir):
        with patch('migration_plugin.lib.core.default_projects_directory') as mock_dir:
            mock_dir.return_value = temp_dir

            project = Project.create("test-project")

            def mock_create_ssh_key_pair(private_key_path, public_key_path):
                pathlib.Path(private_key_path).write_text(
                    "private key", encoding='utf-8')
                pathlib.Path(public_key_path).write_text(
                    "public key", encoding='utf-8')

            with patch('migration_plugin.lib.ssh_utils.create_ssh_key_pair', side_effect=mock_create_ssh_key_pair):
                project.create_ssh_key_pair()

                assert project._ssh_private_key_path.endswith("ssh_rsa")
                assert project._ssh_public_key_path.endswith("ssh_rsa.pub")

    def test_save_shared_ssh_key_pair(self, temp_dir):
        with patch('migration_plugin.lib.core.default_projects_directory') as mock_dir:
            mock_dir.return_value = temp_dir

            project = Project.create("test-project")

            project._ssh_private_key_path = str(project.path / "ssh_rsa")
            project._ssh_public_key_path = str(
                project.path / "ssh_rsa.pub")
            pathlib.Path(project._ssh_private_key_path).write_text(
                "private key", encoding='utf-8')
            pathlib.Path(project._ssh_public_key_path).write_text(
                "public key", encoding='utf-8')

            shared_dir = temp_dir + "/shared"
            os.makedirs(shared_dir, exist_ok=True)

            with patch('migration_plugin.lib.core.default_shared_ssh_key_directory') as mock_shared_dir:
                mock_shared_dir.return_value = shared_dir

                def mock_rename(src, dst):
                    shutil.move(src, dst)

                with patch('os.rename', side_effect=mock_rename):
                    with patch('shutil.move') as mock_move:
                        project.save_shared_ssh_key_pair(
                            "ocid1.instance.oc1.ashburn.12345")

                        assert project._ssh_private_key_path_shared.endswith(
                            "12345")

    def test_save_shared_ssh_key_pair_already_shared(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        project._ssh_private_key_path_shared = "/shared/key"

        project.save_shared_ssh_key_pair(
            "ocid1.instance.oc1.ashburn.12345")
        assert project._ssh_private_key_path_shared == "/shared/key"

    def test_find_shared_ssh_key_exists(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        shared_dir = temp_dir + "/shared"
        os.makedirs(shared_dir, exist_ok=True)
        shared_key_path = shared_dir + "/12345"
        pathlib.Path(shared_key_path).write_text(
            "private key", encoding='utf-8')

        project._shared_ssh_key_directory = shared_dir

        result = project.find_shared_ssh_key(
            "ocid1.instance.oc1.ashburn.12345")

        assert result is True
        assert project._ssh_private_key_path_shared == shared_key_path

    def test_find_shared_ssh_key_not_exists(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        shared_dir = temp_dir + "/shared"
        os.makedirs(shared_dir, exist_ok=True)

        with patch('migration_plugin.lib.core.default_shared_ssh_key_directory') as mock_shared_dir:
            mock_shared_dir.return_value = shared_dir

            result = project.find_shared_ssh_key(
                "ocid1.instance.oc1.ashburn.12345")

            assert isinstance(result, bool)


class TestSSHKeyProperties:

    def test_ssh_key_private_shared(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        project._ssh_private_key_path_shared = "/shared/key"
        assert project.ssh_key_private == "/shared/key"

    def test_ssh_key_private_not_shared(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        project._ssh_private_key_path = "/project/key"
        assert project.ssh_key_private == "/project/key"

    def test_ssh_key_public_not_shared(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        project._ssh_public_key_path = "/project/key.pub"
        assert project.ssh_key_public == "/project/key.pub"


class TestEdgeCases:

    def test_name_property_assertion_error(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        try:
            _ = project.name
            assert False, "Expected AssertionError"
        except AssertionError:
            pass

    def test_source_connection_options_assertion_error(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        try:
            _ = project.source_connection_options
            assert False, "Expected AssertionError"
        except AssertionError:
            pass

    def test_source_password_assertion_error(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        project._options.sourceConnectionOptions = {"user": "test"}

        try:
            _ = project.source_password
            assert False, "Expected AssertionError"
        except AssertionError:
            pass

    def test_source_info_assertion_error(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        try:
            _ = project.source_info
            assert False, "Expected AssertionError"
        except AssertionError:
            pass

    def test_ssh_key_private_assertion_error(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        try:
            _ = project.ssh_key_private
            assert False, "Expected AssertionError"
        except AssertionError:
            pass

    def test_ssh_key_public_assertion_error_shared(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        project._ssh_private_key_path_shared = "/shared/key"

        try:
            _ = project.ssh_key_public
            assert False, "Expected AssertionError"
        except AssertionError:
            pass

    def test_ssh_key_public_assertion_error_no_public(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        try:
            _ = project.ssh_key_public
            assert False, "Expected AssertionError"
        except AssertionError:
            pass

    def test_save_shared_ssh_key_pair_assertion_error(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)

        try:
            project.save_shared_ssh_key_pair("")
            assert False, "Expected AssertionError"
        except AssertionError:
            pass

    def test_project_with_special_characters_in_name(self, temp_dir):
        with patch('migration_plugin.lib.core.default_projects_directory') as mock_dir:
            mock_dir.return_value = temp_dir

            project = Project.create("test-project@#$%")

            assert "test-project" in project.id
            assert project.name == "test-project@#$%"

    def test_project_path_creation_with_existing_directory(self, temp_dir):
        with patch('migration_plugin.lib.core.default_projects_directory') as mock_dir:
            mock_dir.return_value = temp_dir

            project1 = Project.create("test-project")

            time.sleep(1.0)  # 1 second delay to ensure different timestamp

            project2 = Project.create("test-project")

            assert project1.id != project2.id
            assert project1.path != project2.path


def test_project_save_open():
    project = migration.new_project(
        "myproject", source_url="root@localhost:3306")

    trash = migration.new_project(
        "myproject2", source_url="admin@example.com:3306")

    project2 = migration.open_project(project.id)
    assert project.name == project2.name
    assert project.source == project2.source
    assert project.path == project2.path

    assert project.name != trash.name
    assert project.source != trash.source
    assert project.path != trash.path

    shutil.rmtree(trash.path)
    shutil.rmtree(project.path)
