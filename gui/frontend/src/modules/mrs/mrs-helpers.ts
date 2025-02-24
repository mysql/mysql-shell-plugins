/*
 * Copyright (c) 2023, 2025, Oracle and/or its affiliates.
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

/** Some entries have a specific enable state which includes more than just the yes/no duality. */
export enum EnabledState {
    Disabled = 0,
    Enabled = 1,
    PrivateOnly = 2,
}

/**
 * Retrieve the port of the REST API endpoint assigned to a specific connection.
 *
 * @param connectionId The DB connection id.
 *
 * @returns The port of the REST API endpoint assigned to the given connection.
 */
export const getRouterPortForConnection = (connectionId: number = 0): number => {
    // Each connection is incrementally assigned a new port starting at 8443 (default).
    // https://dev.mysql.com/doc/mysql-router/8.0/en/mysqlrouter.html#option_mysqlrouter_https-port
    const defaultRouterPort = 8443;

    // There should be an interval of 2 slots between each assignment to account for the default debug port.
    return (defaultRouterPort - 2) + connectionId * 2;
};

export const getEnabledState = (enabledState: string): EnabledState => {
    return enabledState === "Access ENABLED" ? EnabledState.Enabled : enabledState === "PRIVATE Access Only"
        ? EnabledState.PrivateOnly
        : EnabledState.Disabled;
};
