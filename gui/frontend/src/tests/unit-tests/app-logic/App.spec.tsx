/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

import { mount } from "enzyme";

import { App } from "../../../app-logic/App.js";
import { MessageScheduler } from "../../../communication/MessageScheduler.js";
import { appParameters, requisitions } from "../../../supplement/Requisitions.js";
import { MySQLShellLauncher } from "../../../utilities/MySQLShellLauncher.js";
import { waitFor } from "../../../utilities/helpers.js";
import { mouseEventMock } from "../__mocks__/EventMocks.js";
import { setupShellForTests } from "../test-helpers.js";

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
        launcher = await setupShellForTests(false, false);
        expect(MessageScheduler.get.isConnected).toBe(false);

        expect(requisitions.registrations("dialogResponse")).toBe(1);

        app = mount(<App />);
        await started();

        expect(requisitions.registrations("dialogResponse")).toBe(2);
    });

    afterAll(async () => {
        const event = new Event("beforeunload");
        expect(window.dispatchEvent(event)).toBe(true);

        MessageScheduler.get.disconnect();
        expect(MessageScheduler.get.isConnected).toBe(false);

        app.unmount();

        await launcher.exitProcess();
    });

    it("Application readiness", () => {
        // Note: at this point the app should be fully up and debugging the code seems to show that the
        //       application host is rendered. Yet the snapshot still shows the login page.
        //       What's even more confusing is that we come here, because the application host sent a message
        //       that it was mounted. Need to investigate later.
        expect(app.state("loginInProgress")).toEqual(false);

        expect(app).toMatchSnapshot();
    });

    it("Handling status bar click events", async () => {
        let result = await requisitions.execute("statusBarButtonClick", { type: "dummy", event: mouseEventMock });
        expect(result).toBe(false);

        result = await requisitions.execute("statusBarButtonClick", { type: "openPopupMenu", event: mouseEventMock });
        expect(result).toBe(true);
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
            safeName: "My-Theme",
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
