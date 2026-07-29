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
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

import copy
from dataclasses import dataclass

import pytest

from mrs_plugin import auth_apps, db_objects, lib
from mrs_plugin.tests.e2e.component.harness import MrsHttpClient


_AUTH_APP_NAME = "Component MySQL"
_AUTH_VENDOR_ID = "0x31000000000000000000000000000000"
_LOGIN_PATH = "/test/authentication/login"
_STATUS_PATH = "/test/authentication/status"
_USERNAME = "mrs_component_e2e"
_PASSWORD = "ComponentE2E!1"
_LOCKED_USERNAME = "mrs_component_e2e_locked"
_PASSTHROUGH_PROCEDURE = "component_e2e_current_user"
_PASSTHROUGH_PATH = "/componentE2ECurrentUser"


@dataclass(frozen=True)
class _AuthenticationContext:
    component: object
    username: str
    password: str
    locked_username: str


def _run_sql(phone_book, statement):
    phone_book["session"].run_sql(statement)


def _delete_auth_app(phone_book, auth_app_id):
    lib.auth_apps.delete_auth_app(
        phone_book["session"],
        app_id=auth_app_id,
    )


def _delete_db_object(phone_book, db_object_id):
    lib.db_objects.delete_db_object(phone_book["session"], db_object_id)


def _restore_service_options(phone_book, service_id, options):
    lib.services.update_services(
        phone_book["session"],
        [service_id],
        {"options": options},
    )


def _create_mysql_account(component, phone_book, username, password, locked=False):
    account = f"'{username}'@'%'"
    statement = f"CREATE USER {account} IDENTIFIED BY '{password}'"
    if locked:
        statement += " ACCOUNT LOCK"

    phone_book["session"].run_sql(statement)
    component.add_cleanup(
        _run_sql,
        phone_book,
        f"DROP USER IF EXISTS {account}",
    )


def _configure_mysql_auth(component, phone_book):
    _create_mysql_account(
        component,
        phone_book,
        _USERNAME,
        _PASSWORD,
    )
    _create_mysql_account(
        component,
        phone_book,
        _LOCKED_USERNAME,
        _PASSWORD,
        locked=True,
    )

    result = auth_apps.add_auth_app(
        app_name=_AUTH_APP_NAME,
        service_id=phone_book["service_id"],
        auth_vendor_id=_AUTH_VENDOR_ID,
        description="MRS component E2E authentication",
        limit_to_registered_users=False,
        session=phone_book["session"],
    )
    auth_app_id = result["auth_app_id"]
    component.add_cleanup(_delete_auth_app, phone_book, auth_app_id)

    return _AuthenticationContext(
        component=component,
        username=_USERNAME,
        password=_PASSWORD,
        locked_username=_LOCKED_USERNAME,
    )


def _start_component(context):
    context.component.publish_service()
    context.component.install()
    context.component.wait_until_ready()
    context.component.http.wait_for_status(_STATUS_PATH, 200)
    return context


@pytest.fixture
def mysql_internal_component(mrs_component, phone_book):
    return _start_component(_configure_mysql_auth(mrs_component, phone_book))


@pytest.fixture
def passthrough_component(mrs_component, phone_book):
    context = _configure_mysql_auth(mrs_component, phone_book)
    session = phone_book["session"]
    service = lib.services.get_service(
        session,
        service_id=phone_book["service_id"],
    )
    original_options = copy.deepcopy(service["options"])
    mrs_component.add_cleanup(
        _restore_service_options,
        phone_book,
        phone_book["service_id"],
        original_options,
    )

    passthrough_options = copy.deepcopy(original_options)
    passthrough_options["passthroughDbUser"] = True
    lib.services.update_services(
        session,
        [phone_book["service_id"]],
        {"options": passthrough_options},
    )

    session.run_sql(
        f"""
        CREATE PROCEDURE `PhoneBook`.`{_PASSTHROUGH_PROCEDURE}` ()
        SQL SECURITY INVOKER
        SELECT CURRENT_USER() AS mysqlUser
        """
    )
    mrs_component.add_cleanup(
        _run_sql,
        phone_book,
        f"DROP PROCEDURE IF EXISTS `PhoneBook`.`{_PASSTHROUGH_PROCEDURE}`",
    )
    session.run_sql(
        f"""
        GRANT EXECUTE ON PROCEDURE
            `PhoneBook`.`{_PASSTHROUGH_PROCEDURE}`
        TO '{_USERNAME}'@'%'
        """
    )

    db_object_id = db_objects.add_db_object(
        session=session,
        schema_id=phone_book["schema_id"],
        db_object_name=_PASSTHROUGH_PROCEDURE,
        db_object_type="PROCEDURE",
        request_path=_PASSTHROUGH_PATH,
        crud_operation_format="FEED",
        requires_auth=True,
    )
    mrs_component.add_cleanup(
        _delete_db_object,
        phone_book,
        db_object_id,
    )

    return _start_component(context)


def _login(context, username, password, session_type="cookie"):
    client = MrsHttpClient(context.component.base_url)
    response = client.login(
        _LOGIN_PATH,
        username,
        password,
        session_type=session_type,
        auth_app=_AUTH_APP_NAME,
    )
    return client, response


def _assert_authorized(client):
    response = client.get(_STATUS_PATH)
    assert response.status == 200, response.text
    assert response.json()["status"] == "authorized"


def test_mysql_internal_authentication(mysql_internal_component):
    context = mysql_internal_component

    client, response = _login(
        context,
        context.username,
        context.password,
    )
    assert response.status == 200, response.text
    _assert_authorized(client)

    rejected_credentials = [
        (context.username, "wrong-password"),
        ("mrs_component_e2e_missing", context.password),
        (context.locked_username, context.password),
    ]
    for username, password in rejected_credentials:
        client, response = _login(context, username, password)
        assert response.status == 401, response.text
        assert response.json()["status"] == 401
        assert list(client.cookies) == []

    client, response = _login(
        context,
        context.username,
        context.password,
    )
    assert response.status == 200, response.text
    _assert_authorized(client)


def test_passthrough_uses_authenticated_mysql_user(passthrough_component):
    context = passthrough_component
    client, response = _login(
        context,
        context.username,
        context.password,
    )
    assert response.status == 200, response.text

    response = client.request_json(
        "POST",
        f"/test/PhoneBook{_PASSTHROUGH_PATH}",
        {},
    )
    assert response.status == 200, response.text
    assert response.json()["resultSets"][0]["items"] == [
        {"mysqlUser": f"{context.username}@%"}
    ]


def test_sessions_are_invalidated_after_restart(mysql_internal_component):
    context = mysql_internal_component
    cookie_client, response = _login(
        context,
        context.username,
        context.password,
    )
    assert response.status == 200, response.text
    _assert_authorized(cookie_client)

    bearer_client, response = _login(
        context,
        context.username,
        context.password,
        session_type="bearer",
    )
    assert response.status == 200, response.text
    _assert_authorized(bearer_client)

    context.component.grant_lifecycle_admin()
    assert context.component.restart() == 0
    context.component.wait_until_ready()

    for client in (cookie_client, bearer_client):
        response = client.wait_for_status(_STATUS_PATH, 200)
        assert response.json()["status"] == "unauthorized"

    new_client, response = _login(
        context,
        context.username,
        context.password,
    )
    assert response.status == 200, response.text
    _assert_authorized(new_client)
