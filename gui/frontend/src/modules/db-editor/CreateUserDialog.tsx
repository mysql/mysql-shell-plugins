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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { ComponentChild, RefObject } from "preact";
import { CheckState } from "../../components/ui/Checkbox/Checkbox.js";
import { Radiobutton } from "../../components/ui/Radiobutton/Radiobutton.js";
import { Container, ContentAlignment, Orientation } from "../../components/ui/Container/Container.js";
import {
    CommonDialogValueOption,
    IDialogSection,
    IDialogValidations,
    IDialogValues,
    ValueEditDialog,
} from "../../components/Dialogs/ValueEditDialog.js";
import { DialogResponseClosure } from "../../app-logic/general-types.js";
import { IValueEditCustomProperties, ValueEditCustom } from "../../components/Dialogs/ValueEditCustom.js";
import {
    ComponentBase, IComponentProperties, IComponentState,
} from "../../components/ui/Component/ComponentBase.js";
import type { IMySQLDefaultUserOptions } from "../../communication/ProtocolGui.js";

type TlsModeValue = "None" | "Required" | "Require Certificate";

interface ITlsModeSelectorData {
    tlsMode: TlsModeValue;
}

class TlsModeSelector extends ValueEditCustom<IValueEditCustomProperties, IComponentState> {
    public override render(): ComponentChild {
        const { values, onDataChange } = this.props;
        const data = (values as ITlsModeSelectorData | undefined) ?? { tlsMode: "None" };
        const options: TlsModeValue[] = ["None", "Required", "Require Certificate"];

        return (
            <Container orientation={Orientation.LeftToRight}>
                {options.map((option) => {
                    const checkState = data.tlsMode === option ? CheckState.Checked : CheckState.Unchecked;

                    return (
                        <Radiobutton
                            key={option}
                            name="tlsMode"
                            caption={option}
                            checkState={checkState}
                            onChange={() => {
                                onDataChange?.({ ...data, tlsMode: option });
                            }}
                        />
                    );
                })}
            </Container>
        );
    }
}

export interface ICreateUserDialogProps extends IComponentProperties {
    dialogRef: RefObject<ValueEditDialog>;
    editing?: boolean;
    onClose?: (closure: DialogResponseClosure, values: IDialogValues) => Promise<boolean | void> | boolean | void;
    onValidate?: (closing: boolean, values: IDialogValues) => Promise<IDialogValidations>;
}

export class CreateUserDialog extends ComponentBase<ICreateUserDialogProps, IComponentState> {
    public static readonly fallbackAuthenticationPlugins = ["mysql_native_password", "caching_sha2_password"];

    public constructor(props: ICreateUserDialogProps) {
        super(props);

        this.addHandledProperties("dialogRef", "editing", "onClose", "onValidate");
    }

    public static enableMfa(values: IDialogValues): void {
        CreateUserDialog.configureMfa(values);
    }

