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
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { render } from "@testing-library/preact";
import { type ComponentChild, createRef } from "preact";
import { describe, expect, it, vi } from "vitest";

import { DialogResponseClosure } from "../../../../app-logic/general-types.js";
import { IAuthenticationHints, MySQLAuthenticationPlugin, MySQLConnectionScheme, MySQLSslMode }
    from "../../../../communication/MySQL.js";
import {
    CommonDialogValueOption, IChoiceDialogValue, IDialogValues, INumberInputDialogValue, ISetDialogValue,
    IStringInputDialogValue, ValueEditDialog,
}
    from "../../../../components/Dialogs/ValueEditDialog.js";
import { ConnectionTags } from "../../../../modules/db-editor/ConnectionTags.js";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface.js";
import { ConnectionEditor } from "../../../../modules/db-editor/ConnectionEditor.js";
import type { DocumentContextType } from "../../../../modules/db-editor/index.js";
import { DBType, IConnectionDetails } from "../../../../supplement/ShellInterface/index.js";
import { nextRunLoop } from "../../test-helpers.js";

interface ConnectionEditorPrivate {
    show: ConnectionEditor["show"];
    bundledAuthenticationPlugins: Set<MySQLAuthenticationPlugin>;
    context: DocumentContextType;
    generateEditorConfig: (currentPath: string, details?: IConnectionDetails) => IDialogValues;
    handleOptionsDialogClose: (closure: DialogResponseClosure, values: IDialogValues, data?: object) => void;
    selectedTagsBeforeEdit: string[];
    registerWebAuthnFactor: (values: IDialogValues) => void;
    testConnection: (values: IDialogValues, registerFactor?: 2 | 3) => Promise<void>;
    validateConnectionValues: (closing: boolean, values: IDialogValues) =>
    Promise<{ messages: Record<string, string> }>;
}

const createEditor = (onUpdateConnection = vi.fn()): ConnectionEditorPrivate => {
    const editor = new ConnectionEditor({
        onAddConnection: vi.fn(),
        onUpdateConnection,
    });
    const privateEditor = editor as unknown as ConnectionEditorPrivate;
    privateEditor.context = {
        connectionsDataModel: { roots: [] },
    } as unknown as DocumentContextType;
    privateEditor.bundledAuthenticationPlugins = new Set([
        MySQLAuthenticationPlugin.AuthenticationLdapSimple,
        MySQLAuthenticationPlugin.AuthenticationWebAuthn,
    ]);

    return privateEditor;
};

const connectionDetails = (): IConnectionDetails => {
    return {
        id: 1,
        dbType: DBType.MySQL,
        caption: "MFA connection",
        description: "",
        useSSH: false,
        useMHS: false,
        options: {
            scheme: MySQLConnectionScheme.MySQL,
            host: "localhost",
            port: 3306,
            user: "mfa-user",
            "plugin-authentication-webauthn-device": 2,
            "plugin-authentication-webauthn-client-preserve-privacy": true,
            "auth-method": "mysql_clear_password",
        },
        settings: {
            authenticationHints: {
                factors: [
                    "caching_sha2_password",
                    MySQLAuthenticationPlugin.AuthenticationWebAuthn,
                    MySQLAuthenticationPlugin.AuthenticationLdapSimple,
                ],
                pluginDir: "/client/plugins",
            },
        },
        index: 0,
    };
};

const trailingDescriptionText = (description: ComponentChild | undefined): string => {
    const view = render(<>{description}</>);
    const text = view.container.textContent;
    view.unmount();

    return text ?? "";
};

