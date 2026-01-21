/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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
/* eslint-disable no-restricted-syntax */

import { join, parse } from "path";
import { Page, chromium, errors, Locator, Browser, expect, BrowserContext } from "@playwright/test";
import * as locator from "./locators.js";
import * as constants from "./constants.js";
import * as interfaces from "./interfaces.js";
import { mysqlServerPort } from "../../../../../playwright.config.js";
import { appendFileSync, readdirSync, readFileSync, writeFileSync } from "fs";
import * as types from "./types.js";

export let page: Page;
export let browser: Browser;
export let context: BrowserContext;

export class Misc {

    public static loadPage = async (testSuite: string, mockStatus?: types.MockMigrationStatus): Promise<void> => {
        browser = await chromium.launch();
        context = await browser.newContext();
        await context.grantPermissions(["clipboard-read", "clipboard-write"]);
        page = await context.newPage();

        let feLog = "";
        if (testSuite === "Invalid config file") {
            feLog = join(process.env.CONFIG_DIR_INVALID!, `fe_${testSuite}.log`);
        } else {
            feLog = join(process.env.CONFIG_DIR_DEFAULT!, `fe_${testSuite}.log`);
        }

        writeFileSync(feLog, "");

        page.on("console", (msg) => {
            appendFileSync(feLog, `[${msg.type()}] ${msg.text()}\r\n`);
        });

        if (mockStatus) {
            await this.mockMigration(page, mockStatus);
        }

        if (testSuite === "Invalid config file") {
            // eslint-disable-next-line max-len
            await page.goto(`http://localhost:8001/?token=1234test&subApp=migration&autoSendWebMessage=1&port=${mysqlServerPort}`,
                { timeout: constants.wait1second * 60 });
        } else {
            // eslint-disable-next-line max-len
            await page.goto(`http://localhost:8000/?token=1234&subApp=migration&autoSendWebMessage=1&port=${mysqlServerPort}`,
                { timeout: constants.wait1second * 60 });
        }

        await expect.poll(async () => {
            try {
                await page.waitForSelector(locator.mainPage.sourceInfoItem,
                    { state: "visible", timeout: constants.wait1second * 10 });

                return true;
            } catch (e) {
                if (e instanceof Error) {
                    console.log(`Reloading the page for '${testSuite}' ...`);
                    await page.reload();
                }
            }
        }, { timeout: constants.wait1second * 30 }).toBe(true);

        await this.waitForLoadingIcon();
    };

    public static mockMigration = async (page: Page, status: types.MockMigrationStatus): Promise<void> => {
        if (status === constants.MockMigrationStatusEnum.Success) {
            await page.routeWebSocket(/ws:\/\/localhost:8000/, ws => {
                const server = ws.connectToServer();

                ws.onMessage((message) => {
                    const requestMessage = JSON
                        .parse(message.toString()) as Record<string, string>;

                    if (globalThis.mockMigration) {

                        if ((requestMessage.command === "migration.work_start" ||
                            requestMessage.command === "migration.work_status")) {

                            ws.send(this.getMock("response_work_status_ok", requestMessage.request_id));
                            ws.send(this.getMock("response_generic_ok", requestMessage.request_id));

                        } else {
                            server.send(message);
                        }
                    } else {
                        server.send(message);
                    }
                });

            });
        } else if (status === constants.MockMigrationStatusEnum.Running) {
            await page.routeWebSocket(/ws:\/\/localhost:8000/, ws => {
                const server = ws.connectToServer();

                ws.onMessage((message) => {
                    const requestMessage = JSON
                        .parse(message.toString()) as Record<string, string>;

                    if ((requestMessage.command === "migration.work_start" ||
                        requestMessage.command === "migration.work_status") &&
                        globalThis.mockMigration) {

                        ws.send(this.getMock("response_work_status_in_progress", requestMessage.request_id));
                        ws.send(this.getMock("response_generic_ok", requestMessage.request_id));

                    } else {
                        server.send(message);
                    }

                });

            });
        } else if (status === constants.MockMigrationStatusEnum.Aborted) {
            await page.routeWebSocket(/ws:\/\/localhost:8000/, ws => {
                const server = ws.connectToServer();

                ws.onMessage((message) => {
                    const requestMessage = JSON
                        .parse(message.toString()) as Record<string, string>;

                    if (globalThis.mockMigration) {
                        if (globalThis.mockMigrationAbort && requestMessage.command === "migration.work_status") {

                            ws.send(this.getMock("response_work_status_abort", requestMessage.request_id));
                            ws.send(this.getMock("response_generic_ok", requestMessage.request_id));
                        } else if (requestMessage.command === "migration.work_start" ||
                            requestMessage.command === "migration.work_status") {

                            ws.send(this.getMock("response_work_status_in_progress", requestMessage.request_id));
                            ws.send(this.getMock("response_generic_ok", requestMessage.request_id));
                        } else if (requestMessage.command === "migration.work_abort") {

                            globalThis.mockMigrationAbort = true;
                            ws.send(this.getMock("response_work_status_abort", requestMessage.request_id));
                            ws.send(this.getMock("response_generic_ok", requestMessage.request_id));
                        } else {
                            server.send(message);
                        }
                    } else {
                        server.send(message);
                    }
                });

            });
        } else if (status === constants.MockMigrationStatusEnum.Failed) {
            await page.routeWebSocket(/ws:\/\/localhost:8000/, ws => {
                const server = ws.connectToServer();

                ws.onMessage((message) => {
                    const requestMessage = JSON
                        .parse(message.toString()) as Record<string, string>;

                    if ((requestMessage.command === "migration.work_start" ||
                        requestMessage.command === "migration.work_status") &&
                        globalThis.mockMigration) {

                        ws.send(this.getMock("response_work_status_error", requestMessage.request_id));
                        ws.send(this.getMock("response_generic_ok", requestMessage.request_id));
                    } else {
                        server.send(message);
                    }
                });

            });
        }
    };

