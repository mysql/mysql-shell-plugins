/*
 * Copyright (c) 2021, 2026, Oracle and/or its affiliates.
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

import type { IDictionary } from "../../app-logic/general-types.js";
import {
    IBastionSession, IBastionSummary, ICompartment, IComputeInstance, IComputeShape, IMySQLDbSystem,
    IMySQLDbSystemShapeSummary, ISubnet, IVcn, LoadBalancer, type IBucketListObjects, type IBucketSummary,
} from "../../communication/index.js";
import {
    DataCallback, MessageScheduler
} from "../../communication/MessageScheduler.js";
import { type IShellDictionary } from "../../communication/Protocol.js";
import {
    IRegion, IMdsChatData, IMdsChatResult, IMdsLakehouseStatus, IMdsProfileData, IShellMdsSetCurrentBastionKwargs,
    IShellMdsSetCurrentCompartmentKwargs, ShellAPIMds, type IMdsChatStatus,
} from "../../communication/ProtocolMds.js";
import { Shape } from "../../oci-typings/oci-core/lib/model/shape.js";
import { IShellInteractiveBackend } from "./ShellInteractiveBackend.js";

/** The interface to the MySQL Heatwave Service. */
export class ShellInterfaceMhs {
    private backend: IShellInteractiveBackend;

    public constructor(backend: IShellInteractiveBackend) {
        this.backend = backend;
    }

