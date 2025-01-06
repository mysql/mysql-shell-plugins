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

/* eslint-disable max-len */

import {
    ICompartment, IComputeInstance, IMySQLDbSystemShapeSummary, IMySQLDbSystem, LoadBalancer, IBastionSummary,
    IBastionSession, IComputeShape, IBucketSummary, IBucketListObjects,
} from "./Oci.js";
import { IShellDictionary } from "./Protocol.js";


export enum ShellAPIMds {
    /** Returns the list of available OCI regions */
    MdsGetRegions = "mds.get.regions",
    /** Lists all available profiles */
    MdsListConfigProfiles = "mds.list.config_profiles",
    /** Sets the default profile */
    MdsSetDefaultConfigProfile = "mds.set.default_config_profile",
    /** Gets the default profile if stored in the CLI config file */
    MdsGetDefaultConfigProfile = "mds.get.default_config_profile",
    /** Sets the current compartment */
    MdsSetCurrentCompartment = "mds.set.current_compartment",
    /** Gets the current compartment_id */
    MdsGetCurrentCompartmentId = "mds.get.current_compartment_id",
    /** Makes the given Bastion the current object */
    MdsSetCurrentBastion = "mds.set.current_bastion",
    /** Returns the name of a randomly chosen availability_domain */
    MdsGetAvailabilityDomain = "mds.get.availability_domain",
    /** Lists compartments */
    MdsListCompartments = "mds.list.compartments",
    /** Gets a compartment by id */
    MdsGetCompartmentById = "mds.get.compartment_by_id",
    /** Gets a compartment by path */
    MdsGetCompartment = "mds.get.compartment",
    /** Lists instances */
    MdsListComputeInstances = "mds.list.compute_instances",
    /** Returns an instance object based on instance_name or instance_id */
    MdsGetComputeInstance = "mds.get.compute_instance",
    /** Returns a list of all available compute shapes */
    MdsListComputeShapes = "mds.list.compute_shapes",
    /** Deletes the compute instance with the given name */
    MdsDeleteComputeInstance = "mds.delete.compute_instance",
    /** Loads data to a HeatWave Cluster */
    MdsUtilHeatWaveLoadData = "mds.util.heat_wave_load_data",
    /** Creates a public endpoint using MySQL Router on a compute instance */
    MdsUtilCreateEndpoint = "mds.util.create_endpoint",
    /** Gets a DB System Config */
    MdsGetDbSystemConfiguration = "mds.get.db_system_configuration",
    /** Lists Shapes available for MySQL DB Systems */
    MdsListDbSystemShapes = "mds.list.db_system_shapes",
    /** Lists MySQL DB Systems */
    MdsListDbSystems = "mds.list.db_systems",
    /** Gets a DbSystem with the given id */
    MdsGetDbSystem = "mds.get.db_system",
    /** Gets information about the DbSystem with the given id */
    MdsGetDbSystemId = "mds.get.db_system_id",
    /** Updates the DbSystem with the given id */
    MdsUpdateDbSystem = "mds.update.db_system",
    /** Creates a DbSystem with the given id */
    MdsCreateDbSystem = "mds.create.db_system",
    /** Updates the DbSystem with the given id */
    MdsDeleteDbSystem = "mds.delete.db_system",
    /** Stops the DbSystem with the given id */
    MdsStopDbSystem = "mds.stop.db_system",
    /** Starts the DbSystem with the given id */
    MdsStartDbSystem = "mds.start.db_system",
    /** Restarts the DbSystem with the given id */
    MdsRestartDbSystem = "mds.restart.db_system",
    /** Stops the HeatWave cluster with the given DBSystem id */
    MdsStopHeatWaveCluster = "mds.stop.heat_wave_cluster",
    /** Starts the HeatWave cluster with the given DBSystem id */
    MdsStartHeatWaveCluster = "mds.start.heat_wave_cluster",
    /** Restarts the HeatWave cluster with the given DBSystem id */
    MdsRestartHeatWaveCluster = "mds.restart.heat_wave_cluster",
    /** Adds a HeatWave cluster to the DbSystem with the given id */
    MdsCreateHeatWaveCluster = "mds.create.heat_wave_cluster",
    /** Update the HeatWave cluster for a DbSystem with the given id */
    MdsUpdateHeatWaveCluster = "mds.update.heat_wave_cluster",
    /** Deletes the DbSystem with the given id */
    MdsDeleteHeatWaveCluster = "mds.delete.heat_wave_cluster",
    /** Lists load balancers */
    MdsListLoadBalancers = "mds.list.load_balancers",
    /** Lists object store buckets */
    MdsListBuckets = "mds.list.buckets",
    /** Deletes an object store bucket objects */
    MdsDeleteBucketObject = "mds.delete.bucket_object",
    /** Creates a new object store bucket object */
    MdsCreateBucketObjects = "mds.create.bucket_objects",
    /** Lists bucket object */
    MdsListBucketObjects = "mds.list.bucket_objects",
    /** Lists bastions */
    MdsListBastions = "mds.list.bastions",
    /** Gets a Bastion with the given id */
    MdsGetBastion = "mds.get.bastion",
    /** Creates a Bastion */
    MdsCreateBastion = "mds.create.bastion",
    /** Deletes a Bastion with the given id */
    MdsDeleteBastion = "mds.delete.bastion",
    /** Lists bastion sessions */
    MdsListBastionSessions = "mds.list.bastion_sessions",
    /** Gets a Bastion Session with the given id */
    MdsGetBastionSession = "mds.get.bastion_session",
    /** Creates a Bastion Session for the given bastion_id */
    MdsCreateBastionSession = "mds.create.bastion_session",
    /** Deletes a Bastion Session with the given id */
    MdsDeleteBastionSession = "mds.delete.bastion_session",
    /** Returns status information about the current GenAI setup */
    MdsGenaiStatus = "mds.genai.status",
    /** Configures a local model setup */
    MdsGenaiConfigure = "mds.genai.configure",
    /** Processes a chat request and return a generated answer */
    MdsGenaiChat = "mds.genai.chat",
    /** Gets lakehouse status information */
    MdsGenaiLakehouseStatus = "mds.genai.lakehouse_status",
    /** Saves chat options to a file */
    MdsGenaiSaveChatOptions = "mds.genai.save_chat_options",
    /** Loads the chat options from a file */
    MdsGenaiLoadChatOptions = "mds.genai.load_chat_options"
}

export interface IShellMdsListConfigProfilesKwargs {
    /** The file location of the OCI config file */
    configFilePath?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If set to true exceptions are raised */
    raiseExceptions?: boolean;
    /** If set to true, a list object is returned */
    returnFormatted?: boolean;
}

