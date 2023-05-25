/*
 * Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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

import { ComponentChild } from "preact";
import { CommonWrapper, ReactWrapper } from "enzyme";

import fs from "fs";
import path from "path";
import os from "os";

import { appParameters, requisitions } from "../../supplement/Requisitions";
import { webSession } from "../../supplement/WebSession";
import { LogLevel, MySQLShellLauncher } from "../../utilities/MySQLShellLauncher";
import { ShellInterface } from "../../supplement/ShellInterface/ShellInterface";

export const loremIpsum = "Lorem ipsum dolor sit amet, consectetur adipisci elit, " +
    "sed eiusmod tempor incidunt ut labore et dolore magna aliqua.";

export type JestReactWrapper<P = {}, S = unknown> =
    ReactWrapper<Readonly<P> & Readonly<{ children?: ComponentChild; }>, Readonly<S>>;

export interface ITestDbCredentials {
    userName: string;
    port: number;
    host: string;
    password?: string;
}

/**
 * Promisified version of a component's setState function. Our Component class contains this as well,
 * but it cannot be used in tests, it seems.
 *
 * @param component The component to set the new state for.
 * @param state The new state.
 *
 * @returns A promise that fulfills when setState has finished.
 */
export const stateChange = <P, S>(component: CommonWrapper<P, S>, state: object): Promise<void> => {
    return new Promise((resolve) => {
        component.setState(state, () => {
            resolve();
        });
    });
};

const versionPattern = /^\[(<|<=|>|>=|=)(\d{5})\]/;
const relationMap = new Map<string, number>([
    ["<", 0], ["<=", 1], ["=", 2], [">=", 3], [">", 4],
]);

/** Information about a statement with version information. */
interface IVersionCheckResult {
    /** True if the version in the statement matched a given version. */
    matched: boolean;

    /** The statement with stripped version information. */
    statement: string;

    /** The found version. Can be 0 if the statement contains no version. */
    version: number;
}

/**
 * Determines if the version info in the statement matches the given version (if there's version info at all).
 * The version info is removed from the statement, if any.
 *
 * @param statement The statement with an optional version part at the beginning.
 * @param serverVersion The server version to match the version part against.
 *
 * @returns The check result.
 */
export const checkStatementVersion = (statement: string, serverVersion: number): IVersionCheckResult => {
    const result: IVersionCheckResult = {
        matched: true,
        statement,
        version: serverVersion,
    };

    const matches = statement.match(versionPattern);
    if (matches) {
        result.statement = statement.replace(versionPattern, "");

        const relation = matches[1];
        result.version = parseInt(matches[2], 10);

        switch (relationMap.get(relation)) {
            case 0: {
                if (serverVersion >= result.version) {
                    result.matched = false;
                }
                --result.version;

                break;
            }

            case 1: {
                if (serverVersion > result.version) {
                    result.matched = false;
                }
                break;
            }

            case 2: {
                if (serverVersion !== result.version) {
                    result.matched = false;
                }
                break;
            }

            case 3: {
                if (serverVersion < result.version) {
                    result.matched = false;
                }
                break;
            }

            case 4: {
                if (serverVersion <= result.version) {
                    result.matched = false;
                }
                ++result.version;

                break;
            }

            default:
        }
    }

    return result;
};

/**
 * Similar like checkStatementVersion, but only extracts the statement version and checks that against the given
 * minimum version. Relational operators are only used to adjust the extracted version.
 *
 * @param statement The statement with an optional version part at the beginning.
 * @param minimumVersion The server version to match the version part against.
 *
 * @returns The check result.
 */
export const checkMinStatementVersion = (statement: string, minimumVersion: number): IVersionCheckResult => {
    const result: IVersionCheckResult = {
        matched: true,
        statement,
        version: minimumVersion,
    };

    const matches = statement.match(versionPattern);
    if (matches) {
        result.statement = statement.replace(versionPattern, "");

        const relation = matches[1];
        result.version = parseInt(matches[2], 10);

        switch (relationMap.get(relation)) {
            case 0: { // Less than the given version.
                --result.version;

                break;
            }

            case 4: { // Greater than the given version.
                ++result.version;

                break;
            }

            default:
        }
    }

    result.matched = result.version >= minimumVersion;

    return result;
};

/**
 * Jest doesn't have a fail() function, so we have to provide one.
 * The disadvantage of this solution is that the tests immediately stop, instead continuing with other cases.
 *
 * @param message The message to show.
 */
export const fail = (message: string): void => {
    throw new Error(message);
};

/**
 * Allows to wait for the next tick in a Node.js event phase (of which the run loop is made of).
 * See also: https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick/#process-nexttick
 *
 * @returns A promise which fulfills on the next process tick.
 */
export const nextProcessTick = async (): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    return new Promise(process.nextTick);
};

