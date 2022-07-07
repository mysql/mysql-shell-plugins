/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

import { EventType, ListenerEntry } from "./";
import { IDispatchEvent } from "./Dispatch";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ListenerCallback = (event: any) => any;
export type ListenerEventSource = IDispatchEvent | Error | undefined;

enum CallbackType {
    Then = 1,
    Catch,
    Finally,
}

interface ICallbackCapsule {
    callback: ListenerCallback;
    callbackType: CallbackType;
    errorContext: Error;
}

export interface IListenerThenable {
    then: (callback: ListenerCallback, errorContext?: Error) => IListenerThenable;
    catch: (callback: ListenerCallback, errorContext?: Error) => IListenerThenable;
    finally: (callback: ListenerCallback, errorContext?: Error) => IListenerThenable;
}

export class ListenerExecutor implements IListenerThenable {
    private callbackChain: ICallbackCapsule[];
    private errorContext: Error;

    public constructor(callbackChain: ICallbackCapsule[], errorContext = new Error()) {
        this.callbackChain = callbackChain;
        this.errorContext = errorContext;
    }

    public then(callback: ListenerCallback, errorContext = new Error()): IListenerThenable {
        if (this.findFirstCallbackIndex(new Set()) > -1) {
            throw new Error("It's not possible to add executors after a 'finally' block");
        }
        this.callbackChain.push({ callback, callbackType: CallbackType.Then, errorContext });

        return this;
    }

    public catch(callback: ListenerCallback, errorContext = new Error()): IListenerThenable {
        if (this.findFirstCallbackIndex(new Set()) > -1) {
            throw new Error("It's not possible to add executors after a 'finally' block");
        }
        this.callbackChain.push({ callback, callbackType: CallbackType.Catch, errorContext });

        return this;
    }

    public finally(callback: ListenerCallback, errorContext = new Error()): IListenerThenable {
        if (this.findFirstCallbackIndex(new Set()) > -1) {
            throw new Error("It's not possible to add executors after a 'finally' block");
        }
        this.callbackChain.push({ callback, callbackType: CallbackType.Finally, errorContext });

        return this;
    }

    /**
     * Execute the executor's callback chain.
     *
     * @param source The data to be scheduled.
     *
     * @returns True if the executor has ended its execution or passed its chain to another listener (which means
     *          this executor is done with the entire callback execution).
     *          False to indicate that the callback chain is not yet finished.
     */
    public execute = (source: ListenerEventSource): boolean => {
        const types = this.callBackTypesForSource(source);
        const nextExecutor = this.clone(types);

        // An undefined next executor means there's no callback in this executor for the possible callback types.
        if (nextExecutor === undefined) {
            // See if we are handling an error event and there is no .catch block.
            if (types.has(CallbackType.Catch)) {
                let error = this.errorContext;

                if (source instanceof Error) {
                    error = source;
                }

                error.message = `"Chain without a catch block - ${source?.message ?? ""}`;
                throw error;
            }

            // Ignore any other source type.
            return false;
        }

        let isIntermediate = false;
        if (source && !(source instanceof Error)) {
            // This is a multi-response event (but not the last one), so indicate that the caller must not remove
            // the executor yet.
            if (source.eventType === EventType.StartResponse || source.eventType === EventType.DataResponse) {
                isIntermediate = true;
            }
        }

        // Now execute the first callback in the executor clone (and remove it from its list).
        // This way the current executor stays unchanged and is ready to be triggered again for new incoming
        // sources.
        const callbackResult = nextExecutor.triggerHeadCallback(source);

        if (callbackResult instanceof ListenerEntry) {
            // If the returned value is a listener, delegate the rest of the chain to the new listener and end this one.
            // This allows listener chaining and handling of inner listeners by an outer callback.
            callbackResult.addExecutor(nextExecutor);
        } else {
            // Otherwise just continue with the next callback in the chain.
            return nextExecutor.execute(callbackResult as ListenerEventSource);
        }

        // We're all done. Try to finish the listener sequence, if not persistent.
        return !isIntermediate;
    };

    /**
     * Determines the index of the first capsule that matches any of the given callback types.
     * The type "Finally" is always assumed to be in the set of types.
     *
     * @param callbackTypes A set of callback types to consider in the search.
     *
     * @returns The index of a capsule in the callback chain or -1 if no callback complies to the requested type.
     */
    private findFirstCallbackIndex(callbackTypes: Set<CallbackType>): number {
        callbackTypes.add(CallbackType.Finally);

        for (let index = 0; index < this.callbackChain.length; ++index) {
            const capsule = this.callbackChain[index];
            if (callbackTypes.has(capsule.callbackType)) {
                return index;
            }
        }

        return -1;
    }

    /**
     * Determines which callback types are valid for the given source.
     *
     * @param source The source which determines the type of possible callback types.
     * @returns a list with the possible callback types that can be used to process this event.
     */
    private callBackTypesForSource(source?: ListenerEventSource): Set<CallbackType> {
        if (!source) {
            return new Set();
        }

        if (source instanceof Error || (source && source.eventType === EventType.ErrorResponse)) {
            return new Set([CallbackType.Catch]);
        }

        return new Set([CallbackType.Then, CallbackType.Finally]);
    }

    /**
     * Calls the first callback in the chain and removes that.
     *
     * @param source The data to pass to the callback.
     *
     * @returns The result of the callback, which can be a new listener entry for chaining events.
     */
    private triggerHeadCallback(source: ListenerEventSource): unknown {
        const capsule = this.callbackChain.shift();

        if (!capsule) {
            return undefined;
        }

        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return capsule.callback(source);
        } catch (error) {
            capsule.errorContext.message = String(error);

            return this.execute(capsule.errorContext);
        }
    }

    /**
     * Creates a duplicate of this executor to allow assigning it to a listener entry that was created in
     * a callback. Some cleanup takes place however, by removing any callback before the first callback that
     * conforms to any of the given callback types (e.g. a `.catch` that comes before a `.then` callback, if
     * `.then` is among the acceptable types).
     *
     * @param callbackTypes A set of callback types that are valid for this executor.
     *
     * @returns If this executor has no callback of any of the given types then nothing else can be executed and
     *          undefined is returned. Otherwise a new executor will be created.
     */
    private clone(callbackTypes: Set<CallbackType>): ListenerExecutor | undefined {
        const index = this.findFirstCallbackIndex(callbackTypes);

        if (index === -1) {
            return undefined;
        }

        return new ListenerExecutor(this.callbackChain.slice(index), this.errorContext);
    }
}
