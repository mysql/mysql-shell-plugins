# Copyright (c) 2025, Oracle and/or its affiliates.
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

from migration_plugin.lib.backend.string_utils import *


def test_split_account():
    def expect_account(account: str, user: str, host: str):
        a = split_account(account)
        assert a.user == user, account
        assert a.host == host, account

    for user in ["user", "'user'", '"user"', "`user`"]:
        # just user name
        expect_account(user, "user", "")

        for host in ["host", "'host'", '"host"', "`host`"]:
            # user + host
            expect_account(f"{user}@{host}", "user", "host")

    expect_account("'us''er'@'ho''st'", "us'er", "ho'st")


def test_unquote_db_object():
    def expect_db_object(obj: str, unquoted: tuple[str, ...]):
        assert unquoted == unquote_db_object(obj), obj

    for obj in ["obj", "'obj'", '"obj"', "`obj`"]:
        expect_db_object(obj, ("obj",))

    expect_db_object("a", ("a",))
    expect_db_object("a.b", ("a", "b", ))
    expect_db_object("a.b.c", ("a", "b", "c", ))

    expect_db_object("aa", ("aa",))
    expect_db_object("aa.bb", ("aa", "bb", ))
    expect_db_object("aa.bb.cc", ("aa", "bb", "cc", ))

    expect_db_object("`obj1`", ("obj1", ))
    expect_db_object("`obj1`.`obj2`", ("obj1", "obj2", ))
    expect_db_object("`obj1`.`obj2`.`obj3`", ("obj1", "obj2", "obj3", ))


def test_quote_db_object():
    def expect_db_object(obj: tuple[str, ...], quoted: str):
        assert quoted == quote_db_object(*obj), obj

    expect_db_object(("a", ), "`a`")
    expect_db_object(("a", "b", ), "`a`.`b`")
    expect_db_object(("a", "b", "c", ), "`a`.`b`.`c`")

    expect_db_object(("a`b", ), "`a``b`")
    expect_db_object(("a`b", "c`d", ), "`a``b`.`c``d`")
    expect_db_object(("a`b", "c`d", "e`f", ), "`a``b`.`c``d`.`e``f`")
