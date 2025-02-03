/*
 * Copyright (c) 2024, 2025, Oracle and/or its affiliates.
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

import type { DeepMutable, Mutable } from "../app-logic/general-types.js";
import { ui } from "../app-logic/UILayer.js";
import { JsonParser } from "../communication/JsonParser.js";
import type {
    IBastionSummary, ICompartment, IComputeInstance, IMySQLDbSystem, LoadBalancer,
} from "../communication/Oci.js";
import type { IMdsProfileData } from "../communication/ProtocolMds.js";
import { ShellInterfaceShellSession } from "../supplement/ShellInterface/ShellInterfaceShellSession.js";
import { convertErrorToString, uuid } from "../utilities/helpers.js";
import { createDataModelEntryState } from "./data-model-helpers.js";
import type {
    DataModelSubscriber, IDataModelEntryState, ISubscriberActionType, ProgressCallback, SubscriberAction,
} from "./data-model-types.js";

/**
 * This file contains all interfaces which comprise the data model for Oracle Cloud Infrastructure (OCI).
 * Each interface (except root items) has a parent entry, which determines the hierarchy of the tree.
 *
 * Each interface has a `type` member, which serves as a discriminator for the type of the entry.
 *
 * The prefix means: OciDm = OCI Data Model.
 */

/** The types of the entries that can appear in the OCI data model. */
export enum OciDmEntityType {
    /** The top level entry of the data model. */
    ConfigurationProfile,

    /** A profile contains a list of compartments and compartments can be nested (i.e. contain other compartments). */
    Compartment,

    /** A bastion entry, which is part of a compartment. */
    Bastion,

    /** A compute instance entry, which is part of a compartment. */
    ComputeInstance,

    /** A standalone database system entry, which is part of a compartment. */
    DbSystem,

    /** A HeatWave cluster (database system) entry, which is part of a compartment. */
    HeatWaveCluster,

    /** A load balancer entry, which is part of a compartment. */
    LoadBalancer,
}

/** The base interface for all entries. */
export interface IOciDmBaseEntry {
    /**
     * A unique identifier to find items independent of other properties (e.g. if they represent the same connection)
     * and to link items in the UI (e.g. between data models). This ID is transient and not stored in the backend.
     */
    id: string;

    /** Transient information related to initialization, UI and others. */
    readonly state: IDataModelEntryState;

    /** The caption of the entry. */
    caption: string;

    /** The type of the entry. This is used a discriminator for the individual entries. */
    readonly type: OciDmEntityType;

    /**
     * Loads the content of this entry if not yet done. The promise returns `true` if loading was successful,
     * otherwise `false`.
     *
     * @param callback An optional callback to report progress.
     */
    refresh?(callback?: ProgressCallback): Promise<boolean>;

    getChildren?(): OciDataModelEntry[];
}

/**
 * An interface for a database system. Such a system can be enabled for HeatWave or analytics, in which case
 * it will have a corresponding HeatWave cluster entry.
 */
export interface IOciDmDbSystem extends IOciDmBaseEntry {
    readonly parent: IOciDmCompartment;

    readonly type: OciDmEntityType.DbSystem;
    readonly details: IMySQLDbSystem;

    readonly cluster?: IOciDmHeatWaveCluster;
}

export interface IOciDmHeatWaveCluster extends IOciDmBaseEntry {
    readonly parent: IOciDmDbSystem;

    readonly type: OciDmEntityType.HeatWaveCluster;
}

export interface IOciDmComputeInstance extends IOciDmBaseEntry {
    readonly parent: IOciDmCompartment;

    readonly type: OciDmEntityType.ComputeInstance;
    readonly instance: IComputeInstance;
}

export interface IOciDmBastion extends IOciDmBaseEntry {
    readonly parent: IOciDmCompartment;

    readonly type: OciDmEntityType.Bastion;
    readonly summary: IBastionSummary;

    makeCurrent(): Promise<void>;
}

export interface IOciDmLoadBalancer extends IOciDmBaseEntry {
    readonly parent: IOciDmCompartment;

    readonly type: OciDmEntityType.LoadBalancer;
    readonly details: LoadBalancer;
}

export interface IOciDmCompartment extends IOciDmBaseEntry {
    /** The direct parent in the data model hierarchy. */
    readonly parent: IOciDmCompartment | IOciDmProfile;

    readonly type: OciDmEntityType.Compartment;

    /** The details of the profile this compartment is part of. */
    readonly profileData: IMdsProfileData;

