# Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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

from ... auth_apps import *
from ... import lib
from . helpers import AuthAppCT, UserCT, get_default_auth_app_init, get_default_user_init

import os

InitialAuthAppIds = []

def test_verify_auth_vendors(phone_book, table_contents):
    auth_vendor_table = table_contents("auth_vendor")

    assert auth_vendor_table.count == 5
    assert auth_vendor_table.items == [{
        "comments": "Built-in user management of MRS",
        "enabled": 1,
        "id": lib.core.id_to_binary("0x30000000000000000000000000000000", ""),
        "name": "MRS",
        "validation_url": None,
        "options": None,
    },
    {
        "comments": "Provides basic authentication via MySQL Server accounts",
        "enabled": 1,
        "id": lib.core.id_to_binary("0x31000000000000000000000000000000", ""),
        "name": "MySQL Internal",
        "validation_url": None,
        "options": None,
    },
    {
        "comments": "Uses the Facebook Login OAuth2 service",
        "enabled": 1,
        "id": lib.core.id_to_binary("0x32000000000000000000000000000000", ""),
        "name": "Facebook",
        "validation_url": None,
        "options": None,
    },
    {
        "comments": "Uses the Google OAuth2 service",
        "enabled": 1,
        "id": lib.core.id_to_binary("0x34000000000000000000000000000000", ""),
        "name": "Google",
        "validation_url": None,
        "options": None,
    },
    {
        "id": lib.core.id_to_binary("0x35000000000000000000000000000000", ""),
        "name": "OCI OAuth2",
        "validation_url": None,
        "enabled": 1,
        "comments": "Uses the OCI OAuth2 service",
        "options": None,
    }]


def test_add_auth_apps(phone_book, table_contents):
    session = phone_book["session"]
    auth_apps_table = table_contents("auth_app")

    args = {
        "auth_vendor_id": "0x31000000000000000000000000000000",
        "description": "Authentication via MySQL accounts",
        "url": "/test_auth",
        "access_token": "test_token",
        "limit_to_registered_users": False,
        "registered_users": None,
        "app_id": "some app id",
        "session": session
    }

    result1 = add_auth_app(app_name="Test Auth App", service_id=phone_book["service_id"], **args)
    assert result1 is not None
    InitialAuthAppIds.append(result1["auth_app_id"])
    assert auth_apps_table.count == auth_apps_table.snapshot.count + 1
    assert auth_apps_table.get("id", result1["auth_app_id"]) == {
        "access_token": args["access_token"],
        "app_id": args["app_id"],
        "auth_vendor_id": lib.core.id_to_binary(args["auth_vendor_id"], ""),
        "default_role_id": lib.auth_apps.DEFAULT_ROLE_ID,
        "description": args["description"],
        "enabled": 1,
        "id": result1["auth_app_id"],
        "limit_to_registered_users": int(args["limit_to_registered_users"]),
        "name": "Test Auth App",
        "url": args["url"],
        "url_direct_auth": None,
        "options": None,
    }

    args = {
        "auth_vendor_id": "0x31000000000000000000000000000000",
        "description": "Authentication via MySQL accounts 2",
        "url": "/test_auth2",
        "access_token": "test_token",
        "limit_to_registered_users": False,
        "registered_users": None,
        "app_id": "some app id",
        "session": phone_book["session"]
    }

    result2 = add_auth_app(app_name="Test Auth App 2", service_id=phone_book["service_id"], **args)
    assert result2 is not None
    InitialAuthAppIds.append(result2["auth_app_id"])
    assert auth_apps_table.count == auth_apps_table.snapshot.count + 2
    assert auth_apps_table.get("id", result2["auth_app_id"]) == {
        "access_token": args["access_token"],
        "app_id": args["app_id"],
        "auth_vendor_id": lib.core.id_to_binary(args["auth_vendor_id"], ""),
        "default_role_id": lib.auth_apps.DEFAULT_ROLE_ID,
        "description": args["description"],
        "enabled": 1,
        "id": result2["auth_app_id"],
        "limit_to_registered_users": int(args["limit_to_registered_users"]),
        "name": "Test Auth App 2",
        "url": args["url"],
        "url_direct_auth": None,
        "options": None,
    }

    assert auth_apps_table.count == 4

    delete_auth_app(session=phone_book["session"], app_id=result1["auth_app_id"])

    assert auth_apps_table.count == 3

    delete_auth_app(session=phone_book["session"], app_id=result2["auth_app_id"])

    assert auth_apps_table.count == 2


