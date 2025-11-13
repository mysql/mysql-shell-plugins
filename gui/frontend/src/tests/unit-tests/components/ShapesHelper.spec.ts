/*
 * Copyright (c) 2020, 2025, Oracle and/or its affiliates.
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

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { ShapesHelper } from "../../../app-logic/MigrationSubApp/ShapesHelper.js";
import {
    ComputeShapeSpecsPicked, Shapes, shapesByTemplate,
    ShapesConfig
} from "../../../app-logic/MigrationSubApp/shapes.js";
import { existingShapes } from "./existingShapes.js";
import { ShapePlatformConfigOptions } from "../../../oci-typings/oci-core/lib/model/shape-platform-config-options.js";
import { ShapeSummary } from "../../../oci-typings/oci-mysql/lib/model/shape-summary.js";
import { ISelectOption } from "../../../app-logic/MigrationSubApp/FormGroup.js";

const platformConfigOptions = {
    type: ShapePlatformConfigOptions.Type.AmdVm,
};

const flexShape: ComputeShapeSpecsPicked = {
    shape: "VM.Standard.E5.Flex",
    memoryOptions: {
        "minInGBs": 1,
        "maxInGBs": 128,
    },
    ocpuOptions: {
        min: 1,
        max: 16,
    },
    networkingBandwidthInGbps: 1,
    platformConfigOptions,
};

const computeShapes: ComputeShapeSpecsPicked[] = [
    flexShape,
];

const template: ShapesConfig = {
    databaseShapes: {
        name: "MySQL.8",
    },
    heatwaveCluster: {
        shapeName: "HeatWave.32GB",
        clusterSize: 2,
    },
    computeShapes: {
        shape: "VM.Standard.E5.Flex",
        ocpus: 4,
        memoryInGBs: 48,
    },
};

// #TODO: make proper testing, not tautological.
describe("ShapesHelper", () => {
    let sh: ShapesHelper;

    beforeEach(() => {
        sh = new ShapesHelper(shapesByTemplate);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("ShapesHelper without validation", () => {
        it("getComputeShapesOptions", () => {
            for (const key in shapesByTemplate) {
                const config = shapesByTemplate[key];
                const { options, shapeExists } = sh.getComputeShapesOptions(config.computeShapes, existingShapes);

                expect(shapeExists).toBeTruthy();
                expect(options.length).toBeGreaterThan(1);
            }
        });

        it("getDbSystemOptions", () => {
            for (const key in shapesByTemplate) {
                const config = shapesByTemplate[key];
                const { options, shapeExists } = sh.getDbSystemOptions(config.databaseShapes.name, existingShapes);

                expect(shapeExists).toBeTruthy();
                expect(options.length).toBeGreaterThan(1);
            }
        });

        it("getHeatwaveShapesOptions", () => {
            for (const key in shapesByTemplate) {
                const config = shapesByTemplate[key];
                const { options, shapeExists } = sh.getHeatwaveShapesOptions(config.heatwaveCluster.shapeName,
                    existingShapes);

                expect(shapeExists).toBeTruthy();
                expect(options.length).toBeGreaterThan(1);
            }
        });

        it("no validation: VM.Standard.E5.Flex", () => {
            const helper = new ShapesHelper({
                template,
            });
            const result = helper.getComputeShapesOptions({}, { computeShapes });

            expect(result.shapeExists).toBeTruthy();
            expect(result.options).toHaveLength(1);
            expect(result.options[0]).toEqual({
                id: "VM.Standard.E5.Flex|4|48",
                label: "VM.Standard.E5.Flex / 4 OCPUs / 48GB RAM",
            });
        });
    });

    describe("ShapesHelper with validation", () => {
        describe("getComputeShapesOptions", () => {
            it("basic", () => {
                const { options, shapeExists } = sh.getComputeShapesOptions({
                    shape: "VM.Standard.E5.Flex",
                }, existingShapes, true);

                expect(shapeExists).toBeFalsy();
                expect(options.length).toBeGreaterThan(1);
            });

            it("validate VM.Standard.E5.Flex", () => {
                const helper = new ShapesHelper({
                    template,
                });
                const result = helper.getComputeShapesOptions({
                    shape: "VM.Standard.E5.Flex",
                    ocpus: 4,
                    memoryInGBs: 48,
                }, { computeShapes }, true);

                expect(result.shapeExists).toBeTruthy();
                expect(result.options).toHaveLength(1);
                expect(result.options[0]).toEqual({
                    id: "VM.Standard.E5.Flex|4|48",
                    label: "VM.Standard.E5.Flex / 4 OCPUs / 48GB RAM / 1 Gbps Networking",
                });
            });

            it("non intel or amd are filtered out", () => {
                const helper = new ShapesHelper({});

                const computeShapes: ComputeShapeSpecsPicked[] = [
                    {
                        shape: "VM.Standard.E2.1.Micro",
                        memoryInGBs: 1,
                        ocpus: 1,
                        platformConfigOptions,
                    },
                    {
                        shape: "VM.Standard.A1.Flex",
                        memoryInGBs: 6,
                        ocpus: 1,
                    },
                    {
                        shape: "VM.Standard.A2.Flex",
                        memoryInGBs: 6,
                        ocpus: 0.5,
                    },
                ];

                const result = helper.getComputeShapesOptions({
                    shape: "VM.Standard.A1.Flex",
                    ocpus: 1,
                    memoryInGBs: 6,
                }, { computeShapes }, true);

                expect(result.shapeExists).toBeFalsy();
                expect(result.options).toHaveLength(1);
            });

            it("finds without memory and ocpu range", () => {
                const helper = new ShapesHelper({});

                const computeShapes: ComputeShapeSpecsPicked[] = [
                    {
                        shape: "VM.Standard.E2.1.Micro",
                        memoryInGBs: 1,
                        ocpus: 1,
                        platformConfigOptions,
                    },
                ];

                const result = helper.getComputeShapesOptions({
                    shape: "VM.Standard.E2.1.Micro",
                    ocpus: 1,
                    memoryInGBs: 1,
                }, { computeShapes }, true);

                expect(result.shapeExists).toBeTruthy();
                expect(result.options).toHaveLength(1);
                expect(result.options[0]).toEqual({
                    id: "VM.Standard.E2.1.Micro|1|1",
                    label: "VM.Standard.E2.1.Micro / 1 OCPUs / 1GB RAM",
                });
            });

            it("does not find when shape is missing and displays resources with minimal values", () => {
                const helper = new ShapesHelper({});

                const shape: ComputeShapeSpecsPicked = {
                    shape: "VM.Standard.E5.Flex",
                    memoryOptions: {
                        "minInGBs": 4,
                        "maxInGBs": 128,
                    },
                    ocpuOptions: {
                        min: 2,
                        max: 16,
                    },
                    platformConfigOptions,
                };

                const computeShapes: ComputeShapeSpecsPicked[] = [
                    shape,
                ];

                const result = helper.getComputeShapesOptions({
                    shape: "VM.Standard.E2.1.Micro",
                    ocpus: 1,
                    memoryInGBs: 1,
                }, { computeShapes }, true);

                expect(result.shapeExists).toBeFalsy();
                expect(result.options).toHaveLength(1);
                expect(result.options[0]).toEqual({
                    id: "VM.Standard.E5.Flex|2|4",
                    label: "VM.Standard.E5.Flex / 2 OCPUs / 4GB RAM",
                });
            });

            it("does not find when shape is missing and displays resources with default values", () => {
                const helper = new ShapesHelper({});

                const shape: ComputeShapeSpecsPicked = {
                    shape: "VM.Standard.E5.Flex",
                    ocpus: 2,
                    memoryInGBs: 4,
                    networkingBandwidthInGbps: 1,
                    platformConfigOptions,
                };

                const computeShapes: ComputeShapeSpecsPicked[] = [
                    shape,
                ];

                const result = helper.getComputeShapesOptions({
                    shape: "VM.Standard.E2.1.Micro",
                    ocpus: 1,
                    memoryInGBs: 1,
                }, { computeShapes }, true);

                expect(result.shapeExists).toBeFalsy();
                expect(result.options).toHaveLength(1);
                expect(result.options[0]).toEqual({
                    id: "VM.Standard.E5.Flex|2|4",
                    label: "VM.Standard.E5.Flex / 2 OCPUs / 4GB RAM / 1 Gbps Networking",
                });
            });

            it("does not find without memory and ocpu range", () => {
                const helper = new ShapesHelper({});

                const computeShapes: ComputeShapeSpecsPicked[] = [
                    {
                        shape: "VM.Standard.E2.1.Micro",
                        memoryInGBs: 2,
                        ocpus: 2,
                        platformConfigOptions,
                    },
                ];

                const result = helper.getComputeShapesOptions({
                    shape: "VM.Standard.E2.1.Micro",
                    ocpus: 1,
                    memoryInGBs: 1,
                }, { computeShapes }, true);

                expect(result.shapeExists).toBeFalsy();
                expect(result.options).toHaveLength(1);
                expect(result.options[0]).toEqual({
                    id: "VM.Standard.E2.1.Micro|2|2",
                    label: "VM.Standard.E2.1.Micro / 2 OCPUs / 2GB RAM",
                });
            });

            it("validate others are shown with the same template ocpus and memory", () => {
                const helper = new ShapesHelper({});

                const computeShapes: ComputeShapeSpecsPicked[] = [
                    flexShape,
                    {
                        shape: "VM.Standard.E2.1",
                        memoryInGBs: 64,
                        memoryOptions: {
                            "minInGBs": 24,
                            "maxInGBs": 96,
                        },
                        ocpus: 3,
                        ocpuOptions: {
                            min: 2,
                            max: 6,
                        },
                        platformConfigOptions,
                    },
                ];

                const result = helper.getComputeShapesOptions({
                    shape: "VM.Standard.E5.Flex",
                    ocpus: 4,
                    memoryInGBs: 48,
                }, { computeShapes }, true);

                expect(result.shapeExists).toBeTruthy();
                expect(result.options).toHaveLength(2);
                expect(result.options[1]).toEqual({
                    id: "VM.Standard.E2.1|4|48",
                    label: "VM.Standard.E2.1 / 4 OCPUs / 48GB RAM",
                });
            });

            it("validate less capable compute shown as is", () => {
                const helper = new ShapesHelper({});

                const computeShapes: ComputeShapeSpecsPicked[] = [
                    {
                        shape: "VM.Standard.E5.Flex",
                        memoryInGBs: 1,
                        memoryOptions: {
                            "minInGBs": 1,
                            "maxInGBs": 24,
                        },
                        ocpus: 1,
                        ocpuOptions: {
                            min: 1,
                            max: 2,
                        },
                        platformConfigOptions,
                    },
                ];

                const result = helper.getComputeShapesOptions({
                    shape: "VM.Standard.E5.Flex",
                    ocpus: 4,
                    memoryInGBs: 48,
                }, { computeShapes }, true);

                expect(result.shapeExists).toBeFalsy();
                expect(result.options).toHaveLength(1);
                expect(result.options[0]).toEqual({
                    id: "VM.Standard.E5.Flex|1|1",
                    label: "VM.Standard.E5.Flex / 1 OCPUs / 1GB RAM",
                });
            });

            it("validate more capable compute shown as is", () => {
                const helper = new ShapesHelper({});

                const computeShapes: ComputeShapeSpecsPicked[] = [
                    {
                        shape: "VM.Standard.E5.Flex",
                        memoryInGBs: 64,
                        memoryOptions: {
                            "minInGBs": 64,
                            "maxInGBs": 128,
                        },
                        ocpus: 6,
                        ocpuOptions: {
                            min: 6,
                            max: 12,
                        },
                        platformConfigOptions,
                    },
                ];

                const result = helper.getComputeShapesOptions({
                    shape: "VM.Standard.E5.Flex",
                    ocpus: 4,
                    memoryInGBs: 48,
                }, { computeShapes }, true);

                expect(result.shapeExists).toBeFalsy();
                expect(result.options).toHaveLength(1);
                expect(result.options[0]).toEqual({
                    id: "VM.Standard.E5.Flex|6|64",
                    label: "VM.Standard.E5.Flex / 6 OCPUs / 64GB RAM",
                });
            });
        });

        it("getDbSystemOptions", () => {
            const dbSystemShapes: ShapeSummary[] = [
                { name: "VM.Standard.E2.1", cpuCoreCount: 1, memorySizeInGBs: 8 },
                { name: "MySQL.VM.Standard.E3.1.8GB", cpuCoreCount: 1, memorySizeInGBs: 8 },
                { name: "MySQL.VM.Optimized3.8.128GB", cpuCoreCount: 8, memorySizeInGBs: 128 },
                { name: "MySQL.VM.Optimized3.8.128GB", cpuCoreCount: 8, memorySizeInGBs: 128 },
                { name: "MySQL.Free", cpuCoreCount: 2, memorySizeInGBs: 16 },
                { name: "MySQL.2", cpuCoreCount: 1, memorySizeInGBs: 16 },
                { name: "MySQL.16", cpuCoreCount: 8, memorySizeInGBs: 128 },
                { name: "MySQL.256", cpuCoreCount: 128, memorySizeInGBs: 1024 },
            ];

            const { options, shapeExists } = sh.getDbSystemOptions("MySQL.HeatWave.BM.Standard", { dbSystemShapes },
                true);

            expect(shapeExists).toBeFalsy();

            const expected: ISelectOption[] = [
                { id: "MySQL.Free", label: "MySQL.Free / 2 ECPUs / 16GB RAM" },
                { id: "MySQL.2", label: "MySQL.2 / 2 ECPUs / 16GB RAM" },
                { id: "MySQL.16", label: "MySQL.16 / 16 ECPUs / 128GB RAM" },
                { id: "MySQL.256", label: "MySQL.256 / 256 ECPUs / 1024GB RAM" },
            ];
            expect(options).toEqual(expected);
        });

        it("getHeatwaveShapesOptions", () => {
            const heatwaveClusterShapes: Shapes["heatwaveClusterShapes"] = [
                {
                    name: "HeatWave.Free",
                    memorySizeInGBs: 16,
                    cpuCoreCount: 1,
                },
                {
                    name: "HeatWave.32GB",
                    memorySizeInGBs: 32,
                    cpuCoreCount: 1,
                },
                {
                    name: "HeatWave.512GB",
                    memorySizeInGBs: 512,
                    cpuCoreCount: 16,
                },
                {
                    name: "MySQL.HeatWave.VM.Standard.E3",
                    memorySizeInGBs: 512,
                    cpuCoreCount: 16,
                },
            ];

            const { options, shapeExists } = sh.getHeatwaveShapesOptions("MySQL.HeatWave.VM.Standard.E3",
                { heatwaveClusterShapes }, true);

            expect(shapeExists).toBeFalsy();
            expect(options).toHaveLength(4);
            expect(options[0].id).toBe("0");
            expect(options[0].label).toBe("Heatwave OFF");
        });
    });
});
