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

declare interface IResultSetRow {
    [key: string]: unknown;
}

declare type ResultSetRows = IResultSetRow[];


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
declare function runSql(code: string, callback?: (res: IResultSetRow[]) => void, params?: unknown): void;


declare interface IPieGraphDataPoint {
    /** The label to show for this data point. If no label is given then the value is printed instead. */
    label?: string;

    value: number;

    /**
     * An optional color to use for this pie piece (specified as HTML color).
     *  If not given then a default one is used instead.
     */
    color?: string;
}

/**
 * Defines the configuration of a PieChart and (optionally) initial data.
 */
declare interface IPieGraphLayout {
    /** The width of the root svg group element. */
    width?: number;

    /** The height of the root svg group element. */
    height?: number;

    /** The inner radius of the pie chart. Values > 0 create a donut graphic. */
    innerRadius?: number;

    /** The outer radius of the pie chart. Determines the overall size and must be > the inner radius. */
    outerRadius?: number;

    /** The horizontal position where to place the center of the pie chart. */
    centerX?: number;

    /** The vertical position where to place the center of the pie chart. */
    centerY?: number;
}

declare interface IPieLayoutData {
    mediumPie: IPieGraphLayout;
    mediumDonut: IPieGraphLayout;
    largePie: IPieGraphLayout;
    largeDonut: IPieGraphLayout;
}

declare interface IPieDemoData {
    budget: IPieGraphDataPoint[];
    spending: IPieGraphDataPoint[];
}

/**
 * This class creates a Pie chart graphic.
 */
declare class PieGraph {
    public static readonly layout: IPieLayoutData;
    public static readonly demoData: IPieDemoData;

    /**
     * Creates a new pie graphic using the given data.
     *
     * @param data Specify values that configure the graph.
     */
    public constructor(layout: IPieGraphLayout, data: IPieGraphDataPoint[] | IResultSetRow[]);

    public addDataPoints(data: IPieGraphDataPoint[]): void;
}
