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

import pytest

from ...users import *
from ... import lib
from .helpers import UserCT, get_default_user_init, TableContents

import hashlib
import hmac
import base64


def test_add_users(phone_book, table_contents):
    users_table: TableContents = table_contents("mrs_user")
    users_has_role_table = table_contents("mrs_user_has_role")
    user_init = {
        "name": "User 2",
        "email": "user2@host.com",
        "auth_app_id": phone_book["auth_app_id"],
        "vendor_user_id": None,
        "login_permitted": True,
        "mapped_user_id": None,
        "app_options": {},
        "auth_string": None,
        "session": phone_book["session"],
        "user_roles": [],
    }

    assert users_has_role_table.filter("user_id", phone_book["mrs_user1"]) == [
        {
            "user_id": phone_book["mrs_user1"],
            "role_id": lib.auth_apps.DEFAULT_ROLE_ID,
            "comments": "Default role.",
            "options": None,
        }
    ]

    user = None

    with pytest.raises(Exception) as exp:
        user = add_user(**user_init)
    assert str(exp.value) == "The authentication string is required for this app."
    assert user is None
    assert users_table.same_as_snapshot

    user_init["auth_string"] = "MySQLR0cks!"

    user = add_user(**user_init)
    assert user is not None
    assert users_table.count == users_table.snapshot.count + 1
    assert users_has_role_table.count == users_has_role_table.snapshot.count + 1

    user_auth_string = users_table.get("id", user["id"])["auth_string"]
    assert user_auth_string.startswith("$A$005")

    salt_base64 = user_auth_string.split("$")[3]

    salt = base64.b64decode(salt_base64)
    iterations = 5000

    hash = hashlib.pbkdf2_hmac(
        "sha256", user_init["auth_string"].encode(), salt, iterations
    )
    client_key = hmac.HMAC(hash, b"Client Key", digestmod=hashlib.sha256).digest()

    m = hashlib.sha256()
    m.update(client_key)
    stored_key = m.digest()

    parts = [
        "A",
        f"{int(iterations/1000):03}",
        base64.b64encode(salt).decode(),
        base64.b64encode(stored_key).decode(),
    ]

    test_auth_string = "$" + "$".join(parts)
    assert test_auth_string == user_auth_string

    delete_user(session=phone_book["session"], user_id=user["id"])

    assert users_table.same_as_snapshot


def test_get_users(phone_book, table_contents):
    session = phone_book["session"]
    auth_app_id = phone_book["auth_app_id"]
    users_table = table_contents("mrs_user")

    users = get_users(
        session=phone_book["session"], auth_app_id=phone_book["auth_app_id"]
    )
    assert users is not None
    assert len(users) == 1  # 1 inserted auth the auth_app

    for user in users:
        assert user["auth_string"] == lib.users.STORED_PASSWORD_STRING

    user_init = get_default_user_init(auth_app_id)
    with UserCT(session, **user_init) as user_id:
        users = get_users(
            session=phone_book["session"], auth_app_id=auth_app_id
        )
        assert users is not None
        assert len(users) == 2  # 1 added user + 1 inserted auth the auth_app

        for user in users:
            assert user["auth_string"] == lib.users.STORED_PASSWORD_STRING


