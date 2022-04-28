# Copyright (c) 2022, Oracle and/or its affiliates.
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
import mysqlsh

from lib.core import MrsDbSession
from mrs_plugin import lib

@pytest.mark.usefixtures("init_mrs")
def test_add_content_set(init_mrs, table_contents):
    with lib.core.MrsDbSession(session=init_mrs) as session:
        table_content_set = table_contents("content_set")
        table_content_file = table_contents("content_file")

        with tempfile.TemporaryDirectory() as tmp:
            content_set = {
                "service_id": 1,
                "request_path": "test_content_set2",
                "requires_auth": False,
                "comments": "Content Set",
                "session": session
            }

            with pytest.raises(Exception) as exc_info:
                lib.content_sets.add_content_set(**content_set)
            assert str(exc_info.value) == "The request_path has to start with '/'."

            assert table_content_set.same_as_snapshot, str(table_content_set._diff)
            assert table_content_file.same_as_snapshot

            content_set["service_id"] = None
            with pytest.raises(Exception) as exc_info:
                lib.content_sets.add_content_set(**content_set)
            assert str(exc_info.value) == "The service id is invalid."

            assert table_content_set.same_as_snapshot
            assert table_content_file.same_as_snapshot

@pytest.mark.usefixtures("init_mrs")
def test_enable_disable(init_mrs, table_contents):
    with lib.core.MrsDbSession(session=init_mrs) as session:
        table_content_set = table_contents("content_set")
        args = {
                "content_set_ids": [999],
                "session": session
        }

        with pytest.raises(Exception) as exc_info:
            lib.content_sets.enable_content_set(**args, value=False)
        assert str(exc_info.value) == "The specified content_set was not found."

        assert table_content_set.same_as_snapshot

        args["content_set_ids"] = [1]
        lib.content_sets.enable_content_set(**args, value=False)

        assert not table_content_set.same_as_snapshot

        lib.content_sets.enable_content_set(**args, value=True)
        assert table_content_set.same_as_snapshot


@pytest.mark.usefixtures("init_mrs")
def test_get_content_set(init_mrs, table_contents):
    with MrsDbSession(session=init_mrs) as session:
        table_content_set = table_contents("content_set")
        content_set_1 = {
            'id': 1,
            'request_path': '/test_content_set',
            'requires_auth': 0,
            'enabled': 1,
            'comments': 'Content Set',
            'host_ctx': 'localhost/test',
            "options": None,
        }
        args = {
                "service_id": 1,
                "session": session
        }

        args["content_set_id"] = 1
        sets = lib.content_sets.get_content_set(**args)
        assert sets == content_set_1
        assert table_content_set.get("id", 1) == {
            'id': 1,
            'request_path': '/test_content_set',
            'requires_auth': 0,
            'enabled': 1,
            'comments': 'Content Set',
            'options': None,
            'service_id': 1
        }

        args["content_set_id"] = 10
        del args["service_id"]
        sets = lib.content_sets.get_content_set(**args)
        assert sets is None

