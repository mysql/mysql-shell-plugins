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

import { TreeDataProvider, TreeItem, EventEmitter, ProviderResult, Event } from "vscode";

import { IDBDataEntry } from "../../../frontend/src/modules/db-editor/index.js";
import { ShellInterface } from "../../../frontend/src/supplement/ShellInterface/ShellInterface.js";
import { ScriptTreeItem } from "./ScriptTreeItem.js";

/** A class to provide the script files tree structure. */
export class ScriptsTreeDataProvider implements TreeDataProvider<TreeItem> {
    private changeEvent = new EventEmitter<void>();

    private tree: IDBDataEntry[] = [];

    public constructor(private scriptTypeId: number) { }

    public get onDidChangeTreeData(): Event<void> {
        return this.changeEvent.event;
    }

    public refresh(): void {
        this.changeEvent.fire();
    }

    public getTreeItem(element: TreeItem): TreeItem {
        return element;
    }

    public getChildren(element?: TreeItem): ProviderResult<TreeItem[]> {
        return new Promise((resolve, reject) => {
            if (!element) {
                ShellInterface.modules.loadScriptsTree().then((tree) => {
                    this.tree = tree;
                    const entries: TreeItem[] = [];

                    this.tree.forEach((entry) => {
                        entries.push(new ScriptTreeItem(entry));
                    });

                    resolve(entries);
                }).catch((reason) => {
                    reject(reason);
                });
            } else {
                resolve([]);
            }

        });
    }
}
