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
import { Options } from "selenium-webdriver/chrome";

export const getDriver = async (): Promise<WebDriver> => {
    const prom = async (): Promise<WebDriver> => {
        return new Promise( (resolve) => {
            const options: Options = new Options();

            let headless = process.env.HEADLESS;
            if(!headless) {
                headless = "1";
            }

            let driver: WebDriver;
            options.addArguments("--no-sandbox");

            if(headless === String("1")) {
                options.headless().windowSize({width: 1024, height: 768});
                driver = new Builder()
                    .forBrowser("chrome")
                    .usingServer("http://localhost:4444/wd/hub")
                    .setChromeOptions(options)
                    .build();
            } else {
                driver = new Builder()
                    .forBrowser("chrome")
                    .usingServer("http://localhost:4444/wd/hub")
                    .setChromeOptions(options)
                    .build();
            }

            resolve(driver);
        });
    };
    const driver: WebDriver = await prom();
    await driver.manage().setTimeouts({ implicit: 5000 });

    return driver;
};

export const load = async (driver: WebDriver, url: String): Promise<void> => {
    await driver.get(String(url));
    await driver.wait(until.elementLocated(By.id("root")), 10000);
};


