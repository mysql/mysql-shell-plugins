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
import { until, WebElement } from "vscode-extension-tester";
import { expect } from "chai";
import { driver, Misc } from "../lib/misc";
import { Shell } from "../lib/shell";
import { CommandExecutor } from "../lib/cmdExecutor";
import { Tree } from "../lib/treeViews/tree";
import { Os } from "../lib/os";
import { Workbench } from "../lib/workbench";
import * as constants from "../lib/constants";
import * as waitUntil from "../lib/until";
import * as interfaces from "../lib/interfaces";
import * as locator from "../lib/locators";
import * as errors from "../lib/errors";

describe("MYSQL SHELL CONSOLES", () => {

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: "conn",
        description: "Local connection",
        basic: {
            hostname: String(process.env.DBHOSTNAME),
            username: String(process.env.DBUSERNAME),
            port: Number(process.env.DBPORT),
            portX: Number(process.env.DBPORTX),
            schema: "sakila",
            password: String(process.env.DBPASSWORD),
        },
    };

    const username = String((globalConn.basic as interfaces.IConnBasicMySQL).username);
    const password = String((globalConn.basic as interfaces.IConnBasicMySQL).password);
    const hostname = String((globalConn.basic as interfaces.IConnBasicMySQL).hostname);
    const port = String((globalConn.basic as interfaces.IConnBasicMySQL).port);
    const portX = String((globalConn.basic as interfaces.IConnBasicMySQL).portX);
    const schema = String((globalConn.basic as interfaces.IConnBasicMySQL).schema);

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
        if (!process.env.DBPORTX) {
            throw new Error("Please define the environment variable DBPORTX");
        }

        await Misc.loadDriver();

        try {
            await driver.wait(waitUntil.extensionIsReady(), constants.wait2minutes);
            await Workbench.toggleBottomBar(false);
            await Misc.switchToFrame();
            await driver.wait(until.elementLocated(locator.dbConnectionOverview.newConsoleButton),
                constants.wait10seconds).click();
            await driver.wait(Shell.isShellLoaded(), constants.wait15seconds, "Shell Console was not loaded");
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

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            await Workbench.closeAllEditors();
        });

        it("Open multiple sessions", async () => {

            for (let i = 1; i <= 3; i++) {
                const treeDBConnections = await Tree.getElement(constants.openEditorsTreeSection,
                    constants.dbConnectionsLabel);
                await Tree.openContextMenuAndSelect(treeDBConnections, constants.openNewShellConsole);
                await driver.wait(Shell.isShellLoaded(), constants.wait15seconds, "Shell Console was not loaded");
                expect(await Tree.existsElement(constants.openEditorsTreeSection, `Session ${i}`),
                    errors.doesNotExistOnTree(`Session ${i}`)).to.be.true;
            }

        });

    });

    describe("Shell database connections", () => {

        const commandExecutor = new CommandExecutor();
        const shellConn = Object.assign({}, globalConn);
        shellConn.caption = "shellConn";
        (shellConn.basic as interfaces.IConnBasicMySQL).username = String(process.env.DBSHELLUSERNAME);
        (shellConn.basic as interfaces.IConnBasicMySQL).password = String(process.env.DBSHELLPASSWORD);
        const shellUsername = String((shellConn.basic as interfaces.IConnBasicMySQL).username);

        before(async function () {
            try {
                const treeDBConnections = await Tree.getElement(constants.openEditorsTreeSection,
                    constants.dbConnectionsLabel);
                await Tree.openContextMenuAndSelect(treeDBConnections,
                    constants.openNewShellConsole);
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

        after(async function () {
            try {
                await Workbench.closeAllEditors();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });


        it("Connect to host", async () => {
            let connUri = `\\c ${username}:${password}@${hostname}:${port}/${schema}`;
            await driver.wait(waitUntil.shellSessionIsOpened(shellConn), constants.wait15seconds);
            await commandExecutor.execute(connUri);
            connUri = `Creating a session to '${username}@${hostname}:${port}/${schema}'`;
            expect(commandExecutor.getResultMessage(), errors.queryResultError(connUri,
                commandExecutor.getResultMessage())).to.match(new RegExp(connUri));
            expect(commandExecutor.getResultMessage(),
                errors.queryResultError("Server version: (\\d+).(\\d+).(\\d+)", ""))
                .to.match(/Server version: (\d+).(\d+).(\d+)/);
            expect(commandExecutor.getResultMessage(),
                errors.queryResultError(`Default schema set to \`${schema}\``,
                    commandExecutor.getResultMessage())).to.match(new RegExp(`Default schema set to \`${schema}\``));

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

            await commandExecutor.changeSchemaOnTab("world_x_cst");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("Default schema set to`world_x_cst`",
                commandExecutor.getResultMessage())).to.match(/Default schema set to `world_x_cst`/);
            await commandExecutor.changeSchemaOnTab("sakila");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("Default schema set to`sakila`",
                commandExecutor.getResultMessage())).to.match(/Default schema set to `sakila`/);

        });

        it("Connect to host without password", async () => {

            let uri = `\\c ${shellUsername}@${hostname}:${port}/${schema}`;
            await commandExecutor.executeExpectingCredentials(uri, shellConn);
            uri = `Creating a session to '${shellUsername}@${hostname}:${port}/${schema}'`;
            expect(commandExecutor.getResultMessage(), errors.queryResultError(uri,
                commandExecutor.getResultMessage())).to.match(new RegExp(uri));
            expect(commandExecutor.getResultMessage(), errors.queryResultError("Server version: (\\d+).(\\d+).(\\d+)",
                commandExecutor.getResultMessage())).to.match(/Server version: (\d+).(\d+).(\d+)/);
            expect(commandExecutor.getResultMessage(), errors.queryResultError(`Default schema set to \`${schema}\`.`,
                commandExecutor.getResultMessage())).to.match(new RegExp(`Default schema set to \`${schema}\`.`));

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

            await commandExecutor.execute("shell.status()", true);
            expect(commandExecutor.getResultMessage(),
                errors.queryResultError("MySQL Shell version (\\d+).(\\d+).(\\d+)",
                    commandExecutor.getResultMessage())).to.match(/MySQL Shell version (\d+).(\d+).(\d+)/);

            let uri = `shell.connect('${username}:${password}@${hostname}:${portX}/${schema}')`;
            await commandExecutor.execute(uri, true);
            uri = `Creating a session to '${username}@${hostname}:${portX}/${schema}'`;
            expect(commandExecutor.getResultMessage(), errors.queryResultError(uri,
                commandExecutor.getResultMessage())).to.match(new RegExp(uri));
            expect(commandExecutor.getResultMessage(), errors.queryResultError("Server version: (\\d+).(\\d+).(\\d+)",
                commandExecutor.getResultMessage())).to.match(/Server version: (\d+).(\d+).(\d+)/);
            expect(commandExecutor.getResultMessage())
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
            await commandExecutor.execute(cmd, true);
            expect(commandExecutor.getResultMessage(), errors.queryResultError("ClassicSession",
                commandExecutor.getResultMessage())).to.match(/ClassicSession/);
            cmd = `mysqlx.getSession('${username}:${password}@${hostname}:${portX}/${schema}')`;
            await commandExecutor.execute(cmd, true);
            expect(commandExecutor.getResultMessage(), errors.queryResultError("Session",
                commandExecutor.getResultMessage())).to.match(/Session/);

        });

    });

    describe("Sessions", () => {

        const commandExecutor = new CommandExecutor();

        before(async function () {
            try {
                const treeDBConnections = await Tree.getElement(constants.openEditorsTreeSection,
                    constants.dbConnectionsLabel);
                await Tree.openContextMenuAndSelect(treeDBConnections, constants.openNewShellConsole);
                await driver.wait(Shell.isShellLoaded(), constants.wait15seconds, "Shell Console was not loaded");
                const editor = await driver.wait(until.elementLocated(locator.shellConsole.editor),
                    constants.wait10seconds, "Console was not loaded");
                await driver.executeScript(
                    "arguments[0].click();",
                    await editor.findElement(locator.shellConsole.currentLine),
                );
                let uri = `\\c ${username}:${password}@${hostname}:${portX}/${schema}`;

                await commandExecutor.execute(uri);
                uri = `Creating a session to '${username}@${hostname}:${portX}/${schema}'`;
                expect(commandExecutor.getResultMessage(), errors.queryResultError(uri,
                    commandExecutor.getResultMessage())).to.match(new RegExp(uri));
                uri = `Connection to server ${hostname} at port ${portX},`;
                uri += ` using the X protocol`;
                const server = await driver.wait(until.elementLocated(locator.shellConsole.connectionTab.server),
                    constants.wait5seconds);
                const schemaEl = await driver.wait(until.elementLocated(locator.shellConsole.connectionTab.schema),
                    constants.wait5seconds);
                await driver.wait(until.elementTextContains(server,
                    `${hostname}:${String(portX)}`),
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

        after(async function () {
            try {
                await Workbench.closeAllEditors();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Verify help command", async () => {

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
                expect(commandExecutor.getResultMessage(), errors.queryResultError(reg.toString(),
                    commandExecutor.getResultMessage())).to.match(reg);
            }

        });

        it("Switch session language - javascript python", async () => {

            await driver.wait(until.elementLocated(locator.shellConsole.editor),
                constants.wait10seconds, "Console was not loaded");
            await commandExecutor.languageSwitch("\\py ", true);
            expect(commandExecutor.getResultMessage(), errors.queryResultError("Python",
                commandExecutor.getResultMessage())).to.match(/Python/);
            await commandExecutor.languageSwitch("\\js ", true);
            expect(commandExecutor.getResultMessage(), errors.queryResultError("JavaScript",
                commandExecutor.getResultMessage())).to.match(/JavaScript/);

        });

        it("Using db global variable", async () => {

            await commandExecutor.execute("db.actor.select().limit(1)");
            expect(await (commandExecutor.getResultContent() as WebElement).getAttribute("innerHTML"),
                errors.queryDataSetError("PENELOPE"))
                .to.match(/PENELOPE/);

        });

        it("Using util global variable", async () => {

            await commandExecutor.execute('util.exportTable("actor", "test.txt")');
            expect(commandExecutor.getResultMessage(), errors.queryResultError("Running data dump using 1 thread",
                commandExecutor.getResultMessage())).to.match(/Running data dump using 1 thread/);
            const matches = [
                /Total duration: (\d+)(\d+):(\d+)(\d+):(\d+)(\d+)s/,
                /Data size: (\d+).(\d+)(\d+) KB/,
                /Rows written: (\d+)/,
                /Bytes written: (\d+).(\d+)(\d+) KB/,
                /Average throughput: (\d+).(\d+)(\d+) KB/,
            ];
            for (const match of matches) {
                expect(commandExecutor.getResultMessage(),
                    errors.queryResultError(match.toString(), commandExecutor.getResultMessage())).to.match(match);
            }

        });

        it("Verify collections - json format", async () => {

            await commandExecutor.changeSchemaOnTab("world_x_cst");
            await commandExecutor.execute("db.countryinfo.find()");
            expect(await (commandExecutor.getResultContent() as WebElement).getAttribute("innerHTML"),
                errors.queryDataSetError("Yugoslavia"))
                .to.match(/Yugoslavia/);

        });

        it("Check query result content", async () => {

            await commandExecutor.languageSwitch("\\sql ");
            await commandExecutor.execute("SHOW DATABASES;", true);
            expect(await (commandExecutor.getResultContent() as WebElement).getAttribute("innerHTML"),
                errors.queryDataSetError("sakila"))
                .to.match(/sakila/);
            expect(await (commandExecutor.getResultContent() as WebElement).getAttribute("innerHTML"),
                errors.queryDataSetError("mysql"))
                .to.match(/mysql/);
            await commandExecutor.languageSwitch("\\js ");
            await commandExecutor.execute(`shell.options.resultFormat="json/raw" `);
            expect(commandExecutor.getResultMessage(), errors.queryResultError("json\\/raw",
                commandExecutor.getResultMessage())).to.match(/json\/raw/);
            await commandExecutor.execute(`shell.options.showColumnTypeInfo=false `);
            expect(commandExecutor.getResultMessage(), errors.queryResultError("false",
                commandExecutor.getResultMessage())).to.match(/false/);
            await commandExecutor.execute(`shell.options.resultFormat="json/pretty" `);
            expect(commandExecutor.getResultMessage(), errors.queryResultError("json\\/pretty",
                commandExecutor.getResultMessage())).to.match(/json\/pretty/);
            await commandExecutor.changeSchemaOnTab("sakila");
            expect(commandExecutor.getResultMessage(),
                errors.queryResultError("Default schema `sakila` accessible through db",
                    commandExecutor.getResultMessage())).to.match(/Default schema `sakila` accessible through db/);
            await commandExecutor.execute("db.category.select().limit(1)");
            expect(await (commandExecutor.getResultContent() as WebElement).getAttribute("innerHTML"),
                errors.queryDataSetError("Action"))
                .to.match(/Action/);
            await commandExecutor.execute(`shell.options.resultFormat="table" `);
            expect(commandExecutor.getResultMessage(), errors.queryResultError("table",
                commandExecutor.getResultMessage())).to.match(/table/);
            await commandExecutor.execute("db.category.select().limit(1)");
            expect(await (commandExecutor.getResultContent() as WebElement).getAttribute("innerHTML"),
                errors.queryDataSetError("Action"))
                .to.match(/Action/);

        });

    });
});
