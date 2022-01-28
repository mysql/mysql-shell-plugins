/*
 * Copyright (c) 2021, Oracle and/or its affiliates.
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
    commands, ExtensionContext, OutputChannel, StatusBarAlignment, StatusBarItem, window, workspace,
} from "vscode";

import * as child_process from "child_process";

import { requisitions } from "../../frontend/src/supplement/Requisitions";

import { findFreePort } from "./utilities";
import { uuid } from "../../frontend/src/utilities/helpers";
import { currentConnection } from "../../frontend/src/communication";
import { ExtensionHost } from "./ExtensionHost";
import { webSession } from "../../frontend/src/supplement/WebSession";

export let taskOutputChannel: OutputChannel;
let outputChannel: OutputChannel;
let statusBarItem: StatusBarItem;

let shellProcess: child_process.ChildProcess | undefined;
let host: ExtensionHost;

const restartMessage = "This will close all MySQL Shell tabs and restart the underlying process. " +
    "After that a new connection will automatically be established.";

export const printChannelOutput = (content: string, reveal = false): void => {
    outputChannel.appendLine(content);
    if (reveal) {
        outputChannel.show(true);
    }
};

const startShellAndConnect = (target?: string): void => {
    if (target) {
        const url = new URL(target);
        try {
            currentConnection.connect(new URL(target)).then(() => {
                void requisitions.execute("connectedToUrl", url);
            }).catch((reason) => {
                printChannelOutput(`Could not establish websocket connection: ${String(reason)}`);
                void window.showErrorMessage(`Could not connect to MySQL Shell: ${String(reason)}`);
                void requisitions.execute("connectedToUrl", undefined);
            });
        } catch (e) {
            void window.showErrorMessage("Error while parsing the external URL string: " + String(e));
            void requisitions.execute("connectedToUrl", undefined);
        }
    } else {
        findFreePort().then((port) => {
            const singleUserToken = uuid();

            const parameters = [
                "--log-level=debug3",
                "--py",
                "-e",
                `gui.start.web_server(port=${port}, secure={}, single_instance_token="${singleUserToken}")`,
            ];
            shellProcess = child_process.spawn("mysqlsh", parameters);

            shellProcess.on("error", (error: Error) => {
                printChannelOutput(`Error while starting MySQL Shell: ${error.message}`);
            });

            shellProcess.stderr?.on("data", (data) => {
                printChannelOutput(String(data));
            });

            shellProcess.stdout?.on("data", (data) => {
                const output = String(data);
                printChannelOutput(output);

                if (output.includes("Mode: Single user")) {
                    const url = new URL(`https://localhost:${port}/?token=${singleUserToken}`);

                    // Connect with a copy of the URL, because the URL will be modified in the connect() call.
                    currentConnection.connect(new URL(url.href)).then(() => {
                        void requisitions.execute("connectedToUrl", url);
                    }).catch((reason) => {
                        printChannelOutput(`Could not establish websocket connection: ${String(reason)}`);
                        void requisitions.execute("connectedToUrl", undefined);
                    });
                }
            });
        }).catch((error) => {
            printChannelOutput(String(error), true);
        });
    }
};

/**
 * Entry function for the extension. Called when the extension is activated.
 *
 * @param context The extension context from vscode.
 */
export const activate = (context: ExtensionContext): void => {
    outputChannel = window.createOutputChannel("MySQL Shell for VS Code");
    taskOutputChannel = window.createOutputChannel("MySQL Shell - Tasks");

    statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
    statusBarItem.hide();
    statusBarItem.tooltip = "MySQL Task Process";

    host = new ExtensionHost(context);

    context.subscriptions.push(commands.registerCommand("msg.restartShell", () => {
        void window.showWarningMessage(restartMessage, "Restart MySQL Shell", "Cancel").then((choice) => {
            if (choice === "Restart MySQL Shell") {
                host.closeAllTabs();
                currentConnection.disconnect();
                shellProcess?.kill();
                webSession.clearSessionData();

                startShellAndConnect();
            }
        });
    }));

    context.subscriptions.push(commands.registerCommand("msg.connectToShell", () => {
        const externalUrl = workspace.getConfiguration("msg.shell").get<string>("externalUrl");
        void window.showInputBox({
            title: "Connect to a MySQL Instance",
            value: externalUrl,
            prompt: "Enter the address of a MySQL Shell instance to connect to. Leave the field empty to start and " +
                "connect to a local MySQL Shell",
        }).then((value) => {
            host.closeAllTabs();
            currentConnection.disconnect();
            shellProcess?.kill();
            shellProcess = undefined;
            webSession.clearSessionData();

            startShellAndConnect(value);
        });
    }));

    const useExternalUrl = workspace.getConfiguration("msg.shell").get<boolean>("useExternal");
    let externalUrl;
    if (useExternalUrl) {
        externalUrl = workspace.getConfiguration("msg.shell").get<string>("externalUrl");
    }
    startShellAndConnect(externalUrl);
};

export const deactivate = (): void => {
    requisitions.unregister();
    currentConnection.disconnect();
    if (shellProcess?.pid) {
        shellProcess.kill();
    }
};

let statusBarTimer: ReturnType<typeof setTimeout>;

export const showStatusText = (text: string): void => {
    clearTimeout(statusBarTimer);
    statusBarItem.text = `MySQL Shell: ${text}`;
    statusBarItem.show();

    // Automatically hide the item after the timeout.
    setTimeout(() => {
        statusBarItem.hide();
    }, 15000);
};