export interface IShellMdsSetCurrentCompartmentKwargs {
    /** The path of the compartment */
    compartmentPath?: string;
    /** The OCID of the compartment */
    compartmentId?: string;
    /** The config dict to use */
    config?: IShellDictionary;
    /** The name of the profile currently */
    configProfile?: string;
    /** The profile_name is already defined */
    profileName?: string;
    /** The location of the OCI CLI config file */
    cliRcFilePath?: string;
    /** Whether information should be printed */
    interactive?: boolean;
    /** Whether exceptions should be raised */
    raiseExceptions?: boolean;
}

export interface IShellMdsGetCurrentCompartmentIdKwargs {
    /** If specified, returned instead of the current */
    compartmentId?: string;
    /** The config to be used, None defaults to global config */
    config?: IShellDictionary;
    /** Name of the config profile */
    profileName?: string;
    /** The location of the OCI CLI config file */
    cliRcFilePath?: string;
}

export interface IShellMdsSetCurrentBastionKwargs {
    /** The name of the bastion */
    bastionName?: string;
    /** The OCID of the bastion */
    bastionId?: string;
    /** OCID of the compartment. */
    compartmentId?: string;
    /** An OCI config object or None. */
    config?: object;
    /** The name of the profile currently */
    configProfile?: string;
    /** The name of the profile currently in use */
    profileName?: string;
    /** The location of the OCI CLI config file */
    cliRcFilePath?: string;
    /** Whether exceptions should be raised */
    raiseExceptions?: boolean;
    /** Whether information should be printed */
    interactive?: boolean;
}

export interface IShellMdsGetAvailabilityDomainKwargs {
    /** The name of the availability_domain. */
    availabilityDomain?: string;
    /** Whether a random selection should be made */
    randomSelection?: boolean;
    /** OCID of the parent compartment. */
    compartmentId?: string;
    /** An OCI config object or None */
    config?: IShellDictionary;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If true exceptions are raised */
    raiseExceptions?: boolean;
    /** If true a human readable string is returned */
    returnFormatted?: boolean;
    /** Used for internal plugin calls */
    returnPythonObject?: boolean;
}

export interface IShellMdsListCompartmentsKwargs {
    /** OCID of the parent compartment */
    compartmentId?: string;
    /** Whether to include the tenancy as compartment */
    includeTenancy?: boolean;
    /** An OCI config object or None */
    config?: IShellDictionary;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If set to true exceptions are raised */
    raiseExceptions?: boolean;
    /** If set to true, a list object is returned */
    returnFormatted?: boolean;
}

export interface IShellMdsGetCompartmentByIdKwargs {
    /** An OCI config object or None. */
    config?: object;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Whether exceptions are raised */
    interactive?: boolean;
}

export interface IShellMdsGetCompartmentKwargs {
    /** OCID of the parent compartment */
    parentCompartmentId?: string;
    /** An OCI config object or None. */
    config?: object;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Whether exceptions are raised */
    interactive?: boolean;
}

export interface IShellMdsListComputeInstancesKwargs {
    /** OCID of the parent compartment. */
    compartmentId?: string;
    /** An OCI config object or None. */
    config?: object;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If set to true exceptions are raised */
    raiseExceptions?: boolean;
    /** If set to true, a list object is returned. */
    returnFormatted?: boolean;
}

export interface IShellMdsGetComputeInstanceKwargs {
    /** The name of the instance */
    instanceName?: string;
    /** OCID of the instance */
    instanceId?: string;
    /** Whether the current instance should be ignored */
    ignoreCurrent?: boolean;
    /** OCID of the compartment */
    compartmentId?: string;
    /** An OCI config object or None */
    config?: IShellDictionary;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If true exceptions are raised */
    raiseExceptions?: boolean;
    /** If true a human readable string is returned */
    returnFormatted?: boolean;
    /** Used for internal plugin calls */
    returnPythonObject?: boolean;
}

export interface IShellMdsListComputeShapesKwargs {
    /** A list of shape names */
    limitShapesTo?: unknown[];
    /** The name of the availability_domain to use */
    availabilityDomain?: string;
    /** OCID of the compartment */
    compartmentId?: string;
    /** An OCI config object or None */
    config?: IShellDictionary;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If true exceptions are raised */
    raiseExceptions?: boolean;
    /** If true a human readable string is returned */
    returnFormatted?: boolean;
    /** Used for internal plugin calls */
    returnPythonObject?: boolean;
}

export interface IShellMdsDeleteComputeInstanceKwargs {
    /** The name of the instance. */
    instanceName?: string;
    /** The OCID of the instance */
    instanceId?: string;
    /** Whether to wait till the bastion reaches lifecycle state DELETED */
    awaitDeletion?: boolean;
    /** OCID of the compartment. */
    compartmentId?: string;
    /** An OCI config object or None. */
    config?: IShellDictionary;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Whether the current instance should be ignored */
    ignoreCurrent?: boolean;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If set to true exceptions are raised */
    raiseExceptions?: boolean;
}

export interface IShellMdsUtilHeatWaveLoadDataKwargs {
    /** The list of schemas */
    schemas?: unknown[];
    /** The mode to use, "normal"|"dryrun" */
    mode?: string;
    /** The output mode to use, "normal"|"compact"|"silent"|"help" */
    output?: string;
    /** Whether to disable unsupported columns */
    disableUnsupportedColumns?: boolean;
    /** Whether to optimize parallelism */
    optimizeLoadParallelism?: boolean;
    /** Whether to enable the memory check */
    enableMemoryCheck?: boolean;
    /** The sql_mode to use */
    sqlMode?: string;
    /** The database object list to exclude */
    excludeList?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If set to true exceptions are raised */
    raiseExceptions?: boolean;
}

export interface IShellMdsUtilCreateEndpointKwargs {
    /** Name of the compute instance */
    instanceName?: string;
    /** The new name of the DB System. */
    dbSystemName?: string;
    /** The OCID of the db_system */
    dbSystemId?: string;
    /** The file path to an SSH private key */
    privateKeyFilePath?: string;
    /** The name of the shape to use */
    shape?: string;
    /** The number of OCPUs */
    cpuCount?: number;
    /** The amount of memory */
    memorySize?: number;
    /** The MySQL user name to use for bootstrapping */
    mysqlUserName?: string;
    /** If set to true, a public IP will be assigned to the compute instance */
    publicIp?: boolean;
    /** The domain name of the compute instance */
    domainName?: string;
    /** Whether port forwarding of MySQL ports should be enabled */
    portForwarding?: boolean;
    /** Whether the MySQL REST Service (MRS) should be enabled */
    mrs?: boolean;
    /** Whether SSL Certificates should be managed */
    sslCert?: boolean;
    /** The JWT secret for MRS */
    jwtSecret?: string;
    /** The OCID of the compartment */
    compartmentId?: string;
    /** An OCI config object or None. */
    config?: object;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If set to true exceptions are raised */
    raiseExceptions?: boolean;
    /** If set to true, a list object is returned */
    returnFormatted?: boolean;
}

