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

from typing import Union
from mysqlsh.plugin_manager import plugin, plugin_function

from util_plugin.sql import exported as sql_exported


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

    from util_plugin.visual import exported as visual_exported

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

    from util_plugin.visual import exported as visual_exported

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

    return sql_exported.reformat_sql(
        sql,
        **kwargs,
    )
