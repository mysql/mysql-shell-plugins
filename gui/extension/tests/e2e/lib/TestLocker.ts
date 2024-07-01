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

import { driver } from "./Misc";
import { mkdirSync, rmdirSync, writeFileSync, existsSync, appendFileSync } from "fs";
import * as constants from "./constants";
import { join } from "path";

/**
 * This class locks a test. It means that other tests will wait until the current one is finished
 */
export class TestLocker {

    /** Flag to indicate if the test is locked*/
    private locked = false;

    /**
     * Locks a test
     * @param testName The test name
     * @param timeout The time to wait for a lock
     * @returns A promise resolving when the test is locked
     */
    public lockTest = async (testName: string, timeout: number): Promise<void> => {
        await driver.wait(() => {
            try {
                mkdirSync(constants.locked);
                this.locked = true;
                const now = new Date();
                this.writeLog(`LOCKED '${testName}' at ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}\n`);

                return true;
            } catch (e) {
                console.log(e);

                return false;
            }
        }, timeout, "Could not lock the test");
    };

    /**
     * Unlocks a test
     * @param testName The test name
     * @param testDuration The duration of the test
     */
    public unlockTest = (testName: string, testDuration: number): void => {
        if (this.isLocked()) {
            const now = new Date();
            let log = `unLOCKED '${testName}' at ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}.`;
            log += ` Duration: ${testDuration}ms\n`;
            this.writeLog(log);
            rmdirSync(constants.locked);
            this.locked = false;
        }
    };

    /**
     * Verifies if a test is locked
     * @returns True if a test is locked, false otherwise
     */
    public isLocked = (): boolean => {
        return this.locked === true;
    };

    private writeLog = (content: string) => {
        const logFile = join(process.cwd(), "testLocks.log");

        if (existsSync(logFile)) {
            appendFileSync(logFile, `${content}\n`);
        } else {
            writeFileSync(logFile, `${content}\n`);
        }
    };

}
