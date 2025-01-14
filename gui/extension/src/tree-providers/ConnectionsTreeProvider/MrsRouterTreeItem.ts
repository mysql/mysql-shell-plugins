/*
 * Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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

import { IMrsRouterData } from "../../../../frontend/src/communication/ProtocolMrs.js";
import type { ICdmRestRouterEntry } from "../../../../frontend/src/data-models/ConnectionDataModel.js";
import { MrsTreeBaseItem } from "./MrsTreeBaseItem.js";

export class MrsRouterTreeItem extends MrsTreeBaseItem<ICdmRestRouterEntry> {
    public override contextValue = "mrsRouter";

    public constructor(dataModelEntry: ICdmRestRouterEntry) {
        const value = dataModelEntry.details;
        super(dataModelEntry, MrsRouterTreeItem.getIconName(value, dataModelEntry.requiresUpgrade), true);

        this.tooltip = dataModelEntry.requiresUpgrade
            ? "This MySQL Router requires an upgrade."
            : `MySQL Router ${dataModelEntry.details.version} - ${dataModelEntry.details.address}`;
    }

    private static getIconName = (value: IMrsRouterData, requiresUpgrade: boolean): string => {
        if (requiresUpgrade) {
            return "routerError.svg";
        }

        if (!value.active) {
            return "routerNotActive.svg";
        }

        return "router.svg";
    };
}