export interface IShellMdsGetDbSystemConfigurationKwargs {
    /** The name of the config. */
    configName?: string;
    /** The OCID of the configuration. */
    configurationId?: string;
    /** The name of the compute shape. */
    shape?: string;
    /** The name of the availability domain. */
    availabilityDomain?: string;
    /** OCID of the parent compartment */
    compartmentId?: string;
    /** An OCI config object or None */
    config?: IShellDictionary;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If true exceptions are raised */
    raiseExceptions?: boolean;
    /** If true a human readable string is returned */
    returnFormatted?: boolean;
    /** Used for internal plugin calls */
    returnPythonObject?: boolean;
}

export interface IShellMdsListDbSystemShapesKwargs {
    /** Either DBSYSTEM (default), HEATWAVECLUSTER or "DBSYSTEM, HEATWAVECLUSTER" */
    isSupportedFor?: string;
    /** The name of the availability_domain to use */
    availabilityDomain?: string;
    /** OCID of the parent compartment. */
    compartmentId?: string;
    /** An OCI config object or None. */
    config?: object;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If set to true exceptions are raised */
    raiseExceptions?: boolean;
    /** If set to true, a list object is returned. */
    returnFormatted?: boolean;
    /** Used for internal plugin calls */
    returnPythonObject?: boolean;
}

export interface IShellMdsListDbSystemsKwargs {
    /** OCID of the parent compartment. */
    compartmentId?: string;
    /** An OCI config object or None. */
    config?: object;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If set to true exceptions are raised */
    raiseExceptions?: boolean;
    /** If set to true, a list object is returned. */
    returnFormatted?: boolean;
    /** Used for internal plugin calls */
    returnPythonObject?: boolean;
}

export interface IShellMdsGetDbSystemKwargs {
    /** The new name of the compartment. */
    dbSystemName?: string;
    /** OCID of the DbSystem. */
    dbSystemId?: string;
    /** Whether to not default to the current bastion. */
    ignoreCurrent?: boolean;
    /** OCID of the parent compartment */
    compartmentId?: string;
    /** An OCI config object or None */
    config?: IShellDictionary;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If true exceptions are raised */
    raiseExceptions?: boolean;
    /** If true a human readable string is returned */
    returnFormatted?: boolean;
    /** Used for internal plugin calls */
    returnPythonObject?: boolean;
}

export interface IShellMdsGetDbSystemIdKwargs {
    /** The new name of the compartment. */
    dbSystemName?: string;
    /** Whether to not default to the current bastion. */
    ignoreCurrent?: boolean;
    /** OCID of the compartment. */
    compartmentId?: string;
    /** An OCI config object or None. */
    config?: object;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If true exceptions are raised */
    raiseExceptions?: boolean;
}

export interface IShellMdsUpdateDbSystemKwargs {
    /** The name of the DB System. */
    dbSystemName?: string;
    /** OCID of the DbSystem. */
    dbSystemId?: string;
    /** Whether to not default to the current bastion. */
    ignoreCurrent?: boolean;
    /** The new name */
    newName?: string;
    /** The new description */
    newDescription?: string;
    /** The new freeform_tags formatted as string */
    newFreeformTags?: string;
    /** OCID of the parent compartment */
    compartmentId?: string;
    /** An OCI config object or None */
    config?: IShellDictionary;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If true exceptions are raised */
    raiseExceptions?: boolean;
}

export interface IShellMdsCreateDbSystemKwargs {
    /** The new name of the DB System. */
    dbSystemName?: string;
    /** The new description of the DB System. */
    description?: string;
    /** The name of the availability_domain */
    availabilityDomain?: string;
    /** The compute shape name to use for the instance */
    shape?: string;
    /** The OCID of the subnet to use */
    subnetId?: string;
    /** The OCID of the MySQL configuration */
    configurationId?: string;
    /** The data storage size in gigabytes */
    dataStorageSizeInGbs?: number;
    /** The MySQL version */
    mysqlVersion?: string;
    /** The name of the administrator user account */
    adminUsername?: string;
    /** The password of the administrator account */
    adminPassword?: string;
    /** The file path to an SSH private key */
    privateKeyFilePath?: string;
    /** The PAR url used for initial data import */
    parUrl?: string;
    /** Whether the bucket and PARs should be kept or deleted if an import took place */
    performCleanupAfterImport?: boolean;
    /** The MySQL Connection URI if data should be imported from an existing MySQL Server instance */
    sourceMysqlUri?: string;
    /** The password to use when data should be imported from an existing MySQL Server instance */
    sourceMysqlPassword?: string;
    /** The path to a local directory that contains a dump */
    sourceLocalDumpDir?: string;
    /** The name of the source bucket that contains a dump */
    sourceBucket?: string;
    /** OCID of the host image to use for this Instance. Private API only. */
    hostImageId?: string;
    /** The defined_tags of the dynamic group. */
    definedTags?: IShellDictionary;
    /** The freeform_tags of the dynamic group */
    freeformTags?: IShellDictionary;
    /** The OCID of the compartment */
    compartmentId?: string;
    /** An OCI config object or None. */
    config?: object;
    /** Ask the user for input if needed */
    interactive?: boolean;
    /** Whether to return the object when created */
    returnObject?: boolean;
}

export interface IShellMdsDeleteDbSystemKwargs {
    /** The name of the DB System. */
    dbSystemName?: string;
    /** OCID of the DbSystem. */
    dbSystemId?: string;
    /** Whether to wait till the DbSystem reaches the desired lifecycle state */
    awaitCompletion?: boolean;
    /** Whether to not default to the current bastion. */
    ignoreCurrent?: boolean;
    /** OCID of the parent compartment */
    compartmentId?: string;
    /** An OCI config object or None */
    config?: IShellDictionary;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If true exceptions are raised */
    raiseExceptions?: boolean;
}

export interface IShellMdsStopDbSystemKwargs {
    /** The name of the DB System. */
    dbSystemName?: string;
    /** OCID of the DbSystem. */
    dbSystemId?: string;
    /** Whether to wait till the DbSystem reaches the desired lifecycle state */
    awaitCompletion?: boolean;
    /** Whether to not default to the current bastion. */
    ignoreCurrent?: boolean;
    /** OCID of the parent compartment */
    compartmentId?: string;
    /** An OCI config object or None */
    config?: IShellDictionary;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If true exceptions are raised */
    raiseExceptions?: boolean;
}

