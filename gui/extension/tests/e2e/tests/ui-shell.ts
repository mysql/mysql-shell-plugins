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

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

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

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

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

        let editor: WebElement;
        let textArea: WebElement;

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

                const editors = await new EditorView().getOpenEditorTitles();
                expect(editors).to.include.members(["MySQL Shell Consoles"]);

                await Misc.switchToWebView();

                editor = await driver.wait(until.elementLocated(By.id("shellEditorHost")),
                    10000, "Console was not loaded");

                textArea = await driver.findElement(By.css("textArea"));

            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            await Misc.execCmd(textArea, `\\d`);
            await driver.wait(async () => {
                const text = await Shell.getServerTabStatus();

                return text === "The session is not connected to a MySQL server";
            }, explicitWait, "Session tab text is not disconnected");

            await Misc.cleanEditor();
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

            await Misc.execCmd(textArea, connUri);

            const result = await Shell.getResult();

            connUri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            connUri += `${globalConn.port}/${globalConn.schema}'`;

            expect(result).to.include(connUri);

            expect(result).to.match(/Server version: (\d+).(\d+).(\d+)/);

            expect(result).to.include(
                `Default schema set to \`${globalConn.schema}\`.`,
            );

            connUri = `Connection to server ${globalConn.hostname} at port ${globalConn.port},`;
            connUri += ` using the classic protocol`;

            expect(await Shell.getServerTabStatus()).equals(connUri);

            expect(await Shell.getSchemaTabStatus())
                .to.include(globalConn.schema);

        });

        it("Connect to host without password", async () => {

            let uri = `\\c ${String(shellConn.username)}@${String(shellConn.hostname)}:`;
            uri += `${String(shellConn.port)}/${String(shellConn.schema)}`;

            await Misc.execCmd(

                textArea,
                uri);

            await Database.setPassword(shellConn);

            await Misc.setConfirmDialog(shellConn, "no");

            const result = await Shell.getResult();

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

            await Misc.execCmd(textArea, uri);

            let result = await Shell.getResult();

            uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            uri += `${globalConn.portX}/${globalConn.schema}'`;

            expect(result).to.include(uri);

            expect(result).to.match(/Server version: (\d+).(\d+).(\d+)/);

            expect(result).to.include(
                `Default schema \`${globalConn.schema}\` accessible through db`,
            );

            uri = `Connection to server ${globalConn.hostname} at port ${globalConn.portX},`;
            uri += ` using the X protocol`;

            expect(await Shell.getServerTabStatus()).equals(uri);

            expect(await Shell.getSchemaTabStatus())
                .to.include(globalConn.schema);

            await Misc.execCmd(textArea, "shell.status()");

            result = await Shell.getResult();

            expect(result).to.match(/MySQL Shell version (\d+).(\d+).(\d+)/);

            expect(result).to.include(`"CONNECTION":"${globalConn.hostname} via TCP/IP"`);

            expect(result).to.include(`"CURRENT_SCHEMA":"${globalConn.schema}"`);

            expect(result).to.include(`"CURRENT_USER":"${globalConn.username}@${globalConn.hostname}"`);

            expect(result).to.include(`"TCP_PORT":"${globalConn.portX}"`);

        });

        it("Connect using mysql mysqlx global variable", async () => {

            let cmd = `mysql.getClassicSession('${globalConn.username}:${globalConn.password}
                @${globalConn.hostname}:${globalConn.port}/${globalConn.schema}')`;

            await Misc.execCmd(textArea, cmd.replace(/ /g, ""));

            let result = await Shell.getResult();

            expect(result).to.include("&lt;ClassicSession&gt;");

            await Misc.execCmd(textArea, "shell.disconnect()");

            result = await Shell.getResult();

            cmd = `mysql.getSession('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            cmd += `${globalConn.port}/${globalConn.schema}')`;

            await Misc.execCmd(textArea, cmd);

            result = await Shell.getResult();

            expect(result).to.include("&lt;ClassicSession&gt;");

            await Misc.execCmd(textArea, "shell.disconnect()");

            cmd = `mysqlx.getSession('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            cmd += `${globalConn.portX}/${globalConn.schema}')`;

            await Misc.execCmd(textArea, cmd);

            result = await Shell.getResult();

            expect(result).to.include("&lt;Session&gt;");

        });

        it("Change schemas using menu", async () => {

            await Misc.execCmd(
                textArea,
                `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:${globalConn.portX}`);

            let result = await Shell.getResult();

            expect(result).to.include(
                `Creating a session to '${globalConn.username}@${globalConn.hostname}:${globalConn.portX}`);

            let uri = `Connection to server ${globalConn.hostname} at port ${globalConn.portX},`;
            uri += ` using the X protocol`;

            expect(await Shell.getServerTabStatus()).equals(uri);

            expect(await Shell.getSchemaTabStatus())
                .to.include("no schema selected");

            expect(result).to.include("No default schema selected");

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const schemaLabel = await driver.findElement(By.id("schema")).getText();
            expect(schemaLabel.substring(1).trim()).equals("no schema selected");

            await Shell.changeSchemaOnTab("sakila");

            result = await Shell.getResult();

            expect(result).to.include(`Default schema \`sakila\` accessible through db.`);

            await Shell.changeSchemaOnTab("world_x_cst");

            result = await Shell.getResult();

            expect(result).to.include(`Default schema \`world_x_cst\` accessible through db.`);

        });

    });

    describe("Sessions", () => {

        let editor: WebElement;

        let textArea: WebElement;

        before(async function () {
            try {
                const btn = await Misc.getSectionToolbarButton(
                    consolesTreeSection, "Add a New MySQL Shell Console");
                await btn.click();

                const editors = await new EditorView().getOpenEditorTitles();
                expect(editors).to.include.members(["MySQL Shell Consoles"]);

                await Misc.switchToWebView();

                editor = await driver.wait(until.elementLocated(By.id("shellEditorHost")),
                    10000, "Console was not loaded");

                await driver.executeScript(
                    "arguments[0].click();",
                    await editor.findElement(By.css(".current-line")),
                );

                textArea = await editor.findElement(By.css("textArea"));

                let uri = `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
                uri += `${globalConn.portX}/${globalConn.schema}`;

                await Misc.execCmd(textArea, uri);

                const result = await Shell.getResult();

                uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
                uri += `${globalConn.portX}/${globalConn.schema}'`;

                expect(result).to.include(uri);

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

            await Misc.cleanEditor();
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

            await Misc.execCmd(textArea, "\\h");

            const result = await Shell.getResult();

            expect(result).to.include(
                "The Shell Help is organized in categories and topics.",
            );

            expect(result).to.include("SHELL COMMANDS");
            expect(result).to.include("\\connect");
            expect(result).to.include("\\disconnect");
            expect(result).to.include("\\edit");
            expect(result).to.include("\\exit");
            expect(result).to.include("\\help");
            expect(result).to.include("\\history");
            expect(result).to.include("\\js");
            expect(result).to.include("\\nopager");
            expect(result).to.include("\\nowarnings");
            expect(result).to.include("\\option");
            expect(result).to.include("\\pager");
            expect(result).to.include("\\py");
            expect(result).to.include("\\quit");
            expect(result).to.include("\\reconnect");
            expect(result).to.include("\\rehash");
            expect(result).to.include("\\show");
            expect(result).to.include("\\source");
            expect(result).to.include("\\sql");
            expect(result).to.include("\\status");
            expect(result).to.include("\\system");
            expect(result).to.include("\\use");
            expect(result).to.include("\\warning");
            expect(result).to.include("\\watch");


        });

        it("Switch session language - javascript python", async () => {

            await Misc.execCmd(textArea, "\\py");

            let result = await Shell.getResult();

            expect(result).equals("Switching to Python mode...");

            expect(await Shell.getTech(editor)).equals("python");

            await Misc.execCmd(textArea, "\\js");

            result = await Shell.getResult();

            expect(result).equals("Switching to JavaScript mode...");

            expect(await Shell.getTech(editor)).equals("javascript");

        });

        it("Using db global variable", async () => {

            await Misc.execCmd(textArea, "db.actor.select().limit(1)");

            expect(await driver.wait(async () => {
                return Shell.isValueOnDataSet("PENELOPE");
            }, explicitWait, "'PENELOPE is not on the data set'")).to.be.true;

            expect(await Shell.getTotalRows()).to.match(/(\d+) row in set/);

        });

        it("Using util global variable", async () => {

            await Misc.execCmd(textArea, 'util.exportTable("actor", "test.txt")');

            await driver.wait(
                async () => {
                    return (
                        (await Shell.getResult()).indexOf(
                            "The dump can be loaded using",
                        ) !== -1
                    );
                },
                10000,
                "Export operation was not done in time",
            );

            const result = await Shell.getResult();
            expect(result).to.include("Running data dump using 1 thread.");
            expect(result).to.match(/Total duration: (\d+)(\d+):(\d+)(\d+):(\d+)(\d+)s/);
            expect(result).to.match(/Data size: (\d+).(\d+)(\d+) KB/);
            expect(result).to.match(/Rows written: (\d+)/);
            expect(result).to.match(/Bytes written: (\d+).(\d+)(\d+) KB/);
            expect(result).to.match(/Average throughput: (\d+).(\d+)(\d+) KB/);

        });

        it("Verify collections - json format", async () => {

            await Shell.changeSchemaOnTab("world_x_cst");

            const result = await Shell.getResult();

            expect(result).to.include(`Default schema \`world_x_cst\` accessible through db.`);

            await Misc.execCmd(textArea, "db.countryinfo.find()");

            expect(await Shell.getLangResult()).equals("json");

            expect(await Shell.isValueOnJsonResult("Yugoslavia")).to.be.true;

        });

        it("Check query result content", async () => {

            await Misc.execCmd(textArea, "\\sql");

            await Misc.execCmd(textArea, "SHOW DATABASES;");

            expect(await Shell.isValueOnDataSet("sakila")).equals(true);

            expect(await Shell.isValueOnDataSet("mysql")).equals(true);

            await Misc.execCmd(textArea, "\\js");

            await Shell.changeSchemaOnTab("sakila");

            await Misc.execCmd(textArea, `shell.options.resultFormat="json/raw" `);

            expect(await Shell.getResult()).to.equals("json/raw");

            await Misc.execCmd(textArea, `shell.options.showColumnTypeInfo=false `);

            expect(await Shell.getResult()).to.equals("false");

            await Misc.execCmd(textArea, `shell.options.resultFormat="json/pretty" `);

            expect(await Shell.getResult()).to.equals("json/pretty");

            await Misc.execCmd(textArea, "db.category.select().limit(1)");

            const result = await Shell.getResult();

            expect(result).to.include(`"rows": [`);

            expect(result).to.include(`"name": "Action"`);

            await Misc.execCmd(textArea, `shell.options.resultFormat="table" `);

            expect(await Shell.getResult()).to.equals("table");

            await Misc.execCmd(textArea, "db.category.select().limit(1)");

            expect(await driver.wait(async () => {
                return Shell.isValueOnDataSet("Action");
            }, explicitWait, "'Action is not on the data set'")).to.be.true;
        });

    });
});
