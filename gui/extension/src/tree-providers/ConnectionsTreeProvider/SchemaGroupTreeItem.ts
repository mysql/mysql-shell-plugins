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

import { SchemaItemGroupType } from "./SchemaIndex.js";
import { ConnectionsTreeBaseItem } from "./ConnectionsTreeBaseItem.js";
import { ShellInterfaceSqlEditor } from "../../../../frontend/src/supplement/ShellInterface/ShellInterfaceSqlEditor.js";

export class SchemaGroupTreeItem extends ConnectionsTreeBaseItem {

    public contextValue = `${String(this.label)}GroupItem`;

    public constructor(
        schema: string,
        backend: ShellInterfaceSqlEditor,
        connectionId: number,
        public groupType: SchemaItemGroupType) {
        super(groupType, schema, backend, connectionId, SchemaGroupTreeItem.getIonName(groupType), true);
    }

    private static getIonName(groupType: SchemaItemGroupType): string {
        switch (groupType) {
            case SchemaItemGroupType.Tables: {
                return "schemaTables.svg";
            }
            case SchemaItemGroupType.Views: {
                return "schemaViews.svg";
            }
            case SchemaItemGroupType.Routines: {
                return "schemaRoutines.svg";
            }
            case SchemaItemGroupType.Events: {
                return "schemaEvents.svg";
            }
            default: {
                return "";
            }
        }
    }
}
