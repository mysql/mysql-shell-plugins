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

import * as path from "path";

import { commands, ConfigurationTarget, Uri, ViewColumn, WebviewPanel, window, workspace } from "vscode";

import {
    IRequestTypeMap, IRequisitionCallbackValues, IWebviewProvider, RequisitionHub, requisitions, SimpleCallback,
} from "../../../frontend/src/supplement/Requisitions.js";

import { IEmbeddedMessage } from "../../../frontend/src/communication/index.js";
import { IDialogResponse, IStatusbarInfo } from "../../../frontend/src/app-logic/Types.js";

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
     * Runs a remote command in the webview.
     *
     * @param requestType The type of the request to be sent.
     * @param parameter The data for the request.
     * @param settingName For positioning in VS Code, if a new webview must be opened.
     *
     * @returns A promise that resolves when the panel is up and running.
     */
    public runCommand<K extends keyof IRequestTypeMap>(requestType: K, parameter: IRequisitionCallbackValues<K>,
        settingName = ""): Promise<boolean> {
        return this.runInPanel(() => {
            this.requisitions?.executeRemote(requestType, parameter);

            return Promise.resolve(true);
        }, settingName);
    }

    /**
     * Runs a block of code in this web view. If the web view panel doesn't exist, it will be created first.
     *
     * @param block The block to execute.
     * @param settingName The name of the setting which determines where to place the tab in case it must be created
     *                    by this method.
     * @returns A promise which resolves after the block was executed.
     */
    protected runInPanel(block: () => Promise<boolean>, settingName?: string): Promise<boolean> {
        const placement =
            settingName ? workspace.getConfiguration("msg.tabPosition").get<string>(settingName) : undefined;

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
                this.panel.reveal();
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
            this.requisitions.register("updateStatusbar", this.updateStatusbar);

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

    private updateStatusbar = (items: IStatusbarInfo[]): Promise<boolean> => {
        // Proxy the notification over the global requisitions.
        return requisitions.execute("proxyRequest", {
            provider: this,
            original: { requestType: "updateStatusbar", parameter: items },
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
