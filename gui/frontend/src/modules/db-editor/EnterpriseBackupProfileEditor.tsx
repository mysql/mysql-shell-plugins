/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0.
 */

import type { ComponentChild, ComponentChildren } from "preact";

import { Checkbox, CheckState } from "../../components/ui/Checkbox/Checkbox.js";
import { Frame } from "../../components/ui/Frame/Frame.js";
import { Input } from "../../components/ui/Input/Input.js";
import { LearnMore } from "../../components/ui/LearnMore/LearnMore.js";
import { MonthDayPicker } from "../../components/ui/MonthDayPicker/MonthDayPicker.js";
import { Radiobutton } from "../../components/ui/Radiobutton/Radiobutton.js";
import { Tabview, type ITabviewPage } from "../../components/ui/Tabview/Tabview.js";
import type { IMebBackupProfileInfo } from "../../supplement/ShellInterface/ShellInterfaceMeb.js";
import {
    backupStorageDestinationPath,
    backupStorageRelativePath,
    type IMebProfileDraft,
    type IMebScheduleDraft,
} from "./EnterpriseBackupProfileMapping.js";
import { mebScheduleIntervalMaximum } from "./EnterpriseBackupValidation.js";

export type MebProfileDialogTab = "contents" | "schedule" | "storage" | "options" | "comments";

export interface IEnterpriseBackupProfileEditorProps {
    activeTab: MebProfileDialogTab;
    backupHomePath: string;
    draft: IMebProfileDraft;
    tableFilterError?: string;
    onChange: (patch: Partial<IMebProfileDraft>) => void;
    onTabChange: (tab: MebProfileDialogTab) => void;
}

interface IProfileScheduleProps {
    caption: string;
    incremental?: boolean;
    schedule: IMebScheduleDraft;
    onChange: (patch: Partial<IMebScheduleDraft>) => void;
}

const ProfileSchedule = (props: IProfileScheduleProps): ComponentChild => {
    const { caption, incremental, schedule, onChange } = props;
    const maximumInterval = mebScheduleIntervalMaximum(schedule.frequency);
    const updateNumber = (
        field: "interval" | "hour" | "minute",
        value: string,
        minimum: number,
        maximum: number,
    ): void => {
        const digits = value.replace(/\D/g, "");
        const numberValue = Math.min(maximum, Math.max(minimum, Number.parseInt(digits || String(minimum), 10)));
        onChange({ [field]: String(numberValue) });
    };
    const timeInput = (field: "hour" | "minute", maximum: number): ComponentChild => {
        const caption = field === "hour" ? "Hour" : "Minute";

        return <Input
            aria-label={caption}
            className="enterpriseBackupScheduleTimeInput"
            data-tooltip={`Accepted values for ${field}: 0–${maximum}`}
            value={schedule[field]}
            disabled={!schedule.enabled}
            onChange={(_event, data) => {
                updateNumber(field, data.value, 0, maximum);
            }}
        />;
    };

    return <section className="enterpriseBackupScheduleGroup">
        <Checkbox
            caption={caption}
            checkState={schedule.enabled ? CheckState.Checked : CheckState.Unchecked}
            onChange={(state) => {
                onChange({ enabled: state === CheckState.Checked });
            }}
        />
        <Frame className={incremental
            ? "enterpriseBackupScheduleFrame enterpriseBackupIncrementalScheduleFrame"
            : "enterpriseBackupScheduleFrame"}
        >
            <div className="enterpriseBackupScheduleSentence">
                <span>every</span>
                <Input
                    aria-label="Interval"
                    className="enterpriseBackupScheduleInterval"
                    data-tooltip={`Accepted values for interval: 1–${maximumInterval}`}
                    disabled={!schedule.enabled}
                    value={schedule.interval}
                    onChange={(_event, data) => {
                        updateNumber("interval", data.value, 1, maximumInterval);
                    }}
                />
                <select
                    aria-label="Frequency"
                    value={schedule.frequency}
                    disabled={!schedule.enabled}
                    onInput={(event) => {
                        onChange({ frequency: (event.target as HTMLSelectElement).value });
                    }}
                >
                    <option value="0">Hour(s)</option>
                    <option value="1">Day(s)</option>
                    <option value="2">Week(s)</option>
                    <option value="3">Month(s)</option>
                </select>
                {schedule.frequency === "0" && <><span>at minute</span>{timeInput("minute", 59)}</>}
                {schedule.frequency === "1" && <>
                    <span>at</span>{timeInput("hour", 23)}<span>:</span>{timeInput("minute", 59)}
                </>}
                {schedule.frequency === "2" && <>
                    <span>on</span>
                    <div className="enterpriseBackupWeekDays">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => {
                            return <Checkbox
                                key={day}
                                caption={day}
                                disabled={!schedule.enabled}
                                checkState={schedule.weekDays[index] ? CheckState.Checked : CheckState.Unchecked}
                                onChange={(state) => {
                                    const weekDays = [...schedule.weekDays];
                                    weekDays[index] = state === CheckState.Checked;
                                    onChange({ weekDays });
                                }}
                            />;
                        })}
                    </div>
                    <span>at</span>{timeInput("hour", 23)}<span>:</span>{timeInput("minute", 59)}
                </>}
                {schedule.frequency === "3" && <>
                    <span>on days</span>
                    <MonthDayPicker
                        aria-label="Days of month"
                        selectedDays={schedule.monthDays}
                        disabled={!schedule.enabled}
                        onChange={(monthDays) => {
                            onChange({ monthDays });
                        }}
                    />
                    <span>at</span>{timeInput("hour", 23)}<span>:</span>{timeInput("minute", 59)}
                </>}
            </div>
        </Frame>
    </section>;
};

