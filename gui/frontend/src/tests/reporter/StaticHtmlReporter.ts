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

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

import { RunnerTestFile, type TestAnnotation, type UserConsoleLog } from "vitest";
import type {
    ReportedHookContext, Reporter, SerializedError, TestCase, TestModule, TestRunEndReason, TestSuite, Vitest
} from "vitest/node";

const dir = path.dirname(fileURLToPath(import.meta.url));
const css = readFileSync(path.resolve(dir, "StaticHtmlReporter.css"), "utf-8");

const toCustomISOString = (date: Date): string => {
    const pad = (n: number) => {
        return n < 10 ? `0${n}` : n;
    };

    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} `
        + `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
};

export class StaticHtmlReporter implements Reporter {
    private startTime: Date;
    private outputFile: string;

    public constructor(private name = "Vitest Static HTML Reporter") {
    }

    public onTestRunEnd(testModules: readonly TestModule[], unhandledErrors: readonly SerializedError[],
        _reason: TestRunEndReason
    ): void {
        let totalTests = 0;
        let passedTests = 0;
        let failedTests = 0;
        let skippedTests = 0;

        let passedModules = 0;
        let failedModules = 0;
        let skippedModules = 0;

        const testRunResults: string[] = [];
        const screenshotDir = "../../src/tests/e2e/screenshots";

        const processSuite = (suite: TestSuite): string => {
            switch (suite.state()) {
                case "passed":
                    ++passedModules;
                    break;

                case "failed":
                    ++failedModules;
                    break;

                case "skipped":
                    ++skippedModules;
                    break;

                default:
            }

            const entries: string[] = [];
            for (const child of suite.children) {
                if (child.type === "test") {
                    const result = child.result();
                    ++totalTests;
                    if (result.state === "passed") {
                        ++passedTests;
                    } else if (result.state === "failed") {
                        ++failedTests;
                    } else if (result.state === "skipped") {
                        ++skippedTests;
                    }

                    const safeName = child.name.replace(/[^\w\d\-_.]/g, "_");
                    const imgPath = path.join(screenshotDir, `${safeName}.png`);

                    let imgHtml = "";
                    let errorHtml = "";
                    if (result.state === "failed" || result.state === "skipped") {

                        if (result.errors && result.errors.length > 0) {
                            result.errors.forEach((err) => {
                                errorHtml += `
                                <div class="error-message">
                                    <pre>${err.message}</pre>
                                    <pre>${err.stack}</pre>
                                </div>`;
                            });
                        }

                        suite.errors().forEach((err) => {
                            errorHtml += `Error thrown outside of this test (e.g. in a hook):
                                <div class="error-message">
                                    <pre>${err.message}</pre>
                                    <pre>${err.stack}</pre>
                                </div>`;
                        });

                        if (existsSync(path.join(path.resolve("src/tests/e2e/screenshots"), `${safeName}.png`))) {
                            imgHtml = `<img src="${imgPath}" class="screenshot" />`;
                        }

                    }

                    const slow = child.diagnostic()?.slow;
                    const time = (child.diagnostic()?.duration ?? 0).toFixed(2);
                    entries.push(`
                        <div class="test-result ${result.state}">
                            <div class="test-info">
                                <div class="test-title">${child.name}</div>
                                <div class="test-status ${result.state}">${result.state}</div>
                                <div class="test-duration${slow ? " warn" : ""}">${time} ms</div>
                            </div>
                            <div class="error-info">${errorHtml}</div>
                            <div>${imgHtml}</div>
                        </div>
                    `);

                } else {
                    // Recursively process nested suites.
                    entries.push(processSuite(child));
                }
            };

            let htmlSuiteErrors = "";
            const errors = suite.errors();
            if (errors.length > 0) {
                const suiteErrors: string[] = [];

                const safeName = suite.name.replace(/[^\w\d\-_.]/g, "_");
                const imgPath = path.join(screenshotDir, `${safeName}.png`);
                let imgHtml: string | undefined;

                if (existsSync(path.join(path.resolve("src/tests/e2e/screenshots"), `${safeName}.png`))) {
                    imgHtml = `<img src="${imgPath}" class="screenshot" />`;
                }

                errors.forEach((err) => {
                    if (imgHtml) {
                        suiteErrors.push(`
                            <div class="error-message">
                                <pre>${err.stack}</pre>
                                <pre>${imgHtml}</pre>
                            </div>
                        `);
                    } else {
                        suiteErrors.push(`
                            <div class="error-message">
                                <pre>${err.stack}</pre>
                            </div>
                        `);
                    }
                });

                htmlSuiteErrors += `
                    <div class="suite-errors">
                        <h2>Suite Errors</h2>
                        ${suiteErrors.join("\n")}
                    </div>
                `;
            }

            const suiteFileName = path.basename(suite.module.moduleId);
            const content = `
                <input id="collapsible-${suite.id}" class="toggle" type="checkbox" checked />
                <label for="collapsible-${suite.id}">
                    <div class="suite-info">
                        <div class="suite-path">Suite: ${suite.name} (${suiteFileName})</div>
                        <div class="suite-time">${(suite.module.diagnostic().duration).toFixed(2)} ms</div>
                    </div>
                    ${htmlSuiteErrors}
                </label>
                <div class="suite-tests">
                    ${entries.join("\n")}
                </div>
            `;

            return `<div class="suite">${content}</div>`;
        };

        for (const mod of testModules) {
            const entries: string[] = [];

            const errors = mod.errors();
            if (errors.length > 0) {
                const moduleErrors: string[] = [];
                errors.forEach((err) => {
                    moduleErrors.push(`
                        <div class="error-message">
                            <pre>${err.stack}</pre>
                        </div>
                    `);
                });

                testRunResults.push(`
                    <div class="module-errors">
                        <h2>Errors in module ${mod.moduleId}</h2>
                        ${moduleErrors.join("\n")}
                    </div>
                `);
            }

            // All imported files and their load times.
            const diagnostic = mod.diagnostic();
            const imports = diagnostic.importDurations;

            for (const [name, duration] of Object.entries(imports)) {
                entries.push(`
                    <div class="grid-row">
                        <div class="cell import-path">${name}</div>
                        <div class="cell self-time">${duration.selfTime.toFixed(2)} ms</div>
                        <div class="cell total-time">${duration.totalTime.toFixed(2)} ms</div>
                    </div>
                `);
            }

            testRunResults.push(`
                <div class="module">
                    <input id="collapsible-${mod.id}" class="toggle" type="checkbox" unchecked />
                    <label for="collapsible-${mod.id}">
                        <div class="module-info">
                            <span class="module-title">Test Module - imported files:</span>
                            <span class="module-time">
                                env setup ${diagnostic.environmentSetupDuration.toFixed(2)} ms,
                                prepare ${diagnostic.prepareDuration.toFixed(2)} ms,
                                collection ${diagnostic.collectDuration.toFixed(2)} ms,
                                setup ${diagnostic.setupDuration.toFixed(2)} ms
                                total ${diagnostic.duration.toFixed(2)} ms
                            </span>
                        </div>
                    </label>
                    <div class="grid module-imports">
                        <div class="grid-header">Module Name</div>
                        <div class="grid-header self-time">Self Time</div>
                        <div class="grid-header total-time">Total Time</div>
                        ${entries.join("\n")}
                    </div>
                </div>
            `);

            for (const child of mod.children) {
                if (child.type === "suite") {
                    const suiteHtml = processSuite(child);
                    testRunResults.push(suiteHtml);
                }
            }

        }

        // Report any unhandled errors that were not associated with a specific test.
        if (unhandledErrors.length > 0) {
            const errors: string[] = [];
            unhandledErrors.forEach((err) => {
                errors.push(`
                        <div class="error-message">
                            <pre>${err.message}</pre>
                            <pre>${err.stack}</pre>
                        </div>
                    `);
            });

            testRunResults.push(`
                    <div class="unhandled-errors">
                        <h2>Unhandled Errors</h2>
                        ${errors.join("\n")}
                    </div>
                `);
        }

        const html = `
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>${this.name}</title>
        <link rel="stylesheet" href="style.css">
        <meta http-equiv="Content-Security-Policy"
        content="default-src *; img-src http: https: data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; 
        style-src 'unsafe-inline' http: https: data: *;">
    </head>

    <body>
        <h1 id="title">${this.name}</h1>
        <div class="metadata-container"">
            <div id="timestamp">Started: ${toCustomISOString(this.startTime)}</div>
        </div>
        <div id="summary">
            <div id="suite-summary">
                <div id="summary-total">Suites (${testModules.length})</div>
                <div class="pass">${passedModules} passed</div>
                <div class="fail">${failedModules} failed</div>
                <div class="skip">${skippedModules} skipped</div>
            </div>
            <div id="test-summary">
                <div id="summary-total">Tests (${totalTests})</div>
                <div class="pass">Passed: ${passedTests}</div>
                <div class="fail">Failed: ${failedTests}</div>
                <div class="skip">Skipped: ${skippedTests}</div>
            </div>
        </div>
        <div id="test-run-results">
            ${testRunResults.join("\n")}
        </div>
    </body>
</html>
`;

        // Ensure the output directory exists.
        const dirname = path.dirname(this.outputFile);
        mkdirSync(dirname, { recursive: true });
        writeFileSync(this.outputFile, html, "utf-8");
        const cssFile = path.resolve(path.join(dirname, "style.css"));
        writeFileSync(cssFile, css, "utf-8");

        console.log(`\n Static HTML report written to: ${this.outputFile}\n`);
    };

