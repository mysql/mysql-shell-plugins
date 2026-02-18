/*
 * Copyright (c) 2025, 2026, Oracle and/or its affiliates.
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
 * separately licensed software that they have either included with
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

export interface Compartment {
    compartmentId: string | null;
    id: string;
    name: string;
}

export interface IDatabaseSource {
    name: string;
    host: string;
    port: string;
    user: string;
    id: string;
}

export const generateWbCmdLineArgs = (databaseSourceJson: string) => {
    const base64 = btoa(databaseSourceJson);

    return `{"migrate": "${base64}"}`;
};

export const waitForPromise = <T>(promise: () => Promise<T>, label: string,
    maxAttempts = 60, intervalMs = 5000): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let nextRetryId: ReturnType<typeof setTimeout>;
    let attemptNum = 0;
    let error: Error | undefined;
    let timedOut = false;

    const timeoutMin = maxAttempts * intervalMs / 1000 / 60;

    return Promise.race([
        new Promise<T>((_, reject) => {
            timeoutId = setTimeout(() => {
                clearTimeout(nextRetryId);
                timedOut = true;
                reject(new Error(`waitForPromise ${label} timed out after ${timeoutMin} minutes`));
            }, maxAttempts * intervalMs);
        }),
        new Promise<T>((resolve, reject) => {
            const tryPromise = () => {
                attemptNum++;
                const currentAttempt = attemptNum;
                console.log(`waitForPromise ${label} attempt #${currentAttempt}...`);
                promise().then((result) => {
                    clearTimeout(timeoutId);
                    error = undefined;
                    console.log(`waitForPromise ${label} attempt #${currentAttempt} SUCCEEDED`);
                    resolve(result);
                }).catch((e: unknown) => {
                    error = e as Error;
                    console.warn(`waitForPromise ${label} attempt #${currentAttempt} FAILED`, e);
                }).finally(() => {
                    if (timedOut) {
                        console.debug(`waitForPromise ${label} attempt #${currentAttempt} FINISHED with timeout`);
                    } else if (currentAttempt >= maxAttempts) {
                        let message = `waitForPromise ${label} failed after ${currentAttempt} attempts`;
                        if (error) {
                            message += `, last error: ${error.message}`;
                        }
                        reject(new Error(message));
                    } else if (error) {
                        nextRetryId = setTimeout(tryPromise, intervalMs);
                    }
                });
            };

            tryPromise();
        })
    ]);
};

type FlatObject = Record<string, unknown>;

/**
 * Flattens a nested object or array into a single-level object with dot-separated keys.
 *
 * @param obj - The object or array to flatten.
 * @param prefix - The prefix for the keys (used for recursion).
 * @returns A flat object with dot-separated keys.
 */
export const flattenObject = (obj: unknown, prefix = ""): FlatObject => {
    const result: FlatObject = {};

    if (typeof obj !== "object" || obj === null) {
        result[prefix] = obj;

        return result;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
        // obj.forEach((item, index) => {
        //     const path = prefix ? `${prefix}[${index}]` : `${index}`;
        //     Object.assign(result, flattenObject(item, path));
        // });

        return result;
    }

    // Handle objects
    for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
            Object.assign(result, flattenObject(value, path));
        } else {
            result[path] = value;
        }
    }

    return result;
};

/**
 * Format number of seconds as human readable estimated time for completion.
 *
 * @param seconds approximate number of seconds until completion
 * @returns Formatted time text
 */
export const formatEta = (seconds: number | null): string | undefined => {
    if (!seconds) {
        return undefined;
    }
    if (seconds <= 60) {
        return "less than 1 minute left";
    }

    const totalMinutes = Math.round(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    const parts = [];
    if (hours > 0) {
        parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
    }
    if (minutes > 0 || hours === 0) {
        parts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
    }

    return `about ${parts.join(" ")} left`;
};
