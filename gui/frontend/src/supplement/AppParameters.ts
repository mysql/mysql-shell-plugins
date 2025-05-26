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

import type { IAppParameters } from "./RequisitionTypes.js";

/** A set of values passed to the application via URL parameters and a couple other application wide values. */
export const appParameters: Map<string, string> & IAppParameters = new Map<string, string>();

/**
 * Determines if the app is embedded and wires up message handlers for sending and receiving wrapper messages.
 * It also converts URL parameters to a map, for consumption in the app.
 */
export const parseAppParameters = (): void => {
    if (typeof window !== "undefined") {
        const queryParts = window.location.search.substring(1).split("&");
        queryParts.forEach((part) => {
            const elements = part.split("=");
            if (elements.length > 1) {
                appParameters.set(elements[0], elements[1]);

                if (elements[0] === "app") {
                    appParameters.embedded = true;
                } else if (elements[0] === "fontSize") {
                    const fontSize = parseInt(elements[1], 10);
                    if (!isNaN(fontSize)) {
                        appParameters.fontSize = fontSize;
                    }
                } else if (elements[0] === "editorFontSize") {
                    const fontSize = parseInt(elements[1], 10);
                    if (!isNaN(fontSize)) {
                        appParameters.editorFontSize = fontSize;
                    }
                }
            }
        });
    }

    if (process.env.NODE_ENV === "test") {
        appParameters.testsRunning = true;
    } else if (process.env.NODE_ENV === "development") {
        appParameters.inDevelopment = true;
    }

    // Test Explorer tests also run under VS Code control, but must not be treated as embedded.
    if (process.env.VSCODE_PID !== undefined && process.env.JEST_WORKER_ID === undefined) {
        appParameters.inExtension = true;
    }
};

