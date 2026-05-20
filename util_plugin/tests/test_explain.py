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

from util_plugin.visual.exported import do_explain, render_explain_plan
from util_plugin.visual.explain import InvalidExplainPlan
import os
import json
from mysqlsh import DBError
import subprocess
import sys
from typing import Optional
import re
import pathlib
import xml.etree.ElementTree as ET
import mysqlsh
import pytest

# How to run and update these tests:
#
# ## Running
# mysqlsh --pym pytest [<test>]
#
# ## Reviewing mismatched result files and updating them
# mysqlsh --pym pytest [<failed test>] --explain-review -s
#
# If you know that the only change is the CSS stylesheet then passing
# --explain-ignore-style will update the result file without asking if
# that's the only difference.

input_path = pathlib.Path(__file__).parent / "explain/input"
result_path = pathlib.Path(__file__).parent / "explain/result"


g_open_file_viewer_printed_note = False


def open_file_viewer(path):
    cmd = os.getenv("EXPLAIN_TEST_OPEN")
    if not cmd:
        cmd = ["open"]
    else:
        cmd = cmd.split()

    cmd.append(str(path))

    global g_open_file_viewer_printed_note
    if not g_open_file_viewer_printed_note:
        g_open_file_viewer_printed_note = True
        print(f"Opening results with {cmd}, set EXPLAIN_TEST_OPEN env var to change")

    subprocess.call(cmd)


def strip_style(svg_data):
    return re.sub("(<style>.*</style>)", "", svg_data, flags=re.DOTALL)


def check_output(
    tmp_path: pathlib.Path,
    actual_data: Optional[str],
    expected_path: pathlib.Path,
    in_path: Optional[pathlib.Path] = None,
    explain_review=False,
    explain_ignore_style=False,
):
    out_path = result_path
    tmp_path = tmp_path / result_path.parts[-1]

    assert actual_data

    if explain_ignore_style:
        norm_actual = strip_style(actual_data)
    else:
        norm_actual = actual_data

    if out_path.exists() or not explain_review:
        expected = expected_path.read_text()
        if explain_ignore_style:
            norm_expected = strip_style(expected)
        else:
            norm_expected = expected
    else:
        expected = None
    if explain_review:
        if expected and norm_actual == norm_expected:
            if actual_data != expected:  # handle --explain-ignore-style
                print(
                    f"{in_path or 'result'} OK but <style> doesn't match, updating file..."
                )
                expected_path.write_text(actual_data)
            else:
                print(f"{in_path or 'result'} OK")
        else:
            if not expected:
                print(f"{in_path or 'result'} NEW and has no expected file yet")
                expected_path.write_text(actual_data)
                open_file_viewer(expected_path)
            else:
                print(f"{in_path or 'result'} MISMATCH")
                open_file_viewer(expected_path)
                open_file_viewer(tmp_path)
                global g_update_all
                if not g_update_all:
                    print(f"[u]pdate {expected_path}, update [a]ll, enter to skip")
                    res = sys.stdin.readline()
                    if res.strip() == "u":  # update this one
                        do_update = True
                    elif res.strip() == "a":  # update all
                        g_update_all = True
                        do_update = True
                    else:
                        do_update = False
                else:
                    do_update = True
                if do_update:
                    expected_path.write_text(actual_data)
                    print(f"Updated {expected_path}")
    else:
        assert (
            actual_data == expected
        ), f"Rendering of {in_path or 'result'} does not match expected one"


def check_rendering(
    tmp_path: pathlib.Path,
    in_path: pathlib.Path,
    result_path: pathlib.Path,
    explain_review=False,
    explain_ignore_style=False,
    **kwargs,
):
    out_path = result_path
    tmp_path = tmp_path / result_path.parts[-1]

    data = in_path.read_text()

    if str(in_path).endswith("_invalid.json"):
        with pytest.raises(InvalidExplainPlan) as e:
            render_explain_plan(data, str(out_path), debug=1, **kwargs)
        assert "Invalid explain" in str(e)
        return
    else:
        render_explain_plan(data, str(tmp_path), debug=1, **kwargs)

    out = tmp_path.read_text()

    check_output(
        tmp_path=tmp_path,
        actual_data=out,
        expected_path=result_path,
        in_path=in_path,
        explain_review=explain_review,
        explain_ignore_style=explain_ignore_style,
    )


