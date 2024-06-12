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
import { until } from "vscode-extension-tester";
import { expect } from "chai";
import { driver, Misc } from "../lib/Misc";
import { E2EAccordionSection } from "../lib/SideBar/E2EAccordionSection";
import { Os } from "../lib/Os";
import { Workbench } from "../lib/Workbench";
import * as constants from "../lib/constants";
import * as interfaces from "../lib/interfaces";
import * as locator from "../lib/locators";
import * as errors from "../lib/errors";
import { E2EShellConsole } from "../lib/WebViews/E2EShellConsole";

describe("MYSQL SHELL CONSOLES", () => {

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: "conn",
        description: "Local connection",
        basic: {
            hostname: String(process.env.DBHOSTNAME),
            username: String(process.env.DBUSERNAME),
            port: Number(process.env.DBPORT),
            schema: "sakila",
            password: String(process.env.DBPASSWORD),
        },
    };

    const username = String((globalConn.basic as interfaces.IConnBasicMySQL).username);
    const password = String((globalConn.basic as interfaces.IConnBasicMySQL).password);
    const hostname = String((globalConn.basic as interfaces.IConnBasicMySQL).hostname);
    const port = String((globalConn.basic as interfaces.IConnBasicMySQL).port);
    const schema = String((globalConn.basic as interfaces.IConnBasicMySQL).schema);
    const openEditorsTreeSection = new E2EAccordionSection(constants.openEditorsTreeSection);
    const shellConsole = new E2EShellConsole();

    before(async function () {

        if (!process.env.DBHOSTNAME) {
            throw new Error("Please define the environment variable DBHOSTNAME");
        }
        if (!process.env.DBUSERNAME) {
            throw new Error("Please define the environment variable DBUSERNAME");
        }
        if (!process.env.DBPASSWORD) {
            throw new Error("Please define the environment variable DBPASSWORD");
        }
        if (!process.env.DBPORT) {
            throw new Error("Please define the environment variable DBPORT");
        }

        await Misc.loadDriver();

        try {
            await driver.wait(Workbench.untilExtensionIsReady(), constants.wait2minutes);
            await Workbench.toggleBottomBar(false);
            await Misc.switchToFrame();
            await driver.wait(until.elementLocated(locator.dbConnectionOverview.newConsoleButton),
                constants.wait10seconds).click();
            await driver.wait(new E2EShellConsole().untilIsOpened(), constants.wait15seconds,
                "Shell Console was not loaded");
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }

    });

    after(async function () {
        try {
            await Os.prepareExtensionLogsForExport(process.env.TEST_SUITE);
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    describe("Shell generic operations", () => {

        const openedSessions: number[] = [];

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }
        });

        after(async function () {
            try {
                for (let i = 1; i <= openedSessions.length - 1; i++) {
                    await Workbench.closeEditor(`Session ${openedSessions[i]}`);
                }
            } catch (e) {
                await Misc.processFailure(this);
            }
        });

        it("Open multiple sessions", async () => {

            for (let i = 1; i <= 3; i++) {
                const treeDBConnections = await openEditorsTreeSection.tree.getElement(constants.dbConnectionsLabel);
                await openEditorsTreeSection.tree.openContextMenuAndSelect(treeDBConnections,
                    constants.openNewShellConsole);
                await driver.wait(new E2EShellConsole().untilIsOpened(), constants.wait15seconds,
                    "Shell Console was not loaded");
                await driver.wait(openEditorsTreeSection.tree.untilExists(`Session ${i}`), constants.wait5seconds);
                openedSessions.push(i);
            }

        });

    });

    describe("Shell database connections", () => {

        const shellConn = Object.assign({}, globalConn);
        shellConn.caption = "shellConn";
        (shellConn.basic as interfaces.IConnBasicMySQL).username = String(process.env.DBSHELLUSERNAME);
        (shellConn.basic as interfaces.IConnBasicMySQL).password = String(process.env.DBSHELLPASSWORD);
        const shellUsername = String((shellConn.basic as interfaces.IConnBasicMySQL).username);

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }
        });

        it("Connect to host", async () => {
            await shellConsole.codeEditor.loadCommandResults();
            let connUri = `\\c ${username}:${password}@${hostname}:${port}/${schema}`;
            await driver.wait(new E2EShellConsole().untilIsOpened(shellConn), constants.wait15seconds);
            const result = await shellConsole.codeEditor.execute(connUri);
            connUri = `Creating a session to '${username}@${hostname}:${port}/${schema}'`;
            expect(result.text).to.match(new RegExp(connUri));
            expect(result.text,
                errors.queryResultError("Server version: (\\d+).(\\d+).(\\d+)", ""))
                .to.match(/Server version: (\d+).(\d+).(\d+)/);
            expect(result.text,
                errors.queryResultError(`Default schema set to \`${schema}\``,
                    result.text)).to.match(new RegExp(`Default schema set to \`${schema}\``));

            const server = await driver.wait(until
                .elementLocated(locator.shellConsole.connectionTab.server), constants.wait5seconds);
            const schemaEl = await driver.wait(until.elementLocated(locator.shellConsole.connectionTab.schema),
                constants.wait5seconds);
            await driver.wait(until.elementTextContains(server, `${hostname}:${port}`),
                constants.wait5seconds, `Server tab does not contain '${hostname}:${port}'`);
            await driver.wait(until.elementTextContains(schemaEl, `${schema}`),
                constants.wait5seconds, `Schema tab does not contain '${schema}'`);

        });

        it("Change schemas using menu", async () => {
            let result = await shellConsole.changeSchema("world_x_cst");
            expect(result.text, errors.queryResultError("Default schema set to`world_x_cst`",
                result.text)).to.match(/Default schema set to `world_x_cst`/);
            result = await shellConsole.changeSchema("sakila");
            expect(result.text, errors.queryResultError("Default schema set to`sakila`",
                result.text)).to.match(/Default schema set to `sakila`/);

        });

        it("Connect to host without password", async () => {

            let uri = `\\c ${shellUsername}@${hostname}:${port}/${schema}`;
            const result = await shellConsole.codeEditor.executeExpectingCredentials(uri, shellConn);
            uri = `Creating a session to '${shellUsername}@${hostname}:${port}/${schema}'`;
            expect(result.text, errors.queryResultError(uri,
                result.text)).to.match(new RegExp(uri));
            expect(result.text, errors.queryResultError("Server version: (\\d+).(\\d+).(\\d+)",
                result.text)).to.match(/Server version: (\d+).(\d+).(\d+)/);
            expect(result.text, errors.queryResultError(`Default schema set to \`${schema}\`.`,
                result.text)).to.match(new RegExp(`Default schema set to \`${schema}\`.`));

            const server = await driver.wait(until.elementLocated(locator.shellConsole.connectionTab.server),
                constants.wait5seconds, "Server tab was not found");
            const schemaEl = await driver.wait(until.elementLocated(locator.shellConsole.connectionTab.schema),
                constants.wait5seconds, "Schema tab was not found");
            await driver.wait(until.elementTextContains(server, `${hostname}:${port}`),
                constants.wait5seconds, `Server tab does not contain '${hostname}:${port}'`);
            await driver.wait(until.elementTextContains(schemaEl, `${schema}`),
                constants.wait5seconds, `Schema tab does not contain '${schema}'`);

        });

        it("Connect using shell global variable", async () => {

            let result = await shellConsole.codeEditor.execute("shell.status()", true);
            expect(result.text,
                errors.queryResultError("MySQL Shell version (\\d+).(\\d+).(\\d+)",
                    result.text)).to.match(/MySQL Shell version (\d+).(\d+).(\d+)/);

            let uri = `shell.connect('${username}:${password}@${hostname}:33060/${schema}')`;
            result = await shellConsole.codeEditor.execute(uri, true);
            uri = `Creating a session to '${username}@${hostname}:33060/${schema}'`;
            expect(result.text, errors.queryResultError(uri,
                result.text)).to.match(new RegExp(uri));
            expect(result.text, errors.queryResultError("Server version: (\\d+).(\\d+).(\\d+)",
                result.text)).to.match(/Server version: (\d+).(\d+).(\d+)/);
            expect(result.text)
                .to.match(new RegExp(`Default schema \`${schema}\` accessible through db`));

            const server = await driver.wait(until
                .elementLocated(locator.shellConsole.connectionTab.server), constants.wait5seconds);
            const schemaEl = await driver.wait(until.elementLocated(locator.shellConsole.connectionTab.schema),
                constants.wait5seconds);
            await driver.wait(until.elementTextContains(server, `${hostname}:${port}`),
                constants.wait5seconds, `Server tab does not contain '${hostname}:${port}'`);
            await driver.wait(until.elementTextContains(schemaEl, `${schema}`),
                constants.wait5seconds, `Schema tab does not contain '${schema}'`);

        });

        it("Connect using mysql mysqlx global variable", async () => {

            let cmd = `mysql.getClassicSession('${username}:${password}@${hostname}:${port}/${schema}')`;
            let result = await shellConsole.codeEditor.execute(cmd, true);
            expect(result.text, errors.queryResultError("ClassicSession",
                result.text)).to.match(/ClassicSession/);
            cmd = `mysqlx.getSession('${username}:${password}@${hostname}:33060/${schema}')`;
            result = await shellConsole.codeEditor.execute(cmd, true);
            expect(result.text, errors.queryResultError("Session",
                result.text)).to.match(/Session/);

        });

    });

    describe("Sessions", () => {

        before(async function () {
            try {
                await Workbench.closeAllEditors();
                const treeDBConnections = await openEditorsTreeSection.tree.getElement(constants.dbConnectionsLabel);
                await openEditorsTreeSection.tree.openContextMenuAndSelect(treeDBConnections,
                    constants.openNewShellConsole);
                await driver.wait(new E2EShellConsole().untilIsOpened(), constants.wait15seconds,
                    "Shell Console was not loaded");

                await shellConsole.codeEditor.loadCommandResults();
                let uri = `\\c ${username}:${password}@${hostname}:33060/${schema}`;
                const result = await shellConsole.codeEditor.execute(uri);
                uri = `Creating a session to '${username}@${hostname}:33060/${schema}'`;
                expect(result.text, errors.queryResultError(uri,
                    result.text)).to.match(new RegExp(uri));
                uri = `Connection to server ${hostname} at port 33060,`;
                uri += ` using the X protocol`;
                const server = await driver.wait(until.elementLocated(locator.shellConsole.connectionTab.server),
                    constants.wait5seconds);
                const schemaEl = await driver.wait(until.elementLocated(locator.shellConsole.connectionTab.schema),
                    constants.wait5seconds);
                await driver.wait(until.elementTextContains(server,
                    `${hostname}:33060`),
                    constants.wait5seconds, `Server tab does not contain '${hostname}:${port}'`);
                await driver.wait(until.elementTextContains(schemaEl, `${schema}`),
                    constants.wait5seconds, `Schema tab does not contain '${schema}'`);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }
        });

        it("Verify help command", async () => {

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
                expect(result.text, errors.queryResultError(reg.toString(),
                    result.text)).to.match(reg);
            }

        });

        it("Switch session language - javascript python", async () => {

            await driver.wait(until.elementLocated(locator.shellConsole.editor),
                constants.wait10seconds, "Console was not loaded");
            let result = await shellConsole.codeEditor.languageSwitch("\\py ", true);
            expect(result.text, errors.queryResultError("Python",
                result.text)).to.match(/Python/);
            result = await shellConsole.codeEditor.languageSwitch("\\js ", true);
            expect(result.text, errors.queryResultError("JavaScript",
                result.text)).to.match(/JavaScript/);

        });

        it("Using db global variable", async () => {

            const result = await shellConsole.codeEditor.execute("db.actor.select().limit(1)");
            expect(await result.grid.content.getAttribute("innerHTML"),
                errors.queryDataSetError("PENELOPE"))
                .to.match(/PENELOPE/);

        });

        it("Using util global variable", async () => {

            const result = await shellConsole.codeEditor.execute('util.exportTable("actor", "test.txt")');
            expect(result.text, errors.queryResultError("Running data dump using 1 thread",
                result.text)).to.match(/Running data dump using 1 thread/);
            const matches = [
                /Total duration: (\d+)(\d+):(\d+)(\d+):(\d+)(\d+)s/,
                /Data size: (\d+).(\d+)(\d+) KB/,
                /Rows written: (\d+)/,
                /Bytes written: (\d+).(\d+)(\d+) KB/,
                /Average throughput: (\d+).(\d+)(\d+) KB/,
            ];
            for (const match of matches) {
                expect(result.text,
                    errors.queryResultError(match.toString(), result.text)).to.match(match);
            }

        });

        it("Verify collections - json format", async () => {
            await shellConsole.changeSchema("world_x_cst");
            const result = await shellConsole.codeEditor.execute("db.countryinfo.find()");
            expect(result.json, errors.queryDataSetError("Yugoslavia")).to.match(/Yugoslavia/);
        });

        it("Check query result content", async () => {

            await shellConsole.codeEditor.languageSwitch("\\sql ");
            let result = await shellConsole.codeEditor.execute("SHOW DATABASES;", true);
            expect(await result.grid.content.getAttribute("innerHTML"), errors.queryDataSetError("sakila"))
                .to.match(/sakila/);

            expect(await result.grid.content.getAttribute("innerHTML"), errors.queryDataSetError("mysql"))
                .to.match(/mysql/);
            await shellConsole.codeEditor.languageSwitch("\\js ");
            result = await shellConsole.codeEditor.execute(`shell.options.resultFormat="json/raw" `);
            expect(result.text, errors.queryResultError("json\\/raw",
                result.text)).to.match(/json\/raw/);
            result = await shellConsole.codeEditor.execute(`shell.options.showColumnTypeInfo=false `);
            expect(result.text, errors.queryResultError("false",
                result.text)).to.match(/false/);
            result = await shellConsole.codeEditor.execute(`shell.options.resultFormat="json/pretty" `);
            expect(result.text, errors.queryResultError("json\\/pretty",
                result.text)).to.match(/json\/pretty/);
            result = await shellConsole.changeSchema("sakila");
            expect(result.text,
                errors.queryResultError("Default schema `sakila` accessible through db",
                    result.text)).to.match(/Default schema `sakila` accessible through db/);
            result = await shellConsole.codeEditor.execute("db.category.select().limit(1)");
            expect(result.json, errors.queryDataSetError("Action")).to.match(/Action/);
            result = await shellConsole.codeEditor.execute(`shell.options.resultFormat="table" `);
            expect(result.text).to.match(/table/);
            result = await shellConsole.codeEditor.execute("db.category.select().limit(1)");
            expect(await result.grid.content.getAttribute("innerHTML"), errors.queryDataSetError("Action"))
                .to.match(/Action/);
        });

    });
});
