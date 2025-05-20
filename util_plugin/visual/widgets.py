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
from svg import escape
from enum import Enum
from typing import Optional, List, Any, Tuple

debug = 0


class Point:
    def __init__(self, x=0.0, y=0.0):
        self.x = x
        self.y = y

    def __add__(self, s):
        if isinstance(s, Point):
            return Point(s.x + self.x, s.y + self.y)
        elif isinstance(s, Size):
            return Point(s.w + self.x, s.h + self.y)
        else:
            raise TypeError()

    def __sub__(self, s):
        if isinstance(s, Point):
            return Point(self.x - s.x, self.y - s.y)
        elif isinstance(s, Size):
            return Point(self.x - s.w, self.y - s.h)
        else:
            raise TypeError()

    def __div__(self, n: int):
        if type(n) not in (float, int):
            raise TypeError()
        return Point(self.x / n, self.y / n)

    def __str__(self):
        return f"{self.x},{self.y}"


class Size:
    def __init__(self, w=0.0, h=0.0):
        self.w = w
        self.h = h

    def __add__(self, s):
        if isinstance(s, Point):
            return Size(s.x + self.w, s.y + self.h)
        elif isinstance(s, Size):
            return Size(s.w + self.w, s.h + self.h)
        else:
            raise TypeError()

    def __sub__(self, s):
        if isinstance(s, Point):
            return Size(self.w - s.x, self.h - s.y)
        elif isinstance(s, Size):
            return Size(self.w - s.w, self.h - s.h)
        else:
            raise TypeError()

    def __str__(self):
        return f"{self.w},{self.h}"


class Widget:
    _parent: Optional["Widget"] = None
    _pos: Point
    _size: Optional[Size] = None
    _offset: Point
    _fixed_width: int = 0
    _fixed_height: int = 0
    _min_size: Optional[Size] = None
    _id: str
    _container_data: dict
    user_data: Any = None
    style = ""

    _debug_args = {"stroke": "black", "stroke_width": 1, "fill": "transparent"}

    def __init__(self, id: str = "", style: str = ""):
        self._container_data = {}
        self._pos = Point()
        self._offset = Point()
        self._id = id
        if style:
            self.style = style

    def set_pos(self, pos: Point):
        self._pos = pos

    def set_size(self, size: Size):
        self._size = size

    def to_absolute(self, p: Point) -> Point:
        p.x += self._pos.x
        p.y += self._pos.y
        if self._parent:
            return self._parent.to_absolute(p)
        return p

    def from_absolute(self, p: Point) -> Point:
        p.x -= self._pos.x
        p.y -= self._pos.y
        if self._parent:
            return self._parent.from_absolute(p)
        return p

    def layout(self):
        pass

    def traverse(self, before_fn, after_fn):
        before_fn(self)
        after_fn(self)

    def draw(self) -> Optional[svg.Element]:
        elem = self.do_draw()
        if elem:
            p = self._offset + self._pos
            elem.transform = f"translate({p.x} {p.y})"
            if debug:
                elem = svg.G(
                    elements=[
                        svg.Rect(
                            x=p.x,
                            y=p.y,
                            width=self.size.w,
                            height=self.size.h,
                            **self._debug_args,
                        ),
                        elem,
                    ]
                )
                return elem
            return elem
        return None

    def do_draw(self) -> Optional[svg.Element]:
        raise NotImplementedError()

    @property
    def min_size(self) -> Size:
        if not self._min_size:
            self._min_size = self.calc_min_size()
        return self._min_size

    @property
    def pos(self) -> Point:
        return self._pos

    @property
    def size(self) -> Size:
        if self._size:
            min_size = self.min_size
            return Size(max(min_size.w, self._size.w), max(min_size.h, self._size.h))
        return self.min_size

    def calc_min_size(self) -> Size:
        return Size(0, 0)


