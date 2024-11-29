/*
 * Copyright (c) 2022, 2024, Oracle and/or its affiliates.
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

import { basename } from "path";
import { Misc } from "../lib/misc.js";
import { driver, loadDriver } from "../lib/driver.js";
import { E2EAccordionSection } from "../lib/SideBar/E2EAccordionSection.js";
import { Os } from "../lib/os.js";
import * as constants from "../lib/constants.js";
import * as interfaces from "../lib/interfaces.js";
import { until } from "selenium-webdriver";
import * as locator from "./../lib/locators.js";
import { E2EShellConsole } from "../lib/E2EShellConsole.js";
import { E2EDatabaseConnectionOverview } from "../lib/E2EDatabaseConnectionOverview.js";
import { E2ETabContainer } from "../lib/E2ETabContainer.js";
import { E2ESettings } from "../lib/E2ESettings.js";

const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));

describe("MYSQL SHELL CONSOLES", () => {

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: `E2E - SHELL CONSOLES`,
        description: "Local connection",
        basic: {
            hostname: "localhost",
            username: String(process.env.DBUSERNAME1),
            port: parseInt(process.env.MYSQL_PORT!, 10),
            schema: "sakila",
            password: String(process.env.DBUSERNAME1PWD),
        },
    };

    const username = String((globalConn.basic as interfaces.IConnBasicMySQL).username);
    const password = String((globalConn.basic as interfaces.IConnBasicMySQL).password);
    const hostname = String((globalConn.basic as interfaces.IConnBasicMySQL).hostname);
    const port = String((globalConn.basic as interfaces.IConnBasicMySQL).port);
    const schema = String((globalConn.basic as interfaces.IConnBasicMySQL).schema);
    const openEditorsTreeSection = new E2EAccordionSection(constants.openEditorsTreeSection);
    const shellConsole = new E2EShellConsole();

    beforeAll(async () => {

        await loadDriver(true);
        await driver.get(url);

        try {
            await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds);
            const settings = new E2ESettings();
            await settings.open();
            await settings.selectCurrentTheme(constants.darkModern);
            await settings.close();

            const dbConnectionOverview = new E2EDatabaseConnectionOverview();
            await dbConnectionOverview.openNewShellConsole();
            await driver.wait(new E2EShellConsole().untilIsOpened(), constants.wait15seconds,
                "Shell Console was not loaded");
        } catch (e) {
            await Misc.storeScreenShot("beforeAll_MYSQL_SHELL_CONSOLES");
            throw e;
        }

    });

    afterAll(async () => {
        await Os.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.close();
        await driver.quit();
    });

    describe("Database connections", () => {

        const shellConn = Object.assign({}, globalConn);
        shellConn.caption = "shellConn";
        (shellConn.basic as interfaces.IConnBasicMySQL).username = String(process.env.DBUSERNAME2);
        (shellConn.basic as interfaces.IConnBasicMySQL).password = String(process.env.DBUSERNAME2PWD);
        const shellUsername = String((shellConn.basic as interfaces.IConnBasicMySQL).username);
        let testFailed = false;

        afterEach(async () => {
            if (testFailed) {
                testFailed = false;
                await Misc.storeScreenShot();
            }
        });

        it("Connect to host", async () => {
            try {
                await shellConsole.codeEditor.loadCommandResults();
                let connUri = `\\c ${username}:${password}@${hostname}:${port}/${schema}`;
                await driver.wait(new E2EShellConsole().untilIsOpened(shellConn), constants.wait15seconds);
                const result = await shellConsole.codeEditor.execute(connUri);
                connUri = `Creating a session to '${username}@${hostname}:${port}/${schema}'`;
                expect(result.text).toMatch(new RegExp(connUri));
                expect(result.text).toMatch(/Server version: (\d+).(\d+).(\d+)/);
                expect(result.text).toMatch(new RegExp(`Default schema set to \`${schema}\``));
                const server = await driver.wait(until
                    .elementLocated(locator.shellConsole.connectionTab.server), constants.wait5seconds);
                const schemaEl = await driver.wait(until.elementLocated(locator.shellConsole.connectionTab.schema),
                    constants.wait5seconds);
                await driver.wait(until.elementTextContains(server, `${hostname}:${port}`),
                    constants.wait5seconds, `Server tab does not contain '${hostname}:${port}'`);
                await driver.wait(until.elementTextContains(schemaEl, `${schema}`),
                    constants.wait5seconds, `Schema tab does not contain '${schema}'`);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Change schemas using menu", async () => {
            try {
                let result = await shellConsole.changeSchema("world_x_cst");
                expect(result.text).toMatch(/Default schema set to `world_x_cst`/);
                result = await shellConsole.changeSchema("sakila");
                expect(result.text).toMatch(/Default schema set to `sakila`/);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Connect to host without password", async () => {
            try {
                Os.deleteShellCredentials();
                let uri = `\\c ${shellUsername}@${hostname}:${port}/${schema}`;
                const result = await shellConsole.codeEditor.executeExpectingCredentials(uri, shellConn);
                uri = `Creating a session to '${shellUsername}@${hostname}:${port}/${schema}'`;
                expect(result.text).toMatch(new RegExp(uri));
                expect(result.text).toMatch(/Server version: (\d+).(\d+).(\d+)/);
                expect(result.text).toMatch(new RegExp(`Default schema set to \`${schema}\`.`));

                const server = await driver.wait(until.elementLocated(locator.shellConsole.connectionTab.server),
                    constants.wait5seconds, "Server tab was not found");
                const schemaEl = await driver.wait(until.elementLocated(locator.shellConsole.connectionTab.schema),
                    constants.wait5seconds, "Schema tab was not found");
                await driver.wait(until.elementTextContains(server, `${hostname}:${port}`),
                    constants.wait5seconds, `Server tab does not contain '${hostname}:${port}'`);
                await driver.wait(until.elementTextContains(schemaEl, `${schema}`),
                    constants.wait5seconds, `Schema tab does not contain '${schema}'`);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Connect using shell global variable", async () => {
            try {
                let result = await shellConsole.codeEditor.execute("shell.status()");
                expect(result.text).toMatch(/MySQL Shell version (\d+).(\d+).(\d+)/);
                let uri = `shell.connect('${username}:${password}@${hostname}:${port}0/${schema}')`;
                result = await shellConsole.codeEditor.execute(uri);
                uri = `Creating a session to '${username}@${hostname}:${port}0/${schema}'`;
                expect(result.text).toMatch(new RegExp(uri));
                expect(result.text).toMatch(/Server version: (\d+).(\d+).(\d+)/);
                expect(result.text)
                    .toMatch(new RegExp(`Default schema \`${schema}\` accessible through db`));

                const server = await driver.wait(until
                    .elementLocated(locator.shellConsole.connectionTab.server), constants.wait5seconds);
                const schemaEl = await driver.wait(until.elementLocated(locator.shellConsole.connectionTab.schema),
                    constants.wait5seconds);
                await driver.wait(until.elementTextContains(server, `${hostname}:${port}`),
                    constants.wait5seconds, `Server tab does not contain '${hostname}:${port}'`);
                await driver.wait(until.elementTextContains(schemaEl, `${schema}`),
                    constants.wait5seconds, `Schema tab does not contain '${schema}'`);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Connect using mysql mysqlx global variable", async () => {
            try {
                let cmd = `mysql.getClassicSession('${username}:${password}@${hostname}:${port}/${schema}')`;
                let result = await shellConsole.codeEditor.execute(cmd);
                expect(result.text).toMatch(/ClassicSession/);
                cmd = `mysqlx.getSession('${username}:${password}@${hostname}:${port}0/${schema}')`;
                result = await shellConsole.codeEditor.execute(cmd);
                expect(result.text).toMatch(/Session/);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

    });

    describe("Sessions", () => {

        let testFailed = false;

        beforeAll(async () => {
            try {
                await new E2ETabContainer().closeAllTabs();
                await openEditorsTreeSection.clickToolbarButton(constants.addConsole);
                await driver.wait(new E2EShellConsole().untilIsOpened(), constants.wait15seconds,
                    "Shell Console was not loaded");

                await shellConsole.codeEditor.loadCommandResults();
                let uri = `\\c ${username}:${password}@${hostname}:${port}0/${schema}`;
                const result = await shellConsole.codeEditor.execute(uri);
                uri = `Creating a session to '${username}@${hostname}:${port}0/${schema}'`;
                expect(result.text).toMatch(new RegExp(uri));
                uri = `Connection to server ${hostname} at port ${port}0,`;
                uri += ` using the X protocol`;
                const server = await driver.wait(until.elementLocated(locator.shellConsole.connectionTab.server),
                    constants.wait5seconds);
                const schemaEl = await driver.wait(until.elementLocated(locator.shellConsole.connectionTab.schema),
                    constants.wait5seconds);
                await driver.wait(until.elementTextContains(server,
                    `${hostname}:${port}0`),
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

        it("Verify help command", async () => {
            try {
                const result = await shellConsole.codeEditor.execute("\\help ");
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

        it("Switch session language - javascript python", async () => {
            try {
                await driver.wait(until.elementLocated(locator.shellConsole.editor),
                    constants.wait10seconds, "Console was not loaded");
                let result = await shellConsole.codeEditor.languageSwitch("\\py ");
                expect(result!.text).toMatch(/Python/);
                result = await shellConsole.codeEditor.languageSwitch("\\js ");
                expect(result!.text).toMatch(/JavaScript/);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Using db global variable", async () => {
            try {
                const result = await shellConsole.codeEditor.execute("db.actor.select().limit(1)");
                expect(await result.grid!.content!.getAttribute("innerHTML")).toMatch(/PENELOPE/);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Using util global variable", async () => {
            try {
                const result = await shellConsole.codeEditor.execute('util.exportTable("actor","test.txt")');
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

        it("Verify collections - json format", async () => {
            try {
                await shellConsole.changeSchema("world_x_cst");
                const result = await shellConsole.codeEditor.execute("db.countryinfo.find()");
                expect(result.json).toMatch(/Yugoslavia/);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Check query result content", async () => {
            try {
                await shellConsole.codeEditor.languageSwitch("\\sql");
                let result = await shellConsole.codeEditor.execute("SHOW DATABASES;");
                expect(await result.grid!.content!.getAttribute("innerHTML")).toMatch(/sakila/);
                expect(await result.grid!.content!.getAttribute("innerHTML")).toMatch(/mysql/);
                await shellConsole.codeEditor.languageSwitch("\\js");
                result = await shellConsole.codeEditor.execute(`shell.options.resultFormat="json/raw" `);
                expect(result.text).toMatch(/json\/raw/);
                result = await shellConsole.codeEditor.execute(`shell.options.showColumnTypeInfo=false `);
                expect(result.text).toMatch(/false/);
                result = await shellConsole.codeEditor.execute(`shell.options.resultFormat="json/pretty" `);
                expect(result.text).toMatch(/json\/pretty/);
                result = await shellConsole.changeSchema("sakila");
                expect(result.text).toMatch(/Default schema `sakila` accessible through db/);
                result = await shellConsole.codeEditor.execute("db.category.select().limit(1)");
                expect(result.json).toMatch(/Action/);
                result = await shellConsole.codeEditor.execute(`shell.options.resultFormat="table" `);
                expect(result.text).toMatch(/table/);
                result = await shellConsole.codeEditor.execute("db.category.select().limit(1)");
                expect(await result.grid!.content!.getAttribute("innerHTML")).toMatch(/Action/);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

    });
});
