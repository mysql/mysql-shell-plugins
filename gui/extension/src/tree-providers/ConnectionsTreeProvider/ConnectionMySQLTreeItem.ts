/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

import * as path from "path";

import { IMySQLConnectionOptions } from "../../../../frontend/src/communication/MySQL.js";
import { IConnectionDetails } from "../../../../frontend/src/supplement/ShellInterface/index.js";
import { ShellInterfaceSqlEditor } from "../../../../frontend/src/supplement/ShellInterface/ShellInterfaceSqlEditor.js";

import { ConnectionTreeItem } from "./ConnectionTreeItem.js";

export class ConnectionMySQLTreeItem extends ConnectionTreeItem {

    public override contextValue = "connectionMySQL";

    public constructor(details: IConnectionDetails, backend: ShellInterfaceSqlEditor) {
        super(details, backend);

        let fileName = "connectionMySQL.svg";
        const optionsMySQL = details.options as IMySQLConnectionOptions;
        if (optionsMySQL["mysql-db-system-id"] !== undefined) {
            fileName = "ociDbSystem.svg";
        }

        this.iconPath = {
            light: path.join(__dirname, "..", "images", "light", fileName),
            dark: path.join(__dirname, "..", "images", "dark", fileName),
        };
    }

}
