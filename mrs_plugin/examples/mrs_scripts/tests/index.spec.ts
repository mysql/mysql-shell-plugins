/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

import { SqlError, describe, it } from "../mrs/mrs.js";
import { MrsScriptModule } from "../src/MrsScriptModule.js";

describe("MRS Script tests", async () => {

    await it("helloWorld", async () => {
        const greeting = await MrsScriptModule.helloWorld();
        if (greeting !== "Hello world!") {
            throw Error("The returned greeting was not expected.");
        }
    });

    await it("getTestData", async () => {
        const now = new Date();
        const age = now.getFullYear() - 1975;

        const data = await MrsScriptModule.getTestData("Mike", "Mr.", age);
        if (data.at(0)?.birthYear !== 1975) {
            throw Error("The birthYear was not calculated correctly.");
        }
    });

    await it("helloUser", async () => {
        const userName = "Mike";

        // Push mock results so runSql() will return them instead of actually querying the database
        session.pushRunSqlResults([{ "name": userName }]);

        const result = await MrsScriptModule.helloUser("0x12345678");
        if (result.greeting !== `Hello ${userName}!`) {
            throw Error("The greeting was not composed correctly.");
        }
    });

    await it("getMrsVersions", async () => {
        // Push two versions (3.0.0) for both metadata schema version and user schema version as mock results
        const versionResult = { "major": 3, "minor": 0, "patch": 0 };
        session.pushRunSqlResults([versionResult], [versionResult]);

        const versions = await MrsScriptModule.getMrsVersions();
        if (versions.metadata.major !== versionResult.major
            || versions.metadata.minor !== versionResult.minor
            || versions.metadata.patch !== versionResult.patch
        ) {
            throw Error("The metadata schema version was not returned correctly.");
        }

        // Omit the result for the user schema version to check if an SqlError is thrown
        session.pushRunSqlResults([{ "major": 3, "minor": 0, "patch": 0 }]);
        try {
            await MrsScriptModule.getMrsVersions();
        } catch (error) {
            if (!(error instanceof SqlError)) {
                throw new Error("No SqlError thrown.");
            }
        }
    });

    await it("renderTestPage", async () => {
        const pageContent = await MrsScriptModule.renderTestPage();

        if (!pageContent.startsWith("<!DOCTYPE html>")) {
            throw new Error("Content page not rendered correctly.");
        }
    });

    await it("renderPreactTestPage", async () => {
        const pageContent = await MrsScriptModule.renderPreactTestPage();

        if (!pageContent.startsWith("<!DOCTYPE html>")) {
            throw new Error("Content page not rendered correctly.");
        }
    });
});
