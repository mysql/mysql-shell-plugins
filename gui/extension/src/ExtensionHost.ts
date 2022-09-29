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
    commands, ExtensionContext, window, workspace, ConfigurationChangeEvent, WorkspaceConfiguration,
} from "vscode";

import { isNil } from "lodash";

import {
    ICommAuthenticationEvent, ICommErrorEvent, ICommListDataCategoriesEvent, ICommListProfilesEvent, ICommShellProfile,
    ICommWebSessionEvent, IShellModuleDataCategoriesEntry,
} from "../../frontend/src/communication";

import { eventFilterNoRequests, ListenerEntry } from "../../frontend/src/supplement/Dispatch";
import { DBType, ShellInterface } from "../../frontend/src/supplement/ShellInterface";
import { webSession } from "../../frontend/src/supplement/WebSession";
import { ISettingCategory, settingCategories } from "../../frontend/src/supplement/Settings/SettingsRegistry";
import { settings } from "../../frontend/src/supplement/Settings/Settings";
import { ShellTask } from "../../frontend/src/shell-tasks/ShellTask";

import { ShellConsolesTreeDataProvider } from "./tree-providers/ShellTreeProvider/ShellConsolesTreeProvider";
import { ScriptsTreeDataProvider } from "./tree-providers/ScriptsTreeProvider";
import { SchemaMySQLTreeItem } from "./tree-providers/ConnectionsTreeProvider/SchemaMySQLTreeItem";
import { ShellTasksTreeDataProvider } from "./tree-providers/ShellTreeProvider/ShellTasksTreeProvider";
import { printChannelOutput, taskOutputChannel } from "./extension";
import { ConnectionMySQLTreeItem } from "./tree-providers/ConnectionsTreeProvider/ConnectionMySQLTreeItem";

import { DBEditorCommandHandler } from "./DBEditorCommandHandler";
import { ShellConsoleCommandHandler } from "./ShellConsoleCommandHandler";
import { requisitions } from "../../frontend/src/supplement/Requisitions";
import { MDSCommandHandler } from "./MDSCommandHandler";
import { MRSCommandHandler } from "./MRSCommandHandler";
import { ConnectionsTreeDataProvider, IConnectionEntry } from "./tree-providers/ConnectionsTreeProvider";

// This class manages some extension wide things like authentication handling etc.
export class ExtensionHost {
    private activeProfile?: ICommShellProfile;
    private updatingSettings = false;

    private connectionsProvider = new ConnectionsTreeDataProvider();

    private dbEditorCommandHandler  = new DBEditorCommandHandler(this.connectionsProvider);
    private shellConsoleCommandHandler = new ShellConsoleCommandHandler();
    private mrsCommandHandler = new MRSCommandHandler();
    private mdsCommandHandler = new MDSCommandHandler();

    // Tree data providers for the extension's sidebar. The connection provider is managed in the DB editor
    // command handler.
    private scriptsTreeDataProvider: ScriptsTreeDataProvider;
    private consoleTreeDataProvider: ShellConsolesTreeDataProvider;
    private shellTasksTreeDataProvider: ShellTasksTreeDataProvider;

    // List of shell tasks
    private shellTasks: ShellTask[] = [];

    // A mapping from data type captions to data type ids.
    private moduleDataCategories = new Map<string, IShellModuleDataCategoriesEntry>();

    // Listeners.
    private serverResponseListener: ListenerEntry;
    private sessionListener: ListenerEntry;

    public constructor(public context: ExtensionContext) {
        this.setupEnvironment();

        requisitions.register("settingsChanged", this.updateVscodeSettings);

        this.serverResponseListener = ListenerEntry.createByClass("serverResponse", { persistent: true });
        this.serverResponseListener.catch((errorEvent: ICommErrorEvent) => {
            void window.showErrorMessage(`Backend Error: ${errorEvent.data.result.requestState.msg}`);
        });

        this.sessionListener = ListenerEntry.createByClass("webSession",
            { filters: [eventFilterNoRequests], persistent: true });
        this.sessionListener.then((event: ICommWebSessionEvent) => {
            if (event.data?.sessionUuid) {
                webSession.sessionId = event.data.sessionUuid;
                webSession.localUserMode = event.data.localUserMode;
            }

            if (webSession.userName === "") {
                if (event.data?.localUserMode) {
                    ShellInterface.users.authenticate("LocalAdministrator", "")
                        .then((authEvent: ICommAuthenticationEvent) => {
                            this.onAuthentication(authEvent);
                        });
                }
            } else if (event.data) {
                webSession.loadProfile(event.data.activeProfile);
                this.activeProfile = event.data.activeProfile;
            }
        }).catch((event) => {
            printChannelOutput("Internal error: " + String(event.stack), true);
        });
    }

