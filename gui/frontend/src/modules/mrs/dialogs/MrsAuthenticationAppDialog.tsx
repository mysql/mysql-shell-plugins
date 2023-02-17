/*
 * Copyright (c) 2021, 2023, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with MySQL.
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { createRef, ComponentChild } from "preact";

import { DialogResponseClosure, IDialogRequest, IDictionary } from "../../../app-logic/Types";
import { IMrsAuthAppData, IMrsAuthVendorData, IMrsRoleData } from "../../../communication/ProtocolMrs";
import { ValueDialogBase } from "../../../components/Dialogs/ValueDialogBase";
import {
    CommonDialogValueOption, IDialogSection, IDialogValidations, IDialogValues, ValueEditDialog,
} from "../../../components/Dialogs/ValueEditDialog";

export class MrsAuthenticationAppDialog extends ValueDialogBase {
    private dialogRef = createRef<ValueEditDialog>();

    public render(): ComponentChild {
        return (
            <ValueEditDialog
                ref={this.dialogRef}
                id="mrsAuthenticationAppDialog"
                onClose={this.handleCloseDialog}
                onValidate={this.validateInput}
            />
        );
    }

    public show(request: IDialogRequest, title: string): void {
        const authVendors = request.parameters?.authVendors as IMrsAuthVendorData[];
        const roles = request.parameters?.roles as IMrsRoleData[];

        this.dialogRef.current?.show(this.dialogValues(request, title, authVendors, roles),
            { title: "MySQL REST Authentication App" });
    }

    private dialogValues(request: IDialogRequest, title: string,
        authVendors: IMrsAuthVendorData[], roles: IMrsRoleData[]): IDialogValues {
        const appData = (request.values as unknown) as IMrsAuthAppData;
        const mainSection: IDialogSection = {
            caption: title,
            values: {
                authVendorName: {
                    type: "choice",
                    caption: "Vendor",
                    choices: authVendors ? [""].concat(authVendors.map((authVendor) => {
                        return authVendor.name;
                    })) : [],
                    value: appData.authVendorName,
                    description: "The authentication vendor",
                },
                name: {
                    type: "text",
                    caption: "Name",
                    value: appData.name,
                    description: "The name of the authentication app",
                },
                description: {
                    type: "text",
                    caption: "Description",
                    value: appData.description,
                    description: "A short description of the app",
                },
                accessToken: {
                    type: "text",
                    caption: "Access Token",
                    value: appData.accessToken,
                    description: "The OAuth2 access token for this app as defined by the vendor",
                },
                appId: {
                    type: "text",
                    caption: "App ID",
                    value: appData.appId,
                    description: "The OAuth2 App ID for this app as defined by the vendor",
                },
                url: {
                    type: "text",
                    caption: "Custom URL",
                    value: appData.url,
                    description: "A custom OAuth2 service URL",
                },
                urlDirectAuth: {
                    type: "text",
                    caption: "Custom URL for Access Token",
                    value: appData.urlDirectAuth,
                    description: "A custom URL for exchanging the Access Token",
                },
                defaultRoleName: {
                    type: "choice",
                    caption: "Default Role",
                    choices: roles ? roles.map((role) => {
                        return role.caption;
                    }) : [],
                    value: appData.defaultRoleId ?? "",
                    description: "The default role for users",
                    optional: true,
                },
                flags: {
                    type: "description",
                    caption: "Flags",
                    options: [
                        CommonDialogValueOption.Grouped,
                        CommonDialogValueOption.NewGroup,
                    ],
                },
                enabled: {
                    type: "boolean",
                    caption: "Enabled",
                    value: appData.enabled,
                    options: [
                        CommonDialogValueOption.Grouped,
                    ],
                },
                limitToRegisteredUsers: {
                    type: "boolean",
                    caption: "Limit to registered users",
                    value: appData.limitToRegisteredUsers,
                    options: [
                        CommonDialogValueOption.Grouped,
                    ],
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

    private handleCloseDialog = (closure: DialogResponseClosure, dialogValues: IDialogValues): void => {
        const { onClose } = this.props;

        if (closure === DialogResponseClosure.Accept) {
            const mainSection = dialogValues.sections.get("mainSection");

            if (mainSection) {
                const values: IDictionary = {};
                values.authVendorName = mainSection.values.authVendorName.value as string;
                values.name = mainSection.values.name.value as string;
                values.description = mainSection.values.description.value as string;
                values.accessToken = mainSection.values.accessToken.value as string;
                values.appId = mainSection.values.appId.value as string;
                values.url = mainSection.values.url.value as string;
                values.urlDirectAuth = mainSection.values.urlDirectAuth.value as string;
                values.enabled = mainSection.values.enabled.value as string;
                values.limitToRegisteredUsers = mainSection.values.limitToRegisteredUsers.value as string;
                values.defaultRoleName = mainSection.values.defaultRoleName.value as string;

                onClose(closure, values);
            }
        } else {
            onClose(closure);
        }
    };

    private validateInput = (closing: boolean, values: IDialogValues): IDialogValidations => {
        const result: IDialogValidations = {
            messages: {},
            requiredContexts: [],
        };

        const mainSection = values.sections.get("mainSection");

        if (closing) {
            if (mainSection) {
                if (!mainSection.values.authVendorName.value) {
                    result.messages.authVendorName = "The vendor name must not be empty.";
                }
                if (!mainSection.values.name.value) {
                    result.messages.name = "The name must not be empty.";
                }
            }
        } else if (mainSection) {
            if (mainSection.values.name.value as string === "" || mainSection.values.name.value === undefined) {
                mainSection.values.name.value = mainSection.values.authVendorName.value as string;
            }
        }

        return result;
    };

}
