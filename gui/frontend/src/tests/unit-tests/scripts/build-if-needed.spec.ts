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
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const spawnSyncMock = vi.hoisted(() => {
    return vi.fn();
});

vi.mock("child_process", async (importOriginal) => {
    const actual = await importOriginal<typeof import("child_process")>();

    return {
        ...actual,
        default: { ...actual, spawnSync: spawnSyncMock },
        spawnSync: spawnSyncMock,
    };
});

vi.mock("fs", async (importOriginal) => {
    const actual = await importOriginal<typeof import("fs")>();
    const existsSync = () => {
        return false;
    };

    return {
        ...actual,
        default: { ...actual, existsSync },
        existsSync,
        readdirSync: vi.fn(),
        statSync: vi.fn(),
    };
});

vi.mock("os", async (importOriginal) => {
    const actual = await importOriginal<typeof import("os")>();
    const platform = () => {
        return "win32" as const;
    };

    return {
        ...actual,
        default: { ...actual, platform },
        platform,
    };
});

describe("build-if-needed", () => {
    beforeEach(() => {
        spawnSyncMock.mockReset();
        spawnSyncMock.mockReturnValue({ status: 0 });
        vi.resetModules();
    });

    it("prefers PowerShell 7 when pwsh is available", async () => {
        await import("../../../../scripts/build-if-needed.js");

        expect(spawnSyncMock).toHaveBeenNthCalledWith(1, "pwsh", [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "exit 0",
        ], {
            stdio: "ignore",
        });
        expect(spawnSyncMock.mock.calls[1][0]).toBe(
            "pwsh -NoLogo -NoProfile -NonInteractive -File scripts/production-build.ps1"
            + " && tsc -p tsconfig.json");
    });

    it("falls back to Windows PowerShell when pwsh is unavailable", async () => {
        spawnSyncMock
            .mockReturnValueOnce({ status: null })
            .mockReturnValue({ status: 0 });

        await import("../../../../scripts/build-if-needed.js");

        expect(spawnSyncMock).toHaveBeenNthCalledWith(2, "powershell.exe", [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "exit 0",
        ], {
            stdio: "ignore",
        });
        expect(spawnSyncMock.mock.calls[2][0]).toBe(
            "powershell.exe -NoLogo -NoProfile -NonInteractive -File scripts/production-build.ps1"
            + " && tsc -p tsconfig.json");
    });
});
