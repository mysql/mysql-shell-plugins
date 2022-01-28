/*
 * Copyright (c) 2020, 2021, Oracle and/or its affiliates.
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

import {
    dispatcher, IDispatchUnknownEvent, EventType, ListenerExecutor,
    IListenerThenable, ListenerCallback, ListenerEventSource,
} from "./";

export type EventFilter = (event: IDispatchUnknownEvent) => boolean;

export const eventFilterNoRequests = (event: IDispatchUnknownEvent): boolean => {
    return event.eventType !== EventType.Request;
};

export interface IListenerEntryOptions {
    persistent?: boolean;
    filters?: EventFilter[];
}

/**
 * Listener entry to add to the listeners container. Create one of these to call
 * addClassListener.
 */
export class ListenerEntry implements IListenerThenable {
    private static nextListenerId = 1;
    public id: number = ListenerEntry.nextListenerId++;
    public persistent = false;
    public filters: EventFilter[];

    public source?: ListenerEventSource;
    private hasSource = false;
    private errorContext: Error;
    private executors: ListenerExecutor[] = [];

    public constructor(options: IListenerEntryOptions, errorContext: Error = new Error()) {
        this.errorContext = errorContext;

        this.filters = [];
        if (options.filters) {
            this.filters = options.filters;
        }

        if (options.persistent) {
            this.persistent = options.persistent;
        }

    }

    public static create(options: IListenerEntryOptions, errorContext: Error = new Error()): ListenerEntry {
        const listener = new ListenerEntry(options, errorContext);
        dispatcher.listen(listener);

        return listener;
    }

    public static createByID(requestId: string, options: IListenerEntryOptions = {}): ListenerEntry {
        options.persistent = false;
        if (!options.filters) {
            options.filters = [];
        }
        options.filters.push((event: IDispatchUnknownEvent): boolean => {
            return event.id === requestId;
        });
        const listener = ListenerEntry.create(options);

        return listener;
    }

    public static createByClass(messageClass: string, options: IListenerEntryOptions = {}): ListenerEntry {
        if (!options.filters) {
            options.filters = [];
        }
        options.filters.push((event: IDispatchUnknownEvent): boolean => {
            return event.context.messageClass === messageClass;
        });

        return ListenerEntry.create(options);
    }

    /**
     * Wait for all listeners to get a value.
     *
     * @param entries The ListenerEntry array to wait for.
     *
     * @returns A listener that will be triggered as soon as all listeners in the entry have a value.
     */
    public static all(entries: ListenerEntry[]): ListenerEntry {
        const listener = new ListenerEntry({});
        const executor = new ListenerExecutor([]);

        const results: unknown[] = [];

        // Let the other listeners trigger the executor only and not the listener.
        // This allows us to wait for the .finally to trigger this listener.
        for (const entry of entries) {
            executor.then((event) => {
                return results.push(event);
            });

            entry.then((event: IDispatchUnknownEvent) => {
                return executor.execute(event);
            }).catch((error: Error) => {
                return executor.execute(error);
            });
        }
        executor.finally(() => {
            // XXX: the concept used here is unclear. The listener needs to trigger a single event source.
            //listener.trigger(results);
        });

        listener.addExecutor(executor);

        return listener;
    }

    /**
     * Create a new ListenerEntry that already has a value. Executors will be triggered
     * as soon as they're added to the listener.
     *
     * @param source The source to trigger.
     *
     * @returns a ready to use ListenerEntry.
     */
    public static resolve(source?: ListenerEventSource): ListenerEntry {
        const listener = new ListenerEntry({}, new Error());
        listener.trigger(source);

        return listener;
    }

    /**
     * Check if the event is supposed to be processed or not.
     *
     * @param event The event this method will check it the listener should process it or not
     * @returns true if the event is to be processed, false to skip it.
     */
    public filterEvent(event: IDispatchUnknownEvent): unknown {
        for (const filter of this.filters) {
            if (!filter(event)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Runs all executors of this listener.
     *
     * @param source The source for triggering executors.
     *
     * @returns Itself for listener chaining.
     */
    public trigger(source?: ListenerEventSource): ListenerEntry {
        this.source = source;
        this.hasSource = true;

        const resolved: ListenerExecutor[] = [];
        for (const executor of this.executors) {
            if (executor.execute(this.source)) {
                resolved.push(executor);
            }
        }

        if (!this.persistent) {
            this.removeExecutors(resolved);
        }

        return this;
    }

    public then(callback: ListenerCallback): IListenerThenable {
        return this.addExecutor(new ListenerExecutor([], this.errorContext))
            .then(callback);
    }

    public catch(callback: ListenerCallback): IListenerThenable {
        return this.addExecutor(new ListenerExecutor([], this.errorContext))
            .catch(callback);
    }

    public finally(callback: ListenerCallback): IListenerThenable {
        return this.addExecutor(new ListenerExecutor([], this.errorContext))
            .finally(callback);
    }

    public addExecutor(executor: ListenerExecutor): ListenerExecutor {
        this.executors.push(executor);

        if (this.hasSource) {
            // setImmediate is necessary so that we can apply the executor handlers before executing it.
            setImmediate(() => {
                if (executor.execute(this.source) && !this.persistent) {
                    this.removeExecutors([executor]);
                }
            });
        }

        return executor;
    }

    private removeExecutors(executorList: ListenerExecutor[]): void {
        this.executors = this.executors.filter((item: ListenerExecutor) => {
            return !executorList.includes(item);
        });
    }
}
