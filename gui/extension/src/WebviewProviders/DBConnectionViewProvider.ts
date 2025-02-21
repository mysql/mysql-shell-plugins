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

import { readFile, writeFile } from "fs/promises";

import { commands, OpenDialogOptions, SaveDialogOptions, Uri, window } from "vscode";

import { requisitions } from "../../../frontend/src/supplement/Requisitions.js";
import {
    IEditorExtendedExecutionOptions, IMrsDbObjectEditRequest, IOpenDialogOptions, IOpenFileDialogResult,
    IRequestTypeMap, IRequisitionCallbackValues, type IDocumentOpenData, type InitialEditor, type ISaveDialogOptions,
} from "../../../frontend/src/supplement/RequisitionTypes.js";

import type { IMySQLDbSystem } from "../../../frontend/src/communication/index.js";
import type { EditorLanguage, INewEditorRequest, IScriptRequest } from "../../../frontend/src/supplement/index.js";
import type { IShellSessionDetails } from "../../../frontend/src/supplement/ShellInterface/index.js";
import { WebviewProvider } from "./WebviewProvider.js";
import { ui } from "../../../frontend/src/app-logic/UILayer.js";

export class DBConnectionViewProvider extends WebviewProvider {
    /**
     * Tracks the current schema of all open connections in this provider.
     * This is needed to update the UI when the user changes the current provider.
     */
    public readonly currentSchemas = new Map<number, string>();

    #lastNotebookUri?: Uri;

    /**
     * Shows the given module page.
     *
     * @param page The page to show.
     * @param editor The initial editor to show.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public show(page: string, editor?: InitialEditor): Promise<boolean> {
        return this.runCommand("job", [{ requestType: "showPage", parameter: { page, editor } }], "newConnection");
    }

    /**
     * Shows a specific document.
     *
     * @param data The details for the document to open.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public showDocument(data: IDocumentOpenData): Promise<boolean> {
        return this.runCommand("job", [{ requestType: "openDocument", parameter: data }], "newConnection");
    }

    /**
     * Executes a piece of code in a webview tab.
     *
     * @param page The page to open in the webview tab (if not already done).
     * @param details Required information about the query that must be executed.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public runCode(page: string, details: IEditorExtendedExecutionOptions): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showPage", parameter: { page, suppressAbout: true } },
            { requestType: "editorRunCode", parameter: details },
        ], details.linkId === -1 ? "newConnection" : "newConnectionWithEmbeddedSql");
    }

    /**
     * Executes a full script in a webview tab.
     *
     * @param page The page to open in the webview tab (if not already done).
     * @param details The content of the script to run and other related information.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public runScript(page: string, details: IScriptRequest): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showPage", parameter: { page, suppressAbout: true, noEditor: true } },
            { requestType: "editorRunScript", parameter: details },
        ], "newConnection");
    }

    /**
     * Opens a new script editor in the webview tab and loads the given content into it.
     *
     * @param page The page to open in the webview tab (if not already done).
     * @param details The content of the script to run and other related information.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public editScript(page: string, details: IScriptRequest): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showPage", parameter: { page, suppressAbout: true } },
            { requestType: "editorEditScript", parameter: details },
        ], "newConnection");
    }

    /**
     * Loads the content given in the request into the current script editor.
     *
     * @param page The page to open in the webview tab (if not already done).
     * @param details The content of the script and other related information.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public loadScript(page: string, details: IScriptRequest): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showPage", parameter: { page, suppressAbout: true } },
            { requestType: "editorLoadScript", parameter: details },
        ], "newConnection");
    }

    /**
     * Opens a new script editor in the webview tab and loads the given content into it.
     *
     * @param details The content of the script to run and other related information.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public createNewEditor(details: INewEditorRequest): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showPage", parameter: { page: details.page, suppressAbout: true } },
            { requestType: "createNewEditor", parameter: details },
        ], "newConnection");
    }

    /**
     * Opens the dialog for adding a new connection on the app.
     *
     * @param mdsData Additional data for MDS connections.
     * @param profileName The config profile name for MDS connections.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public addConnection(mdsData?: IMySQLDbSystem, profileName?: String): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showPage", parameter: { page: "connections" } },
            { requestType: "addNewConnection", parameter: { mdsData, profileName } },
        ], "connections");
    }

    /**
     * Opens a page for a session with the given session id.
     *
     * @param session The session to open.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public openSession(session: IShellSessionDetails): Promise<boolean> {
        //const command = session.sessionId === -1 ? "newSession" : "openSession";

        return this.runCommand("job", [{ requestType: "openSession", parameter: session }], "newShellConsole");
    }

    /**
     * Removes the connection from the stored connection list.
     *
     * @param connectionId The connection id.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public removeConnection(connectionId: number): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showPage", parameter: { page: "connections" } },
            { requestType: "removeConnection", parameter: connectionId },
        ], "connections");
    }

    /**
     * Shows the connection editor on the connections page for the given connection id.
     *
     * @param connectionId The connection id.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public editConnection(connectionId: number): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showPage", parameter: { page: "connections" } },
            { requestType: "editConnection", parameter: connectionId },
        ], "connections");
    }

    /**
     * Shows the connection editor on the connections page with a duplicate of the given connection.
     *
     * @param connectionId The connection id.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public duplicateConnection(connectionId: number): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showPage", parameter: { page: "connections" } },
            { requestType: "duplicateConnection", parameter: connectionId },
        ], "connections");
    }

    public renameFile(request: IScriptRequest): Promise<boolean> {
        // Can only be called if a connection is active. This is the bounce-back from a save request from a connection.
        return this.runCommand("job", [{ requestType: "editorRenameScript", parameter: request }], "connections");
    }

    /**
     * Closes the editor with the given id in the webview tab.
     *
     * @param connectionId The id of the webview tab.
     * @param documentId The id of the editor to close.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public closeEditor(connectionId: number, documentId: string): Promise<boolean> {
        return this.runCommand("job", [
            // No need to send a showModule request here. The module must exist or the editor wouldn't be open.
            { requestType: "closeDocument", parameter: { connectionId, documentId } },
        ], "");
    }

    /**
     * Sends a proxy request to the global extension to reselect the last item in the document list.
     */
    public reselectLastDocument(): void {
        void requisitions.execute("proxyRequest", {
            provider: this,
            original: { requestType: "selectDocument", parameter: { connectionId: -1, documentId: "" } },
        });
    }

