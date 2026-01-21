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

import { Locator } from "@playwright/test";
import { MigrationPlan } from "./MigrationPlan.js";
import * as interfaces from "./interfaces.js";
import { page, Misc } from "./Misc.js";
import * as locator from "./locators.js";
import * as constants from "./constants.js";
import * as types from "./types.js";
import { Provisioning } from "./Provisioning.js";
import { DatabaseMigration } from "./DatabaseMigration.js";
import { DataSynchronization } from "./DataSynchronization.js";
import { Finalize } from "./Finalize.js";

export class MigrationAssistantPage {

    public migrationPlan = new MigrationPlan();

    public provisioning = new Provisioning();

    public databaseMigration = new DatabaseMigration();

    public dataSynchronization = new DataSynchronization();

    public finalize = new Finalize();

    // Buttons

    public back = async (): Promise<void> => {
        await page.locator(locator.mainPage.back).click();
    };

    public next = async (): Promise<void> => {
        await page.locator(locator.mainPage.next).click();
        await Misc.waitForLoadingIcon();
    };

    public isButtonEnabled = async (button: types.MigrationButton): Promise<boolean | undefined> => {
        if (button === constants.MigrationButtonEnum.Next) {
            const buttonLocator = page.locator(locator.mainPage.next);

            return !(await buttonLocator.getAttribute("class"))!.includes("disabled");
        } else if (button === constants.MigrationButtonEnum.Back) {
            const buttonLocator = page.locator(locator.mainPage.back);

            return !(await buttonLocator.getAttribute("class"))!.includes("disabled");
        } else {
            const buttonLocator = page.locator(locator.mainPage.startMigration);

            return !(await buttonLocator.getAttribute("class"))!.includes("disabled");
        }
    };

    public startMigration = async (): Promise<void> => {
        globalThis.mockMigration = true;
        await page.locator(locator.mainPage.startMigration).click();
        await Misc.waitForLoadingIcon();
    };

    public abortMigration = async (): Promise<void> => {
        globalThis.mockMigration = true;
        await page.locator(locator.mainPage.abortMigration).click();
        await Misc.waitForLoadingIcon();
    };

    public getTiles = async (): Promise<interfaces.ITile[]> => {
        const tilesLocator = await page.locator(locator.mainPage.tile.root).all();

        const tiles: interfaces.ITile[] = [];

        for (const tile of tilesLocator) {
            const tileInfo: interfaces.ITile = {};

            tileInfo.name = await (tile.locator(locator.mainPage.tile.name)).textContent();
            tileInfo.active = (await tile.getAttribute("class"))!.includes("active");
            const subStepsLocator = await tile.locator(locator.mainPage
                .tile.subSteps.item.name).all();
            const subSteps: interfaces.ITileSubStep[] = [];

            for (const subStepLocator of subStepsLocator) {
                const statusLocator = subStepLocator.locator(locator.mainPage
                    .tile.subSteps.item.status);

                const subStepName = await subStepLocator.textContent();

                let status: types.TileStepStatus;
                if (await statusLocator.textContent() === constants.TileStepStatusEnum.Passed) {
                    status = constants.TileStepStatusEnum.Passed;
                } else if (await statusLocator.textContent() === constants.TileStepStatusEnum.NotStarted ||
                    await statusLocator.textContent() === constants.TileStepStatusEnum.ToStart
                ) {
                    status = constants.TileStepStatusEnum.NotStarted;
                } else if (await statusLocator.textContent() === constants.TileStepStatusEnum.Failed) {
                    status = constants.TileStepStatusEnum.Failed;
                } else if (await statusLocator.textContent() === constants.TileStepStatusEnum.Current) {
                    status = constants.TileStepStatusEnum.Current;
                } else {
                    status = constants.TileStepStatusEnum.Running;
                }

                subSteps.push({
                    name: subStepName!.startsWith(" ") ? subStepName!.substring(3) : subStepName,
                    status
                });
            }

            tileInfo.subSteps = subSteps;
            tiles.push(tileInfo);
        }

        return tiles;
    };

    public getCurrentHeaderStep = async (): Promise<string | null> => {
        const headerLocator = page.locator(locator.mainPage.currentHeader);

        return headerLocator.textContent();
    };

    public getSourceInfo = async (): Promise<interfaces.ISourceInfo> => {

        const sourceInfoLocators = await page.locator(locator.mainPage.sourceInfoItem).all();

        const sourceInfoTexts = await Promise.all(
            (sourceInfoLocators).map(async (item: Locator) => {
                return item.textContent();
            })
        );

        return {
            connectionName: sourceInfoTexts[0]!,
            server: sourceInfoTexts[1]!,
            schemas: parseInt(sourceInfoTexts[2]!.match(/Schemas: (\d+)/)![1]),
            uri: sourceInfoTexts[3]!,
            replicationInfo: sourceInfoTexts[4]!,
            size: sourceInfoTexts[5]!,
        };

    };

}