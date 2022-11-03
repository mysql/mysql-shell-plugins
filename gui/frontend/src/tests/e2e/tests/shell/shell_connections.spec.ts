/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

import { promises as fsPromises } from "fs";
import { driver, loadDriver, loadPage } from "../../lib/engine";
import { By } from "selenium-webdriver";
import {
    waitForHomePage,
    setStartLanguage,
    openShellSession,
    enterCmd,
    setDBEditorPassword,
    setConfirmDialog,
    cleanEditor,
    getShellServerTabStatus,
    IDBConnection,
    waitForShellResult,
    waitForConnectionTabValue,
    changeSchemaOnTab,
} from "../../lib/helpers";

describe("MySQL Shell Connections", () => {

    let testFailed: boolean;

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
        await loadDriver();
        try {
            await loadPage(String(process.env.SHELL_UI_HOSTNAME));
            await waitForHomePage();
        } catch (e) {
            await driver.navigate().refresh();
            await waitForHomePage();
        }
        await setStartLanguage("Shell Session", "javascript");
        await driver.findElement(By.id("gui.shell")).click();
        await openShellSession();
    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            const img = await driver.takeScreenshot();
            const testName: string = expect.getState().currentTestName
                .toLowerCase().replace(/\s/g, "_");
            try {
                await fsPromises.access("src/tests/e2e/screenshots");
            } catch(e) {
                await fsPromises.mkdir("src/tests/e2e/screenshots");
            }
            await fsPromises.writeFile(`src/tests/e2e/screenshots/${testName}_screenshot.png`, img, "base64");
        }

        const textArea = await driver.findElement(By.css("textArea"));
        await enterCmd(textArea, `\\d`);
        await driver.wait(async () => {
            return (await driver.findElements(By.css(".shellPromptItem"))).length === 1;
        }, 2000, "There are still more than 1 tab after disconnect");
        expect(await getShellServerTabStatus()).toBe("The session is not connected to a MySQL server");
        await cleanEditor();
    });

    afterAll(async () => {
        await driver.quit();
    });


    it("Connect to host", async () => {
        try {
            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            let uri = `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${globalConn.port}/${globalConn.schema}`;

            await enterCmd(
                textArea,
                uri,
            );

            let toCheck = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            toCheck += `${globalConn.port}/${globalConn.schema}'`;

            await waitForShellResult(toCheck);
            await waitForShellResult(/Server version: (\d+).(\d+).(\d+)/);
            await waitForShellResult(`Default schema set to \`${globalConn.schema}\`.`);

            toCheck = `Connection to server ${globalConn.hostname} at port ${globalConn.port}`;
            toCheck += `, using the classic protocol`;

            await waitForConnectionTabValue("server", toCheck);
            await waitForConnectionTabValue("schema", globalConn.schema);

        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connect to host without password", async () => {
        try {
            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(
                textArea,
                `\\c ${globalConn.username}@${globalConn.hostname}:${globalConn.port}/${globalConn.schema}`);

            await setDBEditorPassword(globalConn);

            await setConfirmDialog(globalConn, "no");

            let uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            uri += `${globalConn.port}/${globalConn.schema}'`;

            await waitForShellResult(uri);
            await waitForShellResult(/Server version: (\d+).(\d+).(\d+)/);
            await waitForShellResult(`Default schema set to \`${globalConn.schema}\`.`);

            let toCheck = `Connection to server ${globalConn.hostname} at port ${globalConn.port}`;
            toCheck += `, using the classic protocol`;

            await waitForConnectionTabValue("server", toCheck);
            await waitForConnectionTabValue("schema", globalConn.schema);


        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using shell global variable", async () => {
        try {
            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            let uri = `shell.connect('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}/${globalConn.schema}')`;

            await enterCmd(
                textArea,
                uri);

            uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}/${globalConn.schema}'`;

            await waitForShellResult(uri);
            await waitForShellResult(/Server version: (\d+).(\d+).(\d+)/);
            await waitForShellResult(`Default schema \`${globalConn.schema}\` accessible through db`);

            let toCheck = `Connection to server ${globalConn.hostname} at port ${String(globalConn.portX)}`;
            toCheck += `, using the X protocol`;

            await waitForConnectionTabValue("server", toCheck);
            await waitForConnectionTabValue("schema", globalConn.schema);

            await enterCmd(textArea, "shell.status()");

            await waitForShellResult(/MySQL Shell version (\d+).(\d+).(\d+)/);

            await waitForShellResult(`"CONNECTION":"${globalConn.hostname} via TCP/IP"`);

            await waitForShellResult(`"CURRENT_SCHEMA":"${globalConn.schema}"`);

            await waitForShellResult(new RegExp(`"CURRENT_USER":"${globalConn.username}`));

            await waitForShellResult(`"TCP_PORT":"${String(globalConn.portX)}"`);

        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using mysql mysqlx global variable", async () => {
        try {
            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            const cmd = `mysql.getClassicSession('${globalConn.username}:${globalConn.password}
            @${globalConn.hostname}:${globalConn.port}/${globalConn.schema}')`;

            await enterCmd(textArea, cmd.replace(/ /g,""));

            await waitForShellResult("&lt;ClassicSession&gt;");

            await enterCmd(textArea, "shell.disconnect()");

            let uri = `mysql.getSession('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${globalConn.port}/${globalConn.schema}')`;

            await enterCmd(
                textArea,
                uri);

            await waitForShellResult("&lt;ClassicSession&gt;");

            await enterCmd(textArea, "shell.disconnect()");

            uri = `mysqlx.getSession('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}/${globalConn.schema}')`;

            await enterCmd(
                textArea,
                uri);

            await waitForShellResult("&lt;Session&gt;");

        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Change schemas using menu", async () => {
        try {
            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(
                textArea,
                `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:${String(globalConn.portX)}`);

            let uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}`;

            await waitForShellResult(uri);

            await waitForShellResult("No default schema selected");

            let text = `Connection to server ${globalConn.hostname} at port ${String(globalConn.portX)}`;
            text += `, using the X protocol`;

            await waitForConnectionTabValue("server", text);
            await waitForConnectionTabValue("schema", "no schema selected");

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const schemaLabel = await driver.findElement(By.id("schema")).getText();
            expect( schemaLabel.substring(1).trim() ).toBe("no schema selected");

            await changeSchemaOnTab("world_x_cst");

            await waitForShellResult("Default schema `world_x_cst` accessible through db.");

            await changeSchemaOnTab("sakila");

            await waitForShellResult("Default schema `sakila` accessible through db.");

        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

});
