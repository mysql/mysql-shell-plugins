/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

import { ListenerEntry } from "../Dispatch";
import {
    ProtocolMds, IShellSetCurrentCompartmentKwargs, IShellSetCurrentBastionKwargs, MessageScheduler,
} from "../../communication";

export class ShellInterfaceMds {

    public getMdsConfigProfiles(configFilePath?: string): ListenerEntry {
        const request = ProtocolMds.getRequestListConfigProfiles({ configFilePath });

        return MessageScheduler.get.sendRequest(request, { messageClass: "getMdsConfigProfiles" });
    }

    public setDefaultConfigProfile(profile: string): ListenerEntry {
        const request = ProtocolMds.getRequestSetDefaultConfigProfile(profile);

        return MessageScheduler.get.sendRequest(request, { messageClass: "setMdsDefaultConfigProfile" });
    }

    public getMdsCompartments(configProfile: string, compartmentId?: string): ListenerEntry {
        const request = ProtocolMds.getRequestListCompartments({ configProfile, compartmentId });

        return MessageScheduler.get.sendRequest(request, { messageClass: "getMdsCompartments" });
    }

    public getMdsMySQLDbSystems(configProfile: string, compartmentId: string): ListenerEntry {
        const request = ProtocolMds.getRequestListDbSystems({ configProfile, compartmentId });

        return MessageScheduler.get.sendRequest(request, { messageClass: "getMdsMySQLDbSystems" });
    }

    public getMdsMySQLDbSystem(configProfile: string, dbSystemId: string): ListenerEntry {
        const request = ProtocolMds.getRequestGetDbSystem({ configProfile, dbSystemId });

        return MessageScheduler.get.sendRequest(request, { messageClass: "getMdsMySQLDbSystem" });
    }

    public getMdsComputeInstances(configProfile: string, compartmentId: string): ListenerEntry {
        const request = ProtocolMds.getRequestListComputeInstances({ configProfile, compartmentId });

        return MessageScheduler.get.sendRequest(request, { messageClass: "getMdsComputeInstances" });
    }

    public getMdsBastions(configProfile: string, compartmentId: string, validForDbSystemId?: string): ListenerEntry {
        const request = ProtocolMds.getRequestListBastions({ configProfile, compartmentId, validForDbSystemId });

        return MessageScheduler.get.sendRequest(request, { messageClass: "getMdsBastions" });
    }

    public getMdsBastion(configProfile: string, bastionId: string): ListenerEntry {
        const request = ProtocolMds.getRequestGetBastion({ configProfile, bastionId, raiseExceptions: true });

        return MessageScheduler.get.sendRequest(request, { messageClass: "getMdsBastion" });
    }

    public createBastion(configProfile: string, dbSystemId: string, awaitActiveState?: boolean): ListenerEntry {
        const request = ProtocolMds.getRequestCreateBastion({ configProfile, dbSystemId, awaitActiveState });

        return MessageScheduler.get.sendRequest(request, { messageClass: "createBastion" });
    }

    public createBastionSession(
        configProfile: string, targetId: string, sessionType: string, compartmentId: string,
        awaitCreation: boolean): ListenerEntry {
        const request = ProtocolMds.getRequestCreateBastionSession({
            configProfile,
            targetId,
            sessionType,
            compartmentId,
            awaitCreation,
        });

        return MessageScheduler.get.sendRequest(request, { messageClass: "createBastionSession" });
    }

    public listLoadBalancers(configProfile: string, compartmentId: string): ListenerEntry {
        const request = ProtocolMds.getRequestListLoadBalancers({
            configProfile,
            compartmentId,
        });

        return MessageScheduler.get.sendRequest(request, { messageClass: "getMdsLoadBalancers" });
    }

    public setCurrentCompartment(parameters?: IShellSetCurrentCompartmentKwargs): ListenerEntry {
        const request = ProtocolMds.getRequestSetCurrentCompartment(parameters);

        return MessageScheduler.get.sendRequest(request, { messageClass: "setCurrentCompartment" });
    }

    public setCurrentBastion(parameters?: IShellSetCurrentBastionKwargs): ListenerEntry {
        const request = ProtocolMds.getRequestSetCurrentBastion(parameters);

        return MessageScheduler.get.sendRequest(request, { messageClass: "setCurrentBastion" });
    }
}