    public static createDialogValues(
        authenticationPlugins: string[] = [],
        defaults?: IMySQLDefaultUserOptions,
    ): IDialogValues {
        const pluginChoices = this.primaryAuthenticationPluginChoices(authenticationPlugins);
        const defaultAuthenticationPlugin = pluginChoices.includes("caching_sha2_password")
            ? "caching_sha2_password"
            : pluginChoices[0];
        const generalSection: IDialogSection = {
            values: {
                userName: {
                    type: "text",
                    caption: "User Name",
                    value: "",
                    placeholder: "<enter user name>",
                    horizontalSpan: 3,
                    options: [CommonDialogValueOption.AutoFocus],
                },
                hostName: {
                    type: "text",
                    caption: "Host",
                    value: "%",
                    placeholder: "<host or %>",
                    horizontalSpan: 3,
                },
                lockAccount: {
                    type: "boolean",
                    caption: "Lock Account",
                    value: false,
                    horizontalSpan: 2,
                },
                comment: {
                    type: "text",
                    caption: "Comment",
                    placeholder: "<comment string>",
                    multiLine: true,
                    multiLineCount: 4,
                    horizontalSpan: 8,
                },
            },
        };

        const authenticationSection: IDialogSection = {
            caption: "Authentication",
            groupName: "createUser",
            values: {
                authenticationPlugin: {
                    type: "choice",
                    caption: "Authentication Plugin",
                    value: defaultAuthenticationPlugin,
                    choices: pluginChoices,
                    horizontalSpan: 4,
                    onChange: (plugin, dialog): void => {
                        CreateUserDialog.updateFactorInputs("first", plugin, dialog);
                    },
                },
                randomPassword: {
                    type: "boolean",
                    caption: "Random Password",
                    value: false,
                    horizontalSpan: 2,
                    verticalAlignment: ContentAlignment.Center,
                    onChange: (enabled, dialog) => {
                        const authentication = dialog.getDialogValues().sections.get("authentication");
                        if (!authentication) {
                            return;
                        }

                        ["password", "passwordConfirmation"].forEach((key) => {
                            const field = authentication.values[key];
                            field.options = (field.options ?? []).filter((option) => {
                                return option !== CommonDialogValueOption.Disabled;
                            });
                            if (enabled) {
                                field.options.push(CommonDialogValueOption.Disabled);
                            }
                        });
                        dialog.setDialogValues(dialog.getDialogValues());
                    },
                },
                passwordExpire: {
                    type: "boolean",
                    caption: "Require Reset",
                    value: false,
                    horizontalSpan: 2,
                    verticalAlignment: ContentAlignment.Center,
                },
                password: {
                    type: "text",
                    caption: "Password",
                    value: "",
                    placeholder: "<enter password>",
                    obfuscated: true,
                    horizontalSpan: 4,
                },
                passwordConfirmation: {
                    type: "text",
                    caption: "Password Confirmation",
                    value: "",
                    placeholder: "<confirm password>",
                    obfuscated: true,
                    horizontalSpan: 4,
                },
                authenticationString: {
                    type: "text",
                    caption: "Authentication String",
                    value: "",
                    horizontalSpan: 8,
                    options: [CommonDialogValueOption.Hidden],
                },
            },
        };

        const advancedSection: IDialogSection = {
            caption: "Advanced",
            groupName: "createUser",
            values: {
                passwordManagement: {
                    type: "separator",
                    caption: "Password Management",
                    collapsible: true,
                    expanded: true,
                },
                passwordExpiration: {
                    type: "number",
                    caption: "Password Expiration",
                    value: defaults?.passwordLifetime ?? 0,
                    horizontalSpan: 4,
                    description: "Password valid for \u004e days (0 - forever)",
                },
                passwordHistory: {
                    type: "number",
                    caption: "Password History",
                    value: defaults?.passwordReuseHistory ?? 0,
                    horizontalSpan: 4,
                    description: "Prevent re-use of last \u004e passwords (0 - always allow)",
                },
                passwordReuseInterval: {
                    type: "number",
                    caption: "Password Re-use Interval",
                    value: defaults?.passwordReuseInterval ?? 0,
                    horizontalSpan: 4,
                    description: "Prevent re-use of password for \u004e days (0 - always allow)",
                },
                failedPasswordAttempts: {
                    type: "number",
                    caption: "Failed Attempts",
                    value: 0,
                    horizontalSpan: 4,
                    description: "Lock account after \u004e incorrect password entries",
                },
                passwordLockTime: {
                    type: "number",
                    caption: "Account Lock Interval",
                    value: 0,
                    horizontalSpan: 4,
                    description: "Lock account for \u004e days after too many failed password entries",
                },
                lockAccount: {
                    type: "boolean",
                    caption: "Password Change requires Password",
                    value: defaults?.passwordRequireCurrent ?? false,
                    horizontalSpan: 4,
                    description: "Changing the password should require the password itself",
                },
            },
        };

        const tlsSection: IDialogSection = {
            caption: "TLS",
            groupName: "createUser",
            values: {
                tlsMode: {
                    type: "custom",
                    value: {
                        tlsMode: "None",
                    },
                    component: <TlsModeSelector />,
                    horizontalSpan: 8,
                },
                tlsCipher: {
                    type: "text",
                    caption: "Cipher",
                    value: "",
                    placeholder: "<cipher list>",
                    multiLine: true,
                    multiLineCount: 3,
                    horizontalSpan: 8,
                },
                tlsIssuer: {
                    type: "text",
                    caption: "X.509 Issuer",
                    value: "",
                    placeholder: "<issuer>",
                    multiLine: true,
                    multiLineCount: 3,
                    horizontalSpan: 8,
                },
                tlsSubject: {
                    type: "text",
                    caption: "X.509 Subject",
                    value: "",
                    placeholder: "<subject>",
                    multiLine: true,
                    multiLineCount: 3,
                    horizontalSpan: 8,
                },
            },
        };

        const resourceLimitsSection: IDialogSection = {
            caption: "Resource Limits",
            groupName: "createUser",
            values: {
                maxQueriesPerHour: {
                    type: "number",
                    caption: "Max Queries/Hour",
                    value: 0,
                    horizontalSpan: 4,
                    description: "Maximum queries allowed per hour (0 - no limitation).",
                },
                maxConnectionsPerHour: {
                    type: "number",
                    caption: "Max Connections/Hour",
                    value: 0,
                    horizontalSpan: 4,
                    description: "Maximum connections allowed per hour (0 - no limitation).",
                },
                maxUpdatesPerHour: {
                    type: "number",
                    caption: "Max Updates/Hour",
                    value: 0,
                    horizontalSpan: 4,
                    description: "Maximum updates allowed per hour (0 - no limitation).",
                },
                maxUserConnections: {
                    type: "number",
                    caption: "Max User Connections",
                    value: defaults?.maxUserConnections ?? 0,
                    horizontalSpan: 4,
                    description: "Maximum concurrent connections for this account (0 - no limitation).",
                },
            },
        };

        const dialogValues = {
            id: "createUser",
            sections: new Map<string, IDialogSection>([
                ["general", generalSection],
                ["authentication", authenticationSection],
                ["tls", tlsSection],
                ["resourceLimits", resourceLimitsSection],
                ["advanced", advancedSection],
            ]),
        };
        this.updateFactorInputs("first", defaultAuthenticationPlugin, undefined, dialogValues);

        return dialogValues;
    }

