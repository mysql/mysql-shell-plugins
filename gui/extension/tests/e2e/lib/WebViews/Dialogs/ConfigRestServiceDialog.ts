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
import { until, WebElement, Key } from "vscode-extension-tester";
import { driver, Misc } from "../../Misc";
import * as constants from "../../constants";
import * as interfaces from "../../interfaces";
import * as locator from "../../locators";
import { DialogHelper } from "./DialogHelper";

/**
 * This class holds the functions to interact with the Rest Service dialog
 */
export class ConfigRestServiceDialog {

    public static getMRSVersions = async (): Promise<string[]> => {

        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const dialog = await driver.wait(until.elementLocated(locator.mrsConfigDialog.exists),
            constants.wait1second * 5, "MRS Config dialog was not displayed");

        await dialog.findElement(locator.mrsConfigDialog.currentVersion.exists).click();
        const selectList = await driver.wait(until
            .elementLocated(locator.mrsConfigDialog.currentVersion
                .selectList.exists), constants.wait1second * 3, "Could not find the Update to Version select list");

        const allItems = await selectList.findElements(locator.mrsConfigDialog.currentVersion.selectList.allItems);

        const allItemsIds = await Promise.all(allItems.map(async (item: WebElement) => {
            return item.getAttribute("id");
        }));

        await driver.actions().keyDown(Key.ESCAPE).keyUp(Key.ESCAPE).perform();

        return allItemsIds;
    };

    /**
     * Sets a Rest configuration using the web view dialog
     * 
     * @param restConfig The rest configuration
     */
    public static set = async (restConfig?: interfaces.IRestServiceConfig): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const dialog = await driver.wait(until.elementLocated(locator.mrsConfigDialog.exists),
            constants.wait1second * 5, "MRS Config dialog was not displayed");

        if (restConfig!.status) {
            await dialog.findElement(locator.mrsConfigDialog.status.exists).click();
            const selectList = await driver.wait(until
                .elementLocated(locator.mrsConfigDialog.status
                    .selectList.exists), constants.wait1second * 3, "Could not find the Status select list");

            await selectList.findElement(locator.mrsConfigDialog.status.selectList.item(restConfig!.status)).click();
        }

        if (restConfig!.currentVersion) {
            await dialog.findElement(locator.mrsConfigDialog.currentVersion.exists).click();
            const selectList = await driver.wait(until
                .elementLocated(locator.mrsConfigDialog.currentVersion
                    .selectList.exists), constants.wait1second * 3, "Could not find the Update to Version select list");

            await selectList.findElement(locator.mrsConfigDialog.currentVersion.selectList
                .item(restConfig!.currentVersion))
                .click();
        }

        if (restConfig!.updateToVersion) {
            await dialog.findElement(locator.mrsConfigDialog.updateToVersion.exists).click();
            const selectList = await driver.wait(until
                .elementLocated(locator.mrsConfigDialog.updateToVersion
                    .selectList.exists), constants.wait1second * 3, "Could not find the Update to Version select list");

            await selectList.findElement(locator.mrsConfigDialog.updateToVersion.selectList
                .item(restConfig!.updateToVersion))
                .click();
        }

        if (restConfig!.authentication) {
            if (restConfig!.authentication.createDefaultApp !== undefined) {
                await DialogHelper.setCheckboxValue(await dialog
                    .findElement(locator.mrsConfigDialog.authentication
                        .createDefaultApp), restConfig!.authentication.createDefaultApp);

                if (restConfig!.authentication.username) {
                    await DialogHelper.setFieldText(dialog, locator.mrsConfigDialog.authentication.username,
                        restConfig!.authentication.username);
                }

                if (restConfig!.authentication.password) {
                    await DialogHelper.setFieldText(dialog, locator.mrsConfigDialog.authentication.password,
                        restConfig!.authentication.password);
                }
            }
        }

        if (restConfig!.authenticationThrottling) {
            await driver.findElement(locator.mrsConfigDialog.authenticationThrottling.tab).click();

            if (restConfig!.authenticationThrottling.preAccountThrottling) {

                if (restConfig!.authenticationThrottling.preAccountThrottling.minTimeBetweenRequests) {
                    await DialogHelper.setFieldText(dialog,
                        locator.mrsConfigDialog.authenticationThrottling.preAccountThrottling.minTimeRequests,
                        restConfig!.authenticationThrottling.preAccountThrottling.minTimeBetweenRequests);
                }

                if (restConfig!.authenticationThrottling.preAccountThrottling.maxAttemptsPerMinute) {
                    await DialogHelper.setFieldText(dialog,
                        locator.mrsConfigDialog.authenticationThrottling.preAccountThrottling.maxAttemptsPerMin,
                        restConfig!.authenticationThrottling
                            .preAccountThrottling.maxAttemptsPerMinute);
                }
            }

            if (restConfig!.authenticationThrottling.perHostThrottling) {

                if (restConfig!.authenticationThrottling.perHostThrottling.minTimeBetweenRequests) {
                    await DialogHelper.setFieldText(dialog,
                        locator.mrsConfigDialog.authenticationThrottling
                            .perHostThrottling.minTimeRequests,
                        restConfig!.authenticationThrottling.perHostThrottling.minTimeBetweenRequests);
                }

                if (restConfig!.authenticationThrottling.perHostThrottling.maxAttemptsPerMinute) {
                    await DialogHelper.setFieldText(dialog,
                        locator.mrsConfigDialog.authenticationThrottling.perHostThrottling.maxAttemptsPerMin,
                        restConfig!.authenticationThrottling.perHostThrottling.maxAttemptsPerMinute);
                }
            }

            if (restConfig!.authenticationThrottling.throttlingGeneral!.blockTimeout) {
                await DialogHelper.setFieldText(dialog, locator.mrsConfigDialog.authenticationThrottling.blockTimeout,
                    restConfig!.authenticationThrottling.throttlingGeneral!.blockTimeout);
            }
        }

