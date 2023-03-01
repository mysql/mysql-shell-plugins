/*
 * Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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

import { Misc, driver, IDBConnection } from "../../lib/misc";
import { By, WebElement } from "selenium-webdriver";
import { GuiConsole } from "../../lib/guiConsole";
import { ShellSession } from "../../lib/shellSession";
import { Settings } from "../../lib/settings";

describe("MySQL Shell Connections", () => {

    let testFailed: boolean;
    let editor: WebElement;

    const globalConn: IDBConnection = {
        dbType: "MySQL",
        caption: `ClientQA test`,
        description: "Local connection",
        hostname: String(process.env.DBHOSTNAME),
        protocol: "mysql",
        username: String(process.env.DBUSERNAMESHELL),
        port: String(process.env.DBPORT),
        portX: String(process.env.DBPORTX),
        schema: "sakila",
        password: String(process.env.DBPASSWORDSHELL),
        sslMode: undefined,
        sslCA: undefined,
        sslClientCert: undefined,
        sslClientKey: undefined,
    };

    beforeAll(async () => {
        await Misc.loadDriver();
        try {
            await Misc.loadPage(String(process.env.SHELL_UI_HOSTNAME));
            await Misc.waitForHomePage();
        } catch (e) {
            await driver.navigate().refresh();
            await Misc.waitForHomePage();
        }
        await Settings.setStartLanguage("Shell Session", "javascript");
        await driver.findElement(By.id("gui.shell")).click();
        await GuiConsole.openSession();
    });

    beforeEach(async () => {
        editor = await driver.findElement(By.id("shellEditorHost"));
    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            await Misc.storeScreenShot();
        }

        const textArea = await driver.findElement(By.css("textArea"));
        await Misc.execCmd(textArea, `\\d`);
        await driver.wait(async () => {
            return (await driver.findElements(By.css(".shellPromptItem"))).length === 1;
        }, 2000, "There are still more than 1 tab after disconnect");
        expect(await ShellSession.getServerTabStatus()).toBe("The session is not connected to a MySQL server");
        await Misc.cleanPrompt();
    });

    afterAll(async () => {
        await driver.quit();
    });


    it("Connect to host", async () => {
        try {

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            let uri = `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${globalConn.port}/${globalConn.schema}`;

            await Misc.execCmd(
                textArea,
                uri,
            );

            let toCheck = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            toCheck += `${globalConn.port}/${globalConn.schema}'`;

            await ShellSession.waitForResult(toCheck);
            await ShellSession.waitForResult(/Server version: (\d+).(\d+).(\d+)/);
            await ShellSession.waitForResult(`Default schema set to \`${globalConn.schema}\`.`);

            toCheck = `Connection to server ${globalConn.hostname} at port ${globalConn.port}`;
            toCheck += `, using the classic protocol`;

            await ShellSession.waitForConnectionTabValue("server", toCheck);
            await ShellSession.waitForConnectionTabValue("schema", globalConn.schema);

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connect to host without password", async () => {
        try {

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await Misc.execCmd(
                textArea,
                `\\c ${globalConn.username}@${globalConn.hostname}:${globalConn.port}/${globalConn.schema}`);

            await Misc.setPassword(globalConn);

            await Misc.setConfirmDialog(globalConn, "no");

            let uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            uri += `${globalConn.port}/${globalConn.schema}'`;

            await ShellSession.waitForResult(uri);
            await ShellSession.waitForResult(/Server version: (\d+).(\d+).(\d+)/);
            await ShellSession.waitForResult(`Default schema set to \`${globalConn.schema}\`.`);

            let toCheck = `Connection to server ${globalConn.hostname} at port ${globalConn.port}`;
            toCheck += `, using the classic protocol`;

            await ShellSession.waitForConnectionTabValue("server", toCheck);
            await ShellSession.waitForConnectionTabValue("schema", globalConn.schema);


        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using shell global variable", async () => {
        try {

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            let uri = `shell.connect('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}/${globalConn.schema}')`;

            await Misc.execCmd(
                textArea,
                uri);

            uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}/${globalConn.schema}'`;

            await ShellSession.waitForResult(uri);
            await ShellSession.waitForResult(/Server version: (\d+).(\d+).(\d+)/);
            await ShellSession.waitForResult(`Default schema \`${globalConn.schema}\` accessible through db`);

            let toCheck = `Connection to server ${globalConn.hostname} at port ${String(globalConn.portX)}`;
            toCheck += `, using the X protocol`;

            await ShellSession.waitForConnectionTabValue("server", toCheck);
            await ShellSession.waitForConnectionTabValue("schema", globalConn.schema);

            await Misc.execCmd(textArea, "shell.status()");

            await ShellSession.waitForResult(/MySQL Shell version (\d+).(\d+).(\d+)/);

            await ShellSession.waitForResult(`"CONNECTION":"${globalConn.hostname} via TCP/IP"`);

            await ShellSession.waitForResult(`"CURRENT_SCHEMA":"${globalConn.schema}"`);

            await ShellSession.waitForResult(new RegExp(`"CURRENT_USER":"${globalConn.username}`));

            await ShellSession.waitForResult(`"TCP_PORT":"${String(globalConn.portX)}"`);

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using mysql mysqlx global variable", async () => {
        try {

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            const cmd = `mysql.getClassicSession('${globalConn.username}:${globalConn.password}
            @${globalConn.hostname}:${globalConn.port}/${globalConn.schema}')`;

            await Misc.execCmd(textArea, cmd.replace(/ /g, ""));

            await ShellSession.waitForResult("ClassicSession");

            let uri = `mysql.getSession('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${globalConn.port}/${globalConn.schema}')`;

            await Misc.execCmd(
                textArea,
                uri);

            await ShellSession.waitForResult("ClassicSession");

            uri = `mysqlx.getSession('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}/${globalConn.schema}')`;

            await Misc.execCmd(
                textArea,
                uri);

            await ShellSession.waitForResult("Session");

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Change schemas using menu", async () => {
        try {

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await Misc.execCmd(
                textArea,
                `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:${String(globalConn.portX)}`);

            let uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}`;

            await ShellSession.waitForResult(uri);

            await ShellSession.waitForResult("No default schema selected");

            let text = `Connection to server ${globalConn.hostname} at port ${String(globalConn.portX)}`;
            text += `, using the X protocol`;

            await ShellSession.waitForConnectionTabValue("server", text);
            await ShellSession.waitForConnectionTabValue("schema", "no schema selected");

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const schemaLabel = await driver.findElement(By.id("schema")).getText();
            expect(schemaLabel.substring(1).trim()).toBe("no schema selected");

            await ShellSession.changeSchemaOnTab("world_x_cst");

            await ShellSession.waitForResult("Default schema `world_x_cst` accessible through db.");

            await ShellSession.changeSchemaOnTab("sakila");

            await ShellSession.waitForResult("Default schema `sakila` accessible through db.");

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
