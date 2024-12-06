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

import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { Condition } from "selenium-webdriver";
import { SystemLocker } from "./SystemLocker.js";
import * as constants from "./constants.js";

const queueFile = join(process.cwd(), "testsQueue.txt");

/**
 * This class represents the tests queue and all its related functions
 */
export class TestQueue {

    /**
     * Gets the queue
     * @returns The queue as an array of strings
     */
    public static getQueue = (): string[] => {
        if (existsSync(queueFile)) {
            const queue = readFileSync(queueFile).toString().trim();

            if (queue.length > 0) {
                return queue.split("\n");
            }
        }

        return [];
    };

    /**
     * Pushes a test into the queue
     * @param testName The test name
     */
    public static push = async (testName: string): Promise<void> => {
        const reason = `Adding test '${testName}' to the queue`;
        const systemLocker = new SystemLocker();
        await systemLocker.lock(reason, constants.wait30seconds);
        const queue = this.getQueue();
        queue.push(testName);
        writeFileSync(queueFile, queue.join("\n"));
        systemLocker.unlock(reason);
    };

    /**
     * Pops a test from the queue
     * @param testName The test name
     */
    public static pop = async (testName: string): Promise<void> => {
        const reason = `Removing test "${testName}" from the queue`;
        const systemLocker = new SystemLocker();
        await systemLocker.lock(reason, constants.wait30seconds);
        const queue = this.getQueue();
        let newQueue: string[] = [];

        if (queue.length > 0) {
            newQueue = queue.filter((item: string) => { return item !== testName; });
        }

        writeFileSync(queueFile, newQueue.join("\n").trim());
        systemLocker.unlock(reason);
    };

    /**
     * Waits until the next test to execute in the queue is the given test
     * @param testName The test name
     * @returns A condition resolving to true when the next test to execute in the queue is the @testName
     */
    public static poll = (testName: string): Condition<boolean> => {
        return new Condition(`Waiting to poll ${testName}`, () => {
            const queue = this.getQueue();

            return queue[0] === testName;
        });
    };
}