class Container(Widget):
    draw_background: bool = False
    background_args: Optional[dict] = None
    border_style: Optional[str] = None
    top_padding: int = 0
    left_padding: int = 0
    right_padding: int = 0
    bottom_padding: int = 0

    def __init__(
        self,
        top_padding=None,
        left_padding=None,
        right_padding=None,
        bottom_padding=None,
        draw_background=False,
        background_args=None,
        **kwargs,
    ) -> None:
        super().__init__(**kwargs)
        if top_padding is not None:
            self.top_padding = top_padding
        if left_padding is not None:
            self.left_padding = left_padding
        if bottom_padding is not None:
            self.bottom_padding = bottom_padding
        if right_padding is not None:
            self.right_padding = right_padding
        self.draw_background = draw_background
        if background_args:
            self.background_args = background_args

    @property
    def _children(self) -> List[Widget]:
        raise NotImplementedError()

    @property
    def hpadding(self) -> int:
        return self.left_padding + self.right_padding

    @property
    def vpadding(self) -> int:
        return self.top_padding + self.bottom_padding

    def do_draw(self) -> Optional[svg.Element]:
        result = []
        if self.draw_background:
            result.append(
                svg.Rect(
                    x=self.left_padding,
                    y=self.top_padding,
                    width=self.size.w - self.hpadding,
                    height=self.size.h - self.vpadding,
                    class_=[self.style],
                    **(self.background_args or {}),
                )
            )
        for c in self._children:
            tmp = c.draw()
            if tmp:
                result.append(tmp)
        if result:
            return svg.G(
                id=self._id or None, elements=result, class_=self.style or None
            )
        return None

    def traverse(self, before_fn, after_fn):
        before_fn(self)
        for c in self._children:
            c.traverse(before_fn, after_fn)
        after_fn(self)

    def calc_min_size(self) -> Size:
        min_size = super().calc_min_size()
        return min_size + Size(
            self.left_padding + self.right_padding,
            self.top_padding + self.bottom_padding,
        )


class Frame(Container):
    _computed_min_size = Size()
    _content: Optional[Widget] = None

    @property
    def _children(self) -> List[Widget]:
        assert self._content
        return [self._content]

    def layout(self):
        assert self._content
        self._computed_min_size = Size()
        super().layout()
        self._content.set_pos(Point(self.left_padding, self.top_padding))
        if self._fixed_width:
            self._content._fixed_width = self._fixed_width
        self._content.layout()

        self._computed_min_size = self._content.min_size + Size(
            self.hpadding, self.vpadding
        )

    def set_content(self, w: Widget):
        w._parent = self
        self._content = w

    def calc_min_size(self) -> Size:
        return self._computed_min_size


class Box(Container):
    spacing: int = 0

    @property
    def _children(self) -> List[Widget]:
        return self._start_list + self._end_list

    def __init__(self, spacing=0, fixed_width=0, fixed_height=0, **kwargs):
        super().__init__(**kwargs)

        self.spacing = spacing
        self._fixed_width = fixed_width
        self._fixed_height = fixed_height
        self._computed_min_size = Size()
        self._start_list = []
        self._end_list = []

    def add(
        self, w: Widget, expand: bool = False, fill: bool = True, end: bool = False
    ):
        w._parent = self
        w._container_data = {"expand": expand, "fill": fill}
        if end:
            self._end_list.append(w)
        else:
            self._start_list.append(w)


class VBox(Box):
    _debug_args = {"stroke": "red", "stroke_width": 1, "fill": "transparent"}

    def layout(self):
        self._computed_min_size = Size()
        super().layout()

        w = 0
        h = 0
        for c in self._children:
            if self._fixed_width:
                c._fixed_width = self._fixed_width - self.hpadding
            c.layout()
            ms = c.min_size
            w = max(ms.w, w)
            h += ms.h
        h += (len(self._children) - 1) * self.spacing + self.vpadding

        y = self.top_padding
        self._computed_min_size = Size(
            max(self._fixed_width, w + self.hpadding),
            max(self._fixed_height, h + self.vpadding),
        )
        for c in self._children:
            ms = c.min_size
            c.set_pos(Point(self.left_padding, y))
            c.set_size(Size(w, ms.h - self.vpadding))
            c.layout()
            y += ms.h + self.spacing

    def calc_min_size(self):
        return self._computed_min_size


class HBox(Box):
    _debug_args = {"stroke": "magenta", "stroke_width": 1, "fill": "transparent"}

    def layout(self):
        self._computed_min_size = Size()
        super().layout()

        w = 0
        h = 0
        for c in self._children:
            if self._fixed_height:
                c._fixed_height = self._fixed_height - self.vpadding
            c.layout()
            ms = c.size
            w += ms.w
            h = max(ms.h, h)
        w += (len(self._children) - 1) * self.spacing + self.hpadding
        x = self.left_padding
        self._computed_min_size = Size(
            max(self._fixed_width, w + self.hpadding),
            max(self._fixed_height, h + self.vpadding),
        )
        for c in self._start_list:
            ms = c.min_size
            c.set_pos(Point(x, self.top_padding))
            c.set_size(Size(ms.w - self.hpadding, h - self.vpadding))
            c.layout()
            x += ms.w + self.spacing

        leftover_space = self.size.w - w
        x += leftover_space
        for c in reversed(self._end_list):
            ms = c.min_size
            c.set_pos(Point(x, self.top_padding))
            c.set_size(Size(ms.w, h - self.vpadding))
            c.layout()
            x += ms.w + self.spacing

    def calc_min_size(self):
        return self._computed_min_size


