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

import { ShellInterfaceCore } from "./ShellInterfaceCore";
import { ShellInterfaceDbConnection } from "./ShellInterfaceDbConnection";
import { ShellInterfaceModule } from "./ShellInterfaceModule";
import { ShellInterfaceUser } from "./ShellInterfaceUser";

/**
 * This class serves as central point for singleton shell interfaces like `core` or `modules`.
 * Singletons are all those shell interfaces, which don't need a session for their work.
 */
export class ShellInterface {
    private static interfaces: {
        core?: ShellInterfaceCore;
        users?: ShellInterfaceUser;
        modules?: ShellInterfaceModule;
        dbConnections?: ShellInterfaceDbConnection;
    } = {};

    public static get core(): ShellInterfaceCore {
        if (!ShellInterface.interfaces.core) {
            ShellInterface.interfaces.core = new ShellInterfaceCore();
        }

        return ShellInterface.interfaces.core;
    }

    public static get users(): ShellInterfaceUser {
        if (!ShellInterface.interfaces.users) {
            ShellInterface.interfaces.users = new ShellInterfaceUser();
        }

        return ShellInterface.interfaces.users;
    }

    public static get modules(): ShellInterfaceModule {
        if (!ShellInterface.interfaces.modules) {
            ShellInterface.interfaces.modules = new ShellInterfaceModule();
        }

        return ShellInterface.interfaces.modules;
    }

    public static get dbConnections(): ShellInterfaceDbConnection {
        if (!ShellInterface.interfaces.dbConnections) {
            ShellInterface.interfaces.dbConnections = new ShellInterfaceDbConnection();
        }

        return ShellInterface.interfaces.dbConnections;
    }
}
