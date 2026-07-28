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
import { afterEach, describe, expect, it, vi } from "vitest";

import {
    LegacyConfigurationImportWizard,
} from "../../../app-logic/LegacyConfigurationImport/LegacyConfigurationImportWizard.js";
import type {
    ILegacyConfigurationImportDiscovery,
    ILegacyConfigurationImportReport,
    ILegacyConfigurationImportWizardProperties,
} from "../../../app-logic/LegacyConfigurationImport/LegacyConfigurationImportTypes.js";

const allSources: ILegacyConfigurationImportDiscovery = {
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
            projectCount: 5,
            copyPending: true,
            issueCount: 0,
        }],
        sshKeyCount: 2,
        issues: [],
    },
};

const renderWizard = (
    discovery: ILegacyConfigurationImportDiscovery,
    overrides: Partial<ILegacyConfigurationImportWizardProperties> = {},
) => {
    const properties: ILegacyConfigurationImportWizardProperties = {
        discovery,
        onRunPage: vi.fn().mockResolvedValue([]),
        onClose: vi.fn(),
        ...overrides,
    };

    return {
        ...render(<LegacyConfigurationImportWizard {...properties} />),
        properties,
    };
};

const advanceAllPages = async (): Promise<void> => {
    fireEvent.click(await screen.findByText("Next >"));
    fireEvent.click(await screen.findByText("Next >"));
    fireEvent.click(await screen.findByText("Next >"));
};

