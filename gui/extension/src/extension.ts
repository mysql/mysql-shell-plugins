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

import {
    commands, ExtensionContext, OutputChannel, StatusBarAlignment, StatusBarItem, window, workspace, extensions,
} from "vscode";

import * as child_process from "child_process";
import { existsSync } from "fs";
import { join } from "path";

import { requisitions } from "../../frontend/src/supplement/Requisitions";

import { findFreePort } from "./utilities";
import { uuid } from "../../frontend/src/utilities/helpers";
import { currentConnection } from "../../frontend/src/communication";
import { ExtensionHost } from "./ExtensionHost";
import { webSession } from "../../frontend/src/supplement/WebSession";
import { setupInitialWelcomeWebview } from "./web-views/WelcomeWebviewProvider";
import { platform } from "os";

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

/**
 * Starts an instance of the MySQL Shell
 *
 * @param extensionPath The file system path of the extension.
 * @param parameters The parameters to be passed to the shell.
 * @param onStdOutData The callback to handle standard output.
 * @param onStdErrData The callback to handle data error output. If not specified onStdOutData will be used.
 * @param onError The callback to handle other error output. If not specified onStdOutData will be used.
 * @param onExit The callback to handle the shell exit.
 * @param textForStdin Optional text to be passed to STDIN
 *
 * @returns The shell process
 */
export const runMysqlShell = (extensionPath: string, parameters: string[],
    onStdOutData: (data: unknown) => void,
    onStdErrData?: (data: unknown) => void,
    onError?: (error: Error) => void,
    onExit?: (code: number) => void,
    textForStdin?: string): child_process.ChildProcess => {

    // Check if MySQL Shell is bundled with the extension
    let shellPath = join(extensionPath, "shell", "bin", "mysqlsh");
    if (platform() === "win32") {
        shellPath += ".exe";
    }

    if (!existsSync(shellPath)) {
        // If not, try to use the mysqlsh installed in the system
        shellPath = "mysqlsh";
        printChannelOutput("Starting MySQL Shell (from PATH) ...");
    } else {
        printChannelOutput("Starting MySQL Shell ...");
    }

    // Spawn shell process
    const shellProc = child_process.spawn(shellPath, parameters, {
        env: {
            ...process.env,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            LOG_LEVEL: "INFO",
        },
    });

    if (textForStdin) {
        shellProc.stdin.setDefaultEncoding("utf-8");
        shellProc.stdin.write(`${textForStdin}\n`);
        shellProc.stdin.end();
    }

    // Assign callbacks
    shellProc.stdout?.on("data", onStdOutData);
    if (!onError) {
        onError = (error: Error) => {
            printChannelOutput(`Error while starting MySQL Shell: ${error.message}`);
        };
    }

    shellProc.on("error", onError);
    if (onStdErrData) {
        shellProc.stderr?.on("data", onStdErrData);
    } else {
        shellProc.stderr?.on("data", onStdOutData);
    }

    if (onExit) {
        shellProc.on("exit", onExit);
    }

    return shellProc;
};

const startShellAndConnect = (extensionPath: string, target?: string): void => {
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
                "--py",
                "-e",
                `gui.start.web_server(port=${port}, secure={}, read_token_on_stdin=True)`,
            ];

            shellProcess = runMysqlShell(extensionPath, parameters, (data) => {
                // onStdOutData
                const output = String(data);
                printChannelOutput(output);

                // If the web certificate is not installed, ask the user if he wants to run the wizard
                if (output.includes("Certificate is not installed.")) {
                    void window.showInformationMessage(
                        "The MySQL Shell for VSCode extension cannot run because the web certificate is " +
                        "not installed? Do you want to run the Welcome Wizard to install it?",
                        "Run Welcome Wizard", "Cancel").then((answer) => {
                        if (answer !== "Cancel") {
                            void commands.executeCommand("msg.runWelcomeWizard");
                        }
                    },
                    );
                }

                // If the MySQL Shell web server is running and indicates Single user mode, connect to it
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
            }, (data) => {
                // onStdErrData
                printChannelOutput(String(data));
            },
            undefined, undefined, singleUserToken);

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

    // Register "msg.runWelcomeWizard" command.
    setupInitialWelcomeWebview(context);

    context.subscriptions.push(commands.registerCommand("msg.restartShell", () => {
        void window.showWarningMessage(restartMessage, "Restart MySQL Shell", "Cancel").then((choice) => {
            if (choice === "Restart MySQL Shell") {
                host.closeAllTabs();
                currentConnection.disconnect();
                shellProcess?.kill();
                webSession.clearSessionData();

                startShellAndConnect(context.extensionPath);
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

            startShellAndConnect(context.extensionPath, value);
        });
    }));

    // TODO: This is a temporary workaround till we get signed binaries from RE
    if (platform() === "darwin") {
        const shellDir = join(context.extensionPath, "shell");
        if (existsSync(shellDir)) {
            // cSpell:ignore xattr
            void child_process.execSync(`xattr -rc ${shellDir}`);
        }
    }

    // Check if this is the initial run of the MySQL Shell extension after installation
    const initialRun = context.globalState.get("MySQLShellInitialRun");
    if (!initialRun || initialRun === "") {
        const currentVersion = extensions.getExtension(
            "Oracle.mysql-shell-for-vs-code")!.packageJSON.version || "1.0.0";
        void context.globalState.update("MySQLShellInitialRun", currentVersion);

        void commands.executeCommand("msg.runWelcomeWizard");
    } else {
        const useExternalUrl = workspace.getConfiguration("msg.shell").get<boolean>("useExternal");
        let externalUrl;
        if (useExternalUrl) {
            externalUrl = workspace.getConfiguration("msg.shell").get<string>("externalUrl");
        }

        startShellAndConnect(context.extensionPath, externalUrl);
    }
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
