/*
 * Copyright (c) 2022, 2023, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with MySQL.
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */
import {
    EditorView,
    until,
    WebElement,
} from "vscode-extension-tester";
import { expect } from "chai";
import { driver, Misc } from "../lib/misc";
import { Shell } from "../lib/shell";
import * as constants from "../lib/constants";
import * as Until from "../lib/until";
import * as interfaces from "../lib/interfaces";
import * as locator from "../lib/locators";
import { CommandExecutor } from "../lib/cmdExecutor";

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
    let lastResultId = "";
    const updateResultId = (value: string) => {
        lastResultId = value;
    };

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
            await driver.wait(Until.extensionIsReady(), constants.wait2minutes, "Extension was not ready");
            await Misc.toggleBottomBar(false);
            await Misc.switchToFrame();
            await driver.wait(until.elementLocated(locator.dbConnectionOverview.newConsoleButton),
                constants.wait10seconds).click();
            await driver.wait(Shell.isShellLoaded(), constants.wait15seconds, "Shell Console was not loaded");
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }

    });

    describe("Shell generic operations", () => {

        beforeEach(async function () {
            try {
                await Misc.switchBackToTopFrame();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            await Misc.switchBackToTopFrame();
            await new EditorView().closeAllEditors();

        });

        it("Open multiple sessions", async () => {

            for (let i = 1; i <= 3; i++) {
                const treeDBConnections = await Misc.getTreeElement(constants.openEditorsTreeSection,
                    constants.dbConnectionsLabel);
                await Misc.openContextMenuItem(treeDBConnections, constants.openNewShellConsole,
                    constants.checkNewTabAndWebView);
                await driver.wait(Shell.isShellLoaded(), constants.wait15seconds, "Shell Console was not loaded");
                await Misc.switchBackToTopFrame();
                expect(await Misc.existsTreeElement(constants.openEditorsTreeSection, `Session ${i}`)).to.be.true;
            }

        });

    });

    describe("Shell database connections", () => {

        const shellConn = Object.assign({}, globalConn);
        shellConn.caption = "shellConn";
        (shellConn.basic as interfaces.IConnBasicMySQL).username = String(process.env.DBSHELLUSERNAME);
        (shellConn.basic as interfaces.IConnBasicMySQL).password = String(process.env.DBSHELLPASSWORD);
        const shellUsername = String((shellConn.basic as interfaces.IConnBasicMySQL).username);
        let result: interfaces.ICommandResult;

        before(async function () {
            try {
                const treeDBConnections = await Misc.getTreeElement(constants.openEditorsTreeSection,
                    constants.dbConnectionsLabel);
                await Misc.openContextMenuItem(treeDBConnections,
                    constants.openNewShellConsole, constants.checkNewTabAndWebView);
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
                await Misc.switchBackToTopFrame();
                await new EditorView().closeAllEditors();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });


        it("Connect to host", async () => {

            const aboutInfo = await CommandExecutor.getLastExistingCmdResult();
            let connUri = `\\c ${username}:${password}@${hostname}:${port}/${schema}`;
            result = await CommandExecutor.execute(connUri, aboutInfo.id, true);
            updateResultId(result.id);
            connUri = `Creating a session to '${username}@${hostname}:${port}/${schema}'`;
            expect(result.message).to.match(new RegExp(connUri));
            expect(result.message).to.match(/Server version: (\d+).(\d+).(\d+)/);
            expect(result.message).to.match(new RegExp(`Default schema set to \`${schema}\``));

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

            await Shell.changeSchemaOnTab("world_x_cst");
            let result = await CommandExecutor.getLastExistingCmdResult(lastResultId);
            updateResultId(result.id);
            expect(result.message).to.match(/Default schema set to `world_x_cst`/);
            await Shell.changeSchemaOnTab("sakila");
            result = await CommandExecutor.getLastExistingCmdResult(lastResultId);
            updateResultId(result.id);
            expect(result.message).to.match(/Default schema set to `sakila`/);

        });

        it("Connect to host without password", async () => {

            let uri = `\\c ${shellUsername}@${hostname}:${port}/${schema}`;
            result = await CommandExecutor.executeExpectingCredentials(uri, lastResultId, shellConn);
            updateResultId(result.id);
            uri = `Creating a session to '${shellUsername}@${hostname}:${port}/${schema}'`;
            expect(result.message).to.match(new RegExp(uri));
            expect(result.message).to.match(/Server version: (\d+).(\d+).(\d+)/);
            expect(result.message).to.match(new RegExp(`Default schema set to \`${schema}\`.`));

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

            result = await CommandExecutor.execute("shell.status()", lastResultId, true);
            updateResultId(result.id);
            expect(result.message).to.match(/MySQL Shell version (\d+).(\d+).(\d+)/);

            let uri = `shell.connect('${username}:${password}@${hostname}:${portX}/${schema}')`;
            result = await CommandExecutor.execute(uri, lastResultId, true);
            updateResultId(result.id);
            uri = `Creating a session to '${username}@${hostname}:${portX}/${schema}'`;
            expect(result.message).to.match(new RegExp(uri));
            expect(result.message).to.match(/Server version: (\d+).(\d+).(\d+)/);
            expect(result.message).to.match(new RegExp(`Default schema \`${schema}\` accessible through db`));

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
            result = await CommandExecutor.execute(cmd, lastResultId, true);
            updateResultId(result.id);
            expect(result.message).to.match(/ClassicSession/);
            cmd = `mysql.getSession('${username}:${password}@${hostname}:${port}/${schema}')`;
            result = await CommandExecutor.execute(cmd, lastResultId, true);
            lastResultId = result.id;
            expect(result.message).to.match(/ClassicSession/);
            cmd = `mysqlx.getSession('${username}:${password}@${hostname}:${portX}/${schema}')`;
            result = await CommandExecutor.execute(cmd, lastResultId, true);
            expect(result.message).to.match(/Session/);

        });

    });

    describe("Sessions", () => {

        before(async function () {
            try {
                const treeDBConnections = await Misc.getTreeElement(constants.openEditorsTreeSection,
                    constants.dbConnectionsLabel);
                await Misc.openContextMenuItem(treeDBConnections, constants.openNewShellConsole,
                    constants.checkNewTabAndWebView);
                await driver.wait(Shell.isShellLoaded(), constants.wait15seconds, "Shell Console was not loaded");
                const editor = await driver.wait(until.elementLocated(locator.shellConsole.editor),
                    10000, "Console was not loaded");
                await driver.executeScript(
                    "arguments[0].click();",
                    await editor.findElement(locator.shellConsole.currentLine),
                );
                let uri = `\\c ${username}:${password}@${hostname}:${portX}/${schema}`;

                const aboutInfo = await CommandExecutor.getLastExistingCmdResult();
                const result = await CommandExecutor.execute(uri, aboutInfo.id);
                updateResultId(result.id);
                uri = `Creating a session to '${username}@${hostname}:${portX}/${schema}'`;
                expect(result.message).to.match(new RegExp(uri));
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
                await Misc.switchBackToTopFrame();
                await new EditorView().closeAllEditors();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Verify help command", async () => {

            const result = await CommandExecutor.execute("\\help ", lastResultId);
            updateResultId(result.id);
            expect(result.message).to.match(
                /The Shell Help is organized in categories and topics/,
            );
            expect(result.message).to.match(/SHELL COMMANDS/);
            expect(result.message).to.match(/\\connect/);
            expect(result.message).to.match(/\\disconnect/);
            expect(result.message).to.match(/\\edit/);
            expect(result.message).to.match(/\\exit/);
            expect(result.message).to.match(/\\help/);
            expect(result.message).to.match(/\\history/);
            expect(result.message).to.match(/\\js/);
            expect(result.message).to.match(/\\nopager/);
            expect(result.message).to.match(/\\nowarnings/);
            expect(result.message).to.match(/\\option/);
            expect(result.message).to.match(/\\pager/);
            expect(result.message).to.match(/\\py/);
            expect(result.message).to.match(/\\quit/);
            expect(result.message).to.match(/\\reconnect/);
            expect(result.message).to.match(/\\rehash/);
            expect(result.message).to.match(/\\show/);
            expect(result.message).to.match(/\\source/);
            expect(result.message).to.match(/\\sql/);
            expect(result.message).to.match(/\\status/);
            expect(result.message).to.match(/\\system/);
            expect(result.message).to.match(/\\use/);
            expect(result.message).to.match(/\\warning/);
            expect(result.message).to.match(/\\watch/);

        });

        it("Switch session language - javascript python", async () => {

            await driver.wait(until.elementLocated(locator.shellConsole.editor),
                constants.wait10seconds, "Console was not loaded");
            let result = await CommandExecutor.languageSwitch("\\py ", lastResultId, true);
            updateResultId(result.id);
            expect(result.message).to.match(/Python/);
            result = await CommandExecutor.languageSwitch("\\js ", lastResultId, true);
            updateResultId(result.id);
            expect(result.message).to.match(/JavaScript/);

        });

        it("Using db global variable", async () => {

            const result = await CommandExecutor.execute("db.actor.select().limit(1)", lastResultId);
            updateResultId(result.id);
            expect(await (result.content as WebElement).getAttribute("innerHTML")).to.match(/PENELOPE/);

        });

        it("Using util global variable", async () => {

            const result = await CommandExecutor.execute('util.exportTable("actor", "test.txt")', lastResultId);
            updateResultId(result.id);
            expect(result.message).to.match(/Running data dump using 1 thread/);
            const matches = [
                /Total duration: (\d+)(\d+):(\d+)(\d+):(\d+)(\d+)s/,
                /Data size: (\d+).(\d+)(\d+) KB/,
                /Rows written: (\d+)/,
                /Bytes written: (\d+).(\d+)(\d+) KB/,
                /Average throughput: (\d+).(\d+)(\d+) KB/,
            ];
            for (const match of matches) {
                expect(result.message, `${result.message} did not match ${String(match)}`).to.match(match);
            }

        });

        it("Verify collections - json format", async () => {

            await Shell.changeSchemaOnTab("world_x_cst");
            const changeSchema = await CommandExecutor.getLastExistingCmdResult();
            const result = await CommandExecutor.execute("db.countryinfo.find()", changeSchema.id);
            updateResultId(result.id);
            expect(await (result.content as WebElement).getAttribute("innerHTML")).to.match(/Yugoslavia/);

        });

        it("Check query result content", async () => {

            let result = await CommandExecutor.languageSwitch("\\sql ", lastResultId);
            updateResultId(result.id);
            result = await CommandExecutor.execute("SHOW DATABASES;", lastResultId, true);
            updateResultId(result.id);
            expect(await (result.content as WebElement).getAttribute("innerHTML")).to.match(/sakila/);
            expect(await (result.content as WebElement).getAttribute("innerHTML")).to.match(/mysql/);
            result = await CommandExecutor.languageSwitch("\\js ", lastResultId);
            updateResultId(result.id);
            result = await CommandExecutor.execute(`shell.options.resultFormat="json/raw" `, lastResultId);
            updateResultId(result.id);
            expect(result.message).to.match(/json\/raw/);
            result = await CommandExecutor.execute(`shell.options.showColumnTypeInfo=false `, lastResultId);
            updateResultId(result.id);
            expect(result.message).to.match(/false/);
            result = await CommandExecutor.execute(`shell.options.resultFormat="json/pretty" `, lastResultId);
            updateResultId(result.id);
            expect(result.message).to.match(/json\/pretty/);
            await Shell.changeSchemaOnTab("sakila");
            result = await CommandExecutor.getLastExistingCmdResult(lastResultId);
            updateResultId(result.id);
            expect(result.message).to.match(/Default schema `sakila` accessible through db/);
            result = await CommandExecutor.execute("db.category.select().limit(1)", lastResultId);
            updateResultId(result.id);
            expect(await (result.content as WebElement).getAttribute("innerHTML")).to.match(/Action/);
            result = await CommandExecutor.execute(`shell.options.resultFormat="table" `, lastResultId);
            updateResultId(result.id);
            expect(result.message).to.match(/table/);
            result = await CommandExecutor.execute("db.category.select().limit(1)", lastResultId);
            expect(await (result.content as WebElement).getAttribute("innerHTML")).to.match(/Action/);

        });

    });
});
