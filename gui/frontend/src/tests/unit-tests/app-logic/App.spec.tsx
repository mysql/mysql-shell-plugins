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

import { mount } from "enzyme";
import React from "react";

import { App } from "../../../app-logic/App";
import { IStatusbarInfo } from "../../../app-logic/Types";
import { currentConnection } from "../../../communication";
import { IEditorStatusInfo } from "../../../modules/SQLNotebook";
import { appParameters, requisitions } from "../../../supplement/Requisitions";
import { waitFor } from "../../../utilities/helpers";
import { MySQLShellLauncher } from "../../../utilities/MySQLShellLauncher";
import { dispatchErrorResponse, setupShellForTests, snapshotFromWrapper } from "../test-helpers";
import { eventMock } from "../__mocks__/MockEvents";

describe("Application tests", () => {
    let app: ReturnType<typeof mount>;
    let launcher: MySQLShellLauncher;

    const started = (): Promise<void> => {
        return new Promise((resolve) => {
            const loaded = (): Promise<boolean> => {
                requisitions.unregister("applicationDidStart", loaded);
                resolve();

                return Promise.resolve(true);
            };

            requisitions.register("applicationDidStart", loaded);
        });
    };

    beforeAll(async () => {
        // No automatic login takes place here, like in other tests. The app will trigger the login.
        launcher = await setupShellForTests("Application", false, false);
        expect(currentConnection.isConnected).toBe(false);

        app = mount(
            <App />,
        );
        await started();
    });

    afterAll(async () => {
        const event = new Event("beforeunload");
        expect(window.dispatchEvent(event)).toBe(true);

        currentConnection.disconnect();
        expect(currentConnection.isConnected).toBe(false);

        app.unmount();

        await launcher.exitProcess();
    });

    it("Application readiness", () => {
        // Note: at this point the app should be fully up and debugging the code seems to show that the
        //       application host is rendered. Yet the snapshot still shows the login page.
        //       What's even more confusing is that we come here, because the application host sent a message
        //       that it was mounted. Need to investigate later.
        expect(app.state("loginInProgress")).toEqual(false);

        expect(snapshotFromWrapper(app)).toMatchSnapshot();
    });

    it("Fake error event", async () => {
        await dispatchErrorResponse();
    });

    it("Handling status bar click events", async () => {
        let result = await requisitions.execute("statusBarButtonClick", { type: "dummy", event: eventMock });
        expect(result).toBe(false);

        result = await requisitions.execute("statusBarButtonClick", { type: "openPopupMenu", event: eventMock });
        expect(result).toBe(true);
    });

    it("Handling status bar update events", async () => {
        let lastItems: IStatusbarInfo[] = [];
        const listener = (items: IStatusbarInfo[]): Promise<boolean> => {
            lastItems = items;

            return Promise.resolve(true);
        };

        requisitions.register("updateStatusbar", listener);

        const statusInfo: IEditorStatusInfo = {};

        let result = await requisitions.execute("editorInfoUpdated", statusInfo);
        expect(result).toBe(true);
        expect(lastItems).toEqual([]);

        statusInfo.indentSize = 4;
        statusInfo.tabSize = 4;
        result = await requisitions.execute("editorInfoUpdated", statusInfo);
        expect(result).toBe(true);
        expect(lastItems).toEqual([{
            id: "editorIndent",
            visible: true,
            text: "Tab Size: 4",
        }]);

        statusInfo.insertSpaces = true;
        result = await requisitions.execute("editorInfoUpdated", statusInfo);
        expect(result).toBe(true);
        expect(lastItems).toEqual([{
            id: "editorIndent",
            visible: true,
            text: "Spaces: 4",
        }]);

        delete statusInfo.indentSize;
        result = await requisitions.execute("editorInfoUpdated", statusInfo);
        expect(result).toBe(true);
        expect(lastItems).toEqual([{
            id: "editorIndent",
            visible: true,
            text: "Spaces: 0",
        }]);

        statusInfo.indentSize = -1;
        delete statusInfo.tabSize;
        statusInfo.insertSpaces = false;
        result = await requisitions.execute("editorInfoUpdated", statusInfo);
        expect(result).toBe(true);
        expect(lastItems).toEqual([{
            id: "editorIndent",
            visible: true,
            text: "Tab Size: 0",
        }]);

        statusInfo.line = 22;
        result = await requisitions.execute("editorInfoUpdated", statusInfo);
        expect(result).toBe(true);
        expect(lastItems).toEqual([{
            id: "editorIndent",
            visible: true,
            text: "Tab Size: 0",
        },
        {
            id: "editorPosition",
            visible: true,
            text: "Ln 22, Col 1",
        }]);

        delete statusInfo.indentSize;
        statusInfo.column = 33;
        result = await requisitions.execute("editorInfoUpdated", statusInfo);
        expect(result).toBe(true);
        expect(lastItems).toEqual([{
            id: "editorPosition",
            visible: true,
            text: "Ln 22, Col 33",
        }]);

        delete statusInfo.line;
        result = await requisitions.execute("editorInfoUpdated", statusInfo);
        expect(result).toBe(true);
        expect(lastItems).toEqual([{
            id: "editorPosition",
            visible: true,
            text: "Ln 1, Col 33",
        }]);

        statusInfo.language = "JavaScript";
        result = await requisitions.execute("editorInfoUpdated", statusInfo);
        expect(result).toBe(true);
        expect(lastItems).toEqual([{
            id: "editorPosition",
            visible: true,
            text: "Ln 1, Col 33",
        },
        {
            id: "editorLanguage",
            visible: true,
            text: "JavaScript",
        }]);

        statusInfo.eol = "LF";
        result = await requisitions.execute("editorInfoUpdated", statusInfo);
        expect(result).toBe(true);
        expect(lastItems).toEqual([{
            id: "editorPosition",
            visible: true,
            text: "Ln 1, Col 33",
        },
        {
            id: "editorLanguage",
            visible: true,
            text: "JavaScript",
        },
        {
            id: "editorEOL",
            visible: true,
            text: "LF",
        }]);

        statusInfo.indentSize = 4;
        statusInfo.tabSize = 4;
        result = await requisitions.execute("editorInfoUpdated", statusInfo);
        expect(result).toBe(true);
        expect(lastItems).toEqual([{
            id: "editorIndent",
            visible: true,
            text: "Tab Size: 4",
        },
        {
            id: "editorPosition",
            visible: true,
            text: "Ln 1, Col 33",
        },
        {
            id: "editorLanguage",
            visible: true,
            text: "JavaScript",
        },
        {
            id: "editorEOL",
            visible: true,
            text: "LF",
        }]);

        requisitions.unregister("updateStatusbar", listener);
    });

    it("DOM events", () => {
        const event = new MouseEvent("contextmenu", { cancelable: true });
        expect(event.defaultPrevented).toBe(false);
        expect(window.document.body.dispatchEvent(event)).toBe(false); // It's cancelled in App.tsx.
        expect(event.defaultPrevented).toBe(true);
    });

    it("Other events", async () => {
        let messageSent = false;

        // Pretend we are embedded.
        appParameters.embedded = true;
        const listener = (event: MessageEvent): void => {
            if (event.data.command === "themeChanged" && event.data.source === "app") {
                if (event.data.data.name === "My Theme" && event.data.data.type === "dark") {
                    messageSent = true;
                }
            }
        };

        window.addEventListener("message", listener);
        const listenerPromise = waitFor(1000, () => {
            return messageSent;
        });

        const requisitionPromise = await requisitions.execute("themeChanged", {
            name: "My Theme",
            type: "dark",
            values: {
                name: "Color 1",
            },
        });
        const result = await Promise.all([listenerPromise, requisitionPromise]);
        expect(result.length).toBe(2);
        expect(result[0]).toBe(true);
        expect(result[1]).toBe(true);

        window.removeEventListener("message", listener);
    });
});
