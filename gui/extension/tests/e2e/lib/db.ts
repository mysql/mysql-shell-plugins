/*
 * Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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
import { driver, Misc } from "./misc";
import * as waitUntil from "./until";
import * as constants from "./constants";
import * as interfaces from "./interfaces";
import * as locator from "./locators";

export class Database {

    public static setConnection = async (
        dbType: string | undefined,
        caption: string | undefined,
        description: string | undefined,
        basic: interfaces.IConnBasicMySQL | interfaces.IConnBasicSqlite | undefined,
        ssl?: interfaces.IConnSSL,
        advanced?: interfaces.IConnAdvanced,
        mds?: interfaces.IConnMDS,
    ): Promise<void> => {

        const dialog = await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists),
            constants.wait25seconds, "Connection dialog was not displayed");

        if (dbType) {
            const inDBType = await dialog.findElement(locator.dbConnectionDialog.databaseType);
            await inDBType.click();
            const popup = await driver.wait(until.elementLocated(locator.dbConnectionDialog.databaseTypeList),
                constants.wait5seconds, "Database type popup was not found");
            await popup.findElement(By.id(dbType)).click();
        }

        if (caption) {
            const inCaption = await dialog.findElement(locator.dbConnectionDialog.caption);
            await inCaption.clear();
            await inCaption.sendKeys(caption);
        }

        if (description) {
            const inDesc = await dialog.findElement(locator.dbConnectionDialog.description);
            await inDesc.clear();
            await inDesc.sendKeys(description);
        }

        if (dbType === "MySQL") {

            if (basic) {
                await dialog.findElement(locator.dbConnectionDialog.basicTab).click();
                if ((basic as interfaces.IConnBasicMySQL).hostname) {
                    const inHostname = await dialog.findElement(locator.dbConnectionDialog.mysql.basic.hostname);
                    await inHostname.clear();
                    await inHostname.sendKeys((basic as interfaces.IConnBasicMySQL).hostname);
                }
                if ((basic as interfaces.IConnBasicMySQL).username) {
                    const inUserName = await dialog.findElement(locator.dbConnectionDialog.mysql.basic.username);
                    await inUserName.clear();
                    await inUserName.sendKeys((basic as interfaces.IConnBasicMySQL).username);
                }
                if ((basic as interfaces.IConnBasicMySQL).schema) {
                    const inSchema = await dialog.findElement(locator.dbConnectionDialog.mysql.basic.defaultSchema);
                    await inSchema.clear();
                    await inSchema.sendKeys((basic as interfaces.IConnBasicMySQL).schema);
                }
                if ((basic as interfaces.IConnBasicMySQL).port) {
                    const inPort = await dialog.findElement(locator.dbConnectionDialog.mysql.basic.port);
                    await inPort.clear();
                    await inPort.sendKeys((basic as interfaces.IConnBasicMySQL).port);
                }
                if ((basic as interfaces.IConnBasicMySQL).ociBastion !== undefined) {
                    await Database.toggleCheckBox("useMDS", (basic as interfaces.IConnBasicMySQL).ociBastion);
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
                    const inCaPath = await dialog.findElement(locator.dbConnectionDialog.mysql.ssl.ca);
                    await inCaPath.clear();
                    await inCaPath.sendKeys(ssl.caPath);
                }
                if (ssl.clientCertPath) {
                    const inClientCertPath = await dialog.findElement(locator.dbConnectionDialog.mysql.ssl.cert);
                    await inClientCertPath.clear();
                    await inClientCertPath.sendKeys(ssl.clientCertPath);
                }
                if (ssl.clientKeyPath) {
                    const inClientKeyPath = await dialog.findElement(locator.dbConnectionDialog.mysql.ssl.key);
                    await inClientKeyPath.clear();
                    await inClientKeyPath.sendKeys(ssl.clientKeyPath);
                }
            }

            if (mds) {
                await dialog.findElement(locator.dbConnectionDialog.mdsTab).click();
                if (mds.profile) {
                    const inProfile = await dialog.findElement(locator.dbConnectionDialog.mysql.mds.profileName);
                    await inProfile.click();
                    await driver.wait(until
                        .elementLocated(locator.dbConnectionDialog.mysql.mds.profileNameList), constants.wait5seconds);
                    await driver.wait(until.elementLocated(By.id(mds.profile)), constants.wait5seconds).click();
                }
                if (mds.dbSystemOCID) {
                    const inDBSystem = await dialog.findElement(locator.dbConnectionDialog.mysql.mds.dbDystemId);
                    await inDBSystem.clear();
                    await inDBSystem.sendKeys(mds.dbSystemOCID);

                    await dialog.click();
                    const dbSystemName = dialog.findElement(locator.dbConnectionDialog.mysql.mds.dbDystemName);
                    await driver.wait(new Condition("", async () => {
                        return !(await dbSystemName.getAttribute("value")).includes("Loading");
                    }), constants.wait10seconds, "DB System name is still loading");
                }
                if (mds.bastionOCID) {
                    const inDBSystem = await dialog.findElement(locator.dbConnectionDialog.mysql.mds.bastionId);
                    await inDBSystem.clear();
                    await inDBSystem.sendKeys(mds.bastionOCID);

                    await dialog.click();
                    const bastionName = dialog.findElement(locator.dbConnectionDialog.mysql.mds.bastionName);
                    await driver.wait(new Condition("", async () => {
                        return !(await bastionName.getAttribute("value")).includes("Loading");
                    }), constants.wait10seconds, "Bastion name is still loading");
                }
            }

        } else if (dbType === "Sqlite") {

            if (basic) {
                await dialog.findElement(locator.dbConnectionDialog.basicTab).click();
                if ((basic as interfaces.IConnBasicSqlite).dbPath) {
                    const inPath = await dialog.findElement(locator.dbConnectionDialog.sqlite.basic.dbFilePath);
                    await inPath.clear();
                    await inPath.sendKeys((basic as interfaces.IConnBasicSqlite).dbPath);
                }
                if ((basic as interfaces.IConnBasicSqlite).dbName) {
                    const indbName = await dialog.findElement(locator.dbConnectionDialog.sqlite.basic.dbName);
                    await indbName.clear();
                    await indbName.sendKeys((basic as interfaces.IConnBasicSqlite).dbName);
                }
            }

            if (advanced) {
                await dialog.findElement(locator.dbConnectionDialog.advancedTab).click();
                if ((basic as interfaces.IConnBasicSqlite).dbPath) {
                    const inParams = await dialog.findElement(locator.dbConnectionDialog.sqlite.advanced.otherParams);
                    await inParams.clear();
                    await inParams.sendKeys((basic as interfaces.IConnBasicSqlite).advanced.params);
                }
            }
        } else {
            throw new Error("Unknown DB Type");
        }

        await dialog.findElement(locator.dbConnectionDialog.ok).click();
    };

    public static createConnection = async (dbConfig: interfaces.IDBConnection): Promise<void> => {

        await Misc.switchBackToTopFrame();
        await Misc.clickSectionToolbarButton(await Misc.getSection(constants.dbTreeSection),
            constants.createDBConnection);
        await driver.wait(waitUntil.tabIsOpened(constants.dbDefaultEditor), constants.wait5seconds);
        await Misc.switchToFrame();
        await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists), constants.wait10seconds);

        await Database.setConnection(
            dbConfig.dbType,
            dbConfig.caption,
            dbConfig.description,
            dbConfig.basic,
            dbConfig.ssl,
            undefined,
            dbConfig.mds,
        );

        await Misc.switchBackToTopFrame();
    };

    public static getWebViewConnection = async (name: string, useFrame = true): Promise<WebElement> => {

        if (useFrame) {
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

        if (useFrame) {
            await Misc.switchBackToTopFrame();
        }

        return db;
    };

    public static setDBConnectionCredentials = async (data: interfaces.IDBConnection,
        timeout?: number): Promise<void> => {
        await Database.setPassword(data);
        if (waitUntil.credentialHelperOk) {
            await Misc.setConfirmDialog("no", timeout);
        }
    };

    public static setDataToHw = async (
        schemas?: string[],
        opMode?: string,
        output?: string,
        disableCols?: boolean,
        optimize?: boolean,
        enableMemory?: boolean,
        sqlMode?: string,
        exludeList?: string,
    ): Promise<void> => {

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

    public static toggleCheckBox = async (elId: string, checked: boolean): Promise<void> => {
        const isUnchecked = async () => {
            return (await driver.findElement(By.id(elId)).getAttribute("class")).split(" ")
                .includes("unchecked");
        };

        if (checked && (await isUnchecked())) {
            await driver.findElement(By.id(elId)).findElement(locator.checkBox.checkMark).click();
        } else {
            if (!checked && !(await isUnchecked())) {
                await driver.findElement(By.id(elId)).findElement(locator.checkBox.checkMark).click();
            }
        }
    };

    public static getCheckBoxValue = async (elId: string): Promise<boolean> => {
        const classes = (await driver.findElement(By.id(elId)).getAttribute("class")).split(" ");

        return !classes.includes("unchecked");
    };

    private static setPassword = async (dbConfig: interfaces.IDBConnection): Promise<void> => {
        const dialog = await driver.wait(until.elementLocated((locator.passwordDialog.exists)),
            constants.wait5seconds, "No password dialog was found");
        await dialog.findElement(locator.passwordDialog.password)
            .sendKeys((dbConfig.basic as interfaces.IConnBasicMySQL).password);
        await dialog.findElement(locator.passwordDialog.ok).click();
    };
}
