/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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

import { IConsoleWorkerEnvironment, ScriptingApi, PieGraphLayout } from "../console.worker-types";

export class PieGraphProxy {
    public static env?: IConsoleWorkerEnvironment;

    public static render(data: IDataRecord[], layout?: PieGraphLayout, keys?: { name: string; value: string }): void {
        if (PieGraphProxy.env) {
            const pieData = data.map((value) => {
                if (keys) {
                    return { name: value[keys.name], value: value[keys.value] } as IPieDatum;
                }

                if (value.name !== undefined && value.value !== undefined) {
                    return { name: value.name, value: value.value } as IPieDatum;
                }

                if (Object.values(value).length > 2) {
                    throw new Error("PieGraph: if there are more than 2 fields in a result entry, " +
                        "a field mapping is required ");
                }

                const values = Object.values(value);
                if (values.length > 1) {
                    return { name: values[0], value: values[1] } as IPieDatum;
                }

                throw new Error("PieGraph.render: Not enough parameters");
            });

            let radius: [number, number];

            switch (layout) {
                case PieGraphLayout.LargeDonut: {
                    radius = [100, 200];

                    break;
                }

                case PieGraphLayout.MediumDonut: {
                    radius = [80, 120];

                    break;
                }

                case PieGraphLayout.LargePie: {
                    radius = [0, 200];

                    break;
                }

                default: {
                    radius = [0, 120];
                }
            }

            const options: IGraphOptions = {
                series: [
                    {
                        type: "pie",
                        data: pieData,
                        radius,
                    },
                ],
            };

            PieGraphProxy.env.worker.postMessage({
                taskId: PieGraphProxy.env.taskId,
                data: {
                    api: ScriptingApi.Graph,
                    options,
                    contextId: PieGraphProxy.env.contextId,
                    final: true,
                },
            });
        }

    }
}
