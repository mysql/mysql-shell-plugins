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
 * separately licensed software that they have either included with
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

import { MigrationSubAppLogger } from "../../app-logic/MigrationSubApp/MigrationSubAppLogger.js";
import { DataCallback, MessageScheduler } from "../../communication/MessageScheduler.js";
import {
    ShellAPIMigration,
    IMigrationSteps,
    IProjectData,
    IWorkStatusInfo,
    IMigrationPlanState,
    SubStepId
    // ISignInInfo
} from "../../communication/ProtocolMigration.js";

export type ProjectsData = IProjectData[];

export class ShellInterfaceMigration {

    /** The key under which the module session is stored in the WebSession instance. */
    public moduleSessionLookupId = "";

    private logger = new MigrationSubAppLogger(new URLSearchParams(window.location.search).has("enableLogger"));

    public async info(): Promise<string> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMigration.MigrationInfo,
            parameters: {}
        });

        return response.result;
    }

    public async version(): Promise<string> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMigration.MigrationVersion,
            parameters: {}
        });

        return response.result;
    }

    public async getSteps(): Promise<IMigrationSteps> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMigration.MigrationGetSteps,
            parameters: {}
        });

        return response.result;
    }

    public async newProject(name: string, sourceUrl: string): Promise<IProjectData> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMigration.MigrationNewProject,
            parameters: {
                args: { name, sourceUrl }
            }
        });

        return response.result;
    }

    public async listProjects(): Promise<ProjectsData> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMigration.MigrationListProjects,
            parameters: {}
        });

        return response.result;
    }

    public async signIn(signUp?: boolean,
        callback?: DataCallback<ShellAPIMigration.MigrationOciSignIn>): Promise<void> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMigration.MigrationOciSignIn,
            parameters: {
                args: { signUp }
            },
            onData: callback,
        });
    }

    public async planUpdate(configs: object[]): Promise<IMigrationPlanState[]> {
        this.log("planUpdate begin:", configs);
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMigration.MigrationPlanUpdate,
            parameters: {
                args: { configs }
            },
            caseConversionIgnores: this.extractUniqueKeys(configs),
        });

        this.log("planUpdate done:", response.result);

        return response.result;
    }

    public async planUpdateSubStep(subStepId: SubStepId, configs: object): Promise<IMigrationPlanState> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMigration.MigrationPlanUpdateSubStep,
            parameters: {
                args: { subStepId, configs }
            },
            caseConversionIgnores: this.extractUniqueKeys([configs]),
        });

        this.log(response.result);

        return response.result;
    }

    public async planCommit(subStepId: number): Promise<IMigrationPlanState> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMigration.MigrationPlanCommit,
            parameters: {
                args: { subStepId }
            }
        });

        this.log(response.result);

        return response.result;
    }

    public async workStart(): Promise<IWorkStatusInfo> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMigration.MigrationWorkStart,
            parameters: {}
        });

        this.log("Work Start:", response.result);

        return response.result;
    }

    public async workAbort(): Promise<void> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMigration.MigrationWorkAbort,
            parameters: {}
        });

        this.log("Work Abort", response);
    }

    public async workStatus(): Promise<IWorkStatusInfo> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMigration.MigrationWorkStatus,
            parameters: {}
        });

        this.log(response.result);

        return response.result;
    }

    public async workClean(options: IDictionary): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMigration.MigrationWorkClean,
            parameters: {
                args: { options }
            }
        });
    }

    public async openProject(id: string): Promise<IProjectData> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMigration.MigrationOpenProject,
            parameters: {
                args: { id },
            },
        });

        this.log(response.result);

        return response.result;
    }

    private extractUniqueKeys(configs: object[]) {
        const fields = new Set<string>();
        configs.forEach((config) => {
            for (const key in config) {
                fields.add(key);
            }
        });

        return [...fields];
    }

    private log(...args: unknown[]): void {
        this.logger.logWithPasswordMask(...args);
    }
}
