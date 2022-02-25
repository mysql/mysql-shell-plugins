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
import tempfile
from ... content_sets import *

@pytest.mark.usefixtures("init_mrs")
def test_add_content_set(init_mrs):
    with tempfile.TemporaryDirectory() as tmp:
        content_set = {
            "request_path": "test_content_set2",
            "requires_auth": False,
            "comments": "Content Set",
            "session": init_mrs,
            "interactive": False,
            "raise_exceptions": False
        }

        result = add_content_set(content_dir=None, service_id=1, **content_set)
        assert result is None

        content_set["raise_exceptions"] = True
        with pytest.raises(Exception) as exc_info:
            add_content_set(content_dir=None, service_id=1, **content_set)
        assert str(exc_info.value) == "The request_path has to start with '/'."

        content_set["request_path"] = "/test_content_set2"
        with pytest.raises(ValueError) as exc_info:
            add_content_set(content_dir=None, service_id=1, **content_set)
        assert str(exc_info.value) == "No content directory path given."

        with pytest.raises(ValueError) as exc_info:
            add_content_set(content_dir="/wrong_path_123", service_id=1, **content_set)
        assert str(exc_info.value) == "The given content directory path '/wrong_path_123' does not exists."

        result = add_content_set(content_dir=tmp, service_id=1, **content_set)
        assert result is not None
        assert result == {'content_set_id': 2,
                          'number_of_files_uploaded': 0}

@pytest.mark.usefixtures("init_mrs")
def test_get_content_sets(init_mrs):
    args = {
            "include_enable_state": True,
            "session": init_mrs,
            "interactive": False,
            "raise_exceptions": True,
            "return_formatted": True
    }
    sets = get_content_sets(**args)
    assert sets is not None

    args["return_formatted"] = False
    sets = get_content_sets(1, **args)
    assert sets is not None
    assert sets ==  [{'id': 1,
                      'request_path': '/test_content_set',
                      'requires_auth': 0,
                      'enabled': 1,
                      'comments': 'Content Set',
                      'host_ctx': 'localhost/test'},

                     {'id': 2,
                      'request_path': '/test_content_set2',
                      'requires_auth': 0,
                      'enabled': 1,
                      'comments': 'Content Set',
                      'host_ctx': 'localhost/test'}]

@pytest.mark.usefixtures("init_mrs")
def test_get_content_set(init_mrs):
    args = {
            "content_set_id": 1,
            "service_id": 1,
            "session": init_mrs,
            "interactive": True
    }

    sets = get_content_set("test_content_set", **args)
    assert sets is None

    args["interactive"] = False
    with pytest.raises(Exception) as exc_info:
        get_content_set("test_content_set", **args)
    assert str(exc_info.value) == "The request_path has to start with '/'."

    sets = get_content_set("/test_content_set", **args)
    assert sets is not None
    assert sets == {'id': 1,
                    'request_path': '/test_content_set',
                    'requires_auth': 0,
                    'enabled': 1,
                    'comments': 'Content Set',
                    'host_ctx': 'localhost/test'}

@pytest.mark.usefixtures("init_mrs")
def test_enable_disable(init_mrs):
    args = {
            "content_set_id": 999,
            "service_id": 1,
            "session": init_mrs,
            "interactive": True
    }

    result = disable_content_set(**args)
    assert result is None

    args["interactive"] = False
    with pytest.raises(Exception) as exc_info:
        disable_content_set(**args)
    assert str(exc_info.value) == "The specified content_set with id 999 was not found."

    args["content_set_id"] = 2
    result = disable_content_set(**args)
    assert result is not None
    assert result == "The content set has been disabled."

    result = enable_content_set(**args)
    assert result is not None
    assert result == "The content set has been enabled."

@pytest.mark.usefixtures("init_mrs")
def test_delete(init_mrs):
    args = {
            "content_set_id": 2,
            "service_id": 1,
            "session": init_mrs,
            "interactive": False
    }

    result = delete_content_set(**args)
    assert result is not None
    assert result == "The content set has been deleted."