    /** Data of this compartment. */
    readonly compartmentDetails: ICompartment;

    /** Sub compartments. */
    readonly compartments: IOciDmCompartment[];
    readonly dbSystems: IOciDmDbSystem[];
    readonly heatWaveClusters: IOciDmHeatWaveCluster[];
    readonly computeInstances: IOciDmComputeInstance[];
    readonly bastions: IOciDmBastion[];
    readonly loadBalancers: IOciDmLoadBalancer[];

    makeCurrent(): Promise<void>;
}

export interface IOciDmProfile extends IOciDmBaseEntry {
    readonly type: OciDmEntityType.ConfigurationProfile;
    readonly compartments: IOciDmCompartment[];

    readonly profileData: IMdsProfileData;

    makeDefault(): Promise<void>;
}

/** A union type of all possible interfaces. */
export type OciDataModelEntry =
    | IOciDmProfile
    | IOciDmCompartment
    | IOciDmDbSystem
    | IOciDmHeatWaveCluster
    | IOciDmComputeInstance
    | IOciDmBastion
    | IOciDmLoadBalancer;

/**
 * A data model for the scripts stored in the backend.
 */
export class OciDataModel {
    #initialized = false;
    #profiles: IOciDmProfile[] = [];

    // Accessing OCI APIs is slow, so instead of fetching the individual compartments of a profile or parent
    // compartment (which would be possible) we get the list of compartments for a profile once and cache it.
    #compartmentCache = new Map<string, ICompartment[]>();

    // This is our connection to the MySQL shell, which does all the hard work for us.
    #shellSession = new ShellInterfaceShellSession();

    #subscribers = new Set<DataModelSubscriber<OciDataModelEntry>>();

    /**
     * @returns the list of profiles defined in the user's OCI config file.
     */
    public get profiles(): IOciDmProfile[] {
        return this.#profiles;
    }

    /**
     * Initializes the data model. This will load the list of connections from the backend and create the initial
     * data model. This method can be called multiple times, but will only do work once.
     *
     * Loading the connections requires a valid profile id. If no profile is loaded, the method will close all
     * connections and return without doing anything else.
     */
    public async initialize(): Promise<void> {
        if (!this.#initialized) {
            this.#initialized = true;
            await this.updateProfiles();
        }
    }

    /**
     * Adds the given subscriber to the internal subscriber list for change notifications.
     *
     * @param subscriber The subscriber to add.
     */
    public subscribe(subscriber: DataModelSubscriber<OciDataModelEntry>): void {
        this.#subscribers.add(subscriber);
    }

    /**
     * Removes the given subscriber from the internal subscriber list.
     *
     * @param subscriber The subscriber to remove.
     */
    public unsubscribe(subscriber: DataModelSubscriber<OciDataModelEntry>): void {
        this.#subscribers.delete(subscriber);
    }

