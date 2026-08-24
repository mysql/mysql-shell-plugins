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
import { Input } from "../../components/ui/Input/Input.js";
import { ShellInterface } from "../../supplement/ShellInterface/ShellInterface.js";
import type {
    IMebMysqlBackupUserValidation,
    IMebValidationStatus,
} from "../../supplement/ShellInterface/ShellInterfaceMeb.js";
import { convertErrorToString } from "../../utilities/helpers.js";
import type { MebOperation, MebOperationRunner } from "./EnterpriseBackupOperation.js";
import { EnterpriseBackupValidationStatus } from "./EnterpriseBackupValidationStatus.js";

export interface IMebBackupAccountState {
    backupHomePath?: string;
    moduleSessionId?: string;
    username: string;
    valid: boolean;
}

export interface IEnterpriseBackupAccountProps {
    active: boolean;
    backupHomePath?: string;
    disabled: boolean;
    moduleSessionId?: string;
    runOperation: MebOperationRunner;
    username: string;
    onStateChange: (state: IMebBackupAccountState) => void;
    onUsernameChange: (username: string) => void;
}

interface IAccountSelection {
    backupHomePath: string;
    moduleSessionId: string;
    username: string;
}

interface IAccountSnapshotBase extends IAccountSelection {
    status: IMebValidationStatus;
}

type IAccountSnapshot =
    | IAccountSnapshotBase & {
        phase: "running";
        operation: MebOperation;
        validation?: IMebMysqlBackupUserValidation;
    }
    | IAccountSnapshotBase & {
        phase: "checked";
        validation: IMebMysqlBackupUserValidation;
    }
    | IAccountSnapshotBase & {
        phase: "retry";
        validation?: IMebMysqlBackupUserValidation;
    };

interface IAccountOperation extends IAccountSelection {
    generation: number;
    name: MebOperation;
}

const waitingStatus: IMebValidationStatus = {
    message: "Waiting for a valid backup home.",
    tone: "info",
};

const accountKeyMatches = (
    account: Pick<IAccountSelection, "backupHomePath" | "moduleSessionId" | "username"> | undefined,
    moduleSessionId: string | undefined,
    backupHomePath: string | undefined,
    username: string,
): boolean => {
    return account !== undefined && account.moduleSessionId === moduleSessionId
        && account.backupHomePath === backupHomePath
        && account.username === username.trim();
};

const operationMessages: Partial<Record<MebOperation, string>> = {
    createBackupAccount: "Creating backup account.",
    fixBackupAccount: "Fixing backup account grants.",
    resetBackupAccountPassword: "Resetting backup account password.",
    storeBackupAccountPassword: "Validating and storing backup account password.",
    validateBackupAccount: "Checking backup account.",
};

const passwordDisplayStatus = (validation: IMebMysqlBackupUserValidation): IMebValidationStatus => {
    if (validation.passwordStored) {
        return { tone: "ok", message: "Password valid." };
    }

    if (!validation.exists) {
        return { tone: "warn", message: "Password not set." };
    }

    const message = validation.passwordStatus.message.toLowerCase();
    if (message.includes("not found") || message.includes("not set")) {
        return { tone: "warn", message: "Password not set." };
    }

    if (validation.passwordStatus.tone === "warn") {
        return { tone: "warn", message: "Password invalid." };
    }

    return { tone: "info", message: "Password status not checked." };
};

