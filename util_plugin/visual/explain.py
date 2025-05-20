#!/usr/bin/python3
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

import svg
from typing import Optional, List, Union, Tuple
import typing
from textwrap import dedent
import math
import re
from mysqlsh import mysql
from . import widgets
from .widgets import (
    Point,
    Size,
    Frame,
    VBox,
    HBox,
    Grid,
    Text,
    HSeparator,
    VSeparator,
    Badge,
    Icon,
    TextJustification,
)
from .svg_utils import make_bendy_arrow, make_varrow, make_harrow


k_svg_style = """
/* defaults */
* { pointer-events: none; }

.caption { font: 10px sans-serif; text-anchor: start; alignment-baseline: bottom; fill: #aaa; stroke: transparent; }

.title { font: 11px sans-serif; text-anchor: start; alignment-baseline: bottom; fill: #fff; stroke: transparent; }
.text { font: 11px sans-serif; text-anchor: start; alignment-baseline: bottom; fill: #555; stroke: transparent; }
.subtext { font: 11px sans-serif; text-anchor: start; alignment-baseline: bottom; fill: #555; stroke: transparent; }
.code_text { font: 10px monospace; text-anchor: start; alignment-baseline: bottom; fill: #555; stroke: transparent; }

.bold_text { font: bold 11px sans-serif; text-anchor: start; alignment-baseline: bottom; fill: #555; stroke: transparent; }

.join_text { font: bold 11px sans-serif; text-anchor: middle; alignment-baseline: bottom; fill: #fff; stroke: transparent; }
.join_subtext { font: 11px sans-serif; text-anchor: middle; alignment-baseline: bottom; fill: #444; stroke: transparent; }
.bold_join_subtext { font: bold 11px sans-serif; text-anchor: middle; alignment-baseline: bottom; fill: #444; stroke: transparent; }

.description { stroke: #f0f0f0; fill: #f0f0f0; }
.description_text { font: 9px sans-serif; text-anchor: start; alignment-baseline: bottom; fill: #888; stroke: transparent; }

.box_header { pointer-events: visiblePainted; }
.box_body { fill: #fff; stroke: #ccc; }
.box_content {}

.query_box { fill: #fff; }

.cost_box { stroke: #f0f0f0; fill: #f8f8f8; rx: 2; }
.subquery_heading { fill: #eee; stroke: #eee; rx: 2; }
.subquery_box { fill: transparent; stroke: #aaa; rx: 2; stroke-dasharray: 4,2; }

.total_rows_text { font: 11px sans-serif; text-anchor: start; alignment-baseline: bottom; }
.total_rows_text_v { font: 11px sans-serif; writing-mode: tb; text-anchor: end; alignment-baseline: bottom; }
.total_rows_text_vflip { font: 11px sans-serif; writing-mode: tb; text-anchor: start; alignment-baseline: bottom; }

.join_phase { font: 10px sans-serif; text-anchor: end; alignment-baseline: bottom; fill: #aaa; stroke: transparent; }

/* sql */
.identifier { fill: #888; font: 10px monospace; text-anchor: start; alignment-baseline: bottom; }
.comment { fill: #aaa; font: 10px monospace; text-anchor: start; alignment-baseline: bottom; }
.string { fill: #a64; font: 10px monospace; text-anchor: start; alignment-baseline: bottom; }
.number { fill: #266; font: 10px monospace; text-anchor: start; alignment-baseline: bottom; }
.keyword { fill: #48d; font: 10px monospace; text-anchor: start; alignment-baseline: bottom; }
.operator { fill: #c94; font: 10px monospace; text-anchor: start; alignment-baseline: bottom; }

/* index access types */
.index_index_lookup { stroke: #88cc88; fill: #77cc77; }
.index_index_scan { stroke: #a62; fill: #e84; }
.index_index_range_scan { stroke: #ba5; fill: #ec5; }
.index_pushed_join_ref { stroke: #eecc88; fill: #5cb; }
.index_multi_range_read { stroke: #888822; fill: #ec5; }
.index_index_skip_scan { stroke: #a62; fill: #e84; }
.index_group_index_skip_scan { stroke: #a62; fill: #e84; }
.index_dynamic_index_range_scan { stroke: #888822; fill: #ec5; }

.index_text { font: bold 11px sans-serif; text-anchor: start; alignment-baseline: middle; }
.index_subtext { font: 11px sans-serif; text-anchor: start; alignment-baseline: middle; }

/* other source types */
.source { stroke: #444444; fill: #cccccc; }
.source_text { font: bold 11px sans-serif; text-anchor: start; alignment-baseline: middle; }
.source_subtext { font: 11px sans-serif; text-anchor: start; alignment-baseline: middle; }
.source_subtext2 { font:  9px sans-serif; text-anchor: start; alignment-baseline: middle; }

.materialize_information_schema { stroke: #8899aa; fill: #88ccee; }

.rows_fetched_before_execution { stroke: #8899aa; fill: #8ad; }
.rows_fetched_before_execution_text { font: bold 11px sans-serif; }

.zero_rows { stroke: #888; fill: #aaa; }

/* join types */
.nested_loop { fill: #c69; }
.nested_loop_text { fill: #222222; font: bold 11px sans-serif; text-anchor: middle; alignment-baseline: middle; }

.hash { fill: #9cc; }
.hash_text { fill: #222222; font: bold 11px sans-serif; text-anchor: middle; alignment-baseline: middle; }

.batch_key_access { fill: #bbeeee; }
.batch_key_access_text { fill: #222222; font: bold 11px sans-serif; text-anchor: middle; alignment-baseline: middle; }

/* operation types */
.filter { stroke: #aaaa44; fill: #cca; }
.sort { stroke: #aaaa44; fill: #cca; }
.limit { stroke: #aaaa44; fill: #cca; }
.window { stroke: #aaaa44; fill: #cca; }
.aggregate { stroke: #aaaa44; fill: #cca; }
.append { stroke: #aaaa44; fill: #cca; }
.temp_table_aggregate { stroke: #aaaa44; fill: #cca; }
.temp_table_aggregate_text { font: bold 11px sans-serif; text-anchor: start; alignment-baseline: bottom; fill: #555555; }
.stream { stroke: #aaaa44; fill: #cca; }
.remove_duplicates_from_groups { stroke: #aaaa44; fill: #cca; }
.remove_duplicates_from_groups_text { font: bold 11px sans-serif; text-anchor: start; alignment-baseline: bottom; fill: #555555; }

.operation_text { font: bold 11px sans-serif; text-anchor: start; alignment-baseline: bottom; fill: #555555; }
.operation_subtext { font: 11px sans-serif; text-anchor: start; alignment-baseline: bottom; fill: #555555; }
.operation_subtext2 { font: 9px sans-serif; text-anchor: start; alignment-baseline: bottom; fill: #555555; }

/* materialize */
.materialize { stroke: #a9c; fill: #98d;  }

.materialize_text { font: bold 11px sans-serif; text-anchor: start; alignment-baseline: bottom; fill: #555555; }
.materialize_subtext { font: 11px sans-serif; text-anchor: start; alignment-baseline: bottom; fill: #555555; }

/* update types */
.update { stroke: #44f; fill: #44f; }
.insert { stroke: #44a; fill: #44a; }
.insert_values { stroke: #44a; fill: #44a; }
.replace_values { stroke: #4a4; fill: #4a4; }
.delete_rows { stroke: #a44; stroke-width: 2; fill: #a44; }

.update_body { fill: #eee; stroke: #ccc; }
.update_text { font: bold 11px sans-serif; text-anchor: start; alignment-baseline: middle; }

/* badges */
.badge_text { font: 8px sans-serif; text-anchor: middle; alignment-baseline: bottom; fill: #fff; }
.badge { fill: #555; rx:5; stroke-width: 0; }
.engine_badge { fill: #2F6F89; rx:5; stroke-width: 0; }

/* other */
.table { stroke: #b77; fill: #d88; }
.table_secondary { stroke: #6aa; fill: #7cc; }

.table_frame { stroke: #bbbbbb; fill: transparent; }
.subquery_frame { stroke: #bbbbbb; fill: transparent; }

.result { stroke: #a0a0a0; fill: #aaaaaa; rx: 3; }
.result_head { stroke: #a0a0a0; fill: #888888; rx:3; }
.result_text { font: bold 11px sans-serif; fill: #eeeeee; text-anchor: middle; alignment-baseline: middle; }

.arrow { stroke: transparent; fill: #aaa; }

.minimap_frame { stroke: #bbb; fill: #fff; filter: drop-shadow(3px 5px 2px rgb(0 0 0 / 0.4)); }
"""

