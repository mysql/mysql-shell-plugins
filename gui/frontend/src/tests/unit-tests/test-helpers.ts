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

import { CommonWrapper, ReactWrapper } from "enzyme";
import toJson, { Json } from "enzyme-to-json";

import { CommunicationEvents, ICommShellProfile, IGenericResponse, IWebSessionData } from "../../communication";
import { dispatcher } from "../../supplement/Dispatch";
import { uuid } from "../../utilities/helpers";

export type JestReactWrapper<P = {}, S = unknown> =
    ReactWrapper<Readonly<P> & Readonly<{ children?: React.ReactNode }>, Readonly<S>>;

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
 * Internal function to help filtering arrays in Jest JSON trees.
 *
 * @param a The array to filter.
 *
 * @returns The filtered array.
 */
const mapArray = (a: unknown[]): unknown[] => {
    const result = a.map((entry) => {
        if (entry) {
            if (Array.isArray(entry)) {
                return mapArray(entry);
            }

            if (typeof entry === "object") {
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                return mapObject(entry!);
            }
        }

        return entry;
    });

    return result;
};

/**
 * Internal function to help filtering objects in Jest JSON trees. Particularly the __source and __self members
 * are internal React stuff, which we don't need in our snapshots.
 *
 * @param o The object to filter.
 *
 * @returns The filtered object.
 */
const mapObject = (o: object): object => {
    const result: { [key: string]: unknown } = {};

    for (const key of Object.keys(o)) {
        if (key === "__self" || key === "__source") {
            continue;
        }

        const value = o[key];
        if (value === null || value === undefined) {
            result[key] = value;
        } else if (Array.isArray(value)) {
            result[key] = mapArray(value);
        } else if (typeof value === "object") {
            if (value.$$typeof) {
                // A component.
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                result[key] = mapJson(value as Json);
            } else {
                result[key] = mapObject(value as object);
            }
        } else {
            result[key] = value;
        }
    }

    return result;
};

/**
 * Helper function to clean up Jest snapshot. It removes the __self and __source fields from all components,
 * which are rendered for browser debugging and contain absolute paths and other irrelevant info.
 * The `toJson` function takes care to call this method for each component in the normal render tree (children),
 * but does not take care for components passed as properties, which is what we have to do here.
 *
 * @param json The Json structure to fix.
 *
 * @returns The modified Json structure.
 */
const mapJson = (json: Json): Json => {
    if (!json.props) {
        return json;
    }

    const props = mapObject(json.props);

    return {
        type: json.type,
        children: json.children,
        $$typeof: json.$$typeof,
        props,
    };
};

/**
 * Creates a snapshot from the given shallow or deep wrapper for use in snapshot comparisons in Jest.
 *
 * @param wrapper The wrapper from which to create the snapshot.
 *
 * @returns The Json snapshot for the tests.
 */
export const snapshotFromWrapper = <P, S>(wrapper: CommonWrapper<P, S>): Json => {
    return toJson(wrapper, { map: mapJson });
};

/**
 * Promisified version of a component's setState function.
 *
 * @param component The component to set the new state for.
 * @param state The new state.
 *
 * @returns A promise that fulfills when setState has finished.
 */
export const stateChange = <P, S>(component: CommonWrapper<P, S>, state: object): Promise<void> => {
    return new Promise((resolve) => {
        component.setState(state, () => {
            resolve();
        });
    });
};

const versionPattern = /^\[(<|<=|>|>=|=)(\d{5})\]/;
const relationMap = new Map<string, number>([
    ["<", 0], ["<=", 1], ["=", 2], [">=", 3], [">", 4],
]);

// Information about a statement with version information.
export interface IVersionCheckResult {
    matched: boolean;   // True if the version in the statement matched a given version.
    statement: string;  // The statement with stripped version information.
    version: number;    // The found version. Can be 0 if the statement contains no version.
}

/**
 * Determines if the version info in the statement matches the given version (if there's version info at all).
 * The version info is removed from the statement, if any.
 *
 * @param statement The statement with an optional version part at the beginning.
 * @param serverVersion The server version to match the version part against.
 *
 * @returns The check result.
 */
export const checkStatementVersion = (statement: string, serverVersion: number): IVersionCheckResult => {
    const result: IVersionCheckResult = {
        matched: true,
        statement,
        version: serverVersion,
    };

    const matches = statement.match(versionPattern);
    if (matches) {
        result.statement = statement.replace(versionPattern, "");

        const relation = matches[1];
        result.version = parseInt(matches[2], 10);

        switch (relationMap.get(relation)) {
            case 0: {
                if (serverVersion >= result.version) {
                    result.matched = false;
                }
                --result.version;

                break;
            }

            case 1: {
                if (serverVersion > result.version) {
                    result.matched = false;
                }
                break;
            }

            case 2: {
                if (serverVersion !== result.version) {
                    result.matched = false;
                }
                break;
            }

            case 3: {
                if (serverVersion < result.version) {
                    result.matched = false;
                }
                break;
            }

            case 4: {
                if (serverVersion <= result.version) {
                    result.matched = false;
                }
                ++result.version;

                break;
            }

            default:
        }
    }

    return result;
};

/**
 * Similar like checkStatementVersion, but only extracts the statement version and checks that against the given
 * minimum version. Relational operators are only used to adjust the extracted version.
 *
 * @param statement The statement with an optional version part at the beginning.
 * @param minimumVersion The server version to match the version part against.
 *
 * @returns The check result.
 */
export const checkMinStatementVersion = (statement: string, minimumVersion: number): IVersionCheckResult => {
    const result: IVersionCheckResult = {
        matched: true,
        statement,
        version: minimumVersion,
    };

    const matches = statement.match(versionPattern);
    if (matches) {
        result.statement = statement.replace(versionPattern, "");

        const relation = matches[1];
        result.version = parseInt(matches[2], 10);

        switch (relationMap.get(relation)) {
            case 0: { // Less than the given version.
                --result.version;

                break;
            }

            case 4: { // Greater than the given version.
                ++result.version;

                break;
            }

            default:
        }
    }

    result.matched = result.version >= minimumVersion;

    return result;
};

/**
 * Jest doesn't have a fail() function, so we have to provide one.
 * The disadvantage of this solution is that the tests immediately stop, instead continuing with other cases.
 *
 * @param message The message to show.
 */
export const fail = (message: string): void => {
    throw new Error(message);
};

/**
 * Allows to wait for the next tick in the Node.js event loop.
 *
 * @returns A promise which fulfills on the next process tick.
 */
export const nextProcessTick = async (): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    return new Promise(process.nextTick);
};
