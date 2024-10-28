/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

import { registerUiLayer } from "../../../app-logic/UILayer.js";
import {
    OdmEntityType, OpenDocumentDataModel, type OpenDocumentDataModelEntry,
} from "../../../data-models/OpenDocumentDataModel.js";
import { uiLayerMock } from "../__mocks__/UILayerMock.js";
import { checkNoUiWarningsOrErrors } from "../test-helpers.js";
import { connectionDetailsMock1, webviewProviderMock1, webviewProviderMock2 } from "./data-model-test-data.js";

const dataModelChanged = jest.fn();

describe("OpenDocumentDataModel", () => {
    const dataModel = new OpenDocumentDataModel();
    dataModel.subscribe(dataModelChanged);

    beforeAll(() => {
        registerUiLayer(uiLayerMock);
    });

    afterAll(() => {
        dataModel.unsubscribe(dataModelChanged);

        jest.restoreAllMocks();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        dataModelChanged.mockClear();
    });

    it("Roots", () => {
        // By default there's only one document (the connection overview).
        const roots = dataModel.roots;
        expect(roots).toHaveLength(1);

        roots[0].caption = "Connection Overview";
        expect(OpenDocumentDataModel.isDocumentType(roots[0].type, OdmEntityType.Overview)).toBe(true);
        expect(OpenDocumentDataModel.isDocumentType(roots[0].type, OdmEntityType.ConnectionPage)).toBe(false);

        checkNoUiWarningsOrErrors();
    });

    it("Clear", () => {
        // Clearing without an app provider.
        expect(dataModel.closeProvider()).toBe(true);
        expect(dataModel.roots).toHaveLength(1);

        // The given provider doesn't exist, so there's effect on the data model.
        expect(dataModel.closeProvider(webviewProviderMock1)).toBe(true);

        dataModel.openProvider(webviewProviderMock1);

        // Still only one root document. The added provider replaces the overview.
        expect(dataModel.roots).toHaveLength(1);
        expect(dataModel.roots[0].caption).toBe("Webview Provider 1");
        expect(dataModel.closeProvider(webviewProviderMock1)).toBe(true);

        checkNoUiWarningsOrErrors();
    });

    it("Providers", () => {
        // Start clean.
        expect(dataModel.closeProvider()).toBe(true);
        expect(dataModel.roots).toHaveLength(1);

        let provider1 = dataModel.openProvider(webviewProviderMock1);
        expect(provider1?.type).toBe(OdmEntityType.AppProvider);

        const foundProvider = dataModel.findProvider(webviewProviderMock1);
        expect(provider1).toBe(foundProvider);

        // There's no direct way to determine how many providers are registered. But the clear() method
        // returns different values depending on whether there are providers or not.
        const provider2 = dataModel.openProvider(webviewProviderMock2);
        expect(provider1).not.toBe(provider2);

        // With two providers in the DM the overview item is hidden.
        expect(dataModel.roots).toHaveLength(2);
        expect(dataModel.closeProvider()).toBe(true);

        dataModel.openProvider(webviewProviderMock1);
        dataModel.openProvider(webviewProviderMock1);
        dataModel.openProvider(webviewProviderMock2);
        dataModel.openProvider(webviewProviderMock1);
        dataModel.openProvider();
        expect(dataModel.roots).toHaveLength(2);

        // Now we get false because there are still remaining providers.
        expect(dataModel.closeProvider(webviewProviderMock1)).toBe(false);

        const roots = dataModel.roots;
        expect(roots[0].caption).toBe("Webview Provider 2");

        expect(dataModel.createUniqueCaption()).toBe("MySQL Shell (2)");
        expect(dataModel.createUniqueCaption()).toBe("MySQL Shell (2)");
        provider1 = dataModel.openProvider(webviewProviderMock1);
        provider1!.caption = "MySQL Shell (2)";
        expect(dataModel.createUniqueCaption()).toBe("MySQL Shell (3)");

        dataModel.closeProvider();
        expect(dataModel.createUniqueCaption()).toBe("MySQL Shell");

        checkNoUiWarningsOrErrors();
    });

    it("Connections", () => {
        expect(dataModel.closeProvider()).toBe(true);

        const provider1 = dataModel.openProvider(webviewProviderMock1);
        expect(provider1).not.toBeUndefined();

        const page = dataModel.addConnectionTab(webviewProviderMock1, connectionDetailsMock1[0]);
        const roots = dataModel.roots;
        expect(roots).toHaveLength(1);
        expect(roots[0]).toMatchObject(expect.objectContaining({
            type: OdmEntityType.AppProvider,
            caption: "Webview Provider 1",
        }));
        const children = roots[0].getChildren!();
        expect(children).toHaveLength(3);

        expect(children[0]).toMatchObject(expect.objectContaining({
            type: OdmEntityType.Overview,
            caption: "DB Connection Overview",
        }));
        expect(children[1]).toMatchObject(expect.objectContaining({
            type: OdmEntityType.ConnectionPage,
            caption: "Test connection",
        }));
        expect(children[2]).toMatchObject(expect.objectContaining({
            type: OdmEntityType.ShellSessionRoot,
            caption: "MySQL Shell Consoles",
        }));

        expect(children[1]).toBe(page);
        expect(page.getChildren!()).toHaveLength(0); // No open documents yet.
        expect(children[2].getChildren!()).toHaveLength(0); // No open shell sessions yet.

        expect(dataModel.isOpen(connectionDetailsMock1[0])).toBe(true);
        expect(dataModel.isOpen(connectionDetailsMock1[1])).toBe(false);

        let connections = dataModel.findConnections(undefined, 1);
        expect(connections).toHaveLength(0);

        connections = dataModel.findConnections(webviewProviderMock2, 1);
        expect(connections).toHaveLength(0);

        connections = dataModel.findConnections(webviewProviderMock1, 1);
        expect(connections).toHaveLength(1);

        dataModel.addConnectionTab(undefined, connectionDetailsMock1[1]);

        connections = dataModel.findConnections(webviewProviderMock2, 1);
        expect(connections).toHaveLength(0);

        connections = dataModel.findConnections(undefined, 1);
        expect(connections).toHaveLength(0);

        connections = dataModel.findConnections(undefined, 2);
        expect(connections).toHaveLength(1);

        checkNoUiWarningsOrErrors();
    });

    it("Documents", () => {
        expect(dataModel.closeProvider()).toBe(true);

        // We add a new document without explicitly opening a provider or connection. This will happen implicitly.
        let document: OpenDocumentDataModelEntry | undefined = dataModel.openDocument(webviewProviderMock1, {
            type: OdmEntityType.Script,
            parameters: {
                pageId: "1",
                id: "42",
                connection: connectionDetailsMock1[0],
                caption: "Script 1",
                language: "typescript",
            },
        });
        expect(document).toBeDefined();
        expect(document).toMatchObject(expect.objectContaining({
            type: OdmEntityType.Script,
            caption: "Script 1",
        }));

        expect(dataModel.findProvider(webviewProviderMock1)).toBeDefined();

        let roots = dataModel.roots;
        expect(roots).toHaveLength(1);

        let children = roots[0].getChildren!();
        expect(children).toHaveLength(3);

        document = dataModel.openDocument(webviewProviderMock1, {
            type: OdmEntityType.Notebook,
            parameters: {
                pageId: "1",
                id: "43",
                connection: connectionDetailsMock1[0],
                caption: "Notebook 10",
            },
        });

        // Adding the a document with an existing id returns the existing document.
        const document2 = dataModel.openDocument(webviewProviderMock1, {
            type: OdmEntityType.Script,
            parameters: {
                pageId: "1",
                id: "43",
                connection: connectionDetailsMock1[0],
                caption: "Test",
                language: "msg",
            },
        });
        expect(document).toBe(document2);

        let documents = dataModel.findConnectionDocumentsByType(webviewProviderMock1, 1, OdmEntityType.Script);
        expect(documents).toHaveLength(1);

        documents = dataModel.findConnectionDocumentsByType(webviewProviderMock1, 2, OdmEntityType.Script);
        expect(documents).toHaveLength(0);

        documents = dataModel.findConnectionDocumentsByType(webviewProviderMock1, 1, OdmEntityType.Notebook);
        expect(documents).toHaveLength(1);

        document = dataModel.findConnectionDocument(webviewProviderMock1, 1, "42");
        expect(document).toBeDefined();

        document = dataModel.findConnectionDocument(webviewProviderMock1, 0, "42");
        expect(document).toBeUndefined();

        document = dataModel.findConnectionDocument(webviewProviderMock1, -1, "42"); // -1 means any connection.
        expect(document).toBeDefined();

        document = dataModel.findConnectionDocument(webviewProviderMock1, 0, "22");
        expect(document).toBeUndefined();

        document = dataModel.findConnectionDocument(undefined, 1, "2"); // No provider means: default provider.
        expect(document).toBeUndefined();

        // Do the same steps again, but without a provider. This will use the built-in default provider.
        expect(dataModel.closeProvider()).toBe(true);

        // We add a new document without explicitly opening a provider or connection. This will happen implicitly.
        document = dataModel.openDocument(undefined, {
            type: OdmEntityType.Notebook,
            parameters: {
                pageId: "2",
                id: "24",
                connection: connectionDetailsMock1[1],
                caption: "Notebook 1",
            },
        });
        expect(document).toBeDefined();
        expect(document).toMatchObject(expect.objectContaining({
            type: OdmEntityType.Notebook,
            caption: "Notebook 1",
        }));

        // With the default provider being shown, the implicitly created connection page is added to the root,
        // besides the overview.
        roots = dataModel.roots;
        expect(roots).toHaveLength(2);
        expect(roots[1]).toMatchObject(expect.objectContaining({
            type: OdmEntityType.ConnectionPage,
            caption: "Test connection 2",
        }));

        children = roots[1].getChildren!();
        expect(children).toHaveLength(1);
        expect(children[0]).toBe(document);

        document = dataModel.findConnectionDocument(undefined, 0, "24");
        expect(document).toBeUndefined();

        dataModel.closeDocument(undefined, { pageId: "2", id: "24" });
        expect(children).toHaveLength(0);

        document = dataModel.findConnectionDocument(undefined, 0, "24");
        expect(document).toBeUndefined();

        checkNoUiWarningsOrErrors();
    });

    it("Standalone Documents", () => {
        expect(dataModel.closeProvider()).toBe(true);

        const document1 = dataModel.openDocument(webviewProviderMock1, {
            type: OdmEntityType.StandaloneDocument,
            parameters: {
                id: "42",
                caption: "Test",
                language: "msg",
            },
        });

        expect(document1).toBeDefined();
        expect(document1).toMatchObject(expect.objectContaining({
            type: OdmEntityType.StandaloneDocument,
            caption: "Test",
        }));

        const document2 = dataModel.openDocument(webviewProviderMock1, { // Same document again.
            type: OdmEntityType.StandaloneDocument,
            parameters: {
                id: "42",
                caption: "Test",
                language: "msg",
            },
        });

        expect(document1).toBe(document2);

        let documents = dataModel.findConnectionDocumentsByType(undefined, -1, OdmEntityType.StandaloneDocument);
        expect(documents).toHaveLength(0);
        documents = dataModel.findConnectionDocumentsByType(webviewProviderMock1, -1, OdmEntityType.StandaloneDocument);
        expect(documents).toHaveLength(1);

        dataModel.closeDocument(webviewProviderMock1, { pageId: "", id: "42" });
        documents = dataModel.findConnectionDocumentsByType(webviewProviderMock1, -1, OdmEntityType.StandaloneDocument);
        expect(documents).toHaveLength(0);

        checkNoUiWarningsOrErrors();
    });

    it("Shell Sessions", () => {
        expect(dataModel.closeProvider()).toBe(true);

        // Shell sessions can be opened either using `openDocument` or `addShellSession`.
        // The former uses the latter, but the latter is more explicit.
        const result = dataModel.openDocument(webviewProviderMock1, {
            type: OdmEntityType.ShellSession,
            parameters: {
                sessionId: "42",
                caption: "Test",
            },
        });
        expect(result).toBeDefined();

        const session = dataModel.addShellSession(webviewProviderMock1, { // Try again with the same shell details.
            sessionId: "42",
            caption: "Test",
        });
        expect(session).toBeDefined();
        expect(result).toBe(session); // This returns the same session.

        let roots = dataModel.roots;
        expect(roots).toHaveLength(1); // We used an app provider, so the overview is moved to that provider.
        expect(roots[0].getChildren!()).toHaveLength(2); // Overview and shell session root.

        expect(dataModel.closeProvider()).toBe(true);
        dataModel.addShellSession(undefined, { // Default provider.
            sessionId: "42",
            caption: "Test",
        });

        roots = dataModel.roots;
        expect(roots).toHaveLength(2);
        expect(roots[0].type).toBe(OdmEntityType.Overview);
        expect(roots[1].type).toBe(OdmEntityType.ShellSessionRoot);

        // Now add a shell session to another provider. This will hide the entries from the default provider.
        // Default and app providers are not mixed. The default is used if the app is not embedded.
        dataModel.addShellSession(webviewProviderMock2, {
            sessionId: "42",
            caption: "Test",
        });

        roots = dataModel.roots;
        expect(roots).toHaveLength(1);
        expect(roots[0].type).toBe(OdmEntityType.AppProvider);

        let children = roots[0].getChildren!();
        expect(children).toHaveLength(2); // Overview and shell session root.
        expect(children[0].type).toBe(OdmEntityType.Overview);
        expect(children[1].type).toBe(OdmEntityType.ShellSessionRoot);
        expect(children[1].getChildren!()).toHaveLength(1); // The shell session.

        // Remove the shell session from the provider.
        // Unlike documents, the shell session provider is not automatically closed when no more sessions are open.
        dataModel.removeShellSession(webviewProviderMock2, "42");
        expect(children[1].getChildren!()).toHaveLength(0);

        roots = dataModel.roots;
        expect(roots).toHaveLength(1);
        expect(roots[0].type).toBe(OdmEntityType.AppProvider);

        dataModel.closeProvider(webviewProviderMock2);

        // The default provider is back.
        roots = dataModel.roots;
        expect(roots).toHaveLength(2);
        expect(roots[0].type).toBe(OdmEntityType.Overview);
        expect(roots[1].type).toBe(OdmEntityType.ShellSessionRoot);

        dataModel.removeShellSession(webviewProviderMock2, "42"); // Does nothing, the provider is closed.
        dataModel.removeShellSession(undefined, "42");

        dataModel.updateSessions(webviewProviderMock1, [
            { sessionId: "42", caption: "Test 1" },
            { sessionId: "43", caption: "Test 2" },
        ]);

        roots = dataModel.roots;
        expect(roots).toHaveLength(1);
        expect(roots[0].type).toBe(OdmEntityType.AppProvider);
        expect(roots[0].getChildren!()).toHaveLength(2);

        dataModel.updateSessions(webviewProviderMock1, [
            { sessionId: "40", caption: "Test 1" },
            { sessionId: "42", caption: "Test 2" },
            { sessionId: "50", caption: "Test 3" },
            { sessionId: "60", caption: "Test 4" },
        ]);

        roots = dataModel.roots;
        expect(roots[0].getChildren!()).toHaveLength(2);
        expect(roots[0].type).toBe(OdmEntityType.AppProvider);

        children = roots[0].getChildren!();
        expect(children).toHaveLength(2);

        children = children[1].getChildren!();
        expect(children).toHaveLength(4);
        expect(children[2].caption).toBe("Test 3");

        checkNoUiWarningsOrErrors();
    });
});