k_svg_script = r"""
// <![CDATA[
document.boxHeightExpanded = {};

const toggleBox = (e) => {
        // Get the parent and child-elements that we want to manipulate
        const group = e.parentElement;
        const boxBody = group.getElementsByClassName("box_body")[0];
        const boxContent = group.getElementsByClassName("box_content")[0];
        const expandTriangle = group.getElementsByClassName("expand_triangle")[0];
        const nestedContent = group.parentElement.getElementsByClassName("box_nested_content")
            ? group.parentElement.getElementsByClassName("box_nested_content")[0] : undefined;
        if (boxContent.getAttribute("visibility") !== "collapse") {
            // Hide the content
            boxContent.setAttribute("visibility", "collapse");
            // Flip the expandTriangle
            expandTriangle.setAttribute("transform", "scale(1, -1) translate(235 -15)");

            // Remember the expanded height of the box, then collapse it
            const originalHeight = boxBody.getAttribute("height");
            let subContentTranslateX = 0;
            let subContentTranslateY = 0;

            if (nestedContent) {
                const transform = nestedContent.getAttribute("transform");
                const translateRegex = /translate\(\s*(\d*(\.\d*)?)\s+(\d*(\.\d*)?)\s*\)/gm;
                const matches = translateRegex.exec(transform);
                if (matches) {
                    subContentTranslateX = parseFloat(matches[1]);
                    subContentTranslateY = parseFloat(matches[3]);

                    nestedContent.setAttribute("transform",
                        `translate(${subContentTranslateX} ${subContentTranslateY - (originalHeight - 25)})`);
                }
            }

            document.boxHeightExpanded[boxBody.id] = {
                originalHeight,
                subContentTranslateX,
                subContentTranslateY,
            };
            boxBody.setAttribute("height", "25");
        } else {
            // Show the content
            boxContent.setAttribute("visibility", "visible");
            // Restore the expandTriangle orientation
            expandTriangle.setAttribute("transform", "scale(1 1) translate(235 7)");
            boxBody.setAttribute("height", document.boxHeightExpanded[boxBody.id].originalHeight);
            if (nestedContent) {
                nestedContent.setAttribute("transform",
                    `translate(${document.boxHeightExpanded[boxBody.id].subContentTranslateX} ${document.boxHeightExpanded[boxBody.id].subContentTranslateY})`);
            }
        }
};

// Collapse all boxes in the beginning
Array.prototype.map.call(document.getElementsByClassName("box_header"), (box) => {
    toggleBox(box);
});

// Add a global event listener for all mouseup events. This will only be triggered for classes that have
// pointer-events set, as all other pointer-events have been disabled with * { pointer-events: none; }
document.addEventListener("mouseup", (e) => {
    // Check if the event happened on an element with the box_header class name
    if (e.target.getAttribute("class") === "box_header") {
        toggleBox(e.target);
    }
});
 ]]>
"""


def warn(*args):
    print(*args)


def format_number(n) -> str:
    if n >= 1000000000000:
        return f"{n / 1000000000000:.2f} T"
    elif n >= 1000000000:
        return f"{n / 1000000000:.2f} G"
    elif n >= 1000000:
        return f"{n / 1000000:.2f} M"
    elif n >= 1000:
        return f"{n / 1000:.2f} K"
    else:
        return f"{n:.2f}"


def format_cost(cost: Optional[Union[float, str]]) -> str:
    if cost is None:
        return "n/a"
    if isinstance(cost, str):
        return cost
    return format_number(cost)


def format_rows(n, compact=False) -> str:
    if n is None:
        return "n/a"
    if isinstance(n, str):
        return n

    rows = "" if compact else " rows"
    row = "" if compact else " row"

    if n >= 1000000000000:
        return f"{n / 1000000000000:.1f} T{rows}"
    elif n >= 1000000000:
        return f"{n / 1000000000:.1f} G{rows}"
    elif n >= 1000000:
        return f"{n / 1000000:.1f} M{rows}"
    elif n >= 1000:
        return f"{n / 1000:.1f} K{rows}"
    elif n >= 1 or n == 0:
        if n == 1:
            return f"{n:.0f}{row}"
        else:
            return f"{n:.0f}{rows}"
    else:
        return f"{n:.2f}{rows}"


def token_type_format(token_type: str) -> dict:
    if token_type == "IDENTIFIER" or token_type == "BACK_TICK_QUOTED_ID":
        return {"class_": ["identifier", "code"]}
    elif token_type == "BLOCK_COMMENT" or token_type == "DASHDASH_COMMENT":
        return {"class_": ["comment", "code"]}
    elif token_type == "DOUBLE_QUOTED_TEXT" or token_type == "SINGLE_QUOTED_TEXT":
        return {"class_": ["string", "code"]}
    elif token_type.endswith("_NUMBER"):
        return {"class_": ["number", "code"]}
    elif token_type == ("OPEN_PAR_SYMBOL", "CLOSE_PAR_SYMBOL"):
        return {"class_": ["operator", "code"]}
    elif token_type.endswith("_OPERATOR"):
        return {"class_": ["operator", "code"]}
    elif token_type == "DOT_SYMBOL":
        return {"class_": ["keyword", "code"]}
    elif token_type == "COMMA_SYMBOL":
        return {"class_": ["operator", "code"]}
    elif token_type.endswith("_SYMBOL"):
        return {"class_": ["keyword", "code"]}
    elif token_type.endswith("WHITESPACE"):
        return {"class_": ["code"]}
    else:
        return {"class_": ["code"]}


def highlight_sql(sql: str) -> List[Tuple[str, dict]]:
    try:
        tokens = mysql.tokenize_statement(sql)
    except AttributeError as e:
        return [(sql, {})]
    result = []
    for token in tokens:
        result.append((token["token"], token_type_format(token["type"])))
    return result


def snake_case_to_text(s) -> str:
    return " ".join([w.capitalize() for w in s.split("_")])


class InvalidExplainPlan(Exception):
    # when plan has operation = <not executable by iterator executor>
    pass


def make_text(x, y, text, **kwargs):
    elements = []
    for line in text.split("\n"):
        elements.append(svg.Text(text=line, x=x, y=y, **kwargs))
        y += 15
    return svg.G(elements=elements)


def validate_type(type_hint, value):
    origin = typing.get_origin(type_hint)
    args = typing.get_args(type_hint)
    if origin is None:
        return isinstance(value, type_hint)
    elif origin == Optional:
        return value is None or isinstance(value, args[0])
    elif origin == Union:
        return any(isinstance(value, arg) for arg in args)
    elif origin == list:
        return all(isinstance(x, args[0]) for x in value)
    else:
        raise ValueError(f"Unexpected type_hint {type_hint} {origin}")


#####