def test_render_output(tmp_path, explain_review, explain_ignore_style):
    global g_update_all
    g_update_all = False
    for f in os.listdir(input_path):
        if not f.endswith(".json"):
            continue
        # TODO(alfredo) not supported yet because unexpected >2 inputs to JOINs
        if f in [
            "mtr_explain_json_hypergraph_11.json",
            "mtr_explain_json_hypergraph_10.json",
            "mtr_hypergraph_12.json",
            "mtr_hypergraph_11.json",
        ]:
            continue
        try:
            check_rendering(
                tmp_path,
                input_path / f,
                result_path / f.replace(".json", ".svg"),
                explain_ignore_style=explain_ignore_style,
                explain_review=explain_review,
            )
        except:
            print("Exception while testing", input_path / f)
            raise


def test_render_explain_plan(tmp_path, explain_review, explain_ignore_style):
    def check_one(suffix, **kwargs):
        fn = f"select_1_{suffix}.svg"
        out_path = tmp_path / fn

        render_explain_plan(
            (input_path / "select_1.json").read_text(), out_path, **kwargs
        )
        expected = result_path / fn
        check_output(
            tmp_path=tmp_path,
            actual_data=out_path.read_text(),
            expected_path=expected,
            explain_review=explain_review,
            explain_ignore_style=explain_ignore_style,
        )

    check_one("compact", compact=1)
    check_one("showDescription", show_description=0)
    check_one("showQuery", show_query=0)
    check_one("bottomUp", layout="bottomUp")
    check_one("css", css="hello world")


def test_render_explain_plan_source_identity_in_title():
    compact = render_explain_plan(
        (input_path / "select_city.json").read_text(),
        "-",
        compact=True,
        show_query=False,
    )
    detailed = render_explain_plan(
        (input_path / "select_city.json").read_text(),
        "-",
        show_query=False,
    )
    index = render_explain_plan(
        (input_path / "select_city_country_id.json").read_text(),
        "-",
        show_query=False,
    )

    table_caption = '<tspan class="caption" x="0" dy="12">Table</tspan>'
    assert table_caption not in compact
    assert table_caption not in detailed
    assert '<tspan class="access_type_text" x="0" dy="14">table scan</tspan>' in compact
    assert ">city</tspan>" in compact
    assert '<tspan class="access_type_text" x="0" dy="14">table scan</tspan>' in detailed
    assert '<tspan class="source_table_name" x="0" dy="14">sakila.city</tspan>' in detailed
    assert '<tspan class="access_type_text" x="0" dy="14">index_lookup</tspan>' in index
    assert '<tspan class="source_table_name" x="0" dy="14">sakila.city</tspan>' in index
    assert ">idx_fk_country_id</tspan>" in index


def test_render_explain_plan_annotations_include_displayed_fields():
    detailed = render_explain_plan(
        (input_path / "select_city_country_id.json").read_text(),
        "-",
        show_query=False,
    )

    assert 'data-access_type="index"' in detailed
    assert 'data-estimated_total_cost="2.2"' in detailed
    assert 'data-table_name="city"' in detailed
    assert 'data-schema_name="sakila"' in detailed
    assert 'data-index_name="idx_fk_country_id"' in detailed
    assert 'data-index_access_type="index_lookup"' in detailed
    assert 'data-operation="Index lookup on city using idx_fk_country_id' in detailed
    assert 'data-used_columns="city_id, city, country_id, last_update"' in detailed
    assert 'data-lookup_condition="country_id = 4"' in detailed

    filtered = render_explain_plan(
        (input_path / "select_city_filter.json").read_text(),
        "-",
        show_query=False,
    )

    assert 'data-operation="Filter:' in filtered
    assert "data-condition=" in filtered
    assert 'data-estimated_rows="600.0"' in filtered

    compact = render_explain_plan(
        (input_path / "select_city_country_id.json").read_text(),
        "-",
        compact=True,
        show_query=False,
    )

    assert 'data-access_type="index"' in compact
    assert 'data-estimated_total_cost="2.2"' in compact
    assert 'data-table_name="city"' in compact
    assert 'data-index_name="idx_fk_country_id"' in compact
    assert 'data-index_access_type="index_lookup"' in compact
    assert 'data-operation="Index lookup on city using idx_fk_country_id' in compact
    assert "data-schema_name=" not in compact
    assert "data-used_columns=" not in compact
    assert "data-lookup_condition=" not in compact


