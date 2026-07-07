/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 */

import type { ComponentChild, ComponentChildren } from "preact";
import { useState } from "preact/hooks";

import { Codicon } from "../../components/ui/Codicon.js";
import { ErrorLabel } from "../../components/ui/ErrorLabel/ErrorLabel.js";
import { Icon } from "../../components/ui/Icon/Icon.js";
import type { IMebBackupContent } from "../../supplement/ShellInterface/ShellInterfaceMeb.js";

interface IEnterpriseBackupContentViewerProps {
    content?: IMebBackupContent;
}

export const EnterpriseBackupContentViewer = ({ content }: IEnterpriseBackupContentViewerProps): ComponentChild => {
    const [expandedSection, setExpandedSection] = useState<string | undefined>("restoreChain");
    if (content === undefined) {
        return <div className="enterpriseBackupEmptyState">No backup content loaded.</div>;
    }

    const binlogPosition = content.binlogFile && content.binlogPosition
        ? `${content.binlogFile}:${content.binlogPosition}`
        : content.binlogFile ?? content.binlogPosition ?? "--";
    const displayedFileGroups = content.fileGroups.filter((group) => {
        return group.category !== "Backup metadata";
    });
    const renderAccordionSection = (
        section: string,
        caption: string,
        sectionContent: ComponentChildren,
    ): ComponentChild => {
        const expanded = expandedSection === section;

        return <section
            key={section}
            className={`enterpriseBackupContentAccordionSection${expanded ? " expanded" : ""}`}
        >
            <button type="button" className="enterpriseBackupContentAccordionHeader" aria-expanded={expanded}
                onClick={() => {
                    setExpandedSection(expanded ? undefined : section);
                }}>
                <Icon src={expanded ? Codicon.ChevronDown : Codicon.ChevronRight} />
                <span>{caption}</span>
            </button>
            {expanded && <div className="enterpriseBackupContentAccordionBody">{sectionContent}</div>}
        </section>;
    };

    return <div className="enterpriseBackupContentViewer selectableText">
        {content.warnings.length > 0 && <div className="enterpriseBackupContentWarnings">
            {content.warnings.map((warning) => {
                return <ErrorLabel key={warning} type="warning">{warning}</ErrorLabel>;
            })}
        </div>}
        <dl className="enterpriseBackupContentFacts">
            <div><dt>Backup type</dt><dd>{content.backupScope ?? "--"}</dd></div>
            <div><dt>Server version at backup</dt><dd className="selectableText">
                {content.mysqlVersion ?? "--"}
            </dd></div>
            <div><dt>Start time</dt><dd className="selectableText">{content.startTime ?? "--"}</dd></div>
            <div><dt>End time</dt><dd className="selectableText">{content.endTime ?? "--"}</dd></div>
            <div><dt>Redo logs applied</dt><dd>{content.applyLogDone ? "Yes" : "No (pending)"}</dd></div>
            <div><dt>Binary log position</dt><dd className="selectableText">{binlogPosition}</dd></div>
            {content.gtidExecuted !== null && <div className="enterpriseBackupContentWideFact">
                <dt>GTID executed</dt><dd className="selectableText">{content.gtidExecuted}</dd>
            </div>}
        </dl>
        <div className="enterpriseBackupContentAccordion enterpriseBackupContentFileAccordion">
            {renderAccordionSection("restoreChain", `Restore chain (${content.restoreChain.length})`,
                <div className="enterpriseBackupContentRestoreChain"><table><thead><tr>
                    <th>Backup folder name</th><th>Type</th><th>Timestamp</th>
                </tr></thead><tbody>{content.restoreChain.map((backup) => {
                    return <tr key={`${backup.name}-${backup.timestamp ?? ""}`}>
                        <td className="selectableText">{backup.name}</td><td>{backup.type ?? "--"}</td>
                        <td className="selectableText">{backup.timestamp ?? "--"}</td>
                    </tr>;
                })}</tbody></table></div>)}
            {displayedFileGroups.length > 0 ? displayedFileGroups.map((group) => {
                return renderAccordionSection(
                    group.category,
                    `${group.category} (${group.fileCount === 1 ? "1 file" : `${group.fileCount} files`})`,
                    <dl className="enterpriseBackupContentFileGroup">
                        <div className="enterpriseBackupContentFileInfoRow">
                            {group.description}
                        </div><div className="enterpriseBackupContentFileList" role="list">{group.files.map((path) => {
                            return <div key={path} className="enterpriseBackupContentFilePath" role="listitem">
                                {path}
                            </div>;
                        })}</div></dl>,
                );
            }) : <div className="enterpriseBackupEmptyState">No file summary was found for this backup.</div>}
        </div>
    </div>;
};