export interface IShellMdsStartDbSystemKwargs {
    /** The name of the DB System. */
    dbSystemName?: string;
    /** OCID of the DbSystem. */
    dbSystemId?: string;
    /** Whether to wait till the DbSystem reaches the desired lifecycle state */
    awaitCompletion?: boolean;
    /** Whether to not default to the current bastion. */
    ignoreCurrent?: boolean;
    /** OCID of the parent compartment */
    compartmentId?: string;
    /** An OCI config object or None */
    config?: IShellDictionary;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If true exceptions are raised */
    raiseExceptions?: boolean;
}

export interface IShellMdsRestartDbSystemKwargs {
    /** The name of the DB System. */
    dbSystemName?: string;
    /** OCID of the DbSystem. */
    dbSystemId?: string;
    /** Whether to wait till the DbSystem reaches the desired lifecycle state */
    awaitCompletion?: boolean;
    /** Whether to not default to the current bastion. */
    ignoreCurrent?: boolean;
    /** OCID of the parent compartment */
    compartmentId?: string;
    /** An OCI config object or None */
    config?: IShellDictionary;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If true exceptions are raised */
    raiseExceptions?: boolean;
}

export interface IShellMdsStopHeatWaveClusterKwargs {
    /** The name of the DB System. */
    dbSystemName?: string;
    /** OCID of the DbSystem. */
    dbSystemId?: string;
    /** Whether to wait till the DbSystem reaches the desired lifecycle state */
    awaitCompletion?: boolean;
    /** Whether to not default to the current bastion. */
    ignoreCurrent?: boolean;
    /** OCID of the parent compartment */
    compartmentId?: string;
    /** An OCI config object or None */
    config?: IShellDictionary;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If true exceptions are raised */
    raiseExceptions?: boolean;
}

export interface IShellMdsStartHeatWaveClusterKwargs {
    /** The name of the DB System. */
    dbSystemName?: string;
    /** OCID of the DbSystem. */
    dbSystemId?: string;
    /** Whether to wait till the DbSystem reaches the desired lifecycle state */
    awaitCompletion?: boolean;
    /** Whether to not default to the current bastion. */
    ignoreCurrent?: boolean;
    /** OCID of the parent compartment */
    compartmentId?: string;
    /** An OCI config object or None */
    config?: IShellDictionary;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If true exceptions are raised */
    raiseExceptions?: boolean;
}

export interface IShellMdsRestartHeatWaveClusterKwargs {
    /** The name of the DB System. */
    dbSystemName?: string;
    /** OCID of the DbSystem. */
    dbSystemId?: string;
    /** Whether to wait till the DbSystem reaches the desired lifecycle state */
    awaitCompletion?: boolean;
    /** Whether to not default to the current bastion. */
    ignoreCurrent?: boolean;
    /** OCID of the parent compartment */
    compartmentId?: string;
    /** An OCI config object or None */
    config?: IShellDictionary;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If true exceptions are raised */
    raiseExceptions?: boolean;
}

export interface IShellMdsCreateHeatWaveClusterKwargs {
    /** The name of the DB System. */
    dbSystemName?: string;
    /** OCID of the DbSystem. */
    dbSystemId?: string;
    /** Whether to not default to the current DB System. */
    ignoreCurrent?: boolean;
    /** The size of the cluster */
    clusterSize?: number;
    /** The name of the shape to use */
    shapeName?: string;
    /** Whether to wait till the DbSystem reaches the desired lifecycle state */
    awaitCompletion?: boolean;
    /** OCID of the parent compartment. */
    compartmentId?: string;
    /** An OCI config object or None */
    config?: IShellDictionary;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If true exceptions are raised */
    raiseExceptions?: boolean;
}

export interface IShellMdsUpdateHeatWaveClusterKwargs {
    /** The name of the DB System. */
    dbSystemName?: string;
    /** OCID of the DbSystem. */
    dbSystemId?: string;
    /** Whether to not default to the current DB System. */
    ignoreCurrent?: boolean;
    /** The size of the cluster */
    clusterSize?: number;
    /** The name of the shape to use */
    shapeName?: string;
    /** Whether to wait till the DbSystem reaches the desired lifecycle state */
    awaitCompletion?: boolean;
    /** OCID of the parent compartment. */
    compartmentId?: string;
    /** An OCI config object or None */
    config?: IShellDictionary;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If true exceptions are raised */
    raiseExceptions?: boolean;
}

export interface IShellMdsDeleteHeatWaveClusterKwargs {
    /** The name of the DB System. */
    dbSystemName?: string;
    /** OCID of the DbSystem. */
    dbSystemId?: string;
    /** Whether to wait till the DbSystem reaches the desired lifecycle state */
    awaitCompletion?: boolean;
    /** Whether to not default to the current bastion. */
    ignoreCurrent?: boolean;
    /** OCID of the parent compartment */
    compartmentId?: string;
    /** An OCI config object or None */
    config?: IShellDictionary;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If true exceptions are raised */
    raiseExceptions?: boolean;
}

export interface IShellMdsListLoadBalancersKwargs {
    /** OCID of the parent compartment */
    compartmentId?: string;
    /** An OCI config object or None */
    config?: IShellDictionary;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** "STR" will return a formatted string, "DICT" will return the object converted to a dict structure and "OBJ" will return the OCI Python object for internal plugin usage */
    returnType?: string;
    /** If set to true exceptions are raised */
    raiseExceptions?: boolean;
}

export interface IShellMdsListBucketsKwargs {
    /** OCID of the parent compartment. */
    compartmentId?: string;
    /** An OCI config object or None. */
    config?: object;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** If set to True exceptions are raised */
    raiseExceptions?: boolean;
    /** Whether output is more descriptive */
    interactive?: boolean;
    /** If set to true, a list object is returned. */
    returnFormatted?: boolean;
}

export interface IShellMdsDeleteBucketObjectKwargs {
    /** The name of the bucket. */
    bucketName?: string;
    /** OCID of the parent compartment. */
    compartmentId?: string;
    /** An OCI config object or None. */
    config?: object;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** If set to false, function returns true on success */
    interactive?: boolean;
}