/**
 * Allows to wait for the next Node.js run loop, after all I/O tasks, micro tasks and tick callbacks were processed.
 *
 * @returns A promise which fulfills when setTimeout callbacks are executed (which are the last tasks in a run loop).
 */
export const nextRunLoop = async (): Promise<void> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, 0);
    });
};

/**
 * Sends a specific keycode to the given element.
 *
 * @param code The key code to send.
 * @param element The target element to dispatch the keypress for. Default is document.body.
 */
export const sendKeyPress = (code: string, element: Element = document.body): void => {
    let event = new KeyboardEvent("keydown", { key: code, bubbles: true });
    element.dispatchEvent(event);
    event = new KeyboardEvent("keyup", { key: code, bubbles: true });
    element.dispatchEvent(event);
};

/**
 * Sets the given value for an input element and triggers its input event.
 * Note: The approach used here circumvents all React handling, re-rendering and so on. It therefore does not require
 *       to store the given value anywhere (like it is required for controlled components).
 *
 * @param element The element to receive the value. Must be an HTMLInputElement or the call has no effect.
 * @param value The value to set.
 */
export const changeInputValue = (element: Element, value: string): void => {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = value;
        const e = new Event("input", { bubbles: true });
        element.dispatchEvent(e);
    }
};

/**
 * Sends an event to the active element that simulates the onBlur event on it. Sending a blur event, however, doesn't
 * work. Instead focusout is sent, which has the desired effect.
 */
export const sendBlurEvent = (): void => {
    if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) {
        const e = new Event("focusout", { bubbles: true });
        document.activeElement.dispatchEvent(e);
    }
};

/**
 * Simulates a left click on the given element.
 *
 * @param element The element for which to simulate the left click event.
 */
export const sendLeftClick = (element: Element): void => {
    const ev1 = new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: false,
        view: window,
        button: 0,
        buttons: 0,
        clientX: element.getBoundingClientRect().x,
        clientY: element.getBoundingClientRect().y,
    });
    element.dispatchEvent(ev1);

    const ev2 = new MouseEvent("mouseup", {
        bubbles: true,
        cancelable: false,
        view: window,
        button: 0,
        buttons: 0,
        clientX: element.getBoundingClientRect().x,
        clientY: element.getBoundingClientRect().y,
    });
    element.dispatchEvent(ev2);
};

/**
 * Simulates a right click (including context menu event) on the given element.
 *
 * @param element The element for which to simulate the right click event.
 */
export const sendRightClick = (element: Element): void => {
    const ev1 = new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: false,
        view: window,
        button: 2,
        buttons: 2,
        clientX: element.getBoundingClientRect().x,
        clientY: element.getBoundingClientRect().y,
    });
    element.dispatchEvent(ev1);

    const ev2 = new MouseEvent("mouseup", {
        bubbles: true,
        cancelable: false,
        view: window,
        button: 2,
        buttons: 0,
        clientX: element.getBoundingClientRect().x,
        clientY: element.getBoundingClientRect().y,
    });
    element.dispatchEvent(ev2);

    const ev3 = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: false,
        view: window,
        button: 2,
        buttons: 0,
        clientX: element.getBoundingClientRect().x,
        clientY: element.getBoundingClientRect().y,
    });
    element.dispatchEvent(ev3);
};

/**
 * Simulates an entering, moving and leaving mouse pointer.
 *
 * @param element The element for which to simulate the events.
 * @param includeTouch When true also touch start, move and end are triggered.
 */
export const sendPointerMoveSequence = async (element: Element, includeTouch = false): Promise<void> => {
    const event1 = new MouseEvent("pointerenter", {
        bubbles: true,
        cancelable: false,
        view: window,
        clientX: element.getBoundingClientRect().x,
        clientY: element.getBoundingClientRect().y,
    });
    element.dispatchEvent(event1);
    await nextProcessTick();

    const event2 = new MouseEvent("pointermove", {
        bubbles: true,
        cancelable: false,
        view: window,
        clientX: element.getBoundingClientRect().x,
        clientY: element.getBoundingClientRect().y,
    });
    element.dispatchEvent(event2);
    await nextProcessTick();

    const event3 = new MouseEvent("pointerleave", {
        bubbles: true,
        cancelable: false,
        view: window,
        clientX: element.getBoundingClientRect().x,
        clientY: element.getBoundingClientRect().y,
    });
    element.dispatchEvent(event3);
    await nextProcessTick();

    if (includeTouch) {
        const event4 = new MouseEvent("touchstart", {
            bubbles: true,
            cancelable: false,
            view: window,
            clientX: element.getBoundingClientRect().x,
            clientY: element.getBoundingClientRect().y,
        });
        element.dispatchEvent(event4);
        await nextProcessTick();

        const event5 = new MouseEvent("touchmove", {
            bubbles: true,
            cancelable: false,
            view: window,
            clientX: element.getBoundingClientRect().x,
            clientY: element.getBoundingClientRect().y,
        });
        element.dispatchEvent(event5);
        await nextProcessTick();

        const event6 = new MouseEvent("touchend", {
            bubbles: true,
            cancelable: false,
            view: window,
            clientX: element.getBoundingClientRect().x,
            clientY: element.getBoundingClientRect().y,
        });
        element.dispatchEvent(event6);
        await nextProcessTick();
    }
};

