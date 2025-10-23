/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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
/* eslint-disable no-restricted-syntax */

import type { IAppParameters } from "./RequisitionTypes.js";

/** A set of values passed to the application via URL parameters and a couple other application wide values. */
export const appParameters: Map<string, string> & IAppParameters = new Map<string, string>();

/**
 * Determines if the app is embedded and wires up message handlers for sending and receiving wrapper messages.
 * It also converts URL parameters to a map, for consumption in the app.
 */
export const parseAppParameters = (): void => {
    appParameters.embedded = false;
    appParameters.hideStatusBar = false;
    appParameters.testsRunning = false;
    appParameters.inDevelopment = false;
    appParameters.inExtension = false;

    if (typeof window !== "undefined") {
        const search = new URLSearchParams(window.location.search);

        for (const [queryParam, value] of search) {
            appParameters.set(queryParam, value);

            if (queryParam === "app") {
                appParameters.embedded = true;
                appParameters.hideStatusBar = true;

                continue;
            }

            if (queryParam === "fontSize" || queryParam === "editorFontSize") {
                const numericValue = parseInt(value, 10);
                if (!isNaN(numericValue)) {
                    appParameters[queryParam] = numericValue;
                }
            } else if (queryParam === "subApp") {
                appParameters[queryParam] = value;
            }
        }
    }

    if (globalThis.testConfig) {
        appParameters.testsRunning = true;
    } else if (globalThis.VITE_MODE === "development") { // Will be replaced by Vite, but is not defined in tests.
        appParameters.inDevelopment = true;
    }

    // Test Explorer tests also run under VS Code control, but must not be treated as embedded.
    if (typeof process === "undefined") {
        return;
    }

    const env = process.env;
    if ((env.VSCODE_PID !== undefined || env.TERM_PROGRAM === "vscode") && !appParameters.testsRunning) {
        appParameters.inExtension = true;
    }
};
