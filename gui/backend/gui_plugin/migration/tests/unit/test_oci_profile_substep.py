# Copyright (c) 2026, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is designed to work with certain software that is licensed
# under separate terms, as designated in a particular file or component
# or in included license documentation. The authors of MySQL hereby grant
# you an additional permission to link the program and your derivative
# works with the separately licensed software that they have either
# included with the program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful, but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

import pathlib
from unittest.mock import patch

import pytest

from gui_plugin.migration import plan_step
from gui_plugin.migration.lib import errors
from gui_plugin.migration.lib.project import Project


class DummyOwner:

    def __init__(self, project: Project):
        self.project = project
        self.events = []

    def notify(self, event):
        self.events.append(event)


class TestOCIProfileSubStep:

    def test_apply_rejects_region_outside_subscribed_regions(self, temp_dir):
        project_path = pathlib.Path(temp_dir) / "test-project"
        project_path.mkdir()
        project = Project(id="test-project", path=project_path)
        project.oci_profile = "DEFAULT"
        project.oci_config = {
            "tenancy": "ocid1.tenancy.oc1..exampleuniqueID",
            "region": "us-ashburn-1",
            "profile": "DEFAULT",
        }

        owner = DummyOwner(project)
        step = plan_step.OCIProfileSubStep(owner)

        with patch.object(
            project,
            "get_available_oci_regions",
            return_value=[
                "us-ashburn-1",
                "eu-frankfurt-1",
            ],
        ):
            with pytest.raises(errors.BadRequest, match="not subscribed"):
                step.apply({"values": {"region": "ap-singapore-1"}})

        assert owner.events == []
