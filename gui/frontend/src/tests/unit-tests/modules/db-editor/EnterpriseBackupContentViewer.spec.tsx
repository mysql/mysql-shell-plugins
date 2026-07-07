/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { EnterpriseBackupContentViewer } from
    "../../../../modules/db-editor/EnterpriseBackupContentViewer.js";
import type { IMebBackupContent } from
    "../../../../supplement/ShellInterface/ShellInterfaceMeb.js";

afterEach(cleanup);

describe("EnterpriseBackupContentViewer", () => {
    it("renders backup facts and expands a file group", () => {
        const content: IMebBackupContent = {
            activityId: "backup-1",
            applyLogDone: true,
            backupHome: "/backups",
            backupLabel: "2026-07-20_12-00-00",
            backupScope: "Full",
            binlogFile: "binlog.000001",
            binlogPosition: "123",
            endTime: "2026-07-20 12:05:00",
            fileGroups: [{
                category: "Data files",
                description: "InnoDB data files",
                fileCount: 1,
                files: ["datadir/ibdata1"],
                sample: "datadir/ibdata1",
            }],
            gtidExecuted: "uuid:1-10",
            hasInstanceData: true,
            mysqlVersion: "8.4.0",
            restoreChain: [{
                name: "2026-07-20_12-00-00",
                timestamp: "2026-07-20 12:00:00",
                type: "Full",
            }],
            rows: [],
            startTime: "2026-07-20 12:00:00",
            warnings: [],
        };

        render(<EnterpriseBackupContentViewer content={content} />);

        expect(screen.getByText("binlog.000001:123")).toBeTruthy();
        expect(screen.getByText("2026-07-20_12-00-00")).toBeTruthy();

        fireEvent.click(screen.getByText("Data files (1 file)"));

        expect(screen.getByText("datadir/ibdata1")).toBeTruthy();
    });
});
