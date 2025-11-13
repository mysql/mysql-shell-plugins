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

import { Shapes } from "../../../app-logic/MigrationSubApp/shapes.js";

export const existingShapes = {
    "dbSystemShapes": [
        {
            "cpuCoreCount": 1,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 8,
            "name": "VM.Standard.E2.1"
        },
        {
            "cpuCoreCount": 2,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 16,
            "name": "VM.Standard.E2.2"
        },
        {
            "cpuCoreCount": 4,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 32,
            "name": "VM.Standard.E2.4"
        },
        {
            "cpuCoreCount": 8,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 64,
            "name": "VM.Standard.E2.8"
        },
        {
            "cpuCoreCount": 1,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 8,
            "name": "MySQL.VM.Standard.E3.1.8GB"
        },
        {
            "cpuCoreCount": 1,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 16,
            "name": "MySQL.VM.Standard.E3.1.16GB"
        },
        {
            "cpuCoreCount": 2,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 32,
            "name": "MySQL.VM.Standard.E3.2.32GB"
        },
        {
            "cpuCoreCount": 4,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 64,
            "name": "MySQL.VM.Standard.E3.4.64GB"
        },
        {
            "cpuCoreCount": 8,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 128,
            "name": "MySQL.VM.Standard.E3.8.128GB"
        },
        {
            "cpuCoreCount": 16,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 256,
            "name": "MySQL.VM.Standard.E3.16.256GB"
        },
        {
            "cpuCoreCount": 24,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 384,
            "name": "MySQL.VM.Standard.E3.24.384GB"
        },
        {
            "cpuCoreCount": 32,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 512,
            "name": "MySQL.VM.Standard.E3.32.512GB"
        },
        {
            "cpuCoreCount": 48,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 768,
            "name": "MySQL.VM.Standard.E3.48.768GB"
        },
        {
            "cpuCoreCount": 64,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 1024,
            "name": "MySQL.VM.Standard.E3.64.1024GB"
        },
        {
            "cpuCoreCount": 1,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 8,
            "name": "MySQL.VM.Standard.E4.1.8GB"
        },
        {
            "cpuCoreCount": 1,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 16,
            "name": "MySQL.VM.Standard.E4.1.16GB"
        },
        {
            "cpuCoreCount": 2,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 32,
            "name": "MySQL.VM.Standard.E4.2.32GB"
        },
        {
            "cpuCoreCount": 4,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 64,
            "name": "MySQL.VM.Standard.E4.4.64GB"
        },
        {
            "cpuCoreCount": 8,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 128,
            "name": "MySQL.VM.Standard.E4.8.128GB"
        },
        {
            "cpuCoreCount": 16,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 256,
            "name": "MySQL.VM.Standard.E4.16.256GB"
        },
        {
            "cpuCoreCount": 24,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 384,
            "name": "MySQL.VM.Standard.E4.24.384GB"
        },
        {
            "cpuCoreCount": 32,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 512,
            "name": "MySQL.VM.Standard.E4.32.512GB"
        },
        {
            "cpuCoreCount": 48,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 768,
            "name": "MySQL.VM.Standard.E4.48.768GB"
        },
        {
            "cpuCoreCount": 64,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 1024,
            "name": "MySQL.VM.Standard.E4.64.1024GB"
        },
        {
            "cpuCoreCount": 1,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 15,
            "name": "MySQL.VM.Standard2.1.15GB"
        },
        {
            "cpuCoreCount": 2,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 30,
            "name": "MySQL.VM.Standard2.2.30GB"
        },
        {
            "cpuCoreCount": 4,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 60,
            "name": "MySQL.VM.Standard2.4.60GB"
        },
        {
            "cpuCoreCount": 8,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 120,
            "name": "MySQL.VM.Standard2.8.120GB"
        },
        {
            "cpuCoreCount": 16,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 240,
            "name": "MySQL.VM.Standard2.16.240GB"
        },
        {
            "cpuCoreCount": 1,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 8,
            "name": "MySQL.VM.Standard3.1.8GB"
        },
        {
            "cpuCoreCount": 1,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 16,
            "name": "MySQL.VM.Standard3.1.16GB"
        },
        {
            "cpuCoreCount": 2,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 32,
            "name": "MySQL.VM.Standard3.2.32GB"
        },
        {
            "cpuCoreCount": 4,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 64,
            "name": "MySQL.VM.Standard3.4.64GB"
        },
        {
            "cpuCoreCount": 8,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 128,
            "name": "MySQL.VM.Standard3.8.128GB"
        },
        {
            "cpuCoreCount": 16,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 256,
            "name": "MySQL.VM.Standard3.16.256GB"
        },
        {
            "cpuCoreCount": 24,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 384,
            "name": "MySQL.VM.Standard3.24.384GB"
        },
        {
            "cpuCoreCount": 32,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 512,
            "name": "MySQL.VM.Standard3.32.512GB"
        },
        {
            "cpuCoreCount": 1,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 8,
            "name": "MySQL.VM.Optimized3.1.8GB"
        },
        {
            "cpuCoreCount": 1,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 16,
            "name": "MySQL.VM.Optimized3.1.16GB"
        },
        {
            "cpuCoreCount": 2,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 32,
            "name": "MySQL.VM.Optimized3.2.32GB"
        },
        {
            "cpuCoreCount": 4,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 64,
            "name": "MySQL.VM.Optimized3.4.64GB"
        },
        {
            "cpuCoreCount": 8,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 128,
            "name": "MySQL.VM.Optimized3.8.128GB"
        },
        {
            "cpuCoreCount": 16,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 256,
            "name": "MySQL.VM.Optimized3.16.256GB"
        },
        {
            "cpuCoreCount": 1,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 16,
            "name": "MySQL.2"
        },
        {
            "cpuCoreCount": 2,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 32,
            "name": "MySQL.4"
        },
        {
            "cpuCoreCount": 4,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 64,
            "name": "MySQL.8"
        },
        {
            "cpuCoreCount": 8,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 128,
            "name": "MySQL.16"
        },
        {
            "cpuCoreCount": 16,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 256,
            "name": "MySQL.32"
        },
        {
            "cpuCoreCount": 24,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 384,
            "name": "MySQL.48"
        },
        {
            "cpuCoreCount": 32,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 512,
            "name": "MySQL.64"
        },
        {
            "cpuCoreCount": 128,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 2048,
            "name": "MySQL.HeatWave.BM.Standard.E3"
        },
        {
            "cpuCoreCount": 128,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 2048,
            "name": "MySQL.HeatWave.BM.Standard"
        },
        {
            "cpuCoreCount": 128,
            "isSupportedFor": [
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 1024,
            "name": "MySQL.256"
        }
    ],
    "heatwaveClusterShapes": [
        {
            "cpuCoreCount": 16,
            "isSupportedFor": [
                "HEATWAVECLUSTER",
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 512,
            "name": "MySQL.HeatWave.VM.Standard.E3"
        },
        {
            "cpuCoreCount": 16,
            "isSupportedFor": [
                "HEATWAVECLUSTER",
                "DBSYSTEM"
            ],
            "memorySizeInGbs": 512,
            "name": "MySQL.HeatWave.VM.Standard"
        },
        {
            "cpuCoreCount": 1,
            "isSupportedFor": [
                "HEATWAVECLUSTER"
            ],
            "memorySizeInGbs": 32,
            "name": "HeatWave.32GB"
        },
        {
            "cpuCoreCount": 16,
            "isSupportedFor": [
                "HEATWAVECLUSTER"
            ],
            "memorySizeInGbs": 512,
            "name": "HeatWave.512GB"
        }
    ],
    "computeShapes": [
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": false,
            "isSubcore": false,
            "localDiskDescription": "NVMe SSD Storage",
            "localDisks": 2,
            "localDisksTotalSizeInGbs": 1920,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 512,
            "memoryInGbs": 3072,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 2,
            "networkingBandwidthInGbps": 200,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 256,
            "platformConfigOptions": {
                "accessControlServiceOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "inputOutputMemoryManagementUnitOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "measuredBootOptions": {
                    "allowedValues": [
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "memoryEncryptionOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "numaNodesPerSocketPlatformOptions": {
                    "defaultValue": "NPS1",
                    "serviceAllowedValues": [
                        "NPS0",
                        "NPS1",
                        "NPS2",
                        "NPS4"
                    ]
                },
                "percentageOfCoresEnabledOptions": {
                    "defaultValue": 100,
                    "max": 100,
                    "min": 50
                },
                "secureBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "symmetricMultiThreadingOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "trustedPlatformModuleOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "type": "GENERIC_BM",
                "virtualInstructionsOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                }
            },
            "processorDescription": "2.7 GHz AMD EPYC™ 9J45 (Turin)",
            "quotaNames": [
                "standard-e6-core-count",
                "standard-e6-memory-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": null,
            "resizeCompatibleShapes": null,
            "shape": "BM.Standard.E6.256"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": false,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 512,
            "memoryInGbs": 2304,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 2,
            "networkingBandwidthInGbps": 100,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 192,
            "platformConfigOptions": {
                "accessControlServiceOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "inputOutputMemoryManagementUnitOptions": {
                    "allowedValues": [
                        true
                    ],
                    "isDefaultEnabled": true
                },
                "measuredBootOptions": {
                    "allowedValues": [
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "memoryEncryptionOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "numaNodesPerSocketPlatformOptions": {
                    "defaultValue": "NPS1",
                    "serviceAllowedValues": [
                        "NPS0",
                        "NPS1",
                        "NPS2",
                        "NPS4"
                    ]
                },
                "percentageOfCoresEnabledOptions": {
                    "defaultValue": 100,
                    "max": 100,
                    "min": 25
                },
                "secureBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "symmetricMultiThreadingOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "trustedPlatformModuleOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "type": "GENERIC_BM",
                "virtualInstructionsOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                }
            },
            "processorDescription": "2.3 GHz AMD EPYC™ 9J14 (Genoa)",
            "quotaNames": [
                "standard-e5-core-count",
                "standard-e5-memory-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": null,
            "resizeCompatibleShapes": null,
            "shape": "BM.Standard.E5.192"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": false,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 256,
            "memoryInGbs": 1024,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 2,
            "networkingBandwidthInGbps": 100,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 160,
            "platformConfigOptions": null,
            "processorDescription": "3.0 GHz Ampere® Altra™",
            "quotaNames": [
                "standard-a1-memory-count",
                "standard-a1-memory-regional-count",
                "standard-a1-core-count",
                "standard-a1-core-regional-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": null,
            "resizeCompatibleShapes": null,
            "shape": "BM.Standard.A1.160"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": false,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 256,
            "memoryInGbs": 1024,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 2,
            "networkingBandwidthInGbps": 100,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 64,
            "platformConfigOptions": {
                "accessControlServiceOptions": null,
                "inputOutputMemoryManagementUnitOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "measuredBootOptions": null,
                "memoryEncryptionOptions": null,
                "numaNodesPerSocketPlatformOptions": {
                    "defaultValue": "NPS1",
                    "serviceAllowedValues": [
                        "NPS1",
                        "NPS2"
                    ]
                },
                "percentageOfCoresEnabledOptions": {
                    "defaultValue": 100,
                    "max": 100,
                    "min": 1
                },
                "secureBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "symmetricMultiThreadingOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "trustedPlatformModuleOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "type": "INTEL_ICELAKE_BM",
                "virtualInstructionsOptions": null
            },
            "processorDescription": "2.6 GHz Intel® Xeon® Platinum 8358 (Ice Lake)",
            "quotaNames": [
                "standard3-memory-count",
                "standard3-core-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": null,
            "resizeCompatibleShapes": null,
            "shape": "BM.Standard3.64"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": false,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 200,
            "memoryInGbs": 768,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 2,
            "networkingBandwidthInGbps": 50,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 52,
            "platformConfigOptions": {
                "accessControlServiceOptions": null,
                "inputOutputMemoryManagementUnitOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "measuredBootOptions": {
                    "allowedValues": [
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "memoryEncryptionOptions": null,
                "numaNodesPerSocketPlatformOptions": {
                    "defaultValue": "NPS1",
                    "serviceAllowedValues": [
                        "NPS1",
                        "NPS2"
                    ]
                },
                "percentageOfCoresEnabledOptions": {
                    "defaultValue": 100,
                    "max": 100,
                    "min": 1
                },
                "secureBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "symmetricMultiThreadingOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "trustedPlatformModuleOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "type": "INTEL_SKYLAKE_BM",
                "virtualInstructionsOptions": null
            },
            "processorDescription": "2.0 GHz Intel® Xeon® Platinum 8167M (Skylake)",
            "quotaNames": [
                "standard2-core-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": null,
            "resizeCompatibleShapes": null,
            "shape": "BM.Standard2.52"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": false,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 256,
            "memoryInGbs": 2048,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 2,
            "networkingBandwidthInGbps": 100,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 128,
            "platformConfigOptions": {
                "accessControlServiceOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "inputOutputMemoryManagementUnitOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "measuredBootOptions": {
                    "allowedValues": [
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "memoryEncryptionOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "numaNodesPerSocketPlatformOptions": {
                    "defaultValue": "NPS1",
                    "serviceAllowedValues": [
                        "NPS0",
                        "NPS1",
                        "NPS2",
                        "NPS4"
                    ]
                },
                "percentageOfCoresEnabledOptions": {
                    "defaultValue": 100,
                    "max": 100,
                    "min": 1
                },
                "secureBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "symmetricMultiThreadingOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "trustedPlatformModuleOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "type": "AMD_MILAN_BM",
                "virtualInstructionsOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                }
            },
            "processorDescription": "2.55 GHz AMD EPYC™ 7J13 (Milan)",
            "quotaNames": [
                "standard-e4-core-count",
                "standard-e4-memory-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": null,
            "resizeCompatibleShapes": null,
            "shape": "BM.Standard.E4.128"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": false,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 256,
            "memoryInGbs": 2048,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 2,
            "networkingBandwidthInGbps": 100,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 128,
            "platformConfigOptions": {
                "accessControlServiceOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "inputOutputMemoryManagementUnitOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "measuredBootOptions": {
                    "allowedValues": [
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "memoryEncryptionOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "numaNodesPerSocketPlatformOptions": {
                    "defaultValue": "NPS1",
                    "serviceAllowedValues": [
                        "NPS0",
                        "NPS1",
                        "NPS2",
                        "NPS4"
                    ]
                },
                "percentageOfCoresEnabledOptions": {
                    "defaultValue": 100,
                    "max": 100,
                    "min": 1
                },
                "secureBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "symmetricMultiThreadingOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "trustedPlatformModuleOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "type": "AMD_ROME_BM",
                "virtualInstructionsOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                }
            },
            "processorDescription": "2.25 GHz AMD EPYC™ 7742 (Rome)",
            "quotaNames": [
                "standard-e3-core-ad-count",
                "standard-e3-memory-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": null,
            "resizeCompatibleShapes": null,
            "shape": "BM.Standard.E3.128"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": false,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 150,
            "memoryInGbs": 512,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 2,
            "networkingBandwidthInGbps": 50,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 64,
            "platformConfigOptions": null,
            "processorDescription": "2.0 GHz AMD EPYC™ 7551 (Naples)",
            "quotaNames": [
                "standard-e2-core-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": [
                {
                    "shapeName": "BM.Standard2.52"
                },
                {
                    "shapeName": "BM.Standard.E3.128"
                }
            ],
            "resizeCompatibleShapes": null,
            "shape": "BM.Standard.E2.64"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": "NVIDIA® A100",
            "gpus": 8,
            "isBilledForStoppedInstance": true,
            "isFlexible": false,
            "isLiveMigrationSupported": false,
            "isSubcore": false,
            "localDiskDescription": "NVMe SSD Storage",
            "localDisks": 4,
            "localDisksTotalSizeInGbs": 27200,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 64,
            "memoryInGbs": 2048,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 50,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 64,
            "platformConfigOptions": {
                "accessControlServiceOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "inputOutputMemoryManagementUnitOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "measuredBootOptions": null,
                "memoryEncryptionOptions": null,
                "numaNodesPerSocketPlatformOptions": {
                    "defaultValue": "NPS4",
                    "serviceAllowedValues": [
                        "NPS0",
                        "NPS1",
                        "NPS2",
                        "NPS4"
                    ]
                },
                "percentageOfCoresEnabledOptions": null,
                "secureBootOptions": null,
                "symmetricMultiThreadingOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "trustedPlatformModuleOptions": null,
                "type": "AMD_ROME_BM_GPU",
                "virtualInstructionsOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                }
            },
            "processorDescription": "2.9 GHz AMD EPYC™ 7542 (Rome)",
            "quotaNames": [
                "gpu4-count"
            ],
            "rdmaBandwidthInGbps": 100,
            "rdmaPorts": 16,
            "recommendedAlternatives": null,
            "resizeCompatibleShapes": null,
            "shape": "BM.GPU4.8"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": false,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 100,
            "memoryInGbs": 256,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 10,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 36,
            "platformConfigOptions": null,
            "processorDescription": "2.3 GHz Intel® Xeon® E5-2699 v3 (Haswell)",
            "quotaNames": [
                "standard1-core-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": [
                {
                    "shapeName": "BM.Standard2.52"
                },
                {
                    "shapeName": "BM.Standard3.64"
                }
            ],
            "resizeCompatibleShapes": null,
            "shape": "BM.Standard1.36"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": false,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 44,
            "memoryInGbs": 512,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 25,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 44,
            "platformConfigOptions": null,
            "processorDescription": "2.2 GHz Intel® Xeon® E5-2669 v4 (Broadwell)",
            "quotaNames": [
                "standard-b1-core-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": [
                {
                    "shapeName": "BM.Standard2.52"
                },
                {
                    "shapeName": "BM.Standard3.64"
                }
            ],
            "resizeCompatibleShapes": null,
            "shape": "BM.Standard.B1.44"
        },
        {
            "baselineOcpuUtilizations": [
                "BASELINE_1_8",
                "BASELINE_1_2",
                "BASELINE_1_1"
            ],
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": true,
            "isLiveMigrationSupported": true,
            "isSubcore": true,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": {
                "defaultPerOcpu": 1,
                "max": 24,
                "min": 2
            },
            "maxVnicAttachments": 2,
            "memoryInGbs": 16,
            "memoryOptions": {
                "defaultPerOcpuInGBs": 16,
                "maxInGBs": 1760,
                "maxPerNumaNodeInGbs": 1024,
                "maxPerOcpuInGbs": 64,
                "minInGBs": 1,
                "minPerOcpuInGbs": 1
            },
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 1,
            "networkingBandwidthOptions": {
                "defaultPerOcpuInGbps": 1,
                "maxInGbps": 40,
                "minInGbps": 1
            },
            "ocpuOptions": {
                "max": 114,
                "maxPerNumaNode": 64,
                "min": 1
            },
            "ocpus": 1,
            "platformConfigOptions": {
                "accessControlServiceOptions": null,
                "inputOutputMemoryManagementUnitOptions": null,
                "measuredBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "memoryEncryptionOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "numaNodesPerSocketPlatformOptions": null,
                "percentageOfCoresEnabledOptions": null,
                "secureBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "symmetricMultiThreadingOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "trustedPlatformModuleOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "type": "AMD_VM",
                "virtualInstructionsOptions": null
            },
            "processorDescription": "2.55 GHz AMD EPYC™ 7J13 (Milan)",
            "quotaNames": [
                "standard-e4-core-count",
                "standard-e4-memory-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": null,
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard.E4.Flex"
        },
        {
            "baselineOcpuUtilizations": [
                "BASELINE_1_8",
                "BASELINE_1_2",
                "BASELINE_1_1"
            ],
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": true,
            "isLiveMigrationSupported": true,
            "isSubcore": true,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": {
                "defaultPerOcpu": 1,
                "max": 24,
                "min": 2
            },
            "maxVnicAttachments": 2,
            "memoryInGbs": 16,
            "memoryOptions": {
                "defaultPerOcpuInGBs": 16,
                "maxInGBs": 1776,
                "maxPerNumaNodeInGbs": 1024,
                "maxPerOcpuInGbs": 64,
                "minInGBs": 1,
                "minPerOcpuInGbs": 1
            },
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 1,
            "networkingBandwidthOptions": {
                "defaultPerOcpuInGbps": 1,
                "maxInGbps": 40,
                "minInGbps": 1
            },
            "ocpuOptions": {
                "max": 114,
                "maxPerNumaNode": 64,
                "min": 1
            },
            "ocpus": 1,
            "platformConfigOptions": {
                "accessControlServiceOptions": null,
                "inputOutputMemoryManagementUnitOptions": null,
                "measuredBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "memoryEncryptionOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "numaNodesPerSocketPlatformOptions": null,
                "percentageOfCoresEnabledOptions": null,
                "secureBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "symmetricMultiThreadingOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "trustedPlatformModuleOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "type": "AMD_VM",
                "virtualInstructionsOptions": null
            },
            "processorDescription": "2.25 GHz AMD EPYC™ 7742 (Rome)",
            "quotaNames": [
                "standard-e3-core-ad-count",
                "standard-e3-memory-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": null,
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard.E3.Flex"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "LIMITED_FREE",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": true,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": {
                "defaultPerOcpu": 1,
                "max": 24,
                "min": 2
            },
            "maxVnicAttachments": 2,
            "memoryInGbs": 6,
            "memoryOptions": {
                "defaultPerOcpuInGBs": 6,
                "maxInGBs": 512,
                "maxPerNumaNodeInGbs": 512,
                "maxPerOcpuInGbs": 64,
                "minInGBs": 1,
                "minPerOcpuInGbs": 1
            },
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 1,
            "networkingBandwidthOptions": {
                "defaultPerOcpuInGbps": 1,
                "maxInGbps": 40,
                "minInGbps": 1
            },
            "ocpuOptions": {
                "max": 80,
                "maxPerNumaNode": 80,
                "min": 1
            },
            "ocpus": 1,
            "platformConfigOptions": null,
            "processorDescription": "3.0 GHz Ampere® Altra™",
            "quotaNames": [
                "standard-a1-memory-count",
                "standard-a1-memory-regional-count",
                "standard-a1-core-count",
                "standard-a1-core-regional-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": null,
            "resizeCompatibleShapes": [
                "VM.Standard.A1.Flex",
                "VM.Standard.Ampere.Generic",
                "VM.Standard.A2.Flex"
            ],
            "shape": "VM.Standard.A1.Flex"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 2,
            "memoryInGbs": 15,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 1,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 1,
            "platformConfigOptions": {
                "accessControlServiceOptions": null,
                "inputOutputMemoryManagementUnitOptions": null,
                "measuredBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "memoryEncryptionOptions": null,
                "numaNodesPerSocketPlatformOptions": null,
                "percentageOfCoresEnabledOptions": null,
                "secureBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "symmetricMultiThreadingOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "trustedPlatformModuleOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "type": "INTEL_VM",
                "virtualInstructionsOptions": null
            },
            "processorDescription": "2.0 GHz Intel® Xeon® Platinum 8167M (Skylake)",
            "quotaNames": [
                "standard2-core-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": null,
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard2.1"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 2,
            "memoryInGbs": 30,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 2,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 2,
            "platformConfigOptions": {
                "accessControlServiceOptions": null,
                "inputOutputMemoryManagementUnitOptions": null,
                "measuredBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "memoryEncryptionOptions": null,
                "numaNodesPerSocketPlatformOptions": null,
                "percentageOfCoresEnabledOptions": null,
                "secureBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "symmetricMultiThreadingOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "trustedPlatformModuleOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "type": "INTEL_VM",
                "virtualInstructionsOptions": null
            },
            "processorDescription": "2.0 GHz Intel® Xeon® Platinum 8167M (Skylake)",
            "quotaNames": [
                "standard2-core-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": null,
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard2.2"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 4,
            "memoryInGbs": 60,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 4.1,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 4,
            "platformConfigOptions": {
                "accessControlServiceOptions": null,
                "inputOutputMemoryManagementUnitOptions": null,
                "measuredBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "memoryEncryptionOptions": null,
                "numaNodesPerSocketPlatformOptions": null,
                "percentageOfCoresEnabledOptions": null,
                "secureBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "symmetricMultiThreadingOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "trustedPlatformModuleOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "type": "INTEL_VM",
                "virtualInstructionsOptions": null
            },
            "processorDescription": "2.0 GHz Intel® Xeon® Platinum 8167M (Skylake)",
            "quotaNames": [
                "standard2-core-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": null,
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard2.4"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 8,
            "memoryInGbs": 120,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 8.2,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 8,
            "platformConfigOptions": {
                "accessControlServiceOptions": null,
                "inputOutputMemoryManagementUnitOptions": null,
                "measuredBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "memoryEncryptionOptions": null,
                "numaNodesPerSocketPlatformOptions": null,
                "percentageOfCoresEnabledOptions": null,
                "secureBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "symmetricMultiThreadingOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "trustedPlatformModuleOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "type": "INTEL_VM",
                "virtualInstructionsOptions": null
            },
            "processorDescription": "2.0 GHz Intel® Xeon® Platinum 8167M (Skylake)",
            "quotaNames": [
                "standard2-core-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": null,
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard2.8"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 16,
            "memoryInGbs": 240,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 16.4,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 16,
            "platformConfigOptions": {
                "accessControlServiceOptions": null,
                "inputOutputMemoryManagementUnitOptions": null,
                "measuredBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "memoryEncryptionOptions": null,
                "numaNodesPerSocketPlatformOptions": null,
                "percentageOfCoresEnabledOptions": null,
                "secureBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "symmetricMultiThreadingOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "trustedPlatformModuleOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "type": "INTEL_VM",
                "virtualInstructionsOptions": null
            },
            "processorDescription": "2.0 GHz Intel® Xeon® Platinum 8167M (Skylake)",
            "quotaNames": [
                "standard2-core-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": null,
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard2.16"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 24,
            "memoryInGbs": 320,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 24.6,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 24,
            "platformConfigOptions": {
                "accessControlServiceOptions": null,
                "inputOutputMemoryManagementUnitOptions": null,
                "measuredBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "memoryEncryptionOptions": null,
                "numaNodesPerSocketPlatformOptions": null,
                "percentageOfCoresEnabledOptions": null,
                "secureBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "symmetricMultiThreadingOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "trustedPlatformModuleOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "type": "INTEL_VM",
                "virtualInstructionsOptions": null
            },
            "processorDescription": "2.0 GHz Intel® Xeon® Platinum 8167M (Skylake)",
            "quotaNames": [
                "standard2-core-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": null,
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard2.24"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 2,
            "memoryInGbs": 8,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 0.7,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 1,
            "platformConfigOptions": null,
            "processorDescription": "2.0 GHz AMD EPYC™ 7551 (Naples)",
            "quotaNames": [
                "standard-e2-core-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": [
                {
                    "shapeName": "VM.Standard2.1"
                },
                {
                    "shapeName": "VM.Standard.E3.Flex"
                }
            ],
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard.E2.1"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 2,
            "memoryInGbs": 16,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 1.4,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 2,
            "platformConfigOptions": null,
            "processorDescription": "2.0 GHz AMD EPYC™ 7551 (Naples)",
            "quotaNames": [
                "standard-e2-core-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": [
                {
                    "shapeName": "VM.Standard2.2"
                },
                {
                    "shapeName": "VM.Standard.E3.Flex"
                }
            ],
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard.E2.2"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 4,
            "memoryInGbs": 32,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 2.8,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 4,
            "platformConfigOptions": null,
            "processorDescription": "2.0 GHz AMD EPYC™ 7551 (Naples)",
            "quotaNames": [
                "standard-e2-core-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": [
                {
                    "shapeName": "VM.Standard2.4"
                },
                {
                    "shapeName": "VM.Standard.E3.Flex"
                }
            ],
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard.E2.4"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 8,
            "memoryInGbs": 64,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 5.6,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 8,
            "platformConfigOptions": null,
            "processorDescription": "2.0 GHz AMD EPYC™ 7551 (Naples)",
            "quotaNames": [
                "standard-e2-core-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": [
                {
                    "shapeName": "VM.Standard2.8"
                },
                {
                    "shapeName": "VM.Standard.E3.Flex"
                }
            ],
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard.E2.8"
        },
        {
            "baselineOcpuUtilizations": [
                "BASELINE_1_8",
                "BASELINE_1_2",
                "BASELINE_1_1"
            ],
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": true,
            "isLiveMigrationSupported": true,
            "isSubcore": true,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": {
                "defaultPerOcpu": 1,
                "max": 24,
                "min": 2
            },
            "maxVnicAttachments": 2,
            "memoryInGbs": 16,
            "memoryOptions": {
                "defaultPerOcpuInGBs": 16,
                "maxInGBs": 896,
                "maxPerNumaNodeInGbs": 512,
                "maxPerOcpuInGbs": 64,
                "minInGBs": 1,
                "minPerOcpuInGbs": 1
            },
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 1,
            "networkingBandwidthOptions": {
                "defaultPerOcpuInGbps": 1,
                "maxInGbps": 40,
                "minInGbps": 1
            },
            "ocpuOptions": {
                "max": 56,
                "maxPerNumaNode": 32,
                "min": 1
            },
            "ocpus": 1,
            "platformConfigOptions": {
                "accessControlServiceOptions": null,
                "inputOutputMemoryManagementUnitOptions": null,
                "measuredBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "memoryEncryptionOptions": null,
                "numaNodesPerSocketPlatformOptions": null,
                "percentageOfCoresEnabledOptions": null,
                "secureBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "symmetricMultiThreadingOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "trustedPlatformModuleOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "type": "INTEL_VM",
                "virtualInstructionsOptions": null
            },
            "processorDescription": "2.6 GHz Intel® Xeon® Platinum 8358 (Ice Lake)",
            "quotaNames": [
                "standard3-memory-count",
                "standard3-core-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": null,
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard3.Flex"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 2,
            "memoryInGbs": 7,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 0.6,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 1,
            "platformConfigOptions": null,
            "processorDescription": "2.3 GHz Intel® Xeon® E5-2699 v3 (Haswell)",
            "quotaNames": [
                "standard1-core-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": [
                {
                    "shapeName": "VM.Standard2.1"
                },
                {
                    "shapeName": "VM.Standard.E3.Flex"
                }
            ],
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard1.1"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 2,
            "memoryInGbs": 14,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 1.2,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 2,
            "platformConfigOptions": null,
            "processorDescription": "2.3 GHz Intel® Xeon® E5-2699 v3 (Haswell)",
            "quotaNames": [
                "standard1-core-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": [
                {
                    "shapeName": "VM.Standard2.2"
                },
                {
                    "shapeName": "VM.Standard.E3.Flex"
                }
            ],
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard1.2"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 4,
            "memoryInGbs": 28,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 1.2,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 4,
            "platformConfigOptions": null,
            "processorDescription": "2.3 GHz Intel® Xeon® E5-2699 v3 (Haswell)",
            "quotaNames": [
                "standard1-core-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": [
                {
                    "shapeName": "VM.Standard2.4"
                },
                {
                    "shapeName": "VM.Standard.E3.Flex"
                }
            ],
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard1.4"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 8,
            "memoryInGbs": 56,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 2.4,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 8,
            "platformConfigOptions": null,
            "processorDescription": "2.3 GHz Intel® Xeon® E5-2699 v3 (Haswell)",
            "quotaNames": [
                "standard1-core-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": [
                {
                    "shapeName": "VM.Standard2.8"
                },
                {
                    "shapeName": "VM.Standard.E3.Flex"
                }
            ],
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard1.8"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 16,
            "memoryInGbs": 112,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 4.8,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 16,
            "platformConfigOptions": null,
            "processorDescription": "2.3 GHz Intel® Xeon® E5-2699 v3 (Haswell)",
            "quotaNames": [
                "standard1-core-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": [
                {
                    "shapeName": "VM.Standard2.16"
                },
                {
                    "shapeName": "VM.Standard.E3.Flex"
                }
            ],
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard1.16"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 2,
            "memoryInGbs": 12,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 0.6,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 1,
            "platformConfigOptions": null,
            "processorDescription": "2.2 GHz Intel® Xeon® E5-2669 v4 (Broadwell)",
            "quotaNames": [
                "standard-b1-core-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": [
                {
                    "shapeName": "VM.Standard2.1"
                },
                {
                    "shapeName": "VM.Standard.E3.Flex"
                }
            ],
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard.B1.1"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 2,
            "memoryInGbs": 24,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 1.2,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 2,
            "platformConfigOptions": null,
            "processorDescription": "2.2 GHz Intel® Xeon® E5-2669 v4 (Broadwell)",
            "quotaNames": [
                "standard-b1-core-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": [
                {
                    "shapeName": "VM.Standard2.2"
                },
                {
                    "shapeName": "VM.Standard.E3.Flex"
                }
            ],
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard.B1.2"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 4,
            "memoryInGbs": 48,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 2.4,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 4,
            "platformConfigOptions": null,
            "processorDescription": "2.2 GHz Intel® Xeon® E5-2669 v4 (Broadwell)",
            "quotaNames": [
                "standard-b1-core-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": [
                {
                    "shapeName": "VM.Standard2.4"
                },
                {
                    "shapeName": "VM.Standard.E3.Flex"
                }
            ],
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard.B1.4"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 8,
            "memoryInGbs": 96,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 4.8,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 8,
            "platformConfigOptions": null,
            "processorDescription": "2.2 GHz Intel® Xeon® E5-2669 v4 (Broadwell)",
            "quotaNames": [
                "standard-b1-core-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": [
                {
                    "shapeName": "VM.Standard2.8"
                },
                {
                    "shapeName": "VM.Standard.E3.Flex"
                }
            ],
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard.B1.8"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": false,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": null,
            "maxVnicAttachments": 16,
            "memoryInGbs": 192,
            "memoryOptions": null,
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 9.6,
            "networkingBandwidthOptions": null,
            "ocpuOptions": null,
            "ocpus": 16,
            "platformConfigOptions": null,
            "processorDescription": "2.2 GHz Intel® Xeon® E5-2669 v4 (Broadwell)",
            "quotaNames": [
                "standard-b1-core-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": [
                {
                    "shapeName": "VM.Standard2.16"
                },
                {
                    "shapeName": "VM.Standard.E3.Flex"
                }
            ],
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard.B1.16"
        },
        {
            "baselineOcpuUtilizations": [
                "BASELINE_1_8",
                "BASELINE_1_2",
                "BASELINE_1_1"
            ],
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": true,
            "isLiveMigrationSupported": true,
            "isSubcore": true,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": {
                "defaultPerOcpu": 1,
                "max": 24,
                "min": 2
            },
            "maxVnicAttachments": 2,
            "memoryInGbs": 12,
            "memoryOptions": {
                "defaultPerOcpuInGBs": 12,
                "maxInGBs": 2098,
                "maxPerNumaNodeInGbs": 1049,
                "maxPerOcpuInGbs": 64,
                "minInGBs": 1,
                "minPerOcpuInGbs": 1
            },
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 1,
            "networkingBandwidthOptions": {
                "defaultPerOcpuInGbps": 1,
                "maxInGbps": 40,
                "minInGbps": 1
            },
            "ocpuOptions": {
                "max": 126,
                "maxPerNumaNode": 94,
                "min": 1
            },
            "ocpus": 1,
            "platformConfigOptions": {
                "accessControlServiceOptions": null,
                "inputOutputMemoryManagementUnitOptions": null,
                "measuredBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "memoryEncryptionOptions": null,
                "numaNodesPerSocketPlatformOptions": null,
                "percentageOfCoresEnabledOptions": null,
                "secureBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "symmetricMultiThreadingOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "trustedPlatformModuleOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "type": "AMD_VM",
                "virtualInstructionsOptions": null
            },
            "processorDescription": "2.3 GHz AMD EPYC™ 9J14 (Genoa)",
            "quotaNames": [
                "standard-e5-core-count",
                "standard-e5-memory-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": null,
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard.E5.Flex"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": true,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": {
                "defaultPerOcpu": 1,
                "max": 24,
                "min": 2
            },
            "maxVnicAttachments": 2,
            "memoryInGbs": 11,
            "memoryOptions": {
                "defaultPerOcpuInGBs": 11,
                "maxInGBs": 1454,
                "maxPerNumaNodeInGbs": 1454,
                "maxPerOcpuInGbs": 64,
                "minInGBs": 1,
                "minPerOcpuInGbs": 1
            },
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 1,
            "networkingBandwidthOptions": {
                "defaultPerOcpuInGbps": 1,
                "maxInGbps": 99.6,
                "minInGbps": 1
            },
            "ocpuOptions": {
                "max": 126,
                "maxPerNumaNode": 126,
                "min": 1
            },
            "ocpus": 1,
            "platformConfigOptions": {
                "accessControlServiceOptions": null,
                "inputOutputMemoryManagementUnitOptions": null,
                "measuredBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "memoryEncryptionOptions": null,
                "numaNodesPerSocketPlatformOptions": null,
                "percentageOfCoresEnabledOptions": null,
                "secureBootOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "symmetricMultiThreadingOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": true
                },
                "trustedPlatformModuleOptions": {
                    "allowedValues": [
                        true,
                        false
                    ],
                    "isDefaultEnabled": false
                },
                "type": "AMD_VM",
                "virtualInstructionsOptions": null
            },
            "processorDescription": "2.7 GHz AMD EPYC™ 9J45 (Turin)",
            "quotaNames": [
                "standard-e6-core-count",
                "standard-e6-memory-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": null,
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard.E6.Flex"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": 0,
            "isBilledForStoppedInstance": false,
            "isFlexible": true,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": 0,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": {
                "defaultPerOcpu": 1,
                "max": 24,
                "min": 2
            },
            "maxVnicAttachments": 2,
            "memoryInGbs": 6,
            "memoryOptions": {
                "defaultPerOcpuInGBs": 6,
                "maxInGBs": 946,
                "maxPerNumaNodeInGbs": 946,
                "maxPerOcpuInGbs": 64,
                "minInGBs": 1,
                "minPerOcpuInGbs": 1
            },
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": 1,
            "networkingBandwidthInGbps": 1,
            "networkingBandwidthOptions": {
                "defaultPerOcpuInGbps": 1,
                "maxInGbps": 78,
                "minInGbps": 1
            },
            "ocpuOptions": {
                "max": 78,
                "maxPerNumaNode": 78,
                "min": 1
            },
            "ocpus": 0.5,
            "platformConfigOptions": null,
            "processorDescription": "3.0 GHz Ampere® AmpereOne™ (Siryn™)",
            "quotaNames": [
                "standard-a2-core-regional-count",
                "standard-a2-core-count",
                "standard-a2-memory-regional-count",
                "standard-a2-memory-count"
            ],
            "rdmaBandwidthInGbps": 0,
            "rdmaPorts": 0,
            "recommendedAlternatives": null,
            "resizeCompatibleShapes": [
                "VM.Standard.A2.Flex",
                "VM.Standard.A1.Flex"
            ],
            "shape": "VM.Standard.A2.Flex"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": null,
            "isBilledForStoppedInstance": false,
            "isFlexible": true,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": null,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": {
                "defaultPerOcpu": null,
                "max": 24,
                "min": 2
            },
            "maxVnicAttachments": 2,
            "memoryInGbs": 16,
            "memoryOptions": {
                "defaultPerOcpuInGBs": null,
                "maxInGBs": 1024,
                "maxPerNumaNodeInGbs": 1024,
                "maxPerOcpuInGbs": 64,
                "minInGBs": 1,
                "minPerOcpuInGbs": 1
            },
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": null,
            "networkingBandwidthInGbps": null,
            "networkingBandwidthOptions": {
                "defaultPerOcpuInGbps": null,
                "maxInGbps": 40,
                "minInGbps": 1
            },
            "ocpuOptions": {
                "max": 64,
                "maxPerNumaNode": 64,
                "min": 1
            },
            "ocpus": 1,
            "platformConfigOptions": null,
            "processorDescription": "AMD processor. VM.Standard.E3 processor generation or later",
            "quotaNames": [
                "standard-amd-generic-core-count",
                "standard-amd-generic-memory-count"
            ],
            "rdmaBandwidthInGbps": null,
            "rdmaPorts": null,
            "recommendedAlternatives": null,
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard.AMD.Generic"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": null,
            "isBilledForStoppedInstance": false,
            "isFlexible": true,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": null,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": {
                "defaultPerOcpu": null,
                "max": 24,
                "min": 2
            },
            "maxVnicAttachments": 2,
            "memoryInGbs": 6,
            "memoryOptions": {
                "defaultPerOcpuInGBs": null,
                "maxInGBs": 512,
                "maxPerNumaNodeInGbs": 512,
                "maxPerOcpuInGbs": 64,
                "minInGBs": 1,
                "minPerOcpuInGbs": 1
            },
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": null,
            "networkingBandwidthInGbps": null,
            "networkingBandwidthOptions": {
                "defaultPerOcpuInGbps": null,
                "maxInGbps": 40,
                "minInGbps": 1
            },
            "ocpuOptions": {
                "max": 80,
                "maxPerNumaNode": 80,
                "min": 1
            },
            "ocpus": 1,
            "platformConfigOptions": null,
            "processorDescription": "Any Ampere processor",
            "quotaNames": [
                "standard-ampere-generic-core-count",
                "standard-ampere-generic-memory-count"
            ],
            "rdmaBandwidthInGbps": null,
            "rdmaPorts": null,
            "recommendedAlternatives": null,
            "resizeCompatibleShapes": [
                "VM.Standard.A1.Flex",
                "VM.Standard.Ampere.Generic",
                "VM.Standard.A2.Flex"
            ],
            "shape": "VM.Standard.Ampere.Generic"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": null,
            "isBilledForStoppedInstance": false,
            "isFlexible": true,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": null,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": {
                "defaultPerOcpu": null,
                "max": 24,
                "min": 2
            },
            "maxVnicAttachments": 2,
            "memoryInGbs": 16,
            "memoryOptions": {
                "defaultPerOcpuInGBs": null,
                "maxInGBs": 276,
                "maxPerNumaNodeInGbs": 276,
                "maxPerOcpuInGbs": 64,
                "minInGBs": 1,
                "minPerOcpuInGbs": 0
            },
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": null,
            "networkingBandwidthInGbps": null,
            "networkingBandwidthOptions": {
                "defaultPerOcpuInGbps": null,
                "maxInGbps": 24,
                "minInGbps": 1
            },
            "ocpuOptions": {
                "max": 24,
                "maxPerNumaNode": 24,
                "min": 1
            },
            "ocpus": 1,
            "platformConfigOptions": null,
            "processorDescription": "Intel processor. VM.Standard2 processor generation or later",
            "quotaNames": [
                "standard-intel-generic-core-count",
                "standard-intel-generic-memory-count"
            ],
            "rdmaBandwidthInGbps": null,
            "rdmaPorts": null,
            "recommendedAlternatives": null,
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard.Intel.Generic"
        },
        {
            "baselineOcpuUtilizations": null,
            "billingType": "PAID",
            "gpuDescription": null,
            "gpus": null,
            "isBilledForStoppedInstance": false,
            "isFlexible": true,
            "isLiveMigrationSupported": true,
            "isSubcore": false,
            "localDiskDescription": null,
            "localDisks": null,
            "localDisksTotalSizeInGbs": null,
            "maxVnicAttachmentOptions": {
                "defaultPerOcpu": null,
                "max": 24,
                "min": 2
            },
            "maxVnicAttachments": 2,
            "memoryInGbs": 16,
            "memoryOptions": {
                "defaultPerOcpuInGBs": null,
                "maxInGBs": 276,
                "maxPerNumaNodeInGbs": 276,
                "maxPerOcpuInGbs": 64,
                "minInGBs": 1,
                "minPerOcpuInGbs": 0
            },
            "minTotalBaselineOcpusRequired": null,
            "networkPorts": null,
            "networkingBandwidthInGbps": null,
            "networkingBandwidthOptions": {
                "defaultPerOcpuInGbps": null,
                "maxInGbps": 24,
                "minInGbps": 1
            },
            "ocpuOptions": {
                "max": 24,
                "maxPerNumaNode": 24,
                "min": 1
            },
            "ocpus": 1,
            "platformConfigOptions": null,
            "processorDescription": "Either an Intel or an AMD processor. VM.Standard2 processor generation or later (Intel) and VM.Standard.E3 processor generation or later (AMD)",
            "quotaNames": [
                "standard-x86-generic-core-count",
                "standard-x86-generic-memory-count"
            ],
            "rdmaBandwidthInGbps": null,
            "rdmaPorts": null,
            "recommendedAlternatives": null,
            "resizeCompatibleShapes": [
                "VM.Standard1.1",
                "VM.Standard1.2",
                "VM.Standard1.4",
                "VM.Standard1.8",
                "VM.Standard1.16",
                "VM.Standard.B1.1",
                "VM.Standard.B1.2",
                "VM.Standard.B1.4",
                "VM.Standard.B1.8",
                "VM.Standard.B1.16",
                "VM.Standard.E2.1",
                "VM.Standard.E2.2",
                "VM.Standard.E2.4",
                "VM.Standard.E2.8",
                "VM.Standard2.1",
                "VM.Standard2.2",
                "VM.Standard2.4",
                "VM.Standard2.8",
                "VM.Standard2.16",
                "VM.Standard2.24",
                "VM.Standard.E3.Flex",
                "VM.Standard.E4.Flex",
                "VM.Standard.E5.Flex",
                "VM.Standard3.Flex",
                "VM.Standard.AMD.Generic",
                "VM.Standard.Intel.Generic",
                "VM.Standard.x86.Generic",
                "VM.Standard.E6.Flex"
            ],
            "shape": "VM.Standard.x86.Generic"
        }
    ]
} as Shapes;