    /**
     * Closes all webview tabs and frees their providers.
     */
    public closeAllTabs(): void {
        this.dbEditorCommandHandler.closeProviders();
        this.shellConsoleCommandHandler.closeProviders();
    }

    public addNewShellTask(caption: string, shellArgs: string[], dbConnectionId?: number): Promise<unknown> {
        const task = new ShellTask(caption, this.taskPromptCallback, this.taskMessageCallback);
        this.shellTasks.push(task);
        this.shellTasksTreeDataProvider.refresh();

        taskOutputChannel.show();

        return task.runTask(shellArgs, dbConnectionId).then(() => {
            this.shellTasksTreeDataProvider.refresh();
        });
    }


    /**
     * Determines a connection to run SQL code with.
     *
     * @param dbType The DBType of the connection
     *
     * @returns A promise resolving to a connection entry or undefined if no entry was found.
     */
    public determineConnection = async (dbType?: DBType): Promise<IConnectionEntry | undefined> => {
        let connections = this.connectionsProvider.connections;

        const connectionName = workspace.getConfiguration("msg.editor").get<string>("defaultDbConnection");
        if (connectionName) {
            const connection = connections.find((candidate) => {
                return candidate.details.caption === connectionName;
            });

            if (!connection) {
                throw Error(`The default Database Connection ${connectionName} is not available anymore. ` +
                    "Please make another Database Connection the new default.");
            } else if (dbType && connection.details.dbType !== dbType) {
                throw Error(`The default Database Connection ${connectionName} is a ` +
                    `${String(connection.details.dbType)} connection. This function requires a ${String(dbType)} ` +
                    "connection.");
            }

            return connection;
        } else {
            // If a specific dbType was specified, filter connections by that DBType
            if (dbType) {
                connections = connections.filter((conn) => {
                    return conn.details.dbType === dbType;
                });
            }

            // Check if there is at least one connection
            if (connections.length === 0) {
                if (dbType) {
                    throw Error(`Please create a ${String(dbType)} Database Connection first.`);
                } else {
                    throw Error("Please create a Database Connection first.");
                }
            }

            // No default connection set. Show a picker.
            const items = connections.map((connection) => {
                return connection.details.caption;
            });
            const name = await window.showQuickPick(items, {
                title: "Select a connection for SQL execution",
                matchOnDescription: true,
                placeHolder: "Type the name of an existing DB connection",
            });

            const connection = connections.find((candidate) => {
                return candidate.details.caption === name;
            });

            return connection;
        }
    };

