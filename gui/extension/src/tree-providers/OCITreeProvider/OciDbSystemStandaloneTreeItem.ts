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
import { TreeItemCollapsibleState } from "vscode";

import { DbSystem, ICompartment, IMySQLDbSystem } from "../../../../frontend/src/communication/index.js";
import { IMdsProfileData } from "../../../../frontend/src/communication/ProtocolMds.js";
import { OciDbSystemTreeItem } from "./OciDbSystemTreeItem.js";

export class OciDbSystemStandaloneTreeItem extends OciDbSystemTreeItem {
    public override contextValue = "mdsDbSystem";

    public constructor(
        profile: IMdsProfileData,
        public override compartment: ICompartment,
        public override dbSystem: IMySQLDbSystem) {
        super(profile, compartment, dbSystem, TreeItemCollapsibleState.None);
        let iconName = "ociDbSystemNotActive.svg";
        if (dbSystem.lifecycleState === DbSystem.LifecycleState.Active) {
            iconName = "ociDbSystem.svg";
        } else if (dbSystem.lifecycleState === DbSystem.LifecycleState.Inactive ||
            dbSystem.lifecycleState === DbSystem.LifecycleState.Failed) {
            iconName = "ociDbSystemStopped.svg";
        }

        this.iconPath = {
            light: path.join(__dirname, "..", "images", "light", iconName),
            dark: path.join(__dirname, "..", "images", "dark", iconName),
        };
    }
}
