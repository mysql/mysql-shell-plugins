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

const { spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const { join } = require("node:path");

const powerShellExecutables = ["pwsh", "powershell.exe"];
const privateSignerPath = join(__dirname, "windows_sign_private.cjs");

const findPowerShell = (run = spawnSync) => {
    for (const executable of powerShellExecutables) {
        const result = run(executable, [
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "exit 0",
        ], {
            stdio: "ignore",
        });

        if (result.status === 0) {
            return executable;
        }
    }

    throw new Error(
        `PowerShell executable not found: tried ${powerShellExecutables.join(" and ")}`,
    );
};

const getSignatureStatus = (path, powershell, run = spawnSync) => {
    const encodedPath = Buffer.from(path, "utf8").toString("base64");
    const script = [
        `$path = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("${encodedPath}"))`,
        "$signature = Get-AuthenticodeSignature -LiteralPath $path",
        "[Console]::Out.Write([string]$signature.Status)",
    ].join("; ");
    const encodedCommand = Buffer.from(script, "utf16le").toString("base64");
    const result = run(powershell, [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        encodedCommand,
    ], {
        encoding: "utf8",
    });

    if (result.status !== 0) {
        throw new Error(
            `Could not inspect Authenticode signature for ${path}: ${result.stderr.trim()}`,
        );
    }

    const status = result.stdout.trim();
    if (!status) {
        throw new Error(`PowerShell returned no Authenticode status for ${path}`);
    }

    return status;
};

const loadPrivateSigner = () => {
    if (!existsSync(privateSignerPath)) {
        throw new Error(`Private Windows signer not found: ${privateSignerPath}`);
    }

    const signer = require(privateSignerPath);
    if (typeof signer !== "function") {
        throw new Error(`Private Windows signer must export a function: ${privateSignerPath}`);
    }

    return signer;
};

const sign = async (configuration, packager, dependencies = {}) => {
    const inspect = dependencies.getSignatureStatus ?? ((path) =>
        getSignatureStatus(path, findPowerShell()));
    const loadSigner = dependencies.loadPrivateSigner ?? loadPrivateSigner;
    const mockSigning = dependencies.mockSigning
        ?? process.env.MYSQL_WORKBENCH_MOCK_SIGNING === "1";
    const log = dependencies.log ?? console.log;
    const status = inspect(configuration.path);

    if (status === "Valid") {
        log(`[SIGN SKIP] status=Valid file=${configuration.path}`);
        return;
    }

    if (status !== "NotSigned") {
        throw new Error(
            `Unexpected Authenticode status '${status}' for ${configuration.path}`,
        );
    }

    if (mockSigning) {
        log(`[MOCK SIGN] status=NotSigned hash=${configuration.hash} file=${configuration.path}`);
        return;
    }

    log(`[SIGN] hash=${configuration.hash} file=${configuration.path}`);
    await loadSigner()(configuration, packager);
};

sign.findPowerShell = findPowerShell;
sign.getSignatureStatus = getSignatureStatus;
module.exports = sign;
