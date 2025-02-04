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

import { MessageScheduler } from "../../communication/MessageScheduler.js";
import { ShellAPIMsm, IMsmProjectInfo, MsmVersion } from "../../communication/ProtocolMsm.js";

export class ShellInterfaceMsm {

    /** The key under which the module session is stored in the WebSession instance. */
    public moduleSessionLookupId = "";

    public async createNewProjectFolder(schemaName: string, targetPath: string, copyrightHolder: string,
        license?: string, allowSpecialChars: boolean = false, overwriteExisting: boolean = false,
        enforceTargetPath: boolean = true,
    ): Promise<string> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMsm.MsmCreateNewProjectFolder,
            parameters: {
                args: {
                    schemaName,
                    targetPath,
                    copyrightHolder,
                },
                kwargs: {
                    license,
                    allowSpecialChars,
                    overwriteExisting,
                    enforceTargetPath,
                },
            },
        });

        return response.result;
    }

    public async getProjectInformation(schemaProjectPath: string): Promise<IMsmProjectInfo> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMsm.MsmGetProjectInformation,
            parameters: {
                kwargs: {
                    schemaProjectPath,
                },
            },
        });

        return response.result;
    }

    public async prepareRelease(schemaProjectPath: string, version: string, nextVersion: string,
        allowToStayOnSameVersion: boolean = false, overwriteExisting: boolean = false,
    ): Promise<string[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMsm.MsmPrepareRelease,
            parameters: {
                kwargs: {
                    schemaProjectPath,
                    version,
                    nextVersion,
                    allowToStayOnSameVersion,
                    overwriteExisting,
                },
            },
        });

        return response.result;
    }

    public async generateDeploymentScript(schemaProjectPath: string, version: string,
        overwriteExisting: boolean = false,
    ): Promise<string> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMsm.MsmGenerateDeploymentScript,
            parameters: {
                kwargs: {
                    schemaProjectPath,
                    version,
                    overwriteExisting,
                },
            },
        });

        return response.result;
    }

    public async getAvailableLicenses(): Promise<string[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMsm.MsmGetAvailableLicenses,
            parameters: {
            },
        });

        return response.result;
    }

    public async getReleasedVersions(schemaProjectPath: string): Promise<MsmVersion[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMsm.MsmGetReleasedVersions,
            parameters: {
                kwargs: {
                    schemaProjectPath,
                },
            },
        });

        return response.result;
    }

    public async getDeploymentScriptVersions(schemaProjectPath: string): Promise<MsmVersion[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMsm.MsmGetDeploymentScriptVersions,
            parameters: {
                kwargs: {
                    schemaProjectPath,
                },
            },
        });

        return response.result;
    }
}
