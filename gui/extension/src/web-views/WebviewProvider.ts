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

import { commands, ViewColumn, WebviewPanel, window, workspace } from "vscode";

import {
    IRequestTypeMap, IRequisitionCallbackValues, RequisitionHub, requisitions,
} from "../../../frontend/src/supplement/Requisitions";

import { IEmbeddedMessage } from "../../../frontend/src/communication";
import { IDialogResponse } from "../../../frontend/src/app-logic/Types";

import { printChannelOutput } from "../extension";

// The base class for our web view providers.
export class WebviewProvider {
    protected panel?: WebviewPanel;
    protected requisitions?: RequisitionHub;

    private notifyOnDispose = true;

    public constructor(
        protected url: URL,
        protected onDispose: (view: WebviewProvider) => void) {
    }

    public close(): void {
        if (this.panel) {
            this.notifyOnDispose = false;
            this.panel.dispose();
            this.panel = undefined;
        }
    }

    /**
     * Runs a remote command in the webview.
     *
     * @param requestType The type of the request to be sent.
     * @param parameter The data for the request.
     * @param caption A caption for the webview tab.
     * @param settingName For positioning in vscode, if a new webview must be opened.
     *
     * @returns A promise that resolves when the panel is up and running.
     */
    public runCommand<K extends keyof IRequestTypeMap>(requestType: K, parameter: IRequisitionCallbackValues<K>,
        caption: string, settingName = ""): Promise<boolean> {
        return this.runInPanel(() => {
            this.requisitions?.executeRemote(requestType, parameter);

            return Promise.resolve(true);
        }, caption, settingName);
    }

    /**
     * Runs a block of code in this web view. If the web view panel doesn't exist, it will be created first.
     *
     * @param block The block to execute.
     * @param caption The caption of the web view panel, in case it must be created first. If not specified and there's
     *                no webview panel yet, no panel will be created and the execution will not happen.
     * @param settingName The name of the setting which determines where to place the tab in case it must be created
     *                    by this method.
     * @returns A promise which resolves after the block was executed.
     */
    protected runInPanel(block: () => Promise<boolean>, caption?: string, settingName?: string): Promise<boolean> {
        const placement =
            settingName ? workspace.getConfiguration("msg.tabPosition").get<string>(settingName) : undefined;

        return new Promise((resolve, reject) => {
            if (!this.panel) {
                // Create the panel only if a caption is given. Otherwise the block is not executed at all.
                if (caption) {
                    this.createPanel(caption, placement).then(() => {
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
                if (caption) {
                    // Keep the current title if no new caption is given.
                    this.panel.title = caption;
                }

                this.panel.reveal();
                block().then(() => {
                    resolve(true);
                }).catch((reason) => {
                    reject(reason);
                });
            }
        });
    }

    protected createPanel(caption: string, placement?: string): Promise<boolean> {
        return new Promise((resolve) => {
            void this.prepareEditorGroup(placement).then((viewColumn) => {
                this.panel = window.createWebviewPanel(
                    "msg-webview",
                    caption,
                    viewColumn,
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true,
                    });

                this.panel.onDidDispose(() => { this.handleDispose(); });

                this.requisitions = new RequisitionHub("host", this.panel.webview);
                this.requisitions.register("applicationDidStart", (): Promise<boolean> => {
                    resolve(true);
                    printChannelOutput("State: application did start");

                    return Promise.resolve(true);
                });

                this.requisitions.register("settingsChanged", this.updateVscodeSettings);

                this.requisitionsCreated();

                this.panel.webview.onDidReceiveMessage((message: IEmbeddedMessage) => {
                    if (message.source === "app") {
                        this.requisitions?.handleRemoteMessage(message);
                    }
                });

                // Insert an iframe to load the external URL from the running mysql shell server.
                this.url.searchParams.set("app", "vscode");

                this.panel.webview.html = `
<!doctype html><html lang="en">
<head>
<meta http-equiv="Content-Security-Policy" content="default-src *; img-src http: https:;
    script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline' http: https: data: *;">
</head>
<body style="margin:0px;padding:0px;overflow:hidden;">
<iframe id="frame:${caption}"
    src="${this.url.toString()}"
    frameborder="0" style="overflow: hidden; overflow-x: hidden; overflow-y: hidden; height:100%;
    width:100%; position: absolute; top: 0px; left: 0px; right: 0px; bottom: 0px" height="100%"
    width="100%">
</iframe>
<script>
    let frame;
    let vscode;

    document.addEventListener("paste", (event) => {
        frame.contentWindow.postMessage({
            source: "host",
            command: "paste",
            data: { text: event.clipboardData.getData("text") }
        }, "*");
    });

    window.addEventListener('message', (event) => {
        if (!frame) {
            vscode = acquireVsCodeApi();
            frame = document.getElementById("frame:${caption}");

            // Listen to style changes on the outer iframe.
            const sendThemeMessage = () => {
                frame.contentWindow.postMessage({
                    source: "host",
                    command: "hostThemeChange",
                    data: { css: document.documentElement.style.cssText, themeClass: document.body.className }
                }, "*");
            };

            const observer = new MutationObserver(sendThemeMessage);
            observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });

            // Send initial theme change message.
            sendThemeMessage();
        }

        if (event.data.source === "host") {
            // Forward message from the extension to the iframe.
            frame.contentWindow.postMessage(event.data, "*");
        } else if (event.data.source === "app") {
            // Forward app events either directly or after a conversion to vscode.
            switch (event.data.command) {
                case "keydown": {
                    window.dispatchEvent(new KeyboardEvent("keydown", event.data));
                    break;
                }
                case "keyup": {
                    window.dispatchEvent(new KeyboardEvent("keyup", event.data));
                    break;
                }
                case "writeClipboard": {
                    // This is a special message and can be handled here.
                    window.navigator.clipboard.writeText(event.data.text);
                    break;
                }
                default: {
                    vscode.postMessage(event.data);
                    break;
                }
            }
        }
    });
</script>

</body></html>
                    `;
            });

        });
    }

    protected handleDispose(): void {
        this.panel = undefined;
        if (this.notifyOnDispose) {
            this.onDispose(this);
        }
    }

    protected requisitionsCreated(): void {
        if (this.requisitions) {
            this.requisitions.register("selectConnectionTab", this.selectConnectionTab);
            this.requisitions.register("dialogResponse", this.dialogResponse);
        }
    }

    private selectConnectionTab = (page: string): Promise<boolean> => {
        // The app just opened or activated a new tab. We have to update the webview caption.
        if (this.panel && page) {
            this.panel.title = page;

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    };

    private dialogResponse = (response: IDialogResponse): Promise<boolean> => {
        if (!response.data) {
            response.data = { view: this };
        } else {
            response.data.view = this;
        }

        // Forward to global requisitions.
        // TODO: better let handlers subscribe to the internal requisitions.
        return requisitions.execute("dialogResponse", response);
    };

    private updateVscodeSettings = (entry?: { key: string; value: unknown }): Promise<boolean> => {
        return new Promise((resolve) => {
            if (entry) {
                const parts = entry.key.split(".");
                if (parts.length === 3) {
                    const configuration = workspace.getConfiguration(`msg.${parts[0]}`);
                    void configuration.update(`${parts[1]}.${parts[2]}`, entry.value, true).then(() => {
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
