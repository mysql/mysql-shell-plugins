/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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
const mainFile = fs.readFileSync(join(baseDir, "tests", "main.spec.ts"));
const profilesFile = fs.readFileSync(join(baseDir, "tests", "profiles.spec.ts"));
const dbEditorFile = fs.readFileSync(join(baseDir, "tests", "dbeditor.spec.ts"));
const shellFile = fs.readFileSync(join(baseDir, "tests", "shell.spec.ts"));
const loginFile = fs.readFileSync(join(baseDir, "tests", "login.spec.ts"));

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
                    if (failedDivs[j].querySelector("div.test-title")!.textContent!.toLowerCase()
                        .replace(/\s/g, "_") === domTestName) {
                        if (!failedDivs[j].querySelector("div.failureMessages img")) {
                            failedDivs[j].querySelector("div.failureMessages")!.appendChild(img);
                        }
                    }
                }
            }
        }
    }
} else {
    console.log("There are no screenshots to attach.");
}

const refDivs = document.querySelectorAll("div.failed, div.pending");
//Mark bugs on skipped tests
for (let i=0; i <= refDivs.length-1; i++) {
    const suite = refDivs[i].querySelector(".test-suitename")!.textContent;
    const title = refDivs[i].querySelector(".test-title")!.textContent;
    if (!refDivs[i].querySelector("a") || !refDivs[i].querySelector("b")) {
        let codeLines: string[] = [];
        switch(true) {
            case (/Profiles/).test(String(suite)):
                codeLines = profilesFile.toString().split("\n");
                break;
            case (/Login/).test(String(suite)):
                codeLines = loginFile.toString().split("\n");
                break;
            case (/Main pages/).test(String(suite)):
                codeLines = mainFile.toString().split("\n");
                break;
            case (/MySQL Shell Sessions/).test(String(suite)):
                codeLines = shellFile.toString().split("\n");
                break;
            case (/DB Editor/).test(String(suite)):
                codeLines = dbEditorFile.toString().split("\n");
                break;
            default:
                break;
        }

        let text = "";
        for (let y=0; y <= codeLines.length-1; y++) {
            if (codeLines[y].indexOf(String(title)) !== -1) {
                const breakLine1 = document.createElement("br");
                const breakLine2 = document.createElement("br");
                if (!refDivs[i].querySelector("a")) {
                    if (codeLines[y-1].indexOf("mybug.mysql.oraclecorp.com") !== -1) {
                        text = codeLines[y-1].match(/bug:(.*)/)![1].trim();
                        const htmlEl = document.createElement("a");
                        htmlEl.href = text;
                        htmlEl.text = "---->  HAS A BUG  <-----";
                        htmlEl.target = "_blank";

                        refDivs[i]
                            .insertBefore(breakLine1,
                                refDivs[i].firstChild);

                        refDivs[i]
                            .insertBefore(breakLine2,
                                refDivs[i].firstChild);

                        refDivs[i]
                            .insertBefore(htmlEl,
                                refDivs[i].firstChild);

                        console.log(`Marked '${String(title)}' with existing bug`);
                        break;
                    }
                }
                if (!refDivs[i].querySelector("b")) {
                    if (codeLines[y-1].indexOf("reason:") !== -1) {
                        text = codeLines[y-1].match(/reason:(.*)/)![1].trim();
                        const htmlEl = document.createElement("b");
                        htmlEl.textContent = `Skipped Reason: ${text}`;

                        refDivs[i]
                            .insertBefore(breakLine1,
                                refDivs[i].firstChild);

                        refDivs[i]
                            .insertBefore(breakLine2,
                                refDivs[i].firstChild);

                        refDivs[i]
                            .insertBefore(htmlEl,
                                refDivs[i].firstChild);

                        console.log(`Marked '${String(title)}' with skipped reason`);
                        break;
                    }
                }
            }
        }
    }
}
fs.writeFileSync("src/tests/e2e/test-report.html", parsedHtml.serialize());
