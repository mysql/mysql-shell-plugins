/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 */

import type { ComponentChild } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import { ui } from "../../app-logic/UILayer.js";
import { Button } from "../../components/ui/Button/Button.js";
import { Checkbox, CheckState } from "../../components/ui/Checkbox/Checkbox.js";
import { Codicon } from "../../components/ui/Codicon.js";
import { Dialog } from "../../components/ui/Dialog/Dialog.js";
import { Icon } from "../../components/ui/Icon/Icon.js";
import { ShellInterface } from "../../supplement/ShellInterface/ShellInterface.js";
import type {
    IMebBackupContent,
    IMebRestoreResult,
    IMebStatus,
} from "../../supplement/ShellInterface/ShellInterfaceMeb.js";
import { convertErrorToString } from "../../utilities/helpers.js";
import {
    formatMebBinlogPosition,
    type IMebRestoreActivityDetails,
} from "./EnterpriseBackupActivity.js";
import { filterMebContentRows } from "./EnterpriseBackupProfileMapping.js";

type MebRestoreDialogState = "confirm" | "starting" | "running" | "aborting" | "failed";

const mebRestoreProgressIntervalMs = 500;

export interface IEnterpriseBackupRestoreDialogProps {
    activityId: string;
    backupHomePath: string;
    datadir: string;
    disabled: boolean;
    moduleSessionId: string;
    restoreDetails?: IMebRestoreActivityDetails;
    onBusyChange: (busy: boolean) => void;
    onStatusChange: (status: IMebStatus) => void;
    onClose: () => void;
}

