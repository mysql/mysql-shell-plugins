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

import * as locator from "../../locators";
import { driver } from "../../Misc";

/**
 * This class represents the Server Status page and all its related functions
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
     * Loads the Server Status page objects and attributes
     * @returns A promise resolving when the page is loaded
     */
    public create = async (): Promise<void> => {
        const serverStatusLocator = locator.mysqlAdministration.serverStatus;

        const [
            host,
            socket,
            port,
            version,
            compiledFor,
            configFile,
            runningSince,
            baseDir,
            dataDir,
            pluginsDir,
            tmpDir,
            errorLogClasses,
            generalLogClasses,
            slowQueryLogClasses,
            performanceSchemaClasses,
            threadPoolClasses,
            memCachedPlugin,
            semiSyncReplicationPlugin,
            pamAuthenticationClasses,
            passwordValidationClasses,
            auditLogClasses,
            firewall,
            firewallTrace,
            sslCa,
            sslCaPath,
            sslCert,
            sslCipher,
            sslCrl,
            sslCrlPath,
            sslKey,
            privateKey,
            publicKey,
        ] = await Promise.all([
            await (await driver.findElement(serverStatusLocator.host)).getText(),
            await (await driver.findElement(serverStatusLocator.socket)).getText(),
            await (await driver.findElement(serverStatusLocator.port)).getText(),
            await (await driver.findElement(serverStatusLocator.version)).getText(),
            await (await driver.findElement(serverStatusLocator.compiledFor)).getText(),
            await (await driver.findElement(serverStatusLocator.configFile)).getText(),
            await (await driver.findElement(serverStatusLocator.runningSince)).getText(),
            await (await driver.findElement(serverStatusLocator.baseDir)).getText(),
            await (await driver.findElement(serverStatusLocator.dataDir)).getText(),
            await (await driver.findElement(serverStatusLocator.pluginsDir)).getText(),
            await (await driver.findElement(serverStatusLocator.tmpDir)).getText(),
            await (await driver.findElement(serverStatusLocator.errorLog).findElement(locator.htmlTag.label))
                .getAttribute("class"),
            await (await driver.findElement(serverStatusLocator.generalLog).findElement(locator.htmlTag.label))
                .getAttribute("class"),
            await (await driver.findElement(serverStatusLocator.slowQueryLog).findElement(locator.htmlTag.label))
                .getAttribute("class"),
            await (await driver.findElement(serverStatusLocator.performanceSchema).findElement(locator.htmlTag.label))
                .getAttribute("class"),
            await (await driver.findElement(serverStatusLocator.threadPool).findElement(locator.htmlTag.label))
                .getAttribute("class"),
            await (await driver.findElement(serverStatusLocator.memCachedPlugin)).getText(),
            await (await driver.findElement(serverStatusLocator.semiSyncReplicationPlugin)).getText(),
            await (await driver.findElement(serverStatusLocator.pamAuthentication).findElement(locator.htmlTag.label))
                .getAttribute("class"),
            await (await driver.findElement(serverStatusLocator.passwordValidation).findElement(locator.htmlTag.label))
                .getAttribute("class"),
            await (await driver.findElement(serverStatusLocator.auditLog).findElement(locator.htmlTag.label))
                .getAttribute("class"),
            await (await driver.findElement(serverStatusLocator.firewall)).getText(),
            await (await driver.findElement(serverStatusLocator.firewallTrace)).getText(),
            await (await driver.findElement(serverStatusLocator.sslCa)).getText(),
            await (await driver.findElement(serverStatusLocator.sslCaPath)).getText(),
            await (await driver.findElement(serverStatusLocator.sslCert)).getText(),
            await (await driver.findElement(serverStatusLocator.sslCipher)).getText(),
            await (await driver.findElement(serverStatusLocator.sslCrl)).getText(),
            await (await driver.findElement(serverStatusLocator.sslCrlPath)).getText(),
            await (await driver.findElement(serverStatusLocator.sslKey)).getText(),
            await (await driver.findElement(serverStatusLocator.privateKey)).getText(),
            await (await driver.findElement(serverStatusLocator.publicKey)).getText(),
        ]);

        this.host = host;
        this.socket = socket;
        this.port = port;
        this.version = version;
        this.compiledFor = compiledFor;
        this.configurationFile = configFile;
        this.runningSince = runningSince;
        this.baseDirectory = baseDir;
        this.dataDirectory = dataDir;
        this.pluginsDirectory = pluginsDir;
        this.tempDirectory = tmpDir;
        this.errorLog = {
            checked: errorLogClasses.includes("unchecked") ? false : true,
            path: await (await driver.findElement(serverStatusLocator.errorLog)).getText(),
        };
        this.generalLog = {
            checked: generalLogClasses.includes("unchecked") ? false : true,
            path: await (await driver.findElement(serverStatusLocator.generalLog)).getText(),
        };
        this.slowQueryLog = {
            checked: slowQueryLogClasses.includes("unchecked") ? false : true,
            path: await (await driver.findElement(serverStatusLocator.slowQueryLog)).getText(),
        };
        this.performanceSchema = performanceSchemaClasses.includes("unchecked") ? false : true;
        this.threadPool = threadPoolClasses.includes("unchecked") ? false : true;
        this.memCachedPlugin = memCachedPlugin;
        this.semiSyncRepPlugin = semiSyncReplicationPlugin;
        this.pamAuthentication = pamAuthenticationClasses.includes("unchecked") ? false : true;
        this.passwordValidation = passwordValidationClasses.includes("unchecked") ? false : true;
        this.auditLog = auditLogClasses.includes("unchecked") ? false : true;
        this.firewall = firewall;
        this.firewallTrace = firewallTrace;
        this.sslCa = sslCa;
        this.sslCaPath = sslCaPath;
        this.sslCert = sslCert;
        this.sslCipher = sslCipher;
        this.sslCrl = sslCrl;
        this.sslCrlPath = sslCrlPath;
        this.sslKey = sslKey;
        this.privateKey = privateKey;
        this.publicKey = publicKey;
    };

}
