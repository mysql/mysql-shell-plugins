/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms,
 * as designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have either included with
 * the program or referenced in the documentation.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    LegacyConfigurationImportPanel,
} from "../../../app-logic/LegacyConfigurationImport/LegacyConfigurationImportPanel.js";
import type {
    ILegacyConfigurationImportDiscovery,
    ILegacyConfigurationImportReport,
} from "../../../app-logic/LegacyConfigurationImport/LegacyConfigurationImportTypes.js";
import { ProfileState } from "../../../supplement/ProfileState.js";
import { ShellInterface } from "../../../supplement/ShellInterface/ShellInterface.js";
import { webSession } from "../../../supplement/WebSession.js";

const discovery: ILegacyConfigurationImportDiscovery = {
    workbench: {
        connectionCount: 2,
        connectionsPending: true,
        issues: [],
    },
    vscode: {
        connectionCount: 3,
        profileCount: 2,
        logFileCount: 1,
        connectionsPending: true,
        issues: [],
    },
    projects: {
        sources: [{
            id: "vscode-extension",
            label: "VS Code",
            projectCount: 1,
            copyPending: true,
            issueCount: 0,
        }],
        sshKeyCount: 0,
        issues: [],
    },
};

const workbenchReport: ILegacyConfigurationImportReport = {
    phase: "workbenchConnections",
    imported: 2,
    merged: 0,
    skipped: 0,
    warnings: [],
    failed: [],
};

