/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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
    commands, CustomTextEditorProvider, Disposable, Position, TextDocument, Uri, WebviewPanel, window, workspace,
    WorkspaceEdit, Range, OpenDialogOptions,
} from "vscode";

import { readFile } from "fs/promises";

import { IEmbeddedMessage } from "../../../frontend/src/communication/index.js";
import { DBEditorModuleId } from "../../../frontend/src/modules/ModuleInfo.js";
import { RequisitionHub, requisitions } from "../../../frontend/src/supplement/Requisitions.js";
import { DBType } from "../../../frontend/src/supplement/ShellInterface/index.js";
import { ExtensionHost } from "../ExtensionHost.js";
import { prepareWebviewContent } from "../WebviewProviders/webview-helpers.js";

import { Semaphore } from "../../../frontend/src/supplement/Semaphore.js";

/** This provider manages a MySQL notebook document. */
export class NotebookEditorProvider implements CustomTextEditorProvider {
    #host?: ExtensionHost;

    #url?: URL;
    #requisitions?: RequisitionHub;

    // True if the connections list was updated at least once, after a URL was connected.
    #connectionsAvailable = false;

    // Signals that the URL is ready to be used.
    #urlReady = new Semaphore();

    // Signals that the connections list is ready to be used.
    #connectionsReady = new Semaphore();

    #document?: TextDocument;
    #saving = false;

    #panel?: WebviewPanel;
    #disposables: Disposable[] = [];

    public setup(host: ExtensionHost): void {
        this.#host = host;

        // Registrations in the extension wide requisitions hub.
        requisitions.register("connectionsUpdated", this.handleConnectionsUpdated);
        requisitions.register("connectedToUrl", this.handleConnectToUrl);

        host.context.subscriptions.push(window.registerCustomEditorProvider("msg.notebook", this, {
            webviewOptions: {
                retainContextWhenHidden: true,
            },
        }));

        host.context.subscriptions.push(workspace.onDidDeleteFiles((event) => {
            // Remove the connection id for the deleted file.
            for (const file of event.files) {
                if (file.fsPath.endsWith(".mysql-notebook")) {
                    void host.context.workspaceState.update(file.toString(), undefined);
                }
            }
        }));

        host.context.subscriptions.push(workspace.onDidRenameFiles((event) => {
            // Move the connection id from the old file to the new file.
            for (const file of event.files) {
                let usedConnectionId = -1;
                if (file.oldUri.fsPath.endsWith(".mysql-notebook")) {
                    usedConnectionId = host.context.workspaceState.get<number>(file.oldUri.toString(), -1);
                    void host.context.workspaceState.update(file.oldUri.toString(), undefined);
                }

                if (file.newUri.fsPath.endsWith(".mysql-notebook")) {
                    void host.context.workspaceState.update(file.newUri.toString(), usedConnectionId);
                }
            }
        }));

        host.context.subscriptions.push(commands.registerCommand("msg.openNotebookWithConnection", (uri?: Uri) => {
            if (!uri) {
                return;
            }

            void host.determineConnection(DBType.MySQL, true).then((connection) => {
                if (connection) {
                    void workspace.openTextDocument(uri).then((document) => {
                        void commands.executeCommand("vscode.openWith", uri, "msg.notebook").then(() => {
                            void host.context.workspaceState.update(document.uri.toString(), connection.details.id);
                            void this.showNotebookPage(connection.details.id, document.getText());
                        });
                    });
                }
            });
        }));
    }

    /**
     * Prepares the webview for the new document, by loading its initial content and wiring it about for
     * synchronization with the document.
     *
     * @param document The document which holds the content for the webview.
     * @param webviewPanel The webview panel which will display the content.
     *
     * @returns A promise which resolves when the webview is ready to be used.
     */
    public resolveCustomTextEditor(document: TextDocument, webviewPanel: WebviewPanel): Thenable<void> | void {
        return new Promise((resolve) => {
            void this.setupWebview(document, webviewPanel).then(() => {
                resolve();
            });
        });
    }

