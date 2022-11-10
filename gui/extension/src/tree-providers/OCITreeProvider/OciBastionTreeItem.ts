/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

import * as path from "path";

import { TreeItemCollapsibleState } from "vscode";

import { IBastionSummary, ICompartment, IMdsProfileData } from "../../../../frontend/src/communication";
import { OciBaseTreeItem } from "./OciBaseTreeItem";

export class OciBastionTreeItem extends OciBaseTreeItem {
    public contextValue = "mdsBastion";

    public constructor(
        profile: IMdsProfileData,
        public compartment: ICompartment,
        public bastion: IBastionSummary) {
        super(bastion.name, profile, TreeItemCollapsibleState.None);

        let iconName = bastion.isCurrent ? "ociBastionCurrent.svg" : "ociBastion.svg";
        if (bastion.lifecycleState !== "ACTIVE") {
            iconName = bastion.isCurrent ? "ociBastionCurrentNotActive.svg" : "ociBastionNotActive.svg";
        }

        this.iconPath = {
            light: path.join(__dirname, "..", "..", "..", "..", "..", "images", "light", iconName),
            dark: path.join(__dirname, "..", "..", "..", "..", "..", "images", "dark", iconName),
        };
    }

}
