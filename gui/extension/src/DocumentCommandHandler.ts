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

import fs from "fs";
import * as os from "os";
import { basename } from "path";

import { commands, ConfigurationTarget, TextEditor, Uri, window, workspace } from "vscode";

import { requisitions } from "../../frontend/src/supplement/Requisitions.js";
import {
    ICodeBlockExecutionOptions, IRequestListEntry, IRequestTypeMap, IWebviewProvider, type IDocumentOpenData,
    type InitialEditor,
} from "../../frontend/src/supplement/RequisitionTypes.js";

import { EditorLanguage, INewEditorRequest, IScriptRequest } from "../../frontend/src/supplement/index.js";
import { DBConnectionViewProvider } from "./WebviewProviders/DBConnectionViewProvider.js";

import { ui } from "../../frontend/src/app-logic/UILayer.js";
import { IMrsDbObjectData } from "../../frontend/src/communication/ProtocolMrs.js";
import {
    cdbDbEntityTypeName, CdmEntityType, ConnectionDataModelEntry, ICdmConnectionEntry, ICdmEventEntry,
    ICdmRestDbObjectEntry, type ConnectionDataModelNoGroupEntry, type ICdmAdminPageEntry, type ICdmConnectionGroupEntry,
    type ICdmRoutineEntry, type ICdmLibraryEntry, type ICdmSchemaEntry, type ICdmSchemaGroupEntry, type ICdmTableEntry,
    type ICdmTriggerEntry, type ICdmViewEntry,
} from "../../frontend/src/data-models/ConnectionDataModel.js";
import {
    OdmEntityType, OpenDocumentDataModel, type IOdmConnectionPageEntry, type IOdmNotebookEntry, type IOdmScriptEntry,
    type IOdmShellSessionEntry, type OpenDocumentDataModelEntry,
} from "../../frontend/src/data-models/OpenDocumentDataModel.js";
import { ConnectionProcessor } from "../../frontend/src/modules/common/ConnectionProcessor.js";
import { MrsDbObjectType } from "../../frontend/src/modules/mrs/types.js";
import {
    DBType, IConnectionDetails, type IShellSessionDetails,
} from "../../frontend/src/supplement/ShellInterface/index.js";
import { ShellInterface } from "../../frontend/src/supplement/ShellInterface/ShellInterface.js";
import { ShellInterfaceSqlEditor } from "../../frontend/src/supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { webSession } from "../../frontend/src/supplement/WebSession.js";
import { getConnectionInfoFromDetails, uuid } from "../../frontend/src/utilities/helpers.js";
import { convertSnakeToCamelCase, formatWithNumber } from "../../frontend/src/utilities/string-helpers.js";
import { CodeBlocks } from "./CodeBlocks.js";
import { ExtensionHost } from "./ExtensionHost.js";
import {
    ConnectionsTreeDataProvider,
} from "./tree-providers/ConnectionsTreeProvider/ConnectionsTreeProvider.js";
import { ConnectionTreeItem } from "./tree-providers/ConnectionsTreeProvider/ConnectionTreeItem.js";
import { OciDbSystemTreeItem } from "./tree-providers/OCITreeProvider/OciDbSystemTreeItem.js";
import type { DocumentTreeBaseItem } from "./tree-providers/OpenEditorsTreeProvider/DocumentTreeBaseItem.js";
import {
    OpenEditorsTreeDataProvider,
} from "./tree-providers/OpenEditorsTreeProvider/OpenEditorsTreeProvider.js";
import { showMessageWithTimeout } from "./utilities.js";
import { WebviewProvider } from "./WebviewProviders/WebviewProvider.js";
import { LibraryDialogType } from "../../frontend/src/app-logic/general-types.js";
import { DialogWebviewManager } from "./WebviewProviders/DialogWebviewProvider.js";

const homeDir = os.homedir();

/** The platform specific paths for MySQL Workbench connection files. */
const defaultWbConnectionsFilePath = new Map<string, string>([
    ["win32", `${homeDir}/AppData/Roaming/MySQL/Workbench/connections.xml`],
    ["darwin", `${homeDir}/Library/Application Support/MySQL/Workbench/connections.xml`],
    ["linux", `${homeDir}/.mysql/workbench/connections.xml`],
]);

