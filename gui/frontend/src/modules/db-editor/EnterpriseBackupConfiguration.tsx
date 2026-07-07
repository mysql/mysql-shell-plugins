/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 */

import type { ComponentChild } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { ui } from "../../app-logic/UILayer.js";
import { Button } from "../../components/ui/Button/Button.js";
import { Codicon } from "../../components/ui/Codicon.js";
import { Dialog } from "../../components/ui/Dialog/Dialog.js";
import { FileSelector } from "../../components/ui/FileSelector/FileSelector.js";
import { Icon } from "../../components/ui/Icon/Icon.js";
import { Input } from "../../components/ui/Input/Input.js";
import type { ICdmConnectionEntry } from "../../data-models/ConnectionDataModel.js";
import { ShellInterface } from "../../supplement/ShellInterface/ShellInterface.js";
import {
    type IMebBackupHomeValidation,
    type IMebMysqlBackupUserValidation,
    type IMebPrerequisitesValidation,
    type IMebSetupState,
    type IMebValidationStatus,
} from "../../supplement/ShellInterface/ShellInterfaceMeb.js";
import { webSession } from "../../supplement/WebSession.js";
import { convertErrorToString } from "../../utilities/helpers.js";

export interface IMebConfiguration {
    mysqlbackupPath: string;
    backupHomePath: string;
    backupUser: string;
}

interface IMebConfigurationValidation {
    mysqlbackupPath: IMebValidationStatus;
    backupHomePath: IMebValidationStatus;
    backupUser: IMebValidationStatus;
    backupPassword: IMebValidationStatus;
}

export interface IMebConfigurationServerInfo {
    datadir: string;
    mysqlBasedir: string;
    mysqlEdition: string;
    mysqlVersion: string;
}

export interface IEnterpriseBackupConfigurationProps {
    active: boolean;
    backupCommandsDisabled: boolean;
    configuration: IMebConfiguration;
    connection?: ICdmConnectionEntry;
    dialogOpen: boolean;
    expectedMysqlbackupPath: string;
    loadError?: string;
    moduleSessionId?: string;
    serverInfo: IMebConfigurationServerInfo;
    setupState?: IMebSetupState;
    onApplied: (configuration: IMebConfiguration, setupState: IMebSetupState) => void;
    onCancel: () => void;
    onDialogOpenChange: (open: boolean) => void;
}

type MebWizardPage = 0 | 1 | 2 | 3;

const initialValidation: IMebConfigurationValidation = {
    mysqlbackupPath: { tone: "info", message: "Waiting for validation." },
    backupHomePath: { tone: "info", message: "Waiting for validation." },
    backupUser: { tone: "info", message: "Waiting for validation." },
    backupPassword: { tone: "info", message: "Waiting for validation." },
};

export const normalizeMebConfiguration = (configuration: IMebConfiguration): IMebConfiguration => {
    return {
        mysqlbackupPath: configuration.mysqlbackupPath.trim(),
        backupHomePath: configuration.backupHomePath.trim(),
        backupUser: configuration.backupUser.trim(),
    };
};

const validationIcon = (tone: IMebValidationStatus["tone"]): Codicon => {
    return tone === "ok" ? Codicon.PassFilled : tone === "warn" ? Codicon.Warning : Codicon.Info;
};

