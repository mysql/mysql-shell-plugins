# Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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
from mrs_plugin import lib
from mrs_plugin.tests.unit.helpers import ServiceCT, TableContents
from lib.core import MrsDbSession


def test_get_service(phone_book, table_contents):
    with MrsDbSession(session=phone_book["session"]) as session:
        service_table = table_contents("service")
        service1 = lib.services.get_service(session=session, url_context_root="/test", url_host_name="localhost")

        assert service1 is not None
        assert service1 == {
            "id": phone_book["service_id"],
            "parent_id": None,
            "enabled": 1,
            "url_protocol": ["HTTP"],
            "url_host_name": "localhost",
            "url_context_root": "/test",
            "url_host_id": phone_book["url_host_id"],
            "comments": "Test service",
            "host_ctx": "localhost/test",
            "auth_completed_page_content": None,
            "auth_completed_url": None,
            "auth_completed_url_validation": None,
            "auth_path": "/authentication",
            "options": None,
            "metadata": None,
            "is_current": 1,
            "options": None,
            "in_development": None,
            "full_service_path": "localhost/test",
            "published": 0,
            "sorted_developers": None,
            "name": "mrs",
            "auth_apps": ["MRS Auth App"]
        }

        with ServiceCT(session, "/service2", "localhost") as service_id:
            assert service_table.count == service_table.snapshot.count + 1

            service2 = lib.services.get_service(session=session, url_context_root="/service2", url_host_name="localhost")

            assert service2 is not None
            assert service2 == {
                "id": service_id,
                "parent_id": None,
                "enabled": 1,
                "url_protocol": ["HTTP"],
                "url_host_name": "localhost",
                "url_context_root": "/service2",
                "url_host_id": service2["url_host_id"],
                "comments": "",
                "host_ctx": "localhost/service2",
                "auth_completed_page_content": None,
                "auth_completed_url": None,
                "auth_completed_url_validation": None,
                "auth_path": "/authentication",
                "options": {
                    "headers": {
                        "Access-Control-Allow-Credentials": "true",
                        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Origin, X-Auth-Token",
                        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                    },
                    "http": { "allowedOrigin": "auto" },
                    "logging": {
                        "exceptions": True,
                        "request": { "body": True, "headers": True },
                        "response": { "body": True, "headers": True },
                    },
                    "returnInternalErrorDetails": True,
                },
                "metadata": None,
                "in_development": None,
                "is_current": 0,
                "full_service_path": "localhost/service2",
                "published": 0,
                "sorted_developers": None,
                "name": "mrs",
                "auth_apps": None,
            }

            assert service_table.get("id", service_id) == {
                "comments": "",
                "enabled": 1,
                "id": service_id,
                "parent_id": None,
                "url_context_root": "/service2",
                "url_host_id": service2["url_host_id"],
                "url_protocol": ["HTTP"],
                "auth_completed_page_content": None,
                "auth_completed_url": None,
                "auth_completed_url_validation": None,
                "auth_path": "/authentication",
                "options": {
                    "headers": {
                        "Access-Control-Allow-Credentials": "true",
                        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Origin, X-Auth-Token",
                        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                    },
                    "http": { "allowedOrigin": "auto" },
                    "logging": {
                        "exceptions": True,
                        "request": { "body": True, "headers": True },
                        "response": { "body": True, "headers": True },
                    },
                    "returnInternalErrorDetails": True,
                },
                "metadata": None,
                "in_development": None,
                "custom_metadata_schema": None,
                "enable_sql_endpoint": 0,
                "published": 0,
                "name": "mrs",
            }

            with pytest.raises(Exception) as exc_info:
                lib.services.get_service(session=session, url_context_root="service2", url_host_name="localhost")
            assert str(exc_info.value) == "The url_context_root has to start with '/'."

        # Test getting the default service
        result = lib.services.get_service(session=session, url_context_root="/service2", url_host_name="localhost", get_default=False)
        assert result is None

        result = lib.services.get_service(session=session, url_context_root="/service2", url_host_name="localhost", get_default=True)
        assert result is not None

        with ServiceCT(session, "/service2", "localhost") as service_id:
            lib.services.set_current_service_id(session, service_id)

        result = lib.services.get_service(session=session, url_context_root="/service2", url_host_name="localhost", get_default=False)
        assert result is None

        result = lib.services.get_service(session=session, url_context_root="/service2", url_host_name="localhost", get_default=True)
        assert result is None

        lib.services.set_current_service_id(session, phone_book["service_id"])

        result = lib.services.get_service(session=session, url_context_root="/service2", url_host_name="localhost", get_default=True)
        assert result is not None

def test_get_services(phone_book, table_contents):
    with MrsDbSession(session=phone_book["session"]) as session:
        service_table: TableContents = table_contents("service")
        services = lib.services.get_services(session=session)

        assert len(service_table.items) == len(services)
        assert len(services) == 1

        with ServiceCT(session, "/service2", "localhost") as service2_id:
            services = lib.services.get_services(session=session)
            assert len(service_table.items) == len(services)
            assert len(services) == 2

            with ServiceCT(session, "/service3", "") as service3_id:
                services = lib.services.get_services(session=session)
                assert len(service_table.items) == len(services)
                assert len(services) == 3

            services = lib.services.get_services(session=session)
            assert len(service_table.items) == len(services)
            assert len(services) == 2

        services = lib.services.get_services(session=session)
        assert len(service_table.items) == len(services)
        assert len(services) == 1


def test_change_service(phone_book, table_contents):
    service_table = table_contents("service")
    auth_app_table = table_contents("auth_app")

    with MrsDbSession(session=phone_book["session"]) as session:
        with pytest.raises(Exception) as exc_info:
                lib.services.update_services(session=session, service_ids=[1000], value={"enabled": True})
        assert str(exc_info.value) == "'int' object has no attribute 'hex'"

        with ServiceCT(session, "/service2", "localhost") as service_id:
            value = {
                "comments": "This is the updated comment."
            }
            lib.services.update_services(session=session, service_ids=[service_id], value=value)


    assert service_table.same_as_snapshot
    assert auth_app_table.same_as_snapshot

