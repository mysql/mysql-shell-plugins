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
import { localMySQLConnection, mysqlshUserConfigHome, uniqueSchemaName } from "../helpers/testConfig.js";

const untitledSqlScriptTab = /^Untitled(?:-\d+)?\.sql$/;

const sqlString = (value: string): string => {
    return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
};

const executeSql = (connection: ReturnType<typeof localMySQLConnection>, statements: string | string[]): string => {
    const response = spawnSync(process.env.ELECTRON_E2E_MYSQLSH ?? process.env.MYSQLSH ?? "mysqlsh", [
        "--disable-builtin-plugins",
        "--sql",
        "--result-format=tabbed",
        "--host", connection.host,
        "--port", connection.port,
        "--user", connection.user,
        `--password=${connection.password}`,
        "-e", Array.isArray(statements) ? statements.join("\n") : statements,
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

    return response.stdout;
};

const failAuthentication = (connection: ReturnType<typeof localMySQLConnection>, user: string): void => {
    const response = spawnSync(process.env.ELECTRON_E2E_MYSQLSH ?? process.env.MYSQLSH ?? "mysqlsh", [
        "--disable-builtin-plugins",
        "--sql",
        "--host", connection.host,
        "--port", connection.port,
        "--user", user,
        "--password=WrongE2ePassword!1",
        "-e", "SELECT 1;",
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

    if (response.status === 0) {
        throw new Error("The intentional failed-login attempt unexpectedly succeeded.");
    }
};

test.describe("User accounts and privilege management", () => {
    test("creates a user account from the native Database menu", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const adminConnection = localMySQLConnection("E2E Electron Create User Admin");
        const username = uniqueSchemaName(testInfo, "e2eu").slice(0, 32);
        const password = "E2eCreateUser!1";
        const userConnection = {
            ...adminConnection,
            caption: `E2E Electron ${username}`,
            user: username,
            password,
            schema: "",
        };

        await workbench.createMySQLConnection(adminConnection);
        await workbench.openSqlScriptFromConnectionTile(adminConnection.caption, adminConnection.password,
            untitledSqlScriptTab);
        expect(executeSql(adminConnection,
            `SELECT COUNT(*) AS account_count FROM mysql.user WHERE User = '${username}' AND Host = '%';`)).toContain("0");

        await workbench.clickMenu(["Database", "User Accounts"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#userAccountsOverview"), "User Accounts");
        await page.locator("#userAccountsToolbar [data-tooltip='Create user']").click();
        const dialog = page.locator("#createUserDialog");
        await expect(dialog).toBeVisible({ timeout: 15000 });
        await dialog.locator("#userName input, input#userName").fill(username);
        await dialog.locator("#hostName input, input#hostName").fill("%");
        await dialog.locator("#password input, input#password").fill(password);
        await dialog.locator("#passwordConfirmation input, input#passwordConfirmation").fill(password);
        await dialog.locator("#ok").click();
        await expect(dialog).toBeHidden({ timeout: 15000 });
        await expect(page.locator("#userAccountsGrid .tabulator-row", { hasText: username })).toBeVisible({
            timeout: 15000,
        });

        await workbench.closeActiveTabDiscardingChanges();
        await workbench.closeActiveTabDiscardingChanges();
        await workbench.createMySQLConnection(userConnection);
        await workbench.openSqlScriptFromConnectionTile(userConnection.caption, userConnection.password,
            untitledSqlScriptTab);

        await workbench.closeActiveTabDiscardingChanges();
        await workbench.selectConnectionTileAction(userConnection.caption, ["Delete Connection…"]);
        await workbench.acceptConfirmDialog();
        expect(executeSql(adminConnection, [
            `DROP USER IF EXISTS '${username}'@'%';`,
            `SELECT COUNT(*) AS account_count FROM mysql.user WHERE User = '${username}' AND Host = '%';`,
        ])).toContain("0");
    });

    test("deletes an existing user account from the account list context menu", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Delete User");
        const username = uniqueSchemaName(testInfo, "a_e2eu").slice(0, 32);

        await workbench.createMySQLConnection(connection);
        await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);
        expect(executeSql(connection, [
            `DROP USER IF EXISTS '${username}'@'%';`,
            `CREATE USER '${username}'@'%' IDENTIFIED BY 'E2eDeleteUser!1';`,
            `SELECT COUNT(*) AS account_count FROM mysql.user WHERE User = '${username}' AND Host = '%';`,
        ])).toContain("1");

        await workbench.clickMenu(["Database", "User Accounts"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#userAccountsOverview"), "User Accounts");
        await expect(page.locator("#userAccountsGrid .tabulator-row").first()).toBeVisible({ timeout: 15000 });
        const userRow = page.locator("#userAccountsGrid .tabulator-row", { hasText: username });
        await expect(userRow).toBeVisible({ timeout: 15000 });
        await workbench.selectUserAccountRowAction(userRow, ["Delete Account..."]);
        await workbench.acceptConfirmDialog();
        await expect(userRow).toHaveCount(0, { timeout: 15000 });
    });

    test("clones an existing user account from the account list context menu", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Clone User");
        const username = uniqueSchemaName(testInfo, "a_e2eu").slice(0, 32);

        await workbench.createMySQLConnection(connection);
        await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);
        expect(executeSql(connection, [
            `DROP USER IF EXISTS '${username}'@'%';`,
            `CREATE USER '${username}'@'%' IDENTIFIED BY 'E2eCloneUser!1';`,
            `SELECT COUNT(*) AS account_count FROM mysql.user WHERE User = '${username}' AND Host = '%';`,
        ])).toContain("1");

        await workbench.clickMenu(["Database", "User Accounts"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#userAccountsOverview"), "User Accounts");
        await expect(page.locator("#userAccountsGrid .tabulator-row").first()).toBeVisible({ timeout: 15000 });
        const userRow = page.locator("#userAccountsGrid .tabulator-row", { hasText: username });
        await expect(userRow).toBeVisible({ timeout: 15000 });
        await workbench.selectUserAccountRowAction(userRow, ["Clone Account..."]);

        const dialog = page.locator("#createUserDialog");
        await expect(dialog).toBeVisible({ timeout: 15000 });
        await expect(dialog.locator("#userName input, input#userName")).toHaveValue(`${username}_copy`);
    });

    test("creates a user account with a random password", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Random Password");
        const username = uniqueSchemaName(testInfo, "a_e2eu").slice(0, 32);
        const replacementPassword = "E2eReplacementUser!3";

        await workbench.createMySQLConnection(connection);
        await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);
        await workbench.clickMenu(["Database", "User Accounts"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#userAccountsOverview"), "User Accounts");
        await page.locator("#userAccountsToolbar [data-tooltip='Create user']").click();

        const createDialog = page.locator("#createUserDialog");
        await expect(createDialog).toBeVisible({ timeout: 15000 });
        await createDialog.locator("#userName input, input#userName").fill(username);
        await createDialog.locator("#hostName input, input#hostName").fill("%");
        await createDialog.locator("#randomPassword").click();
        await createDialog.locator("#ok").click();
        await expect(createDialog).toBeHidden({ timeout: 15000 });

        const generatedPasswordDialog = page.locator("#generatedPasswordDialog");
        await expect(generatedPasswordDialog).toBeVisible({ timeout: 15000 });
        const generatedPassword = await generatedPasswordDialog
            .locator("#generatedPassword input, input#generatedPassword").inputValue();
        await generatedPasswordDialog.getByRole("button", { name: "Close" }).click();
        await expect(generatedPasswordDialog).toBeHidden({ timeout: 15000 });

        const userConnection = {
            ...connection,
            caption: `E2E Electron ${username}`,
            user: username,
            password: generatedPassword,
            schema: "",
        };
        await workbench.closeActiveTabDiscardingChanges();
        await workbench.closeActiveTabDiscardingChanges();
        await workbench.createMySQLConnection(userConnection);
        await workbench.openSqlScriptFromConnectionTile(userConnection.caption, userConnection.password, untitledSqlScriptTab);
        expect(executeSql(userConnection, [
            `ALTER USER USER() IDENTIFIED BY '${replacementPassword}' REPLACE '${sqlString(generatedPassword)}';`,
            "SELECT 'password changed' AS result;",
        ])).toContain("password changed");
    });

    test("creates an account requiring a password reset", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Password Reset Required");
        const username = uniqueSchemaName(testInfo, "a_e2eu").slice(0, 32);
        const password = "E2ePasswordReset!1";

        await workbench.createMySQLConnection(connection);
        await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);
        await workbench.clickMenu(["Database", "User Accounts"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#userAccountsOverview"), "User Accounts");
        await page.locator("#userAccountsToolbar [data-tooltip='Create user']").click();

        const dialog = page.locator("#createUserDialog");
        await expect(dialog).toBeVisible({ timeout: 15000 });
        await dialog.locator("#userName input, input#userName").fill(username);
        await dialog.locator("#hostName input, input#hostName").fill("%");
        await dialog.locator("#password input, input#password").fill(password);
        await dialog.locator("#passwordConfirmation input, input#passwordConfirmation").fill(password);
        await dialog.locator("#passwordExpire").click();
        await dialog.locator("#ok").click();
        await expect(dialog).toBeHidden({ timeout: 15000 });

        const userRow = page.locator("#userAccountsGrid .tabulator-row", { hasText: username });
        await expect(userRow).toBeVisible({ timeout: 15000 });
        await expect(userRow.locator(".userAccountPill").first()).toHaveText("EXPIRED");
    });

    test("creates a locked user account through the UI", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Create Locked User");
        const username = uniqueSchemaName(testInfo, "a_e2eu").slice(0, 32);
        const password = "E2eLockedUser!1";

        await workbench.createMySQLConnection(connection);
        await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);
        await workbench.clickMenu(["Database", "User Accounts"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#userAccountsOverview"), "User Accounts");
        await page.locator("#userAccountsToolbar [data-tooltip='Create user']").click();

        const dialog = page.locator("#createUserDialog");
        await expect(dialog).toBeVisible({ timeout: 15000 });
        await dialog.locator("#userName input, input#userName").fill(username);
        await dialog.locator("#hostName input, input#hostName").fill("%");
        await dialog.locator("#password input, input#password").fill(password);
        await dialog.locator("#passwordConfirmation input, input#passwordConfirmation").fill(password);
        await dialog.locator("#lockAccount").first().click();
        await dialog.locator("#ok").click();
        await expect(dialog).toBeHidden({ timeout: 15000 });

        expect(executeSql(connection,
            `SELECT account_locked FROM mysql.user WHERE User = '${username}' AND Host = '%';`)).toContain("Y");

        executeSql(connection, `DROP USER IF EXISTS '${username}'@'%';`);
        await workbench.closeActiveTabDiscardingChanges();
    });

    test("locks and unlocks an account from the account list", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Lock Unlock User");
        const username = uniqueSchemaName(testInfo, "a_e2eu").slice(0, 32);

        await workbench.createMySQLConnection(connection);
        await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);
        expect(executeSql(connection, [
            `DROP USER IF EXISTS '${username}'@'%';`,
            `CREATE USER '${username}'@'%' IDENTIFIED BY 'E2eLockUnlockUser!1';`,
            `SELECT COUNT(*) AS account_count FROM mysql.user WHERE User = '${username}' AND Host = '%';`,
        ])).toContain("1");

        await workbench.clickMenu(["Database", "User Accounts"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#userAccountsOverview"), "User Accounts");
        const userRow = page.locator("#userAccountsGrid .tabulator-row", { hasText: username });
        const statusPill = userRow.locator(".userAccountPill").first();
        await expect(userRow).toBeVisible({ timeout: 15000 });
        await expect(statusPill).toHaveText("UNLOCKED");

        await workbench.selectUserAccountRowAction(userRow, ["Lock Account"]);
        await expect(statusPill).toHaveText("LOCKED");

        await workbench.selectUserAccountRowAction(userRow, ["Unlock Account"]);
        await expect(statusPill).toHaveText("UNLOCKED");

        executeSql(connection, `DROP USER IF EXISTS '${username}'@'%';`);
        await workbench.closeActiveTabDiscardingChanges();
    });

    test("shows a temporary failed-login lock", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Temporary Account Lock");
        const username = uniqueSchemaName(testInfo, "a_e2eu").slice(0, 32);
        const password = "E2eTemporaryLock!1";

        await workbench.createMySQLConnection(connection);
        await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);
        expect(executeSql(connection, [
            `DROP USER IF EXISTS '${username}'@'%';`,
            `CREATE USER '${username}'@'%' IDENTIFIED BY '${password}' `
                + "FAILED_LOGIN_ATTEMPTS 2 PASSWORD_LOCK_TIME UNBOUNDED;",
            `SELECT COUNT(*) AS account_count FROM mysql.user WHERE User = '${username}' AND Host = '%';`,
        ])).toContain("1");

        failAuthentication(connection, username);
        failAuthentication(connection, username);

        await workbench.clickMenu(["Database", "User Accounts"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#userAccountsOverview"), "User Accounts");
        const userRow = page.locator("#userAccountsGrid .tabulator-row", { hasText: username });
        const statusPill = userRow.locator(".userAccountPill").first();
        await expect(userRow).toBeVisible({ timeout: 15000 });
        await expect(statusPill).toHaveText("LOCKED");

        const temporaryLockOutput = executeSql(connection, [
            "SELECT u.account_locked, tal.LOCKED AS temporarily_locked",
            "FROM mysql.user u",
            "LEFT JOIN performance_schema.temporary_account_locks tal",
            "  ON tal.USER = u.User AND tal.HOST = u.Host",
            `WHERE u.User = '${username}' AND u.Host = '%';`,
        ]);
        expect(temporaryLockOutput).toContain("N");
        expect(temporaryLockOutput).toContain("YES");

        executeSql(connection, `DROP USER IF EXISTS '${username}'@'%';`);
        await workbench.closeActiveTabDiscardingChanges();
    });

    test("preserves password policies when editing an unrelated comment", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Password Policy Update");
        const username = uniqueSchemaName(testInfo, "a_e2eu").slice(0, 32);
        const password = "E2ePasswordPolicy!1";

        await workbench.createMySQLConnection(connection);
        await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);
        expect(executeSql(connection, [
            `DROP USER IF EXISTS '${username}'@'%';`,
            `CREATE USER '${username}'@'%' IDENTIFIED BY '${password}' `
                + "PASSWORD EXPIRE INTERVAL 6 DAY PASSWORD HISTORY 3 PASSWORD REUSE INTERVAL 4 DAY "
                + "PASSWORD REQUIRE CURRENT FAILED_LOGIN_ATTEMPTS 2 PASSWORD_LOCK_TIME 7;",
            `SELECT COUNT(*) AS account_count FROM mysql.user WHERE User = '${username}' AND Host = '%';`,
        ])).toContain("1");

        failAuthentication(connection, username);
        failAuthentication(connection, username);

        await workbench.clickMenu(["Database", "User Accounts"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#userAccountsOverview"), "User Accounts");
        const userRow = page.locator("#userAccountsGrid .tabulator-row", { hasText: username });
        await expect(userRow).toBeVisible({ timeout: 15000 });
        await workbench.selectUserAccountRowAction(userRow, ["Edit Account..."]);
        const dialog = page.locator("#createUserDialog");
        await expect(dialog).toBeVisible({ timeout: 15000 });
        await dialog.locator("#comment textarea, textarea#comment, #comment input, input#comment")
            .fill("unrelated comment update");
        await dialog.locator("#ok").click();
        await expect(dialog).toBeHidden({ timeout: 15000 });

        const passwordPolicyOutput = executeSql(connection, [
            "SELECT u.password_lifetime, u.Password_reuse_history, u.Password_reuse_time,",
            "       u.Password_require_current,",
            "       JSON_UNQUOTE(JSON_EXTRACT(u.User_attributes,",
            "           '$.Password_locking.failed_login_attempts')) AS failed_login_attempts,",
            "       JSON_UNQUOTE(JSON_EXTRACT(u.User_attributes,",
            "           '$.Password_locking.password_lock_time_days')) AS password_lock_time,",
            "       u.account_locked, tal.LOCKED AS temporarily_locked",
            "FROM mysql.user u",
            "LEFT JOIN performance_schema.temporary_account_locks tal",
            "  ON tal.USER = u.User AND tal.HOST = u.Host",
            `WHERE u.User = '${username}' AND u.Host = '%';`,
        ]);
        for (const value of ["6", "3", "4", "Y", "2", "7", "N", "YES"]) {
            expect(passwordPolicyOutput).toContain(value);
        }

        executeSql(connection, `DROP USER IF EXISTS '${username}'@'%';`);
        await workbench.closeActiveTabDiscardingChanges();
    });

    test("shows SQL for a granted account opened from its row context menu", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron View User SQL");
        const username = uniqueSchemaName(testInfo, "a_e2eu").slice(0, 32);

        await workbench.createMySQLConnection(connection);
        await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);
        expect(executeSql(connection, [
            `DROP USER IF EXISTS '${username}'@'%';`,
            `CREATE USER '${username}'@'%' IDENTIFIED BY 'E2eViewUserSql!1';`,
            `GRANT SELECT, INSERT ON *.* TO '${username}'@'%';`,
            `SELECT COUNT(*) AS account_count FROM mysql.user WHERE User = '${username}' AND Host = '%';`,
        ])).toContain("1");

        await workbench.clickMenu(["Database", "User Accounts"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#userAccountsOverview"), "User Accounts");
        const userRow = page.locator("#userAccountsGrid .tabulator-row", { hasText: username });
        await expect(userRow).toBeVisible({ timeout: 15000 });
        await workbench.selectUserAccountRowContextMenuAction(userRow, ["View as SQL..."]);

        const dialog = page.locator("#viewUserAccountSqlDialog");
        const output = dialog.locator("#userAccountSqlOutput");
        await expect(dialog).toBeVisible({ timeout: 15000 });
        await expect(output).toHaveValue(new RegExp(`-- SHOW CREATE USER '${username}'@'%'`));
        await expect(output).toHaveValue(new RegExp("CREATE USER `" + username + "`@`%`"));
        await expect(output).toHaveValue(new RegExp(`-- SHOW GRANTS FOR '${username}'@'%'`));
        await expect(output).toHaveValue(new RegExp(
            "GRANT (?=[^\\n]*SELECT)(?=[^\\n]*INSERT)[^\\n]* ON \\*\\.\\* TO `" + username + "`@`%`",
        ));
        await dialog.locator("#cancel").click();
        await expect(dialog).toBeHidden({ timeout: 15000 });

        executeSql(connection, `DROP USER IF EXISTS '${username}'@'%';`);
        await workbench.closeActiveTabDiscardingChanges();
    });

    test("shows a role created through SQL as locked", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Role Status");
        const roleName = uniqueSchemaName(testInfo, "a_e2er").slice(0, 32);

        await workbench.createMySQLConnection(connection);
        await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);
        expect(executeSql(connection, [
            `DROP ROLE IF EXISTS '${roleName}'@'%';`,
            `CREATE ROLE '${roleName}'@'%';`,
            `SELECT COUNT(*) AS role_count FROM mysql.user WHERE User = '${roleName}' AND Host = '%';`,
        ])).toContain("1");

        await workbench.clickMenu(["Database", "User Accounts"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#userAccountsOverview"), "User Accounts");
        const roleRow = page.locator("#userAccountsGrid .tabulator-row", { hasText: roleName });
        await expect(roleRow).toBeVisible({ timeout: 15000 });
        await expect(roleRow.locator(".userAccountPill").first()).toHaveText("LOCKED");
    });

    test("assigns a role to an account", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Assign Role");
        const username = uniqueSchemaName(testInfo, "a_e2eu").slice(0, 32);
        const roleName = uniqueSchemaName(testInfo, "a_e2er").slice(0, 32);

        await workbench.createMySQLConnection(connection);
        await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);
        expect(executeSql(connection, [
            `DROP USER IF EXISTS '${username}'@'%';`,
            `DROP ROLE IF EXISTS '${roleName}'@'%';`,
            `CREATE USER '${username}'@'%' IDENTIFIED BY 'E2eAssignRole!1';`,
            `CREATE ROLE '${roleName}'@'%';`,
            `SELECT COUNT(*) AS account_count FROM mysql.user `
                + `WHERE (User = '${username}' OR User = '${roleName}') AND Host = '%';`,
        ])).toContain("2");

        await workbench.clickMenu(["Database", "User Accounts"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#userAccountsOverview"), "User Accounts");
        const userRow = page.locator("#userAccountsGrid .tabulator-row", { hasText: username });
        await expect(userRow).toBeVisible({ timeout: 15000 });
        await workbench.selectUserAccountRowAction(userRow, ["Manage Roles..."]);

        const dialog = page.locator("#manageRolesAndPrivilegesDialog");
        await expect(dialog).toBeVisible({ timeout: 15000 });
        await dialog.locator(`[data-tooltip='Add ${roleName}@%']`).click();
        await dialog.locator("#ok").click();
        await expect(dialog).toBeHidden({ timeout: 15000 });

        await expect(userRow.locator(".tabulator-cell[tabulator-field='roles'] .userAccountPill"))
            .toHaveText("1");
    });

    test("does not count global privileges inherited from a non-default role", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Inherited Global Privileges");
        const username = uniqueSchemaName(testInfo, "a_e2eu").slice(0, 32);
        const roleName = uniqueSchemaName(testInfo, "a_e2er").slice(0, 32);

        await workbench.createMySQLConnection(connection);
        await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);
        expect(executeSql(connection, [
            `DROP USER IF EXISTS '${username}'@'%';`,
            `DROP ROLE IF EXISTS '${roleName}'@'%';`,
            `CREATE USER '${username}'@'%' IDENTIFIED BY 'E2eInheritedPrivileges!1';`,
            `CREATE ROLE '${roleName}'@'%';`,
            `GRANT SELECT, INSERT ON *.* TO '${roleName}'@'%';`,
            `SELECT COUNT(*) AS account_count FROM mysql.user `
                + `WHERE (User = '${username}' OR User = '${roleName}') AND Host = '%';`,
        ])).toContain("2");

        await workbench.clickMenu(["Database", "User Accounts"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#userAccountsOverview"), "User Accounts");
        const userRow = page.locator("#userAccountsGrid .tabulator-row", { hasText: username });
        const globalPrivilegesPill = userRow.locator(
            ".tabulator-cell[tabulator-field='globalPrivileges'] .userAccountPill",
        );
        await expect(userRow).toBeVisible({ timeout: 15000 });
        await expect(globalPrivilegesPill).toHaveText("0");
        await workbench.selectUserAccountRowAction(userRow, ["Manage Roles..."]);

        const dialog = page.locator("#manageRolesAndPrivilegesDialog");
        await expect(dialog).toBeVisible({ timeout: 15000 });
        await dialog.locator(`[data-tooltip='Add ${roleName}@%']`).click();
        await dialog.locator("#ok").click();
        await expect(dialog).toBeHidden({ timeout: 15000 });

        await expect(globalPrivilegesPill).toHaveText("0");
    });

    test("does not count global privileges inherited from a default role", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Default Role Global Privileges");
        const username = uniqueSchemaName(testInfo, "a_e2eu").slice(0, 32);
        const roleName = uniqueSchemaName(testInfo, "a_e2er").slice(0, 32);

        await workbench.createMySQLConnection(connection);
        await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);
        expect(executeSql(connection, [
            `DROP USER IF EXISTS '${username}'@'%';`,
            `DROP ROLE IF EXISTS '${roleName}'@'%';`,
            `CREATE USER '${username}'@'%' IDENTIFIED BY 'E2eDefaultRolePrivileges!1';`,
            `CREATE ROLE '${roleName}'@'%';`,
            `GRANT SELECT, INSERT ON *.* TO '${roleName}'@'%';`,
            `SELECT COUNT(*) AS account_count FROM mysql.user `
                + `WHERE (User = '${username}' OR User = '${roleName}') AND Host = '%';`,
        ])).toContain("2");

        await workbench.clickMenu(["Database", "User Accounts"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#userAccountsOverview"), "User Accounts");
        const userRow = page.locator("#userAccountsGrid .tabulator-row", { hasText: username });
        const globalPrivilegesPill = userRow.locator(
            ".tabulator-cell[tabulator-field='globalPrivileges'] .userAccountPill",
        );
        await expect(userRow).toBeVisible({ timeout: 15000 });
        await expect(globalPrivilegesPill).toHaveText("0");
        await workbench.selectUserAccountRowAction(userRow, ["Manage Roles..."]);

        const dialog = page.locator("#manageRolesAndPrivilegesDialog");
        await expect(dialog).toBeVisible({ timeout: 15000 });
        await dialog.locator(`[data-tooltip='Add ${roleName}@%']`).click();
        await dialog.locator(`[data-tooltip='Set ${roleName}@% as default role']`).click();
        await dialog.locator("#ok").click();
        await expect(dialog).toBeHidden({ timeout: 15000 });

        await expect(globalPrivilegesPill).toHaveText("0");
    });

    test("marks global privileges inherited from an assigned role", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Inherited Privilege Labels");
        const username = uniqueSchemaName(testInfo, "a_e2eu").slice(0, 32);
        const roleName = uniqueSchemaName(testInfo, "a_e2er").slice(0, 32);

        await workbench.createMySQLConnection(connection);
        await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);
        expect(executeSql(connection, [
            `DROP USER IF EXISTS '${username}'@'%';`,
            `DROP ROLE IF EXISTS '${roleName}'@'%';`,
            `CREATE USER '${username}'@'%' IDENTIFIED BY 'E2eInheritedPrivilegeLabels!1';`,
            `CREATE ROLE '${roleName}'@'%';`,
            `GRANT SELECT, INSERT ON *.* TO '${roleName}'@'%';`,
            `GRANT '${roleName}'@'%' TO '${username}'@'%';`,
            "SELECT COUNT(*) AS assigned_role_count FROM mysql.role_edges "
                + `WHERE FROM_USER = '${roleName}' AND FROM_HOST = '%' `
                + `AND TO_USER = '${username}' AND TO_HOST = '%';`,
        ])).toContain("1");

        await workbench.clickMenu(["Database", "User Accounts"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#userAccountsOverview"), "User Accounts");
        const userRow = page.locator("#userAccountsGrid .tabulator-row", { hasText: username });
        await expect(userRow).toBeVisible({ timeout: 15000 });
        await workbench.selectUserAccountRowAction(userRow, ["Manage Global Privileges..."]);

        const dialog = page.locator("#manageRolesAndPrivilegesDialog");
        await expect(dialog).toBeVisible({ timeout: 15000 });
        await expect(dialog.locator(".userAccountAssignedPrivileges")).toContainText("No privileges assigned");
        for (const privilege of ["SELECT", "INSERT"]) {
            const privilegeEntry = dialog.locator(".userAccountPrivilegeResult", { hasText: privilege });
            await expect(privilegeEntry).toBeVisible();
            await expect(privilegeEntry.locator(".userAccountPrivilegeInheritedPill")).toHaveText("INHERITED");
        }
    });

    test("shows inherited role globals as unselected object privileges", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Inherited Object Privileges");
        const username = uniqueSchemaName(testInfo, "a_e2eu").slice(0, 32);
        const roleName = uniqueSchemaName(testInfo, "a_e2er").slice(0, 32);

        await workbench.createMySQLConnection(connection);
        await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);
        expect(executeSql(connection, [
            `DROP USER IF EXISTS '${username}'@'%';`,
            `DROP ROLE IF EXISTS '${roleName}'@'%';`,
            "SET GLOBAL partial_revokes = ON;",
            `CREATE USER '${username}'@'%' IDENTIFIED BY 'E2eInheritedObjectPrivileges!1';`,
            `CREATE ROLE '${roleName}'@'%';`,
            `GRANT SELECT, INSERT ON *.* TO '${roleName}'@'%';`,
            `GRANT '${roleName}'@'%' TO '${username}'@'%';`,
            "SELECT COUNT(*) AS assigned_role_count FROM mysql.role_edges "
                + `WHERE FROM_USER = '${roleName}' AND FROM_HOST = '%' `
                + `AND TO_USER = '${username}' AND TO_HOST = '%';`,
        ])).toContain("1");

        await workbench.clickMenu(["Database", "User Accounts"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#userAccountsOverview"), "User Accounts");
        const userRow = page.locator("#userAccountsGrid .tabulator-row", { hasText: username });
        await expect(userRow).toBeVisible({ timeout: 15000 });
        await workbench.selectUserAccountRowAction(userRow, ["Manage Object Privileges..."]);

        const dialog = page.locator("#manageRolesAndPrivilegesDialog");
        await expect(dialog).toBeVisible({ timeout: 15000 });
        await expect(dialog.locator(".userAccountAssignedPrivileges")).toContainText("No privileges assigned");
        for (const privilege of ["SELECT", "INSERT"]) {
            const privilegeEntry = dialog.locator(".userAccountPrivilegeResult", { hasText: privilege });
            await expect(privilegeEntry).toBeVisible();
            await expect(privilegeEntry.locator(".userAccountPrivilegeInheritedPill")).toHaveText("INHERITED");
        }
    });

    test("shows direct object and global privileges as X plus GLOBAL", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Object Plus Global Privileges");
        const username = uniqueSchemaName(testInfo, "a_e2eu").slice(0, 32);

        await workbench.createMySQLConnection(connection);
        await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);
        expect(executeSql(connection, [
            "SET GLOBAL partial_revokes = ON;",
            `DROP USER IF EXISTS '${username}'@'%';`,
            `CREATE USER '${username}'@'%' IDENTIFIED BY 'E2eObjectPlusGlobal!1';`,
            `GRANT SELECT ON *.* TO '${username}'@'%';`,
            `GRANT INSERT ON sakila.* TO '${username}'@'%';`,
            `SELECT COUNT(*) AS account_count FROM mysql.user WHERE User = '${username}' AND Host = '%';`,
        ])).toContain("1");

        await workbench.clickMenu(["Database", "User Accounts"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#userAccountsOverview"), "User Accounts");
        const userRow = page.locator("#userAccountsGrid .tabulator-row", { hasText: username });
        await expect(userRow).toBeVisible({ timeout: 15000 });
        await expect(userRow.locator(".tabulator-cell[tabulator-field='objectPrivileges'] .userAccountPill"))
            .toHaveText("1+global");
    });

    test("counts global privileges granted despite inheritance", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Grant Inherited Global Privileges");
        const username = uniqueSchemaName(testInfo, "a_e2eu").slice(0, 32);
        const roleName = uniqueSchemaName(testInfo, "a_e2er").slice(0, 32);

        await workbench.createMySQLConnection(connection);
        await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);
        expect(executeSql(connection, [
            `DROP USER IF EXISTS '${username}'@'%';`,
            `DROP ROLE IF EXISTS '${roleName}'@'%';`,
            `CREATE USER '${username}'@'%' IDENTIFIED BY 'E2eGrantInheritedPrivileges!1';`,
            `CREATE ROLE '${roleName}'@'%';`,
            `GRANT SELECT, INSERT ON *.* TO '${roleName}'@'%';`,
            `GRANT '${roleName}'@'%' TO '${username}'@'%';`,
            "SELECT COUNT(*) AS assigned_role_count FROM mysql.role_edges "
                + `WHERE FROM_USER = '${roleName}' AND FROM_HOST = '%' `
                + `AND TO_USER = '${username}' AND TO_HOST = '%';`,
        ])).toContain("1");

        await workbench.clickMenu(["Database", "User Accounts"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#userAccountsOverview"), "User Accounts");
        const userRow = page.locator("#userAccountsGrid .tabulator-row", { hasText: username });
        const globalPrivilegesPill = userRow.locator(
            ".tabulator-cell[tabulator-field='globalPrivileges'] .userAccountPill",
        );
        await expect(userRow).toBeVisible({ timeout: 15000 });
        await expect(globalPrivilegesPill).toHaveText("0");
        await workbench.selectUserAccountRowAction(userRow, ["Manage Global Privileges..."]);

        const dialog = page.locator("#manageRolesAndPrivilegesDialog");
        await expect(dialog).toBeVisible({ timeout: 15000 });
        for (const privilege of ["SELECT", "INSERT"]) {
            const privilegeEntry = dialog.locator(".userAccountPrivilegeResult", { hasText: privilege });
            await expect(privilegeEntry.locator(".userAccountPrivilegeInheritedPill")).toHaveText("INHERITED");
            await privilegeEntry.click();
        }
        await dialog.locator("#ok").click();
        await expect(dialog).toBeHidden({ timeout: 15000 });

        await expect(globalPrivilegesPill).toHaveText("2");
    });

    test("creates an account requiring TLS", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron TLS Required");
        const username = uniqueSchemaName(testInfo, "a_e2eu").slice(0, 32);
        const password = "E2eTlsRequired!1";

        await workbench.createMySQLConnection(connection);
        await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);
        await workbench.clickMenu(["Database", "User Accounts"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#userAccountsOverview"), "User Accounts");
        await page.locator("#userAccountsToolbar [data-tooltip='Create user']").click();

        const dialog = page.locator("#createUserDialog");
        await expect(dialog).toBeVisible({ timeout: 15000 });
        await dialog.locator("#userName input, input#userName").fill(username);
        await dialog.locator("#hostName input, input#hostName").fill("%");
        await dialog.locator("#password input, input#password").fill(password);
        await dialog.locator("#passwordConfirmation input, input#passwordConfirmation").fill(password);
        await dialog.locator(".tabItem", { hasText: "TLS" }).click();
        await dialog.getByRole("radio", { name: "Required", exact: true }).click();
        await dialog.locator("#ok").click();
        await expect(dialog).toBeHidden({ timeout: 15000 });

        const userRow = page.locator("#userAccountsGrid .tabulator-row", { hasText: username });
        await expect(userRow).toBeVisible({ timeout: 15000 });
        await expect(userRow.locator(".tabulator-cell[tabulator-field='sslOptions'] .userAccountPill"))
            .toHaveText("REQUIRED");
    });

    test("creates an account requiring a TLS certificate", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron TLS Certificate Required");
        const username = uniqueSchemaName(testInfo, "a_e2eu").slice(0, 32);
        const password = "E2eTlsCertificate!1";

        await workbench.createMySQLConnection(connection);
        await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);
        await workbench.clickMenu(["Database", "User Accounts"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#userAccountsOverview"), "User Accounts");
        await page.locator("#userAccountsToolbar [data-tooltip='Create user']").click();

        const dialog = page.locator("#createUserDialog");
        await expect(dialog).toBeVisible({ timeout: 15000 });
        await dialog.locator("#userName input, input#userName").fill(username);
        await dialog.locator("#hostName input, input#hostName").fill("%");
        await dialog.locator("#password input, input#password").fill(password);
        await dialog.locator("#passwordConfirmation input, input#passwordConfirmation").fill(password);
        await dialog.locator(".tabItem", { hasText: "TLS" }).click();
        await dialog.getByRole("radio", { name: "Require Certificate", exact: true }).click();
        await dialog.locator("#tlsIssuer textarea, textarea#tlsIssuer, #tlsIssuer input, input#tlsIssuer")
            .fill("CN=E2E Test Issuer");
        await dialog.locator("#ok").click();
        await expect(dialog).toBeHidden({ timeout: 15000 });

        const userRow = page.locator("#userAccountsGrid .tabulator-row", { hasText: username });
        await expect(userRow).toBeVisible({ timeout: 15000 });
        const tlsPill = userRow.locator(".tabulator-cell[tabulator-field='sslOptions'] .userAccountPill");
        await expect(tlsPill)
            .toHaveText("CERT REQUIRED");
        await tlsPill.hover();
        await expect(page.locator(".tooltip", { hasText: "issuer: CN=E2E Test Issuer" }))
            .toBeVisible({ timeout: 15000 });
    });

    test("creates an account with an expiring password", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Password Expiration");
        const username = uniqueSchemaName(testInfo, "a_e2eu").slice(0, 32);
        const password = "E2ePasswordExpiration!1";

        await workbench.createMySQLConnection(connection);
        await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);
        await workbench.clickMenu(["Database", "User Accounts"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#userAccountsOverview"), "User Accounts");
        await page.locator("#userAccountsToolbar [data-tooltip='Create user']").click();

        const dialog = page.locator("#createUserDialog");
        await expect(dialog).toBeVisible({ timeout: 15000 });
        await dialog.locator("#userName input, input#userName").fill(username);
        await dialog.locator("#hostName input, input#hostName").fill("%");
        await dialog.locator("#password input, input#password").fill(password);
        await dialog.locator("#passwordConfirmation input, input#passwordConfirmation").fill(password);
        const passwordManagement = dialog.locator("details.collapsibleValueGroup", {
            hasText: "Password Management",
        });
        await passwordManagement.locator("summary").click();
        await dialog.locator("#passwordExpiration input, input#passwordExpiration").fill("1");
        await dialog.locator("#ok").click();
        await expect(dialog).toBeHidden({ timeout: 15000 });

        const userRow = page.locator("#userAccountsGrid .tabulator-row", { hasText: username });
        await expect(userRow).toBeVisible({ timeout: 15000 });
        const statusPill = userRow.locator(".userAccountPill").first();
        await expect(statusPill).toHaveText("EXPIRING");
        await statusPill.hover();
        await expect(page.locator(".tooltip", { hasText: "1 day left" })).toBeVisible({ timeout: 15000 });
    });

    test("resets an account password from the account list context menu", async ({ page, workbench }, testInfo) => {
        await workbench.waitForShell();

        const connection = localMySQLConnection("E2E Electron Reset Password");
        const username = uniqueSchemaName(testInfo, "a_e2eu").slice(0, 32);
        const initialPassword = "E2eInitialUser!1";
        const resetPassword = "E2eResetUser!2";
        const replacementPassword = "E2eReplacementUser!3";
        const userConnection = {
            ...connection,
            caption: `E2E Electron ${username}`,
            user: username,
            password: resetPassword,
            schema: "",
        };

        await workbench.createMySQLConnection(connection);
        await workbench.openSqlScriptFromConnectionTile(connection.caption, connection.password, untitledSqlScriptTab);
        expect(executeSql(connection, [
            `DROP USER IF EXISTS '${username}'@'%';`,
            `CREATE USER '${username}'@'%' IDENTIFIED BY '${initialPassword}';`,
            `SELECT COUNT(*) AS account_count FROM mysql.user WHERE User = '${username}' AND Host = '%';`,
        ])).toContain("1");

        await workbench.clickMenu(["Database", "User Accounts"]);
        await workbench.expectVisibleWithoutPassword(page.locator("#userAccountsOverview"), "User Accounts");
        await expect(page.locator("#userAccountsGrid .tabulator-row").first()).toBeVisible({ timeout: 15000 });
        const userRow = page.locator("#userAccountsGrid .tabulator-row", { hasText: username });
        await expect(userRow).toBeVisible({ timeout: 15000 });
        await workbench.selectUserAccountRowAction(userRow, ["Reset Password..."]);

        const dialog = page.locator("#userAccountResetPasswordDialog");
        await expect(dialog).toBeVisible({ timeout: 15000 });
        await dialog.locator("#newPassword input, input#newPassword").fill(resetPassword);
        await dialog.locator("#passwordConfirmation input, input#passwordConfirmation").fill(resetPassword);
        await dialog.locator("#ok").click();
        await expect(dialog).toBeHidden({ timeout: 15000 });

        await workbench.closeActiveTabDiscardingChanges();
        await workbench.closeActiveTabDiscardingChanges();
        await workbench.createMySQLConnection(userConnection);
        await workbench.openSqlScriptFromConnectionTile(userConnection.caption, userConnection.password, untitledSqlScriptTab);
        expect(executeSql(userConnection, [
            `ALTER USER USER() IDENTIFIED BY '${replacementPassword}' REPLACE '${resetPassword}';`,
            "SELECT 'password changed' AS result;",
        ])).toContain("password changed");
    });

});
