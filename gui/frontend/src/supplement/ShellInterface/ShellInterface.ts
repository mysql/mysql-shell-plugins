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

import { IShellInterface } from ".";
import { ShellInterfaceCore } from "./ShellInterfaceCore";
import { ShellInterfaceDbConnection } from "./ShellInterfaceDbConnection";
import { ShellInterfaceModule } from "./ShellInterfaceModule";
import { ShellInterfaceUser } from "./ShellInterfaceUser";

// This class serves as central point for singleton shell interfaces like core or modules.
// Other interfaces (e.g. sql editor) are not singletons and have to be managed locally.
export class ShellInterface {
    private static interfaces: { [key: string]: IShellInterface } = {};

    public static get core(): ShellInterfaceCore {
        if (ShellInterface.interfaces.core === undefined) {
            ShellInterface.interfaces.core = new ShellInterfaceCore("core");
        }

        return ShellInterface.interfaces.core as ShellInterfaceCore;
    }

    public static get users(): ShellInterfaceUser {
        if (ShellInterface.interfaces.users === undefined) {
            ShellInterface.interfaces.users = new ShellInterfaceUser("users");
        }

        return ShellInterface.interfaces.users as ShellInterfaceUser;
    }

    public static get modules(): ShellInterfaceModule {
        if (ShellInterface.interfaces.modules === undefined) {
            ShellInterface.interfaces.modules = new ShellInterfaceModule("modules");
        }

        return ShellInterface.interfaces.modules as ShellInterfaceModule;
    }

    public static get dbConnections(): ShellInterfaceDbConnection {
        if (ShellInterface.interfaces.dbConnections === undefined) {
            ShellInterface.interfaces.dbConnections = new ShellInterfaceDbConnection("dbConnections");
        }

        return ShellInterface.interfaces.dbConnections as ShellInterfaceDbConnection;
    }

}
