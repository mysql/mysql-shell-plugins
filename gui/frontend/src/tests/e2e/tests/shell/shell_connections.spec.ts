/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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
import { until } from "selenium-webdriver";
import { basename } from "path";
import { GuiConsole } from "../../lib/guiConsole.js";
import { Misc, explicitWait } from "../../lib/misc.js";
import * as locator from "../../lib/locators.js";
import { CommandExecutor } from "../../lib/cmdExecutor.js";
import * as constants from "../../lib/constants.js";
import * as interfaces from "../../lib/interfaces.js";
import { driver, loadDriver } from "../../lib/driver.js";

const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));

describe("MySQL Shell Connections", () => {

    let testFailed: boolean;
    let username: string | undefined;
    let password: string | undefined;
    let hostname: string | undefined;
    let schema: string | undefined;
    let port: number | undefined;
    let portX: number | undefined;

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: `ClientQA test connections`,
        description: "Local connection",
        basic: {
            hostname: String(process.env.DBHOSTNAME),
            protocol: "mysql",
            username: String(process.env.DBUSERNAMESHELL),
            port: parseInt(process.env.DBPORT!, 10),
            portX: parseInt(process.env.DBPORTX!, 10),
            schema: "sakila",
            password: String(process.env.DBPASSWORDSHELL),
        },
    };

    const commandExecutor = new CommandExecutor();

    if (interfaces.isMySQLConnection(globalConn.basic)) {
        username = globalConn.basic.username;
        password = globalConn.basic.password;
        hostname = globalConn.basic.hostname;
        schema = globalConn.basic.schema;
        port = globalConn.basic.port;
        portX = globalConn.basic.portX;
    } else {
        throw new Error("Unknown connection type");
    }

    beforeAll(async () => {
        try {
            await loadDriver();
            await driver.wait(async () => {
                try {
                    await Misc.waitForHomePage(url);

                    return true;
                } catch (e) {
                    await driver.navigate().refresh();
                }
            }, explicitWait * 4, "Home Page was not loaded");

            await driver.findElement(locator.shellPage.icon).click();
            await GuiConsole.openSession();
        } catch (e) {
            await Misc.storeScreenShot("beforeAll_ShellConnections");
            throw e;
        }
    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            await Misc.storeScreenShot();
        }
    });

    afterAll(async () => {
        await Misc.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.close();
        await driver.quit();
    });

    it("Connect to host", async () => {
        try {
            let connUri = `\\c ${username}:${password}@${hostname}:${port}/${schema}`;
            await commandExecutor.execute(connUri);
            connUri = `Creating a session to '${username}@${hostname}:${port}/${schema}'`;
            expect(commandExecutor.getResultMessage()).toMatch(new RegExp(connUri));
            expect(commandExecutor.getResultMessage()).toMatch(/Server version: (\d+).(\d+).(\d+)/);
            expect(commandExecutor.getResultMessage()).toMatch(new RegExp(`Default schema set to \`${schema}\``));

            const server = await driver.wait(until
                .elementLocated(locator.shellSession.server), constants.wait5seconds);
            const schemaEl = await driver.wait(until.elementLocated(locator.shellSession.schema),
                constants.wait5seconds);
            await driver.wait(until.elementTextContains(server, `${hostname}:${port}`),
                constants.wait5seconds, `Server tab does not contain '${hostname}:${port}'`);
            await driver.wait(until.elementTextContains(schemaEl, `${schema}`),
                constants.wait5seconds, `Schema tab does not contain '${schema}'`);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Change schemas using menu", async () => {
        try {
            await commandExecutor.changeSchemaOnTab("world_x_cst");
            expect(commandExecutor.getResultMessage()).toMatch(/Default schema set to `world_x_cst`/);
            await commandExecutor.changeSchemaOnTab("sakila");
            expect(commandExecutor.getResultMessage()).toMatch(/Default schema set to `sakila`/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connect to host without password", async () => {
        const localConn: interfaces.IDBConnection = {
            dbType: "MySQL",
            caption: `ClientQA test connections`,
            description: "Local connection",
            basic: {
                hostname: String(process.env.DBHOSTNAME),
                protocol: "mysql",
                username: "dbuser1",
                port: parseInt(String(process.env.DBPORT), 10),
                portX: parseInt(String(process.env.DBPORTX), 10),
                schema: "sakila",
                password: "dbuser1",

            },
        };

        const username = (localConn.basic as interfaces.IConnBasicMySQL).username;
        const hostname = (localConn.basic as interfaces.IConnBasicMySQL).hostname;
        const schema = (localConn.basic as interfaces.IConnBasicMySQL).schema;
        const port = (localConn.basic as interfaces.IConnBasicMySQL).port;

        try {
            await commandExecutor.deleteCredentials();
            let uri = `\\c ${username}@${hostname}:${port}/${schema}`;
            await commandExecutor.executeExpectingCredentials(uri, localConn);
            uri = `Creating a session to '${username}@${hostname}:${port}/${schema}'`;
            expect(commandExecutor.getResultMessage()).toMatch(new RegExp(uri));
            expect(commandExecutor.getResultMessage()).toMatch(/Server version: (\d+).(\d+).(\d+)/);
            expect(commandExecutor.getResultMessage()).toMatch(new RegExp(`Default schema set to \`${schema}\`.`));

            const server = await driver.wait(until.elementLocated(locator.shellSession.server),
                constants.wait5seconds, "Server tab was not found");
            const schemaEl = await driver.wait(until.elementLocated(locator.shellSession.schema),
                constants.wait5seconds, "Schema tab was not found");
            await driver.wait(until.elementTextContains(server, `${hostname}:${port}`),
                constants.wait5seconds, `Server tab does not contain '${hostname}:${port}'`);
            await driver.wait(until.elementTextContains(schemaEl, `${schema}`),
                constants.wait5seconds, `Schema tab does not contain '${schema}'`);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using shell global variable", async () => {
        try {
            await commandExecutor.execute("shell.status()", true);
            expect(commandExecutor.getResultMessage()).toMatch(/MySQL Shell version (\d+).(\d+).(\d+)/);
            let uri = `shell.connect('${username}:${password}@${hostname}:${portX}/${schema}')`;
            await commandExecutor.execute(uri, true);
            uri = `Creating a session to '${username}@${hostname}:${portX}/${schema}'`;
            expect(commandExecutor.getResultMessage()).toMatch(new RegExp(uri));
            expect(commandExecutor.getResultMessage()).toMatch(/Server version: (\d+).(\d+).(\d+)/);
            expect(commandExecutor.getResultMessage())
                .toMatch(new RegExp(`Default schema \`${schema}\` accessible through db`));

            const server = await driver.wait(until
                .elementLocated(locator.shellSession.server), constants.wait5seconds);
            const schemaEl = await driver.wait(until.elementLocated(locator.shellSession.schema),
                constants.wait5seconds);
            await driver.wait(until.elementTextContains(server, `${hostname}:${port}`),
                constants.wait5seconds, `Server tab does not contain '${hostname}:${port}'`);
            await driver.wait(until.elementTextContains(schemaEl, `${schema}`),
                constants.wait5seconds, `Schema tab does not contain '${schema}'`);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using mysql mysqlx global variable", async () => {
        try {
            let cmd = `mysql.getClassicSession('${username}:${password}@${hostname}:${port}/${schema}')`;
            await commandExecutor.execute(cmd, true);
            expect(commandExecutor.getResultMessage()).toMatch(/ClassicSession/);
            cmd = `mysqlx.getSession('${username}:${password}@${hostname}:${portX}/${schema}')`;
            await commandExecutor.execute(cmd, true);
            expect(commandExecutor.getResultMessage()).toMatch(/Session/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
