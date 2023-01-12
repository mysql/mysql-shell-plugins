/*
 * Copyright (c) 2023, Oracle and/or its affiliates.
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

import React from "react";
import { DialogResponseClosure, IDialogRequest, IDictionary } from "../../../app-logic/Types";
import { IMrsUserData, IMrsAuthAppData } from "../../../communication/";

import {
    CommonDialogValueOption, IDialogSection, IDialogValidations, IDialogValues, ValueDialogBase,
    ValueEditDialog,
} from "../../../components/Dialogs";

const mrsVendorId = "MAAAAAAAAAAAAAAAAAAAAA==";

export class MrsUserDialog extends ValueDialogBase {
    private dialogRef = React.createRef<ValueEditDialog>();
    private currentAuthApp: IMrsAuthAppData | null = null;

    public render(): React.ReactNode {
        return (
            <ValueEditDialog
                ref={this.dialogRef}
                id="mrsUserDialog"
                onClose={this.handleCloseDialog}
                onValidate={this.validateInput}
            />
        );
    }

    public show(request: IDialogRequest, title: string): void {
        const authApps = request.parameters?.authApps as IMrsAuthAppData[];

        this.dialogRef.current?.show(this.dialogValues(request, title, authApps),
            { title: "MySQL REST User" });
    }

    private dialogValues(request: IDialogRequest, title: string, authApps: IMrsAuthAppData[]): IDialogValues {
        const data = (request.values as unknown) as IMrsUserData;
        this.currentAuthApp = request.parameters?.authApp as IMrsAuthAppData;

        const mainSection: IDialogSection = {
            caption: title,
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
                    type: "choice",
                    caption: "Authentication App",
                    choices: authApps ? [""].concat(authApps.map((authApp) => {
                        return authApp.name ? authApp.name: "";
                    })) : [],
                    value: this.currentAuthApp.name,
                    horizontalSpan: 2,
                    description: "The authentication app",
                },
                email: {
                    type: "text",
                    caption: "Email",
                    value: data.email,
                    horizontalSpan: 6,
                    description: "The email of the user",
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
                    description: "The options stored for this user",
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

    private handleCloseDialog = (closure: DialogResponseClosure, dialogValues: IDialogValues): void => {
        const { onClose } = this.props;

        if (closure === DialogResponseClosure.Accept) {
            const mainSection = dialogValues.sections.get("mainSection");

            if (mainSection) {
                const values: IDictionary = {};
                values.authAppName = mainSection.values.authApp.value as string;
                values.name = mainSection.values.name.value as string;
                values.email = mainSection.values.email.value as string;
                values.vendorUserId = mainSection.values.vendorUserId.value as string;
                values.loginPermitted = mainSection.values.loginPermitted.value as string;
                values.mappedUserId = mainSection.values.mappedUserId.value as string;
                values.appOptions = mainSection.values.appOptions.value as string;
                values.authString = mainSection.values.authString.value as string;

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

}
