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
    By,
    EditorView,
    until,
    WebElement,
} from "vscode-extension-tester";

import { before, after, afterEach } from "mocha";
import { expect } from "chai";
import { driver, Misc } from "../lib/misc";
import { IDBConnection, Database, IConnBasicMySQL } from "../lib/db";
import { Shell } from "../lib/shell";
import * as constants from "../lib/constants";

describe("MYSQL SHELL CONSOLES", () => {

    const globalBasicInfo: IConnBasicMySQL = {
        hostname: String(process.env.DBHOSTNAME),
        username: String(process.env.DBUSERNAME),
        port: Number(process.env.DBPORT),
        portX: Number(process.env.DBPORTX),
        schema: "sakila",
        password: String(process.env.DBPASSWORD),
    };

    const globalConn: IDBConnection = {
        dbType: "MySQL",
        caption: "conn",
        description: "Local connection",
        basic: globalBasicInfo,
    };

    const username = String((globalConn.basic as IConnBasicMySQL).username);
    const password = String((globalConn.basic as IConnBasicMySQL).password);
    const hostname = String((globalConn.basic as IConnBasicMySQL).hostname);
    const port = String((globalConn.basic as IConnBasicMySQL).port);
    const portX = String((globalConn.basic as IConnBasicMySQL).portX);
    const schema = String((globalConn.basic as IConnBasicMySQL).schema);

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
            await driver.wait(Misc.extensionIsReady(), constants.extensionReadyWait, "Extension was not ready");
            await Misc.toggleBottomBar(false);
            await Misc.sectionFocus(constants.openEditorsTreeSection);
            const treeDBConnections = await Misc.getTreeElement(constants.openEditorsTreeSection,
                constants.dbConnectionsLabel);
            await Misc.openContexMenuItem(treeDBConnections, constants.openNewShellConsole, undefined, true);
            await driver.wait(Shell.isShellLoaded(), constants.explicitWait * 3, "Shell Console was not loaded");
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }

    });

    describe("Shell generic operations", () => {

        beforeEach(async function () {
            try {
                await driver.switchTo().defaultContent();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            await driver.switchTo().defaultContent();
            await new EditorView().closeAllEditors();

        });

        it("Open multiple sessions", async () => {

            for (let i = 1; i <= 3; i++) {
                const treeDBConnections = await Misc.getTreeElement(constants.openEditorsTreeSection,
                    constants.dbConnectionsLabel);
                await Misc.openContexMenuItem(treeDBConnections, constants.openNewShellConsole,
                    undefined, true);
                await driver.wait(Shell.isShellLoaded(), constants.explicitWait * 3, "Shell Console was not loaded");
                await driver.switchTo().defaultContent();
                await Misc.getTreeElement(constants.openEditorsTreeSection, `Session ${i}`);
            }

        });

    });

    describe("Shell database connections", () => {

        const shellConn = Object.assign({}, globalConn);
        shellConn.caption = "shellConn";
        (shellConn.basic as IConnBasicMySQL).username = String(process.env.DBSHELLUSERNAME);
        (shellConn.basic as IConnBasicMySQL).password = String(process.env.DBSHELLPASSWORD);
        const shellUsername = String((shellConn.basic as IConnBasicMySQL).username);

        before(async function () {
            try {
                const treeDBConnections = await Misc.getTreeElement(constants.openEditorsTreeSection,
                    constants.dbConnectionsLabel);
                await Misc.openContexMenuItem(treeDBConnections,
                    constants.openNewShellConsole, undefined, true);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            const result = await Misc.execCmd(`\\disconnect `, undefined, undefined, true);
            expect(result[0] === "" || result[0] === "Already disconnected.").to.be.true;

        });

        after(async function () {
            try {
                await driver.switchTo().defaultContent();
                await new EditorView().closeAllEditors();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });


        it("Connect to host", async () => {

            let connUri = `\\c ${username}:${password}@${hostname}:${port}/${schema}`;
            const result = await Misc.execCmd(connUri, undefined, undefined, true);
            connUri = `Creating a session to '${username}@${hostname}:${port}/${schema}'`;
            expect(result[0]).to.include(connUri);
            await driver.wait(async () => {
                return (await Misc.getCmdResultMsg())?.match(/Server version: (\d+).(\d+).(\d+)/);
            }, constants.explicitWait, `'/Server version: (\\d+).(\\d+).(\\d+)/' was not matched`);

            await driver.wait(async () => {
                return (await Misc.getCmdResultMsg())?.includes(`Default schema set to \`${schema}\`.`);
            }, constants.explicitWait, `Could not find 'Default schema set to \`${schema}\`.'`);

            const server = await driver.wait(until.elementLocated(By.id("server")), constants.explicitWait);
            const schemaEl = await driver.wait(until.elementLocated(By.id("schema")), constants.explicitWait);
            await driver.wait(until.elementTextContains(server, `${hostname}:${port}`),
                constants.explicitWait, `Server tab does not contain '${hostname}:${port}'`);
            await driver.wait(until.elementTextContains(schemaEl, `${schema}`),
                constants.explicitWait, `Schema tab does not contain '${schema}'`);

        });

        it("Connect to host without password", async () => {

            let uri = `\\c ${shellUsername}@${hostname}:${port}/${schema}`;
            const nextResultBlock = await Misc.getNextResultBlockId();
            const textArea = driver.findElement(By.css("textarea"));
            await textArea.sendKeys(uri);
            await Misc.execOnEditor();
            await Database.setDBConnectionCredentials(shellConn);
            await driver.wait(async () => {
                const next = await driver
                    .findElements(
                        By.xpath(`//div[@class='zoneHost' and @monaco-view-zone='${String(nextResultBlock)}']`));

                return next.length > 0;
            }, constants.explicitWait, "Could not get the command results");

            uri = `Creating a session to '${shellUsername}@${hostname}:${port}/${schema}'`;
            await driver.wait(async () => {
                return (await Misc.getCmdResultMsg())?.includes(uri);
            }, constants.explicitWait, `Result does not include '${uri}'`);

            await driver.wait(async () => {
                return (await Misc.getCmdResultMsg())?.match(/Server version: (\d+).(\d+).(\d+)/);
            }, constants.explicitWait, `'/Server version: (\\d+).(\\d+).(\\d+)/' was not matched`);

            await driver.wait(async () => {
                return (await Misc.getCmdResultMsg())?.includes(`Default schema set to \`${schema}\`.`);
            }, constants.explicitWait, `Could not find 'Default schema set to \`${schema}\`.'`);

            const server = await driver.wait(until.elementLocated(By.id("server")),
                constants.explicitWait, "Server tab was not found");
            const schemaEl = await driver.wait(until.elementLocated(By.id("schema")),
                constants.explicitWait, "Schema tab was not found");
            await driver.wait(until.elementTextContains(server, `${hostname}:${port}`),
                constants.explicitWait, `Server tab does not contain '${hostname}:${port}'`);
            await driver.wait(until.elementTextContains(schemaEl, `${schema}`),
                constants.explicitWait, `Schema tab does not contain '${schema}'`);

        });

        it("Connect using shell global variable", async () => {

            let result = await Misc.execCmd("shell.status()", undefined, undefined, true);
            expect(result[0]).to.match(/MySQL Shell version (\d+).(\d+).(\d+)/);

            let uri = `shell.connect('${username}:${password}@${hostname}:${portX}/${schema}')`;
            result = await Misc.execCmd(uri, undefined, undefined, true);
            uri = `Creating a session to '${username}@${hostname}:${portX}/${schema}'`;
            expect(result[0]).to.include(uri);
            await driver.wait(async () => {
                return (await Misc.getCmdResultMsg())?.match(/Server version: (\d+).(\d+).(\d+)/);
            }, constants.explicitWait, `'/Server version: (\\d+).(\\d+).(\\d+)/' was not matched`);

            await driver.wait(async () => {
                return (await Misc.getCmdResultMsg())?.includes(`Default schema \`${schema}\``);
            }, constants.explicitWait, `Could not find 'Default schema set to \`${schema}\`.'`);

            const server = await driver.wait(until.elementLocated(By.id("server")), constants.explicitWait);
            const schemaEl = await driver.wait(until.elementLocated(By.id("schema")), constants.explicitWait);
            await driver.wait(until.elementTextContains(server, `${hostname}:${port}`),
                constants.explicitWait, `Server tab does not contain '${hostname}:${port}'`);
            await driver.wait(until.elementTextContains(schemaEl, `${schema}`),
                constants.explicitWait, `Schema tab does not contain '${schema}'`);

        });

        it("Connect using mysql mysqlx global variable", async () => {

            let cmd = `mysql.getClassicSession('${username}:${password}
                @${hostname}:${port}/${schema}')`;
            let result = await Misc.execCmd(cmd.replace(/ /g, ""), undefined, undefined, true);
            expect(result[0]).to.include("ClassicSession");
            cmd = `mysql.getSession('${username}:${password}@${hostname}:${port}/${schema}')`;
            result = await Misc.execCmd(cmd, undefined, undefined, true);
            expect(result[0]).to.include("ClassicSession");
            cmd = `mysqlx.getSession('${username}:${password}@${hostname}:${portX}/${schema}')`;
            result = await Misc.execCmd(cmd, undefined, undefined, true);
            expect(result[0]).to.include("Session");

        });

        it("Change schemas using menu", async () => {

            const result = await Misc.execCmd(`\\c ${username}:${password}@${hostname}:${portX}`,
                undefined, constants.explicitWait * 2, true);
            expect(result[0]).to.include(`Creating a session to '${username}@${hostname}:${portX}`);
            const server = await driver.wait(until.elementLocated(By.id("server")), constants.explicitWait);
            const schema = await driver.wait(until.elementLocated(By.id("schema")), constants.explicitWait);
            await driver.wait(until.elementTextContains(server, `${hostname}:${portX}`),
                constants.explicitWait, `Server tab does not contain '${hostname}:${port}'`);
            await driver.wait(until.elementTextContains(schema, `no schema selected`),
                constants.explicitWait, `Schema tab does not have 'no schema selected'`);

            await driver.executeScript(
                "arguments[0].click();",
                await driver.findElement(By.css(".current-line")),
            );
            const schemaLabel = await driver.findElement(By.id("schema")).getText();
            expect(schemaLabel.substring(1).trim()).to.equals("no schema selected");
            await Shell.changeSchemaOnTab("sakila");
            await Shell.changeSchemaOnTab("world_x_cst");

        });

    });

    describe("Sessions", () => {

        before(async function () {
            try {
                const treeDBConnections = await Misc.getTreeElement(constants.openEditorsTreeSection,
                    constants.dbConnectionsLabel);
                await Misc.openContexMenuItem(treeDBConnections, constants.openNewShellConsole,
                    undefined, true);
                await driver.wait(Shell.isShellLoaded(), constants.explicitWait * 3, "Shell Console was not loaded");
                const editor = await driver.wait(until.elementLocated(By.id("shellEditorHost")),
                    10000, "Console was not loaded");
                await driver.executeScript(
                    "arguments[0].click();",
                    await editor.findElement(By.css(".current-line")),
                );
                let uri = `\\c ${username}:${password}@${hostname}:${portX}/${schema}`;
                const result = await Misc.execCmd(uri);
                uri = `Creating a session to '${username}@${hostname}:${portX}/${schema}'`;
                expect(result[0]).to.include(uri);
                uri = `Connection to server ${hostname} at port ${portX},`;
                uri += ` using the X protocol`;
                const server = await driver.wait(until.elementLocated(By.id("server")), constants.explicitWait);
                const schemaEl = await driver.wait(until.elementLocated(By.id("schema")), constants.explicitWait);
                await driver.wait(until.elementTextContains(server,
                    `${hostname}:${String(portX)}`),
                    constants.explicitWait, `Server tab does not contain '${hostname}:${port}'`);
                await driver.wait(until.elementTextContains(schemaEl, `${schema}`),
                    constants.explicitWait, `Schema tab does not contain '${schema}'`);
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
                await driver.switchTo().defaultContent();
                await new EditorView().closeAllEditors();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Verify help command", async () => {

            const result = await Misc.execCmd("\\help ");
            expect(result[0]).to.include(
                "The Shell Help is organized in categories and topics.",
            );
            expect(result[0]).to.include("SHELL COMMANDS");
            expect(result[0]).to.include("\\connect");
            expect(result[0]).to.include("\\disconnect");
            expect(result[0]).to.include("\\edit");
            expect(result[0]).to.include("\\exit");
            expect(result[0]).to.include("\\help");
            expect(result[0]).to.include("\\history");
            expect(result[0]).to.include("\\js");
            expect(result[0]).to.include("\\nopager");
            expect(result[0]).to.include("\\nowarnings");
            expect(result[0]).to.include("\\option");
            expect(result[0]).to.include("\\pager");
            expect(result[0]).to.include("\\py");
            expect(result[0]).to.include("\\quit");
            expect(result[0]).to.include("\\reconnect");
            expect(result[0]).to.include("\\rehash");
            expect(result[0]).to.include("\\show");
            expect(result[0]).to.include("\\source");
            expect(result[0]).to.include("\\sql");
            expect(result[0]).to.include("\\status");
            expect(result[0]).to.include("\\system");
            expect(result[0]).to.include("\\use");
            expect(result[0]).to.include("\\warning");
            expect(result[0]).to.include("\\watch");

        });

        it("Switch session language - javascript python", async () => {

            const editor = await driver.wait(until.elementLocated(By.id("shellEditorHost")),
                10000, "Console was not loaded");
            let result = await Misc.execCmd("\\py ");
            expect(result[0]).to.equals("Switching to Python mode...");
            expect(await Shell.getTech(editor)).to.equals("python");
            result = await Misc.execCmd("\\js ");
            expect(result[0]).to.equals("Switching to JavaScript mode...");
            expect(await Shell.getTech(editor)).to.equals("javascript");

        });

        it("Using db global variable", async () => {

            const result = await Misc.execCmd("db.actor.select().limit(1)");
            await driver.wait(Shell.isValueOnDataSet(result[1] as WebElement, "PENELOPE"),
                constants.explicitWait, "'PENELOPE is not on the data set'");

        });

        it("Using util global variable", async () => {

            await Misc.execCmd('util.exportTable("actor", "test.txt")');
            await driver.wait(async () => {
                return (await Misc.getCmdResultMsg())?.includes("Running data dump using 1 thread.");
            }, constants.explicitWait, "'Running data dump using 1 thread.' was not found");
            const matches = [
                /Total duration: (\d+)(\d+):(\d+)(\d+):(\d+)(\d+)s/,
                /Data size: (\d+).(\d+)(\d+) KB/,
                /Rows written: (\d+)/,
                /Bytes written: (\d+).(\d+)(\d+) KB/,
                /Average throughput: (\d+).(\d+)(\d+) KB/,
            ];
            for (const match of matches) {
                await driver.wait(async () => {
                    return (await Misc.getCmdResultMsg())?.match(match);
                }, constants.explicitWait, `'${String(match)}' was not matched`);
            }

        });

        it("Verify collections - json format", async () => {

            await Shell.changeSchemaOnTab("world_x_cst");
            const result1 = await Misc.execCmd("db.countryinfo.find()");
            await driver.wait(Shell.isValueOnJsonResult(result1[1] as WebElement, "Yugoslavia"),
                constants.explicitWait, "'Yugoslavia' is not the json result");

        });

        it("Check query result content", async () => {

            await Misc.execCmd("\\sql ");
            let result = await Misc.execCmd("SHOW DATABASES;", undefined, constants.explicitWait * 4, true);
            await driver.wait(Shell.isValueOnDataSet(result[1] as WebElement, "sakila"),
                constants.explicitWait, "'sakila is not on the data set'");
            await driver.wait(Shell.isValueOnDataSet(result[1] as WebElement, "mysql"),
                constants.explicitWait, "'mysql is not on the data set'");
            await Misc.execCmd("\\js ");
            result = await Misc.execCmd(`shell.options.resultFormat="json/raw" `);
            expect(result[0]).to.equals("json/raw");
            result = await Misc.execCmd(`shell.options.showColumnTypeInfo=false `);
            expect(result[0]).to.equals("false");
            result = await Misc.execCmd(`shell.options.resultFormat="json/pretty" `);
            expect(result[0]).to.equals("json/pretty");
            await Shell.changeSchemaOnTab("sakila");
            result = await Misc.execCmd("db.category.select().limit(1)");
            await driver.wait(Shell.isValueOnJsonResult(result[1] as WebElement, "Action"),
                constants.explicitWait, "'Action is not on the json result'");
            result = await Misc.execCmd(`shell.options.resultFormat="table" `);
            expect(result[0]).to.equals("table");
            result = await Misc.execCmd("db.category.select().limit(1)");
            await driver.wait(Shell.isValueOnDataSet(result[1] as WebElement, "Action"),
                constants.explicitWait, "'Action is not on the data set'");
        });

    });
});
