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
import { Misc } from "../../lib/misc.js";
import * as locator from "../../lib/locators.js";
import * as constants from "../../lib/constants.js";
import * as interfaces from "../../lib/interfaces.js";
import { driver, loadDriver } from "../../lib/driver.js";
import { Os } from "../../lib/os.js";
import { E2EGuiConsole } from "../../lib/E2EGuiConsole.js";
import { E2EShellSession } from "../../lib/E2EShellSession.js";

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

    const guiConsole = new E2EGuiConsole();
    let session: E2EShellSession;

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
            await driver.get(url);
            await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds, "Home page was not loaded");
            await driver.findElement(locator.shellPage.icon).click();
            await guiConsole.openSession();
            session = guiConsole.sessions[0];
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
        await Os.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.close();
        await driver.quit();
    });

    it("Connect to host", async () => {
        try {
            await session.codeEditor.loadCommandResults();
            let connUri = `\\c ${username}:${password}@${hostname}:${port}/${schema}`;
            const result = await session.codeEditor.execute(connUri);
            connUri = `Creating a session to '${username}@${hostname}:${port}/${schema}'`;
            expect(result.text).toMatch(new RegExp(connUri));
            expect(result.text).toMatch(/Server version: (\d+).(\d+).(\d+)/);
            expect(result.text).toMatch(new RegExp(`Default schema set to \`${schema}\``));

            const server = await driver.wait(until
                .elementLocated(locator.shellConsole.connectionTab.server), constants.wait5seconds);
            const schemaEl = await driver.wait(until.elementLocated(locator.shellConsole.connectionTab.schema),
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
            let result = await session.changeSchema("world_x_cst");
            expect(result.text).toMatch(/Default schema set to `world_x_cst`/);
            result = await session.changeSchema("sakila");
            expect(result.text).toMatch(/Default schema set to `sakila`/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connect to host without password", async () => {
        const shellConn: interfaces.IDBConnection = {
            dbType: "MySQL",
            caption: `ClientQA test connections`,
            description: "Local connection",
            basic: {
                hostname: String(process.env.DBHOSTNAME),
                protocol: "mysql",
                username: "dbuser3",
                port: parseInt(String(process.env.DBPORT), 10),
                portX: parseInt(String(process.env.DBPORTX), 10),
                schema: "sakila",
                password: "dbuser3",

            },
        };

        const shellUsername = (shellConn.basic as interfaces.IConnBasicMySQL).username;
        const hostname = (shellConn.basic as interfaces.IConnBasicMySQL).hostname;
        const schema = (shellConn.basic as interfaces.IConnBasicMySQL).schema;
        const port = (shellConn.basic as interfaces.IConnBasicMySQL).port;

        try {
            let uri = `\\c ${shellUsername}@${hostname}:${port}/${schema}`;
            await session.codeEditor.deleteCredentials();
            const result = await session.codeEditor.executeExpectingCredentials(uri, shellConn);
            uri = `Creating a session to '${shellUsername}@${hostname}:${port}/${schema}'`;
            expect(result.text).toMatch(new RegExp(uri));
            expect(result.text).toMatch(/Server version: (\d+).(\d+).(\d+)/);
            expect(result.text).toMatch(new RegExp(`Default schema set to \`${schema}\`.`));

            const server = await driver.wait(until.elementLocated(locator.shellConsole.connectionTab.server),
                constants.wait5seconds, "Server tab was not found");
            const schemaEl = await driver.wait(until.elementLocated(locator.shellConsole.connectionTab.schema),
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
            let result = await session.codeEditor.execute("shell.status()", true);
            expect(result.text).toMatch(/MySQL Shell version (\d+).(\d+).(\d+)/);

            let uri = `shell.connect('${username}:${password}@${hostname}:${portX}/${schema}')`;
            result = await session.codeEditor.execute(uri, true);
            uri = `Creating a session to '${username}@${hostname}:${portX}/${schema}'`;
            expect(result.text).toMatch(new RegExp(uri));
            expect(result.text).toMatch(/Server version: (\d+).(\d+).(\d+)/);
            expect(result.text).toMatch(new RegExp(`Default schema \`${schema}\` accessible through db`));

            const server = await driver.wait(until
                .elementLocated(locator.shellConsole.connectionTab.server), constants.wait5seconds);
            const schemaEl = await driver.wait(until.elementLocated(locator.shellConsole.connectionTab.schema),
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
            let result = await session.codeEditor.execute(cmd, true);
            expect(result.text).toMatch(/ClassicSession/);
            cmd = `mysqlx.getSession('${username}:${password}@${hostname}:33060/${schema}')`;
            result = await session.codeEditor.execute(cmd, true);
            expect(result.text).toMatch(/Session/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
