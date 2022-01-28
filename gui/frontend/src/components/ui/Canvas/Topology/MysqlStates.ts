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

// Different states of MySQL Server Instances
export enum MySQLServerInstanceState {
    Configured = 0,
    AddInstance = 1,
    AddSecondaryInstance = 2,
}

// Different states of DB Systems
export enum DbSystemState {
    NotYetConfigured = 0,
    Configured = 1,
}

export enum DbSystemStateColor {
    Inactive = 0x272729,
    Waiting = 0xd8da20,
    OK = 0x34b850,
    Error = 0xda3832,
}

// Type of regions
export enum RegionType {
    OnPremise = 0,
    OnCloud = 1,
}
