/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

import { Condition } from "vscode-extension-tester";
import * as locator from "../locators";
import { Misc, driver } from "../Misc";
import { PasswordDialog } from "./Dialogs/PasswordDialog";
import * as interfaces from "../interfaces";
import * as constants from "../constants";

/**
 * This class represents the code editor widget and all its related functions
 */
export class E2EServerStatus {

    // MAIN SETTINGS

    /** The host*/
    public host: string;

    /** The socket*/
    public socket: string;

    /** The port*/
    public port: string;

    /** The version*/
    public version: string;

    /** Compiled for*/
    public compiledFor: string;

    /** The configuration file*/
    public configurationFile: string;

    /** Running since*/
    public runningSince: string;

    // SERVER DIRECTORIES

    /** The base directory*/
    public baseDirectory: string;

    /** The data directory*/
    public dataDirectory: string;

    /** The plugins directory*/
    public pluginsDirectory: string;

    /** The temp directory*/
    public tempDirectory: string;

    /** The Error Log*/
    public errorLog: {
        checked: boolean;
        path: string;
    };

    /** The General Log*/
    public generalLog: {
        checked: boolean;
        path: string;
    };

    /** Slow Query Log*/
    public slowQueryLog: {
        checked: boolean;
        path: string;
    };

    // SERVER FEATURES

    /** The Performance Schema*/
    public performanceSchema: boolean;

    /** The Thread Pool*/
    public threadPool: boolean;

    /** The MemCached Plugin*/
    public memCachedPlugin: string;

    /** The SemiSync Replication Plugin*/
    public semiSyncRepPlugin: string;

    /** The PAM Authentication*/
    public pamAuthentication: boolean;

    /** The password validation*/
    public passwordValidation: boolean;

    /** The Audit Log*/
    public auditLog: boolean;

    /** The Firewall*/
    public firewall: string;

    /** The Firewall Trace*/
    public firewallTrace: string;

    // SERVER SSL

    /** The SSL Ca*/
    public sslCa: string;

    /** The SSL Ca path*/
    public sslCaPath: string;

    /** The SSL Cert*/
    public sslCert: string;

    /** The SSL Cipher*/
    public sslCipher: string;

    /** The SSL CRL*/
    public sslCrl: string;

    /** The SSL CRL Path*/
    public sslCrlPath: string;

    /** The SSL Key*/
    public sslKey: string;

    // SERVER AUTHENTICATION

    /** The private Key*/
    public privateKey: string;

    /** The public Key*/
    public publicKey: string;

    /**
     * Verifies if the Server Status page is opened and fully loaded
     * @param connection The DB connection
     * @returns A condition resolving to true if the page is fully loaded, false otherwise
     */
    public untilIsOpened = (connection: interfaces.IDBConnection): Condition<boolean> => {
        return new Condition(`for Server Status to be opened`, async () => {
            await Misc.switchBackToTopFrame();
            await Misc.switchToFrame();

            const isOpened = async (): Promise<boolean> => {
                return (await driver.findElements(locator.mysqlAdministration.serverStatus.exists)).length > 0;
            };

            if (await PasswordDialog.exists()) {
                await PasswordDialog.setCredentials(connection);

                return driver.wait(async () => {
                    return isOpened();
                }, constants.wait10seconds).catch(async () => {
                    const existsErrorDialog = (await driver.findElements(locator.errorDialog.exists)).length > 0;
                    if (existsErrorDialog) {
                        const errorDialog = await driver.findElement(locator.errorDialog.exists);
                        const errorMsg = await errorDialog.findElement(locator.errorDialog.message);
                        throw new Error(await errorMsg.getText());
                    } else {
                        throw new Error("Unknown error");
                    }
                });
            } else {
                return isOpened();
            }
        });
    };

