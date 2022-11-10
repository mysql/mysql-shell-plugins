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

/* eslint-disable max-len */

import {
    ICompartment, IComputeInstance, IMySQLDbSystemShapeSummary, IMySQLDbSystem, ILoadBalancer, IBastionSummary,
    IBastionSession,
} from "./Oci";
import { IShellDictionary } from "./Protocol";

/* eslint-disable max-len */

export enum ShellAPIMds {
    //  Begin auto generated API names
    MdsGetRegions = "mds.get.regions",
    MdsListConfigProfiles = "mds.list.config_profiles",
    MdsSetDefaultConfigProfile = "mds.set.default_config_profile",
    MdsGetDefaultConfigProfile = "mds.get.default_config_profile",
    MdsSetCurrentCompartment = "mds.set.current_compartment",
    MdsGetCurrentCompartmentId = "mds.get.current_compartment_id",
    MdsSetCurrentBastion = "mds.set.current_bastion",
    MdsGetAvailabilityDomain = "mds.get.availability_domain",
    MdsListCompartments = "mds.list.compartments",
    MdsGetCompartment = "mds.get.compartment",
    MdsListComputeInstances = "mds.list.compute_instances",
    MdsGetComputeInstance = "mds.get.compute_instance",
    MdsListComputeShapes = "mds.list.compute_shapes",
    MdsDeleteComputeInstance = "mds.delete.compute_instance",
    MdsUtilHeatWaveLoadData = "mds.util.heat_wave_load_data",
    MdsUtilCreateMdsEndpoint = "mds.util.create_mds_endpoint",
    MdsGetDbSystemConfiguration = "mds.get.db_system_configuration",
    MdsListDbSystemShapes = "mds.list.db_system_shapes",
    MdsListDbSystems = "mds.list.db_systems",
    MdsGetDbSystem = "mds.get.db_system",
    MdsGetDbSystemId = "mds.get.db_system_id",
    MdsUpdateDbSystem = "mds.update.db_system",
    MdsCreateDbSystem = "mds.create.db_system",
    MdsDeleteDbSystem = "mds.delete.db_system",
    MdsStopDbSystem = "mds.stop.db_system",
    MdsStartDbSystem = "mds.start.db_system",
    MdsRestartDbSystem = "mds.restart.db_system",
    MdsStopHeatWaveCluster = "mds.stop.heat_wave_cluster",
    MdsStartHeatWaveCluster = "mds.start.heat_wave_cluster",
    MdsRestartHeatWaveCluster = "mds.restart.heat_wave_cluster",
    MdsCreateHeatWaveCluster = "mds.create.heat_wave_cluster",
    MdsUpdateHeatWaveCluster = "mds.update.heat_wave_cluster",
    MdsDeleteHeatWaveCluster = "mds.delete.heat_wave_cluster",
    MdsListLoadBalancers = "mds.list.load_balancers",
    MdsListBastions = "mds.list.bastions",
    MdsGetBastion = "mds.get.bastion",
    MdsCreateBastion = "mds.create.bastion",
    MdsDeleteBastion = "mds.delete.bastion",
    MdsListBastionSessions = "mds.list.bastion_sessions",
    MdsGetBastionSession = "mds.get.bastion_session",
    MdsCreateBastionSession = "mds.create.bastion_session",
    MdsDeleteBastionSession = "mds.delete.bastion_session",
    //  End auto generated API names
}

export interface IShellListConfigProfilesKwargs {
    configFilePath?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
}

export interface IShellSetCurrentCompartmentKwargs {
    compartmentPath?: string;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    profileName?: string;
    cliRcFilePath?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}

export interface IShellGetCurrentCompartmentIdKwargs {
    compartmentId?: string;
    config?: IShellDictionary;
    profileName?: string;
    cliRcFilePath?: string;
}

export interface IShellSetCurrentBastionKwargs {
    bastionName?: string;
    bastionId?: string;
    compartmentId?: string;
    config?: object;
    configProfile?: string;
    profileName?: string;
    cliRcFilePath?: string;
    raiseExceptions?: boolean;
    interactive?: boolean;
}