export const EnterpriseBackupRestoreDialog = (props: IEnterpriseBackupRestoreDialogProps): ComponentChild => {
    const {
        activityId,
        backupHomePath,
        datadir,
        disabled,
        moduleSessionId,
        restoreDetails,
        onBusyChange,
        onStatusChange,
        onClose,
    } = props;
    const dialogRef = useRef<Dialog>(null);
    const outputRef = useRef<HTMLTextAreaElement>(null);
    const metadataRequestId = useRef(0);
    const mounted = useRef(true);
    const progressPollingActive = useRef(false);
    const progressRequestActive = useRef(false);
    const progressTimer = useRef<ReturnType<typeof globalThis.setInterval>>();
    const [dialogState, setDialogState] = useState<MebRestoreDialogState>("confirm");
    const [operationId, setOperationId] = useState<string>();
    const [output, setOutput] = useState("");
    const [failureMessage, setFailureMessage] = useState("");
    const [failureForce, setFailureForce] = useState(false);
    const [metadata, setMetadata] = useState<IMebBackupContent>();
    const [metadataLoading, setMetadataLoading] = useState(true);

    useEffect(() => {
        return () => {
            mounted.current = false;
            progressPollingActive.current = false;
            if (progressTimer.current !== undefined) {
                globalThis.clearInterval(progressTimer.current);
            }
        };
    }, []);

    useEffect(() => {
        const requestId = ++metadataRequestId.current;
        dialogRef.current?.open({ closeOnEscape: false });

        void ShellInterface.meb.readBackupContent(moduleSessionId, backupHomePath, activityId).then((content) => {
            if (metadataRequestId.current === requestId) {
                setMetadata({ ...content, rows: filterMebContentRows(content.rows) });
            }
        }).catch(() => {
            // Missing metadata is non-fatal; restore performs its own authoritative validation.
        }).finally(() => {
            if (metadataRequestId.current === requestId) {
                setMetadataLoading(false);
            }
        });

        return () => {
            ++metadataRequestId.current;
        };
    }, [activityId, backupHomePath, moduleSessionId]);

    useEffect(() => {
        const element = outputRef.current;
        if (element) {
            element.scrollTop = element.scrollHeight;
        }
    }, [output]);

    const reset = (): void => {
        ++metadataRequestId.current;
        setDialogState("confirm");
        setOperationId(undefined);
        setOutput("");
        setFailureMessage("");
        setFailureForce(false);
        setMetadata(undefined);
        setMetadataLoading(false);
    };

    const close = (): void => {
        dialogRef.current?.close(true);
    };

    const handleClose = (): void => {
        reset();
        onClose();
    };

    const restoreBackup = async (force = false): Promise<void> => {
        if (disabled || !backupHomePath || !activityId) {
            void ui.showErrorMessage("Select a recent backup activity entry first.", {});

            return;
        }

        const nextOperationId = `restore-${globalThis.crypto.randomUUID()}`;
        setOperationId(nextOperationId);
        setDialogState("starting");
        setOutput("");
        setFailureMessage("");
        onBusyChange(true);

        const restorePromise: Promise<IMebRestoreResult> = ShellInterface.meb.restoreBackup(
            moduleSessionId,
            backupHomePath,
            activityId,
            nextOperationId,
            force,
        );
        progressPollingActive.current = true;
        progressRequestActive.current = false;
        const pollProgress = async (): Promise<void> => {
            if (!progressPollingActive.current || progressRequestActive.current) {
                return;
            }
            progressRequestActive.current = true;
            try {
                const progress = await ShellInterface.meb.getRestoreProgress(
                    moduleSessionId,
                    backupHomePath,
                    nextOperationId,
                );
                if (!mounted.current) {
                    return;
                }
                if (progress.output) {
                    setOutput((current) => {
                        return progress.output.length >= current.length ? progress.output : current;
                    });
                }
                setDialogState((current) => {
                    if (current === "aborting" || current === "failed") {
                        return current;
                    }

                    return progress.state === "running" ? "running" : current;
                });
            } catch {
                // The restore result reports terminal errors; progress polling is best effort.
            } finally {
                progressRequestActive.current = false;
            }
        };
        progressTimer.current = globalThis.setInterval(() => {
            void pollProgress();
        }, mebRestoreProgressIntervalMs);
        void pollProgress();

        try {
            const result = await restorePromise;
            progressPollingActive.current = false;
            if (!mounted.current) {
                return;
            }
            if (!result.succeeded) {
                setOutput((current) => {
                    return result.output || current || result.message;
                });
                setFailureMessage(result.message);
                setDialogState("failed");

                return;
            }
            if (!result.status) {
                throw new Error("Restore completed without refreshed status.");
            }

            onStatusChange(result.status);
            dialogRef.current?.close(false);
            void ui.showInformationMessage("Backup restore completed.", {});
        } catch (reason: unknown) {
            progressPollingActive.current = false;
            if (!mounted.current) {
                return;
            }
            const message = convertErrorToString(reason);
            setOutput((current) => {
                return current || message;
            });
            setFailureMessage(message);
            setDialogState("failed");
        } finally {
            progressPollingActive.current = false;
            globalThis.clearInterval(progressTimer.current);
            progressTimer.current = undefined;
            if (mounted.current) {
                onBusyChange(false);
            }
        }
    };

    const abortBackupRestore = async (): Promise<void> => {
        if (!backupHomePath || !operationId || dialogState !== "running") {
            return;
        }

        setDialogState("aborting");
        try {
            const progress = await ShellInterface.meb.abortBackupRestore(
                moduleSessionId,
                backupHomePath,
                operationId,
            );
            if (progress.output) {
                setOutput((current) => {
                    return progress.output.length >= current.length ? progress.output : current;
                });
            }
        } catch (reason: unknown) {
            const message = convertErrorToString(reason);
            setDialogState((current) => {
                return current === "aborting" ? "running" : current;
            });
            void ui.showErrorMessage(`Cannot abort restore: ${message}`, {});
        }
    };

    const restoreIsActive = dialogState === "starting" || dialogState === "running" || dialogState === "aborting";
    const content = (): ComponentChild => {
        if (dialogState === "confirm") {
            return <div className="enterpriseBackupRestoreContent selectableText">
                <p>The following backup will be restored and replace the data directory shown below.</p>
                <dl>
                    <div><dt>Profile</dt><dd>{restoreDetails?.profile ?? "Unknown profile"}</dd></div>
                    <div><dt>Backup type</dt><dd>{restoreDetails?.backupType ?? "Backup"}</dd></div>
                    <div><dt>Backup timestamp</dt><dd>{restoreDetails?.timestamp ?? "Unknown"}</dd></div>
                    <div>
                        <dt>GTID executed</dt>
                        <dd>{metadataLoading ? "Loading…" : metadata?.gtidExecuted ?? "--"}</dd>
                    </div>
                    <div>
                        <dt>Binary log position</dt>
                        <dd>{metadataLoading ? "Loading…" : formatMebBinlogPosition(
                            metadata?.binlogFile,
                            metadata?.binlogPosition,
                        )}</dd>
                    </div>
                    <div><dt>Data directory</dt><dd>{datadir}</dd></div>
                </dl>
                <p>MySQL must be manually stopped and the target data directory must be empty.</p>
                <p className="enterpriseBackupRestoreWarning">
                    <Icon src={Codicon.Warning} />
                    Changes made after this backup was created will be lost!
                </p>
            </div>;
        }

        const statusMessage = dialogState === "starting"
            ? "Starting mysqlbackup…"
            : dialogState === "running"
                ? "Restoring backup…"
                : dialogState === "aborting"
                    ? "Stopping mysqlbackup safely…"
                    : failureMessage || "MySQL Enterprise Backup could not restore the selected backup.";

        return <div className="enterpriseBackupRestoreProgressContent">
            <div className={`enterpriseBackupRestoreProgressStatus ${dialogState}`}>
                {restoreIsActive && <Icon src={Codicon.Loading} />}
                <span>{statusMessage}</span>
            </div>
            <textarea ref={outputRef} readOnly aria-label="MySQL Enterprise Backup output" value={output} />
            {dialogState === "failed" && <Checkbox
                caption="Force restore on retry (may overwrite the target data directory)"
                checkState={failureForce ? CheckState.Checked : CheckState.Unchecked}
                onChange={(checkState) => {
                    setFailureForce(checkState === CheckState.Checked);
                }}
            />}
        </div>;
    };

    const actions = dialogState === "confirm"
        ? { end: [
            <Button key="restore" onClick={() => {
                void restoreBackup();
            }} disabled={disabled || metadataLoading}>
                Restore
            </Button>,
            <Button key="cancel" onClick={close}>Cancel</Button>,
        ] }
        : dialogState === "failed"
            ? { end: [
                <Button key="retry" onClick={() => {
                    void restoreBackup(failureForce);
                }} disabled={disabled}>
                    Retry
                </Button>,
                <Button key="cancel" onClick={close}>Cancel</Button>,
            ] }
            : { end: [
                <Button key="abort" onClick={() => {
                    void abortBackupRestore();
                }} disabled={dialogState !== "running"}>
                    {dialogState === "aborting" ? "Aborting…" : "Abort"}
                </Button>,
            ] };

    return <Dialog
        ref={dialogRef}
        className={`enterpriseBackupRestoreDialog${restoreIsActive ? " active" : ""}`}
        caption={dialogState === "failed" ? "Restore Backup Failed" : "Restore Backup"}
        content={content()}
        actions={actions}
        onClose={handleClose}
    />;
};
