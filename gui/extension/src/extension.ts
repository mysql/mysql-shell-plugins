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
    commands, ExtensionContext, OutputChannel, StatusBarAlignment, StatusBarItem, window, workspace, extensions, env,
    Uri,
} from "vscode";

import * as child_process from "child_process";
import { existsSync, rmSync } from "fs";
import { join } from "path";
import { platform, arch } from "os";

import { appParameters, requisitions } from "../../frontend/src/supplement/Requisitions";

import {
    IShellLaunchConfiguration, LogLevel, MySQLShellLauncher,
} from "../../frontend/src/utilities/MySQLShellLauncher";

import { currentConnection } from "../../frontend/src/communication";
import { ExtensionHost } from "./ExtensionHost";
import { webSession } from "../../frontend/src/supplement/WebSession";
import { setupInitialWelcomeWebview } from "./web-views/WelcomeWebviewProvider";
import { waitFor } from "../../frontend/src/utilities/helpers";

export let taskOutputChannel: OutputChannel;
export let statusBarItem: StatusBarItem;
let outputChannel: OutputChannel;

let host: ExtensionHost;

let startupCompleted = false;

// Dialog Messages
const restartMessage = "This will close all MySQL Shell tabs and restart the underlying process. " +
    "After that a new connection will automatically be established.";
const resetMessage = "This will completely reset the MySQL Shell for VS Code extension by deleting the " +
    "web certificate and user settings directory.";
const resetRestartMessage = "The MySQL Shell for VS Code extension has been reset. Please restart VS Code " +
    "to initialize the extension again or press [Cancel] and remove the Extension from the Extensions View Container.";

/**
 * Prints the given content on the MySQL Shell for VS Code output channel.
 *
 * @param content The content to be printed.
 * @param reveal Whether the output channel should be revealed.
 */
export const printChannelOutput = (content: string, reveal = false): void => {
    outputChannel.appendLine(content);
    if (reveal) {
        outputChannel.show(true);
    }
};

/**
 * Checks the output sent from the shell process for special actions.
 *
 * @param output The process output.
 */
const handleShellOutput = (output: string): void => {
    if (!startupCompleted && output.includes("Sending session response...")) {
        // Set startupCompleted to indicate the extension has completed its startup
        startupCompleted = true;
    }

    if (!startupCompleted) {
        if (output.includes("Certificate is not installed.")) {
            // If the web certificate is not installed, ask the user if he wants to run the wizard
            void window.showInformationMessage(
                "The MySQL Shell for VSCode extension cannot run because the web certificate is " +
                "not installed. Do you want to run the Welcome Wizard to install it?",
                "Run Welcome Wizard", "Cancel")
                .then((answer) => {
                    if (answer !== "Cancel") {
                        void commands.executeCommand("msg.runWelcomeWizard");
                    }
                });
        } else if (output.includes("Certificate is not correctly installed.")) {
            // If the web certificate is not installed correctly, ask the user if he wants to run the wizard to fix it
            void window.showInformationMessage(
                "The MySQL Shell for VSCode extension cannot run because the web certificate is " +
                "incorrectly installed. Do you want to run the Welcome Wizard to fix it?",
                "Run Welcome Wizard", "Cancel")
                .then((answer) => {
                    if (answer !== "Cancel") {
                        void commands.executeCommand("msg.runWelcomeWizard");
                    }
                });
        }
    }

    printChannelOutput(output);
};