def test_edit_users(phone_book, table_contents):
    session = phone_book["session"]
    auth_app_id = phone_book["auth_app_id"]
    users_table: TableContents = table_contents("mrs_user")

    user_init = get_default_user_init(auth_app_id)

    with UserCT(session, **user_init) as user_id:
        user = get_user(session=session, user_id=user_id)
        assert isinstance(user, dict)

        user_update = {
            "user_id": user_id,
            "value": {"email": "user2@anotherhost.com"},
            "session": session,
        }

        update_user(**user_update)

        user = get_user(session=phone_book["session"], user_id=user_id)

        assert user is not None
        assert user["email"] == user_update["value"]["email"]

        user_update = {
            "user_id": user_id,
            "value": {"auth_string": lib.users.STORED_PASSWORD_STRING},
            "session": session,
        }

        update_user(**user_update)

        users_table.items[1]["auth_string"] == user["auth_string"]

        user_update = {
            "user_id": user_id,
            "value": {"auth_string": "somotherpassword"},
            "session": session,
        }

        with pytest.raises(RuntimeError) as exp:
            update_user(**user_update)
        assert str(exp.value) == "The auth_app_id is required to set the auth_string."

        users_table.items[1]["auth_string"] == user["auth_string"]

        user_update = {
            "user_id": user_id,
            "value": {
                "auth_app_id": lib.core.convert_id_to_string(user["auth_app_id"])
            },
            "session": session,
        }

        new_values = {
            "name": "new user1 name",
            "email": "newuser1@host.com",
            "vendor_user_id": "new vendor user1 id",
            "login_permitted": False,
            "mapped_user_id": "new mapped user1",
            "app_options": {"name": "new app options name for user1"},
        }

        users_table.take_snapshot()

        original_record = users_table.snapshot.get("id", user_id)

        for key, value in new_values.items():
            user_update = {"user_id": user_id, "value": {}, "session": session}
            user_update["value"][key] = value
            original_record[key] = value

            update_user(**user_update)

            assert users_table.get("id", user_id) == original_record

        user_update = {
            "user_id": user_id,
            "value": {},
            "user_roles": None,
            "session": session,
        }

        # Update setting user_roles to None
        roles = get_user_roles(user_id)
        update_user(**user_update)
        roles2 = get_user_roles(user_id)

        assert roles == roles2

        # Update setting user_roles to an empty list
        user_update["user_roles"] = []
        update_user(**user_update)
        roles3 = get_user_roles(user_id)

        assert roles3 == []

        # Update setting user_roles to the previous roles
        for role in roles:
            user_update["user_roles"].append(
                {
                    "user_id": lib.core.convert_id_to_string(role["user_id"]),
                    "role_id": lib.core.convert_id_to_string(role["role_id"]),
                    "comments": role["comments"],
                }
            )

        update_user(**user_update)
        roles4 = get_user_roles(user_id)

        for role in roles:
            assert role["role_id"] in [r["role_id"] for r in roles4]

        user_update = {
            "user_id": user_id,
            "value": {"name": "User 1"},
            "session": session,
        }
        with pytest.raises(Exception) as exp:
            update_user(**user_update)
        assert (
            str(exp.value)
            == "MySQL Error (1644): This name has already been used."
        )

        user_update = {
            "user_id": user_id,
            "value": {"email": "user1@host.com"},
            "session": session,
        }
        with pytest.raises(Exception) as exp:
            update_user(**user_update)
        assert (
            str(exp.value)
            == "MySQL Error (1644): This email has already been used."
        )


def test_user_roles(phone_book, table_contents):
    session = phone_book["session"]
    auth_app_id = phone_book["auth_app_id"]
    user_init = get_default_user_init(auth_app_id)

    with UserCT(session, **user_init) as user_id:
        roles = get_user_roles(user_id)

        assert roles == []

        add_user_role(
            user_id,
            phone_book["roles"]["Full Access"],
            "Default role.",
            phone_book["session"],
        )
        roles = get_user_roles(user_id)

        assert roles == [
            {
                "caption": "Full Access",
                "comments": "Default role.",
                "derived_from_role_caption": None,
                "derived_from_role_id": None,
                "description": "Full access to all db_objects",
                "user_id": user_id,
                "role_id": lib.roles.FULL_ACCESS_ROLE_ID,
                "specific_to_service_id": None,
                "options": None,
                "user_role_options": None,
            },
        ]

        add_user_role(
            user_id,
            phone_book["roles"]["Process Admin"],
            "Added as process admin",
            phone_book["session"],
        )

        roles = get_user_roles(user_id)
        for r in roles:
            r["derived_from_role_id"] = None
            r["specific_to_service_id"] = None

        assert roles == [
            {
                "user_id": user_id,
                "role_id": phone_book["roles"]["Process Admin"],
                "caption": "Process Admin",
                "comments": "Added as process admin",
                "derived_from_role_caption": "Maintenance Admin",
                "derived_from_role_id": None,
                "description": "Process administrator.",
                "options": {},
                "specific_to_service_id": None,
                'user_role_options': None,
            },
            {
                "caption": "Full Access",
                "comments": "Default role.",
                "derived_from_role_caption": None,
                "derived_from_role_id": None,
                "description": "Full access to all db_objects",
                "user_id": user_id,
                "role_id": lib.roles.FULL_ACCESS_ROLE_ID,
                "specific_to_service_id": None,
                "options": None,
                'user_role_options': None,
            },
        ]

        delete_user_roles(user_id)

        roles = get_user_roles(user_id)

        assert roles == []

        add_user_role(
            user_id,
            phone_book["roles"]["Full Access"],
            "Default role.",
            phone_book["session"],
        )

        roles = get_user_roles(user_id)

        assert roles == [
            {
                "caption": "Full Access",
                "comments": "Default role.",
                "derived_from_role_caption": None,
                "derived_from_role_id": None,
                "description": "Full access to all db_objects",
                "user_id": user_id,
                "role_id": lib.roles.FULL_ACCESS_ROLE_ID,
                "specific_to_service_id": None,
                "options": None,
                'user_role_options': None,
            },
        ]


