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
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

# full end-to-end tests where all OCI resources are created from scratch


import pathlib
import pytest
from typing import Optional
from migration_plugin.lib.project import Project
from migration_plugin.lib.backend import model
from migration_plugin.lib.backend.stage import OrchestratorInterface


class TestOrchestrator(OrchestratorInterface):
    def __init__(self, project: Project):
        super().__init__()

        self._project = project
        if not self._project.options.sourceConnectionOptions:
            self._project.options.sourceConnectionOptions = {
                "user": "root",
                "host": "localhost",
                "port": 3306,
                "password": "rootpassword"
            }

        if not self._project._source_info:
            self._project.source_info = model.ServerInfo(
                version="8.0.33",
                gtidMode="ON",
                serverType=model.ServerType.MySQL,
            )

    @property
    def options(self) -> model.MigrationOptions:
        return self._project.options

    @property
    def oci_config(self) -> dict:
        return {
            'user': 'ocid1.user.oc1..dummydummydummydummydummydummydummydummydummydummydummydummy',
            'region': 'dummy',
            'key_file': 'dummy',
            'fingerprint': 'aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa',
            'tenancy': 'ocid1.tenancy.oc1..dummydummydummydummydummydummydummydummydummydummydummydummy'}

    @property
    def cloud_resources(self) -> model.CloudResources:
        return self._project.resources

    @property
    def source_connection_options(self) -> dict:
        return self._project.source_connection_options

    @property
    def source_info(self) -> model.ServerInfo:
        return self._project.source_info

    @property
    def project(self) -> Project:
        return self._project

    @property
    def migrator_instance_id(self) -> str:
        return self._project.id


def make_stage_for_test(stage_class, project: Project):
    orchestrator = TestOrchestrator(project)

    return stage_class(orchestrator)


def make_test_project(mocker) -> Project:
    project = Project("test_project", pathlib.Path("test_project"))

    mocker.patch.object(project, "save_resources")

    return project


def mock_mds_plugin(mocker):
    mocker.patch("mds_plugin.core.get_oci_db_system_client")
    mocker.patch("mds_plugin.core.get_oci_mysql_channels_client")
    mocker.patch("mds_plugin.core.get_oci_db_backups_client")


def mock_get_db_system(mocker):
    mock_db_system = mocker.MagicMock()
    mock_db_system.id = "ocid1.dbsystem.oc1..dummydummydummydummydummydummydummydummydummydummydummydummy"
    mock_db_system.display_name = "test_db_system"
    mock_db_system.lifecycle_state = "ACTIVE"

    mocker.patch("oci.mysql.DbSystemClient.get_db_system",
                 return_value=mock_db_system)
