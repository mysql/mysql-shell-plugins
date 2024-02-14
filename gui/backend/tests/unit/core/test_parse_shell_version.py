# Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

import pytest
from gui_plugin.core import Info

test_version = [
    ("Ver 8.0.24 for Win64 on x86_64 - for MySQL 8.0.24 (MySQL Community Server (GPL))", {
        "major": "8",
        "minor": "0",
        "patch": "24",
        "platform": "Win64",
        "architecture": "x86_64",
        "server_major": "8",
        "server_minor": "0",
        "server_patch": "24",
        "server_distribution": "MySQL Community Server (GPL)"

    }),
    ("Ver 8.0.24 for Linux on x86_64 - for MySQL 8.0.24-tr (MySQL Enterprise Server - Commercial)", {
        "major": "8",
        "minor": "0",
        "patch": "24",
        "platform": "Linux",
        "architecture": "x86_64",
        "server_major": "8",
        "server_minor": "0",
        "server_patch": "24",
        "server_distribution": "MySQL Enterprise Server - Commercial"

    }),
    ("Ver 8.0.24-com for Linux on x86_64 - for MySQL 8.0.24 (Source distribution)", {
        "major": "8",
        "minor": "0",
        "patch": "24",
        "platform": "Linux",
        "architecture": "x86_64",
        "server_major": "8",
        "server_minor": "0",
        "server_patch": "24",
        "server_distribution": "Source distribution"

    })
]

@pytest.mark.parametrize("version, expected", test_version)
def test_parse_shell_version(version, expected):
    info = Info.parse_shell_version(version)

    assert info["major"] == expected["major"]
    assert info["minor"] == expected["minor"]
    assert info["patch"] == expected["patch"]
    assert info["platform"] == expected["platform"]
    assert info["architecture"] == expected["architecture"]
    assert info["server_major"] == expected["server_major"]
    assert info["server_minor"] == expected["server_minor"]
    assert info["server_patch"] == expected["server_patch"]
    assert info["server_distribution"] == expected["server_distribution"]
