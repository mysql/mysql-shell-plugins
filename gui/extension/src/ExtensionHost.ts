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

import {
    ConfigurationChangeEvent, ConfigurationTarget, Disposable, ExtensionContext, StatusBarItem, WorkspaceConfiguration,
    commands, window, workspace, type StatusBarAlignment,
} from "vscode";

import { ShellTask } from "../../frontend/src/shell-tasks/ShellTask.js";
import { Settings } from "../../frontend/src/supplement/Settings/Settings.js";
import { ISettingCategory, settingCategories } from "../../frontend/src/supplement/Settings/SettingsRegistry.js";
import { DBType } from "../../frontend/src/supplement/ShellInterface/index.js";
import { webSession } from "../../frontend/src/supplement/WebSession.js";

import { printChannelOutput, taskOutputChannel } from "./extension.js";
import { ShellTasksTreeDataProvider } from "./tree-providers/ShellTreeProvider/ShellTasksTreeProvider.js";

import { ui } from "../../frontend/src/app-logic/UILayer.js";
import type { IShellModuleDataCategoriesEntry, IShellProfile } from "../../frontend/src/communication/ProtocolGui.js";
import {
    ConnectionDataModel, type ICdmConnectionEntry, type ICdmSchemaEntry,
} from "../../frontend/src/data-models/ConnectionDataModel.js";
import type {
    IEditorExtendedExecutionOptions, IRequestListEntry, IRequestTypeMap, IRequisitionCallbackValues,
    IUpdateStatusBarItem, IWebviewProvider,
} from "../../frontend/src/supplement/RequisitionTypes.js";
import { requisitions } from "../../frontend/src/supplement/Requisitions.js";
import { ShellInterface } from "../../frontend/src/supplement/ShellInterface/ShellInterface.js";
import { DBEditorCommandHandler } from "./DBEditorCommandHandler.js";
import { MDSCommandHandler } from "./MDSCommandHandler.js";
import { MRSCommandHandler } from "./MRSCommandHandler.js";
import { ShellConsoleCommandHandler } from "./ShellConsoleCommandHandler.js";
import { DBConnectionViewProvider } from "./WebviewProviders/DBConnectionViewProvider.js";
import { WebviewProvider } from "./WebviewProviders/WebviewProvider.js";
import { NodeMessageScheduler } from "./communication/NodeMessageScheduler.js";
import { NotebookEditorProvider } from "./editor-providers/NotebookEditorProvider.js";
import { ConnectionsTreeDataProvider } from "./tree-providers/ConnectionsTreeProvider/ConnectionsTreeProvider.js";
import { convertErrorToString } from "../../frontend/src/utilities/helpers.js";

/** This class manages some extension wide things like authentication handling etc. */
export class ExtensionHost {
    // The URL of the web session.
    private url?: URL;

    // All open DB editor view providers.
    private providers: DBConnectionViewProvider[] = [];
    private lastActiveProvider?: DBConnectionViewProvider;

    private activeProfile?: IShellProfile;
    private updatingSettings = false;

    private connectionsProvider: ConnectionsTreeDataProvider;

    private dbEditorCommandHandler: DBEditorCommandHandler;
    private shellConsoleCommandHandler = new ShellConsoleCommandHandler();
    private notebookProvider = new NotebookEditorProvider();
    private mrsCommandHandler: MRSCommandHandler;
    private mdsCommandHandler = new MDSCommandHandler();

    // Tree data providers for the extension's sidebar. The connection provider is managed in the DB editor
    // command handler.
    private shellTasksTreeDataProvider: ShellTasksTreeDataProvider;

    // List of shell tasks
    private shellTasks: ShellTask[] = [];

    // A mapping from data type captions to data type ids.
    private moduleDataCategories = new Map<string, IShellModuleDataCategoriesEntry>();

    #statusbarItems = new Map<string, [StatusBarItem, ReturnType<typeof setTimeout> | undefined]>();

    // Set when a status message was set, to allow disposing it before its timeout.
    #statusMessageDisposable?: Disposable;
    #connectionsDataModel: ConnectionDataModel;

