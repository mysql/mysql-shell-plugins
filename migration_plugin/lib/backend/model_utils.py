# Copyright (c) 2025, 2026, Oracle and/or its affiliates.
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


import itertools
from . import model


def build_dump_exclude_list(selection: model.SchemaSelectionOptions) -> list:
    args = []

    def add(what: str, filter: list[model.IncludeList] | model.IncludeList):
        def q(s):
            return f'"{s.replace('\\', '\\\\').replace('"', '\\"')}"'

        if isinstance(filter, list):
            filters = filter
        else:
            filters = [filter]

        excludes = ','.join([q(n) for n in itertools.chain(
            *[f.exclude for f in filters if f.exclude])])
        includes = ','.join([q(n) for n in itertools.chain(
            *[f.include for f in filters if f.include])])

        if excludes:
            args.append(f"--exclude-{what}={excludes}")
        if includes:
            args.append(f"--include-{what}={includes}")

    filters = selection.filter
    if filters:
        add("schemas", filters.schemas)
        add("tables", [filters.tables, filters.views])

    if selection.migrateRoutines:
        if filters:
            add("routines", filters.routines)
    else:
        args.append("--routines=false")

    if selection.migrateEvents:
        if filters:
            add("events", filters.events)
    else:
        args.append("--events=false")

    if selection.migrateLibraries:
        if filters:
            add("libraries", filters.libraries)
    else:
        args.append("--libraries=false")

    if selection.migrateTriggers:
        if filters:
            add("triggers", filters.triggers)
    else:
        args.append("--triggers=false")

    if selection.migrateUsers:
        if filters:
            add("users", filters.users)
    else:
        args.append("--users=false")

    return args
