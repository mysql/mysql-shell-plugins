/* eslint-disable @typescript-eslint/no-unsafe-argument */
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

import { join } from "path";
import Sequencer from "@jest/test-sequencer";
const basePath = join(process.cwd(), "src", "tests", "e2e", "tests");

const testPriority = new Map([
    [join(basePath, "ui-rest.ts"), 1],
    [join(basePath, "ui-result-grids.ts"), 2],
    [join(basePath, "ui-db.ts"), 3],
    [join(basePath, "ui-clipboard.ts"), 4],
    [join(basePath, "ui-notebook.ts"), 5],
    [join(basePath, "ui-oci.ts"), 6],
    [join(basePath, "ui-shell.ts"), 7],
    [join(basePath, "ui-misc.ts"), 8],
    [join(basePath, "ui-open-editors.ts"), 9],
]);

class CustomSequencer extends Sequencer.default {
    // eslint-disable-next-line max-len
    // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility, @typescript-eslint/explicit-module-boundary-types
    sort(tests) {
        const copyTests = [...tests];

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return copyTests.sort((testA, testB) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const testAPriority = testPriority.get(testA.path);
            const testBPriority = testPriority.get(testB.path);

            return testAPriority > testBPriority ? 1 : -1;
        });
    }
}
export default CustomSequencer;
