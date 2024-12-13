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
import { AwaitableValueEditDialog } from "../../../components/Dialogs/AwaitableValueEditDialog.js";
import {
    CommonDialogValueOption, IDialogSection, IDialogValidations, IDialogValues,
} from "../../../components/Dialogs/ValueEditDialog.js";

export interface IMrsServiceDialogData extends IDictionary {
    servicePath: string;
    name: string;
    comments: string;
    hostName: string;
    isCurrent: boolean;
    enabled: boolean;
    published: boolean;
    protocols: string[];
    options: string;
    authPath: string;
    authCompletedUrlValidation: string;
    authCompletedUrl: string;
    authCompletedPageContent: string;
    metadata: string;
    mrsAdminUser?: string;
    mrsAdminUserPassword?: string;
}

export class MrsServiceDialog extends AwaitableValueEditDialog {
    protected override get id(): string {
        return "mrsServiceDialog";
    }

    public override async show(request: IDialogRequest): Promise<IDictionary | DialogResponseClosure> {
        const dialogValues = this.dialogValues(request);
        const result = await this.doShow(() => { return dialogValues; }, { title: "MySQL REST Service" });

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
                const servicePath = mainSection.values.servicePath.value as string;
                if (!servicePath) {
                    result.messages.servicePath = "The service path must not be empty.";
                } else if (!servicePath.startsWith("/")) {
                    result.messages.servicePath = "The request path must start with /.";
                } else if (servicePath.toLowerCase() === "/mrs") {
                    result.messages.servicePath = `The request path \`${servicePath}\` is reserved and cannot be used.`;
                }

                const name = mainSection.values.name.value as string;
                if (!name) {
                    result.messages.name = "The service name must not be empty.";
                }
            }
            const settingsSection = values.sections.get("settingsSection");
            if (settingsSection) {
                if (settingsSection.values.mrsAdminUser?.value
                    && !settingsSection.values.mrsAdminUserPassword?.value) {
                    result.messages.mrsAdminUserPassword = "Please specify a password for the MRS Admin User.";
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
                if (optionsSection.values.metadata.value) {
                    try {
                        JSON.parse(optionsSection.values.metadata.value as string);
                    } catch (e) {
                        result.messages.metadata = "Please provide a valid JSON object.";
                    }
                }
            }
        }

        return result;
    };

    private dialogValues(request: IDialogRequest): IDialogValues {
        const mainSection: IDialogSection = {
            caption: request.title,
            values: {
                servicePath: {
                    type: "text",
                    caption: "REST Service Path",
                    value: request.values?.servicePath as string,
                    horizontalSpan: 3,
                    options: [CommonDialogValueOption.AutoFocus],
                    description: "The URL context root of this service, has to start with / and needs to be unique.",
                },
                name: {
                    type: "text",
                    caption: "REST Service Name",
                    value: request.values?.name as string,
                    horizontalSpan: 3,
                    description: "The descriptive name of the REST service.",
                },
                makeDefaultTitle: {
                    type: "description",
                    caption: "REST Service Flags",
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
                published: {
                    type: "boolean",
                    caption: "Published",
                    value: (request.values?.published ?? false) as boolean,
                    horizontalSpan: 2,
                    options: [
                        CommonDialogValueOption.Grouped,
                    ],
                },
            },
        };

        const settingsSection: IDialogSection = {
            caption: "Settings",
            groupName: "group1",
            values: {},
        };

        // If this is a new service, show the option to create a MRS auth app and user name
        if (!request.values?.serviceId) {
            settingsSection.values.mrsAdminUser = {
                type: "text",
                caption: "Create MRS Admin User",
                value: "",
                horizontalSpan: 4,
                description: "If a user name is given, a MRS Auth App will be created and the " +
                    "user will be added.",
            };
            settingsSection.values.mrsAdminUserPassword = {
                type: "text",
                caption: "MRS Admin User Password",
                obfuscated: true,
                value: "",
                horizontalSpan: 4,
                description: "The password of the MRS Admin User.",
            };
        }

        settingsSection.values.comments = {
            type: "text",
            caption: "Comments",
            value: request.values?.comments as string,
            multiLine: true,
            multiLineCount: 3,
            horizontalSpan: 8,
            description: "Comments to describe this REST Service.",
        };

        const optionsSection: IDialogSection = {
            caption: "Options",
            groupName: "group1",
            values: {
                options: {
                    type: "text",
                    caption: "Options:",
                    value: request.values?.options as string,
                    horizontalSpan: 8,
                    multiLine: true,
                    multiLineCount: 8,
                    description: "Additional options in JSON format",
                },
                metadata: {
                    type: "text",
                    caption: "Metadata:",
                    value: request.values?.metadata as string,
                    horizontalSpan: 8,
                    multiLine: true,
                    multiLineCount: 8,
                    description: "Metadata settings in JSON format",
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

        const advancedSection: IDialogSection = {
            caption: "Advanced",
            groupName: "group1",
            values: {
                hostName: {
                    type: "text",
                    caption: "Host Name Filter",
                    value: request.values?.hostName as string,
                    horizontalSpan: 5,
                    description: "If specified, the REST service will only be made available " +
                        "to requests for this specific host.",
                    placeholder: "<Host Name Filter:Port>",
                },
                protocols: {
                    type: "set",
                    caption: "Supported Protocols",
                    horizontalSpan: 3,
                    tagSet: ["HTTP", "HTTPS"],
                    value: request.values?.protocols as string[] ?? [],
                    description: "The protocols the REST service is accessed on. HTTPS is preferred.",
                },
            },
        };

        return {
            id: "mainSection",
            sections: new Map<string, IDialogSection>([
                ["mainSection", mainSection],
                ["settingsSection", settingsSection],
                ["optionsSection", optionsSection],
                ["authSection", authSection],
                ["advancedSection", advancedSection],
            ]),
        };
    }

    private processResults = (dialogValues: IDialogValues): IDictionary => {
        const mainSection = dialogValues.sections.get("mainSection");
        const settingsSection = dialogValues.sections.get("settingsSection");
        const optionsSection = dialogValues.sections.get("optionsSection");
        const authSection = dialogValues.sections.get("authSection");
        const advancedSection = dialogValues.sections.get("advancedSection");

        if (mainSection && settingsSection && optionsSection && authSection && advancedSection) {
            const values: IMrsServiceDialogData = {
                servicePath: mainSection.values.servicePath.value as string,
                name: mainSection.values.name.value as string,
                comments: settingsSection.values.comments.value as string,
                isCurrent: mainSection.values.makeDefault.value as boolean,
                enabled: mainSection.values.enabled.value as boolean,
                published: mainSection.values.published.value as boolean,
                options: optionsSection.values.options.value as string,
                authPath: authSection.values.authPath.value as string,
                authCompletedUrlValidation: authSection.values.authCompletedUrlValidation.value as string,
                authCompletedUrl: authSection.values.authCompletedUrl.value as string,
                authCompletedPageContent: authSection.values.authCompletedPageContent.value as string,
                metadata: optionsSection.values.metadata.value as string,
                mrsAdminUser: settingsSection.values.mrsAdminUser?.value as string | undefined,
                mrsAdminUserPassword: settingsSection.values.mrsAdminUserPassword?.value as string | undefined,
                hostName: advancedSection.values.hostName.value as string,
                protocols: advancedSection.values.protocols.value as string[],
            };

            return values;
        }

        return {};
    };
}
