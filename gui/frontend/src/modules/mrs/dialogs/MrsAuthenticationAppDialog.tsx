/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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
import { IMrsAuthAppData, IMrsAuthVendorData, IMrsRoleData } from "../../../communication/ProtocolMrs.js";
import { AwaitableValueEditDialog } from "../../../components/Dialogs/AwaitableValueEditDialog.js";
import {
    CommonDialogValueOption, DialogValueType, IDialogSection, IDialogValidations, IDialogValues,
    ValueEditDialog,
} from "../../../components/Dialogs/ValueEditDialog.js";

export interface IMrsAuthenticationAppDialogData extends IDictionary {
    authVendorName: string;
    name: string;
    description: string;
    accessToken: string;
    appId: string;
    url: string;
    urlDirectAuth: string;
    enabled: boolean;
    limitToRegisteredUsers: boolean;
    defaultRoleName: string;
    options: string;
}

export class MrsAuthenticationAppDialog extends AwaitableValueEditDialog {
    protected override get id(): string {
        return "mrsAuthenticationAppDialog";
    }

    public override async show(request: IDialogRequest): Promise<IDictionary | DialogResponseClosure> {
        const authVendors = request.parameters?.authVendors as IMrsAuthVendorData[];
        const roles = request.parameters?.roles as IMrsRoleData[];
        const appData = (request.values as unknown) as IMrsAuthAppData;

        const contexts = [];
        if (appData.authVendorName && appData.authVendorName !== "MRS" && appData.authVendorName !== "MySQL Internal") {
            contexts.push("oAuth");
        }

        const dialogValues = this.dialogValues(request, authVendors, roles);
        const result = await this.doShow(() => { return dialogValues; },
            { title: "MySQL REST Authentication App", contexts });

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

        const mainSection = values.sections.get("mainSection");

        if (closing) {
            if (mainSection) {
                if (!mainSection.values.authVendorName.value) {
                    result.messages.authVendorName = "The vendor name must not be empty.";
                }
                if (!mainSection.values.name.value) {
                    result.messages.name = "The name must not be empty.";
                }

                if (mainSection.values.authVendorName.value !== "MRS" &&
                    mainSection.values.authVendorName.value !== "MySQL Internal") {
                        const oAuthSection = values.sections.get("oAuthSection");
                        if (!oAuthSection?.values.url.value) {
                            result.messages.url = "The App URL must not be empty for OAuth2 auth apps.";
                        }
                        if (!oAuthSection?.values.appId.value) {
                            result.messages.appId = "The App ID must not be empty for OAuth2 auth apps.";
                        }
                        if (!oAuthSection?.values.accessToken.value) {
                            result.messages.accessToken = "The App Secret must not be empty for OAuth2 auth apps.";
                        }
                }
            }

            const optionsSection = values.sections.get("optionsSection");
            if (optionsSection) {
                if (optionsSection.values.options.value) {
                    try {
                        JSON.parse(optionsSection.values.options.value as string);
                    } catch (e) {
                        result.messages.options = "Please provide a valid JSON object.";
                    }
                }
            }
        } else if (mainSection) {
            if (mainSection.values.name.value as string === "" || mainSection.values.name.value === undefined) {
                const vendorName = mainSection.values.authVendorName.value as string;
                if (vendorName === "OCI OAuth2") {
                    mainSection.values.name.value = "OCI";
                } else {
                    mainSection.values.name.value = vendorName.replace(/\s/g, "");
                }
            }
        }

        return result;
    };

