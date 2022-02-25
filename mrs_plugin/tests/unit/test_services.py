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
from ... services import *

@pytest.mark.usefixtures("init_mrs")
def test_add_service(init_mrs):
    args = {
        "url_protocol": "HTTP",
        "is_default": True,
        "comments": "Test service",
        "session": init_mrs,
        "interactive": False,
        "raise_exceptions": False
    }
    result = add_service("/test", "localhost", True, **args)
    assert result is None

    args = {
        "url_protocol": "HTTP",
        "is_default": False,
        "comments": "Test service 2",
        "session": init_mrs,
        "interactive": False,
        "raise_exceptions": True
    }

    with pytest.raises(Exception) as exc_info:
        add_service(None, "localhost", True, **args)
    assert str(exc_info.value) == "No context path given. Operation cancelled."

    with pytest.raises(Exception) as exc_info:
        add_service("service2", "localhost", True, **args)
    assert str(exc_info.value) == "The url_context_root has to start with '/'."

    result = add_service("/service2", "localhost", True, **args)
    assert result is not None

@pytest.mark.usefixtures("init_mrs")
def test_get_services(init_mrs):
    services = get_services()
    assert services is not None

    args = {
        "session": init_mrs,
        "interactive": False,
        "raise_exceptions": False,
        "return_formatted": True
    }
    services = get_services(**args)
    assert services is not None

    args["return_formatted"] = False
    services = get_services(**args)
    assert services is not None
    assert services == [{'id': 2,
                         'enabled': 1,
                         'url_protocol': 'HTTP',
                         'url_host_name': 'localhost',
                         'url_context_root': '/service2',
                         'is_default': 0,
                         'comments': 'Test service 2',
                         'host_ctx': 'localhost/service2'},

                        {'id': 1,
                         'enabled': 1,
                         'url_protocol': 'HTTP',
                         'url_host_name': 'localhost',
                         'url_context_root': '/test',
                         'is_default': 1,
                         'comments': 'Test service',
                         'host_ctx': 'localhost/test'}
                        ]

@pytest.mark.usefixtures("init_mrs")
def test_get_service(init_mrs):
    # service = get_service()

    # assert service is not None
    # assert service == {'id': 1, 'enabled': 1, 'url_protocol': 'HTTP', 'url_host_name': 'localhost', 'url_context_root': '/test', 'is_default': 1, 'comments': 'Test service', 'host_ctx': 'localhost/test'}

    args = {
        "session": init_mrs,
        "interactive": False,
        "raise_exceptions": False,
        "return_formatted": False
    }
    service = get_service("/test", "localhost", **args)

    assert service is not None
    assert service == {'id': 1,
                       'enabled': 1,
                       'url_protocol': 'HTTP',
                       'url_host_name': 'localhost',
                       'url_context_root': '/test',
                       'is_default': 1,
                       'comments': 'Test service',
                       'host_ctx': 'localhost/test'}

    service = get_service("/service2", "localhost", **args)

    assert service is not None
    assert service == {'id': 2,
                       'enabled': 1,
                       'url_protocol': 'HTTP',
                       'url_host_name': 'localhost',
                       'url_context_root': '/service2',
                       'is_default': 0,
                       'comments': 'Test service 2',
                       'host_ctx': 'localhost/service2'}

    args['return_formatted'] = True
    service = get_service("/service2", "localhost", **args)
    assert service is not None

    args['raise_exceptions'] = True
    with pytest.raises(Exception) as exc_info:
        get_service("service2", "localhost", **args)
    assert str(exc_info.value) == "The url_context_root has to start with '/'."

    args['get_default'] = True
    with pytest.raises(Exception) as exc_info:
        get_service("/service2", "localhost", **args)
    assert str(exc_info.value) == "The given service was not found."


@pytest.mark.usefixtures("init_mrs")
def test_change_service(init_mrs):
    args = {
        "url_host_name": "localhost",
        "session": init_mrs,
        "interactive": False,
        "raise_exceptions": True
    }

    with pytest.raises(ValueError) as exc_info:
        enable_service(**args)
    assert str(exc_info.value) == "The specified service was not found."

    args["url_context_root"] = "/service2"
    args["service_id"] = 2
    result = disable_service(**args)
    assert result is not None
    assert result == "The service has been disabled."

    result = enable_service(**args)
    assert result is not None
    assert result == "The service has been enabled."

    result = set_default_service(**args)
    assert result is not None
    assert result == "The service has been made the default."

    args['value'] = "/service3"
    result = set_url_context_root(**args)
    assert result is not None
    assert result == "The service has been updated."

    args['url_context_root'] = '/service3'
    args['value'] = "HTTPS"
    result = set_protocol(**args)
    assert result is not None
    assert result == "The service has been updated."

    args['value'] = "Test service updated"
    result = set_comments(**args)
    assert result is not None
    assert result == "The service has been updated."

    args['value'] = {"url_context_root": "/service3",
                    "url_host_name": "localhost",
                    "service_id": 2,
                    "session": init_mrs,
                    "interactive": False,
                    "raise_exceptions": False
    }
    result = update_service(**args)
    assert result is not None
    assert result == "The service has been updated."

    del args['value']
    result = delete_service(**args)
    assert result is not None
    assert result == "The service has been deleted."
