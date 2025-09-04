
/*
 * Copyright (c) 2024, 2025, Oracle and/or its affiliates.
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

import { join } from "path";
import { BaseSequencer, type TestSpecification } from "vitest/node";

// eslint-disable-next-line no-restricted-syntax
const basePath = join(process.cwd(), "src", "tests", "e2e", "tests");

const testPriority = new Map([
    [join(basePath, "ui-rest.ts"), 1],
    [join(basePath, "ui-result-grids.ts"), 2],
    [join(basePath, "ui-db.ts"), 3],
    [join(basePath, "ui-notebook.ts"), 4],
    [join(basePath, "ui-misc.ts"), 5],
    [join(basePath, "ui-clipboard.ts"), 6],
    [join(basePath, "ui-oci.ts"), 7],
    [join(basePath, "ui-shell.ts"), 8],
    [join(basePath, "ui-open-editors.ts"), 9],
]);

export class CustomSequencer extends BaseSequencer {

    public override sort(tests: TestSpecification[]): Promise<TestSpecification[]> {
        const copyTests = [...tests];

        return Promise.resolve(copyTests.sort((testA, testB) => {

            const testAPriority = testPriority.get(testA.moduleId) ?? Number.MAX_SAFE_INTEGER;
            const testBPriority = testPriority.get(testB.moduleId) ?? Number.MAX_SAFE_INTEGER;

            return testAPriority > testBPriority ? 1 : -1;
        }));
    }
}
