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
import { Misc, driver, IDBConnection, explicitWait } from "../../lib/misc";
import { By, until } from "selenium-webdriver";
import { GuiConsole } from "../../lib/guiConsole";
import { ShellSession } from "../../lib/shellSession";
import { Settings } from "../../lib/settings";

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

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            await Misc.processFailure();
        }


        const result = await Misc.execCmd(`\\disconnect `);
        expect(result[0] === "" || result[0] === "Already disconnected.").toBe(true);

    });

    afterAll(async () => {
        await driver.quit();
    });


    it("Connect to host", async () => {
        try {

            let connUri = `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            connUri += `${globalConn.port}/${globalConn.schema}`;

            const result = await Misc.execCmd(connUri);

            connUri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            connUri += `${globalConn.port}/${globalConn.schema}'`;

            expect(result[0]).toContain(connUri);

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

        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connect to host without password", async () => {
        try {

            let uri = `\\c ${String(globalConn.username)}@${String(globalConn.hostname)}:`;
            uri += `${String(globalConn.port)}/${String(globalConn.schema)}`;

            const lastQueryInfo = await Misc.getLastResultBlockId();
            const textArea = driver.findElement(By.css("textarea"));
            await textArea.sendKeys(uri);
            await Misc.execOnEditor();

            await Misc.setPassword(globalConn);

            await Misc.setConfirmDialog(globalConn, "no");

            let hasNewQueryInfo = false;
            await driver.wait(async () => {
                const curQueryInfo = await Misc.getLastResultBlockId();
                hasNewQueryInfo = curQueryInfo !== lastQueryInfo;

                return hasNewQueryInfo;
            },  explicitWait, "Could not get the command results");

            const result = await Misc.getCmdResultMsg();

            uri = `Creating a session to '${String(globalConn.username)}@${String(globalConn.hostname)}:`;
            uri += `${String(globalConn.port)}/${String(globalConn.schema)}'`;

            expect(result).toContain(uri);

            await driver.wait(async () => {
                return (await Misc.getCmdResultMsg())?.match(/Server version: (\d+).(\d+).(\d+)/);
            }, explicitWait, `'/Server version: (\\d+).(\\d+).(\\d+)/' was not matched`);

            await driver.wait(async () => {
                return (await Misc.getCmdResultMsg())?.includes(`Default schema set to \`${globalConn.schema}\`.`);
            }, explicitWait, `Could not find 'Default schema set to \`${globalConn.schema}\`.'`);

            const server = await driver.findElement(By.id("server"));
            const schema = await driver.findElement(By.id("schema"));
            await driver.wait(until.elementTextContains(server, `${globalConn.hostname}:${globalConn.port}`),
                explicitWait, `Server tab does not contain '${globalConn.hostname}:${globalConn.port}'`);
            await driver.wait(until.elementTextContains(schema, `${globalConn.schema}`),
                explicitWait, `Schema tab does not contain '${globalConn.schema}'`);


        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using shell global variable", async () => {
        try {

            let uri = `shell.connect('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}/${globalConn.schema}')`;

            let result = await Misc.execCmd(uri);

            uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}/${globalConn.schema}'`;

            expect(result[0]).toContain(uri);

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

            expect(result[0]).toMatch(/MySQL Shell version (\d+).(\d+).(\d+)/);

            expect(result[0]).toContain(`"CONNECTION":"${globalConn.hostname} via TCP/IP"`);

            expect(result[0]).toContain(`"CURRENT_SCHEMA":"${globalConn.schema}"`);

            expect(result[0]).toContain(`"CURRENT_USER":"${globalConn.username}`);

            expect(result[0]).toContain(`"TCP_PORT":"${String(globalConn.portX)}"`);

        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using mysql mysqlx global variable", async () => {
        try {

            let cmd = `mysql.getClassicSession('${globalConn.username}:${globalConn.password}
                @${globalConn.hostname}:${globalConn.port}/${globalConn.schema}')`;

            let result = await Misc.execCmd(cmd.replace(/ /g, ""));

            expect(result[0]).toContain("ClassicSession");

            cmd = `mysql.getSession('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            cmd += `${globalConn.port}/${globalConn.schema}')`;

            result = await Misc.execCmd(cmd);

            expect(result[0]).toContain("ClassicSession");

            cmd = `mysqlx.getSession('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            cmd += `${String(globalConn.portX)}/${globalConn.schema}')`;

            result = await Misc.execCmd(cmd);

            expect(result[0]).toContain("Session");
        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Change schemas using menu", async () => {
        try {
            const result = await Misc.execCmd(
                `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:${String(globalConn.portX)}`);

            expect(result[0]).toContain(
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
            expect(schemaLabel.substring(1).trim()).toBe("no schema selected");

            await ShellSession.changeSchemaOnTab("sakila");

            await ShellSession.changeSchemaOnTab("world_x_cst");

        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

});