class Grid(Container):
    _debug_args = {"stroke": "#0f0", "stroke_width": 1, "fill": "transparent"}

    def __init__(
        self,
        hspacing=0,
        vspacing=0,
        num_rows=1,
        num_columns=0,
        column_homogeneous=False,
        **kwargs,
    ):
        super().__init__(**kwargs)

        self.hspacing = hspacing
        self.vspacing = vspacing
        self.num_rows = num_rows
        self.num_columns = num_columns
        self.column_homogeneous = column_homogeneous
        self._cells: List[Optional[Widget]] = [None] * (num_rows * num_columns)
        self._cell_widths: List[float] = []
        self._cell_heights: List[float] = []

    @property
    def _children(self) -> List[Widget]:
        return [w for w in self._cells if w]

    def get(self, row: int, column: int) -> Optional[Widget]:
        assert row < self.num_rows
        assert column < self.num_columns
        return self._cells[row * self.num_columns + column]

    def put(self, row: int, column: int, w: Widget, row_span: int = 1, fill=False):
        assert w._parent is None
        w._parent = self
        self._cells[row * self.num_columns + column] = w
        w._container_data["fill"] = fill
        w._container_data["row_span"] = row_span

    def layout(self):
        widths = [0.0] * self.num_columns
        heights = [0.0] * self.num_rows

        for w in self._cells:
            if w:
                w.layout()

        # find height of each row
        for r in range(self.num_rows):
            for c in range(self.num_columns):
                w = self.get(r, c)
                if w:
                    ms = w.min_size
                    span = w._container_data.get("row_span", 1)
                    ms.h /= span
                    heights[r] = max(ms.h, heights[r])

        # find width of each column
        for c in range(self.num_columns):
            for r in range(self.num_rows):
                w = self.get(r, c)
                if w:
                    ms = w.min_size
                    widths[c] = max(ms.w, widths[c])
        if self.column_homogeneous:
            column_width = max(widths)
            # TODO fixme
            avail_width = self._fixed_width - self.hpadding
            if avail_width >= column_width * self.num_columns:
                column_width = avail_width / self.num_columns
                widths = [column_width] * self.num_columns

        self._cell_widths = widths
        self._cell_heights = heights

        y = self.top_padding
        for r in range(self.num_rows):
            x = self.left_padding
            for c in range(self.num_columns):
                w = self.get(r, c)
                if w:
                    ms = w.min_size
                    cell_width = self._cell_widths[c]
                    cell_height = sum(
                        self._cell_heights[r : r + w._container_data.get("row_span", 1)]
                    )
                    if w._container_data.get("fill"):
                        size = Size(max(cell_width, ms.w), max(cell_height, ms.h))
                        w.set_pos(Point(x, y))
                        w.set_size(size)
                    else:
                        w.set_pos(Point(x + (cell_width - ms.w) / 2, y))
                        w.set_size(Size(min(cell_width, ms.w), min(cell_height, ms.h)))
                x += self._cell_widths[c] + self.hspacing
            y += self._cell_heights[r] + self.vspacing

        self._computed_min_size = Size(self._fixed_width, self._fixed_height)
        if self._computed_min_size.w == 0:
            self._computed_min_size.w = (
                sum(widths) + (self.num_columns - 1) * self.hspacing + self.hpadding
            )
        if self._computed_min_size.h == 0:
            self._computed_min_size.h = (
                sum(heights) + (self.num_rows - 1) * self.vspacing + self.vpadding
            )

    def do_draw(self):
        elements = []
        for r in range(self.num_rows):
            for c in range(self.num_columns):
                w = self.get(r, c)
                if w:
                    elements.append(w.draw())
        if debug > 1:
            for r in range(self.num_rows):
                elements.append(
                    svg.Line(
                        x1=0,
                        x2=self.size.w,
                        y1=r * self._cell_heights[r],
                        y2=r * self._cell_heights[r],
                        stroke="cyan",
                    )
                )
            for c in range(self.num_columns):
                elements.append(
                    svg.Line(
                        y1=0,
                        y2=self.size.h,
                        x1=c * self._cell_widths[c],
                        x2=c * self._cell_widths[c],
                        stroke="cyan",
                    )
                )
        return svg.G(elements=elements, class_=[self.style] if self.style else None)

    def calc_min_size(self) -> Size:
        return self._computed_min_size


