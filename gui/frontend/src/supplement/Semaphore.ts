/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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

interface IWaiter<T> {
    timeout: ReturnType<typeof setTimeout> | null;
    resolve: (noRemove: boolean, value?: T) => void;
}

type SemaphoreResult<T> = T extends undefined ? boolean : T;

/**
 * A class that implements a semaphore behavior, which allows multiple consumers to wait for an event.
 * Useful for code that needs to wait for a specific condition.
 *
 * @param T The type of the value that is passed to the waiters.
 */
export class Semaphore<T = void> {
    // The list of waiters (promises) that are waiting for a notification.
    #waiters: Array<IWaiter<T>> = [];

    /**
     * Adds a new waiter to the semaphore, to be notified when one of the notification methods is called.
     *
     * @param timeout An optional timeout value (in milliseconds).
     *
     * @returns A promise that resolves to true if triggered by a notification, otherwise false (in case of a timeout).
     *          If a value was specified in the notification, the promise resolves to that value.
     */
    public wait(timeout?: number): Promise<SemaphoreResult<T>> {
        const waiter: IWaiter<T> = { timeout: null, resolve: () => { /**/ } };
        this.#waiters.push(waiter);
        const promise = new Promise<SemaphoreResult<T>>((resolve) => {
            let resolved = false;
            waiter.resolve = (noRemove: boolean, value?: T) => {
                if (resolved) {
                    return;
                }

                resolved = true;
                if (waiter.timeout) {
                    clearTimeout(waiter.timeout);
                    waiter.timeout = null;
                }

                if (!noRemove) {
                    const pos = this.#waiters.indexOf(waiter);
                    if (pos > -1) {
                        this.#waiters.splice(pos, 1);
                    }
                }

                if (value === undefined) {
                    resolve(true as SemaphoreResult<T>);
                } else {
                    resolve(value as SemaphoreResult<T>);
                }
            };
        });

        if (timeout !== undefined && timeout > 0 && isFinite(timeout)) {
            waiter.timeout = setTimeout(() => {
                waiter.timeout = null;
                waiter.resolve(false);
            }, timeout);
        }

        return promise;
    }

    /**
     * Notifies one waiter and removes that from the internal list of waiters.
     *
     * @param value An optional value that is passed to the waiter.
     */
    public notify(value?: T): void {
        const waiter = this.#waiters.pop();
        waiter?.resolve(true, value);
    }

    /**
     * Notifies all waiters in reverse order and clears the internal list.
     *
     * @param value An optional value that is passed to the waiters.
     */
    public notifyAll(value?: T): void {
        const list = this.#waiters.reverse();
        this.#waiters = [];

        let waiter;
        while ((waiter = list.pop()) !== undefined) {
            waiter.resolve(true, value);
        }
    }
}
