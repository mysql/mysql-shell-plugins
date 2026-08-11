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
import { Container, Orientation } from "../../components/ui/Container/Container.js";
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

    public static createDialogValues(
        authenticationPlugins: string[] = [],
        defaults?: IMySQLDefaultUserOptions,
    ): IDialogValues {
        const pluginChoices = this.authenticationPluginChoices(authenticationPlugins);
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
                },
                randomPassword: {
                    type: "boolean",
                    caption: "Random Password",
                    value: false,
                    horizontalSpan: 2,
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
                passwordManagement: {
                    type: "separator",
                    caption: "Password Management",
                    collapsible: true,
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

        return {
            id: "createUser",
            sections: new Map<string, IDialogSection>([
                ["general", generalSection],
                ["authentication", authenticationSection],
                ["tls", tlsSection],
                ["resourceLimits", resourceLimitsSection],
            ]),
        };
    }

    public render(): ComponentChild {
        const { dialogRef, editing, onClose, onValidate } = this.props;

        return (
            <ValueEditDialog
                ref={dialogRef}
                id="createUserDialog"
                confirmCaption={editing ? "Apply" : undefined}
                onClose={onClose}
                onValidate={onValidate}
            />
        );
    }

    private static authenticationPluginChoices(authenticationPlugins: string[]): string[] {
        const choices = [...new Set(authenticationPlugins.map((plugin) => {
            return plugin.trim();
        }).filter((plugin) => {
            return plugin.endsWith("_password");
        }))];

        return choices.length > 0 ? choices : this.fallbackAuthenticationPlugins;
    }
}