def guesstimate_text_width(text: str, char_width=5.0, monospace=False):
    if monospace:
        return len(text) * char_width

    narrow_chars = "ilI|.,'\"!:;`()[]"
    wide_chars = "WM@&#%8OQ"

    wide = 0
    narrow = 0
    other = 0
    for c in text:
        if c in wide_chars:
            wide += 1
        elif c in narrow_chars:
            narrow += 1
        else:
            other += 1
    return wide * (char_width * 2) + narrow * (char_width * 0.6) + other * char_width


def guesstimate_segmented_line_width(
    segments: List[Tuple[str, dict]], char_width: float
):
    if not segments:
        return 0.0

    monospace = "code" in segments[0][1].get("class_", [])
    return guesstimate_text_width(
        "".join([t for t, _ in segments]),
        char_width=char_width,
        monospace=monospace,
    )


def fit_text(
    segments: List[Tuple[str, dict]], max_width: int, char_width: float
) -> Tuple[float, List[List[Tuple[str, dict]]]]:
    # first, break segments into paragraphs based on \n
    paragraphs = []
    for text, attr in segments:
        first, nl, rest = text.partition("\n")
        if paragraphs:
            paragraphs[-1].append((first, attr))
        else:
            paragraphs = [[(first, attr)]]
        if nl:
            paragraphs.append([])
        paragraphs += [[(l, attr)] for l in rest.split("\n") if l]
    # filter empty segments
    paragraphs = [[seg for seg in para if seg[0]] for para in paragraphs]
    # now, go through tokens of each paragraph and break into lines that fit the space
    max_line_width = 0.0
    lines = []
    for para in paragraphs:
        line = []
        for segment in para:
            line.append(segment)
            w = guesstimate_segmented_line_width(line, char_width)
            if w > max_width:
                if len(line) == 1:
                    lines.append(line)
                    line = []
                else:
                    lines.append(line[:-1])
                    line = line[-1:]
                max_line_width = max(
                    max_line_width,
                    guesstimate_segmented_line_width(lines[-1], char_width),
                )
        if line:
            lines.append(line)
            max_line_width = max(
                max_line_width,
                guesstimate_segmented_line_width(lines[-1], char_width),
            )
    # coalesce words with the same attributes
    return max_line_width, lines


class TextJustification(Enum):
    Left = 0
    Right = 1
    Center = 2


class Text(Widget):
    _lines: List[List[Tuple[str, dict]]]
    _line_height: int = 14
    _computed_min_size = Size()
    # 9pt = 4.5
    # 10pt = 5
    # 11pt = 5.5
    # 12pt = 6
    _char_width: float = 6.0

    def __init__(
        self,
        text,
        char_width=6.0,
        justify=TextJustification.Left,
        **kwargs,
    ):
        super().__init__(**kwargs)

        def normalize(text) -> List[Tuple[str, dict]]:
            if isinstance(text, list):
                lines = []
                for line in text:
                    if isinstance(line, tuple):
                        lines.append(line)
                    else:
                        lines.append((line, {}))
                return lines
            else:
                return [(text, {})]

        # list of paragraphs
        self._text = normalize(text)
        self._char_width = char_width
        self._justify = justify

    def do_draw(self) -> Optional[svg.Element]:
        style = []
        if self.style:
            style.append(self.style)

        if self._justify == TextJustification.Left:
            x = 0
        elif self._justify == TextJustification.Right:
            x = self.size.w
        else:
            x = self.size.w / 2

        tspan_list = []
        for line in self._lines:
            first = True
            for text, attr in line:
                if first:
                    sx = x
                    sdy = self._line_height - 2
                    first = False
                else:
                    sx = None
                    sdy = None
                tspan_list.append(svg.TSpan(text=escape(text), x=sx, dy=sdy, **attr))
        return svg.G(elements=[svg.Text(y=0, elements=tspan_list, class_=style)])

    def layout(self):
        super().layout()

        max_width, self._lines = fit_text(
            self._text, self._fixed_width, self._char_width
        )

        self._computed_min_size = Size(
            self._fixed_width or max_width or 20, self._line_height * len(self._lines)
        )

    def calc_min_size(self) -> Size:
        return self._computed_min_size


