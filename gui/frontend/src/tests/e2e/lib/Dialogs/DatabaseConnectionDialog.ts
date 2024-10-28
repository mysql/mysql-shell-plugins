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
import { WebElement, By, until, Key, Condition, error } from "selenium-webdriver";
import { driver } from "../../lib/driver.js";
import * as constants from "../constants.js";
import * as interfaces from "../interfaces.js";
import * as locator from "../locators.js";
import { DialogHelper } from "./DialogHelper.js";
import { E2EToolbar } from "../E2EToolbar.js";
import { ConfirmDialog } from "./ConfirmationDialog.js";

/**
 * This class aggregates the functions to interact with the database connection dialog
 */
export class DatabaseConnectionDialog {

    /**
     * Sets a Database connection data
     * @param dbConfig The database config object
     * @returns A promise resolving when the connection dialog is set
     */
    public static setConnection = async (dbConfig: interfaces.IDBConnection): Promise<void> => {

        const dialog = await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists),
            constants.wait25seconds, "Connection dialog was not displayed");
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
                                    const modeItems = await driver.wait(until
                                        .elementsLocated(locator.dbConnectionDialog.mysql
                                            .advanced.sqlModeItem), constants.wait5seconds);
                                    for (const item of modeItems) {
                                        if ((await item.getText()).toLowerCase().replace(/_/g, "") ===
                                            name.toLowerCase().replace(/_/g, "")) {
                                            return item;
                                        }
                                    }
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
        await new E2EToolbar().editorSelector.selectEditor(/DB Connection Overview/); // TO REMOVE
    };

    /**
     * Gets the database connection details from the connection dialog
     * @returns A promise resolving with the connection details
     */
    public static getConnectionDetails = async (): Promise<interfaces.IDBConnection> => {

        const dialog = await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists),
            constants.wait25seconds, "Connection dialog was not displayed");
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

            const getModeItem = async (name: string): Promise<WebElement> => {
                let itemToReturn: WebElement;
                await driver.wait(async () => {
                    try {
                        const modeItems = await driver.findElements(locator.dbConnectionDialog.mysql
                            .advanced.sqlModeItem);
                        if (modeItems.length > 0) {
                            for (const item of modeItems) {
                                if ((await item.getText() === name)) {
                                    await item.getAttribute("class");
                                    itemToReturn = item;

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

                return itemToReturn!;
            };
            let advanced: interfaces.IConnAdvancedMySQL;
            await driver.wait(async () => {
                try {
                    advanced = {
                        mode: {
                            ansi: await DialogHelper.getCheckBoxValue(await getModeItem("ANSI")),
                            traditional: await DialogHelper.getCheckBoxValue(await getModeItem("TRADITIONAL")),
                            allowInvalidDates: await DialogHelper
                                .getCheckBoxValue(await getModeItem("ALLOW_INVALID_DATES")),
                            ansiQuotes: await DialogHelper.getCheckBoxValue(await getModeItem("ANSI_QUOTES")),
                            errorForDivisionByZero: await DialogHelper
                                .getCheckBoxValue(await getModeItem("ERROR_FOR_DIVISION_BY_ZERO")),
                            highNotPrecedence: await DialogHelper
                                .getCheckBoxValue(await getModeItem("HIGH_NOT_PRECEDENCE")),
                            ignoreSpace: await DialogHelper.getCheckBoxValue(await getModeItem("IGNORE_SPACE")),
                            noAutoValueOnZero: await DialogHelper
                                .getCheckBoxValue(await getModeItem("NO_AUTO_VALUE_ON_ZERO")),
                            noUnsignedSubtraction: await DialogHelper
                                .getCheckBoxValue(await getModeItem("NO_UNSIGNED_SUBTRACTION")),
                            noZeroDate: await DialogHelper.getCheckBoxValue(await getModeItem("NO_ZERO_DATE")),
                            noZeroInDate: await DialogHelper.getCheckBoxValue(await getModeItem("NO_ZERO_IN_DATE")),
                            onlyFullGroupBy: await DialogHelper
                                .getCheckBoxValue(await getModeItem("ONLY_FULL_GROUP_BY")),
                            padCharToFullLength: await DialogHelper
                                .getCheckBoxValue(await getModeItem("PAD_CHAR_TO_FULL_LENGTH")),
                            pipesAsConcat: await DialogHelper.getCheckBoxValue(await getModeItem("PIPES_AS_CONCAT")),
                            realAsFloat: await DialogHelper.getCheckBoxValue(await getModeItem("REAL_AS_FLOAT")),
                            strictAllTables: await DialogHelper
                                .getCheckBoxValue(await getModeItem("STRICT_ALL_TABLES")),
                            strictTransTables: await DialogHelper
                                .getCheckBoxValue(await getModeItem("STRICT_TRANS_TABLES")),
                            timeTruncateFractional: await DialogHelper
                                .getCheckBoxValue(await getModeItem("TIME_TRUNCATE_FRACTIONAL")),
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

                    return true;
                } catch (e) {
                    if (!(e instanceof error.StaleElementReferenceError)) {
                        throw e;
                    }
                }
            }, constants.wait3seconds, "Could not set data on the advanced tabs");

            dbConnection.advanced = advanced!;
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
     * Sets the database schema data to Heat Wave
     * @param schemas The schemas
     * @param opMode The operational mode
     * @param output The output
     * @param disableCols True to disable unsupported columns, false otherwise
     * @param optimize True to optimize load parallelism, false otherwise
     * @param enableMemory True to enable memory check, false otherwise
     * @param sqlMode The SQL mode
     * @param excludeList The exclude list
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
        excludeList?: string,
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
        if (excludeList) {
            const excludeListInput = await dialog.findElement(locator.hwDialog.excludeList);
            await excludeListInput.sendKeys(excludeList);
        }

        await dialog.findElement(locator.hwDialog.ok).click();
    };

    /**
     * Clears the password
     */
    public static clearPassword = async (): Promise<void> => {
        const dialog = await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists),
            constants.wait5seconds, "Connection dialog was not displayed");
        await dialog.findElement(locator.dbConnectionDialog.clearPassword).click();
        const confirmDialog = await new ConfirmDialog().untilExists(500).catch(() => { return undefined; });

        if (confirmDialog) {
            await confirmDialog.accept();
        }

        await dialog.findElement(locator.dbConnectionDialog.cancel).click();
    };
}
