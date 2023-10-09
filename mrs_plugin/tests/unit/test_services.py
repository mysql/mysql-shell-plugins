# Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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
from ... services import *
from .helpers import ServiceCT
from mrs_plugin import lib


def test_add_service(phone_book, table_contents):
    args = {
        "url_protocol": ["HTTP"],
        "comments": "Test service",
        "session": phone_book["session"]
    }

    services_table = table_contents("service")

    with pytest.raises(Exception) as exc_info:
        add_service(url_context_root="/test", url_host_name="localhost", enabled=True, **args)
    assert str(exc_info.value) == "The request_path localhost/test is already in use."

    assert services_table.same_as_snapshot

    args = {
        "url_protocol": ["HTTP"],
        "comments": "Test service 2",
        "session": phone_book["session"]
    }

    with ServiceCT("/service2", "localhost", **args) as service_id:
        assert service_id is not None
        assert services_table.count == services_table.snapshot.count + 1

    assert services_table.same_as_snapshot


def test_get_services(phone_book, table_contents):
    services = get_services()
    assert services is not None

    args = {
        "session": phone_book["session"]
    }
    services = get_services(**args)
    assert services is not None
    assert len(services) > 0
    assert services == [{
        'id': services[0]["id"],
        'enabled': 1,
        'auth_completed_page_content': None,
        'auth_completed_url': None,
        'auth_completed_url_validation': None,
        'auth_path': '/authentication',
        'url_protocol': ['HTTP'],
        'url_host_name': 'localhost',
        'url_context_root': '/test',
        'url_host_id': services[0]["url_host_id"],
        'options': None,
        'comments': 'Test service',
        'host_ctx': 'localhost/test',
        'is_current': 1,
    }]


def test_get_service(phone_book, table_contents):
    service_table = table_contents("service")
    args = {
        "session": phone_book["session"]
    }
    service = get_service(url_host_name="localhost", url_context_root="/test", **args)

    assert service is not None
    assert isinstance(service, dict)
    assert service == {
        'comments': 'Test service',
        'enabled': 1,
        'host_ctx': 'localhost/test',
        'id': service["id"],
        'auth_completed_page_content': None,
        'auth_completed_url': None,
        'auth_completed_url_validation': None,
        'auth_path': '/authentication',
        'options': None,
        'url_context_root': '/test',
        'url_host_id': service["url_host_id"],
        'url_host_name': 'localhost',
        'url_protocol': ['HTTP'],
        'is_current': 1,
    }
    assert service_table.snapshot[0] == {
        'comments': 'Test service',
        'enabled': 1,
        'id': service["id"],
        'auth_completed_page_content': None,
        'auth_completed_url': None,
        'auth_completed_url_validation': None,
        'auth_path': '/authentication',
        'options': None,
        'url_context_root': '/test',
        'url_host_id': service["url_host_id"],
        'url_protocol': ['HTTP'],
        'custom_metadata_schema': None,
        'enable_sql_endpoint': 0,
    }

    with ServiceCT("/service2", "localhost", **args) as service_id:
        assert service_id is not None
        service = get_service(url_host_name="localhost", url_context_root="/service2", **args)
        assert service is not None
        assert isinstance(service, dict)
        assert service == {
            'comments': '',
            'enabled': 1,
            'host_ctx': 'localhost/service2',
            'id': service_id,
            'auth_completed_page_content': None,
            'auth_completed_url': None,
            'auth_completed_url_validation': None,
            'auth_path': '/authentication',
            'options': None,
            'url_context_root': '/service2',
            'url_host_id': service["url_host_id"],
            'url_host_name': 'localhost',
            'url_protocol': ['HTTP'],
            'is_current': 0,
        }


def test_change_service(phone_book):
    session = phone_book["session"]
    args = {
        "session": session
    }

    with ServiceCT(url_host_name="localhost", url_context_root="/service2", **args) as service_id:
        assert service_id is not None

        args_for_get_service = {
            "session": phone_book["session"],
        }

        args_for_get_service["service_id"] = args["service_id"] = service_id

        assert disable_service(**args) == True
        service2 = get_service(**args_for_get_service)
        assert not service2["enabled"]

        assert enable_service(**args) == True
        service2 = get_service(**args_for_get_service)
        assert service2["enabled"]

        assert set_current_service(**args) == True
        assert set_current_service(session=session, service_id=phone_book["service_id"]) == True

        with pytest.raises(Exception) as exc_info:
            set_url_context_root(**args, value="/test")
        assert str(exc_info.value) == "The request_path localhost/test is already in use."

        assert set_url_context_root(**args, value="/service3") == True
        service2 = get_service(**args_for_get_service)
        assert service2["url_context_root"] == "/service3"

        assert set_protocol(**args, value = ["HTTPS"]) == True
        service2 = get_service(**args_for_get_service)
        assert service2["url_protocol"] == ["HTTPS"]

        assert set_comments(**args, value="Test service updated") == True
        service2 = get_service(**args_for_get_service)
        assert service2["comments"] == "Test service updated"

        value = {
            "url_host_name": "localhost",
            "url_context_root": "/test",
            "url_protocol": ["HTTP"],
            "comments": "Test service comments",
            "enabled": False
        }
        with pytest.raises(Exception) as exc_info:
            update_service(**args, value=value)
        assert str(exc_info.value) == "The request_path localhost/test is already in use."


        value = {
            "url_context_root": "/service4",
            "url_protocol": ["HTTP"],
            "comments": "Test service comments",
            "enabled": False
        }
        update_service(**args, value=value) == True
        service2 = get_service(**args_for_get_service)

        assert service2["url_context_root"] == value["url_context_root"]
        assert service2["url_protocol"] == value["url_protocol"]
        assert service2["comments"] == value["comments"]
        assert service2["enabled"] == value["enabled"]

        value = {
            "url_context_rootxxx": "/service4",
            "url_protocol": ["HTTP"],
            "comments": "Test service comments",
            "enabled": False
        }
        with pytest.raises(Exception) as exc_info:
            update_service(**args, service_ids=[1], value=value)
        assert str(exc_info.value) == "Attempting to change an invalid service value."


def test_delete_service(phone_book, table_contents):
    service_args = {
        "url_context_root": "/service_to_delete",
        "url_host_name": "localhost",
        "url_protocol": "HTTP",
        "is_default": False,
        "comments": "no comments",
    }

    result = add_service(**service_args)

    assert result is not None
    assert isinstance(result, dict)

    with pytest.raises(Exception) as exc_info:
        delete_service(service_id=1)
    assert str(exc_info.value) == "Invalid id type for service_id."

    with pytest.raises(Exception) as exc_info:
        delete_service(service_id="1")
    assert str(exc_info.value) == "Invalid base64 string for service_id."

    assert delete_service(service_id=result["id"]) == True