        if (restConfig!.caches) {
            await driver.findElement(locator.mrsConfigDialog.caches.tab).click();

            if (restConfig!.caches.endPointResponseCache) {
                await DialogHelper.setFieldText(dialog, locator.mrsConfigDialog.caches.endPointResponseCache,
                    restConfig!.caches.endPointResponseCache);
            }

            if (restConfig!.caches.staticFileCache) {
                await DialogHelper.setFieldText(dialog, locator.mrsConfigDialog.caches.staticFileCache,
                    restConfig!.caches.staticFileCache);
            }

            if (restConfig!.caches.gtidCache) {
                await DialogHelper.setCheckboxValue(await dialog.findElement(locator.mrsConfigDialog.caches.gtidCache),
                    restConfig!.caches.gtidCache);
            }

            if (restConfig!.caches.refreshRate) {
                await DialogHelper.setFieldText(dialog, locator.mrsConfigDialog.caches.refreshRate,
                    restConfig!.caches.refreshRate);
            }

            if (restConfig!.caches.refreshWhenIncreased) {
                await DialogHelper.setFieldText(dialog, locator.mrsConfigDialog.caches.refreshWhenIncreased,
                    restConfig!.caches.refreshWhenIncreased);
            }

        }

        if (restConfig!.redirectsStaticContent) {
            await driver.findElement(locator.mrsConfigDialog.redirectsAndStaticContent.tab).click();

            if (restConfig!.redirectsStaticContent.endPointResponseCacheOptions) {

                for (const option of restConfig!.redirectsStaticContent.endPointResponseCacheOptions) {
                    const addEntryEndpoint = (await dialog
                        .findElements(locator.mrsConfigDialog.redirectsAndStaticContent
                            .grid.addEntry))[0];
                    await addEntryEndpoint.click();
                    const paramDialog = await driver.wait(until.elementLocated(locator.parameterDialog.exists),
                        constants.wait1second * 3, "Could not find the Parameters dialog");
                    await paramDialog.findElement(locator.parameterDialog.name).sendKeys(option.name);
                    await paramDialog.findElement(locator.parameterDialog.value).sendKeys(option.value);
                    await paramDialog.findElement(locator.parameterDialog.ok).click();
                }

            }

            if (restConfig!.redirectsStaticContent.defaultRedirects) {

                for (const option of restConfig!.redirectsStaticContent.defaultRedirects) {
                    const addEntryEndpoint = (await dialog
                        .findElements(locator.mrsConfigDialog.redirectsAndStaticContent
                            .grid.addEntry))[1];
                    await addEntryEndpoint.click();
                    const paramDialog = await driver.wait(until.elementLocated(locator.parameterDialog.exists),
                        constants.wait1second * 3, "Could not find the Parameters dialog");
                    await paramDialog.findElement(locator.parameterDialog.name).sendKeys(option.name);
                    await paramDialog.findElement(locator.parameterDialog.value).sendKeys(option.value);
                    await paramDialog.findElement(locator.parameterDialog.ok).click();
                }

            }

        }

