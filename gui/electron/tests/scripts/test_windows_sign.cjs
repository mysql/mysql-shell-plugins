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

const assert = require("node:assert/strict");
const test = require("node:test");

const sign = require("../../scripts/windows_sign.cjs");

const configuration = {
    path: "C:\\build\\MySQL Workbench.exe",
    hash: "sha256",
};

test("valid files are skipped", async () => {
    let privateSignerCalled = false;
    const messages = [];

    await sign(configuration, undefined, {
        getSignatureStatus: () => "Valid",
        loadPrivateSigner: () => async () => {
            privateSignerCalled = true;
        },
        mockSigning: false,
        log: (message) => messages.push(message),
    });

    assert.equal(privateSignerCalled, false);
    assert.deepEqual(messages, [
        `[SIGN SKIP] status=Valid file=${configuration.path}`,
    ]);
});

test("unsigned files are delegated to the private signer", async () => {
    const calls = [];
    const packager = {};

    await sign(configuration, packager, {
        getSignatureStatus: () => "NotSigned",
        loadPrivateSigner: () => async (signConfiguration, signPackager) => {
            calls.push([signConfiguration, signPackager]);
        },
        mockSigning: false,
        log: () => undefined,
    });

    assert.deepEqual(calls, [[configuration, packager]]);
});

test("unexpected signature statuses are rejected", async () => {
    await assert.rejects(
        sign(configuration, undefined, {
            getSignatureStatus: () => "HashMismatch",
            loadPrivateSigner: () => async () => undefined,
            mockSigning: false,
            log: () => undefined,
        }),
        /Unexpected Authenticode status 'HashMismatch'/,
    );
});

test("unsigned files are mock signed when requested", async () => {
    const messages = [];

    await sign(configuration, undefined, {
        getSignatureStatus: () => "NotSigned",
        loadPrivateSigner: () => {
            throw new Error("private signer should not be loaded");
        },
        mockSigning: true,
        log: (message) => messages.push(message),
    });

    assert.deepEqual(messages, [
        `[MOCK SIGN] status=NotSigned hash=${configuration.hash} file=${configuration.path}`,
    ]);
});

test("missing private signer is rejected", async () => {
    await assert.rejects(
        sign(configuration, undefined, {
            getSignatureStatus: () => "NotSigned",
            loadPrivateSigner: () => {
                throw new Error("Private Windows signer not found: test path");
            },
            mockSigning: false,
            log: () => undefined,
        }),
        /Private Windows signer not found: test path/,
    );
});

test("non-function private signer is rejected", async () => {
    await assert.rejects(
        sign(configuration, undefined, {
            getSignatureStatus: () => "NotSigned",
            loadPrivateSigner: () => {
                throw new Error("Private Windows signer must export a function: test path");
            },
            mockSigning: false,
            log: () => undefined,
        }),
        /Private Windows signer must export a function: test path/,
    );
});

test("private signer failures propagate", async () => {
    const failure = new Error("signing failed");

    await assert.rejects(
        sign(configuration, undefined, {
            getSignatureStatus: () => "NotSigned",
            loadPrivateSigner: () => async () => {
                throw failure;
            },
            mockSigning: false,
            log: () => undefined,
        }),
        failure,
    );
});

test("findPowerShell returns the first available executable", () => {
    const calls = [];
    const executable = sign.findPowerShell((command) => {
        calls.push(command);
        return { status: command === "powershell.exe" ? 0 : 1 };
    });

    assert.equal(executable, "powershell.exe");
    assert.deepEqual(calls, ["pwsh", "powershell.exe"]);
});

test("findPowerShell reports both unavailable executables", () => {
    assert.throws(
        () => sign.findPowerShell(() => ({ status: 1 })),
        /PowerShell executable not found: tried pwsh and powershell\.exe/,
    );
});

test("getSignatureStatus invokes PowerShell with an encoded inspection command", () => {
    let invocation;
    const status = sign.getSignatureStatus(configuration.path, "pwsh", (...args) => {
        invocation = args;
        return { status: 0, stdout: "Valid\r\n", stderr: "" };
    });
    const encodedCommand = invocation[1][invocation[1].indexOf("-EncodedCommand") + 1];
    const script = Buffer.from(encodedCommand, "base64").toString("utf16le");

    assert.equal(status, "Valid");
    assert.equal(invocation[0], "pwsh");
    assert.match(script, /Get-AuthenticodeSignature -LiteralPath/);
    assert.match(script, /FromBase64String/);
    assert.equal(script.includes(configuration.path), false);
    assert.match(script, /\[Console\]::Out\.Write\(\[string\]\$signature\.Status\)/);
});

test("getSignatureStatus rejects failed inspection", () => {
    assert.throws(
        () => sign.getSignatureStatus(configuration.path, "pwsh", () => ({
            status: 1,
            stdout: "",
            stderr: "access denied\n",
        })),
        /Could not inspect Authenticode signature.*access denied/,
    );
});

test("getSignatureStatus rejects empty inspection output", () => {
    assert.throws(
        () => sign.getSignatureStatus(configuration.path, "pwsh", () => ({
            status: 0,
            stdout: "",
            stderr: "",
        })),
        /PowerShell returned no Authenticode status/,
    );
});