const tabContent = (content: ComponentChildren, className?: string): ComponentChild => {
    return <div
        className={["enterpriseBackupProfileTabContent", className].filter(Boolean).join(" ")}
    >{content}</div>;
};

export const EnterpriseBackupProfileEditor = (props: IEnterpriseBackupProfileEditorProps): ComponentChild => {
    const { activeTab, backupHomePath, draft, tableFilterError, onChange, onTabChange } = props;
    const updateSchedule = (field: "fullSchedule" | "incSchedule", patch: Partial<IMebScheduleDraft>): void => {
        onChange({ [field]: { ...draft[field], ...patch } });
    };
    const contents = <>
        <Radiobutton name="enterpriseBackupContentMode" caption="Backup all contents of this MySQL instance"
            checkState={draft.partialMode === "full" ? CheckState.Checked : CheckState.Unchecked}
            onChange={() => {
                onChange({ partialMode: "full", usingTts: "0" });
            }} />
        <p className="enterpriseBackupContentModeHelp">
            Full backups include the whole MySQL instance and are the safest base for restore, point-in-time
            recovery, and later incremental backups. Server metadata and system tables are included as part
            of the instance backup.
        </p>
        <Radiobutton name="enterpriseBackupContentMode" caption="Select objects to be included/excluded"
            checkState={draft.partialMode === "filters" ? CheckState.Checked : CheckState.Unchecked}
            onChange={() => {
                onChange({ partialMode: "filters" });
            }} />
        <p className="enterpriseBackupContentModeHelp">
            Partial backups include only matching objects. They are useful for focused data protection, but
            they are not a complete instance backup. System tables are not added automatically; include them
            only when the selected restore workflow requires them.
        </p>
        {draft.partialMode !== "full" && <section className="enterpriseBackupPartialControls">
            <Frame className="enterpriseBackupObjectFilterFrame">
                <label><span>Tables to Include</span><Input value={draft.includeTables} spellCheck={false}
                    onChange={(_event, data) => {
                        onChange({ includeTables: data.value });
                    }} /></label>
                <label><span>Tables to Exclude</span><Input value={draft.excludeTables} spellCheck={false}
                    onChange={(_event, data) => {
                        onChange({ excludeTables: data.value });
                    }} /></label>
                {tableFilterError && <div className="enterpriseBackupInlineError">{tableFilterError}</div>}
                <p>Use regexes matched against fully qualified table names,
                    for example <code>^sales\.orders$</code> or <code>^sales\.</code><br />
                    Include is applied first; exclude removes matching tables from that set.</p>
            </Frame>
        </section>}
        <section className="enterpriseBackupTtsControls"><label>
            <span className="enterpriseBackupFieldCaptionRow"><span>Use Transportable Tablespaces</span></span>
            <select value={draft.usingTts} onInput={(event) => {
                onChange({
                    usingTts: (event.target as HTMLSelectElement).value as IMebBackupProfileInfo["usingTts"],
                });
            }}>
                <option value="0">No</option><option value="1">Yes, with minimal locking</option>
                <option value="2">Yes, with full locking</option>
            </select>
            <p>Non-TTS table-level restores require matching target tables to already exist. Enable TTS
                when selected tables must be restored into a target where those tables do not already
                exist. <LearnMore url="https://dev.mysql.com/doc/mysql-enterprise-backup/en/restore-use-tts.html" /></p>
        </label></section>
    </>;
    const storagePath = backupStorageRelativePath(backupHomePath, draft.destination);
    const storageFullPath = storagePath ? backupStorageDestinationPath(backupHomePath, storagePath) : backupHomePath;
    const storage = <section className="enterpriseBackupStorageTabLayout">
        <section className="enterpriseBackupBackupPathFrame"><label>
            <span>Backup Storage Directory (in backup home)</span>
            <Input value={storagePath} spellCheck={false} onChange={(_event, data) => {
                onChange({
                    destination: backupStorageDestinationPath(backupHomePath, data.value), storageType: "local",
                });
            }} />
            <span className="enterpriseBackupStorageFullPath" title={storageFullPath}>
                Full path: {storageFullPath || "Not configured"}
            </span>
        </label></section>
        <p className="enterpriseBackupStorageNote">Backups are written in the specified backup storage directory. A
            timestamped subdirectory is created for each backup.</p>
    </section>;
    const compression = <>
        <Checkbox caption="Compress backup (non-incremental InnoDB backups only)"
            checkState={draft.compress ? CheckState.Checked : CheckState.Unchecked}
            onChange={(state) => {
                onChange({ compress: state === CheckState.Checked });
            }} />
        <Frame className="enterpriseBackupCompressionFrame"><div className="enterpriseBackupOptionPair">
            <span>Method:</span><label><select value={draft.compressMethod} disabled={!draft.compress}
                onInput={(event) => {
                    onChange({ compressMethod: (event.target as HTMLSelectElement).value });
                }}>
                <option value="lz4">lz4</option><option value="lzma">lzma</option><option value="zlib">zlib</option>
            </select></label>
            <span>Level:</span><label><select value={draft.compressLevel}
                disabled={!draft.compress || draft.compressMethod === "lz4"}
                onInput={(event) => {
                    onChange({ compressLevel: (event.target as HTMLSelectElement).value });
                }}>
                {Array.from({ length: 9 }, (_, index) => {
                    return <option key={index + 1} value={index + 1}>{index + 1}</option>;
                })}
            </select></label>
        </div></Frame>
    </>;
    const options = <>{compression}<hr className="enterpriseBackupOptionsSeparator" />
        <section className="enterpriseBackupOptionsGroup">
            <Checkbox caption="Apply log after backup (backup-and-apply-log)"
                checkState={draft.applyLog ? CheckState.Checked : CheckState.Unchecked}
                onChange={(state) => {
                    onChange({ applyLog: state === CheckState.Checked });
                }} />
            <p className="enterpriseBackupOptionHelp">After a backup is done, an apply-log operation is needed before
                it can be recovered. That may be done right after backup, before recovery, or at any other time.</p>
            <Checkbox caption="Skip Unused Pages"
                checkState={draft.skipUnusedPages ? CheckState.Checked : CheckState.Unchecked}
                onChange={(state) => {
                    onChange({ skipUnusedPages: state === CheckState.Checked });
                }} />
            <p className="enterpriseBackupOptionHelp">Use this option to reduce backup size by removing unused pages
                usually generated by bulk deletes. It can increase restore time because removed unused pages must be
                added back.</p>
        </section><hr className="enterpriseBackupOptionsSeparator" />
        <section className="enterpriseBackupOptionsGroup"><label><span>Incremental Backup Base</span>
            <select value={draft.incrementalBase} onInput={(event) => {
                const value = (event.target as HTMLSelectElement).value;
                if (value === "history:last_backup" || value === "history:last_full_backup") {
                    onChange({ incrementalBase: value });
                }
            }}><option value="history:last_backup">Last backup</option>
                <option value="history:last_full_backup">Last full backup</option></select>
        </label>
        <p className="enterpriseBackupOptionHelp">Select whether incremental backups are based on the latest backup,
            full or incremental, or always on the latest full backup.</p>
        <Checkbox caption="Incremental Backups Using Only the Redo Log"
            checkState={draft.incrementalWithRedoLogOnly ? CheckState.Checked : CheckState.Unchecked}
            onChange={(state) => {
                onChange({ incrementalWithRedoLogOnly: state === CheckState.Checked });
            }} />
        <p className="enterpriseBackupOptionHelp">Specifies that an incremental backup is created using only the redo
            log.</p></section>
    </>;
    const comments = <label className="enterpriseBackupCommentsField"><span>Comments</span><textarea
        value={draft.comments} onInput={(event) => {
            onChange({ comments: (event.target as HTMLTextAreaElement).value });
        }}
    /></label>;
    const profileType = draft.partialMode === "full" ? "Full Data"
        : draft.usingTts !== "0" ? "TTS Partial Data" : "Partial Data";
    const scheduleType = draft.fullSchedule.enabled && draft.incSchedule.enabled ? "Full + Incremental"
        : draft.fullSchedule.enabled ? "Full Only" : draft.incSchedule.enabled ? "Incr. Only" : "Not Scheduled";
    const pages: ITabviewPage[] = [
        { id: "contents", caption: "Contents", content: tabContent(contents, "enterpriseBackupContentsTabContent") },
        { id: "schedule", caption: "Schedule", content: tabContent(<>
            <ProfileSchedule caption="Perform full backups" schedule={draft.fullSchedule}
                onChange={(patch) => {
                    updateSchedule("fullSchedule", patch);
                }} />
            <ProfileSchedule caption="Perform incremental backups" incremental schedule={draft.incSchedule}
                onChange={(patch) => {
                    updateSchedule("incSchedule", patch);
                }} />
        </>) },
        { id: "storage", caption: "Storage", content: tabContent(storage, "enterpriseBackupStorageTabContent") },
        { id: "options", caption: "Options", content: tabContent(options) },
        { id: "comments", caption: "Comments", content: tabContent(comments) },
    ];

    return <div className="enterpriseBackupProfileContent">
        <div className="enterpriseBackupProfileHeaderFields"><label><span>Backup Profile Name</span>
            <Input value={draft.label} spellCheck={false}
                onChange={(_event, data) => {
                    onChange({ label: data.value });
                }} />
        </label><div className="enterpriseBackupProfileSummaries">
            <div className="enterpriseBackupProfileTypeSummary">
                <span>Backup type</span><strong>{profileType}</strong>
            </div>
            <div className="enterpriseBackupProfileTypeSummary">
                <span>Scheduling</span><strong>{scheduleType}</strong>
            </div>
            <div className="enterpriseBackupProfileTypeSummary"><span>Backup directory</span>
                <strong title={storagePath || "."}>{storagePath || "."}</strong></div>
        </div></div>
        <Tabview className="enterpriseBackupProfileTabview" selectedId={activeTab} pages={pages}
            contentSeparatorWidth={1} onSelectTab={(id) => {
                onTabChange(id as MebProfileDialogTab);
            }} />
    </div>;
};
