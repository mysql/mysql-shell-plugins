/*
 * Copyright (c) 2022, 2024, Oracle and/or its affiliates.
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

//This script attaches screenshots to failed tests
//This script marks pending tests to existing bugs if there is the tag <bug:> before the test title

import * as jsdom from "jsdom";
// eslint-disable-next-line @typescript-eslint/naming-convention
const { JSDOM } = jsdom;
import * as fs from "fs";
import { join } from "path";
const baseDir = "src/tests/e2e";
const html = fs.readFileSync(join(baseDir, "test-report.html"));
const parsedHtml = new JSDOM(html, { includeNodeLocations: true });
const document = parsedHtml.window.document;

if (fs.existsSync(join(baseDir, "screenshots"))) {
    const files = fs.readdirSync(join(baseDir, "screenshots"));
    console.log(`"Processing ${files.length} screenshots..."`);
    const testTitles = document.querySelectorAll("div.failed div.test-title");
    const failedDivs = document.querySelectorAll("div.failed");

    for (const file of files) {
        for (let i = 0; i <= testTitles.length - 1; i++) {
            const domTestName = String(testTitles[i].textContent).toLowerCase().replace(/\s/g, "_");
            if (file.indexOf(domTestName) !== -1) {
                const img = document.createElement("img");
                img.src = "screenshots/" + file;
                for (let j = 0; j <= failedDivs.length - 1; j++) {
                    if (failedDivs[j].querySelector("div.test-title").textContent.toLowerCase()
                        .replace(/\s/g, "_") === domTestName) {
                        if (!failedDivs[j].querySelector("div.failureMessages img")) {
                            failedDivs[j].querySelector("div.failureMessages").appendChild(img);
                        }
                    }
                }
            }
        }
    }
} else {
    console.log("There are no screenshots to attach.");
}

fs.writeFileSync("src/tests/e2e/test-report.html", parsedHtml.serialize());
