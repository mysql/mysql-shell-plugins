/*
 * Copyright (c) 2023, Oracle and/or its affiliates.
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

import { Command, TreeItem, TreeItemCollapsibleState } from "vscode";
import { EntityType } from "../../../../frontend/src/modules/db-editor";
import { IEditorOpenChangeData } from "../../../../frontend/src/supplement/Requisitions";
import { DBType } from "../../../../frontend/src/supplement/ShellInterface";

export class EditorTreeItem extends TreeItem {
    public contextValue = "editorItem";

    static readonly #iconMap = new Map<EntityType, string>([
        [EntityType.Notebook, "shell"],
        [EntityType.Script, "script"],
        [EntityType.Folder, "folder"],
        [EntityType.Status, "adminServerStatus"],
        [EntityType.Connections, "clientConnections"],
        [EntityType.Dashboard, "adminPerformanceDashboard"],
    ]);

    public constructor(data: IEditorOpenChangeData, command: Command) {
        super(data.editorCaption, TreeItemCollapsibleState.None);
        this.command = command;

        if (data.editorType === EntityType.Script || data.editorType === EntityType.Notebook) {
            if (data.language === "msg") {
                const icon = data.dbType === DBType.MySQL ? "notebookMysql" : "notebookSqlite";
                this.iconPath = {
                    light: path.join(__dirname, "..", "images", "light", icon + ".svg"),
                    dark: path.join(__dirname, "..", "images", "dark", icon + ".svg"),
                };
            } else {
                this.iconPath = {
                    light: path.join(__dirname, "..", "images", "file-icons", data.language + ".svg"),
                    dark: path.join(__dirname, "..", "images", "file-icons", data.language + ".svg"),
                };
            }
        } else {
            const icon = EditorTreeItem.#iconMap.get(data.editorType) ?? "default";
            this.iconPath = {
                light: path.join(__dirname, "..", "images", "light", icon + ".svg"),
                dark: path.join(__dirname, "..", "images", "dark", icon + ".svg"),
            };
        }
    }
}
