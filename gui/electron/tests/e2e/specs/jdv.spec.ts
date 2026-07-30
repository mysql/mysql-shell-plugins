/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { spawnSync } from "node:child_process";

import { test, expect } from "../fixtures/electron.js";
import type { ElectronWorkbench } from "../helpers/ElectronWorkbench.js";
import {
    localMySQLConnection, mysqlshUserConfigHome, quoteIdentifier, uniqueSchemaName,
} from "../helpers/testConfig.js";

const untitledSqlScriptTab = /^Untitled(?:-\d+)?\.sql$/;

const executeSql = (connection: ReturnType<typeof localMySQLConnection>, statements: string[]): void => {
    const response = spawnSync(process.env.ELECTRON_E2E_MYSQLSH ?? process.env.MYSQLSH ?? "mysqlsh", [
        "--disable-builtin-plugins",
        "--sql",
        "--host", connection.host,
        "--port", connection.port,
        "--user", connection.user,
        `--password=${connection.password}`,
        "-e", statements.join("\n"),
    ], {
        encoding: "utf8",
        env: {
            ...process.env,
            MYSQLSH_USER_CONFIG_HOME: mysqlshUserConfigHome(),
        },
    });

    if (response.error) {
        throw response.error;
    }

    if (response.status !== 0) {
        throw new Error(response.stderr || response.stdout || "mysqlsh failed to execute SQL.");
    }
};

const openSqlScript = async (workbench: ElectronWorkbench, caption: string) => {
    const connection = localMySQLConnection(caption);
    await workbench.createMySQLConnection(connection);
    await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);
    await workbench.settlePasswordPrompts(connection.password, 10000);
    await workbench.waitForSchemasTreeReady();

    return connection;
};

test.describe("JSON Relational Duality Views", () => {
    test("opens the builder from a table context menu", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron JDV Builder");
        const schemaName = uniqueSchemaName(testInfo, "jdv");
        const schema = quoteIdentifier(schemaName);

        executeSql(connection, [
            `DROP SCHEMA IF EXISTS ${schema};`,
            `CREATE SCHEMA ${schema};`,
            `CREATE TABLE ${schema}.customer (id INT PRIMARY KEY, username VARCHAR(50) NOT NULL);`,
            `CREATE TABLE ${schema}.orders (id INT PRIMARY KEY, customer_id INT NOT NULL, ` +
                `FOREIGN KEY (customer_id) REFERENCES ${schema}.customer(id));`,
        ]);

        try {
            await openSqlScript(workbench, connection.caption);
            const customerTreePath = [schemaName, "Tables", "customer"];
            await workbench.expandSchemaTreePath(customerTreePath);
            await workbench.selectSchemaTreePathAction(customerTreePath, ["Create a JSON Duality View..."]);

            const dialog = page.locator("#jdvObjectDialog");
            await workbench.expectVisibleWithoutPassword(dialog, "JSON Duality View Builder", 30000);
            await expect(dialog).toContainText("Json Duality View Builder");
            await expect(dialog.locator("#viewName")).toHaveValue("customer_dv");
            await expect(dialog.locator(".jdvObjectTreeGrid")).toBeVisible();

            await dialog.locator("#cancel").click();
            await expect(dialog).toBeHidden();
        } finally {
            executeSql(connection, [`DROP SCHEMA IF EXISTS ${schema};`]);
        }
    });
});