describe("LegacyConfigurationImportPanel", () => {
    beforeEach(() => {
        vi.spyOn(ProfileState, "get").mockReturnValue(false);
        vi.spyOn(ProfileState, "saveState").mockImplementation(() => { /**/ });
    });

    afterEach(() => {
        cleanup();
        window.sessionStorage.clear();
        vi.restoreAllMocks();
    });

    it("summarizes actionable data on the home screen", async () => {
        vi.spyOn(ShellInterface.legacy, "discover").mockResolvedValue(discovery);

        render(<LegacyConfigurationImportPanel onConnectionsImported={vi.fn()} />);

        expect(await screen.findByText(
            "Configuration data from previous MySQL applications is ready to be imported.",
        )).toBeTruthy();
        expect(screen.getByText("2 connections")).toBeTruthy();
        expect(screen.getByText("3 connections in 2 profiles")).toBeTruthy();
        expect(screen.getByText("1 project")).toBeTruthy();
        expect(screen.getByText("Review and Import…")).toBeTruthy();
    });

    it("counts each Migration Assistant issue once", async () => {
        vi.spyOn(ShellInterface.legacy, "discover").mockResolvedValue({
            projects: {
                sources: [{
                    id: "vscode-extension",
                    label: "VS Code",
                    projectCount: 0,
                    copyPending: true,
                    issueCount: 1,
                }],
                sshKeyCount: 0,
                issues: [{
                    item: "vscode-extension: invalid-project",
                    message: "Project data.json is malformed",
                }],
            },
        });

        render(<LegacyConfigurationImportPanel onConnectionsImported={vi.fn()} />);

        expect(await screen.findByText("1 item needs attention")).toBeTruthy();
        expect(screen.queryByText("2 items need attention")).toBeNull();
    });

    it("persists the panel dismissal across application restarts", async () => {
        const getProfileState = vi.spyOn(ProfileState, "get");
        const saveProfileState = vi.spyOn(ProfileState, "saveState");
        const setProfileState = vi.spyOn(ProfileState, "set");
        const discover = vi.spyOn(
            ShellInterface.legacy,
            "discover",
        ).mockResolvedValue(discovery);
        const first = render(<LegacyConfigurationImportPanel onConnectionsImported={vi.fn()} />);

        expect(await screen.findByText(
            "Configuration data from previous MySQL applications is ready to be imported.",
        )).toBeTruthy();
        fireEvent.click(document.getElementById("dismissLegacyConfigurationImportPanel")!);

        await waitFor(() => {
            expect(screen.queryByText(
                "Configuration data from previous MySQL applications is ready to be imported.",
            )).toBeNull();
        });
        expect(screen.queryByText(
            "Configuration data from previous MySQL applications is ready to be imported.",
        )).toBeNull();
        expect(setProfileState).toHaveBeenCalledWith(
            "dbEditor.connectionBrowser.configurationImport.dismissed",
            true,
        );
        expect(saveProfileState).toHaveBeenCalledWith(true);

        first.unmount();
        getProfileState.mockReturnValue(true);
        render(<LegacyConfigurationImportPanel onConnectionsImported={vi.fn()} />);

        await waitFor(() => {
            expect(discover).toHaveBeenCalledTimes(2);
        });
        expect(screen.queryByText(
            "Configuration data from previous MySQL applications is ready to be imported.",
        )).toBeNull();
    });

    it("imports every relevant source and refreshes connections", async () => {
        vi.spyOn(webSession, "currentProfileId", "get").mockReturnValue(17);
        vi.spyOn(ShellInterface.legacy, "discover").mockResolvedValue(discovery);
        const importWorkbench = vi.spyOn(
            ShellInterface.legacy,
            "importDiscoveredWorkbenchConnections",
        ).mockResolvedValue(workbenchReport);
        const importVsCode = vi.spyOn(
            ShellInterface.legacy,
            "importVsCode",
        ).mockResolvedValue([]);
        const importMigrationAssistantProjects = vi.spyOn(
            ShellInterface.legacy,
            "importMigrationAssistantProjects",
        ).mockResolvedValue([]);
        const onConnectionsImported = vi.fn();
        render(<LegacyConfigurationImportPanel onConnectionsImported={onConnectionsImported} />);

        fireEvent.click(await screen.findByText("Review and Import…"));
        fireEvent.click(await screen.findByText("Next >"));
        expect(await screen.findByText("Import MySQL Shell for VS Code Connections")).toBeTruthy();
        fireEvent.click(screen.getByText("Next >"));
        expect(await screen.findByText("Import Migration Assistant Projects")).toBeTruthy();
        fireEvent.click(screen.getByText("Next >"));
        fireEvent.click(await screen.findByText("Import"));

        expect(await screen.findByText("Import results")).toBeTruthy();
        expect(importWorkbench).toHaveBeenCalledWith(17);
        expect(importVsCode).toHaveBeenCalledWith(17);
        expect(importMigrationAssistantProjects).toHaveBeenCalledWith({
            sourceIds: ["vscode-extension"],
            deleteSources: true,
            copySshKeys: true,
            deleteSshKeys: true,
        });
        expect(onConnectionsImported).toHaveBeenCalledOnce();
    });

    it("keeps a failed connection phase active and does not run later sources", async () => {
        vi.spyOn(webSession, "currentProfileId", "get").mockReturnValue(17);
        vi.spyOn(ShellInterface.legacy, "discover").mockResolvedValue(discovery);
        vi.spyOn(
            ShellInterface.legacy,
            "importDiscoveredWorkbenchConnections",
        ).mockRejectedValue(new Error("Workbench import failed."));
        const importVsCode = vi.spyOn(
            ShellInterface.legacy,
            "importVsCode",
        ).mockResolvedValue([]);
        const importMigrationAssistantProjects = vi.spyOn(
            ShellInterface.legacy,
            "importMigrationAssistantProjects",
        ).mockResolvedValue([]);
        render(<LegacyConfigurationImportPanel onConnectionsImported={vi.fn()} />);

        fireEvent.click(await screen.findByText("Review and Import…"));
        fireEvent.click(await screen.findByText("Next >"));
        fireEvent.click(await screen.findByText("Next >"));
        fireEvent.click(await screen.findByText("Next >"));
        fireEvent.click(await screen.findByText("Import"));

        expect(await screen.findByText("Workbench import failed.")).toBeTruthy();
        expect(screen.getByText("Import results")).toBeTruthy();
        expect(importVsCode).not.toHaveBeenCalled();
        expect(importMigrationAssistantProjects).not.toHaveBeenCalled();
    });

    it("keeps the wizard open for results after the final source is imported", async () => {
        vi.spyOn(webSession, "currentProfileId", "get").mockReturnValue(17);
        vi.spyOn(ShellInterface.legacy, "discover")
            .mockResolvedValueOnce({ workbench: discovery.workbench })
            .mockResolvedValueOnce({});
        vi.spyOn(
            ShellInterface.legacy,
            "importDiscoveredWorkbenchConnections",
        ).mockResolvedValue(workbenchReport);
        render(<LegacyConfigurationImportPanel onConnectionsImported={vi.fn()} />);

        fireEvent.click(await screen.findByText("Review and Import…"));
        fireEvent.click(await screen.findByText("Next >"));
        fireEvent.click(await screen.findByText("Import"));

        expect(await screen.findByText("Import results")).toBeTruthy();
        expect(screen.getByText("2 imported, 0 merged, 0 skipped")).toBeTruthy();
    });

    it("does not rediscover away a source with report failures", async () => {
        vi.spyOn(webSession, "currentProfileId", "get").mockReturnValue(17);
        const discover = vi.spyOn(ShellInterface.legacy, "discover")
            .mockResolvedValueOnce({ workbench: discovery.workbench })
            .mockResolvedValueOnce({});
        vi.spyOn(
            ShellInterface.legacy,
            "importDiscoveredWorkbenchConnections",
        ).mockResolvedValue({
            ...workbenchReport,
            failed: [{
                item: "connections.xml",
                message: "The connection file could not be imported.",
            }],
        });
        render(<LegacyConfigurationImportPanel onConnectionsImported={vi.fn()} />);

        fireEvent.click(await screen.findByText("Review and Import…"));
        fireEvent.click(await screen.findByText("Next >"));
        fireEvent.click(await screen.findByText("Import"));

        expect(await screen.findByText(
            "connections.xml: The connection file could not be imported.",
        )).toBeTruthy();
        expect(screen.getByText("Import results")).toBeTruthy();
        expect(discover).toHaveBeenCalledOnce();
    });

    it("offers an inline retry when discovery fails", async () => {
        const discover = vi.spyOn(ShellInterface.legacy, "discover")
            .mockRejectedValueOnce(new Error("Discovery failed."))
            .mockResolvedValue(discovery);
        render(<LegacyConfigurationImportPanel onConnectionsImported={vi.fn()} />);

        expect(await screen.findByText(/Discovery failed/)).toBeTruthy();
        fireEvent.click(screen.getByText("Retry"));

        await waitFor(() => {
            expect(discover).toHaveBeenCalledTimes(2);
            expect(screen.getByText("Review and Import…")).toBeTruthy();
        });
    });

    it("stays hidden when no import work is available", async () => {
        const discover = vi.spyOn(ShellInterface.legacy, "discover").mockResolvedValue({});
        render(<LegacyConfigurationImportPanel onConnectionsImported={vi.fn()} />);

        await waitFor(() => {
            expect(discover).toHaveBeenCalledOnce();
        });
        expect(screen.queryByText(
            "Configuration data from previous MySQL applications is ready to be imported.",
        )).toBeNull();
    });
});