        if (restConfig!.options) {
            await dialog.findElement(locator.mrsConfigDialog.options.tab).click();
            await DialogHelper.setFieldText(dialog, locator.mrsConfigDialog.options.value, restConfig!.options);
        }

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsConfigDialog.ok).click();

            return !(await DialogHelper.existsDialog());
        }, constants.wait1second * 10, "The MySQL Rest Configuration Dialog was not closed");

    };

    /**
     * Gets a Rest Config using the web view dialog
     * 
     * @param closeDialog True to close the dialog, false otherwise
     * @returns A promise resolving with the rest configuration
     */
    public static get = async (closeDialog = true): Promise<interfaces.IRestServiceConfig> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const dialog = await driver.wait(until.elementLocated(locator.mrsConfigDialog.exists),
            constants.wait1second * 20, "MRS Configuration dialog was not displayed");

        const mrsConfig: interfaces.IRestServiceConfig = {
            status: await (await dialog.findElement(locator.mrsConfigDialog.status.label)).getText(),
            currentVersion: await (await dialog.findElement(locator.mrsConfigDialog.currentVersion.label)).getText(),
            updateToVersion: await (await dialog.findElement(locator.mrsConfigDialog.updateToVersion.label)).getText(),
            authenticationThrottling: {
                preAccountThrottling: {
                    minTimeBetweenRequests: await DialogHelper.getFieldValue(dialog,
                        locator.mrsConfigDialog.authenticationThrottling.preAccountThrottling.minTimeRequests),
                    maxAttemptsPerMinute: await DialogHelper.getFieldValue(dialog,
                        locator.mrsConfigDialog.authenticationThrottling.preAccountThrottling.maxAttemptsPerMin),
                },
                perHostThrottling: {
                    minTimeBetweenRequests: await DialogHelper.getFieldValue(dialog,
                        locator.mrsConfigDialog.authenticationThrottling.perHostThrottling.minTimeRequests),
                    maxAttemptsPerMinute: await DialogHelper.getFieldValue(dialog,
                        locator.mrsConfigDialog.authenticationThrottling.perHostThrottling.maxAttemptsPerMin),
                },
                throttlingGeneral: {
                    blockTimeout: await DialogHelper.getFieldValue(dialog, locator.mrsConfigDialog
                        .authenticationThrottling.blockTimeout),
                },
            },
        };

        await dialog.findElement(locator.mrsConfigDialog.caches.tab).click();
        mrsConfig.caches = {
            endPointResponseCache: await DialogHelper.getFieldValue(dialog, locator.mrsConfigDialog
                .caches.endPointResponseCache),
            staticFileCache: await DialogHelper.getFieldValue(dialog, locator.mrsConfigDialog
                .caches.staticFileCache),
            gtidCache: await DialogHelper.getCheckBoxValue(await dialog
                .findElement(locator.mrsConfigDialog.caches.gtidCache)),
            refreshRate: await DialogHelper.getFieldValue(dialog, locator.mrsConfigDialog
                .caches.refreshRate),
            refreshWhenIncreased: await DialogHelper.getFieldValue(dialog, locator.mrsConfigDialog
                .caches.refreshWhenIncreased),
        };

        await dialog.findElement(locator.mrsConfigDialog.redirectsAndStaticContent.tab).click();
        const grids = (await dialog.findElements(locator.mrsConfigDialog.redirectsAndStaticContent.grid.exists));
        const endPointResponseCacheGrid = grids[0];
        const defaultRedirectsGrid = grids[1];

        const endPointResponseCacheKeys = await Promise.all((await endPointResponseCacheGrid
            .findElements(locator.mrsConfigDialog.redirectsAndStaticContent
                .grid.key))
            .map(async (item: WebElement) => {
                return item.getText();
            }));

        const endPointResponseCacheValues = await Promise.all((await endPointResponseCacheGrid
            .findElements(locator.mrsConfigDialog.redirectsAndStaticContent
                .grid.value))
            .map(async (item: WebElement) => {
                return (await item.getText()).substring(0, 30);
            }));

        const endPointResponseCacheOpts: interfaces.IOption[] = [];
        for (const key of endPointResponseCacheKeys) {
            for (const value of endPointResponseCacheValues) {
                endPointResponseCacheOpts.push(
                    {
                        name: key,
                        value,
                    },
                );
            }
        }

        const defaultRedirectsKeys = await Promise.all((await defaultRedirectsGrid
            .findElements(locator.mrsConfigDialog.redirectsAndStaticContent
                .grid.key))
            .map(async (item: WebElement) => {
                return item.getText();
            }));

        const defaultRedirectsValues = await Promise.all((await defaultRedirectsGrid
            .findElements(locator.mrsConfigDialog.redirectsAndStaticContent
                .grid.value))
            .map(async (item: WebElement) => {
                return (await item.getText()).substring(0, 30);
            }));

        const defaultRedirectsOpts: interfaces.IOption[] = [];
        for (const key of defaultRedirectsKeys) {
            for (const value of defaultRedirectsValues) {
                defaultRedirectsOpts.push(
                    {
                        name: key,
                        value,
                    },
                );
            }
        }

        mrsConfig.redirectsStaticContent = {
            endPointResponseCacheOptions: endPointResponseCacheOpts,
            defaultRedirects: defaultRedirectsOpts,
        };

        await dialog.findElement(locator.mrsConfigDialog.options.tab).click();
        mrsConfig.options = await DialogHelper.getFieldValue(dialog, locator.mrsConfigDialog.options.value);

        if (closeDialog) {
            await driver.wait(async () => {
                await dialog.findElement(locator.mrsConfigDialog.cancel).click();

                return !(await DialogHelper.existsDialog());
            }, constants.wait1second * 10, "The MRS Config dialog was not closed");
        }

        return mrsConfig;
    };

}
