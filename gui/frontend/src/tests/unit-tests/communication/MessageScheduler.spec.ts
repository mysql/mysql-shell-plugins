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

import { afterEach, describe, expect, it } from "vitest";

import { MessageScheduler, type IConnectionOptions } from "../../../communication/MessageScheduler.js";
import { appParameters } from "../../../supplement/AppParameters.js";

class MockWebSocket {
    public readonly CONNECTING = 0;
    public readonly OPEN = 1;
    public readyState = this.CONNECTING;

    public addEventListener(type: string, listener: EventListener): void {
        if (type === "open") {
            queueMicrotask(() => {
                this.readyState = this.OPEN;
                listener(new Event("open"));
            });
        }
    }

    public connect(): void {
        this.readyState = this.OPEN;
    }

    public close(): void {
        this.readyState = 3;
    }

    public send(): void {
        // No-op.
    }
}

class TestMessageScheduler extends MessageScheduler {
    public target?: URL;

    public static create(): TestMessageScheduler {
        return new TestMessageScheduler();
    }

    protected override createConnection(target: URL, _options: IConnectionOptions): ReturnType<MessageScheduler["createConnection"]> {
        this.target = new URL(target);

        return new MockWebSocket() as ReturnType<MessageScheduler["createConnection"]>;
    }
}

describe("MessageScheduler", () => {
    afterEach(() => {
        appParameters.inDevelopment = false;
        appParameters.inExtension = false;
    });

    it("uses the backend development port outside the VS Code extension", async () => {
        const scheduler = TestMessageScheduler.create();

        appParameters.inDevelopment = true;
        appParameters.inExtension = false;

        await scheduler.connect({ url: new URL("http://127.0.0.1:3001/?token=test") });

        expect(scheduler.target?.href).toBe("ws://127.0.0.1:8000/ws1.ws?token=test");

        scheduler.disconnect();
    });

    it("keeps the supplied backend port inside the VS Code extension", async () => {
        const scheduler = TestMessageScheduler.create();

        appParameters.inDevelopment = true;
        appParameters.inExtension = true;

        await scheduler.connect({ url: new URL("https://localhost:33336/?token=test") });

        expect(scheduler.target?.href).toBe("wss://localhost:33336/ws1.ws?token=test");

        scheduler.disconnect();
    });
});
