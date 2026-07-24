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

from unittest import mock
import pytest
import threading
from gui_plugin.migration.lib.backend import model
from gui_plugin.migration.lib.backend.sync_stages import (
    CreateChannel,
    CreateSSHTunnel,
    MonitorChannel,
)
from gui_plugin.migration.lib.ssh_utils import RemoteSSHTunnel

from .mock_helpers import (
    make_stage_for_test,
    make_test_project,
    mock_get_db_system,
    mock_mds_plugin,
)


def test_create_ssh_tunnel_uses_idle_keepalive(mocker):
    """
    Ensure the built-in local SSH tunnel sends regular keepalives while idle.
    """

    project = make_test_project(mocker)
    project.options.migrationType = model.MigrationType.HOT
    project.options.cloudConnectivity = model.CloudConnectivity.LOCAL_SSH_TUNNEL
    project.resources.computePublicIP = "203.0.113.10"
    project._ssh_private_key_path = "/tmp/test_ssh_key"

    stage = make_stage_for_test(CreateSSHTunnel, project)
    stage.setup_tunnel()

    assert isinstance(stage._tunnel, RemoteSSHTunnel)
    assert stage._tunnel.keepalive == 30


def test_remote_ssh_tunnel_closes_partial_transport_on_connect_failure(mocker):
    tunnel = RemoteSSHTunnel(
        user="opc",
        from_host="203.0.113.10",
        from_port=3306,
        to_host="127.0.0.1",
        to_port=3306,
        key_filename="/tmp/test_ssh_key",
    )

    sock = mocker.patch("gui_plugin.migration.lib.ssh_utils.socket.socket").return_value
    transport = mocker.patch(
        "gui_plugin.migration.lib.ssh_utils.paramiko.Transport"
    ).return_value
    mocker.patch(
        "gui_plugin.migration.lib.ssh_utils.paramiko.RSAKey.from_private_key_file"
    ).return_value = mocker.Mock()
    transport.auth_publickey.side_effect = RuntimeError("auth failed")

    with pytest.raises(RuntimeError, match="auth failed"):
        tunnel._connect()

    sock.connect.assert_called_once_with(("203.0.113.10", 22))
    transport.close.assert_called_once()


def test_remote_ssh_tunnel_probe_times_out_and_closes_transport(mocker):
    tunnel = RemoteSSHTunnel(
        user="opc",
        from_host="203.0.113.10",
        from_port=3306,
        to_host="127.0.0.1",
        to_port=3306,
        key_filename="/tmp/test_ssh_key",
    )
    tunnel._probe_timeout = 0.01

    transport = mocker.Mock()
    transport.is_active.return_value = True
    release_probe = threading.Event()
    probe_started = threading.Event()

    def block_probe(*args, **kwargs):
        probe_started.set()
        release_probe.wait(1.0)
        return mocker.Mock()

    transport.global_request.side_effect = block_probe
    tunnel._transport = transport

    result = None

    def run_probe():
        nonlocal result
        result = tunnel._probe_transport()

    thread = threading.Thread(target=run_probe)
    thread.start()
    assert probe_started.wait(0.5)
    thread.join(0.5)

    try:
        assert not thread.is_alive()
        assert result is False
        transport.close.assert_called_once()
    finally:
        release_probe.set()
        thread.join(1.0)


def test_monitor_channel_reports_recovered_active_status(mocker):
    owner = mocker.Mock()
    stage = object.__new__(MonitorChannel)
    stage._id = model.SubStepId.MONITOR_CHANNEL
    stage._owner = owner

    stage._report_status(
        channel=None,
        channel_status={
            "gtid_executed": "",
            "gtid_received": None,
            "receiver_error": None,
            "applier_errors": [],
        },
        source_status={},
    )

    owner.push_progress.assert_called_once()
    source, message, status = owner.push_progress.call_args.args
    assert source == model.SubStepId.MONITOR_CHANNEL
    assert message == ""
    assert status.status == model.ReplicationStatus.ACTIVE
    assert status.details == ""
    assert status.errors == []


def test_monitor_channel_reports_receiver_error_as_details_only(mocker):
    owner = mocker.Mock()
    stage = object.__new__(MonitorChannel)
    stage._id = model.SubStepId.MONITOR_CHANNEL
    stage._owner = owner

    stage._report_status(
        channel=None,
        channel_status={
            "gtid_executed": "",
            "gtid_received": "",
            "receiver_error": {
                "errno": 2003,
                "error": "Can't connect to MySQL server",
            },
            "applier_errors": [],
        },
        source_status={},
    )

    owner.push_progress.assert_called_once()
    source, message, status = owner.push_progress.call_args.args
    assert source == model.SubStepId.MONITOR_CHANNEL
    assert message == ""
    assert status.status == model.ReplicationStatus.RECEIVER_ERROR
    assert status.details == "Target DBSystem is unable to connect to the source database."
    assert status.errors == ["Can't connect to MySQL server (error=2003)"]