    /**
     * Prepares all vscode providers for first use.
     */
    private setupEnvironment(): void {
        this.dbEditorCommandHandler.setup(this.context, this);
        this.shellConsoleCommandHandler.setup(this.context);
        this.mrsCommandHandler.setup(this.context, this);
        this.mdsCommandHandler.setup(this.context, this);

        const updateLogLevel = (): void => {
            const configuration = workspace.getConfiguration(`msg.debugLog`);
            const level = configuration.get<string>("level", "INFO");

            void ShellInterface.core.setLogLevel(level).catch((error) => {
                void window.showErrorMessage("Error while setting log level: " + String(error));
            });
        };
        updateLogLevel();

        this.context.subscriptions.push(workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
            if (event.affectsConfiguration("msg")) {
                updateLogLevel();
                this.updateProfileSettings();
            }
        }));

        // Our tree providers.
        this.consoleTreeDataProvider = new ShellConsolesTreeDataProvider();
        this.context.subscriptions.push(window.registerTreeDataProvider("msg.consoles", this.consoleTreeDataProvider));

        this.shellTasksTreeDataProvider = new ShellTasksTreeDataProvider(this.shellTasks);
        this.context.subscriptions.push(window.registerTreeDataProvider("msg.shellTasks",
            this.shellTasksTreeDataProvider));

        // The scripts provider needs a module data category id and is created later, when this info is available.

        // Handling of extension commands.
        this.context.subscriptions.push(commands.registerCommand("msg.selectProfile", () => {
            this.selectProfile();
        }));

        this.context.subscriptions.push(commands.registerCommand("msg.dumpSchemaToDisk",
            (item?: SchemaMySQLTreeItem) => {
                if (item) {
                    void window.showOpenDialog({
                        title: "Select an output folder for the dump.",
                        openLabel: "Select Dump Folder",
                        canSelectFiles: false,
                        canSelectFolders: true,
                        canSelectMany: false,
                    }).then((targetUri) => {
                        if (targetUri && targetUri.length === 1) {
                            const shellArgs = [
                                "--",
                                "util",
                                "dump-schemas",
                                item.schema,
                                "--outputUrl",
                                targetUri[0].fsPath,
                            ];

                            void this.addNewShellTask(`Dump Schema ${item.schema} to Disk`, shellArgs,
                                item.entry.details.id)
                                .then(() => {
                                    this.shellTasksTreeDataProvider.refresh();
                                });
                        }
                    });
                }
            }));

        this.context.subscriptions.push(commands.registerCommand("msg.dumpSchemaToDiskForMds",
            (item?: SchemaMySQLTreeItem) => {
                if (item) {
                    void window.showOpenDialog({
                        title: "Select an output folder for the dump.",
                        openLabel: "Select Dump Folder",
                        canSelectFiles: false,
                        canSelectFolders: true,
                        canSelectMany: false,
                    }).then((targetUri) => {
                        if (targetUri && targetUri.length === 1) {
                            const shellArgs = [
                                "--",
                                "util",
                                "dump-schemas",
                                item.schema,
                                "--outputUrl",
                                targetUri[0].fsPath,
                                "--ocimds",
                                "true",
                                "--compatibility",
                                "create_invisible_pks,force_innodb,skip_invalid_accounts," +
                                "strip_definers,strip_restricted_grants,strip_tablespaces",
                            ];

                            void this.addNewShellTask(`Dump Schema ${item.schema} to Disk`, shellArgs,
                                item.entry.details.id)
                                .then(() => {
                                    this.shellTasksTreeDataProvider.refresh();
                                });
                        }
                    });
                }
            }));

        this.context.subscriptions.push(commands.registerCommand("msg.loadDumpFromDisk",
            (item?: ConnectionMySQLTreeItem) => {
                if (item) {
                    void window.showOpenDialog({
                        title: "Select a folder that contains a MySQL Shell dump.",
                        openLabel: "Select Dump Folder",
                        canSelectFiles: false,
                        canSelectFolders: true,
                        canSelectMany: false,
                    }).then((targetUri) => {
                        if (targetUri && targetUri.length === 1) {
                            const shellArgs = [
                                "--",
                                "util",
                                "load-dump",
                                targetUri[0].fsPath,
                            ];

                            let folderName = "";
                            const m = targetUri[0].fsPath.match(/([^/]*)\/*$/);
                            if (m && m.length > 1) {
                                folderName = m[1] + " ";
                            }

                            void this.addNewShellTask(`Loading Dump ${folderName}from Disk`, shellArgs,
                                item.entry.details.id)
                                .then(() => {
                                    this.shellTasksTreeDataProvider.refresh();
                                    void commands.executeCommand("msg.refreshConnections");
                                });
                        }
                    });
                }
            }));
    }

    private onAuthentication(event: ICommAuthenticationEvent): void {
        this.activeProfile = event.data?.activeProfile;
        ShellInterface.modules.listDataCategories().then((list: ICommListDataCategoriesEvent) => {
            list.data.result.forEach((row) => {
                this.moduleDataCategories.set(row.name, row);
            });

            // TODO: Finish the SCRIPT tree,
            // leave the current implementation commented out for now on purpose
            /*if (!this.scriptsTreeDataProvider) {
                const category = this.moduleDataCategories.get("Script");
                if (category) {
                    this.scriptsTreeDataProvider = new ScriptsTreeDataProvider(category.id);
                    this.context.subscriptions.push(window.registerTreeDataProvider("msg.scripts",
                        this.scriptsTreeDataProvider));
                }
            } else {
                this.scriptsTreeDataProvider.refresh();
            }*/

            // Refresh relevant tree providers.
            this.dbEditorCommandHandler.refreshConnectionTree();
            this.consoleTreeDataProvider.refresh([]);

            void commands.executeCommand("msg.mds.refreshOciProfiles");
        });

    }

    /**
     * Triggered when the user changed a vscode setting. Updates the current profile.
     */
    private updateProfileSettings(): void {
        if (!this.updatingSettings) {
            this.updatingSettings = true;

            const handleChildren = (children?: ISettingCategory[], configuration?: WorkspaceConfiguration): void => {
                children?.forEach((child) => {
                    child.values.forEach((value) => {
                        const configValue = configuration?.get(`${child.key}.${value.key}`);
                        if (!isNil(configValue)) {
                            settings.set(value.id, configValue);
                        }
                    });

                    handleChildren(child.children, configuration);
                });
            };

            const categories = settingCategories.children;
            if (categories) {
                categories.forEach((category) => {
                    const configuration = workspace.getConfiguration(`msg.${category.key}`);
                    category.values.forEach((value) => {
                        const configValue = configuration.get(value.key);
                        if (!isNil(configValue)) {
                            settings.set(value.id, configValue);
                        }
                    });

                    handleChildren(category.children, configuration);
                });
            }

            settings.saveSettings();

            this.updatingSettings = false;
        }
    }

    /**
     * The other way around for settings. When the profile changes, change also VS code settings.
     *
     * @param entry The entry that changed or undefined when all values must be set.
     * @param entry.key The key of the value to change.
     * @param entry.value The value to set.
     *
     * @returns A promise resolving to true.
     */
    private updateVscodeSettings = async (entry?: { key: string; value: unknown }): Promise<boolean> => {
        if (!this.updatingSettings) {
            this.updatingSettings = true;
            if (entry) {
                const parts = entry.key.split(".");
                if (parts.length === 3) {
                    const configuration = workspace.getConfiguration(`msg.${parts[0]}`);
                    const currentValue = configuration.get(`${parts[1]}.${parts[2]}`);
                    if (currentValue !== entry.value) {
                        await configuration.update(`${parts[1]}.${parts[2]}`, entry.value, true);
                    }
                }
            } else {
                const categories = settingCategories.children;
                if (categories) {
                    const updateFromChildren = async (children?: ISettingCategory[],
                        configuration?: WorkspaceConfiguration): Promise<void> => {
                        if (children && configuration) {
                            for await (const child of children) {
                                for await (const value of child.values) {
                                    const setting = settings.get(value.id);
                                    const currentValue = configuration.get(`${child.key}.${value.key}`);
                                    if (setting !== currentValue) {
                                        await configuration.update(`${child.key}.${value.key}`, setting, true);
                                    }
                                }

                                await updateFromChildren(child.children, configuration);
                            }
                        }
                    };

                    for await (const category of categories) {
                        if (category.key !== "theming") {
                            const configuration = workspace.getConfiguration(`msg.${category.key}`);
                            for await (const value of category.values) {
                                const setting = settings.get(value.id);
                                const currentValue = configuration.get(value.key);
                                if (setting !== currentValue) {
                                    await configuration.update(value.key, setting, true);
                                }
                            }

                            await updateFromChildren(category.children, configuration);
                        }
                    }
                }
            }

            this.updatingSettings = false;
        }

        return true;
    };

    private selectProfile(): void {
        if (this.activeProfile) {
            ShellInterface.users.listProfiles(this.activeProfile.userId).then((event: ICommListProfilesEvent) => {
                const items = event.data.result.map((profile) => {
                    return profile.name;
                });

                void window.showQuickPick(items, {
                    title: "Activate a Profile",
                    matchOnDescription: true,
                    placeHolder: "Type the name of an existing profile",
                }).then((name) => {
                    if (name) {
                        const row = event.data.result.find((candidate) => { return candidate.name === name; });
                        if (row) {
                            ShellInterface.users.setCurrentProfile(row.id).then(() => {
                                window.setStatusBarMessage("Profile set successfully", 5000);
                            });
                        }
                    }
                });
            });
        }
    }

    private taskPromptCallback = (text: string, isPassword: boolean): Promise<string | undefined> => {
        return new Promise((resolve) => {
            // Check if the text ends with "[yes/NO/...]: ".
            const match = text.match(/\[([\w\d\s/]+)\]:\s*?$/);
            if (match && match.length === 2 && match.index) {
                const buttons = match[1].split("/");

                // Ensure first char is uppercase.
                for (let i = 0; i < buttons.length; i++) {
                    buttons[i] = buttons[i].charAt(0).toUpperCase() + buttons[i].slice(1);
                }

                void window.showInformationMessage(text.substring(0, match.index) + "?", ...buttons).then((value) => {
                    resolve(value);
                });
            } else {
                void window.showInputBox({ title: text, password: isPassword }).then((value) => {
                    resolve(value);
                });
            }
        });
    };

    private taskMessageCallback = (message: unknown): void => {
        if (typeof message === "string") {
            taskOutputChannel.append(message);
        } else {
            taskOutputChannel.append(JSON.stringify(message));
        }
    };
}
