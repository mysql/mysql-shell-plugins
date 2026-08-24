/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 */

import type { ComponentChild } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { Button } from "../../components/ui/Button/Button.js";
import { FileSelector } from "../../components/ui/FileSelector/FileSelector.js";
import { ShellInterface } from "../../supplement/ShellInterface/ShellInterface.js";
import type {
    IMebBackupHomeValidation,
    IMebValidationStatus,
} from "../../supplement/ShellInterface/ShellInterfaceMeb.js";
import { convertErrorToString } from "../../utilities/helpers.js";
import type { MebOperation, MebOperationRunner } from "./EnterpriseBackupOperation.js";
import { EnterpriseBackupValidationStatus } from "./EnterpriseBackupValidationStatus.js";

export interface IMebBackupHomeState {
    moduleSessionId?: string;
    path: string;
    valid: boolean;
    validatedPath?: string;
}

interface IBackupHomeResult {
    moduleSessionId: string;
    path: string;
    validation: IMebBackupHomeValidation;
}

interface ICheckedBackupHome {
    moduleSessionId?: string;
    path: string;
}

export interface IEnterpriseBackupHomeProps {
    active: boolean;
    disabled: boolean;
    moduleSessionId?: string;
    path: string;
    runOperation: MebOperationRunner;
    onPathChange: (path: string) => void;
    onStateChange: (state: IMebBackupHomeState) => void;
}

const waitingStatus: IMebValidationStatus = {
    message: "Waiting for backup home validation.",
    tone: "info",
};

