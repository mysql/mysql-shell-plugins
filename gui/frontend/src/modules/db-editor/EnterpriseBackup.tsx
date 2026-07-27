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

import "./assets/EnterpriseBackup.css";

import type { ComponentChild, TargetedMouseEvent } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";

import { ui } from "../../app-logic/UILayer.js";
import { Button } from "../../components/ui/Button/Button.js";
import { Codicon } from "../../components/ui/Codicon.js";
import { Dialog } from "../../components/ui/Dialog/Dialog.js";
import { EmbeddedLogViewer } from "../../components/ui/EmbeddedLogViewer/EmbeddedLogViewer.js";
import { Icon } from "../../components/ui/Icon/Icon.js";
import { Menu } from "../../components/ui/Menu/Menu.js";
import { MenuItem } from "../../components/ui/Menu/MenuItem.js";
import type { ICdmConnectionEntry } from "../../data-models/ConnectionDataModel.js";
import { Assets } from "../../supplement/Assets.js";
import { requisitions } from "../../supplement/Requisitions.js";
import { ShellInterface } from "../../supplement/ShellInterface/ShellInterface.js";
import {
    type IMebBackupContent, type IMebBackupProfileInfo, type IMebLogContent, type IMebBackupProfile,
    type IMebSetupState, type IMebStatus,
} from "../../supplement/ShellInterface/ShellInterfaceMeb.js";
import { convertErrorToString } from "../../utilities/helpers.js";
import {
    validateMebProfileRequiredFields,
    validateMebProfileSaveOptions,
    validateMebTableFilters,
} from "./EnterpriseBackupValidation.js";
import {
    filterMebActivityItems,
    mebRestoreActivityDetails,
} from "./EnterpriseBackupActivity.js";
import {
    draftToProfileConfiguration,
    filterMebContentRows,
    profileToDraft,
    legacyPartialBackupConversionMessage,
    profileSchedulesChanged,
    type IMebProfileDraft,
} from "./EnterpriseBackupProfileMapping.js";
import { EnterpriseBackupContentViewer } from "./EnterpriseBackupContentViewer.js";
import {
    EnterpriseBackupConfiguration,
    type IMebConfiguration,
    normalizeMebConfiguration,
} from "./EnterpriseBackupConfiguration.js";
import {
    EnterpriseBackupProfileEditor,
    type MebProfileDialogTab,
} from "./EnterpriseBackupProfileEditor.js";
import { EnterpriseBackupRestoreDialog } from "./EnterpriseBackupRestoreDialog.js";
import {
    AdministrationPageBody, AdministrationPageFrame, AdministrationPageHeading,
} from "./AdministrationPageFrame.js";

interface IMebBackupJob {
    command?: string;
    configPath?: string;
    label: string;
    destination: string;
    latest: string;
    nextFull: string;
    nextIncremental: string;
    status: string;
    type: string;
}

interface IMebOverviewItem {
    label: string;
    value: string;
    status?: string;
    tone?: string;
    backupFillPercent?: number;
    otherFillPercent?: number;
}

export interface IEnterpriseBackupSavedState {
    configuration?: IMebConfiguration;
    setupState?: IMebSetupState;
    status?: IMebStatus;
}

interface IEnterpriseBackupProps {
    connection?: ICdmConnectionEntry;
    savedState?: IEnterpriseBackupSavedState;
    onStateChange?: (data: Partial<IEnterpriseBackupSavedState>) => void;
}

const mebStatusRefreshIntervalMs = 2000;

const defaultMysqlbackupPath = (mysqlBasedir?: string): string => {
    const basedir = mysqlBasedir ?? "";
    if (!basedir) {
        return "";
    }

    const normalizedBasedir = basedir.replace(/[\\/]+$/, "");
    const usesWindowsPaths = normalizedBasedir.includes("\\") || /^[A-Za-z]:/.test(normalizedBasedir);
    const separator = usesWindowsPaths ? "\\" : "/";
    const binaryName = usesWindowsPaths ? "mysqlbackup.exe" : "mysqlbackup";

    return `${normalizedBasedir}${separator}bin${separator}${binaryName}`;
};

const defaultBackupHomePath = "~/backups";
const defaultBackupUser = "mysqlbackup@localhost";

const defaultConfiguration = (connection?: ICdmConnectionEntry): IMebConfiguration => {
    const saved = connection?.details.settings?.enterpriseBackup;

    return {
        mysqlbackupPath: saved?.mysqlbackupPath ?? defaultMysqlbackupPath(),
        backupHomePath: saved?.backupHomePath ?? defaultBackupHomePath,
        backupUser: saved?.backupUser ?? defaultBackupUser,
    };
};

const mysqlConnectionHost = (connection?: ICdmConnectionEntry): string | undefined => {
    const options = connection?.details.options as Record<string, unknown> | undefined;
    const host = options?.host;

    return typeof host === "string" ? host : undefined;
};

const mysqlConnectionSocket = (connection?: ICdmConnectionEntry): string | undefined => {
    const options = connection?.details.options as Record<string, unknown> | undefined;
    const socket = options?.socket;

    return typeof socket === "string" ? socket : undefined;
};

const mysqlConnectionTarget = (connection?: ICdmConnectionEntry): string => {
    const socket = mysqlConnectionSocket(connection);
    const host = mysqlConnectionHost(connection);

    if (connection?.details.useSSH) {
        return `SSH tunnel to ${host ?? "configured host"}`;
    }

    if (socket) {
        return `socket ${socket}`;
    }

    return host ?? "localhost";
};

const isLocalhostConnection = (connection?: ICdmConnectionEntry): boolean => {
    const host = mysqlConnectionHost(connection)?.trim().toLowerCase();
    const socket = mysqlConnectionSocket(connection);

    if (connection?.details.useSSH) {
        return false;
    }

    return socket !== undefined || host === undefined || host === "" || host === "localhost"
        || host === "127.0.0.1" || host === "::1" || host === "[::1]";
};

const mapProfiles = (profiles: IMebBackupProfileInfo[]): IMebBackupJob[] => {
    return profiles.map((profile) => {
        return {
            command: profile.command ?? undefined,
            configPath: profile.configPath ?? undefined,
            label: profile.label,
            type: profile.type,
            destination: profile.destination,
            latest: profile.latest,
            nextFull: profile.nextFull,
            nextIncremental: profile.nextIncremental,
            status: profile.status,
        };
    });
};

const profileContentsSummary = (profile?: IMebBackupProfileInfo): string => {
    if (!profile) {
        return "Unknown";
    }

    if (!profile.partial) {
        return "Full instance";
    }

    const parts: string[] = [];
    if (profile.includeTables) {
        parts.push(`include ${profile.includeTables}`);
    }

    if (profile.excludeTables) {
        parts.push(`exclude ${profile.excludeTables}`);
    }

    const filterSummary = parts.length > 0 ? parts.join("; ") : "selected objects";

    return profile.usingTts !== "0" ? `${filterSummary}; TTS` : filterSummary;
};

const statusHasRunningBackup = (status?: IMebStatus): boolean => {
    return status?.recentActivity[0]?.status === "Running";
};

