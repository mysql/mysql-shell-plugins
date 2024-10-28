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

import { mkdirSync, rmdirSync, writeFileSync, existsSync, appendFileSync } from "fs";
import { join } from "path";
import { driver } from "./driver.js";
import * as constants from "./constants.js";

/**
 * This class locks the testing system by creating a folder in the file system.
 * It is used for parallel execution of the tests that use the system clipboard
 */
export class SystemLocker {

    /** Flag to indicate if the resource is locked*/
    private locked = false;

    /**
     * Creates the lock / Creates the lock folder
     * @param reason The reason to lock the system
     * @param timeout The time to wait for a lock
     * @returns A promise resolving when the system is locked
     */
    public lock = async (reason: string, timeout: number): Promise<void> => {
        await driver.wait(() => {
            try {
                mkdirSync(constants.lockFlag);
                this.locked = true;
                const now = new Date();
                this.log(`LOCKED: "${reason}" at ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`);

                return true;
            } catch (e) {
                console.log(e);

                return false;
            }
        }, timeout, "Could not lock the system");
    };

    /**
     * Removes the lock / Removes the lock folder
     * @param reason The reason to unlock the system
     * @param testDuration The duration of the lock
     */
    public unlock = (reason: string, testDuration?: number): void => {
        if (this.isLocked()) {
            const now = new Date();
            let log = `unLOCKED: "${reason}" at ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}\n`;

            if (testDuration) {
                log += ` Duration: ${testDuration}ms\n`;
            }

            this.log(log);
            rmdirSync(constants.lockFlag);
            this.locked = false;
        }
    };

    /**
     * Verifies if the system is locked
     * @returns True if the system is locked, false otherwise
     */
    public isLocked = (): boolean => {
        return this.locked === true;
    };

    /**
     * Writes to the log file
     * @param content The content to write
     */
    private log = (content: string) => {
        const logFile = join(process.cwd(), "systemLocks.log");

        if (existsSync(logFile)) {
            appendFileSync(logFile, `${content}\n`);
        } else {
            writeFileSync(logFile, `${content}\n`);
        }
    };

}
