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

import {
    IBastionSession, IBastionSummary, ICompartment, IComputeInstance, ILoadBalancer, IMySQLDbSystem,
    IMySQLDbSystemShapeSummary, IComputeShape,
} from "../../communication/index.js";
import { MessageScheduler, DataCallback } from "../../communication/MessageScheduler.js";
import {
    IMdsProfileData, ShellAPIMds, IShellMdsSetCurrentCompartmentKwargs, IShellMdsSetCurrentBastionKwargs,
} from "../../communication/ProtocolMds.js";

export class ShellInterfaceMds {

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

    public async listLoadBalancers(configProfile: string, compartmentId: string): Promise<ILoadBalancer[]> {
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
}
