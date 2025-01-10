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
import tempfile
import json
import mysqlsh

from lib.core import MrsDbSession
from ... content_sets import *
from .helpers import ContentSetCT, get_default_content_set_init, TableContents, string_replace

def test_add_content_set(phone_book, table_contents):
    table_content_set = table_contents("content_set")
    assert table_content_set.snapshot.count == 1

    with tempfile.TemporaryDirectory() as tmp:
        content_set = {
            "request_path": "test_content_set2",
            "requires_auth": False,
            "comments": "Content Set",
            "session": phone_book["session"]
        }

        with pytest.raises(Exception) as exc_info:
            result = add_content_set(content_dir=None, service_id=phone_book["service_id"], **content_set)
        assert str(exc_info.value) == "The request_path has to start with '/'."
        assert table_content_set.same_as_snapshot

        content_set["request_path"] = "/test_content_set2"
        result = add_content_set(content_dir=tmp, service_id=phone_book["service_id"], **content_set)
        assert result is not None
        assert result == {
            'content_set_id': result["content_set_id"],
            'number_of_files_uploaded': 0
        }
        table_content_set.count == table_content_set.snapshot.count + 1

        result = delete_content_set(content_set_id=result["content_set_id"], session=content_set["session"])
        assert result is not None
        assert result == "The content set has been deleted."
        assert table_content_set.same_as_snapshot

    assert table_content_set.same_as_snapshot


def test_get_content_sets(phone_book, table_contents):
    table_content_set = table_contents("content_set")
    assert table_content_set.snapshot.count == 1

    args = {
            "include_enable_state": None,
            "session": phone_book["session"],
    }

    sets = get_content_sets(phone_book["service_id"], **args)
    assert sets is not None
    assert sets ==  [{
        "id": sets[0]["id"],
        "options": None,
        "request_path": "/test_content_set",
        "requires_auth": 0,
        "enabled": 1,
        "comments": "Content Set",
        "host_ctx": "localhost/test",
        "service_id": phone_book["service_id"],
        "content_type": "STATIC",
        "options": {},
    }]


def test_get_content_set(phone_book):
    with MrsDbSession(session=phone_book["session"]) as session:
        content_set_1 = {
            'id': phone_book["content_set_id"],
            'request_path': '/test_content_set',
            'requires_auth': 0,
            'enabled': 1,
            'comments': 'Content Set',
            'host_ctx': 'localhost/test',
            "options": None,
            "service_id": phone_book["service_id"],
            "content_type": "STATIC",
            "options": {},
        }
        args = {
                "content_set_id": phone_book["content_set_id"],
                "service_id": phone_book["service_id"],
                "session": session,
                "auto_select_single": True
        }

        # test for non existing content set
        args["content_set_id"] = 10
        with pytest.raises(RuntimeError) as exc_info:
            get_content_set(request_path="test_content_set", **args)
        assert str(exc_info.value) == "Invalid id type for 'content_set_id'."

        args["content_set_id"] = phone_book["content_set_id"]
        sets = get_content_set(**args)
        assert sets == content_set_1

        get_content_set(request_path="/test_content_set", **args)
        assert sets == content_set_1

        del args["content_set_id"]
        sets = get_content_set(request_path="/test_content_set", **args)
        assert sets == content_set_1


def test_enable_disable(phone_book, table_contents):
    content_set_table = table_contents("content_set")
    args = {
            "content_set_id": 999,
            "service_id": phone_book["service_id"],
            "session": phone_book["session"]
    }

    with pytest.raises(RuntimeError) as exc_info:
        result = disable_content_set(**args)
    assert str(exc_info.value) == "Invalid id type for 'content_set_id'."

    args["content_set_id"] = "0x00000000000000000000000000000000"
    result = disable_content_set(**args)

    assert content_set_table.snapshot.get("id", phone_book["content_set_id"])["enabled"] == True
    args["content_set_id"] = phone_book["content_set_id"]
    result = disable_content_set(**args)
    assert result is not None
    assert result == "The content set has been disabled."
    assert content_set_table.get("id", phone_book["content_set_id"])["enabled"] == False

    result = enable_content_set(**args)
    assert result is not None
    assert result == "The content set has been enabled."
    assert content_set_table.get("id", phone_book["content_set_id"])["enabled"] == True
    assert content_set_table.same_as_snapshot



def test_dump_and_recover(phone_book, table_contents):
    create_statement = """CREATE OR REPLACE REST CONTENT SET /tempContentSet
    ON SERVICE localhost/test
    COMMENTS "Content set comment"
    OPTIONS {
        "option_1": "value 1",
        "option_2": "value 2",
        "option_3": "value 3"
    };

CREATE OR REPLACE REST CONTENT FILE "/readme.txt"
    ON SERVICE localhost/test CONTENT SET /tempContentSet
    OPTIONS {
        "last_modification": "__README_TXT_LAST_MODIFICATION__"
    }
    CONTENT 'Line \\'1\\'
Line "2"
Line \\\\3\\\\';

CREATE OR REPLACE REST CONTENT FILE "/somebinaryfile.bin"
    ON SERVICE localhost/test CONTENT SET /tempContentSet
    OPTIONS {
        "last_modification": "__SOMEBINARYFILE_BIN_LAST_MODIFICATION__"
    }
    BINARY CONTENT 'AAECAwQFBgc=';"""

    create_function = lambda file_path, content_set_id, overwrite=True: \
        store_create_statement(file_path=file_path,
                                overwrite=overwrite,
                                content_set_id=content_set_id,
                                session=session)
    session = phone_book["session"]
    service_id = phone_book["service_id"]

    script = ""

    full_path_file = os.path.expanduser("~/content_set_compare_1.dump.sql")
    full_path_file2 = os.path.expanduser("~/content_set_compare_2.dump.sql")

    content_sets = lib.content_sets.get_content_sets(session, service_id)
    assert len(content_sets) == 1

    content_set = get_default_content_set_init(phone_book["service_id"], phone_book["temp_dir"])
    with ContentSetCT(session, **content_set) as content_set_id:
        content_sets = lib.content_sets.get_content_sets(session, service_id)
        assert len(content_sets) == 2
        content_files_table: TableContents = table_contents("content_file")

        result = create_function(file_path=full_path_file, content_set_id=content_set_id, overwrite=True)
        assert result == True


    content_sets = lib.content_sets.get_content_sets(session, service_id)
    assert len(content_sets) == 1

    content_file_table: TableContents = table_contents("content_file")
    expected_create_statement = string_replace(create_statement, {
            "__README_TXT_LAST_MODIFICATION__": content_file_table.filter("request_path", "/readme.txt")[0]["options"]["last_modification"],
            "__SOMEBINARYFILE_BIN_LAST_MODIFICATION__": content_file_table.filter("request_path", "/somebinaryfile.bin")[0]["options"]["last_modification"],
        })


    with open(os.path.expanduser(full_path_file), "r+") as f:
        script = f.read()
        assert script == expected_create_statement

    # Uncomment these tests once the script supports 'OPTIONS'
    # results = lib.script.run_mrs_script(mrs_script=script)

    # content_sets = lib.content_sets.get_content_sets(session, service_id)
    # assert len(content_sets) == 2

    # content_set = lib.content_sets.get_content_set(session, phone_book["service_id"], "/tempContentSet")
    # assert content_set is not None

    # content_set_table: TableContents = table_contents("content_set")

    # lib.content_sets.delete_content_set(session, [content_set["id"]])

    content_sets = lib.content_sets.get_content_sets(session, service_id)
    assert len(content_sets) == 1

