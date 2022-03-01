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

import * as net from "net";

import { window, ProgressLocation } from "vscode";
import { waitFor } from "../../frontend/src/utilities/helpers";

export const findFreePort = (): Promise<number> => {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        let calledFn = false;

        server.on("error", (err) => {
            server.close();

            if (!calledFn) {
                calledFn = true;
                reject(err);
            }
        });

        server.listen(0, () => {
            const address = server.address();
            if (!address || typeof address === "string" || address.port === 0) {
                reject(new Error("Unable to get a port for the backend"));
            } else {
                server.close();

                if (!calledFn) {
                    calledFn = true;
                    resolve(address.port);
                }
            }
        });

    });
};

/**
 * Shows a message that auto closes after a certain timeout. Since there's no API for this functionality the
 * progress output is used instead, which auto closes at 100%.
 * This means the function cannot (and should not) be used for warnings or errors. These types of message require
 * the user to really take note.
 *
 * @param message The message to show.
 * @param timeout The time in milliseconds after which the message should close (default 3secs).
 */
export const showMessageWithTimeout = (message: string, timeout = 3000): void => {
    void window.withProgress(
        {
            location: ProgressLocation.Notification,
            title: message,
            cancellable: false,
        },

        async (progress): Promise<void> => {
            await waitFor(timeout, () => { return false; });
            progress.report({ increment: 100 });
        },
    );
};