export interface IShellMdsCreateBucketObjectsKwargs {
    /** The name of the new bucket. */
    bucketName?: string;
    /** OCID of the parent compartment. */
    compartmentId?: string;
    /** An OCI config object or None. */
    config?: object;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Whether exceptions should be raised */
    interactive?: boolean;
    /** If true exceptions are raised */
    raiseExceptions?: boolean;
    /** The function to send a message to he GUI. */
    sendGuiMessage?: object;
    /** If set to true, the extension is changed to lower case. */
    fixExtension?: boolean;
}

export interface IShellMdsListBucketObjectsKwargs {
    /** The name of the bucket */
    bucketName?: string;
    /** Then name of the bucket object, can include * to match multiple objects */
    name?: string;
    /** The string to use for matching against the start of object names in a list query */
    prefix?: string;
    /** When this parameter is set, only objects whose names do not contain the delimiter character (after an optionally specified prefix) are returned in the objects key of the response body. Scanned objects whose names contain the delimiter have the part of their name up to the first occurrence of the delimiter (including the optional prefix) returned as a set of prefixes. Note that only "/" is a supported delimiter character at this time. */
    delimiter?: string;
    /** OCID of the parent compartment. */
    compartmentId?: string;
    /** An OCI config object or None. */
    config?: object;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** If set to false exceptions are raised */
    interactive?: boolean;
    /** If set to true, a list object is returned. */
    returnFormatted?: boolean;
}

export interface IShellMdsListBastionsKwargs {
    /** OCID of the parent compartment */
    compartmentId?: string;
    /** OCID of the db_system_id the bastions needs to be valid for and therefore are in the same subnet */
    validForDbSystemId?: string;
    /** An OCI config object or None */
    config?: IShellDictionary;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** "STR" will return a formatted string, "DICT" will return the object converted to a dict structure and "OBJ" will return the OCI Python object for internal plugin usage */
    returnType?: string;
    /** If set to true exceptions are raised */
    raiseExceptions?: boolean;
}

export interface IShellMdsGetBastionKwargs {
    /** The new name bastion */
    bastionName?: string;
    /** OCID of the bastion. */
    bastionId?: string;
    /** Await the given lifecycle state, ACTIVE, DELETED, .. */
    awaitState?: string;
    /** Whether the current bastion should be ignored */
    ignoreCurrent?: boolean;
    /** Whether to lookup bastion in compartment */
    fallbackToAnyInCompartment?: boolean;
    /** OCID of the compartment. */
    compartmentId?: string;
    /** An OCI config object or None. */
    config?: IShellDictionary;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** "STR" will return a formatted string, "DICT" will return the object converted to a dict structure and "OBJ" will return the OCI Python object for internal plugin usage */
    returnType?: string;
    /** If set to true exceptions are raised */
    raiseExceptions?: boolean;
}

export interface IShellMdsCreateBastionKwargs {
    /** The new name of the compartment. */
    bastionName?: string;
    /** OCID of the DbSystem. */
    dbSystemId?: string;
    /** The client CIDR, defaults to "0.0.0.0/0" */
    clientCidr?: string;
    /** The maximum amount of time that any session on the bastion can remain active, defaults to 10800 */
    maxSessionTtlInSeconds?: number;
    /** The OCID of the subnet, defaults to the subnet of the db_system if db_system_id is given */
    targetSubnetId?: string;
    /** Await the ACTIVE lifecycle state before returning */
    awaitActiveState?: boolean;
    /** OCID of the compartment. */
    compartmentId?: string;
    /** An OCI config object or None. */
    config?: IShellDictionary;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Whether the current DbSystem should be ignored */
    ignoreCurrent?: boolean;
    /** Whether exceptions are raised */
    interactive?: boolean;
    /** "STR" will return a formatted string, "DICT" will return the object converted to a dict structure and "OBJ" will return the OCI Python object for internal plugin usage */
    returnType?: string;
    /** If set to true exceptions are raised */
    raiseExceptions?: boolean;
}

export interface IShellMdsDeleteBastionKwargs {
    /** The new name bastion */
    bastionName?: string;
    /** OCID of the bastion. */
    bastionId?: string;
    /** Whether to wait till the bastion reaches lifecycle state DELETED */
    awaitDeletion?: boolean;
    /** OCID of the compartment. */
    compartmentId?: string;
    /** An OCI config object or None. */
    config?: IShellDictionary;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Whether the current bastion should be ignored */
    ignoreCurrent?: boolean;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If set to true exceptions are raised */
    raiseExceptions?: boolean;
}

export interface IShellMdsListBastionSessionsKwargs {
    /** OCID of the bastion. */
    bastionId?: string;
    /** Whether to not default to the current bastion. */
    ignoreCurrent?: boolean;
    /** OCID of the parent compartment. */
    compartmentId?: string;
    /** An OCI config object or None. */
    config?: object;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Whether output is more descriptive */
    interactive?: boolean;
    /** "STR" will return a formatted string, "DICT" will return the object converted to a dict structure and "OBJ" will return the OCI Python object for internal plugin usage */
    returnType?: string;
    /** If set to true exceptions are raised */
    raiseExceptions?: boolean;
}

export interface IShellMdsGetBastionSessionKwargs {
    /** The name of the session. */
    sessionName?: string;
    /** OCID of the session. */
    sessionId?: string;
    /** OCID of the bastion. */
    bastionId?: string;
    /** OCID of the compartment. */
    compartmentId?: string;
    /** An OCI config object or None. */
    config?: IShellDictionary;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Whether the current bastion should be ignored */
    ignoreCurrent?: boolean;
    /** Whether exceptions are raised */
    interactive?: boolean;
    /** "STR" will return a formatted string, "DICT" will return the object converted to a dict structure and "OBJ" will return the OCI Python object for internal plugin usage */
    returnType?: string;
    /** If set to true exceptions are raised */
    raiseExceptions?: boolean;
}

export interface IShellMdsCreateBastionSessionKwargs {
    /** The new name of the compartment. */
    bastionName?: string;
    /** OCID of the Bastion. */
    bastionId?: string;
    /** Fallback to first bastion in the given compartment */
    fallbackToAnyInCompartment?: boolean;
    /** The type of the session, either MANAGED_SSH or PORT_FORWARDING */
    sessionType?: string;
    /** The name of the session. */
    sessionName?: string;
    /** OCID of the session target. */
    targetId?: string;
    /** The TCP/IP address of the session target. */
    targetIp?: string;
    /** The TCP/IP Port of the session target. */
    targetPort?: string;
    /** The user account on the session target. */
    targetUser?: string;
    /** Time to live for the session, max 10800. */
    ttlInSeconds?: number;
    /** The filename of a public SSH key. */
    publicKeyFile?: string;
    /** The public SSH key. */
    publicKeyContent?: string;
    /** Whether to wait till the bastion reaches lifecycle state ACTIVE */
    awaitCreation?: boolean;
    /** OCID of the compartment. */
    compartmentId?: string;
    /** An OCI config object or None. */
    config?: IShellDictionary;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Whether the current Bastion should be ignored */
    ignoreCurrent?: boolean;
    /** Whether exceptions are raised */
    interactive?: boolean;
    /** "STR" will return a formatted string, "DICT" will return the object converted to a dict structure and "OBJ" will return the OCI Python object for internal plugin usage */
    returnType?: string;
    /** If set to true exceptions are raised */
    raiseExceptions?: boolean;
}

