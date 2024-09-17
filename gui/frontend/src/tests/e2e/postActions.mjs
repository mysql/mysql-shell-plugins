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
const mainFile = fs.readFileSync(join(baseDir, "tests", "main", "main.spec.ts"));
const notebookFile = fs.readFileSync(join(baseDir, "tests", "dbeditor", "notebook.spec.ts"));
const dbConnectionOverviewFile = fs.readFileSync(join(baseDir, "tests", "dbeditor", "db_connection_overview.spec.ts"));
const scriptsFile = fs.readFileSync(join(baseDir, "tests", "dbeditor", "scripts.spec.ts"));
const adminFile = fs.readFileSync(join(baseDir, "tests", "dbeditor", "admin.spec.ts"));

const sessionsFile = fs.readFileSync(join(baseDir, "tests", "shell", "sessions.spec.ts"));
const guiConsoleFile = fs.readFileSync(join(baseDir, "tests", "shell", "guiconsole.spec.ts"));
const shellConnectionsFile = fs.readFileSync(join(baseDir, "tests", "shell", "shell_connections.spec.ts"));
const loginFile = fs.readFileSync(join(baseDir, "tests", "login", "login.spec.ts"));
const notificationsFile = fs.readFileSync(join(baseDir, "tests", "main", "notifications.spec.ts"));

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

const refDivs = document.querySelectorAll("div.failed, div.pending");
//Mark bugs on skipped tests
for (let i = 0; i <= refDivs.length - 1; i++) {
    const suite = refDivs[i].querySelector(".test-suitename").textContent;
    const title = refDivs[i].querySelector(".test-title").textContent;
    if (!refDivs[i].querySelector("a") || !refDivs[i].querySelector("b")) {
        let codeLines = [];

        switch (suite) {
            case "Login":
                codeLines = loginFile.toString().split("\n");
                break;
            case "Main pages":
                codeLines = mainFile.toString().split("\n");
                break;
            case "Sessions":
                codeLines = sessionsFile.toString().split("\n");
                break;
            case "MySQL Shell Connections":
                codeLines = shellConnectionsFile.toString().split("\n");
                break;
            case "GUI Console":
                codeLines = guiConsoleFile.toString().split("\n");
                break;
            case "Notebook":
                codeLines = notebookFile.toString().split("\n");
                break;
            case "Database Connections":
                codeLines = dbConnectionOverviewFile.toString().split("\n");
                break;
            case "MySQL Administration":
                codeLines = adminFile.toString().split("\n");
                break;
            case "Scripts":
                codeLines = scriptsFile.toString().split("\n");
                break;
            case "Notifications":
                codeLines = notificationsFile.toString().split("\n");
                break;
            default:
                break;
        }

        let text = "";
        for (let y = 0; y <= codeLines.length - 1; y++) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            if (codeLines[y].indexOf(String(title)) !== -1) {
                const breakLine1 = document.createElement("br");
                const breakLine2 = document.createElement("br");
                if (!refDivs[i].querySelector("a")) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    if (codeLines[y - 1].indexOf("mybug.mysql.oraclecorp.com") !== -1) {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                        text = codeLines[y - 1].match(/bug:(.*)/)[1].trim();
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
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    if (codeLines[y - 1].indexOf("reason:") !== -1) {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                        text = codeLines[y - 1].match(/reason:(.*)/)[1].trim();
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