describe("LegacyConfigurationImportWizard", () => {
    afterEach(() => {
        cleanup();
    });

    it("collects source choices before importing them in order", async () => {
        const onRunPage = vi.fn().mockResolvedValue([]);
        renderWizard(allSources, { onRunPage });

        expect(await screen.findByText("Import MySQL Workbench 8 Connections")).toBeTruthy();
        expect(screen.getByText("2 connection definitions were found.")).toBeTruthy();
        fireEvent.click(screen.getByText("Next >"));

        expect(await screen.findByText("Import MySQL Shell for VS Code Connections")).toBeTruthy();
        expect(screen.getByText("3 connection definitions were found.")).toBeTruthy();
        fireEvent.click(screen.getByText("Next >"));

        expect(await screen.findByText("Import Migration Assistant Projects")).toBeTruthy();
        expect(screen.getByText("5 migration assistant projects were found.")).toBeTruthy();
        expect(screen.getByText("2 SSH keys for OCI jump host instances were found.")).toBeTruthy();
        fireEvent.click(screen.getByText("Next >"));

        expect(await screen.findByText("Import Summary")).toBeTruthy();
        expect(onRunPage).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText("Import"));

        await waitFor(() => {
            expect(onRunPage).toHaveBeenNthCalledWith(
                1,
                "workbench",
                expect.any(Object),
            );
            expect(onRunPage).toHaveBeenNthCalledWith(
                2,
                "vscode",
                expect.any(Object),
            );
            expect(onRunPage).toHaveBeenNthCalledWith(
                3,
                "projects",
                expect.any(Object),
            );
        });
        expect(await screen.findByText("Import results")).toBeTruthy();
    });

    it("allows revising source inclusion before importing", async () => {
        renderWizard(allSources);

        fireEvent.click(await screen.findByText("Next >"));
        fireEvent.click(screen.getByText("Import MySQL Shell for VS Code data"));
        fireEvent.click(screen.getByText("< Back"));
        fireEvent.click(screen.getByText("Next >"));
        fireEvent.click(screen.getByText("Next >"));
        fireEvent.click(screen.getByText("Next >"));

        expect(await screen.findByText("Import Summary")).toBeTruthy();
        expect(screen.queryByText(
            "Import 3 MySQL Shell for VS Code connection definitions",
        )).toBeNull();
        expect(screen.getByText("Import 2 MySQL Workbench 8 connection definitions")).toBeTruthy();
    });

    it("shows a no-op page when no source is selected", async () => {
        const onRunPage = vi.fn().mockResolvedValue([]);
        renderWizard(allSources, { onRunPage });

        fireEvent.click(await screen.findByText("Import MySQL Workbench 8 connections"));
        fireEvent.click(screen.getByText("Next >"));
        fireEvent.click(await screen.findByText("Import MySQL Shell for VS Code data"));
        fireEvent.click(screen.getByText("Next >"));
        fireEvent.click(await screen.findByText("Import Migration Assistant projects and SSH keys"));
        fireEvent.click(screen.getByText("Next >"));

        expect(await screen.findByText("Nothing to import")).toBeTruthy();
        expect(screen.getByText("Close")).toBeTruthy();
        expect(screen.queryByText("Import")).toBeNull();
        expect(onRunPage).not.toHaveBeenCalled();
    });

    it("uses independent project and SSH cleanup choices", async () => {
        renderWizard({ projects: allSources.projects });

        const deleteProjects = await screen.findByText(
            "Delete original Migration Assistant project files",
        );
        const copyKeys = screen.getByText("Copy SSH keys for jump host instances");
        const deleteKeys = screen.getByText("Delete original SSH keys after copying");
        expect(deleteProjects.classList.contains("checked")).toBe(true);
        expect(copyKeys.classList.contains("checked")).toBe(true);
        expect(deleteKeys.classList.contains("checked")).toBe(true);

        fireEvent.click(copyKeys);
        expect(copyKeys.classList.contains("checked")).toBe(false);
        expect(deleteKeys.classList.contains("checked")).toBe(false);
        expect(deleteKeys.classList.contains("disabled")).toBe(true);

        fireEvent.click(copyKeys);
        expect(copyKeys.classList.contains("checked")).toBe(true);
        expect(deleteKeys.classList.contains("checked")).toBe(false);
    });

    it("explains password handling on connection pages", async () => {
        renderWizard(allSources);

        expect(await screen.findByText("Note: passwords will not be imported.")).toBeTruthy();
        fireEvent.click(screen.getByText("Next >"));

        expect(await screen.findByText(
            "Saved passwords remain available to both applications.",
        )).toBeTruthy();
        expect(screen.queryByText("Note: passwords will not be imported.")).toBeNull();
    });

    it("summarizes the selected copy and cleanup actions", async () => {
        renderWizard({ projects: allSources.projects });

        fireEvent.click(await screen.findByText("Next >"));

        expect(await screen.findByText("Import Summary")).toBeTruthy();
        expect(screen.getByText("Import 5 Migration Assistant projects")).toBeTruthy();
        expect(screen.getByText("Delete original Migration Assistant project files")).toBeTruthy();
        expect(screen.getByText("Copy 2 SSH keys for jump host instances")).toBeTruthy();
        expect(screen.getByText("Delete original SSH keys after copying")).toBeTruthy();
    });

    it("stops after a failed source and shows the results", async () => {
        const failedReport: ILegacyConfigurationImportReport = {
            phase: "workbenchConnections",
            imported: 0,
            merged: 0,
            skipped: 0,
            warnings: [],
            failed: [{
                item: "connections.xml",
                message: "The connection file could not be imported.",
            }],
        };
        const onRunPage = vi.fn().mockResolvedValueOnce([failedReport]);
        renderWizard(allSources, { onRunPage });
        await advanceAllPages();

        fireEvent.click(await screen.findByText("Import"));

        expect(await screen.findByText("Import results")).toBeTruthy();
        expect(screen.getByText(
            "connections.xml: The connection file could not be imported.",
        )).toBeTruthy();
        expect(onRunPage).toHaveBeenCalledTimes(1);
    });

    it("notifies the parent when import is cancelled", async () => {
        const onClose = vi.fn();
        renderWizard(allSources, { onClose });

        fireEvent.click(await screen.findByText("Cancel"));

        await waitFor(() => {
            expect(onClose).toHaveBeenCalledOnce();
            expect(onClose).toHaveBeenCalledWith(false);
        });
    });
});
