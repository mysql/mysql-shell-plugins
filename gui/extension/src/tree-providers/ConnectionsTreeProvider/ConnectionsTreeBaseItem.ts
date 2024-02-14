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

import { Command, TreeItem, TreeItemCollapsibleState, env, window, commands } from "vscode";

import { ShellInterfaceSqlEditor } from "../../../../frontend/src/supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { showMessageWithTimeout, showModalDialog } from "../../utilities.js";

export class ConnectionsTreeBaseItem extends TreeItem {

    public constructor(
        public name: string,
        public schema: string,
        public backend: ShellInterfaceSqlEditor,
        public connectionId: number,
        iconName: string,
        hasChildren: boolean,
        command?: Command) {
        super(name, hasChildren ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None);

        this.iconPath = {
            light: path.join(__dirname, "..", "images", "light", iconName),
            dark: path.join(__dirname, "..", "images", "dark", iconName),
        };
        this.command = command;
    }

    public copyNameToClipboard(): void {
        void env.clipboard.writeText(this.name).then(() => {
            showMessageWithTimeout("The name was copied to the system clipboard");
        });
    }

    public copyCreateScriptToClipboard(withDelimiter = false, withDrop = false): void {
        this.backend.execute(`show create ${this.dbType} ${this.qualifiedName}`).then((data) => {
            if (data) {
                if (data.rows && data.rows.length > 0) {
                    const firstRow = data.rows[0] as string[];
                    const index = this.createScriptResultIndex;
                    if (firstRow.length > index) {
                        let stmt = firstRow[index];
                        if (withDelimiter) {
                            if (withDrop) {
                                // The SHOW CREATE PROCEDURE / FUNCTION statements do not return the fully qualified
                                // name including the schema, just the name of the procedure / functions with backticks
                                let name = Array.from(stmt.matchAll(/PROCEDURE `(.*?)`/gm), (m) => { return m[1]; });
                                if (name.length > 0) {
                                    stmt = `DROP PROCEDURE \`${name[0]}\`$$\n${stmt}`;
                                } else {
                                    name = Array.from(stmt.matchAll(/FUNCTION `(.*?)`/gm), (m) => { return m[1]; });
                                    if (name.length) {
                                        stmt = `DROP FUNCTION \`${name[0]}\`$$\n${stmt}`;
                                    }
                                }
                            }
                            stmt = `DELIMITER $$\n${stmt}$$\nDELIMITER ;`;
                        }
                        void env.clipboard.writeText(stmt).then(() => {
                            showMessageWithTimeout("The create script was copied to the system clipboard");
                        });
                    }
                }
            }
        }).catch((event) => {
            void window.showErrorMessage("Error while getting create script: " + (event.message as string));
        });
    }

    public dropItem(): void {
        const message = `Do you want to drop the ${this.dbType} ${this.name}?`;
        const okText = `Drop ${this.name}`;
        void showModalDialog(message, okText, "This operation cannot be reverted!").then((accepted) => {
            if (accepted) {
                const query = `drop ${this.dbType} ${this.qualifiedName}`;
                this.backend.execute(query).then(() => {
                    // TODO: refresh only the affected connection.
                    void commands.executeCommand("msg.refreshConnections");
                    showMessageWithTimeout(`The object ${this.name} has been dropped successfully.`);
                }).catch((errorEvent): void => {
                    void window.showErrorMessage(`Error dropping the object: ${errorEvent.message as string}`);
                });
            }
        });
    }

    public get qualifiedName(): string {
        return "";
    }

    public get dbType(): string {
        return "";
    }

    /**
     * The result for create script retrieval differs for certain DB types.
     *
     * @returns the index in the result row, where to find the correct text.
     *
     */
    protected get createScriptResultIndex(): number {
        return 1;
    }
}