def test_get_auth_apps(phone_book):
    session = phone_book["session"]
    args = {
        "include_enable_state": False,
        "session": session,
    }
    apps = get_auth_apps(**args)
    assert apps == []


    args1 = {
        "name": "Test Auth App",
        "service_id": phone_book["service_id"],
        "auth_vendor_id": lib.core.id_to_binary("0x31000000000000000000000000000000", "auth_vendor_id"),
        "description": "Authentication via MySQL accounts",
        "url": "/test_auth",
        "access_token": "test_token",
        "limit_to_registered_users": False,
        "registered_users": None,
        "app_id": "some app id",
        "session": session
    }

    args2 = {
        "name": "Test Auth App 2",
        "service_id": phone_book["service_id"],
        "auth_vendor_id": lib.core.id_to_binary("0x31000000000000000000000000000000", "auth_vendor_id"),
        "description": "Authentication via MySQL accounts 2",
        "url": "/test_auth2",
        "access_token": "test_token",
        "limit_to_registered_users": False,
        "registered_users": None,
        "app_id": "some app id",
        "session": session
    }


    with AuthAppCT(**args1) as auth_app_id1:
        with AuthAppCT(**args2) as auth_app_id2:

            args = {
                "include_enable_state": True,
                "session": session,
            }
            apps = get_auth_apps(**args)

            assert apps is not None
            assert len(apps) == 4

            assert apps[2]["name"] == "Test Auth App"
            assert apps[2]["id"] == auth_app_id1
            assert apps[3]["name"] == "Test Auth App 2"
            assert apps[3]["id"] == auth_app_id2


    args = {
        "include_enable_state": True,
        "session": session,
    }
    apps = get_auth_apps(**args)

    assert apps is not None
    assert len(apps) == 2


def test_update_auth_apps(phone_book, table_contents):
    session = phone_book["session"]
    args = {
        "name": "Test Auth App",
        "service_id": phone_book["service_id"],
        "auth_vendor_id": lib.core.id_to_binary("0x31000000000000000000000000000000", "auth_vendor_id"),
        "description": "Authentication via MySQL accounts",
        "url": "/test_auth",
        "access_token": "test_token",
        "limit_to_registered_users": False,
        "registered_users": None,
        "app_id": "some app id",
    }
    with AuthAppCT(session, **args) as auth_app_id:
        auth_apps_table = table_contents("auth_app")
        value = {
            "name": "Test Auth App New",
            "description": "This is a new description",
            "url": "/test_app_new",
            "url_direct_auth": "new url direct auth",
            "access_token": "new access token",
            "app_id": "some app id",
            "enabled": False,
            "limit_to_registered_users": False,
            "default_role_id": None
        }
        args = {
            "app_id": auth_app_id,
            "session": session,
            "value": value
        }
        update_auth_app(**args)

        assert auth_apps_table.count == auth_apps_table.snapshot.count

        assert auth_apps_table.get("id", args["app_id"]) == {
            "access_token": value["access_token"],
            "app_id": value["app_id"],
            "auth_vendor_id": lib.core.id_to_binary("0x31000000000000000000000000000000", ""),
            "default_role_id": value["default_role_id"],
            "description": value["description"],
            "enabled": int(value["enabled"]),
            "id": args["app_id"],
            "limit_to_registered_users": int(value["limit_to_registered_users"]),
            "name": value["name"],
            "url": value["url"],
            "url_direct_auth": value["url_direct_auth"],
            "options": None,
        }


def test_dump_and_recover(phone_book):
    auth_app_create_statement2 = """CREATE OR REPLACE REST AUTH APP `MyAuthApp`
    VENDOR MYSQL
    COMMENT 'This is a comment'
    ALLOW NEW USERS TO REGISTER
    DEFAULT ROLE `Full Access`;

CREATE OR REPLACE REST USER `user1`@`MyAuthApp`
    OPTIONS {
        "key1": "value1"
    }
    APP OPTIONS {
        "key2": "value2"
    };

GRANT REST ROLE `Full Access` TO `user1`@`MyAuthApp`
    COMMENT 'Comment for user role';"""

    session = phone_book["session"]
    schema_id = phone_book["schema_id"]
    auth_app = get_default_auth_app_init(name="MyAuthApp",
                                         url="/myAuthApp",
                                         default_role_id=lib.core.id_to_binary("0x31000000000000000000000000000000", "default_role_id"),
                                         description="This is a comment")
    script = ""

    auth_apps = lib.auth_apps.get_auth_apps(session, None)
    assert len(auth_apps) == 2

    with AuthAppCT(session, **auth_app) as auth_app_id:
        auth_apps = lib.auth_apps.get_auth_apps(session, None)
        assert len(auth_apps) == 3

        user_init = get_default_user_init(auth_app_id, name="user1", auth_string=None, options={"key1": "value1"}, app_options={"key2": "value2"})

        with UserCT(session, **user_init) as user_id:

            lib.users.add_user_role(session,
                                    user_id,
                                    lib.core.id_to_binary("0x31000000000000000000000000000000", "role_id"),
                                    comments="Comment for user role")

            full_path_file = os.path.expanduser("~/auth_app2.dump.sql")

            # Test home path
            create_function = lambda file_path, overwrite: \
                store_auth_app_create_statement(file_path=file_path,
                                                overwrite=overwrite,
                                                auth_app_id=auth_app_id,
                                                include_all_objects=True,
                                                session=phone_book["session"])

            result = create_function(file_path=full_path_file, overwrite=True)

            assert result == True

            with open(os.path.expanduser(full_path_file), "r+") as f:
                script = f.read()
                assert script == auth_app_create_statement2


    auth_apps = lib.auth_apps.get_auth_apps(session, None)
    assert len(auth_apps) == 2

    lib.script.run_mrs_script(path=full_path_file)

    auth_apps = lib.auth_apps.get_auth_apps(session, None)
    assert len(auth_apps) == 3

    for auth_app in auth_apps:
        if auth_app["name"] == "MyAuthApp":
            lib.auth_apps.delete_auth_app(session, auth_app["id"])

    auth_apps = lib.auth_apps.get_auth_apps(session, None)
    assert len(auth_apps) == 2

