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

    public async getCreateSqlScript(withDelimiter = false, withDrop = false): Promise<string> {
        let sql = "";

        const data = await this.backend.execute(`show create ${this.dbType} ${this.qualifiedName}`);
        if (data) {
            if (data.rows && data.rows.length > 0) {
                const firstRow = data.rows[0] as string[];
                const index = this.createScriptResultIndex;
                if (firstRow.length > index) {
                    sql = firstRow[index];
                    // The SHOW CREATE PROCEDURE / FUNCTION statements do not return the fully qualified
                    // name including the schema, just the name of the procedure / functions with backticks
                    sql = sql.replaceAll(
                        /PROCEDURE `(.*?)`/gm,
                        `PROCEDURE \`${this.schema}\`.\`${this.name}\``);
                    sql = sql.replaceAll(
                        /FUNCTION `(.*?)`/gm,
                        `FUNCTION \`${this.schema}\`.\`${this.name}\``);
                    if (withDelimiter) {
                        if (withDrop) {
                            const name = Array.from(sql.matchAll(/PROCEDURE `(.*?)`/gm), (m) => { return m[1]; });
                            if (name.length > 0) {
                                sql = `DROP PROCEDURE \`${this.schema}\`.\`${this.name}\`%%\n${sql}`;
                            } else {
                                sql = `DROP FUNCTION \`${this.schema}\`.\`${this.name}\`%%\n${sql}`;
                            }
                        }
                        sql = `DELIMITER %%\n${sql}%%\nDELIMITER ;`;
                    }
                }
            }
        }

        if (sql === "") {
            throw new Error("Failed to get CREATE statement.");
        }

        return sql;
    }

    public async copyCreateScriptToClipboard(withDelimiter = false, withDrop = false): Promise<void> {
        try {
            const sql = await this.getCreateSqlScript(withDelimiter, withDrop);

            void env.clipboard.writeText(sql).then(() => {
                showMessageWithTimeout("The create script was copied to the system clipboard");
            });
        } catch (error) {
            void window.showErrorMessage("Error while getting create script: " + String(error));
        }
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
