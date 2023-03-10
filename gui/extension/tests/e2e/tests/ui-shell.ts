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
    Condition,
    CustomTreeSection,
    EditorView,
    until,
    WebElement,
} from "vscode-extension-tester";

import { before, after, afterEach } from "mocha";
import { expect } from "chai";
import {
    consolesTreeSection,
    driver,
    explicitWait,
    Misc,
    isExtPrepared,
    shellMaxLevel,
} from "../lib/misc";

import { IDBConnection, Database } from "../lib/db";
import { Shell } from "../lib/shell";

describe("MYSQL SHELL CONSOLES", () => {

    const globalConn: IDBConnection = {
        caption: "conn",
        description: "Local connection",
        hostname: String(process.env.DBHOSTNAME),
        username: String(process.env.DBUSERNAME),
        port: Number(process.env.DBPORT),
        portX: Number(process.env.DBPORTX),
        schema: "sakila",
        password: String(process.env.DBPASSWORD),
        sslMode: undefined,
        sslCA: undefined,
        sslClientCert: undefined,
        sslClientKey: undefined,
    };

    let treeConsolesSection: CustomTreeSection;

    before(async function () {
        try {
            if (!isExtPrepared) {
                await Misc.prepareExtension();
            }

            treeConsolesSection = await Misc.getSection(consolesTreeSection);
            await treeConsolesSection?.expand();
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }

    });

    describe("Toolbar shell", () => {

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            await driver.switchTo().defaultContent();
            await new EditorView().closeAllEditors();

        });

        it("Add a new MySQL Shell Console", async () => {

            await Misc.clickSectionToolbarButton(treeConsolesSection!, "Add a New MySQL Shell Console");

            await Misc.switchToWebView();

            await driver.wait(Shell.isShellLoaded(), explicitWait * 3, "Shell Console was not loaded");

            await driver.switchTo().defaultContent();

            const treeSession1 = await treeConsolesSection.findItem("Session 1", shellMaxLevel);

            expect(treeSession1).to.exist;

            await Misc.selectContextMenuItem(treeSession1!, "Close this MySQL Shell Console");

            await driver.wait(until.stalenessOf(treeSession1!), explicitWait, "Session 1 was not closed");

        });

        it("Open MySQL Shell Console Browser", async () => {

            await Misc.clickSectionToolbarButton(treeConsolesSection!, "Open MySQL Shell Console Browser");
            await Misc.switchToWebView();

            await driver.wait(Shell.isShellLoaded(), explicitWait * 3, "Shell Console was not loaded");

            expect(await driver.wait(until.elementLocated(By.id("title")),
                explicitWait, "Title was not found").getText())
                .to.equal("MySQL Shell - GUI Console");

            const newSession = await driver.findElement(By.id("-1"));

            await newSession.click();

            await driver.wait(Shell.isShellLoaded(), explicitWait * 3, "Shell Console was not loaded");

            await driver.switchTo().defaultContent();

            await driver.wait(new Condition("", async () => {
                return treeConsolesSection.findItem("Session 1", shellMaxLevel);
            }), explicitWait, "Session 1 was not found on the tree");

        });

        it("Open multiple sessions", async () => {

            for (let i = 1; i <= 3; i++) {
                await Misc.clickSectionToolbarButton(treeConsolesSection!, "Add a New MySQL Shell Console");
                await Misc.switchToWebView();
                await driver.wait(Shell.isShellLoaded(), explicitWait * 3, "Shell Console was not loaded");
                await driver.switchTo().defaultContent();
                await driver.wait(treeConsolesSection.findItem(`Session ${i}`, shellMaxLevel),
                    explicitWait, `Session ${i} does not exist on the tree`);
            }

        });

    });

    describe("Shell database connections", () => {

        const shellConn: IDBConnection = {
            caption: "shellConn",
            description: "Local connection for shell",
            hostname: String(process.env.DBHOSTNAME),
            username: String(process.env.DBSHELLUSERNAME),
            port: Number(process.env.DBPORT),
            portX: Number(process.env.DBPORTX),
            schema: "sakila",
            password: String(process.env.DBSHELLPASSWORD),
            sslMode: undefined,
            sslCA: undefined,
            sslClientCert: undefined,
            sslClientKey: undefined,
        };

        before(async function () {
            try {
                await Misc.clickSectionToolbarButton(treeConsolesSection!, "Add a New MySQL Shell Console");
                await Misc.switchToWebView();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            const result = await Misc.execCmd(`\\disconnect `);
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

            let connUri = `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            connUri += `${globalConn.port}/${globalConn.schema}`;

            const result = await Misc.execCmd(connUri);

            connUri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            connUri += `${globalConn.port}/${globalConn.schema}'`;

            expect(result[0]).to.include(connUri);

            await driver.wait(async () => {
                return (await Misc.getCmdResultMsg())?.match(/Server version: (\d+).(\d+).(\d+)/);
            }, explicitWait, `'/Server version: (\\d+).(\\d+).(\\d+)/' was not matched`);

            await driver.wait(async () => {
                return (await Misc.getCmdResultMsg())?.includes(`Default schema set to \`${globalConn.schema}\`.`);
            }, explicitWait, `Could not find 'Default schema set to \`${globalConn.schema}\`.'`);

            const server = await driver.wait(until.elementLocated(By.id("server")), explicitWait);
            const schema = await driver.wait(until.elementLocated(By.id("schema")), explicitWait);
            await driver.wait(until.elementTextContains(server, `${globalConn.hostname}:${globalConn.port}`),
                explicitWait, `Server tab does not contain '${globalConn.hostname}:${globalConn.port}'`);
            await driver.wait(until.elementTextContains(schema, `${globalConn.schema}`),
                explicitWait, `Schema tab does not contain '${globalConn.schema}'`);

        });

        it("Connect to host without password", async () => {

            let uri = `\\c ${String(shellConn.username)}@${String(shellConn.hostname)}:`;
            uri += `${String(shellConn.port)}/${String(shellConn.schema)}`;

            const nextResultBlock = await Misc.getNextResultBlockId();
            const textArea = driver.findElement(By.css("textarea"));
            await textArea.sendKeys(uri);
            await Misc.execOnEditor();

            await Database.setPassword(shellConn);

            try {
                await Misc.setConfirmDialog(shellConn, "no");
            } catch (e) {
                // continue
            }

            await driver.wait(async () => {
                const next = await driver
                    .findElements(
                        By.xpath(`//div[@class='zoneHost' and @monaco-view-zone='${String(nextResultBlock)}']`));

                return next.length > 0;
            }, explicitWait, "Could not get the command results");

            uri = `Creating a session to '${String(shellConn.username)}@${String(shellConn.hostname)}:`;
            uri += `${String(shellConn.port)}/${String(shellConn.schema)}'`;

            await driver.wait(async () => {
                return (await Misc.getCmdResultMsg())?.includes(uri);
            }, explicitWait, `Result does not include '${uri}'`);

            await driver.wait(async () => {
                return (await Misc.getCmdResultMsg())?.match(/Server version: (\d+).(\d+).(\d+)/);
            }, explicitWait, `'/Server version: (\\d+).(\\d+).(\\d+)/' was not matched`);

            await driver.wait(async () => {
                return (await Misc.getCmdResultMsg())?.includes(`Default schema set to \`${shellConn.schema}\`.`);
            }, explicitWait, `Could not find 'Default schema set to \`${shellConn.schema}\`.'`);

            const server = await driver.findElement(By.id("server"));
            const schema = await driver.findElement(By.id("schema"));
            await driver.wait(until.elementTextContains(server, `${shellConn.hostname}:${shellConn.port}`),
                explicitWait, `Server tab does not contain '${shellConn.hostname}:${shellConn.port}'`);
            await driver.wait(until.elementTextContains(schema, `${shellConn.schema}`),
                explicitWait, `Schema tab does not contain '${shellConn.schema}'`);

        });

        it("Connect using shell global variable", async () => {

            let uri = `shell.connect('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}/${globalConn.schema}')`;

            let result = await Misc.execCmd(uri);

            uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}/${globalConn.schema}'`;

            expect(result[0]).to.include(uri);

            await driver.wait(async () => {
                return (await Misc.getCmdResultMsg())?.match(/Server version: (\d+).(\d+).(\d+)/);
            }, explicitWait, `'/Server version: (\\d+).(\\d+).(\\d+)/' was not matched`);

            await driver.wait(async () => {
                return (await Misc.getCmdResultMsg())?.includes(`Default schema \`${globalConn.schema}\``);
            }, explicitWait, `Could not find 'Default schema set to \`${globalConn.schema}\`.'`);

            const server = await driver.wait(until.elementLocated(By.id("server")), explicitWait);
            const schema = await driver.wait(until.elementLocated(By.id("schema")), explicitWait);
            await driver.wait(until.elementTextContains(server, `${globalConn.hostname}:${globalConn.port}`),
                explicitWait, `Server tab does not contain '${globalConn.hostname}:${globalConn.port}'`);
            await driver.wait(until.elementTextContains(schema, `${globalConn.schema}`),
                explicitWait, `Schema tab does not contain '${globalConn.schema}'`);

            result = await Misc.execCmd("shell.status()");
            expect(result[0]).to.match(/MySQL Shell version (\d+).(\d+).(\d+)/);
            expect(result[0]).to.include(`"CONNECTION":"${globalConn.hostname} via TCP/IP"`);
            expect(result[0]).to.include(`"CURRENT_SCHEMA":"${globalConn.schema}"`);
            expect(result[0]).to.include(`"CURRENT_USER":"${globalConn.username}`);
            expect(result[0]).to.include(`"TCP_PORT":"${String(globalConn.portX)}"`);

        });

        it("Connect using mysql mysqlx global variable", async () => {

            let cmd = `mysql.getClassicSession('${globalConn.username}:${globalConn.password}
                @${globalConn.hostname}:${globalConn.port}/${globalConn.schema}')`;

            let result = await Misc.execCmd(cmd.replace(/ /g, ""));

            expect(result[0]).to.include("ClassicSession");

            cmd = `mysql.getSession('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            cmd += `${globalConn.port}/${globalConn.schema}')`;

            result = await Misc.execCmd(cmd);

            expect(result[0]).to.include("ClassicSession");

            cmd = `mysqlx.getSession('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            cmd += `${String(globalConn.portX)}/${globalConn.schema}')`;

            result = await Misc.execCmd(cmd);

            expect(result[0]).to.include("Session");

        });

        it("Change schemas using menu", async () => {

            const result = await Misc.execCmd(
                `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:${String(globalConn.portX)}`);

            expect(result[0]).to.include(
                `Creating a session to '${globalConn.username}@${globalConn.hostname}:${String(globalConn.portX)}`);

            const server = await driver.wait(until.elementLocated(By.id("server")), explicitWait);
            const schema = await driver.wait(until.elementLocated(By.id("schema")), explicitWait);
            await driver.wait(until.elementTextContains(server, `${globalConn.hostname}:${String(globalConn.portX)}`),
                explicitWait, `Server tab does not contain '${globalConn.hostname}:${globalConn.port}'`);
            await driver.wait(until.elementTextContains(schema, `no schema selected`),
                explicitWait, `Schema tab does not have 'no schema selected'`);

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

        let editor: WebElement;

        before(async function () {
            try {
                await Misc.clickSectionToolbarButton(treeConsolesSection!, "Add a New MySQL Shell Console");

                await Misc.switchToWebView();

                await driver.wait(Shell.isShellLoaded(), explicitWait * 3, "Shell Console was not loaded");

                editor = await driver.wait(until.elementLocated(By.id("shellEditorHost")),
                    10000, "Console was not loaded");

                await driver.executeScript(
                    "arguments[0].click();",
                    await editor.findElement(By.css(".current-line")),
                );

                let uri = `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
                uri += `${globalConn.portX}/${globalConn.schema}`;

                const result = await Misc.execCmd(uri);

                uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
                uri += `${globalConn.portX}/${globalConn.schema}'`;

                expect(result[0]).to.include(uri);

                uri = `Connection to server ${globalConn.hostname} at port ${globalConn.portX},`;
                uri += ` using the X protocol`;

                const server = await driver.wait(until.elementLocated(By.id("server")), explicitWait);
                const schema = await driver.wait(until.elementLocated(By.id("schema")), explicitWait);
                await driver.wait(until.elementTextContains(server,
                    `${globalConn.hostname}:${String(globalConn.portX)}`),
                explicitWait, `Server tab does not contain '${globalConn.hostname}:${globalConn.port}'`);
                await driver.wait(until.elementTextContains(schema, `${globalConn.schema}`),
                    explicitWait, `Schema tab does not contain '${globalConn.schema}'`);
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
                explicitWait, "'PENELOPE is not on the data set'");

        });

        it("Using util global variable", async () => {

            await Misc.execCmd('util.exportTable("actor", "test.txt")');

            await driver.wait(async () => {
                return (await Misc.getCmdResultMsg())?.includes("Running data dump using 1 thread.");
            }, explicitWait, "'Running data dump using 1 thread.' was not found");

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
                }, explicitWait, `'${String(match)}' was not matched`);
            }

        });

        it("Verify collections - json format", async () => {

            await Shell.changeSchemaOnTab("world_x_cst");

            const result1 = await Misc.execCmd("db.countryinfo.find()");

            expect(await Shell.getLangResult(result1[1] as WebElement)).to.equals("json");

            await driver.wait(Shell.isValueOnJsonResult(result1[1] as WebElement, "Yugoslavia"),
                explicitWait, "'Yugoslavia' is not the json result");

        });

        it("Check query result content", async () => {

            await Misc.execCmd("\\sql ");

            let result = await Misc.execCmd("SHOW DATABASES;", undefined, explicitWait * 4, true);

            await driver.wait(Shell.isValueOnDataSet(result[1] as WebElement, "sakila"),
                explicitWait, "'sakila is not on the data set'");

            await driver.wait(Shell.isValueOnDataSet(result[1] as WebElement, "mysql"),
                explicitWait, "'mysql is not on the data set'");

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
                explicitWait, "'Action is not on the json result'");

            result = await Misc.execCmd(`shell.options.resultFormat="table" `);

            expect(result[0]).to.equals("table");

            result = await Misc.execCmd("db.category.select().limit(1)");

            await driver.wait(Shell.isValueOnDataSet(result[1] as WebElement, "Action"),
                explicitWait, "'Action is not on the data set'");
        });

    });
});
