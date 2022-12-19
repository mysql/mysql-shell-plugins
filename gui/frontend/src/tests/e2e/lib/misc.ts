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
import { promises as fsPromises } from "fs";
import { By, until, Key, WebElement, Builder, WebDriver, error } from "selenium-webdriver";
import { Options, ServiceBuilder, setDefaultService } from "selenium-webdriver/chrome";
import { DBConnection } from "./dbConnection";

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
    public static execOnEditor = async (): Promise<void> => {
        await driver
            .actions()
            .keyDown(Key.CONTROL)
            .keyDown(Key.ENTER)
            .keyUp(Key.CONTROL)
            .keyUp(Key.ENTER)
            .perform();
    };

    /**
     * Gets the zone host id of the last results block
     *
     * @returns Promise resolving with the zone host id
     */
    public static getLastResultBlockId = async (): Promise<number> => {
        await driver.wait(until.elementLocated(By.css("textarea")), explicitWait, "Could not find the text area");
        const prevBlocks = await driver.findElements(By.css(".zoneHost"));
        if (prevBlocks.length > 0) {
            const x = await prevBlocks[prevBlocks.length - 1].getAttribute("monaco-view-zone");

            return parseInt(x.replace("d", ""), 10);
        }

        return 0;
    };


    /**
     * Writes a command on the DB Editor or Shell session
     *
     * @param cmd command to execute
     * @param slowWriting true to write in slow mode, false otherwise
     * @returns Promise resolving when the command is written
     */
    public static writeCmd = async (cmd: string, slowWriting?: boolean): Promise<void> => {
        const textArea = await driver.wait(until.elementLocated(By.css("textarea")),
            explicitWait, "Could not find the textarea");
        if (slowWriting) {
            const items = cmd.split("");
            for (const item of items) {
                await textArea.sendKeys(item);
                await driver.sleep(20);
            }
        } else {
            await textArea.sendKeys(cmd);
        }
    };


    /**
     * Writes a command (sql/js/py) and executes it, using CTRL+ENTER or a toolbar button
     *
     * @param cmd command to execute
     * @param button name of the button to use, to perform the command
     * @param timeout wait for results
     * @param slowWriting true to write in slow mode, false otherwise
     * @returns Promise resolving when the command is executed and the results are generated.
     * The returned array contains 2 positions. First one, has the command result (ex: OK, 1 record retrieved).
     * The second position has the WebElement which contains the results block (ex: table/string)
     */
    public static execCmd = async (
        cmd: string,
        button?: string,
        timeout?: number,
        slowWriting?: boolean): Promise<Array<string | WebElement | boolean | undefined>> => {

        cmd = cmd.replace(/(\r\n|\n|\r)/gm, "");
        const count = (cmd.match(/;|select|SELECT/g) || []).length;
        const hasMultipleQueries = count >= 3 && cmd.toLowerCase().startsWith("select");

        const prevBlockId = await Misc.getLastResultBlockId();
        const nextBlockId = prevBlockId + 1;

        if (cmd.length > 0) {
            await Misc.writeCmd(cmd, slowWriting);
        }

        if (button) {
            const btn = await DBConnection.getToolbarButton(button);
            await btn?.click();
        } else {
            await Misc.execOnEditor();
        }

        timeout = timeout ?? 5000;

        return Misc.getCmdResult(cmd, nextBlockId, timeout, hasMultipleQueries);
    };

    /**
     * Writes a command (sql/js/py) and executes it, using right-click on context menu
     *
     * @param cmd command to execute
     * @param item name of the button to use, to perform the command
     * @param timeout wait for results
     * @param slowWriting true to write in slow mode, false otherwise
     * @returns Promise resolving when the command is executed and the results are generated.
     * The returned array contains 2 positions. First one, has the command result (ex: OK, 1 record retrieved).
     * The second position has the WebElement which contains the results block (ex: table/string)
     */
    public static execCmdByContextItem = async (
        cmd: string,
        item: string,
        timeout?: number,
        slowWriting?: boolean): Promise<Array<string | WebElement | boolean | undefined>> => {

        cmd = cmd.replace(/(\r\n|\n|\r)/gm, "");
        const count = (cmd.match(/;|select|SELECT/g) || []).length;
        const hasMultipleQueries = count >= 3 && cmd.toLowerCase().startsWith("select");

        const prevBlockId = await Misc.getLastResultBlockId();
        const nextBlockId = prevBlockId + 1;

        if (cmd.length > 0) {
            await Misc.writeCmd(cmd, slowWriting);
        }

        await DBConnection.clickContextItem(item);
        timeout = timeout ?? 5000;

        return Misc.getCmdResult(cmd, nextBlockId, timeout, hasMultipleQueries);
    };

    /**
     * Returns the result tab names of the result block
     *
     * @param resultHost the context block
     * @returns A promise resolving with the tab names
     */
    public static getResultTabs = async (resultHost: WebElement): Promise<string[]> => {
        const result: string[] = [];
        const tabs = await resultHost.findElements(By.css(".tabArea div"));
        for (const tab of tabs) {
            if (await tab.getAttribute("id") !== "selectorItemstepDown" &&
                await tab.getAttribute("id") !== "selectorItemstepUp") {

                const label = await tab.findElement(By.css("label"));
                const tabLabel = await label.getAttribute("innerHTML");
                result.push(tabLabel);
            }
        }

        return result;
    };

    /**
     * Returns the result tab within a results block
     *
     * @param resultHost the context block
     * @param tabName name of the tab
     * @returns A promise resolving with the tab result
     */
    public static getResultTab = async (resultHost: WebElement, tabName: string): Promise <WebElement | undefined> => {
        const tabs = await resultHost.findElements(By.css(".tabArea div"));

        for (const tab of tabs) {
            if (await tab.getAttribute("id") !== "selectorItemstepDown" &&
                await tab.getAttribute("id") !== "selectorItemstepUp") {

                const label = await tab.findElement(By.css("label"));
                const tabLabel = await label.getAttribute("innerHTML");
                if (tabName === tabLabel) {
                    return tab;
                }
            }
        }
    };

    /**
     * Returns the result column names of a query within a results block
     *
     * @param resultHost the context block
     * @returns A promise resolving with the column names
     */
    public static getResultColumns = async (resultHost: WebElement): Promise<string[]> => {

        const result = [];

        const resultSet = await driver.wait(async () => {
            return (await resultHost.findElements(By.css(".tabulator-headers")))[0];
        }, explicitWait, "No tabulator-headers detected");

        const resultHeaderRows = await driver.wait(async () => {
            return resultSet.findElements(By.css(".tabulator-col-title"));
        }, explicitWait, "No tabulator-col-title detected");

        for (const row of resultHeaderRows) {
            const rowText = await row.getAttribute("innerHTML");
            result.push(rowText);
        }

        return result;

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
            explicitWait, "No confirm dialog was found");

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
     * Removes all the existing text on the prompt
     *
     * @returns A promise resolving when the clean is made
     */
    public static cleanPrompt = async (): Promise<void> => {
        const textArea = await driver.findElement(By.css("textarea"));

        await textArea
            .sendKeys(Key.chord(Key.CONTROL, "a", "a"));

        await textArea.sendKeys(Key.BACK_SPACE);
        await driver.wait(async () => {
            return await Misc.getPromptTextLine("last") === "";
        }, 3000, "Prompt was not cleaned");
    };

    /**
     * Takes a screenshot, and saves it into a file
     *
     */
    public static processFailure = async (): Promise<void> => {

        const img = await driver.takeScreenshot();
        const testName: string = expect.getState().currentTestName
            .toLowerCase().replace(/\s/g, "_");
        try {
            await fsPromises.access("src/tests/e2e/screenshots");
        } catch (e) {
            await fsPromises.mkdir("src/tests/e2e/screenshots");
        }
        await fsPromises.writeFile(`src/tests/e2e/screenshots/${testName}_screenshot.png`, img, "base64");

    };

    /**
     * Gets the last command result message (ex: OK, 1 record retrieved)
     *
     * @param zoneHost context
     * @param timeout time to wait
     * @returns Promise resolving with the zone host id
     */
    public static getCmdResultMsg = async (zoneHost?: WebElement, timeout?: number): Promise<string | undefined> => {
        let resultToReturn = "";
        timeout = timeout ?? 5000;
        await driver.wait(async () => {
            try {
                let context;
                if (zoneHost) {
                    context = zoneHost;
                } else {
                    const blocks = await driver.wait(until.elementsLocated(By.css(".zoneHost")),
                        explicitWait, "No zone hosts were found");
                    context = blocks[blocks.length - 1];
                }

                const resultStatus = await context.findElements(By.css(".resultStatus"));
                if (resultStatus.length > 0) {
                    const elements: WebElement[] = await driver.executeScript("return arguments[0].childNodes;",
                        resultStatus[0]);

                    resultToReturn = await elements[0].getAttribute("innerHTML");

                    return resultToReturn;
                }

                const resultTexts = await context.findElements(By.css(".resultText"));
                if (resultTexts.length > 0) {
                    let result = "";
                    for (const resultText of resultTexts) {
                        const span = await resultText.findElement(By.css("code span"));
                        result += await span.getAttribute("innerHTML");
                    }

                    resultToReturn = result.trim();

                    return resultToReturn;
                }

                const actionLabel = await context.findElements(By.css(".actionLabel"));
                if(actionLabel.length > 0) {
                    resultToReturn = await actionLabel[0].getAttribute("innerHTML");

                    return resultToReturn;
                }

                const actionOutput = await context.findElements(By.css(".actionOutput"));
                if(actionOutput.length > 0) {
                    resultToReturn = await actionOutput[0].findElement(By.css(".info")).getAttribute("innerHTML");

                    return resultToReturn;
                }

                const graphHost = await context.findElements(By.css(".graphHost"));
                if(graphHost.length > 0) {
                    resultToReturn = "graph";

                    return resultToReturn;
                }

            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                } else {
                    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
                    zoneHost = zoneHosts[zoneHosts.length -1];
                }
            }

        }, timeout, "Could not return the last result command");

        return resultToReturn;
    };

    /**
     * Returns the prompt text within a line, on the prompt
     *
     * @param prompt last (last line), last-1 (line before the last line), last-2 (line before the 2 last lines)
     * @returns Promise resolving with the text on the selected line
     */
    private static getPromptTextLine = async (prompt: string): Promise<String> => {
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
     * Gets the last command result content (ex: result of a SELECT statement)
     *
     * @param multipleQueries true if the result content to be returned reslulted from a multiple query
     * @param zoneHost context
     * @param timeout time to wait
     * @returns Promise resolving with the zone host id
     */
    private static getCmdResultContent = async (multipleQueries: boolean,
        zoneHost: WebElement, timeout?: number): Promise<WebElement | undefined> => {
        timeout = timeout ?? 5000;
        let toReturn: WebElement | undefined;

        await driver.wait(async () => {
            try {
                const resultTabview = await zoneHost.findElements(By.css(".resultTabview"));
                if (resultTabview.length > 0) {
                    if (multipleQueries) {
                        const tabArea = await zoneHost.findElements(By.css(".tabArea"));
                        if (tabArea.length > 0) {
                            toReturn = resultTabview[resultTabview.length - 1];

                            return true;
                        } else {
                            return undefined;
                        }
                    } else {
                        toReturn = resultTabview[resultTabview.length - 1];

                        return true;
                    }
                }

                const renderTarget = await zoneHost.findElements(By.css(".renderTarget"));
                if (renderTarget.length > 0 && !multipleQueries) {
                    toReturn = renderTarget[renderTarget.length - 1];

                    return true;
                }
            } catch (e) {
                if (e instanceof error.StaleElementReferenceError) {
                    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
                    zoneHost = zoneHosts[zoneHosts.length -1];
                } else {
                    throw e;
                }
            }
        }, timeout, "Could not return the last result content");

        return toReturn;
    };

    /**
     * Gets the last command result content (ex: result of a SELECT statement)
     *
     * @param cmd that was executed
     * @param blockId to search for
     * @param timeout time to wait
     * @param hasMultipleQueries cmd has more than one query?
     * @returns Promise resolving with an array of 2 positions: First one has the cmd result message,
     * the second one has the WebElement that represents the result
     */
    private static getCmdResult = async (
        cmd: string,
        blockId: number,
        timeout: number,
        hasMultipleQueries: boolean,
    ): Promise<Array<string | WebElement | boolean | undefined>> => {

        const toReturn: Array<string | WebElement | boolean | undefined> = [];
        let zoneHost;

        if (!cmd.includes("disconnect")) {

            if (blockId === 1) {
                const zoneHosts = await driver.wait(until.elementsLocated(By.css(".zoneHost")), timeout,
                    `zoneHosts not found for '${cmd}'`);
                zoneHost = zoneHosts[zoneHosts.length - 1];
            } else {
                zoneHost = await driver.wait(
                    until.elementLocated(By.xpath(`//div[@class='zoneHost' and @monaco-view-zone='d${blockId}']`)),
                    timeout, `Could not get the result block id '${blockId}' for '${cmd}'`);
            }

            await Misc.getCmdResultMsg(zoneHost, timeout)
                .then ( (result) => {
                    toReturn.push(result);
                })
                .catch ( (e) => {
                    if (String(e).includes("Could not return")) {
                        throw new Error(`Could not get result for '${cmd}'`);
                    } else {
                        throw e;
                    }
                });

            await Misc.getCmdResultContent(hasMultipleQueries, zoneHost, timeout)
                .then ( (result) => {
                    toReturn.push(result);
                })
                .catch ( (e) => {
                    if (String(e).includes("Could not return")) {
                        throw new Error(`Could not get content for '${cmd}'`);
                    } else {
                        throw e;
                    }
                });

        } else {
            await driver.wait(until.elementLocated(
                By.xpath(`//div[@class='zoneHost' and @monaco-view-zone='d${blockId}']`)),
            150, "")
                .then( async (zoneHost: WebElement) => {
                    await Misc.getCmdResultMsg(zoneHost, timeout)
                        .then ( (result) => {
                            toReturn.push(result);
                        })
                        .catch ( (e) => {
                            if (String(e).includes("Could not return")) {
                                throw new Error(`Could not get result for '${cmd}'`);
                            } else {
                                throw e;
                            }
                        });
                })
                .catch( () => {
                    toReturn.push("");
                } );
        }

        return toReturn;
    };

}