export const EnterpriseBackupAccount = (props: IEnterpriseBackupAccountProps): ComponentChild => {
    const {
        active,
        backupHomePath,
        disabled,
        moduleSessionId,
        runOperation,
        username,
        onStateChange,
        onUsernameChange,
    } = props;
    const activeRef = useRef(active);
    const backupHomePathRef = useRef(backupHomePath);
    const disabledRef = useRef(disabled);
    const moduleSessionIdRef = useRef(moduleSessionId);
    const onStateChangeRef = useRef(onStateChange);
    const onUsernameChangeRef = useRef(onUsernameChange);
    const operationRef = useRef<IAccountOperation>();
    const requestGeneration = useRef(0);
    const usernameRef = useRef(username);
    const [snapshot, setSnapshot] = useState<IAccountSnapshot>();

    activeRef.current = active;
    backupHomePathRef.current = backupHomePath;
    disabledRef.current = disabled;
    moduleSessionIdRef.current = moduleSessionId;
    onStateChangeRef.current = onStateChange;
    onUsernameChangeRef.current = onUsernameChange;
    usernameRef.current = username;

    const requestIsCurrent = useCallback((generation: number, selection: IAccountSelection): boolean => {
        return requestGeneration.current === generation && activeRef.current
            && moduleSessionIdRef.current === selection.moduleSessionId
            && backupHomePathRef.current === selection.backupHomePath
            && usernameRef.current.trim() === selection.username;
    }, []);

    const selectionIsCurrent = useCallback((selection: IAccountSelection): boolean => {
        return activeRef.current && moduleSessionIdRef.current === selection.moduleSessionId
            && backupHomePathRef.current === selection.backupHomePath
            && usernameRef.current.trim() === selection.username;
    }, []);

    useEffect(() => {
        return () => {
            ++requestGeneration.current;
        };
    }, [active, backupHomePath, moduleSessionId]);

    useEffect(() => {
        if (active) {
            return;
        }

        operationRef.current = undefined;
        setSnapshot(undefined);
    }, [active]);

    const currentSelection = useCallback((): IAccountSelection | undefined => {
        const currentBackupHomePath = backupHomePathRef.current;
        const currentModuleSessionId = moduleSessionIdRef.current;
        const currentUsername = usernameRef.current.trim();
        if (!activeRef.current || disabledRef.current || !currentBackupHomePath || !currentModuleSessionId
            || currentUsername === "") {
            return undefined;
        }

        return {
            backupHomePath: currentBackupHomePath,
            moduleSessionId: currentModuleSessionId,
            username: currentUsername,
        };
    }, []);

    const setSelectionStatus = useCallback((selection: IAccountSelection,
        nextStatus: IMebValidationStatus): void => {
        if (selectionIsCurrent(selection)) {
            setSnapshot((current) => {
                if (current === undefined || !accountKeyMatches(
                    current,
                    selection.moduleSessionId,
                    selection.backupHomePath,
                    selection.username,
                )) {
                    return current;
                }

                if (current.phase === "running") {
                    if (current.operation === "validateBackupAccount") {
                        return {
                            ...selection,
                            phase: "retry",
                            validation: current.validation,
                            status: nextStatus,
                        };
                    }

                    if (current.validation !== undefined) {
                        return {
                            ...selection,
                            phase: "checked",
                            validation: current.validation,
                            status: nextStatus,
                        };
                    }

                    return {
                        ...selection,
                        phase: "retry",
                        status: nextStatus,
                    };
                }

                return { ...current, status: nextStatus };
            });
        }
    }, [selectionIsCurrent]);

    const runValidationResultOperation = useCallback(async (
        operationName: MebOperation,
        selection: IAccountSelection,
        callback: () => Promise<IMebMysqlBackupUserValidation>,
    ): Promise<IMebMysqlBackupUserValidation | undefined> => {
        let generation: number | undefined;

        try {
            const validation = await runOperation(operationName, async () => {
                generation = ++requestGeneration.current;
                const nextOperation = { ...selection, generation, name: operationName };
                operationRef.current = nextOperation;
                setSnapshot((current) => {
                    const validation = current !== undefined && accountKeyMatches(
                        current,
                        selection.moduleSessionId,
                        selection.backupHomePath,
                        selection.username,
                    ) ? current.validation : undefined;

                    return {
                        ...selection,
                        phase: "running",
                        operation: operationName,
                        validation,
                        status: {
                            message: operationMessages[operationName] ?? "Checking backup account.",
                            tone: "info",
                        },
                    };
                });

                return callback();
            });

            if (validation !== undefined && generation !== undefined && requestIsCurrent(generation, selection)) {
                setSnapshot({ ...selection, phase: "checked", validation, status: validation.status });

                return validation;
            }

            return undefined;
        } catch (reason: unknown) {
            if (generation === undefined || requestIsCurrent(generation, selection)) {
                throw reason;
            }

            return undefined;
        } finally {
            if (generation !== undefined) {
                if (operationRef.current?.generation === generation) {
                    operationRef.current = undefined;
                    setSnapshot((current) => {
                        if (current?.phase !== "running" || !accountKeyMatches(
                            current,
                            selection.moduleSessionId,
                            selection.backupHomePath,
                            selection.username,
                        )) {
                            return current;
                        }

                        if (current.operation === "validateBackupAccount") {
                            return {
                                ...selection,
                                phase: "retry",
                                status: current.status,
                            };
                        }

                        if (current.validation !== undefined) {
                            return {
                                ...selection,
                                phase: "checked",
                                validation: current.validation,
                                status: current.status,
                            };
                        }

                        return {
                            ...selection,
                            phase: "retry",
                            status: current.status,
                        };
                    });
                }
            }
        }
    }, [requestIsCurrent, runOperation]);

    const validateAccount = useCallback(async (requestedUsername: string): Promise<void> => {
        if (!activeRef.current || disabledRef.current) {
            return;
        }

        const currentBackupHomePath = backupHomePathRef.current;
        const currentModuleSessionId = moduleSessionIdRef.current;
        const normalizedUsername = requestedUsername.trim();
        if (!currentBackupHomePath || !currentModuleSessionId || normalizedUsername === "") {
            return;
        }

        const selection = {
            backupHomePath: currentBackupHomePath,
            moduleSessionId: currentModuleSessionId,
            username: normalizedUsername,
        };

        try {
            await runValidationResultOperation(
                "validateBackupAccount",
                selection,
                async () => {
                    return ShellInterface.meb.validateBackupMysqlUser(
                        selection.moduleSessionId,
                        selection.backupHomePath,
                        selection.username,
                        undefined,
                    );
                },
            );
        } catch (reason: unknown) {
            if (selectionIsCurrent(selection)) {
                const message = convertErrorToString(reason);
                setSelectionStatus(selection, { message, tone: "warn" });
            }
        }
    }, [runValidationResultOperation, selectionIsCurrent, setSelectionStatus]);

    useEffect(() => {
        const currentUsername = usernameRef.current.trim();
        const currentAccountWasAttempted = accountKeyMatches(
            snapshot,
            moduleSessionId,
            backupHomePath,
            currentUsername,
        );
        if (!active || disabled || !backupHomePath || !moduleSessionId || currentUsername === ""
            || currentAccountWasAttempted) {
            return;
        }

        const dependencyChanged = snapshot === undefined
            || snapshot.moduleSessionId !== moduleSessionId
            || snapshot.backupHomePath !== backupHomePath;
        if (dependencyChanged) {
            void validateAccount(currentUsername);
        }
    }, [active, backupHomePath, disabled, moduleSessionId, snapshot, validateAccount]);

    const normalizedUsername = username.trim();
    const matchingSnapshot = active && accountKeyMatches(
        snapshot,
        moduleSessionId,
        backupHomePath,
        normalizedUsername,
    ) ? snapshot : undefined;
    const matchingAttempt = matchingSnapshot !== undefined;
    const matchingValidation = matchingSnapshot?.validation;
    const matchingOperation = matchingSnapshot?.phase === "running"
        ? matchingSnapshot.operation : undefined;
    const matchingRetry = matchingSnapshot?.phase === "retry";
    const matchingStatus = matchingSnapshot?.status;
    const reportedValid = active && matchingValidation?.valid === true;

    useEffect(() => {
        onStateChangeRef.current({
            backupHomePath,
            moduleSessionId,
            username: normalizedUsername,
            valid: reportedValid,
        });
    }, [backupHomePath, moduleSessionId, normalizedUsername, reportedValid]);

    const validateAndStorePassword = async (password: string): Promise<boolean> => {
        const selection = currentSelection();
        if (!selection || operationRef.current) {
            return false;
        }

        try {
            const validation = await runValidationResultOperation(
                "storeBackupAccountPassword",
                selection,
                async () => {
                    return ShellInterface.meb.validateBackupMysqlUser(
                        selection.moduleSessionId,
                        selection.backupHomePath,
                        selection.username,
                        password,
                    );
                },
            );
            if (validation?.passwordStored) {
                void ui.showInformationMessage("Backup account password was validated and stored.", {});
            }

            return validation?.passwordStored ?? false;
        } catch (reason: unknown) {
            const message = convertErrorToString(reason);
            setSelectionStatus(selection, { message, tone: "warn" });
            void ui.showErrorMessage(`Cannot validate backup account: ${message}`, {});

            return false;
        }
    };

    const inputPassword = async (): Promise<boolean> => {
        const selection = currentSelection();
        if (!selection || operationRef.current || matchingValidation?.exists !== true) {
            return false;
        }

        setSelectionStatus(selection, { message: "Opening password prompt.", tone: "info" });
        const password = await ui.requestPassword({
            requestId: "mebInputBackupPassword",
            caption: "Store Backup User Password",
            description: [`Enter the existing password for ${selection.username}.`],
            user: selection.username,
            passwordLabel: "Existing password",
            passwordRequired: true,
            confirmPassword: false,
            submitCaption: "Store",
        });

        if (password !== undefined && selectionIsCurrent(selection)) {
            return validateAndStorePassword(password);
        }

        if (selectionIsCurrent(selection)) {
            setSelectionStatus(selection, {
                tone: "warn",
                message: "Password storage was cancelled or the password prompt could not be opened.",
            });
        }

        return false;
    };

    const createAccount = async (): Promise<boolean> => {
        const selection = currentSelection();
        if (!selection || operationRef.current || matchingValidation?.exists !== false) {
            return false;
        }

        try {
            const validation = await runValidationResultOperation(
                "createBackupAccount",
                selection,
                async () => {
                    return ShellInterface.meb.createBackupMysqlUser(
                        selection.moduleSessionId,
                        selection.backupHomePath,
                        selection.username,
                    );
                },
            );
            if (validation?.passwordStored) {
                void ui.showInformationMessage("Backup account was created and credentials were stored.", {});
            }

            return validation?.passwordStored ?? false;
        } catch (reason: unknown) {
            const message = convertErrorToString(reason);
            setSelectionStatus(selection, { message, tone: "warn" });
            void ui.showErrorMessage(`Cannot create backup account: ${message}`, {});

            return false;
        }
    };

    const fixAccount = async (): Promise<void> => {
        const selection = currentSelection();
        if (!selection || operationRef.current || matchingValidation?.exists !== true
            || matchingValidation.missingGrants.length === 0) {
            return;
        }

        try {
            const validation = await runValidationResultOperation(
                "fixBackupAccount",
                selection,
                async () => {
                    return ShellInterface.meb.fixBackupMysqlUser(
                        selection.moduleSessionId,
                        selection.backupHomePath,
                        selection.username,
                    );
                },
            );
            if (validation?.missingGrants.length === 0) {
                void ui.showInformationMessage("Backup account grants were fixed.", {});
            }
        } catch (reason: unknown) {
            const message = convertErrorToString(reason);
            setSelectionStatus(selection, { message, tone: "warn" });
            void ui.showErrorMessage(`Cannot fix backup account: ${message}`, {});
        }
    };

    const resetPassword = async (password?: string): Promise<boolean> => {
        const selection = currentSelection();
        if (!selection || operationRef.current || matchingValidation?.exists !== true) {
            return false;
        }

        try {
            const validation = await runValidationResultOperation(
                "resetBackupAccountPassword",
                selection,
                async () => {
                    return ShellInterface.meb.resetBackupMysqlUserPassword(
                        selection.moduleSessionId,
                        selection.backupHomePath,
                        selection.username,
                        password,
                    );
                },
            );
            if (validation?.passwordStored) {
                void ui.showInformationMessage("Backup account password was reset and stored.", {});
            }

            return validation?.passwordStored ?? false;
        } catch (reason: unknown) {
            const message = convertErrorToString(reason);
            setSelectionStatus(selection, { message, tone: "warn" });
            void ui.showErrorMessage(`Cannot reset backup account password: ${message}`, {});

            return false;
        }
    };

    const promptPasswordReset = async (): Promise<void> => {
        const selection = currentSelection();
        if (!selection || operationRef.current || matchingValidation?.exists !== true) {
            return;
        }

        const password = await ui.requestPassword({
            requestId: "mebResetBackupPassword",
            caption: "Reset Backup User Password",
            description: [`Enter a new password for ${selection.username}.`],
            user: selection.username,
            passwordLabel: "New password",
            confirmPasswordLabel: "Confirm",
            confirmPassword: true,
            submitCaption: "Reset",
        });

        if (password !== undefined && selectionIsCurrent(selection)) {
            await resetPassword(password);
        }
    };

    const currentDependencyChanged = snapshot === undefined
        || snapshot.moduleSessionId !== moduleSessionId
        || snapshot.backupHomePath !== backupHomePath;
    const waitingForAutomaticCheck = active && !!backupHomePath && !!moduleSessionId && normalizedUsername !== ""
        && !matchingAttempt && currentDependencyChanged;
    const showUseAccount = active && !!backupHomePath && !!moduleSessionId && normalizedUsername !== ""
        && !matchingAttempt
        && !waitingForAutomaticCheck;
    const missingGrants = matchingValidation?.missingGrants ?? [];
    const hasSpecificAction = matchingValidation !== undefined && (
        !matchingValidation.exists
        || missingGrants.length > 0
        || !matchingValidation.passwordStored
    );
    const showCheckAgain = active && matchingAttempt && !matchingOperation && (
        matchingRetry
        || (matchingValidation !== undefined && !matchingValidation.valid && !hasSpecificAction)
    );
    const controlsDisabled = !active || disabled || snapshot?.phase === "running";

    let displayedStatus = matchingStatus;
    if (!active || !backupHomePath) {
        displayedStatus = waitingStatus;
    } else if (!moduleSessionId) {
        displayedStatus = {
            message: "Open a MySQL connection before checking the backup account.",
            tone: "warn",
        };
    } else if (normalizedUsername === "") {
        displayedStatus = { message: "Enter the backup MySQL username.", tone: "warn" };
    } else if (showUseAccount) {
        displayedStatus = { message: "Click Use Account to check this backup account.", tone: "info" };
    } else if (waitingForAutomaticCheck && !matchingOperation) {
        displayedStatus = { message: "Waiting to check the backup account.", tone: "info" };
    } else {
        displayedStatus ??= matchingValidation?.status ?? waitingStatus;
    }

    const renderActions = (): ComponentChild => {
        if (!active) {
            return null;
        }

        if (showUseAccount) {
            return <div className="enterpriseBackupAccountActions">
                <Button disabled={controlsDisabled} onClick={() => {
                    void validateAccount(usernameRef.current);
                }}>
                    Use Account
                </Button>
            </div>;
        }

        if (showCheckAgain) {
            return <div className="enterpriseBackupAccountActions">
                <Button disabled={controlsDisabled} onClick={() => {
                    void validateAccount(usernameRef.current);
                }}>
                    Check Again
                </Button>
            </div>;
        }

        if (matchingValidation === undefined) {
            return null;
        }

        if (missingGrants.length > 0) {
            return <div className="enterpriseBackupAccountActions">
                <Button disabled={controlsDisabled} onClick={() => {
                    void fixAccount();
                }}>
                    {matchingOperation === "fixBackupAccount" ? "Fixing..." : "Fix Account"}
                </Button>
            </div>;
        }

        if (!matchingValidation.exists) {
            return <div className="enterpriseBackupAccountActions">
                <Button disabled={controlsDisabled} onClick={() => {
                    void createAccount();
                }}>
                    {matchingOperation === "createBackupAccount" ? "Creating" : "Create User"}
                </Button>
            </div>;
        }

        if (!matchingValidation.passwordStored) {
            return <div className="enterpriseBackupAccountActions">
                <p>
                    The MySQL account exists, please provide its password.
                    If you don&apos;t know it, you may reset it.
                </p>
                <Button disabled={controlsDisabled} onClick={() => {
                    void inputPassword();
                }}>
                    Input Password
                </Button>
                <Button disabled={controlsDisabled} onClick={() => {
                    void promptPasswordReset();
                }}>
                    Reset Password
                </Button>
                <Button disabled={controlsDisabled} onClick={() => {
                    void resetPassword();
                }}>
                    Reset to Random Password
                </Button>
            </div>;
        }

        return null;
    };

    return (
        <div className="enterpriseBackupAccount">
            <label className="enterpriseBackupAccountField">
                <span>MySQL username for backups</span>
                <Input
                    value={username}
                    spellCheck={false}
                    disabled={controlsDisabled}
                    onChange={(_event, data) => {
                        if (activeRef.current && !disabledRef.current && operationRef.current === undefined) {
                            onUsernameChangeRef.current(data.value);
                        }
                    }}
                />
            </label>

            {renderActions()}

            <div className="enterpriseBackupAccountStatus">
                {missingGrants.length > 0 && matchingValidation !== undefined
                    ? <EnterpriseBackupValidationStatus status={{
                        message: "Backup account is missing required grants.",
                        tone: "warn",
                    }}>
                        Backup account is missing <span className="enterpriseBackupTooltipTarget"
                            data-tooltip={missingGrants.join("\n")}>required grants</span>.
                    </EnterpriseBackupValidationStatus>
                    : <EnterpriseBackupValidationStatus status={displayedStatus} />}
                {matchingValidation?.exists === true
                    && <EnterpriseBackupValidationStatus status={passwordDisplayStatus(matchingValidation)} />}
            </div>
        </div>
    );
};
