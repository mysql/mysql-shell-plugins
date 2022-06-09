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

import { Protocol, IShellRequest, IShellDictionary } from ".";



/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/naming-convention */

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
    MdsUtilCreateMdsEndpoint = "mds.util.create_mds_endpoint",
    MdsGetDbSystemConfiguration = "mds.get.db_system_configuration",
    MdsListDbSystems = "mds.list.db_systems",
    MdsGetDbSystem = "mds.get.db_system",
    MdsGetDbSystemId = "mds.get.db_system_id",
    MdsUpdateDbSystem = "mds.update.db_system",
    MdsCreateDbSystem = "mds.create.db_system",
    MdsDeleteDbSystem = "mds.delete.db_system",
    MdsStopDbSystem = "mds.stop.db_system",
    MdsStartDbSystem = "mds.start.db_system",
    MdsRestartDbSystem = "mds.restart.db_system",
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

//  Begin auto generated types

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

//  End auto generated types

export class ProtocolMds extends Protocol {
    //  Begin auto generated content
    /**
     * Returns the list of available OCI regions
     *
     * @returns A list of dicts
     */
    public static getRequestGetRegions(): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsGetRegions,
            {
                args: {},
            });
    }

    /**
     * Lists all available profiles
     *
     * @param kwargs Additional options
     *
     * @returns None
     */
    public static getRequestListConfigProfiles(kwargs?: IShellListConfigProfilesKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                config_file_path: kwargs.configFilePath,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
                return_formatted: kwargs.returnFormatted,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsListConfigProfiles,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Sets the default profile
     *
     * @param profileName The name of the profile currently in use
     * @param configFileLocation The location of the OCI config file
     * @param cliRcFileLocation The location of the OCI CLI config file
     *
     * @returns None
     */
    public static getRequestSetDefaultConfigProfile(profileName?: string, configFileLocation = "~/.oci/config", cliRcFileLocation = "~/.oci/oci_cli_rc"): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsSetDefaultConfigProfile,
            {
                args: {
                    profile_name: profileName,
                    config_file_location: configFileLocation,
                    cli_rc_file_location: cliRcFileLocation,
                },
            });
    }

    /**
     * Gets the default profile if stored in the CLI config file
     *
     * @param cliRcFileLocation The location of the OCI CLI config file
     *
     * @returns None
     */
    public static getRequestGetDefaultConfigProfile(cliRcFileLocation = "~/.oci/oci_cli_rc"): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsGetDefaultConfigProfile,
            {
                args: {
                    cli_rc_file_location: cliRcFileLocation,
                },
            });
    }

    /**
     * Sets the current compartment
     *
     * @param kwargs Optional parameters
     *
     * @returns None
     */
    public static getRequestSetCurrentCompartment(kwargs?: IShellSetCurrentCompartmentKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                compartment_path: kwargs.compartmentPath,
                compartment_id: kwargs.compartmentId,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                profile_name: kwargs.profileName,
                cli_rc_file_path: kwargs.cliRcFilePath,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsSetCurrentCompartment,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Gets the current compartment_id
     *
     * @param compartmentId If specified, returned instead of the current
     * @param config The config to be used, None defaults to global config
     * @param profileName Name of the config profile
     * @param cliRcFilePath The location of the OCI CLI config file
     *
     * @returns The current compartment_id
     */
    public static getRequestGetCurrentCompartmentId(compartmentId?: string, config?: IShellDictionary, profileName?: string, cliRcFilePath = "~/.oci/oci_cli_rc"): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsGetCurrentCompartmentId,
            {
                args: {
                    compartment_id: compartmentId,
                    config,
                    profile_name: profileName,
                    cli_rc_file_path: cliRcFilePath,
                },
            });
    }

    /**
     * Makes the given Bastion the current object
     *
     * @param kwargs Optional parameters
     *
     * @returns None
     */
    public static getRequestSetCurrentBastion(kwargs?: IShellSetCurrentBastionKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                bastion_name: kwargs.bastionName,
                bastion_id: kwargs.bastionId,
                compartment_id: kwargs.compartmentId,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                profile_name: kwargs.profileName,
                cli_rc_file_path: kwargs.cliRcFilePath,
                raise_exceptions: kwargs.raiseExceptions,
                interactive: kwargs.interactive,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsSetCurrentBastion,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Returns the name of a randomly chosen availability_domain
     *
     * @param kwargs Additional options
     *
     * @returns Not documented
     *
     * If a name is given, it will be checked if that name actually exists in the
     * current compartment
     *
     * <b>Returns:</b>
     *
     *     The availability_domain
     */
    public static getRequestGetAvailabilityDomain(kwargs?: IShellGetAvailabilityDomainKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                availability_domain: kwargs.availabilityDomain,
                random_selection: kwargs.randomSelection,
                compartment_id: kwargs.compartmentId,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
                return_formatted: kwargs.returnFormatted,
                return_python_object: kwargs.returnPythonObject,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsGetAvailabilityDomain,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Lists compartments
     *
     * @param kwargs Optional parameters
     *
     * @returns Not documented
     *
     * This function will list all sub-compartments of the compartment with the
     * given compartment_id. If compartment_id is omitted, all compartments of the
     * tenancy are listed.
     *
     * <b>Returns:</b>
     *
     *     A list of dicts representing the compartments
     */
    public static getRequestListCompartments(kwargs?: IShellListCompartmentsKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                compartment_id: kwargs.compartmentId,
                include_tenancy: kwargs.includeTenancy,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
                return_formatted: kwargs.returnFormatted,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsListCompartments,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Gets a compartment by path
     *
     * @param compartmentPath The name of the compartment
     * @param kwargs Optional parameters
     *
     * @returns Not documented
     *
     * If the path was not specified or does not match an existing compartment,
     * show the user a list to select a compartment
     *
     * <b>Returns:</b>
     *
     *     The compartment object
     */
    public static getRequestGetCompartment(compartmentPath?: string, kwargs?: IShellGetCompartmentKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                parent_compartment_id: kwargs.parentCompartmentId,
                config: kwargs.config,
                interactive: kwargs.interactive,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsGetCompartment,
            {
                args: {
                    compartment_path: compartmentPath,
                },
                kwargs: kwargsToUse,
            });
    }

    /**
     * Lists instances
     *
     * @param kwargs Optional parameters
     *
     * @returns Not documented
     *
     * This function will list all instances of the compartment with the given
     * compartment_id.
     *
     * <b>Returns:</b>
     *
     *     A list of dicts representing the compartments
     */
    public static getRequestListComputeInstances(kwargs?: IShellListComputeInstancesKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                compartment_id: kwargs.compartmentId,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
                return_formatted: kwargs.returnFormatted,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsListComputeInstances,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Returns an instance object based on instance_name or instance_id
     *
     * @param kwargs Optional parameters
     *
     * @returns The compartment or tenancy object or None if not found
     */
    public static getRequestGetComputeInstance(kwargs?: IShellGetComputeInstanceKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                instance_name: kwargs.instanceName,
                instance_id: kwargs.instanceId,
                ignore_current: kwargs.ignoreCurrent,
                compartment_id: kwargs.compartmentId,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
                return_formatted: kwargs.returnFormatted,
                return_python_object: kwargs.returnPythonObject,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsGetComputeInstance,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Returns a list of all available compute shapes
     *
     * @param kwargs Additional options
     *
     * @returns Not documented
     *
     * This list is specific for the given compartment and availability_domain
     *
     * <b>Returns:</b>
     *
     *     A list of shapes
     */
    public static getRequestListComputeShapes(kwargs?: IShellListComputeShapesKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                limit_shapes_to: kwargs.limitShapesTo,
                availability_domain: kwargs.availabilityDomain,
                compartment_id: kwargs.compartmentId,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
                return_formatted: kwargs.returnFormatted,
                return_python_object: kwargs.returnPythonObject,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsListComputeShapes,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Deletes the compute instance with the given name
     *
     * @param kwargs Optional parameters
     *
     * @returns Not documented
     *
     * If no name is given, it will prompt the user for the name.
     *
     * <b>Returns:</b>
     *
     *    None
     */
    public static getRequestDeleteComputeInstance(kwargs?: IShellDeleteComputeInstanceKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                instance_name: kwargs.instanceName,
                instance_id: kwargs.instanceId,
                await_deletion: kwargs.awaitDeletion,
                compartment_id: kwargs.compartmentId,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                ignore_current: kwargs.ignoreCurrent,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsDeleteComputeInstance,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Creates a public endpoint using MySQL Router on a compute instance
     *
     * @param kwargs Optional parameters
     *
     * @returns Not documented
     *
     * If no id is given, it will prompt the user for the id.
     *
     * <b>Returns:</b>
     *
     *    None
     */
    public static getRequestUtilCreateMdsEndpoint(kwargs?: IShellUtilCreateMdsEndpointKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                instance_name: kwargs.instanceName,
                db_system_name: kwargs.dbSystemName,
                db_system_id: kwargs.dbSystemId,
                private_key_file_path: kwargs.privateKeyFilePath,
                compartment_id: kwargs.compartmentId,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
                return_formatted: kwargs.returnFormatted,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsUtilCreateMdsEndpoint,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Gets a DB System Config
     *
     * @param kwargs Optional parameters
     *
     * @returns Not documented
     *
     * If no name is given, the user can select from a list.
     *
     * <b>Returns:</b>
     *
     *    The MySQL configuration object
     */
    public static getRequestGetDbSystemConfiguration(kwargs?: IShellGetDbSystemConfigurationKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                config_name: kwargs.configName,
                configuration_id: kwargs.configurationId,
                shape: kwargs.shape,
                availability_domain: kwargs.availabilityDomain,
                compartment_id: kwargs.compartmentId,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
                return_formatted: kwargs.returnFormatted,
                return_python_object: kwargs.returnPythonObject,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsGetDbSystemConfiguration,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Lists MySQL DB Systems
     *
     * @param kwargs Optional parameters
     *
     * @returns Not documented
     *
     * Lists all users of a given compartment.
     *
     * <b>Returns:</b>
     *
     *     A list of DB Systems
     */
    public static getRequestListDbSystems(kwargs?: IShellListDbSystemsKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                compartment_id: kwargs.compartmentId,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
                return_formatted: kwargs.returnFormatted,
                return_python_object: kwargs.returnPythonObject,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsListDbSystems,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Gets a DbSystem with the given id
     *
     * @param kwargs Optional parameters
     *
     * @returns Not documented
     *
     * If no id is given, it will prompt the user for the id.
     *
     * <b>Returns:</b>
     *
     *    None
     */
    public static getRequestGetDbSystem(kwargs?: IShellGetDbSystemKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                db_system_name: kwargs.dbSystemName,
                db_system_id: kwargs.dbSystemId,
                ignore_current: kwargs.ignoreCurrent,
                compartment_id: kwargs.compartmentId,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
                return_formatted: kwargs.returnFormatted,
                return_python_object: kwargs.returnPythonObject,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsGetDbSystem,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Gets information about the DbSystem with the given id
     *
     * @param kwargs Optional parameters
     *
     * @returns Not documented
     *
     * If no id is given, it will prompt the user for the id.
     *
     * <b>Returns:</b>
     *
     *    None
     */
    public static getRequestGetDbSystemId(kwargs?: IShellGetDbSystemIdKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                db_system_name: kwargs.dbSystemName,
                ignore_current: kwargs.ignoreCurrent,
                compartment_id: kwargs.compartmentId,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsGetDbSystemId,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Updates the DbSystem with the given id
     *
     * @param kwargs Optional parameters
     *
     * @returns Not documented
     *
     * If no id is given, it will prompt the user for the id.
     *
     * <b>Returns:</b>
     *
     *    None
     */
    public static getRequestUpdateDbSystem(kwargs?: IShellUpdateDbSystemKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                db_system_name: kwargs.dbSystemName,
                db_system_id: kwargs.dbSystemId,
                ignore_current: kwargs.ignoreCurrent,
                new_name: kwargs.newName,
                new_description: kwargs.newDescription,
                new_freeform_tags: kwargs.newFreeformTags,
                compartment_id: kwargs.compartmentId,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsUpdateDbSystem,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Creates a DbSystem with the given id
     *
     * @param kwargs Optional parameters
     *
     * @returns Not documented
     *
     * If no id is given, it will prompt the user for the id.
     *
     * <b>Returns:</b>
     *
     *    None or the new DB System object if return_object is set to true
     */
    public static getRequestCreateDbSystem(kwargs?: IShellCreateDbSystemKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                db_system_name: kwargs.dbSystemName,
                description: kwargs.description,
                availability_domain: kwargs.availabilityDomain,
                shape: kwargs.shape,
                subnet_id: kwargs.subnetId,
                configuration_id: kwargs.configurationId,
                data_storage_size_in_gbs: kwargs.dataStorageSizeInGbs,
                mysql_version: kwargs.mysqlVersion,
                admin_username: kwargs.adminUsername,
                admin_password: kwargs.adminPassword,
                private_key_file_path: kwargs.privateKeyFilePath,
                par_url: kwargs.parUrl,
                perform_cleanup_after_import: kwargs.performCleanupAfterImport,
                source_mysql_uri: kwargs.sourceMysqlUri,
                source_mysql_password: kwargs.sourceMysqlPassword,
                source_local_dump_dir: kwargs.sourceLocalDumpDir,
                source_bucket: kwargs.sourceBucket,
                host_image_id: kwargs.hostImageId,
                defined_tags: kwargs.definedTags,
                freeform_tags: kwargs.freeformTags,
                compartment_id: kwargs.compartmentId,
                config: kwargs.config,
                interactive: kwargs.interactive,
                return_object: kwargs.returnObject,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsCreateDbSystem,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Updates the DbSystem with the given id
     *
     * @param kwargs Optional parameters
     *
     * @returns Not documented
     *
     * If no id is given, it will prompt the user for the id.
     *
     * <b>Returns:</b>
     *
     *    None
     */
    public static getRequestDeleteDbSystem(kwargs?: IShellDeleteDbSystemKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                db_system_name: kwargs.dbSystemName,
                db_system_id: kwargs.dbSystemId,
                await_completion: kwargs.awaitCompletion,
                ignore_current: kwargs.ignoreCurrent,
                compartment_id: kwargs.compartmentId,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsDeleteDbSystem,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Stops the DbSystem with the given id
     *
     * @param kwargs Optional parameters
     *
     * @returns Not documented
     *
     * If no id is given, it will prompt the user for the id.
     *
     * <b>Returns:</b>
     *
     *    None
     */
    public static getRequestStopDbSystem(kwargs?: IShellStopDbSystemKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                db_system_name: kwargs.dbSystemName,
                db_system_id: kwargs.dbSystemId,
                await_completion: kwargs.awaitCompletion,
                ignore_current: kwargs.ignoreCurrent,
                compartment_id: kwargs.compartmentId,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsStopDbSystem,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Starts the DbSystem with the given id
     *
     * @param kwargs Optional parameters
     *
     * @returns Not documented
     *
     * If no id is given, it will prompt the user for the id.
     *
     * <b>Returns:</b>
     *
     *    None
     */
    public static getRequestStartDbSystem(kwargs?: IShellStartDbSystemKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                db_system_name: kwargs.dbSystemName,
                db_system_id: kwargs.dbSystemId,
                await_completion: kwargs.awaitCompletion,
                ignore_current: kwargs.ignoreCurrent,
                compartment_id: kwargs.compartmentId,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsStartDbSystem,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Restarts the DbSystem with the given id
     *
     * @param kwargs Optional parameters
     *
     * @returns Not documented
     *
     * If no id is given, it will prompt the user for the id.
     *
     * <b>Returns:</b>
     *
     *    None
     */
    public static getRequestRestartDbSystem(kwargs?: IShellRestartDbSystemKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                db_system_name: kwargs.dbSystemName,
                db_system_id: kwargs.dbSystemId,
                await_completion: kwargs.awaitCompletion,
                ignore_current: kwargs.ignoreCurrent,
                compartment_id: kwargs.compartmentId,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsRestartDbSystem,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Lists load balancers
     *
     * @param kwargs Optional parameters
     *
     * @returns Not documented
     *
     * This function will list all load balancers of the compartment with the
     * given compartment_id.
     *
     * <b>Returns:</b>
     *
     *     Based on return_type
     */
    public static getRequestListLoadBalancers(kwargs?: IShellListLoadBalancersKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                compartment_id: kwargs.compartmentId,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                interactive: kwargs.interactive,
                return_type: kwargs.returnType,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsListLoadBalancers,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Lists bastions
     *
     * @param kwargs Optional parameters
     *
     * @returns Not documented
     *
     * This function will list all bastions of the compartment with the given
     * compartment_id.
     *
     * <b>Returns:</b>
     *
     *     Based on return_type
     */
    public static getRequestListBastions(kwargs?: IShellListBastionsKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                compartment_id: kwargs.compartmentId,
                valid_for_db_system_id: kwargs.validForDbSystemId,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                interactive: kwargs.interactive,
                return_type: kwargs.returnType,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsListBastions,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Gets a Bastion with the given id
     *
     * @param kwargs Optional parameters
     *
     * @returns Not documented
     *
     * If no id is given, it will prompt the user for the id.
     *
     * <b>Returns:</b>
     *
     *    None
     */
    public static getRequestGetBastion(kwargs?: IShellGetBastionKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                bastion_name: kwargs.bastionName,
                bastion_id: kwargs.bastionId,
                await_state: kwargs.awaitState,
                ignore_current: kwargs.ignoreCurrent,
                fallback_to_any_in_compartment: kwargs.fallbackToAnyInCompartment,
                compartment_id: kwargs.compartmentId,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                interactive: kwargs.interactive,
                return_type: kwargs.returnType,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsGetBastion,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Creates a Bastion
     *
     * @param kwargs Additional options
     *
     * @returns The id of the Bastion Session, None in interactive mode
     */
    public static getRequestCreateBastion(kwargs?: IShellCreateBastionKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                bastion_name: kwargs.bastionName,
                db_system_id: kwargs.dbSystemId,
                client_cidr: kwargs.clientCidr,
                max_session_ttl_in_seconds: kwargs.maxSessionTtlInSeconds,
                target_subnet_id: kwargs.targetSubnetId,
                await_active_state: kwargs.awaitActiveState,
                compartment_id: kwargs.compartmentId,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                ignore_current: kwargs.ignoreCurrent,
                interactive: kwargs.interactive,
                return_type: kwargs.returnType,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsCreateBastion,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Deletes a Bastion with the given id
     *
     * @param kwargs Optional parameters
     *
     * @returns Not documented
     *
     * If no id is given, it will prompt the user for the id.
     *
     * <b>Returns:</b>
     *
     *    None
     */
    public static getRequestDeleteBastion(kwargs?: IShellDeleteBastionKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                bastion_name: kwargs.bastionName,
                bastion_id: kwargs.bastionId,
                await_deletion: kwargs.awaitDeletion,
                compartment_id: kwargs.compartmentId,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                ignore_current: kwargs.ignoreCurrent,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsDeleteBastion,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Lists bastion sessions
     *
     * @param kwargs Optional parameters
     *
     * @returns A list of dicts representing the bastions
     */
    public static getRequestListBastionSessions(kwargs?: IShellListBastionSessionsKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                bastion_id: kwargs.bastionId,
                ignore_current: kwargs.ignoreCurrent,
                compartment_id: kwargs.compartmentId,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                interactive: kwargs.interactive,
                return_type: kwargs.returnType,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsListBastionSessions,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Gets a Bastion Session with the given id
     *
     * @param kwargs Optional parameters
     *
     * @returns Not documented
     *
     * If no id is given, it will prompt the user for the id.
     *
     * <b>Returns:</b>
     *
     *    None
     */
    public static getRequestGetBastionSession(kwargs?: IShellGetBastionSessionKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                session_name: kwargs.sessionName,
                session_id: kwargs.sessionId,
                bastion_id: kwargs.bastionId,
                compartment_id: kwargs.compartmentId,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                ignore_current: kwargs.ignoreCurrent,
                interactive: kwargs.interactive,
                return_type: kwargs.returnType,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsGetBastionSession,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Creates a Bastion Session for the given bastion_id
     *
     * @param kwargs Additional options
     *
     * @returns Not documented
     *
     * If no id is given, it will prompt the user for the id.
     *
     * <b>Returns:</b>
     *
     *    The id of the Bastion Session, None in interactive mode
     */
    public static getRequestCreateBastionSession(kwargs?: IShellCreateBastionSessionKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                bastion_name: kwargs.bastionName,
                bastion_id: kwargs.bastionId,
                fallback_to_any_in_compartment: kwargs.fallbackToAnyInCompartment,
                session_type: kwargs.sessionType,
                session_name: kwargs.sessionName,
                target_id: kwargs.targetId,
                target_ip: kwargs.targetIp,
                target_port: kwargs.targetPort,
                target_user: kwargs.targetUser,
                ttl_in_seconds: kwargs.ttlInSeconds,
                public_key_file: kwargs.publicKeyFile,
                public_key_content: kwargs.publicKeyContent,
                await_creation: kwargs.awaitCreation,
                compartment_id: kwargs.compartmentId,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                ignore_current: kwargs.ignoreCurrent,
                interactive: kwargs.interactive,
                return_type: kwargs.returnType,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsCreateBastionSession,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Deletes a Bastion Session with the given id
     *
     * @param kwargs Optional parameters
     *
     * @returns Not documented
     *
     * If no id is given, it will prompt the user for the id.
     *
     * <b>Returns:</b>
     *
     *    None
     */
    public static getRequestDeleteBastionSession(kwargs?: IShellDeleteBastionSessionKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                session_name: kwargs.sessionName,
                session_id: kwargs.sessionId,
                bastion_name: kwargs.bastionName,
                bastion_id: kwargs.bastionId,
                compartment_id: kwargs.compartmentId,
                config: kwargs.config,
                config_profile: kwargs.configProfile,
                ignore_current: kwargs.ignoreCurrent,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMds.MdsDeleteBastionSession,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    //  End auto generated content
}
