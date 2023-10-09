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

from mrs_plugin import lib
from mrs_plugin import routers
from tests.unit.helpers import TableContents

def test_add_delete_router(phone_book, table_contents):
    session = phone_book["session"]
    router_table: TableContents = table_contents("router")
    router_table.take_snapshot()
    router_table.same_as_snapshot

    router_data = {
        "router_name": "test_router_2",
        "address": "localhost",
        "product_name": "MySQL Router",
        "version": "8.0.32",
        "attributes": { "test_router_attribute_1": "this is the test router attribute 1" },
        "options": { "test_router_option_1": "this is the test router option 1" }
    }

    sql = """
        INSERT INTO `mysql_rest_service_metadata`.`router`
            (router_name, address, product_name, version, attributes, options)
        VALUES
            (?, ?, ?, ?, ?, ?)
    """
    params = [
        router_data["router_name"],
        router_data["address"],
        router_data["product_name"],
        router_data["version"],
        router_data["attributes"],
        router_data["options"]
    ]

    router_id = lib.core.MrsDbExec(sql, params).exec(session).id

    router = lib.routers.get_router(phone_book["session"], router_id)

    assert router
    assert not router_table.same_as_snapshot
    assert router_table.count == router_table.snapshot.count + 1

    for key, value in router_data.items():
        assert router[key] == value

    routers.delete_router(router["id"], phone_book["session"])

    assert router_table.same_as_snapshot
