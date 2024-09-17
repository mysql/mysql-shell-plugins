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

import { until } from "selenium-webdriver";
import { basename } from "path";
import { Misc } from "../../lib/misc.js";
import * as locator from "../../lib/locators.js";
import * as constants from "../../lib/constants.js";
import { driver, loadDriver } from "../../lib/driver.js";
import * as interfaces from "../../lib/interfaces.js";
import { Os } from "../../lib/os.js";
import { E2EGuiConsole } from "../../lib/E2EGuiConsole.js";
import { E2EShellSession } from "../../lib/E2EShellSession.js";

const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));

describe("Sessions", () => {

    let testFailed: boolean;
    let username: string | undefined;
    let password: string | undefined;
    let hostname: string | undefined;
    let schema: string | undefined;
    let portX: number | undefined;

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: `ClientQA test`,
        description: "Local connection",
        basic: {
            hostname: String(process.env.DBHOSTNAME),
            protocol: "mysql",
            username: "dbuser2",
            port: parseInt(process.env.DBPORT!, 10),
            portX: parseInt(process.env.DBPORTX!, 10),
            schema: "sakila",
            password: "dbuser2",
        },
    };

    if (interfaces.isMySQLConnection(globalConn.basic)) {
        username = globalConn.basic.username;
        password = globalConn.basic.password;
        hostname = globalConn.basic.hostname;
        schema = globalConn.basic.schema;
        portX = globalConn.basic.portX;
    } else {
        throw new Error("Unknown connection type");
    }

    const guiConsole = new E2EGuiConsole();
    let session: E2EShellSession;

    beforeAll(async () => {
        try {
            await loadDriver();
            await driver.get(url);
            await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds, "Home page was not loaded");

            await driver.findElement(locator.shellPage.icon).click();
            await guiConsole.openSession();
            session = guiConsole.sessions[0];
            const editor = await driver.findElement(locator.shellSession.exists);
            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(locator.shellSession.currentLine),
            );

            await session.codeEditor.loadCommandResults();
            let uri = `\\c ${username}:${password}@${hostname}:${portX}/${schema}`;
            const result = await session.codeEditor.execute(uri);
            uri = `Creating a session to '${username}@${hostname}:${portX}/${schema}'`;
            expect(result.text).toMatch(new RegExp(uri));
            uri = `Connection to server ${hostname} at port ${portX},`;
            uri += ` using the X protocol`;
            const server = await driver.wait(until.elementLocated(locator.shellConsole.connectionTab.server),
                constants.wait5seconds);
            const schemaEl = await driver.wait(until.elementLocated(locator.shellConsole.connectionTab.schema),
                constants.wait5seconds);
            await driver.wait(until.elementTextContains(server,
                `${hostname}:${portX}`),
                constants.wait5seconds, `Server tab does not contain '${hostname}:${portX}'`);
            await driver.wait(until.elementTextContains(schemaEl, `${schema}`),
                constants.wait5seconds, `Schema tab does not contain '${schema}'`);
        } catch (e) {
            await Misc.storeScreenShot("beforeAll_Sessions");
            throw e;
        }
    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            await Misc.storeScreenShot();
        }
    });

    afterAll(async () => {
        await Os.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.close();
        await driver.quit();
    });

    it("Verify collections - json format", async () => {
        try {
            await session.changeSchema("world_x_cst");
            const result = await session.codeEditor.execute("db.countryinfo.find()");
            expect(result.json).toMatch(/Yugoslavia/);
        } catch (e) {
            testFailed = true;
            throw e;
        } finally {
            await session.changeSchema("sakila");
        }
    });

    it("Verify help command", async () => {
        try {
            const result = await session.codeEditor.execute("\\help ");
            const regex = [
                /The Shell Help is organized in categories and topics/,
                /SHELL COMMANDS/,
                /\\connect/,
                /\\disconnect/,
                /\\edit/,
                /\\exit/,
                /\\help/,
                /\\history/,
                /\\js/,
                /\\nopager/,
                /\\nowarnings/,
                /\\option/,
                /\\pager/,
                /\\py/,
                /\\quit/,
                /\\reconnect/,
                /\\rehash/,
                /\\show/,
                /\\source/,
                /\\sql/,
                /\\status/,
                /\\system/,
                /\\use/,
                /\\warning/,
                /\\watch/,
            ];

            for (const reg of regex) {
                expect(result.text).toMatch(reg);
            }
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Switch session language", async () => {
        try {
            await driver.wait(until.elementLocated(locator.shellConsole.editor),
                constants.wait10seconds, "Console was not loaded");
            let result = await session.codeEditor.languageSwitch("\\py ", true);
            expect(result!.text).toMatch(/Python/);
            result = await session.codeEditor.languageSwitch("\\js ", true);
            expect(result!.text).toMatch(/JavaScript/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Check query result content", async () => {
        try {
            await session.codeEditor.languageSwitch("\\sql ");
            let result = await session.codeEditor.execute("SHOW DATABASES;", true);
            expect(await result.grid!.content!.getAttribute("innerHTML")).toMatch(/sakila/);
            expect(await result.grid!.content!.getAttribute("innerHTML")).toMatch(/mysql/);

            await session.codeEditor.languageSwitch("\\js ");
            result = await session.codeEditor.execute(`shell.options.resultFormat="json/raw" `);
            expect(result.text).toMatch(/json\/raw/);
            result = await session.codeEditor.execute(`shell.options.showColumnTypeInfo=false `);
            expect(result.text).toMatch(/false/);
            result = await session.codeEditor.execute(`shell.options.resultFormat="json/pretty" `);
            expect(result.text).toMatch(/json\/pretty/);
            result = await session.changeSchema("sakila");
            expect(result.text).toMatch(/Default schema `sakila` accessible through db/);
            result = await session.codeEditor.execute("db.category.select().limit(1)");
            expect(result.json).toMatch(/Action/);
            result = await session.codeEditor.execute(`shell.options.resultFormat="table" `);
            expect(result.text).toMatch(/table/);
            result = await session.codeEditor.execute("db.category.select().limit(1)");
            expect(await result.grid!.content!.getAttribute("innerHTML")).toMatch(/Action/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using db global variable", async () => {
        try {
            const result = await session.codeEditor.execute("db.actor.select().limit(1)");
            expect(await result.grid!.content!.getAttribute("innerHTML")).toMatch(/PENELOPE/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using util global variable", async () => {
        try {
            const result = await session.codeEditor.execute('util.exportTable("actor", "test.txt")');
            expect(result.text).toMatch(/Running data dump using 1 thread/);
            const matches = [
                /Total duration: (\d+)(\d+):(\d+)(\d+):(\d+)(\d+)s/,
                /Data size: (\d+).(\d+)(\d+) KB/,
                /Rows written: (\d+)/,
                /Bytes written: (\d+).(\d+)(\d+) KB/,
                /Average throughput: (\d+).(\d+)(\d+) KB/,
            ];

            for (const match of matches) {
                expect(result.text).toMatch(match);
            }
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
