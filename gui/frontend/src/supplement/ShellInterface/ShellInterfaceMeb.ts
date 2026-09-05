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
import {
    ShellAPIGui, type IMebBackupContent, type IMebBackupHomeValidation, type IMebPrerequisitesValidation,
    type IMebLogContent, type IMebMysqlBackupUserValidation, type IMebBackupProfile, type IMebSetupState,
    type IMebRestoreProgress, type IMebRestoreResult, type IMebStatus,
} from "../../communication/ProtocolGui.js";

export type {
    IMebActivityItem, IMebBackupContent, IMebBackupContentRow, IMebBackupHomeValidation,
    IMebPrerequisitesValidation, IMebBackupProfileInfo, IMebLogContent, IMebMysqlBackupUserValidation,
    IMebBackupProfile, IMebProfileSchedule, IMebRestoreProgress, IMebRestoreResult, IMebSetupState,
    IMebStatus, IMebStatusItem,
    IMebValidationStatus,
} from "../../communication/ProtocolGui.js";

export class ShellInterfaceMeb {
    public async getStatus(moduleSessionId: string, backupHomePath?: string): Promise<IMebStatus> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiMebGetStatus,
            parameters: { args: { moduleSessionId, backupHomePath } },
        });

        return response.result as unknown as IMebStatus;
    }

    public async getSetupState(moduleSessionId: string, backupHomePath?: string): Promise<IMebSetupState> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiMebGetSetupState,
            parameters: { args: { moduleSessionId, backupHomePath } },
        });

        return response.result as unknown as IMebSetupState;
    }

    public async validateLocalBackupAccess(moduleSessionId: string): Promise<IMebPrerequisitesValidation> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiMebValidateLocalBackupAccess,
            parameters: { args: { moduleSessionId } },
        });

        return response.result as unknown as IMebPrerequisitesValidation;
    }

    public async validateBackupHome(moduleSessionId: string,
        backupHomePath: string): Promise<IMebBackupHomeValidation> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiMebValidateBackupHome,
            parameters: { args: { moduleSessionId, backupHomePath } },
        });

        return response.result as unknown as IMebBackupHomeValidation;
    }

    public async createBackupHome(moduleSessionId: string,
        backupHomePath: string): Promise<IMebBackupHomeValidation> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiMebCreateBackupHome,
            parameters: { args: { moduleSessionId, backupHomePath } },
        });

        return response.result as unknown as IMebBackupHomeValidation;
    }

    public async validateBackupMysqlUser(moduleSessionId: string, backupHomePath: string,
        mysqlUser: string, password?: string): Promise<IMebMysqlBackupUserValidation> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiMebValidateBackupMysqlUser,
            parameters: { args: { moduleSessionId, backupHomePath, mysqlUser, password } },
        });

        return response.result as unknown as IMebMysqlBackupUserValidation;
    }

    public async createBackupMysqlUser(moduleSessionId: string, backupHomePath: string,
        mysqlUser: string): Promise<IMebMysqlBackupUserValidation> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiMebCreateBackupMysqlUser,
            parameters: { args: { moduleSessionId, backupHomePath, mysqlUser } },
        });

        return response.result as unknown as IMebMysqlBackupUserValidation;
    }

    public async fixBackupMysqlUser(moduleSessionId: string, backupHomePath: string,
        mysqlUser: string): Promise<IMebMysqlBackupUserValidation> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiMebFixBackupMysqlUser,
            parameters: { args: { moduleSessionId, backupHomePath, mysqlUser } },
        });

        return response.result as unknown as IMebMysqlBackupUserValidation;
    }

    public async resetBackupMysqlUserPassword(moduleSessionId: string, backupHomePath: string,
        mysqlUser: string, password?: string): Promise<IMebMysqlBackupUserValidation> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiMebResetBackupMysqlUserPassword,
            parameters: { args: { moduleSessionId, backupHomePath, mysqlUser, password } },
        });

        return response.result as unknown as IMebMysqlBackupUserValidation;
    }

    public async applySetup(moduleSessionId: string, backupHomePath: string,
        mysqlUser: string): Promise<IMebSetupState> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiMebApplySetup,
            parameters: { args: { moduleSessionId, backupHomePath, mysqlUser } },
        });

        return response.result as unknown as IMebSetupState;
    }

    public async saveProfile(moduleSessionId: string, backupHomePath: string,
        profile: IMebBackupProfile): Promise<IMebStatus> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiMebSaveProfile,
            parameters: { args: { moduleSessionId, backupHomePath, profile } },
        });

        return response.result as unknown as IMebStatus;
    }

    public async deleteProfile(moduleSessionId: string, backupHomePath: string,
        profileUuid: string): Promise<IMebStatus> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiMebDeleteProfile,
            parameters: { args: { moduleSessionId, backupHomePath, profileUuid } },
        });

        return response.result as unknown as IMebStatus;
    }

    public async startProfileExecution(moduleSessionId: string, backupHomePath: string, profileUuid: string,
        backupMode: "full" | "incremental"): Promise<IMebStatus> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiMebStartProfileExecution,
            parameters: { args: { moduleSessionId, backupHomePath, profileUuid, backupMode } },
        });

        return response.result as unknown as IMebStatus;
    }

    public async deleteBackup(moduleSessionId: string, backupHomePath: string,
        activityId: string): Promise<IMebStatus> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiMebDeleteBackup,
            parameters: { args: { moduleSessionId, backupHomePath, activityId } },
        });

        return response.result as unknown as IMebStatus;
    }

    public async verifyBackup(moduleSessionId: string, backupHomePath: string,
        activityId: string): Promise<IMebLogContent> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiMebVerifyBackup,
            parameters: { args: { moduleSessionId, backupHomePath, activityId } },
        });

        return response.result as unknown as IMebLogContent;
    }

    public async applyBackupLogs(moduleSessionId: string, backupHomePath: string,
        activityId: string): Promise<IMebStatus> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiMebApplyBackupLogs,
            parameters: { args: { moduleSessionId, backupHomePath, activityId } },
        });

        return response.result as unknown as IMebStatus;
    }

    public async restoreBackup(moduleSessionId: string, backupHomePath: string,
        activityId: string, operationId: string, force: boolean): Promise<IMebRestoreResult> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiMebRestoreBackup,
            parameters: { args: { moduleSessionId, backupHomePath, activityId, operationId, force } },
        });

        return response.result as unknown as IMebRestoreResult;
    }

    public async getRestoreProgress(moduleSessionId: string, backupHomePath: string,
        operationId: string): Promise<IMebRestoreProgress> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiMebGetRestoreProgress,
            parameters: { args: { moduleSessionId, backupHomePath, operationId } },
        });

        return response.result as unknown as IMebRestoreProgress;
    }

    public async abortBackupRestore(moduleSessionId: string, backupHomePath: string,
        operationId: string): Promise<IMebRestoreProgress> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiMebAbortBackupRestore,
            parameters: { args: { moduleSessionId, backupHomePath, operationId } },
        });

        return response.result as unknown as IMebRestoreProgress;
    }

    public async readBackupContent(
        moduleSessionId: string, backupHomePath: string, activityId: string,
    ): Promise<IMebBackupContent> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiMebReadBackupContent,
            parameters: { args: { moduleSessionId, backupHomePath, activityId } },
        });

        return response.result as unknown as IMebBackupContent;
    }

    public async getBackupPath(moduleSessionId: string, backupHomePath: string, activityId: string): Promise<string> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiMebGetBackupPath,
            parameters: { args: { moduleSessionId, backupHomePath, activityId } },
        });

        return response.result as unknown as string;
    }

    public async readLog(moduleSessionId: string, backupHomePath: string, activityId: string): Promise<IMebLogContent> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiMebReadLog,
            parameters: { args: { moduleSessionId, backupHomePath, activityId } },
        });

        return response.result as unknown as IMebLogContent;
    }
}
