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


import json

from dataclasses import dataclass, asdict
from gui_plugin.migration.lib.backend.model import MigrationMessage

k_sensitive_fields = [
    "password",
    "adminPassword",
    "adminPasswordConfirm",
    "pass_phrase",
]


@dataclass
class MyMessage(MigrationMessage):
    attribute: str = ""
    password: str = ""
    adminPassword: str = ""
    adminPasswordConfirm: str = ""
    pass_phrase: str = ""


def test_message_serialization():
    i = MyMessage(
        attribute="value",
        password="mypwd",
        adminPassword="myadminpwd",
        adminPasswordConfirm="myadminpwd",
        pass_phrase="mypassphrase",
    )

    to_string = str(i)
    to_repr = repr(i)
    to_json = json.dumps(i._json())
    to_json_class = json.dumps(i._json(noclass=False))

    # Serializing with asdict honors the order of declaration of the fields
    assert (
        to_string
        == '{"attribute": "value", "password": "****", "adminPassword": "****", "adminPasswordConfirm": "****", "pass_phrase": "****"}'
    )
    assert (
        to_repr
        == "MyMessage(attribute='value', password='mypwd', adminPassword='myadminpwd', adminPasswordConfirm='myadminpwd', pass_phrase='mypassphrase')"
    )
    assert (
        to_json
        == '{"adminPassword": "myadminpwd", "adminPasswordConfirm": "myadminpwd", "attribute": "value", "pass_phrase": "mypassphrase", "password": "mypwd"}'
    )
    assert (
        to_json_class
        == '{"_class": "MyMessage", "adminPassword": "myadminpwd", "adminPasswordConfirm": "myadminpwd", "attribute": "value", "pass_phrase": "mypassphrase", "password": "mypwd"}'
    )
