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

import { ShapeSummary } from "../../oci-typings/oci-mysql/lib/model/shape-summary.js";
import { FormGroupValues, ISelectOption } from "./FormGroup.js";
import {
    ComputeShapeInfo, ComputeShapeSpecsPicked, ConfigTemplate, customTemplateId, PreConfiguredShapes, Shapes,
    ShapesConfig
} from "./shapes.js";

interface ComputeShape {
    shape: string,
    ocpus?: number,
    memoryInGBs?: number,
    networkingBandwidthInGbps?: number,
}

export interface NotFoundShapesFor {
    type: "dbSystem" | "compute" | "heatWave";
    text: string;
}

const dbsRegex = /MySQL.(Free|\d+)/;

export class ShapesHelper {
    public constructor(public readonly shapesByTemplate: PreConfiguredShapes) { }

    public updateTemplate(dbShape: string | undefined, computeShapeInfo: ComputeShapeInfo,
        heatWaveClusterInfo: Partial<ShapesConfig["heatwaveCluster"]>, template = customTemplateId) {
        if (dbShape) {
            this.shapesByTemplate[template].databaseShapes.name = dbShape;
        }

        const { shape, ocpus, memoryInGBs } = computeShapeInfo;
        if (shape && ocpus && memoryInGBs) {
            this.shapesByTemplate[template].computeShapes = { shape, ocpus, memoryInGBs };
        }

        const { shapeName, clusterSize } = heatWaveClusterInfo;
        if (shapeName && clusterSize !== undefined) {
            this.shapesByTemplate[template].heatwaveCluster = { shapeName, clusterSize };
        }
    }

    public getShapeInfoForTemplate(configTemplate: ConfigTemplate, existingShapes?: Shapes, validate?: boolean) {
        // const isProduction = this.shapesByTemplate[configTemplate].isProduction;
        const dbShapeInfo = this.shapesByTemplate[configTemplate].databaseShapes;
        const heatwaveShapeInfo = this.shapesByTemplate[configTemplate].heatwaveCluster;
        const { shapeName: heatWaveShapeName, clusterSize } = heatwaveShapeInfo;
        const { enableBackup, autoExpandStorage } = dbShapeInfo;
        const computeShapeInfo = this.shapesByTemplate[configTemplate].computeShapes;

        let formGroupValues: FormGroupValues = {
            "database.shapeName": dbShapeInfo.name,
            "database.enableHA": dbShapeInfo.enableHA ? "database.enableHA" : "",
            "database.enableHeatWave": "database.enableHeatWave",
            "database.heatWaveShapeName": heatWaveShapeName,
            "database.heatWaveClusterSize": `${clusterSize}`,
            // "database.isProduction": isProduction ? "1" : "0",
            "database.enableBackup": enableBackup ? "1" : "0",
            "database.autoExpandStorage": autoExpandStorage ? "1" : "0",
            "hosting.shapeName": computeShapeInfo.shape,
            "hosting.cpuCount": `${computeShapeInfo.ocpus}`,
            "hosting.memorySizeGB": `${computeShapeInfo.memoryInGBs}`,
        };
        if (!validate) {
            return { formGroupValues };
        }

        const foundDatabaseShape = this.findDbSystemShape(dbShapeInfo.name, existingShapes?.dbSystemShapes);

        const foundHeatwaveShape = this.findHeatWaveShape(heatWaveShapeName, existingShapes?.heatwaveClusterShapes);

        const foundComputeShape = this.findComputeShape(computeShapeInfo, existingShapes?.computeShapes);

        // console.log({ foundDatabaseShape, foundHeatwaveShape, foundComputeShape });

        if (foundDatabaseShape && foundHeatwaveShape && foundComputeShape) {
            return { formGroupValues };
        }

        // formGroupValues["hosting.configTemplate"] = customTemplateId;

        const notFoundShapesFor: NotFoundShapesFor[] = [];
        if (!foundDatabaseShape) {
            notFoundShapesFor.push({ type: "dbSystem", text: `DB System (${dbShapeInfo.name})` });
            formGroupValues = {
                ...formGroupValues,
                "database.shapeName": "",
                "database.enableHA": "",
            };
        }
        if (!foundHeatwaveShape) {
            notFoundShapesFor.push({ type: "heatWave", text: heatWaveShapeName });
            formGroupValues = {
                ...formGroupValues,
                "database.enableHeatWave": "",
                "database.heatWaveShapeName": "0",
                "database.heatWaveClusterSize": "",
            };
        }
        if (!foundComputeShape) {
            notFoundShapesFor.push({ type: "compute", text: `Compute (${computeShapeInfo.shape})` });
            formGroupValues = {
                ...formGroupValues,
                "hosting.shapeName": "",
                "hosting.cpuCount": "",
                "hosting.memorySizeGB": "",
            };
        }

        return { formGroupValues, notFoundShapesFor };
    }

