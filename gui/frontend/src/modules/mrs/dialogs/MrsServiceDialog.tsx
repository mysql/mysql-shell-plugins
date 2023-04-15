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

import { ComponentChild, createRef } from "preact";
import { DialogResponseClosure, IDialogRequest, IDictionary } from "../../../app-logic/Types";
import { IMrsAuthVendorData, IMrsAuthAppData } from "../../../communication/ProtocolMrs";
import { ValueDialogBase } from "../../../components/Dialogs/ValueDialogBase";
import {
    ValueEditDialog, IDialogValues, IDialogSection, CommonDialogValueOption, IDialogValidations,
    IRelationDialogValue,
} from "../../../components/Dialogs/ValueEditDialog";

export class MrsServiceDialog extends ValueDialogBase {
    private dialogRef = createRef<ValueEditDialog>();

    public render(): ComponentChild {
        return (
            <ValueEditDialog
                ref={this.dialogRef}
                id="mrsServiceDialog"
                onClose={this.handleCloseDialog}
                onValidate={this.validateInput}
            />
        );
    }

    public show(request: IDialogRequest, title: string): void {
        const authVendors = request.parameters?.authVendors as IMrsAuthVendorData[];

        this.dialogRef.current?.show(this.dialogValues(request, title, authVendors), { title: "MySQL REST Service" },
            request.parameters?.payload as IDictionary);
    }

    private dialogValues(request: IDialogRequest, title: string, authVendors: IMrsAuthVendorData[]): IDialogValues {
        const mainSection: IDialogSection = {
            caption: title,
            values: {
                servicePath: {
                    type: "text",
                    caption: "REST Service Path",
                    value: request.values?.servicePath as string,
                    horizontalSpan: 3,
                    options: [CommonDialogValueOption.AutoFocus],
                    description: "The URL context root of this service.",
                },
                comments: {
                    type: "text",
                    caption: "Comments",
                    value: request.values?.comments as string,
                    horizontalSpan: 5,
                    description: "Comments to describe this MRS Service.",
                },
                hostName: {
                    type: "text",
                    caption: "Host Name Filter",
                    value: request.values?.hostName as string,
                    horizontalSpan: 3,
                    description: "If specified, only requests for this host will served.",
                    placeholder: "<Host Name Filter:Port>",
                },
                protocols: {
                    type: "set",
                    caption: "Supported Protocols",
                    horizontalSpan: 3,
                    tagSet: ["HTTP", "HTTPS"],
                    value: request.values?.protocols as string[] ?? [],
                    description: "The supported protocols.",
                },
                makeDefaultTitle: {
                    type: "description",
                    caption: "MRS Service Flags",
                    horizontalSpan: 2,
                    options: [
                        CommonDialogValueOption.Grouped,
                        CommonDialogValueOption.NewGroup,
                    ],
                },
                enabled: {
                    type: "boolean",
                    caption: "Enabled",
                    value: (request.values?.enabled ?? true) as boolean,
                    horizontalSpan: 2,
                    options: [
                        CommonDialogValueOption.Grouped,
                    ],
                },
                makeDefault: {
                    type: "boolean",
                    caption: "Default",
                    value: (request.values?.isCurrent ?? true) as boolean,
                    horizontalSpan: 2,
                    options: [
                        CommonDialogValueOption.Grouped,
                    ],
                },
            },
        };

        const authSection: IDialogSection = {
            caption: "Authentication",
            groupName: "group1",
            values: {
                authPath: {
                    type: "text",
                    caption: "Authentication Path:",
                    value: request.values?.authPath as string,
                    horizontalSpan: 4,
                    description: "The path used for authentication.",
                },
                authCompletedUrl: {
                    type: "text",
                    caption: "Redirection URL:",
                    value: request.values?.authCompletedUrl as string,
                    horizontalSpan: 4,
                    description: "The authentication workflow will redirect to this URL after login.",
                },
                authCompletedUrlValidation: {
                    type: "text",
                    caption: "Redirection URL Validation:",
                    value: request.values?.authCompletedUrlValidation as string,
                    horizontalSpan: 4,
                    description: "A regular expression to validate the /login?onCompletionRedirect "
                        + "parameter set by the app.",
                },
                authCompletedPageContent: {
                    type: "text",
                    caption: "Authentication Completed Page Content:",
                    value: request.values?.authCompletedPageContent as string,
                    multiLine: true,
                    horizontalSpan: 4,
                    description: "If this field is set its content will replace the page content of the "
                        + "/completed page.",
                },
            },
        };

        const appData = request.values?.authApps as Array<IMrsAuthAppData & IDictionary> ?? [];
        const authAppSection: IDialogSection = {
            caption: "Authentication Apps",
            groupName: "group1",
            values: {
                authApps: {
                    type: "relation",
                    caption: "Apps:",
                    value: appData,
                    listItemCaptionFields: ["name"],
                    listItemId: "id",
                    active: appData.length > 0 ? String(appData[0].id) : undefined,
                    horizontalSpan: 2,
                    verticalSpan: 4,
                    relations: {
                        authVendorName: "appAuthVendorName",
                        name: "appName",
                        description: "appDescription",
                        url: "appUrl",
                        urlDirectAuth: "appUrlDirectAuth",
                        accessToken: "appAccessToken",
                        appId: "appId",
                        enabled: "appEnabled",
                        limitToRegisteredUsers: "appLimitToRegisteredUsers",
                    },
                },
                appAuthVendorName: {
                    type: "choice",
                    caption: "Vendor",
                    choices: authVendors ? [""].concat(authVendors.map((authVendor) => {
                        return authVendor.name;
                    })) : [],
                    value: "",
                    horizontalSpan: 3,
                    description: "The authentication vendor",
                },
                appName: {
                    type: "text",
                    caption: "Name",
                    value: "",
                    horizontalSpan: 3,
                    description: "The name of the app",
                },
                appDescription: {
                    type: "text",
                    caption: "Description",
                    value: "",
                    horizontalSpan: 3,
                    description: "A short description of the app",
                },
                flags: {
                    type: "description",
                    caption: "Auth App Flags",
                    horizontalSpan: 3,
                    options: [
                        CommonDialogValueOption.Grouped,
                        CommonDialogValueOption.NewGroup,
                    ],
                },
                appEnabled: {
                    type: "boolean",
                    caption: "Enabled",
                    horizontalSpan: 3,
                    value: true,
                    options: [
                        CommonDialogValueOption.Grouped,
                    ],
                },
                appLimitToRegisteredUsers: {
                    type: "boolean",
                    caption: "Limit to registered users",
                    horizontalSpan: 3,
                    value: true,
                    options: [
                        CommonDialogValueOption.Grouped,
                    ],
                },
                appId: {
                    type: "text",
                    caption: "App ID",
                    value: "",
                    horizontalSpan: 3,
                    description: "The OAuth2 App ID for this app as defined by the vendor",
                },
                appAccessToken: {
                    type: "text",
                    caption: "Access Token",
                    value: "",
                    horizontalSpan: 3,
                    description: "The OAuth2 access token for this app as defined by the vendor",
                },
                appUrl: {
                    type: "text",
                    caption: "Custom URL",
                    value: "",
                    horizontalSpan: 3,
                    description: "A custom OAuth2 service URL",
                },
                appUrlDirectAuth: {
                    type: "text",
                    caption: "Custom URL for Access Token",
                    value: "",
                    horizontalSpan: 3,
                    description: "A custom URL for exchanging the Access Token",
                },
            },
        };

        const optionsSection: IDialogSection = {
            caption: "Options",
            groupName: "group1",
            values: {
                options: {
                    type: "text",
                    caption: "Options in JSON Format:",
                    value: request.values?.options as string,
                    horizontalSpan: 8,
                    multiLine: true,
                },
            },
        };

        return {
            id: "mainSection",
            sections: new Map<string, IDialogSection>([
                ["mainSection", mainSection],
                ["optionsSection", optionsSection],
                ["authSection", authSection],
                ["authAppSection", authAppSection],
            ]),
        };
    }