const activityRelativeTime = (value: string): string => {
    const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/.exec(value);
    if (!match) {
        return "";
    }

    const timestamp = new Date(`${match[1]}T${match[2]}:00`).getTime();
    if (!Number.isFinite(timestamp)) {
        return "";
    }

    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    if (elapsedMinutes < 1) {
        return "just now";
    }
    if (elapsedMinutes < 60) {
        return `${elapsedMinutes} ${elapsedMinutes === 1 ? "minute" : "minutes"} ago`;
    }

    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) {
        return `${elapsedHours} ${elapsedHours === 1 ? "hour" : "hours"} ago`;
    }

    const elapsedDays = Math.floor(elapsedHours / 24);

    return `${elapsedDays} ${elapsedDays === 1 ? "day" : "days"} ago`;
};

const contextMenuRect = (event: MouseEvent | KeyboardEvent): DOMRect => {
    if ("clientX" in event && "clientY" in event) {
        return new DOMRect(event.clientX, event.clientY, 1, 1);
    }

    if (event.currentTarget instanceof Element) {
        return event.currentTarget.getBoundingClientRect();
    }

    return new DOMRect();
};

export const EnterpriseBackup = ({ connection, onStateChange, savedState }: IEnterpriseBackupProps): ComponentChild => {
    const profileDialogRef = useRef<Dialog>(null);
    const logDialogRef = useRef<Dialog>(null);
    const contentDialogRef = useRef<Dialog>(null);
    const profileScheduleBaselineRef = useRef<Pick<
        IMebBackupProfileInfo, "fullSchedule" | "incSchedule"
    > | undefined>(undefined);
    const jobMenuRef = useRef<Menu>(null);
    const activityMenuRef = useRef<Menu>(null);
    const activityEntryMenuRef = useRef<Menu>(null);
    const activityFilterMenuRef = useRef<Menu>(null);
    const backend = connection?.backend;
    const moduleSessionId = backend?.moduleSessionId;
    const initialConfiguration = useMemo(() => {
        return savedState?.configuration ?? defaultConfiguration(connection);
    }, [connection, savedState?.configuration]);
    const [status, setStatus] = useState<IMebStatus | undefined>(savedState?.status);
    const [setupState, setSetupState] = useState<IMebSetupState | undefined>(savedState?.setupState);
    const offline = connection?.isOffline === true;
    const [setupStateLoading, setSetupStateLoading] = useState(
        !offline && initialConfiguration.backupHomePath.trim() !== "" && isLocalhostConnection(connection)
        && !savedState?.status && !savedState?.setupState,
    );
    const [loadError, setLoadError] = useState<string>();
    const [configurationDialogOpen, setConfigurationDialogOpen] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [executingProfile, setExecutingProfile] = useState<"full" | "incremental" | undefined>();
    const [openingLog, setOpeningLog] = useState(false);
    const [jobCommand, setJobCommand] = useState<string>();
    const [selectedJobIndex, setSelectedJobIndex] = useState(0);
    const [selectedActivityIndex, setSelectedActivityIndex] = useState(0);
    const [activityBackupsOnly, setActivityBackupsOnly] = useState(false);
    const [activitySelectedProfileOnly, setActivitySelectedProfileOnly] = useState(false);
    const [configuration, setConfiguration] = useState<IMebConfiguration>(initialConfiguration);
    const [wizardActive, setWizardActive] = useState(initialConfiguration.backupHomePath.trim() === "");
    const [wizardCancelled, setWizardCancelled] = useState(false);
    const [profileDraft, setProfileDraft] = useState<IMebProfileDraft>();
    const [profileDialogMode, setProfileDialogMode] = useState<"new" | "edit">("new");
    const [profileDialogTab, setProfileDialogTab] = useState<MebProfileDialogTab>("schedule");
    const [logContent, setLogContent] = useState<IMebLogContent>();
    const [logDialogCaption, setLogDialogCaption] = useState("mysqlbackup Log");
    const [backupContent, setBackupContent] = useState<IMebBackupContent>();
    const [contentProfileName, setContentProfileName] = useState<string>();
    const [openingBackupContent, setOpeningBackupContent] = useState(false);
    const [activityCommand, setActivityCommand] = useState<string>();
    const [restoreActivityId, setRestoreActivityId] = useState<string>();
    const initialLoadKey = useRef<string>();
    const updateCachedStatus = useCallback((nextStatus: IMebStatus | undefined): void => {
        setStatus(nextStatus);
        onStateChange?.({ status: nextStatus });
    }, [onStateChange]);

    const updateCachedConfiguration = useCallback((nextConfiguration: IMebConfiguration): void => {
        const normalizedConfiguration = normalizeMebConfiguration(nextConfiguration);

        setConfiguration(normalizedConfiguration);
        onStateChange?.({ configuration: normalizedConfiguration });
    }, [onStateChange]);

    const updateCachedSetupState = useCallback((nextSetupState: IMebSetupState): void => {
        const nextStatus = nextSetupState.status ?? undefined;

        setSetupState(nextSetupState);
        setStatus(nextStatus);
        onStateChange?.({
            setupState: nextSetupState,
            status: nextStatus,
        });
    }, [onStateChange]);

    const loadSetupState = useCallback(async (
        path: string,
        fallbackConfiguration: IMebConfiguration,
    ): Promise<IMebSetupState | undefined> => {
        if (offline) {
            setSetupStateLoading(true);
            setLoadError(undefined);
            try {
                updateCachedStatus(await ShellInterface.meb.getStatus(path.trim() || undefined));
            } catch (reason: unknown) {
                const message = convertErrorToString(reason);
                setLoadError(message);
            } finally {
                setSetupStateLoading(false);
            }

            return undefined;
        }

        if (!moduleSessionId) {
            setSetupStateLoading(false);
            setLoadError("Open a MySQL connection before configuring Enterprise Backup.");

            return undefined;
        }

        setSetupStateLoading(true);
        setLoadError(undefined);
        try {
            const nextSetupState = await ShellInterface.meb.getSetupState(
                moduleSessionId,
                path.trim() || undefined,
            );
            updateCachedSetupState(nextSetupState);

            const nextConfiguration = normalizeMebConfiguration({
                mysqlbackupPath: nextSetupState.mysqlbackupPath ?? fallbackConfiguration.mysqlbackupPath,
                backupHomePath: nextSetupState.backupHomePath ?? fallbackConfiguration.backupHomePath,
                backupUser: nextSetupState.mysqlBackupUser || fallbackConfiguration.backupUser,
            });
            updateCachedConfiguration(nextConfiguration);

            return nextSetupState;
        } catch (reason: unknown) {
            const message = convertErrorToString(reason);
            setLoadError(message);

            return undefined;
        } finally {
            setSetupStateLoading(false);
        }
    }, [moduleSessionId, offline, updateCachedConfiguration, updateCachedSetupState, updateCachedStatus]);

    useEffect(() => {
        const backupHomePath = initialConfiguration.backupHomePath.trim();
        const localConnection = isLocalhostConnection(connection);
        const ready = (offline && backupHomePath) || (!offline && moduleSessionId && localConnection);
        const loadKey = `${offline}:${moduleSessionId ?? ""}:${localConnection}:${backupHomePath}`;
        if (ready && initialLoadKey.current !== loadKey) {
            initialLoadKey.current = loadKey;
            void loadSetupState(backupHomePath, initialConfiguration);
        }
    }, [connection, initialConfiguration, loadSetupState, moduleSessionId, offline]);

    const displayJobs = useMemo(() => {
        return status?.profiles ? mapProfiles(status.profiles) : [];
    }, [status]);
    const tableFilterError = profileDraft
        ? validateMebTableFilters(
            profileDraft.partialMode,
            profileDraft.includeTables,
            profileDraft.excludeTables,
        ) : null;

    useEffect(() => {
        if (selectedJobIndex >= displayJobs.length) {
            setSelectedJobIndex(0);
        }
    }, [displayJobs.length, selectedJobIndex]);

    const clampedJobIndex = displayJobs.length > 0
        ? Math.min(selectedJobIndex, displayJobs.length - 1)
        : 0;
    const selectedJob = displayJobs.length > 0
        ? displayJobs[clampedJobIndex]
        : undefined;
    const selectedProfile = status?.profiles.length ? status.profiles[clampedJobIndex] : undefined;
    const displayActivity = filterMebActivityItems(
        status?.recentActivity ?? [],
        activityBackupsOnly,
        activitySelectedProfileOnly,
        selectedProfile?.uuid,
    );
    const restoreActivityDetails = mebRestoreActivityDetails(status?.recentActivity ?? [], restoreActivityId);

    useEffect(() => {
        if (selectedActivityIndex >= displayActivity.length) {
            setSelectedActivityIndex(0);
        }
    }, [displayActivity.length, selectedActivityIndex]);

    const backupRunning = statusHasRunningBackup(status);
    const hasConfiguredBackupHome = status?.configured === true;
    const serverInfo = {
        mysqlVersion: status?.mysqlVersion ?? setupState?.mysqlVersion ?? "Unknown",
        mysqlEdition: status?.mysqlEdition ?? setupState?.mysqlEdition ?? "Unknown",
        mysqlBasedir: status?.mysqlBasedir ?? setupState?.mysqlBasedir ?? "",
        datadir: status?.datadir ?? setupState?.datadir ?? "Unknown",
    };
    const backupHomePath = configuration.backupHomePath.trim();
    const expectedMysqlbackupPath = setupState?.mysqlbackupPath ?? defaultMysqlbackupPath(serverInfo.mysqlBasedir);
    const localhostSupported = offline || isLocalhostConnection(connection);
    const backupCommandsDisabled = offline || moduleSessionId === undefined;
    const restoreCommandsDisabled = !offline && backupCommandsDisabled;
    const activityCommandsDisabled = !offline && backupCommandsDisabled;
    const connectionTarget = mysqlConnectionTarget(connection);
    const setupProbePending = localhostSupported && !wizardActive && setupStateLoading && !status && !setupState
        && !loadError;

    useEffect(() => {
        if (hasConfiguredBackupHome) {
            setWizardCancelled(false);

            return;
        }

        if ((status || loadError || setupState?.needsSetup) && !wizardCancelled) {
            setWizardActive(true);
        }
    }, [hasConfiguredBackupHome, loadError, setupState, status, wizardCancelled]);

    useEffect(() => {
        if (!backupRunning) {
            setExecutingProfile(undefined);
        }
    }, [backupRunning]);

    useEffect(() => {
        if (!hasConfiguredBackupHome || wizardActive || !backupHomePath) {
            return;
        }

        let cancelled = false;
        const refreshStatus = async (): Promise<void> => {
            try {
                const nextStatus = await ShellInterface.meb.getStatus(backupHomePath);

                if (!cancelled) {
                    updateCachedStatus(nextStatus);
                }
            } catch {
                // Keep the last status; foreground actions surface their own failures.
            }
        };

        const interval = setInterval(() => {
            void refreshStatus();
        }, mebStatusRefreshIntervalMs);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [configuration.backupHomePath, hasConfiguredBackupHome, updateCachedStatus, wizardActive]);

    const renderLocalhostNotice = (): ComponentChild => {
        return (
            <section className="enterpriseBackupLocalNotice warn">
                <Icon src={Codicon.Warning} />
                <div>
                    <strong>MEB support is available only for MySQL servers running on localhost.</strong>
                    <p>Current connection target: {connectionTarget}</p>
                </div>
            </section>
        );
    };

    const openProfileDialog = (mode: "new" | "edit", profileOverride?: IMebBackupProfileInfo): void => {
        if (backupCommandsDisabled) {
            return;
        }

        const profile = profileOverride ?? (mode === "edit" ? selectedProfile : status?.profileTemplate);
        if (!profile) {
            void ui.showErrorMessage("Backup profile defaults are not available yet.", {});

            return;
        }

        setProfileDialogMode(mode);
        setProfileDialogTab("contents");
        profileScheduleBaselineRef.current = mode === "edit" ? profile : undefined;
        setProfileDraft(profileToDraft(mode, profile));
        if (mode === "edit") {
            const conversionMessage = legacyPartialBackupConversionMessage(profile);
            if (conversionMessage) {
                void ui.showInformationMessage(conversionMessage, {});
            }
        }
        profileDialogRef.current?.open();
    };

    const newJobClicked = (): void => {
        openProfileDialog("new");
    };

    const startWizard = (): void => {
        if (backupCommandsDisabled) {
            return;
        }

        setWizardCancelled(false);
        setWizardActive(true);
        void loadSetupState(configuration.backupHomePath, configuration);
    };

    const cancelWizard = (): void => {
        setWizardActive(false);
        setWizardCancelled(true);
    };

    const updateProfileDraft = (values: Partial<IMebProfileDraft>): void => {
        setProfileDraft((current) => {
            if (!current) {
                return current;
            }

            return {
                ...current,
                ...values,
            };
        });
    };

    const saveProfile = async (): Promise<void> => {
        if (backupCommandsDisabled) {
            return;
        }

        if (!profileDraft) {
            void ui.showErrorMessage("Open a backup profile before saving.", {});

            return;
        }
        const profile: IMebBackupProfile = draftToProfileConfiguration(profileDraft, {
            backupHomePath: backupHomePath,
            backupUser: configuration.backupUser,
            datadir: serverInfo.datadir,
            mysqlBasedir: serverInfo.mysqlBasedir,
        });

        if (!backupHomePath) {
            void ui.showErrorMessage("Configure a backup home directory before saving backup profiles.", {});

            return;
        }

        const requiredFieldsError = validateMebProfileRequiredFields(profile.label, profile.destination);
        if (requiredFieldsError) {
            void ui.showErrorMessage(requiredFieldsError, {});

            return;
        }

        if (/[`'$\n\r\\/:*?"<>|]/.test(profile.label)) {
            void ui.showErrorMessage("The profile name contains characters that cannot be used in a filename.", {});

            return;
        }

        const saveOptionsError = validateMebProfileSaveOptions(backupHomePath, profileDraft);
        if (saveOptionsError) {
            setProfileDialogTab(saveOptionsError.tab);
            void ui.showErrorMessage(saveOptionsError.message, {});

            return;
        }

        if (profile.compress && profile.applyLog) {
            void ui.showErrorMessage("Compress cannot be used with backup-and-apply-log.", {});

            return;
        }

        if (profile.partial && tableFilterError) {
            setProfileDialogTab("contents");

            return;
        }

        if (profile.partial && profile.usingTts !== "0" && profile.incSchedule.enabled) {
            void ui.showErrorMessage("Transportable Tablespaces cannot be used on incremental backups.", {});

            return;
        }

        const scheduleChanged = profileSchedulesChanged(profileScheduleBaselineRef.current, profile);
        setSavingProfile(true);
        try {
            if (!moduleSessionId) {
                throw new Error("Open a MySQL connection before saving backup profiles.");
            }

            const nextStatus = await ShellInterface.meb.saveProfile(moduleSessionId, backupHomePath, profile);
            updateCachedStatus(nextStatus);
            profileDialogRef.current?.close(false);
            void ui.showInformationMessage(
                scheduleChanged
                    ? "Backup profile and schedule were saved successfully."
                    : "Backup profile was saved successfully.",
                {},
            );
        } catch (reason: unknown) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Cannot save backup profile: ${message}`, {});
        } finally {
            setSavingProfile(false);
        }
    };

    const openActivityLog = async (activityId: string): Promise<void> => {
        if (openingLog) {
            return;
        }

        if (!backupHomePath || !activityId) {
            void ui.showInformationMessage("No mysqlbackup log file is available for the current backup profiles.", {});

            return;
        }

        setOpeningLog(true);
        try {
            const content = await ShellInterface.meb.readLog(backupHomePath, activityId);
            setLogContent(content);
            setLogDialogCaption("mysqlbackup Log");
            logDialogRef.current?.open();
        } catch (reason: unknown) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Cannot open mysqlbackup log: ${message}`, {});
        } finally {
            setOpeningLog(false);
        }
    };

    const openActivityBackupContent = async (
        activityId: string,
    ): Promise<void> => {
        if (openingBackupContent) {
            return;
        }

        if (!backupHomePath || !activityId) {
            void ui.showErrorMessage("Select a recent backup activity entry first.", {});

            return;
        }

        setOpeningBackupContent(true);
        try {
            const content = await ShellInterface.meb.readBackupContent(
                backupHomePath,
                activityId,
            );
            setBackupContent({ ...content, rows: filterMebContentRows(content.rows) });
            setContentProfileName(displayActivity.find((item) => {
                return item.activityId === activityId;
            })?.profile ?? undefined);
            contentDialogRef.current?.open();
        } catch (reason: unknown) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Cannot open backup contents: ${message}`, {});
        } finally {
            setOpeningBackupContent(false);
        }
    };

    const copyActivityBackupPath = async (activityId: string): Promise<void> => {
        if (activityCommand !== undefined || !backupHomePath || !activityId) {
            return;
        }

        setActivityCommand(`copyPath:${activityId}`);
        try {
            requisitions.writeToClipboard(await ShellInterface.meb.getBackupPath(backupHomePath, activityId));
            void ui.showInformationMessage("Backup path copied to the system clipboard.", {});
        } catch (reason: unknown) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Cannot copy backup path: ${message}`, {});
        } finally {
            setActivityCommand(undefined);
        }
    };

    const openRestoreDialog = (activityId: string): void => {
        if (activityCommand !== undefined || restoreCommandsDisabled || !backupHomePath) {
            return;
        }

        setRestoreActivityId(activityId);
    };

    const applyBackupLogs = async (activityId: string): Promise<void> => {
        if (activityCommandsDisabled || !backupHomePath || activityCommand !== undefined) {
            return;
        }
        const response = await ui.confirm("Apply logs to this backup?", "Apply Logs", "Cancel");
        if (response !== "Apply Logs") {
            return;
        }
        setActivityCommand(`applyLogs:${activityId}`);
        try {
            updateCachedStatus(await ShellInterface.meb.applyBackupLogs(backupHomePath, activityId));
            void ui.showInformationMessage("Backup logs applied.", {});
        } catch (reason: unknown) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Cannot apply backup logs: ${message}`, {});
        } finally {
            setActivityCommand(undefined);
        }
    };

    const deleteActivityEntry = async (activityId: string): Promise<void> => {
        if (activityCommandsDisabled || !backupHomePath || activityCommand !== undefined) {
            return;
        }
        const response = await ui.confirm(
            "Delete this activity entry? The associated backup data will not be deleted.",
            "Delete Entry",
            "Cancel",
        );
        if (response !== "Delete Entry") {
            return;
        }

        setActivityCommand(`deleteEntry:${activityId}`);
        try {
            updateCachedStatus(await ShellInterface.meb.deleteBackup(backupHomePath, activityId));
            void ui.showInformationMessage("Activity entry deleted.", {});
        } catch (reason: unknown) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Cannot delete activity entry: ${message}`, {});
        } finally {
            setActivityCommand(undefined);
        }
    };

    const runActivityBackupOperation = async (operation: "delete" | "verify", activityId: string): Promise<void> => {
        if (activityCommandsDisabled || !backupHomePath || !activityId) {
            void ui.showErrorMessage("Select a recent backup activity entry first.", {});

            return;
        }

        const commandKey = `${operation}:${activityId}`;
        if (activityCommand !== undefined) {
            return;
        }

        if (operation === "delete") {
            const response = await ui.confirm(
                "Delete this backup and all related files? This cannot be undone.",
                "Delete",
                "Cancel",
            );
            if (response !== "Delete") {
                return;
            }
        }

        setActivityCommand(commandKey);
        try {
            if (operation === "delete") {
                updateCachedStatus(await ShellInterface.meb.deleteBackup(backupHomePath, activityId));
                void ui.showInformationMessage("Backup was deleted.", {});
            } else {
                setLogContent(await ShellInterface.meb.verifyBackup(backupHomePath, activityId));
                setLogDialogCaption("Backup Verification");
                logDialogRef.current?.open();
            }
        } catch (reason: unknown) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(
                operation === "delete"
                    ? `Cannot delete backup: ${message}`
                    : `Cannot verify backup: ${message}`,
                {},
            );
        } finally {
            setActivityCommand(undefined);
        }
    };

    const deleteProfile = async (profileUuid: string): Promise<void> => {
        if (backupCommandsDisabled || !moduleSessionId || !backupHomePath || !profileUuid) {
            void ui.showErrorMessage("Select a configured backup profile before deleting it.", {});

            return;
        }

        if (jobCommand !== undefined) {
            return;
        }

        const response = await ui.confirm(
            "Delete this backup job? Backup data and logs are not deleted.",
            "Delete",
            "Cancel",
        );
        if (response !== "Delete") {
            return;
        }

        setJobCommand(`delete:${profileUuid}`);
        try {
            const nextStatus = await ShellInterface.meb.deleteProfile(moduleSessionId, backupHomePath, profileUuid);
            updateCachedStatus(nextStatus);
            void ui.showInformationMessage("Backup job was deleted.", {});
        } catch (reason: unknown) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Cannot delete backup job: ${message}`, {});
        } finally {
            setJobCommand(undefined);
        }
    };

    const openJobActionsMenu = (target: DOMRect | HTMLElement, profileUuid?: string): void => {
        if (!profileUuid || jobCommand !== undefined || backupCommandsDisabled) {
            return;
        }

        jobMenuRef.current?.open(
            target instanceof DOMRect ? target : target.getBoundingClientRect(),
            false,
            undefined,
            { profileUuid },
        );
    };

    const openActivityActionsMenu = (
        target: DOMRect | HTMLElement,
        activityId: string,
        enabled: boolean,
        canRestore: boolean,
        canApplyLogs: boolean,
    ): void => {
        if (!enabled || activityCommand !== undefined) {
            return;
        }

        activityMenuRef.current?.open(
            target instanceof DOMRect ? target : target.getBoundingClientRect(),
            false,
            undefined,
            { activityId, canRestore, canApplyLogs },
        );
    };

    const openActivityEntryMenu = (target: DOMRect | HTMLElement, activityId: string): void => {
        if (activityCommand !== undefined) {
            return;
        }

        activityEntryMenuRef.current?.open(
            target instanceof DOMRect ? target : target.getBoundingClientRect(),
            false,
            undefined,
            { activityId },
        );
    };

    const executeSelectedProfile = async (
        backupMode: "full" | "incremental",
        profileUuid = selectedProfile?.uuid,
    ): Promise<void> => {
        if (backupCommandsDisabled || !moduleSessionId || !backupHomePath || !profileUuid) {
            void ui.showErrorMessage("Select a configured backup profile before executing a backup.", {});

            return;
        }

        setExecutingProfile(backupMode);
        try {
            const nextStatus = await ShellInterface.meb.startProfileExecution(
                moduleSessionId,
                backupHomePath,
                profileUuid,
                backupMode,
            );
            updateCachedStatus(nextStatus);
            if (!statusHasRunningBackup(nextStatus)) {
                setExecutingProfile(undefined);
            }
        } catch (reason: unknown) {
            const message = convertErrorToString(reason);
            setExecutingProfile(undefined);
            void ui.showErrorMessage(`Cannot execute backup: ${message}`, {});
        }
    };

    const renderUnsupportedPage = (): ComponentChild => {
        return (
            <AdministrationPageFrame className="enterpriseBackupSurface enterpriseBackupIntroSurface">
                <AdministrationPageHeading
                    className="enterpriseBackupIntro enterpriseBackupNotConfigured"
                    heading="MEB support not available for this connection"
                    subtitle="Connect to a MySQL Server running on localhost to configure Enterprise Backup support."
                />
                <AdministrationPageBody className="enterpriseBackupIntroBody">
                    {renderLocalhostNotice()}
                </AdministrationPageBody>
            </AdministrationPageFrame>
        );
    };

    const renderLoadingPage = (): ComponentChild => {
        return (
            <AdministrationPageFrame className="enterpriseBackupSurface enterpriseBackupIntroSurface">
                <AdministrationPageHeading
                    className="enterpriseBackupIntro enterpriseBackupNotConfigured"
                    heading="Loading Enterprise Backup"
                    subtitle="Checking the configured backup home for this connection."
                />
                <AdministrationPageBody className="enterpriseBackupIntroBody" />
            </AdministrationPageFrame>
        );
    };

    const renderNotConfiguredPage = (): ComponentChild => {
        if (wizardActive) {
            return undefined;
        }

        return (
            <AdministrationPageFrame className="enterpriseBackupSurface enterpriseBackupIntroSurface">
                <AdministrationPageHeading
                    className="enterpriseBackupIntro enterpriseBackupNotConfigured"
                    heading="MEB support not configured"
                    subtitle="Manage local MySQL Enterprise Backup jobs and schedules."
                    actions={
                        <Button onClick={startWizard} disabled={backupCommandsDisabled}>
                            Configure
                        </Button>
                    }
                />
                <AdministrationPageBody className="enterpriseBackupIntroBody" />
            </AdministrationPageFrame>
        );
    };

    const renderConfiguredPage = (): ComponentChild => {
        const lastSuccessfulBackupActivity = displayActivity.find(({ status }) => {
            return status === "Completed OK";
        });
        const overviewItems: IMebOverviewItem[] = [{
            label: "Last successful backup",
            value: lastSuccessfulBackupActivity?.time ?? "No successful backups",
        }, {
            label: "Backup destination",
            value: configuration.backupHomePath.trim() || "Not configured",
        }, {
            label: "Storage",
            value: `${status?.spaceUsed ?? "Unknown"} used for backups – ${status?.spaceAvailable ?? "Unknown"} free`,
            backupFillPercent: status?.spaceUsedPercent ?? undefined,
            otherFillPercent: status?.spaceOtherUsedPercent ?? undefined,
        }];

        return (
            <AdministrationPageFrame className="enterpriseBackupSurface">
                <AdministrationPageHeading
                    className="enterpriseBackupHeader"
                    heading="MySQL Enterprise Backup"
                    icon={<Icon src={Assets.documents.adminBackupIcon} className="enterpriseBackupIcon" />}
                    subtitle="Manage local MySQL Enterprise Backup jobs and schedules"
                    actions={
                        <Button onClick={() => {
                            setConfigurationDialogOpen(true);
                        }} disabled={backupCommandsDisabled}>
                            Configure
                        </Button>
                    }
                >

                    <div className="enterpriseBackupHeaderOverview" aria-label="Backup overview">
                        {overviewItems.map((item) => {
                            const otherFillPercent = item.otherFillPercent !== undefined && item.otherFillPercent > 0
                                ? Math.min(100, Math.max(1, Math.round(item.otherFillPercent)))
                                : 0;
                            const backupFillPercent = item.backupFillPercent !== undefined && item.backupFillPercent > 0
                                ? Math.min(100 - otherFillPercent, Math.max(1, Math.round(item.backupFillPercent)))
                                : 0;
                            const availableFillPercent = item.backupFillPercent !== undefined
                                || item.otherFillPercent !== undefined
                                ? Math.max(0, 100 - otherFillPercent - backupFillPercent)
                                : 0;

                            return (
                                <div className="enterpriseBackupHeaderMetric" key={item.label}>
                                    <div className="enterpriseBackupHeaderMetricTitle">
                                        <span className="enterpriseBackupHeaderMetricCaption">{item.label}</span>
                                        {(item.backupFillPercent !== undefined || item.otherFillPercent !== undefined)
                                            && <div className="enterpriseBackupHeaderMetricLegend">
                                                <span className="enterpriseBackupHeaderMetricLegendItem">
                                                    <span className="enterpriseBackupHeaderMetricLegendDot backup" />
                                                    backups
                                                </span>
                                                <span className="enterpriseBackupHeaderMetricLegendItem">
                                                    <span className="enterpriseBackupHeaderMetricLegendDot other" />
                                                    other
                                                </span>
                                                <span className="enterpriseBackupHeaderMetricLegendItem">
                                                    <span className="enterpriseBackupHeaderMetricLegendDot available" />
                                                    available
                                                </span>
                                            </div>}
                                    </div>
                                    {backupFillPercent > 0 || otherFillPercent > 0 || availableFillPercent > 0
                                        ? <div className="enterpriseBackupHeaderMetricFill">
                                            <span className="enterpriseBackupHeaderMetricFillBackup" style={{
                                                width: `${backupFillPercent}%`,
                                            }} />
                                            <span className="enterpriseBackupHeaderMetricFillOther" style={{
                                                left: `${backupFillPercent}%`,
                                                width: `${otherFillPercent}%`,
                                            }} />
                                            <span className="enterpriseBackupHeaderMetricFillAvailable" style={{
                                                left: `${otherFillPercent + backupFillPercent}%`,
                                                width: `${availableFillPercent}%`,
                                            }} />
                                            <strong>{item.value}</strong>
                                        </div>
                                        : <strong>{item.value}</strong>}
                                    {item.status !== undefined && <span
                                        className={`enterpriseBackupHeaderMetricStatus ${item.tone ?? "info"}`}
                                    >
                                        {item.status}
                                    </span>}
                                </div>
                            );
                        })}
                    </div>
                </AdministrationPageHeading>

                <AdministrationPageBody>
                    {loadError && <div className="enterpriseBackupLoadError">{loadError}</div>}

                    <section className="enterpriseBackupWorkspace">
                        <div className="enterpriseBackupJobs">
                            <div className="enterpriseBackupSectionHeader">
                                <h2>Backup Jobs</h2>
                                <div className="enterpriseBackupSectionActions">
                                    <Button
                                        imageOnly={true}
                                        appearance="flat"
                                        title="New Job"
                                        onClick={newJobClicked}
                                        disabled={backupCommandsDisabled}
                                    >
                                        <Icon src={Codicon.Add} />
                                    </Button>
                                </div>
                            </div>

                            <div className="enterpriseBackupJobTable">
                                <div className="enterpriseBackupJobHeader">
                                    <span>Profile</span>
                                    <span>Latest</span>
                                    <span>Next full</span>
                                    <span>Next incremental</span>
                                </div>
                                {displayJobs.map((job, index) => {
                                    const rowClassName = index === selectedJobIndex
                                        ? "enterpriseBackupJobRow selected"
                                        : "enterpriseBackupJobRow";
                                    const profile = status?.profiles[index];

                                    return (
                                        <div
                                            className={rowClassName}
                                            key={job.configPath ?? job.label}
                                            onClick={() => {
                                                setSelectedJobIndex(index);
                                            }}
                                            onDblClick={() => {
                                                if (profile && !backupCommandsDisabled) {
                                                    openProfileDialog("edit", profile);
                                                }
                                            }}
                                            onContextMenu={(event: TargetedMouseEvent<HTMLDivElement>) => {
                                                event.preventDefault();
                                                setSelectedJobIndex(index);
                                                if (!backupCommandsDisabled) {
                                                    openJobActionsMenu(contextMenuRect(event), profile?.uuid);
                                                }
                                            }}>
                                            <div>
                                                <strong>{job.label}</strong>
                                                <span>{job.type}</span>
                                            </div>
                                            <span>{job.latest}</span>
                                            <span>{job.nextFull}</span>
                                            <span>{job.nextIncremental}</span>
                                        </div>
                                    );
                                })}
                                {displayJobs.length === 0 && <div className="enterpriseBackupEmptyState">
                                    No backup profiles found.
                                </div>}
                            </div>
                        </div>

                        {selectedJob ? <aside className="enterpriseBackupInspector">
                            <div className="enterpriseBackupSectionHeader">
                                <h2>{selectedJob.label}</h2>
                                <Button
                                    imageOnly={true}
                                    appearance="flat"
                                    className="iconSize24"
                                    data-tooltip="Job Actions"
                                    disabled={!selectedProfile || jobCommand !== undefined || backupCommandsDisabled}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        openJobActionsMenu(contextMenuRect(event), selectedProfile?.uuid);
                                    }}
                                >
                                    <Icon src={Codicon.Ellipsis} data-tooltip="inherit" />
                                </Button>
                            </div>

                            <dl>
                                <div>
                                    <dt>Type</dt>
                                    <dd>{profileContentsSummary(selectedProfile)}</dd>
                                </div>
                                <div>
                                    <dt>Full backup schedule</dt>
                                    <dd>{selectedJob.nextFull}</dd>
                                </div>
                                <div>
                                    <dt>Incremental backup schedule</dt>
                                    <dd>{selectedJob.nextIncremental}</dd>
                                </div>
                            </dl>
                            <div className="enterpriseBackupInspectorActions">
                                <Button
                                    onClick={() => {
                                        void executeSelectedProfile("full");
                                    }}
                                    disabled={backupCommandsDisabled || executingProfile !== undefined
                                    || backupRunning || !selectedProfile}
                                >
                                    Start Backup
                                </Button>
                                <Button
                                    onClick={() => {
                                        void executeSelectedProfile("incremental");
                                    }}
                                    disabled={backupCommandsDisabled || executingProfile !== undefined || backupRunning
                                    || !selectedProfile?.destination
                                    || selectedProfile.destination === "Not configured"}
                                >
                                    Start Incremental Backup
                                </Button>
                            </div>
                        </aside> : <aside className="enterpriseBackupInspector">
                            <div className="enterpriseBackupSectionHeader">
                                <h2>Selected Job</h2>
                            </div>
                            <div className="enterpriseBackupEmptyState">
                                Select or create a backup profile.
                            </div>
                        </aside>}
                    </section>

                    <section className="enterpriseBackupLower">
                        <div>
                            <div className="enterpriseBackupSectionHeader">
                                <h2>Recent Activity</h2>
                                <div className="enterpriseBackupSectionActions">
                                    <Button
                                        imageOnly={true}
                                        appearance="flat"
                                        data-tooltip="Filter Recent Activity"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            activityFilterMenuRef.current?.open(contextMenuRect(event), false);
                                        }}
                                    >
                                        <Icon src={Codicon.ListFilter} data-tooltip="inherit" />
                                    </Button>
                                </div>
                            </div>

                            <div className="enterpriseBackupTimeline">
                                {displayActivity.length > 0 && <div className="enterpriseBackupTimelineHeader">
                                    <span>Date</span>
                                    <span>Type</span>
                                    <span>Profile</span>
                                    <span>Status</span>
                                    <span>Size</span>
                                    <span />
                                </div>}
                                {displayActivity.map(({ time, title, detail, tone, activityId: itemActivityId,
                                    size, profile, status,
                                    backupType, isBackup }, index) => {
                                    const activityId = itemActivityId ?? "";
                                    const canOpenLog = activityId.length > 0;
                                    const canManageBackupData = canOpenLog && status !== "Running"
                                    && status !== "Backup missing";
                                    const canRestoreBackup = canManageBackupData && status === "Completed OK"
                                    && !restoreCommandsDisabled;
                                    const canApplyLogs = canManageBackupData && status === "apply-log pending"
                                    && !activityCommandsDisabled;
                                    const canManageActivityEntry = canOpenLog && status !== "Running";
                                    const canOpenActions = isBackup ? canManageBackupData : canManageActivityEntry;
                                    const relativeTime = activityRelativeTime(time);
                                    const statusText = status ?? detail;
                                    const statusDetail = status !== null && detail !== status ? detail : undefined;
                                    const rowClassName = index === selectedActivityIndex
                                        ? `enterpriseBackupTimelineItem ${tone} selected`
                                        : `enterpriseBackupTimelineItem ${tone}`;

                                    return (
                                        <div
                                            className={rowClassName}
                                            key={`${time}-${title}`}
                                            onClick={() => {
                                                setSelectedActivityIndex(index);
                                            }}
                                            onDblClick={canOpenLog ? () => {
                                                void openActivityLog(activityId);
                                            } : undefined}
                                            onContextMenu={canOpenActions
                                                ? (event: TargetedMouseEvent<HTMLDivElement>) => {
                                                    event.preventDefault();
                                                    setSelectedActivityIndex(index);
                                                    if (isBackup) {
                                                        openActivityActionsMenu(
                                                            contextMenuRect(event),
                                                            activityId,
                                                            canManageBackupData,
                                                            canRestoreBackup,
                                                            canApplyLogs,
                                                        );
                                                    } else {
                                                        openActivityEntryMenu(contextMenuRect(event), activityId);
                                                    }
                                                } : undefined}
                                        >
                                            <div className="enterpriseBackupActivityTime">
                                                {relativeTime && <span>{relativeTime}</span>}
                                                <span>{time}</span>
                                            </div>
                                            <span>{backupType ?? "--"}</span>
                                            <span className="enterpriseBackupActivityProfile">{profile ?? title}</span>
                                            <div className="enterpriseBackupActivityStatus">
                                                <Icon src={tone === "ok" ? Codicon.PassFilled : tone === "warn"
                                                    ? Codicon.Warning : Codicon.Info} />
                                                <div>
                                                    <span>{statusText}</span>
                                                    {statusDetail !== undefined && <small>{statusDetail}</small>}
                                                </div>
                                            </div>
                                            <span>{size ?? "--"}</span>
                                            <div className="enterpriseBackupActivityActions">
                                                {canOpenActions && <Button
                                                    imageOnly={true}
                                                    appearance="flat"
                                                    className="iconSize24"
                                                    data-tooltip="Activity Actions"
                                                    disabled={activityCommand !== undefined || openingBackupContent}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        if (isBackup) {
                                                            openActivityActionsMenu(
                                                                contextMenuRect(event),
                                                                activityId,
                                                                canManageBackupData,
                                                                canRestoreBackup,
                                                                canApplyLogs,
                                                            );
                                                        } else {
                                                            openActivityEntryMenu(
                                                                contextMenuRect(event),
                                                                activityId,
                                                            );
                                                        }
                                                    }}
                                                >
                                                    <Icon src={Codicon.Ellipsis} data-tooltip="inherit" />
                                                </Button>}
                                            </div>
                                        </div>
                                    );
                                })}
                                {displayActivity.length === 0 && <div className="enterpriseBackupEmptyState">
                                    No recent activity.
                                </div>}
                            </div>
                        </div>
                    </section>
                </AdministrationPageBody>
            </AdministrationPageFrame>
        );
    };

    const renderEnterpriseBackupPage = (): ComponentChild => {
        if (!localhostSupported) {
            return renderUnsupportedPage();
        }

        if (setupProbePending) {
            return renderLoadingPage();
        }

        return hasConfiguredBackupHome ? renderConfiguredPage() : renderNotConfiguredPage();
    };

    const renderBackupContentDialogContent = (): ComponentChild => {
        return <EnterpriseBackupContentViewer key={backupContent?.activityId} content={backupContent} />;
    };
    const backupContentDialogCaption = (): string => {
        if (backupContent === undefined) {
            return "Backup Contents";
        }

        const profileName = contentProfileName ?? "Unknown profile";

        return `${profileName} - ${backupContent.backupLabel}`;
    };

    const handleActivityFilterCommand = (command: string): boolean => {
        if (command === "meb.activityFilter.backupsOnly") {
            setActivityBackupsOnly((value) => {
                return !value;
            });

            return true;
        }
        if (command === "meb.activityFilter.selectedProfileOnly") {
            setActivitySelectedProfileOnly((value) => {
                return !value;
            });

            return true;
        }

        return false;
    };

    return (
        <div className="msg enterpriseBackupHost">
            <Menu
                ref={jobMenuRef}
                isItemDisabled={(props, payload) => {
                    if (backupCommandsDisabled) {
                        return true;
                    }

                    const profileUuid = (payload as { profileUuid?: string } | undefined)?.profileUuid;
                    const profile = status?.profiles.find((candidate) => {
                        return candidate.uuid === profileUuid;
                    });

                    if (props.command.command === "meb.job.start"
                        || props.command.command === "meb.job.startIncremental") {
                        if (executingProfile !== undefined || backupRunning || profile === undefined) {
                            return true;
                        }

                        return props.command.command === "meb.job.startIncremental"
                            && (!profile.destination || profile.destination === "Not configured");
                    }

                    return props.command.command === "meb.job.delete"
                        && (jobCommand !== undefined || executingProfile !== undefined || backupRunning);
                }}
                onItemClick={(props, _altActive, payload) => {
                    const profileUuid = (payload as { profileUuid?: string } | undefined)?.profileUuid;
                    if (!profileUuid) {
                        return true;
                    }

                    if (props.command.command === "meb.job.start") {
                        void executeSelectedProfile("full", profileUuid);
                    } else if (props.command.command === "meb.job.startIncremental") {
                        void executeSelectedProfile("incremental", profileUuid);
                    } else if (props.command.command === "meb.job.configure") {
                        openProfileDialog("edit", status?.profiles.find((profile) => {
                            return profile.uuid === profileUuid;
                        }));
                    } else if (props.command.command === "meb.job.delete") {
                        void deleteProfile(profileUuid);
                    }

                    return true;
                }}
            >
                <MenuItem
                    command={{
                        command: "meb.job.start",
                        title: "Start Backup",
                    }}
                />
                <MenuItem
                    command={{
                        command: "meb.job.startIncremental",
                        title: "Start Incremental Backup",
                    }}
                />

                <MenuItem
                    command={{
                        command: "meb.job.sep",
                        title: "-",
                    }}
                />

                <MenuItem
                    command={{
                        command: "meb.job.configure",
                        title: "Configure Job...",
                    }}
                />
                <MenuItem
                    command={{
                        command: "meb.job.delete",
                        title: "Delete Job...",
                    }}
                />
            </Menu>

            <Menu
                ref={activityMenuRef}
                isItemDisabled={(props, payload) => {
                    if (activityCommand !== undefined || openingBackupContent) {
                        return true;
                    }

                    if (props.command.command === "meb.activity.verify"
                        || props.command.command === "meb.activity.delete") {
                        return activityCommandsDisabled;
                    }

                    if (props.command.command === "meb.activity.restore") {
                        return restoreCommandsDisabled
                            || (payload as { canRestore?: boolean } | undefined)?.canRestore !== true;
                    }
                    if (props.command.command === "meb.activity.applyLogs") {
                        return activityCommandsDisabled
                            || (payload as { canApplyLogs?: boolean } | undefined)?.canApplyLogs !== true;
                    }

                    return false;
                }}
                onItemClick={(props, _altActive, payload) => {
                    const activityId = (payload as { activityId?: string } | undefined)?.activityId;
                    if (!activityId) {
                        return true;
                    }

                    if (props.command.command === "meb.activity.viewLogs") {
                        void openActivityLog(activityId);
                    } else if (props.command.command === "meb.activity.viewContents") {
                        void openActivityBackupContent(activityId);
                    } else if (props.command.command === "meb.activity.copyPath") {
                        void copyActivityBackupPath(activityId);
                    } else if (props.command.command === "meb.activity.verify") {
                        void runActivityBackupOperation("verify", activityId);
                    } else if (props.command.command === "meb.activity.restore") {
                        openRestoreDialog(activityId);
                    } else if (props.command.command === "meb.activity.applyLogs") {
                        void applyBackupLogs(activityId);
                    } else if (props.command.command === "meb.activity.delete") {
                        void runActivityBackupOperation("delete", activityId);
                    }

                    return true;
                }}
            >
                <MenuItem
                    command={{
                        command: "meb.activity.viewLogs",
                        title: "View Logs",
                    }}
                />
                <MenuItem
                    command={{
                        command: "meb.activity.viewContents",
                        title: "View Backup Contents",
                    }}
                />
                <MenuItem
                    command={{
                        command: "meb.activity.verify",
                        title: "Verify Backup",
                    }}
                />
                <MenuItem command={{ command: "meb.activity.copyPath", title: "Copy Backup Path" }} />
                <MenuItem
                    command={{
                        command: "meb.activity.separator.restore",
                        title: "-",
                    }}
                />
                <MenuItem
                    command={{ command: "meb.activity.applyLogs", title: "Apply Logs" }}
                />
                <MenuItem
                    command={{
                        command: "meb.activity.restore",
                        title: "Restore Backup...",
                    }}
                />
                <MenuItem
                    command={{
                        command: "meb.activity.separator.delete",
                        title: "-",
                    }}
                />
                <MenuItem
                    command={{
                        command: "meb.activity.delete",
                        title: "Delete Backup...",
                    }}
                />
            </Menu>

            <Menu
                ref={activityEntryMenuRef}
                isItemDisabled={(props) => {
                    return activityCommand !== undefined || openingLog;
                }}
                onItemClick={(props, _altActive, payload) => {
                    const activityId = (payload as { activityId?: string } | undefined)?.activityId;
                    if (!activityId) {
                        return true;
                    }

                    if (props.command.command === "meb.activityEntry.viewLogs") {
                        void openActivityLog(activityId);
                    } else if (props.command.command === "meb.activityEntry.delete") {
                        void deleteActivityEntry(activityId);
                    }

                    return true;
                }}
            >
                <MenuItem
                    command={{ command: "meb.activityEntry.viewLogs", title: "View Logs" }}
                />
                <MenuItem
                    command={{ command: "meb.activityEntry.sep", title: "-" }}
                />
                <MenuItem
                    command={{ command: "meb.activityEntry.delete", title: "Delete Entry..." }}
                />
            </Menu>

            <Menu
                ref={activityFilterMenuRef}
                isItemDisabled={(props) => {
                    return props.command.command === "meb.activityFilter.selectedProfileOnly"
                        && selectedProfile === undefined;
                }}
                onItemClick={(props) => {
                    return handleActivityFilterCommand(props.command.command);
                }}
            >
                <MenuItem
                    checked={activityBackupsOnly}
                    command={{ command: "meb.activityFilter.backupsOnly", title: "Backups Only" }}
                />
                <MenuItem
                    checked={activitySelectedProfileOnly}
                    command={{ command: "meb.activityFilter.selectedProfileOnly", title: "Selected Profile Only" }}
                />
            </Menu>

            <EnterpriseBackupConfiguration
                active={wizardActive}
                backupCommandsDisabled={backupCommandsDisabled}
                configuration={configuration}
                connection={connection}
                dialogOpen={configurationDialogOpen}
                expectedMysqlbackupPath={expectedMysqlbackupPath}
                loadError={loadError}
                moduleSessionId={moduleSessionId}
                serverInfo={serverInfo}
                setupState={setupState}
                onApplied={(nextConfiguration, nextSetupState) => {
                    updateCachedConfiguration(nextConfiguration);
                    updateCachedSetupState(nextSetupState);
                    setWizardActive(false);
                    setWizardCancelled(false);
                    setConfigurationDialogOpen(false);
                }}
                onCancel={cancelWizard}
                onDialogOpenChange={setConfigurationDialogOpen}
            />

            <Dialog
                ref={profileDialogRef}
                className="enterpriseBackupProfileDialog"
                caption={profileDialogMode === "new" ? "New Backup Job" : "Configure Backup Job"}
                content={profileDraft && <EnterpriseBackupProfileEditor
                    activeTab={profileDialogTab}
                    backupHomePath={backupHomePath}
                    draft={profileDraft}
                    tableFilterError={tableFilterError ?? undefined}
                    onChange={updateProfileDraft}
                    onTabChange={setProfileDialogTab}
                />}
                actions={{
                    end: [
                        <Button key="save" onClick={() => {
                            void saveProfile();
                        }} disabled={backupCommandsDisabled || savingProfile}>
                            {savingProfile ? "Saving" : "Save"}
                        </Button>,
                        <Button key="cancel" onClick={() => {
                            profileDialogRef.current?.close(true);
                        }}>
                            Cancel
                        </Button>,
                    ],
                }}
            />

            <Dialog
                ref={logDialogRef}
                className="enterpriseBackupLogDialog"
                caption={logDialogCaption}
                content={
                    <EmbeddedLogViewer
                        path={logContent?.displayName}
                        content={logContent?.content}
                        warnings={logContent?.warnings}
                    />
                }
                actions={{
                    end: [
                        <Button key="close" onClick={() => {
                            logDialogRef.current?.close(false);
                        }}>
                            Close
                        </Button>,
                    ],
                }}
            />

            <Dialog
                ref={contentDialogRef}
                className="enterpriseBackupContentDialog"
                caption={backupContentDialogCaption()}
                content={renderBackupContentDialogContent()}
                actions={{
                    end: [
                        <Button key="close" onClick={() => {
                            contentDialogRef.current?.close(false);
                        }}>
                            Close
                        </Button>,
                    ],
                }}
            />

            {restoreActivityId && <EnterpriseBackupRestoreDialog
                activityId={restoreActivityId}
                backupHomePath={backupHomePath}
                datadir={serverInfo.datadir}
                disabled={restoreCommandsDisabled || activityCommand !== undefined}
                restoreDetails={restoreActivityDetails}
                onBusyChange={(busy) => {
                    setActivityCommand(busy ? `restore:${restoreActivityId}` : undefined);
                }}
                onStatusChange={updateCachedStatus}
                onClose={() => {
                    setRestoreActivityId(undefined);
                }}
            />}

            {renderEnterpriseBackupPage()}
        </div>
    );
};
