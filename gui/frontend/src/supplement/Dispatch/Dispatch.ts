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

/* eslint-disable max-classes-per-file */

import { DispatchEvents } from ".";
import { ListenerEntry } from "./ListenerEntry";

/**
 * Describes the type of a dispatched event. Also used for event logging/debugging.
 *
 * @param Request       A request sent to the backend/server.
 * @param ErrorResponse An error response event from the server.
 * @param StartResponse A response indicating the start of multi-response scenario.
 * @param DataResponse  A response carrying data in a multi-response scenario.
 * @param FinalResponse The last data response in a multi-response scenario.
 * @param Notification  A simple event without data, for actions happening in the application.
 * @param Unknown       Used when nothing is known about the event.
 */
export enum EventType {
    Request = -1,
    ErrorResponse = -2,

    StartResponse = 1,
    DataResponse = 2,
    FinalResponse = 3,

    Notification = 4,

    Unknown = 0,
}

/**
 * Some data to contextualize an event. This is done using a message class (that names an event),
 * or by any other data that the entity that triggers the event finds useful.
 */
export interface IDispatchEventContext {
    messageClass: string;
    data?: unknown;
}

/**
 * Dispatch event base class. This class can be specialized to
 * describe the specific data that the event contains.
 * This class may also carry some context data. This context has
 * two items. The 'messageClass' is used to identify events by name (instead matching its id).
 * The 'data' which can be anything that the trigger entity finds useful for the consumer. This is
 * complementary to the event data itself.
 */
export interface IDispatchEvent<T> {
    id: string;
    eventType: EventType;
    message: string;

    context: IDispatchEventContext;
    data?: T;
}

/**
 * The IDispatchUnknownEvent should be used when you don't know the event type that it's being handled.
 * This means the event may or may not have the 'data' defined. Handling unknown events will 'force' the
 * consumer to check for the 'data' property before using it.
 */
export type IDispatchUnknownEvent = IDispatchEvent<unknown | undefined>;

/**
 * Use the IDispatchDefaultEvent when you know for sure the 'data' property is defined but
 * don't have a better way to describe it (didn't define a class to describe the data or not possible
 * to determine it).
 */
export type IDispatchDefaultEvent = IDispatchEvent<unknown>;

/**
 * The IDispatchNotification is a simple notification method which can only handle a message. The 'data' property
 * is 'undefined' so it will never be used in a notification.
 */
export type IDispatchNotification = IDispatchEvent<undefined>;

/**
 * A message dispatcher and listener manager. This dispatches the messages to the
 * listeners that are waiting for them and manage their lifetime as active listeners.
 */
export class Dispatcher {
    private listeners: ListenerEntry[];
    private messageContext: Map<string, IDispatchEventContext>;

    protected constructor() {
        this.listeners = [];
        this.messageContext = new Map<string, IDispatchEventContext>();
    }

    /**
     * Create a mapping between an id and a context
     *
     * @param requestId the request id
     * @param context the context to match later
     */
    public mapMessageContext(requestId: string, context: IDispatchEventContext): void {
        this.messageContext.set(requestId, context);
    }

    /**
     * Add a listener to the listener array
     *
     * @param listener the listener to use and wait for the event
     */
    public listen(listener: ListenerEntry): void {
        this.listeners.push(listener);
    }

    public remove(id: number): void {
        const index = this.listeners.findIndex((candidate: ListenerEntry) => {
            return candidate.id === id;
        });

        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }

    /**
     * Triggers a simple notification event without attached data.
     *
     * @param messageClass The message class for the notification.
     */
    public triggerNotification(messageClass: string): void {
        this.triggerEvent(DispatchEvents.notification(messageClass));
    }

    /**
     * Trigger an event
     *
     * @param event The event to trigger.
     * @param debugging Trigger the event only if it is a debugger event.
     */
    public triggerEvent(event: IDispatchUnknownEvent, debugging = false): void {
        // Try to match a context.
        const context = this.messageContext.get(event.id);
        if (context) {
            event.context = context;
        }

        // If no context, then set a default one.
        if (event.context === undefined) {
            event.context = { messageClass: "" };
        } else if (debugging && !event.context.messageClass.startsWith("debugger")) {
            return;
        }

        const toTrigger = [];

        // Make a selection of which listeners to trigger.
        for (let index = this.listeners.length - 1; index >= 0; --index) {
            const listener: ListenerEntry = this.listeners[index];

            if (!listener.filterEvent(event)) {
                continue;
            }

            toTrigger.unshift(listener);

            if ([EventType.FinalResponse,
                EventType.ErrorResponse,
                EventType.Notification].includes(event.eventType)
            ) {
                if (!listener.persistent) {
                    this.listeners.splice(index, 1);
                }
                this.messageContext.delete(event.id);
            }
        }

        // Trigger the selected listeners.
        for (const listener of toTrigger) {
            listener.trigger(event);
        }
    }
}

class DispatcherSingleton extends Dispatcher {
    public constructor() {
        super();
    }
}

export const dispatcher = new DispatcherSingleton();