    /**
     * Selects the given item in the webview tab.
     *
     * @param connectionId The id of the webview tab.
     * @param documentId The id of the document to select.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public selectDocument(connectionId: number, documentId: string): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "selectDocument", parameter: { connectionId, documentId } },
        ], "");
    }

    /**
     * We have 2 entry points to create new scripts. One is from the web app via a remote request. The other is from the
     * extension via a local request. This method handles the local request.
     *
     * @param language The language of the script to create.
     */
    public createScript(language: EditorLanguage): void {
        void requisitions.execute("proxyRequest", {
            provider: this,
            original: {
                requestType: "createNewEditor",
                parameter: language,
            },
        });
    }

    /**
     * Shows the MRS DB object editor dialog.
     *
     * @param page The page to show.
     * @param data Details of the object to edit.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public editMrsDbObject(page: string, data: IMrsDbObjectEditRequest): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showPage", parameter: { page } },
            { requestType: "showMrsDbObjectDialog", parameter: data },
        ], "newConnection");
    }

    /**
     * Tell the web app to switch the current schema to the given one.
     *
     * @param connectionId The ID of the connection to switch the schema for.
     * @param schema The new current schema.
     *
     * @returns Returns a promise which resolves after the command was executed.
     */
    public makeCurrentSchema(connectionId: number, schema: string): Promise<boolean> {
        // Assume we can set the given schema. If we can't, the web app will tell us next time an editor is activated.
        this.currentSchemas.set(connectionId, schema);

        if (this.panel) {
            // Tell the web app to switch the schema, if one is open.
            return this.runCommand("job", [
                { requestType: "sqlSetCurrentSchema", parameter: { id: "", connectionId, schema } },
            ], "connections");
        }

        return Promise.resolve(false);
    }

