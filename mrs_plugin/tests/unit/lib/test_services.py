# Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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
from mrs_plugin.tests.unit.helpers import ServiceCT
from lib.core import MrsDbSession


def test_get_service(phone_book, table_contents):
    with MrsDbSession(session=phone_book["session"]) as session:
        service_table = table_contents("service")
        service1 = lib.services.get_service(session=session, url_context_root="/test", url_host_name="localhost")

        assert service1 is not None
        assert service1 == {
            'id': phone_book["service_id"],
            'enabled': 1,
            'url_protocol': ['HTTP'],
            'url_host_name': 'localhost',
            'url_context_root': '/test',
            'url_host_id': phone_book["url_host_id"],
            'comments': 'Test service',
            'host_ctx': 'localhost/test',
            'auth_completed_page_content': None,
            'auth_completed_url': None,
            'auth_completed_url_validation': None,
            'auth_path': '/authentication',
            'options': None,
            'is_current': 1,
        }

        with ServiceCT("/service2", "localhost") as service_id:
            assert service_table.count == service_table.snapshot.count + 1

            service2 = lib.services.get_service(session=session, url_context_root="/service2", url_host_name="localhost")

            assert service2 is not None
            assert service2 == {
                'id': service_id,
                'enabled': 1,
                'url_protocol': ['HTTP'],
                'url_host_name': 'localhost',
                'url_context_root': '/service2',
                'url_host_id': service2["url_host_id"],
                'comments': "",
                'host_ctx': 'localhost/service2',
                'auth_completed_page_content': None,
                'auth_completed_url': None,
                'auth_completed_url_validation': None,
                'auth_path': '/authentication',
                'options': None,
                'is_current': 0,
            }

            assert service_table.get("id", service_id) == {
                'comments': '',
                'enabled': 1,
                'id': service_id,
                'url_context_root': '/service2',
                'url_host_id': service2["url_host_id"],
                'url_protocol': ['HTTP'],
                'auth_completed_page_content': None,
                'auth_completed_url': None,
                'auth_completed_url_validation': None,
                'auth_path': '/authentication',
                'options': None,
                'custom_metadata_schema': None,
                'enable_sql_endpoint': 0,
            }

            with pytest.raises(Exception) as exc_info:
                lib.services.get_service(session=session, url_context_root="service2", url_host_name="localhost")
            assert str(exc_info.value) == "The url_context_root has to start with '/'."

        # Test getting the default service
        result = lib.services.get_service(session=session, url_context_root="/service2", url_host_name="localhost", get_default=False)
        assert result is None

        result = lib.services.get_service(session=session, url_context_root="/service2", url_host_name="localhost", get_default=True)
        assert result is not None

        with ServiceCT("/service2", "localhost") as service_id:
            lib.services.set_current_service_id(session, service_id)

        result = lib.services.get_service(session=session, url_context_root="/service2", url_host_name="localhost", get_default=False)
        assert result is None

        result = lib.services.get_service(session=session, url_context_root="/service2", url_host_name="localhost", get_default=True)
        assert result is None

        lib.services.set_current_service_id(session, phone_book["service_id"])

        result = lib.services.get_service(session=session, url_context_root="/service2", url_host_name="localhost", get_default=True)
        assert result is not None



def test_change_service(phone_book, table_contents):
    service_table = table_contents("service")
    auth_app_table = table_contents("auth_app")

    auth_apps = [{
        "auth_vendor_id": "0x31000000000000000000000000000000",
        "auth_vendor_name": "Service 1 app 1",
        "url_direct_auth": "/app1",
        "app_id": "my app id 1",
        "limit_to_registered_users": 0,
        "access_token": "TestToken1",
    }, {
        "auth_vendor_id": "0x31000000000000000000000000000000",
        "auth_vendor_name": "Service 1 app 2",
        "url_direct_auth": "/app2",
        "app_id": "my app id 2",
        "limit_to_registered_users": 0,
        "access_token": "TestToken2",
    }]

    with MrsDbSession(session=phone_book["session"]) as session:
        with pytest.raises(Exception) as exc_info:
                lib.services.update_services(session=session, service_ids=[1000], value={"enabled": True})
        assert str(exc_info.value) == "'int' object has no attribute 'hex'"

        with ServiceCT("/service2", "localhost", auth_apps=auth_apps) as service_id:
            auth_apps_in_db = auth_app_table.filter("service_id", service_id)
            assert len(auth_apps_in_db) == 2

            value = {
                "auth_apps": [{
                    "id": auth_apps_in_db[0]["id"],
                    "auth_vendor_id": 1,
                    "auth_vendor_name": "Service 1 app 1 Updated",
                    "service_id": service_id,
                    "url_direct_auth": "/app2",
                    "app_id": "my app id 1 update",
                    "limit_to_registered_users": 0,
                    "access_token": "TestToken2Updated",
                    "description": "This is a description 1"
                }, {
                    "id": None,
                    "auth_vendor_id": 1,
                    "auth_vendor_name": "Service 1 app 3",
                    "service_id": service_id,
                    "url_direct_auth": "/app3",
                    "app_id": "my app id 3",
                    "limit_to_registered_users": 0,
                    "access_token": "TestToken3",
                    "description": "This is a description 3"
                }],
                "comments": "This is the updated comment."
            }
            lib.services.update_services(session=session, service_ids=[service_id], value=value)

            auth_apps_in_db = auth_app_table.filter("service_id", service_id)
            assert auth_apps_in_db == [{
                    "id": auth_apps_in_db[0]["id"],
                    "auth_vendor_id": b'1\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00',
                    "service_id": service_id,
                    "url_direct_auth": "/app2",
                    "app_id": "my app id 1 update",
                    "limit_to_registered_users": 0,
                    "access_token": "TestToken2Updated",
                    "default_role_id": None,
                    "description": "This is a description 1",
                    "enabled": None,
                    "url": None,
                    "name": None,
                }, {
                    "id": auth_apps_in_db[1]["id"],
                    "auth_vendor_id": b'1\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00',
                    "service_id": service_id,
                    "url_direct_auth": "/app3",
                    "app_id": "my app id 3",
                    "limit_to_registered_users": 0,
                    "access_token": "TestToken3",
                    "default_role_id": None,
                    "description": "This is a description 3",
                    "enabled": None,
                    "url": None,
                    "name": None,
                }]

    assert service_table.same_as_snapshot
    assert auth_app_table.same_as_snapshot