def test_monitor_channel_empty_progress_clears_stale_message(mocker):
    project = make_test_project(mocker)
    mocker.patch.object(project, "save_progress")
    stage = project.work_status._stage(model.SubStepId.MONITOR_CHANNEL)
    stage.message = "Target DBSystem is unable to connect to the source database."

    project.log_work_progress(
        model.SubStepId.MONITOR_CHANNEL,
        "",
        {
            "status": model.ReplicationStatus.ACTIVE,
            "details": "",
            "errors": [],
        },
    )

    assert stage.message == ""


def test_create_channel_filtering(mocker):
    """
    Ensure that replication filtering options are properly generated for
    schema, user and object filters.
    """

    mock_mds_plugin(mocker)

    project = make_test_project(mocker=mocker)
    stage = make_stage_for_test(CreateChannel, project)

    def test_one(filters, wild_ignore_tables=[]):
        project.options.migrationType = model.MigrationType.HOT
        project.options.schemaSelection.filter = filters

        mock_create_channel = mocker.patch(
            "gui_plugin.migration.lib.oci_utils.DBSystem.create_channel"
        )

        mock_get_db_system(mocker)

        stage.ensure_channel()

        mock_create_channel.assert_called_once()
        args, kwargs = mock_create_channel.call_args

        def fixup(s):
            return s.replace("`", "")

        assert set(kwargs["replicate_ignore_db"]) == set(
            [fixup(s) for s in filters.schemas.exclude]
        )
        assert set(kwargs["replicate_ignore_table"]) == set(
            [fixup(t) for t in filters.tables.exclude]
        )
        assert set(kwargs["replicate_wild_ignore_table"]) == set(wild_ignore_tables)

    test_one(
        model.MigrationFilters(
            schemas=model.IncludeList(
                include=[],
                exclude=[],
            ),
            tables=model.IncludeList(
                include=[],
                exclude=[],
            ),
            users=model.IncludeList(
                include=["ignore"],
                exclude=["ignore"],
            ),
            views=model.IncludeList(
                include=["ignore"],
                exclude=["ignore"],
            ),
            routines=model.IncludeList(
                include=["ignore"],
                exclude=["ignore"],
            ),
            events=model.IncludeList(
                include=["ignore"],
                exclude=["ignore"],
            ),
            libraries=model.IncludeList(
                include=["ignore"],
                exclude=["ignore"],
            ),
            triggers=model.IncludeList(
                include=["ignore"],
                exclude=["ignore"],
            ),
        )
    )

    test_one(
        model.MigrationFilters(
            schemas=model.IncludeList(
                include=[],
                exclude=["mydb1", "mydb2"],
            ),
            tables=model.IncludeList(
                include=[],
                exclude=["`db1`.`table1`", "`db2`.`table2`"],
            ),
            users=model.IncludeList(
                include=["ignore"],
                exclude=["ignore"],
            ),
            views=model.IncludeList(
                include=["ignore"],
                exclude=["ignore"],
            ),
            routines=model.IncludeList(
                include=["ignore"],
                exclude=["ignore"],
            ),
            events=model.IncludeList(
                include=["ignore"],
                exclude=["ignore"],
            ),
            libraries=model.IncludeList(
                include=["ignore"],
                exclude=["ignore"],
            ),
            triggers=model.IncludeList(
                include=["ignore"],
                exclude=["ignore"],
            ),
        )
    )

    test_one(
        model.MigrationFilters(
            schemas=model.IncludeList(
                include=[],
                exclude=[],
            ),
            tables=model.IncludeList(
                include=[],
                exclude=["`db1`.`table1`", "`db2`.`table2`"],
            ),
        )
    )

    test_one(
        model.MigrationFilters(
            schemas=model.IncludeList(
                include=[],
                exclude=["mydb1", "mydb2"],
            ),
            tables=model.IncludeList(
                include=[],
                exclude=[],
            ),
        )
    )

    project._source_info.serverType = model.ServerType.RDS
    test_one(
        model.MigrationFilters(
            schemas=model.IncludeList(
                include=[],
                exclude=[],
            ),
            tables=model.IncludeList(
                include=[],
                exclude=[],
            ),
        ),
        wild_ignore_tables=["mysql.rds%"],
    )

    test_one(
        model.MigrationFilters(
            schemas=model.IncludeList(
                include=[],
                exclude=["mydb1", "mydb2"],
            ),
            tables=model.IncludeList(
                include=[],
                exclude=[],
            ),
        ),
        wild_ignore_tables=["mysql.rds%"],
    )

    project._source_info.serverType = model.ServerType.Aurora
    test_one(
        model.MigrationFilters(
            schemas=model.IncludeList(
                include=[],
                exclude=["mydb1", "mydb2"],
            ),
            tables=model.IncludeList(
                include=[],
                exclude=[],
            ),
        ),
        wild_ignore_tables=["mysql.rds%", "mysql.aurora%"],
    )