    public getDbSystemOptions(shape?: string, existingShapes?: Shapes, validate?: boolean) {
        if (!validate) {
            const options = new Map<string, ISelectOption>();
            for (const configTemplate in this.shapesByTemplate) {
                const shapesConfig = this.shapesByTemplate[configTemplate];
                const { name } = shapesConfig.databaseShapes;

                options.set(name, {
                    id: name,
                    label: name,
                });
            }

            return {
                shapeExists: true,
                options: Array.from(options.values()),
            };
        }

        if (!existingShapes?.dbSystemShapes?.length) {
            return { shapeExists: false, options: [] };
        }

        const filteredShapes = existingShapes.dbSystemShapes.filter(this.dbSystemsFilter).map(this.changeDbSystemsCpus);

        return {
            shapeExists: !!this.findDbSystemShape(shape, filteredShapes),
            options: this.generateDbSystemOptions(filteredShapes),
        };
    }

    public getHeatwaveShapesOptions(shape?: string, existingShapes?: Shapes, validate?: boolean) {
        const options = new Map<string, string>([
            ["0", "Heatwave OFF"],
        ]);
        if (!validate) {
            for (const configTemplate in this.shapesByTemplate) {
                const shapesConfig = this.shapesByTemplate[configTemplate];
                const { shapeName } = shapesConfig.heatwaveCluster;

                options.set(shapeName, shapeName);
            }

            return {
                shapeExists: true,
                options: this.generateHeatwaveShapeOptions(options),
            };
        }

        if (!existingShapes?.heatwaveClusterShapes?.length) {
            return {
                options: this.generateHeatwaveShapeOptions(options),
            };
        }

        const filteredShapes = existingShapes.heatwaveClusterShapes.filter(this.heatWaveShapeFilter);

        filteredShapes.forEach(({ name }) => {
            options.set(name, name);
        });

        return {
            shapeExists: !!this.findHeatWaveShape(shape, filteredShapes),
            options: this.generateHeatwaveShapeOptions(options),
        };
    }

    public getComputeShapesId(computeShapeInfo: ComputeShapeInfo) {
        const { shape, ocpus, memoryInGBs } = computeShapeInfo;
        if (!shape) {
            return "";
        }

        let ocpusString = "|";
        if (ocpus) {
            ocpusString += `${ocpus}`;
        }
        let memoryString = "|";
        if (memoryInGBs) {
            memoryString += `${memoryInGBs}`;
        }

        return `${shape}${ocpusString}${memoryString}`;
    }

    public getComputeShapesOptions(computeShapeInfo: ComputeShapeInfo, existingShapes?: Shapes, validate?: boolean) {
        if (!validate) {
            const options = new Map<string, ComputeShape>();
            for (const configTemplate in this.shapesByTemplate) {
                const shapesConfig = this.shapesByTemplate[configTemplate];

                const id = this.getComputeShapesId(shapesConfig.computeShapes);

                options.set(id, {
                    shape: shapesConfig.computeShapes.shape,
                    ocpus: shapesConfig.computeShapes.ocpus,
                    memoryInGBs: shapesConfig.computeShapes.memoryInGBs,
                });
            }

            return {
                shapeExists: true,
                options: this.generateComputeShapesOptions(Array.from(options.values())),
            };
        }

        if (!existingShapes?.computeShapes?.length) {
            return { shapeExists: false, options: [] };
        }
        // TODO allow any ALWAYS_FREE shape for compute when MySQL.Free is picked
        let selectedOcpus: number | undefined;
        let selectedMemory: number | undefined;

        const filteredShapes = existingShapes.computeShapes.filter(this.computeShapesFilter);

        const shapeExists = !!this.findComputeShape(computeShapeInfo, filteredShapes);
        if (shapeExists) {
            selectedOcpus = computeShapeInfo.ocpus;
        }
        if (shapeExists) {
            selectedMemory = computeShapeInfo.memoryInGBs;
        }

        const resources: ComputeShape[] = filteredShapes.map((r) => {
            let memoryInGBs = r.memoryInGBs;
            const { minInGBs, maxInGBs } = r.memoryOptions ?? {};
            if (minInGBs && maxInGBs && selectedMemory && selectedMemory >= minInGBs && selectedMemory <= maxInGBs) {
                memoryInGBs = selectedMemory;
            } else {
                memoryInGBs ??= minInGBs;
            }

            let ocpus = r.ocpus;
            const { min, max } = r.ocpuOptions ?? {};
            if (min && max && selectedOcpus && selectedOcpus >= min && selectedOcpus <= max) {
                ocpus = selectedOcpus;
            } else {
                ocpus ??= min;
            }

            return {
                ...r,
                memoryInGBs,
                ocpus,
            };
        });

        return {
            shapeExists,
            options: this.generateComputeShapesOptions(resources),
        };
    }

