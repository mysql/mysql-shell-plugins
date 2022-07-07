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
import { MessageScheduler, ProtocolMrs } from "../../communication";
import { webSession } from "../WebSession";

export class ShellInterfaceMrs {

    // The key under which the module session is stored in the WebSession instance.
    public moduleSessionLookupId = "";

    public listServices(): ListenerEntry {
        const request = ProtocolMrs.getRequestListServices({ moduleSessionId: this.moduleSessionId });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsListServices" });
    }

    public addService(urlContextRoot: string, urlProtocol: string, urlHostName: string, isDefault?: boolean,
        comments?: string, enabled?: boolean): ListenerEntry {
        const request = ProtocolMrs.getRequestAddService(urlContextRoot, urlHostName, enabled, {
            moduleSessionId: this.moduleSessionId,
            urlProtocol,
            isDefault,
            comments,
        });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsAddService" });
    }

    public updateService(serviceId: number, urlContextRoot: string, urlHostName: string): ListenerEntry {
        const request = ProtocolMrs.getRequestUpdateService({
            moduleSessionId: this.moduleSessionId,
            serviceId,
            urlContextRoot,
            urlHostName,
        });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsUpdateService" });
    }

    public deleteService(serviceId?: number): ListenerEntry {
        const request = ProtocolMrs.getRequestDeleteService({ moduleSessionId: this.moduleSessionId, serviceId });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsDeleteService" });
    }

    public setDefaultService(serviceId: number): ListenerEntry {
        const request = ProtocolMrs.getRequestSetServiceDefault({
            moduleSessionId: this.moduleSessionId,
            serviceId,
        });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsSetDefaultService" });
    }

    public listSchemas(serviceId: number): ListenerEntry {
        const request = ProtocolMrs.getRequestListSchemas({ serviceId, moduleSessionId: this.moduleSessionId });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsListSchemas" });
    }

    public deleteSchema(schemaId: number, serviceId: number): ListenerEntry {
        const request = ProtocolMrs.getRequestDeleteSchema({
            moduleSessionId: this.moduleSessionId,
            schemaId,
            serviceId,
        });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsDeleteSchema" });
    }

    public addSchema(schemaName: string, requestPath: string,
        requiresAuth: boolean, serviceId?: number, itemsPerPage?: number, comments?: string): ListenerEntry {
        const request = ProtocolMrs.getRequestAddSchema({
            moduleSessionId: this.moduleSessionId,
            schemaName,
            requestPath,
            requiresAuth,
            serviceId,
            itemsPerPage,
            comments,
        });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsAddSchema" });
    }

    public updateSchema(schemaId: number, schemaName: string, requestPath: string,
        requiresAuth: boolean, serviceId?: number, value?: string, interactive?: boolean,
        raiseExceptions?: boolean): ListenerEntry {
        const request = ProtocolMrs.getRequestUpdateSchema({
            moduleSessionId: this.moduleSessionId,
            schemaId,
            schemaName,
            serviceId,
            value,
            interactive,
            raiseExceptions,
        });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsUpdateSchema" });
    }

    public addDbObject(dbObjectName: string, dbObjectType: string, schemaName: string, autoAddSchema: boolean,
        requestPath: string, crudOperations: string[], crudOperationFormat: string, requiresAuth: boolean,
        rowUserOwnershipEnforced: boolean, rowUserOwnershipColumn?: string,
        schemaId?: number, itemsPerPage?: number, comments?: string): ListenerEntry {
        const request = ProtocolMrs.getRequestAddDbObject({
            moduleSessionId: this.moduleSessionId,
            dbObjectName,
            dbObjectType,
            schemaId,
            schemaName,
            autoAddSchema,
            requestPath,
            crudOperations,
            crudOperationFormat,
            requiresAuth,
            itemsPerPage,
            rowUserOwnershipEnforced,
            rowUserOwnershipColumn,
            comments,
        });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsAddService" });
    }

    public listDbObjects(schemaId: number): ListenerEntry {
        const request = ProtocolMrs.getRequestListDbObjects(schemaId, { moduleSessionId: this.moduleSessionId });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsListDbObjects" });
    }

    private get moduleSessionId(): string | undefined {
        return webSession.moduleSessionId(this.moduleSessionLookupId);
    }
}