const shellLauncher = new MySQLShellLauncher(handleShellOutput,
    (error: Error) => {
        printChannelOutput(error.message, true);
    },
);

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
        void window.showWarningMessage(restartMessage, "Restart MySQL Shell", "Cancel").then(async (choice) => {
            if (choice === "Restart MySQL Shell") {
                host.closeAllTabs();
                currentConnection.disconnect();
                await shellLauncher.exitProcess();
                webSession.clearSessionData();

                shellLauncher.startShellAndConnect(context.extensionPath, true);
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
        }).then(async (value) => {
            host.closeAllTabs();
            currentConnection.disconnect();
            await shellLauncher.exitProcess();
            webSession.clearSessionData();

            const configuration = workspace.getConfiguration(`msg.debugLog`);
            const level = configuration.get<LogLevel>("level", "INFO");
            shellLauncher.startShellAndConnect(context.extensionPath, true, level, value);
        });
    }));

    context.subscriptions.push(commands.registerCommand("msg.resetExtension", () => {
        void window.showWarningMessage(resetMessage, "Reset Extension", "Cancel").then((choice) => {
            if (choice === "Reset Extension") {
                // Reset the MySQLShellInitialRun flag
                void context.globalState.update("MySQLShellInitialRun", "");

                const configuration = workspace.getConfiguration(`msg.debugLog`);
                const logLevel = configuration.get<LogLevel>("level", "INFO");

                // Delete the web certificate before removing shell user config dir.
                const config: IShellLaunchConfiguration = {
                    rootPath: context.extensionPath,
                    parameters: [
                        "--", "gui", "core", "remove-shell-web-certificate",
                    ],
                    logLevel,
                    onStdOutData: (output: string) => {
                        if (output.includes("true")) {
                            // Delete the shell user settings folder, only if it is the dedicated one for the extension.
                            const shellUserConfigDir = MySQLShellLauncher.getShellUserConfigDir(context.extensionPath);
                            if (shellUserConfigDir
                                .endsWith(MySQLShellLauncher.extensionShellUserConfigFolderBaseName)) {
                                rmSync(shellUserConfigDir, { recursive: true, force: true });
                            }

                            void window.showWarningMessage(resetRestartMessage, "Restart VS Code", "Cancel")
                                .then((choice) => {
                                    if (choice === "Restart VS Code") {
                                        void commands.executeCommand("workbench.action.reloadWindow");
                                    }
                                });
                        } else if (!output.startsWith("Starting embedded MySQL Shell") && !output.includes("DEBUG")) {
                            void window.showInformationMessage(
                                `The following error occurred while deleting the certificate: ${output} ` +
                                "Cancelled reset operation.");
                        }

                    },
                };

                MySQLShellLauncher.runMysqlShell(config);
            }
        });
    }));

    context.subscriptions.push(commands.registerCommand("msg.fileBugReport", () => {
        const currentVersion: string = extensions.getExtension(
            "Oracle.mysql-shell-for-vs-code")!.packageJSON.version || "1.0.0";
        let platformId;
        let cpuArch;

        switch (platform()) {
            case "darwin": {
                platformId = "6";
                break;
            }
            case "win32": {
                platformId = "7";
                break;
            }
            default: {
                // Default to Linux
                platformId = "5";
                break;
            }
        }

        switch (arch()) {
            case "arm":
            case "arm64": {
                cpuArch = "3";
                break;
            }
            case "x86": {
                cpuArch = "2";
                break;
            }
            default: {
                cpuArch = "1";
                break;
            }
        }

        void env.openExternal(Uri.parse("https://bugs.mysql.com/report.php?category=Shell%20VSCode%20Extension" +
            `&version=${currentVersion}&os=${platformId}&cpu_arch=${cpuArch}`));
    }));

    context.subscriptions.push(commands.registerCommand("msg.hasLaunchedSuccessfully", async (): Promise<Boolean> => {
        await waitFor(5000, () => {
            return startupCompleted;
        });

        return startupCompleted;
    }));

    // Handle version specific topics
    const currentVersion = extensions.getExtension("Oracle.mysql-shell-for-vs-code")!.packageJSON.version || "1.0.0";

    // Check if this is the initial run of the MySQL Shell extension after an update
    const lastRunVersion = context.globalState.get("MySQLShellLastRunVersion");
    if (!lastRunVersion || lastRunVersion === "" || lastRunVersion !== currentVersion) {
        void context.globalState.update("MySQLShellLastRunVersion", currentVersion);

        // Reset extended attributes on macOS
        if (platform() === "darwin") {
            const shellDir = join(context.extensionPath, "shell");
            if (existsSync(shellDir)) {
                // cSpell:ignore xattr
                void child_process.execSync(`xattr -rc ${shellDir}`);
            }
        }
    }

    // Check if this is the initial run of the MySQL Shell extension after installation
    const initialRun = context.globalState.get("MySQLShellInitialRun");
    if ((!initialRun || initialRun === "") && !appParameters.testsRunning) {
        void context.globalState.update("MySQLShellInitialRun", currentVersion);

        void commands.executeCommand("msg.runWelcomeWizard");
    } else {
        const useExternalUrl = workspace.getConfiguration("msg.shell").get<boolean>("useExternal");
        let externalUrl;
        if (useExternalUrl) {
            externalUrl = workspace.getConfiguration("msg.shell").get<string>("externalUrl");
        }

        const configuration = workspace.getConfiguration(`msg.debugLog`);
        const level = configuration.get<LogLevel>("level", "INFO");
        shellLauncher.startShellAndConnect(context.extensionPath, true, level, externalUrl);
    }
};

export const deactivate = (): void => {
    requisitions.unregister();
    currentConnection.disconnect();
    void shellLauncher.exitProcess();
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
