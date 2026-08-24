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
import { Dialog } from "../../components/ui/Dialog/Dialog.js";
import type { ICdmConnectionEntry } from "../../data-models/ConnectionDataModel.js";
import { ShellInterface } from "../../supplement/ShellInterface/ShellInterface.js";
import {
    type IMebPrerequisitesValidation,
    type IMebSetupState,
    type IMebValidationStatus,
} from "../../supplement/ShellInterface/ShellInterfaceMeb.js";
import { webSession } from "../../supplement/WebSession.js";
import { convertErrorToString } from "../../utilities/helpers.js";
import {
    EnterpriseBackupAccount,
    type IMebBackupAccountState,
} from "./EnterpriseBackupAccount.js";
import {
    EnterpriseBackupHome,
    type IMebBackupHomeState,
} from "./EnterpriseBackupHome.js";
import { type MebOperationRunner, useMebOperation } from "./EnterpriseBackupOperation.js";
import { EnterpriseBackupValidationStatus } from "./EnterpriseBackupValidationStatus.js";

export interface IMebConfiguration {
    mysqlbackupPath: string;
    backupHomePath: string;
    backupUser: string;
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

export const normalizeMebConfiguration = (configuration: IMebConfiguration): IMebConfiguration => {
    return {
        mysqlbackupPath: configuration.mysqlbackupPath.trim(),
        backupHomePath: configuration.backupHomePath.trim(),
        backupUser: configuration.backupUser.trim(),
    };
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
    const dialogOpenRef = useRef(false);
    const dialogLifecycleGeneration = useRef(0);
    const wizardActiveRef = useRef(active);
    const wizardLocalAccessGeneration = useRef(0);
    const wizardLocalAccessRetryGeneration = useRef<number>();
    const wizardModuleSessionIdRef = useRef(moduleSessionId);
    const wizardPageRef = useRef<MebWizardPage>(0);
    const { activeOperation: wizardActiveOperation, runOperation: runWizardOperation } = useMebOperation();
    const {
        activeOperation: dialogActiveOperation,
        resetOperation: resetDialogOperation,
        runOperation: runDialogOperation,
    } = useMebOperation();
    const [localAccessValidation, setLocalAccessValidation] = useState<IMebPrerequisitesValidation>();
    const [wizardLocalAccessValidatedGeneration, setWizardLocalAccessValidatedGeneration] = useState<number>();
    const [wizardLocalAccessValidatedSessionId, setWizardLocalAccessValidatedSessionId] = useState<string>();
    const [wizardLocalAccessStatus, setWizardLocalAccessStatus] = useState<IMebValidationStatus>();
    const [draftConfiguration, setDraftConfiguration] = useState<IMebConfiguration>(configuration);
    const [dialogEntitiesActive, setDialogEntitiesActive] = useState(false);
    const [dialogLifecycleId, setDialogLifecycleId] = useState(0);
    const [dialogBackupHomeState, setDialogBackupHomeState] = useState<IMebBackupHomeState>({
        moduleSessionId,
        path: configuration.backupHomePath,
        valid: false,
    });
    const [dialogBackupAccountState, setDialogBackupAccountState] = useState<IMebBackupAccountState>({
        moduleSessionId,
        username: configuration.backupUser.trim(),
        valid: false,
    });
    const [wizardBackupHomeState, setWizardBackupHomeState] = useState<IMebBackupHomeState>({
        moduleSessionId,
        path: configuration.backupHomePath,
        valid: false,
    });
    const [wizardBackupAccountState, setWizardBackupAccountState] = useState<IMebBackupAccountState>({
        moduleSessionId,
        username: configuration.backupUser.trim(),
        valid: false,
    });
    const [wizardPage, setWizardPage] = useState<MebWizardPage>(0);

    wizardActiveRef.current = active;
    wizardModuleSessionIdRef.current = moduleSessionId;
    wizardPageRef.current = wizardPage;

    const wizardBusy = wizardActiveOperation !== undefined;
    const wizardDisabled = backupCommandsDisabled || wizardBusy;
    const wizardLocalAccessValid = localAccessValidation?.valid === true
        && wizardLocalAccessValidatedGeneration === wizardLocalAccessGeneration.current
        && wizardLocalAccessValidatedSessionId === moduleSessionId;
    const wizardBackupHomeValid = wizardBackupHomeState.valid
        && wizardBackupHomeState.path === draftConfiguration.backupHomePath
        && wizardBackupHomeState.validatedPath === draftConfiguration.backupHomePath
        && wizardBackupHomeState.moduleSessionId === moduleSessionId;
    const wizardBackupAccountValid = wizardBackupAccountState.valid
        && wizardBackupAccountState.backupHomePath === wizardBackupHomeState.validatedPath
        && wizardBackupAccountState.username === draftConfiguration.backupUser.trim()
        && wizardBackupAccountState.moduleSessionId === moduleSessionId;
    const normalizedDraftConfiguration = normalizeMebConfiguration(draftConfiguration);
    const normalizedStoredConfiguration = normalizeMebConfiguration(configuration);
    const dialogConfigurationChanged = normalizedDraftConfiguration.backupHomePath
        !== normalizedStoredConfiguration.backupHomePath
        || normalizedDraftConfiguration.backupUser !== normalizedStoredConfiguration.backupUser;
    const dialogSurfaceActive = dialogOpen && dialogEntitiesActive;
    const dialogBusy = dialogActiveOperation !== undefined;
    const dialogBackupHomeValid = dialogSurfaceActive && dialogBackupHomeState.valid
        && dialogBackupHomeState.path === normalizedDraftConfiguration.backupHomePath
        && dialogBackupHomeState.validatedPath === normalizedDraftConfiguration.backupHomePath
        && dialogBackupHomeState.moduleSessionId === moduleSessionId;
    const dialogBackupAccountValid = dialogSurfaceActive && dialogBackupAccountState.valid
        && dialogBackupAccountState.backupHomePath === dialogBackupHomeState.validatedPath
        && dialogBackupAccountState.username === normalizedDraftConfiguration.backupUser
        && dialogBackupAccountState.moduleSessionId === moduleSessionId;
    const disableDialogApply = backupCommandsDisabled || dialogBusy || !dialogConfigurationChanged
        || !dialogBackupHomeValid || !dialogBackupAccountValid;

    const resetWizardEntities = (path: string, username: string): void => {
        setWizardBackupHomeState({ moduleSessionId, path, valid: false });
        setWizardBackupAccountState({ moduleSessionId, username: username.trim(), valid: false });
    };

    const resetDialogEntities = (path: string, username: string): void => {
        setDialogBackupHomeState({ moduleSessionId, path, valid: false });
        setDialogBackupAccountState({ moduleSessionId, username: username.trim(), valid: false });
    };

    const cancelWizard = (): void => {
        if (wizardBusy) {
            return;
        }

        ++wizardLocalAccessGeneration.current;
        wizardLocalAccessRetryGeneration.current = undefined;
        setLocalAccessValidation(undefined);
        setWizardLocalAccessValidatedGeneration(undefined);
        setWizardLocalAccessValidatedSessionId(undefined);
        setWizardLocalAccessStatus(undefined);
        resetWizardEntities(draftConfiguration.backupHomePath, draftConfiguration.backupUser);
        setWizardPage(0);
        onCancel();
    };

    const applyConfiguration = async (operationRunner: MebOperationRunner): Promise<void> => {
        if (backupCommandsDisabled) {
            return;
        }

        const nextConfiguration = normalizeMebConfiguration(draftConfiguration);

        if (!moduleSessionId) {
            void ui.showErrorMessage("Open a MySQL connection before configuring Enterprise Backup.", {});

            return;
        }

        const apply = async (): Promise<void> => {
            try {
                const nextSetupState = await ShellInterface.meb.applySetup(
                    moduleSessionId,
                    nextConfiguration.backupHomePath,
                    nextConfiguration.backupUser,
                );

                if (!nextSetupState.configured) {
                    throw new Error(nextSetupState.message);
                }

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
            }
        };

        await operationRunner("applyConfiguration", apply);
    };

    const updateConfiguration = (values: Partial<IMebConfiguration>): void => {
        setDraftConfiguration((current) => {
            return {
                ...current,
                ...values,
            };
        });
    };

    const wizardLocalAccessRequestIsCurrent = useCallback((generation: number,
        requestedModuleSessionId: string): boolean => {
        return wizardLocalAccessGeneration.current === generation && wizardActiveRef.current
            && wizardPageRef.current === 1 && wizardModuleSessionIdRef.current === requestedModuleSessionId;
    }, []);

    const refreshWizardLocalAccess = useCallback(async (): Promise<void> => {
        if (!wizardActiveRef.current || wizardPageRef.current !== 1) {
            return;
        }

        const requestedModuleSessionId = wizardModuleSessionIdRef.current;
        if (!requestedModuleSessionId) {
            ++wizardLocalAccessGeneration.current;
            wizardLocalAccessRetryGeneration.current = undefined;
            setLocalAccessValidation(undefined);
            setWizardLocalAccessValidatedGeneration(undefined);
            setWizardLocalAccessValidatedSessionId(undefined);
            setWizardLocalAccessStatus({
                message: "Open a MySQL connection before checking local access.",
                tone: "warn",
            });

            return;
        }

        let generation: number | undefined;
        try {
            const nextValidation = await runWizardOperation("validateLocalAccess", async () => {
                generation = ++wizardLocalAccessGeneration.current;
                wizardLocalAccessRetryGeneration.current = undefined;
                setLocalAccessValidation(undefined);
                setWizardLocalAccessValidatedGeneration(undefined);
                setWizardLocalAccessValidatedSessionId(undefined);
                setWizardLocalAccessStatus({
                    message: "Checking current-user access to the MySQL data directory.",
                    tone: "info",
                });

                return ShellInterface.meb.validateLocalBackupAccess(requestedModuleSessionId);
            });

            if (generation === undefined) {
                wizardLocalAccessRetryGeneration.current = wizardLocalAccessGeneration.current;

                return;
            }

            if (nextValidation !== undefined
                && wizardLocalAccessRequestIsCurrent(generation, requestedModuleSessionId)) {
                setLocalAccessValidation(nextValidation);
                setWizardLocalAccessValidatedGeneration(generation);
                setWizardLocalAccessValidatedSessionId(requestedModuleSessionId);
                setWizardLocalAccessStatus(undefined);
            }
        } catch (reason: unknown) {
            if (generation !== undefined
                && wizardLocalAccessRequestIsCurrent(generation, requestedModuleSessionId)) {
                setWizardLocalAccessStatus({ message: convertErrorToString(reason), tone: "warn" });
            }
        }
    }, [runWizardOperation, wizardLocalAccessRequestIsCurrent]);

    useEffect(() => {
        return () => {
            ++wizardLocalAccessGeneration.current;
            wizardLocalAccessRetryGeneration.current = undefined;
        };
    }, [active, moduleSessionId, wizardPage]);

    useEffect(() => {
        if (!active || wizardPage !== 1) {
            return;
        }

        setLocalAccessValidation(undefined);
        setWizardLocalAccessValidatedGeneration(undefined);
        setWizardLocalAccessValidatedSessionId(undefined);
        setWizardLocalAccessStatus(undefined);
        void refreshWizardLocalAccess();
    }, [active, moduleSessionId, refreshWizardLocalAccess, wizardPage]);

    useEffect(() => {
        if (wizardActiveOperation !== undefined || wizardLocalAccessRetryGeneration.current === undefined
            || !active || wizardPage !== 1) {
            return;
        }

        wizardLocalAccessRetryGeneration.current = undefined;
        void refreshWizardLocalAccess();
    }, [active, refreshWizardLocalAccess, wizardActiveOperation, wizardPage]);

    const continueWizard = async (): Promise<void> => {
        if (wizardDisabled || (wizardPage === 0 && setupState?.mysqlbackupExists !== true)
            || (wizardPage === 1 && !wizardLocalAccessValid)
            || (wizardPage === 2 && !wizardBackupHomeValid)
            || (wizardPage === 3 && !wizardBackupAccountValid)) {
            return;
        }

        if (wizardPage < 3) {
            if (wizardPage === 0) {
                ++wizardLocalAccessGeneration.current;
                wizardLocalAccessRetryGeneration.current = undefined;
                setLocalAccessValidation(undefined);
                setWizardLocalAccessValidatedGeneration(undefined);
                setWizardLocalAccessValidatedSessionId(undefined);
                setWizardLocalAccessStatus(undefined);
            } else if (wizardPage === 1) {
                resetWizardEntities(draftConfiguration.backupHomePath, draftConfiguration.backupUser);
            } else if (wizardPage === 2) {
                setWizardBackupAccountState({
                    backupHomePath: wizardBackupHomeState.validatedPath,
                    moduleSessionId,
                    username: draftConfiguration.backupUser.trim(),
                    valid: false,
                });
            }

            setWizardPage((wizardPage + 1) as MebWizardPage);

            return;
        }

        await applyConfiguration(runWizardOperation);
    };

    const backWizard = (): void => {
        if (wizardBusy) {
            return;
        }

        if (wizardPage === 2) {
            ++wizardLocalAccessGeneration.current;
            wizardLocalAccessRetryGeneration.current = undefined;
            setLocalAccessValidation(undefined);
            setWizardLocalAccessValidatedGeneration(undefined);
            setWizardLocalAccessValidatedSessionId(undefined);
            setWizardLocalAccessStatus(undefined);
        } else if (wizardPage === 3) {
            resetWizardEntities(draftConfiguration.backupHomePath, draftConfiguration.backupUser);
        }

        setWizardPage((Math.max(0, wizardPage - 1)) as MebWizardPage);
    };

    const wizardSteps = [
        "Introduction",
        "Local Access",
        "Backup Home",
        "MySQL User for Backups",
    ];

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

        if (wizardLocalAccessStatus) {
            return wizardLocalAccessStatus;
        }

        if (!localAccessValidation) {
            return {
                tone: "info",
                message: "The wizard automatically checks that the current OS user can read and traverse the "
                    + "MySQL data directory.",
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
                    Thus, the user you run Workbench as must have read permission to data directory and its contents.
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
        return renderWizardPageLayout(
            "Backup Home Directory",
            <p>
                The backup home stores backup files, backup profiles, configuration and other
                files for this MySQL instance.
            </p>,
            <>
                <div className="enterpriseBackupWizardField enterpriseBackupWizardBackupHomeField">
                    <span>Backup home directory</span>
                    <EnterpriseBackupHome
                        active={active && wizardPage === 2}
                        disabled={wizardDisabled}
                        moduleSessionId={moduleSessionId}
                        path={draftConfiguration.backupHomePath}
                        runOperation={runWizardOperation}
                        onPathChange={(path) => {
                            setWizardBackupHomeState({ moduleSessionId, path, valid: false });
                            setWizardBackupAccountState({
                                moduleSessionId,
                                username: draftConfiguration.backupUser.trim(),
                                valid: false,
                            });
                            updateConfiguration({ backupHomePath: path });
                        }}
                        onStateChange={(state) => {
                            setWizardBackupHomeState(state);
                            setWizardBackupAccountState({
                                moduleSessionId,
                                username: draftConfiguration.backupUser.trim(),
                                valid: false,
                            });
                        }}
                    />
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
        return renderWizardPageLayout(
            "MySQL User for Backups",
            <p>
                mysqlbackup will use this MySQL account to connect to the target server. The account should
                have MEB backup privileges, including BACKUP_ADMIN, backup history table privileges,
                and read privileges. The wizard automatically checks the account on this page. If an account does
                not exist, the wizard can create one. If you already have an account, you must either provide its
                password or reset it to a new one.
            </p>,
            <div className="enterpriseBackupWizardAccountPanel">
                <EnterpriseBackupAccount
                    active={active && wizardPage === 3}
                    backupHomePath={wizardBackupHomeValid ? wizardBackupHomeState.validatedPath : undefined}
                    disabled={wizardDisabled}
                    moduleSessionId={moduleSessionId}
                    runOperation={runWizardOperation}
                    username={draftConfiguration.backupUser}
                    onStateChange={(state) => {
                        setWizardBackupAccountState(state);
                    }}
                    onUsernameChange={(username) => {
                        setWizardBackupAccountState({
                            backupHomePath: wizardBackupHomeState.validatedPath,
                            moduleSessionId,
                            username: username.trim(),
                            valid: false,
                        });
                        updateConfiguration({ backupUser: username });
                    }}
                />
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
                            <EnterpriseBackupValidationStatus status={getWizardMysqlbackupStatus()} />
                        </div>
                    </div>
                );

            case 1:
                return (
                    <div className="enterpriseBackupWizardStatusFooter">
                        <div className="enterpriseBackupWizardResultRow">
                            <EnterpriseBackupValidationStatus status={localAccessCheckStatus()} />
                        </div>
                        {(wizardLocalAccessStatus?.tone === "warn"
                            || localAccessValidation?.valid === false) && (
                            <Button
                                disabled={wizardDisabled}
                                onClick={() => {
                                    void refreshWizardLocalAccess();
                                }}
                            >
                                Check Again
                            </Button>
                        )}
                    </div>
                );

            default:
                return null;
        }
    };

    const renderConfigurationWizard = (): ComponentChild => {
        const nextDisabled = wizardDisabled
            || (wizardPage === 0 && setupState?.mysqlbackupExists !== true)
            || (wizardPage === 1 && !wizardLocalAccessValid)
            || (wizardPage === 2 && !wizardBackupHomeValid)
            || (wizardPage === 3 && !wizardBackupAccountValid);

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
                        <Button onClick={cancelWizard} disabled={wizardBusy}>
                            Cancel
                        </Button>
                        <Button onClick={backWizard} disabled={wizardPage === 0 || wizardBusy}>
                            Back
                        </Button>
                        <Button onClick={() => {
                            void continueWizard();
                        }} disabled={nextDisabled}>
                            {wizardPage === 3
                                ? wizardActiveOperation === "applyConfiguration" ? "Applying" : "Finish"
                                : "Next"}
                        </Button>
                    </div>
                </section>
            </main>
        );
    };

    useEffect(() => {
        if (active && !activeRef.current) {
            ++wizardLocalAccessGeneration.current;
            wizardLocalAccessRetryGeneration.current = undefined;
            setDraftConfiguration(configuration);
            setLocalAccessValidation(undefined);
            setWizardLocalAccessValidatedGeneration(undefined);
            setWizardLocalAccessValidatedSessionId(undefined);
            setWizardLocalAccessStatus(undefined);
            resetWizardEntities(configuration.backupHomePath, configuration.backupUser);
            setWizardPage(0);
        } else if (active) {
            setDraftConfiguration((current) => {
                return {
                    ...current,
                    mysqlbackupPath: configuration.mysqlbackupPath || current.mysqlbackupPath,
                    backupUser: configuration.backupUser || current.backupUser,
                };
            });
        } else if (activeRef.current) {
            ++wizardLocalAccessGeneration.current;
            wizardLocalAccessRetryGeneration.current = undefined;
            setLocalAccessValidation(undefined);
            setWizardLocalAccessValidatedGeneration(undefined);
            setWizardLocalAccessValidatedSessionId(undefined);
            setWizardLocalAccessStatus(undefined);
            resetWizardEntities(configuration.backupHomePath, configuration.backupUser);
            setWizardPage(0);
        }
        activeRef.current = active;
    }, [active, configuration]);

    useEffect(() => {
        if (dialogOpen && !dialogOpenRef.current) {
            const nextConfiguration = normalizeMebConfiguration(configuration);
            const nextLifecycleId = ++dialogLifecycleGeneration.current;
            setDraftConfiguration(nextConfiguration);
            setDialogLifecycleId(nextLifecycleId);
            resetDialogEntities(nextConfiguration.backupHomePath, nextConfiguration.backupUser);
            setDialogEntitiesActive(true);
            configurationDialogRef.current?.open();
        } else if (!dialogOpen && dialogOpenRef.current) {
            ++dialogLifecycleGeneration.current;
            resetDialogOperation();
            setDialogEntitiesActive(false);
            resetDialogEntities(configuration.backupHomePath.trim(), configuration.backupUser);
            configurationDialogRef.current?.close(false);
        }

        dialogOpenRef.current = dialogOpen;
    }, [configuration, dialogOpen, resetDialogOperation]);

    return (
        <>
            {active && renderConfigurationWizard()}
            <Dialog
                ref={configurationDialogRef}
                className="enterpriseBackupConfigurationDialog"
                caption="Configure MySQL Enterprise Backup"
                disabled={dialogBusy}
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
                                    {setupState?.currentOsUser ?? "Unknown"}
                                </strong>
                            </div>
                        </section>

                        <section className="enterpriseBackupConfigurationFields" aria-label="MEB configuration fields">
                            <div className="enterpriseBackupConfigurationField">
                                <span>Backup home directory</span>
                                <EnterpriseBackupHome
                                    key={`dialog-home-${dialogLifecycleId}`}
                                    active={dialogSurfaceActive}
                                    disabled={dialogBusy}
                                    moduleSessionId={moduleSessionId}
                                    path={normalizedDraftConfiguration.backupHomePath}
                                    runOperation={runDialogOperation}
                                    onPathChange={(path) => {
                                        const normalizedPath = path.trim();
                                        setDialogBackupHomeState({
                                            moduleSessionId,
                                            path: normalizedPath,
                                            valid: false,
                                        });
                                        setDialogBackupAccountState({
                                            moduleSessionId,
                                            username: normalizedDraftConfiguration.backupUser,
                                            valid: false,
                                        });
                                        updateConfiguration({ backupHomePath: normalizedPath });
                                    }}
                                    onStateChange={(state) => {
                                        setDialogBackupHomeState(state);
                                        setDialogBackupAccountState({
                                            moduleSessionId,
                                            username: normalizedDraftConfiguration.backupUser,
                                            valid: false,
                                        });
                                    }}
                                />
                            </div>

                            <EnterpriseBackupAccount
                                key={`dialog-account-${dialogLifecycleId}`}
                                active={dialogSurfaceActive}
                                backupHomePath={dialogBackupHomeValid
                                    ? dialogBackupHomeState.validatedPath
                                    : undefined}
                                disabled={dialogBusy}
                                moduleSessionId={moduleSessionId}
                                runOperation={runDialogOperation}
                                username={draftConfiguration.backupUser}
                                onStateChange={(state) => {
                                    setDialogBackupAccountState(state);
                                }}
                                onUsernameChange={(username) => {
                                    setDialogBackupAccountState({
                                        backupHomePath: dialogBackupHomeState.validatedPath,
                                        moduleSessionId,
                                        username: username.trim(),
                                        valid: false,
                                    });
                                    updateConfiguration({ backupUser: username });
                                }}
                            />
                        </section>
                    </div>
                }
                actions={{
                    end: [
                        <Button key="apply" onClick={() => {
                            if (!disableDialogApply) {
                                void applyConfiguration(runDialogOperation);
                            }
                        }} disabled={disableDialogApply}>
                            {dialogActiveOperation === "applyConfiguration" ? "Applying" : "Apply"}
                        </Button>,
                        <Button key="cancel" onClick={() => {
                            if (!dialogBusy) {
                                configurationDialogRef.current?.close(true);
                            }
                        }} disabled={dialogBusy}>
                            Cancel
                        </Button>,
                    ],
                }}
                onClose={() => {
                    ++dialogLifecycleGeneration.current;
                    resetDialogOperation();
                    setDialogEntitiesActive(false);
                    resetDialogEntities(configuration.backupHomePath.trim(), configuration.backupUser);
                    onDialogOpenChange(false);
                }}
            />
        </>
    );
};
