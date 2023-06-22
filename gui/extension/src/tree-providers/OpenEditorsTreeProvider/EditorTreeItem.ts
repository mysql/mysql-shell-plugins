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
import { EditorLanguage } from "../../../../frontend/src/supplement";

export class EditorTreeItem extends TreeItem {
    static readonly #entityIconMap = new Map<EntityType, string>([
        [EntityType.Notebook, "terminal"],
        [EntityType.Script, "script"],
        [EntityType.Folder, "folder"],
        [EntityType.Status, "adminServerStatus"],
        [EntityType.Connections, "clientConnections"],
        [EntityType.Dashboard, "adminPerformanceDashboard"],
    ]);

    public contextValue = "editorItem";

    public constructor(private normalCaption: string, private alternativeCaption: string, language: EditorLanguage,
        editorType: EntityType, command: Command) {
        super(normalCaption, TreeItemCollapsibleState.None);
        this.command = command;

        if (editorType === EntityType.Script || editorType === EntityType.Notebook) {
            if (language === "msg") {
                this.iconPath = {
                    light: path.join(__dirname, "..", "images", "light", "notebook.svg"),
                    dark: path.join(__dirname, "..", "images", "dark", "notebook.svg"),
                };
            } else {
                let name;
                switch (language) {
                    case "sql": {
                        name = "scriptSqlite";
                        break;
                    }

                    case "mysql": {
                        name = "scriptMysql";
                        break;
                    }

                    case "javascript": {
                        name = "scriptJs";
                        break;
                    }

                    case "typescript": {
                        name = "scriptTs";
                        break;
                    }

                    case "python": {
                        name = "scriptPy";
                        break;
                    }

                    default: {
                        name = "default";
                        break;
                    }
                }

                this.iconPath = {
                    light: path.join(__dirname, "..", "images", "light", "file-icons", name + ".svg"),
                    dark: path.join(__dirname, "..", "images", "dark", "file-icons", name + ".svg"),
                };
            }
        } else {
            const icon = EditorTreeItem.#entityIconMap.get(editorType) ?? "default";
            this.iconPath = {
                light: path.join(__dirname, "..", "images", "light", icon + ".svg"),
                dark: path.join(__dirname, "..", "images", "dark", icon + ".svg"),
            };
        }
    }

    public updateLabel(simpleView: boolean): void {
        this.label = simpleView ? this.alternativeCaption : this.normalCaption;
    }
}
