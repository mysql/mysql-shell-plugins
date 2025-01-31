/*
 * Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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
import { IMrsServiceData } from "../../../communication/ProtocolMrs.js";
import { AwaitableValueEditDialog } from "../../../components/Dialogs/AwaitableValueEditDialog.js";
import {
    IDialogValues, IDialogSection, CommonDialogValueOption, IDialogValidations,
} from "../../../components/Dialogs/ValueEditDialog.js";
import { EnabledState, getEnabledState } from "../mrs-helpers.js";

export interface IMrsSchemaDialogData extends IDictionary {
    dbSchemaName: string;
    serviceId: string;
    requestPath: string;
    requiresAuth: boolean;
    enabled: number;
    itemsPerPage: number;
    comments: string;
    options: string;
    metadata: string;
}

export class MrsSchemaDialog extends AwaitableValueEditDialog {
    protected override get id(): string {
        return "mrsSchemaDialog";
    }

    public override async show(request: IDialogRequest): Promise<IDictionary | DialogResponseClosure> {
        const services = request.parameters?.services as IMrsServiceData[] ?? [];

        const dialogValues = this.dialogValues(request, services);
        const result = await this.doShow(() => { return dialogValues; }, { title: "MySQL REST Schema" });
        if (result.closure === DialogResponseClosure.Accept) {
            return this.processResults(result.values, services);
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
            const settingsSection = values.sections.get("settingsSection");
            if (mainSection && settingsSection) {
                if (!settingsSection.values.dbSchemaName.value) {
                    result.messages.dbSchemaName = "The database schema name must not be empty.";
                }
                const requestPath = mainSection.values.requestPath.value as string;
                if (!requestPath) {
                    result.messages.requestPath = "The request path must not be empty.";
                } else if (!requestPath.startsWith("/")) {
                    result.messages.requestPath = "The request path must start with /.";
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

            const metadataSection = values.sections.get("metadataSection");
            if (metadataSection) {
                if (metadataSection.values.metadata.value) {
                    try {
                        JSON.parse(metadataSection.values.metadata.value as string);
                    } catch (e) {
                        result.messages.metadata = "Please provide a valid JSON object.";
                    }
                }
            }
        }

        return result;
    };

    private dialogValues(request: IDialogRequest, services: IMrsServiceData[]): IDialogValues {

        let selectedService = services.find((service) => {
            return service.id === request.values?.serviceId;
        });

        if (selectedService === undefined) {
            selectedService = services.find((service) => {
                return service.isCurrent === 1;
            });
        }

        if (services.length > 0 && !selectedService) {
            selectedService = services[0];
        }

        const mainSection: IDialogSection = {
            caption: request.title,
            values: {
                service: {
                    type: "choice",
                    caption: "REST Service Path",
                    value: selectedService?.fullServicePath ?? "",
                    choices: services.map((service) => {
                        return service.fullServicePath ?? "";
                    }),
                    horizontalSpan: 3,
                    description: "The path of the REST Service this REST Schema belongs to.",
                },
                requestPath: {
                    type: "text",
                    caption: "REST Schema Path",
                    value: request.values?.requestPath as string,
                    horizontalSpan: 3,
                    options: [CommonDialogValueOption.AutoFocus],
                    description: "The request path to access the schema, has to start with / and needs to be unique.",
                },
                flagsTitle: {
                    type: "description",
                    caption: "REST Schema Flags",
                    horizontalSpan: 2,
                    options: [
                        CommonDialogValueOption.Grouped,
                        CommonDialogValueOption.NewGroup,
                    ],
                },
                enabled: {
                    type: "choice",
                    caption: "Access",
                    choices: ["Access DISABLED", "Access ENABLED", "PRIVATE Access Only"],
                    horizontalSpan: 2,
                    value: request.values?.enabled === EnabledState.PrivateOnly ? "PRIVATE Access Only" :
                        request.values?.enabled === EnabledState.Enabled ? "Access ENABLED" : "Access DISABLED",
                    options: [
                        CommonDialogValueOption.Grouped,
                    ],
                },
                requiresAuth: {
                    type: "boolean",
                    caption: "Auth. Required",
                    horizontalSpan: 2,
                    value: (request.values?.requiresAuth ?? true) as boolean,
                    options: [CommonDialogValueOption.Grouped],
                },
            },
        };

        const settingsSection: IDialogSection = {
            caption: "Settings",
            groupName: "group1",
            values: {
                dbSchemaName: {
                    type: "text",
                    caption: "Database Schema Name",
                    value: request.values?.dbSchemaName as string,
                    horizontalSpan: 5,
                    description: "The name of the corresponding database schema.",
                },
                itemsPerPage: {
                    type: "text",
                    caption: "Items per Page",
                    horizontalSpan: 3,
                    value: request.values?.itemsPerPage as string,
                },
                comments: {
                    type: "text",
                    caption: "Comments",
                    value: request.values?.comments as string,
                    horizontalSpan: 8,
                    description: "Comments to describe this REST Schema.",
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

        const metadataSection: IDialogSection = {
            caption: "Metadata",
            groupName: "group1",
            values: {
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

        return {
            id: "mainSection",
            sections: new Map<string, IDialogSection>([
                ["mainSection", mainSection],
                ["settingsSection", settingsSection],
                ["optionsSection", optionsSection],
                ["metadataSection", metadataSection],
            ]),
        };
    }

    private processResults = (dialogValues: IDialogValues, services: IMrsServiceData[]): IDictionary => {
        const mainSection = dialogValues.sections.get("mainSection");
        const settingsSection = dialogValues.sections.get("settingsSection");
        const optionsSection = dialogValues.sections.get("optionsSection");
        const metadataSection = dialogValues.sections.get("metadataSection");
        if (mainSection && settingsSection && optionsSection && metadataSection) {
            const values: IMrsSchemaDialogData = {
                dbSchemaName: settingsSection.values.dbSchemaName.value as string,
                serviceId: services.find((service) => {
                    return mainSection.values.service.value === service.fullServicePath;
                })?.id ?? "",
                requestPath: mainSection.values.requestPath.value as string,
                requiresAuth: mainSection.values.requiresAuth.value as boolean,
                enabled: getEnabledState(mainSection.values.enabled.value as string),
                itemsPerPage: settingsSection.values.itemsPerPage.value as number,
                comments: settingsSection.values.comments.value as string,
                options: optionsSection.values.options.value as string,
                metadata: metadataSection.values.metadata.value as string,
            };

            return values;
        }

        return {};
    };

}
