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

import {
    IRequestListEntry, IRequestTypeMap, IWebviewProvider, requisitions,
} from "../../../frontend/src/supplement/Requisitions";

import { IDialogRequest, IDialogResponse } from "../../../frontend/src/app-logic/Types";
import { WebviewProvider } from "./WebviewProvider";
import { DBEditorModuleId } from "../../../frontend/src/modules/ModuleInfo";
import {
    IMrsAuthAppData, IMrsContentSetData, IMrsSchemaData, IMrsServiceData, IMrsUserData,
} from "../../../frontend/src/communication/ProtocolMrs";

/** Creates and handles web views for dialog requests. */
export class DialogWebviewManager {
    // Standard dialog requests awaiting a response.
    private pendingDialogRequests = new Map<IWebviewProvider, (value?: IDialogResponse) => void>();

    // Running special dialogs. Usually only one should be active at the same time.
    private runningDialogs = new Set<IWebviewProvider>();

    private url?: URL;

    public constructor() {
        requisitions.register("connectedToUrl", this.connectedToUrl);
        requisitions.register("proxyRequest", this.proxyRequest);
    }

    /**
     * Shows the MRS service dialog.
     *
     * @param caption A caption for the dialog.
     * @param connectionId The ID of the connection for which the MRS object is edited.
     * @param data Details of the service to edit.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public showMrsServiceDialog(caption: string, connectionId: string, data?: IMrsServiceData): Promise<boolean> {
        const provider = new WebviewProvider(this.url!, this.handleDispose);
        provider.caption = caption;
        this.runningDialogs.add(provider);

        return provider.runCommand("job", [
            { requestType: "showModule", parameter: DBEditorModuleId },
            { requestType: "showPage", parameter: { module: DBEditorModuleId, page: connectionId } },
            { requestType: "showMrsServiceDialog", parameter: data },
        ], "newConnection");
    }

    /**
     * Shows the MRS schema dialog.
     *
     * @param caption A caption for the dialog.
     * @param connectionId The ID of the connection for which the MRS object is edited.
     * @param schemaName The name of the schema to edit.
     * @param schema The schema data to edit.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public showMrsSchemaDialog(caption: string, connectionId: string, schemaName?: string,
        schema?: IMrsSchemaData): Promise<boolean> {
        const provider = new WebviewProvider(this.url!, this.handleDispose);
        provider.caption = caption;
        this.runningDialogs.add(provider);

        return provider.runCommand("job", [
            { requestType: "showModule", parameter: DBEditorModuleId },
            { requestType: "showPage", parameter: { module: DBEditorModuleId, page: connectionId } },
            { requestType: "showMrsSchemaDialog", parameter: { schemaName, schema } },
        ], "newConnection");
    }

    /**
     * Shows the MRS content set dialog.
     *
     * @param caption A caption for the dialog.
     * @param connectionId The ID of the connection for which the MRS object is edited.
     * @param directory The directory to edit.
     * @param contentSet The content set to edit.s
     *
     * @returns A promise which resolves after the command was executed.
     */
    public showMrsContentSetDialog(caption: string, connectionId: string, directory?: string,
        contentSet?: IMrsContentSetData): Promise<boolean> {
        const provider = new WebviewProvider(this.url!, this.handleDispose);
        provider.caption = caption;
        this.runningDialogs.add(provider);

        return provider.runCommand("job", [
            { requestType: "showModule", parameter: DBEditorModuleId },
            { requestType: "showPage", parameter: { module: DBEditorModuleId, page: connectionId } },
            { requestType: "showMrsContentSetDialog", parameter: { directory, contentSet } },
        ], "newConnection");
    }

    /**
     * Shows the MRS auth app dialog.
     *
     * @param caption A caption for the dialog.
     * @param connectionId The ID of the connection for which the MRS object is edited.
     * @param authApp The auth app to edit.
     * @param service The service to edit.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public showMrsAuthAppDialog(caption: string, connectionId: string, authApp?: IMrsAuthAppData,
        service?: IMrsServiceData): Promise<boolean> {
        const provider = new WebviewProvider(this.url!, this.handleDispose);
        provider.caption = caption;
        this.runningDialogs.add(provider);

        return provider.runCommand("job", [
            { requestType: "showModule", parameter: DBEditorModuleId },
            { requestType: "showPage", parameter: { module: DBEditorModuleId, page: connectionId } },
            { requestType: "showMrsAuthAppDialog", parameter: { authApp, service } },
        ], "newConnection");
    }

    /**
     * Shows the MRS user dialog.
     *
     * @param caption A caption for the dialog.
     * @param connectionId The ID of the connection for which the MRS object is edited.
     * @param authApp The auth app to edit.
     * @param user The user to edit.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public showMrsUserDialog(caption: string, connectionId: string, authApp: IMrsAuthAppData,
        user?: IMrsUserData): Promise<boolean> {
        const provider = new WebviewProvider(this.url!, this.handleDispose);
        provider.caption = caption;
        this.runningDialogs.add(provider);

        return provider.runCommand("job", [
            { requestType: "showModule", parameter: DBEditorModuleId },
            { requestType: "showPage", parameter: { module: DBEditorModuleId, page: connectionId } },
            { requestType: "showMrsUserDialog", parameter: { authApp, user } },
        ], "newConnection");
    }

    public showDialog(request: IDialogRequest, caption: string): Promise<IDialogResponse | void> {
        if (!this.url) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            const provider = new WebviewProvider(this.url!, this.handleDispose);
            provider.caption = caption;
            this.pendingDialogRequests.set(provider, resolve);

            // We don't wait here for the app instantiation, but will resolve the promise when the dialog
            // response comes in.
            void provider.runCommand("showDialog", request, caption);
        });
    }

    private handleDispose = (view: IWebviewProvider) => {
        const resolve = this.pendingDialogRequests.get(view);
        if (resolve) {
            resolve();
            this.pendingDialogRequests.delete(view);
        }

        this.runningDialogs.delete(view);
    };

    private connectedToUrl = (url?: URL): Promise<boolean> => {
        this.url = url;
        this.pendingDialogRequests.clear();

        return Promise.resolve(true);
    };

    private proxyRequest = (request: {
        provider: IWebviewProvider;
        original: IRequestListEntry<keyof IRequestTypeMap>;
    }): Promise<boolean> => {
        switch (request.original.requestType) {
            case "dialogResponse": {
                const response = request.original.parameter as IDialogResponse;

                // Is this a response for a request we sent out from here?
                const resolve = this.pendingDialogRequests.get(request.provider);
                if (resolve) {
                    request.provider.close();
                    this.pendingDialogRequests.delete(request.provider);
                    resolve(response);

                    return Promise.resolve(true);
                }

                break;
            }

            case "closeInstance": {
                request.provider.close();

                break;
            }

            default:
        }

        return Promise.resolve(false);
    };
}
