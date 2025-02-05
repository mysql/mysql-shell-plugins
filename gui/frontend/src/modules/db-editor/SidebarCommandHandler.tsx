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

import type { RefObject } from "preact";

import { DialogHost } from "../../app-logic/DialogHost.js";
import { ui } from "../../app-logic/UILayer.js";
import { DialogResponseClosure, DialogType, type IDialogRequest } from "../../app-logic/general-types.js";
import type { IMrsDbObjectData } from "../../communication/ProtocolMrs.js";
import {
    CdmEntityType, cdmDbEntityTypes, type ConnectionDataModel, type ConnectionDataModelEntry, type ICdmConnectionEntry,
    type ICdmRestAuthAppEntry, type ICdmRestDbObjectEntry, type ICdmRestSchemaEntry, type ICdmRestServiceAuthAppEntry,
    type ICdmRestServiceEntry, type ICdmRestUserEntry, type ICdmRoutineEntry, type ICdmSchemaEntry,
    type ICdmTableEntry, type ICdmViewEntry,
} from "../../data-models/ConnectionDataModel.js";
import type {
    IOciDmBastion, IOciDmCompartment, IOciDmDbSystem, IOciDmProfile, OciDataModelEntry,
} from "../../data-models/OciDataModel.js";
import { type OpenDocumentDataModelEntry } from "../../data-models/OpenDocumentDataModel.js";
import type { Command } from "../../data-models/data-model-types.js";
import type { IEditorExtendedExecutionOptions } from "../../supplement/RequisitionTypes.js";
import { requisitions } from "../../supplement/Requisitions.js";
import { Settings } from "../../supplement/Settings/Settings.js";
import type { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import type { IShellSessionDetails } from "../../supplement/ShellInterface/index.js";
import { convertErrorToString, sleep, uuid } from "../../utilities/helpers.js";
import { convertSnakeToCamelCase, quote } from "../../utilities/string-helpers.js";
import { DBEditorModuleId, ShellModuleId } from "../ModuleInfo.js";
import type { MrsHub } from "../mrs/MrsHub.js";
import { getRouterPortForConnection } from "../mrs/mrs-helpers.js";
import { MrsDbObjectType } from "../mrs/types.js";
import type { ISideBarCommandResult, QualifiedName } from "./index.js";

/** Centralized handling of commands send from the DB editor sidebar to the DB editor module. */
export class SidebarCommandHandler {
    static #dmTypeToMrsType = new Map<CdmEntityType, MrsDbObjectType>([
        [CdmEntityType.Table, MrsDbObjectType.Table],
        [CdmEntityType.View, MrsDbObjectType.View],
        [CdmEntityType.StoredFunction, MrsDbObjectType.Function],
        [CdmEntityType.StoredProcedure, MrsDbObjectType.Procedure],
    ]);

    public constructor(private connectionDataModel: ConnectionDataModel, private mrsHubRef: RefObject<MrsHub>) { }

    /**
     * Handles a single connection tree command for the DB editor module. Only commands that are not handled by the
     * DB editor module itself are processed here.
     *
     * @param command The command to execute.
     * @param entry The data model entry for which to execute the command.
     * @param qualifiedName Optionally, the qualified name of the entry. Used for DB object related actions.
     *
     * @returns A promise which resolves to true, except when the user cancels the operation.
     */
    public async handleConnectionTreeCommand(command: Command, entry?: ConnectionDataModelEntry,
        qualifiedName?: QualifiedName): Promise<ISideBarCommandResult> {

        let success = false;
        const connection = entry?.connection;
        if (connection) {
            // Commands/actions that are related to a specific connection.
            switch (command.command) {
                case "msg.editConnection": {
                    success = await requisitions.execute("job", [
                        { requestType: "showPage", parameter: { module: DBEditorModuleId, page: "connections" } },
                        { requestType: "editConnection", parameter: connection.details.id },
                    ]);

                    break;
                }

                case "msg.duplicateConnection": {
                    success = await requisitions.execute("job", [
                        { requestType: "showPage", parameter: { module: DBEditorModuleId, page: "connections" } },
                        { requestType: "duplicateConnection", parameter: connection.details.id },
                    ]);

                    break;
                }

                case "msg.removeConnection": {
                    success = await requisitions.execute("job", [
                        { requestType: "showPage", parameter: { module: DBEditorModuleId, page: "connections" } },
                        { requestType: "removeConnection", parameter: connection.details.id },
                    ]);

                    break;
                }

                case "msg.loadDumpFromDisk": {
                    // TODO: Implement this for embedded scenarios.

                    // It's not possible in a browser to get a full folder path for this functionality.

                    break;
                }

                case "msg.newSessionUsingConnection": {
                    let caption: string;
                    if (entry.type === CdmEntityType.Connection) {
                        caption = entry.details.caption;
                        const dbConnectionId = entry.details.id;

                        const details: IShellSessionDetails = {
                            sessionId: uuid(),
                            caption: `Session to ${caption}`,
                            dbConnectionId,
                        };

                        success = await requisitions.execute("job", [
                            { requestType: "showModule", parameter: ShellModuleId },
                            { requestType: "newSession", parameter: details },
                        ]);
                    }

                    break;
                }

                case "msg.mrs.loadSchemaFromJSONFile": {
                    // TODO: works with the file system, not possible in a browser.

                    break;
                }

                case "msg.mrs.exportServiceSdk": {
                    // TODO: works with the file system, not possible in a browser.

                    break;
                }

                case "msg.mrs.exportCreateServiceSql": {
                    // TODO: works with the file system, not possible in a browser.
                    break;
                }

                case "msg.mrs.copyCreateServiceSql": {
                    const object = entry as ICdmRestDbObjectEntry;
                    try {
                        const result = await entry.connection.backend.mrs.getServiceCreateStatement(object.details.id,
                            true,
                        );
                        requisitions.writeToClipboard(result);
                        void ui.showInformationMessage("The CREATE statement was copied to the system clipboard", {});
                        success = true;
                    } catch (error) {
                        const message = convertErrorToString(error);
                        void ui.showErrorMessage(`Error getting the SQL for this REST Service: ${message}`, {});
                    }

                    break;
                }

                case "msg.mrs.configureMySQLRestService": {
                    if (entry.type === CdmEntityType.Connection) {
                        let configure = entry.mrsEntry !== undefined;

                        if (!entry.mrsEntry) {
                            const response = await DialogHost.showDialog({
                                id: "msg.mrs.configureMySQLRestService",
                                type: DialogType.Confirm,
                                parameters: {
                                    title: "Confirmation",
                                    prompt: `Do you want to configure this instance for MySQL REST Service Support? ` +
                                        `This operation will create the MRS metadata database schema.`,
                                    accept: "Configure",
                                    refuse: "No",
                                    default: "No",
                                },
                            });

                            configure = response.closure === DialogResponseClosure.Accept;
                        }

                        if (configure) {
                            success = await this.configureMrs(connection, true);
                        }
                    }

                    break;
                }

                case "msg.mrs.enableMySQLRestService":
                case "msg.mrs.disableMySQLRestService": {
                    const enableMrs = command.command === "msg.mrs.enableMySQLRestService";
                    success = await this.configureMrs(connection, enableMrs);

                    break;
                }

                case "msg.mrs.addService": {
                    const configured = await this.checkMrsStatus(connection.backend, false);
                    if (configured) {
                        success = await this.mrsHubRef.current?.showMrsServiceDialog(connection.backend) ?? false;
                    }

                    break;
                }

                case "msg.mrs.editService": {
                    const service = entry as ICdmRestServiceEntry;
                    success = await this.mrsHubRef.current
                        ?.showMrsServiceDialog(connection.backend, service.details) ?? false;

                    break;
                }

                case "msg.mrs.setCurrentService": {
                    const service = entry as ICdmRestServiceEntry;
                    try {
                        await connection.backend?.mrs.setCurrentService(service.details.id);
                        void ui.showInformationMessage("The MRS service has been set as the new default service.", {});
                        success = true;
                    } catch (reason) {
                        const message = convertErrorToString(reason);
                        void ui.showErrorMessage(`Error setting the default MRS service: ${message}`, {});
                    }

                    break;
                }

                case "msg.mrs.linkAuthApp": {
                    try {
                        const service = entry as ICdmRestServiceEntry;
                        const apps = await connection.backend.mrs.listAuthApps();

                        const items = apps.map((app) => {
                            return app.name;
                        });

                        const response = await DialogHost.showDialog({
                            id: "msg.mrs.linkToService",
                            type: DialogType.Select,
                            title: "Select REST Authentication App",
                            parameters: {
                                prompt: "Select a REST Authentication app to link it to this service.",
                                default: "Accept",
                                options: items,
                            },
                        });

                        if (response.closure === DialogResponseClosure.Accept) {
                            const name = response.values?.input as string;
                            if (name) {
                                const authApp = apps.find((candidate) => {
                                    return candidate.name === name;
                                });

                                if (authApp !== undefined) {
                                    try {
                                        await connection.backend.mrs.linkAuthAppToService(authApp.id!, service.id);
                                        void ui.showInformationMessage("The MRS Authentication App has " +
                                            `been linked to service ${service.details.name}`, {});
                                        success = true;
                                    } catch (reason) {
                                        const message = convertErrorToString(reason);
                                        void ui.showErrorMessage("Error linking an MRS Authentication App: " +
                                            `${message}`, {});
                                    }
                                }
                            }
                        }
                    } catch (reason) {
                        const message = convertErrorToString(reason);
                        void ui.showErrorMessage(`Error adding a new MRS Authentication App: ${message}`, {});
                    }

                    break;
                }

                case "msg.mrs.addAuthApp": {
                    try {
                        let serviceDetails;
                        if (entry.type === CdmEntityType.MrsService) {
                            serviceDetails = entry.details;
                        }

                        success = await this.mrsHubRef.current?.showMrsAuthAppDialog(connection.backend, undefined,
                            serviceDetails) ?? false;
                    } catch (reason) {
                        const message = convertErrorToString(reason);
                        void ui.showErrorMessage(`Error adding a new MRS Authentication App: ${message}`, {});
                    }

                    break;
                }

                case "msg.mrs.editAuthApp": {
                    try {
                        const app = entry as ICdmRestAuthAppEntry;

                        success = await this.mrsHubRef.current?.showMrsAuthAppDialog(
                            connection.backend, app.details) ?? false;
                    } catch (reason) {
                        const message = convertErrorToString(reason);
                        void ui.showErrorMessage(`Error adding a new MRS Authentication App: ${message}`, {});
                    }

                    break;
                }

                case "msg.mrs.deleteAuthApp": {
                    const app = entry as ICdmRestAuthAppEntry;
                    if (app.details.id) {
                        const prompt = `Are you sure the MRS authentication app "${app.details.name}" should ` +
                            "be deleted?";
                        const response = await DialogHost.showDialog({
                            id: "msg.mrs.deleteAuthApp",
                            type: DialogType.Confirm,
                            parameters: {
                                title: "Confirmation",
                                prompt,
                                accept: "Delete",
                                refuse: "No",
                                default: "No",
                            },
                        });

                        if (response.closure === DialogResponseClosure.Accept) {
                            try {
                                await connection.backend?.mrs.deleteAuthApp(app.details.id);

                                success = true;
                                void ui.showInformationMessage(`The MRS Authentication App ` +
                                    `"${app.details.name}" has been deleted.`, {});
                            } catch (error) {
                                const message = convertErrorToString(error);
                                void ui.showErrorMessage(`Error removing an Auth App: ${message}`, {});
                            }
                        }
                    }

                    break;
                }

                case "msg.mrs.linkToService": {
                    const authApp = entry as ICdmRestAuthAppEntry;
                    const services = await connection.backend.mrs.listServices();
                    const items = services.map((s) => {
                        return s.urlContextRoot;
                    });

                    const response = await DialogHost.showDialog({
                        id: "msg.mrs.linkToService",
                        type: DialogType.Select,
                        title: "Select REST Service",
                        parameters: {
                            prompt: "Select a REST service to link this authentication app to.",
                            default: "Accept",
                            options: items,
                        },
                    });

                    if (response.closure === DialogResponseClosure.Accept) {
                        const name = response.values?.input as string;
                        if (name) {
                            const service = services.find((candidate) => {
                                return candidate.urlContextRoot === name;
                            });

                            if (service) {
                                try {
                                    await connection.backend.mrs.linkAuthAppToService(authApp.details.id!,
                                        service.id);
                                    void ui.showInformationMessage("The MRS Authentication App has been linked " +
                                        `to service ${service.name}`, {});
                                    success = true;
                                } catch (reason) {
                                    const message = convertErrorToString(reason);
                                    void ui.showErrorMessage("Error linking an MRS Authentication App: " +
                                        `${message}`, {});
                                }
                            }
                        }
                    }

                    break;
                }

                case "msg.mrs.unlinkAuthApp": {
                    const app = entry as ICdmRestServiceAuthAppEntry;
                    if (app.details.id) {
                        const prompt = `Are you sure the MRS authentication app "${app.details.name}" should ` +
                            `be unlinked from the service "${app.parent.caption}"?`;
                        const response = await DialogHost.showDialog({
                            id: "msg.mrs.unlinkAuthApp",
                            type: DialogType.Confirm,
                            parameters: {
                                title: "Confirmation",
                                prompt,
                                accept: "Unlink",
                                refuse: "No",
                                default: "No",
                            },
                        });

                        if (response.closure === DialogResponseClosure.Accept) {
                            try {
                                await connection.backend?.mrs.unlinkAuthAppFromService(app.details.id,
                                    app.parent.details.id);

                                success = true;
                                void ui.showInformationMessage(`The MRS Authentication App ` +
                                    `"${app.details.name}" has been unlinked.`, {});
                            } catch (error) {
                                void ui.showErrorMessage(`Error removing an Auth App: ${String(error)}`, {});
                            }
                        }
                    }

                    break;
                }

                case "msg.mrs.deleteService": {
                    const service = entry as ICdmRestServiceEntry;
                    const response = await DialogHost.showDialog({
                        id: "msg.mrs.deleteService",
                        type: DialogType.Confirm,
                        parameters: {
                            title: "Confirmation",
                            prompt: `Are you sure the MRS service ${service.details.urlContextRoot} should be deleted?`,
                            accept: "Delete",
                            refuse: "No",
                            default: "No",
                        },
                    });

                    if (response.closure === DialogResponseClosure.Accept) {
                        try {
                            await connection.backend?.mrs.deleteService(service.details.id);
                            success = true;
                            void ui.showInformationMessage("The MRS service has been deleted successfully.", {});
                        } catch (error) {
                            const message = convertErrorToString(error);
                            void ui.showErrorMessage(`Error removing an MRS service: ${message}`, {});
                        }
                    }

                    break;
                }

                case "msg.mrs.editSchema": {
                    const service = entry as ICdmRestSchemaEntry;
                    const path = await this.mrsHubRef.current?.showMrsSchemaDialog(connection.backend,
                        qualifiedName?.schema, service.details);
                    if (path) {
                        success = true;
                    }

                    break;
                }

                case "msg.mrs.deleteSchema": {
                    const response = await DialogHost.showDialog({
                        id: "msg.mrs.deleteSchema",
                        type: DialogType.Confirm,
                        parameters: {
                            title: "Confirmation",
                            prompt: `Are you sure the MRS schema ${entry.caption} should be deleted?`,
                            accept: "Delete",
                            refuse: "Cancel",
                            default: "Cancel",
                        },
                    });

                    if (response.closure === DialogResponseClosure.Accept) {
                        try {
                            const schema = entry as ICdmRestSchemaEntry;
                            await connection.backend.mrs.deleteSchema(schema.details.id, schema.details.serviceId);
                            success = true;
                            void ui.showInformationMessage("The MRS schema has been deleted successfully.", {});
                        } catch (error) {
                            const message = convertErrorToString(error);
                            void ui.showErrorMessage(`Error removing an MRS schema: ${message}`, {});
                        }
                    }

                    break;
                }

                case "msg.mrs.addDbObject": {
                    switch (entry.type) {
                        case CdmEntityType.Table:
                        case CdmEntityType.View:
                        case CdmEntityType.StoredFunction:
                        case CdmEntityType.StoredProcedure: {
                            try {
                                const configured = await this.checkMrsStatus(connection.backend, true);
                                if (!configured) {
                                    return { success: false };
                                }

                                // First, create a new temporary dbObject, then call the DbObject dialog.
                                const dbObject = await this.createNewDbObject(entry);
                                await this.mrsHubRef.current?.showMrsDbObjectDialog(connection.backend,
                                    { dbObject, createObject: true });

                                return {
                                    success: true,
                                    mrsServiceId: dbObject.serviceId,
                                    mrsSchemaId: dbObject.dbSchemaId,
                                };

                            } catch (error) {
                                const message = convertErrorToString(error);
                                void ui.showErrorMessage(`Error while adding the object: ${message}`, {});

                                return { success: false };
                            }

                        }

                        default: {
                            void ui.showErrorMessage(
                                `The database object type '${entry.caption}' is not supported at this time`, {});
                        }
                    }

                    break;
                }

                case "msg.mrs.editDbObject": {
                    const dbObject = entry as ICdmRestDbObjectEntry;
                    await this.mrsHubRef.current?.showMrsDbObjectDialog(connection.backend,
                        { dbObject: dbObject.details, createObject: false });

                    return {
                        success: true,
                        mrsServiceId: dbObject.details.serviceId,
                        mrsSchemaId: dbObject.details.dbSchemaId,
                    };
                }

                case "msg.mrs.copyDbObjectRequestPath": {
                    const path = this.buildDbObjectRequestPath(entry as ICdmRestDbObjectEntry);
                    if (path) {
                        requisitions.writeToClipboard(path.toString());
                        success = true;
                        void ui.showInformationMessage("The DB Object Path was copied to the system clipboard", {});
                    }

                    break;
                }

                case "msg.mrs.copyCreateSchemaSql": {
                    try {
                        const schema = entry as ICdmRestSchemaEntry;
                        const result = await entry.connection.backend.mrs.getSchemaCreateStatement(schema.details.id,
                            true);
                        requisitions.writeToClipboard(result);
                        success = true;
                        void ui.showInformationMessage("The CREATE statement was copied to the system clipboard", {});
                    } catch (reason) {
                        void ui.showErrorMessage(`Error getting the SQL for this REST Schema`, {});
                    }

                    break;
                }

                case "msg.mrs.copyCreateDbObjectSql": {
                    try {
                        const object = entry as ICdmRestDbObjectEntry;
                        const result = await entry.connection.backend.mrs.getDbObjectCreateStatement(object.details.id);
                        requisitions.writeToClipboard(result);
                        success = true;
                        void ui.showInformationMessage("The CREATE statement was copied to the system clipboard", {});
                    } catch (reason) {
                        void ui.showErrorMessage(`Error getting the SQL for this REST DB Object`, {});
                    }

                    break;
                }

                case "msg.mrs.deleteDbObject": {
                    const response = await DialogHost.showDialog({
                        id: "msg.mrs.deleteDbObject",
                        type: DialogType.Confirm,
                        parameters: {
                            title: "Confirmation",
                            prompt: `Are you sure you want to delete the REST DB Object ${entry.caption}?`,
                            accept: "Delete",
                            refuse: "Cancel",
                            default: "Cancel",
                        },
                    });

                    if (response.closure === DialogResponseClosure.Accept) {
                        try {
                            const dbObject = entry as ICdmRestDbObjectEntry;
                            await connection.backend.mrs.deleteDbObject(dbObject.details.id);
                            success = true;
                            void ui.showInformationMessage("The MRS DB object has been deleted successfully.", {});
                        } catch (error) {
                            const message = convertErrorToString(error);
                            void ui.showErrorMessage(`Error removing an MRS schema: ${message}`, {});
                        }
                    }

                    break;
                }

                case "msg.mrs.addUser": {
                    if (this.mrsHubRef.current) {
                        const authApp = entry as ICdmRestAuthAppEntry;
                        success = await this.mrsHubRef.current.showMrsUserDialog(authApp.connection.backend,
                            authApp.details);
                    }

                    break;
                }

                case "msg.mrs.editUser": {
                    if (this.mrsHubRef.current) {
                        const user = entry as ICdmRestUserEntry;
                        const authApp = user.parent;
                        success = await this.mrsHubRef.current.showMrsUserDialog(authApp.connection.backend,
                            authApp.details, user.details);
                    }

                    break;
                }

                case "msg.mrs.deleteUser": {
                    const response = await DialogHost.showDialog({
                        id: "msg.mrs.deleteUser",
                        type: DialogType.Confirm,
                        parameters: {
                            title: "Confirmation",
                            prompt: `Are you sure you want to delete the MRS user "${entry.caption}"?`,
                            accept: "Delete",
                            refuse: "Cancel",
                            default: "Cancel",
                        },
                    });

                    if (response.closure === DialogResponseClosure.Accept) {
                        try {
                            const user = entry as ICdmRestUserEntry;
                            await connection.backend.mrs.deleteUser(user.details.id!);
                            success = true;
                            void ui.showInformationMessage(`The MRS user ${user.caption} has been deleted ` +
                                `successfully.`, {});
                        } catch (error) {
                            const message = convertErrorToString(error);
                            void ui.showErrorMessage(`Error removing an MRS user: ${message}`, {});
                        }
                    }

                    break;
                }

                case "msg.selectRows": {
                    if (qualifiedName?.schema && qualifiedName.name) {
                        let query;

                        const uppercaseKeywords = Settings.get("dbEditor.upperCaseKeywords", true);
                        const select = uppercaseKeywords ? "SELECT" : "select";
                        const from = uppercaseKeywords ? "FROM" : "from";

                        if (entry.type === CdmEntityType.Column) {
                            const qualifiedTableName = `${quote(qualifiedName.schema)}.${quote(qualifiedName.table!)}`;
                            query = `${select} ${qualifiedTableName}.${quote(qualifiedName.name)} ${from} ` +
                                `${qualifiedTableName}`;
                        } else {
                            const qualifiedTableName = `${quote(qualifiedName.schema)}.${quote(qualifiedName.name)}`;
                            query = `${select} * ${from} ${qualifiedTableName}`;
                        }

                        const options: IEditorExtendedExecutionOptions = {
                            code: query,
                            language: "mysql",
                        };

                        const pageId = String(connection.details.id);
                        success = await requisitions.execute("job", [
                            {
                                requestType: "showPage",
                                parameter: { module: DBEditorModuleId, page: pageId },
                            },
                            { requestType: "editorRunCode", parameter: options },
                        ]);
                    }

                    break;
                }

                case "filterMenuItem": {
                    break;
                }

                case "inspectorMenuItem": {
                    break;
                }

                case "msg.copyNameToEditor":
                case "msg.copyNameToClipboard": {
                    if (command.command === "msg.copyNameToClipboard") {
                        requisitions.writeToClipboard(entry.caption);

                        void ui.showInformationMessage("The name was copied to the system clipboard", {});
                        success = true;
                    } else {
                        const pageId = String(connection.details.id);
                        success = await requisitions.execute("job", [
                            {
                                requestType: "showPage",
                                parameter: { module: DBEditorModuleId, page: pageId },
                            },
                            { requestType: "editorInsertText", parameter: entry.caption },
                        ]);
                    }

                    break;
                }

                case "msg.copyCreateStatementToClipboard":
                case "msg.copyCreateStatementToEditor": {
                    let type;
                    let qualifier = qualifiedName ? `\`${qualifiedName.schema}\`.` : "";
                    let index = 1; // The column index in the result row.
                    switch (entry.type) {
                        case CdmEntityType.Schema: {
                            type = "schema";
                            qualifier = "";
                            break;
                        }

                        case CdmEntityType.Table: {
                            type = "table";
                            break;
                        }

                        case CdmEntityType.View: {
                            type = "view";
                            break;
                        }

                        case CdmEntityType.StoredFunction: {
                            index = 2;
                            type = "function";
                            break;
                        }

                        case CdmEntityType.StoredProcedure: {
                            index = 2;
                            type = "procedure";
                            break;
                        }

                        case CdmEntityType.Trigger: {
                            type = "trigger";
                            break;
                        }

                        case CdmEntityType.Event: {
                            index = 3;
                            type = "event";
                            break;
                        }

                        default:
                    }

                    if (type) {
                        const data = await connection?.backend.execute(
                            `show create ${type} ${qualifier}\`${entry.caption}\``);
                        const rows = data?.rows;
                        if (rows && rows.length > 0) {
                            // Returns one row with 2 columns.
                            const row = rows[0] as string[];
                            if (row.length > index) {
                                if (command.command === "msg.copyCreateStatementToClipboard") {
                                    requisitions.writeToClipboard(row[index]);

                                    void ui.showInformationMessage("The CREATE statement was copied to the " +
                                        "system clipboard", {});
                                    success = true;
                                } else {
                                    const pageId = String(connection.details.id);
                                    success = await requisitions.execute("job", [
                                        {
                                            requestType: "showPage",
                                            parameter: { module: DBEditorModuleId, page: pageId },
                                        },
                                        { requestType: "editorInsertText", parameter: row[index] },
                                    ]);
                                }
                            }
                        }
                    }

                    break;
                }

                case "msg.createSchema": {
                    break;
                }

                case "msg.alterSchema": {
                    break;
                }

                case "msg.mrs.addSchema": {
                    if (this.mrsHubRef.current) {
                        const configured = await this.checkMrsStatus(connection.backend, true);
                        if (!configured) {
                            return { success: false };
                        }

                        try {
                            const serviceId = await this.mrsHubRef.current.showMrsSchemaDialog(connection.backend,
                                entry.caption);

                            return {
                                success: true,
                                mrsServiceId: serviceId,
                            };
                        } catch (error) {
                            const message = convertErrorToString(error);
                            void ui.showErrorMessage(`Error while adding the schema: ${message}.`, {});

                            return { success: false };
                        }
                    }

                    break;
                }

                case "refreshMenuItem": {
                    break;
                }

                default:
            }
        }

        // Other Commands/actions that are not related to a specific connection.
        switch (command.command) {
            case "msg.addConnection": {
                success = await requisitions.execute("job", [
                    { requestType: "showPage", parameter: { module: DBEditorModuleId, page: "connections" } },
                    { requestType: "addNewConnection", parameter: {} },
                ]);
                break;
            }

            case "msg.refreshConnections": {
                await this.connectionDataModel.reloadConnections();
                success = true;

                break;
            }

            case "msg.mrs.docs": {
                window.open("https://dev.mysql.com/doc/dev/mysql-rest-service/latest/", "_blank");
                success = true;

                break;
            }

            case "msg.mrs.docs.service": {
                window.open("https://dev.mysql.com/doc/dev/mysql-rest-service/latest/#rest-service-properties",
                    "_blank");
                success = true;

                break;
            }

            case "msg.fileBugReport": {
                // The version is injected by the vite config.
                const currentVersion = process.env.versionNumber ?? "1.0.0";

                void window.open("https://bugs.mysql.com/report.php?category=Shell%20VSCode%20Extension" +
                    `&version=${currentVersion}`);

                break;
            }

            case "msg.mrs.copyDbObjectRequestPath": {
                const path = this.buildDbObjectRequestPath(entry as ICdmRestDbObjectEntry);
                if (path) {
                    requisitions.writeToClipboard(path.toString());
                    success = true;
                    void ui.showInformationMessage("The DB Object Path was copied to the system clipboard", {});
                }

                break;
            }

            case "msg.mrs.openDbObjectRequestPath": {
                const path = this.buildDbObjectRequestPath(entry as ICdmRestDbObjectEntry);
                if (path) {
                    window.open(path);
                    success = true;
                }

                break;
            }

            case "msg.copyNameToClipboard": {
                requisitions.writeToClipboard(entry!.caption);
                success = true;

                break;
            }

            case "msg.dropSchema": {
                const schema = entry as ICdmSchemaEntry;
                await this.dropItem(schema);
                success = true;

                break;
            }

            default:
        }

        return { success };
    }

    /**
     * Handles a single OCI command for the DB editor module. Only commands that are not handled by the
     * DB editor module itself are processed here.
     *
     * @param command The command to execute.
     * @param entry The data model entry for which to execute the command.
     *
     * @returns A promise which resolves to true, except when the user cancels the operation.
     */
    public async handleOciCommand(command: Command, entry: OciDataModelEntry): Promise<ISideBarCommandResult> {
        const success = false;
        switch (command.command) {
            case "msg.mds.setDefaultProfile": {
                const profile = entry as IOciDmProfile;
                await profile.makeDefault();

                break;
            }

            case "msg.mds.setCurrentCompartment": {
                const compartment = entry as IOciDmCompartment;
                await compartment.makeCurrent();

                break;
            }

            case "msg.mds.createConnectionViaBastionService": {
                const dbSystem = entry as IOciDmDbSystem;
                const profileData = dbSystem.parent.profileData;
                await requisitions.execute("addNewConnection",
                    { mdsData: dbSystem.details, profileName: profileData.profile });

                break;
            }

            case "msg.mds.startDbSystem": { break; }
            case "msg.mds.restartDbSystem": { break; }
            case "msg.mds.stopDbSystem": { break; }
            case "msg.mds.deleteDbSystem": { break; }
            case "msg.mds.createRouterEndpoint": { break; }
            case "msg.mds.openBastionSshSession": { break; }

            case "msg.mds.deleteComputeInstance": { break; }

            case "msg.mds.startHWCluster": { break; }

            case "msg.mds.stopHWCluster": { break; }

            case "msg.mds.restartHWCluster": { break; }

            case "msg.mds.rescaleHWCluster": { break; }

            case "msg.mds.deleteHWCluster": { break; }

            case "msg.mds.setCurrentBastion": {
                const bastion = entry as IOciDmBastion;
                await bastion.makeCurrent();

                break;
            }

            case "msg.mds.deleteBastion": { break; }

            case "msg.mds.refreshOnBastionActiveState": { break; }

            default:
        }

        return { success };
    }

    public async handleDocumentCommand(command: Command,
        _entry: OpenDocumentDataModelEntry): Promise<ISideBarCommandResult> {
        const success = false;
        switch (command.command) {
            case "todo": { // Just a place holder to keep the async nature of this function.
                await sleep(1000);

                break;
            }

            default:
        }

        return { success };
    }

    private async configureMrs(entry: ICdmConnectionEntry, enableMrs?: boolean): Promise<boolean> {
        try {
            ui.setStatusBarMessage("$(loading~spin) Configuring the MySQL REST Service Metadata Schema ...");

            if (!entry.isOpen) {
                await entry.refresh?.();
            }

            await entry.backend.mrs.configure(enableMrs);

            void ui.showInformationMessage("MySQL REST Service configured successfully.", {});
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage("Error while configuring MRS: " + message, {});
        }

        return true;
    }

    private buildDbObjectRequestPath = (entry: ICdmRestDbObjectEntry): URL | undefined => {
        try {
            const o = entry.details;
            const port = getRouterPortForConnection(entry.connection.details.id);
            let url = (o.hostCtx ?? "") + (o.schemaRequestPath ?? "") + o.requestPath;

            if (url.startsWith("/")) {
                url = `https://localhost:${port}${url}`;
            } else {
                url = `https://${url}`;
            }

            return new URL(url);
        } catch (error) {
            let message = `An error occurred when trying to build the DB Object Path. `;
            message += convertErrorToString(error);
            void ui.showErrorMessage(message, {});
        }
    };

    /**
     * If the given item is one of the database objects, it will be dropped (after confirmation by the user).
     *
     * @param entry The item to drop. Only has an effect if it is a database object.
     */
    private async dropItem(entry: ConnectionDataModelEntry): Promise<void> {
        if (!cdmDbEntityTypes.has(entry.type)) {
            return;
        }

        const response = await DialogHost.showDialog({
            id: "dropItem",
            type: DialogType.Confirm,
            parameters: {
                title: "Confirmation",
                prompt: `Do you want to drop the ${entry.type} ${entry.caption}?` +
                    "This operation cannot be reverted!",
                accept: `Drop ${entry.caption}`,
                refuse: "No",
                default: "No",
            },
        });

        if (response.closure === DialogResponseClosure.Accept) {
            try {
                await this.connectionDataModel.dropItem(entry);
                await this.connectionDataModel.removeEntry(entry);

                void ui.showInformationMessage(`The object ${entry.caption} has been dropped successfully.`, {});
            } catch (error) {
                const message = convertErrorToString(error);
                void ui.showErrorMessage(`Error dropping the object: ${message}`, {});
            }
        }
    }

    private async createNewDbObject(
        entry: ICdmTableEntry | ICdmViewEntry | ICdmRoutineEntry): Promise<IMrsDbObjectData> {

        const dbObject: IMrsDbObjectData = {
            comments: "",
            crudOperations: (entry.type === CdmEntityType.StoredProcedure) ? ["UPDATE"] : ["READ"],
            crudOperationFormat: "FEED",
            dbSchemaId: "",
            enabled: 1,
            id: "",
            name: entry.caption,
            objectType: SidebarCommandHandler.#dmTypeToMrsType.get(entry.type)!,
            requestPath: `/${convertSnakeToCamelCase(entry.caption)}`,
            requiresAuth: 1,
            rowUserOwnershipEnforced: 0,
            serviceId: "",
            autoDetectMediaType: 0,
        };

        const backend = entry.connection.backend;
        const services = await backend.mrs.listServices();
        let service;
        if (services.length === 1) {
            service = services[0];
        } else if (services.length > 1) {
            // Lookup default service
            service = services.find((service) => {
                return service.isCurrent;
            });

            if (!service) {
                // No default connection set. Show a picker.
                const items = services.map((s) => {
                    return s.urlContextRoot;
                });

                const request: IDialogRequest = {
                    type: DialogType.Select,
                    title: "Select a connection for SQL execution",
                    id: "selectConnectionForMrsDbObject",
                    parameters: {
                        prompt: "Select",
                        options: items,
                    },
                };

                const response = await DialogHost.showDialog(request);
                if (response.closure === DialogResponseClosure.Accept) {
                    const name = response.values?.name as string;
                    if (name) {
                        service = services.find((candidate) => {
                            return candidate.urlContextRoot === name;
                        });
                    }
                }
            }
        }

        if (service) {
            const schemas = await backend.mrs.listSchemas(service.id);
            const schema = schemas.find((schema) => {
                return schema.name === entry.schema;
            });

            // Check if the DbObject's schema is already exposed as an MRS schema
            dbObject.schemaName = entry.schema;
            if (schema) {
                dbObject.dbSchemaId = schema.id;
            } else {
                const response = await DialogHost.showDialog({
                    id: "confirmMrsSchemaCreation",
                    type: DialogType.Confirm,
                    parameters: {
                        title: "Confirmation",
                        prompt: `The database schema ${entry.schema} has not been added to the `
                            + "REST Service. Do you want to add the schema now?",
                        accept: "Yes",
                        refuse: "No",
                    },
                });

                if (response.closure === DialogResponseClosure.Accept) {
                    dbObject.dbSchemaId = await backend.mrs.addSchema(service.id,
                        entry.schema, 1, `/${convertSnakeToCamelCase(entry.schema)}`, false, null, null, undefined);
                    void ui.showInformationMessage(`The MRS schema ${entry.schema} has been added successfully.`, {});
                } else {
                    throw new Error("Operation cancelled.");
                }
            }
        } else {
            if (services.length === 0) {
                throw new Error("Please create a REST Service before adding DB Objects.");
            } else {
                throw new Error("No REST Service selected.");
            }
        }

        return dbObject;
    }

    /**
     * Checks the status of the MRS service and and the number of available services.
     *
     * @param backend The backend for a connection.
     * @param needService If true, the method will check if there is at least one service available.
     *
     * @returns A promise which resolves to true if all conditions are true.
     */
    private async checkMrsStatus(backend: ShellInterfaceSqlEditor, needService: boolean): Promise<boolean> {
        const status = await backend.mrs.status();
        if (!status.serviceConfigured) {
            void ui.showErrorMessage(`The REST Service support is not configured yet for this connection.`, {});

            return false;
        }

        if (needService && status.serviceCount === 0) {
            void ui.showErrorMessage(`Please create a REST Service first.`, {});

            return false;
        }

        return true;
    }
}