/**
 * Helper method to launch a MySQL Shell for a test suite and wait for it until it's fully up.
 *
 * @param showOutput If true then the shell output will be printed to the console (inline). Errors are always displayed.
 * @param handleEvents If this parameter is true, the function also subscribes to serverResponse and webSession events
 *                     to trigger authentication and waits until a profile is loaded. If false, the caller has to take
 *                     care of that.
 * @param logLevel The log level to use. Only relevant if showOutput is true.
 *
 * @returns A promise resolving to the created shell launcher. Use this to shut down the shell process when done.
 */
export const setupShellForTests = (showOutput: boolean, handleEvents = true,
    logLevel?: LogLevel): Promise<MySQLShellLauncher> => {

    // Create a test folder name with a random part, in the system's temp folder.
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), "msg-unit-tests"));

    return new Promise((resolve, reject) => {
        try {
            // Create that folder and add links to the shell plugins.
            fs.mkdirSync(targetDir + "/plugins", { recursive: true });
            fs.symlinkSync(path.resolve("../../../../backend/gui_plugin"), targetDir + "/plugins/gui_plugin");
            fs.symlinkSync(path.resolve("../../../../../mrs_plugin"), targetDir + "/plugins/mrs_plugin");
            fs.symlinkSync(path.resolve("../../../../../mds_plugin"), targetDir + "/plugins/mds_plugin");

            // And create a web root link in the gui_plugin, if not yet done.
            if (!fs.existsSync(targetDir + "/plugins/gui_plugin/core/webroot")) {
                fs.symlinkSync(path.resolve("../../../build"), targetDir + "/plugins/gui_plugin/core/webroot");
            }

            appParameters.set("shellUserConfigDir", path.resolve(targetDir));
        } catch (error) {
            reject(error);

            return;
        }

        const shellLauncher = new MySQLShellLauncher(
            (text) => {
                if (showOutput) {
                    console.log(text);
                }
            },
            (error) => {
                console.error(`\nError while setting up MySQL Shell connection: ${error.message}\n`);
            },
            () => { // Called on exit of the shell process.
                fs.rmSync(targetDir, { recursive: true, force: true });
            },
        );

        if (handleEvents) {
            requisitions.register("webSessionStarted", (data) => {
                webSession.sessionId = data.sessionUuid;
                webSession.localUserMode = data.localUserMode ?? false;

                // Session recovery is not supported in tests, so remove the else branch from test coverage.
                // istanbul ignore else
                if (webSession.userName === "") {
                    if (webSession.localUserMode) {
                        void ShellInterface.users.authenticate("LocalAdministrator", "")
                            .then((profile) => {
                                if (showOutput) {
                                    console.log("Shell connection established and user authenticated");
                                }

                                if (profile) {
                                    webSession.loadProfile(profile);
                                    void requisitions.execute("userAuthenticated", profile);
                                }
                            });
                    }
                } else {
                    webSession.loadProfile(data.activeProfile);
                }

                return Promise.resolve(true);
            });

            const loaded = (): Promise<boolean> => {
                requisitions.unregister("profileLoaded", loaded);
                resolve(shellLauncher);

                return Promise.resolve(true);
            };

            requisitions.register("profileLoaded", loaded);
        }

        shellLauncher.startShellAndConnect(".", false, logLevel);

        if (!handleEvents) {
            // If events are handled then the promise is resolved when a profile is loaded.
            resolve(shellLauncher);
        }
    });
};

/**
 * @returns a set of DB credentials for tests.
 */
export const getDbCredentials = (): ITestDbCredentials => {
    return {
        // cspell:ignore DBUSERNAME DBPASSWORD DBHOST DBPORT
        userName: process.env.DBUSERNAME ?? "root",
        password: process.env.DBPASSWORD ?? "",
        host: process.env.DBHOST ?? "localhost",
        port: process.env.DBPORT ? parseInt(process.env.DBPORT, 10) : 3306,
    };
};

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Copies an entire folder structure from `from` to `to`, recursively.
 *
 * @param from The source folder to copy from.
 * @param to The target folder to place the copy in.
 */
export const copyFolderSync = (from: string, to: string): void => {
    fs.mkdirSync(to);
    fs.readdirSync(from).forEach((element) => {
        if (fs.lstatSync(path.join(from, element)).isFile()) {
            fs.copyFileSync(path.join(from, element), path.join(to, element));
        } else {
            copyFolderSync(path.join(from, element), path.join(to, element));
        }
    });
};
