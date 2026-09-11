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

import { act, cleanup, fireEvent, render } from "@testing-library/preact";
import { createRef } from "preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DialogResponseClosure, type IDictionary } from "../../../../app-logic/general-types.js";
import { registerUiLayer } from "../../../../app-logic/UILayer.js";
import {
    type IMySQLConnectionOptions, MySQLConnectionScheme, MySQLSslMode,
} from "../../../../communication/MySQL.js";
import {
    CommonDialogValueOption, type IDialogValidations, type IDialogValues, ValueEditDialog,
} from "../../../../components/Dialogs/ValueEditDialog.js";
import { ConnectionEditor } from "../../../../modules/db-editor/ConnectionEditor.js";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface.js";
import { DBType, type IConnectionDetails } from "../../../../supplement/ShellInterface/index.js";
import { uiLayerMock } from "../../__mocks__/UILayerMock.js";

interface ITestableConnectionEditor {
    generateEditorConfig(path: string, details?: IConnectionDetails): IDialogValues;
    validateConnectionValues(closing: boolean, values: IDialogValues): Promise<IDialogValidations>;
    handleOptionsDialogClose(closure: DialogResponseClosure, values: IDialogValues, data: IDictionary): void;
    testConnection(values: IDialogValues): Promise<void>;
}

