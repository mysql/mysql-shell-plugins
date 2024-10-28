/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

/* eslint-disable max-classes-per-file */

declare interface IRequestState {
    type: string;
    msg: string;
}

declare interface IResultSetData {
    requestId: string;
    requestState: IRequestState;

    executionTime?: number;
    rows?: unknown[];
    columns?: string[];
    totalRowCount?: number;
}

declare interface IDataRecord {
    [key: string]: unknown;
}

declare type DataRecords = IDataRecord[];


/**
 * Adds the value (converted to a string) to the current block output or creates new output if nothing was shown so far.
 *
 * @param value The value to print.
 */
declare function print(value: unknown): void;

/**
 * Executes a query and calls a callback for each answer from the server.
 *
 * @param code The query to run.
 * @param callback A function to call on results.
 * @param params Optional parameters for the query.
 */
declare function runSqlIterative(code: string, callback?: (res: IResultSetData) => void, params?: unknown): void;

/**
 * Executes a query and calls a callback with the full reply from the server.
 *
 * @param code The query to run.
 * @param callback A function to call on results.
 * @param params Optional parameters for the query.
 */
declare function runSqlWithCallback(code: string, callback?: (res: IDataRecord[]) => void, params?: unknown): void;

/**
 * Executes a query and returns the answer from the server in a promise that can be awaited.
 *
 * @param code The query to run.
 * @param params Optional parameters for the query.
 * @returns A promise
 */
declare async function runSql(code: string, params?: unknown): Promise<IDataRecord[]>;


// ---------- Graph Structures ----------

declare interface ITooltipOptions {
    /** Generates the tooltip for the value at the given index. Return an empty string to hide the tooltip. */
    format: (datum: IXYDatum | IPieDatum, index?: number, data?: Array<IXYDatum | IPieDatum>) => string;

    /** Pins the tooltip to this position, if given (default: tooltip moves with the mouse). */
    position?: { left: number; top: number; };
}

declare interface IBaseGraphEntry {
    /** The series type. */
    type: string;

    name?: string;

    /**
     * A unique ID to identify the specific graph.
     * Note: this is also used as an HTML ID, so it must start with a letter to be valid!
     */
    id: string;

    /** A local color palette for a single series. */
    colors?: string[];

    /** Specifies position and size of the single graph entry, relative to the owning viewport. */
    transformation?: {
        /** X position in CSS units (default 50% for pie charts, otherwise 0). */
        x: number | string;

        /** Y position in CSS units (default 50%, for pie charts, otherwise 0). */
        y: number | string;

        width: number;
        height: number;
    };

    /** Tooltip formatting options. */
    tooltip?: ITooltipOptions;

    /** Animation options. */
    animation?: {
        /** Whether to animate data changes. */
        disabled?: boolean;

        /** The duration of animations in milliseconds. */
        duration?: number;
    };
}

declare interface IPieDatum {
    /** Title for a pie piece and id for the mapping between the datum and the legend. */
    name?: string;
    value: number;
}

declare interface IPieGraphConfiguration extends IBaseGraphEntry {
    type: "pie";

    /** Inner and outer radius in CSS units. If not given the parent determines the size. */
    radius?: [number, number];

    /** The angle is specified in radians, with 0 at -y (12 o’clock) and positive angles proceeding clockwise. */
    startAngle?: number;

    /** The angle is specified in radians, with 0 at -y (12 o’clock) and positive angles proceeding clockwise. */
    endAngle?: number;

    /**
     * If the corner radius is greater than zero, the corners of the arc are rounded using circles of the given radius.
     * For a circular sector, the two outer corners are rounded; for an annular sector, all four corners are rounded.
     */
    borderRadius?: number;

    borderColor?: string;
    borderWidth?: number;

    /**
     * Specifies a padding sector between pie arcs.
     * The recommended minimum inner radius when using padding is outerRadius * padAngle / sin(θ), where θ is
     * the angular span of the smallest arc before padding.
     */
    padAngle?: number;

    /**
     * The pad radius determines the fixed linear distance separating adjacent arcs, defined as padRadius * padAngle.
     */
    padRadius?: number;

    /** When true then value labels with lines are rendered (default: true). */
    showValues?: boolean;

    /** A CSS value that specifies an angle around which to rotate the graph. */
    rotation?: string;

    data?: IPieDatum[];
}

/** A single point in a two-dimensional graph. */
declare interface IXYDatum {
    /** The value on the x axis. */
    xValue: number | Date;

    /** The associated y value. Can be undefined to defined a gap. */
    yValue?: number;

    /** A value to assign a datum to a group of values. Use this to define XY graphs with an additional dimension. */
    group?: string;
}

declare type DatumDataType = string | number | Date;

declare type ITabularGraphRow = DatumDataType[];
declare type ITabularGraphData = ITabularGraphRow[];

