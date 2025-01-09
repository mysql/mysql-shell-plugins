/*
 * Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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

import * as path from "path";

import { commands, ConfigurationTarget, Uri, ViewColumn, WebviewPanel, window, workspace } from "vscode";

import { RequisitionHub, requisitions } from "../../../frontend/src/supplement/Requisitions.js";
import {
    IRequestTypeMap, IRequisitionCallbackValues, IWebviewProvider, SimpleCallback,
    type IUpdateStatusBarItem,
} from "../../../frontend/src/supplement/RequisitionTypes.js";

import { IDialogResponse } from "../../../frontend/src/app-logic/general-types.js";
import { IEmbeddedMessage } from "../../../frontend/src/communication/index.js";

import { printChannelOutput } from "../extension.js";
import { prepareWebviewContent } from "./webview-helpers.js";

type WebviewDisposeHandler = (view: WebviewProvider) => void;
type WebviewChangeStateHandler = (view: WebviewProvider, active: boolean) => void;

/** The base class for our web view providers. */
export class WebviewProvider implements IWebviewProvider {
    protected panel?: WebviewPanel;
    protected requisitions?: RequisitionHub;

    #notifyOnDispose = true;
    #caption: string;

    public constructor(
        protected url: URL,
        protected onDispose: WebviewDisposeHandler,
        protected onStateChange?: WebviewChangeStateHandler) {
    }

    /** @returns the current caption of the web view panel (if it exists). */
    public get caption(): string {
        return this.#caption ?? "MySQL Shell";
    }

    /** Sets a new caption for the webview panel. */
    public set caption(value: string) {
        this.#caption = value;
        if (this.panel) {
            this.panel.title = value;
        }
    }

    public close(): void {
        if (this.panel) {
            this.#notifyOnDispose = false;
            this.panel.dispose();
            this.panel = undefined;
        }
    }

    /**
     * Make the web view panel visible.
     */
    public reveal(): void {
        if (this.panel) {
            this.panel.reveal();
        }
    }

    /**
     * Runs a remote command in the webview.
     *
     * @param requestType The type of the request to be sent.
     * @param parameter The data for the request.
     * @param caption For positioning in VS Code, if a new webview must be opened.
     * @param reveal Whether web view panel needs to be revealed.
     *
     * @returns A promise that resolves when the panel is up and running.
     */
    public runCommand<K extends keyof IRequestTypeMap>(requestType: K, parameter: IRequisitionCallbackValues<K>,
        caption = "", reveal = true): Promise<boolean> {
        return this.runInPanel(() => {
            this.requisitions?.executeRemote(requestType, parameter);

            return Promise.resolve(true);
        }, caption, reveal);
    }

    /**
     * Runs a block of code in this web view. If the web view panel doesn't exist, it will be created first.
     *
     * @param block The block to execute.
     * @param caption The name of the setting which determines where to place the tab in case it must be created
     *                    by this method.
     * @param reveal Whether web view panel needs to be revealed.
     * @returns A promise which resolves after the block was executed.
     */
    protected runInPanel(block: () => Promise<boolean>, caption?: string,
        reveal?: boolean): Promise<boolean> {
        const placement =
            caption ? workspace.getConfiguration("msg.tabPosition").get<string>(caption) : undefined;

        return new Promise((resolve, reject) => {
            if (!this.panel) {
                // Create the panel only if a caption is given. Otherwise the block is not executed at all.
                if (this.caption) {
                    this.createPanel(placement).then(() => {
                        block().then(() => {
                            resolve(true);
                        }).catch((reason) => {
                            reject(reason);
                        });
                    }).catch((reason) => {
                        reject(reason);
                    });
                } else {
                    resolve(false);
                }
            } else {
                if (reveal) {
                    this.panel.reveal();
                }
                block().then(() => {
                    resolve(true);
                }).catch((reason) => {
                    reject(reason);
                });
            }
        });
    }