export interface IShellMdsDeleteBastionSessionKwargs {
    /** The name of the bastion session */
    sessionName?: string;
    /** The id of the bastion session */
    sessionId?: string;
    /** The name of the bastion. */
    bastionName?: string;
    /** OCID of the bastion. */
    bastionId?: string;
    /** OCID of the compartment. */
    compartmentId?: string;
    /** An OCI config object or None. */
    config?: IShellDictionary;
    /** The name of an OCI config profile */
    configProfile?: string;
    /** Whether the current bastion should be ignored */
    ignoreCurrent?: boolean;
    /** Indicates whether to execute in interactive mode */
    interactive?: boolean;
    /** If set to true exceptions are raised */
    raiseExceptions?: boolean;
}

export interface IShellMdsGenaiConfigureKwargs {
    /** The options that store information about the request. */
    options?: IShellDictionary;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
    /** The function to send a message to he GUI. */
    sendGuiMessage?: object;
}

export interface IShellMdsGenaiChatKwargs {
    /** The options that store information about the request. */
    options?: IShellDictionary;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
    /** The function to send a message to he GUI. */
    sendGuiMessage?: object;
}

export interface IShellMdsGenaiLakehouseStatusKwargs {
    /** The amount of used lakehouse memory */
    memoryUsed?: number;
    /** The amount of total lakehouse memory */
    memoryTotal?: number;
    /** The database schema name used to lookup the lakehouse tables */
    schemaName?: string;
    /** The hash calculated for lakehouse tables of the given schema */
    lakehouseTablesHash?: string;
    /** The hash calculated for lakehouse tasks */
    lakehouseTasksHash?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMdsGenaiSaveChatOptionsKwargs {
    /** The options that store information about the request. */
    options?: IShellDictionary;
}

export interface IProtocolMdsParameters {
    [ShellAPIMds.MdsGetRegions]: {};
    [ShellAPIMds.MdsListConfigProfiles]: { kwargs?: IShellMdsListConfigProfilesKwargs; };
    [ShellAPIMds.MdsSetDefaultConfigProfile]: { args: { profileName?: string; configFilePath?: string; cliRcFilePath?: string; }; };
    [ShellAPIMds.MdsGetDefaultConfigProfile]: { args: { cliRcFilePath?: string; }; };
    [ShellAPIMds.MdsSetCurrentCompartment]: { kwargs?: IShellMdsSetCurrentCompartmentKwargs; };
    [ShellAPIMds.MdsGetCurrentCompartmentId]: { kwargs?: IShellMdsGetCurrentCompartmentIdKwargs; };
    [ShellAPIMds.MdsSetCurrentBastion]: { kwargs?: IShellMdsSetCurrentBastionKwargs; };
    [ShellAPIMds.MdsGetAvailabilityDomain]: { kwargs?: IShellMdsGetAvailabilityDomainKwargs; };
    [ShellAPIMds.MdsListCompartments]: { kwargs?: IShellMdsListCompartmentsKwargs; };
    [ShellAPIMds.MdsGetCompartmentById]: { args: { compartmentId: string; }; kwargs?: IShellMdsGetCompartmentByIdKwargs; };
    [ShellAPIMds.MdsGetCompartment]: { args: { compartmentPath?: string; }; kwargs?: IShellMdsGetCompartmentKwargs; };
    [ShellAPIMds.MdsListComputeInstances]: { kwargs?: IShellMdsListComputeInstancesKwargs; };
    [ShellAPIMds.MdsGetComputeInstance]: { kwargs?: IShellMdsGetComputeInstanceKwargs; };
    [ShellAPIMds.MdsListComputeShapes]: { kwargs?: IShellMdsListComputeShapesKwargs; };
    [ShellAPIMds.MdsDeleteComputeInstance]: { kwargs?: IShellMdsDeleteComputeInstanceKwargs; };
    [ShellAPIMds.MdsUtilHeatWaveLoadData]: { kwargs?: IShellMdsUtilHeatWaveLoadDataKwargs; };
    [ShellAPIMds.MdsUtilCreateEndpoint]: { kwargs?: IShellMdsUtilCreateEndpointKwargs; };
    [ShellAPIMds.MdsGetDbSystemConfiguration]: { kwargs?: IShellMdsGetDbSystemConfigurationKwargs; };
    [ShellAPIMds.MdsListDbSystemShapes]: { kwargs?: IShellMdsListDbSystemShapesKwargs; };
    [ShellAPIMds.MdsListDbSystems]: { kwargs?: IShellMdsListDbSystemsKwargs; };
    [ShellAPIMds.MdsGetDbSystem]: { kwargs?: IShellMdsGetDbSystemKwargs; };
    [ShellAPIMds.MdsGetDbSystemId]: { kwargs?: IShellMdsGetDbSystemIdKwargs; };
    [ShellAPIMds.MdsUpdateDbSystem]: { kwargs?: IShellMdsUpdateDbSystemKwargs; };
    [ShellAPIMds.MdsCreateDbSystem]: { kwargs?: IShellMdsCreateDbSystemKwargs; };
    [ShellAPIMds.MdsDeleteDbSystem]: { kwargs?: IShellMdsDeleteDbSystemKwargs; };
    [ShellAPIMds.MdsStopDbSystem]: { kwargs?: IShellMdsStopDbSystemKwargs; };
    [ShellAPIMds.MdsStartDbSystem]: { kwargs?: IShellMdsStartDbSystemKwargs; };
    [ShellAPIMds.MdsRestartDbSystem]: { kwargs?: IShellMdsRestartDbSystemKwargs; };
    [ShellAPIMds.MdsStopHeatWaveCluster]: { kwargs?: IShellMdsStopHeatWaveClusterKwargs; };
    [ShellAPIMds.MdsStartHeatWaveCluster]: { kwargs?: IShellMdsStartHeatWaveClusterKwargs; };
    [ShellAPIMds.MdsRestartHeatWaveCluster]: { kwargs?: IShellMdsRestartHeatWaveClusterKwargs; };
    [ShellAPIMds.MdsCreateHeatWaveCluster]: { kwargs?: IShellMdsCreateHeatWaveClusterKwargs; };
    [ShellAPIMds.MdsUpdateHeatWaveCluster]: { kwargs?: IShellMdsUpdateHeatWaveClusterKwargs; };
    [ShellAPIMds.MdsDeleteHeatWaveCluster]: { kwargs?: IShellMdsDeleteHeatWaveClusterKwargs; };
    [ShellAPIMds.MdsListLoadBalancers]: { kwargs?: IShellMdsListLoadBalancersKwargs; };
    [ShellAPIMds.MdsListBuckets]: { kwargs?: IShellMdsListBucketsKwargs; };
    [ShellAPIMds.MdsDeleteBucketObject]: { args: { name?: string; }; kwargs?: IShellMdsDeleteBucketObjectKwargs; };
    [ShellAPIMds.MdsCreateBucketObjects]: { args: { filePaths: unknown[]; prefix: string; }; kwargs?: IShellMdsCreateBucketObjectsKwargs; };
    [ShellAPIMds.MdsListBucketObjects]: { kwargs?: IShellMdsListBucketObjectsKwargs; };
    [ShellAPIMds.MdsListBastions]: { kwargs?: IShellMdsListBastionsKwargs; };
    [ShellAPIMds.MdsGetBastion]: { kwargs?: IShellMdsGetBastionKwargs; };
    [ShellAPIMds.MdsCreateBastion]: { kwargs?: IShellMdsCreateBastionKwargs; };
    [ShellAPIMds.MdsDeleteBastion]: { kwargs?: IShellMdsDeleteBastionKwargs; };
    [ShellAPIMds.MdsListBastionSessions]: { kwargs?: IShellMdsListBastionSessionsKwargs; };
    [ShellAPIMds.MdsGetBastionSession]: { kwargs?: IShellMdsGetBastionSessionKwargs; };
    [ShellAPIMds.MdsCreateBastionSession]: { kwargs?: IShellMdsCreateBastionSessionKwargs; };
    [ShellAPIMds.MdsDeleteBastionSession]: { kwargs?: IShellMdsDeleteBastionSessionKwargs; };
    [ShellAPIMds.MdsGenaiStatus]: { args: { moduleSessionId?: string; }; };
    [ShellAPIMds.MdsGenaiConfigure]: { args: { cohereApiKey?: string; }; kwargs?: IShellMdsGenaiConfigureKwargs; };
    [ShellAPIMds.MdsGenaiChat]: { args: { prompt: string; }; kwargs?: IShellMdsGenaiChatKwargs; };
    [ShellAPIMds.MdsGenaiLakehouseStatus]: { kwargs?: IShellMdsGenaiLakehouseStatusKwargs; };
    [ShellAPIMds.MdsGenaiSaveChatOptions]: { args: { filePath: string; }; kwargs?: IShellMdsGenaiSaveChatOptionsKwargs; };
    [ShellAPIMds.MdsGenaiLoadChatOptions]: { args: { filePath: string; }; };

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

export interface IMdsChatStatus {
    heatwaveSupport: boolean;
    localModelSupport: boolean;
    languageSupport: boolean;
}

export interface IMdsChatConfigure {
    success: boolean;
    error: string;
}

export interface IMdsChatResult {
    data: IMdsChatData;
}

export interface IMdsChatData {
    // Input fields, only set by client.

