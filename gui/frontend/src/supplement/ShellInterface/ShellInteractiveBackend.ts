/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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

import { ISendRequestParameters, ResponsePromise} from "../../communication/MessageScheduler.js";
import type { IProtocolResults } from "../../communication/ProtocolResultMapper.js";

/**
 * A backend that can send a “interactive” request to the server and
 * receive a strongly‑typed response promise.
 *
 * The generic type `K` is a key of the protocol‑result map, which
 * guarantees that the returned `ResponsePromise` matches the shape of
 * the expected result.
 */
export interface IShellInteractiveBackend {
    /**
     * Sends an interactive request to the server.
     *
     * @param details    The request description (type, parameters, …).
     * @param useExecute When **true** (default) the request is wrapped in an
     *                   `Execute` message; when **false** it is sent as‑is.
     *
     * @returns A `ResponsePromise` that resolves to the result described by
     *          the generic key `K`.
     */
    sendInteractiveRequest<
        K extends keyof IProtocolResults
    >(
        details: ISendRequestParameters<K>,
        useExecute?: boolean
    ): Promise<ResponsePromise<K>>;
}
