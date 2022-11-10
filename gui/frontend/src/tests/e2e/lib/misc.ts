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

import { platform } from "os";
import { By, until, Key, WebElement, Builder, WebDriver } from "selenium-webdriver";
import { Options, ServiceBuilder, setDefaultService } from "selenium-webdriver/chrome";

export let driver: WebDriver;
export const explicitWait = 5000;

/**
 * DB Connection interface
 *
 */
export interface IDBConnection {
    dbType: string | undefined;
    caption: string;
    description: string;
    hostname: string;
    protocol: string;
    port: string;
    portX: string | undefined;
    username: string;
    password: string;
    schema: string;
    sslMode: string | undefined;
    sslCA: string | undefined;
    sslClientCert: string | undefined;
    sslClientKey: string | undefined;
}

export class Misc {

    /**
     * Loads the webdriver object
     *
     * @returns A promise resolving when the webdriver is loaded
     */
    public static loadDriver = async (): Promise<void> => {
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

    /**
     * Waits until a page loads
     *
     * @param url URL of the page
     * @returns A promise resolving when the page is loaded
     */
    public static loadPage = async (url: String): Promise<void> => {
        await driver.get(String(url));
        await driver.wait(until.elementLocated(By.id("root")), 10000);
    };

    /**
     * Waits for the homepage to be loaded
     *
     * @returns A promise resolving when the homepage is loaded.
     */
    public static waitForHomePage = async (): Promise<void> => {
        await driver.wait(until.elementLocated(By.id("mainActivityBar")), 10000, "Blank page was displayed");
    };

    /**
     * Waits for the login page to be loaded
     *
     * @returns A promise resolving when the login page is loaded
     */
    public static waitForLoginPage = async (): Promise<void> => {
        await driver.findElement(By.id("loginDialogSakilaLogo"));
    };

    /**
     * Returns the background color of the page
     *
     * @returns Promise resolving to the background color
     */
    public static getBackgroundColor = async (): Promise<string> => {
        const script =
        "return window.getComputedStyle(document.documentElement).getPropertyValue('--background'); ";

        return driver.executeScript(script);
    };

    /**
     * Press the combination keys to execute a statement on the DB Editor or Shell session (CTRL+ENTER)
     *
     * @returns Promise resolving when the key combination is pressed
     */
    public static pressEnter = async (): Promise<void> => {
        if (platform() === "win32") {
            await driver
                .actions()
                .keyDown(Key.CONTROL)
                .keyDown(Key.ENTER)
                .keyUp(Key.CONTROL)
                .keyUp(Key.ENTER)
                .perform();
        } else if (platform() === "darwin") {
            await driver
                .actions()
                .keyDown(Key.COMMAND)
                .keyDown(Key.ENTER)
                .keyUp(Key.COMMAND)
                .keyUp(Key.ENTER)
                .perform();
        }
    };

    /**
     * Writes an SQL query and executes it
     *
     * @param textArea text area to send the query
     * @param cmd command to execute
     * @param timeout wait for results
     * @returns Promise resolving when the command is executed
     */
    public static execCmd = async (textArea: WebElement, cmd: string, timeout?: number): Promise<void> => {
        cmd = cmd.replace(/(\r\n|\n|\r)/gm, "");
        const prevBlocks = await driver.findElements(By.css(".zoneHost"));
        await textArea.sendKeys(cmd);
        if (cmd.indexOf("\\") !== -1) {
            const codeMenu = await driver.findElements(By.css("div.contents"));
            if (codeMenu.length > 0) {
                await textArea.sendKeys(Key.ENTER);
            }
        } else {
            await textArea.sendKeys(Key.ENTER);
        }

        await Misc.pressEnter();

        if (!timeout) {
            timeout = 10000;
        }

        if (cmd !== "\\q" && cmd !== "\\d") {
            await driver.wait(async () => {
                const blocks = await driver.findElements(By.css(".zoneHost"));

                return blocks.length > prevBlocks.length;
            }, timeout, "Command '" + cmd + "' did not triggered a new results block");
        }
    };

    /**
     * Returns the css computed style of an element
     *
     * @param element The Element
     * @param style The style
     * @returns A promise resolving with the element style
     */
    public static getElementStyle = async (element: WebElement, style: string): Promise<string> => {
        return driver.executeScript("return window.getComputedStyle(arguments[0])." + style, element);
    };

    /**
     * Converts and RGB code to hex
     *
     * @param r value
     * @param g value
     * @param b value
     * @returns A promise resolving with the hex value
     */
    public static rgbToHex = (r: string, g: string, b: string): string => {

        const componentToHex = (c: number) => {
            const hex = c.toString(16);

            return hex.length === 1 ? "0" + hex : hex;
        };

        const result = "#" + componentToHex(parseInt(r, 10)) +
        componentToHex(parseInt(g, 10)) + componentToHex(parseInt(b, 10));

        return result.toUpperCase();
    };

    /**
     * Sets the password for a connection, on the Password dialog
     *
     * @param dbConfig connection object
     * @returns A promise resolving when the password is set
     */
    public static setPassword = async (dbConfig: IDBConnection): Promise<void> => {
        const dialog = await driver.wait(until.elementsLocated(By.css(".passwordDialog")),
            500, "No Password dialog was found");

        const title = await dialog[0].findElement(By.css(".title .label"));
        const gridDivs = await dialog[0].findElements(By.css("div.grid > div"));

        let service;
        let username;
        for (let i = 0; i <= gridDivs.length - 1; i++) {
            if (await gridDivs[i].getText() === "Service:") {
                service = await gridDivs[i + 1].findElement(By.css(".resultText span")).getText();
            }
            if (await gridDivs[i].getText() === "User Name:") {
                username = await gridDivs[i + 1].findElement(By.css(".resultText span")).getText();
            }
        }

        expect(service).toBe(`${String(dbConfig.username)}@${String(dbConfig.hostname)}:${String(dbConfig.port)}`);
        expect(username).toBe(dbConfig.username);

        expect(await title.getText()).toBe("Open MySQL Connection");

        await dialog[0].findElement(By.css("input")).sendKeys(String(dbConfig.password));
        await dialog[0].findElement(By.id("ok")).click();
    };

    /**
     * Sets the confirm dialog value, for a password storage
     *
     * @param dbConfig connection object
     * @param value yes/no/never
     * @returns A promise resolving when the set is made
     */
    public static setConfirmDialog = async (dbConfig: IDBConnection, value: string): Promise<void> => {
        const confirmDialog = await driver.wait(until.elementsLocated(By.css(".confirmDialog")),
            500, "No confirm dialog was found");

        expect(await confirmDialog[0].findElement(By.css(".title label")).getText()).toBe("Confirm");

        let text = `Save password for '${String(dbConfig.username)}@${String(dbConfig.hostname)}:`;
        text += `${String(dbConfig.port)}'?`;

        expect(await confirmDialog[0].findElement(By.id("dialogMessage")).getText()).toContain(text);

        const noBtn = await confirmDialog[0].findElement(By.id("refuse"));
        const yesBtn = await confirmDialog[0].findElement(By.id("accept"));
        const neverBtn = await confirmDialog[0].findElement(By.id("alternative"));

        switch (value) {
            case "yes":
                await yesBtn.click();
                break;
            case "no":
                await noBtn.click();
                break;
            case "never":
                await neverBtn.click();
                break;
            default:
                break;
        }
    };

    /**
     * Inserts texts on an input box or other element, on a safer way (avoiding Stale Elements)
     *
     * @param inputId html input id
     * @param type input/selectList/checkbox
     * @param value text to set
     * @returns A promise resolving with the set is made
     */
    public static setInputValue = async (inputId: string,
        type: string | undefined, value: string): Promise<void> => {
        let el = await driver.findElement(By.id(inputId));
        const letters = value.split("");
        for (const letter of letters) {
            if (type) {
                el = await driver.findElement(By.id(inputId)).findElement(By.css(type));
            } else {
                el = await driver.findElement(By.id(inputId));
            }
            await el.sendKeys(letter);
        }
    };

    /**
     * Returns the prompt text within a line, on the prompt
     *
     * @param prompt last (last line), last-1 (line before the last line), last-2 (line before the 2 last lines)
     * @returns Promise resolving with the text on the selected line
     */
    public static getPromptTextLine = async (prompt: string): Promise<String> => {
        const context = await driver.findElement(By.css(".monaco-editor-background"));
        let lines = await context.findElements(By.css(".view-lines.monaco-mouse-cursor-text .view-line"));
        let position: number;
        let tags;
        switch(prompt) {
            case "last":
                position = 1;
                break;
            case "last-1":
                position = 2;
                break;
            case "last-2":
                position = 3;
                break;
            default:
                throw new Error("Error getting line");
        }

        let sentence = "";
        try {
            tags = await lines[lines.length - position].findElements(By.css("span > span"));
            for (const tag of tags) {
                sentence += (await tag.getText()).replace("&nbsp;", " ");
            }
        } catch (e) {
            lines = await context.findElements(By.css(".view-lines.monaco-mouse-cursor-text .view-line"));
            tags = await lines[lines.length - position].findElements(By.css("span > span"));
            for (const tag of tags) {
                sentence += (await tag.getText()).replace("&nbsp;", " ");
            }
        }

        return sentence;
    };

    /**
     * Removes all the existing text on the prompt
     *
     * @returns A promise resolving when the clean is made
     */
    public static cleanPrompt = async (): Promise<void> => {
        const textArea = await driver.findElement(By.css("textarea"));
        if (platform() === "win32") {
            await textArea
                .sendKeys(Key.chord(Key.CONTROL, "a", "a"));
        } else if (platform() === "darwin") {
            await textArea
                .sendKeys(Key.chord(Key.COMMAND, "a", "a"));
        }
        await textArea.sendKeys(Key.BACK_SPACE);
        await driver.wait(async () => {
            return await Misc.getPromptTextLine("last") === "";
        }, 3000, "Prompt was not cleaned");
    };

}