    /** Loads the list of profiles from the backend. */
    public async updateProfiles(): Promise<void> {
        const profiles = await this.#shellSession.mhs.getMdsConfigProfiles();

        // TODO: implement a diff algorithm to update the list of profiles.
        this.#profiles = profiles.map((profileData) => {
            const profile: Mutable<IOciDmProfile> = {
                id: uuid(),
                state: createDataModelEntryState(),
                caption: `${profileData.profile} (${profileData.region})`,
                type: OciDmEntityType.ConfigurationProfile,
                profileData,
                compartments: [],
                makeDefault: async () => {
                    await this.setDefaultProfile(profileData);
                },
                getChildren: () => { return profile.compartments; },
            };

            profile.refresh = () => { return this.updateProfile(profile); };

            return profile as IOciDmProfile;
        });
    }

    private async updateProfile(profile: DeepMutable<IOciDmProfile>): Promise<boolean> {
        const actions: Array<{ action: SubscriberAction, entry?: OciDataModelEntry; }> = [];
        profile.state.initialized = true;

        // istanbul ignore catch
        try {
            // First update the profile entry itself.
            // TODO: Implement a backend AP that allows to get the data of a single profile.
            const profiles = await this.#shellSession.mhs.getMdsConfigProfiles();
            const profileData = profiles.find((p) => { return p.profile === profile.profileData.profile; });
            if (profileData) {
                profile.profileData = profileData;
                profile.caption = `${profileData.profile} (${profileData.region})`;
                actions.push({ action: "update", entry: profile });
            }

            profile.compartments.length = 0;

            // Load the entire compartment tree for the profile and cache it.
            const compartmentList = await this.#shellSession.mhs.getMdsCompartments(profile.profileData.profile);
            this.#compartmentCache.set(profile.profileData.profile, compartmentList);

            // Find all compartments that are direct children of the profile.
            // If there is a current compartment, show it *also* as top level compartment entry.
            const parentId = profile.profileData.tenancy;
            compartmentList.forEach((compartmentData) => {
                if (compartmentData.isCurrent || compartmentData.id === parentId) {
                    const compartment: Mutable<IOciDmCompartment> = {
                        id: uuid(),
                        state: createDataModelEntryState(),
                        caption: compartmentData.name,
                        type: OciDmEntityType.Compartment,
                        parent: profile,
                        profileData: profile.profileData,
                        compartmentDetails: compartmentData,
                        compartments: [],
                        dbSystems: [],
                        heatWaveClusters: [],
                        computeInstances: [],
                        bastions: [],
                        loadBalancers: [],
                        getChildren: () => {
                            return [
                                ...compartment.compartments,
                                ...compartment.dbSystems,
                                ...compartment.heatWaveClusters,
                                ...compartment.computeInstances,
                                ...compartment.bastions,
                                ...compartment.loadBalancers,
                            ];
                        },
                        makeCurrent: async () => {
                            return this.setDefaultCompartment(profile.profileData, compartmentData);
                        },
                    };

                    compartment.refresh = () => { return this.updateCompartment(compartment); };

                    profile.compartments.push(compartment as IOciDmCompartment);
                    actions.push({ action: "add", entry: compartment });
                }
            });

            this.notifySubscribers(actions);
        } catch (reason) {
            let message = this.handleServiceError(reason);
            if (message === undefined) {
                message = convertErrorToString(reason);
            }

            void ui.showErrorMessage(`Failed to list the compartments of this profile:\n${message}`, {});
        }

        return true;
    }

    private async setDefaultProfile(profileData: IMdsProfileData): Promise<void> {
        try {
            await this.#shellSession.mhs.setDefaultConfigProfile(profileData.profile);
            void ui.showInformationMessage(`Default config profile set to ${profileData.profile}.`, {});
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Error while setting default config profile: ${message}`, {});
        }
    }

    private async setDefaultCompartment(profileData: IMdsProfileData, compartment: ICompartment): Promise<void> {
        try {
            await this.#shellSession.mhs.setCurrentCompartment({
                compartmentId: compartment.id,
                configProfile: profileData.profile,
                interactive: false,
                raiseExceptions: true,
            });
            void ui.showInformationMessage(`${compartment.name} in ${profileData.profile} is now the current ` +
                `compartment.`, {});
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Error while setting a default compartment: ${message}`, {});
        }
    }

    private async updateCompartment(compartment: DeepMutable<IOciDmCompartment>): Promise<boolean> {
        const actions: Array<{ action: SubscriberAction, entry?: OciDataModelEntry; }> = [];
        compartment.state.initialized = true;

        const profileData = compartment.profileData;
        const compartmentList = this.#compartmentCache.get(profileData.profile);
        if (!compartmentList) {
            return false;
        }

        try {
            // TODO: implement a diff algorithm to update the list of compartments.
            compartment.compartments.length = 0;

            // Find all sub compartments of the current compartment.
            compartmentList.forEach((compartmentData) => {
                if (compartmentData.compartmentId === compartment.compartmentDetails.id) {
                    const subCompartment: Mutable<IOciDmCompartment> = {
                        id: compartmentData.id,
                        state: createDataModelEntryState(),
                        caption: compartmentData.name,
                        type: OciDmEntityType.Compartment,
                        parent: compartment,
                        profileData: compartment.profileData,
                        compartmentDetails: compartmentData,
                        compartments: [],
                        dbSystems: [],
                        heatWaveClusters: [],
                        computeInstances: [],
                        bastions: [],
                        loadBalancers: [],
                        getChildren: () => {
                            return [
                                ...subCompartment.compartments,
                                ...subCompartment.dbSystems,
                                ...subCompartment.heatWaveClusters,
                                ...subCompartment.computeInstances,
                                ...subCompartment.bastions,
                                ...subCompartment.loadBalancers,
                            ];
                        },
                        makeCurrent: async () => {
                            return this.setDefaultCompartment(compartment.profileData, compartmentData);
                        },
                    };

                    subCompartment.refresh = () => {
                        return this.updateCompartment(subCompartment);
                    };

                    compartment.compartments.push(subCompartment as IOciDmCompartment);
                    actions.push({ action: "add", entry: subCompartment });
                }
            });

            this.notifySubscribers(actions);
        } catch (error) {
            const message = convertErrorToString(error);
            if (message.includes("NotAuthorizedOrNotFound")) {
                void ui.showWarningMessage("Not authorized to list the sub-compartment of this compartment.", {});
            } else {
                void ui.showErrorMessage("Failed to list the sub-compartments of this compartment:\n" + message, {});
            }
        }

        const result = await Promise.all([
            this.updateDbSystems(profileData.profile, compartment),
            this.updateComputeInstances(profileData.profile, compartment),
            this.updateBastions(profileData.profile, compartment),
            this.updateLoadBalancers(profileData.profile, compartment),
        ]);

        return result.every((r) => { return r; }); // Return true if all results are true.
    }

    private async updateDbSystems(profileId: string, compartment: IOciDmCompartment): Promise<boolean> {
        try {
            const actions: Array<{ action: SubscriberAction, entry?: OciDataModelEntry; }> = [];

            const systems = await this.#shellSession.mhs.getMdsMySQLDbSystems(profileId,
                compartment.compartmentDetails.id);
            systems.forEach((dbSystem) => {
                const dbSystemEntry: Mutable<IOciDmDbSystem> = {
                    id: uuid(),
                    state: createDataModelEntryState(true),
                    parent: compartment,
                    details: dbSystem,
                    caption: dbSystem.displayName,
                    type: OciDmEntityType.DbSystem,
                };
                dbSystemEntry.refresh = () => {
                    return this.updateDbSystem(dbSystemEntry);
                };

                // If this DB system supports HW or analytics, add a corresponding HeatWave cluster entry.
                if (dbSystem.isSupportedForHwCluster || dbSystem.isSupportedForAnalyticsCluster) {
                    const clusterSize = dbSystem.heatWaveCluster?.clusterSize ?? 0;
                    dbSystemEntry.cluster = {
                        id: uuid(),
                        state: createDataModelEntryState(true, true),
                        parent: dbSystemEntry as IOciDmDbSystem,
                        caption: `HeatWave Cluster (${clusterSize} node${clusterSize > 1 ? "s" : ""})`,
                        type: OciDmEntityType.HeatWaveCluster,
                    };
                }

                compartment.dbSystems.push(dbSystemEntry as IOciDmDbSystem);
                actions.push({ action: "add", entry: dbSystemEntry });
            });

            return true;
        } catch (error) {
            const message = convertErrorToString(error);
            if (message.includes("NotAuthorizedOrNotFound")) {
                void ui.showWarningMessage("Not authorized to list the MySQL DB Systems in this compartment.", {});
            }

            return false;
        }
    }

    private updateDbSystem(dbSystem: DeepMutable<IOciDmDbSystem>): Promise<boolean> {
        if (dbSystem.state.initialized) {
            return Promise.resolve(true);
        }
        dbSystem.state.initialized = true;

        return Promise.resolve(true);
    }

    private async updateComputeInstances(profileId: string, compartment: IOciDmCompartment): Promise<boolean> {
        try {
            const actions: Array<{ action: SubscriberAction, entry?: OciDataModelEntry; }> = [];

            // TODO: implement a diff algorithm to update the list of compute instances.
            compartment.computeInstances.length = 0;
            actions.push({ action: "clear", entry: compartment });

            const instances = await this.#shellSession.mhs.getMdsComputeInstances(profileId,
                compartment.compartmentDetails.id);
            instances.forEach((instance) => {
                const computeInstance: Mutable<IOciDmComputeInstance> = {
                    type: OciDmEntityType.ComputeInstance,
                    id: uuid(),
                    state: createDataModelEntryState(true),
                    instance,
                    caption: instance.displayName ?? instance.id,
                    parent: compartment,
                };
                computeInstance.refresh = () => { return this.updateComputeInstance(computeInstance); };

                compartment.computeInstances.push(computeInstance as IOciDmComputeInstance);
                actions.push({ action: "add", entry: computeInstance });
            });

            this.notifySubscribers(actions);

            return true;
        } catch (error) {
            const message = convertErrorToString(error);
            if (message.includes("NotAuthorizedOrNotFound")) {
                void ui.showErrorMessage("Not authorized to list the compute instances in this compartment.", {});
            }

            return false;
        }
    }

    private updateComputeInstance(computeInstance: DeepMutable<IOciDmComputeInstance>): Promise<boolean> {
        if (computeInstance.state.initialized) {
            return Promise.resolve(true);
        }
        computeInstance.state.initialized = true;

        return Promise.resolve(true);
    }

    private async updateBastions(profileId: string, compartment: IOciDmCompartment): Promise<boolean> {
        try {
            const actions: Array<{ action: SubscriberAction, entry?: OciDataModelEntry; }> = [];

            compartment.bastions.length = 0;
            const bastions = await this.#shellSession.mhs.getMdsBastions(profileId,
                compartment.compartmentDetails.id);
            bastions.forEach((bastion) => {
                const bastionEntry: Mutable<IOciDmBastion> = {
                    id: uuid(),
                    state: createDataModelEntryState(true),
                    parent: compartment,
                    summary: bastion,
                    caption: bastion.name,
                    type: OciDmEntityType.Bastion,
                    makeCurrent: async () => {
                        await this.setDefaultBastion(compartment.profileData, bastion);
                    },
                };
                bastionEntry.refresh = () => { return this.updateBastion(bastionEntry); };

                compartment.bastions.push(bastionEntry as IOciDmBastion);
                actions.push({ action: "add", entry: bastionEntry });
            });

            this.notifySubscribers(actions);

            return true;
        } catch (error) {
            const message = convertErrorToString(error);
            if (message.includes("NotAuthorizedOrNotFound")) {
                void ui.showErrorMessage("Not authorized to list the bastions in this compartment.", {});
            }

            return false;
        }
    }

    private updateBastion(bastion: DeepMutable<IOciDmBastion>): Promise<boolean> {
        if (bastion.state.initialized) {
            return Promise.resolve(true);
        }
        bastion.state.initialized = true;

        return Promise.resolve(true);
    }

    private async setDefaultBastion(profileData: IMdsProfileData, bastion: IBastionSummary): Promise<void> {
        try {
            void ui.showInformationMessage(`Setting current bastion to ${bastion.name} ...`, {});
            await this.#shellSession.mhs.setCurrentBastion({
                bastionId: bastion.id,
                configProfile: profileData.profile,
                interactive: false,
                raiseExceptions: true,
            });
            void ui.showInformationMessage(`Current bastion set to ${bastion.name}.`, {});
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Error while setting a current bastion: ${message}`, {});
        }
    }

    private async updateLoadBalancers(profileId: string, compartment: IOciDmCompartment): Promise<boolean> {
        try {
            const actions: Array<{ action: SubscriberAction, entry?: OciDataModelEntry; }> = [];

            compartment.loadBalancers.length = 0;
            const loadBalancers = await this.#shellSession.mhs.listLoadBalancers(profileId,
                compartment.compartmentDetails.id);
            loadBalancers.forEach((loadBalancer) => {
                const loadBalancerEntry: IOciDmLoadBalancer = {
                    id: loadBalancer.id,
                    state: createDataModelEntryState(true, true),
                    caption: loadBalancer.displayName,
                    type: OciDmEntityType.LoadBalancer,
                    details: loadBalancer,
                    parent: compartment,
                };

                compartment.loadBalancers.push(loadBalancerEntry);
                actions.push({ action: "add", entry: loadBalancerEntry });
            });

            this.notifySubscribers(actions);

            return true;
        } catch (error) {
            const message = convertErrorToString(error);
            if (message.includes("NotAuthorizedOrNotFound")) {
                void ui.showErrorMessage("Not authorized to list the load balancers in this compartment.", {});
            }

            return false;
        }
    }

    /**
     * Checks the given error for a service error and if one was found its message is returned.
     *
     * @param reason The error to check.
     *
     * @returns The error message if a service error was found, otherwise `undefined`.
     */
    // istanbul ignore next
    private handleServiceError(reason: unknown): string | undefined {
        if (reason instanceof Error) {
            const msg = reason.message;
            if (msg.includes("oci.exceptions.ServiceError")) {
                // Extract the error message from the exception.
                const lines = msg.split("\n");
                const errorLine = lines.find((line) => { return line.startsWith("oci.exceptions.ServiceError"); })!;
                const error = errorLine.substring(errorLine.indexOf("{"));

                // OCI errors are just serialized python dictionaries, so they use single quotes.
                // TODO: check if this is still true. It doesn't work with embedded single quotes.
                const json = error.replace(/'/g, "\"");
                const errorDetails = JsonParser.parseJson(json) as IDictionary;

                return errorDetails.message as string;
            }
        }
    }

    private notifySubscribers = (list: Array<ISubscriberActionType<OciDataModelEntry>>): void => {
        for (const subscriber of this.#subscribers) {
            subscriber(list);
        }
    };
}