    private dbSystemsFilter = (shape: ShapeSummary) => {
        return dbsRegex.test(shape.name);
    };

    private changeDbSystemsCpus = (shape: ShapeSummary): ShapeSummary => {
        if (!dbsRegex.test(shape.name)) {
            return shape;
        }

        const match = dbsRegex.exec(shape.name);
        const cpuCoreCount = match?.[1];
        if (!cpuCoreCount) {
            return shape;
        }

        let ecpus: number;
        if (cpuCoreCount === "Free") {
            ecpus = 2;
        } else {
            ecpus = parseInt(cpuCoreCount, 10);
        }

        return {
            ...shape,
            cpuCoreCount: ecpus,
        };
    };

    private computeShapesFilter = (shape: ComputeShapeSpecsPicked) => {
        const type = shape.platformConfigOptions?.type;
        if (!type) {
            if (shape.processorDescription?.includes(" AMD ")) {
                return true;
            }

            return false;
        }

        return type.toLowerCase().startsWith("intel") || type.toLowerCase().startsWith("amd");
    };

    private heatWaveShapeFilter = (shape: ShapeSummary) => {
        return shape.name.startsWith("HeatWave.");
    };

    private generateComputeShapesOptions(resources: ComputeShape[]) {
        return resources.map(
            ({ shape, ocpus, memoryInGBs, networkingBandwidthInGbps }) => {
                let label = shape;
                if (ocpus) {
                    label += ` / ${ocpus} OCPUs`;
                }
                if (memoryInGBs) {
                    label += ` / ${memoryInGBs}GB RAM`;
                }
                if (networkingBandwidthInGbps) {
                    label += ` / ${networkingBandwidthInGbps} Gbps Networking`;
                }

                const computeShapeInfo: ComputeShapeInfo = {
                    shape: shape,
                    ocpus,
                    memoryInGBs: memoryInGBs,
                };

                const id = this.getComputeShapesId(computeShapeInfo);

                return { id, label };
            },
        );
    }

    private generateDbSystemOptions(resources: ShapeSummary[]): ISelectOption[] {

        return resources.map(
            ({ name, cpuCoreCount, memorySizeInGBs }) => {
                let label = `${name} / ${cpuCoreCount} ECPUs`;
                if (memorySizeInGBs) {
                    label += ` / ${memorySizeInGBs}GB RAM`;
                }

                return { id: name, label };
            },
        );
    }

    private generateHeatwaveShapeOptions(shapes: Map<string, string>): ISelectOption[] {
        const list = Array.from(shapes.entries());
        list.sort(([a], [b]) => {
            if (a === "0") {
                return -1; // a should come before b
            }
            if (b === "0") {
                return 1; // b should come before a
            }

            if (a === "HeatWave.Free") {
                return -1; // a should come before b
            }
            if (b === "HeatWave.Free") {
                return 1; // b should come before a
            }

            return a.localeCompare(b);
        });

        return list.map(([id, label]) => {
            return { id, label };
        });
    }

    private findDbSystemShape(shape?: string, dbSystemShapes?: ShapeSummary[]) {
        if (!shape) {
            return undefined;
        }

        return dbSystemShapes?.find((d) => {
            return d.name === shape;
        });
    }

    private findHeatWaveShape(shape?: string, heatwaveClusterShapes?: ShapeSummary[]) {
        return heatwaveClusterShapes?.find(({ name }) => {
            return name === shape;
        });
    }

    private findComputeShape(computeShapeInfo: ComputeShapeInfo, computeShapes?: ComputeShapeSpecsPicked[]) {
        return computeShapes?.find(
            ({ shape, memoryOptions, ocpuOptions, ocpus, memoryInGBs }) => {
                if (shape !== computeShapeInfo.shape || !computeShapeInfo.memoryInGBs || !computeShapeInfo.ocpus) {
                    return false;
                }

                if (computeShapeInfo.memoryInGBs === memoryInGBs && computeShapeInfo.ocpus === ocpus) {
                    return true;
                }

                const memoryInRange = { min: false, max: false };
                const { minInGBs, maxInGBs } = memoryOptions ?? {};
                if (minInGBs && computeShapeInfo.memoryInGBs >= minInGBs) {
                    memoryInRange.min = true;
                }
                if (maxInGBs && computeShapeInfo.memoryInGBs <= maxInGBs) {
                    memoryInRange.max = true;
                }

                const ocpusInRange = { min: false, max: false };
                const { min, max } = ocpuOptions ?? {};
                if (min && computeShapeInfo.ocpus >= min) {
                    ocpusInRange.min = true;
                }
                if (max && computeShapeInfo.ocpus <= max) {
                    ocpusInRange.max = true;
                }

                return memoryInRange.min && memoryInRange.max && ocpusInRange.min && ocpusInRange.max;
            });
    }
}