class BaseExplainWidget(VBox):
    operation: str = ""

    def __init__(self, owner: "node", compact=False, top_anchor_margin=0, **kwargs):
        elem_id = f'{owner.access_type or "node"}_{owner._owner.get_id_serial()}'
        super().__init__(id=elem_id, **kwargs)
        self.owner = owner
        self.compact = compact
        self.top_anchor_margin = top_anchor_margin
        self.id = elem_id

    @property
    def top_anchor(self) -> Point:
        return Point(self.size.w // 2, 1 - self.top_anchor_margin)

    @property
    def left_anchor(self) -> Point:
        return Point(1, self.size.h // 2)

    @property
    def bottom_anchor(self) -> Point:
        return Point(self.size.w // 2, self.size.h)

    @property
    def right_anchor(self) -> Point:
        return Point(self.size.w, self.size.h // 2)

    @property
    def top_left(self) -> Point:
        return Point(self.left_anchor.x, self.top_anchor.y)

    @property
    def bottom_right(self) -> Point:
        return Point(self.right_anchor.x, self.bottom_anchor.y)

    def add_text(self, text, style="text", bold=False, end=False, **kwargs):
        raise NotImplementedError()

    def add_widget(self, w, end=False):
        raise NotImplementedError()

    def layout(self):
        super().layout()

    def _draw_arrow(
        self,
        from_widget: "BaseExplainWidget",
        to_widget: "BaseExplainWidget",
        is_select_item: bool,
    ):
        flipped = self.owner._owner.options.top_down

        from_point = self.from_absolute(
            from_widget.to_absolute(
                from_widget.bottom_anchor if flipped else from_widget.top_anchor
            )
        )
        yoffset = 5 if flipped else -5
        if is_select_item:
            to_point = self.from_absolute(to_widget.to_absolute(to_widget.right_anchor))

            return make_bendy_arrow(
                from_point.x,
                from_point.y + yoffset,
                to_point.x + 10,
                to_point.y,
                self.owner._arrow_width,
                invert=flipped,
                class_=["arrow"],
            )
        else:
            to_point = self.from_absolute(
                to_widget.to_absolute(
                    to_widget.top_anchor if flipped else to_widget.bottom_anchor
                )
            )

            if from_point.x == to_point.x:
                return make_varrow(
                    to_point.x,
                    from_point.y + yoffset,
                    to_point.y - yoffset,
                    self.owner._arrow_width,
                    invert=flipped,
                    class_=["arrow"],
                )
            else:
                to_point = self.from_absolute(
                    to_widget.to_absolute(to_widget.left_anchor)
                )

                return make_bendy_arrow(
                    from_point.x,
                    from_point.y + yoffset,
                    to_point.x,
                    to_point.y,
                    self.owner._arrow_width,
                    invert=flipped,
                    class_=["arrow"],
                )

    def _draw_row_count(
        self, from_widget: "BaseExplainWidget", to_widget: "BaseExplainWidget"
    ) -> list:
        estimated_rows = getattr(from_widget.owner, "estimated_rows", None)
        actual_rows = getattr(from_widget.owner, "actual_rows", None)

        if estimated_rows is None and actual_rows is None:
            return []

        flipped = self.owner._owner.options.top_down

        if flipped:
            from_point = self.from_absolute(
                from_widget.to_absolute(from_widget.bottom_anchor)
            )
            to_point = self.from_absolute(to_widget.to_absolute(to_widget.top_anchor))
            yoffset = 20
        else:
            from_point = self.from_absolute(
                from_widget.to_absolute(from_widget.top_anchor)
            )
            to_point = self.from_absolute(
                to_widget.to_absolute(to_widget.bottom_anchor)
            )
            yoffset = -10

        est_rows_text = f"{'' if isinstance(estimated_rows, str) else '~'}{format_rows(estimated_rows, compact=self.compact)}"
        if actual_rows is not None:
            actual_rows_text = (
                f"{format_rows(actual_rows, compact=self.compact)} (actual)"
            )
        else:
            actual_rows_text = None
        elems = []
        p = from_point
        if from_point.y != to_point.y:
            elems.append(
                svg.Text(
                    x=from_point.x + from_widget.owner._arrow_width / 2 + 6,
                    y=from_point.y + yoffset,
                    text=est_rows_text,
                    class_=[
                        "total_rows_text_vflip" if flipped else "total_rows_text_v"
                    ],
                )
            )
            if actual_rows_text:
                elems.append(
                    svg.Text(
                        x=from_point.x - from_widget.owner._arrow_width / 2 - 6,
                        y=from_point.y + yoffset,
                        text=actual_rows_text,
                        class_=[
                            "total_rows_text_vflip" if flipped else "total_rows_text_v"
                        ],
                    )
                )
        else:
            elems.append(
                svg.Text(
                    x=p.x,
                    y=p.y - from_widget.owner._arrow_width / 2 - 2,
                    text=est_rows_text,
                    class_=["total_rows_text"],
                )
            )
            if actual_rows_text:
                elems.append(
                    svg.Text(
                        x=p.x,
                        y=p.y + from_widget.owner._arrow_width / 2 + 2,
                        text=actual_rows_text,
                        class_=["total_rows_text"],
                    )
                )
        return elems

    def do_draw(self) -> Optional[svg.Element]:
        extras = []
        if self.owner._parent:
            is_select_item = self.owner in self.owner._parent.inputs_from_select_list

            from_widget = self
            to_widget = self.owner._parent._symbol
            extras.append(
                self._draw_arrow(from_widget, to_widget, is_select_item=is_select_item)
            )

            extras += self._draw_row_count(from_widget, to_widget)

            if self.owner.inputs_from_select_list:
                p = self.right_anchor

                extras.append(
                    svg.Text(
                        x=p.x + 10,
                        y=p.y - 10,
                        text="(from select list)",
                        class_=["text"],
                    )
                )

        if widgets.debug:
            extras += [
                svg.Circle(cx=self.top_anchor.x, cy=self.top_anchor.y, r=2),
                svg.Circle(cx=self.left_anchor.x, cy=self.left_anchor.y, r=2),
                svg.Circle(cx=self.bottom_anchor.x, cy=self.bottom_anchor.y, r=2),
                svg.Circle(cx=self.right_anchor.x, cy=self.right_anchor.y, r=2),
            ]

        return svg.G(elements=[super().do_draw()] + extras)


class JoinWidget(BaseExplainWidget):
    _symbol_height = 70
    _symbol_width = 100

    def __init__(self, owner: "node", title: str, compact=False, **kwargs) -> None:
        super().__init__(
            owner=owner,
            fixed_width=200 if not compact else 100,
            fixed_height=70,
            compact=compact,
            **kwargs,
        )
        self.title = title
        self._inner_box = VBox(top_padding=15, fixed_height=self._symbol_height)
        self.add(self._inner_box, fill=True)
        self._inner_box.add(
            Text(self.title, justify=TextJustification.Center, style="join_text")
        )

    @property
    def left_anchor(self) -> Point:
        return Point(
            (self.size.w - self._symbol_width) // 2,
            self.top_padding + self._symbol_height // 2,
        )

    @property
    def bottom_anchor(self) -> Point:
        return Point(self.size.w // 2, self.min_size.h)

    @property
    def right_anchor(self) -> Point:
        return Point(
            (self.size.w + self._symbol_width) // 2,
            self.top_padding + self._symbol_height // 2,
        )

    def add_inner_text(self, text, style="join_subtext", **kwargs):
        self._inner_box.add(
            Text(text, justify=TextJustification.Center, style=style, **kwargs)
        )

    def add_text(
        self, text, style=None, bold=False, end=False, char_width=5.5, **kwargs
    ):
        if not style:
            style = "bold_text" if bold else "text"
        w = Text(text, style=style, char_width=char_width, **kwargs)
        self.add(w, end=end)

    def add_widget(self, w, end=False):
        self.add(w, end=end)

    def _draw_join_phases(self) -> List[svg.Element]:
        assert len(self.owner.inputs) == 2, self.owner.inputs

        # tag inputs with the phases that they represent
        tag0 = None
        tag1 = None
        input0 = self.owner.inputs[0]
        input1 = self.owner.inputs[1]
        if self.owner.join_algorithm == "nested_loop":
            tag0 = "outer"
            tag1 = "inner"
        elif self.owner.join_algorithm == "hash":
            if getattr(input1, "heading") == "Hash":
                tag0 = "probe"
                tag1 = "build"
            else:
                tag0 = "build"
                tag1 = "probe"
        elif self.owner.join_algorithm == "batch_key_access":
            if getattr(input0, "heading") == "Batch input rows":
                tag0 = "outer"
                tag1 = "inner"
            else:
                tag0 = "inner"
                tag1 = "outer"

        p0 = self.from_absolute(
            input0._symbol.to_absolute(
                Point(input0._symbol.right_anchor.x, input0._symbol.top_anchor.y)
            )
        )
        p1 = self.from_absolute(
            input1._symbol.to_absolute(
                Point(input1._symbol.right_anchor.x, input1._symbol.top_anchor.y)
            )
        )

        flipped = self.owner._owner.options.top_down
        yoffset = 5 if flipped else 4

        elements = []
        elements.append(
            svg.Text(
                x=p0.x,
                y=p0.y - yoffset,
                text=tag0,
                class_=["join_phase"],
            )
        )
        elements.append(
            svg.Text(
                x=p1.x,
                y=p1.y - yoffset,
                text=tag1,
                class_=["join_phase"],
            )
        )
        return elements

    def do_draw(self) -> Optional[svg.Element]:
        x = (self.size.w - self._symbol_width) / 2
        y = 0
        elements = [
            svg.Circle(
                cx=x + self._symbol_height / 2,
                cy=y + self._symbol_height / 2,
                r=self._symbol_height / 2,
                class_=[self.style],
                opacity="90%",
            ),
            svg.Circle(
                cx=x + self._symbol_width - self._symbol_height / 2,
                cy=y + self._symbol_height / 2,
                r=self._symbol_height / 2,
                class_=[self.style],
                opacity="90%",
            ),
            super().do_draw(),
        ] + self._draw_join_phases()

        return svg.G(elements=elements)


class ResultWidget(BaseExplainWidget):
    _symbol_width = 60
    _symbol_height = 60

    def __init__(self, owner: "node", **kwargs) -> None:
        super().__init__(owner=owner, fixed_width=60, fixed_height=60, **kwargs)
        self._inner_box = VBox(fixed_height=self._symbol_height)
        self.add(self._inner_box, fill=True)

    def add_inner_text(self, text, style="join_subtext", **kwargs):
        pass

    def add_text(self, text, style=None, bold=False, end=False, **kwargs):
        pass

    def do_draw(self) -> Optional[svg.Element]:
        elements: list = [
            svg.Rect(
                x=0,
                width=self._symbol_width,
                height=self._symbol_height,
                class_=["result"],
            ),
            svg.Rect(
                x=0,
                width=self._symbol_width,
                height=self._symbol_height / 7,
                class_=["result_head"],
            ),
        ]
        for i in range(6):
            elements.append(
                svg.Line(
                    x1=0,
                    y1=self._symbol_height * (i + 1) / 7,
                    x2=self._symbol_width,
                    y2=self._symbol_height * (i + 1) / 7,
                    class_=["result"],
                )
            )

        return svg.G(
            elements=elements
            + [
                svg.Line(
                    x1=self._symbol_width / 3,
                    y1=0,
                    x2=self._symbol_width / 3,
                    y2=self._symbol_height,
                    class_=["result"],
                ),
                svg.Line(
                    x1=self._symbol_width * 2 / 3,
                    y1=0,
                    x2=self._symbol_width * 2 / 3,
                    y2=self._symbol_height,
                    class_=["result"],
                ),
                svg.Text(
                    text="result",
                    x=self._symbol_width / 2,
                    y=self._symbol_height / 2 + 5,
                    class_=["result_text", "text"],
                ),
                super().do_draw(),
            ]
        )


class ExplainWidget(BaseExplainWidget):
    def __init__(
        self,
        owner: "node",
        title,
        description=None,
        icon=None,
        style=None,
        body_style=None,
        always_show_description=False,
        compact=False,
        **kwargs,
    ) -> None:
        super().__init__(owner=owner, spacing=1, compact=compact, **kwargs)

        kwargs.pop("top_anchor_margin", None)

        self.title = title
        self.header_style = style
        self.body_style = body_style or "box_body"
        if icon and not compact:
            self._title_box = HBox(
                left_padding=4,
                right_padding=8,
                top_padding=2,
                bottom_padding=2,
                fixed_height=21,
                spacing=4,
            )
            self._title_box.add(
                Icon(icon, width=16, height=14, opacity="40%", **kwargs)
            )
        else:
            self._title_box = HBox(
                left_padding=8,
                right_padding=8,
                top_padding=2,
                bottom_padding=2,
                fixed_height=21,
                spacing=4,
            )
        self._title_box.add(Text(self.title, style="title"))
        self._title_box.add(VSeparator(), expand=True)
        self.add(self._title_box, fill=True)

        content_group = VBox(style="box_content")
        self.add(content_group)

        if (
            description
            and (owner._owner.options.show_description or always_show_description)
            and not self.compact
        ):
            frame = Frame(
                left_padding=1,
                right_padding=1,
                draw_background=True,
                style="description",
            )
            margin = Frame(
                left_padding=5, top_padding=0, right_padding=5, bottom_padding=3
            )
            text = Text(not_code(description), char_width=4.5, style="description_text")
            # hack to force width of text
            text._fixed_width = self.symbol_width - 10
            margin.set_content(text)
            frame.set_content(margin)
            content_group.add(frame)

        self._box = VBox(
            top_padding=4,
            left_padding=8,
            right_padding=8,
            bottom_padding=2,
            spacing=2,
            fixed_width=self.symbol_width,
        )
        content_group.add(self._box)

    @property
    def symbol_width(self):
        if self.compact:
            return 120
        else:
            return 220

    def add_badge(self, text, style="badge", text_style="badge_text", **kwargs):
        self._title_box.add(
            Badge(text, style=style, height=18, text_style=text_style, **kwargs),
            end=True,
        )

    def add_text(
        self, text, style=None, bold=False, end=False, char_width=5.5, **kwargs
    ):
        if not style:
            style = "bold_text" if bold else "text"
        w = Text(text, style=style, char_width=char_width, **kwargs)
        w._fixed_width = self.symbol_width - self.hpadding
        self._box.add(w, end=end)

    def add_widget(self, w, end=False):
        self._box.add(w, end=end)

    def do_draw(self) -> Optional[svg.Element]:
        size = self.size
        title_height = self._title_box.min_size.h + self.top_padding

        expander = []
        if self.owner._owner.options.dynamic:
            expander.append(
                svg.Polygon(
                    class_=["expand_triangle"],
                    points=[0, 7, 5, 0, 10, 7],
                    fill="white",
                    transform=f"translate({size.w-20} 7)",
                )
            )

        pos = Point()
        return svg.G(
            elements=[
                svg.Rect(
                    x=pos.x,
                    y=pos.y,
                    rx=5,
                    width=size.w,
                    height=size.h,
                    stroke_width=1,
                    class_=[self.body_style],
                ),
                svg.Path(
                    d=[
                        svg.M(pos.x, pos.y + title_height),
                        svg.l(size.w, 0),
                        svg.l(0, -(title_height - 5)),
                        svg.a(5, 5, 0, False, False, -5, -5),
                        svg.l(-(size.w - 10), 0),
                        svg.a(5, 5, 0, False, False, -5, 5),
                        svg.Z(),
                    ],
                    class_=[self.header_style],
                    stroke_width=1,
                ),
                svg.Path(
                    d=[
                        svg.M(pos.x + 1, pos.y + title_height - 1),
                        svg.l(size.w - 2, 0),
                        svg.l(0, -(title_height - 6)),
                        svg.a(5, 5, 0, False, False, -4, -4),
                        svg.l(-(size.w - 10), 0),
                        svg.a(5, 5, 0, False, False, -4, 4),
                        svg.Z(),
                    ],
                    fill="transparent",
                    stroke="#eeeeee",
                    stroke_width=0.5,
                    class_=["box_header"],
                ),
                super().do_draw(),
            ]
            + expander,
        )


class SubqueryGrid(Grid):
    def __init__(self, heading, **kwargs):
        super().__init__(
            top_padding=8 + (24 if heading else 0),
            left_padding=8,
            right_padding=8,
            bottom_padding=8,
            **kwargs,
        )
        self.heading = heading

    def do_draw(self) -> Optional[svg.Element]:
        size = self.size
        return svg.G(
            elements=[
                svg.Rect(
                    x=0, y=0, width=size.w, height=24, class_=["subquery_heading"]
                ),
                svg.Text(x=8, y=18, text=self.heading, class_=["text"]),
                svg.Rect(
                    x=0,
                    y=0,
                    width=size.w,
                    height=size.h,
                    class_=["subquery_box"],
                ),
                super().do_draw(),
            ]
        )


def caption(text):
    return [(text, {"class_": "caption"}), ("\n", {})]


def code(text):
    return highlight_sql(text)


def not_code(text):
    return [(t, {}) for t in re.split(r"(\S+)", text)]


#####


class DrawOptions:
    debug = 0
    show_description = True
    detailed = True
    show_query = True
    compact_chained_joins = False
    top_down = True
    css = None
    dynamic = False
    minimap: Optional[Tuple[int, int, int, int]] = None


class Explain:
    unknown_operation_keys = set()
    unknown_access_types = set()

    def __init__(
        self,
        explain: dict,
        explain_analyze: bool = False,
        options: DrawOptions = DrawOptions(),
    ):
        self.analyze = explain_analyze
        self.options = options
        self.query = explain.get("query")
        # json_schema_version was introduced in 9.2
        if "json_schema_version" not in explain:
            schema_version = 100
        else:
            major, minor = explain["json_schema_version"].split(".", 2)
            schema_version = int(major) * 100 + int(minor)

        self.query_type = explain.get("query_type")

        # 9.2 added a new query_plan block and added versioning, starting at 2.0
        if schema_version < 200:
            query_plan = explain.copy()
            if "query" in query_plan:
                del query_plan["query"]
        else:
            query_plan = explain["query_plan"]

        # cost estimate below this value are painted in gray
        self.ignored_cost_cutoff = 1.0
        self.min_cost = None
        self.max_cost = None
        self._analyze_plan(query_plan)

        if self.query_type == "select":
            self.query_plan = QueryPlan(self, None, {"inputs": [query_plan]})
        else:
            self.query_plan = make_node(self, None, query_plan)

    def dump(self, indent=0):
        print(self.query)
        print()
        self.query_plan._dump(indent)

    _element_id_serial = 0

    def get_id_serial(self) -> int:
        self._element_id_serial += 1
        return self._element_id_serial

    def _analyze_plan(self, plan: dict):
        cost = plan.get("estimated_total_cost", None)
        if isinstance(cost, float):
            self.min_cost = (
                min(self.min_cost, cost) if self.min_cost is not None else cost
            )
            self.max_cost = (
                max(self.max_cost, cost) if self.max_cost is not None else cost
            )
        for c in plan.get("inputs", []):
            self._analyze_plan(c)
        for c in plan.get("inputs_from_select_list", []):
            self._analyze_plan(c)

    def _color_for_cost(self, cost: Optional[Union[str, float]]) -> str:
        def hex_to_rgb(hex_color):
            hex_color = hex_color.lstrip("#")
            return tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4))

        def rgb_to_hex(rgb_color):
            return "#{:02x}{:02x}{:02x}".format(*rgb_color)

        def interpolate_colors(color1, color2, fraction):
            r = int(color1[0] + (color2[0] - color1[0]) * fraction)
            g = int(color1[1] + (color2[1] - color1[1]) * fraction)
            b = int(color1[2] + (color2[2] - color1[2]) * fraction)
            return (r, g, b)

        def percentage_to_rgb(percentage: float):
            colors = [
                "#ffb07f",
                "#e98d6b",
                "#e3685c",
                "#d14a61",
                "#b13c6c",
                "#8f3371",
                "#6c2b6d",
            ]
            rgb_colors = [hex_to_rgb(color) for color in colors]

            index = int(percentage * (len(colors) - 1))
            fraction = (percentage * (len(colors) - 1)) % 1

            if index >= len(colors) - 1:
                return rgb_colors[-1]
            else:
                return rgb_to_hex(
                    interpolate_colors(
                        rgb_colors[index], rgb_colors[index + 1], fraction
                    )
                )

        if not isinstance(cost, float):
            return "#f0f0f0"

        if cost < self.ignored_cost_cutoff:
            return "#f0f0f0"

        if self.max_cost is None:
            return "#f0f0f0"

        return percentage_to_rgb(
            math.log10(cost) / (self.max_cost - self.ignored_cost_cutoff)
        )

    def adjust_nodes(self, w):
        node = w.user_data
        if not node:
            return

        # align this node to the parent node of the child group
        if node.inputs:
            c = node.inputs[-1]
            assert node._container
            assert not c._container or isinstance(c._container, Grid)

            child_offset = node._container.from_absolute(
                c._symbol.to_absolute(c._symbol.top_anchor)
            )
            node._symbol._pos.x = child_offset.x - node._symbol.size.w / 2

    def _make_icons(self):
        return svg.Defs(
            elements=[
                svg.Symbol(
                    id="filtericon",
                    elements=[
                        svg.Polygon(
                            points=[
                                1,
                                2,
                                17,
                                2,
                                10.5,
                                7,
                                10.5,
                                15,
                                8.5,
                                16,
                                8.5,
                                8,
                                1,
                                2,
                            ],
                            stroke_width=1,
                            stroke="white",
                            fill="transparent",
                        )
                    ],
                ),
                svg.Symbol(
                    id="sorticon",
                    elements=[
                        svg.Line(
                            x1=0,
                            y1=i * 3.5,
                            x2=i * 3,
                            y2=i * 3.5,
                            stroke_width=2,
                            stroke="white",
                        )
                        for i in range(5)
                    ],
                ),
                svg.Symbol(
                    id="limiticon",
                    elements=[
                        svg.Rect(
                            x=2,
                            y=2,
                            width=12,
                            height=15,
                            stroke_width=1,
                            stroke="white",
                            fill="transparent",
                        ),
                        svg.Line(
                            x1=15, y1=5, x2=18, y2=5, stroke_width=1, stroke="white"
                        ),
                        svg.Line(
                            x1=18, y1=5, x2=18, y2=15, stroke_width=1, stroke="white"
                        ),
                        svg.Line(
                            x1=15, y1=15, x2=18, y2=15, stroke_width=1, stroke="white"
                        ),
                        svg.Line(
                            x1=8, y1=2, x2=8, y2=17, stroke_width=1, stroke="white"
                        ),
                    ]
                    + [
                        svg.Line(
                            x1=2,
                            y1=2 + i * 3,
                            x2=14,
                            y2=2 + i * 3,
                            stroke="white",
                            stroke_width=1,
                        )
                        for i in range(5)
                    ],
                ),
                svg.Symbol(
                    id="aggregateicon",
                    elements=[
                        svg.Circle(
                            cx=8,
                            cy=5,
                            r=3,
                            stroke_width=1,
                            stroke="white",
                            fill="transparent",
                        ),
                        svg.Circle(
                            cx=2,
                            cy=15,
                            r=2,
                            stroke_width=1,
                            stroke="white",
                            fill="transparent",
                        ),
                        svg.Circle(
                            cx=8,
                            cy=15,
                            r=2,
                            stroke_width=1,
                            stroke="white",
                            fill="transparent",
                        ),
                        svg.Circle(
                            cx=14,
                            cy=15,
                            r=2,
                            stroke_width=1,
                            stroke="white",
                            fill="transparent",
                        ),
                        svg.Line(
                            x1=8,
                            y1=8,
                            x2=4,
                            y2=13,
                            stroke_width=1,
                            stroke="white",
                        ),
                        svg.Line(
                            x1=8,
                            y1=8,
                            x2=8,
                            y2=13,
                            stroke_width=1,
                            stroke="white",
                        ),
                        svg.Line(
                            x1=8,
                            y1=8,
                            x2=12,
                            y2=13,
                            stroke_width=1,
                            stroke="white",
                        ),
                    ],
                ),
                svg.Symbol(
                    id="streamicon",
                    elements=[
                        svg.Polygon(
                            points=[0, 6, 5, 1, 10, 6, 10, 20, 6, 15, 0, 20],
                            stroke="white",
                            fill="white",
                        )
                    ],
                ),
                svg.Symbol(
                    id="windowicon",
                    elements=[
                        svg.Rect(
                            x=3,
                            y=1,
                            width=11,
                            height=15,
                            stroke="white",
                            fill="transparent",
                        ),
                        svg.Rect(
                            x=0,
                            y=6,
                            width=16,
                            height=5,
                            stroke="white",
                            fill="white",
                        ),
                    ],
                ),
            ]
        )

    def _draw_extras(self, size: Size):
        extra_size = Size(0, 0)
        elems = []
        if self.options.show_query and self.query:
            frame = Frame(
                top_padding=10,
                left_padding=10,
                right_padding=10,
                draw_background=True,
                style="query_box",
            )
            w = Text(code(self.query), style="text")
            w._fixed_width = 800
            frame.set_content(w)
            frame.set_pos(Point(0, size.h + 60))
            frame.layout()
            elems.append(frame.draw())
            extra_size.w = max(extra_size.w, w.size.w)
            extra_size.h = max(extra_size.h, w.size.h)
        return elems, extra_size

    def _draw_minimap(self, size: Size, scale: float) -> svg.SVG:
        def draw_recursive(n: node):
            elements = []
            if isinstance(n._symbol, JoinWidget):
                top_anchor = n._symbol.to_absolute(n._symbol.top_anchor)
                bottom_anchor = n._symbol.to_absolute(n._symbol.bottom_anchor)
                r = (bottom_anchor.y - top_anchor.y) * scale / 2
                elements += [
                    svg.Circle(
                        cx=top_anchor.x * scale - r / 2,
                        cy=top_anchor.y * scale + r / 2,
                        r=r,
                        stroke="transparent",
                        fill=n._cost_color,
                    ),
                    svg.Circle(
                        cx=top_anchor.x * scale + r / 2,
                        cy=top_anchor.y * scale + r / 2,
                        r=r,
                        stroke="transparent",
                        fill=n._cost_color,
                    ),
                ]
            else:
                top_left = n._symbol.to_absolute(n._symbol.top_left)
                bottom_right = n._symbol.to_absolute(n._symbol.bottom_right)
                elements.append(
                    svg.Rect(
                        x=top_left.x * scale,
                        y=top_left.y * scale,
                        width=(bottom_right.x - top_left.x) * scale,
                        height=(bottom_right.y - top_left.y) * scale,
                        stroke="transparent",
                        fill=self._color_for_cost(n.estimated_total_cost),
                    )
                )
            for c in n.inputs:
                elements += draw_recursive(c)
            for c in n.inputs_from_select_list:
                elements += draw_recursive(c)
            return elements

        elements = draw_recursive(self.query_plan)

        return svg.G(
            elements=[
                svg.Rect(
                    x=0, y=0, width=size.w, height=size.h, class_=["minimap_frame"]
                ),
            ]
            + elements
        )

    def render_svg(self) -> svg.SVG:
        style = [svg.Style(text=self.options.css or k_svg_style)]
        if self.options.dynamic:
            script = [svg.Script(text=k_svg_script)]
        else:
            script = []
        defs = self._make_icons()
        assert self.query_plan._container
        self.query_plan._container.layout()

        min_size = self.query_plan._container.min_size
        self.query_plan._container.traverse(lambda x: None, self.adjust_nodes)
        elem = self.query_plan._container.draw()

        extra_elems, extra_size = self._draw_extras(min_size)

        if self.options.minimap:
            x, y, w, h = self.options.minimap
            ratio = min_size.w / min_size.h
            if min_size.w > min_size.h:
                adjusted_w = w
                adjusted_h = h * ratio
            else:
                adjusted_w = w * ratio
                adjusted_h = h

            if x < 0:
                x = min_size.w + x
            if y < 0:
                y = min_size.h + y

            minimap = self._draw_minimap(
                Size(adjusted_w, adjusted_h), adjusted_w / min_size.w
            )
            minimap.transform = f"translate({x} {y})"
            extra_elems.append(minimap)

        total_width = max(min_size.w, extra_size.w) + 100
        total_height = min_size.h + 100 + extra_size.h

        if elem:
            elem.transform = f"translate(50 50)"

            return svg.SVG(
                id="mysqlVisualExplain",
                width=total_width,
                height=total_height,
                elements=style + [defs, elem] + extra_elems + script,
            )
        else:
            return svg.SVG(
                id="mysqlVisualExplain",
                width=total_width,
                height=total_height,
                elements=style + [defs] + extra_elems + script,
            )


def make_node(owner: Explain, parent: Optional["node"], explain: dict):
    access_type = explain.get("access_type")

    if explain.get("operation") == "<not executable by iterator executor>":
        raise InvalidExplainPlan(f"Invalid explain plan: {explain}")

    # workaround for server bug: explain doesn't set access_type for this case
    if (
        access_type is None
        and owner.query_type == "select"
        and explain.get("semijoin_strategy") == "weedout"
    ):
        access_type = "unknown"
        explain["access_type"] = "weedout"

    if access_type not in k_access_types and owner.query_type == "select":
        owner.unknown_access_types.add(access_type)
        return UnknownOperation(owner, parent, explain)
    else:
        if not access_type:
            if owner.query_type in ("update", "insert"):
                return k_access_types[owner.query_type](owner, parent, explain)
            raise InvalidExplainPlan(
                f"Invalid explain plan node for type '{owner.query_type}' missing access_type: {explain}"
            )

        return k_access_types[access_type](owner, parent, explain)


class node:
    access_type: str = ""
    actual_first_row_ms: Optional[float] = None
    actual_last_row_ms: Optional[float] = None
    actual_loops: Optional[int] = None
    actual_rows: Optional[float] = None
    alias: Optional[str] = None
    buffering: Optional[bool] = None
    cacheable: Optional[bool] = None
    condition: Optional[str] = None
    covering: Optional[bool] = None
    cte: Optional[bool] = None
    deduplication: Optional[bool] = None
    dependent: Optional[bool] = None
    duplicate_removal: Optional[bool] = None
    estimated_first_row_cost: Optional[Union[float, str]] = None
    estimated_rows: Optional[Union[float, str]] = None
    estimated_total_cost: Optional[Union[float, str]] = None
    except_: Optional[bool] = None
    extra_condition: List[str]
    filter_columns: List[str]
    functions: List[str]
    group_by: Optional[bool] = None
    group_items: List[str]
    hash_condition: List[str]
    heading: Optional[str] = None
    index_access_type: Optional[str] = None
    index_name: Optional[str] = None
    inputs_from_select_list: List["node"]
    inputs: List["node"]
    intersect: Optional[bool] = None
    join_algorithm: Optional[str] = None
    join_columns: List[str]
    join_type: Optional[str] = None
    key_columns: List[str]
    limit_offset: Optional[int] = None
    limit: Optional[int] = None
    lookup_condition: Optional[str] = None
    lookup_references: List[str]
    operation: Optional[str] = None
    per_chunk_limit: Optional[int] = None
    pushed_index_condition: Optional[str] = None
    query_type: str
    ranges: List[str]
    recursive: Optional[bool] = None
    rollup: Optional[bool] = None
    schema_name: Optional[str] = None
    secondary_engine: Optional[str] = None
    semijoin_strategy: Optional[str] = None
    sort_fields: List[str]
    subquery_location: Optional[str] = None
    subquery: Optional[bool] = None
    table_name: Optional[str] = None
    tables: List[str]
    temp_table: Optional[bool] = None
    union: Optional[bool] = None
    used_columns: List[str]
    zero_rows_cause: Optional[str] = None

    _is_framed = False

    def __init__(self, owner: Explain, parent: Optional["node"], explain: dict):
        self._owner = owner
        self._parent = parent

        k_python_keywords = ["except"]

        type_hints = typing.get_type_hints(node)
        for k, v in explain.items():
            if k in k_python_keywords:
                k = "except_"

            if k not in type_hints:
                owner.unknown_operation_keys.add(k)
            else:
                if k not in ["inputs", "inputs_from_select_list"]:
                    assert validate_type(
                        type_hints[k], v
                    ), f"Unexpected type in explain plan for {k}: {v} ({type(v)})"
                setattr(self, k, v)
        self.inputs = []
        self.inputs_from_select_list = []

        self._symbol = self._make_symbol()

        self._cost_color = self._owner._color_for_cost(self.estimated_total_cost)

        self._add_cost_estimate()
        self._add_cost_actual()

        self._container: Optional[Grid] = None

        if "inputs" in explain:
            assert isinstance(explain["inputs"], list)
            for inp in explain["inputs"]:
                self.inputs.append(make_node(owner, self, inp))

        if "inputs_from_select_list" in explain:
            assert isinstance(explain["inputs_from_select_list"], list)
            for inp in explain["inputs_from_select_list"]:
                self.inputs_from_select_list.append(make_node(owner, self, inp))

        if self.inputs or self.inputs_from_select_list:
            chained_join = False
            if (
                isinstance(self, Join)
                and self.inputs
                and isinstance(self.inputs[0], Join)
            ):
                chained_join = True
                assert len(self.inputs) == 2

            num_columns = len(self.inputs) + len(self.inputs_from_select_list)
            if not self.inputs:
                num_columns += 1
            if self.subquery:
                self._container = SubqueryGrid(
                    num_columns=num_columns,
                    num_rows=2,
                    vspacing=80 if not self._symbol.compact else 60,
                    hspacing=40 if not self._symbol.compact else 20,
                    heading=self.heading,
                    style="box_nested_content",
                )
            else:
                self._container = Grid(
                    num_columns=num_columns,
                    num_rows=2,
                    vspacing=80 if not self._symbol.compact else 60,
                    hspacing=40 if not self._symbol.compact else 20,
                    style="box_nested_content",
                )
            self._container.user_data = self

            if self._owner.options.top_down:
                children_row = 0
                parent_row = 1
            else:
                children_row = 1
                parent_row = 0

            col = 0
            for child in self.inputs:
                if chained_join and 0:
                    self._container.put(
                        row=children_row,
                        row_span=2,
                        column=col,
                        w=child._container or child._symbol,
                    )
                else:
                    self._container.put(
                        row=children_row,
                        column=col,
                        w=child._container or child._symbol,
                    )
                col += 1
            if self.inputs:
                col -= 1
            self._container.put(row=parent_row, column=col, w=self._symbol)

            for child in self.inputs_from_select_list:
                col += 1
                self._container.put(
                    row=children_row, column=col, w=child._container or child._symbol
                )

    def _add_cost_estimate(self):
        if isinstance(self._symbol, BaseExplainWidget):
            if isinstance(self._symbol, ExplainWidget) or isinstance(
                self._symbol, JoinWidget
            ):
                if not self._symbol.compact:
                    # self._symbol.add_text(caption("Cost Estimate"), style="text")
                    grid = Grid(
                        num_rows=1,
                        num_columns=2,
                        top_padding=2,
                        bottom_padding=2,
                        left_padding=6,
                        right_padding=6,
                        hspacing=4,
                        column_homogeneous=True,
                    )
                    text = Text(
                        caption("Total Cost Estimate")
                        + [format_cost(self.estimated_total_cost)],
                        style="bold_text",
                    )
                    grid.put(0, 0, text, fill=True)
                    if self.estimated_first_row_cost is not None:
                        text = Text(
                            caption("First Row Cost")
                            + [format_cost(self.estimated_first_row_cost)],
                            style="text",
                        )
                        grid.put(0, 1, text, fill=True)
                    frame = Frame(
                        draw_background=True,
                        style="cost_box",
                        # background_args={
                        #     "stroke": self._cost_color,
                        #     "stroke_width": 1,
                        # },
                    )
                    frame.set_content(grid)
                    self._symbol.add_widget(frame)
                else:
                    self._symbol.add_text(
                        f"Cost Est.: {format_cost(self.estimated_total_cost)}",
                        style="text",
                    )

    def _add_cost_actual(self):
        if self.actual_loops is None and self.actual_rows is None:
            return

        if isinstance(self._symbol, BaseExplainWidget):
            if isinstance(self._symbol, ExplainWidget) or isinstance(
                self._symbol, JoinWidget
            ):
                if not self._symbol.compact:
                    elems = []
                    if self.actual_loops is not None:
                        elems.append(
                            Text(
                                caption("Loops") + [f"{self.actual_loops}"],
                                style="text",
                            )
                        )
                    if self.actual_first_row_ms is not None:
                        elems.append(
                            Text(
                                caption("First Row")
                                + [f"{self.actual_first_row_ms:.2f} ms"],
                                style="text",
                            )
                        )
                    if self.actual_last_row_ms is not None:
                        elems.append(
                            Text(
                                caption("Last Row")
                                + [f"{self.actual_last_row_ms:.2f} ms"],
                                style="text",
                            )
                        )

                    self._symbol.add_text(caption("Actual Cost"), style="text")
                    grid = Grid(
                        num_rows=1,
                        num_columns=len(elems),
                        top_padding=0,
                        bottom_padding=0,
                        left_padding=6,
                        right_padding=6,
                        hspacing=4,
                        column_homogeneous=True,
                    )

                    for c, elem in enumerate(elems):
                        grid.put(0, c, elem, fill=True)

                    frame = Frame(draw_background=True, style="cost_box")
                    frame.set_content(grid)
                    self._symbol.add_widget(frame)
                else:
                    self._symbol.add_text(
                        f"Actual Cost: {format_cost(self.estimated_total_cost)}",
                        style="text",
                    )

    def _dump(self, indent=0):
        print(indent * "  ", f"+ {self.access_type or '?'} '{self.operation}'")
        for k in dir(self):
            if (
                not k.startswith("_")
                and k
                not in [
                    "inputs",
                    "inputs_from_select_list",
                    "access_type",
                    "operation",
                ]
                and getattr(self, k) is not None
            ):
                print(indent * "  ", f"  - {k}: {getattr(self, k)}")
        if self.inputs_from_select_list:
            print(indent * "  ", f"  = inputs_from_select_list")
        for inp in self.inputs_from_select_list:
            inp._dump(indent + 2)
        if self.inputs:
            print(indent * "  ", f"  = inputs")
        for inp in self.inputs:
            inp._dump(indent + 2)

    def __str__(self) -> str:
        return f"'{self.operation}'"

    _style = "generic"

    @property
    def _caption(self) -> str:
        return f"{self.access_type}"

    @property
    def _arrow_width(self) -> int:
        if not hasattr(self, "estimated_rows"):
            if self.inputs:
                return self.inputs[0]._arrow_width
            return 1

        if not self.estimated_rows or isinstance(self.estimated_rows, str):
            return 1
        else:
            return max(
                (int(math.log2(self.estimated_rows)) if self.estimated_rows else 0) + 1,
                1,
            )

    def _make_symbol(self, **kwargs) -> BaseExplainWidget:
        # fallback only
        widget = ExplainWidget(
            self,
            self._caption + (f" ({self.heading})" if self.heading else ""),
            description=self.operation,
            style=self._style,
            compact=not self._owner.options.detailed,
            top_anchor_margin=(
                30 if self.subquery and not self._owner.options.top_down else 0
            ),
            **kwargs,
        )
        return widget


class source(node):
    """
    +----------+
    |   xxxx   |
    +----------+
    """

    @property
    def _style(self):
        return self.access_type

    def _make_symbol(self, **kwargs) -> BaseExplainWidget:
        widget = ExplainWidget(
            self,
            self._caption + (f" ({self.heading})" if self.heading else ""),
            description=self.operation,
            style=self._style,
            compact=not self._owner.options.detailed,
            top_anchor_margin=(
                30 if self.subquery and not self._owner.options.top_down else 0
            ),
            **kwargs,
        )

        if self.table_name:
            if getattr(self, "alias", None) and not widget.compact:
                alias = f" ({self.alias})"
            else:
                alias = ""
            if getattr(self, "schema_name", None) and not widget.compact:
                table_name = f"{self.schema_name}.{self.table_name}{alias}"
            else:
                table_name = f"{self.table_name}{alias}"
            widget.add_text(caption("Table") + [table_name], style="bold_text")
        if self.secondary_engine:
            assert isinstance(widget, ExplainWidget)
            widget.add_badge(self.secondary_engine, style="engine_badge")
            widget.add_text(caption("Secondary Engine") + [self.secondary_engine])
        if self.index_name:
            widget.add_text(caption("Index") + [self.index_name], style="bold_text")
        if hasattr(self, "used_columns") and not widget.compact:
            widget.add_text(
                caption("Used Columns") + not_code(", ".join(self.used_columns))
            )
        if self.lookup_condition and not widget.compact:
            widget.add_text(caption("Lookup Condition") + code(self.lookup_condition))
        if self.pushed_index_condition and not widget.compact:
            widget.add_text(
                caption("Pushed Index Condition") + code(self.pushed_index_condition)
            )
        if self.cacheable and not widget.compact:
            widget.add_text("Cacheable: true")

        return widget


class update(node):
    @property
    def _caption(self):
        return self.access_type or self._owner.query_type

    @property
    def _style(self) -> str:
        return self.access_type or self._owner.query_type

    def _make_symbol(self, **kwargs) -> BaseExplainWidget:
        w = ExplainWidget(
            self,
            self._caption,
            description=self.operation,
            style=self._style,
            body_style="update_body",
            compact=not self._owner.options.detailed,
            **kwargs,
        )
        if self.heading:
            w.add_text(self.heading)
        return w


class operation(node):
    """
    <op>
      |
    [...]
    """

    _icon = "unknown"

    @property
    def _style(self):
        return f"{self.access_type}"

    def _make_symbol(self, **kwargs) -> BaseExplainWidget:
        widget = ExplainWidget(
            self,
            self._caption + (f" ({self.heading})" if self.heading else ""),
            description=self.operation,
            icon=self._icon,
            style=self._style,
            compact=not self._owner.options.detailed,
            top_anchor_margin=(
                30 if self.subquery and not self._owner.options.top_down else 0
            ),
            **kwargs,
        )
        return widget


class Index(source):
    @property
    def _style(self) -> str:
        assert self.index_access_type, "Index:missing index_access_type"
        return f"index_{self.index_access_type}"

    @property
    def _caption(self) -> str:
        if self._owner.options.detailed:
            text = f"{'covering ' if self.covering else ''}{self.index_access_type}"
        else:
            text = f"{self.index_access_type}"
        return text


class Table(source):
    @property
    def _style(self):
        if self.secondary_engine:
            return "table_secondary"
        return "table"

    @property
    def _caption(self) -> str:
        return "table scan"


class Join(node):
    """
     +----<g>        <.>----<g>
     |     |    or           |
    [t]   [t]               [t]
    """

    @property
    def _style(self):
        return f"{self.join_algorithm}"

    def _make_symbol(self, **kwargs) -> BaseExplainWidget:
        assert self.join_type
        w = JoinWidget(
            self,
            self.join_type,
            style=self._style,
            compact=not self._owner.options.detailed,
            **kwargs,
        )
        w.add_inner_text(self.join_algorithm)
        if self.semijoin_strategy:
            w.add_inner_text(self.semijoin_strategy)
        if getattr(self, "hash_condition", None) and not w.compact:
            w.add_text(caption("Hash Condition") + code("\n".join(self.hash_condition)))
        return w


class Filter(operation):
    _icon = "filtericon"

    def _make_symbol(self, **kwargs) -> BaseExplainWidget:
        w = super()._make_symbol(**kwargs)
        if not w.compact:
            w.add_text(
                caption("Condition") + code(self.condition),
                char_width=6,
            )
        return w


class Sort(operation):
    _icon = "sorticon"

    @property
    def _caption(self) -> str:
        # unlike in format v1, if there's a sort in v2, then it's a filesort
        return "filesort"

    def _make_symbol(self, **kwargs) -> BaseExplainWidget:
        w = super()._make_symbol(**kwargs)
        if not w.compact:
            w.add_text(
                caption("Sort Fields") + code(", ".join(self.sort_fields)),
                char_width=6,
            )
        return w


class Aggregate(operation):
    _icon = "aggregateicon"

    @property
    def _style(self):
        return f"{self.access_type}{' (group by)' if getattr(self, 'group_by', False) else ''}"

    def _make_symbol(self, **kwargs) -> BaseExplainWidget:
        w = super()._make_symbol(**kwargs)
        if hasattr(self, "functions") and not w.compact:
            w.add_text(
                caption("Functions") + code("\n".join(self.functions)),
                char_width=6,
            )
        return w


class Window(operation):
    _icon = "windowicon"

    def _make_symbol(self, **kwargs) -> BaseExplainWidget:
        w = super()._make_symbol(**kwargs)
        if hasattr(self, "functions") and not w.compact:
            w.add_text(
                caption("Functions") + code(", ".join(self.functions)),
                char_width=6,
            )
        return w


class Limit(operation):
    _icon = "limiticon"

    def _make_symbol(self, **kwargs) -> BaseExplainWidget:
        w = super()._make_symbol(**kwargs)
        if (self.limit_offset is not None or self.limit is not None) and not w.compact:
            grid = Grid(num_rows=1, num_columns=2, column_homogeneous=True)
            c = 0
            if self.limit_offset is not None:
                grid.put(
                    0,
                    0,
                    Text(caption("Offset") + [str(self.limit_offset)], style="text"),
                    fill=True,
                )
                c = 1
            if self.limit is not None:
                grid.put(
                    0,
                    c,
                    Text(caption("Limit") + [str(self.limit)], style="text"),
                    fill=True,
                )
            w.add_widget(grid)
        return w


class TemptableAggregate(Aggregate):
    pass


class Materialize(node):
    """
     +-------....[m]
     |     |      |
    [.]   [.] .. [.]
    """

    def _make_symbol(self, **kwargs) -> BaseExplainWidget:
        widget = ExplainWidget(
            self,
            self.operation,
            style="materialize",
            compact=not self._owner.options.detailed,
            top_anchor_margin=(
                30 if self.subquery and not self._owner.options.top_down else 0
            ),
        )
        return widget


class ConstTable(source):
    pass


class FollowTail(node):
    pass


class IndexMerge(operation):
    pass


class RowidIntersection(operation):
    pass


class RowidUnion(operation):
    pass


class RowsFetchedBeforeExecution(source):
    pass


class MaterializedTableFunction(node):
    pass


class UnqualifiedCount(node):
    pass


class ZeroRows(source):
    def _make_symbol(self, **kwargs) -> BaseExplainWidget:
        w = super()._make_symbol(**kwargs)
        if not w.compact:
            w.add_text(caption("Zero Rows Cause") + not_code(self.zero_rows_cause))
        return w


class ZeroRowsAggregated(node):
    pass


class Stream(operation):
    _icon = "streamicon"


class ConstantRow(node):
    pass


class MaterializeInformationSchema(source):
    pass


class Append(operation):
    pass


class RemoveDuplicatesFromGroups(operation):
    pass


class RemoveDuplicatesOnIndex(node):
    pass


class AlternativePlansForInSubquery(node):
    pass


class InvalidateMaterializedTables(node):
    pass


class InsertValues(update):
    pass


class ReplaceValues(update):
    pass


class DeleteRows(update):
    def _make_symbol(self, **kwargs) -> BaseExplainWidget:
        w = super()._make_symbol(**kwargs)
        if not w.compact:
            w.add_text(caption("Tables") + not_code(self.tables))
        return w


class Update(update):
    pass


class UnknownOperation(node):  # artificial
    pass


class QueryPlan(node):
    access_type = "query_plan"
    operation = "query"

    @property
    def _caption(self):
        return f"result"

    @property
    def _style(self) -> str:
        return "result"

    def _make_symbol(self, **kwargs) -> BaseExplainWidget:
        return ResultWidget(self)


k_access_types = {
    "aggregate": Aggregate,
    "alternative_plans_for_in_subquery": AlternativePlansForInSubquery,
    "append": Append,
    "const_table": ConstTable,
    "constant_row": ConstantRow,
    "delete_rows": DeleteRows,
    "filter": Filter,
    "follow_tail": FollowTail,
    "index_merge": IndexMerge,
    "index": Index,
    "insert_values": InsertValues,
    "insert": InsertValues,
    "invalidate_materialized_tables": InvalidateMaterializedTables,
    "join": Join,
    "limit": Limit,
    "materialize_information_schema": MaterializeInformationSchema,
    "materialize": Materialize,
    "materialized_table_function": MaterializedTableFunction,
    "remove_duplicates_from_groups": RemoveDuplicatesFromGroups,
    "remove_duplicates_on_index": RemoveDuplicatesOnIndex,
    "replace_values": ReplaceValues,
    "rowid_intersection": RowidIntersection,
    "rowid_union": RowidUnion,
    "rows_fetched_before_execution": RowsFetchedBeforeExecution,
    "sort": Sort,
    "stream": Stream,
    "table": Table,
    "temp_table_aggregate": TemptableAggregate,
    "unknown": UnknownOperation,
    "unqualified_count": UnqualifiedCount,
    "update": Update,
    "window": Window,
    "zero_rows_aggregated": ZeroRowsAggregated,
    "zero_rows": ZeroRows,
}

if __name__ == "__main__":
    import sys
    import json
    import subprocess
    import os
    import argparse

    parser = argparse.ArgumentParser(
        prog="explain",
        description="Render MySQL explain plan in SVG",
        epilog="Test program",
    )
    parser.add_argument("filenames", nargs="+")
    parser.add_argument(
        "-c",
        "--compact",
        help="Compact mode",
    )
    parser.add_argument(
        "-d",
        "--description",
        help="Show descriptions",
    )
    parser.add_argument(
        "-t", "--top-down", help="Display from top to down", default=False
    )
    parser.add_argument("--css", help="Path to css file to embed")
    parser.add_argument("--debug", action="store_true", help="Enable debug mode")
    args = parser.parse_args()

    first = True
    for inpath in args.filenames:
        # import time

        # if args.wait and not first:
        #     # input("Press Enter to continue")
        #     for i in range(args.wait):
        #         print(args.wait - i)
        #         time.sleep(1)
        # first = False

        print(inpath)
        if inpath == "-":
            data = sys.stdin.read()
            inpath = "stdin.json"
        else:
            with open(inpath) as f:
                data = f.read()
        outpath = os.path.basename(inpath).replace(".json", ".svg")

        options = DrawOptions()
        options.debug = args.debug
        options.show_description = not args.description
        options.detailed = not args.compact
        options.top_down = args.top_down
        # options.minimap = (10, 10, 200, 200)
        options.minimap = None
        if args.css:
            options.css = open(args.css).read()

        try:
            qb = Explain(json.loads(data), options=options)
            qb.dump()

            out = qb.render_svg()
        except InvalidExplainPlan as e:
            print(inpath, e)
            continue
        except:
            print("While handling", inpath)
            raise
        print("Writing", outpath)
        with open(outpath, "w+") as f:
            f.write(str(out))

        # subprocess.call(["open", outpath])

        if qb.unknown_operation_keys:
            print(inpath + ": UNKNOWN KEYS IN EXPLAIN PLAN:", qb.unknown_operation_keys)

        if qb.unknown_access_types:
            print(
                inpath + ": UNKNOWN ACCESS_TYPES IN EXPLAIN PLAN:",
                qb.unknown_access_types,
            )
