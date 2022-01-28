/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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

import { CommonWrapper, ShallowWrapper } from "enzyme";
import toJson, { Json, shallowToJson } from "enzyme-to-json";

import { CommunicationEvents, ICommShellProfile, IGenericResponse, IWebSessionData } from "../../communication";
import { dispatcher } from "../../supplement/Dispatch";
import { uuid } from "../../utilities/helpers";

/**
 * Sent to start the communication rolling. This is the first reply from a real server sent to the application
 * on establishing the websocket connection.
 *
 * @param localUserMode A flag indicating if we start in single or multi user mode.
 * @param activeProfile The profile set as active on session start.
 */
export const dispatchSessionStartEvent = (localUserMode: boolean, activeProfile: ICommShellProfile): void => {
    const serverData: IWebSessionData = {
        requestState: {
            type: "OK",
            msg: "A new session has been created",
        },
        sessionUuid: uuid(),
        localUserMode,
        activeProfile,
    };

    dispatcher.triggerEvent(CommunicationEvents.generateWebSessionEvent(serverData), false);
};

/**
 * Simulates an OK event for the application.
 *
 * @param context The context to use. This describes what an event handler is described to.
 * @param data The data to send with the event.
 */
export const dispatchTestEvent = <T extends IGenericResponse>(context: string, data: T): void => {
    dispatcher.triggerEvent(CommunicationEvents.generateResponseEvent(context, data), false);
};

/**
 * Helper function to clean up Jest snapshot. It removes the __self and __source fields from all components,
 * which are rendered for browser debugging and contain absolute paths and other irrelevant info.
 *
 * @param json The Json structure to fix.
 *
 * @returns The modified Json structure.
 */
const removeSelfAndSource = (json: Json): Json => {
    return {
        ...json,
        props: {
            ...json.props,
            __self: undefined,
            __source: undefined,
        },
    };
};

/**
 * Creates a snapshot from the given shallow or deep wrapper for use in snapshot comparisons in Jest.
 *
 * @param wrapper The wrapper from which to create the snapshot.
 *
 * @returns The Json snapshot for the tests.
 */
export const snapshotFromWrapper = <P, S>(wrapper: ShallowWrapper<P, S> | CommonWrapper<P, S>): Json => {
    if (wrapper instanceof ShallowWrapper) {
        return shallowToJson(wrapper, { map: removeSelfAndSource, mode: "shallow" });
    }

    return toJson(wrapper, { map: removeSelfAndSource, mode: "deep" });
};