    /**
     * Closes the session with the given id.
     *
     * @param session The session to remove.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public removeSession(session: IShellSessionDetails): Promise<boolean> {
        return this.runCommand("removeSession", session, "newShellConsole");
    }

    protected override requisitionsCreated(): void {
        super.requisitionsCreated();

        if (this.requisitions) {
            // For requests sent by the web app. These are often forwarded to the global extension requisitions.

            /* eslint-disable @typescript-eslint/no-unsafe-argument */
            // Have to disable ESLint checks for the following lines because ESLint cannot infer the type of the
            // callback.
            ["refreshConnection", "connectionAdded", "connectionUpdated", "connectionRemoved", "refreshOciTree",
                "codeBlocksUpdate", "editorLoadScript", "editorSaveScript", "createNewEditor", "documentOpened",
                "documentClosed", "selectDocument", "sessionAdded", "sessionRemoved"]
                .forEach((requestType: keyof IRequestTypeMap) => {
                    this.requisitions!.register(requestType, this.forwardRequest.bind(this, requestType));
                });

            /* eslint-enable @typescript-eslint/no-unsafe-argument */

            this.requisitions.register("newSession", this.createNewSession);
            this.requisitions.register("closeInstance", this.closeInstance);
            this.requisitions.register("editorSaveNotebook", this.editorSaveNotebook);
            this.requisitions.register("editorSaveNotebookInPlace", this.editorSaveNotebookInPlace);
            this.requisitions.register("editorLoadNotebook", this.editorLoadNotebook);
            this.requisitions.register("showOpenDialog", this.showOpenDialog);
            this.requisitions.register("showSaveDialog", this.showSaveDialog);
            this.requisitions.register("sqlSetCurrentSchema", this.setCurrentSchema);

