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

import argparse
import json
from pathlib import Path

import pytest

import setup_e2e


def test_setup_records_unmodified_mysql_version(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    config_template = tmp_path / ".env.test.json.in"
    config_template.write_text("{}\n", encoding="utf-8")
    config_file = tmp_path / ".env.test.json"

    monkeypatch.setattr(setup_e2e, "CONFIG_TEMPLATE", config_template)
    monkeypatch.setattr(setup_e2e, "CONFIG_FILE", config_file)
    monkeypatch.setattr(setup_e2e, "MYSQLSH_CONFIG_DIR", tmp_path / "mysqlsh")
    monkeypatch.setattr(setup_e2e, "is_port_in_use", lambda port: False)
    monkeypatch.setattr(setup_e2e, "deploy_sandbox", lambda *args: None)
    monkeypatch.setattr(
        setup_e2e,
        "mysql_server_info",
        lambda *args: ("1.2.3-commercial", "/mysql/base"),
    )
    monkeypatch.setattr(setup_e2e, "run_sql_file", lambda *args: None)

    setup_e2e.setup(
        argparse.Namespace(
            db_root_user="root",
            db_root_password="password",
        )
    )

    config = json.loads(config_file.read_text(encoding="utf-8"))
    assert config["MYSQL_VERSION"] == "1.2.3-commercial"