    /**
     * Loads the Server Status page objects and attributes
     * @returns A promise resolving when the page is loaded
     */
    public create = async (): Promise<void> => {
        const serverStatusLocator = locator.mysqlAdministration.serverStatus;
        this.host = await (await driver.findElement(serverStatusLocator.host)).getText();
        this.socket = await (await driver.findElement(serverStatusLocator.socket)).getText();
        this.port = await (await driver.findElement(serverStatusLocator.port)).getText();
        this.version = await (await driver.findElement(serverStatusLocator.version)).getText();
        this.compiledFor = await (await driver.findElement(serverStatusLocator.compiledFor)).getText();
        this.configurationFile = await (await driver.findElement(serverStatusLocator.configFile)).getText();
        this.runningSince = await (await driver.findElement(serverStatusLocator.runningSince)).getText();
        this.baseDirectory = await (await driver.findElement(serverStatusLocator.baseDir)).getText();
        this.dataDirectory = await (await driver.findElement(serverStatusLocator.dataDir)).getText();
        this.pluginsDirectory = await (await driver.findElement(serverStatusLocator.pluginsDir)).getText();
        this.tempDirectory = await (await driver.findElement(serverStatusLocator.tmpDir)).getText();
        const errorLogClass = await (await driver.findElement(serverStatusLocator.errorLog)
            .findElement(locator.htmlTag.label)).getAttribute("class");
        this.errorLog = {
            checked: errorLogClass.includes("unchecked") ? false : true,
            path: await (await driver.findElement(serverStatusLocator.errorLog)).getText(),
        };
        const generalLogClass = await (await driver.findElement(serverStatusLocator.generalLog)
            .findElement(locator.htmlTag.label)).getAttribute("class");
        this.generalLog = {
            checked: generalLogClass.includes("unchecked") ? false : true,
            path: await (await driver.findElement(serverStatusLocator.generalLog)).getText(),
        };
        const slowQueryLogClass = await (await driver.findElement(serverStatusLocator.slowQueryLog)
            .findElement(locator.htmlTag.label)).getAttribute("class");
        this.slowQueryLog = {
            checked: slowQueryLogClass.includes("unchecked") ? false : true,
            path: await (await driver.findElement(serverStatusLocator.slowQueryLog)).getText(),
        };
        const performanceSchemaClass = await (await driver.findElement(serverStatusLocator.performanceSchema)
            .findElement(locator.htmlTag.label)).getAttribute("class");
        this.performanceSchema = performanceSchemaClass.includes("unchecked") ? false : true;
        const threadPoolClass = await (await driver.findElement(serverStatusLocator.threadPool)
            .findElement(locator.htmlTag.label)).getAttribute("class");
        this.threadPool = threadPoolClass.includes("unchecked") ? false : true;
        this.memCachedPlugin = await (await driver.findElement(serverStatusLocator.memCachedPlugin)).getText();
        this.semiSyncRepPlugin = await (await driver.findElement(serverStatusLocator.semiSyncReplicationPlugin))
            .getText();
        const pamAuthenticationClass = await (await driver.findElement(serverStatusLocator.pamAuthentication)
            .findElement(locator.htmlTag.label)).getAttribute("class");
        this.pamAuthentication = pamAuthenticationClass.includes("unchecked") ? false : true;
        const passwordValidationClass = await (await driver.findElement(serverStatusLocator.passwordValidation)
            .findElement(locator.htmlTag.label)).getAttribute("class");
        this.passwordValidation = passwordValidationClass.includes("unchecked") ? false : true;
        const auditLogClass = await (await driver.findElement(serverStatusLocator.auditLog)
            .findElement(locator.htmlTag.label)).getAttribute("class");
        this.auditLog = auditLogClass.includes("unchecked") ? false : true;
        this.firewall = await (await driver.findElement(serverStatusLocator.firewall)).getText();
        this.firewallTrace = await (await driver.findElement(serverStatusLocator.firewallTrace)).getText();
        this.sslCa = await (await driver.findElement(serverStatusLocator.sslCa)).getText();
        this.sslCaPath = await (await driver.findElement(serverStatusLocator.sslCaPath)).getText();
        this.sslCert = await (await driver.findElement(serverStatusLocator.sslCert)).getText();
        this.sslCipher = await (await driver.findElement(serverStatusLocator.sslCipher)).getText();
        this.sslCrl = await (await driver.findElement(serverStatusLocator.sslCrl)).getText();
        this.sslCrlPath = await (await driver.findElement(serverStatusLocator.sslCrlPath)).getText();
        this.sslKey = await (await driver.findElement(serverStatusLocator.sslKey)).getText();
        this.privateKey = await (await driver.findElement(serverStatusLocator.privateKey)).getText();
        this.publicKey = await (await driver.findElement(serverStatusLocator.publicKey)).getText();
    };

}
