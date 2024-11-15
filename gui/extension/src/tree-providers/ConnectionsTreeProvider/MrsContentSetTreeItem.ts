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

import { IMrsContentSetData } from "../../../../frontend/src/communication/ProtocolMrs.js";
import { ShellInterfaceSqlEditor } from "../../../../frontend/src/supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { MrsTreeBaseItem } from "./MrsTreeBaseItem.js";

export class MrsContentSetTreeItem extends MrsTreeBaseItem {
    public override contextValue = "mrsContentSet";

    public constructor(
        label: string,
        public value: IMrsContentSetData,
        backend: ShellInterfaceSqlEditor,
        connectionId: number,
    ) {
        super(label, backend, connectionId, MrsContentSetTreeItem.getIconName(value), true);

        this.description = value.contentType === "SCRIPTS" ? "MRS Scripts" : "Static Files";
    }

    private static getIconName = (value: IMrsContentSetData): string => {
        let iconName = value.contentType === "SCRIPTS" ? "mrsContentSetScripts" : "mrsContentSet";
        if (value.enabled === 0) {
            iconName += "Disabled";
        } else if (value.enabled === 2) {
            iconName += "Private";
        } else if (value.requiresAuth === 1) {
            iconName += "Locked";
        }

        return iconName + ".svg";
    };
}
