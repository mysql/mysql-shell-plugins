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

import { IGenericResponse } from "../../communication";
import { uuid } from "../../utilities/helpers";
import { EventType, IDispatchEvent } from "./Dispatch";

/**
 * Factory for standard events. The events can be used in the Dispatcher
 */
export class DispatchEvents {

    public static baseEvent<T extends IGenericResponse>(eventType: EventType, data: T, id?: string,
        messageClass?: string): IDispatchEvent<T> {
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
            data,
        };

    }

    public static classEvent<T extends IGenericResponse>(data: T, messageClass?: string): IDispatchEvent<T> {
        const result = DispatchEvents.baseEvent<T>(EventType.Notification, data, undefined, messageClass);

        return result;
    }

    public static okEvent<T extends IGenericResponse>(data: T, messageClass?: string, id?: string): IDispatchEvent<T> {
        const result = DispatchEvents.baseEvent<T>(EventType.Notification, data, id, messageClass);
        result.message = "ok";

        return result;
    }

    public static errorEvent<T extends IGenericResponse>(data: T, message: string, messageClass?: string,
        id?: string): IDispatchEvent<T> {
        const result = DispatchEvents.baseEvent<T>(EventType.ErrorResponse, data, id, messageClass);
        result.message = message;

        return result;
    }

    public static okErrorEvent<T extends IGenericResponse>(data: T, errorMessage: string, messageClass?: string,
        id?: string): IDispatchEvent<T> {
        if (data) {
            return DispatchEvents.okEvent(data, messageClass, id);
        }

        return DispatchEvents.errorEvent(data, errorMessage, messageClass, id);
    }
}