def test_user_sql(phone_book):
    session = phone_book["session"]

    import json

    with pytest.raises(Exception, match='ScriptingError: Invalid REST user "boss"@"MRS Auth App"'):
        session.run_sql('ALTER REST USER "boss"@"MRS Auth App" IDENTIFIED BY "somepassword";')

    with pytest.raises(Exception, match='ScriptingError: The password must not be empty.'):
        session.run_sql('ALTER REST USER "boss"@"MRS Auth App" IDENTIFIED BY "";')

    with pytest.raises(Exception, match='ScriptingError: Invalid REST user "boss"@"MRS Auth App"'):
        session.run_sql('ALTER REST USER "boss"@"MRS Auth App" IDENTIFIED BY "SomePassword";')

    with pytest.raises(Exception, match='ScriptingError: Invalid REST user "boss"@"MRS Auth App"'):
        session.run_sql('ALTER REST USER "boss"@"MRS Auth App" IDENTIFIED BY "SomePassword!";')

    session.run_sql("""CREATE REST USER "boss"@"MRS Auth App" IDENTIFIED BY "MySQLR0cks!" ACCOUNT LOCK OPTIONS {
                                          "email": "boss@example.com",
                                          "vendor_user_id": "vendor",
                                          "mapped_user_id": "vendorboss123"
                    } APP OPTIONS {"myoption": 12345};""")
    user = lib.users.get_user(session=session, user_name="boss", auth_app_name="MRS Auth App", service_id=phone_book["service_id"])
    assert user is not None
    assert user["email"] == "boss@example.com"
    assert not user["login_permitted"], "locked"
    assert user["vendor_user_id"] == "vendor"
    assert user["mapped_user_id"] == "vendorboss123"
    assert json.dumps(user["app_options"]) == '{"myoption": 12345}'

    session.run_sql('ALTER REST USER "boss"@"MRS Auth App" IDENTIFIED BY "MySQLR0cks!";')
    user = lib.users.get_user(session=session, user_name="boss", auth_app_name="MRS Auth App", service_id=phone_book["service_id"])
    assert user is not None
    assert user["email"] == "boss@example.com"
    assert not user["login_permitted"], "locked"
    assert user["vendor_user_id"] == "vendor"
    assert user["mapped_user_id"] == "vendorboss123"
    assert json.dumps(user["app_options"]) == '{"myoption": 12345}'

    session.run_sql("""ALTER REST USER "boss"@"MRS Auth App" OPTIONS {
                    "email": "boss@example2.com",
                    "vendor_user_id": "vendor2",
                    "mapped_user_id": "vendor123"
                    } APP OPTIONS {
                    "anything": [32]
                    };""")
    user = lib.users.get_user(session=session, user_name="boss", auth_app_name="MRS Auth App", service_id=phone_book["service_id"])
    assert user is not None
    assert user["email"] == "boss@example2.com"
    assert not user["login_permitted"], "locked"
    assert user["vendor_user_id"] == "vendor2"
    assert user["mapped_user_id"] == "vendor123"
    assert json.dumps(user["app_options"]) == '{"anything": [32]}'

    session.run_sql('ALTER REST USER "boss"@"MRS Auth App" ACCOUNT UNLOCK;')
    user = lib.users.get_user(session=session, user_name="boss", auth_app_name="MRS Auth App", service_id=phone_book["service_id"])
    assert user is not None
    assert user["login_permitted"], "locked"


def test_user_sql_service(phone_book):
    session = phone_book["session"]

    script = [
        "CREATE REST SERVICE localhost/one",
        "CREATE REST SERVICE localhost/two",
        'CREATE REST AUTH APP "app1" VENDOR MySQL COMMENTS "svc1"',
        'CREATE REST AUTH APP "app2" VENDOR MySQL COMMENTS "svc2"',
        'CREATE REST USER "usr"@"app1" OPTIONS {"email": "one@site.com"}',
        'CREATE REST USER "usr"@"app2" OPTIONS {"email": "two@site.com"}',
    ]
    for sql in script:
        try:
            session.run_sql(sql)
        except:
            print(sql)
            raise

    id_one = lib.services.get_service(session=session, url_host_name="localhost", url_context_root="/one")["id"]
    id_two = lib.services.get_service(session=session, url_host_name="localhost",url_context_root="/two")["id"]

    user = lib.users.get_user(session=session, user_name="usr", auth_app_name="app1", service_id=id_one)
    assert user["email"] == "one@site.com"
    user = lib.users.get_user(session=session, user_name="usr", auth_app_name="app2", service_id=id_two)
    assert user["email"] == "two@site.com"

    session.run_sql('ALTER REST USER "usr"@"app1" OPTIONS {"email": "ONE@site.com"}')
    session.run_sql('ALTER REST USER "usr"@"app2" OPTIONS {"email": "TWO@site.com"}')
    user = lib.users.get_user(session=session, user_name="usr", auth_app_name="app1", service_id=id_one)
    assert user["email"] == "ONE@site.com"
    user = lib.users.get_user(session=session, user_name="usr", auth_app_name="app2", service_id=id_two)
    assert user["email"] == "TWO@site.com"

    session.run_sql("DROP REST SERVICE localhost/one")
    session.run_sql("DROP REST SERVICE localhost/two")