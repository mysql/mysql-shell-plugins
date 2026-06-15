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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearIntervalAsync, setIntervalAsync } from "../../../utilities/AsyncInterval.js";

describe("AsyncInterval tests", (): void => {
    beforeEach(() => {
        vi.useRealTimers();
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2100-10-12T09:09:09Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("passes handler arguments", async () => {
        const handler = vi.fn();
        const timer = setIntervalAsync(handler, 20, "one", 2);

        await vi.advanceTimersByTimeAsync(20);

        expect(handler).toHaveBeenCalledWith("one", 2);
        await clearIntervalAsync(timer);
    });

    it("does not run overlapping handlers", async () => {
        let resolveHandler: (() => void) | undefined;
        let activeHandlers = 0;
        let maxActiveHandlers = 0;

        const timer = setIntervalAsync(async () => {
            ++activeHandlers;
            maxActiveHandlers = Math.max(maxActiveHandlers, activeHandlers);

            await new Promise<void>((resolve) => {
                resolveHandler = resolve;
            });

            --activeHandlers;
        }, 20);

        await vi.advanceTimersByTimeAsync(20);
        await vi.advanceTimersByTimeAsync(100);

        expect(maxActiveHandlers).toBe(1);
        expect(activeHandlers).toBe(1);

        resolveHandler?.();
        await clearIntervalAsync(timer);

        expect(activeHandlers).toBe(0);
    });

    it("schedules the next run only after the previous handler settles", async () => {
        const calls: number[] = [];
        let resolveHandler: (() => void) | undefined;

        const timer = setIntervalAsync(async () => {
            calls.push(Date.now());

            await new Promise<void>((resolve) => {
                resolveHandler = resolve;
            });
        }, 20);

        await vi.advanceTimersByTimeAsync(20);
        await vi.advanceTimersByTimeAsync(100);
        expect(calls).toHaveLength(1);

        resolveHandler?.();
        await vi.advanceTimersByTimeAsync(0);
        expect(calls).toHaveLength(2);

        resolveHandler?.();
        await clearIntervalAsync(timer);
    });

    it("stops future executions when cleared", async () => {
        const handler = vi.fn();
        const timer = setIntervalAsync(handler, 20);

        await vi.advanceTimersByTimeAsync(20);
        await clearIntervalAsync(timer);
        await vi.advanceTimersByTimeAsync(100);

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("waits for an active execution to complete when cleared", async () => {
        let completed = false;
        let resolveHandler: (() => void) | undefined;

        const timer = setIntervalAsync(async () => {
            await new Promise<void>((resolve) => {
                resolveHandler = resolve;
            });

            completed = true;
        }, 20);

        await vi.advanceTimersByTimeAsync(20);

        const clearPromise = clearIntervalAsync(timer);
        await vi.advanceTimersByTimeAsync(100);
        expect(completed).toBe(false);

        resolveHandler?.();
        await clearPromise;

        expect(completed).toBe(true);
    });

    it("validates arguments", async () => {
        expect(() => {
            setIntervalAsync("not a function" as never, 20);
        }).toThrow(TypeError);

        expect(() => {
            setIntervalAsync(() => { /**/ }, "20" as never);
        }).toThrow(TypeError);

        await expect(clearIntervalAsync({} as never)).rejects.toThrow(TypeError);
    });
});
