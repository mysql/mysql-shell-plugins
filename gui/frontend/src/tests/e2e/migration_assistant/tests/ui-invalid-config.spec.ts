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
 * separately licensed software that they have included with
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
/* eslint-disable no-restricted-syntax */

import { test, expect } from "@playwright/test";
import { Misc, browser } from "../lib/Misc.js";
import { PasswordDialog } from "../lib/PasswordDialog.js";
import { MigrationAssistantPage } from "../lib/MigrationAssistantPage.js";

const migrationAssistant = new MigrationAssistantPage();

test.describe("Invalid config file", () => {

    // eslint-disable-next-line no-empty-pattern
    test.beforeAll(async ({ }, testInfo) => {
        await Misc.loadPage(testInfo.titlePath[1]);

        const passwordDialog = new PasswordDialog();
        if (await passwordDialog.exists()) {
            await passwordDialog.setCredentials(String(process.env.DBROOTPASSWORD));
        }

        await Misc.waitForLoadingIcon();
    });

    test.afterAll(async () => {
        await browser.close();
    });

    test("Invalid config file", async () => {
        expect(await migrationAssistant.migrationPlan.existsSignInButton()).toBe(true);
        expect(await migrationAssistant.migrationPlan.existsSignUpButton()).toBe(true);
        await migrationAssistant.migrationPlan.clickSignIn();

        await migrationAssistant.migrationPlan.copySignInUrl();
        await Misc.existsOnClipboard(/https:\/\/login.oci.oraclecloud.com/);
    });

});
