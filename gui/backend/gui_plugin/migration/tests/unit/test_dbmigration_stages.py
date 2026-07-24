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

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from gui_plugin.migration.lib.backend import dbmigration_stages, model


class FakeRemoteDumper:
    def __init__(self, args, owner):
        pass

    def available(self):
        return False


class FakeLocalDumper:
    def __init__(self, args):
        pass

    def dump(self, listener):
        return 0

    def stop(self):
        pass


def _dump_stage():
    owner = SimpleNamespace(
        stopped=False,
        cloud_resources=SimpleNamespace(computePublicIP="203.0.113.10"),
        source_connection_options={"host": "source.example.com"},
        push_output=MagicMock(),
        push_progress=MagicMock(),
        push_status=MagicMock(),
    )

    return dbmigration_stages.DumpStage(owner), owner


class TestDumpStage:

    def test_local_dump_output_uses_unknown_when_public_ip_is_empty(self):
        dump_stage, owner = _dump_stage()

        with patch.object(
            dump_stage, "_initialize_dump", return_value=True
        ), patch.object(
            dump_stage, "_prepare_dumper_args", return_value={}
        ), patch.object(
            dbmigration_stages, "RemoteDumper", FakeRemoteDumper
        ), patch.object(
            dbmigration_stages, "LocalDumper", FakeLocalDumper
        ), patch.object(
            dbmigration_stages.util, "get_my_public_ip", return_value=""
        ):
            dump_stage._work_thread()

        messages = [call.args[1] for call in owner.push_output.call_args_list]

        assert (
            "Source database will be exported from local host at unknown" in messages
        )
        owner.push_status.assert_called_with(
            model.SubStepId.DUMP,
            model.WorkStatusEvent.END,
            {},
            "Source database was exported",
        )