    /** If set, the search for vector tables is limited to this database schema. */
    schemaName?: string;

    /** If set to true, a stream of tokens is sent. Otherwise the full response is returned at once. */
    stream?: boolean;

    /** Whether status should be reported during execution. */
    reportProgress?: boolean;

    /** If set to true, the GenAI component is not called. Used to test the vector store part. */
    skipGenerate?: boolean;

    /** Return queried context that was passed to the GenAI component. */
    returnPrompt?: boolean;

    /** Setting the parameter to true indicates that this request ist a re-run of a previous query. */
    reRun?: boolean;

    /** The preamble to pass to the LLM. */
    preamble?: string;

    /** Whether the list of tables should remain fixed. */
    lockTableList?: boolean;

    /** Language options for use prompts and answers. */
    languageOptions?: IMdsChatLanguageOptions;

    // Input/Output fields, that can be set by both, the client or the server.

    /** A GUID that uniquely identifies the chat conversation. */
    conversationId?: string;

    /** A GUID that uniquely identifies the specific chat query of the chat conversation. */
    chatQueryId?: string;

    /** The history of the current chat. */
    chatHistory?: IMdsChatHistoryEntry[];

    /** The list of database schema tables considered for document lookup. */
    tables?: IMdsChatTable[];

    /** Used to limit the possible documents in a table based on metadata. */
    tableMetadata? : IMdsChatTableMetadata[];

    /** The list of documents that were used to compose the response. */
    documents?: IMdsChatDocument[];

    /** The list of document ids to include in the response. */
    includeDocumentUris?: string[];

    /** The number of document segments to be used. */
    retrieveTopK?: number;

    /** the task to be executed. Inferred from the prompt if not given or AUTO. */
    task?: string;

    /** Model options specific to the LLM. */
    modelOptions?: IMdsChatModelOptions;

    // Output fields, that can only be set by the server

    /** A token of the stream of tokens */
    token?: string;

    /** The full response text consisting of all tokens */
    response?: string;

    /** Additional information text that should be displayed in the status bar to update the user. */
    info?: string;

    /** The error message, if an error has occurred. */
    error?: string;

    /** The actual prompt sent to the GenAI component, if returnExecutedPrompt was true. */
    prompt?: string;

    /** Usage information about used tokens if available from the LLM. */
    usage?: IMdsChatUsage;

    /** Set to true when this is the last response message to the request. */
    requestCompleted?: boolean;
}

export interface IMdsChatLanguageOptions {
    language?: string;
    translateUserPrompt?: boolean;
    translateResponse?: boolean;

    /** the id of the model to be used for GenAI translations. */
    modelId?: string;
}

export interface IMdsChatUsageVersion {
    version: string;
}

export interface IMdsChatUsageUnits {
    inputTokens: number;
    outputTokens: number;
}

export interface IMdsChatUsage {
    /** The version of the chat API. */
    apiVersion: IMdsChatUsageVersion;

    /** The used input- and output tokens. */
    usedUnits: IMdsChatUsageUnits;
}

export interface IMdsChatHistoryEntry {
    /** The id of the chat query that produced this message entry. */
    chatQueryId: string;

    /** The message the user sent. */
    userMessage: string;

