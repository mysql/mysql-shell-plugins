/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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
    IMySQLDbSystemShapeSummary, LoadBalancer, type IBucketListObjects, type IBucketSummary,
} from "../../communication/index.js";
import { DataCallback, MessageScheduler } from "../../communication/MessageScheduler.js";
import {
    IMdsChatData, IMdsChatResult, IMdsLakehouseStatus, IMdsProfileData, IShellMdsSetCurrentBastionKwargs,
    IShellMdsSetCurrentCompartmentKwargs, ShellAPIMds, type IMdsChatStatus,
} from "../../communication/ProtocolMds.js";

/** The interface to the MySQL Heatwave Service. */
export class ShellInterfaceMhs {

    public async getMdsConfigProfiles(configFilePath?: string): Promise<IMdsProfileData[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMds.MdsListConfigProfiles,
            parameters: { kwargs: { configFilePath } },
        });

        return response.result;
    }

    public async setDefaultConfigProfile(profile: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMds.MdsSetDefaultConfigProfile,
            parameters: { args: { profileName: profile } },
        });
    }

    public async getMdsCompartments(configProfile: string, compartmentId?: string): Promise<ICompartment[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMds.MdsListCompartments,
            parameters: { kwargs: { configProfile, compartmentId } },
        });

        return response.result;
    }

    public async getCompartmentById(configProfile: string, compartmentId: string): Promise<ICompartment | undefined> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMds.MdsGetCompartmentById,
            parameters: { args: { compartmentId }, kwargs: { configProfile } },
        });

        return response.result;
    }

    public async getCurrentCompartmentId(configProfile: string): Promise<string | undefined> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMds.MdsGetCurrentCompartmentId,
            parameters: { kwargs: { profileName: configProfile } },
        });

        return response.result;
    }


    public async getMdsMySQLDbSystems(configProfile: string, compartmentId: string): Promise<IMySQLDbSystem[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMds.MdsListDbSystems,
            parameters: { kwargs: { configProfile, compartmentId } },
        });

        return response.result;
    }

    public async getMdsMySQLDbSystem(configProfile: string, dbSystemId: string): Promise<IMySQLDbSystem> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMds.MdsGetDbSystem,
            parameters: { kwargs: { configProfile, dbSystemId } },
        });

        return response.result;
    }

    public async getMdsComputeInstances(configProfile: string, compartmentId: string): Promise<IComputeInstance[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMds.MdsListComputeInstances,
            parameters: { kwargs: { configProfile, compartmentId } },
        });

        return response.result;
    }

    public async getMdsBastions(configProfile: string, compartmentId: string,
        validForDbSystemId?: string): Promise<IBastionSummary[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMds.MdsListBastions,
            parameters: { kwargs: { configProfile, compartmentId, validForDbSystemId } },
        });

        return response.result;
    }

    public async getMdsBastion(configProfile: string, bastionId: string): Promise<IBastionSummary> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMds.MdsGetBastion,
            parameters: { kwargs: { configProfile, bastionId } },
        });

        return response.result;
    }

    public async createBastion(configProfile: string, dbSystemId: string,
        awaitActiveState?: boolean): Promise<IBastionSummary> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMds.MdsCreateBastion,
            parameters: { kwargs: { configProfile, dbSystemId, awaitActiveState } },
        });

        return response.result;
    }

    public async createBastionSession(configProfile: string, targetId: string, sessionType: string,
        compartmentId: string, awaitCreation: boolean,
        callback: DataCallback<ShellAPIMds.MdsCreateBastionSession>): Promise<IBastionSession> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMds.MdsCreateBastionSession,
            parameters: { kwargs: { configProfile, targetId, sessionType, compartmentId, awaitCreation } },
            onData: callback,
        });

        return response.result;
    }

    public async listLoadBalancers(configProfile: string, compartmentId: string): Promise<LoadBalancer[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMds.MdsListLoadBalancers,
            parameters: { kwargs: { configProfile, compartmentId } },
        });

        return response.result;
    }

    public async setCurrentCompartment(parameters?: IShellMdsSetCurrentCompartmentKwargs): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMds.MdsSetCurrentCompartment,
            parameters: { kwargs: parameters },
        });
    }

    public async setCurrentBastion(parameters?: IShellMdsSetCurrentBastionKwargs): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMds.MdsSetCurrentBastion,
            parameters: { kwargs: parameters },
        });
    }

    public async listDbSystemShapes(isSupportedFor: string, configProfile: string,
        compartmentId: string): Promise<IMySQLDbSystemShapeSummary[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMds.MdsListDbSystemShapes,
            parameters: { kwargs: { configProfile, isSupportedFor, compartmentId } },
        });

        return response.result;
    }

    public async listComputeShapes(configProfile: string,
        compartmentId: string): Promise<IComputeShape[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMds.MdsListComputeShapes,
            parameters: { kwargs: { configProfile, compartmentId } },
        });

        return response.result;
    }

    public async getMdsBuckets(configProfile: string, compartmentId?: string): Promise<IBucketSummary[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMds.MdsListBuckets,
            parameters: { kwargs: { configProfile, compartmentId } },
        });

        return response.result;
    }

    public async getMdsBucketObjects(configProfile: string, compartmentId?: string, bucketName?: string,
        name?: string, prefix?: string, delimiter?: string): Promise<IBucketListObjects> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMds.MdsListBucketObjects,
            parameters: { kwargs: { configProfile, compartmentId, bucketName, name, prefix, delimiter } },
        });

        return response.result;
    }

    public async createMdsBucketObjects(configProfile: string, filePaths: string[], prefix: string,
        bucketName: string, compartmentId: string, fixExtension?: boolean,
        callback?: DataCallback<ShellAPIMds.MdsCreateBucketObjects>): Promise<void> {
        await MessageScheduler.get.sendRequest({
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
        await MessageScheduler.get.sendRequest({
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
                    options,
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
                    options,
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
}
