/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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
import {
    consolesTreeSection,
    driver,
    explicitWait,
    Misc,
    isExtPrepared,
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

    before(async function () {
        try {
            if (!isExtPrepared) {
                await Misc.prepareExtension();
            }
            await Misc.initTreeSection(consolesTreeSection);
            await Misc.toggleSection(consolesTreeSection, true);
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }

    });

    after(async function () {
        try {
            await Misc.toggleSection(consolesTreeSection, false);
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

            const btn = await Misc.getSectionToolbarButton(consolesTreeSection, "Add a New MySQL Shell Console");
            await btn.click();

            await Misc.switchToWebView();

            await driver.wait(until.elementLocated(By.id("shellEditorHost")), 10000, "Console was not loaded");
            await driver.switchTo().defaultContent();

            expect(await Misc.existsTreeElement(consolesTreeSection, "Session 1") as Boolean).to.equal(true);

            await Misc.selectContextMenuItem(consolesTreeSection, "Session 1",
                "Close this MySQL Shell Console");

            expect(await Misc.existsTreeElement(consolesTreeSection, "Session 1")).to.equal(false);

        });

        it("Open MySQL Shell Console Browser", async () => {
            const btn = await Misc.getSectionToolbarButton(
                consolesTreeSection, "Open MySQL Shell Console Browser");
            await btn.click();

            await Misc.switchToWebView();

            expect(await driver.wait(until.elementLocated(By.css("#shellModuleTabview h2")),
                explicitWait, "Title was not found").getText())
                .to.equal("MySQL Shell - GUI Console");

            const newSession = await driver.findElement(By.id("-1"));
            await newSession.click();

            await driver.wait(until.elementLocated(By.id("shellEditorHost")), 10000, "Console was not loaded");
            await driver.switchTo().defaultContent();

            expect(await Misc.existsTreeElement(consolesTreeSection, "Session 1")).to.equal(true);
        });

        it("Open multiple sessions", async () => {

            const btn = await Misc.getSectionToolbarButton(consolesTreeSection, "Add a New MySQL Shell Console");

            for (let i = 1; i <= 3; i++) {
                await btn.click();
                await Misc.switchToWebView();
                await driver.wait(until.elementLocated(By.id("shellEditorHost")), 10000, "Console was not loaded");
                await driver.switchTo().defaultContent();
                expect(await Misc.existsTreeElement(consolesTreeSection, `Session ${i}`) as Boolean)
                    .to.equal(true);
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
                const btn = await Misc.getSectionToolbarButton(
                    consolesTreeSection, "Add a New MySQL Shell Console");
                await btn.click();

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

            await Misc.execCmd(`\\disconnect `);
            await driver.wait(async () => {
                const text = await Shell.getServerTabStatus();

                return text === "The session is not connected to a MySQL server";
            }, explicitWait, "Session tab text is not disconnected");

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

            expect(result[0]).to.match(/Server version: (\d+).(\d+).(\d+)/);

            expect(result[0]).to.include(
                `Default schema set to \`${globalConn.schema}\`.`,
            );

            connUri = `Connection to server ${globalConn.hostname} at port ${globalConn.port},`;
            connUri += ` using the classic protocol`;

            expect(await Shell.getServerTabStatus()).equals(connUri);

            expect(await Shell.getSchemaTabStatus()).to.include(globalConn.schema);

        });

        it("Connect to host without password", async () => {

            let uri = `\\c ${String(shellConn.username)}@${String(shellConn.hostname)}:`;
            uri += `${String(shellConn.port)}/${String(shellConn.schema)}`;

            const lastQueryInfo = await Misc.getLastCmdInfo();
            const textArea = driver.findElement(By.css("textarea"));
            await textArea.sendKeys(uri);
            await Misc.execOnEditor();

            await Database.setPassword(shellConn);

            await Misc.setConfirmDialog(shellConn, "no");

            let hasNewQueryInfo = false;
            let blocks: WebElement[] = [];
            await driver.wait(async () => {
                blocks = await driver.findElements(By.css(".zoneHost"));
                const curQueryInfo = await blocks[blocks.length - 1].getAttribute("monaco-view-zone");
                hasNewQueryInfo = curQueryInfo !== lastQueryInfo;

                return hasNewQueryInfo;
            },  explicitWait, "Could not get the command results");

            const result = await Misc.getLastCmdResult();

            uri = `Creating a session to '${String(shellConn.username)}@${String(shellConn.hostname)}:`;
            uri += `${String(shellConn.port)}/${String(shellConn.schema)}'`;

            expect(result).to.include(uri);

            expect(result).to.match(/Server version: (\d+).(\d+).(\d+)/);

            expect(result).to.include(
                `Default schema set to \`${String(shellConn.schema)}\`.`,
            );

            uri = `Connection to server ${globalConn.hostname} at port ${globalConn.port},`;
            uri += ` using the classic protocol`;

            expect(await Shell.getServerTabStatus()).equals(uri);

            expect(await Shell.getSchemaTabStatus()).to.include(globalConn.schema);

        });

        it("Connect using shell global variable", async () => {

            let uri = `shell.connect('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${globalConn.portX}/${globalConn.schema}')`;

            let result = await Misc.execCmd(uri);

            uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            uri += `${globalConn.portX}/${globalConn.schema}'`;

            expect(result[0]).to.include(uri);

            expect(result[0]).to.match(/Server version: (\d+).(\d+).(\d+)/);

            expect(result[0]).to.include(
                `Default schema \`${globalConn.schema}\` accessible through db`,
            );

            uri = `Connection to server ${globalConn.hostname} at port ${globalConn.portX},`;
            uri += ` using the X protocol`;

            expect(await Shell.getServerTabStatus()).equals(uri);

            expect(await Shell.getSchemaTabStatus())
                .to.include(globalConn.schema);

            result = await Misc.execCmd("shell.status()");

            expect(result[0]).to.match(/MySQL Shell version (\d+).(\d+).(\d+)/);

            expect(result[0]).to.include(`"CONNECTION":"${globalConn.hostname} via TCP/IP"`);

            expect(result[0]).to.include(`"CURRENT_SCHEMA":"${globalConn.schema}"`);

            expect(result[0]).to.include(`"CURRENT_USER":"${globalConn.username}@${globalConn.hostname}"`);

            expect(result[0]).to.include(`"TCP_PORT":"${globalConn.portX}"`);

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
            cmd += `${globalConn.portX}/${globalConn.schema}')`;

            result = await Misc.execCmd(cmd);

            expect(result[0]).to.include("Session");

        });

        it("Change schemas using menu", async () => {

            const result = await Misc.execCmd(
                `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:${globalConn.portX}`);

            expect(result[0]).to.include(
                `Creating a session to '${globalConn.username}@${globalConn.hostname}:${globalConn.portX}`);

            let uri = `Connection to server ${globalConn.hostname} at port ${globalConn.portX},`;
            uri += ` using the X protocol`;

            expect(await Shell.getServerTabStatus()).equals(uri);

            expect(await Shell.getSchemaTabStatus())
                .to.include("no schema selected");

            expect(result[0]).to.include("No default schema selected");

            await driver.executeScript(
                "arguments[0].click();",
                await driver.findElement(By.css(".current-line")),
            );

            const schemaLabel = await driver.findElement(By.id("schema")).getText();
            expect(schemaLabel.substring(1).trim()).equals("no schema selected");

            await Shell.changeSchemaOnTab("sakila");

            let result1 = await Misc.getLastCmdResult();

            expect(result1).to.include(`Default schema \`sakila\` accessible through db.`);

            await Shell.changeSchemaOnTab("world_x_cst");

            result1 = await Misc.getLastCmdResult();

            expect(result1).to.include(`Default schema \`world_x_cst\` accessible through db.`);

        });

    });

    describe("Sessions", () => {

        let editor: WebElement;

        before(async function () {
            try {
                const btn = await Misc.getSectionToolbarButton(
                    consolesTreeSection, "Add a New MySQL Shell Console");
                await btn.click();

                await Misc.switchToWebView();

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

                expect(await Shell.getServerTabStatus()).equals(uri);

                expect(await Shell.getSchemaTabStatus())
                    .to.include(globalConn.schema);
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

            expect(result[0]).equals("Switching to Python mode...");

            expect(await Shell.getTech(editor)).equals("python");

            result = await Misc.execCmd("\\js ");

            expect(result[0]).equals("Switching to JavaScript mode...");

            expect(await Shell.getTech(editor)).equals("javascript");

        });

        it("Using db global variable", async () => {

            const result = await Misc.execCmd("db.actor.select().limit(1)");

            expect(await Shell.isValueOnDataSet(result[1] as WebElement, "PENELOPE")).to.be.true;

        });

        it("Using util global variable", async () => {

            const result = await Misc.execCmd('util.exportTable("actor", "test.txt")');

            expect(result[0]).to.include("Running data dump using 1 thread.");
            expect(result[0]).to.match(/Total duration: (\d+)(\d+):(\d+)(\d+):(\d+)(\d+)s/);
            expect(result[0]).to.match(/Data size: (\d+).(\d+)(\d+) KB/);
            expect(result[0]).to.match(/Rows written: (\d+)/);
            expect(result[0]).to.match(/Bytes written: (\d+).(\d+)(\d+) KB/);
            expect(result[0]).to.match(/Average throughput: (\d+).(\d+)(\d+) KB/);

        });

        it("Verify collections - json format", async () => {

            await Shell.changeSchemaOnTab("world_x_cst");

            const result = await Misc.getLastCmdResult();

            expect(result).to.include(`Default schema \`world_x_cst\` accessible through db.`);

            const result1 = await Misc.execCmd("db.countryinfo.find()");

            expect(await Shell.getLangResult(result1[1] as WebElement)).equals("json");

            expect(await Shell.isValueOnJsonResult(result1[1] as WebElement,"Yugoslavia")).to.be.true;

        });

        it("Check query result content", async () => {

            await Misc.execCmd("\\sql ");

            let result = await Misc.execCmd("SHOW DATABASES;");

            expect(await Shell.isValueOnDataSet(result[1] as WebElement, "sakila")).equals(true);

            expect(await Shell.isValueOnDataSet(result[1] as WebElement, "mysql")).equals(true);

            await Misc.execCmd("\\js ");

            await Shell.changeSchemaOnTab("sakila");

            result = await Misc.execCmd(`shell.options.resultFormat="json/raw" `);

            expect(result[0]).to.equals("json/raw");

            result = await Misc.execCmd(`shell.options.showColumnTypeInfo=false `);

            expect(result[0]).to.equals("false");

            result = await Misc.execCmd(`shell.options.resultFormat="json/pretty" `);

            expect(result[0]).to.equals("json/pretty");

            result = await Misc.execCmd("db.category.select().limit(1)");

            expect(await Shell.isValueOnJsonResult(result[1] as WebElement, "Action")).to.be.true;

            result = await Misc.execCmd(`shell.options.resultFormat="table" `);

            expect(result[0]).to.equals("table");

            result = await Misc.execCmd("db.category.select().limit(1)");

            expect(await Shell.isValueOnDataSet(result[1] as WebElement, "Action")).to.be.true;

        });

    });
});