    public constructor(public context: ExtensionContext) {
        this.#connectionsDataModel = new ConnectionDataModel();
        void this.#connectionsDataModel.initialize(); // Async init, but don't wait.

        this.connectionsProvider = new ConnectionsTreeDataProvider(this.#connectionsDataModel);
        this.dbEditorCommandHandler = new DBEditorCommandHandler(this.connectionsProvider);
        this.mrsCommandHandler = new MRSCommandHandler(this.connectionsProvider);

        this.setupEnvironment();

        requisitions.register("settingsChanged", this.updateVscodeSettings);
        requisitions.register("webSessionStarted", (data) => {
            webSession.sessionId = data.sessionUuid;
            webSession.localUserMode = data.localUserMode ?? false;

            if (webSession.userName === "") {
                if (webSession.localUserMode) {
                    ShellInterface.users.authenticate("LocalAdministrator", "").then((profile) => {
                        if (profile) {
                            void this.onAuthentication(profile);
                        }
                    }).catch((reason) => {
                        printChannelOutput("Internal error: " + String(reason), true);
                    });
                }
            } else {
                webSession.loadProfile(data.activeProfile);
                this.activeProfile = data.activeProfile;
            }

            return Promise.resolve(true);
        });

        requisitions.register("connectedToUrl", this.connectedToUrl);
        requisitions.register("proxyRequest", this.proxyRequest);
    }

    /**
     * Closes all webview tabs and frees their providers.
     */
    public closeAllTabs(): void {
        this.providers.forEach((provider) => {
            provider.close();
        });
        this.providers = [];
        this.dbEditorCommandHandler.clear();
        this.lastActiveProvider = undefined;

        this.shellConsoleCommandHandler.closeProviders();
    }

    public async addNewShellTask(caption: string, shellArgs: string[], dbConnectionId?: number,
        showOutputChannel = true, responses?: string[]): Promise<void> {
        const task = new ShellTask(caption, this.taskPromptCallback, this.taskMessageCallback);
        this.shellTasks.push(task);
        this.shellTasksTreeDataProvider.refresh();

        if (showOutputChannel) {
            taskOutputChannel.show();
        }

        await task.runTask(shellArgs, dbConnectionId, responses);
        this.shellTasksTreeDataProvider.refresh();
    }

    /**
     * Determines a connection to run SQL code with.
     *
     * @param dbType The DBType of the connection
     * @param forcePicker If true then always open the connection picker and ignore the default connection.
     * @param showErrorMessages If set to true, error messages are displayed, otherwise undefined is returned
     *
     * @returns A promise resolving to a connection entry or undefined if no entry was found.
     */
    public determineConnection = async (dbType?: DBType,
        forcePicker?: boolean, showErrorMessages = true): Promise<ICdmConnectionEntry | undefined> => {
        let connections = this.#connectionsDataModel.connections;

        let title = "Select a connection for SQL execution";
        if (!forcePicker) {
            const connectionName = workspace.getConfiguration("msg.editor").get<string>("defaultDbConnection");
            if (connectionName) {
                const connection = connections.find((candidate) => {
                    return candidate.details.caption === connectionName;
                });

                if (!connection) {
                    if (showErrorMessages) {
                        void ui.showErrorMessage(`The default Database Connection ${connectionName} is ` +
                            `not available anymore.`, {});
                    }
                } else if (dbType && connection.details.dbType !== dbType) {
                    if (showErrorMessages) {
                        void ui.showErrorMessage(`The default Database Connection ${connectionName} is a ` +
                            `${String(connection.details.dbType)} connection. This function requires a ` +
                            `${String(dbType)} connection.`, {});
                    }
                } else {
                    return connection;
                }

                title = "Select a connection for SQL execution";
            }
        }

        // If a specific dbType was specified, filter connections by that DBType
        if (dbType) {
            connections = connections.filter((conn) => {
                return conn.details.dbType === dbType;
            });
        }

        // Check if there is at least one connection
        if (connections.length === 0) {
            if (!showErrorMessages) {
                return undefined;
            }

            if (dbType) {
                void ui.showErrorMessage(`Please create a ${String(dbType)} Database Connection first.`, {});
            } else {
                void ui.showErrorMessage("Please create a Database Connection first.", {});
            }

            return undefined;
        }

        // No default connection set. Show a picker.
        const items = connections.map((connection) => {
            return connection.details.caption;
        });
        const name = await window.showQuickPick(items, {
            title,
            matchOnDescription: true,
            placeHolder: "Type the name of an existing DB connection",
        });

        const connection = connections.find((candidate) => {
            return candidate.details.caption === name;
        });

        return connection;
    };

    /**
     * Sends the given request to all currently open providers. The request is executed asynchronously and in parallel.
     * This method actually handles broadcast requests from the requisition hub.
     *
     * @param sender The origin of the request, in case it came from a provider. This provider will not receive the
     *               request.
     * @param requestType The type of the request to send.
     * @param parameter The request parameters to use for the request.
     *
     * @returns A promise resolving when all requests have been sent.
     */
    public broadcastRequest = async <K extends keyof IRequestTypeMap>(sender: IWebviewProvider | undefined,
        requestType: K, parameter: IRequisitionCallbackValues<K>): Promise<void> => {

        await Promise.all(this.providers.map((provider) => {
            if (sender === undefined || provider !== sender) {
                return provider.runCommand(requestType, parameter, "", false); // Skipping reveal.
            }

            return Promise.resolve();
        }));
    };

    public get currentProvider(): DBConnectionViewProvider | undefined {
        if (this.lastActiveProvider) {
            return this.lastActiveProvider;
        }

        if (this.providers.length > 0) {
            return this.providers[this.providers.length - 1];
        }

        return this.newProvider;
    }

    /**
     * Creates a new connection view provider, which will open a new webview tab in the editor.
     *
     * @returns A new provider or undefined if the extension is not connected to a server.
     */
    public get newProvider(): DBConnectionViewProvider | undefined {
        if (this.url) {
            const caption = this.dbEditorCommandHandler.generateNewProviderCaption();
            const provider = new DBConnectionViewProvider(this.url, this.providerDisposed, this.providerStateChanged);
            provider.caption = caption;
            this.providers.push(provider);

            this.dbEditorCommandHandler.providerOpened(provider);

            return provider;
        }

        return undefined;
    }

    /**
     * @returns True if the given connection id corresponds to a valid (and hence open) connection.
     *
     * @param connectionId The id of the connection to check.
     */
    public isValidConnectionId(connectionId: number): boolean {
        return this.#connectionsDataModel.isValidConnectionId(connectionId);
    }

    /**
     * Prepares all VS Code providers for first use.
     */
    private setupEnvironment(): void {
        // Access the node specific message scheduler once to create the correct version of it.
        void NodeMessageScheduler.get;

        // Register the extension host as target for broadcasts.
        requisitions.setRemoteTarget(this);

        this.dbEditorCommandHandler.setup(this);
        this.shellConsoleCommandHandler.setup(this);
        this.notebookProvider.setup(this);
        this.mrsCommandHandler.setup(this);
        this.mdsCommandHandler.setup(this);

        const updateLogLevel = (): void => {
            const configuration = workspace.getConfiguration(`msg.debugLog`);
            const level = configuration.get<string>("level", "INFO");

            void ShellInterface.core.setLogLevel(level).catch((error) => {
                const message = convertErrorToString(error);
                void ui.showErrorMessage(`Error while setting log level: ${message}`, {});
            });
        };
        updateLogLevel();

        this.context.subscriptions.push(workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
            if (event.affectsConfiguration("msg")) {
                updateLogLevel();
                this.updateProfileSettings(event);
            }
        }));