export interface IShellGetAvailabilityDomainKwargs {
    availabilityDomain?: string;
    randomSelection?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
    returnPythonObject?: boolean;
}


export interface IShellListCompartmentsKwargs {
    compartmentId?: string;
    includeTenancy?: boolean;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
}

export interface IShellGetCompartmentKwargs {
    parentCompartmentId?: string;
    config?: object;
    interactive?: boolean;
}

export interface IShellListComputeInstancesKwargs {
    compartmentId?: string;
    config?: object;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
}


export interface IShellGetComputeInstanceKwargs {
    instanceName?: string;
    instanceId?: string;
    ignoreCurrent?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
    returnPythonObject?: boolean;
}


export interface IShellListComputeShapesKwargs {
    limitShapesTo?: unknown[];
    availabilityDomain?: string;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
    returnPythonObject?: boolean;
}


export interface IShellDeleteComputeInstanceKwargs {
    instanceName?: string;
    instanceId?: string;
    awaitDeletion?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    ignoreCurrent?: boolean;
    interactive?: boolean;
    raiseExceptions?: boolean;
}

export interface IShellUtilHeatWaveLoadDataKwargs {
    schemas?: unknown[];
    mode?: string;
    output?: string;
    disableUnsupportedColumns?: boolean;
    optimizeLoadParallelism?: boolean;
    enableMemoryCheck?: boolean;
    sqlMode?: string;
    excludeList?: string;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}

export interface IShellUtilCreateMdsEndpointKwargs {
    instanceName?: string;
    dbSystemName?: string;
    dbSystemId?: string;
    privateKeyFilePath?: string;
    compartmentId?: string;
    config?: object;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
}


export interface IShellGetDbSystemConfigurationKwargs {
    configName?: string;
    configurationId?: string;
    shape?: string;
    availabilityDomain?: string;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
    returnPythonObject?: boolean;
}


export interface IShellListDbSystemShapesKwargs {
    isSupportedFor?: string;
    availabilityDomain?: string;
    compartmentId?: string;
    config?: object;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
    returnPythonObject?: boolean;
}


export interface IShellListDbSystemsKwargs {
    compartmentId?: string;
    config?: object;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
    returnPythonObject?: boolean;
}

export interface IShellGetDbSystemKwargs {
    dbSystemName?: string;
    dbSystemId?: string;
    ignoreCurrent?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
    returnPythonObject?: boolean;
}

export interface IShellGetDbSystemIdKwargs {
    dbSystemName?: string;
    ignoreCurrent?: boolean;
    compartmentId?: string;
    config?: object;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}

