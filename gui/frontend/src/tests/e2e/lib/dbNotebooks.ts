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

import { By, until, WebElement } from "selenium-webdriver";
import { driver, explicitWait, IDBConnection } from "./misc";

export class DBNotebooks {

    /**
     * Selects the database type on the Database Connection Configuration dialog
     *
     * @param value database type
     * @returns Promise resolving when the select is made
     */
    public static selectDBType = async (value: string): Promise<void> => {
        await driver.findElement(By.id("databaseType")).click();
        const dropDownList = await driver.findElement(By.css(".dropdownList"));
        const els = await dropDownList.findElements(By.css("div"));
        if (els.length > 0) {
            await dropDownList.findElement(By.id(value)).click();
        }
    };

    /**
     * Selects the protocol on the Database Connection Configuration dialog
     *
     * @param value protocol
     * @returns Promise resolving when the select is made
     */
    public static setProtocol = async (value: string): Promise<void> => {
        await driver.findElement(By.id("scheme")).click();
        const dropDownList = await driver.findElement(By.css(".dropdownList"));
        await dropDownList.findElement(By.id(value)).click();
    };

    /**
     * Selects the SSL Mode on the Database Connection Configuration dialog
     *
     * @param value SSL Mode
     * @returns Promise resolving when the select is made
     */
    public static setSSLMode = async (value: string): Promise<void> => {
        await driver.findElement(By.id("sslMode")).click();
        const dropDownList = await driver.findElement(By.css(".dropdownList"));
        await dropDownList.findElement(By.id(value)).click();
    };

    /**
     * Creates a new database connection, from the DB Editor main page.
     * It verifies that the Connection dialog is closed, at the end.
     *
     * @param dbConfig SSL Mode
     * @param storePassword true saves the password
     * @param clearPassword true cleares the password
     * @returns Promise resolving with the connection created
     */
    public static createDBconnection = async (dbConfig: IDBConnection,
        storePassword?: boolean, clearPassword?: boolean): Promise<WebElement | undefined> => {

        const ctx = await driver.findElement(By.css(".connectionBrowser"));
        await ctx.findElement(By.id("-1")).click();
        const newConDialog = await driver.wait(until.elementLocated(By.css(".valueEditDialog")),
            explicitWait, "Dialog was not displayed");
        await driver.wait(async () => {
            await newConDialog.findElement(By.id("caption")).clear();

            return !(await driver.executeScript("return document.querySelector('#caption').value"));
        }, 3000, "caption was not cleared in time");
        await newConDialog.findElement(By.id("caption")).sendKeys(dbConfig.caption);
        await newConDialog.findElement(By.id("description")).clear();
        await newConDialog
            .findElement(By.id("description"))
            .sendKeys(dbConfig.description);
        await newConDialog.findElement(By.id("hostName")).clear();
        await newConDialog.findElement(By.id("hostName")).sendKeys(String(dbConfig.hostname));
        await DBNotebooks.setProtocol(dbConfig.protocol);
        await driver.findElement(By.css("#port input")).clear();
        await driver.findElement(By.css("#port input")).sendKeys(String(dbConfig.port));
        await newConDialog.findElement(By.id("userName")).sendKeys(String(dbConfig.username));
        await newConDialog
            .findElement(By.id("defaultSchema"))
            .sendKeys(String(dbConfig.schema));
        if (clearPassword) {
            await newConDialog.findElement(By.id("clearPassword")).click();
            try {
                const dialog = await driver.wait(until.elementsLocated(By.css(".errorPanel")), 500, "");
                await dialog[0].findElement(By.css("button")).click();
            } catch (e) {
            //continue
            }
        }
        if (storePassword) {
            const storeBtn = await newConDialog.findElement(By.id("storePassword"));
            await storeBtn.click();
            const dialog = await driver.wait(until.elementLocated(By.css(".passwordDialog")),
                2000, "No password dialog was found");
            await dialog.findElement(By.css("input")).sendKeys(String(dbConfig.password));
            await dialog.findElement(By.id("ok")).click();
        }

        if (dbConfig.dbType) {
            await DBNotebooks.selectDBType(dbConfig.dbType);
        }

        if (dbConfig.sslMode) {
            await newConDialog.findElement(By.id("page1")).click();
            await newConDialog.findElement(By.id("sslMode")).click();
            const dropDownList = await driver.findElement(By.css(".noArrow.dropdownList"));
            await dropDownList.findElement(By.id(dbConfig.sslMode)).click();
            expect(await newConDialog.findElement(By.css("#sslMode label")).getText())
                .toBe(dbConfig.sslMode);

            const certsPath = process.env.SSLCERTSPATH as string;
            const paths = await newConDialog.findElements(By.css(".tabview.top input.msg"));
            await paths[0].sendKeys(`${certsPath}/ca-cert.pem`);
            await paths[1].sendKeys(`${certsPath}/client-cert.pem`);
            await paths[2].sendKeys(`${certsPath}/client-key.pem`);
        }

        const okBtn = await driver.findElement(By.id("ok"));
        await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
        await okBtn.click();
        expect((await driver.findElements(By.css(".valueEditDialog"))).length).toBe(0);

        return driver.wait(async () => {
            const connections = await driver.findElements(By.css("#tilesHost button"));
            for (const connection of connections) {
                const el = await connection.findElement(By.css(".textHost .tileCaption"));
                if ((await el.getAttribute("innerHTML")).includes(dbConfig.caption)) {
                    return connection;
                }
            }
        }, explicitWait, `'${dbConfig.caption}' was not created`);
    };

    /**
     * Returns the WebElement that represents the DB Connection, on the DB Connection main page
     * Throws an exception if not found.
     *
     * @param name Connection caption
     * @returns @returns Promise resolving with the DB Connection
     */
    public static getConnection = async (name: string): Promise<WebElement | undefined> => {

        return driver.wait(async () => {
            const connections = await driver.findElements(By.css("#tilesHost button"));
            for (const connection of connections) {
                const el = await connection.findElement(By.css(".textHost .tileCaption"));
                if ((await el.getAttribute("innerHTML")).includes(name)) {
                    return connection;
                }
            }
        }, 1500, "Could not find any connection");

    };

    /**
     * Checks if the Db Type drop down list is stale, on the Connections dialog
     * Because of the tests speed, sometimes we need to reload the dialog
     *
     * @returns A promise resolving when the init is made
     */
    public static initConDialog = async (): Promise<void> => {

        const connBrowser = await driver.wait(until.elementLocated(By.css(".connectionBrowser")),
            explicitWait, "Connection browser was not found");

        await connBrowser.findElement(By.id("-1")).click();

        const dialog = driver.findElement(By.css(".valueEditDialog"));
        await dialog.findElement(By.id("cancel")).click();
        await driver.wait(until.stalenessOf(dialog), 2000, "Connection dialog is still displayed");
        await driver.findElement(By.id("gui.shell")).click();
        await driver.findElement(By.id("gui.sqleditor")).click();
    };

}
