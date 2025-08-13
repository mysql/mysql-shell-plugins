/*
 * Copyright (c) 2024, 2025, Oracle and/or its affiliates.
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

import { until } from "selenium-webdriver";
import * as locator from "../locators.js";
import { driver } from "../../lib/driver.js";
import { E2EEditorSelector } from "../E2EEditorSelector.js";
import { wait3seconds } from "../constants.js";

/**
 * This class represents the Server Status page and all its related functions
 */
export class E2EServerStatus {

    /** The editor selector*/
    public editorSelector = new E2EEditorSelector();

    // MAIN SETTINGS

    /** The host*/
    public host: string | undefined;

    /** The socket*/
    public socket: string | undefined;

    /** The port*/
    public port: string | undefined;

    /** The version*/
    public version: string | undefined;

    /** Compiled for*/
    public compiledFor: string | undefined;

    /** The configuration file*/
    public configurationFile: string | undefined;

    /** Running since*/
    public runningSince: string | undefined;

    // SERVER DIRECTORIES

    /** The base directory*/
    public baseDirectory: string | undefined;

    /** The data directory*/
    public dataDirectory: string | undefined;

    /** The plugins directory*/
    public pluginsDirectory: string | undefined;

    /** The temp directory*/
    public tempDirectory: string | undefined;

    /** The Error Log*/
    public errorLog: {
        checked: boolean;
        path: string;
    } | undefined;

    /** The General Log*/
    public generalLog: {
        checked: boolean;
        path: string;
    } | undefined;

    /** Slow Query Log*/
    public slowQueryLog: {
        checked: boolean;
        path: string;
    } | undefined;

    // SERVER FEATURES

    /** The Performance Schema*/
    public performanceSchema: boolean | undefined;

    /** The Thread Pool*/
    public threadPool: boolean | undefined;

    /** The MemCached Plugin*/
    public memCachedPlugin: string | undefined;

    /** The SemiSync Replication Plugin*/
    public semiSyncRepPlugin: string | undefined;

    /** The PAM Authentication*/
    public pamAuthentication: boolean | undefined;

    /** The password validation*/
    public passwordValidation: boolean | undefined;

    /** The Audit Log*/
    public auditLog: boolean | undefined;

    /** The Firewall*/
    public firewall: string | undefined;

    /** The Firewall Trace*/
    public firewallTrace: string | undefined;

    // SERVER SSL

    /** The SSL Ca*/
    public sslCa: string | undefined;

    /** The SSL Ca path*/
    public sslCaPath: string | undefined;

    /** The SSL Cert*/
    public sslCert: string | undefined;

    /** The SSL Cipher*/
    public sslCipher: string | undefined;

    /** The SSL CRL*/
    public sslCrl: string | undefined;

    /** The SSL CRL Path*/
    public sslCrlPath: string | undefined;

    /** The SSL Key*/
    public sslKey: string | undefined;

    // SERVER AUTHENTICATION

    /** The private Key*/
    public privateKey: string | undefined;

    /** The public Key*/
    public publicKey: string | undefined;

    /**
     * Loads the Server Status page objects and attributes
     * 
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
            await driver.findElement(serverStatusLocator.host),
            await driver.findElement(serverStatusLocator.socket),
            await driver.findElement(serverStatusLocator.port),
            await driver.findElement(serverStatusLocator.version),
            await driver.findElement(serverStatusLocator.compiledFor),
            await driver.findElement(serverStatusLocator.configFile),
            await driver.findElement(serverStatusLocator.runningSince),
            await driver.findElement(serverStatusLocator.baseDir),
            await driver.findElement(serverStatusLocator.dataDir),
            await driver.findElement(serverStatusLocator.pluginsDir),
            await driver.findElement(serverStatusLocator.tmpDir),
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
            await driver.findElement(serverStatusLocator.memCachedPlugin),
            await driver.findElement(serverStatusLocator.semiSyncReplicationPlugin),
            await (await driver.findElement(serverStatusLocator.pamAuthentication).findElement(locator.htmlTag.label))
                .getAttribute("class"),
            await (await driver.findElement(serverStatusLocator.passwordValidation).findElement(locator.htmlTag.label))
                .getAttribute("class"),
            await (await driver.findElement(serverStatusLocator.auditLog).findElement(locator.htmlTag.label))
                .getAttribute("class"),
            await driver.findElement(serverStatusLocator.firewall),
            await driver.findElement(serverStatusLocator.firewallTrace),
            await driver.findElement(serverStatusLocator.sslCa),
            await driver.findElement(serverStatusLocator.sslCaPath),
            await driver.findElement(serverStatusLocator.sslCert),
            await driver.findElement(serverStatusLocator.sslCipher),
            await driver.findElement(serverStatusLocator.sslCrl),
            await driver.findElement(serverStatusLocator.sslCrlPath),
            await driver.findElement(serverStatusLocator.sslKey),
            await driver.findElement(serverStatusLocator.privateKey),
            await driver.findElement(serverStatusLocator.publicKey),
        ]);

        const notEmpty = /(.|\s)*\S(.|\s)*/;

