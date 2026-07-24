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

import errno

import pytest

from gui_plugin.migration.lib.backend.orchestration import MigrationFrontend, Orchestrator
from gui_plugin.migration.lib.project import Project


def _make_orchestrator(tmp_path):
    project_path = tmp_path / "project"
    project_path.mkdir()

    project = Project("test-project", project_path)
    project._resources.computePublicIP = "141.148.242.198"
    project._ssh_private_key_path = str(tmp_path / "ssh_key")

    orchestrator = Orchestrator(MigrationFrontend(), project)
    orchestrator.stopped = False
    return orchestrator


def test_connect_remote_helper_wait_ready_retries_connection_refused(
    mocker, tmp_path
):
    orchestrator = _make_orchestrator(tmp_path)
    fake_ssh = object()
    fake_helper = object()
    connection_refused = ConnectionRefusedError(
        errno.ECONNREFUSED, "Connection refused"
    )
    connect_ssh = mocker.patch(
        "gui_plugin.migration.lib.backend.orchestration.ssh_utils.connect_ssh",
        side_effect=[connection_refused, fake_ssh],
    )
    sleep = mocker.patch("time.sleep")
    remote_helper = mocker.patch(
        "gui_plugin.migration.lib.backend.orchestration.RemoteHelperClient",
        return_value=fake_helper,
    )

    helper = orchestrator.connect_remote_helper(wait_ready=True)

    assert helper is fake_helper
    assert connect_ssh.call_count == 2
    sleep.assert_called_once_with(10)
    remote_helper.assert_called_once_with(
        fake_ssh, token=orchestrator.migrator_instance_id
    )


def test_connect_remote_helper_wait_ready_does_not_retry_other_os_errors(
    mocker, tmp_path
):
    orchestrator = _make_orchestrator(tmp_path)
    network_unreachable = OSError(errno.ENETUNREACH, "Network is unreachable")
    connect_ssh = mocker.patch(
        "gui_plugin.migration.lib.backend.orchestration.ssh_utils.connect_ssh",
        side_effect=network_unreachable,
    )
    remote_helper = mocker.patch(
        "gui_plugin.migration.lib.backend.orchestration.RemoteHelperClient"
    )

    with pytest.raises(OSError) as err:
        orchestrator.connect_remote_helper(wait_ready=True)

    assert err.value is network_unreachable
    connect_ssh.assert_called_once()
    remote_helper.assert_not_called()
