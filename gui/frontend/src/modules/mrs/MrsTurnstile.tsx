/*
 * Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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

import { ComponentChild, createRef, RefObject } from "preact";
import { DialogResponseClosure, DialogType, IDialogRequest, IDictionary } from "../../app-logic/Types";

import { IShellDictionary } from "../../communication/Protocol";

import {
    IMrsDbObjectData, IMrsDbObjectFieldData, IMrsObject,
    IMrsServiceData,
} from "../../communication/ProtocolMrs";
import { ValueDialogBase } from "../../components/Dialogs/ValueDialogBase";
import { ComponentBase } from "../../components/ui/Component/ComponentBase";
import { IMrsDbObjectEditRequest, requisitions } from "../../supplement/Requisitions";

import { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface/ShellInterfaceSqlEditor";
import { MrsDbObjectDialog } from "./dialogs/MrsDbObjectDialog";

interface IMrsEditObjectData extends IDictionary {
    serviceId: string,
    dbSchemaId: string,
    dbSchemaPath: string,
    name: string,
    requestPath: string,
    requiresAuth: boolean,
    enabled: boolean,
    itemsPerPage: number,
    comments: string,
    rowUserOwnershipEnforced: boolean,
    rowUserOwnershipColumn: string,
    objectType: string,
    crudOperations: string[],
    crudOperationFormat: string,
    autoDetectMediaType: boolean,
    mediaType: string,
    options: string,
    authStoredProcedure: string,
    parameters: IMrsDbObjectFieldData[],

    payload: IDictionary;
}

export class MrsTurnstile extends ComponentBase {
    // Holds the currently running dialog type (only one of each type can run at the same time) and last
    // active HTML element, when this dialog was launched.
    #runningDialogs = new Map<DialogType, Element | null>();
    #dialogRefs = new Map<DialogType, RefObject<ValueDialogBase>>();

    public render(): ComponentChild {
        const dialogs: ComponentChild[] = [];

        const refMrs3 = createRef<MrsDbObjectDialog>();
        this.#dialogRefs.set(DialogType.MrsDbObject, refMrs3);
        dialogs.push(<MrsDbObjectDialog
            key="mrsDbObjectDialog"
            ref={refMrs3}
            onClose={this.handleDialogClose.bind(this, DialogType.MrsDbObject)}
        />);

        return (
            <>
                {dialogs}
            </>
        );
    }

    /**
     * Shows a dialog to create a new or edit an existing MRS service.
     *
     * @param backend The interface for sending the requests.
     * @param request Details about the object to edit.
     */
    public showMrsDbObjectDialog = async (backend: ShellInterfaceSqlEditor,
        request: IMrsDbObjectEditRequest): Promise<boolean> => {

        if (request.createObject && request.schemaName === undefined) {
            void requisitions.execute("showError", ["When creating a new DB Object the schema name must be valid."]);

            return false;
        }

        const dbObject = request.dbObject;

        const services = await backend.mrs.listServices();
        const schemas = await backend.mrs.listSchemas(dbObject.serviceId === "" ? undefined : dbObject.serviceId);
        const rowOwnershipFields = await backend.mrs.getDbObjectRowOwnershipFields(dbObject.requestPath,
            dbObject.name,
            dbObject.id === "" ? undefined : dbObject.id,
            dbObject.dbSchemaId === "" ? undefined : dbObject.dbSchemaId,
            request.schemaName, dbObject.objectType);

        const parameterNewItem: IMrsDbObjectFieldData = {
            id: "",
            dbObjectId: dbObject.id,
            position: 0,
            name: "<new>",
            bindFieldName: "",
            datatype: "STRING",
            mode: "IN",
            comments: "",
        };

        if (dbObject.id && (!dbObject.fields)) {
            dbObject.fields = await backend.mrs.getDbObjectSelectedFields(dbObject.requestPath, dbObject.name,
                dbObject.id, dbObject.dbSchemaId, request.schemaName);

            // Add entry for <new> item.
            dbObject.fields.push(parameterNewItem);
        }

        const dialogRequest = {
            id: "mrsDbObjectDialog",
            type: DialogType.MrsDbObject,
            title: undefined,
            parameters: { services, schemas, rowOwnershipFields },
            values: {
                id: dbObject.id,
                serviceId: dbObject.serviceId,
                dbSchemaId: dbObject.dbSchemaId,
                name: dbObject.name,
                requestPath: dbObject.requestPath,
                requiresAuth: dbObject.requiresAuth === 1,
                enabled: dbObject.enabled === 1,
                itemsPerPage: dbObject.itemsPerPage,
                comments: dbObject.comments ?? "",
                rowUserOwnershipEnforced: dbObject.rowUserOwnershipEnforced === 1,
                rowUserOwnershipColumn: dbObject.rowUserOwnershipColumn,
                objectType: dbObject.objectType,
                crudOperations: dbObject.crudOperations,
                crudOperationFormat: dbObject.crudOperationFormat,
                autoDetectMediaType: dbObject.autoDetectMediaType === 1,
                mediaType: dbObject.mediaType,
                options: dbObject?.options ? JSON.stringify(dbObject?.options) : "",
                authStoredProcedure: dbObject.authStoredProcedure,
                parameters: dbObject.fields ?? [parameterNewItem],

                payload: {
                    backend,
                    dbObject,
                    createObject: request.createObject,
                },
            },
        };

        this.showDialog(dialogRequest);

        return true;
    };

    private showDialog = (request: IDialogRequest): void => {
        // Check if a dialog of the given type is already active.
        // Only one of each type can be active at any time.
        if (!this.#runningDialogs.has(request.type)) {
            const ref = this.#dialogRefs.get(request.type);
            if (ref && ref.current) {
                this.#runningDialogs.set(request.type, document.activeElement);
                ref.current.show(request, request.title);
            }
        }
    };

    private handleDialogClose = (type: DialogType, closure: DialogResponseClosure, data?: IDictionary): void => {
        const element = this.#runningDialogs.get(type);
        this.#runningDialogs.delete(type);

        if (data && closure === DialogResponseClosure.Accept) {
            switch (type) {
                case DialogType.MrsDbObject: {
                    void this.handleMrsServiceResult(data as IMrsEditObjectData);
                    break;
                }

                default:
            }
        }

        if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
            element.focus();
        }
    };

    private handleMrsServiceResult = async (data: IMrsEditObjectData): Promise<void> => {
        const servicePath = data.servicePath as string;
        const schemaId = data.dbSchemaId;
        const schemaPath = data.dbSchemaPath;
        const name = data.name;
        const requestPath = data.requestPath;
        const requiresAuth = data.requiresAuth;
        const itemsPerPage = data.itemsPerPage;
        const comments = data.comments;
        const enabled = data.enabled;
        const rowUserOwnershipEnforced = data.rowUserOwnershipEnforced;
        const rowUserOwnershipColumn = data.rowUserOwnershipColumn;
        const objectType = data.objectType;
        const crudOperations = objectType === "PROCEDURE" ? ["UPDATE"] : (data.crudOperations ?? ["READ"]);
        const crudOperationFormat = data.crudOperationFormat ?? "FEED";
        const mediaType = data.mediaType;
        const autoDetectMediaType = data.autoDetectMediaType;
        const authStoredProcedure = data.authStoredProcedure;
        const options = data.options === "" ? null : JSON.parse(data.options) as IShellDictionary;
        const mrsObject = data.mrsObject;
        const payload = data.payload;

        const createObject = payload.createObject ?? false;
        const services = payload.services as IMrsServiceData[];
        const backend = payload.backend as ShellInterfaceSqlEditor;
        const dbObject = payload.dbObject as IMrsDbObjectData;

        // Remove entry for <new> item
        const fields = data.parameters.filter(
            (p: IMrsDbObjectFieldData) => {
                return p.id !== "";
            });

        const newService = services.find((service) => {
            return service.urlContextRoot === servicePath;
        });

        const serviceSchemas = await backend.mrs.listSchemas(newService?.id);
        const newSchema = serviceSchemas.find((schema) => {
            return schema.requestPath === schemaPath;
        });

        let newObjectId = "";

        if (createObject) {
            // Create new DB Object
            try {
                newObjectId = await backend.mrs.addDbObject(name, objectType,
                    false, requestPath, enabled, crudOperations,
                    crudOperationFormat, requiresAuth,
                    rowUserOwnershipEnforced, autoDetectMediaType,
                    options, itemsPerPage,
                    rowUserOwnershipColumn,
                    newSchema?.id, undefined, comments,
                    mediaType, "",
                    fields);

                requisitions.executeRemote("refreshConnections", undefined);
            } catch (error) {
                void requisitions.execute("showError", [
                    `The MRS Database Object ${name} could not be created.`,
                    `${String(error)}`,
                ]);

                return;
            }
        } else {
            // Update existing DB Object
            try {
                await backend.mrs.updateDbObject(
                    dbObject.id, dbObject.name,
                    dbObject.requestPath,
                    schemaId,
                    {
                        name,
                        dbSchemaId: newSchema?.id,
                        requestPath,
                        requiresAuth,
                        autoDetectMediaType,
                        enabled,
                        rowUserOwnershipEnforced,
                        rowUserOwnershipColumn,
                        itemsPerPage,
                        comments,
                        mediaType,
                        authStoredProcedure,
                        crudOperations,
                        crudOperationFormat,
                        options,
                        fields,
                    });

                requisitions.executeRemote("refreshConnections", undefined);
            } catch (error) {
                void requisitions.execute("showError", [
                    `The MRS Database Object ${name} could not be updated.`,
                    `${String(error)}`,
                ]);

                return;
            }
        }

        if (mrsObject) {
            // Create or replace mrsObject and its fields and references
            try {
                const obj = mrsObject as IMrsObject;
                if (newObjectId !== "") {
                    obj.dbObjectId = newObjectId;
                }
                await backend.mrs.setObjectFieldsWithReferences(obj);
            } catch (error) {
                void requisitions.execute("showError", [
                    `The MRS Object ${(mrsObject as IMrsObject).name} could not be stored.`,
                    `${String(error)}`,
                ]);

                return;
            }
        }

        void requisitions.execute("showInfo", [
            `The MRS Database Object ${name} was ${createObject ? "created" : "updated"} successfully.`]);

        void requisitions.execute("refreshMrsServiceSdk", {});
    };
}
