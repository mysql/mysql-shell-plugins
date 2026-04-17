# Copyright (c) 2025, 2026, Oracle and/or its affiliates.
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

import importlib
import importlib.util
import sys
from pathlib import Path
from typing import Union
from mysqlsh.plugin_manager import plugin, plugin_function


def _ensure_plugin_package_path() -> None:
    # mysqlsh can load this plugin entrypoint directly from its file path,
    # without putting the repository root on sys.path.
    plugin_parent = str(Path(__file__).resolve().parent.parent)
    if plugin_parent not in sys.path:
        sys.path.insert(0, plugin_parent)


_ensure_plugin_package_path()


def _bootstrap_plugin_package() -> None:
    package_name = "util_plugin"
    if package_name in sys.modules:
        return

    package_dir = Path(__file__).resolve().parent
    spec = importlib.util.spec_from_file_location(
        package_name,
        package_dir / "__init__.py",
        submodule_search_locations=[str(package_dir)],
    )
    if spec is None or spec.loader is None:
        raise ModuleNotFoundError(f"Unable to bootstrap package {package_name!r}.")

    module = importlib.util.module_from_spec(spec)
    sys.modules[package_name] = module
    spec.loader.exec_module(module)


def _import_plugin_module(module_name: str):
    full_name = f"util_plugin.{module_name}"
    try:
        return importlib.import_module(full_name)
    except ModuleNotFoundError as exc:
        if exc.name not in {"util_plugin", full_name} and not str(exc.name).startswith(
            "util_plugin."
        ):
            raise
        _bootstrap_plugin_package()
        return importlib.import_module(full_name)


@plugin(parent="util")
class visual:
    """
    Visualization utilities.
    """


@plugin(parent="util")
class sql:
    """
    SQL formatting utilities.
    """


@plugin_function("util.visual.renderExplainPlan", cli=True)
def render_explain_plan(plan: Union[str, dict], path: str, **kwargs):
    """Renders a given JSON EXPLAIN or EXPLAIN ANALYZE plan into a SVG image.

    The EXPLAIN plan must be in JSON format, as returned by:
        EXPLAIN FORMAT=JSON <sql> or EXPLAIN ANALYZE FORMAT=JSON <sql>

    Additionally, the JSON plan format must be in version 2, as set by:
        SET explain_json_format_version=2

    Args:
        plan (str): explain plan in JSON format (as a string or parsed JSON), version 2 or newer
        path (str): path to write the SVG image to. Use "-" to return the image data as a string.
        **kwargs (dict): optional arguments

    Returns:
        Nothing or the SVG data as a string if path is -

    Keyword Args:
        compact (bool): enables compact mode, showing only essential information in smaller footprint (default false)]
        darkMode (bool): renders with colors suitable for a dark background (default false)
        layout (str): layout mode, one of topDown or bottomUp
        showDescription (bool): whether to show long descriptions for each operation (default true)
        showQuery (bool): display the SQL statement being explained (default true)
        css (str): CSS data to be embedded in the image instead of the default one
        debug (int): show debug information (default 0)
    """

    visual_exported = _import_plugin_module("visual.exported")

    return visual_exported.render_explain_plan(plan, path, **kwargs)


@plugin_function("util.visual.explain", cli=True)
def do_explain(sql: str, path: str, **kwargs):
    """Executes EXPLAIN on a given SQL statement and renders the resulting
    explain plan into a SVG image.

    If the analyze option is set to true, EXPLAIN ANALYZE will be executed instead
    of a regular EXPLAIN and stats from the actual execution of the query
    will be displayed. Note that EXPLAIN ANALYZE will actually execute the statement.

    Args:
        sql (str): the SQL statement to be explained
        path (str): path to write the SVG image to. Use "-" to return the image data as a string.
        **kwargs (dict): optional arguments

    Returns:
        Nothing or the SVG data as a string if path is -

    Keyword Args:
        analyze (bool): executes EXPLAIN ANALYZE instead of regular EXPLAIN (default false)
        compact (bool): enables compact mode, showing only essential information in smaller footprint (default false)]
        darkMode (bool): renders with colors suitable for a dark background (default false)
        layout (str): layout mode, one of topDown or bottomUp
        showDescription (bool): whether to show long descriptions for each operation (default true)
        showQuery (bool): display the SQL statement being explained (default true)
        css (str): CSS data to be embedded in the image instead of the default one
        debug (bool): show debug information
    """

    visual_exported = _import_plugin_module("visual.exported")

    return visual_exported.do_explain(sql, path, **kwargs)


@plugin_function("util.sql.reformat", cli=True)
def reformat_sql(sql: str, **kwargs):
    """Reformats a SQL statement or script using mysqlsh-native parsing.

    Args:
        sql (str): SQL statement or script to reformat.
        **kwargs (dict): optional formatter style arguments.

    Keyword Args:
        indentWidth (int): indentation width in spaces (default 4)
        keywordCase (str): keyword style: upper, lower, or preserve
        quoteIdentifiers (bool): quote bare identifiers with backticks
        maxInlineLength (int): inline length threshold before wrapping
        breakSelectItems (bool): always break SELECT item lists
        breakFunctionArgs (bool): always break function argument lists
        tableOptionsPerLine (bool): keep CREATE TABLE options on separate lines
        ansiQuotes (bool): interpret double quotes using ANSI_QUOTES parser rules
        noBackslashEscapes (bool): interpret strings using NO_BACKSLASH_ESCAPES rules
    """

    sql_exported = _import_plugin_module("sql.exported")

    return sql_exported.reformat_sql(
        sql,
        **kwargs,
    )
