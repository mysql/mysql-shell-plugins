# Copyright (c) 2025, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is designed to work with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms,
# as designated in a particular file or component or in included license
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

from typing import Union
from mysqlsh import globals
from mysqlsh import Error
import json
from util_plugin.visual import explain


def render_explain_plan(plan: Union[str, dict], path: str, **options):
    opt = explain.DrawOptions()
    opt.show_description = options.get(
        "showDescription", not options.get("compact", False)
    )
    opt.detailed = not options.get("compact", False)
    opt.show_query = options.get("showQuery", True)
    opt.css = options.get("css", None)
    opt.top_down = options.get("topDown", True)
    opt.debug = options.get("debug", 0)

    if isinstance(plan, str):
        try:
            plan = json.loads(plan)
        except:
            raise ValueError("Could not parse the given explain plan as JSON")
    if not isinstance(plan, dict):
        raise ValueError("Explain plan must be a JSON object")

    try:
        qb = explain.Explain(plan, options=opt)
        if options.get("debug", 0):
            qb.dump()

        out = qb.render_svg()
    except explain.InvalidExplainPlan as e:
        raise

    if path != "-":
        with open(path, "w+") as f:
            f.write(str(out))

    if options.get("debug", 0):
        if qb.unknown_operation_keys:
            print("UNKNOWN KEYS IN EXPLAIN PLAN:", qb.unknown_operation_keys)

        if qb.unknown_access_types:
            print(
                "UNKNOWN ACCESS_TYPES IN EXPLAIN PLAN:",
                qb.unknown_access_types,
            )

    if path == "-":
        return str(out)


def do_explain(sql: str, path: str, **options):
    active_session = globals.shell.get_session()
    if not active_session:
        raise Error("Shell must be connected to a MySQL server.")

    analyze = options.pop("analyze", False)

    version = active_session.run_sql("select @@version").fetch_one()[0]
    major, minor, _ = version.split(".", 2)
    major = int(major)
    minor = int(minor)
    if major < 8 or major == 8 and minor < 3:
        raise RuntimeError("This feature requires a MySQL server version 8.3 or newer.")

    explain_format_version = active_session.run_sql(
        "SELECT @@explain_json_format_version"
    ).fetch_one()[0]
    if explain_format_version != 2:
        active_session.run_sql("SET SESSION explain_json_format_version=2")

    try:
        plan = active_session.run_sql(
            f"EXPLAIN {'ANALYZE ' if analyze else ''}FORMAT=JSON {sql}"
        ).fetch_one()[0]
    finally:
        if explain_format_version != 2:
            active_session.run_sql(
                "SET SESSION explain_json_format_version=?", [explain_format_version]
            )

    return render_explain_plan(plan, path, **options)