export interface IShellUpdateDbSystemKwargs {
    dbSystemName?: string;
    dbSystemId?: string;
    ignoreCurrent?: boolean;
    newName?: string;
    newDescription?: string;
    newFreeformTags?: string;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellCreateDbSystemKwargs {
    dbSystemName?: string;
    description?: string;
    availabilityDomain?: string;
    shape?: string;
    subnetId?: string;
    configurationId?: string;
    dataStorageSizeInGbs?: number;
    mysqlVersion?: string;
    adminUsername?: string;
    adminPassword?: string;
    privateKeyFilePath?: string;
    parUrl?: string;
    performCleanupAfterImport?: boolean;
    sourceMysqlUri?: string;
    sourceMysqlPassword?: string;
    sourceLocalDumpDir?: string;
    sourceBucket?: string;
    hostImageId?: string;
    definedTags?: IShellDictionary;
    freeformTags?: IShellDictionary;
    compartmentId?: string;
    config?: object;
    interactive?: boolean;
    returnObject?: boolean;
}


export interface IShellDeleteDbSystemKwargs {
    dbSystemName?: string;
    dbSystemId?: string;
    awaitCompletion?: boolean;
    ignoreCurrent?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellStopDbSystemKwargs {
    dbSystemName?: string;
    dbSystemId?: string;
    awaitCompletion?: boolean;
    ignoreCurrent?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellStartDbSystemKwargs {
    dbSystemName?: string;
    dbSystemId?: string;
    awaitCompletion?: boolean;
    ignoreCurrent?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellRestartDbSystemKwargs {
    dbSystemName?: string;
    dbSystemId?: string;
    awaitCompletion?: boolean;
    ignoreCurrent?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellStopHeatWaveClusterKwargs {
    dbSystemName?: string;
    dbSystemId?: string;
    awaitCompletion?: boolean;
    ignoreCurrent?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellStartHeatWaveClusterKwargs {
    dbSystemName?: string;
    dbSystemId?: string;
    awaitCompletion?: boolean;
    ignoreCurrent?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellRestartHeatWaveClusterKwargs {
    dbSystemName?: string;
    dbSystemId?: string;
    awaitCompletion?: boolean;
    ignoreCurrent?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellCreateHeatWaveClusterKwargs {
    dbSystemName?: string;
    dbSystemId?: string;
    ignoreCurrent?: boolean;
    clusterSize?: number;
    shapeName?: string;
    awaitCompletion?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellUpdateHeatWaveClusterKwargs {
    dbSystemName?: string;
    dbSystemId?: string;
    ignoreCurrent?: boolean;
    clusterSize?: number;
    shapeName?: string;
    awaitCompletion?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellDeleteHeatWaveClusterKwargs {
    dbSystemName?: string;
    dbSystemId?: string;
    awaitCompletion?: boolean;
    ignoreCurrent?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellListLoadBalancersKwargs {
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    returnType?: string;
    raiseExceptions?: boolean;
}


export interface IShellListBastionsKwargs {
    compartmentId?: string;
    validForDbSystemId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    returnType?: string;
    raiseExceptions?: boolean;
}


export interface IShellGetBastionKwargs {
    bastionName?: string;
    bastionId?: string;
    awaitState?: string;
    ignoreCurrent?: boolean;
    fallbackToAnyInCompartment?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    returnType?: string;
    raiseExceptions?: boolean;
}


export interface IShellCreateBastionKwargs {
    bastionName?: string;
    dbSystemId?: string;
    clientCidr?: string;
    maxSessionTtlInSeconds?: number;
    targetSubnetId?: string;
    awaitActiveState?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    ignoreCurrent?: boolean;
    interactive?: boolean;
    returnType?: string;
    raiseExceptions?: boolean;
}


export interface IShellDeleteBastionKwargs {
    bastionName?: string;
    bastionId?: string;
    awaitDeletion?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    ignoreCurrent?: boolean;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellListBastionSessionsKwargs {
    bastionId?: string;
    ignoreCurrent?: boolean;
    compartmentId?: string;
    config?: object;
    configProfile?: string;
    interactive?: boolean;
    returnType?: string;
    raiseExceptions?: boolean;
}


export interface IShellGetBastionSessionKwargs {
    sessionName?: string;
    sessionId?: string;
    bastionId?: string;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    ignoreCurrent?: boolean;
    interactive?: boolean;
    returnType?: string;
    raiseExceptions?: boolean;
}


export interface IShellCreateBastionSessionKwargs {
    bastionName?: string;
    bastionId?: string;
    fallbackToAnyInCompartment?: boolean;
    sessionType?: string;
    sessionName?: string;
    targetId?: string;
    targetIp?: string;
    targetPort?: string;
    targetUser?: string;
    ttlInSeconds?: number;
    publicKeyFile?: string;
    publicKeyContent?: string;
    awaitCreation?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    ignoreCurrent?: boolean;
    interactive?: boolean;
    returnType?: string;
    raiseExceptions?: boolean;
}


export interface IShellDeleteBastionSessionKwargs {
    sessionName?: string;
    sessionId?: string;
    bastionName?: string;
    bastionId?: string;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    ignoreCurrent?: boolean;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


/** The mapping between an MDS module API name and the accepted parameters for it. */
export interface IProtocolMdsParameters {
    [ShellAPIMds.MdsGetRegions]: {};
    [ShellAPIMds.MdsListConfigProfiles]: { kwargs?: IShellListConfigProfilesKwargs };
    [ShellAPIMds.MdsSetDefaultConfigProfile]: { args: { profileName?: string; configFileLocation?: string; cliRcFileLocation?: string } };
    [ShellAPIMds.MdsGetDefaultConfigProfile]: { args: { cliRcFileLocation?: string } };
    [ShellAPIMds.MdsSetCurrentCompartment]: { kwargs?: IShellSetCurrentCompartmentKwargs };
    [ShellAPIMds.MdsGetCurrentCompartmentId]: { kwargs?: IShellGetCurrentCompartmentIdKwargs };
    [ShellAPIMds.MdsSetCurrentBastion]: { kwargs?: IShellSetCurrentBastionKwargs };
    [ShellAPIMds.MdsGetAvailabilityDomain]: { kwargs?: IShellGetAvailabilityDomainKwargs };
    [ShellAPIMds.MdsListCompartments]: { kwargs?: IShellListCompartmentsKwargs };
    [ShellAPIMds.MdsGetCompartment]: { args: { compartmentPath?: string }; kwargs?: IShellGetCompartmentKwargs };
    [ShellAPIMds.MdsListComputeInstances]: { kwargs?: IShellListComputeInstancesKwargs };
    [ShellAPIMds.MdsGetComputeInstance]: { kwargs?: IShellGetComputeInstanceKwargs };
    [ShellAPIMds.MdsListComputeShapes]: { kwargs?: IShellListComputeShapesKwargs };
    [ShellAPIMds.MdsDeleteComputeInstance]: { kwargs?: IShellDeleteComputeInstanceKwargs };
    [ShellAPIMds.MdsUtilHeatWaveLoadData]: { kwargs?: IShellUtilHeatWaveLoadDataKwargs };
    [ShellAPIMds.MdsUtilCreateMdsEndpoint]: { kwargs?: IShellUtilCreateMdsEndpointKwargs };
    [ShellAPIMds.MdsGetDbSystemConfiguration]: { kwargs?: IShellGetDbSystemConfigurationKwargs };
    [ShellAPIMds.MdsListDbSystemShapes]: { kwargs?: IShellListDbSystemShapesKwargs };
    [ShellAPIMds.MdsListDbSystems]: { kwargs?: IShellListDbSystemsKwargs };
    [ShellAPIMds.MdsGetDbSystem]: { kwargs?: IShellGetDbSystemKwargs };
    [ShellAPIMds.MdsGetDbSystemId]: { kwargs?: IShellGetDbSystemIdKwargs };
    [ShellAPIMds.MdsUpdateDbSystem]: { kwargs?: IShellUpdateDbSystemKwargs };
    [ShellAPIMds.MdsCreateDbSystem]: { kwargs?: IShellCreateDbSystemKwargs };
    [ShellAPIMds.MdsDeleteDbSystem]: { kwargs?: IShellDeleteDbSystemKwargs };
    [ShellAPIMds.MdsStopDbSystem]: { kwargs?: IShellStopDbSystemKwargs };
    [ShellAPIMds.MdsStartDbSystem]: { kwargs?: IShellStartDbSystemKwargs };
    [ShellAPIMds.MdsRestartDbSystem]: { kwargs?: IShellRestartDbSystemKwargs };
    [ShellAPIMds.MdsStopHeatWaveCluster]: { kwargs?: IShellStopHeatWaveClusterKwargs };
    [ShellAPIMds.MdsStartHeatWaveCluster]: { kwargs?: IShellStartHeatWaveClusterKwargs };
    [ShellAPIMds.MdsRestartHeatWaveCluster]: { kwargs?: IShellRestartHeatWaveClusterKwargs };
    [ShellAPIMds.MdsCreateHeatWaveCluster]: { kwargs?: IShellCreateHeatWaveClusterKwargs };
    [ShellAPIMds.MdsUpdateHeatWaveCluster]: { kwargs?: IShellUpdateHeatWaveClusterKwargs };
    [ShellAPIMds.MdsDeleteHeatWaveCluster]: { kwargs?: IShellDeleteHeatWaveClusterKwargs };
    [ShellAPIMds.MdsListLoadBalancers]: { kwargs?: IShellListLoadBalancersKwargs };
    [ShellAPIMds.MdsListBastions]: { kwargs?: IShellListBastionsKwargs };
    [ShellAPIMds.MdsGetBastion]: { kwargs?: IShellGetBastionKwargs };
    [ShellAPIMds.MdsCreateBastion]: { kwargs?: IShellCreateBastionKwargs };
    [ShellAPIMds.MdsDeleteBastion]: { kwargs?: IShellDeleteBastionKwargs };
    [ShellAPIMds.MdsListBastionSessions]: { kwargs?: IShellListBastionSessionsKwargs };
    [ShellAPIMds.MdsGetBastionSession]: { kwargs?: IShellGetBastionSessionKwargs };
    [ShellAPIMds.MdsCreateBastionSession]: { kwargs?: IShellCreateBastionSessionKwargs };
    [ShellAPIMds.MdsDeleteBastionSession]: { kwargs?: IShellDeleteBastionSessionKwargs };
}

export interface IMdsProfileData {
    fingerprint: string;
    keyFile: string;
    profile: string;
    region: string;
    tenancy: string;
    user: string;
    isCurrent: boolean;
}

export interface IProtocolMdsResults {
    // Begin auto generated API result mappings.
    [ShellAPIMds.MdsGetRegions]: {};
    [ShellAPIMds.MdsListConfigProfiles]: { result: IMdsProfileData[] };
    [ShellAPIMds.MdsSetDefaultConfigProfile]: {};
    [ShellAPIMds.MdsGetDefaultConfigProfile]: {};
    [ShellAPIMds.MdsSetCurrentCompartment]: {};
    [ShellAPIMds.MdsGetCurrentCompartmentId]: {};
    [ShellAPIMds.MdsSetCurrentBastion]: {};
    [ShellAPIMds.MdsGetAvailabilityDomain]: {};
    [ShellAPIMds.MdsListCompartments]: { result: ICompartment[] };
    [ShellAPIMds.MdsGetCompartment]: {};
    [ShellAPIMds.MdsListComputeInstances]: { result: IComputeInstance[] };
    [ShellAPIMds.MdsGetComputeInstance]: {};
    [ShellAPIMds.MdsListComputeShapes]: {};
    [ShellAPIMds.MdsDeleteComputeInstance]: {};
    [ShellAPIMds.MdsUtilHeatWaveLoadData]: {};
    [ShellAPIMds.MdsUtilCreateMdsEndpoint]: {};
    [ShellAPIMds.MdsGetDbSystemConfiguration]: {};
    [ShellAPIMds.MdsListDbSystemShapes]: { result: IMySQLDbSystemShapeSummary[] };
    [ShellAPIMds.MdsListDbSystems]: { result: IMySQLDbSystem[] };
    [ShellAPIMds.MdsGetDbSystem]: { result: IMySQLDbSystem };
    [ShellAPIMds.MdsGetDbSystemId]: {};
    [ShellAPIMds.MdsUpdateDbSystem]: {};
    [ShellAPIMds.MdsCreateDbSystem]: {};
    [ShellAPIMds.MdsDeleteDbSystem]: {};
    [ShellAPIMds.MdsStopDbSystem]: {};
    [ShellAPIMds.MdsStartDbSystem]: {};
    [ShellAPIMds.MdsRestartDbSystem]: {};
    [ShellAPIMds.MdsStopHeatWaveCluster]: {};
    [ShellAPIMds.MdsStartHeatWaveCluster]: {};
    [ShellAPIMds.MdsRestartHeatWaveCluster]: {};
    [ShellAPIMds.MdsCreateHeatWaveCluster]: {};
    [ShellAPIMds.MdsUpdateHeatWaveCluster]: {};
    [ShellAPIMds.MdsDeleteHeatWaveCluster]: {};
    [ShellAPIMds.MdsListLoadBalancers]: { result: ILoadBalancer[] };
    [ShellAPIMds.MdsListBastions]: { result: IBastionSummary[] };
    [ShellAPIMds.MdsGetBastion]: { result: IBastionSummary };
    [ShellAPIMds.MdsCreateBastion]: { result: IBastionSummary };
    [ShellAPIMds.MdsDeleteBastion]: {};
    [ShellAPIMds.MdsListBastionSessions]: {};
    [ShellAPIMds.MdsGetBastionSession]: {};
    [ShellAPIMds.MdsCreateBastionSession]: { result: IBastionSession };
    [ShellAPIMds.MdsDeleteBastionSession]: {};
    // End auto generated API result mappings.
}