    private dialogValues(request: IDialogRequest, authVendors: IMrsAuthVendorData[],
        roles: IMrsRoleData[]): IDialogValues {
        const appData = (request.values as unknown) as IMrsAuthAppData;
        const mainSection: IDialogSection = {
            caption: request.title,
            values: {
                authVendorName: {
                    type: "choice",
                    caption: "Vendor",
                    choices: authVendors ? authVendors.map((authVendor) => {
                        return authVendor.name;
                    }) : [],
                    value: appData.authVendorName,
                    description: "The authentication vendor",
                    horizontalSpan: 2,
                    onChange: (value: DialogValueType, dialog: ValueEditDialog): void => {
                        if (value as string === "MRS" || value as string === "MySQL Internal") {
                            dialog.updateActiveContexts({remove: ["oAuth"]});
                        } else {
                            dialog.updateActiveContexts({add: ["oAuth"]});
                        }
                    },
                },
                name: {
                    type: "text",
                    caption: "Name",
                    value: appData.name,
                    description: "The name of the authentication app",
                    horizontalSpan: 3,
                },
                flags: {
                    type: "description",
                    caption: "Flags",
                    options: [
                        CommonDialogValueOption.Grouped,
                        CommonDialogValueOption.NewGroup,
                    ],
                    horizontalSpan: 3,
                },
                enabled: {
                    type: "boolean",
                    caption: "Enabled",
                    value: appData.enabled,
                    options: [
                        CommonDialogValueOption.Grouped,
                    ],
                    horizontalSpan: 3,
                },
                limitToRegisteredUsers: {
                    type: "boolean",
                    caption: "Limit to registered users",
                    value: appData.limitToRegisteredUsers,
                    options: [
                        CommonDialogValueOption.Grouped,
                    ],
                    horizontalSpan: 3,
                },
            },
        };

        const settingsSection: IDialogSection = {
            caption: "Settings",
            groupName: "group1",
            values: {
                description: {
                    type: "text",
                    caption: "Description",
                    value: appData.description,
                    description: "A short description of the app",
                    horizontalSpan: 5,
                    multiLine: true,
                    multiLineCount: 8,
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
                    horizontalSpan: 3,
                },
            },
        };

        const oAuthSection: IDialogSection = {
            contexts: ["oAuth"],
            caption: "OAuth2 Settings",
            groupName: "group1",
            values: {
                url: {
                    type: "text",
                    caption: "Custom URL",
                    value: appData.url,
                    description: "A custom OAuth2 service URL",
                    horizontalSpan: 8,
                },
                appId: {
                    type: "text",
                    caption: "App ID",
                    value: appData.appId,
                    description: "The OAuth2 App ID/Client ID for this app as defined by the vendor",
                    horizontalSpan: 4,
                },
                accessToken: {
                    type: "text",
                    caption: "App Secret",
                    value: appData.accessToken,
                    description: "The OAuth2 App Secret/Client Secret for this app as defined by the vendor",
                    horizontalSpan: 4,
                    obfuscated: true,
                },
                urlDirectAuth: {
                    type: "text",
                    caption: "Custom URL for Access Token",
                    value: appData.urlDirectAuth,
                    description: "A custom URL for exchanging the Access Token",
                    horizontalSpan: 8,
                },
            },
        };

        const optionsSection: IDialogSection = {
            caption: "Options",
            groupName: "group1",
            values: {
                options: {
                    type: "text",
                    caption: "Options",
                    value: request.values?.options as string,
                    horizontalSpan: 8,
                    multiLine: true,
                    multiLineCount: 8,
                    description: "Additional options in JSON format",
                },
            },
        };

        return {
            id: "mainSection",
            sections: new Map<string, IDialogSection>([
                ["mainSection", mainSection],
                ["oAuthSection", oAuthSection],
                ["settingsSection", settingsSection],
                ["optionsSection", optionsSection],
            ]),
        };
    }

    private processResults = (dialogValues: IDialogValues): IDictionary => {
        const mainSection = dialogValues.sections.get("mainSection");
        const settingsSection = dialogValues.sections.get("settingsSection");
        const oAuthSection = dialogValues.sections.get("oAuthSection");
        const optionsSection = dialogValues.sections.get("optionsSection");

        if (mainSection && settingsSection && oAuthSection && optionsSection) {
            const values: IMrsAuthenticationAppDialogData = {
                authVendorName: mainSection.values.authVendorName.value as string,
                name: mainSection.values.name.value as string,
                enabled: mainSection.values.enabled.value as boolean,
                limitToRegisteredUsers: mainSection.values.limitToRegisteredUsers.value as boolean,
                description: settingsSection.values.description.value as string,
                defaultRoleName: settingsSection.values.defaultRoleName.value as string,
                accessToken: oAuthSection.values.accessToken.value as string,
                appId: oAuthSection.values.appId.value as string,
                url: oAuthSection.values.url.value as string,
                urlDirectAuth: oAuthSection.values.urlDirectAuth.value as string,
                options: optionsSection.values.options.value as string,
            };

            return values;
        }

        return {};
    };

}
