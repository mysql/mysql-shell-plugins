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

import { Misc, page } from "./Misc.js";
import * as interfaces from "./interfaces.js";
import * as locator from "./locators.js";
import * as types from "./types.js";
import * as constants from "./constants.js";

export class Finalize {

    public selectTile = async (): Promise<void> => {
        await Misc.selectTile("Finalize");
    };

    public getSteps = async (): Promise<Array<interfaces.IStep | interfaces.IDatabaseReady>> => {

        await page.locator(locator.steps.section.root).first().waitFor({ state: "attached" });
        const genericSteps = await page.locator(locator.steps.section.root).all();

        // Monitor Replication Progress step
        const toggleIcon = genericSteps[0].locator(locator.steps.section.toggle);
        let statusLocator = genericSteps[0].locator(locator.steps.section.status);
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
        }

        let description = "";
        const commentsLocator = await genericSteps[0].locator(locator.steps.section.description).all();

        for (const comment of commentsLocator) {
            description += `${await comment.textContent()}. `;
        }

        const monitorReplicationProgressStep: interfaces.IStep = {
            toggle: genericSteps[0].locator(locator.steps.section.toggle),
            isExpanded: (await toggleIcon.getAttribute("class"))!.includes("codicon-chevron-down")
                ? true : false,
            caption: await genericSteps[0].locator(locator.steps.section.caption).textContent(),
            status,
            description
        };

        // Database Ready
        statusLocator = genericSteps[1].locator(locator.steps.section.status);
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
        }

        const explanationDetailsLocator = await page.locator(locator.steps.databaseReady.explanation.details).all();
        let explanation = "";

        for (const p of explanationDetailsLocator) {
            explanation += `${await p.textContent()} \r\n`;
        }

        // Code
        const codesLocator = await page.locator(locator.steps.databaseReady.code).all();
        const copyButtonsLocator = await page.locator(locator.steps.databaseReady.copyButton).all();

        const steps: Array<interfaces.IStep | interfaces.IDatabaseReady> = [];
        steps.push(monitorReplicationProgressStep);
        steps.push({
            toggle: genericSteps[1].locator(locator.steps.section.toggle),
            isExpanded: (await toggleIcon.getAttribute("class"))!.includes("codicon-chevron-down")
                ? true : false,
            status,
            explanation: {
                title: await (page.locator(locator.steps.databaseReady.explanation.title)).textContent(),
                details: explanation
            },
            dbSystem: {
                ip: await codesLocator[0].textContent(),
                copyButton: copyButtonsLocator[0],
            },
            jumpHost: {
                command: await codesLocator[1].textContent(),
                copyButton: copyButtonsLocator[1],
            },
            mysqlShell: {
                command: await codesLocator[2].textContent(),
                copyButton: copyButtonsLocator[2],
            }
        });

        return steps;
    };

    public toggleDeleteJumpHost = async (toggle: boolean): Promise<void> => {
        const checkBoxLocator = await page.locator(locator.finalize.checkBox).all();
        const deleteJumpHost = checkBoxLocator[0];
        const textLocator = deleteJumpHost.locator("..").locator("p");

        if ((await textLocator.textContent())!.includes("Delete jump host")) {
            const classLocator = await deleteJumpHost.getAttribute("class");

            if (classLocator!.includes("unchecked") && toggle) {
                await deleteJumpHost.click();
            }
        }
    };

    public toggleDeleteBucket = async (toggle: boolean): Promise<void> => {
        const checkBoxLocator = await page.locator(locator.finalize.checkBox).all();
        const deleteJumpHost = checkBoxLocator[1];
        const textLocator = deleteJumpHost.locator("..").locator("p");

        if ((await textLocator.textContent())!.includes("Delete jump host")) {
            const classLocator = await deleteJumpHost.getAttribute("class");

            if (classLocator!.includes("unchecked") && toggle) {
                await deleteJumpHost.click();
            }
        }
    };

    public deleteSelectedOciResources = async (): Promise<void> => {
        const deleteLocator = page.locator(locator.finalize.deleteOciResources);
        globalThis.migrationMock = true;
        await deleteLocator.click();
        await Misc.waitForLoadingIcon();
    };
}