            this.requisitions.register("editorExecuteOnHost", this.executeOnHost);
        }
    }

    /**
     * Takes a request and forwards it to the global extension requisitions, as a proxy request.
     *
     * @param requestType The type of request to forward.
     * @param parameter The request parameter.
     *
     * @returns The promise returned by the global extension requisitions.
     */
    protected forwardRequest = async <K extends keyof IRequestTypeMap>(requestType: K,
        parameter: IRequisitionCallbackValues<K>): Promise<boolean> => {

        return requisitions.execute("proxyRequest", { provider: this, original: { requestType, parameter } });
    };

    private createNewSession = async (_details: IShellSessionDetails): Promise<boolean> => {
        await commands.executeCommand("msg.newSession");

        return true;
    };

    private setCurrentSchema = (data: {
        id: string,
        connectionId: number,
        schema: string,
    }): Promise<boolean> => {
        // The connection entry set here is never removed, but that doesn't matter as all we need is to
        // track the current schema for each connection (which can also be empty if no editor is open).
        this.currentSchemas.set(data.connectionId, data.schema);

        return requisitions.execute("proxyRequest", {
            provider: this,
            original: { requestType: "sqlSetCurrentSchema", parameter: data },
        });
    };

    private executeOnHost = (data: IEditorExtendedExecutionOptions): Promise<boolean> => {
        return requisitions.execute("proxyRequest", {
            provider: this,
            original: { requestType: "editorExecuteOnHost", parameter: data },
        });
    };

    /**
     * Sent when a notebook shall be saved. This comes in two flavours: either with no content, which means the content
     * must be created first (which is only handled by the frontend), or with content, which means the user has to
     * select a file to save to.
     *
     * This is used for notebook content in a DB editor tab. There's a separate implementation for a standalone
     * notebook file here NotebookEditorProvider.triggerSave.
     *
     * @param content The content to save.
     *
     * @returns A promise which resolves to true if the save was successful.
     */
    private editorSaveNotebook = (content?: string): Promise<boolean> => {
        return new Promise((resolve) => {
            if (content) {
                const dialogOptions: SaveDialogOptions = {
                    title: "",
                    filters: {
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        "MySQL Notebook": ["mysql-notebook"],
                    },
                    saveLabel: "Save Notebook",
                };

                void window.showSaveDialog(dialogOptions).then((uri: Uri) => {
                    if (uri !== undefined) {
                        this.#lastNotebookUri = uri;

                        const path = uri.fsPath;
                        writeFile(path, content).then(() => {
                            window.setStatusBarMessage(`DB Notebook saved to ${path}`, 5000);

                            return resolve(true);
                        }).catch(() => {
                            void ui.showErrorMessage(`Could not save notebook to ${path}.`, {});

                            return resolve(false);
                        });
                    } else {
                        return resolve(false);
                    }
                });
            } else {
                return resolve(false);
            }
        });
    };

    private editorSaveNotebookInPlace = (content?: string): Promise<boolean> => {
        return new Promise((resolve) => {
            if (content) {
                if (this.#lastNotebookUri === undefined) {
                    void this.editorSaveNotebook(content);
                } else {
                    const path = this.#lastNotebookUri.fsPath;
                    writeFile(path, content).then(() => {
                        window.setStatusBarMessage(`DB Notebook saved to ${path}`, 5000);

                        return resolve(true);
                    }).catch(() => {
                        void ui.showErrorMessage(`Could not save notebook to ${path}.`, {});

                        return resolve(false);
                    });
                }
            } else {
                return resolve(false);
            }
        });
    };

    /**
     * Sent when a notebook shall be loaded. The user has to select a file to load from. The content of the file is
     * then sent back to the frontend and used there to replace the current notebook.
     *
     * This is used for notebook content in a DB editor tab. There's a separate implementation for a standalone
     * notebook file here NotebookEditorProvider.triggerLoad.
     *
     * @returns A promise which resolves to true if the save was successful.
     */
    private editorLoadNotebook = (): Promise<boolean> => {
        return new Promise((resolve) => {
            const dialogOptions: OpenDialogOptions = {
                title: "",
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    "MySQL Notebook": ["mysql-notebook"],
                },
                openLabel: "Open Notebook",
            };

            void window.showOpenDialog(dialogOptions).then((paths?: Uri[]) => {
                if (paths && paths.length > 0) {
                    this.#lastNotebookUri = paths[0];
                    const path = paths[0].fsPath;
                    readFile(path, { encoding: "utf-8" }).then((content) => {
                        this.requisitions?.executeRemote("editorLoadNotebook", { content, standalone: false });
                    }).catch(() => {
                        void ui.showErrorMessage(`Could not load notebook from ${path}.`, {});
                    });
                }

                resolve(true);
            });
        });
    };

    private showOpenDialog = (options: IOpenDialogOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            const dialogOptions = {
                id: options.id,
                defaultUri: Uri.file(options.default ?? ""),
                openLabel: options.openLabel,
                canSelectFiles: options.canSelectFiles,
                canSelectFolders: options.canSelectFolders,
                canSelectMany: options.canSelectMany,
                filters: options.filters,
                title: options.title,

            };

            void window.showOpenDialog(dialogOptions).then((paths?: Uri[]) => {
                if (paths) {
                    const result: IOpenFileDialogResult = {
                        resourceId: dialogOptions.id ?? "",
                        path: paths.map((path) => {
                            return path.fsPath;
                        }),
                    };
                    void this.requisitions?.executeRemote("selectFile", result);
                }

                resolve(true);
            });
        });
    };

    private showSaveDialog = (options: ISaveDialogOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            const dialogOptions = {
                id: options.id,
                defaultUri: Uri.file(options.default ?? ""),
                saveLabel: options.saveLabel,
                filters: options.filters,
                title: options.title,
            };

            void window.showSaveDialog(dialogOptions).then((path?: Uri) => {
                if (path) {
                    const result: IOpenFileDialogResult = {
                        resourceId: dialogOptions.id ?? "",
                        path: [path.fsPath],
                    };
                    void this.requisitions?.executeRemote("selectFile", result);
                }

                resolve(true);
            });
        });
    };

    private closeInstance = (): Promise<boolean> => {
        this.close();

        return Promise.resolve(true);
    };

}
