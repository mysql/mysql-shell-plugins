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

from migration_plugin.lib.backend.filtering_utils import *


def test_filter_accounts():
    filter = DbFilters.UserFilters()

    assert filter.is_included("user")
    assert filter.is_included("user@host")
    assert filter.is_included("'user'@'host'")

    filter.exclude("user")

    assert not filter.is_included("user")
    assert not filter.is_included("user@host")
    assert not filter.is_included("'user'@'host'")

    assert filter.is_included("admin")
    assert filter.is_included("admin@host")
    assert filter.is_included("'admin'@'host'")

    filter.exclude("user@host")

    assert not filter.is_included("user")
    assert not filter.is_included("user@host")
    assert not filter.is_included("'user'@'host'")

    assert filter.is_included("admin")
    assert filter.is_included("admin@host")
    assert filter.is_included("'admin'@'host'")

    filter.exclude("admin@host")

    assert not filter.is_included("user")
    assert not filter.is_included("user@host")
    assert not filter.is_included("'user'@'host'")

    assert filter.is_included("admin")
    assert not filter.is_included("admin@host")
    assert not filter.is_included("'admin'@'host'")

    assert filter.is_included("admin@host2")
    assert filter.is_included("'admin'@'host2'")

    filter.include("root@host")

    assert not filter.is_included("user")
    assert not filter.is_included("user@host")
    assert not filter.is_included("'user'@'host'")

    assert not filter.is_included("admin")
    assert not filter.is_included("admin@host")
    assert not filter.is_included("'admin'@'host'")

    assert not filter.is_included("admin@host2")
    assert not filter.is_included("'admin'@'host2'")

    assert not filter.is_included("root")
    assert filter.is_included("root@host")
    assert filter.is_included("'root'@'host'")

    assert not filter.is_included("'root'@'host2'")

    filter.include("root@host2")

    assert not filter.is_included("root")
    assert filter.is_included("root@host")
    assert filter.is_included("'root'@'host'")

    assert filter.is_included("'root'@'host2'")


def test_filter_schemas():
    filter = DbFilters.SchemaFilters()

    assert filter.is_included("schema")
    assert filter.is_included("mysql")

    filter.exclude("mysql")

    assert filter.is_included("schema")
    assert not filter.is_included("mysql")

    filter.exclude("sys")

    assert filter.is_included("schema")
    assert not filter.is_included("mysql")
    assert not filter.is_included("sys")

    filter.include("`I-S`")

    assert not filter.is_included("schema")
    assert not filter.is_included("mysql")
    assert not filter.is_included("sys")
    assert filter.is_included("I-S")
    assert not filter.is_included("P-S")

    filter.include("P-S")

    assert not filter.is_included("`schema`")
    assert not filter.is_included("mysql")
    assert not filter.is_included("sys")
    assert filter.is_included("I-S")
    assert filter.is_included("P-S")


def test_filter_objects():
    schemas = DbFilters.SchemaFilters()
    filter = DbFilters.ObjectFilters(schemas)

    assert filter.is_included("s.t")

    filter.exclude("s.t2")

    assert filter.is_included("s.t")
    assert not filter.is_included("s.t2")

    filter.exclude("`s`.t3")

    assert filter.is_included("s.t")
    assert not filter.is_included("s.t2")
    assert not filter.is_included("s.t3")

    schemas.exclude("s2")

    assert filter.is_included("s.t")
    assert not filter.is_included("s.t2")
    assert not filter.is_included("s.t3")
    assert not filter.is_included("s2.t")
    assert filter.is_included("s3.t")

    filter.include("s1.`t`")

    assert not filter.is_included("s.t")
    assert not filter.is_included("s.t2")
    assert not filter.is_included("s.t3")
    assert not filter.is_included("s2.t")
    assert not filter.is_included("s3.t")
    assert filter.is_included("s1.t")

    filter.include("`s4`.`t`")

    assert not filter.is_included("s.t")
    assert not filter.is_included("s", "t")
    assert not filter.is_included("s.t2")
    assert not filter.is_included("s.t3")
    assert not filter.is_included("s2.t")
    assert not filter.is_included("s3.t")
    assert filter.is_included("s1.t")
    assert filter.is_included("s4.t")
    assert filter.is_included("s4", "t")

    schemas.include("s4")

    assert not filter.is_included("s.t")
    assert not filter.is_included("s.t2")
    assert not filter.is_included("s.t3")
    assert not filter.is_included("s2.t")
    assert not filter.is_included("s3.t")
    assert not filter.is_included("s1.t")
    assert filter.is_included("s4.t")


def test_filter_triggers():
    schemas = DbFilters.SchemaFilters()
    tables = DbFilters.ObjectFilters(schemas)
    filter = DbFilters.TriggerFilters(tables)

    assert filter.is_included("s.t.tt")

    filter.exclude("s.t2")

    assert filter.is_included("s.t.tt")
    assert not filter.is_included("s.t2.tt")

    filter.exclude("s.t2.tt")

    assert filter.is_included("s.t.tt")
    assert not filter.is_included("s.t2.tt")
    assert not filter.is_included("s.t2.tt1")

    filter.exclude("s.t3.tt")

    assert filter.is_included("s.t.tt")
    assert not filter.is_included("s.t2.tt")
    assert not filter.is_included("s.t2.tt1")
    assert not filter.is_included("s.t3.tt")
    assert filter.is_included("s.t3.tt1")

    filter.exclude("s.t3")

    assert filter.is_included("s.t.tt")
    assert not filter.is_included("s.t2.tt")
    assert not filter.is_included("s.t2.tt1")
    assert not filter.is_included("s.t3.tt")
    assert not filter.is_included("s.t3.tt1")

    tables.exclude("s.t4")

    assert filter.is_included("s.t.tt")
    assert not filter.is_included("s.t2.tt")
    assert not filter.is_included("s.t2.tt1")
    assert not filter.is_included("s.t3.tt")
    assert not filter.is_included("s.t3.tt1")
    assert not filter.is_included("s.t4.tt")

    filter.include("s.t5")

    assert not filter.is_included("s.t.tt")
    assert not filter.is_included("s.t2.tt")
    assert not filter.is_included("s.t2.tt1")
    assert not filter.is_included("s.t3.tt")
    assert not filter.is_included("s.t3.tt1")
    assert not filter.is_included("s.t4.tt")
    assert filter.is_included("s.t5.tt")
    assert filter.is_included("s.t5.tt1")

    filter.include("s.t5.tt2")

    assert filter.is_included("s.t5.tt")
    assert filter.is_included("s.t5.tt1")
    assert filter.is_included("s.t5.tt2")

    filter.include("s.t6.tt")

    assert filter.is_included("s.t5.tt")
    assert filter.is_included("s.t5.tt1")
    assert filter.is_included("s.t5.tt2")
    assert filter.is_included("s.t6.tt")
    assert not filter.is_included("s.t6.tt1")

    filter.include("s.t6")

    assert filter.is_included("s.t5.tt")
    assert filter.is_included("s.t5.tt1")
    assert filter.is_included("s.t5.tt2")
    assert filter.is_included("s.t6.tt")
    assert filter.is_included("s.t6.tt1")
