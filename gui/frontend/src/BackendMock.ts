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

// We are sending backend events, so we have to use snake case here.
/* eslint-disable @typescript-eslint/naming-convention */

import { ICommShellProfile, IGenericResponse, IShellDictionary, IShellRequest } from "./communication";
import { EventType, IDispatchDefaultEvent, ListenerEntry } from "./supplement/Dispatch";
import { requisitions } from "./supplement/Requisitions";
import { dispatchTestEvent, dispatchSessionStartEvent } from "./tests/unit-tests/test-helpers";

const defaultProfile: ICommShellProfile = {
    id: 1,
    userId: 1,
    name: "Default",
    description: "Default Profile",
    options: {

    },
    active: true,
};

const profile2: ICommShellProfile = {
    id: 2,
    userId: 1,
    name: "Other",
    description: "Other Profile",
    options: {

    },
    active: true,
};

// A class to simulate the client/server protocol.
export class BackendMock {
    public constructor() {
        ListenerEntry.create({ persistent: true }).then((event: IDispatchDefaultEvent) => {
            this.handleEvent(event);
        }).catch((_event: IDispatchDefaultEvent) => {
            //console.log(event);
        });
    }

    /**
     * Sends the initial fake response, so the application starts the communication.
     */
    public startProtocol(): void {
        dispatchSessionStartEvent(true, defaultProfile);
    }

    public sendErrorResponse = (): Promise<boolean> => {
        return new Promise((resolve) => {
            const callback = (_values: string[]): Promise<boolean> => {
                requisitions.unregister("showError", callback);
                resolve(true);

                return Promise.resolve(true);
            };

            requisitions.register("showError", callback);
            dispatchTestEvent("serverResponse", this.createResponse("ERROR", "Something went wrong."));
        });
    };

    /**
     * Handles all triggered events that are requests or responses, except state and error responses.
     *
     * @param event The event that was triggered.
     */
    private handleEvent = (event: IDispatchDefaultEvent): void => {
        switch (event.eventType) {
            case EventType.Request: { // A request sent to the server.
                const data = event.data as IShellRequest;

                /* istanbul ignore next */
                switch (data.request) {
                    case "authenticate": {
                        // Before sending a valid auth event, send two that are errors, to cover those cases too.
                        dispatchTestEvent("authenticate", this.createResponse("ERROR",
                            "User unknown"));
                        dispatchTestEvent("authenticate", this.createResponse("OK",
                            "User LocalAdministrator was successfully authenticated"));

                        const data = {
                            activeProfile: defaultProfile,
                        };
                        dispatchTestEvent("authenticate", this.createResponse("OK",
                            "User LocalAdministrator was successfully authenticated", undefined, data));
                        break;
                    }

                    case "execute": {
                        this.handleExecutionRequest(data);
                        break;
                    }

                    default:
                }

                break;
            }

            default:
        }
    };

    private handleExecutionRequest = (request: IShellRequest): void => {
        /* istanbul ignore next */
        switch (request.command) {
            case "gui.users.get_gui_module_list": {
                const data = {
                    result: [
                        "gui.sqleditor",
                        "gui.innodb.cluster",
                        "gui.mds",
                        "gui.mrs",
                        "gui.shell",
                    ],
                };
                dispatchTestEvent("", this.createResponse("OK", "done", request.request_id, data));

                break;
            }

            case "gui.users.list_profiles": {
                const data = {
                    result: defaultProfile,
                    rows: [
                        { id: defaultProfile.id, name: defaultProfile.name },
                        { id: profile2.id, name: profile2.name },
                    ],
                };
                dispatchTestEvent("", this.createResponse("OK", "done", request.request_id, data));

                break;
            }

            default:
        }
    };

    private createResponse = (type: string, msg: string, request_id?: string,
        data?: IShellDictionary): IGenericResponse => {

        return {
            request_id,
            requestState: { type, msg },
            ...data,
        };
    };
}
