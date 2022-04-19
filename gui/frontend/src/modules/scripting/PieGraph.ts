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

import { PrivateWorker, ScriptingApi } from "./console.worker-types";
import {
    IPieGraphLayout, IPieLayoutData, IPieGraphDataPoint, IPieDemoData, IResultSetRow,
} from "../../components/ResultView/graphs/PieGraphImpl";

// eslint-disable-next-line no-restricted-globals
const ctx: PrivateWorker = self as unknown as PrivateWorker;

// This is the intermediate Pie graph class, which can be used by the user in JS/TS editors.
// It forwards all Pie graph calls to the PieGraphImpl component in the application.
export class PieGraphProxy {
    public static readonly layout: IPieLayoutData = {
        mediumPie: {
            width: 700,
            height: 300,
            innerRadius: 0,
            outerRadius: 120,
            centerX: 300,
            centerY: 150,
        },
        mediumDonut: {
            width: 700,
            height: 240,
            innerRadius: 60,
            outerRadius: 100,
            centerX: 350,
            centerY: 120,
        },
        largePie: {
            width: 700,
            height: 500,
            innerRadius: 0,
            outerRadius: 150,
            centerX: 500,
            centerY: 250,
        },
        largeDonut: {
            width: 700,
            height: 450,
            innerRadius: 130,
            outerRadius: 200,
            centerX: 500,
            centerY: 250,
        },

    };

    public static readonly demoData: IPieDemoData = {
        budget: [
            { label: "Third Party Logistics and Packaging", value: 29.2, color: "#004a83" },
            { label: "General Retail and Wholesale", value: 20.8, color: "#3c74a5" },
            { label: "Manufacturing", value: 16.8, color: "#4281b6" },
            { label: "E-Commerce", value: 10.7, color: "#4789c3" },
            { label: "Food and Beverage", value: 9.5, color: "#4b93ce" },
            { label: "Constructions/Improvements/Repair", value: 4.5, color: "#65a1d7" },
            { label: "Furniture and Appliances", value: 4.1, color: "#84b0dd" },
            { label: "Motor Vehicles/Tires/Parts", value: 3.7, color: "#9cbee0" },
        ] as IPieGraphDataPoint[],
        spending: [
            { label: "Federal Contracts & Grants", value: 19, color: "#5588b7" },
            { label: "State Support", value: 27, color: "#ba5b55" },
            { label: "Tuition & Fees", value: 18, color: "#9bb260" },
            { label: "Educational Activities & Auxiliaries", value: 11, color: "#866ea0" },
            { label: "Other C&Gs", value: 11, color: "#51a7be" },
            { label: "Private Gifts", value: 8, color: "#e4964e" },
            { label: "Other", value: 6, color: "#a2b9d9" },
        ] as IPieGraphDataPoint[],
    };

    protected contextId: string | undefined;
    protected taskId: number | undefined;

    public constructor(layout: IPieGraphLayout, data?: IPieGraphDataPoint[] | IResultSetRow[]) {
        // Store the current context id so that we always send additional data points to the same output area,
        // even if that is triggered asynchronously.
        this.contextId = ctx.currentContext;
        this.taskId = ctx.currentTaskId;

        ctx.postMessage({
            taskId: this.taskId,
            data: {
                api: ScriptingApi.PieGraphCreate,
                graphLayout: layout,
                graphData: data,
                contextId: this.contextId,
                final: true,
            },
        });
    }

    public addDataPoints(data: IPieGraphDataPoint[]): void {
        ctx.postMessage({
            taskId: this.taskId,
            data: {
                api: ScriptingApi.PieGraphAddPoints,
                graphData: data,
                contextId: this.contextId,
            },
        });
    }

}