    public render(): ComponentChild {
        const { dialogRef, editing, onClose, onValidate } = this.props;

        return (
            <ValueEditDialog
                ref={dialogRef}
                id="createUserDialog"
                advancedActionCaption="Enable MFA"
                advancedActionDisabled={(values) => {
                    return Object.hasOwn(values.sections.get("authentication")?.values ?? {}, "firstFactor");
                }}
                advancedAction={(values) => {
                    CreateUserDialog.enableMfa(values);
                }}
                confirmCaption={editing ? "Apply" : undefined}
                onClose={onClose}
                onValidate={onValidate}
            />
        );
    }

    private static configureMfa(values: IDialogValues): void {
        const authentication = values.sections.get("authentication");
        if (!authentication || Object.hasOwn(authentication.values, "firstFactor")) {
            return;
        }

        const primaryPlugin = authentication.values.authenticationPlugin;
        if (primaryPlugin.type !== "choice") {
            return;
        }

        const pluginChoices = primaryPlugin.choices;
        const additionalPluginChoices = ["None", ...pluginChoices.filter((plugin) => {
            return !plugin.endsWith("_password");
        })];
        primaryPlugin.onChange = (plugin, dialog): void => {
            CreateUserDialog.updateFactorInputs("first", plugin, dialog);
        };

        authentication.values = {
            firstFactor: {
                type: "separator",
                caption: "1st Factor",
                collapsible: true,
                expanded: true,
            },
            authenticationPlugin: primaryPlugin,
            authenticationString: authentication.values.authenticationString,
            randomPassword: authentication.values.randomPassword,
            passwordExpire: authentication.values.passwordExpire,
            password: authentication.values.password,
            passwordConfirmation: authentication.values.passwordConfirmation,
            firstFactorEnd: {
                type: "separator",
                endCollapsible: true,
            },
            ...CreateUserDialog.additionalFactorValues("second", "2nd", additionalPluginChoices),
            ...CreateUserDialog.additionalFactorValues("third", "3rd", additionalPluginChoices),
        };
        CreateUserDialog.updateFactorInputs("first", primaryPlugin.value ?? "", undefined, values);
    }

