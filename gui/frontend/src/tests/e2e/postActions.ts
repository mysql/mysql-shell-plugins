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
//This script marks failed tests to existing bugs if there is the tag <bug:> before the test title

import * as jsdom from "jsdom";
// eslint-disable-next-line @typescript-eslint/naming-convention
const { JSDOM } = jsdom;
import * as fs from "fs";
import { join } from "path";
const baseDir = "src/tests/e2e";
const html = fs.readFileSync(join(baseDir, "test-report.html"));
const mainFile = fs.readFileSync(join(baseDir, "tests", "main.spec.ts"));
const profilesFile = fs.readFileSync(join(baseDir, "tests", "profiles.spec.ts"));
const dbEditorFile = fs.readFileSync(join(baseDir, "tests", "dbeditor.spec.ts"));
const shellFile = fs.readFileSync(join(baseDir, "tests", "shell.spec.ts"));
const loginFile = fs.readFileSync(join(baseDir, "tests", "login.spec.ts"));

if (fs.existsSync(join(baseDir, "screenshots"))) {
    const files = fs.readdirSync(join(baseDir, "screenshots"));
    console.log(`"Processing ${files.length} screenshots..."`);
    const parsedHtml = new JSDOM(html, { includeNodeLocations: true });
    const document = parsedHtml.window.document;
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
                        if (!failedDivs[j].querySelector("div.failureMessages a")) {
                            //Mark test with existing bug
                            console.log(`Marking '${String(testTitles[i].textContent)}' with existing bug`);
                            const suite = failedDivs[j].querySelector("div.test-suitename")?.textContent;
                            let codeLines: string[] = [];
                            switch(suite) {
                                case "Profiles":
                                    codeLines = profilesFile.toString().split("\n");
                                    break;
                                case "Login":
                                    codeLines = loginFile.toString().split("\n");
                                    break;
                                case "Main pages":
                                    codeLines = mainFile.toString().split("\n");
                                    break;
                                case "MySQL Shell Sessions":
                                    codeLines = shellFile.toString().split("\n");
                                    break;
                                case "DB Editor":
                                case "DB Editor > SQL Database connections":
                                    codeLines = dbEditorFile.toString().split("\n");
                                    break;
                                default:
                                    break;
                            }

                            let bugLink = "";
                            for(let y=0; y <= codeLines.length-1; y++) {
                                if (codeLines[y].indexOf(String(testTitles[i].textContent)) !== -1) {
                                    if (codeLines[y-1].indexOf("mybug.mysql.oraclecorp.com") !== -1) {
                                        bugLink = codeLines[y-1].replace("// bug: ", "").trim();
                                        const htmlLink = document.createElement("a");
                                        const breakLine1 = document.createElement("br");
                                        htmlLink.href = bugLink;
                                        htmlLink.text = "---->  HAS A BUG  <-----";
                                        htmlLink.target = "_blank";

                                        failedDivs[j].querySelector("div.failureMessages")!
                                            .insertBefore(htmlLink,
                                                failedDivs[j].querySelector("div.failureMessages")!.firstChild);

                                        failedDivs[j].querySelector("div.failureMessages")!
                                            .insertBefore(breakLine1,
                                                failedDivs[j].querySelector("div.failureMessages")!.firstChild);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    fs.writeFileSync("src/tests/e2e/test-report.html", parsedHtml.serialize());
} else {
    console.log("There are no screenshots to attach.");
}
