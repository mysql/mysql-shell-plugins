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

from tests.conftest import table_contents
from mrs_plugin import lib
from mrs_plugin import routers

def test_add_delete_router(init_mrs, table_contents):
    router_table = table_contents("router")

    router_data = {
        "router_name": "test_router_2",
        "address": "localhost",
        "product_name": "MySQL Router",
        "version": "8.0.32",
        "attributes": { "test_router_attribute_1": "this is the test router attribute 1" },
        "options": { "test_router_option_1": "this is the test router option 1" }
    }
    router_id = routers.add_router(router_name="test_router_2",
        address="localhost",
        product_name="MySQL Router",
        version="8.0.32",
        attributes={ "test_router_attribute_1": "this is the test router attribute 1" },
        options={ "test_router_option_1": "this is the test router option 1" },
        session=init_mrs["session"])

    assert router_id

    router = lib.routers.get_router(init_mrs["session"], router_id)

    assert router
    assert not router_table.same_as_snapshot
    assert router_table.count == router_table.snapshot.count + 1

    for key, value in router_data.items():
        assert router[key] == value

    routers.delete_router(router["id"], init_mrs["session"])

    assert router_table.same_as_snapshot
