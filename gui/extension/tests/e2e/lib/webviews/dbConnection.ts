/*
 * Copyright (c) 2023, Oracle and/or its affiliates.
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
import { WebElement, By, until, Key, Condition } from "vscode-extension-tester";
import { driver, Misc } from "../misc";
import * as waitUntil from "../until";
import * as constants from "../constants";
import * as interfaces from "../interfaces";
import * as locator from "../locators";
import { DialogHelper } from "./dialogHelper";

export class DatabaseConnection {

    /**
     * Sets a Database connection data
     * @param databaseType The database type
     * @param caption The caption
     * @param description The description
     * @param basic The MySQL or SQLite basic information
     * @param ssl The SSL information
     * @param advanced The advanced information
     * @param mds The MDS information
     * @returns A promise resolving when the connection dialog is set
     */
    public static setConnection = async (
        databaseType?: string,
        caption?: string,
        description?: string,
        basic?: interfaces.IConnBasicMySQL | interfaces.IConnBasicSqlite,
        ssl?: interfaces.IConnSSL,
        advanced?: interfaces.IConnAdvanced,
        mds?: interfaces.IConnMDS,
    ): Promise<void> => {

        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const dialog = await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists),
            constants.wait25seconds, "Connection dialog was not displayed");

        if (databaseType) {
            const inDBType = await dialog.findElement(locator.dbConnectionDialog.databaseType);
            await inDBType.click();
            const popup = await driver.wait(until.elementLocated(locator.dbConnectionDialog.databaseTypeList),
                constants.wait5seconds, "Database type popup was not found");
            await popup.findElement(By.id(databaseType)).click();
        }
        if (caption) {
            await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.caption, caption);
        }
        if (description) {
            await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.description, description);
        }

        if (databaseType) {
            if (databaseType === "MySQL") {
                const mysqlData = (basic as interfaces.IConnBasicMySQL);
                if (basic) {
                    await dialog.findElement(locator.dbConnectionDialog.basicTab).click();
                    if (mysqlData.hostname) {
                        await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.mysql.basic.hostname,
                            mysqlData.hostname);
                    }
                    if (mysqlData.username) {
                        await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.mysql.basic.username,
                            mysqlData.username);
                    }
                    if (mysqlData.schema) {
                        await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.mysql.basic.defaultSchema,
                            mysqlData.schema);
                    }
                    if (mysqlData.port) {
                        await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.mysql.basic.port,
                            String(mysqlData.port));
                    }
                    if (mysqlData.ociBastion !== undefined) {
                        await DialogHelper.setCheckboxValue("useMDS", mysqlData.ociBastion);
                    }
                }
                if (ssl) {
                    await dialog.findElement(locator.dbConnectionDialog.sslTab).click();
                    if (ssl.mode) {
                        const inMode = await dialog.findElement(locator.dbConnectionDialog.mysql.ssl.mode);
                        await inMode.click();
                        const popup = await driver.findElement(locator.dbConnectionDialog.mysql.ssl.modeList);
                        await popup.findElement(By.id(ssl.mode)).click();
                    }
                    if (ssl.caPath) {
                        await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.mysql.ssl.ca, ssl.caPath);
                    }
                    if (ssl.clientCertPath) {
                        await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.mysql.ssl.cert,
                            ssl.clientCertPath);
                    }
                    if (ssl.clientKeyPath) {
                        await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.mysql.ssl.key,
                            ssl.clientKeyPath);
                    }
                }
                if (mds) {
                    await dialog.findElement(locator.dbConnectionDialog.mdsTab).click();
                    if (mds.profile) {
                        const inProfile = await dialog.findElement(locator.dbConnectionDialog.mysql.mds.profileName);
                        await inProfile.click();
                        await driver.wait(until
                            .elementLocated(locator.dbConnectionDialog.mysql.mds.profileNameList),
                            constants.wait5seconds);
                        await driver.wait(until.elementLocated(By.id(mds.profile)), constants.wait5seconds).click();
                    }
                    if (mds.dbSystemOCID) {
                        await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.mysql.mds.dbDystemId,
                            mds.dbSystemOCID);
                        await dialog.click();
                        const dbSystemName = dialog.findElement(locator.dbConnectionDialog.mysql.mds.dbDystemName);
                        await driver.wait(new Condition("", async () => {
                            return !(await dbSystemName.getAttribute("value")).includes("Loading");
                        }), constants.wait10seconds, "DB System name is still loading");
                    }
                    if (mds.bastionOCID) {
                        await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.mysql.mds.bastionId,
                            mds.bastionOCID);
                        await dialog.click();
                        const bastionName = dialog.findElement(locator.dbConnectionDialog.mysql.mds.bastionName);
                        await driver.wait(new Condition("", async () => {
                            return !(await bastionName.getAttribute("value")).includes("Loading");
                        }), constants.wait10seconds, "Bastion name is still loading");
                    }
                }
            } else if (databaseType === "Sqlite") {
                const sqliteData = (basic as interfaces.IConnBasicSqlite);
                if (basic) {
                    await dialog.findElement(locator.dbConnectionDialog.basicTab).click();
                    if (sqliteData.dbPath) {
                        await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.sqlite.basic.dbFilePath,
                            sqliteData.dbPath);
                    }
                    if (sqliteData.dbName) {
                        await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.sqlite.basic.dbName,
                            sqliteData.dbName);
                    }
                }
                if (advanced) {
                    await dialog.findElement(locator.dbConnectionDialog.advancedTab).click();
                    if (sqliteData.advanced.params) {
                        await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.sqlite.advanced.otherParams,
                            sqliteData.advanced.params);
                    }
                }
            }
        }

        await dialog.findElement(locator.dbConnectionDialog.ok).click();
    };
    /**
     * Gets a Database connection from the connection browser
     * @param name The database connection caption
     * @returns A promise resolving with the connection
     */
    public static getConnection = async (name: string): Promise<WebElement> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const db = await driver.wait(async () => {
            const hosts = await driver.findElements(locator.dbConnectionOverview.dbConnection.tile);
            for (const host of hosts) {
                try {
                    const el = await (await host
                        .findElement(locator.dbConnectionOverview.dbConnection.caption)).getText();
                    if (el === name) {
                        return host;
                    }
                } catch (e) {
                    return undefined;
                }
            }

            return undefined;
        }, constants.wait5seconds, "No DB was found");

        return db;
    };

    /**
     * Sets the database credentials on the password dialog
     * @param data The credentials
     * @param timeout The max number of time the function should wait until the connection is successful
     * @returns A promise resolving when the credentials are set
     */
    public static setCredentials = async (data: interfaces.IDBConnection,
        timeout?: number): Promise<void> => {
        await DatabaseConnection.setPassword(data);
        if (waitUntil.credentialHelperOk) {
            await DatabaseConnection.setConfirm("no", timeout);
        }
    };

    /**
     * Sets the database schema data to Heat Wave
     * @param schemas The schemas
     * @param opMode The operational mode
     * @param output The output
     * @param disableCols True to disable unsupported columnds, false otherwise
     * @param optimize True to optimze load parallelism, false otherwise
     * @param enableMemory True to enable memory check, false otherwise
     * @param sqlMode The SQL mode
     * @param exludeList The exclude list
     * @returns A promise resolving when the schema data is set
     */
    public static setDataToHeatWave = async (
        schemas?: string[],
        opMode?: string,
        output?: string,
        disableCols?: boolean,
        optimize?: boolean,
        enableMemory?: boolean,
        sqlMode?: string,
        exludeList?: string,
    ): Promise<void> => {

        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const dialog = await driver.wait(until.elementLocated(locator.hwDialog.exists),
            constants.wait5seconds, "MDS dialog was not found");
        if (schemas) {
            const schemaInput = await dialog.findElement(locator.hwDialog.schemas);
            await schemaInput.click();
            const popup = await driver.wait(until.elementLocated(locator.hwDialog.schemasList));
            for (const schema of schemas) {
                await popup.findElement(By.id(schema)).click();
            }
            await driver.actions().sendKeys(Key.ESCAPE).perform();
        }
        if (opMode) {
            const modeInput = await dialog.findElement(locator.hwDialog.mode);
            await modeInput.click();
            const popup = await driver.wait(until.elementLocated(locator.hwDialog.modeList));
            await popup.findElement(By.id(opMode)).click();
        }
        if (output) {
            const outputInput = await dialog.findElement(locator.hwDialog.output);
            await outputInput.click();
            const popup = await driver.wait(until.elementLocated(locator.hwDialog.outputList));
            await popup.findElement(By.id(output)).click();
        }
        if (disableCols) {
            const disableColsInput = await dialog.findElement(locator.hwDialog.disableUnsupportedColumns);
            await disableColsInput.click();
        }
        if (optimize) {
            const optimizeInput = await dialog.findElement(locator.hwDialog.optimizeLoadParallelism);
            await optimizeInput.click();
        }
        if (enableMemory) {
            const enableInput = await dialog.findElement(locator.hwDialog.enableMemoryCheck);
            await enableInput.click();
        }
        if (sqlMode) {
            const sqlModeInput = await dialog.findElement(locator.hwDialog.sqlMode);
            await sqlModeInput.sendKeys(sqlMode);
        }
        if (exludeList) {
            const exludeListInput = await dialog.findElement(locator.hwDialog.excludeList);
            await exludeListInput.sendKeys(exludeList);
        }

        await dialog.findElement(locator.hwDialog.ok).click();
    };

    /**
     * Sets the database connection password
     * @param dbConfig The database configuration
     * @returns A promise resolving when the password is set
     */
    private static setPassword = async (dbConfig: interfaces.IDBConnection): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const dialog = await driver.wait(until.elementLocated((locator.passwordDialog.exists)),
            constants.wait5seconds, "No password dialog was found");
        await dialog.findElement(locator.passwordDialog.password)
            .sendKeys((dbConfig.basic as interfaces.IConnBasicMySQL).password);
        await dialog.findElement(locator.passwordDialog.ok).click();
    };

    /**
     * Sets the database connection confirm dialog
     * @param value The value. (Y, N, A)
     * @param timeoutDialog The time to wait for the confirm dialog
     * @returns A promise resolving when the password is set
     */
    private static setConfirm = async (value: string,
        timeoutDialog = constants.wait10seconds): Promise<void> => {

        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const confirmDialog = await driver.wait(until.elementsLocated(locator.confirmDialog.exists),
            timeoutDialog, "No confirm dialog was found");

        const noBtn = await confirmDialog[0].findElement(locator.confirmDialog.refuse);
        const yesBtn = await confirmDialog[0].findElement(locator.confirmDialog.accept);
        const neverBtn = await confirmDialog[0].findElement(locator.confirmDialog.alternative);

        switch (value) {
            case "yes": {
                await yesBtn.click();
                break;
            }
            case "no": {
                await noBtn.click();
                break;
            }
            case "never": {
                await neverBtn.click();
                break;
            }
            default: {
                break;
            }
        }
    };
}
