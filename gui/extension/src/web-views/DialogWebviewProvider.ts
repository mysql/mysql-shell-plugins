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

/** Creates and handles web views for dialog requests. */
export class DialogWebviewManager {
    private pendingDialogRequests = new Map<IWebviewProvider, (value?: IDialogResponse) => void>();
    private url?: URL;

    public constructor() {
        requisitions.register("connectedToUrl", this.connectedToUrl);
        requisitions.register("proxyRequest", this.proxyRequest);
    }

    public showDialog(request: IDialogRequest, caption: string): Promise<IDialogResponse | void> {
        if (!this.url) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            const provider = new WebviewProvider(this.url!, caption, this.handleDispose);
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

            default:
        }

        return Promise.resolve(false);
    };
}