describe("ConnectionEditor authentication", () => {
    it("offers bundled authentication plugins after opening for SQLite and switching to MySQL", async () => {
        const editor = createEditor();
        editor.bundledAuthenticationPlugins = new Set();
        const plugins = [MySQLAuthenticationPlugin.AuthenticationWebAuthn,
            MySQLAuthenticationPlugin.AuthenticationKerberos, MySQLAuthenticationPlugin.AuthenticationOci];
        vi.spyOn(ShellInterface.core, "getDbTypes").mockResolvedValue([DBType.Sqlite, DBType.MySQL]);
        vi.spyOn(ShellInterface.core, "getBundledAuthenticationPlugins").mockResolvedValue(plugins);
        vi.spyOn(ConnectionTags, "load").mockResolvedValue({});

        await editor.show(DBType.Sqlite, true, "/");
        const details = { ...connectionDetails(), dbType: DBType.Sqlite, options: { dbFile: "test.sqlite3" } };
        const values = editor.generateEditorConfig("/", details);
        const updateActiveContexts = vi.fn();
        const connectionMethod = values.sections.get("connectionMethod")!.values.connectionMethod as IChoiceDialogValue;
        expect(connectionMethod.choices.at(-1)).toBe(DBType.Sqlite);
        expect(trailingDescriptionText(connectionMethod.trailingDescription))
            .toBe("Workbench  local file  SQLite");
        connectionMethod.onChange!("mysql (socket/pipe)", {
            getDialogValues: (): IDialogValues => {
                return values;
            },
            updateActiveContexts,
            setDialogValues: vi.fn(),
        } as unknown as ValueEditDialog);

        expect(updateActiveContexts).toHaveBeenCalledWith({ add: [DBType.MySQL], remove: [DBType.Sqlite] });
        expect(trailingDescriptionText(connectionMethod.trailingDescription))
            .toBe("Workbench  socket  MySQL");
        expect(values.sections.get("authentication")!.values.factor1.choices).toEqual(
            expect.arrayContaining(plugins),
        );
    });

    it("defaults the connection timeout to fifteen seconds", () => {
        const editor = createEditor();
        const values = editor.generateEditorConfig("/", connectionDetails());
        const options = values.sections.get("mysqlAdvanced")!.values;

        expect(Object.keys(options).slice(2, 4)).toEqual(["sqlMode", "timeout"]);
        expect(options.sqlMode.horizontalSpan).toBe(5);
        expect(options.timeout.horizontalSpan).toBe(3);
        expect(options.timeout.value).toBe(15000);
    });

    it("round-trips SQL mode text without validating individual modes", () => {
        const onUpdateConnection = vi.fn();
        const editor = createEditor(onUpdateConnection);
        const details = connectionDetails();
        details.options["sql-mode"] = ["ANSI_QUOTES,UNKNOWN_MODE"];
        const values = editor.generateEditorConfig("/", details);
        const sqlMode = values.sections.get("mysqlAdvanced")!.values.sqlMode as IStringInputDialogValue;

        expect(sqlMode.value).toBe("ANSI_QUOTES,UNKNOWN_MODE");

        editor.handleOptionsDialogClose(DialogResponseClosure.Accept, values, { details });

        const savedDetails = onUpdateConnection.mock.calls[0][0] as IConnectionDetails;
        expect(savedDetails.options["sql-mode"]).toEqual(["ANSI_QUOTES,UNKNOWN_MODE"]);
    });

    it("shows Basic connection details outside the tab view", () => {
        const editor = createEditor();
        const values = editor.generateEditorConfig("/", connectionDetails());

        expect(values.columns).toBe(9);
        expect(values.sections.get("information")!.values).toHaveProperty("tags");
        expect(values.sections.get("connectionMethod")!.values.connectionMethod.caption).toBe("Connection Method");
        expect(values.sections.get("mysqlDetails")!.caption).toBeUndefined();
        expect(values.sections.get("sqliteDetails")!.caption).toBeUndefined();
        expect(values.sections.get("mysqlDetails")!.groupName).toBeUndefined();
        expect(values.sections.get("sqliteDetails")!.groupName).toBeUndefined();
        expect(values.sections.get("mysqlAdvanced")!.caption).toBe("Options");
        expect(values.sections.get("sqliteAdvanced")!.caption).toBe("Options");
        expect(values.sections.get("mysqlAdvanced")!.values).toHaveProperty("defaultEditorSeparator");
        expect(values.sections.get("sqliteAdvanced")!.values).toHaveProperty("defaultEditorSeparator");
        expect(values.sections.get("mysqlAdvanced")!.values.defaultEditorSeparator.horizontalSpan).toBe(8);
        expect(values.sections.get("sqliteAdvanced")!.values.defaultEditorSeparator.horizontalSpan).toBe(8);

        const mysqlDetails = values.sections.get("mysqlDetails")!.values;
        expect(Object.keys(mysqlDetails).slice(1, 5)).toEqual(["userName", "hostName", "port", "defaultSchema"]);
        expect(mysqlDetails.userName.horizontalSpan).toBe(2);
        expect(mysqlDetails.hostName.horizontalSpan).toBe(4);
        expect(mysqlDetails.port.horizontalSpan).toBe(1);
        expect(mysqlDetails.defaultSchema.horizontalSpan).toBe(2);

        const sqliteDetails = { ...connectionDetails(), dbType: DBType.Sqlite, options: { dbFile: "test.sqlite3" } };
        const sqliteValues = editor.generateEditorConfig("/", sqliteDetails);
        const sqliteConnectionDetails = sqliteValues.sections.get("sqliteDetails")!.values;
        expect(sqliteConnectionDetails.dbFilePath.horizontalSpan).toBe(7);
        expect(sqliteConnectionDetails.dbName.horizontalSpan).toBe(2);
        expect(Object.keys(sqliteValues.sections.get("sqliteAdvanced")!.values)).toEqual([
            "defaultEditorSeparator", "defaultEditor", "otherParameters",
        ]);
    });

    it("labels the transports in SSH and Bastion connection diagrams", () => {
        const editor = createEditor();
        const sshDetails = connectionDetails();
        sshDetails.options.ssh = "ssh.example.com";
        const bastionDetails = connectionDetails();
        bastionDetails.options["mysql-db-system-id"] = "ocid1.mysqldbsystem.oc1..example";
        const sshValues = editor.generateEditorConfig("/", sshDetails);
        const sshMethod = sshValues.sections.get("connectionMethod")!.values.connectionMethod as IChoiceDialogValue;
        const sslMode = sshValues.sections.get("ssl")!.values.sslMode as IChoiceDialogValue;

        expect(trailingDescriptionText(sshMethod.trailingDescription))
            .toBe("Workbench  ssh  SSH Host  ssl?  MySQL");
        const diagram = render(<>{sshMethod.trailingDescription}</>);
        expect([...diagram.container.querySelectorAll("strong")].map((node) => {
            return node.textContent;
        }))
            .toEqual(["Workbench", "SSH Host", "MySQL"]);
        expect([...diagram.container.querySelectorAll("strong")].map((node) => {
            return node.getAttribute("data-endpoint");
        })).toEqual([null, "ssh.example.com:22", "localhost:3306"]);
        expect([...diagram.container.querySelectorAll(".connectionMethodProtocol")].map((node) => {
            return node.textContent;
        })).toEqual(["ssh", "ssl?"]);
        diagram.unmount();
        const dialog = {
            getDialogValues: (): IDialogValues => {
                return sshValues;
            },
            setDialogValues: vi.fn(),
        } as unknown as ValueEditDialog;
        const mysqlDetails = sshValues.sections.get("mysqlDetails")!.values;
        const hostName = mysqlDetails.hostName as IStringInputDialogValue;
        const port = mysqlDetails.port as INumberInputDialogValue;
        const ssh = sshValues.sections.get("ssh")!.values.ssh as IStringInputDialogValue;
        hostName.value = "2001:db8::1";
        hostName.onFocusLost!(hostName.value, dialog);
        port.value = 3307;
        port.onFocusLost!(port.value, dialog);
        ssh.value = "user@[2001:db8::2]:2222";
        ssh.onFocusLost!(ssh.value, dialog);
        const updatedDiagram = render(<>{sshMethod.trailingDescription}</>);
        expect([...updatedDiagram.container.querySelectorAll("strong")].map((node) => {
            return node.getAttribute("data-endpoint");
        })).toEqual([null, "[2001:db8::2]:2222", "[2001:db8::1]:3307"]);
        updatedDiagram.unmount();
        sslMode.value = "Require";
        sslMode.onChange!("Require", {
            getDialogValues: (): IDialogValues => {
                return sshValues;
            },
            setDialogValues: vi.fn(),
        } as unknown as ValueEditDialog);
        expect(trailingDescriptionText(sshMethod.trailingDescription))
            .toBe("Workbench  ssh  SSH Host  ssl  MySQL");
        const bastionMethod = editor.generateEditorConfig("/", bastionDetails)
            .sections.get("connectionMethod")!.values.connectionMethod as IChoiceDialogValue;
        expect(trailingDescriptionText(bastionMethod.trailingDescription))
            .toBe("Workbench  ssh  Bastion  ssl?  MySQL");
    });

    it("keeps socket connection fields on one row", () => {
        const editor = createEditor();
        const details = connectionDetails();
        details.options.socket = "/tmp/mysql.sock";
        const values = editor.generateEditorConfig("/", details);
        const mysqlDetails = values.sections.get("mysqlDetails")!.values;

        expect(mysqlDetails.userName.horizontalSpan).toBe(2);
        expect(mysqlDetails.hostName.options).toContain(CommonDialogValueOption.Hidden);
        expect(mysqlDetails.port.horizontalSpan).toBe(5);
        expect(mysqlDetails.defaultSchema.horizontalSpan).toBe(2);
        const connectionMethod = values.sections.get("connectionMethod")!.values.connectionMethod as IChoiceDialogValue;
        const diagram = render(<>{connectionMethod.trailingDescription}</>);
        expect([...diagram.container.querySelectorAll("strong")].map((node) => {
            return node.getAttribute("data-endpoint");
        })).toEqual([null, "localhost"]);
        diagram.unmount();
    });

    it("keeps SSL certificate paths on one row", () => {
        const editor = createEditor();
        const ssl = editor.generateEditorConfig("/", connectionDetails()).sections.get("ssl")!.values;

        expect(ssl.sslMode.horizontalSpan).toBe(3);
        expect(ssl.sslCipher.horizontalSpan).toBe(6);
        expect(ssl.sslCipher.tooltip).toBe("Comma-separated list of TLS cipher suites permitted for this connection.");
        expect(ssl.sslCaFile.horizontalSpan).toBe(3);
        expect(ssl.sslCertFile.horizontalSpan).toBe(3);
        expect(ssl.sslKeyFile.horizontalSpan).toBe(3);
        expect(ssl.sslCaFile.tooltip).toBe("Path to the CA certificate used to validate the server certificate.");
        expect(ssl.sslCertFile.tooltip).toBe("Path to the client certificate presented to the server.");
        expect(ssl.sslKeyFile.tooltip).toBe("Path to the private key for the client certificate.");
        expect(ssl.pqcTitle.framed).toBe(true);
        expect(ssl.tlsKex.tooltip).toContain("X25519MLKEM768:X25519");
        expect(ssl.forcePqc.tooltip).toContain("enforces TLSv1.3");
        expect(ssl.usePqcSign.tooltip).toContain("classical signature");
    });

    it("focuses the Caption field when opening a connection editor", async () => {
        const editor = createEditor();
        const dialogRef = createRef<ValueEditDialog>();
        const view = render(<ValueEditDialog ref={dialogRef} />);

        dialogRef.current?.show(editor.generateEditorConfig("/", connectionDetails()), {
            contexts: [DBType.MySQL],
        });
        await nextRunLoop();
        await nextRunLoop();

        expect(document.activeElement).toBe(document.querySelector("#caption"));

        view.unmount();
    });

    it("opens the tag editor with the selected tags", () => {
        const editor = createEditor();
        const values = editor.generateEditorConfig("/", connectionDetails());
        const tags = values.sections.get("information")!.values.tags as ISetDialogValue;
        tags.value = ["DEV"];

        tags.captionAction!.onClick("tags", values);

        expect(editor.selectedTagsBeforeEdit).toEqual(["DEV"]);
    });

    it("offers only bundled client authentication plugins", () => {
        const editor = createEditor();
        const values = editor.generateEditorConfig("/", connectionDetails());
        const choices = values.sections.get("authentication")!.values.factor1.choices as string[];

        expect(choices).toEqual(expect.arrayContaining([
            MySQLAuthenticationPlugin.Password,
            MySQLAuthenticationPlugin.AuthenticationLdapSimple,
            MySQLAuthenticationPlugin.AuthenticationWebAuthn,
        ]));
        expect(choices).not.toContain(MySQLAuthenticationPlugin.AuthenticationKerberos);

        const factor2 = values.sections.get("authentication")!.values.factor2;
        expect(factor2.options).not.toContain(CommonDialogValueOption.Disabled);
    });

    it("round-trips MFA factors and authentication options", () => {
        const onUpdateConnection = vi.fn();
        const editor = createEditor(onUpdateConnection);
        const details = connectionDetails();
        const values = editor.generateEditorConfig("/", details);
        const authentication = values.sections.get("authentication")!.values;

        expect(authentication.factor1.value).toBe(MySQLAuthenticationPlugin.Password);
        expect(authentication.factor2.value).toBe(MySQLAuthenticationPlugin.AuthenticationWebAuthn);
        expect(authentication.factor3.value).toBe(MySQLAuthenticationPlugin.AuthenticationLdapSimple);
        expect(authentication.pluginDir.value).toBe("/client/plugins");
        expect(authentication.webauthnDevice.value).toBe(2);
        expect(authentication.webauthnPreservePrivacy.value).toBe(true);
        expect(authentication.webauthnDevice.options).not.toContain(CommonDialogValueOption.Hidden);
        expect(authentication.pluginDir.options).not.toContain(CommonDialogValueOption.Hidden);
        expect(values.sections.get("ssl")!.values.sslMode.value).toBe("Require");

        editor.handleOptionsDialogClose(DialogResponseClosure.Accept, values, { details });

        const savedDetails = onUpdateConnection.mock.calls[0][0] as IConnectionDetails;
        expect(savedDetails.options).toMatchObject({
            "auth-method": "mysql_clear_password",
            "ssl-mode": "REQUIRED",
            "plugin-authentication-webauthn-device": 2,
            "plugin-authentication-webauthn-client-preserve-privacy": true,
        });
        expect(savedDetails.settings?.authenticationHints).toEqual({
            factors: [
                MySQLAuthenticationPlugin.Password,
                MySQLAuthenticationPlugin.AuthenticationWebAuthn,
                MySQLAuthenticationPlugin.AuthenticationLdapSimple,
            ],
            pluginDir: "/client/plugins",
        } satisfies IAuthenticationHints);
    });

    it.each(["PLAIN", "MYSQL41", "SHA256_MEMORY"])("preserves the X Protocol method %s", (method) => {
        const onUpdateConnection = vi.fn();
        const editor = createEditor(onUpdateConnection);
        const details = connectionDetails();
        details.options.scheme = MySQLConnectionScheme.MySQLx;
        details.options["auth-method"] = method;
        const values = editor.generateEditorConfig("/", details);

        editor.handleOptionsDialogClose(DialogResponseClosure.Accept, values, { details });

        const savedDetails = onUpdateConnection.mock.calls[0][0] as IConnectionDetails;
        expect(savedDetails.options["auth-method"]).toBe(method);
    });

    it("does not retain SQLite options when changing to MySQL", () => {
        const onUpdateConnection = vi.fn();
        const editor = createEditor(onUpdateConnection);
        const details = connectionDetails();
        details.dbType = DBType.Sqlite;
        details.options = {
            dbFile: "/tmp/connection.sqlite3",
            dbName: "connection",
            otherParameters: "cache=shared",
        };
        const values = editor.generateEditorConfig("/", details);
        values.sections.get("connectionMethod")!.values.connectionMethod.value = MySQLConnectionScheme.MySQL;

        editor.handleOptionsDialogClose(DialogResponseClosure.Accept, values, { details });

        const savedDetails = onUpdateConnection.mock.calls[0][0] as IConnectionDetails;
        expect(savedDetails.options).not.toHaveProperty("dbFile");
        expect(savedDetails.options).not.toHaveProperty("dbName");
        expect(savedDetails.options).not.toHaveProperty("otherParameters");
    });

    it("supports only password authentication for MySQL X connections", () => {
        const onUpdateConnection = vi.fn();
        const editor = createEditor(onUpdateConnection);
        const details = connectionDetails();
        details.options.scheme = MySQLConnectionScheme.MySQLx;
        const values = editor.generateEditorConfig("/", details);
        const authentication = values.sections.get("authentication")!.values;

        editor.handleOptionsDialogClose(DialogResponseClosure.Accept, values, { details });

        expect(authentication.factor1.value).toBe(MySQLAuthenticationPlugin.Password);
        expect(authentication.factor1.choices).toEqual([MySQLAuthenticationPlugin.Password]);
        expect(authentication.factor1.caption).toBeUndefined();
        expect(authentication.factor2.value).toBe("None");
        expect(authentication.factor2.choices).toEqual(["None"]);
        expect(authentication.factor2.options).toContain(CommonDialogValueOption.Hidden);
        expect(authentication.factor2Separator.options).toContain(CommonDialogValueOption.Hidden);
        expect(authentication.factor3.value).toBe("None");
        expect(authentication.factor3.choices).toEqual(["None"]);
        expect(authentication.factor3.options).toContain(CommonDialogValueOption.Hidden);
        expect(authentication.factor3Separator.options).toContain(CommonDialogValueOption.Hidden);
        const savedDetails = onUpdateConnection.mock.calls[0][0] as IConnectionDetails;
        expect(savedDetails.settings).toEqual({});
    });

    it("keeps a stronger SSL mode and PQC options for clear-text authentication", () => {
        const onUpdateConnection = vi.fn();
        const editor = createEditor(onUpdateConnection);
        const details = connectionDetails();
        details.options["ssl-mode"] = MySQLSslMode.VerifyIdentity;
        details.options["tls-kex"] = "X25519MLKEM768";
        details.options["force-pqc"] = true;
        details.options["use-pqc-sign"] = false;
        const values = editor.generateEditorConfig("/", details);

        expect(values.sections.get("ssl")!.values.sslMode.value).toBe("Require and Verify Identity");

        editor.handleOptionsDialogClose(DialogResponseClosure.Accept, values, { details });

        const savedDetails = onUpdateConnection.mock.calls[0][0] as IConnectionDetails;
        expect(savedDetails.options).toMatchObject({
            "ssl-mode": MySQLSslMode.VerifyIdentity,
            "tls-kex": "X25519MLKEM768",
            "force-pqc": true,
            "use-pqc-sign": false,
        });
    });

    it("requires OCI settings when OCI authentication is selected", async () => {
        const editor = createEditor();
        const values = editor.generateEditorConfig("/", connectionDetails());
        const authentication = values.sections.get("authentication")!.values;
        authentication.factor1.value = MySQLAuthenticationPlugin.AuthenticationOci;
        authentication.factor2.value = "None";
        authentication.factor3.value = "None";
        authentication.ociConfigFile.value = "";
        authentication.ociConfigProfile.value = "";

        const result = await editor.validateConnectionValues(true, values);

        expect(result.messages).toMatchObject({
            ociConfigFile: "Specify the OCI config file used for authentication",
            ociConfigProfile: "Specify the OCI config profile used for authentication",
        });
    });

    it("updates authentication-specific fields when a factor changes", () => {
        const editor = createEditor();
        const values = editor.generateEditorConfig("/", connectionDetails());
        const authentication = values.sections.get("authentication")!.values;
        const dialog = {
            getDialogValues: (): IDialogValues => {
                return values;
            },
            setDialogValues: vi.fn(),
        };
        const factor2 = authentication.factor2 as unknown as {
            onChange: (plugin: string, valueDialog: typeof dialog) => void;
        };

        authentication.factor1.value = MySQLAuthenticationPlugin.AuthenticationOci;
        authentication.factor2.value = "None";
        authentication.factor3.value = "None";
        factor2.onChange(MySQLAuthenticationPlugin.AuthenticationOci, dialog);

        expect(authentication.ociConfigFile.options).not.toContain(CommonDialogValueOption.Hidden);
        expect(authentication.ociConfigProfile.options).not.toContain(CommonDialogValueOption.Hidden);
        expect(authentication.webauthnDevice.options).toContain(CommonDialogValueOption.Hidden);
        expect(Object.keys(authentication)).toEqual(expect.arrayContaining([
            "factor1", "ociConfigFile", "ociConfigProfile",
        ]));
        expect(dialog.setDialogValues).toHaveBeenCalledWith(values);
    });

    it.each([
        [MySQLAuthenticationPlugin.AuthenticationLdapSimple, []],
        ["None", [CommonDialogValueOption.Disabled]],
    ])("updates the third slot after removing factor 2 with factor 3 set to %s", (thirdPlugin, expectedOptions) => {
        const editor = createEditor();
        const values = editor.generateEditorConfig("/", connectionDetails());
        const authentication = values.sections.get("authentication")!.values;
        const dialog = {
            getDialogValues: (): IDialogValues => {
                return values;
            },
            setDialogValues: vi.fn(),
        };
        const factor2 = authentication.factor2 as unknown as {
            onChange: (plugin: string, valueDialog: typeof dialog) => void;
        };

        authentication.factor3.value = thirdPlugin;
        authentication.factor2.value = "None";
        factor2.onChange("None", dialog);

        expect(authentication.factor2.value).toBe(thirdPlugin);
        expect(authentication.factor3.value).toBe("None");
        expect(authentication.factor3.options).toEqual(expectedOptions);
    });

    it("registers WebAuthn with the required factor", () => {
        const editor = createEditor();
        const testConnection = vi.fn().mockResolvedValue(undefined);
        editor.testConnection = testConnection;
        const values = editor.generateEditorConfig("/", connectionDetails());
        const authentication = values.sections.get("authentication")!.values;

        authentication.factor1.value = MySQLAuthenticationPlugin.AuthenticationWebAuthn;
        authentication.factor2.value = "None";
        authentication.factor3.value = "None";
        editor.registerWebAuthnFactor(values);
        expect(testConnection).toHaveBeenLastCalledWith(values, 2);

        authentication.factor1.value = MySQLAuthenticationPlugin.Password;
        authentication.factor2.value = MySQLAuthenticationPlugin.AuthenticationWebAuthn;
        editor.registerWebAuthnFactor(values);
        expect(testConnection).toHaveBeenLastCalledWith(values, 2);

        authentication.factor2.value = "None";
        authentication.factor3.value = MySQLAuthenticationPlugin.AuthenticationWebAuthn;
        editor.registerWebAuthnFactor(values);
        expect(testConnection).toHaveBeenLastCalledWith(values, 2);
    });
});