        // Our tree providers.
        this.shellTasksTreeDataProvider = new ShellTasksTreeDataProvider(this.shellTasks);
        this.context.subscriptions.push(window.registerTreeDataProvider("msg.shellTasks",
            this.shellTasksTreeDataProvider));

        // The scripts provider needs a module data category id and is created later, when this info is available.

        // Handling of extension commands.
        this.context.subscriptions.push(commands.registerCommand("msg.selectProfile", async () => {
            await this.selectProfile();
        }));

        this.context.subscriptions.push(commands.registerCommand("msg.dumpSchemaToDisk", (entry?: ICdmSchemaEntry) => {
            if (entry) {
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
                            entry.caption,
                            "--outputUrl",
                            targetUri[0].fsPath,
                        ];

                        void this.addNewShellTask(`Dump Schema ${entry.caption} to Disk`, shellArgs,
                            entry.connection.details.id).then(() => {
                                this.shellTasksTreeDataProvider.refresh();
                            });
                    }
                });
            }
        }));

        this.context.subscriptions.push(commands.registerCommand("msg.dumpSchemaToDiskForMds",
            (entry?: ICdmSchemaEntry) => {
                if (entry) {
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
                                entry.caption,
                                "--outputUrl",
                                targetUri[0].fsPath,
                                "--ocimds",
                                "true",
                                "--compatibility",
                                "create_invisible_pks,force_innodb,skip_invalid_accounts," +
                                "strip_definers,strip_restricted_grants,strip_tablespaces",
                            ];

                            void this.addNewShellTask(`Dump Schema ${entry.caption} to Disk`, shellArgs,
                                entry.connection.details.id).then(() => {
                                    this.shellTasksTreeDataProvider.refresh();
                                });
                        }
                    });
                }
            }));

        this.context.subscriptions.push(commands.registerCommand("msg.loadDumpFromDisk",
            (entry?: ICdmConnectionEntry) => {
                if (entry) {
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
                                entry.details.id)
                                .then(() => {
                                    this.shellTasksTreeDataProvider.refresh();
                                    void commands.executeCommand("msg.refreshConnections");
                                });
                        }
                    });
                }
            }));
    }

    private async onAuthentication(profile: IShellProfile): Promise<void> {
        this.activeProfile = profile;
        const categories = await ShellInterface.modules.listDataCategories();
        categories.forEach((row) => {
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
        await this.dbEditorCommandHandler.refreshConnectionTree();

        void commands.executeCommand("msg.mds.refreshOciProfiles");
    }

    /**
     * Triggered when the user changed a VS Code setting. Updates the current profile.
     *
     * @param event The configuration change event triggered by workspace.onDidChangeConfiguration.
     */
    private updateProfileSettings(event: ConfigurationChangeEvent): void {
        if (!this.updatingSettings) {
            this.updatingSettings = true;

            const processCategories = (categories?: ISettingCategory[], baseConfigKey = "msg"): void => {
                categories?.forEach(({ key, values, children }) => {
                    const fullKey = `${baseConfigKey}.${key}`;
                    const configuration = workspace.getConfiguration(fullKey);

                    values.forEach(({ id, key: valueKey }) => {
                        const configValue = configuration.get(valueKey);
                        if (event.affectsConfiguration(fullKey) && Settings.get(id) !== configValue) {
                            Settings.set(id, configValue);
                        }
                    });

                    processCategories(children, `${baseConfigKey}.${key}`);
                });
            };

            processCategories(settingCategories.children);

            Settings.saveSettings();

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
    private updateVscodeSettings = async (entry?: { key: string; value: unknown; }): Promise<boolean> => {
        if (!this.updatingSettings) {
            this.updatingSettings = true;
            if (entry) {
                const parts = entry.key.split(".");
                if (parts.length === 3) {
                    const configuration = workspace.getConfiguration(`msg.${parts[0]}`);
                    const currentValue = configuration.get(`${parts[1]}.${parts[2]}`);
                    if (currentValue !== entry.value) {
                        await configuration.update(`${parts[1]}.${parts[2]}`, entry.value, ConfigurationTarget.Global);
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
                                    const setting = Settings.get(value.id);
                                    const currentValue = configuration.get(`${child.key}.${value.key}`);
                                    if (setting !== currentValue) {
                                        await configuration.update(`${child.key}.${value.key}`, setting,
                                            ConfigurationTarget.Global);
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
                                const setting = Settings.get(value.id);
                                const currentValue = configuration.get(value.key);
                                if (setting !== currentValue) {
                                    await configuration.update(value.key, setting, ConfigurationTarget.Global);
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

    private async selectProfile(): Promise<void> {
        if (this.activeProfile) {
            const profiles = await ShellInterface.users.listProfiles(this.activeProfile.userId);
            const items = profiles.map((profile) => {
                return profile.name;
            });

            const name = await window.showQuickPick(items, {
                title: "Activate a Profile",
                matchOnDescription: true,
                placeHolder: "Type the name of an existing profile",
            });

            if (name) {
                const row = profiles.find((candidate) => {
                    return candidate.name === name;
                });

                if (row) {
                    await ShellInterface.users.setCurrentProfile(row.id);
                    window.setStatusBarMessage("Profile set successfully", 5000);
                }
            }
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

                void ui.showInformationMessage(text.substring(0, match.index), {}, ...buttons).then((value) => {
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

    private connectedToUrl = (url?: URL): Promise<boolean> => {
        this.url = url;
        this.closeAllTabs();

        return Promise.resolve(true);
    };

    private providerDisposed = (provider: WebviewProvider): void => {
        const index = this.providers.findIndex((candidate) => {
            return candidate === provider;
        });

        if (index > -1) {
            this.providers.splice(index, 1);
        }

        // When all providers are closed, remove the status bar items.
        if (this.providers.length === 0) {
            this.#statusbarItems.forEach((entry) => {
                entry[0].dispose();
            });
            this.#statusbarItems.clear();
        }

        if (this.lastActiveProvider === provider) {
            this.lastActiveProvider = undefined;
        }

        this.dbEditorCommandHandler.providerClosed(provider as DBConnectionViewProvider);
    };

    private providerStateChanged = (provider: WebviewProvider, active: boolean): void => {
        if (active) {
            this.lastActiveProvider = provider as DBConnectionViewProvider;
            this.lastActiveProvider.reselectLastDocument();
        }

        this.dbEditorCommandHandler.providerStateChanged(provider as DBConnectionViewProvider, active);
    };

    /**
     * Requests sent from one of the providers.
     *
     * @param request The request to handle.
     * @param request.provider The provider that sent the request.
     * @param request.original The original request.
     *
     * @returns A promise that resolves to true if the request was handled.
     */
    private proxyRequest = (request: {
        provider: IWebviewProvider;
        original: IRequestListEntry<keyof IRequestTypeMap>;
    }): Promise<boolean> => {
        switch (request.original.requestType) {
            case "updateStatusBarItem": {
                this.updateStatusBarItem(request.original.parameter as IUpdateStatusBarItem);

                return Promise.resolve(true);
            }

            case "showError": {
                void ui.showErrorMessage(request.original.parameter as string, {});

                return Promise.resolve(true);
            }

            case "showWarning": {
                void ui.showWarningMessage(request.original.parameter as string, {});

                return Promise.resolve(true);
            }

            case "showInfo": {
                void ui.showInformationMessage(request.original.parameter as string, {});

                return Promise.resolve(true);
            }

            case "connectionAdded":
            case "connectionUpdated":
            case "connectionRemoved":
            case "refreshConnection": {
                return new Promise((resolve) => {
                    void requisitions.broadcastRequest(request.provider, request.original.requestType,
                        request.original.parameter).then(() => {
                            resolve(true);
                        });
                });
            }

            case "editorExecuteOnHost": {
                const incoming = request.original.parameter as IEditorExtendedExecutionOptions;

                return new Promise((resolve) => {
                    void requisitions.broadcastRequest(request.provider, "editorRunCode", incoming).then(() => {
                        resolve(true);
                    });
                });
            }

            default:
        }

        return Promise.resolve(false);
    };

    /**
     * Creates, updates or removes a statusbar item.
     *
     * @param item The item to create or update.
     */
    private updateStatusBarItem = (item: IUpdateStatusBarItem): void => {
        switch (item.state) {
            case "show": {
                // Show the item or create it if it does not exist.
                if (item.id === "msg.fe.statusBarMessage") {
                    // This special id indicates a status message.
                    this.#statusMessageDisposable = window.setStatusBarMessage(item.text ?? "<text not set>",
                        item.timeout ?? 5000);
                } else {
                    const entry = this.#statusbarItems.get(item.id);
                    if (entry) {
                        if (entry[1]) {
                            clearTimeout(entry[1]);
                        }

                        if (item.text) {
                            entry[0].text = item.text;
                        }

                        if (item.tooltip) {
                            entry[0].tooltip = item.tooltip;
                        }

                        if (item.timeout) {
                            entry[1] = setTimeout(() => {
                                entry?.[0].dispose();
                                this.#statusbarItems.delete(item.id);
                            }, item.timeout);
                        }

                        this.#statusbarItems.set(item.id, entry);
                        entry[0].show();
                    } else {
                        // Have to create the item.
                        const newItem = window.createStatusBarItem(item.alignment as StatusBarAlignment, item.priority);
                        if (item.text) {
                            newItem.text = item.text;
                        }

                        if (item.tooltip) {
                            newItem.tooltip = item.tooltip;
                        }

                        let timeout;
                        if (item.timeout) {
                            timeout = setTimeout(() => {
                                newItem.dispose();
                                this.#statusbarItems.delete(item.id);
                            }, item.timeout);
                        }
                        this.#statusbarItems.set(item.id, [newItem, timeout]);
                    }
                }

                break;
            }

            case "hide": {
                if (item.id === "msg.fe.statusBarMessage") {
                    if (this.#statusMessageDisposable) {
                        this.#statusMessageDisposable.dispose();
                        this.#statusMessageDisposable = undefined;
                    }
                } else {
                    const entry = this.#statusbarItems.get(item.id);
                    if (entry) {
                        if (entry[1]) {
                            clearTimeout(entry[1]);
                            entry[1] = undefined;
                        }
                        entry[0].hide();
                    }
                }

                break;
            }

            case "keep": {
                // Change attributes, but keep the current state.
                const entry = this.#statusbarItems.get(item.id);
                if (entry) {
                    if (item.text) {
                        entry[0].text = item.text;
                    }

                    if (item.tooltip) {
                        entry[0].tooltip = item.tooltip;
                    }
                }
                break;
            }

            case "dispose": {
                if (item.id === "msg.fe.statusBarMessage") {
                    if (this.#statusMessageDisposable) {
                        this.#statusMessageDisposable.dispose();
                        this.#statusMessageDisposable = undefined;
                    }
                } else {
                    const entry = this.#statusbarItems.get(item.id);
                    if (entry) {
                        if (entry[1]) {
                            clearTimeout(entry[1]);
                            entry[1] = undefined;
                        }
                        entry[0].dispose();
                        this.#statusbarItems.delete(item.id);
                    }
                }

                break;
            }

            default:
        }
    };
}