def test_render_explain_plan_sales_by_film_category_select_star():
    plan = json.loads((input_path / "sales_by_film_category.json").read_text())
    plan["query"] = "SELECT * FROM sakila.sales_by_film_category"

    actual = render_explain_plan(json.dumps(plan), "-", show_query=True)
    ET.fromstring(actual)

    assert 'data-operation="Table scan on sales_by_film_category"' in actual
    assert 'data-table_name="sales_by_film_category"' in actual
    assert 'data-operation="Table scan on &lt;temporary&gt;"' in actual
    assert 'data-table_name="&lt;temporary&gt;"' in actual
    assert 'data-operation="Table scan on <temporary>"' not in actual
    assert 'data-table_name="<temporary>"' not in actual
    assert ">&lt;temporary&gt;</tspan>" in actual
    assert '<g transform="translate(0.0 2200.0)" class="query_box">' in actual
    assert ">SELECT</tspan>" in actual
    assert ">sakila</tspan>" in actual
    assert ">sales_by_film_category</tspan>" in actual


def test_render_explain_plan_bottom_up_single_input_nodes_align_vertically():
    actual = render_explain_plan(
        (input_path / "sales_by_film_category.json").read_text(),
        "-",
        layout="bottomUp",
        compact=True,
        show_description=False,
    )
    arrow_widths_by_operation = {}
    for match in re.finditer(r'<polygon class="arrow" points="([^"]+)"', actual):
        operations = list(
            re.finditer(r'data-operation="([^"]+)"', actual[: match.start()])
        )
        assert operations

        operation = operations[-1].group(1)
        arrow = match.group(1)
        values = [float(value) for value in arrow.split()]
        xs = values[0::2]
        arrow_widths_by_operation[operation] = max(xs) - min(xs)

    assert arrow_widths_by_operation["Materialize"] <= 20
    assert arrow_widths_by_operation["Table scan on &lt;temporary&gt;"] <= 20


def test_render_explain_plan_compact_joins_reduces_chained_join_height():
    plan = (input_path / "sales_by_film_category.json").read_text()

    regular = render_explain_plan(
        plan,
        "-",
        layout="bottomUp",
        compact=True,
        show_description=False,
    )
    compact_joins = render_explain_plan(
        plan,
        "-",
        layout="bottomUp",
        compact=True,
        compact_joins=True,
        show_description=False,
    )

    def height(svg: str) -> float:
        match = re.search(r'<svg[^>]*height="([^"]+)"', svg)
        assert match

        return float(match.group(1))

    assert height(compact_joins) < height(regular)


def test_render_explain_plan_dark_mode_css():
    actual = render_explain_plan(
        (input_path / "select_1.json").read_text(), "-", dark_mode=True
    )

    assert ".box_body { fill: #172033; stroke: #475569; }" in actual
    assert ".box_header { stroke: #0b122030; }" in actual
    assert ".text, .subtext, .code_text, .bold_text { fill: #d6deea; }" in actual

    custom = render_explain_plan(
        (input_path / "select_1.json").read_text(), "-", dark_mode=True, css="hello world"
    )
    assert "hello world" in custom
    assert "#172033" not in custom


def test_render_explain_plan_paths(tmp_path, explain_review, explain_ignore_style):
    fn = f"test_out.svg"
    out_path = tmp_path / fn
    render_explain_plan((input_path / "select_1.json").read_text(), out_path)
    orig = out_path.read_text()
    out_path.write_text("junk")
    # test overwrite
    render_explain_plan((input_path / "select_1.json").read_text(), out_path)
    assert orig == out_path.read_text()

    rodir = tmp_path / "rodir"

    # baddir
    with pytest.raises(OSError) as e:
        render_explain_plan(
            (input_path / "select_1.json").read_text(), rodir / "test.svg"
        )

    # test write to place without permissions
    rodir.mkdir()
    import stat

    rodir.chmod(stat.S_IREAD)
    try:
        with pytest.raises(OSError) as e:
            render_explain_plan(
                (input_path / "select_1.json").read_text(), rodir / "test.svg"
            )
    finally:
        rodir.chmod(stat.S_IREAD | stat.S_IWRITE)
        rodir.rmdir()


