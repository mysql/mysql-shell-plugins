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


from . import model


def build_exclude_list(filters: model.MigrationFilters, include_users: bool) -> list:
    args = []

    def add(what, filter):
        if filter:
            def q(s):
                return f'"{s.replace('\\', '\\\\').replace('"', '\\"')}"'

            if filter.exclude:
                args.append(
                    f"--exclude-{what}={','.join([q(n) for n in filter.exclude])}"
                )
            if filter.include:
                args.append(
                    f"--include-{what}={','.join([q(n) for n in filter.include])}"
                )

    add("schemas", filters.schemas)
    add("tables", filters.tables)
    add("routines", filters.routines)
    add("events", filters.events)
    add("libraries", filters.libraries)
    add("triggers", filters.triggers)

    if include_users:
        add("users", filters.users)
    else:
        args.append("--users=false")

    return args
