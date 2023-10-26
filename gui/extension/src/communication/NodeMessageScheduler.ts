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

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { default as NodeWebSocket } from "ws";

import { IConnectionOptions, MessageScheduler } from "../../../frontend/src/communication/MessageScheduler.js";

/** An extended message scheduler for tasks only used in the extension. */
export class NodeMessageScheduler extends MessageScheduler {
    protected static createInstance(): MessageScheduler {
        return new NodeMessageScheduler();
    }

    protected createWebSocket(target: URL, options: IConnectionOptions): WebSocket {
        let ca;
        if (options.shellConfigDir) {
            const caFile = join(options.shellConfigDir, "plugin_data/gui_plugin/web_certs/rootCA.crt");

            if (existsSync(caFile)) {
                ca = readFileSync(caFile);
            }
        }

        return new NodeWebSocket(target, { ca }) as unknown as WebSocket;
    }
}
