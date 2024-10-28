/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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

import { DialogResponseClosure, IDialogRequest, IDictionary } from "../../../app-logic/general-types.js";
import { IMrsAuthAppData, IMrsRoleData, IMrsUserData, IMrsUserRoleData } from "../../../communication/ProtocolMrs.js";
import { AwaitableValueEditDialog } from "../../../components/Dialogs/AwaitableValueEditDialog.js";
import {
    CommonDialogValueOption, IDialogSection, IDialogValidations, IDialogValues,
} from "../../../components/Dialogs/ValueEditDialog.js";

const mrsVendorId = "MAAAAAAAAAAAAAAAAAAAAA==";

export interface IMrsUserDialogData extends IDictionary {
    authAppName: string;
    name?: string;
    email?: string;
    vendorUserId?: string;
    loginPermitted: boolean;
    mappedUserId?: string;
    appOptions?: string;
    authString?: string;
    userRoles: string[];
}

export class MrsUserDialog extends AwaitableValueEditDialog {
    private currentAuthApp: IMrsAuthAppData | null = null;

    protected override get id(): string {
        return "mrsUserDialog";
    }

    public override async show(request: IDialogRequest): Promise<IDictionary | DialogResponseClosure> {
        const availableRoles = request.parameters?.availableRoles as IMrsRoleData[];
        const userRoles = request.parameters?.userRoles as IMrsUserRoleData[];

        const dialogValues = this.dialogValues(request, availableRoles, userRoles);
        const result = await this.doShow(() => { return dialogValues; }, { title: "MySQL REST User" });

        if (result.closure === DialogResponseClosure.Accept) {
            return this.processResults(result.values);
        }

        return DialogResponseClosure.Cancel;
    }

    protected override validateInput = (closing: boolean, values: IDialogValues): IDialogValidations => {
        const result: IDialogValidations = {
            messages: {},
            requiredContexts: [],
        };

        if (closing) {
            const mainSection = values.sections.get("mainSection");
            if (mainSection) {
                if (this.currentAuthApp?.authVendorId === mrsVendorId) {
                    if (!mainSection.values.name.value && !mainSection.values.email.value) {
                        result.messages.name = "The user name or email are required for this app.";
                    }
                    if (!mainSection.values.authString.value) {
                        result.messages.authString = "The authentication string is required for this app.";
                    }
                }

            }
        }

        return result;
    };

    private dialogValues(request: IDialogRequest, availableRoles: IMrsRoleData[],
        userRoles: IMrsUserRoleData[]): IDialogValues {
        const data = (request.values as unknown) as IMrsUserData;
        this.currentAuthApp = request.parameters?.authApp as IMrsAuthAppData;

        const rolesToDisplay = userRoles.map((role) => {
            return availableRoles.find((availableRole) => {
                return availableRole.id === role.roleId;
            })?.caption ?? "unknown role";
        });

        const mainSection: IDialogSection = {
            caption: request.title,
            values: {
                name: {
                    type: "text",
                    caption: "User Name",
                    value: data.name,
                    horizontalSpan: 3,
                    description: "The name of the user",
                    options: [
                        CommonDialogValueOption.AutoFocus,
                    ],
                },
                authString: {
                    type: "text",
                    caption: "User Password",
                    value: data.authString,
                    horizontalSpan: 3,
                    obfuscated: true,
                    description: "The password of the user",
                },
                authApp: {
                    type: "text",
                    caption: "Authentication App",
                    value: this.currentAuthApp.name,
                    horizontalSpan: 2,
                    description: "The authentication app",
                    options: [CommonDialogValueOption.ReadOnly],
                },
                email: {
                    type: "text",
                    caption: "Email",
                    value: data.email,
                    horizontalSpan: 3,
                    description: "The email of the user",
                },
                roles: {
                    type: "set",
                    caption: "Assigned Roles",
                    tagSet: availableRoles.map((role) => {
                        return role.caption;
                    }),
                    value: rolesToDisplay,
                    horizontalSpan: 3,
                    description: "Roles assign DB Object privileges to the user.",
                },
                loginPermittedTitle: {
                    type: "description",
                    caption: "",
                    horizontalSpan: 2,
                    options: [
                        CommonDialogValueOption.Grouped,
                        CommonDialogValueOption.NewGroup,
                    ],
                },
                loginPermitted: {
                    type: "boolean",
                    caption: "Permit Login",
                    value: data.loginPermitted,
                    horizontalSpan: 2,
                    description: "Allow user to log in",
                    options: [
                        CommonDialogValueOption.Grouped,
                    ],
                },
                appOptions: {
                    type: "text",
                    caption: "User Options",
                    value: data.appOptions ? JSON.stringify(data.appOptions) : "",
                    horizontalSpan: 6,
                    verticalSpan: 2,
                    description: "Additional options in JSON format",
                    multiLine: true,
                },
                vendorUserId: {
                    type: "text",
                    caption: "Vendor User Id",
                    value: data.vendorUserId,
                    horizontalSpan: 2,
                    description: "Set by OAuth2 vendors",
                },
                mappedUserId: {
                    type: "text",
                    caption: "Mapped User Id",
                    value: data.mappedUserId,
                    horizontalSpan: 2,
                    description: "Optional id for sync-ing",
                },
            },
        };

        return {
            id: "mainSection",
            sections: new Map<string, IDialogSection>([
                ["mainSection", mainSection],
            ]),
        };
    }

    private processResults = (dialogValues: IDialogValues): IDictionary => {
        const mainSection = dialogValues.sections.get("mainSection");

        if (mainSection) {
            const values: IMrsUserDialogData = {
                authAppName: mainSection.values.authApp.value as string,
                name: mainSection.values.name.value as string,
                email: mainSection.values.email.value as string,
                vendorUserId: mainSection.values.vendorUserId.value as string,
                loginPermitted: mainSection.values.loginPermitted.value as boolean,
                mappedUserId: mainSection.values.mappedUserId.value as string,
                appOptions: mainSection.values.appOptions.value as string,
                authString: mainSection.values.authString.value as string,
                userRoles: mainSection.values.roles.value as string[],
            };

            return values;
        }

        return {};
    };
}