class Icon(Widget):
    _symbol_name = None
    _computed_min_size = Size()

    def __init__(self, symbol, width=20, height=20, opacity=None, **kwargs):
        super().__init__(**kwargs)
        self._symbol_name = symbol
        self._fixed_width = width
        self._fixed_height = height
        self._opacity = opacity

    def do_draw(self) -> Optional[svg.Element]:
        style = []
        if self.style:
            style.append(self.style)
        return svg.Use(x=0, y=0, href=f"#{self._symbol_name}", opacity=self._opacity)

    def calc_min_size(self) -> Size:
        return Size(self._fixed_width, self._fixed_height)


class Badge(Widget):
    def __init__(self, text, height=15, text_style=None, **kwargs):
        super().__init__(**kwargs)
        self.text = text
        self.text_style = text_style
        self._badge_height = height

    def calc_min_size(self):
        return Size(48, self._badge_height)

    def do_draw(self):
        size = self.size

        return svg.G(
            opacity="85%",
            elements=[
                svg.Rect(
                    x=0,
                    y=(size.h - self._badge_height) / 2,
                    rx=2,
                    width=size.w,
                    height=self._badge_height,
                    class_=[self.style],
                ),
                svg.Text(x=size.w / 2, y=12, text=self.text, class_=[self.text_style]),
            ],
        )


class VSeparator(Widget):
    _line_height = 5

    def __init__(self, width=2, **kwargs):
        super().__init__(**kwargs)
        self._width = width

    def calc_min_size(self) -> Size:
        return Size(self._width, self._line_height)

    def do_draw(self) -> Optional[svg.Element]:
        return None


class HSeparator(Widget):
    _line_width = 10

    def __init__(self, height=2, **kwargs):
        super().__init__(**kwargs)
        self._height = height

    def calc_min_size(self) -> Size:
        return Size(self._line_width, self._height)

    def do_draw(self) -> Optional[svg.Element]:
        return None


class InfoCard(Frame):
    operation: str = ""
    _max_size = Size(300, 0)

    def __init__(self, title) -> None:
        super().__init__()

        self.title = title
        self.top_padding = 28
        self._box = VBox(spacing=4, fixed_width=300)
        self.set_content(self._box)

    def add_text(self, text, **kwargs):
        self._box.add(Text(text, **kwargs))

    def add(self, w):
        self._box.add(w)

    def calc_min_size(self) -> Size:
        size = super().calc_min_size() + Size(0, 30)
        size.w = max(size.w, 300)
        size.h = max(size.h, 100)
        return size

    def do_draw(self) -> Optional[svg.Element]:
        size = self.size
        return svg.G(
            elements=[
                svg.Rect(
                    x=0,
                    y=0,
                    rx=5,
                    width=size.w,
                    height=size.h - self.top_padding,
                    stroke_width=1,
                    fill="transparent",
                    stroke="#aaaaaa",
                ),
                svg.Path(
                    d=[
                        svg.M(0, self.top_padding),
                        svg.l(size.w, 0),
                        svg.l(0, -(self.top_padding - 5)),
                        svg.a(5, 5, 0, False, False, -5, -5),
                        svg.l(-(size.w - 10), 0),
                        svg.a(5, 5, 0, False, False, -5, 5),
                        svg.Z(),
                    ],
                    fill="#44AACC",
                    stroke="#aaaaaa",
                    stroke_width=1,
                ),
                svg.Path(
                    d=[
                        svg.M(1, self.top_padding - 1),
                        svg.l(size.w - 2, 0),
                        svg.l(0, -(self.top_padding - 6)),
                        svg.a(5, 5, 0, False, False, -4, -4),
                        svg.l(-(size.w - 10), 0),
                        svg.a(5, 5, 0, False, False, -4, 4),
                        svg.Z(),
                    ],
                    fill="transparent",
                    stroke="#eeeeee",
                    stroke_width=0.5,
                ),
                svg.Text(
                    x=self.left_padding + 5,
                    y=20,
                    text=self.title,
                    fill="white",
                    style="font: 12px sans-serif; alignment-baseline: bottom;",
                ),
                super().do_draw(),
            ]
        )
