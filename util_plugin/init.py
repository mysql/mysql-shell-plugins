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
from mysqlsh.plugin_manager import plugin, plugin_function
from util_plugin.visual import exported


@plugin(parent="util")
class visual:
    """
    Visualization utilities.
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
        showDescription (bool): whether to show long descriptions for each operation (default true)
        showQuery (bool): display the SQL statement being explained (default true)
        topDown (bool): display operations executed first at the top (default true)
        css (str): CSS data to be embedded in the image instead of the default one
        debug (int): show debug information (default 0)
    """

    return exported.render_explain_plan(plan, path, **kwargs)


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
        showDescription (bool): whether to show long descriptions for each operation (default true)
        showQuery (bool): display the SQL statement being explained (default true)
        topDown (bool): display operations executed first at the top (default true)
        css (str): CSS data to be embedded in the image instead of the default one
        debug (bool): show debug information
    """

    return exported.do_explain(sql, path, **kwargs)
