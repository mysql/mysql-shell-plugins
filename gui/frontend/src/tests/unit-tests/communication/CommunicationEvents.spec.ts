/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

/* eslint-disable @typescript-eslint/naming-convention */

import {
    CommunicationEvents, IWebSessionData, IGenericResponse, IShellRequest, ISentShellRequestData,
} from "../../../communication";
import { EventType, IDispatchEvent } from "../../../supplement/Dispatch";
import { uuid } from "../../../utilities/helpers";

describe("Communication events tests", () => {
    it("WebSession events", (): void => {
        const data: IWebSessionData = {
            requestId: "123",
            requestState: { type: "error", msg: "test" },
            sessionUuid: uuid(),
            localUserMode: false,
            activeProfile: {
                id: 1,
                userId: 2,
                name: "user",
                description: "",
                options: {},
            },
        };

        const event = CommunicationEvents.generateWebSessionEvent(data);
        expect(event).toStrictEqual<IDispatchEvent<IWebSessionData>>({
            id: expect.any(String),
            data,
            context: {
                messageClass: "webSession",
            },
            eventType: EventType.Notification,
            message: "test",
        });

    });

    it("Communication events", (): void => {
        let data: IGenericResponse = {
            requestId: "123",
            requestState: { type: "ERROR", msg: "test" },
        };


        let event = CommunicationEvents.generateResponseEvent("myClass", data);
        expect(event).toStrictEqual({
            id: "123",
            eventType: EventType.ErrorResponse,
            message: "test",
            context: {
                messageClass: "myClass",
            },
            data,
        });

        data = {
            requestId: "123",
            requestState: { type: "PENDING", msg: "Execution started..." },
        };
        event = CommunicationEvents.generateResponseEvent("myClass", data);
        expect(event).toStrictEqual({
            id: "123",
            eventType: EventType.StartResponse,
            message: "Execution started...",
            context: {
                messageClass: "myClass",
            },
            data,
        });

        data = {
            requestId: "123",
            requestState: { type: "PENDING", msg: "soon finished" },
        };
        event = CommunicationEvents.generateResponseEvent("myClass", data);
        expect(event).toStrictEqual({
            id: "123",
            eventType: EventType.DataResponse,
            message: "soon finished",
            context: {
                messageClass: "myClass",
            },
            data,
        });

        data = {
            requestId: "888",
            requestState: { type: "OK", msg: "done" },
        };
        event = CommunicationEvents.generateResponseEvent("myClass", data);
        expect(event).toStrictEqual({
            id: "888",
            eventType: EventType.FinalResponse,
            message: "done",
            context: {
                messageClass: "myClass",
            },
            data,
        });

        data = {
            requestId: "888",
            requestState: { type: "Lorem ipsum", msg: "dolor sit amet" },
        };
        event = CommunicationEvents.generateResponseEvent("myClass", data);
        expect(event).toStrictEqual({
            id: "888",
            eventType: EventType.Unknown,
            message: "dolor sit amet",
            context: {
                messageClass: "myClass",
            },
            data,
        });
    });

    it("Communication request", (): void => {
        const request: IShellRequest = {
            request_id: uuid(),
            request: "I need coffee",
            command: "instantly!",
            args: {
                espresso: true,
                milk: false,
            },
        };

        const event = CommunicationEvents.generateRequestEvent(request);
        expect(event).toStrictEqual<IDispatchEvent<ISentShellRequestData>>({
            id: expect.any(String),
            eventType: EventType.Request,
            data: { request, requestState: { type: "", msg: "" } },
            message: "",
            context: {
                messageClass: "",
            },
        });
    });
});
