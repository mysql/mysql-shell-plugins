/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 */

import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { EnterpriseBackupValidationStatus } from "../../../../modules/db-editor/EnterpriseBackupValidationStatus.js";

afterEach(() => {
    cleanup();
});

describe("EnterpriseBackupValidationStatus", () => {
    it.each([
        ["ok", "Backup home is ready.", "pass-filled"],
        ["warn", "Backup home is invalid.", "warning"],
        ["info", "Checking backup home.", "info"],
    ] as const)("renders the %s status message with its %s icon", (tone, message, icon) => {
        const { container } = render(<EnterpriseBackupValidationStatus status={{ message, tone }} />);

        expect(screen.getByText(message)).toBeTruthy();
        expect(container.querySelector(`.enterpriseBackupValidation.${tone}`)).toBeTruthy();
        expect(container.querySelector(`.codicon-${icon}`)).toBeTruthy();
    });

    it("renders custom content instead of the status message", () => {
        render(<EnterpriseBackupValidationStatus status={{ tone: "warn", message: "Invalid" }}>
            Custom status
        </EnterpriseBackupValidationStatus>);

        expect(screen.getByText("Custom status")).toBeTruthy();
        expect(screen.queryByText("Invalid")).toBeNull();
    });
});
