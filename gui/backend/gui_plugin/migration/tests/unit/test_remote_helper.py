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
from unittest.mock import MagicMock, call

import pytest

from gui_plugin.migration.lib.backend import remote_helper


@pytest.mark.parametrize(
    ("version", "expected"),
    [
        ("Ver 26.10.3-commercial for Linux", ("26.10.3", "26.10.0")),
        ("Ver 26.10.0 for Linux", ("26.10.0", "26.7.0")),
        ("Ver 27.1.0 for Linux", ("27.1.0", "26.10.0")),
    ],
)
def test_mysqlsh_versions(version, expected):
    assert remote_helper._mysqlsh_versions(version) == expected


@pytest.mark.parametrize("version", ["MySQL Shell", "Ver 26.8.0 for Linux"])
def test_mysqlsh_versions_rejects_invalid_version(version):
    with pytest.raises(remote_helper.errors.RemoteHelperFailed):
        remote_helper._mysqlsh_versions(version)


def setup_mysqlsh_from_repo(
    mocker, tmp_path, responses, version="26.10.0", arch="x86_64\n", ssh=None
):
    if ssh is None:
        ssh = MagicMock()

    ssh.executeWithStdin.side_effect = [(0, arch), *responses]
    mysqlsh = mocker.patch.object(remote_helper, "mysqlsh")
    mysqlsh.globals.shell.version = f"Ver {version} for Linux"

    remote_helper.setup_mysqlsh(
        ssh=ssh,
        sftp=MagicMock(),
        local_basedir=str(tmp_path),
        target_basedir="./mysql-migration",
        progress_fn=MagicMock(),
    )

    return ssh


@pytest.mark.parametrize(
    ("arch_output", "rpm_arch"),
    [("x86_64\n", "x86_64"), ("arm64\n", "aarch64")],
)
def test_setup_mysqlsh_installs_current_version(
    mocker, tmp_path, arch_output, rpm_arch
):
    ssh = setup_mysqlsh_from_repo(
        mocker, tmp_path, [(0, "")], arch=arch_output
    )

    url = remote_helper._repo_mysqlsh_url("26.10.0", rpm_arch)
    assert ssh.executeWithStdin.call_args_list == [
        call("arch", ""),
        call(f"sudo yum -y install {url}", ""),
    ]


@pytest.mark.parametrize("status_code", [404, 410])
def test_setup_mysqlsh_falls_back_to_previous_version(
    mocker, tmp_path, status_code
):
    ssh = setup_mysqlsh_from_repo(
        mocker,
        tmp_path,
        [
            (1, f"Curl error (22): Status code: {status_code}"),
            (0, ""),
        ],
    )

    current_url = remote_helper._repo_mysqlsh_url("26.10.0", "x86_64")
    fallback_url = remote_helper._repo_mysqlsh_url("26.7.0", "x86_64")
    assert ssh.executeWithStdin.call_args_list == [
        call("arch", ""),
        call(f"sudo yum -y install {current_url}", ""),
        call(f"sudo yum -y install {fallback_url}", ""),
    ]


def test_setup_mysqlsh_does_not_fallback_for_other_errors(mocker, tmp_path):
    ssh = MagicMock()

    with pytest.raises(remote_helper.errors.RemoteHelperFailed):
        setup_mysqlsh_from_repo(
            mocker,
            tmp_path,
            [(1, "Package signature verification failed")],
            ssh=ssh,
        )

    current_url = remote_helper._repo_mysqlsh_url("26.10.0", "x86_64")
    assert ssh.executeWithStdin.call_args_list == [
        call("arch", ""),
        call(f"sudo yum -y install {current_url}", ""),
    ]


def test_setup_mysqlsh_fails_if_fallback_is_unavailable(mocker, tmp_path):
    ssh = MagicMock()

    with pytest.raises(remote_helper.errors.RemoteHelperFailed):
        setup_mysqlsh_from_repo(
            mocker,
            tmp_path,
            [
                (1, "Status code: 404"),
                (1, "Status code: 404"),
            ],
            ssh=ssh,
        )

    assert ssh.executeWithStdin.call_count == 3


def test_remote_helper_archive_preserves_gui_migration_package():
    with remote_helper.RemoteHelperClient(MagicMock(), "token") as client:
        archive = client.create_zip()

        with zipfile.ZipFile(archive) as helper_zip:
            files = set(helper_zip.namelist())

        assert "gui_plugin/__init__.py" in files
        assert "gui_plugin/migration/lib/backend/submysqlsh.py" in files
        assert "mds_plugin/__init__.py" in files