describe("Connection editor PQC options", () => {
    beforeEach(() => {
        registerUiLayer(uiLayerMock);
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    const setup = (options: Partial<IMySQLConnectionOptions> = {}) => {
        const saved: IConnectionDetails[] = [];
        const editor = new ConnectionEditor({
            onAddConnection: (details) => {
                saved.push(details);
            },
            onUpdateConnection: (details) => {
                saved.push(details);
            },
        });
        editor.context = { connectionsDataModel: { roots: [] } };
        const testable = editor as unknown as ITestableConnectionEditor;
        const details: IConnectionDetails = {
            id: 42, index: 0, dbType: DBType.MySQL, caption: "PQC connection", description: "",
            options: { scheme: MySQLConnectionScheme.MySQL, host: "localhost", user: "root", ...options },
        };
        const values = testable.generateEditorConfig("/", details);
        const save = () => {
            testable.handleOptionsDialogClose(DialogResponseClosure.Accept, values, { details });

            return saved[0];
        };

        return { testable, details, values, save, saved };
    };

    it.each([MySQLConnectionScheme.MySQL, MySQLConnectionScheme.MySQLx])(
        "preserves PQC options through save, reopen and test with %s", async (scheme) => {
            const { testable, values, save } = setup({ scheme, "extra-options": { "tls-version": "TLSv1.3" } });
            const ssl = values.sections.get("ssl")!.values;
            Object.assign(ssl, {
                sslMode: { type: "choice", value: "Require and Verify Identity" },
                tlsKex: { type: "text", value: "X25519MLKEM768:secp384r1MLKEM1024" },
                forcePqc: { type: "boolean", value: true },
                usePqcSign: { type: "boolean", value: false },
            });
            const testConnection = vi.spyOn(ShellInterface.dbConnections, "testConnection").mockResolvedValue();

            expect((await testable.validateConnectionValues(true, values)).messages).toEqual({});
            await testable.testConnection(values);
            const saved = save();
            const expectedTls = {
                scheme,
                "ssl-mode": "VERIFY_IDENTITY",
                "extra-options": { "tls-version": "TLSv1.3" },
                "tls-kex": "X25519MLKEM768:secp384r1MLKEM1024",
                "force-pqc": true,
                "use-pqc-sign": false,
            };
            expect(saved.options).toMatchObject(expectedTls);
            expect(testConnection.mock.calls[0][0].options).toMatchObject(expectedTls);
            const reopened = testable.generateEditorConfig("/", saved).sections.get("ssl")!.values;
            expect(reopened.tlsKex.value).toBe("X25519MLKEM768:secp384r1MLKEM1024");
            expect(reopened.forcePqc.value).toBe(true);
            expect(reopened.usePqcSign.value).toBe(false);
        },
    );

    it("leaves untouched PQC options unset on an existing connection", () => {
        const { save } = setup();
        const options = JSON.parse(JSON.stringify(save().options)) as Record<string, unknown>;
        expect(options).not.toHaveProperty("tls-kex");
        expect(options).not.toHaveProperty("force-pqc");
        expect(options).not.toHaveProperty("use-pqc-sign");
    });

    it("removes cleared text options and preserves an explicit false", () => {
        const { values, save } = setup();
        Object.assign(values.sections.get("ssl")!.values, {
            tlsKex: { type: "text", value: "" },
            forcePqc: { type: "boolean", value: false },
        });
        const options = JSON.parse(JSON.stringify(save().options)) as Record<string, unknown>;
        expect(options).not.toHaveProperty("tls-kex");
        expect(options["force-pqc"]).toBe(false);
    });

    it.each([
        [MySQLSslMode.Preferred, undefined],
        [MySQLSslMode.Preferred, "TLSv1.3"],
        [MySQLSslMode.Required, undefined],
        [MySQLSslMode.Required, "TLSv1.2"],
        [MySQLSslMode.Required, "TLSv1.2,TLSv1.3"],
    ] as const)("preserves forced PQC with %s and %s through save and test", async (mode, version) => {
        const extraOptions: Record<string, string> = {};

        if (version) {
            extraOptions["tls-version"] = version;
        }

        const options = { "ssl-mode": mode, "extra-options": extraOptions, "force-pqc": true };
        const { testable, values, save } = setup(options);
        const testConnection = vi.spyOn(ShellInterface.dbConnections, "testConnection").mockResolvedValue();
        expect((await testable.validateConnectionValues(true, values)).messages).toEqual({});
        await testable.testConnection(values);
        expect(testConnection).toHaveBeenCalledOnce();
        expect(testConnection.mock.calls[0][0].options).toMatchObject(options);
        expect(save().options).toMatchObject(options);
    });

    it.each(["Require", "Require and Verify CA", "Require and Verify Identity"])(
        "accepts forced PQC with default TLS versions and %s", async (mode) => {
            const { testable, values } = setup();
            Object.assign(values.sections.get("ssl")!.values, {
                sslMode: { type: "choice", value: mode },
                forcePqc: { type: "boolean", value: true },
            });
            expect((await testable.validateConnectionValues(true, values)).messages).toEqual({});
        },
    );

    it("preserves dialog PQC values when SSL is disabled and re-enabled before saving", () => {
        const { values, save } = setup({
            "tls-kex": "X25519", "force-pqc": true, "use-pqc-sign": false, "ssl-mode": MySQLSslMode.Disabled,
        });
        const ssl = values.sections.get("ssl")!.values;
        expect(ssl.tlsKex.value).toBe("X25519");
        expect(ssl.tlsKex.options).toContain(CommonDialogValueOption.Disabled);
        expect(ssl.forcePqc.options).toContain(CommonDialogValueOption.Disabled);
        const dialog = new ValueEditDialog({});
        dialog.state = { ...dialog.state, values };
        if (ssl.sslMode.type === "choice") {
            ssl.sslMode.value = "Require";
            ssl.sslMode.onChange?.("Require", dialog);
        }
        expect(ssl.tlsKex.options).not.toContain(CommonDialogValueOption.Disabled);
        expect(ssl.tlsKex.value).toBe("X25519");
        expect(save().options).toMatchObject({
            "ssl-mode": MySQLSslMode.Required, "tls-kex": "X25519", "force-pqc": true, "use-pqc-sign": false,
        });
    });

    it.each([
        [MySQLConnectionScheme.MySQL, true, false],
        [MySQLConnectionScheme.MySQL, false, true],
        [MySQLConnectionScheme.MySQLx, true, false],
        [MySQLConnectionScheme.MySQLx, false, true],
    ] as const)("omits PQC options from save and test with disabled SSL: %s, %s, %s", async (scheme, force, sign) => {
        const { testable, details, values, save } = setup({
            scheme, "ssl-mode": MySQLSslMode.Disabled, "tls-kex": "X25519MLKEM768",
            "force-pqc": force, "use-pqc-sign": sign,
        });
        const original = structuredClone(details.options);
        const testConnection = vi.spyOn(ShellInterface.dbConnections, "testConnection").mockResolvedValue();

        expect((await testable.validateConnectionValues(true, values)).messages).toEqual({});
        await testable.testConnection(values);
        expect(testConnection).toHaveBeenCalledOnce();
        expect(details.options).toEqual(original);
        const saved = save();

        for (const options of [testConnection.mock.calls[0][0].options, saved.options]) {
            const serialized = JSON.parse(JSON.stringify(options)) as Record<string, unknown>;
            expect(serialized).toMatchObject({ scheme, "ssl-mode": "DISABLED" });
            expect(serialized).not.toHaveProperty("tls-kex");
            expect(serialized).not.toHaveProperty("force-pqc");
            expect(serialized).not.toHaveProperty("use-pqc-sign");
        }

        const reopened = testable.generateEditorConfig("/", saved).sections.get("ssl")!.values;
        expect(reopened.tlsKex.value).toBeUndefined();
        expect(reopened.forcePqc.value).toBeUndefined();
        expect(reopened.usePqcSign.value).toBeUndefined();
    });

    it.each([MySQLConnectionScheme.MySQL, MySQLConnectionScheme.MySQLx])(
        "allows disabled SSL after toggling PQC options with %s", async (scheme) => {
            const { testable, values, save } = setup({ scheme });
            const ref = createRef<ValueEditDialog>();
            const { baseElement } = render(<ValueEditDialog ref={ref}
                onValidate={() => {
                    return testable.validateConnectionValues(false, values);
                }} />);
            await act(() => {
                ref.current!.show({ sections: new Map([["ssl", values.sections.get("ssl")!]]) }, {
                    contexts: ["MySQL"], title: "Connection TLS options",
                });
            });

            for (const key of ["forcePqc", "usePqcSign"]) {
                await act(() => {
                    fireEvent.click(baseElement.querySelector(`#${key}`)!);
                });
                await act(() => {
                    fireEvent.click(baseElement.querySelector(`#${key}`)!);
                });
                expect(values.sections.get("ssl")!.values[key].value).toBe(false);
            }

            await act(() => {
                fireEvent.click(baseElement.querySelector("#sslMode")!);
            });
            const disable = Array.from(baseElement.querySelectorAll("#sslModePopup .dropdownItem")).find((item) => {
                return item.textContent === "Disable";
            });
            await act(() => {
                fireEvent.click(disable!);
            });
            expect(values.sections.get("ssl")!.values.sslMode.value).toBe("Disable");
            expect((await testable.validateConnectionValues(true, values)).messages).toEqual({});
            expect(baseElement.querySelector("#ok")!.classList).not.toContain("disabled");
            expect(baseElement.querySelector(".message.error")).toBeNull();
            expect(baseElement.querySelector(".message.warning")).toBeNull();

            const testConnection = vi.spyOn(ShellInterface.dbConnections, "testConnection").mockResolvedValue();
            await testable.testConnection(values);
            expect(testConnection).toHaveBeenCalledOnce();
            const saved = save();

            for (const options of [testConnection.mock.calls[0][0].options, saved.options]) {
                const serialized = JSON.parse(JSON.stringify(options)) as Record<string, unknown>;
                expect(serialized).toMatchObject({ scheme, "ssl-mode": "DISABLED" });
                expect(serialized).not.toHaveProperty("tls-kex");
                expect(serialized).not.toHaveProperty("force-pqc");
                expect(serialized).not.toHaveProperty("use-pqc-sign");
            }
        },
    );

    it("omits invalid imported PQC values when SSL is disabled", async () => {
        const { testable, values, save } = setup({
            "ssl-mode": MySQLSslMode.Disabled,
            "force-pqc": "invalid" as unknown as boolean,
            "use-pqc-sign": "invalid" as unknown as boolean,
        });
        expect((await testable.validateConnectionValues(true, values)).messages).toEqual({});
        const savedOptions = JSON.parse(JSON.stringify(save().options)) as Record<string, unknown>;
        expect(savedOptions).not.toHaveProperty("force-pqc");
        expect(savedOptions).not.toHaveProperty("use-pqc-sign");
    });

    it.each([
        [MySQLSslMode.Preferred, true, true],
        [undefined, true, true],
        [MySQLSslMode.Preferred, false, false],
        [MySQLSslMode.Preferred, undefined, false],
        [MySQLSslMode.Required, true, false],
        [MySQLSslMode.VerifyCA, true, false],
        [MySQLSslMode.VerifyIdentity, true, false],
        [MySQLSslMode.Disabled, true, false],
    ] as const)("shows a warning for SSL mode %s and force-pqc %s: %s", async (mode, forcePqc, warns) => {
        const { values } = setup({ "ssl-mode": mode, "force-pqc": forcePqc });
        const ref = createRef<ValueEditDialog>();
        const { baseElement } = render(<ValueEditDialog ref={ref} />);
        await act(() => {
            ref.current!.show({ sections: new Map([["ssl", values.sections.get("ssl")!]]) }, {
                contexts: ["MySQL"], title: "Connection TLS options",
            });
        });
        const warning = baseElement.querySelector(".message.warning");
        expect(warning !== null).toBe(warns);

        if (warns) {
            expect(warning!.textContent).toContain("unencrypted connection");
        }
    });

    it("updates the warning as PQC and SSL mode change without blocking save or test", async () => {
        const { testable, values, save } = setup();
        const ref = createRef<ValueEditDialog>();
        const { baseElement } = render(<ValueEditDialog ref={ref}
            onValidate={() => {
                return testable.validateConnectionValues(false, values);
            }} />);
        await act(() => {
            ref.current!.show({ sections: new Map([["ssl", values.sections.get("ssl")!]]) }, {
                contexts: ["MySQL"], title: "Connection TLS options",
            });
        });
        expect(baseElement.querySelector(".message.warning")).toBeNull();
        await act(() => {
            fireEvent.click(baseElement.querySelector("#forcePqc")!);
        });
        expect(baseElement.querySelector(".message.warning")).not.toBeNull();
        expect(baseElement.querySelector("#ok")!.classList).not.toContain("disabled");

        const modes = ["Require", "Require and Verify CA", "Require and Verify Identity", "Preferred"];

        for (const mode of modes) {
            await act(() => {
                fireEvent.click(baseElement.querySelector("#sslMode")!);
            });
            const option = Array.from(baseElement.querySelectorAll("#sslModePopup .dropdownItem")).find((item) => {
                return item.textContent === mode;
            });
            expect(option).toBeDefined();
            await act(() => {
                fireEvent.click(option!);
            });
            expect(baseElement.querySelector(".message.warning") !== null).toBe(mode === "Preferred");
        }

        expect(baseElement.querySelector("#ok")!.classList).not.toContain("disabled");
        const testConnection = vi.spyOn(ShellInterface.dbConnections, "testConnection").mockResolvedValue();
        await testable.testConnection(values);
        expect(testConnection).toHaveBeenCalledOnce();
        const expectedTls = { "ssl-mode": "PREFERRED", "force-pqc": true };
        expect(testConnection.mock.calls[0][0].options).toMatchObject(expectedTls);
        expect(save().options).toMatchObject(expectedTls);

        await act(() => {
            fireEvent.click(baseElement.querySelector("#forcePqc")!);
        });
        expect(baseElement.querySelector(".message.warning")).toBeNull();
    });

    it("keeps imported Boolean text fields labeled while correcting their values", async () => {
        const { values } = setup({
            "force-pqc": "invalid" as unknown as boolean,
            "use-pqc-sign": "invalid" as unknown as boolean,
        });
        const ref = createRef<ValueEditDialog>();
        const { baseElement, getByLabelText, getAllByText } = render(<ValueEditDialog ref={ref} />);
        await act(() => {
            ref.current!.show({ sections: new Map([["ssl", values.sections.get("ssl")!]]) }, {
                contexts: ["MySQL"], title: "Connection TLS options",
            });
        });
        const forcePqc = getByLabelText<HTMLInputElement>("Require PQC key exchange");
        const usePqcSign = getByLabelText<HTMLInputElement>("Allow PQC handshake signatures");
        expect(forcePqc.value).toBe("invalid");
        expect(usePqcSign.value).toBe("invalid");
        expect(baseElement.querySelector(".message.warning")).toBeNull();
        await act(() => {
            fireEvent.input(forcePqc, { target: { value: "true" } });
        });
        const warning = baseElement.querySelector(".message.warning")!;
        expect(warning).not.toBeNull();
        expect(getByLabelText("Require PQC key exchange")).toBe(forcePqc);
        expect(getAllByText("Require PQC key exchange")).toHaveLength(1);
        expect(forcePqc.compareDocumentPosition(warning)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(warning.compareDocumentPosition(usePqcSign)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        await act(() => {
            fireEvent.input(forcePqc, { target: { value: "false" } });
            fireEvent.input(usePqcSign, { target: { value: "true" } });
        });
        expect(baseElement.querySelector(".message.warning")).toBeNull();
        expect(getByLabelText("Require PQC key exchange")).toBe(forcePqc);
        expect(getByLabelText("Allow PQC handshake signatures")).toBe(usePqcSign);
        expect(values.sections.get("ssl")!.values.usePqcSign.value).toBe("true");
    });

    it("renders the PQC fields and updates their values through the dialog", async () => {
        const { values } = setup({ "ssl-mode": MySQLSslMode.Required });
        const ref = createRef<ValueEditDialog>();
        const { baseElement, getByLabelText, getAllByText } = render(<ValueEditDialog ref={ref} />);
        await act(() => {
            ref.current!.show({ sections: new Map([["ssl", values.sections.get("ssl")!]]) }, {
                contexts: ["MySQL"], title: "Connection TLS options",
            });
        });
        const forcePqc = baseElement.querySelector<HTMLElement>("#forcePqc")!;
        expect(forcePqc).not.toBeNull();
        expect(baseElement.querySelector("#tlsVersion")).toBeNull();
        expect(getAllByText("Require PQC key exchange")).toHaveLength(1);
        expect(getAllByText("Allow PQC handshake signatures")).toHaveLength(1);
        fireEvent.click(forcePqc);
        expect(ref.current!.getDialogValues().sections.get("ssl")!.values.forcePqc.value).toBe(true);
        const kex = getByLabelText<HTMLInputElement>("TLS key-exchange groups");
        expect(kex).toBe(baseElement.querySelector("#tlsKex"));
        fireEvent.input(kex, { target: { value: "X25519MLKEM768:X25519" } });
        expect(ref.current!.getDialogValues().sections.get("ssl")!.values.tlsKex.value)
            .toBe("X25519MLKEM768:X25519");
    });

    it("keeps advanced TLS settings separate from the SSL tab", async () => {
        const extraOptions = {
            "ssl-mode": "VERIFY_CA", "tls-version": "TLSv1.3", "TLS-KEX": "MLKEM768",
            "force-pqc": "1", "use-pqc-sign": "TRUE", "net-read-timeout": "20",
        };
        const options = {
            "ssl-mode": MySQLSslMode.Preferred, "tls-kex": "X25519",
            "force-pqc": false, "use-pqc-sign": false, "extra-options": extraOptions,
        };
        const before = structuredClone(options);
        const { testable, details, values } = setup(options);
        const ssl = values.sections.get("ssl")!.values;
        expect(ssl.sslMode.value).toBe("Preferred");
        expect(ssl.tlsKex.value).toBe("X25519");
        expect(ssl.forcePqc.value).toBe(false);
        expect(ssl.usePqcSign.value).toBe(false);
        expect(values.sections.get("mysqlAdvanced")!.values.extraOptions.value).toEqual(extraOptions);
        expect(details.options).toMatchObject(before);
        expect((await testable.validateConnectionValues(true, values)).messages).toHaveProperty("extraOptions");
    });

    it.each(["ssl-mode", "tls-kex", "force-pqc", "use-pqc-sign", "SSL-MODE", "Force-PQC"])(
        "rejects a new advanced override of %s", async (key) => {
            const { testable, values, save, saved } = setup();
            values.sections.get("mysqlAdvanced")!.values.extraOptions.value = { [key]: "false" };
            const testConnection = vi.spyOn(ShellInterface.dbConnections, "testConnection").mockResolvedValue();
            expect((await testable.validateConnectionValues(true, values)).messages).toHaveProperty("extraOptions");
            await testable.testConnection(values);
            save();
            expect(testConnection).not.toHaveBeenCalled();
            expect(saved).toEqual([]);
        },
    );

    it.each(["maybe", ""])("keeps invalid saved Boolean '%s' visible until corrected", async (invalid) => {
        const { testable, values } = setup({ "force-pqc": invalid as unknown as boolean });
        const field = values.sections.get("ssl")!.values.forcePqc;
        expect(field.value).toBe(invalid);
        expect((await testable.validateConnectionValues(true, values)).messages).toHaveProperty("forcePqc");
        field.value = "false";
        expect((await testable.validateConnectionValues(true, values)).messages).toEqual({});
    });

    it("reports a rejected PQC connection as an error", async () => {
        const { testable, values } = setup({
            "ssl-mode": MySQLSslMode.Preferred, "extra-options": { "tls-version": "TLSv1.2" }, "force-pqc": true,
        });
        vi.spyOn(ShellInterface.dbConnections, "testConnection").mockRejectedValue(new Error("PQC unavailable"));
        const showError = vi.spyOn(uiLayerMock, "showErrorMessage");
        const showSuccess = vi.spyOn(uiLayerMock, "showInformationMessage");
        await testable.testConnection(values);
        expect(showError).toHaveBeenCalledWith(expect.stringContaining("PQC unavailable"), {});
        expect(showSuccess).not.toHaveBeenCalled();
    });
});
