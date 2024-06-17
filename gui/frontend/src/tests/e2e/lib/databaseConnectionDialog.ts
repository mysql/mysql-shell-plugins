/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

import { until, By, WebElement, Condition, error } from "selenium-webdriver";
import * as locator from "./locators.js";
import * as constants from "./constants.js";
import { driver } from "./driver.js";
import * as interfaces from "./interfaces.js";
import { DialogHelper } from "./dialogHelper.js";
import { DatabaseConnectionOverview } from "./databaseConnectionOverview.js";
import { Misc } from "./misc.js";

export class DatabaseConnectionDialog {

    /**
     * Sets a Database connection data
     * @param dbConfig The database config object
     * @returns A promise resolving when the connection dialog is set
     */
    public static setConnection = async (dbConfig: interfaces.IDBConnection): Promise<void> => {
        const dialog = await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists),
            constants.wait5seconds, "Connection dialog was not displayed");
        if (dbConfig.dbType) {
            const inDBType = await dialog.findElement(locator.dbConnectionDialog.databaseType);
            await inDBType.click();
            const popup = await driver.wait(until.elementLocated(locator.dbConnectionDialog.databaseTypeList),
                constants.wait5seconds, "Database type popup was not found");
            await popup.findElement(By.id(dbConfig.dbType)).click();
        }

        if (dbConfig.caption) {
            await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.caption, dbConfig.caption);
        }

        if (dbConfig.description) {
            await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.description, dbConfig.description);
        }

        if (dbConfig.dbType) {

            if (dbConfig.dbType === "MySQL") {

                if (interfaces.isMySQLConnection(dbConfig.basic)) {
                    await DialogHelper.selectTab(constants.basicTab);
                    if (dbConfig.basic.hostname) {
                        await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.mysql.basic.hostname,
                            dbConfig.basic.hostname);
                    }

                    if (dbConfig.basic.username) {
                        await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.mysql.basic.username,
                            dbConfig.basic.username);
                    }

                    if (dbConfig.basic.schema) {
                        await DialogHelper
                            .setFieldText(dialog, locator.dbConnectionDialog.mysql.basic.defaultSchema,
                                dbConfig.basic.schema);
                    }

                    if (dbConfig.basic.port) {
                        await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.mysql.basic.port,
                            String(dbConfig.basic.port));
                    }

                    if (dbConfig.basic.protocol) {
                        await dialog.findElement(locator.dbConnectionDialog.mysql.basic.protocol).click();
                        const list = await driver.wait(until.elementLocated(locator.dbConnectionDialog.mysql.basic
                            .protocolList), constants.wait5seconds, "Protocol list was not displayed");
                        await list.findElement(By.id(dbConfig.basic.protocol)).click();
                    }

                    if (dbConfig.basic.sshTunnel !== undefined) {
                        await DialogHelper.setCheckboxValue("useSSH", dbConfig.basic.sshTunnel);
                    }

                    if (dbConfig.basic.ociBastion !== undefined) {
                        await DialogHelper.setCheckboxValue("useMDS", dbConfig.basic.ociBastion);
                    }

                    if (dbConfig.ssl) {
                        await DialogHelper.selectTab(constants.sslTab);
                        if (dbConfig.ssl.mode) {
                            const inMode = await dialog.findElement(locator.dbConnectionDialog.mysql.ssl.mode);
                            await inMode.click();
                            const popup = await driver.findElement(locator.dbConnectionDialog.mysql.ssl.modeList);
                            await popup.findElement(By.id(dbConfig.ssl.mode)).click();
                        }

                        if (dbConfig.ssl.ciphers) {
                            await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.mysql.ssl.ciphers,
                                dbConfig.ssl.ciphers);
                        }

                        if (dbConfig.ssl.caPath) {
                            await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.mysql.ssl.ca,
                                dbConfig.ssl.caPath);
                        }

                        if (dbConfig.ssl.clientCertPath) {
                            await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.mysql.ssl.cert,
                                dbConfig.ssl.clientCertPath);
                        }

                        if (dbConfig.ssl.clientKeyPath) {
                            await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.mysql.ssl.key,
                                dbConfig.ssl.clientKeyPath);
                        }
                    }

                    if (dbConfig.advanced) {
                        await DialogHelper.selectTab(constants.advancedTab);

                        if (interfaces.isAdvancedMySQL(dbConfig.advanced)) {
                            if (dbConfig.advanced.mode) {
                                const getModeItem = async (name: string): Promise<WebElement | undefined> => {
                                    let mode: WebElement | undefined;
                                    await driver.wait(async () => {
                                        try {
                                            const modeItems = await driver.wait(until
                                                .elementsLocated(locator.dbConnectionDialog.mysql
                                                    .advanced.sqlModeItem), constants.wait5seconds);
                                            for (const item of modeItems) {
                                                if ((await item.getText()).toLowerCase().replace(/_/g, "") ===
                                                    name.toLowerCase().replace(/_/g, "")) {
                                                    mode = item;

                                                    return true;
                                                }
                                            }
                                        } catch (e) {
                                            if (!(e instanceof error.StaleElementReferenceError)) {
                                                throw e;
                                            }
                                        }
                                    }, constants.wait5seconds, `Could not get the mode ${name}`);

                                    return mode;
                                };

                                const modes = Object.keys(dbConfig.advanced.mode);
                                for (const mode of modes) {
                                    await DialogHelper.setCheckboxValue(await getModeItem(mode) as WebElement,
                                        dbConfig.advanced.mode[mode as keyof typeof dbConfig.advanced.mode]);
                                }
                            }

                            if (dbConfig.advanced.timeout) {
                                await DialogHelper.setFieldText(dialog,
                                    locator.dbConnectionDialog.mysql.advanced.connectionTimeout,
                                    dbConfig.advanced.timeout);
                            }

                            if (dbConfig.advanced.compression) {
                                await dialog.findElement(locator.dbConnectionDialog.mysql.advanced.compression).click();
                                const list = await driver
                                    .wait(until.elementLocated(locator.dbConnectionDialog.mysql.advanced
                                        .compressionPopup), constants.wait5seconds,
                                        "Compression list was not displayed");
                                await list.findElement(By.id(dbConfig.advanced.compression)).click();
                            }

                            if (dbConfig.advanced.compressionLevel) {
                                await DialogHelper.setFieldText(dialog,
                                    locator.dbConnectionDialog.mysql.advanced.compressionLevel,
                                    dbConfig.advanced.compressionLevel);
                            }

                            if (dbConfig.advanced.disableHeatWave) {
                                await DialogHelper.setCheckboxValue("disableHeatwaveCheck",
                                    dbConfig.advanced.disableHeatWave);
                            }
                        } else {
                            throw new Error("Please define the 'mode' field for the advanced section");
                        }
                    }

                    if (dbConfig.basic.sshTunnel === true && dbConfig.ssh) {
                        await DialogHelper.selectTab(constants.sshTab);
                        if (dbConfig.ssh.uri) {
                            await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.mysql.ssh.uri,
                                dbConfig.ssh.uri);
                        }

                        if (dbConfig.ssh.privateKey) {
                            await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.mysql.ssh.privateKey,
                                dbConfig.ssh.privateKey);
                        }

                        if (dbConfig.ssh.customPath) {
                            await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.mysql.ssh.customPath,
                                dbConfig.ssh.customPath);
                        }
                    }

                    if (dbConfig.mds) {
                        await DialogHelper.selectTab(constants.mdsTab);

                        if (dbConfig.mds.profile) {
                            const inProfile = await dialog.findElement(locator.dbConnectionDialog.mysql
                                .mds.profileName);
                            await inProfile.click();
                            await driver.wait(until
                                .elementLocated(locator.dbConnectionDialog.mysql.mds.profileNameList),
                                constants.wait5seconds);
                            await driver.wait(until.elementLocated(By.id(dbConfig.mds.profile)),
                                constants.wait5seconds).click();
                        }

                        if (dbConfig.mds.sshPrivateKey) {
                            await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.mysql.mds.sshPrivateKey,
                                dbConfig.mds.sshPrivateKey);
                        }

                        if (dbConfig.mds.sshPublicKey) {
                            await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.mysql.mds.sshPublicKey,
                                dbConfig.mds.sshPublicKey);
                        }

                        if (dbConfig.mds.dbSystemOCID) {
                            await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.mysql.mds.dbSystemId,
                                dbConfig.mds.dbSystemOCID);
                            await dialog.click();
                            const dbSystemName = dialog.findElement(locator.dbConnectionDialog.mysql.mds.dbSystemName);
                            await driver.wait(new Condition("", async () => {
                                return !(await dbSystemName.getAttribute("value")).includes("Loading");
                            }), constants.wait10seconds, "DB System name is still loading");
                        }

                        if (dbConfig.mds.bastionOCID) {
                            await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.mysql.mds.bastionId,
                                dbConfig.mds.bastionOCID);
                            await dialog.click();
                            const bastionName = dialog.findElement(locator.dbConnectionDialog.mysql.mds.bastionName);
                            await driver.wait(new Condition("", async () => {
                                return !(await bastionName.getAttribute("value")).includes("Loading");
                            }), constants.wait10seconds, "Bastion name is still loading");
                        }

                    }
                } else {
                    throw new Error("Please define the 'hostname' field for the basic section");
                }

            } else if (dbConfig.dbType === "Sqlite") {
                const sqliteData = (dbConfig.basic as interfaces.IConnBasicSqlite);

                if (dbConfig.basic) {
                    await DialogHelper.selectTab(constants.basicTab);
                    if (sqliteData.dbPath) {
                        await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.sqlite.basic.dbFilePath,
                            sqliteData.dbPath);
                    }
                    if (sqliteData.dbName) {
                        await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.sqlite.basic.dbName,
                            sqliteData.dbName);
                    }
                }

                if (dbConfig.advanced) {
                    await DialogHelper.selectTab(constants.advancedTab);
                    if (interfaces.isAdvancedSqlite(dbConfig.advanced)) {
                        if ((dbConfig.advanced)) {
                            await DialogHelper.setFieldText(dialog,
                                locator.dbConnectionDialog.sqlite.advanced.otherParams,
                                dbConfig.advanced.params!);
                        }
                    } else {
                        throw new Error("Please define the params object field");
                    }
                }

            }
        } else {
            throw new Error("Could not find the database type on the db object");
        }

        await dialog.findElement(locator.dbConnectionDialog.ok).click();
    };

    /**
     * Gets a Database connection details by opening the connection dialog
     * @param name The database connection caption
     * @returns A promise resolving with the connection details
     */
    public static getConnectionDetails = async (name: string): Promise<interfaces.IDBConnection> => {
        await DatabaseConnectionOverview.moreActions(name, constants.editConnection);
        const dialog = await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists),
            constants.wait5seconds, "Connection dialog was not displayed");
        const dbConnection: interfaces.IDBConnection = {
            dbType: await dialog.findElement(locator.dbConnectionDialog.databaseType).findElement(locator.htmlTag.label)
                .getText(),
            caption: await DialogHelper.getFieldValue(dialog, locator.dbConnectionDialog.caption),
            description: await DialogHelper.getFieldValue(dialog, locator.dbConnectionDialog.description),
        };

        if (dbConnection.dbType === "MySQL") {
            const basic: interfaces.IConnBasicMySQL = {
                hostname: await DialogHelper.getFieldValue(dialog, locator.dbConnectionDialog.mysql.basic.hostname),
                username: await DialogHelper.getFieldValue(dialog, locator.dbConnectionDialog.mysql.basic.username),
                schema: await DialogHelper.getFieldValue(dialog, locator.dbConnectionDialog.mysql.basic.defaultSchema),
                protocol: await dialog.findElement(locator.dbConnectionDialog.mysql.basic.protocol)
                    .findElement(locator.htmlTag.label).getText(),
                port: parseInt(await DialogHelper.getFieldValue(dialog, locator.dbConnectionDialog.mysql.basic.port)
                    , 10),
                sshTunnel: await DialogHelper.getCheckBoxValue("useSSH"),
                ociBastion: await DialogHelper.getCheckBoxValue("useMDS"),
            };
            dbConnection.basic = basic;
            await DialogHelper.selectTab(constants.sslTab);
            const ssl: interfaces.IConnSSL = {
                mode: await dialog.findElement(locator.dbConnectionDialog.mysql.ssl.mode)
                    .findElement(locator.htmlTag.label).getText(),
                ciphers: await DialogHelper.getFieldValue(dialog, locator.dbConnectionDialog.mysql.ssl.ciphers),
                caPath: await DialogHelper.getFieldValue(dialog, locator.dbConnectionDialog.mysql.ssl.ca),
                clientCertPath: await DialogHelper.getFieldValue(dialog, locator.dbConnectionDialog.mysql.ssl.cert),
                clientKeyPath: await DialogHelper.getFieldValue(dialog, locator.dbConnectionDialog.mysql.ssl.key),
            };
            dbConnection.ssl = ssl;
            await DialogHelper.selectTab(constants.advancedTab);
            const getModeItem = async (name: string): Promise<WebElement | undefined> => {
                let itemToReturn: WebElement | undefined;
                await driver.wait(async () => {
                    try {
                        const modeItems = await driver.findElements(locator.dbConnectionDialog.mysql
                            .advanced.sqlModeItem);
                        if (modeItems.length > 0) {

                            for (const item of modeItems) {
                                if ((await item.getText() === name)) {
                                    await item.getAttribute("class");
                                    itemToReturn = item;
                                    await itemToReturn.getAttribute("class"); // test if its stale

                                    return true;
                                }
                            }

                        }

                    } catch (e) {
                        if (!(e instanceof error.StaleElementReferenceError)) {
                            throw e;
                        }
                    }
                }, constants.wait5seconds, "The items were always stale");

                return itemToReturn;
            };
            const advanced: interfaces.IConnAdvancedMySQL = {
                mode: {
                    ansi: await DialogHelper.getCheckBoxValue(await getModeItem("ANSI") as WebElement),
                    traditional: await DialogHelper.getCheckBoxValue(await getModeItem("TRADITIONAL") as WebElement),
                    allowInvalidDates: await DialogHelper
                        .getCheckBoxValue(await getModeItem("ALLOW_INVALID_DATES") as WebElement),
                    ansiQuotes: await DialogHelper.getCheckBoxValue(await getModeItem("ANSI_QUOTES") as WebElement),
                    errorForDivisionByZero: await DialogHelper
                        .getCheckBoxValue(await getModeItem("ERROR_FOR_DIVISION_BY_ZERO") as WebElement),
                    highNotPrecedence: await DialogHelper
                        .getCheckBoxValue(await getModeItem("HIGH_NOT_PRECEDENCE") as WebElement),
                    ignoreSpace: await DialogHelper.getCheckBoxValue(await getModeItem("IGNORE_SPACE") as WebElement),
                    noAutoValueOnZero: await DialogHelper
                        .getCheckBoxValue(await getModeItem("NO_AUTO_VALUE_ON_ZERO") as WebElement),
                    noUnsignedSubtraction: await DialogHelper
                        .getCheckBoxValue(await getModeItem("NO_UNSIGNED_SUBTRACTION") as WebElement),
                    noZeroDate: await DialogHelper.getCheckBoxValue(await getModeItem("NO_ZERO_DATE") as WebElement),
                    noZeroInDate: await DialogHelper
                        .getCheckBoxValue(await getModeItem("NO_ZERO_IN_DATE") as WebElement),
                    onlyFullGroupBy: await DialogHelper
                        .getCheckBoxValue(await getModeItem("ONLY_FULL_GROUP_BY") as WebElement),
                    padCharToFullLength: await DialogHelper
                        .getCheckBoxValue(await getModeItem("PAD_CHAR_TO_FULL_LENGTH") as WebElement),
                    pipesAsConcat: await DialogHelper
                        .getCheckBoxValue(await getModeItem("PIPES_AS_CONCAT") as WebElement),
                    realAsFloat: await DialogHelper.getCheckBoxValue(await getModeItem("REAL_AS_FLOAT") as WebElement),
                    strictAllTables: await DialogHelper
                        .getCheckBoxValue(await getModeItem("STRICT_ALL_TABLES") as WebElement),
                    strictTransTables: await DialogHelper
                        .getCheckBoxValue(await getModeItem("STRICT_TRANS_TABLES") as WebElement),
                    timeTruncateFractional: await DialogHelper
                        .getCheckBoxValue(await getModeItem("TIME_TRUNCATE_FRACTIONAL") as WebElement),
                },
                timeout: await DialogHelper.getFieldValue(dialog,
                    locator.dbConnectionDialog.mysql.advanced.connectionTimeout),
                compression: await dialog
                    .findElement(locator.dbConnectionDialog.mysql.advanced.compression)
                    .findElement(locator.htmlTag.label)
                    .then((el) => {
                        return el.getText();
                    })
                    .catch(() => {
                        return undefined;
                    }),
                compressionLevel: await DialogHelper.getFieldValue(dialog,
                    locator.dbConnectionDialog.mysql.advanced.compressionLevel),
                disableHeatWave: await DialogHelper.getCheckBoxValue("disableHeatwaveCheck"),
            };
            dbConnection.advanced = advanced;

            if (await DialogHelper.existsTab(constants.sshTab)) {
                await DialogHelper.selectTab(constants.sshTab);
                const ssh: interfaces.IConnSSH = {
                    uri: await DialogHelper.getFieldValue(dialog, locator.dbConnectionDialog.mysql.ssh.uri),
                    privateKey: await DialogHelper.getFieldValue(dialog,
                        locator.dbConnectionDialog.mysql.ssh.privateKey),
                    customPath: await DialogHelper.getFieldValue(dialog,
                        locator.dbConnectionDialog.mysql.ssh.customPath),
                };
                dbConnection.ssh = ssh;
            }

            if (await DialogHelper.existsTab(constants.mdsTab)) {
                await DialogHelper.selectTab(constants.mdsTab);

                const mds: interfaces.IConnMDS = {
                    profile: await dialog
                        .findElement(locator.dbConnectionDialog.mysql.mds.profileName)
                        .findElement(locator.htmlTag.label)
                        .then((el) => {
                            return el.getText();
                        })
                        .catch(() => {
                            return undefined;
                        }),
                    sshPrivateKey: await DialogHelper.getFieldValue(dialog,
                        locator.dbConnectionDialog.mysql.mds.sshPrivateKey),
                    sshPublicKey: await DialogHelper.getFieldValue(dialog,
                        locator.dbConnectionDialog.mysql.mds.sshPublicKey),
                    dbSystemOCID: await DialogHelper.getFieldValue(dialog,
                        locator.dbConnectionDialog.mysql.mds.dbSystemId),
                    bastionOCID: await DialogHelper.getFieldValue(dialog,
                        locator.dbConnectionDialog.mysql.mds.bastionId),
                };
                dbConnection.mds = mds;
            }
        } else {
            const basic: interfaces.IConnBasicSqlite = {
                dbPath: await DialogHelper.getFieldValue(dialog, locator.dbConnectionDialog.sqlite.basic.dbFilePath),
                dbName: await DialogHelper.getFieldValue(dialog, locator.dbConnectionDialog.sqlite.basic.dbName),
            };
            await DialogHelper.selectTab(constants.advancedTab);
            const advanced: interfaces.IConnAdvancedSqlite = {
                params: await DialogHelper.getFieldValue(dialog,
                    locator.dbConnectionDialog.sqlite.advanced.otherParams),
            };
            dbConnection.basic = basic;
            dbConnection.advanced = advanced;
        }
        await dialog.findElement(locator.dbConnectionDialog.ok).click();

        return dbConnection;
    };

    /**
     * Clicks the Clear Password button. It waits for the confirm dialog and click the OK button,
     * or wait for a notification error, dismissing it
     * @returns A promise resolving when the button is clicked and the dialog or notification is dismissed
     */
    public static clearPassword = async (): Promise<void> => {
        const dialog = await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists),
            constants.wait5seconds, "Connection dialog was not displayed");

        await dialog.findElement(locator.dbConnectionDialog.clearPassword).click();

        await driver.wait(async () => {
            const dialog = await driver.findElements(locator.confirmDialog.exists);
            const notifications = await Misc.getToastNotifications();

            if (dialog.length > 0) {
                await dialog[0].findElement(locator.confirmDialog.accept).click();

                return true;
            }

            if (notifications.length > 0) {
                for (const notification of notifications) {
                    await notification.close();
                    await driver.wait(notification.untilIsClosed(), constants.wait5seconds,
                        "The notification was not closed");
                }

                return true;
            }
        }, constants.wait5seconds, "No confirm dialog nor notifications were triggered");

        await dialog.findElement(locator.dbConnectionDialog.ok).click();
    };

}
