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

import { WebElement, until } from "selenium-webdriver";
import { basename } from "path";
import { GuiConsole } from "../../lib/guiConsole.js";
import { IDBConnection, Misc, explicitWait } from "../../lib/misc.js";
import * as locator from "../../lib/locators.js";
import { CommandExecutor } from "../../lib/cmdExecutor.js";
import * as constants from "../../lib/constants.js";
import { driver, loadDriver } from "../../lib/driver.js";

const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));

describe("Sessions", () => {

    let testFailed: boolean;
    const globalConn: IDBConnection = {
        dbType: "MySQL",
        caption: `ClientQA test`,
        description: "Local connection",
        hostname: String(process.env.DBHOSTNAME),
        protocol: "mysql",
        username: "dbuser1",
        port: String(process.env.DBPORT),
        portX: String(process.env.DBPORTX),
        schema: "sakila",
        password: "dbuser1",
        sslMode: undefined,
        sslCA: undefined,
        sslClientCert: undefined,
        sslClientKey: undefined,
    };

    const username = globalConn.username;
    const password = globalConn.password;
    const hostname = globalConn.hostname;
    const schema = globalConn.schema;
    const port = globalConn.port;
    const portX = globalConn.portX;

    const commandExecutor = new CommandExecutor();

    beforeAll(async () => {
        try {
            await loadDriver();
            await driver.wait(async () => {
                try {
                    console.log(`${basename(__filename)} : ${url}`);
                    await Misc.waitForHomePage(url);

                    return true;
                } catch (e) {
                    await driver.navigate().refresh();
                }
            }, explicitWait * 4, "Home Page was not loaded");

            await driver.findElement(locator.shellPage.icon).click();
            await GuiConsole.openSession();
            const editor = await driver.findElement(locator.shellSession.exists);
            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(locator.shellSession.currentLine),
            );

            let uri = `\\c ${username}:${password}@${hostname}:${portX}/${schema}`;

            await commandExecutor.execute(uri);
            uri = `Creating a session to '${username}@${hostname}:${portX}/${schema}'`;
            expect(commandExecutor.getResultMessage()).toMatch(new RegExp(uri));
            uri = `Connection to server ${hostname} at port ${portX},`;
            uri += ` using the X protocol`;
            const server = await driver.wait(until.elementLocated(locator.shellSession.server),
                constants.wait5seconds);
            const schemaEl = await driver.wait(until.elementLocated(locator.shellSession.schema),
                constants.wait5seconds);
            await driver.wait(until.elementTextContains(server,
                `${hostname}:${String(portX)}`),
                constants.wait5seconds, `Server tab does not contain '${hostname}:${port}'`);
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
        await Misc.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.close();
        await driver.quit();
    });

    it("Verify collections - json format", async () => {
        try {
            await commandExecutor.changeSchemaOnTab("world_x_cst");
            await commandExecutor.execute("db.countryinfo.find()");
            expect(await (commandExecutor.getResultContent() as WebElement)
                .getAttribute("innerHTML")).toMatch(/Yugoslavia/);
        } catch (e) {
            testFailed = true;
            throw e;
        } finally {
            await commandExecutor.changeSchemaOnTab("sakila");
        }
    });

    it("Verify help command", async () => {
        try {
            await commandExecutor.execute("\\help ");
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
                console.log(commandExecutor.getResultMessage());
                console.log("---");
                expect(commandExecutor.getResultMessage()).toMatch(reg);
            }
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Switch session language", async () => {
        try {
            await commandExecutor.languageSwitch("\\py ", true);
            expect(commandExecutor.getResultMessage()).toMatch(/Python/);
            await commandExecutor.languageSwitch("\\js ", true);
            expect(commandExecutor.getResultMessage()).toMatch(/JavaScript/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Check query result content", async () => {
        try {
            await commandExecutor.languageSwitch("\\sql ");
            await commandExecutor.execute("SHOW DATABASES;", true);
            expect(await (commandExecutor.getResultContent() as WebElement).getAttribute("innerHTML"))
                .toMatch(/sakila/);
            expect(await (commandExecutor.getResultContent() as WebElement).getAttribute("innerHTML")).toMatch(/mysql/);
            await commandExecutor.languageSwitch("\\js ");
            await commandExecutor.execute(`shell.options.resultFormat="json/raw" `);
            expect(commandExecutor.getResultMessage()).toMatch(/json\/raw/);
            await commandExecutor.execute(`shell.options.showColumnTypeInfo=false `);
            expect(commandExecutor.getResultMessage()).toMatch(/false/);
            await commandExecutor.execute(`shell.options.resultFormat="json/pretty" `);
            expect(commandExecutor.getResultMessage()).toMatch(/json\/pretty/);
            await commandExecutor.changeSchemaOnTab("sakila");
            expect(commandExecutor.getResultMessage()).toMatch(/Default schema `sakila` accessible through db/);
            await commandExecutor.execute("db.category.select().limit(1)");
            expect(await (commandExecutor.getResultContent() as WebElement)
                .getAttribute("innerHTML")).toMatch(/Action/);
            await commandExecutor.execute(`shell.options.resultFormat="table" `);
            expect(commandExecutor.getResultMessage()).toMatch(/table/);
            await commandExecutor.execute("db.category.select().limit(1)");
            expect(await (commandExecutor.getResultContent() as WebElement).getAttribute("innerHTML"))
                .toMatch(/Action/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using db global variable", async () => {
        try {
            await commandExecutor.execute("db.actor.select().limit(1)");
            expect(await (commandExecutor.getResultContent() as WebElement)
                .getAttribute("innerHTML")).toMatch(/PENELOPE/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using util global variable", async () => {
        try {
            await commandExecutor.execute('util.exportTable("actor", "test.txt")');
            expect(commandExecutor.getResultMessage()).toMatch(/Running data dump using 1 thread/);
            const matches = [
                /Total duration: (\d+)(\d+):(\d+)(\d+):(\d+)(\d+)s/,
                /Data size: (\d+).(\d+)(\d+) KB/,
                /Rows written: (\d+)/,
                /Bytes written: (\d+).(\d+)(\d+) KB/,
                /Average throughput: (\d+).(\d+)(\d+) KB/,
            ];
            for (const match of matches) {
                expect(commandExecutor.getResultMessage()).toMatch(match);
            }
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
