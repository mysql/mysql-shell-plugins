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
import json
from ...lib.core import *
from ...lib.services import *
from ...lib.content_sets import *
from ...lib.schemas import *

@pytest.mark.usefixtures("init_mrs")
def test_get_current_service(init_mrs):
    set_current_objects()
    current_service = get_current_service(None)
    assert current_service is None

    set_current_objects(service_id=1, schema_id=1, content_set_id=1)
    with MrsDbSession(session=init_mrs) as session:
        current_service = get_current_service(session)
    assert current_service is not None
    assert current_service == {
        'id': 1,
        'enabled': 1,
        'auth_completed_page_content': None,
        'auth_completed_url': None,
        'auth_completed_url_validation': None,
        'auth_path': "/authentication",
        'url_protocol': ['HTTP'],
        'url_host_name': 'localhost',
        'url_context_root': '/test',
        'is_default': 1,
        'url_host_id': 1,
        'options': None,
        'comments': 'Test service',
        'host_ctx': 'localhost/test'
    }

@pytest.mark.usefixtures("init_mrs")
def test_get_current_content_set():
    set_current_objects()
    content = get_current_content_set(None)
    assert content is None

@pytest.mark.usefixtures("init_mrs")
def test_get_current_schema(init_mrs):
    with MrsDbSession(session=init_mrs) as session:
        set_current_objects()
        schema = get_current_schema(session=session)
        assert schema is None

@pytest.mark.usefixtures("init_mrs")
def test_get_current_schema(init_mrs):
    set_current_objects()

    schema = get_current_schema(None)
    assert schema is None

    set_current_objects(service_id=1, schema_id=1, content_set_id=1)
    schema = get_current_schema(init_mrs)
    assert schema is not None
    assert schema == {
        'id': 1,
        'name': 'PhoneBook',
        'service_id': 1,
        'request_path': '/PhoneBook',
        'requires_auth': 0,
        'enabled': 1,
        'options': None,
        'url_host_id': 1,
        'items_per_page': 20,
        'comments': 'test schema',
        'host_ctx': 'localhost/test'
    }

@pytest.mark.usefixtures("init_mrs")
def test_get_interactive_default():
    interactive_default = get_interactive_default()
    assert interactive_default is not None
    assert isinstance(interactive_default, bool)

@pytest.mark.usefixtures("init_mrs")
def test_get_current_session():
    current_session = get_current_session()
    assert current_session is not None

@pytest.mark.usefixtures("init_mrs")
def test_split_sql_script():
    splitted_script = split_sql_script("")
    assert splitted_script is not None
    assert splitted_script == ['']

@pytest.mark.usefixtures("init_mrs")
def test_get_current_config():
    config = get_current_config()
    assert config is not None
    assert config == {'current_service_id': 1,
                      'current_schema_id': 1,
                      'current_content_set_id': 1}


@pytest.mark.usefixtures("init_mrs")
def test_validate_service_path(init_mrs):
    with MrsDbSession(session=init_mrs) as session:
        service, schema, content_set = validate_service_path(session, None)
        assert service is None
        assert schema is None
        assert content_set is None

        service, schema, content_set = validate_service_path(session, "localhost/test/PhoneBook")
        assert service is not None
        assert service == {
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
        }

        assert schema is not None
        assert schema == {
            'id': 1,
            'name': 'PhoneBook',
            'service_id': 1,
            'request_path': '/PhoneBook',
            'requires_auth': 0,
            'enabled': 1,
            'options': None,
            'items_per_page': 20,
            'comments': 'test schema',
            'host_ctx': 'localhost/test',
            'url_host_id': 1,
        }

        assert content_set is None

        with pytest.raises(ValueError) as exc_info:
            service, schema, content_set = validate_service_path(session, "localhost/test/schema")
        assert str(exc_info.value) == "The given schema or content set was not found."

        with pytest.raises(ValueError) as exc_info:
            service, schema, content_set = validate_service_path(session, "127.0.0.1/test")
        assert str(exc_info.value) == "The given MRS service was not found."
