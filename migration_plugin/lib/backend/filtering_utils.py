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

from typing import Optional

from . import model, string_utils

type Account = string_utils.Account


class DbFilters:
    class UserFilters:
        type Filter = list[Account]

        def __init__(self) -> None:
            self.included: DbFilters.UserFilters.Filter = []
            self.excluded: DbFilters.UserFilters.Filter = []

        def include(self, account: str) -> None:
            self._add(account, self.included)

        def exclude(self, account: str) -> None:
            self._add(account, self.excluded)

        def is_included(self, account: str | Account) -> bool:
            if isinstance(account, str):
                assert account
                account = string_utils.split_account(account)

            def predicate(a: Account):
                return account.user == a.user and (not a.host or account.host == a.host)

            if any(predicate(a) for a in self.excluded):
                return False

            if not self.included:
                return True

            return any(predicate(a) for a in self.included)

        def _add(self, account: str, filter: Filter) -> None:
            filter.append(string_utils.split_account(account))

    class SchemaFilters:
        type Filter = list[str]

        def __init__(self) -> None:
            self.included: DbFilters.SchemaFilters.Filter = []
            self.excluded: DbFilters.SchemaFilters.Filter = []

        def include(self, schema: str) -> None:
            self._add(schema, self.included)

        def exclude(self, schema: str) -> None:
            self._add(schema, self.excluded)

        def is_included(self, schema: str) -> bool:
            assert schema

            schema = self._unquote(schema)

            if schema in self.excluded:
                return False

            if not self.included:
                return True

            return schema in self.included

        def _add(self, schema: str, filter: Filter) -> None:
            filter.append(self._unquote(schema))

        def _unquote(self, schema: str) -> str:
            s = string_utils.unquote_db_object(schema)
            assert 1 == len(s)
            return s[0]

    class ObjectFilters:
        type Filter = dict[str, DbFilters.SchemaFilters.Filter]

        def __init__(self, schema_filters: 'DbFilters.SchemaFilters') -> None:
            self._schema_filters: DbFilters.SchemaFilters = schema_filters
            self.included: DbFilters.ObjectFilters.Filter = {}
            self.excluded: DbFilters.ObjectFilters.Filter = {}

        def include(self, qualified_object: str) -> None:
            self._add(qualified_object, self.included)

        def exclude(self, qualified_object: str) -> None:
            self._add(qualified_object, self.excluded)

        def is_included(self, qualified_object_or_schema: str, table: str = "") -> bool:
            assert qualified_object_or_schema

            if table:
                schema = qualified_object_or_schema
            else:
                schema, table = self._unquote(qualified_object_or_schema)

            assert schema
            assert table

            if not self._schema_filters.is_included(schema):
                return False

            if schema in self.excluded and table in self.excluded[schema]:
                return False

            if not self.included:
                return True

            return schema in self.included and table in self.included[schema]

        def _add(self, qualified_object: str, filter: Filter) -> None:
            schema, object = self._unquote(qualified_object)
            filter.setdefault(schema, []).append(object)

        def _unquote(self, qualified_object: str) -> tuple[str, str]:
            o = string_utils.unquote_db_object(qualified_object)
            assert 2 == len(o)
            return o  # type: ignore

    class TriggerFilters:
        type Filter = dict[str, DbFilters.ObjectFilters.Filter]

        def __init__(self, table_filters: 'DbFilters.ObjectFilters') -> None:
            self._table_filters: DbFilters.ObjectFilters = table_filters
            self.included: DbFilters.TriggerFilters.Filter = {}
            self.excluded: DbFilters.TriggerFilters.Filter = {}

        def include(self, qualified_object: str) -> None:
            self._add(qualified_object, self.included)

        def exclude(self, qualified_object: str) -> None:
            self._add(qualified_object, self.excluded)

        def is_included(self, qualified_object_or_schema: str, table: str = "", trigger: str = "") -> bool:
            assert qualified_object_or_schema

            if table:
                schema = qualified_object_or_schema
            else:
                assert not trigger
                schema, table, trigger = self._unquote(
                    qualified_object_or_schema)

            assert schema
            assert table
            assert trigger

            if not self._table_filters.is_included(schema, table):
                return False

            if schema in self.excluded and table in self.excluded[schema]:
                triggers = self.excluded[schema][table]

                # empty array means that all triggers are excluded
                if not triggers or trigger in triggers:
                    return False

            if not self.included:
                return True

            if schema in self.included and table in self.included[schema]:
                triggers = self.included[schema][table]

                # empty array means that all triggers are included
                if not triggers or trigger in triggers:
                    return True

            return False

        def _add(self, qualified_object: str, filter: Filter) -> None:
            schema, table, trigger = self._unquote(qualified_object)

            tables = filter.setdefault(schema, {})
            has_table = table in tables

            triggers = tables.setdefault(table, [])

            if not trigger:
                # an empty trigger name, clear the filter, all triggers from
                # this table are included/excluded
                triggers.clear()
            else:
                # non-empty trigger name
                if not has_table or triggers:
                    # add trigger if table entry was just created or if there are other names there
                    triggers.append(trigger)
                else:
                    # else an empty filter means that all triggers are included/excluded
                    pass

        def _unquote(self, qualified_object: str) -> tuple[str, str, str]:
            o = string_utils.unquote_db_object(qualified_object)
            assert 2 == len(o) or 3 == len(o)
            return o if 3 == len(o) else o + ("", )  # type: ignore

    def __init__(self, filters: model.MigrationFilters) -> None:
        self.users = DbFilters.UserFilters()
        self.schemas = DbFilters.SchemaFilters()
        self.tables = DbFilters.ObjectFilters(self.schemas)
        self.events = DbFilters.ObjectFilters(self.schemas)
        self.routines = DbFilters.ObjectFilters(self.schemas)
        self.libraries = DbFilters.ObjectFilters(self.schemas)
        self.triggers = DbFilters.TriggerFilters(self.tables)

        self._initialize(filters.users, self.users)
        self._initialize(filters.schemas, self.schemas)
        self._initialize(filters.tables, self.tables)
        self._initialize(filters.events, self.events)
        self._initialize(filters.routines, self.routines)
        self._initialize(filters.libraries, self.libraries)
        self._initialize(filters.triggers, self.triggers)

    def _initialize(self, filter: Optional[model.IncludeList], target):
        if not filter:
            return

        for i in filter.include:
            target.include(i)

        for e in filter.exclude:
            target.exclude(e)