        this.host = await (await driver.wait(until.elementTextMatches(host, notEmpty), wait3seconds)).getText();
        this.socket = await (await driver.wait(until.elementTextMatches(socket, notEmpty), wait3seconds)).getText();
        this.port = await (await driver.wait(until.elementTextMatches(port, notEmpty), wait3seconds)).getText();
        this.version = await (await driver.wait(until.elementTextMatches(version, notEmpty), wait3seconds)).getText();
        this.compiledFor = await (await driver.wait(until.elementTextMatches(compiledFor,
            notEmpty), wait3seconds)).getText();
        this.configurationFile = await (await driver.wait(until.elementTextMatches(configFile,
            notEmpty), wait3seconds)).getText();
        this.runningSince = await (await driver.wait(until.elementTextMatches(runningSince,
            notEmpty), wait3seconds)).getText();
        this.baseDirectory = await (await driver.wait(until.elementTextMatches(baseDir,
            notEmpty), wait3seconds)).getText();
        this.dataDirectory = await (await driver.wait(until.elementTextMatches(dataDir,
            notEmpty), wait3seconds)).getText();
        this.pluginsDirectory = await (await driver.wait(until.elementTextMatches(pluginsDir,
            notEmpty), wait3seconds)).getText();
        this.tempDirectory = await (await driver.wait(until.elementTextMatches(tmpDir,
            notEmpty), wait3seconds)).getText();

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
        this.memCachedPlugin = await (await driver.wait(until.elementTextMatches(memCachedPlugin,
            notEmpty), wait3seconds)).getText();
        this.semiSyncRepPlugin = await (await driver.wait(until.elementTextMatches(semiSyncReplicationPlugin,
            notEmpty), wait3seconds)).getText();
        this.pamAuthentication = pamAuthenticationClasses.includes("unchecked") ? false : true;
        this.passwordValidation = passwordValidationClasses.includes("unchecked") ? false : true;
        this.auditLog = auditLogClasses.includes("unchecked") ? false : true;
        this.firewall = await (await driver.wait(until.elementTextMatches(firewall, notEmpty), wait3seconds)).getText();
        this.firewallTrace = await (await driver.wait(until.elementTextMatches(firewallTrace,
            notEmpty), wait3seconds)).getText();
        this.sslCa = await (await driver.wait(until.elementTextMatches(sslCa,
            notEmpty), wait3seconds)).getText();
        this.sslCaPath = await sslCaPath.getText();
        this.sslCert = await (await driver.wait(until.elementTextMatches(sslCert,
            notEmpty), wait3seconds)).getText();
        this.sslCipher = await sslCipher.getText();
        this.sslCrl = await sslCrl.getText();
        this.sslCrlPath = await sslCrlPath.getText();
        this.sslKey = await (await driver.wait(until.elementTextMatches(sslKey,
            notEmpty), wait3seconds)).getText();
        this.privateKey = await (await driver.wait(until.elementTextMatches(privateKey,
            notEmpty), wait3seconds)).getText();
        this.publicKey = await (await driver.wait(until.elementTextMatches(publicKey,
            notEmpty), wait3seconds)).getText();
    };

}
