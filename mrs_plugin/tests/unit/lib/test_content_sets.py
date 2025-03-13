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
import tempfile
import mysqlsh

from lib.core import MrsDbSession
from mrs_plugin import lib
from .. helpers import ContentSetCT, get_default_content_set_init

def test_add_content_set(phone_book, table_contents):
    with lib.core.MrsDbSession(session=phone_book["session"]) as session:
        table_content_set = table_contents("content_set")

        with tempfile.TemporaryDirectory() as tmp:
            content_set = {
                "service_id": phone_book["service_id"],
                "request_path": "test_content_set2",
                "requires_auth": False,
                "comments": "Content Set",
                "session": session
            }

            with pytest.raises(Exception, match="The request_path has to start with '/'."):
                content_set_id = lib.content_sets.add_content_set(**content_set)

            content_set["request_path"] = "/test_content_set2"
            content_set_id, _ = lib.content_sets.add_content_set(**content_set)

            assert not table_content_set.same_as_snapshot

            lib.content_sets.delete_content_set(session, [content_set_id])

            assert table_content_set.same_as_snapshot


def test_enable_disable(phone_book, table_contents):
    with lib.core.MrsDbSession(session=phone_book["session"]) as session:
        table_content_set = table_contents("content_set")
        args = {
                "content_set_ids": [b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00'],
                "session": session
        }

        args["content_set_ids"] = [b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00']
        lib.content_sets.enable_content_set(**args, value=False)

        assert table_content_set.same_as_snapshot

        content_set_init = get_default_content_set_init(phone_book["service_id"])
        with ContentSetCT(session, **content_set_init) as content_set_id:
            table_content_set.take_snapshot()

            assert table_content_set.get("id", content_set_id)["enabled"] == 1

            lib.content_sets.enable_content_set(session, [content_set_id], value=False)
            assert not table_content_set.same_as_snapshot
            assert table_content_set.get("id", content_set_id)["enabled"] == 0

            lib.content_sets.enable_content_set(session, [content_set_id], value=True)

            assert table_content_set.same_as_snapshot
            assert table_content_set.get("id", content_set_id)["enabled"] == 1



def test_get_content_set(phone_book, table_contents):
    with MrsDbSession(session=phone_book["session"]) as session:
        table_content_set = table_contents("content_set")
        content_set_1 = {
            "id": phone_book["content_set_id"],
            "request_path": "/test_content_set",
            "requires_auth": 0,
            "enabled": 1,
            "comments": "Content Set",
            "host_ctx": "/test",
            "content_type": "STATIC",
            "options": {},
            "service_id": phone_book["service_id"],
        }
        args = {
            "content_set_id": phone_book["content_set_id"],
            "service_id": phone_book["service_id"],
            "session": session,
        }


        sets = lib.content_sets.get_content_set(**args)
        assert sets == content_set_1
        assert table_content_set.get("id", phone_book["content_set_id"]) == {
            "id": phone_book["content_set_id"],
            "request_path": "/test_content_set",
            "requires_auth": 0,
            "enabled": 1,
            "comments": "Content Set",
            "options": {},
            "service_id": phone_book["service_id"],
            "content_type": "STATIC",
            "internal": 0,
        }

        args["content_set_id"] = "0x00000000000000000000000000000000"
        del args["service_id"]
        sets = lib.content_sets.get_content_set(**args)
        assert sets is None