    private handleCloseDialog = (closure: DialogResponseClosure, dialogValues: IDialogValues,
        payload?: IDictionary): void => {
        const { onClose } = this.props;

        if (closure === DialogResponseClosure.Accept) {
            const mainSection = dialogValues.sections.get("mainSection");
            const optionsSection = dialogValues.sections.get("optionsSection");
            const authSection = dialogValues.sections.get("authSection");
            const authAppSection = dialogValues.sections.get("authAppSection");
            if (mainSection && optionsSection && authSection && authAppSection) {
                const values: IDictionary = {};
                values.servicePath = mainSection.values.servicePath.value as string;
                values.comments = mainSection.values.comments.value as string;
                values.hostName = mainSection.values.hostName.value as string;
                values.isCurrent = mainSection.values.makeDefault.value as boolean;
                values.enabled = mainSection.values.enabled.value as boolean;
                values.protocols = mainSection.values.protocols.value as string[];
                values.options = optionsSection.values.options.value as string;
                values.authPath = authSection.values.authPath.value as string;
                values.authCompletedUrlValidation =
                    authSection.values.authCompletedUrlValidation.value as string;
                values.authCompletedUrl = authSection.values.authCompletedUrl.value as string;
                values.authCompletedPageContent = authSection.values.authCompletedPageContent.value as string;
                values.authApps = authAppSection.values.authApps.value as Array<IMrsAuthAppData & IDictionary>;
                values.payload = payload;

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
                if (!mainSection.values.servicePath.value) {
                    result.messages.servicePath = "The service name must not be empty.";
                } else {
                    const servicePath = mainSection.values.servicePath.value as string;
                    if (!servicePath.startsWith("/")) {
                        result.messages.servicePath = "The request path must start with /.";
                    }
                }
            }
        } else {
            // Detect change of the <new> entry
            const authAppSection = values.sections.get("authAppSection");
            if (authAppSection && authAppSection.values.authApps) {
                const authAppsDlgValue = authAppSection.values.authApps as IRelationDialogValue;
                const authApps = authAppsDlgValue.value as Array<IMrsAuthAppData & IDictionary>;
                const newEntry = authApps.find((p) => {
                    return p.id === "";
                });
                // Detect a change of the <new> entry
                if (newEntry && (newEntry.authVendorName !== "" || newEntry.name !== "<new>")) {
                    // Update id and position
                    newEntry.id = `${authApps.length * -1}`;
                    newEntry.position = authApps.length;

                    if (newEntry.authVendorName && newEntry.name === "<new>") {
                        newEntry.name = newEntry.authVendorName;
                    }

                    authAppsDlgValue.active = newEntry.id;


                    authApps.push({
                        id: "",
                        authVendorId: "",
                        authVendorName: "",
                        serviceId: "",
                        name: "<new>",
                        description: "",
                        url: "",
                        urlDirectAuth: "",
                        accessToken: "",
                        appId: "",
                        enabled: true,
                        useBuiltInAuthorization: true,
                        limitToRegisteredUsers: true,
                        defaultRoleId: "MQAAAAAAAAAAAAAAAAAAAA==",
                    });
                }
            }
        }

        return result;
    };

}
