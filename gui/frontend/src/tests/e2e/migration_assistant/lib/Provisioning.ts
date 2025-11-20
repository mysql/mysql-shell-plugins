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

import { expect } from "@playwright/test";
import { Misc } from "./Misc.js";
import * as interfaces from "./interfaces.js";
import * as constants from "./constants.js";

export class Provisioning {

    public selectTile = async (): Promise<void> => {
        await Misc.selectTile("Provisioning");
    };

    public getSteps = async (): Promise<interfaces.IStep[] | undefined> => {
        return Misc.getSteps();

    };

    public waitForProvisioningSteps = async (): Promise<void> => {

        let steps = await this.getSteps();

        for (let i = 0; i <= steps!.length - 1; i++) {
            if (steps![i].status === constants.StepStatusEnum.Running) {
                await expect.poll(async () => {
                    const steps = await this.getSteps();

                    return steps!.find((item: interfaces.IStep) => {
                        return item.caption === steps![i].caption;
                    })!.status !== constants.StepStatusEnum.Running;
                }, {
                    timeout: constants.wait1second * 3600,
                    message: `Step '${steps![i].caption}' timed out Running`
                }).toBe(true);

                steps = await this.getSteps(); // update the array

                if (i === 0) {
                    i = -1; // repeat iteration 0 to check the last step status
                } else {
                    i--; // repeat iteration to check the last step status
                }
            } else if (steps![i].status === constants.StepStatusEnum.Failed) {
                throw new Error(steps![i].description!);
            } else if (steps![i].status === constants.StepStatusEnum.NotStarted) {
                await expect.poll(async () => {
                    const steps = await this.getSteps();

                    return steps!.find((item: interfaces.IStep) => {
                        return item.caption === steps![i].caption;
                    })!.status !== constants.StepStatusEnum.NotStarted;
                }, {
                    timeout: constants.wait1second * 20,
                    message: `Step '${steps![i].caption}' timed out Not Starting`
                }).toBe(true);

                steps = await this.getSteps(); // update the array

                if (i === 0) {
                    i = -1; // repeat iteration 0 to check the last step status
                } else {
                    i--; // repeat iteration to check the last step status
                }
            }
        }

    };

}