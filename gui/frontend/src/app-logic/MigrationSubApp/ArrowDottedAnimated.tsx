/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have either included with
 * the program or referenced in the documentation.
 *
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { FunctionalComponent } from "preact";
import { useId } from "preact/hooks";

interface ArrowLineProps {
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    color?: string;
    strokeWidth?: number;
    dotLength?: number;
    gapLength?: number;
    durationMs?: number;
    roundedDots?: boolean;
    arrowSize?: number;
    animateDirection?: "forward" | "backward";
    variant?: "dotted" | "solid";
    animated?: boolean;
    curve?: number; // NEW: curve offset in px
    className?: string;
    style?: preact.JSX.CSSProperties;
}

export const ArrowDottedAnimated: FunctionalComponent<ArrowLineProps> = ({
    x1 = 10,
    y1 = 10,
    x2 = 290,
    y2 = 90,
    color = "#0b74ff",
    strokeWidth = 3,
    dotLength = 6,
    gapLength = 10,
    durationMs = 700,
    roundedDots = true,
    arrowSize = 8,
    animateDirection = "forward",
    variant = "dotted",
    animated = true,
    curve = 0,
    className,
    style,
}) => {
    const id = useId().replace(/:/g, "_");
    const pattern = dotLength + gapLength;
    const offsetTarget = animateDirection === "backward" ? -pattern : pattern;
    const animationName = `dashShift_${id}`;

    const strokeDasharray =
        variant === "dotted" ? `${dotLength} ${gapLength}` : undefined;

    const lineStyle: preact.JSX.CSSProperties = {
        ...(animated && variant === "dotted"
            ? { animation: `${animationName} ${durationMs}ms linear infinite` }
            : {}),
    };

    // Calculate control point for curve
    let d: string;
    if (curve === 0) {
        // straight line
        d = `M ${x1},${y1} L ${x2},${y2}`;
    } else {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;

        // Vector perpendicular to line
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;

        // Control point offset by "curve" in px
        const cx = mx + nx * curve;
        const cy = my + ny * curve;

        d = `M ${x1},${y1} Q ${cx},${cy} ${x2},${y2}`;
    }

    return (
        <svg
            width={Math.max(x1, x2) + 40}
            height={Math.max(y1, y2) + 40}
            viewBox={`0 0 ${Math.max(x1, x2) + 40} ${Math.max(y1, y2) + 40}`}
            className={className}
            style={style}
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <marker
                    id={`arrow_${id}`}
                    markerWidth={arrowSize}
                    markerHeight={arrowSize}
                    refX={arrowSize * 0.6}
                    refY={arrowSize * 0.5}
                    orient="auto-start-reverse"
                    markerUnits="strokeWidth"
                >
                    <path
                        d={`M0,0 L${arrowSize},${arrowSize * 0.5} L0,${arrowSize} Z`}
                        fill={color}
                    />
                </marker>

                {animated && variant === "dotted" && (
                    <style>
                        {`
              @keyframes ${animationName} {
                0%   { stroke-dashoffset: 0; }
                100% { stroke-dashoffset: ${offsetTarget}; }
              }
            `}
                    </style>
                )}
            </defs>

            <path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap={roundedDots && variant === "dotted" ? "round" : "butt"}
                strokeDasharray={strokeDasharray}
                markerEnd={`url(#arrow_${id})`}
                style={lineStyle}
            />
        </svg>
    );
};
