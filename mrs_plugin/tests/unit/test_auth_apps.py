# Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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
from ... auth_apps import *

@pytest.mark.usefixtures("init_mrs")
def test_add_auth_apps(init_mrs, table_contents):
    auth_apps_table = table_contents("auth_app")
    args = {
        "auth_vendor_id": b'1\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00',
        "description": "Authentication via MySQL accounts",
        "url": "/test_auth",
        "access_token": "test_token",
        "limit_to_registered_users": False,
        "registered_users": "root",
        "app_id": "some app id",
        "session": init_mrs["session"]
    }

    result = add_auth_app(app_name="Test Auth App", service_id=init_mrs["service_id"], **args)
    assert result is not None
    # assert result == {'auth_app_id': 1}
    assert auth_apps_table.count == auth_apps_table.snapshot.count + 1
    assert auth_apps_table.get("id", result["auth_app_id"]) == {
        'access_token': args["access_token"],
        'app_id': args["app_id"],
        'auth_vendor_id': args['auth_vendor_id'],
        'default_role_id': None,
        'description': args["description"],
        'enabled': 1,
        'id': result["auth_app_id"],
        'limit_to_registered_users': int(args["limit_to_registered_users"]),
        'name': 'Test Auth App',
        'service_id': init_mrs["service_id"],
        'url': args["url"],
        'url_direct_auth': None,
        'use_built_in_authorization': 1
    }

@pytest.mark.usefixtures("init_mrs")
def test_get_auth_apps(init_mrs):
    args = {
        "include_enable_state": False,
        "session": init_mrs["session"],
    }
    apps = get_auth_apps(**args)
    assert apps is not None
