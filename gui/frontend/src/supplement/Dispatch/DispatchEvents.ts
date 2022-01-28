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

import { uuid } from "../../utilities/helpers";
import { EventType, IDispatchEvent, IDispatchNotification } from "./Dispatch";

/**
 * Factory for standard events. The events can be used in the Dispatcher
 */
export class DispatchEvents {

    public static baseEvent<T>(eventType: EventType, id?: string, messageClass?: string): IDispatchEvent<T> {
        if (!id) {
            id = uuid();
        }

        if (messageClass === undefined) {
            messageClass = "";
        }

        return {
            id,
            context: {
                messageClass,
            },
            eventType,
            message: "",
        };

    }

    public static classEvent<T>(messageClass: string, data?: T): IDispatchEvent<T> {
        const result = DispatchEvents.baseEvent<T>(EventType.Notification, undefined, messageClass);
        result.data = data;

        return result;
    }

    public static okEvent<T>(messageClass?: string, data?: T, id?: string): IDispatchEvent<T> {
        const result = DispatchEvents.baseEvent<T>(EventType.Notification, id, messageClass);
        result.message = "ok";
        result.data = data;

        return result;
    }

    public static errorEvent<T = unknown>(message: string, messageClass?: string,
        data?: T, id?: string): IDispatchEvent<T> {
        const result = DispatchEvents.baseEvent<T>(EventType.ErrorResponse, id, messageClass);
        result.message = message;
        result.data = data;

        return result;
    }

    public static okErrorEvent<T = unknown>(data: T, errorMessage: string, messageClass?: string,
        id?: string): IDispatchEvent<T> {
        if (data) {
            return DispatchEvents.okEvent(messageClass, data, id);
        }

        return DispatchEvents.errorEvent(errorMessage, messageClass, data, id);
    }

    public static notification(messageClass: string, message = ""): IDispatchNotification {
        const result = DispatchEvents.baseEvent<undefined>(EventType.Notification, undefined, messageClass);
        result.message = message;

        return result;
    }
}