    /**
     * Opens a new script editor in the webview tab and loads the given content into it.
     *
     * @param connectionId The id of the connection to use for the notebook.
     * @param content The content of the script to run and other related information.
     *
     * @returns A promise which resolves after the command was executed.
     */
    private showNotebookPage(connectionId: number, content: string): Promise<boolean> {
        return Promise.resolve(this.#requisitions?.executeRemote("job", [
            { requestType: "showModule", parameter: DBEditorModuleId },
            {
                requestType: "showPage",
                parameter: {
                    module: DBEditorModuleId, page: String(connectionId), suppressAbout: true, noEditor: true,
                },
            },
            { requestType: "editorLoadNotebook", parameter: { content, standalone: true } },
        ]) ?? true);
    }

    /**
     * This handler is called on every connection list refresh. This can be the initial load of the
     * connections, or a refresh triggered by the user. Also when connecting to a different
     * backend, this handler is called again.
     *
     * @returns A promise which resolves after the command was executed.
     */
    private handleConnectionsUpdated = (): Promise<boolean> => {
        this.#connectionsAvailable = true;

        // Check if the connection is still valid.
        if (this.#document && this.#panel) {
            const connectionId = this.#host!.context.workspaceState.get<number>(this.#document.uri.toString());
            if (connectionId !== undefined && !this.#host!.isValidConnectionId(connectionId)) {
                if (this.#document.isDirty) {
                    void this.#document.save().then(() => {
                        this.#panel!.dispose();

                        return Promise.resolve(true);
                    });
                } else {
                    this.#panel.dispose();

                    return Promise.resolve(true);
                }
            }
        }

        // Finally continue any waiting load requests.
        this.#connectionsReady.notifyAll();

        return Promise.resolve(true);
    };

    /**
     * This handler is called when the extension connects the first time to the backend or when
     * the user switches the backend URL.
     *
     * @param url The URL of the backend.
     *
     * @returns A promise which resolves after the command was executed.
     */
    private handleConnectToUrl = (url?: URL): Promise<boolean> => {
        // If we were connected to a different backend, we have to close the notebook.
        if (this.#url) {
            this.#panel?.dispose();

            return Promise.resolve(true);
        }

        this.#url = url;
        this.#connectionsAvailable = false;
        this.#urlReady.notifyAll();

        return Promise.resolve(true);
    };

    /**
     * Promisified setup routine. The caller uses this to wait for the webview to be ready.
     *
     * @param document The document which holds the content for the webview.
     * @param webviewPanel The webview panel which will display the content.
     *
     * @returns A promise which resolves when the webview is ready to be used.
     */
    private async setupWebview(document: TextDocument, webviewPanel: WebviewPanel): Promise<void> {
        webviewPanel.webview.html = "<br/><h2>Loading...</h2>";

        if (!this.#url) {
            // If there is no URL yet, wait for it to arrive.
            await this.#urlReady.wait();
        }
        prepareWebviewContent(webviewPanel, this.#url!);

        if (!this.#connectionsAvailable) {
            // If there are no connections yet, wait for them to arrive.
            await this.#connectionsReady.wait();
        }

        // Do we have a connection id for this document, stored when it was last opened?
        let usedConnectionId = this.#host!.context.workspaceState.get<number>(document.uri.toString());
        if (usedConnectionId === undefined || !this.#host!.isValidConnectionId(usedConnectionId)) {
            usedConnectionId = undefined;
            await this.#host!.context.workspaceState.update(document.uri.toString(), undefined);
        }

        // If not then let the user pick a connection. This will return the default connection ID if there is one.
        if (usedConnectionId === undefined) {
            const connection = await this.#host!.determineConnection(DBType.MySQL);
            if (connection) {
                usedConnectionId = connection.details.id;
            }
        }

        if (usedConnectionId !== undefined) {
            // Now that we have everything needed, we can load the notebook.
            this.#panel = webviewPanel;
            this.#document = document;

            void this.#host!.context.workspaceState.update(document.uri.toString(), usedConnectionId);

            webviewPanel.webview.options = {
                ...webviewPanel.webview.options,
                enableScripts: true,
            };

            // Set up the communication between the webview and the extension.
            this.#requisitions = new RequisitionHub("host");
            this.#requisitions.setRemoteTarget(webviewPanel.webview);

            this.#requisitions.register("editorChanged", async (): Promise<boolean> => {
                // Sent by the webview when the user changes the content of the editor.
                await this.makeDocumentDirty();

                return Promise.resolve(true);
            });

            this.#requisitions.register("editorSaveNotebook", this.triggerSave);
            this.#requisitions.register("editorLoadNotebook", this.triggerLoad);
            this.#requisitions.register("applicationDidStart", (): Promise<boolean> => {
                // Finally show the notebook.
                return this.showNotebookPage(usedConnectionId, document.getText());
            });

            this.#disposables.push(webviewPanel.webview.onDidReceiveMessage((message: IEmbeddedMessage) => {
                if (message.source === "app") {
                    this.#requisitions?.handleRemoteMessage(message);
                }
            }));

            this.#disposables.push(webviewPanel.onDidChangeViewState((event) => {
                if (event.webviewPanel.active) {
                    // The notebook was activated.
                }
            }));

            this.#disposables.push(workspace.onWillSaveTextDocument((event) => {
                if (event.document.uri.toString() === this.#document?.uri.toString()) {
                    // The notebook is about to be saved.
                    event.waitUntil(this.saveNotebook());
                }
            }));

            this.#disposables.push(this.#panel.onDidDispose(() => {
                this.handleDispose();
            }));
        } else {
            webviewPanel.webview.html = "<br/><h2>No connection selected</h2>";
        }
    }

    private handleDispose(): void {
        this.#disposables.forEach((d) => { d.dispose(); });
        this.#panel = undefined;
    }

    /**
     * Causes our document to be dirty, without really changing something.
     * This is mostly for the dirty indicator in the tab.
     */
    private async makeDocumentDirty(): Promise<void> {
        if (this.#document) {
            const edits = new WorkspaceEdit();
            edits.insert(this.#document.uri, new Position(0, 0), " ");
            await workspace.applyEdit(edits);

            const edits2 = new WorkspaceEdit();
            edits2.delete(this.#document.uri, new Range(new Position(0, 0), new Position(0, 1)));
            await workspace.applyEdit(edits2);
        }
    }

    /**
     * Called from the extension to save the notebook file.
     *
     * @returns A promise which resolves always.
     */
    private saveNotebook(): Promise<void> {
        if (!this.#saving) {
            this.#requisitions!.executeRemote("editorSaveNotebook", undefined);
        }

        return Promise.resolve();
    }

    /**
     * Called from the provider requisitions hub to save the notebook file. This event is triggered either by the
     * `saveNotebook()` method or by a save action in the application.
     *
     * @param content The content of the notebook.
     *
     * @returns A promise which resolves always.
     */
    private triggerSave = async (content?: string): Promise<boolean> => {
        if (this.#document && content) {
            const edit = new WorkspaceEdit();
            edit.replace(this.#document.uri, new Range(0, 0, this.#document.lineCount, 0), content);
            await workspace.applyEdit(edit);

            this.#saving = true;
            await this.#document.save();
            this.#saving = false;
        }

        return Promise.resolve(true);
    };

    /**
     * Called from the provider requisitions hub to load a notebook file. The handling here (in contrast to
     * DBConnectionProvider) is a bit different, because we don't want to create a new notebook editor, but
     * instead replace the content of the current one.
     *
     * @returns A promise which resolves always.
     */
    private triggerLoad = async (): Promise<boolean> => {
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

        const paths = await window.showOpenDialog(dialogOptions);
        if (paths && paths.length > 0) {
            const path = paths[0].fsPath;
            const content = await readFile(path, { encoding: "utf-8" });
            if (this.#document) {
                const edit = new WorkspaceEdit();
                edit.replace(this.#document.uri, new Range(0, 0, this.#document.lineCount, 0), content);
                await workspace.applyEdit(edit);

                this.#requisitions!.executeRemote("editorLoadNotebook", { content, standalone: true });
            }
        }

        return true;
    };
}
