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

from tests.conftest import table_contents
from ... services import *
from .helpers import ServiceCT
from mrs_plugin import lib


@pytest.mark.usefixtures("init_mrs")
def test_add_service(init_mrs, table_contents):
    args = {
        "url_protocol": ["HTTP"],
        "is_default": True,
        "comments": "Test service",
        "session": init_mrs
    }

    services_table = table_contents("service")

    with pytest.raises(Exception) as exc_info:
        add_service(url_context_root="/test", url_host_name="localhost", enabled=True, **args)
    assert str(exc_info.value) == "A service with this host_name and context_root already exists."

    assert services_table.same_as_snapshot

    args = {
        "url_protocol": ["HTTP"],
        "is_default": False,
        "comments": "Test service 2",
        "session": init_mrs
    }

    with ServiceCT("/service2", "localhost", **args) as service_id:
        assert isinstance(service_id, int)
        assert services_table.count == services_table.snapshot.count + 1

    assert services_table.same_as_snapshot


@pytest.mark.usefixtures("init_mrs")
def test_get_services(init_mrs, table_contents):
    services = get_services()
    assert services is not None

    args = {
        "session": init_mrs
    }
    services = get_services(**args)
    assert services is not None
    assert services == [{
        'id': 1,
        'enabled': 1,
        'auth_completed_page_content': None,
        'auth_completed_url': None,
        'auth_completed_url_validation': None,
        'auth_path': '/authentication',
        'url_protocol': ['HTTP'],
        'url_host_name': 'localhost',
        'url_context_root': '/test',
        'url_host_id': 1,
        'is_default': 1,
        'options': None,
        'comments': 'Test service',
        'host_ctx': 'localhost/test'
    }]

@pytest.mark.usefixtures("init_mrs")
def test_get_service(init_mrs, table_contents):
    service_table = table_contents("service")
    args = {
        "session": init_mrs
    }
    service = get_service(url_host_name="localhost", url_context_root="/test", **args)

    assert service is not None
    assert isinstance(service, dict)
    assert service == {
        'comments': 'Test service',
        'enabled': 1,
        'host_ctx': 'localhost/test',
        'id': 1,
        'auth_completed_page_content': None,
        'auth_completed_url': None,
        'auth_completed_url_validation': None,
        'auth_path': '/authentication',
        'options': None,
        'is_default': 1,
        'url_context_root': '/test',
        'url_host_id': 1,
        'url_host_name': 'localhost',
        'url_protocol': ['HTTP']
    }
    assert service_table.snapshot[0] == {
        'comments': 'Test service',
        'enabled': 1,
        'id': 1,
        'is_default': 1,
        'auth_completed_page_content': None,
        'auth_completed_url': None,
        'auth_completed_url_validation': None,
        'auth_path': '/authentication',
        'options': None,
        'url_context_root': '/test',
        'url_host_id': 1,
        'url_protocol': ['HTTP']
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
            'is_default': 0,
            'auth_completed_page_content': None,
            'auth_completed_url': None,
            'auth_completed_url_validation': None,
            'auth_path': '/authentication',
            'options': None,
            'url_context_root': '/service2',
            'url_host_id': 1,
            'url_host_name': 'localhost',
            'url_protocol': ['HTTP']
        }


@pytest.mark.usefixtures("init_mrs")
def test_change_service(init_mrs):

    args = {
        "session": init_mrs
    }

    with ServiceCT(url_host_name="localhost", url_context_root="/service2", **args) as service_id:
        assert service_id is not None

        args_for_get_service = {
            "session": init_mrs,
        }

        args_for_get_service["service_id"] = args["service_id"] = service_id

        assert disable_service(**args) == "The service has been disabled."
        service2 = get_service(**args_for_get_service)
        print(f"service2: {service2}")
        assert not service2["enabled"]

        assert enable_service(**args) == "The service has been enabled."
        service2 = get_service(**args_for_get_service)
        assert service2["enabled"]

        assert set_default_service(**args) == "The service has been made the default."

        assert set_url_context_root(**args, value="/service3") == "The service has been updated."
        service2 = get_service(**args_for_get_service)
        assert service2["url_context_root"] == "/service3"

        assert set_protocol(**args, value = ["HTTPS"]) == "The service has been updated."
        service2 = get_service(**args_for_get_service)
        assert service2["url_protocol"] == ["HTTPS"]

        assert set_comments(**args, value="Test service updated") == "The service has been updated."
        service2 = get_service(**args_for_get_service)
        assert service2["comments"] == "Test service updated"

        value = {
            "url_context_root": "/service4",
            "url_protocol": ["HTTP"],
            "comments": "Test service comments",
            "is_default": 0,
            "enabled": False
        }
        update_service(**args, value=value) == "The service has been updated."
        service2 = get_service(**args_for_get_service)

        assert service2["url_context_root"] == value["url_context_root"]
        assert service2["url_protocol"] == value["url_protocol"]
        assert service2["comments"] == value["comments"]
        assert service2["is_default"] == value["is_default"]
        assert service2["enabled"] == value["enabled"]

        value = {
            "url_context_rootxxx": "/service4",
            "url_protocol": ["HTTP"],
            "comments": "Test service comments",
            "is_default": 0,
            "enabled": False
        }
        with pytest.raises(Exception) as exc_info:
            update_service(**args, service_ids=[1], value=value)
        assert str(exc_info.value) == "Attempting to change an invalid service value."
