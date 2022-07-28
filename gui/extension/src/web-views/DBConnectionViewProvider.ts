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

import { Uri, window } from "vscode";

import { IOpenDialogOptions, IOpenFileDialogResult, requisitions } from "../../../frontend/src/supplement/Requisitions";

import { IMySQLDbSystem } from "../../../frontend/src/communication";
import { DBEditorModuleId } from "../../../frontend/src/modules/ModuleInfo";
import { EntityType, IDBEditorScriptState } from "../../../frontend/src/modules/db-editor";
import { WebviewProvider } from "./WebviewProvider";
import { INewScriptRequest, IRunQueryRequest, IScriptRequest } from "../../../frontend/src/supplement";

export class DBConnectionViewProvider extends WebviewProvider {

    public constructor(url: URL, onDispose: (view: WebviewProvider) => void) {
        super(url, onDispose);
    }

    /**
     * Shows the given module page.
     *
     * @param caption A caption for the webview tab in which the page is hosted.
     * @param page The page to show.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public show(caption: string, page: string): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showModule", parameter: DBEditorModuleId },
            { requestType: "showPage", parameter: { module: DBEditorModuleId, page } },
        ], caption, "newConnection");
    }

    /**
     * Shows a sub part of a page.
     *
     * @param caption The title of the webview tab.
     * @param page The page to open in the webview tab (if not already done).
     * @param id The unique ID of the section to show.
     * @param type The type of the section.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public showPageSection(caption: string, page: string, id: string, type: EntityType): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showModule", parameter: DBEditorModuleId },
            { requestType: "showPage", parameter: { module: DBEditorModuleId, page } },
            { requestType: "showPageSection", parameter: { type, id } },
        ], caption, "newConnection");
    }

    /**
     * Executes a single statement in a webview tab.
     *
     * @param caption The title of the webview tab.
     * @param page The page to open in the webview tab (if not already done).
     * @param details Required information about the query that must be executed.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public runQuery(caption: string, page: string, details: IRunQueryRequest): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showModule", parameter: DBEditorModuleId },
            { requestType: "showPage", parameter: { module: DBEditorModuleId, page, suppressAbout: true } },
            { requestType: "editorRunQuery", parameter: details },
        ], caption, details.linkId === -1 ? "newConnection" : "newConnectionWithEmbeddedSql");
    }

    /**
     * Executes a full script in a webview tab.
     *
     * @param caption The title of the webview tab.
     * @param page The page to open in the webview tab (if not already done).
     * @param details The content of the script to run and other related information.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public runScript(caption: string, page: string, details: IScriptRequest): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showModule", parameter: DBEditorModuleId },
            { requestType: "showPage", parameter: { module: DBEditorModuleId, page, suppressAbout: true } },
            { requestType: "editorRunScript", parameter: details },
        ], caption, "newConnection");
    }

    /**
     * Opens a new script editor in the webview tab and loads the given content into it.
     *
     * @param caption The title of the webview tab.
     * @param page The page to open in the webview tab (if not already done).
     * @param details The content of the script to run and other related information.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public editScriptInNotebook(caption: string, page: string, details: IScriptRequest): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showModule", parameter: DBEditorModuleId },
            { requestType: "showPage", parameter: { module: DBEditorModuleId, page, suppressAbout: true } },
            { requestType: "editorEditScript", parameter: details },
        ], caption, "newConnection");
    }

    /**
     * Inserts data from a script (given by a module data id) into this connection editor.
     * The editor must already exist.
     *
     * @param state The script information.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public insertScriptData(state: IDBEditorScriptState): Promise<boolean> {
        if (state.dbDataId) {
            return this.runCommand("editorInsertUserScript",
                { language: state.language, resourceId: state.dbDataId }, "", "newConnection");
        }

        return Promise.resolve(false);
    }

    /**
     * Opens the dialog for adding a new connection on the app.
     *
     * @param caption A caption for the webview tab in which the page is hosted.
     * @param mdsData Additional data for MDS connections.
     * @param profileName The config profile name for MDS connections.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public addConnection(caption: string, mdsData?: IMySQLDbSystem, profileName?: String): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showModule", parameter: DBEditorModuleId },
            { requestType: "showPage", parameter: { module: DBEditorModuleId, page: "connections" } },
            { requestType: "addNewConnection", parameter: { mdsData, profileName } },
        ], caption, "connections");
    }

    /**
     * Removes the connection from the stored connection list.
     *
     * @param caption A caption for the webview tab in which the page is hosted.
     * @param connectionId The connection id.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public removeConnection(caption: string, connectionId: number): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showModule", parameter: DBEditorModuleId },
            { requestType: "showPage", parameter: { module: DBEditorModuleId, page: "connections" } },
            { requestType: "removeConnection", parameter: connectionId },
        ], caption, "connections");
    }

    /**
     * Shows the connection editor on the connections page for the given connection id.
     *
     * @param caption A caption for the webview tab in which the page is hosted.
     * @param connectionId The connection id.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public editConnection(caption: string, connectionId: number): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showModule", parameter: DBEditorModuleId },
            { requestType: "showPage", parameter: { module: DBEditorModuleId, page: "connections" } },
            { requestType: "editConnection", parameter: connectionId },
        ], caption, "connections");
    }

    /**
     * Shows the connection editor on the connections page with a duplicate of the given connection.
     *
     * @param caption A caption for the webview tab in which the page is hosted.
     * @param connectionId The connection id.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public duplicateConnection(caption: string, connectionId: number): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showModule", parameter: DBEditorModuleId },
            { requestType: "showPage", parameter: { module: DBEditorModuleId, page: "connections" } },
            { requestType: "duplicateConnection", parameter: connectionId },
        ], caption, "connections");
    }

    public renameFile(request: IScriptRequest): Promise<boolean> {
        // Can only be called if a connection is active. This is the bounce-back from a save request from a connection.
        return this.runCommand("job", [
            { requestType: "editorRenameScript", parameter: request },
        ], "", "connections");
    }

    protected requisitionsCreated(): void {
        super.requisitionsCreated();

        if (this.requisitions) {
            // For requests sent by the web app. These are usually forwarded to the extension global requisitions.
            this.requisitions.register("refreshConnections", this.refreshConnections);
            this.requisitions.register("refreshOciTree", this.refreshOciTree);
            this.requisitions.register("codeBlocksUpdate", this.updateCodeBlock);
            this.requisitions.register("showOpenDialog", this.showOpenDialog);
            this.requisitions.register("editorSaveScript", this.editorSaveScript);
            this.requisitions.register("createNewScript", this.createNewScript);
            this.requisitions.register("closeInstance", this.closeInstance);
        }
    }

    protected refreshConnections = (): Promise<boolean> => {
        // Watch out! It uses the global requisition singleton, not the local one for this webview provider.
        return requisitions.execute("refreshConnections", undefined);
    };

    protected refreshOciTree = (): Promise<boolean> => {
        // Ditto.
        return requisitions.execute("refreshOciTree", undefined);
    };

    protected updateCodeBlock = (data: { linkId: number; code: string }): Promise<boolean> => {
        // Ditto.
        return requisitions.execute("codeBlocksUpdate", data);
    };

    private editorSaveScript = (details: IScriptRequest): Promise<boolean> => {
        // Ditto.
        return requisitions.execute("editorSaveScript", details);
    };

    private createNewScript = (details: INewScriptRequest): Promise<boolean> => {
        // Ditto.
        return requisitions.execute("createNewScript", details);
    };

    private closeInstance = (): Promise<boolean> => {
        this.close();

        return Promise.resolve(true);
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
}