declare interface IJsonGraphEntry {
    [key: string]: DatumDataType;
}

declare type IJsonGraphData = IJsonGraphEntry[];

/**
 * Graph data consist of one of two formats:
 *
 * Tabular data uses the first entire row and the first column (the first value in each row) as categories of the data
 * (depending on the graph layout).
 *
 * JSON data uses keys for categories, which nonetheless follow a similar pattern as tabular data.
 */
declare type IGraphData = ITabularGraphData | IJsonGraphData;

/**
 * Determines the look of the generated curve in a line graph.
 */
declare type LineGraphCurve =
    /** Cubic basis spline curve. */
    "Basis"

    /** Straightened cubic basis spline curve. */
    | "Bundle"

    /** Polyline curve. */
    | "Linear"

    /** A cubic spline. */
    | "Natural"

    /** Stepwise curve (midpoint). */
    | "Step"

    /** Stepwise curve (start x). */
    | "StepBefore"

    /** Stepwise curve (end x). */
    | "StepAfter"
    ;


declare interface ILineGraphConfiguration extends IBaseGraphEntry {
    type: "line";

    /** The x axis value title for a given datum. */
    xTitle?: (datum: IXYDatum, index: number, data: IXYDatum[]) => string;

    /** The top margin, in pixels (default: 20). */
    marginTop?: number;

    /** The right margin, in pixels (default: 30). */
    marginRight?: number;

    /** The bottom margin, in pixels (default: 30). */
    marginBottom?: number;

    /** The left margin, in pixels (default: 40). */
    marginLeft?: number;

    /** Width of the line in pixels (default: 1.5). */
    strokeWidth?: number;

    /** The join type of line segments (default: "round"). */
    strokeLinejoin?: string;

    /** The line cap of line segments (defaultL "round"). */
    strokeLinecap?: string;

    /** Minimum and maximum X value. */
    xDomain?: [number, number] | [Date, Date];

    /** Number of x axis tick marks (default: width / 80) */
    xTickCount?: number;

    /** Minimum and maximum Y value. */
    yDomain?: [number, number];

    /** Number of y axis tick marks (default: height / 40) */
    yTickCount?: number;

    /** A format specifier string for the y-axis, */
    yFormat?: string | ((value: d3.NumberValue) => string);

    /** A label for the y-axis. */
    yLabel?: string;

    /** The type of curve to draw (default: Basis) */
    curve?: LineGraphCurve;

    data?: IXYDatum[];
}

declare interface IBarGraphConfiguration extends IBaseGraphEntry {
    type: "bar";

    /** The x axis tooltip for a given datum. */
    xTitle?: (datum: DatumDataType, index: number, data: DatumDataType[]) => string;

    /** The top margin, in pixels (default: 20). */
    marginTop?: number;

    /** The right margin, in pixels (default: 0). */
    marginRight?: number;

    /** The bottom margin, in pixels (default: 30). */
    marginBottom?: number;

    /** The left margin, in pixels (default: 0). */
    marginLeft?: number;

    /** Amount of x-space between bars (default: 0.1). */
    xPadding?: number;

    /** Minimum and maximum X value. */
    xDomain?: [DatumDataType, DatumDataType];

    /** Minimum and maximum Y value. */
    yDomain?: [DatumDataType, DatumDataType];

    /** A format specifier string for the y-axis, */
    yFormat?: string;

    /** A label for the y-axis. */
    yLabel?: string;

    data?: IGraphData;
}

/** Description of an entry in the graph. */
declare type IGraphConfiguration = IPieGraphConfiguration | ILineGraphConfiguration | IBarGraphConfiguration;

/** Alignment of content within its parent container. */
declare type GraphAlignment = "Start" | "Middle" | "End";

/** Description of a caption in a graph (titles, legend labels, data labels etc.). */
declare interface IGraphLabel {
    text: string;
    horizontalAlignment?: GraphAlignment;
    verticalAlignment?: GraphAlignment;
}

/** The top level interface for a graph host, which can contain multiple graphs. */
declare interface IGraphOptions {
    /** The graph's main title. */
    title?: IGraphLabel;

    /** The list of entries in the graph. */
    series?: IGraphConfiguration[];

    /** The global color palette. */
    colors?: string[];

    viewport?: { left: number; top: number; width: number; height: number; };
}

/** The entry point for general graph rendering. */
declare class Graph {
    public static render(options: IGraphOptions): void;
}

declare enum PieGraphLayout {
    Donut,
    ThickDonut,
    ThinDonut,
    Pie,
}

/** A simplified graph class specifically for Pie graphs. */
declare class PieGraph {
    public static render(data: IDataRecord[], layout?: PieGraphLayout, keys?: { name: string; value: string; }): void;
}

/** Define the global object that is persisted between code blocks. */
declare interface IDictionary { [key: string]: unknown; }

declare let $: IDictionary;
