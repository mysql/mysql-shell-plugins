/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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
import { WebElement, By, until, Key, Condition, error } from "vscode-extension-tester";
import { driver, Misc } from "../misc";
import * as waitUntil from "../until";
import * as constants from "../constants";
import * as interfaces from "../interfaces";
import * as locator from "../locators";
import { DialogHelper } from "./dialogHelper";

/**
 * This class aggregates the functions that perform database related operations
 */
export class DatabaseConnection {

    /**
     * Selects a Database connection tab
     * @param name The tab name
     * @returns A promise resolving when the tab is selected
     */
    public static selectTab = async (name: string): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const dialog = await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists),
            constants.wait25seconds, "Connection dialog was not displayed");
        const tabs = await dialog.findElements(locator.dbConnectionDialog.tab);
        for (const tab of tabs) {
            if ((await tab.getText() === name)) {
                await tab.click();

                break;
            }
        }
    };

    /**
     * Verifies if a Database connection tab exists
     * @param name The tab name
     * @returns A promise resolving with true if the tab exists, false otherwise
     */
    public static existsTab = async (name: string): Promise<boolean> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const dialog = await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists),
            constants.wait25seconds, "Connection dialog was not displayed");
        const tabs = await dialog.findElements(locator.dbConnectionDialog.tab);
        for (const tab of tabs) {
            if ((await tab.getText() === name)) {
                return true;
            }
        }
    };

    /**
     * Sets a Database connection data
     * @param dbConfig The database config object
     * @returns A promise resolving when the connection dialog is set
     */
    public static setConnection = async (dbConfig: interfaces.IDBConnection): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

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
                    await this.selectTab(constants.basicTab);
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
                        await DialogHelper.setCheckboxValue("useSSH", dbConfig.basic.ociBastion);
                    }
                    if (dbConfig.basic.ociBastion !== undefined) {
                        await DialogHelper.setCheckboxValue("useMDS", dbConfig.basic.ociBastion);
                    }
                    if (dbConfig.ssl) {
                        await this.selectTab(constants.sslTab);
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
                        await this.selectTab(constants.advancedTab);
                        if (interfaces.isAdvancedMySQL(dbConfig.advanced)) {
                            if (dbConfig.advanced.mode) {
                                const getModeItem = async (name: string): Promise<WebElement> => {
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
                                    await DialogHelper.setCheckboxValue(await getModeItem(mode),
                                        dbConfig.advanced.mode[mode] as boolean);
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
                        await this.selectTab(constants.sshTab);
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
                        await this.selectTab(constants.mdsTab);
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
                    await this.selectTab(constants.basicTab);
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
                    await this.selectTab(constants.advancedTab);
                    if (sqliteData.advanced.params) {
                        await DialogHelper.setFieldText(dialog, locator.dbConnectionDialog.sqlite.advanced.otherParams,
                            sqliteData.advanced.params);
                    }
                }
            }
        } else {
            throw new Error("Could not find the database type on the db object");
        }

        await dialog.findElement(locator.dbConnectionDialog.ok).click();
    };
    /**
     * Gets a Database connection from the connection overview
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
        }, constants.wait5seconds, `The connection ${name} was not found on the Connection Browser`);

        return db;
    };

    /**
     * Clicks on a database connection edit button
     * @param name The database connection caption
     * @returns A promise resolving with the connection details
     */
    public static editConnection = async (name: string): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }
        const connection = await DatabaseConnection.getConnection(name);
        const moreActions = await connection.findElement(locator.dbConnectionOverview.dbConnection.moreActions);
        await driver.actions().move({ origin: moreActions }).perform();
        await driver.executeScript("arguments[0].click()", moreActions);
        await driver.wait(until.elementLocated(locator.dbConnectionOverview.dbConnection.moreActionsMenu.exists),
            constants.wait5seconds, "More actions menu was not displayed");
        await driver.findElement(locator.dbConnectionOverview.dbConnection.moreActionsMenu.editConnection)
            .click();
    };

    /**
     * Gets a Database connection details by opening the connection dialog
     * @param name The database connection caption
     * @returns A promise resolving with the connection details
     */
    public static getConnectionDetails = async (name: string): Promise<interfaces.IDBConnection> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }
        await this.editConnection(name);
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
            await this.selectTab(constants.sslTab);
            const ssl: interfaces.IConnSSL = {
                mode: await dialog.findElement(locator.dbConnectionDialog.mysql.ssl.mode)
                    .findElement(locator.htmlTag.label).getText(),
                ciphers: await DialogHelper.getFieldValue(dialog, locator.dbConnectionDialog.mysql.ssl.ciphers),
                caPath: await DialogHelper.getFieldValue(dialog, locator.dbConnectionDialog.mysql.ssl.ca),
                clientCertPath: await DialogHelper.getFieldValue(dialog, locator.dbConnectionDialog.mysql.ssl.cert),
                clientKeyPath: await DialogHelper.getFieldValue(dialog, locator.dbConnectionDialog.mysql.ssl.key),
            };
            dbConnection.ssl = ssl;
            await this.selectTab(constants.advancedTab);
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

                return itemToReturn;
            };
            const advanced: interfaces.IConnAdvancedMySQL = {
                mode: {
                    ansi: await DialogHelper.getCheckBoxValue(await getModeItem("ANSI")),
                    traditional: await DialogHelper.getCheckBoxValue(await getModeItem("TRADITIONAL")),
                    allowInvalidDates: await DialogHelper.getCheckBoxValue(await getModeItem("ALLOW_INVALID_DATES")),
                    ansiQuotes: await DialogHelper.getCheckBoxValue(await getModeItem("ANSI_QUOTES")),
                    errorForDivisionByZero: await DialogHelper
                        .getCheckBoxValue(await getModeItem("ERROR_FOR_DIVISION_BY_ZERO")),
                    highNotPrecedence: await DialogHelper.getCheckBoxValue(await getModeItem("HIGH_NOT_PRECEDENCE")),
                    ignoreSpace: await DialogHelper.getCheckBoxValue(await getModeItem("IGNORE_SPACE")),
                    noAutoValueOnZero: await DialogHelper.getCheckBoxValue(await getModeItem("NO_AUTO_VALUE_ON_ZERO")),
                    noUnsignedSubtraction: await DialogHelper
                        .getCheckBoxValue(await getModeItem("NO_UNSIGNED_SUBTRACTION")),
                    noZeroDate: await DialogHelper.getCheckBoxValue(await getModeItem("NO_ZERO_DATE")),
                    noZeroInDate: await DialogHelper.getCheckBoxValue(await getModeItem("NO_ZERO_IN_DATE")),
                    onlyFullGroupBy: await DialogHelper.getCheckBoxValue(await getModeItem("ONLY_FULL_GROUP_BY")),
                    padCharToFullLength: await DialogHelper
                        .getCheckBoxValue(await getModeItem("PAD_CHAR_TO_FULL_LENGTH")),
                    pipesAsConcat: await DialogHelper.getCheckBoxValue(await getModeItem("PIPES_AS_CONCAT")),
                    realAsFloat: await DialogHelper.getCheckBoxValue(await getModeItem("REAL_AS_FLOAT")),
                    strictAllTables: await DialogHelper.getCheckBoxValue(await getModeItem("STRICT_ALL_TABLES")),
                    strictTransTables: await DialogHelper.getCheckBoxValue(await getModeItem("STRICT_TRANS_TABLES")),
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
            dbConnection.advanced = advanced;
            if (await this.existsTab(constants.sshTab)) {
                await this.selectTab(constants.sshTab);
                const ssh: interfaces.IConnSSH = {
                    uri: await DialogHelper.getFieldValue(dialog, locator.dbConnectionDialog.mysql.ssh.uri),
                    privateKey: await DialogHelper.getFieldValue(dialog,
                        locator.dbConnectionDialog.mysql.ssh.privateKey),
                    customPath: await DialogHelper.getFieldValue(dialog,
                        locator.dbConnectionDialog.mysql.ssh.customPath),
                };
                dbConnection.ssh = ssh;
            }
            if (await this.existsTab(constants.mdsTab)) {
                await this.selectTab(constants.mdsTab);

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
        if (excludeList) {
            const excludeListInput = await dialog.findElement(locator.hwDialog.excludeList);
            await excludeListInput.sendKeys(excludeList);
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