    /** The message the chatbot replied. */
    chatBotMessage: string;
}

export interface IMdsChatDocument {
    /** The ID of the document, e.g. the full bucket file path. */
    id: string;

    /** The title of the document. */
    title: string;

    /** A segment of the document. */
    segment: string;
}

export interface IMdsChatModelOptions {
    /** The context used in the prompt to augment the query and guide the generation of the LLM. */
    context?: string;

    /** the id of the model to be used for GenAI. */
    modelId?: string;

    /** A non-negative float that tunes the degree of randomness in generation. */
    temperature?: number;

    /** Denotes the maximum number of tokens to predict per generation. */
    maxTokens?: number;

    /** Ensures only the top k most likely tokens are considered for text generation at each step. */
    topK?: number;

    /** Ensures that only the most likely tokens with the sum p of their probabilities are considered. */
    topP?: number;

    /** Assigns a penalty when a token appears frequently. */
    repeatPenalty?: number;

    /** Assigns a penalty to each token when it appears in the output. */
    tokenLikelihoods?: number;

    /** A list of characters that tells the model when to stop the generated output. */
    stopSequences?: string[];

    /** The language code of the language to use. */
    language?: string;
}

export interface IMdsChatTable {
    /** The name of the database schema. */
    schemaName: string;

    /** The name of the table. */
    tableName: string;

    /** True if the table has vector embeddings, false if it is a relational table. */
    vectorEmbeddings: boolean;

    /** Actual SQL query used for that table. */
    query: string;
}

export interface IMdsChatTableMetadata {
    /* The name of the field as stored in the metadata, e.g. title. */
    metadataField: string;

    /** The filter to use, e.g. LIKE, <, >, =, etc. */
    filterOperator: string;

    /** The value used for filtering, e.g. MySQL%, 2024-01-25, etc. */
    filterValue: string;
}

export interface IMdsCreateBucketObjectsResult {
    data: IMdsCreateBucketObjectsData;
}

export interface IMdsCreateBucketObjectsData {
    filePath?: string;
    bytesUploaded?: number;
    totalFileSize?: number;
    error?: string;
}

export interface IMdsLakehouseStatus {
    memoryStatus?: IMdsLakehouseMemoryStatus;
    tableStatus?: IMdsLakehouseTablesStatus;
    taskStatus?: IMdsLakehouseTasksStatus;
}

export interface IMdsLakehouseTablesStatus {
    hash: string;
    tables: IMdsLakehouseTableStatus[];
}

export interface IMdsLakehouseTableStatus {
    id: string;
    schemaName: string;
    tableName: string;
    loaded: boolean;
    progress: number;
    comment: string;
    rows: number;
    dataLength: number;
    lastChange: string;
}

export interface IMdsLakehouseTasksStatus {
    hash: string;
    tasks: IMdsLakehouseTaskStatus[];
}

export interface IMdsLakehouseTaskStatus {
    id: string;
    title: string;
    logTime: string;
    status: string;
    statusMessage: string;
    progress: number;
    startingTime: string;
    estimatedCompletionTime: string;
    estimatedRemainingTime: number;
}

export interface IMdsLakehouseMemoryStatus {
    memoryUsed: number;
    memoryTotal: number;
}

export interface IProtocolMdsResults {
    [ShellAPIMds.MdsGetRegions]: {};
    [ShellAPIMds.MdsListConfigProfiles]: { result: IMdsProfileData[]; };
    [ShellAPIMds.MdsSetDefaultConfigProfile]: {};
    [ShellAPIMds.MdsGetDefaultConfigProfile]: {};
    [ShellAPIMds.MdsSetCurrentCompartment]: {};
    [ShellAPIMds.MdsGetCurrentCompartmentId]: { result: string | undefined};
    [ShellAPIMds.MdsSetCurrentBastion]: {};
    [ShellAPIMds.MdsGetAvailabilityDomain]: {};
    [ShellAPIMds.MdsListCompartments]: { result: ICompartment[]; };
    [ShellAPIMds.MdsGetCompartment]: { result: ICompartment; };
    [ShellAPIMds.MdsGetCompartmentById]: { result: ICompartment | undefined; };
    [ShellAPIMds.MdsListComputeInstances]: { result: IComputeInstance[]; };
    [ShellAPIMds.MdsGetComputeInstance]: {};
    [ShellAPIMds.MdsListComputeShapes]: { result: IComputeShape[]; };
    [ShellAPIMds.MdsDeleteComputeInstance]: {};
    [ShellAPIMds.MdsUtilHeatWaveLoadData]: {};
    [ShellAPIMds.MdsUtilCreateEndpoint]: {};
    [ShellAPIMds.MdsGetDbSystemConfiguration]: {};
    [ShellAPIMds.MdsListDbSystemShapes]: { result: IMySQLDbSystemShapeSummary[]; };
    [ShellAPIMds.MdsListDbSystems]: { result: IMySQLDbSystem[]; };
    [ShellAPIMds.MdsGetDbSystem]: { result: IMySQLDbSystem; };
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
    [ShellAPIMds.MdsListLoadBalancers]: { result: LoadBalancer[]; };
    [ShellAPIMds.MdsListBastions]: { result: IBastionSummary[]; };
    [ShellAPIMds.MdsGetBastion]: { result: IBastionSummary; };
    [ShellAPIMds.MdsCreateBastion]: { result: IBastionSummary; };
    [ShellAPIMds.MdsDeleteBastion]: {};
    [ShellAPIMds.MdsListBastionSessions]: {};
    [ShellAPIMds.MdsGetBastionSession]: {};
    [ShellAPIMds.MdsCreateBastionSession]: { result: IBastionSession; };
    [ShellAPIMds.MdsDeleteBastionSession]: {};
    [ShellAPIMds.MdsListBuckets]: { result: IBucketSummary[]; }
    [ShellAPIMds.MdsListBucketObjects]: { result: IBucketListObjects; }
    [ShellAPIMds.MdsCreateBucketObjects]: { result: IMdsCreateBucketObjectsResult; };
    [ShellAPIMds.MdsDeleteBucketObject]: {};
    [ShellAPIMds.MdsGenaiStatus]: { result: IMdsChatStatus; };
    [ShellAPIMds.MdsGenaiConfigure]: { result: IMdsChatConfigure; };
    [ShellAPIMds.MdsGenaiChat]: { result: IMdsChatResult; };
    [ShellAPIMds.MdsGenaiLakehouseStatus]: { result: IMdsLakehouseStatus; };
    [ShellAPIMds.MdsGenaiSaveChatOptions]: {};
    [ShellAPIMds.MdsGenaiLoadChatOptions]: { result: IMdsChatData };
}