    public async getMdsConfigProfiles(configFilePath?: string): Promise<IMdsProfileData[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMds.MdsListConfigProfiles,
            parameters: { kwargs: { configFilePath } },
        });

        return response.result;
    }

    public async setCurrentConfigProfile(profile: string, configPath?: string): Promise<void> {
        await this.backend.sendInteractiveRequest({
            requestType: ShellAPIMds.MdsSetCurrentConfigProfile,
            parameters: { args: { profileName: profile, configFilePath: configPath, interactive: false } },
        });
    }

    public async setDefaultConfigProfile(profile: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMds.MdsSetDefaultConfigProfile,
            parameters: { args: { profileName: profile } },
        });
    }

    public async getMdsCompartments(configProfile: string, compartmentId?: string): Promise<ICompartment[]> {
        const response = await this.backend.sendInteractiveRequest({
            requestType: ShellAPIMds.MdsListCompartments,
            parameters: { kwargs: { configProfile, compartmentId } },
        });

        return response.result;
    }

    public async getCompartmentById(configProfile: string, compartmentId: string): Promise<ICompartment | undefined> {
        const response = await this.backend.sendInteractiveRequest({
            requestType: ShellAPIMds.MdsGetCompartmentById,
            parameters: { args: { compartmentId }, kwargs: { configProfile } },
        });

        return response.result;
    }

    public async getCurrentCompartmentId(configProfile: string): Promise<string | undefined> {
        const response = await this.backend.sendInteractiveRequest({
            requestType: ShellAPIMds.MdsGetCurrentCompartmentId,
            parameters: { kwargs: { profileName: configProfile } },
        });

        return response.result;
    }

    public async getMdsMySQLDbSystems(configProfile: string, compartmentId: string): Promise<IMySQLDbSystem[]> {
        const response = await this.backend.sendInteractiveRequest({
            requestType: ShellAPIMds.MdsListDbSystems,
            parameters: { kwargs: { configProfile, compartmentId } },
        });

        return response.result;
    }

    public async getMdsMySQLDbSystem(configProfile: string, dbSystemId: string): Promise<IMySQLDbSystem> {
        const response = await this.backend.sendInteractiveRequest({
            requestType: ShellAPIMds.MdsGetDbSystem,
            parameters: { kwargs: { configProfile, dbSystemId } },
        });

        return response.result;
    }

    public async getMdsComputeInstances(configProfile: string, compartmentId: string): Promise<IComputeInstance[]> {
        const response = await this.backend.sendInteractiveRequest({
            requestType: ShellAPIMds.MdsListComputeInstances,
            parameters: { kwargs: { configProfile, compartmentId } },
        });

        return response.result;
    }

    public async getMdsBastions(configProfile: string, compartmentId: string,
        validForDbSystemId?: string): Promise<IBastionSummary[]> {
        const response = await this.backend.sendInteractiveRequest({
            requestType: ShellAPIMds.MdsListBastions,
            parameters: { kwargs: { configProfile, compartmentId, validForDbSystemId } },
        });

        return response.result;
    }

    public async getMdsBastion(configProfile: string, bastionId: string): Promise<IBastionSummary> {
        const response = await this.backend.sendInteractiveRequest({
            requestType: ShellAPIMds.MdsGetBastion,
            parameters: { kwargs: { configProfile, bastionId } },
        });

        return response.result;
    }

    public async createBastion(configProfile: string, dbSystemId: string,
        awaitActiveState?: boolean): Promise<IBastionSummary> {
        const response = await this.backend.sendInteractiveRequest({
            requestType: ShellAPIMds.MdsCreateBastion,
            parameters: { kwargs: { configProfile, dbSystemId, awaitActiveState } },
        });

        return response.result;
    }

    public async createBastionSession(configProfile: string, targetId: string, sessionType: string,
        compartmentId: string, awaitCreation: boolean,
        callback: DataCallback<ShellAPIMds.MdsCreateBastionSession>): Promise<IBastionSession> {
        const response = await this.backend.sendInteractiveRequest({
            requestType: ShellAPIMds.MdsCreateBastionSession,
            parameters: { kwargs: { configProfile, targetId, sessionType, compartmentId, awaitCreation } },
            onData: callback,
        });

        return response.result;
    }

    public async listLoadBalancers(configProfile: string, compartmentId: string): Promise<LoadBalancer[]> {
        const response = await this.backend.sendInteractiveRequest({
            requestType: ShellAPIMds.MdsListLoadBalancers,
            parameters: { kwargs: { configProfile, compartmentId } },
        });

        return response.result;
    }

    public async setCurrentCompartment(parameters?: IShellMdsSetCurrentCompartmentKwargs): Promise<void> {
        await this.backend.sendInteractiveRequest({
            requestType: ShellAPIMds.MdsSetCurrentCompartment,
            parameters: { kwargs: parameters },
        });
    }

    public async setCurrentBastion(parameters?: IShellMdsSetCurrentBastionKwargs): Promise<void> {
        await this.backend.sendInteractiveRequest({
            requestType: ShellAPIMds.MdsSetCurrentBastion,
            parameters: { kwargs: parameters },
        });
    }

    public async listAvailabilityDomains(configProfile: string, compartmentId?: string): Promise<string[]> {
        const response = await this.backend.sendInteractiveRequest({
            requestType: ShellAPIMds.MdsListAvailabilityDomains,
            parameters: { kwargs: { configProfile, compartmentId, interactive: false, returnFormatted: false } },
        });

        return response.result.map((i) => {
            return i.name!;
        });
    }

    public async listDbSystemShapes(isSupportedFor: string, configProfile: string,
        compartmentId: string, availabilityDomain?: string): Promise<IMySQLDbSystemShapeSummary[]> {
        const response = await this.backend.sendInteractiveRequest({
            requestType: ShellAPIMds.MdsListDbSystemShapes,
            parameters: { kwargs: { configProfile, isSupportedFor, compartmentId, availabilityDomain, interactive: false } },
        });

        // return response.result;
        return (response.result as Array<IMySQLDbSystemShapeSummary
            & { memorySizeInGbs: IMySQLDbSystemShapeSummary["memorySizeInGBs"] }>).map((i) => {
            return {
                ...i,
                memorySizeInGBs: i.memorySizeInGbs,
            };
        });
    }

    public async listComputeShapes(configProfile: string,
        compartmentId: string, availabilityDomain?: string): Promise<IComputeShape[]> {
        const response = await this.backend.sendInteractiveRequest({
            requestType: ShellAPIMds.MdsListComputeShapes,
            parameters: { kwargs: { configProfile, compartmentId, availabilityDomain, interactive: false } },
        });

        // return response.result;
        return (response.result as Array<Shape & { memoryInGbs: Shape["memoryInGBs"] }>).map((i) => {
            return {
                ...i,
                memoryInGBs: i.memoryInGbs,
            };
        });
    }

    public async getMdsBuckets(configProfile: string, compartmentId?: string): Promise<IBucketSummary[]> {
        const response = await this.backend.sendInteractiveRequest({
            requestType: ShellAPIMds.MdsListBuckets,
            parameters: { kwargs: { configProfile, compartmentId } },
        });

        return response.result;
    }

    public async getMdsBucketObjects(configProfile: string, compartmentId?: string, bucketName?: string,
        name?: string, prefix?: string, delimiter?: string): Promise<IBucketListObjects> {
        const response = await this.backend.sendInteractiveRequest({
            requestType: ShellAPIMds.MdsListBucketObjects,
            parameters: { kwargs: { configProfile, compartmentId, bucketName, name, prefix, delimiter } },
        });

        return response.result;
    }

    public async createMdsBucketObjects(configProfile: string, filePaths: string[], prefix: string,
        bucketName: string, compartmentId: string, fixExtension?: boolean,
        callback?: DataCallback<ShellAPIMds.MdsCreateBucketObjects>): Promise<void> {
        await this.backend.sendInteractiveRequest({
            requestType: ShellAPIMds.MdsCreateBucketObjects,
            parameters: {
                args: { filePaths, prefix },
                kwargs: { configProfile, compartmentId, bucketName, fixExtension },
            },
            onData: callback,
        });
    }

    public async getMdsDeleteBucketObjects(configProfile: string, compartmentId?: string, bucketName?: string,
        name?: string): Promise<void> {
        await this.backend.sendInteractiveRequest({
            requestType: ShellAPIMds.MdsDeleteBucketObject,
            parameters: {
                args: { name },
                kwargs: { configProfile, compartmentId, bucketName },
            },
        });
    }

    public async getMdsGetGenAiStatus(moduleSessionId: string): Promise<IMdsChatStatus> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMds.MdsGenaiStatus,
            parameters: {
                args: {
                    moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async executeChatRequest(prompt: string, moduleSessionId: string, options?: IDictionary,
        callback?: DataCallback<ShellAPIMds.MdsGenaiChat>,
    ): Promise<IMdsChatResult> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMds.MdsGenaiChat,
            parameters: {
                args: {
                    prompt,
                },
                kwargs: {
                    options: options as IShellDictionary,
                    moduleSessionId,
                },
            },
            onData: callback,
        });

        return response.result;
    }

    public async getMdsGetLakehouseStatus(moduleSessionId: string, schemaName?: string,
        memoryUsed?: number, memoryTotal?: number,
        lakehouseTablesHash?: string, lakehouseTasksHash?: string): Promise<IMdsLakehouseStatus> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMds.MdsGenaiLakehouseStatus,
            parameters: {
                kwargs: {
                    schemaName, memoryUsed, memoryTotal, lakehouseTablesHash, lakehouseTasksHash,
                    moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async saveMdsChatOptions(filePath: string, options: IDictionary): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMds.MdsGenaiSaveChatOptions,
            parameters: {
                args: {
                    filePath,
                },
                kwargs: {
                    options: options as IShellDictionary,
                },
            },
        });
    }

    public async loadMdsChatOptions(filePath: string): Promise<IMdsChatData> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMds.MdsGenaiLoadChatOptions,
            parameters: {
                args: {
                    filePath,
                },
            },
        });

        return response.result;
    }

    public async getMdsNetworks(configProfile: string, compartmentId?: string): Promise<IVcn[]> {
        const response = await this.backend.sendInteractiveRequest({
            requestType: ShellAPIMds.MdsListNetworks,
            parameters: { kwargs: { configProfile, compartmentId, returnFormatted: false } },
        });

        return response.result;
    }

    public async getMdsSubnets(configProfile: string, networkId?: string): Promise<ISubnet[]> {
        const response = await this.backend.sendInteractiveRequest({
            requestType: ShellAPIMds.MdsListSubnets,
            parameters: { kwargs: { configProfile, networkId, returnFormatted: false, interactive: false } },
        });

        return response.result;
    }

    public async getRegions(): Promise<IRegion[]> {
        const response = await this.backend.sendInteractiveRequest({
            requestType: ShellAPIMds.MdsGetRegions,
            parameters: { args: {} },
        });

        return response.result;
    }
}
