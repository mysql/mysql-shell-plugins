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

import { WebElement, until, WebDriver } from "selenium-webdriver";
import { basename } from "path";
import { GuiConsole } from "../../lib/guiConsole.js";
import { IDBConnection, Misc, explicitWait } from "../../lib/misc.js";
import { ShellSession } from "../../lib/shellSession.js";
import * as locator from "../../lib/locators.js";

let driver: WebDriver;
const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));

jest.retryTimes(1);
describe("MySQL Shell Connections", () => {

    let testFailed: boolean;
    let editor: WebElement;

    const globalConn: IDBConnection = {
        dbType: "MySQL",
        caption: `ClientQA test connections`,
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
        driver = await Misc.loadDriver();
        try {
            await driver.wait(async () => {
                try {
                    console.log(`${basename(__filename)} : ${url}`);
                    await Misc.waitForHomePage(driver, url);

                    return true;
                } catch (e) {
                    await driver.navigate().refresh();
                }
            }, explicitWait * 4, "Home Page was not loaded");

            await driver.findElement(locator.shellPage.icon).click();
            await GuiConsole.openSession(driver);
        } catch (e) {
            await Misc.storeScreenShot(driver, "beforeAll_ShellConnections");
            throw e;
        }
    });

    beforeEach(async () => {
        editor = await driver.findElement(locator.shellSession.exists);
    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            await Misc.storeScreenShot(driver);
        }
    });

    afterAll(async () => {
        await Misc.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.quit();
    });

    it("Change schemas using menu", async () => {
        try {
            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(locator.shellSession.currentLine),
            );
            const textArea = await editor.findElement(locator.shellSession.textArea);
            await Misc.execCmd(driver,
                textArea,
                `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:${String(globalConn.port)}`);
            let uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            uri += `${String(globalConn.port)}`;
            await ShellSession.waitForResult(driver, uri);
            await ShellSession.waitForResult(driver, "No default schema selected");
            let text = `Connection to server ${globalConn.hostname} at port ${String(globalConn.port)}`;
            text += `, using the classic protocol`;
            await ShellSession.waitForConnectionTabValue(driver, "server", text);
            await ShellSession.waitForConnectionTabValue(driver, "schema", "no schema selected");
            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(locator.shellSession.currentLine),
            );

            const schemaLabel = await driver.findElement(locator.shellSession.schemaTabSelector).getText();
            expect(schemaLabel.substring(1).trim()).toBe("no schema selected");
            await ShellSession.changeSchemaOnTab(driver, "world_x_cst");
            await ShellSession.waitForResult(driver, "Default schema set to `world_x_cst`.");
            await ShellSession.changeSchemaOnTab(driver, "sakila");
            await ShellSession.waitForResult(driver, "Default schema set to `sakila`.");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connect to host", async () => {
        try {
            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(locator.shellSession.currentLine),
            );

            const textArea = await editor.findElement(locator.shellSession.textArea);
            let uri = `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${globalConn.port}/${globalConn.schema}`;
            await Misc.execCmd(driver, textArea, uri);
            let toCheck = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            toCheck += `${globalConn.port}/${globalConn.schema}'`;
            await ShellSession.waitForResult(driver, toCheck);
            await ShellSession.waitForResult(driver, /Server version: (\d+).(\d+).(\d+)/);
            await ShellSession.waitForResult(driver, `Default schema set to \`${globalConn.schema}\`.`);
            toCheck = `Connection to server ${globalConn.hostname} at port ${globalConn.port}`;
            toCheck += `, using the classic protocol`;
            await ShellSession.waitForConnectionTabValue(driver, "server", toCheck);
            await ShellSession.waitForConnectionTabValue(driver, "schema", globalConn.schema);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connect to host without password", async () => {

        try {
            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(locator.shellSession.currentLine),
            );

            const textArea = await editor.findElement(locator.shellSession.textArea);
            await Misc.execCmd(driver, textArea, "\\disconnect ");
            await Misc.execCmd(driver,
                textArea,
                `\\c ${globalConn.username}@${globalConn.hostname}/${globalConn.schema}`);
            const dialog = await driver.wait(until.elementLocated(locator.passwordDialog.exists),
                500, "No Password dialog was found");
            await dialog.findElement(locator.passwordDialog.cancel).click();

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using shell global variable", async () => {
        try {
            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(locator.shellSession.currentLine),
            );
            const textArea = await editor.findElement(locator.shellSession.textArea);
            let uri = `shell.connect('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}/${globalConn.schema}')`;
            await Misc.execCmd(driver, textArea, uri);
            uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}/${globalConn.schema}'`;
            await ShellSession.waitForResult(driver, uri);
            await ShellSession.waitForResult(driver, /Server version: (\d+).(\d+).(\d+)/);
            await ShellSession.waitForResult(driver, `Default schema \`${globalConn.schema}\` accessible through db`);
            let toCheck = `Connection to server ${globalConn.hostname} at port ${String(globalConn.portX)}`;
            toCheck += `, using the X protocol`;
            await ShellSession.waitForConnectionTabValue(driver, "server", toCheck);
            await ShellSession.waitForConnectionTabValue(driver, "schema", globalConn.schema);
            await Misc.execCmd(driver, textArea, "shell.status()");
            await ShellSession.waitForResult(driver, /MySQL Shell version (\d+).(\d+).(\d+)/);
            await ShellSession.waitForResult(driver, `"CONNECTION":"${globalConn.hostname} via TCP/IP"`);
            await ShellSession.waitForResult(driver, `"CURRENT_SCHEMA":"${globalConn.schema}"`);
            await ShellSession.waitForResult(driver, new RegExp(`"CURRENT_USER":"${globalConn.username}`));
            await ShellSession.waitForResult(driver, `"TCP_PORT":"${String(globalConn.portX)}"`);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using mysql mysqlx global variable", async () => {
        try {
            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(locator.shellSession.currentLine),
            );
            const textArea = await editor.findElement(locator.shellSession.textArea);
            const cmd = `mysql.getClassicSession('${globalConn.username}:${globalConn.password}
            @${globalConn.hostname}:${globalConn.port}/${globalConn.schema}')`;
            await Misc.execCmd(driver, textArea, cmd.replace(/ /g, ""));
            await ShellSession.waitForResult(driver, "ClassicSession");
            let uri = `mysql.getSession('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${globalConn.port}/${globalConn.schema}')`;
            await Misc.execCmd(driver,
                textArea,
                uri);
            await ShellSession.waitForResult(driver, "ClassicSession");
            uri = `mysqlx.getSession('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}/${globalConn.schema}')`;
            await Misc.execCmd(driver, textArea, uri);
            await ShellSession.waitForResult(driver, "Session");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