    public static getMock = (mockName: string, requestId: string): string => {
        const mocksPath = join(process.cwd(), "src", "tests", "e2e", "migration_assistant", "mocks");

        for (const file of readdirSync(mocksPath)) {
            if (parse(file).name === mockName) {
                const json = JSON.parse(readFileSync(join(mocksPath, file)).toString()) as Record<string, string>;
                json.request_id = requestId;

                return JSON.stringify(json);
            }
        }

        throw new Error(`Could not find mock '${mockName}'`);
    };

    public static waitForLoadingIcon = async (timeout = constants.wait1second * 30): Promise<void> => {
        const isLoading = async (wait = false): Promise<boolean> => {
            let isLoading = false;
            const loadingIcons = page.locator(locator.mainPage.loadingIcon);

            if (wait) {
                try {
                    await loadingIcons.first().waitFor({ state: "visible", timeout: constants.wait1second * 1 });
                    isLoading = true;
                } catch (e) {
                    if (!(e instanceof errors.TimeoutError)) {
                        throw e;
                    }
                }
            } else {
                if ((await loadingIcons.all()).length > 0) {
                    isLoading = true;
                    for (const loadingIcon of await loadingIcons.all()) {
                        await loadingIcon.waitFor({ state: "detached", timeout });
                    }
                }
            }

            return isLoading;
        };

        let counter = 1;

        while (counter <= 10) {
            if (counter === 1) {
                await isLoading(true);
                counter++;
            } else {
                if (!await isLoading()) {
                    return;
                } else {
                    counter++;
                }
            }

            await page.waitForTimeout(1500);
        }

        throw new Error(`At least 10 loading icons were displayed`);
    };

    public static getNotifications = async (): Promise<interfaces.INotification[]> => {
        const ntfs: interfaces.INotification[] = [];
        const notifications = await page.locator(locator.notification.exists).all();

        for (const notification of notifications) {
            const typeLocator = notification.locator(locator.notification.type).first();
            const typeLocatorClasses = (await typeLocator.getAttribute("class"))!.split(" ");
            ntfs.push({
                type: typeLocatorClasses[typeLocatorClasses.length - 1]
                    .match(/codicon-(.*)/)![1],
                message: await notification.locator(locator.notification.message).textContent(),
                close: notification.locator(locator.notification.close)
            });
        }

        return ntfs;
    };

    public static dismissNotifications = async (): Promise<void> => {
        const notifications = await this.getNotifications();
        if (notifications.length > 0) {
            for (const notification of notifications) {
                try {
                    await notification.close!.click();
                } catch {
                    // continue
                }
            }
        };
    };

    public static getSteps = async (): Promise<interfaces.IStep[] | undefined> => {
        await page.locator(locator.steps.section.root).first().waitFor({ state: "attached" });
        const genericSteps = await page.locator(locator.steps.section.root).all();

        const steps: interfaces.IStep[] = [];

        for (const step of genericSteps) {
            const toggleIcon = step.locator(locator.steps.section.toggle);
            const statusLocator = step.locator(locator.steps.section.status);
            let status: types.StepStatus | undefined;

            if (await statusLocator.count() > 0) {
                const statusClass = await statusLocator.getAttribute("class");

                if (statusClass!.includes("codicon-check")) {
                    status = constants.StepStatusEnum.Passed;
                } else if (statusClass!.includes("codicon-gear")) {
                    status = constants.StepStatusEnum.Running;
                } else if (statusClass!.includes("codicon-dash")) {
                    status = constants.StepStatusEnum.NotStarted;
                } else if (statusClass!.includes("codicon-error")) {
                    status = constants.StepStatusEnum.Failed;
                } else if (statusClass!.includes("icon-aborted")) {
                    status = constants.StepStatusEnum.Aborted;
                } else {
                    throw new Error(`Unknown status`);
                }

                let description = "";
                const commentsLocator = await step.locator(locator.steps.section.description).all();

                for (const comment of commentsLocator) {
                    description += `${await comment.textContent()}. `;
                }

                steps.push({
                    toggle: step.locator(locator.steps.section.toggle),
                    isExpanded: (await toggleIcon.getAttribute("class"))!.includes("codicon-chevron-down")
                        ? true : false,
                    caption: await step.locator(locator.steps.section.caption).textContent(),
                    status,
                    description
                });
            }

            return steps;
        };
    };

    public static selectTile = async (tileName: string): Promise<void> => {

        const waitUntilTileIsActive = async (tile: Locator) => {
            await expect.poll(async () => {
                await tile.click();
                const header = page.locator(locator.mainPage.currentHeader);

                return (await header.textContent())!.includes(tileName);
            }, { timeout: constants.wait1second * 5, message: `Tile ${tileName} was not selected` }).toBe(true);
        };

        const tilesLocator = await page.locator(locator.mainPage.tile.root).all();

        for (const tile of tilesLocator) {
            const caption = await tile.locator(locator.mainPage.tile.name).textContent();

            if (caption === tileName) {
                await waitUntilTileIsActive(tile);

                return;
            }
        }
    };

    public static existsOnClipboard = async (data: RegExp): Promise<boolean> => {
        const clipboardContent = await page!.evaluate(async () => {
            return await navigator.clipboard.readText();
        });

        return clipboardContent.match(data) !== null;
    };

    public static scrollTop = async (): Promise<void> => {
        await page.evaluate(() => {
            window.scrollTo(0, 0);
        });
    };
}