    public onTestSuiteResult(testSuite: TestSuite): void {
        // No-op, we handle everything in onTestRunEnd
        //console.log("test suite result");
    }

    public onTestRunStart(): void {
        this.startTime = new Date();
    }

    public onWatcherStart(files?: RunnerTestFile[], errors?: unknown[]): void {
        // console.log("watcher start");
    }

    public onWatcherRerun(files: string[], trigger?: string): void {
        // console.log("watcher rerun");
    }

    public onServerRestart(reason?: string): void {
        // console.log("server restart");
    }

    public onUserConsoleLog(log: UserConsoleLog): void {
        // console.log("user log");
    }

    public onProcessTimeout(): PromiseLike<void> | void {
        // console.log("process timeout");
    }

    public onTestModuleQueued(testModule: TestModule): void {
        // console.log("test module queued");
    }

    public onTestModuleCollected(testModule: TestModule): void {
        // console.log("test module collected");
    }

    public onTestModuleStart(testModule: TestModule): PromiseLike<void> | void {
        // console.log("test module start");
    }

    public onTestModuleEnd(testModule: TestModule): void {
        // console.log("test module end");
    }

    public onTestCaseReady(testCase: TestCase): void {
        // console.log("test case ready");
    }

    public onTestCaseResult(testCase: TestCase): void {
        // console.log("test case result");
    }

    public onTestCaseAnnotate(testCase: TestCase, annotation: TestAnnotation): PromiseLike<void> | void {
        // console.log("test case annotate");
    }

    public onTestSuiteReady(testSuite: TestSuite): PromiseLike<void> | void {
        // console.log("test suite ready");
    }

    public onHookStart(hook: ReportedHookContext): void {
        // console.log("hook start");
    }

    public onHookEnd(hook: ReportedHookContext): void {
        // console.log("hook end");
    }

    public onCoverage(coverage: unknown): PromiseLike<void> | void {
        // console.log("coverage");
    }

    public onInit(ctx: Vitest): void {
        // console.log("init");
        const output = ctx.getRootProject().config.outputFile;
        if (typeof output === "string" && output.length > 0) {
            this.outputFile = output;
        } else {
            this.outputFile = path.resolve("test-report/index.html");
        }
    }

}
