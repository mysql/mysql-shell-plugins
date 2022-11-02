/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

import { Builder, until, By, WebDriver } from "selenium-webdriver";
import { Options, ServiceBuilder, setDefaultService } from "selenium-webdriver/chrome";

export let driver: WebDriver;

export const loadDriver = async (): Promise<void> => {
    const prom = async (): Promise<WebDriver> => {
        return new Promise( (resolve) => {
            const options: Options = new Options();

            const headless = process.env.HEADLESS ?? "1";

            let driver: WebDriver;
            options.addArguments("--no-sandbox");

            if (!process.env.CHROMEDRIVER_PATH) {
                throw new Error("Please define the chrome driver path environment variable (CHROMEDRIVER_PATH)");
            }

            setDefaultService(new ServiceBuilder(String(process.env.CHROMEDRIVER_PATH)).build());

            if(headless === String("1")) {
                options.headless().windowSize({width: 1024, height: 768});
                driver = new Builder()
                    .forBrowser("chrome")
                    .setChromeOptions(options)
                    .build();
            } else {
                driver = new Builder()
                    .forBrowser("chrome")
                    .setChromeOptions(options)
                    .build();
            }

            resolve(driver);
        });
    };

    driver = await prom();
    await driver.manage().setTimeouts({ implicit: 0 });
};

export const loadPage = async (url: String): Promise<void> => {
    await driver.get(String(url));
    await driver.wait(until.elementLocated(By.id("root")), 10000);
};
