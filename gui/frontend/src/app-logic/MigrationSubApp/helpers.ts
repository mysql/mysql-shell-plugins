/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

import { ISelectOption } from "./FormGroup.js";

export interface Compartment {
    compartmentId: string | null;
    id: string;
    name: string;
}

/**
 * Builds a tree structure from a flat array of compartments.
 *
 * @param flat - The flat array of compartments.
 * @returns A tree structure with nested children.
 */
const buildTree = (flat: Compartment[]): Array<Compartment & { children?: Compartment[] }> => {
    const nodes: Record<string, Compartment & { children?: Compartment[] }> = {};
    flat.forEach(item => {
        nodes[item.id] = { ...item, children: [] };
    });

    const tree: Array<Compartment & { children?: Compartment[] }> = [];
    flat.forEach(item => {
        if (item.compartmentId && nodes[item.compartmentId]) {
            nodes[item.compartmentId].children!.push(nodes[item.id]);
        } else {
            tree.push(nodes[item.id]);
        }
    });

    return tree;
};

/**
 * Converts a tree structure into a flat array of options with hierarchical labels.
 *
 * @param nodes - The tree structure of compartments.
 * @param level - The current depth level in the tree (default is 0).
 * @returns A flat array of options with value and label properties.
 */
const treeToOptions = (
    nodes: Array<Compartment & { children?: Compartment[] }>,
    level = 0
) => {
    let options: ISelectOption[] = [];
    nodes.forEach(node => {
        options.push({
            id: node.id,
            label: `${"—".repeat(level)}${node.name}`,
        });
        if (node.children?.length) {
            options = options.concat(treeToOptions(node.children, level + 1));
        }
    });

    return options;
};

export const convertCompartments = (compartments: Compartment[]) => {
    const tree = buildTree(compartments);

    return treeToOptions(tree);
};

export const waitForPromise = <T>(promise: () => Promise<T>, label: string,
    maxAttempts = 60, intervalMs = 5000): Promise<T> => {
    let intervalId: ReturnType<typeof setInterval>;
    let attemptNum = 0;
    let error: Error | undefined;

    const timeoutMin = maxAttempts * intervalMs / 1000 / 60;

    return Promise.race([
        new Promise<T>((_, reject) => {
            setTimeout(() => {
                clearInterval(intervalId);
                reject(new Error(`waitForPromise ${label} timed out after ${timeoutMin} minutes`));
            }, maxAttempts * intervalMs);
        }),
        new Promise<T>((resolve, reject) => {
            const tryPromise = () => {
                attemptNum++;
                console.log(`waitForPromise ${label} attempt #${attemptNum}...`);
                void promise().then((result) => {
                    console.log(`waitForPromise ${label} attempt #${attemptNum} SUCCEEDED`);
                    error = undefined;
                    clearInterval(intervalId);
                    resolve(result);
                }).catch((e: unknown) => {
                    error = e as Error;
                    console.warn(`waitForPromise ${label} attempt #${attemptNum} FAILED`, e);
                }).finally(() => {
                    if (attemptNum >= maxAttempts) {
                        clearInterval(intervalId);
                        let message = `waitForPromise ${label} failed after ${attemptNum} attempts`;
                        if (error) {
                            message += `, last error: ${error.message}`;
                        }
                        reject(new Error(message));

                        return;
                    }
                });
            };

            tryPromise();
            if (maxAttempts > 1) {
                intervalId = setInterval(tryPromise, intervalMs);
            }
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