    protected createPanel(placement?: string): Promise<boolean> {
        return new Promise((resolve) => {
            void this.prepareEditorGroup(placement).then((viewColumn) => {
                this.panel = window.createWebviewPanel(
                    "msg-webview",
                    this.#caption,
                    { viewColumn, preserveFocus: true },
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true,
                    });

                this.panel.onDidDispose(() => { this.handleDispose(); });
                this.panel.iconPath = {
                    dark: Uri.file(path.join(__dirname, "..", "images", "dark", "mysql.svg")),
                    light: Uri.file(path.join(__dirname, "..", "images", "light", "mysql.svg")),
                };

                this.requisitions = new RequisitionHub("host");
                this.requisitions.setRemoteTarget(this.panel.webview);
                this.requisitions.register("applicationDidStart", (): Promise<boolean> => {
                    resolve(true);
                    printChannelOutput("State: application did start");

                    return Promise.resolve(true);
                });

                this.requisitionsCreated();

                this.panel.webview.onDidReceiveMessage((message: IEmbeddedMessage) => {
                    if (message.source === "app") {
                        this.requisitions?.handleRemoteMessage(message);
                    }
                });

                if (this.onStateChange) {
                    this.panel.onDidChangeViewState((event) => {
                        this.onStateChange?.(this, event.webviewPanel.active);
                    });
                }

                prepareWebviewContent(this.panel, this.url);
            });

        });
    }

    protected handleDispose(): void {
        this.panel = undefined;
        if (this.#notifyOnDispose) {
            this.onDispose(this);
        }
    }

    protected requisitionsCreated(): void {
        if (this.requisitions) {
            this.requisitions.register("settingsChanged", this.updateVscodeSettings);
            this.requisitions.register("selectConnectionTab", this.selectConnectionTab);
            this.requisitions.register("dialogResponse", this.dialogResponse);
            this.requisitions.register("updateStatusBarItem", this.updateStatusBarItem);
            this.requisitions.register("showError", this.showError);
            this.requisitions.register("showInfo", this.showInfo);
            this.requisitions.register("showWarning", this.showWarning);
            this.requisitions.register("updateMrsRoot", this.updateMrsRoot);

            this.requisitions.register("closeInstance",
                this.forwardSimple.bind(this, "closeInstance") as SimpleCallback);
        }
    }

    private selectConnectionTab = (details: { connectionId: number, page: string; }): Promise<boolean> => {
        // The app just opened or activated a new tab.
        if (this.panel) {
            return requisitions.execute("proxyRequest", {
                provider: this,
                original: { requestType: "selectConnectionTab", parameter: details },
            });
        }

        return Promise.resolve(false);
    };

    private dialogResponse = (response: IDialogResponse): Promise<boolean> => {
        // Proxy the notification over the global requisitions.
        return requisitions.execute("proxyRequest", {
            provider: this,
            original: { requestType: "dialogResponse", parameter: response },
        });
    };

    private showError = (message: string): Promise<boolean> => {
        // Proxy the notification over the global requisitions.
        return requisitions.execute("proxyRequest", {
            provider: this,
            original: { requestType: "showError", parameter: message },
        });
    };

    private showInfo = (message: string): Promise<boolean> => {
        // Proxy the notification over the global requisitions.
        return requisitions.execute("proxyRequest", {
            provider: this,
            original: { requestType: "showInfo", parameter: message },
        });
    };

    private showWarning = (message: string): Promise<boolean> => {
        // Proxy the notification over the global requisitions.
        return requisitions.execute("proxyRequest", {
            provider: this,
            original: { requestType: "showWarning", parameter: message },
        });
    };

    private updateStatusBarItem = (item: IUpdateStatusBarItem): Promise<boolean> => {
        // Proxy the notification over the global requisitions.
        return requisitions.execute("proxyRequest", {
            provider: this,
            original: { requestType: "updateStatusBarItem", parameter: item },
        });
    };

    private updateMrsRoot = (connectionId: string): Promise<boolean> => {
        return requisitions.execute("proxyRequest", {
            provider: this,
            original: { requestType: "updateMrsRoot", parameter: connectionId },
        });
    };

    /**
     * Used to forward all requests to the global requisitions, which have no parameters.
     *
     * @param requestType The request type to forward.
     *
     * @returns A promise that resolves when the request was forwarded.
     */
    private forwardSimple = (requestType: keyof IRequestTypeMap): Promise<boolean> => {
        // Proxy the notification over the global requisitions.
        return requisitions.execute("proxyRequest", {
            provider: this,
            original: { requestType, parameter: undefined },
        });
    };

    private updateVscodeSettings = (entry?: { key: string; value: unknown; }): Promise<boolean> => {
        return new Promise((resolve) => {
            if (entry) {
                const parts = entry.key.split(".");
                if (parts.length === 3) {
                    const configuration = workspace.getConfiguration(`msg.${parts[0]}`);
                    void configuration.update(`${parts[1]}.${parts[2]}`, entry.value,
                        ConfigurationTarget.Global).then(() => {
                            resolve(true);
                        });
                }
            }

            resolve(false);
        });
    };

    private prepareEditorGroup = async (placement?: string): Promise<ViewColumn> => {
        let viewColumn = (!placement || placement === "Active") ? ViewColumn.Active : ViewColumn.Beside;
        if (placement === "Beside Bottom") {
            viewColumn = ViewColumn.Active;
            await commands.executeCommand("workbench.action.editorLayoutTwoRows");
            await commands.executeCommand("workbench.action.focusSecondEditorGroup");
        }

        return viewColumn;
    };
}