export const EnterpriseBackupConfiguration = (props: IEnterpriseBackupConfigurationProps): ComponentChild => {
    const {
        active,
        backupCommandsDisabled,
        configuration,
        connection,
        dialogOpen,
        expectedMysqlbackupPath,
        loadError,
        moduleSessionId,
        serverInfo,
        setupState,
        onApplied,
        onCancel,
        onDialogOpenChange,
    } = props;
    const configurationDialogRef = useRef<Dialog>(null);
    const activeRef = useRef(false);
    const [backupAccountExists, setBackupAccountExists] = useState<boolean>();
    const [backupPasswordKnown, setBackupPasswordKnown] = useState(false);
    const [applyingConfiguration, setApplyingConfiguration] = useState(false);
    const [checkingLocalAccess, setCheckingLocalAccess] = useState(false);
    const [creatingBackupHome, setCreatingBackupHome] = useState(false);
    const [fixingBackupAccount, setFixingBackupAccount] = useState(false);
    const [localAccessValidation, setLocalAccessValidation] = useState<IMebPrerequisitesValidation>();
    const [backupHomeValidation, setBackupHomeValidation] = useState<IMebBackupHomeValidation>();
    const [backupMysqlUserValidation, setBackupMysqlUserValidation] = useState<IMebMysqlBackupUserValidation>();
    const [validation, setValidation] = useState<IMebConfigurationValidation>(initialValidation);
    const [draftConfiguration, setDraftConfiguration] = useState<IMebConfiguration>(configuration);
    const [wizardPage, setWizardPage] = useState<MebWizardPage>(0);

    const updateValidation = useCallback((patch: Partial<IMebConfigurationValidation>): void => {
        setValidation((current) => {
            return { ...current, ...patch };
        });
    }, []);

    const resetBackupAccountValidation = useCallback((): void => {
        setBackupAccountExists(undefined);
        setBackupPasswordKnown(false);
        setBackupMysqlUserValidation(undefined);
    }, []);

    const cancelWizard = (): void => {
        setWizardPage(0);
        onCancel();
    };

    const renderValidation = (validation: IMebValidationStatus): ComponentChild => {
        return (
            <div className={`enterpriseBackupValidation ${validation.tone}`}>
                <Icon src={validationIcon(validation.tone)} />
                <span>{validation.message}</span>
            </div>
        );
    };

    const backupAccountPasswordDisplayStatus = (): IMebValidationStatus => {
        if (backupPasswordKnown || backupMysqlUserValidation?.passwordStored) {
            return { tone: "ok", message: "Password valid." };
        }

        if (backupAccountExists === false) {
            return { tone: "warn", message: "Password not set." };
        }

        if (backupAccountExists === true) {
            const message = validation.backupPassword.message.toLowerCase();
            if (message.includes("not found") || message.includes("not set")) {
                return { tone: "warn", message: "Password not set." };
            }

            if (validation.backupPassword.tone === "warn") {
                return { tone: "warn", message: "Password invalid." };
            }
        }

        return { tone: "info", message: "Password status not checked." };
    };

    const refreshConfigurationPathValidation = async (nextConfiguration: IMebConfiguration): Promise<void> => {
        if (!moduleSessionId) {
            updateValidation({
                mysqlbackupPath: { tone: "warn", message: "Open a MySQL connection before validating paths." },
                backupHomePath: { tone: "warn", message: "Open a MySQL connection before validating paths." },
            });

            return;
        }

        updateValidation({
            mysqlbackupPath: { tone: "info", message: "Checking mysqlbackup path." },
            backupHomePath: { tone: "info", message: "Checking backup home directory." },
        });

        try {
            const localAccess = await ShellInterface.meb.validateLocalBackupAccess(moduleSessionId);
            setLocalAccessValidation(localAccess);
            updateValidation({
                mysqlbackupPath: localAccess.mysqlbackupStatus,
            });
        } catch (reason: unknown) {
            const message = convertErrorToString(reason);
            updateValidation({
                mysqlbackupPath: { tone: "warn", message },
            });
        }

        if (!nextConfiguration.backupHomePath.trim()) {
            updateValidation({
                backupHomePath: { tone: "warn", message: "Enter the backup home directory." },
            });

            return;
        }

        try {
            const result = await ShellInterface.meb.validateBackupHome(
                moduleSessionId,
                nextConfiguration.backupHomePath,
            );
            setBackupHomeValidation(result);
            updateValidation({
                backupHomePath: result.status,
            });
        } catch (reason: unknown) {
            const message = convertErrorToString(reason);
            updateValidation({
                backupHomePath: { tone: "warn", message },
            });
        }
    };

    const applyConfiguration = async (): Promise<void> => {
        if (backupCommandsDisabled) {
            return;
        }

        const nextConfiguration = normalizeMebConfiguration(draftConfiguration);

        if (!moduleSessionId) {
            void ui.showErrorMessage("Open a MySQL connection before configuring Enterprise Backup.", {});

            return;
        }

        setApplyingConfiguration(true);
        try {
            const nextSetupState = await ShellInterface.meb.applySetup(
                moduleSessionId,
                nextConfiguration.backupHomePath,
                nextConfiguration.backupUser,
            );
            const storedConfiguration = normalizeMebConfiguration({
                mysqlbackupPath: nextSetupState.mysqlbackupPath ?? nextConfiguration.mysqlbackupPath,
                backupHomePath: nextSetupState.backupHomePath ?? nextConfiguration.backupHomePath,
                backupUser: nextSetupState.mysqlBackupUser || nextConfiguration.backupUser,
            });

            if (connection) {
                const nextSettings = {
                    ...connection.details.settings,
                    enterpriseBackup: storedConfiguration,
                };
                const nextDetails = {
                    ...connection.details,
                    settings: nextSettings,
                };

                await ShellInterface.dbConnections.updateDbConnection(webSession.currentProfileId, nextDetails);
                connection.details.settings = nextSettings;
            }

            onApplied(storedConfiguration, nextSetupState);
            setDraftConfiguration(storedConfiguration);
            configurationDialogRef.current?.close(false);
        } catch (reason: unknown) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Cannot save MySQL Enterprise Backup configuration: ${message}`, {});
        } finally {
            setApplyingConfiguration(false);
        }
    };

    const updateConfiguration = (values: Partial<IMebConfiguration>): void => {
        setDraftConfiguration((current) => {
            return {
                ...current,
                ...values,
            };
        });
    };

    const refreshLocalAccess = async (): Promise<IMebPrerequisitesValidation | undefined> => {
        setCheckingLocalAccess(true);
        try {
            if (!moduleSessionId) {
                throw new Error("Open a MySQL connection before checking local access.");
            }

            const nextValidation = await ShellInterface.meb.validateLocalBackupAccess(moduleSessionId);
            setLocalAccessValidation(nextValidation);
            updateValidation({
                mysqlbackupPath: nextValidation.mysqlbackupStatus,
            });

            return nextValidation;
        } catch (reason: unknown) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Cannot check MySQL Enterprise Backup local access: ${message}`, {});

            return undefined;
        } finally {
            setCheckingLocalAccess(false);
        }
    };

    useEffect(() => {
        if (!active || wizardPage !== 1 || !moduleSessionId) {
            return;
        }

        void refreshLocalAccess();
    }, [moduleSessionId, active, wizardPage]);

    const refreshBackupHomeValidation = async (): Promise<IMebBackupHomeValidation | undefined> => {
        try {
            if (!moduleSessionId) {
                throw new Error("Open a MySQL connection before checking the backup home.");
            }

            const result = await ShellInterface.meb.validateBackupHome(
                moduleSessionId,
                draftConfiguration.backupHomePath,
            );
            setBackupHomeValidation(result);
            updateValidation({
                backupHomePath: result.status,
            });

            return result;
        } catch (reason: unknown) {
            const message = convertErrorToString(reason);
            updateValidation({
                backupHomePath: { tone: "warn", message },
            });

            return undefined;
        }
    };

    const createBackupHomeDirectory = async (): Promise<void> => {
        if (backupCommandsDisabled) {
            return;
        }

        const backupHomePath = draftConfiguration.backupHomePath.trim();

        if (!backupHomePath) {
            updateValidation({
                backupHomePath: { tone: "warn", message: "Enter a backup home directory to create." },
            });

            return;
        }

        if (!moduleSessionId) {
            updateValidation({
                backupHomePath: {
                    tone: "warn",
                    message: "Open a MySQL connection before creating the backup home.",
                },
            });
            void ui.showErrorMessage("Open a MySQL connection before creating the backup home.", {});

            return;
        }

        updateValidation({
            backupHomePath: { tone: "info", message: "Creating backup home directory." },
        });
        setCreatingBackupHome(true);
        try {
            const result = await ShellInterface.meb.createBackupHome(moduleSessionId, backupHomePath);
            setBackupHomeValidation(result);
            resetBackupAccountValidation();
            if (result.backupHomePath) {
                updateConfiguration({ backupHomePath: result.backupHomePath });
            }
            updateValidation({
                backupHomePath: result.status,
            });
        } catch (reason: unknown) {
            const message = convertErrorToString(reason);
            updateValidation({
                backupHomePath: { tone: "warn", message },
            });
        } finally {
            setCreatingBackupHome(false);
        }
    };

    const refreshBackupMysqlUserValidation = async (): Promise<IMebMysqlBackupUserValidation | undefined> => {
        const backupUser = draftConfiguration.backupUser.trim();

        if (!moduleSessionId) {
            void ui.showErrorMessage("Open a MySQL connection before validating the backup account.", {});

            return undefined;
        }

        if (!backupUser) {
            updateValidation({
                backupUser: { tone: "warn", message: "Enter the backup MySQL username." },
            });

            return undefined;
        }

        try {
            const result = await ShellInterface.meb.validateBackupMysqlUser(
                moduleSessionId,
                draftConfiguration.backupHomePath,
                backupUser,
                undefined,
            );
            setBackupMysqlUserValidation(result);
            setBackupAccountExists(result.exists);
            updateValidation({
                backupUser: result.status,
                backupPassword: result.passwordStatus,
            });
            setBackupPasswordKnown(result.passwordStored);

            return result;
        } catch (reason: unknown) {
            const message = convertErrorToString(reason);
            updateValidation({
                backupUser: { tone: "warn", message },
            });

            return undefined;
        }
    };

    const ensureBackupAccountReady = async (): Promise<boolean> => {
        if (backupMysqlUserValidation !== undefined) {
            return backupMysqlUserValidation.valid;
        }

        const result = await refreshBackupMysqlUserValidation();
        if (result !== undefined) {
            return result.valid;
        }

        if (backupAccountExists) {
            updateValidation({
                backupPassword: {
                    tone: "warn",
                    message: "Input or reset the backup account password before finishing setup.",
                },
            });

            return false;
        }

        updateValidation({
            backupPassword: {
                tone: "warn",
                message: "Create the backup MySQL account before finishing setup.",
            },
        });

        return false;
    };

    const continueWizard = async (): Promise<void> => {
        if (wizardPage === 0) {
            if (setupState?.mysqlbackupExists !== true) {
                return;
            }

            setWizardPage(1);

            return;
        }

        if (wizardPage === 1) {
            const result = await refreshLocalAccess();
            if (!result?.valid) {
                return;
            }

            setWizardPage(2);

            return;
        }

        if (wizardPage === 2) {
            const result = await refreshBackupHomeValidation();
            if (!result?.valid) {
                return;
            }

            resetBackupAccountValidation();
            setWizardPage(3);

            return;
        }

        const accountReady = await ensureBackupAccountReady();
        if (!accountReady) {
            return;
        }

        await applyConfiguration();
    };

    const backWizard = (): void => {
        setWizardPage((Math.max(0, wizardPage - 1)) as MebWizardPage);
    };

    const setBackupAccountActionStatus = (status: IMebValidationStatus): void => {
        updateValidation({
            backupPassword: status,
        });
    };

    const setBackupMysqlUserValidationResult = (result: IMebMysqlBackupUserValidation): void => {
        setBackupMysqlUserValidation(result);
        setBackupAccountExists(result.exists);
        setBackupPasswordKnown(result.passwordStored);
        updateValidation({
            backupUser: result.status,
            backupPassword: result.passwordStatus,
        });
    };

    const validateAndStoreBackupAccountPassword = async (password: string): Promise<boolean> => {
        const backupUser = draftConfiguration.backupUser.trim();

        if (!moduleSessionId) {
            void ui.showErrorMessage("Open a MySQL connection before validating the backup account.", {});

            return false;
        }

        try {
            const result = await ShellInterface.meb.validateBackupMysqlUser(
                moduleSessionId,
                draftConfiguration.backupHomePath,
                backupUser,
                password,
            );
            setBackupMysqlUserValidationResult(result);
            if (result.passwordStored) {
                void ui.showInformationMessage("Backup account password was validated and stored.", {});
            }

            return result.passwordStored;
        } catch (reason: unknown) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Cannot validate backup account: ${message}`, {});

            return false;
        }
    };

    const requireCheckedBackupAccount = (): boolean => {
        if (backupAccountExists !== undefined) {
            return true;
        }

        setBackupAccountActionStatus({
            tone: "info",
            message: "Click Finish to check the backup account before choosing an account action.",
        });

        return false;
    };

    const inputBackupAccountPassword = async (): Promise<boolean> => {
        const backupUser = draftConfiguration.backupUser.trim();

        if (!requireCheckedBackupAccount()) {
            return false;
        }

        if (!backupAccountExists) {
            setBackupAccountActionStatus({
                tone: "warn",
                message: "Use Create User to create and store backup account credentials.",
            });

            return false;
        }

        setBackupAccountActionStatus({
            tone: "info",
            message: "Opening password prompt.",
        });
        const password = await ui.requestPassword({
            requestId: "mebInputBackupPassword",
            caption: "Store Backup User Password",
            description: [`Enter the existing password for ${backupUser}.`],
            user: backupUser,
            passwordLabel: "Existing password",
            passwordRequired: true,
            confirmPassword: false,
            submitCaption: "Store",
        });

        if (password !== undefined) {
            return await validateAndStoreBackupAccountPassword(password);
        }

        setBackupAccountActionStatus({
            tone: "warn",
            message: "Password storage was cancelled or the password prompt could not be opened.",
        });

        return false;
    };

    const createBackupAccount = async (): Promise<boolean> => {
        const backupUser = draftConfiguration.backupUser.trim();

        if (!requireCheckedBackupAccount()) {
            return false;
        }

        if (backupAccountExists) {
            setBackupAccountActionStatus({
                tone: "warn",
                message: "Use Input Password or Reset Password for an existing backup account.",
            });

            return false;
        }

        if (!moduleSessionId) {
            void ui.showErrorMessage("Open a MySQL connection before creating the backup account.", {});

            return false;
        }

        try {
            const result = await ShellInterface.meb.createBackupMysqlUser(
                moduleSessionId,
                draftConfiguration.backupHomePath,
                backupUser,
            );
            setBackupMysqlUserValidationResult(result);
            if (result.passwordStored) {
                void ui.showInformationMessage("Backup account was created and credentials were stored.", {});
            }

            return result.passwordStored;
        } catch (reason: unknown) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Cannot create backup account: ${message}`, {});

            return false;
        }
    };

    const fixBackupAccount = async (): Promise<void> => {
        const backupUser = draftConfiguration.backupUser.trim();

        if (!requireCheckedBackupAccount() || !backupAccountExists || !moduleSessionId || fixingBackupAccount) {
            return;
        }

        setFixingBackupAccount(true);
        try {
            const result = await ShellInterface.meb.fixBackupMysqlUser(
                moduleSessionId,
                draftConfiguration.backupHomePath,
                backupUser,
            );
            setBackupMysqlUserValidationResult(result);
            if (result.missingGrants.length === 0) {
                void ui.showInformationMessage("Backup account grants were fixed.", {});
            }
        } catch (reason: unknown) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Cannot fix backup account: ${message}`, {});
        } finally {
            setFixingBackupAccount(false);
        }
    };

    const handleBackupAccountAction = async (): Promise<void> => {
        if (backupCommandsDisabled) {
            return;
        }

        if ((backupMysqlUserValidation?.missingGrants.length ?? 0) > 0) {
            await fixBackupAccount();

            return;
        }

        if (backupPasswordKnown || backupMysqlUserValidation?.passwordStored) {
            return;
        }

        if (backupAccountExists === undefined) {
            await refreshBackupMysqlUserValidation();

            return;
        }

        if (backupAccountExists) {
            await inputBackupAccountPassword();

            return;
        }

        await createBackupAccount();
    };

    const resetBackupAccountPassword = async (password?: string): Promise<boolean> => {
        const backupUser = draftConfiguration.backupUser.trim();

        if (!requireCheckedBackupAccount()) {
            return false;
        }

        if (!backupAccountExists) {
            setBackupAccountActionStatus({
                tone: "warn",
                message: "Use Create User to create and store backup account credentials.",
            });

            return false;
        }

        if (!moduleSessionId) {
            void ui.showErrorMessage("Open a MySQL connection before resetting the backup account password.", {});

            return false;
        }

        if (!backupUser) {
            updateValidation({
                backupUser: { tone: "warn", message: "Enter the backup MySQL username." },
            });

            return false;
        }

        updateValidation({
            backupPassword: { tone: "info", message: "Resetting backup account password." },
        });

        try {
            const result = await ShellInterface.meb.resetBackupMysqlUserPassword(
                moduleSessionId,
                draftConfiguration.backupHomePath,
                backupUser,
                password,
            );
            setBackupMysqlUserValidationResult(result);
            if (result.passwordStored) {
                void ui.showInformationMessage("Backup account password was reset and stored.", {});
            }

            return result.passwordStored;
        } catch (reason: unknown) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Cannot reset backup account password: ${message}`, {});

            return false;
        }
    };

    const promptBackupAccountPasswordReset = async (): Promise<void> => {
        const backupUser = draftConfiguration.backupUser.trim();

        if (!requireCheckedBackupAccount()) {
            return;
        }

        if (!backupAccountExists) {
            setBackupAccountActionStatus({
                tone: "warn",
                message: "Use Create User to create and store backup account credentials.",
            });

            return;
        }

        const password = await ui.requestPassword({
            requestId: "mebResetBackupPassword",
            caption: "Reset Backup User Password",
            description: [`Enter a new password for ${backupUser}.`],
            user: backupUser,
            passwordLabel: "New password",
            confirmPasswordLabel: "Confirm",
            confirmPassword: true,
            submitCaption: "Reset",
        });

        if (password !== undefined) {
            await resetBackupAccountPassword(password);
        }
    };

    const resetBackupAccountToRandomPassword = async (): Promise<void> => {
        await resetBackupAccountPassword();
    };

    const backupAccountPasswordValid = backupPasswordKnown || backupMysqlUserValidation?.passwordStored === true;
    const backupAccountMissingGrants = (backupMysqlUserValidation?.missingGrants.length ?? 0) > 0;
    const backupAccountActionCaption = backupAccountMissingGrants
        ? fixingBackupAccount ? "Fixing..." : "Fix Account"
        : backupAccountPasswordValid
            ? "Check Account"
            : backupAccountExists === undefined
                ? "Check Account"
                : backupAccountExists ? "Store Password..." : "Create User";
    const disableBackupAccountAction = backupCommandsDisabled || draftConfiguration.backupUser.trim() === ""
        || (!backupAccountMissingGrants && backupAccountPasswordValid) || fixingBackupAccount;
    const disableConfigurationApply = backupCommandsDisabled || applyingConfiguration
        || draftConfiguration.backupHomePath.trim() === "" || draftConfiguration.backupUser.trim() === "";
    const wizardSteps = [
        "Introduction",
        "Local Access",
        "Backup Home",
        "MySQL User for Backups",
    ];
    const renderWizardStatus = (label: string, value: ComponentChild,
        status?: IMebValidationStatus): ComponentChild => {
        return (
            <>
                <div className="enterpriseBackupWizardStatusRow">
                    <div>
                        <span>{label}</span>
                        <strong>{value}</strong>
                    </div>
                </div>
                <div>
                    {status && renderValidation(status)}
                </div>
            </>
        );
    };

    const renderWizardPageLayout = (
        title: string,
        description: ComponentChild,
        body?: ComponentChild,
    ): ComponentChild => {
        return (
            <div className="enterpriseBackupWizardPage">
                <div className="enterpriseBackupWizardPageHeader">
                    <h1>{title}</h1>
                    <div className="enterpriseBackupWizardPageDescription">
                        {description}
                    </div>
                </div>

                {body && <div className="enterpriseBackupWizardPageBody">
                    {body}
                </div>}
            </div>
        );
    };

    const getWizardMysqlbackupStatus = (): IMebValidationStatus => {
        const mysqlbackupPath = setupState?.mysqlbackupPath ?? expectedMysqlbackupPath;

        return !setupState ? {
            tone: "info",
            message: "Checking for mysqlbackup at @@basedir/bin.",
        } : setupState.mysqlbackupExists ? {
            tone: "ok",
            message: "mysqlbackup was found at the expected path",
        } : {
            tone: "warn",
            message: `mysqlbackup was not found at ${mysqlbackupPath}. MySQL Enterprise Edition is required.`,
        };
    };

    const renderWizardIntro = (): ComponentChild => {
        const mysqlbackupPath = setupState?.mysqlbackupPath ?? expectedMysqlbackupPath;

        return renderWizardPageLayout(
            "MySQL Enterprise Backup",
            <>
                <p>
                    MySQL Enterprise Backup (MEB) provides online backup and
                    recovery for MySQL databases, including full, incremental,
                    partial, and point-in-time recovery workflows. It is
                    intended for production environments where backups need to
                    be consistent, restorable, and minimally disruptive to
                    running workloads. Key capabilities include compression,
                    encryption, backup validation, selective restore, and
                    support for backing up to local or cloud storage.
                </p>
                <br />
                <p>This wizard checks pre-requisites and configures MySQL Workbench
                    for securely creating and scheduling backups using MEB.
                </p>
            </>,
            <div className="enterpriseBackupWizardStatusRow">
                <div>
                    <span>Path to mysqlbackup binary:</span>
                    <strong>{mysqlbackupPath}</strong>
                </div>
            </div>,
        );
    };

    const localAccessCheckStatus = (): IMebValidationStatus => {
        const datadir = serverInfo.datadir && serverInfo.datadir !== "Unknown"
            ? serverInfo.datadir
            : "the MySQL data directory";

        if (!localAccessValidation) {
            return {
                tone: "info",
                message: checkingLocalAccess
                    ? "Checking current-user access to the MySQL data directory."
                    : "The wizard will check that the current OS user can read and traverse the MySQL data directory.",
            };
        }

        if (localAccessValidation.valid) {
            return {
                tone: "ok",
                message: "The current OS user can access the MySQL data directory.",
            };
        }

        if (localAccessValidation.userStatus.tone === "warn") {
            return {
                tone: "warn",
                message: localAccessValidation.userStatus.message,
            };
        }

        if (localAccessValidation.datadirStatus.tone === "warn") {
            return {
                tone: "warn",
                message: `${localAccessValidation.datadirStatus.message} mysqlbackup requires read access to the MySQL `
                    + `data directory (${datadir}). Therefore, the user you run Workbench as must have read permission `
                    + `to data directory and its contents.`,
            };
        }

        return {
            tone: "warn",
            message: `The current OS user must be able to read and traverse ${datadir}.`,
        };
    };

    const backupHomeCheckStatus = (): IMebValidationStatus => {
        if (creatingBackupHome) {
            return { tone: "info", message: "Creating backup home directory." };
        }

        if (backupHomeValidation) {
            return backupHomeValidation.status;
        }

        if (validation.backupHomePath.tone === "warn") {
            return validation.backupHomePath;
        }

        return draftConfiguration.backupHomePath.trim() ? {
            tone: "info",
            message: "Click Next to validate this backup home.",
        } : {
            tone: "info",
            message: "Choose an existing directory and/or create one.",
        };
    };

    const backupHomeWarningDetails = (): Array<{
        label: string;
        value: string;
        status: IMebValidationStatus;
    }> => {
        return backupHomeValidation ? [{
            label: "Owner",
            value: backupHomeValidation.owner ?? "Unknown",
            status: backupHomeValidation.ownershipStatus,
        }, {
            label: "Permissions",
            value: "Owner-only",
            status: backupHomeValidation.permissionsStatus,
        }, {
            label: "Instance",
            value: "Current data directory",
            status: backupHomeValidation.reuseStatus,
        }, {
            label: "Access",
            value: setupState?.currentOsUser ?? localAccessValidation?.currentOsUser ?? "Current OS user",
            status: backupHomeValidation.accessStatus,
        }].filter((item) => {
            return item.status.tone === "warn";
        }) : [];
    };

    const backupMysqlUserStatus = (): IMebValidationStatus => {
        if (draftConfiguration.backupUser.trim() === "") {
            return { tone: "warn", message: "Enter the backup MySQL username." };
        }

        if (backupAccountPasswordValid) {
            return {
                tone: "ok",
                message: "Credentials are stored in the backup home login file.",
            };
        }

        return backupMysqlUserValidation?.passwordStatus ?? backupMysqlUserValidation?.status ?? {
            tone: "info",
            message: "The account will be checked when you click Finish.",
        };
    };

    const renderBackupMysqlUserValidation = (): ComponentChild => {
        const status = backupMysqlUserStatus();
        const missingGrants = backupMysqlUserValidation?.missingGrants ?? [];
        if (missingGrants.length === 0) {
            return renderValidation(status);
        }

        return <div className="enterpriseBackupValidation warn">
            <Icon src={validationIcon("warn")} />
            <span>
                Backup account is missing <span className="enterpriseBackupTooltipTarget"
                    data-tooltip={missingGrants.join("\n")}>required grants</span>.
            </span>
        </div>;
    };

    const renderWizardLocalAccess = (): ComponentChild => {
        const datadir = localAccessValidation?.datadir ?? setupState?.datadir ?? "Unknown";
        const datadirOwner = localAccessValidation?.datadirOwner ?? setupState?.datadirOwner ?? "Unknown";
        const datadirGroup = localAccessValidation?.datadirGroup ?? setupState?.datadirGroup ?? "Unknown";
        const currentUser = localAccessValidation?.currentOsUser ?? setupState?.currentOsUser ?? "Unknown";

        return renderWizardPageLayout(
            "Read Access to MySQL Data Directory",
            <>
                <p>
                    mysqlbackup requires read access to the MySQL data directory ({datadir}).
                    Thus, the user you run Workbench as must have read permission to data directory and its contents.,
                </p>
            </>,
            <div className="enterpriseBackupWizardInfoText">
                <p>
                    Current OS user: <strong>{currentUser}</strong>
                </p>
                <p>
                    MySQL data directory: <strong>{serverInfo.datadir}</strong>
                </p>
                <p>
                    Data directory owner: user <strong>{datadirOwner}</strong>, group{" "}
                    <strong>{datadirGroup}</strong>
                    {datadirOwner === "root" && " (running mysqld and backups as root is strongly discouraged)"}
                </p>
            </div>,
        );
    };

    const renderWizardBackupHome = (): ComponentChild => {
        const showCreateBackupHome = creatingBackupHome
            || (backupHomeValidation?.exists === false && backupHomeValidation.backupHomePath != null);

        return renderWizardPageLayout(
            "Backup Home Directory",
            <p>
                The backup home stores backup files, backup profiles, configuration and other
                files for this MySQL instance.
            </p>,
            <>
                <div className="enterpriseBackupWizardField enterpriseBackupWizardBackupHomeField">
                    <span>Backup home directory</span>
                    <div className="enterpriseBackupWizardBackupHomeInput">
                        <FileSelector
                            id="enterpriseBackupWizardHome"
                            path={draftConfiguration.backupHomePath}
                            title="Select backup home"
                            openLabel="Use Directory"
                            canSelectFiles={false}
                            canSelectFolders={true}
                            onChange={(files) => {
                                setBackupHomeValidation(undefined);
                                resetBackupAccountValidation();
                                updateValidation({
                                    backupPassword: { tone: "info", message: "Waiting for validation." },
                                });
                                updateConfiguration({ backupHomePath: files[0]?.name ?? "" });
                            }}
                        />
                        {showCreateBackupHome && <Button
                            onClick={() => {
                                void createBackupHomeDirectory();
                            }}
                            disabled={backupCommandsDisabled || creatingBackupHome
                                || draftConfiguration.backupHomePath.trim() === ""}
                        >
                            {creatingBackupHome ? "Creating" : "Create"}
                        </Button>}
                    </div>
                </div>

                <div className="enterpriseBackupWizardInfoText">
                    <p>
                        The directory must be owned by the current OS user, allow only owner access, and be readable
                        and writable by MySQL Workbench. It must not already be configured for another MySQL data
                        directory.
                    </p>
                </div>
            </>,
        );
    };

    const renderWizardBackupUser = (): ComponentChild => {
        const renderActions = (): ComponentChild => {
            if (backupAccountExists === undefined || backupAccountPasswordValid) {
                return null;
            }

            if (backupAccountExists) {
                return (
                    <div className="enterpriseBackupWizardAccountActions">
                        <p>
                            The MySQL account exists, please provide its password.
                            If you don't know it, you may reset it.
                        </p>
                        <Button onClick={() => {
                            void inputBackupAccountPassword();
                        }} disabled={disableBackupAccountAction}>
                            Input Password
                        </Button>
                        <Button onClick={() => {
                            void promptBackupAccountPasswordReset();
                        }} disabled={disableBackupAccountAction}>
                            Reset Password
                        </Button>
                        <Button onClick={() => {
                            void resetBackupAccountToRandomPassword();
                        }} disabled={disableBackupAccountAction}>
                            Reset to Random Password
                        </Button>
                    </div>
                );
            }

            return (
                <div className="enterpriseBackupWizardAccountActions">
                    <Button onClick={() => {
                        void createBackupAccount();
                    }} disabled={disableBackupAccountAction}>
                        Create User
                    </Button>
                </div>
            );
        };

        return renderWizardPageLayout(
            "MySQL User for Backups",
            <p>
                mysqlbackup will use this MySQL account to connect to the target server. The account should
                have MEB backup privileges, including BACKUP_ADMIN, backup history table privileges,
                and read privileges. Click Finish to check the account. If an account does not exist, the wizard can
                create one. If you already have an account, you must either provide its password or reset it to a new
                one.
            </p>,
            <div className="enterpriseBackupWizardAccountPanel">
                <label>
                    <span>MySQL username for backups</span>
                    <Input
                        value={draftConfiguration.backupUser}
                        spellCheck={false}
                        onChange={(_event, data) => {
                            resetBackupAccountValidation();
                            updateConfiguration({ backupUser: data.value });
                        }}
                    />
                </label>

                {renderActions()}
            </div>,
        );
    };

    const renderWizardPage = (): ComponentChild => {
        switch (wizardPage) {
            case 1:
                return renderWizardLocalAccess();

            case 2:
                return renderWizardBackupHome();

            case 3:
                return renderWizardBackupUser();

            default:
                return renderWizardIntro();
        }
    };

    const renderWizardStatusFooter = (): ComponentChild => {
        switch (wizardPage) {
            case 0:
                return (
                    <div className="enterpriseBackupWizardStatusFooter">
                        <div className="enterpriseBackupWizardStatusList">
                            {renderValidation(getWizardMysqlbackupStatus())}
                        </div>
                    </div>
                );

            case 1:
                return (
                    <div className="enterpriseBackupWizardStatusFooter">
                        <div className="enterpriseBackupWizardResultRow">
                            {renderValidation(localAccessCheckStatus())}
                        </div>
                    </div>
                );

            case 2: {
                const backupHomeDetails = backupHomeWarningDetails();

                return (
                    <div className="enterpriseBackupWizardStatusFooter">
                        <div className="enterpriseBackupWizardResultRow">
                            {renderValidation(backupHomeCheckStatus())}
                        </div>
                        {backupHomeDetails.length > 0 && <div className="enterpriseBackupWizardStatusList">
                            {backupHomeDetails.map((item) => {
                                return renderWizardStatus(item.label, item.value, item.status);
                            })}
                        </div>}
                    </div>
                );
            }

            default:
                return (
                    <div className="enterpriseBackupWizardStatusFooter">
                        {renderBackupMysqlUserValidation()}
                    </div>
                );
        }
    };

    const renderConfigurationWizard = (): ComponentChild => {
        const nextDisabled = backupCommandsDisabled || applyingConfiguration || checkingLocalAccess
            || creatingBackupHome
            || (wizardPage === 0 && setupState?.mysqlbackupExists !== true)
            || (wizardPage === 2 && !draftConfiguration.backupHomePath.trim())
            || (wizardPage === 3 && !draftConfiguration.backupUser.trim());

        return (
            <main className="enterpriseBackupSurface enterpriseBackupIntroSurface">
                <section className="enterpriseBackupWizard">
                    <ol className="enterpriseBackupWizardSteps">
                        {wizardSteps.map((step, index) => {
                            const className = index === wizardPage
                                ? "enterpriseBackupWizardStep current"
                                : index < wizardPage ? "enterpriseBackupWizardStep complete"
                                    : "enterpriseBackupWizardStep";

                            return (
                                <li className={className} key={step}>
                                    <span>{index + 1}</span>
                                    <strong>{step}</strong>
                                </li>
                            );
                        })}
                    </ol>

                    <div className="enterpriseBackupWizardContent">
                        {renderWizardPage()}
                        {loadError && <div className="enterpriseBackupLoadError">{loadError}</div>}
                    </div>

                    {renderWizardStatusFooter()}

                    <div className="enterpriseBackupWizardActions">
                        <Button onClick={cancelWizard}>
                            Cancel
                        </Button>
                        <Button onClick={backWizard} disabled={wizardPage === 0}>
                            Back
                        </Button>
                        <Button onClick={() => {
                            void continueWizard();
                        }} disabled={nextDisabled}>
                            {wizardPage === 3 ? applyingConfiguration ? "Applying" : "Finish" : "Next"}
                        </Button>
                    </div>
                </section>
            </main>
        );
    };

    useEffect(() => {
        if (active && !activeRef.current) {
            setDraftConfiguration(configuration);
            setLocalAccessValidation(undefined);
            setBackupHomeValidation(undefined);
            resetBackupAccountValidation();
            setWizardPage(0);
        } else if (active) {
            setDraftConfiguration((current) => {
                return {
                    ...current,
                    mysqlbackupPath: configuration.mysqlbackupPath || current.mysqlbackupPath,
                    backupUser: configuration.backupUser || current.backupUser,
                };
            });
        }
        activeRef.current = active;
    }, [active, configuration, resetBackupAccountValidation]);

    useEffect(() => {
        if (!dialogOpen) {
            return;
        }

        const nextConfiguration = normalizeMebConfiguration(configuration);
        setDraftConfiguration(nextConfiguration);
        setBackupHomeValidation(undefined);
        resetBackupAccountValidation();
        void refreshConfigurationPathValidation(nextConfiguration);
        configurationDialogRef.current?.open();
    }, [configuration, dialogOpen, resetBackupAccountValidation]);

    useEffect(() => {
        let cancelled = false;
        if (active) {
            return () => {
                cancelled = true;
            };
        }

        resetBackupAccountValidation();

        const timeout = setTimeout(() => {
            if (!moduleSessionId || !draftConfiguration.backupHomePath.trim()
                || !draftConfiguration.backupUser.trim()) {
                updateValidation({
                    backupUser: { tone: "warn", message: "Enter the backup MySQL username." },
                });

                return;
            }

            void ShellInterface.meb.validateBackupMysqlUser(
                moduleSessionId,
                draftConfiguration.backupHomePath,
                draftConfiguration.backupUser,
                undefined,
            ).then((result) => {
                if (!cancelled) {
                    setBackupMysqlUserValidation(result);
                    setBackupAccountExists(result.exists);
                    updateValidation({
                        backupUser: result.status,
                        backupPassword: result.passwordStatus,
                    });
                }
            }).catch((reason: unknown) => {
                if (!cancelled) {
                    const message = convertErrorToString(reason);
                    updateValidation({
                        backupUser: { tone: "warn", message },
                    });
                }
            });
        }, 200);

        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [
        draftConfiguration.backupHomePath,
        draftConfiguration.backupUser,
        moduleSessionId,
        resetBackupAccountValidation,
        updateValidation,
        active,
    ]);

    return (
        <>
            {active && renderConfigurationWizard()}
            <Dialog
                ref={configurationDialogRef}
                className="enterpriseBackupConfigurationDialog"
                caption="Configure MySQL Enterprise Backup"
                content={
                    <div className="enterpriseBackupConfigurationContent">
                        <section className="enterpriseBackupServerFacts" aria-label="MySQL server information">
                            <div className="enterpriseBackupServerFactRow twoColumns">
                                <div>
                                    <span>MySQL version</span>
                                    <strong>{serverInfo.mysqlVersion}</strong>
                                </div>
                                <div>
                                    <span>Edition</span>
                                    <strong>{serverInfo.mysqlEdition}</strong>
                                </div>
                            </div>
                            <div className="enterpriseBackupServerFactRow">
                                <span>Data directory</span>
                                <strong>{serverInfo.datadir}</strong>
                            </div>
                            <div className="enterpriseBackupServerFactRow">
                                <span>Workbench OS user</span>
                                <strong>
                                    {setupState?.currentOsUser ?? localAccessValidation?.currentOsUser ?? "Unknown"}
                                </strong>
                            </div>
                        </section>

                        <section className="enterpriseBackupConfigurationFields" aria-label="MEB configuration fields">
                            <label>
                                <span>Backup home directory</span>
                                <FileSelector
                                    id="enterpriseBackupHome"
                                    path={draftConfiguration.backupHomePath}
                                    title="Select backup home"
                                    openLabel="Use Directory"
                                    canSelectFiles={false}
                                    canSelectFolders={true}
                                    onChange={(files) => {
                                        setBackupHomeValidation(undefined);
                                        resetBackupAccountValidation();
                                        updateValidation({
                                            backupPassword: {
                                                tone: "info",
                                                message: "Waiting for validation.",
                                            },
                                        });
                                        updateConfiguration({ backupHomePath: files[0]?.name ?? "" });
                                    }}
                                />
                                {renderValidation(validation.backupHomePath)}
                            </label>

                            <div className="enterpriseBackupAccountFields">
                                <label>
                                    <span>MySQL user for backups</span>
                                    <Input
                                        value={draftConfiguration.backupUser}
                                        spellCheck={false}
                                        onChange={(_event, data) => {
                                            resetBackupAccountValidation();
                                            updateValidation({
                                                backupPassword: {
                                                    tone: "info",
                                                    message: "Waiting for validation.",
                                                },
                                            });
                                            updateConfiguration({ backupUser: data.value });
                                        }}
                                    />
                                    {renderBackupMysqlUserValidation()}
                                </label>

                                <Button onClick={() => {
                                    void handleBackupAccountAction();
                                }} disabled={disableBackupAccountAction}>
                                    {backupAccountActionCaption}
                                </Button>
                                <div className="enterpriseBackupAccountPasswordStatus">
                                    {renderValidation(backupAccountPasswordDisplayStatus())}
                                </div>
                            </div>
                        </section>
                    </div>
                }
                actions={{
                    end: [
                        <Button key="apply" onClick={() => {
                            void applyConfiguration();
                        }} disabled={disableConfigurationApply}>
                            {applyingConfiguration ? "Applying" : "Apply"}
                        </Button>,
                        <Button key="cancel" onClick={() => {
                            configurationDialogRef.current?.close(true);
                        }}>
                            Cancel
                        </Button>,
                    ],
                }}
                onClose={() => {
                    onDialogOpenChange(false);
                }}
            />
        </>
    );
};
