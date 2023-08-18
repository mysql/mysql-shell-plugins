# Copyright (c) 2023, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is also distributed with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms, as
# designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have included with MySQL.
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

import pytest

from ... roles import *
from mrs_plugin import lib
from . helpers import get_default_role_init, RoleCT

def test_get_roles(phone_book):
    roles = get_roles(None, phone_book["session"])

    assert len(roles) == len(phone_book["roles"]) - 1

    for role in roles:
        assert role["caption"] in phone_book["roles"]
        assert role["id"] == phone_book["roles"][role["caption"]]

    roles = get_roles(phone_book["service_id"], phone_book["session"])

    assert len(roles) == len(phone_book["roles"])

    for role in roles:
        assert role["caption"] in phone_book["roles"]
        assert role["id"] == phone_book["roles"][role["caption"]]


def test_add_role(phone_book):
    session = phone_book["session"]
    role1_init = get_default_role_init("Test role 1", "This is the role 1 description")
    role2_init = get_default_role_init("Test role 2", "This is the role 2 description")
    role3_init = get_default_role_init("Test role 3", "This is the role 3 description")

    with RoleCT(session, **role1_init) as role1_id:
        with RoleCT(session, **role2_init) as role2_id:
            with RoleCT(session, **role3_init) as role3_id:
                local_roles = {
                    "Test role 1": role1_id,
                    "Test role 2": role2_id,
                    "Test role 3": role3_id,
                    **phone_book["roles"],
                }

                roles = get_roles(phone_book["service_id"], phone_book["session"])

                for role in roles:
                    assert role["caption"] in local_roles
                    assert role["id"] == local_roles[role["caption"]]
                    if role["caption"].startswith("Test role "):
                        assert role["description"] == f'This is the role {role["caption"][-1]} description'