export const EnterpriseBackupHome = (props: IEnterpriseBackupHomeProps): ComponentChild => {
    const {
        active,
        disabled,
        moduleSessionId,
        path,
        runOperation,
        onPathChange,
        onStateChange,
    } = props;
    const activeRef = useRef(active);
    const disabledRef = useRef(disabled);
    const moduleSessionIdRef = useRef(moduleSessionId);
    const onStateChangeRef = useRef(onStateChange);
    const pathRef = useRef(path);
    const requestGeneration = useRef(0);
    const [checkedHome, setCheckedHome] = useState<ICheckedBackupHome>();
    const [operation, setOperation] = useState<MebOperation>();
    const [result, setResult] = useState<IBackupHomeResult>();
    const [status, setStatus] = useState<IMebValidationStatus>(waitingStatus);
    const [retryAvailable, setRetryAvailable] = useState(false);

    activeRef.current = active;
    disabledRef.current = disabled;
    moduleSessionIdRef.current = moduleSessionId;
    onStateChangeRef.current = onStateChange;
    pathRef.current = path;

    const requestIsCurrent = useCallback((generation: number, requestedModuleSessionId: string,
        requestedPath: string): boolean => {
        return requestGeneration.current === generation && activeRef.current
            && moduleSessionIdRef.current === requestedModuleSessionId && pathRef.current === requestedPath;
    }, []);

    useEffect(() => {
        return () => {
            ++requestGeneration.current;
        };
    }, [active, moduleSessionId, path]);

    useEffect(() => {
        if (active) {
            return;
        }

        setCheckedHome(undefined);
        setOperation(undefined);
        setResult(undefined);
        setRetryAvailable(false);
        setStatus(waitingStatus);
    }, [active]);

    const validatePath = useCallback(async (requestedPath: string): Promise<void> => {
        if (!activeRef.current || disabledRef.current) {
            return;
        }

        const requestedModuleSessionId = moduleSessionIdRef.current;
        const checkedHome = { moduleSessionId: requestedModuleSessionId, path: requestedPath };

        if (requestedPath.trim() === "") {
            setCheckedHome(checkedHome);
            setResult(undefined);
            setRetryAvailable(false);
            setStatus({ message: "Choose a backup home directory.", tone: "warn" });

            return;
        }

        if (!requestedModuleSessionId) {
            setCheckedHome(checkedHome);
            setResult(undefined);
            setRetryAvailable(false);
            setStatus({
                message: "Open a MySQL connection before checking the backup home.",
                tone: "warn",
            });

            return;
        }

        let generation: number | undefined;

        try {
            const validation = await runOperation("validateBackupHome", async () => {
                generation = ++requestGeneration.current;
                setCheckedHome(checkedHome);
                setResult(undefined);
                setRetryAvailable(false);
                setOperation("validateBackupHome");
                setStatus({ message: "Checking backup home directory.", tone: "info" });

                return ShellInterface.meb.validateBackupHome(requestedModuleSessionId, requestedPath);
            });

            if (validation !== undefined && generation !== undefined
                && requestIsCurrent(generation, requestedModuleSessionId, requestedPath)) {
                setResult({ moduleSessionId: requestedModuleSessionId, path: requestedPath, validation });
                setStatus(validation.status);
            }
        } catch (reason: unknown) {
            if (generation !== undefined && requestIsCurrent(generation, requestedModuleSessionId, requestedPath)) {
                setStatus({ message: convertErrorToString(reason), tone: "warn" });
                setRetryAvailable(true);
            }
        } finally {
            if (generation !== undefined && requestIsCurrent(generation, requestedModuleSessionId, requestedPath)) {
                setOperation(undefined);
            }
        }
    }, [requestIsCurrent, runOperation]);

    useEffect(() => {
        const currentHomeIsChecked = checkedHome !== undefined && checkedHome.moduleSessionId === moduleSessionId
            && checkedHome.path === path;
        if (!active || disabled || currentHomeIsChecked) {
            return;
        }

        void validatePath(path);
    }, [active, checkedHome, disabled, moduleSessionId, path, validatePath]);

    const matchingResult = result !== undefined && result.moduleSessionId === moduleSessionId && result.path === path
        ? result
        : undefined;
    const reportedValid = active && matchingResult?.validation.valid === true;
    const reportedValidatedPath = reportedValid ? matchingResult.path : undefined;

    useEffect(() => {
        if (reportedValid) {
            onStateChangeRef.current({
                moduleSessionId,
                path,
                valid: true,
                validatedPath: reportedValidatedPath,
            });

            return;
        }

        onStateChangeRef.current({ moduleSessionId, path, valid: false });
    }, [moduleSessionId, path, reportedValid, reportedValidatedPath]);

    const createBackupHome = async (): Promise<void> => {
        const requestedPath = pathRef.current;
        const requestedModuleSessionId = moduleSessionIdRef.current;
        if (!activeRef.current || disabledRef.current || requestedPath.trim() === "" || !requestedModuleSessionId) {
            return;
        }

        let generation: number | undefined;

        try {
            const validation = await runOperation("createBackupHome", async () => {
                generation = ++requestGeneration.current;
                setOperation("createBackupHome");
                setRetryAvailable(false);
                setStatus({ message: "Creating backup home directory.", tone: "info" });

                return ShellInterface.meb.createBackupHome(requestedModuleSessionId, requestedPath);
            });

            if (validation !== undefined && generation !== undefined
                && requestIsCurrent(generation, requestedModuleSessionId, requestedPath)) {
                const canonicalPath = validation.backupHomePath ?? requestedPath;
                setCheckedHome({ moduleSessionId: requestedModuleSessionId, path: canonicalPath });
                setResult({ moduleSessionId: requestedModuleSessionId, path: canonicalPath, validation });
                setStatus(validation.status);
                setOperation(undefined);
                pathRef.current = canonicalPath;
                onPathChange(canonicalPath);
            }
        } catch (reason: unknown) {
            if (generation !== undefined && requestIsCurrent(generation, requestedModuleSessionId, requestedPath)) {
                setStatus({ message: convertErrorToString(reason), tone: "warn" });
            }
        } finally {
            if (generation !== undefined && requestIsCurrent(generation, requestedModuleSessionId, requestedPath)) {
                setOperation(undefined);
            }
        }
    };

    const showCreate = matchingResult?.validation.exists === false;
    const showCheckAgain = !operation && (retryAvailable
        || (matchingResult !== undefined && !matchingResult.validation.valid && !showCreate));
    const controlsDisabled = !active || disabled;

    return (
        <div className="enterpriseBackupHome">
            <div className="enterpriseBackupHomeInput">
                <FileSelector
                    id="enterpriseBackupHome"
                    path={path}
                    title="Select backup home"
                    openLabel="Use Directory"
                    canSelectFiles={false}
                    canSelectFolders={true}
                    readOnly
                    disabled={controlsDisabled}
                    onChange={(files) => {
                        if (activeRef.current && !disabledRef.current) {
                            const selectedPath = files[0]?.name ?? "";
                            if (selectedPath !== pathRef.current) {
                                onPathChange(selectedPath);
                            }
                        }
                    }}
                />
                {showCreate && <Button
                    disabled={controlsDisabled || operation !== undefined}
                    onClick={() => {
                        void createBackupHome();
                    }}
                >
                    {operation === "createBackupHome" ? "Creating" : "Create"}
                </Button>}
                {showCheckAgain && <Button
                    disabled={controlsDisabled}
                    onClick={() => {
                        void validatePath(pathRef.current);
                    }}
                >
                    Check Again
                </Button>}
            </div>
            <EnterpriseBackupValidationStatus status={status} />
        </div>
    );
};
