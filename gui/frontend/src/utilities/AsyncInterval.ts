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

const minIntervalMs = 10;
const maxIntervalMs = 2_147_483_647;

export type SetIntervalAsyncHandler<HandlerArgs extends unknown[]> =
    (...handlerArgs: HandlerArgs) => void | Promise<void>;

export class SetIntervalAsyncTimer<HandlerArgs extends unknown[]> {
    #handler: SetIntervalAsyncHandler<unknown[]>;
    #handlerArgs: unknown[];
    #intervalMs: number;
    #timeout?: ReturnType<typeof setTimeout>;
    #promise?: Promise<void>;
    #stopped = false;

    public constructor(handler: SetIntervalAsyncHandler<HandlerArgs>, intervalMs: number,
        ...handlerArgs: HandlerArgs) {
        this.#handler = handler as SetIntervalAsyncHandler<unknown[]>;
        this.#intervalMs = Math.min(Math.max(Math.trunc(intervalMs), minIntervalMs), maxIntervalMs);
        this.#handlerArgs = handlerArgs;
        this.#scheduleTimeout(this.#intervalMs);
    }

    public async stop(): Promise<void> {
        this.#stopped = true;

        if (this.#timeout) {
            clearTimeout(this.#timeout);
            this.#timeout = undefined;
        }

        if (this.#promise) {
            await this.#promise;
        }
    }

    #scheduleTimeout(delayMs: number): void {
        this.#timeout = setTimeout(() => {
            this.#timeout = undefined;
            this.#promise = this.#runHandlerAndScheduleTimeout();
            void this.#promise.then(() => {
                this.#promise = undefined;
            }, () => {
                this.#promise = undefined;
            });
        }, delayMs);
    }

    async #runHandlerAndScheduleTimeout(): Promise<void> {
        const startTimeMs = Date.now();

        try {
            await this.#handler(...this.#handlerArgs);
        } finally {
            if (!this.#stopped) {
                const executionTimeMs = Date.now() - startTimeMs;
                this.#scheduleTimeout(Math.max(this.#intervalMs - executionTimeMs, 0));
            }
        }
    }
}

export const setIntervalAsync = <HandlerArgs extends unknown[]>(
    handler: SetIntervalAsyncHandler<HandlerArgs>, intervalMs: number,
    ...handlerArgs: HandlerArgs): SetIntervalAsyncTimer<HandlerArgs> => {
    if (!(typeof handler === "function")) {
        throw new TypeError("First argument is not a function");
    }

    if (!(typeof intervalMs === "number")) {
        throw new TypeError("Second argument is not a number");
    }

    return new SetIntervalAsyncTimer(handler, intervalMs, ...handlerArgs);
};

export const clearIntervalAsync = async <HandlerArgs extends unknown[]>(
    timer: SetIntervalAsyncTimer<HandlerArgs>): Promise<void> => {
    if (!(timer instanceof SetIntervalAsyncTimer)) {
        throw new TypeError("First argument is not an instance of SetIntervalAsyncTimer");
    }

    await timer.stop();
};
