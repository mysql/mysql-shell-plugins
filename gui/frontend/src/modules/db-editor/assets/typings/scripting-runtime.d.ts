/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with MySQL.
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
 * @param params Optional parameters for the query.
 * @param callback A function to call on results.
 */
declare function runSqlIterative(code: string, callback?: (res: IResultSetData) => void, params?: unknown): void;

/**
 * Executes a query and calls a callback for each answer from the server.
 *
 * @param code The query to run.
 * @param params Optional parameters for the query.
 * @param callback A function to call on results.
 */
declare function runSql(code: string, callback?: (res: IDataRecord[]) => void, params?: unknown): void;

declare interface IBaseGraphEntry {
    /** The series type. */
    type: string;

    name?: string;

    /** The ID used for the graph entry top level node. */
    id?: string;

    /** A local color palette for a single series. */
    colors?: string[];
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

    data?: IPieDatum[];
}

declare interface IXYDatum {
    xValue: number | Date;
    yValue: number;
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

declare interface ILineGraphConfiguration extends IBaseGraphEntry {
    type: "line";

    // The x axis value title for a given datum.
    xTitle?: (datum: IXYDatum, index: number, data: IXYDatum[]) => string;

    // The top margin, in pixels (default: 20).
    marginTop?: number;

    // The right margin, in pixels (default: 30).
    marginRight?: number;

    // The bottom margin, in pixels (default: 30).
    marginBottom?: number;

    // The left margin, in pixels (default: 40).
    marginLeft?: number;

    // Minimum and maximum X value.
    xDomain?: [number, number] | [Date, Date];

    // Minimum and maximum Y value.
    yDomain?: [number, number];

    // CSS Line color (default: "currentColor").
    strokeColor?: string;

    // Width of the line in pixels (default: 1.5).
    strokeWidth?: number;

    // The join type of line segments (default: "round").
    strokeLinejoin?: string;

    // The line cap of line segments (defaultL "round").
    strokeLinecap?: string;

    // A format specifier string for the y-axis,
    yFormat?: string;

    // A label for the y-axis.
    yLabel?: string;

    data?: IXYDatum[];
}

declare interface IBarGraphConfiguration extends IBaseGraphEntry {
    type: "bar";

    // The x axis tooltip for a given datum.
    xTitle?: (datum: DatumDataType, index: number, data: DatumDataType[]) => string;

    // The top margin, in pixels (default: 20).
    marginTop?: number;

    // The right margin, in pixels (default: 30).
    marginRight?: number;

    // The bottom margin, in pixels (default: 30).
    marginBottom?: number;

    // The left margin, in pixels (default: 40).
    marginLeft?: number;

    // Amount of x-space between bars (default: 0.1).
    xPadding?: number;

    // Minimum and maximum X value.
    xDomain?: [DatumDataType, DatumDataType];

    // Minimum and maximum Y value.
    yDomain?: [DatumDataType, DatumDataType];

    // A format specifier string for the y-axis,
    yFormat?: string;

    // A label for the y-axis.
    yLabel?: string;

    data?: IGraphData;
}

/** Description of an entry in the graph. */
declare type IGraphConfiguration = IPieGraphConfiguration | ILineGraphConfiguration | IBarGraphConfiguration;

/** Alignment of content within its parent container. */
declare enum IGraphAlignment {
    Start,
    Middle,
    End,
}

/** Description of a caption in a graph (titles, legend labels, data labels etc.). */
declare interface IGraphLabel {
    text: string;
    horizontalAlignment?: IGraphAlignment;
    verticalAlignment?: IGraphAlignment;
}

/** The top level interface for a graph host, which can contain multiple graphs. */
declare interface IGraphOptions {
    /** The graph's main title. */
    title?: IGraphLabel;

    /** The list of entries in the graph. */
    series?: IGraphConfiguration[];

    /** The global color palette. */
    colors?: string[];
}

/** The entry point for general graph rendering. */
declare class Graph {
    public static render(options: IGraphOptions): void;
}

declare enum PieGraphLayout {
    MediumPie,
    MediumDonut,
    LargePie,
    LargeDonut,
}

/** A simplified graph class specifically for Pie graphs. */
declare class PieGraph {
    public static render(data: IDataRecord[], layout?: PieGraphLayout, keys?: { name: string; value: string }): void;
}
