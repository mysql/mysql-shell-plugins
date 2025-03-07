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
import json
from ...lib.core import *
from ...lib.services import *
from ...lib.content_sets import *
from ...lib.schemas import *

def test_get_current_service(phone_book):
    set_current_objects()
    current_service = None
    with pytest.raises(RuntimeError) as exc_info:
        current_service = get_current_service(None)
    assert str(exc_info.value) == "A valid session is required."
    assert current_service is None

    set_current_objects(service_id=phone_book["service_id"],
        schema_id=phone_book["schema_id"],
        content_set_id=phone_book["url_host_id"])
    with MrsDbSession(session=phone_book["session"]) as session:
        current_service = get_current_service(session)
    assert current_service is not None
    assert current_service == {
        "id": phone_book["service_id"],
        "parent_id": None,
        "enabled": 1,
        "auth_completed_page_content": None,
        "auth_completed_url": None,
        "auth_completed_url_validation": None,
        "auth_path": "/authentication",
        "url_protocol": ["HTTP"],
        "url_host_name": "localhost",
        "url_context_root": "/test",
        "url_host_id": phone_book["url_host_id"],
        "options": None,
        "metadata": None,
        "comments": "Test service",
        "host_ctx": "localhost/test",
        "is_current": 1,
        "in_development": None,
        "full_service_path": "localhost/test",
        "published": 0,
        "sorted_developers": None,
        "name": "mrs",
        "auth_apps": ["MRS Auth App"],
    }

def test_get_current_content_set():
    set_current_objects()
    content = get_current_content_set(None)
    assert content is None

def test_get_current_schema(phone_book):
    with MrsDbSession(session=phone_book["session"]) as session:
        set_current_objects()
        schema = get_current_schema(session=session)
        assert schema is None

def test_get_current_schema(phone_book):
    set_current_objects()

    schema = get_current_schema(None)
    assert schema is None

    set_current_objects(service_id=phone_book["service_id"],
        schema_id=phone_book["schema_id"],
        content_set_id=phone_book["content_set_id"])
    schema = get_current_schema(phone_book["session"])
    assert schema is not None
    assert schema == {
        "id": phone_book["schema_id"],
        "name": "PhoneBook",
        "service_id": phone_book["service_id"],
        "request_path": "/PhoneBook",
        "requires_auth": 0,
        "enabled": 1,
        "options": None,
        "metadata": None,
        "url_host_id": phone_book["url_host_id"],
        "items_per_page": 20,
        "comments": "test schema",
        "host_ctx": "localhost/test",
        "schema_type": "DATABASE_SCHEMA",
    }

def test_get_interactive_default():
    interactive_default = get_interactive_default()
    assert interactive_default is not None
    assert isinstance(interactive_default, bool)

def test_get_current_session():
    current_session = get_current_session()
    assert current_session is not None


def test_get_current_config(phone_book):
    config = get_current_config()
    assert config is not None
    assert config == {"current_service_id": phone_book["service_id"],
                      "current_schema_id": phone_book["schema_id"],
                      "current_content_set_id": phone_book["content_set_id"]}


def test_validate_service_path(phone_book):
    with MrsDbSession(session=phone_book["session"]) as session:
        service, schema, content_set = validate_service_path(session, None)
        assert service is None
        assert schema is None
        assert content_set is None

        service, schema, content_set = validate_service_path(session, "localhost/test/PhoneBook")
        assert service is not None
        assert service == {
            "id": phone_book["service_id"],
            "parent_id": None,
            "enabled": 1,
            "auth_completed_page_content": None,
            "auth_completed_url": None,
            "auth_completed_url_validation": None,
            "auth_path": "/authentication",
            "url_protocol": ["HTTP"],
            "url_host_name": "localhost",
            "url_context_root": "/test",
            "url_host_id": phone_book["url_host_id"],
            "options": None,
            "metadata": None,
            "comments": "Test service",
            "host_ctx": "localhost/test",
            "is_current": 1,
            "in_development": None,
            "full_service_path": "localhost/test",
            "published": 0,
            "sorted_developers": None,
            "name": "mrs",
            "auth_apps": ["MRS Auth App"],
        }

        assert schema is not None
        assert schema == {
            "id": phone_book["schema_id"],
            "name": "PhoneBook",
            "service_id": phone_book["service_id"],
            "request_path": "/PhoneBook",
            "requires_auth": 0,
            "enabled": 1,
            "options": None,
            "metadata": None,
            "items_per_page": 20,
            "comments": "test schema",
            "host_ctx": "localhost/test",
            "url_host_id": phone_book["url_host_id"],
            "schema_type": "DATABASE_SCHEMA",
        }

        assert content_set is None

        with pytest.raises(ValueError) as exc_info:
            service, schema, content_set = validate_service_path(session, "localhost/test/schema")
        assert str(exc_info.value) == "The given schema or content set was not found."

        with pytest.raises(ValueError) as exc_info:
            service, schema, content_set = validate_service_path(session, "127.0.0.1/test")
        assert str(exc_info.value) == "The given MRS service was not found."


def test_id_to_binary():
    context = "my_context"
    ids = ["", "1234", "localhost/myService"]

    for id in ids:
        with pytest.raises(RuntimeError, match=f"Invalid id format '{id}' for '{context}'."):
            core.id_to_binary(id, context, False)

    id = "0x1234"
    with pytest.raises(RuntimeError, match=f"The '{context}' has an invalid size."):
        core.id_to_binary(id, context, False)
