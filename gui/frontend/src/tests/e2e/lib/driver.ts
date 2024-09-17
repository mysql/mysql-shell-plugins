/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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

import {
    Builder, WebDriver, logging, Browser,
} from "selenium-webdriver";
import { Options, ServiceBuilder } from "selenium-webdriver/chrome.js";
export let driver: WebDriver;

const outDir = process.env.USERPROFILE ?? process.env.HOME;

/**
 * Loads the webdriver object
 * @param useHeadless True to run tests in background
 * @returns A promise resolving when the webdriver is loaded
 */
export const loadDriver = async (useHeadless?: boolean): Promise<void> => {
    const logger = logging.getLogger("webdriver");
    logger.setLevel(logging.Level.INFO);
    logging.installConsoleHandler();

    const options = new Options();
    options.addArguments("--no-sandbox");
    options.addArguments("--disable-dev-shm-usage");
    options.addArguments("--disable-gpu");
    options.addArguments("--disable-infobars");
    options.addArguments("--disable-features=NetworkService");
    options.addArguments("--disable-features=VizDisplayCompositor");

    options.setUserPreferences({
        download: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            default_directory: `${String(outDir)}`,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            prompt_for_download: "false",
        },
        profile: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            content_settings: {
                exceptions: {
                    clipboard: {
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        "http://localhost,*":
                        {
                            expiration: "0",
                            // eslint-disable-next-line @typescript-eslint/naming-convention
                            last_modified: Date.now(),
                            model: 0,
                            setting: 1,
                        },
                    },
                },
            },
        },
    });

    let headless: string;

    if (useHeadless === undefined) {
        headless = process.env.HEADLESS ?? "1"; // headless is enabled by default
    } else {
        if (useHeadless === true) {
            headless = "1";
        } else {
            headless = "0";
        }
    }

    if (headless === "1") {
        options.headless().windowSize({ width: 1024, height: 768 });
    }

    if (process.env.CHROMEDRIVER_PATH) {
        const builder = new ServiceBuilder(process.env.CHROMEDRIVER_PATH);
        driver = await new Builder()
            .forBrowser(Browser.CHROME)
            .setChromeOptions(options)
            .setChromeService(builder)
            .build();
    } else {
        driver = await new Builder()
            .forBrowser(Browser.CHROME)
            .setChromeOptions(options)
            .build();
    }

    if (headless === "0") {
        await driver.manage().window().maximize();
    }

    await driver.manage().setTimeouts({ implicit: 0, pageLoad: 15000 });
};