/** A class to handle all DB editor related commands and jobs. */
export class DocumentCommandHandler {
    static #dmTypeToMrsType = new Map<CdmEntityType, MrsDbObjectType>([
        [CdmEntityType.Table, MrsDbObjectType.Table],
        [CdmEntityType.View, MrsDbObjectType.View],
        [CdmEntityType.StoredFunction, MrsDbObjectType.Function],
        [CdmEntityType.StoredProcedure, MrsDbObjectType.Procedure],
    ]);

    private latestPagesByConnection: Map<number, string> = new Map();

    private isConnected = false;
    private host: ExtensionHost;

    private dialogManager = new DialogWebviewManager();

    private codeBlocks = new CodeBlocks();

    // For each open editor a list of open scripts is held (via a mapping of script IDs and their target URI).
    private openScripts = new Map<DBConnectionViewProvider, Map<string, Uri>>();

    private openEditorsTreeDataProvider: OpenEditorsTreeDataProvider;
    private connectionsProvider: ConnectionsTreeDataProvider;

    private initialDisplayOfOpenEditorsView = true;
    private displayDbConnectionOverviewWhenConnected = false;

    private openDocumentsModel = new OpenDocumentDataModel(false);

    // Set when the handler triggers a document selection, which causes the a bounce back from the web app
    // in which a document was selected. This flag is used to prevent the re-selection of the last selected item.
    private selectionInProgress = false;

    private lastUsedWbImportPath?: string;

    public constructor(connectionsProvider: ConnectionsTreeDataProvider) {
        this.connectionsProvider = connectionsProvider;
    }

    public setup(host: ExtensionHost): void {
        this.host = host;
        const context = host.context;

        this.codeBlocks.setup(context);
        const dbConnectionsTreeView = window.createTreeView("msg.connections", {
            treeDataProvider: this.connectionsProvider,
            showCollapseAll: true,
            canSelectMany: false,
        });
        context.subscriptions.push(dbConnectionsTreeView);

        // Register expand/collapse handlers
        dbConnectionsTreeView.onDidExpandElement((event) => {
            this.connectionsProvider.didExpandElement(event.element);
        });

        dbConnectionsTreeView.onDidCollapseElement((event) => {
            this.connectionsProvider.didCollapseElement(event.element);
        });

        this.openEditorsTreeDataProvider = new OpenEditorsTreeDataProvider(this.openDocumentsModel);
        const openEditorsTreeView = window.createTreeView(
            "msg.openEditors",
            {
                treeDataProvider: this.openEditorsTreeDataProvider,
                showCollapseAll: true,
                canSelectMany: false,
            });
        context.subscriptions.push(openEditorsTreeView);
        this.openEditorsTreeDataProvider.onSelect = (item: OpenDocumentDataModelEntry): void => {
            if (!this.selectionInProgress) {
                void openEditorsTreeView.reveal(item, { select: true, focus: false, expand: 3 });
            } else {
                this.selectionInProgress = false;
            }
        };

        // Display the DB Connection Overview together with the initial display of the OPEN EDITORS view
        openEditorsTreeView.onDidChangeVisibility((e) => {
            // Get the user setting for msg.startup.showDbConnectionsTab
            const showDbConnectionsTab = workspace.getConfiguration(`msg.startup`)
                .get<boolean>("showDbConnectionsTab", true);

            if (e.visible && this.initialDisplayOfOpenEditorsView && showDbConnectionsTab) {
                this.initialDisplayOfOpenEditorsView = false;

                // If the extension is already connected to the MySQL Shell websocket,
                // open the DB Connection Overview right away
                if (this.isConnected) {
                    void commands.executeCommand("msg.openDBBrowser");
                } else {
                    // Otherwise open the DB Connection Overview when connected
                    this.displayDbConnectionOverviewWhenConnected = true;
                }
            }
        });

        requisitions.register("connectedToUrl", this.connectedToUrl);
        requisitions.register("executeCodeBlock", this.executeCodeBlock);
        requisitions.register("proxyRequest", this.proxyRequest);

        context.subscriptions.push(commands.registerCommand("msg.refreshConnections", () => {
            void requisitions.execute("refreshConnection", undefined);
        }));

        const openConnection = (entry?: ICdmConnectionEntry, editor?: InitialEditor) => {
            if (entry) {
                // "Open connection" acts differently, depending on whether the same connection is already open or not.
                let provider;
                if (this.openDocumentsModel.isOpen(entry.details)) {
                    provider = this.host.newProvider;
                } else {
                    provider = this.host.currentProvider;
                }

                void provider?.show(entry.details, editor);
            }
        };

        context.subscriptions.push(commands.registerCommand("msg.importWorkbenchConnections", async () => {
            const defaultPath = this.lastUsedWbImportPath ?? defaultWbConnectionsFilePath.get(os.platform())
                ?? "";

            const value = await window.showOpenDialog({
                defaultUri: Uri.file(defaultPath),
                title: "Select the connection.xml file to import",
                openLabel: "Import Connections File",
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    XML: ["xml"],
                },
            });

            if (value && value.length === 1) {
                const uri = value[0];
                this.lastUsedWbImportPath = uri.fsPath;
                const content = (await workspace.fs.readFile(uri)).toString();
                await ConnectionProcessor.importMySQLWorkbenchConnections(content, this.connectionsProvider.dataModel);
                void requisitions.execute("refreshConnection", undefined);
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.openConnection", (entry?: ICdmConnectionEntry) => {
            openConnection(entry);
        }));

        context.subscriptions.push(commands.registerCommand("msg.openConnectionNotebook",
            (entry?: ICdmConnectionEntry) => {
                openConnection(entry, "notebook");
            }));

        context.subscriptions.push(commands.registerCommand("msg.openConnectionSqlScript",
            (entry?: ICdmConnectionEntry) => {
                openConnection(entry, "script");
            }));

        context.subscriptions.push(commands.registerCommand("msg.openConnectionNewTab",
            (entry?: ICdmConnectionEntry) => {
                if (entry) {
                    const provider = this.host.newProvider;
                    void provider?.show(entry.details);
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.openScriptWithConnection", async (uri?: Uri) => {
            if (!uri) {
                return;
            }

            const connection = await host.determineConnection(DBType.MySQL, true);
            if (connection) {
                const stat = await workspace.fs.stat(uri);

                if (stat.size >= 10000000) {
                    await ui.showInformationMessage(`The file "${uri.fsPath}" ` +
                        `is too large to edit it in a web view. Instead use the VS Code built-in editor.`, {});
                } else {
                    const content = (await workspace.fs.readFile(uri)).toString();
                    const provider = this.host.currentProvider;

                    if (provider) {
                        // We load only sql and mysql scripts here.
                        const language: EditorLanguage = "mysql";
                        const caption = basename(uri.fsPath);

                        const details = connection.details;
                        const request: IScriptRequest = {
                            id: uuid(),
                            caption,
                            content,
                            language,
                            connectionInfo: getConnectionInfoFromDetails(details),
                        };

                        let scripts = this.openScripts.get(provider);
                        if (!scripts) {
                            scripts = new Map();
                            this.openScripts.set(provider, scripts);
                        }
                        scripts.set(request.id, uri);

                        void provider.editScript(details.id, request);
                    }
                }
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.showTableData", (entry?: ICdmTableEntry) => {
            if (entry) {
                const provider = this.host.currentProvider;

                const configuration = workspace.getConfiguration(`msg.dbEditor`);
                const uppercaseKeywords = configuration.get("upperCaseKeywords", true);
                const select = uppercaseKeywords ? "SELECT" : "select";
                const from = uppercaseKeywords ? "FROM" : "from";

                const query = `${select} * ${from} \`${entry.schema}\`.\`${entry.caption}\``;
                const name = `${entry.schema}.${entry.caption} - Data`;

                const request: IScriptRequest = {
                    id: uuid(),
                    caption: name,
                    language: "mysql",
                    content: query,
                    connectionInfo: getConnectionInfoFromDetails(entry.connection.details),
                };

                void provider?.runScript(entry.connection.details.id, request);
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.selectTableRows", (entry?: ICdmTableEntry) => {
            if (entry) {
                const provider = this.host.currentProvider;

                const configuration = workspace.getConfiguration(`msg.dbEditor`);
                const uppercaseKeywords = configuration.get("upperCaseKeywords", true);
                const select = uppercaseKeywords ? "SELECT" : "select";
                const from = uppercaseKeywords ? "FROM" : "from";

                const query = `${select} * ${from} \`${entry.schema}\`.\`${entry.caption}\``;
                const connectionInfo = getConnectionInfoFromDetails(entry.connection.details);
                void provider?.runCode(connectionInfo, {
                    code: query,
                    language: "mysql",
                    linkId: -1,
                });
            }
        }));

        const showAdminPage = (provider: IWebviewProvider | undefined, _caption: string, page: ICdmAdminPageEntry) => {
            provider ??= this.host.currentProvider;
            if (provider instanceof DBConnectionViewProvider) {
                const connectionId = page.connection.details.id;

                const latestPageId = this.latestPagesByConnection.get(connectionId);
                const documents = this.openEditorsTreeDataProvider.findAdminDocument(provider,
                    connectionId, latestPageId);

                // Check the list of open admin pages for the type we want to open.
                const existing = documents.find((doc) => {
                    return doc.pageType === page.pageType;
                });

                const id = existing ? existing.id : uuid();
                const data: IDocumentOpenData = {
                    connection: page.connection.details,
                    documentDetails: {
                        id,
                        type: OdmEntityType.AdminPage,
                        pageType: page.pageType,
                        caption: page.caption,
                    },

                };
                void provider.showDocument(data);
            }
        };

        context.subscriptions.push(commands.registerCommand("msg.showServerStatus", showAdminPage));
        context.subscriptions.push(commands.registerCommand("msg.showClientConnections", showAdminPage));
        context.subscriptions.push(commands.registerCommand("msg.showPerformanceDashboard", showAdminPage));
        context.subscriptions.push(commands.registerCommand("msg.showLakehouseNavigator", showAdminPage));

        context.subscriptions.push(commands.registerCommand("msg.addConnection", () => {
            const provider = this.host.currentProvider;
            void provider?.addConnection();
        }));

        context.subscriptions.push(commands.registerCommand("msg.refreshConnection", (item?: ConnectionTreeItem) => {
            void requisitions.execute("refreshConnection", item?.dataModelEntry);
        }));

        context.subscriptions.push(commands.registerCommand("msg.removeConnection", (entry?: ICdmConnectionEntry) => {
            if (entry) {
                const provider = this.host.currentProvider;
                void provider?.removeConnection(entry.details);
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.editConnection", (entry?: ICdmConnectionEntry) => {
            if (entry) {
                const provider = this.host.currentProvider;
                void provider?.editConnection(entry.details);
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.duplicateConnection",
            (entry?: ICdmConnectionEntry) => {
                if (entry) {
                    const provider = this.host.currentProvider;
                    void provider?.duplicateConnection(entry.details);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.showSystemSchemasOnConnection",
            (entry?: ICdmConnectionEntry) => {
                if (entry) {
                    if (entry.type === CdmEntityType.Connection) {
                        entry.state.payload = { showSystemSchemas: true };

                        void requisitions.execute("refreshConnection", entry);
                    }
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.hideSystemSchemasOnConnection",
            (entry?: ICdmConnectionEntry) => {
                if (entry) {
                    if (entry.type === CdmEntityType.Connection) {
                        entry.state.payload = { showSystemSchemas: false };

                        void requisitions.execute("refreshConnection", entry);
                    }
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.openDBBrowser", (provider?: IWebviewProvider) => {
            provider ??= this.host.currentProvider;
            if (provider instanceof DBConnectionViewProvider) {
                void provider.show();
            } else {
                const provider = this.host.currentProvider;
                if (provider) {
                    void provider.show();
                }
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.makeCurrentSchema", (entry?: ICdmSchemaEntry) => {
            if (entry) {
                const provider = this.host.currentProvider;
                if (provider) {
                    void provider?.makeCurrentSchema(entry.connection.details, entry.caption).then((success) => {
                        if (success) {
                            this.connectionsProvider.makeCurrentSchema(entry);
                        }
                    });
                }
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.createProcedure",
            (entry?: ICdmSchemaGroupEntry<CdmEntityType.StoredProcedure>) => {
                if (entry) {
                    void this.addNewSqlScript(entry.connection.details, "msg.createProcedure",
                        entry.parent.caption, "New Procedure", "my_procedure");
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.createFunction",
            (entry?: ICdmSchemaGroupEntry<CdmEntityType.StoredFunction>) => {
                if (entry) {
                    void this.addNewSqlScript(entry.connection.details, "msg.createFunction",
                        entry.parent.caption, "New Function", "my_function");
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.createFunctionJs",
            (entry?: ICdmSchemaGroupEntry<CdmEntityType.StoredFunction>) => {
                if (entry) {
                    void this.addNewSqlScript(entry.connection.details, "msg.createFunctionJs",
                        entry.parent.caption, "New Function", "my_function");
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.createLibraryJs",
            (entry?: ICdmSchemaGroupEntry<CdmEntityType.Library>) => {
                if (entry) {
                    void this.addNewSqlScript(entry.connection.details, "msg.createLibraryJs",
                        entry.parent.caption, "New Library", "my_library");
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.createLibraryFrom",
            (entry?: ICdmLibraryEntry) => {
                if (entry) {
                    const connection = entry.parent.connection;
                    const connectionId = connection.details.id;
                    const provider = this.host.currentProvider;
                    const data = {
                        type: LibraryDialogType.CreateLibraryFrom,
                        id: "createLibraryDialog",
                        parameters: {},
                        values: { schemaName: entry.parent.caption },
                    };
                    if (provider) {
                        void provider.runCommand("job", [
                            { requestType: "showPage", parameter: { connectionId } },
                            { requestType: "showCreateLibraryDialog", parameter: data },
                        ], "newConnection");
                    }

                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.createProcedureJs",
            (entry?: ICdmSchemaGroupEntry<CdmEntityType.StoredProcedure>) => {
                if (entry) {
                    void this.addNewSqlScript(entry.connection.details, "msg.createProcedureJs",
                        entry.parent.caption, "New Procedure", "my_procedure");
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.editRoutine", async (entry?: ICdmRoutineEntry) => {
            if (entry) {
                const entryType = entry.type === CdmEntityType.StoredFunction ? "function" : "procedure";
                const sql = await this.connectionsProvider.getCreateSqlScript(entry, entryType, true, true, true);

                void this.addNewSqlScript(entry.connection.details, "msg.editRoutine",
                    entry.parent.caption, "Edit Routine", sql);
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.editLibrary", async (entry?: ICdmLibraryEntry) => {
            if (entry) {
                const entryType = "library";
                const sql = await this.connectionsProvider.getCreateSqlScript(entry, entryType, true, true);

                void this.addNewSqlScript(entry.connection.details, "msg.editLibrary",
                    entry.parent.caption, "Edit Library", sql);
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.dropSchema", (entry?: ICdmSchemaEntry) => {
            if (entry) {
                this.connectionsProvider.dropItem(entry);
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.dropTable", (entry?: ICdmTableEntry) => {
            if (entry) {
                this.connectionsProvider.dropItem(entry);
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.dropView", (entry?: ICdmViewEntry) => {
            if (entry) {
                this.connectionsProvider.dropItem(entry);
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.dropRoutine", (entry?: ICdmRoutineEntry) => {
            if (entry) {
                this.connectionsProvider.dropItem(entry);
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.dropLibrary", (entry?: ICdmRoutineEntry) => {
            if (entry) {
                this.connectionsProvider.dropItem(entry);
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.dropTrigger", (entry?: ICdmTriggerEntry) => {
            if (entry) {
                this.connectionsProvider.dropItem(entry);
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.dropEvent", (entry?: ICdmEventEntry) => {
            if (entry) {
                this.connectionsProvider.dropItem(entry);
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.defaultConnection",
            (entry?: ICdmConnectionEntry) => {
                if (entry) {
                    const configuration = workspace.getConfiguration(`msg.editor`);
                    void configuration.update("defaultDbConnection", entry.details.caption,
                        ConfigurationTarget.Global).then(() => {
                            void ui.showInformationMessage(`"${entry.caption}" has been set as default DB Connection.`,
                                {});
                        });
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.copyNameToClipboard",
            (entry?: ConnectionDataModelEntry) => {
                if (entry) {
                    this.connectionsProvider.copyNameToClipboard(entry);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.copyCreateScriptToClipboard",
            (entry?: ConnectionDataModelNoGroupEntry) => {
                if (entry) {
                    const typeName = cdbDbEntityTypeName.get(entry.type)!;
                    void this.connectionsProvider.copyCreateScriptToClipboard(entry, typeName);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.copyCreateScriptWithDelimitersToClipboard",
            (entry?: ConnectionDataModelNoGroupEntry) => {
                if (entry) {
                    const typeName = cdbDbEntityTypeName.get(entry.type)!;
                    void this.connectionsProvider.copyCreateScriptToClipboard(entry, typeName, true);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.copyDropCreateScriptWithDelimitersToClipboard",
            (entry?: ConnectionDataModelNoGroupEntry) => {
                if (entry) {
                    const typeName = cdbDbEntityTypeName.get(entry.type)!;
                    void this.connectionsProvider.copyCreateScriptToClipboard(entry, typeName, true, true);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.editInScriptEditor", async (uri?: Uri) => {
            if (uri?.scheme === "file") {
                if (!fs.existsSync(uri.fsPath)) {
                    void ui.showErrorMessage(`The file ${uri.fsPath} could not be found.`, {});
                } else {
                    const stat = await workspace.fs.stat(uri);

                    if (stat.size >= 10000000) {
                        await ui.showInformationMessage(`The file "${uri.fsPath}" is too large to edit it in a web ` +
                            `view. Instead use the VS Code built-in editor.`, {});
                    } else {
                        const connection = await host.determineConnection();
                        if (connection) {
                            await workspace.fs.readFile(uri).then((value) => {
                                const content = value.toString();
                                const provider = this.host.currentProvider;

                                if (provider) {
                                    const name = basename(uri.fsPath);
                                    const details: IScriptRequest = {
                                        id: uuid(),
                                        caption: name,
                                        language: this.languageFromConnection(connection),
                                        content,
                                        connectionInfo: getConnectionInfoFromDetails(connection.details),
                                    };

                                    let scripts = this.openScripts.get(provider);
                                    if (!scripts) {
                                        scripts = new Map();
                                        this.openScripts.set(provider, scripts);
                                    }
                                    scripts.set(details.id, uri);

                                    void provider.editScript(connection.details.id, details);
                                }
                            });
                        }
                    }
                }
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.loadScriptFromDisk", (
            entry?: ICdmConnectionEntry) => {
            if (entry) {
                void window.showOpenDialog({
                    title: "Select the script file to load to MySQL Shell",
                    openLabel: "Select Script File",
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    filters: {
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        SQL: ["sql", "mysql"], TypeScript: ["ts"], JavaScript: ["js"],
                    },
                }).then(async (value) => {
                    if (value && value.length === 1) {
                        const uri = value[0];
                        const stat = await workspace.fs.stat(uri);

                        if (stat.size >= 10000000) {
                            await ui.showInformationMessage(`The file "${uri.fsPath}" is too large to edit it in a ` +
                                `web view. Instead use the VS Code built-in editor.`, {});
                        } else {
                            await workspace.fs.readFile(uri).then((value) => {
                                const content = value.toString();
                                const provider = this.host.currentProvider;

                                if (provider) {
                                    let language: EditorLanguage = "mysql";
                                    const name = basename(uri.fsPath);
                                    const ext = name.substring(name.lastIndexOf(".") ?? 0);
                                    switch (ext) {
                                        case ".ts": {
                                            language = "typescript";
                                            break;
                                        }

                                        case ".js": {
                                            language = "javascript";
                                            break;
                                        }

                                        case ".sql": {
                                            if (entry.details.dbType === DBType.Sqlite) {
                                                language = "sql";
                                            }

                                            break;
                                        }

                                        default:
                                    }

                                    const details: IScriptRequest = {
                                        id: uuid(),
                                        caption: name,
                                        language,
                                        content,
                                        connectionInfo: getConnectionInfoFromDetails(entry.details),
                                    };

                                    let scripts = this.openScripts.get(provider);
                                    if (!scripts) {
                                        scripts = new Map();
                                        this.openScripts.set(provider, scripts);
                                    }
                                    scripts.set(details.id, uri);

                                    void provider.editScript(entry.details.id, details);
                                }
                            });
                        }
                    }
                });
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.addSubFolder",
            async (entry: ICdmConnectionGroupEntry) => {
                let name = await window.showInputBox({
                    title: `Add subfolder in Folder \`${entry.caption}\``,
                    placeHolder: "Sub folder",
                    prompt: "Enter the name of the new folder:",
                    value: "",
                });

                if (name === undefined) {
                    return;
                }

                if (name === "") {
                    name = "Sub folder";
                }

                await ShellInterface.dbConnections.addFolderPath(webSession.currentProfileId, name,
                    entry.folderPath.id);
                await entry.refresh?.();
                void requisitions.executeRemote("refreshConnectionGroup", entry.folderPath);
            }));

        context.subscriptions.push(commands.registerCommand("msg.editFolder",
            async (entry: ICdmConnectionGroupEntry) => {
                const name = await window.showInputBox({
                    title: `Edit Folder`,
                    prompt: "Enter the new name of the folder:",
                    value: entry.caption,
                });

                if (!name) {
                    return;
                }

                await ShellInterface.dbConnections.renameFolderPath(entry.folderPath.id, name);

                // TODO: for now we have to update the parent folder, to get the new name. A new API should be created
                // to get the new name of the folder directly.
                await entry.parent?.refresh?.();
                void requisitions.executeRemote("refreshConnectionGroup", entry.parent?.folderPath);
            }));

        context.subscriptions.push(commands.registerCommand("msg.removeFolder",
            async (entry: ICdmConnectionGroupEntry) => {
                // Count how many connections and subfolders are in the folder. The group entry is returned
                // in the list too.
                await entry?.refresh?.();
                const flatList = await this.connectionsProvider.dataModel.flattenGroupList(entry);

                let description: string[] = [];
                let prompt = `Are you sure you want to remove the folder "${entry?.caption}", including all its ` +
                    `contents? This operation cannot be reverted!`;
                if (flatList.connections.length === 0 &&
                    flatList.groups.length === 1) { // Only the group entry is in the list.
                    prompt = `The folder "${entry?.caption}" is empty. Do you want to remove it?`;
                } else {
                    let groupString = "";
                    if (flatList.groups.length > 1) {
                        groupString = formatWithNumber("subfolder", flatList.groups.length - 1);
                    }

                    let connectionString = "";
                    if (flatList.connections.length > 0) {
                        connectionString = formatWithNumber("connection", flatList.connections.length);
                    }

                    if (groupString && connectionString) {
                        description = [`The folder contains ${groupString} and ` +
                            `${connectionString}.`];
                    } else if (groupString) {
                        description = [`The folder contains ${groupString}.`];
                    } else {
                        description = [`The folder contains ${connectionString}.`];
                    }
                }

                description.unshift("");
                description.unshift(prompt);
                const answer = await ui.confirm(description.join("\n"), "Delete Folder");
                if (answer === "Delete Folder") {
                    for (const connection of flatList.connections.reverse()) {
                        await this.connectionsProvider.dataModel.dropItem(connection);
                        await this.connectionsProvider.dataModel.removeEntry(connection);
                    }

                    for (const group of flatList.groups.reverse()) {
                        await this.connectionsProvider.dataModel.dropItem(group);
                        await this.connectionsProvider.dataModel.removeEntry(group);
                    }

                    void ui.showInformationMessage(`The connection group ` +
                        `"${entry?.caption}" has been deleted.`, {});

                    await entry.parent?.refresh?.();
                    void requisitions.executeRemote("refreshConnectionGroup", entry.parent?.folderPath);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.selectDocument",
            (item?: DocumentTreeBaseItem<OpenDocumentDataModelEntry>) => {
                if (item) {
                    const dataModelEntry = item.dataModelEntry;
                    let provider;
                    let connectionId: number | undefined;
                    let pageId: string | undefined;

                    switch (dataModelEntry.type) {
                        case OdmEntityType.Script:
                        case OdmEntityType.Notebook:
                        case OdmEntityType.AdminPage: {
                            provider = dataModelEntry.parent?.parent?.provider as DBConnectionViewProvider;
                            connectionId = dataModelEntry.parent!.details.id;
                            pageId = dataModelEntry.parent?.id;

                            break;
                        }

                        case OdmEntityType.ConnectionPage: {
                            provider = dataModelEntry.parent?.provider as DBConnectionViewProvider;
                            connectionId = dataModelEntry.details.id;
                            pageId = dataModelEntry.id;

                            break;
                        }

                        case OdmEntityType.Overview: {
                            provider = this.host.currentProvider;
                            break;
                        }

                        case OdmEntityType.AppProvider: {
                            provider = dataModelEntry.provider as DBConnectionViewProvider;

                            // Selecting a provider entry means to select the web view tab.
                            void provider?.reveal();

                            return;
                        }

                        case OdmEntityType.ShellSessionRoot: {
                            provider = dataModelEntry.parent?.provider as DBConnectionViewProvider;
                            void provider?.reveal();

                            return;
                        }

                        case OdmEntityType.ShellSession: {
                            provider = dataModelEntry.parent?.parent?.provider as DBConnectionViewProvider;

                            break;
                        }

                        default:
                    }

                    if (provider) {
                        this.selectionInProgress = true;
                        void provider.selectDocument(dataModelEntry.id, connectionId, pageId);
                    }
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mds.createConnectionViaBastionService",
            (item?: OciDbSystemTreeItem) => {
                if (item) {
                    const provider = this.host.currentProvider;
                    void provider?.addConnection(item.dbSystem, item.profile.profile);
                }
            }));

        context.subscriptions.push(commands.registerTextEditorCommand("msg.executeEmbeddedSqlFromEditor",
            (editor?: TextEditor) => {
                if (editor) {
                    void host.determineConnection().then((connection) => {
                        if (connection) {
                            this.codeBlocks.executeSqlFromEditor(editor, connection.details.caption,
                                connection.details);
                        }
                    });
                }
            }));

        context.subscriptions.push(commands.registerTextEditorCommand("msg.executeSelectedSqlFromEditor",
            (editor?: TextEditor) => {
                if (editor) {
                    void host.determineConnection().then((connection) => {
                        if (connection) {
                            const provider = this.host.currentProvider;
                            if (provider) {
                                const sql = this.getSql(editor);

                                return provider.runScript(connection.details.id, {
                                    id: uuid(),
                                    language: this.languageFromConnection(connection),
                                    caption: "Selected SQL",
                                    content: sql,
                                    connectionInfo: getConnectionInfoFromDetails(connection.details),
                                });
                            }
                        }
                    });
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.closeEditor", (
            entry?: IOdmNotebookEntry | IOdmScriptEntry) => {
            if (entry?.parent) {
                const provider = entry.parent.parent?.provider;
                const connection = entry.parent;
                if (provider instanceof DBConnectionViewProvider) {
                    void provider.closeEditor(connection.details.id, entry.id, entry.parent.id);
                }
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.newNotebookMysql",
            (entry?: IOdmConnectionPageEntry) => {
                void this.createNewEditor({ entry, language: "msg" });
            }));

        context.subscriptions.push(commands.registerCommand("msg.newNotebookSqlite",
            (entry?: IOdmConnectionPageEntry) => {
                void this.createNewEditor({ entry, language: "msg" });
            }));

        context.subscriptions.push(commands.registerCommand("msg.newScriptJs", (entry?: IOdmConnectionPageEntry) => {
            void this.createNewEditor({ entry, language: "javascript" });
        }));

        context.subscriptions.push(commands.registerCommand("msg.newScriptMysql", (entry?: IOdmConnectionPageEntry) => {
            void this.createNewEditor({ entry, language: "mysql" });
        }));

        context.subscriptions.push(commands.registerCommand("msg.newScriptSqlite",
            (entry?: IOdmConnectionPageEntry) => {
                void this.createNewEditor({ entry, language: "sql" });
            }));

        context.subscriptions.push(commands.registerCommand("msg.newScriptTs", (entry?: IOdmConnectionPageEntry) => {
            void this.createNewEditor({ entry, language: "typescript" });
        }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.addDbObject", (
            entry?: ICdmTableEntry | ICdmViewEntry | ICdmRoutineEntry) => {
            if (entry) {
                const connection = entry.parent.parent.parent;
                if (entry.type === CdmEntityType.Table || entry.type === CdmEntityType.View
                    || entry.type === CdmEntityType.StoredFunction || entry.type === CdmEntityType.StoredProcedure) {
                    // First, create a new temporary dbObject, then call the DbObject dialog
                    this.createNewDbObject(connection.backend, entry).then((dbObject) => {
                        const provider = this.host.currentProvider;
                        void provider?.editMrsDbObject(connection.details,
                            { dbObject, createObject: true });
                    }).catch((reason) => {
                        void ui.showErrorMessage(`${String(reason)}`, {});
                    });
                } else {
                    void ui.showErrorMessage(`The database object type '${entry.caption}' is not supported at ` +
                        `this time`, {});
                }
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.editDbObject", (entry?: ICdmRestDbObjectEntry) => {
            if (entry) {
                const provider = this.host.currentProvider;
                const connection = entry.parent.parent.parent.parent;
                void provider?.editMrsDbObject(connection.details,
                    { dbObject: entry.details, createObject: false });
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.newSession", () => {
            const provider = this.host.currentProvider;
            void provider?.openSession({ sessionId: uuid() });
        }));

        context.subscriptions.push(commands.registerCommand("msg.openSession", (details: IShellSessionDetails) => {
            const provider = this.host.currentProvider;
            void provider?.openSession(details);
        }));

        context.subscriptions.push(commands.registerCommand("msg.newSessionUsingConnection",
            (entry: ICdmConnectionEntry | IOdmConnectionPageEntry) => {
                const provider = this.host.currentProvider;

                const caption = entry.type === CdmEntityType.Connection ? entry.details.caption : entry.caption;
                const dbConnectionId = entry.details.id;

                const details: IShellSessionDetails = {
                    sessionId: uuid(),
                    caption,
                    dbConnectionId,
                };
                void provider?.openSession(details);
            }));

        context.subscriptions.push(commands.registerCommand("msg.removeSession", (entry: IOdmShellSessionEntry) => {
            const provider = entry.parent?.parent?.provider;
            if (provider instanceof DBConnectionViewProvider) {
                void provider.removeSession(entry.details);
            }
        }));

    }

    public async addNewSqlScript(details: IConnectionDetails, command: string, schemaName: string,
        scriptName: string, placeHolder: string): Promise<void> {

        let name: string | undefined = "";
        let sql = "";
        // If the commands is a create command, get the name of the new routine
        if (command.startsWith("msg.create")) {
            if (command.startsWith("msg.createLibraryJs")) {
                name = await window.showInputBox({
                    title: `New Library on Schema \`${schemaName}\``,
                    placeHolder,
                    prompt: "Please enter a name for the new library:",
                    value: "",
                });
            } else {
                name = await window.showInputBox({
                    title: `New Routine on Schema \`${schemaName}\``,
                    placeHolder,
                    prompt: "Please enter a name for the new routine:",
                    value: "",
                });
            }

            if (name === undefined) {
                return;
            }

            if (name === "") {
                name = placeHolder;
            }
        }

        switch (command) {
            case "msg.createProcedure": {
                sql = `DELIMITER %%\nDROP PROCEDURE IF EXISTS \`${schemaName}\`.\`${name}\`%%\n`
                    + `/* Add or remove procedure IN/OUT/INOUT parameters as needed. */\n`
                    + `CREATE PROCEDURE \`${schemaName}\`.\`${name}\`(IN arg1 INTEGER, OUT arg2 INTEGER)\n`
                    + `SQL SECURITY DEFINER\nNOT DETERMINISTIC\nBEGIN\n`
                    + `    /* Insert the procedure code here. */\n    SET arg2 = arg1 * 2;\n`
                    + `END%%\nDELIMITER ;\n\n`
                    + `CALL \`${schemaName}\`.\`${name}\`(1, @arg2);\nSELECT @arg2;`;
                break;
            }

            case "msg.createFunction": {
                sql = `DELIMITER %%\nDROP FUNCTION IF EXISTS \`${schemaName}\`.\`${name}\`%%\n`
                    + `/* Add or remove function parameters as needed. */\n`
                    + `CREATE FUNCTION \`${schemaName}\`.\`${name}\`(arg1 INTEGER)\nRETURNS INTEGER\n`
                    + `SQL SECURITY DEFINER\nDETERMINISTIC\nBEGIN\n`
                    + `    /* Insert the function code here. */\n    return arg1;\nEND%%\nDELIMITER ;`
                    + `\n\nSELECT \`${schemaName}\`.\`${name}\`(1);`;
                break;
            }

            case "msg.createFunctionJs": {
                sql = `DROP FUNCTION IF EXISTS \`${schemaName}\`.\`${name}\`;\n`
                    + `/* Add or remove function parameters as needed. */\n`
                    + `CREATE FUNCTION \`${schemaName}\`.\`${name}\`(arg1 INTEGER)\n`
                    + `RETURNS INTEGER\n`
                    + `/* USING (\`${schemaName}\`.\`library1\` AS lib1, \`other_schema\`.\`library2\` AS lib2) */\n`
                    + `SQL SECURITY DEFINER\n`
                    + `DETERMINISTIC LANGUAGE JAVASCRIPT\nAS $$\n`
                    + `    /* Insert the function code here. */\n`
                    + `    console.log("Hello World!");\n`
                    + `    console.log('{"info": "This is Javascript"}');\n`
                    + `    /* console.log("Imported function: ", lib1.f()); */\n`
                    + `    /* throw("Custom Error"); */\n`
                    + `    return arg1;\n`
                    + `$$;\n`
                    + `SELECT \`${schemaName}\`.\`${name}\`(1);`;
                break;
            }

            case "msg.createLibraryJs": {
                sql = `DROP LIBRARY IF EXISTS \`${schemaName}\`.\`${name}\`;\n`
                    + `CREATE LIBRARY \`${schemaName}\`.\`${name}\`\n`
                    + `LANGUAGE JAVASCRIPT\nAS $$\n`
                    + `    /* Insert the library code here. */\n`
                    + `    export function f(x) {\n`
                    + `        return x + 1;\n`
                    + `    }\n`
                    + `    export class MyRectangle {\n`
                    + `        /* your class implementation */\n`
                    + `    }\n`
                    + `    export const myConst = 7;\n`
                    + `$$;\n`;
                break;
            }

            case "msg.createProcedureJs": {
                sql = `DROP PROCEDURE IF EXISTS \`${schemaName}\`.\`${name}\`;\n`
                    + `/* Add or remove procedure parameters as needed. */\n`
                    + `CREATE PROCEDURE \`${schemaName}\`.\`${name}\`(IN arg1 INTEGER, OUT arg2 INTEGER)\n`
                    + `/* USING (\`${schemaName}\`.\`library1\` AS lib1, \`other_schema\`.\`library2\` AS lib2) */\n`
                    + `DETERMINISTIC LANGUAGE JAVASCRIPT\nAS $$\n`
                    + `    /* Insert the procedure code here. */\n`
                    + `    console.log("Hello World!");\n`
                    + `    const sql_query = session.prepare('SELECT ?');\n`
                    + `    const query_result = sql_query.bind(arg1).execute().fetchOne();\n`
                    + `    arg2 = query_result[0];\n`
                    + `    /* console.log("Imported function: ", lib1.f()); */\n`
                    + `$$;\n`
                    + `CALL\`${schemaName}\`.\`${name}\`(42, @out);\n`
                    + `SELECT @out;`;
                break;
            }

            case "msg.editRoutine": {
                sql = placeHolder;
                break;
            }

            case "msg.editLibrary": {
                sql = placeHolder;
                break;
            }

            default:
        }

        const provider = this.host.currentProvider ?? this.host.newProvider;
        if (provider) {
            const { id: connectionId } = details;
            this.createNewScriptEditor(
                provider, scriptName, sql, "mysql", connectionId, undefined, undefined, details,
            );
        }
    }

    /**
     * Triggered on authentication, which means existing connections are no longer valid.
     */
    public async refreshConnectionTree(): Promise<void> {
        await this.connectionsProvider.closeAllConnections();
        this.connectionsProvider.refresh();
    }

    public clear(): void {
        this.openEditorsTreeDataProvider.clear();
    }

    /**
     * Called when a new DB tree provider is opened (a new web app tab).
     *
     * @param provider The provider that was opened.
     */
    public providerOpened(provider: DBConnectionViewProvider): void {
        // Register the new provider with our data model.
        this.openDocumentsModel.openProvider(provider);
        this.openEditorsTreeDataProvider.refresh();
    }

    public providerClosed(provider: DBConnectionViewProvider): void {
        this.openDocumentsModel.closeProvider(provider);
        this.openScripts.delete(provider);
        this.openEditorsTreeDataProvider.refresh();
        if (this.openEditorsTreeDataProvider.clear(provider)) {
            // No provider remained open. Reset the current schemas.
            this.connectionsProvider.resetCurrentSchemas();
        }
    }

    /**
     * Helper to create a unique caption for a new provider.
     *
     * @returns The new caption.
     */
    public generateNewProviderCaption(): string {
        return this.openDocumentsModel.createUniqueCaption();
    }

    public providerStateChanged(provider: DBConnectionViewProvider, active: boolean): void {
        this.connectionsProvider.providerStateChanged(provider, active);
    }

    private createNewDbObject = async (backend: ShellInterfaceSqlEditor,
        entry: ICdmTableEntry | ICdmViewEntry | ICdmRoutineEntry): Promise<IMrsDbObjectData> => {

        const dbObject: IMrsDbObjectData = {
            comments: "",
            crudOperations: (entry.type === CdmEntityType.StoredProcedure) ? ["UPDATE"] : ["READ"],
            crudOperationFormat: "FEED",
            dbSchemaId: "",
            enabled: 1,
            id: "",
            name: entry.caption,
            objectType: DocumentCommandHandler.#dmTypeToMrsType.get(entry.type)!,
            requestPath: `/${convertSnakeToCamelCase(entry.caption)}`,
            requiresAuth: 1,
            rowUserOwnershipEnforced: 0,
            serviceId: "",
            autoDetectMediaType: 0,
        };

        const services = await backend.mrs.listServices();
        let service;
        if (services.length === 1) {
            service = services[0];
        } else if (services.length > 1) {
            // Lookup default service
            service = services.find((service) => {
                return service.isCurrent;
            });

            if (!service) {
                // No default connection set. Show a picker.
                const items = services.map((s) => {
                    return s.urlContextRoot;
                });

                const name = await window.showQuickPick(items, {
                    title: "Select a connection for SQL execution",
                    matchOnDescription: true,
                    placeHolder: "Type the name of an existing DB connection",
                });

                if (name) {
                    service = services.find((candidate) => {
                        return candidate.urlContextRoot === name;
                    });
                }

            }
        }

        if (service) {
            const schemas = await backend.mrs.listSchemas(service.id);
            const schema = schemas.find((schema) => {
                return schema.name === entry.schema;
            });

            // Check if the DbObject's schema is already exposed as an MRS schema
            dbObject.schemaName = entry.schema;
            if (schema) {
                dbObject.dbSchemaId = schema.id;
            } else {
                const answer = await ui.showInformationMessage(
                    `The database schema ${entry.schema} has not been added to the REST Service. Do you want to add ` +
                    "the schema now?", {}, "Yes", "No");
                if (answer === "Yes") {
                    dbObject.dbSchemaId = await backend.mrs.addSchema(service.id, entry.schema, 1,
                        `/${convertSnakeToCamelCase(entry.schema)}`, false, null, null, undefined);

                    void commands.executeCommand("msg.refreshConnections");
                    showMessageWithTimeout(`The MRS schema ${entry.schema} has been added successfully.`, 5000);
                } else {
                    throw new Error("Operation cancelled.");
                }
            }
        } else {
            if (services.length === 0) {
                throw new Error("Please create a REST Service before adding DB Objects.");
            } else {
                throw new Error("No REST Service selected.");
            }
        }

        return dbObject;
    };

    private connectedToUrl = (url?: URL): Promise<boolean> => {
        this.isConnected = url !== undefined;

        if (this.displayDbConnectionOverviewWhenConnected) {
            this.displayDbConnectionOverviewWhenConnected = false;
            void commands.executeCommand("msg.openDBBrowser");
        }

        return Promise.resolve(true);
    };

    /**
     * Triggered from CodeBlocks when an embedded query must be executed.
     *
     * @param details The request to send to the app.
     *
     * @returns A promise returning a flag whether the task was successfully executed or not.
     */
    private executeCodeBlock = (details: ICodeBlockExecutionOptions): Promise<boolean> => {
        const provider = this.host.currentProvider;
        if (provider) {
            return provider.runCode(details.connectionInfo, {
                linkId: details.linkId,
                code: details.query,
                language: "mysql",
            });
        }

        return Promise.resolve(false);
    };

    private editorLoadScript = (details: IScriptRequest): Promise<boolean> => {
        // The user has to select a target file.
        const filters: { [key: string]: string[]; } = {};

        switch (details.language) {
            case "mysql": {
                filters.SQL = ["mysql", "sql"];
                break;
            }

            case "sql": {
                filters.SQL = ["sql"];
                break;
            }

            case "typescript": {
                filters.TypeScript = ["ts"];
                break;
            }

            case "javascript": {
                filters.JavaScript = ["js"];
                break;
            }

            default:
        }

        void window.showOpenDialog({
            title: "Load Script File",
            filters,
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
        }).then((list: Uri[]) => {
            if (list.length > 0) {
                void workspace.fs.readFile(list[0]).then((content) => {
                    const provider = this.host.currentProvider;
                    if (provider) {
                        const scripts = this.openScripts.get(provider);
                        if (scripts) {
                            scripts.set(details.id, list[0]);
                            const newName = basename(list[0].fsPath);

                            void provider.renameFile({
                                ...details,
                                caption: newName,
                            });

                            void requisitions.execute("editorSaved",
                                { id: details.id, newName, saved: false });
                        }

                        details.content = content.toString();
                        const connectionId = this.openEditorsTreeDataProvider.currentConnectionId(provider) ?? -1;

                        void provider.loadScript(connectionId, details);
                    }
                });

            }
        });

        return Promise.resolve(true);
    };

    private editorSaveScript = (details: IScriptRequest): Promise<boolean> => {
        const provider = this.host.currentProvider;
        if (provider) {
            const scripts = this.openScripts.get(provider);
            if (scripts) {
                const uri = scripts.get(details.id);
                if (uri) {
                    if (uri.scheme === "untitled") {
                        // The user has to select a target file.
                        const filters: { [key: string]: string[]; } = {};

                        switch (details.language) {
                            case "mysql": {
                                filters.SQL = ["mysql", "sql"];
                                break;
                            }

                            case "sql": {
                                filters.SQL = ["sql"];
                                break;
                            }

                            case "typescript": {
                                filters.TypeScript = ["ts"];
                                break;
                            }

                            case "javascript": {
                                filters.JavaScript = ["js"];
                                break;
                            }

                            default:
                        }

                        void window.showSaveDialog({
                            title: "Save Script File",
                            filters,
                        }).then((value: Uri) => {
                            if (value) {
                                const newName = basename(value.fsPath);
                                scripts.set(details.id, value);
                                void provider.renameFile({
                                    ...details,
                                    caption: newName,
                                });


                                const buffer = Buffer.from(details.content, "utf-8");

                                void workspace.fs.writeFile(value, buffer);
                                void requisitions.execute("editorSaved",
                                    { id: details.id, newName, saved: value !== undefined });
                            }
                        });
                    } else {
                        const buffer = Buffer.from(details.content, "utf-8");
                        void workspace.fs.writeFile(uri, buffer);
                    }
                }
            }
        }

        return Promise.resolve(true);
    };

    private createNewScriptEditor = (
        dbProvider: DBConnectionViewProvider, name: string, content: string, language: string,
        connectionId: number, uri?: Uri, pageId?: string, details?: IConnectionDetails): void => {
        // A new script.
        const request: IScriptRequest = {
            id: uuid(),
            caption: name,
            content,
            language: language as EditorLanguage,
            pageId,
            connectionInfo: details ? getConnectionInfoFromDetails(details) : undefined,
        };

        let scripts = this.openScripts.get(dbProvider);
        if (!scripts) {
            scripts = new Map();
            this.openScripts.set(dbProvider, scripts);
        }
        if (uri) {
            scripts.set(request.id, uri);
        }

        void dbProvider.editScript(connectionId, request);
    };

    private createNewEditor = (params: {
        provider?: IWebviewProvider,
        language: string,
        entry?: IOdmConnectionPageEntry,
        content?: string,
        connectionId?: number,
    }): Promise<boolean> => {
        return new Promise((resolve) => {
            let connectionId = params.connectionId;
            let provider: IWebviewProvider | undefined;
            let pageId: string | undefined;
            let details: IConnectionDetails | undefined;
            if (params.entry?.parent?.provider) {
                connectionId = params.entry.details.id;
                provider = params.entry.parent.provider;
                pageId = params.entry.id;
                details = params.entry.details;
            } else if (!connectionId) {
                provider = this.host.currentProvider;
                if (provider) {
                    connectionId = this.openEditorsTreeDataProvider.currentConnectionId(provider) ?? -1;
                }
            }

            if (!connectionId) {
                void ui.showErrorMessage("Please select a connection first.", {});
                resolve(false);

                return;
            }

            void workspace.openTextDocument({ language: params.language, content: params.content })
                .then((document) => {
                    const dbProvider = (params.provider ?? provider) as DBConnectionViewProvider;
                    if (provider) {
                        const name = basename(document.fileName);
                        if (params.language === "msg") {
                            // A new notebook.
                            void dbProvider.createNewEditor({
                                connectionId,
                                language: params.language,
                                content: params.content,
                            }, details);
                        } else {
                            // A new script
                            this.createNewScriptEditor(dbProvider, name, document.getText(),
                                params.language as EditorLanguage, connectionId, document.uri, pageId, details);
                        }
                    }

                    resolve(true);
                });
        });
    };

    private languageFromConnection = (entry: ICdmConnectionEntry): EditorLanguage => {
        switch (entry.details.dbType) {
            case DBType.MySQL: {
                return "mysql";
            }

            default: {
                return "sql";
            }
        }
    };

    private proxyRequest = (request: {
        provider: WebviewProvider;
        original: IRequestListEntry<keyof IRequestTypeMap>;
    }): Promise<boolean> => {
        switch (request.original.requestType) {
            case "editorSaveScript": {
                const response = request.original.parameter as IScriptRequest;

                return this.editorSaveScript(response);
            }

            case "editorLoadScript": {
                const response = request.original.parameter as IScriptRequest;

                return this.editorLoadScript(response);
            }

            case "documentOpened": {
                const response = request.original.parameter as IDocumentOpenData;

                return this.updateLatestPagesByConnection(response.connection?.id, response.pageId);
            }

            case "selectConnectionTab":
            case "selectDocument": {
                const response = request.original.parameter as { connectionId?: number, pageId?: string; };

                return this.updateLatestPagesByConnection(response.connectionId, response.pageId);
            }

            case "createNewEditor": {
                const response = request.original.parameter as INewEditorRequest;

                return this.createNewEditor({
                    provider: request.provider, language: response.language, content: response.content,
                });
            }

            default:
        }

        return Promise.resolve(false);
    };

    private updateLatestPagesByConnection(connectionId?: number, pageId?: string) {
        if (!pageId || !connectionId || connectionId < 1) {
            return Promise.resolve(false);
        }

        this.latestPagesByConnection.set(connectionId, pageId);

        return Promise.resolve(true);
    }

    private getSql = (editor: TextEditor): string => {
        let sql = "";
        if (!editor.selection.isEmpty) {
            editor.selections.forEach((selection) => {
                sql += editor.document.getText(selection);
            });
        } else {
            sql = editor.document.getText();
        }

        return sql;
    };
}
