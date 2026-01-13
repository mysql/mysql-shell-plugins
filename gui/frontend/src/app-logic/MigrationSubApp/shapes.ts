/*
 * Copyright (c) 2025, 2026, Oracle and/or its affiliates.
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

// import { IComputeShape } from "../../communication/Oci.js";
import { IComputeShape } from "../../communication/Oci.js";
import { ShapeSummary } from "../../oci-typings/oci-mysql/lib/model/shape-summary.js";

type ComputeShapeSpecs = Pick<IComputeShape,
    "shape" | "ocpus" | "ocpuOptions" | "memoryInGBs" | "memoryOptions" | "networkingBandwidthInGbps"
    | "platformConfigOptions">;

type MemoryOptionsPicked = Pick<
    NonNullable<ComputeShapeSpecs["memoryOptions"]>,
    "minInGBs" | "maxInGBs"
>;

type OcpuOptionsPicked = Pick<
    NonNullable<ComputeShapeSpecs["ocpuOptions"]>,
    "min" | "max"
>;

export type ComputeShapeSpecsPicked = Omit<ComputeShapeSpecs, "memoryOptions" | "ocpuOptions"> & {
    memoryOptions?: MemoryOptionsPicked;
    ocpuOptions?: OcpuOptionsPicked;
    processorDescription?: string;
};

export interface Shapes {
    dbSystemShapes?: ShapeSummary[];
    heatwaveClusterShapes?: ShapeSummary[];
    computeShapes?: ComputeShapeSpecsPicked[];
}

export interface ShapesConfig {
    databaseShapes: {
        name: string,
        enableHA?: boolean,
        enableBackup?: boolean,
        autoExpandStorage?: boolean,
    },
    heatwaveCluster: {
        shapeName: string,
        clusterSize: number,
    },
    computeShapes: {
        shape: string,
        ocpus: number,
        memoryInGBs: number,
    },
    // isProduction?: boolean,
}

export type ComputeShapeInfo = Partial<ShapesConfig["computeShapes"]>;

export type PreConfiguredShapes = Record<string, ShapesConfig>;

const smallTemplate: ShapesConfig = {
    databaseShapes: {
        name: "MySQL.2",
    },
    heatwaveCluster: {
        shapeName: "HeatWave.32GB",
        clusterSize: 1,
    },
    computeShapes: {
        shape: "VM.Standard.E5.Flex",
        ocpus: 2,
        memoryInGBs: 24,
    },
};

const standardTemplate: ShapesConfig = {
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

const largeTemplate: ShapesConfig = {
    databaseShapes: {
        name: "MySQL.64",
    },
    heatwaveCluster: {
        shapeName: "HeatWave.512GB",
        clusterSize: 4,
    },
    computeShapes: {
        shape: "VM.Standard.E5.Flex",
        ocpus: 12,
        memoryInGBs: 96,
    },
};

export const standardTemplateId = "Standard Development Setup - 8 ECPU, 64GB RAM, 4Gbps NET";
export const customTemplateId = "Custom";

export const shapesByTemplate: PreConfiguredShapes = {
    "Always Free - 2 ECPU, 8 GB RAM, 1Gbps NET": {
        databaseShapes: {
            name: "MySQL.Free",
        },
        heatwaveCluster: {
            shapeName: "HeatWave.Free",
            clusterSize: 1,
        },
        computeShapes: {
            shape: "VM.Standard.A1.Flex",
            ocpus: 2,
            memoryInGBs: 12,
        },
    },
    "Small Development Setup - 2 ECPU, 16GB RAM, 1Gbps NET": smallTemplate,
    [standardTemplateId]: standardTemplate,
    "Large Development Setup - 64 ECPU, 512GB RAM, 32Gbps NET": largeTemplate,
    "Small Production Workload - 2 ECPU, 16GB RAM, 1Gbps NET": {
        ...smallTemplate,
        databaseShapes: {
            ...smallTemplate.databaseShapes,
            enableHA: true,
            enableBackup: true,
            autoExpandStorage: true,
        },
        // isProduction: true,
    },
    "Standard Production Workload - 8 ECPUs, 64GB RAM, 4Gbps NET": {
        ...standardTemplate,
        databaseShapes: {
            ...standardTemplate.databaseShapes,
            enableHA: true,
            enableBackup: true,
            autoExpandStorage: true,
        },
        // isProduction: true,
    },
    "Heavy Production Workload - 64 ECPUs, 512GB RAM, 32Gbps NET": {
        ...largeTemplate,
        databaseShapes: {
            ...largeTemplate.databaseShapes,
            enableHA: true,
            enableBackup: true,
            autoExpandStorage: true,
        },
        // isProduction: true,
    },
    [customTemplateId]: standardTemplate,
} as const;

export type ConfigTemplate = keyof typeof shapesByTemplate;

export const configTemplates: ConfigTemplate[] = Object.keys(shapesByTemplate);

export const getClusterSizeBoundaries = (heatWaveShapeName?: string) => {
    switch (heatWaveShapeName) {
        case "HeatWave.Free":
            return { min: 0, max: 1 };
        case "HeatWave.32GB":
            return { min: 0, max: 16 };
        default:
            return { min: 0, max: 512 };
    }
};