    private static additionalFactorValues(
        factor: "second" | "third", ordinal: string, pluginChoices: string[],
    ): IDialogSection["values"] {
        return {
            [`${factor}Factor`]: {
                type: "separator",
                caption: `${ordinal} Factor`,
                collapsible: true,
                expanded: true,
            },
            [`${factor}AuthenticationPlugin`]: {
                type: "choice",
                caption: "Authentication Plugin",
                value: "None",
                choices: pluginChoices,
                horizontalSpan: 4,
                onChange: (plugin, dialog): void => {
                    CreateUserDialog.updateFactorInputs(factor, plugin, dialog);
                },
            },
            [`${factor}AuthenticationString`]: {
                type: "text",
                caption: "Authentication String",
                value: "",
                horizontalSpan: 8,
                options: [CommonDialogValueOption.Hidden],
            },
            [`${factor}FactorEnd`]: {
                type: "separator",
                endCollapsible: true,
            },
        };
    }

    // Used while prefilling MFA factors for user editing.
    // eslint-disable-next-line @typescript-eslint/member-ordering
    public static updateFactorInputs(
        factor: "first" | "second" | "third", plugin: string, dialog?: ValueEditDialog, values?: IDialogValues,
    ): void {
        const dialogValues = values ?? dialog?.getDialogValues();
        const authentication = dialogValues?.sections.get("authentication");
        if (!dialogValues || !authentication) {
            return;
        }

        // A dialog is supplied for interactive plugin changes, but not when prefilling an account.
        if (dialog) {
            const credentialKey = factor === "first" ? "authenticationString" : `${factor}AuthenticationString`;
            authentication.values[credentialKey].value = "";
            if (factor === "first") {
                authentication.values.password.value = "";
                authentication.values.passwordConfirmation.value = "";
            }
        }

        if (factor === "second" && plugin === "None") {
            const thirdPlugin = authentication.values.thirdAuthenticationPlugin;
            const thirdAuthenticationString = authentication.values.thirdAuthenticationString;
            if (thirdPlugin.type === "choice" && thirdPlugin.value !== "None") {
                authentication.values.secondAuthenticationPlugin.value = thirdPlugin.value;
                authentication.values.secondAuthenticationString.value = thirdAuthenticationString.value;
                thirdPlugin.value = "None";
                thirdAuthenticationString.value = "";
                plugin = authentication.values.secondAuthenticationPlugin.value ?? "None";
                CreateUserDialog.updateFactorInputs("third", "None", undefined, dialogValues);
            }
        }

        let showPasswordInputs = false;
        let showAuthenticationString = false;
        let authenticationStringCaption = "Authentication String";
        let authenticationStringDescription: string | undefined;
        let documentationUrl: string | undefined =
            "https://dev.mysql.com/doc/refman/en/pluggable-authentication.html";
        let pluginDescription: string | undefined;

        switch (plugin) {
            case "caching_sha2_password":
                documentationUrl =
                    "https://dev.mysql.com/doc/refman/en/caching-sha2-pluggable-authentication.html";
                pluginDescription = "Authenticate using MySQL managed passwords.";
                showPasswordInputs = true;
                break;

            case "mysql_native_password":
                documentationUrl =
                    "https://dev.mysql.com/doc/refman/en/native-pluggable-authentication.html";
                pluginDescription = "Authenticate using MySQL managed passwords (deprecated)";
                showPasswordInputs = true;
                break;

            case "sha256_password":
                documentationUrl =
                    "https://dev.mysql.com/doc/refman/en/sha256-pluggable-authentication.html";
                pluginDescription = "Authenticate using MySQL managed passwords (deprecated)";
                showPasswordInputs = true;
                break;

            case "authentication_pam":
                documentationUrl = "https://dev.mysql.com/doc/refman/en/pam-pluggable-authentication.html";
                pluginDescription = "Authenticates through the Linux/macOS PAM service.";
                showAuthenticationString = true;
                authenticationStringCaption = "PAM Service";
                authenticationStringDescription = "Auth string for the PAM service name (eg. mysql-unix).";
                break;

            case "authentication_kerberos":
                documentationUrl = "https://dev.mysql.com/doc/refman/en/kerberos-pluggable-authentication.html";
                pluginDescription = "Kerberos identity and ticket-based auth service.";
                showAuthenticationString = true;
                authenticationStringCaption = "Kerberos Realm";
                authenticationStringDescription = "Kerberos realm for this account (eg. MYSQL.LOCAL).";
                break;

            case "authentication_ldap_simple":
            case "authentication_ldap_sasl":
                documentationUrl = "https://dev.mysql.com/doc/refman/en/ldap-pluggable-authentication.html";
                if (plugin === "authentication_ldap_simple") {
                    pluginDescription = "Username and password through an LDAP directory.";
                } else {
                    pluginDescription = "LDAP directory using SASL-based mechanisms.";
                }
                showAuthenticationString = true;
                authenticationStringCaption = "LDAP User DN";
                authenticationStringDescription = "Optional LDAP distinguished name for this account.";
                break;

            case "authentication_windows":
                documentationUrl = "https://dev.mysql.com/doc/refman/en/windows-pluggable-authentication.html";
                pluginDescription = "MS Windows credentials through Windows native authentication.";
                showAuthenticationString = true;
                authenticationStringCaption = "Windows User or Group Mappings";
                authenticationStringDescription =
                    "Comma-separated Windows users or groups permitted to use this account.";
                break;

            case "authentication_webauthn":
                documentationUrl = "https://dev.mysql.com/doc/refman/en/webauthn-pluggable-authentication.html";
                pluginDescription = "Use a FIDO2/WebAuthn hardware security key or other method.";
                break;

            case "mysql_no_login":
                documentationUrl = "https://dev.mysql.com/doc/refman/en/no-login-pluggable-authentication.html";
                pluginDescription = "Blocks authentication and log in for the account.";
                break;

            case "None":
                documentationUrl = undefined;
                break;

            case "auth_socket":
                documentationUrl = "https://dev.mysql.com/doc/refman/en/socket-pluggable-authentication.html";
                pluginDescription = "Use the OS account associated with the local socket connection.";
                break;

            default:
                showPasswordInputs = plugin.endsWith("_password");
                showAuthenticationString = !showPasswordInputs;
                break;
        }

        const authenticationPluginKey = factor === "first" ? "authenticationPlugin" :
            `${factor}AuthenticationPlugin`;
        const authenticationPlugin = authentication.values[authenticationPluginKey];
        if (authenticationPlugin.type === "choice" && documentationUrl) {
            authenticationPlugin.trailingLink = {
                url: documentationUrl,
                caption: pluginDescription ?? plugin,
            };
        } else if (authenticationPlugin.type === "choice") {
            delete authenticationPlugin.trailingLink;
        }

        if (factor === "first") {
            ["randomPassword", "passwordExpire", "password", "passwordConfirmation"].forEach((key) => {
                const value = authentication.values[key];
                value.options = (value.options ?? []).filter((option) => {
                    return option !== CommonDialogValueOption.Hidden;
                });
                if (!showPasswordInputs) {
                    value.options.push(CommonDialogValueOption.Hidden);
                }
            });
            if (!showPasswordInputs) {
                authentication.values.randomPassword.value = false;
                ["password", "passwordConfirmation"].forEach((key) => {
                    const value = authentication.values[key];
                    value.options = (value.options ?? []).filter((option) => {
                        return option !== CommonDialogValueOption.Disabled;
                    });
                });
            }
        }
        const authenticationStringKey = factor === "first" ? "authenticationString" : `${factor}AuthenticationString`;
        const authenticationGuidanceKey = factor === "first"
            ? "authenticationGuidance"
            : `${factor}AuthenticationGuidance`;
        if (plugin === "authentication_webauthn") {
            authentication.values[authenticationGuidanceKey] = {
                type: "description",
                value: "After creating this account, register a WebAuthn device with a WebAuthn-capable client.",
                horizontalSpan: 8,
            };
        } else {
            delete authentication.values[authenticationGuidanceKey];
        }

        const authenticationString = authentication.values[authenticationStringKey];
        authenticationString.caption = authenticationStringCaption;
        authenticationString.description = authenticationStringDescription;
        authenticationString.options = (authenticationString.options ?? []).filter((option) => {
            return option !== CommonDialogValueOption.Hidden;
        });
        if (!showAuthenticationString) {
            authenticationString.options.push(CommonDialogValueOption.Hidden);
        }
        dialog?.setDialogValues(dialogValues);
    }

    private static primaryAuthenticationPluginChoices(authenticationPlugins: string[]): string[] {
        return authenticationPlugins.length > 0 ? authenticationPlugins : this.fallbackAuthenticationPlugins;
    }
}