def test_old_explain_plan(tmp_path, explain_review, explain_ignore_style):
    plan = """
{
  "query_block": {
    "select_id": 1,
    "cost_info": {
      "query_cost": "221.50"
    },
    "nested_loop": [
      {
        "table": {
          "table_name": "country",
          "access_type": "ALL",
          "possible_keys": [
            "PRIMARY"
          ],
          "rows_examined_per_scan": 109,
          "rows_produced_per_join": 109,
          "filtered": "100.00",
          "cost_info": {
            "read_cost": "0.25",
            "eval_cost": "10.90",
            "prefix_cost": "11.15",
            "data_read_per_join": "22K"
          },
          "used_columns": [
            "country_id",
            "country",
            "last_update"
          ]
        }
      },
      {
        "table": {
          "table_name": "city",
          "access_type": "ref",
          "possible_keys": [
            "idx_fk_country_id"
          ],
          "key": "idx_fk_country_id",
          "used_key_parts": [
            "country_id"
          ],
          "key_length": "2",
          "ref": [
            "sakila.country.country_id"
          ],
          "rows_examined_per_scan": 5,
          "rows_produced_per_join": 60,
          "filtered": "10.00",
          "cost_info": {
            "read_cost": "150.25",
            "eval_cost": "6.01",
            "prefix_cost": "221.50",
            "data_read_per_join": "12K"
          },
          "used_columns": [
            "city_id",
            "city",
            "country_id",
            "last_update"
          ],
          "attached_condition": "(`sakila`.`city`.`last_update` = `sakila`.`country`.`last_update`)"
        }
      }
    ]
  }
}"""
    with pytest.raises(InvalidExplainPlan) as e:
        render_explain_plan(plan, "-")
    assert "Invalid explain plan" in str(e)


def test_render_explain_plan_return(tmp_path, explain_review, explain_ignore_style):
    actual = render_explain_plan((input_path / "select_1.json").read_text(), "-")
    expected = (result_path / "select_1.svg").read_text()
    assert actual == expected


def test_explain(tmp_path, explain_review, explain_ignore_style):
    try:
        mysqlsh.globals.shell.connect("root:@localhost")
    except DBError as e:
        pytest.skip(f"MySQL server is not available on localhost:3306: {e}")

    session = mysqlsh.globals.session

    version = session.run_sql("select @@version").fetch_one()[0]
    major, minor, _ = version.split(".", 2)
    if int(major) * 10000 + int(minor) * 100 < 80300:
        # requires 8.3.0+
        return
    session.run_sql("set session explain_json_format_version=1")
    session.run_sql(
        "set @old_explain_version=@@global.explain_json_format_version, @old_explain_format=@@global.explain_format"
    )
    session.run_sql("set global explain_json_format_version=1")
    session.run_sql("set global explain_format=tree")
    session.run_sql("set session explain_json_format_version=1")
    session.run_sql("set session explain_format=tree")

    try:
        actual = do_explain("select 1", "-")
        expected_path = result_path / "select_1.svg"

        with pytest.raises(DBError) as e:
            do_explain("garbage", "-")
        assert "You have an error in your SQL syntax" in str(e)
    finally:
        session.run_sql("set global explain_json_format_version=@old_explain_version")
        session.run_sql("set global explain_format=@old_explain_format")

    check_output(
        tmp_path=tmp_path,
        actual_data=actual,
        expected_path=expected_path,
        explain_review=explain_review,
        explain_ignore_style=explain_ignore_style,
    )


def test_badargs(tmp_path):
    outpath = str(tmp_path / "explain_out.svg")

    for arg0, arg1 in [
        (None, outpath),
        ("", outpath),
        (1, outpath),
        ([], outpath),
        ({}, outpath),
    ]:
        with pytest.raises(Exception) as e:
            render_explain_plan(arg0, arg1)

        with pytest.raises(Exception) as e:
            do_explain(arg0, arg1)

    with pytest.raises(Exception) as e:
        render_explain_plan({}, outpath, invalid_option=123)

    with pytest.raises(InvalidExplainPlan) as e:
        render_explain_plan("{}", outpath)

    with pytest.raises(InvalidExplainPlan) as e:
        render_explain_plan('{"query_block":{}}', outpath)
