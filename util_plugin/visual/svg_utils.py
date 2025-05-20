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
from enum import Enum
from typing import List, Tuple


class ArrowStyle(Enum):
    TRIANGLE_TIP = 1
    BLOCK = 2


def make_varrow(
    cx,
    y0,
    y1,
    width,
    style: ArrowStyle = ArrowStyle.BLOCK,
    invert: bool = False,
    **kwargs
):
    width //= 2
    width = max(0.5, width)
    awidth = max(width, 1.5)

    if invert:
        points = [
            cx,
            y0 + awidth * 1.5,
            cx + awidth,
            y0,
            cx + awidth,
            y1 - awidth * 1.5,
            cx,
            y1,
            cx - awidth,
            y1 - awidth * 1.5,
            cx - awidth,
            y0,
        ]
    else:
        points = [
            cx,
            y0 - awidth * 1.5,
            cx + awidth,
            y0,
            cx + awidth,
            y1 + awidth * 1.5,
            cx,
            y1,
            cx - awidth,
            y1 + awidth * 1.5,
            cx - awidth,
            y0,
        ]
    return svg.Polygon(points=points, **kwargs)


def make_harrow(x0, x1, cy, width, style: ArrowStyle = ArrowStyle.BLOCK, **kwargs):
    width //= 2
    width = max(0.5, width)
    awidth = max(width, 1.5)

    return svg.Polygon(
        points=[
            x1,
            cy,
            x1 - awidth * 2,
            cy + awidth,
            x0,
            cy + awidth,
            x0 + awidth * 2,
            cy,
            x0,
            cy - awidth,
            x1 - awidth * 2,
            cy - awidth,
        ],
        **kwargs,
    )


def make_bendy_arrow(x0, y0, x1, y1, width, invert: bool = False, **kwargs):
    width //= 2
    width = max(0.5, width)
    awidth = max(width, 1.5)
    if x0 < x1:
        if invert:
            points = [
                x0 + awidth,
                y0,
                x0 + awidth,
                y1 - awidth,
                x1 - awidth * 2,
                y1 - awidth,
                x1,
                y1,
                x1 - awidth * 2,
                y1 + awidth,
                x0 - awidth,
                y1 + awidth,
                x0 - awidth,
                y0,
                x0,
                y0 + awidth * 2,
            ]
        else:
            points = [
                x0 + awidth,
                y0,
                x0 + awidth,
                y1 + awidth,
                x1 - awidth * 2,
                y1 + awidth,
                x1,
                y1,
                x1 - awidth * 2,
                y1 - awidth,
                x0 - awidth,
                y1 - awidth,
                x0 - awidth,
                y0,
                x0,
                y0 - awidth * 2,
            ]
    else:
        if invert:
            points = [
                x0 + awidth,
                y0,
                x0 + awidth,
                y1 + awidth,
                x1 + awidth * 2,
                y1 + awidth,
                x1,
                y1,
                x1 + awidth * 2,
                y1 - awidth,
                x0 - awidth,
                y1 - awidth,
                x0 - awidth,
                y0,
                x0,
                y0 + awidth * 2,
            ]
        else:
            points = [
                x0 + awidth,
                y0,
                x0 + awidth,
                y1 - awidth,
                x1 + awidth * 2,
                y1 - awidth,
                x1,
                y1,
                x1 + awidth * 2,
                y1 + awidth,
                x0 - awidth,
                y1 + awidth,
                x0 - awidth,
                y0,
                x0,
                y0 - awidth * 2,
            ]
    return svg.Polygon(points=points, **kwargs)


def make_diamond(x, y, w, h, **kwargs):
    return svg.Polygon(
        points=[x, y + h / 2, x + w / 2, y, x + w, y + h / 2, x + w / 2, y + h],
        **kwargs,
    )
