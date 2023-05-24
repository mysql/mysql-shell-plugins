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

import { DialogResponseClosure, IDialogRequest, IDictionary } from "../../../app-logic/Types";
import { IMrsServiceData } from "../../../communication/ProtocolMrs";
import { AwaitableValueEditDialog } from "../../../components/Dialogs/AwaitableValueEditDialog";
import {
    IDialogValues, IDialogSection, CommonDialogValueOption, IDialogValidations,
} from "../../../components/Dialogs/ValueEditDialog";

export interface IMrsSchemaDialogData extends IDictionary {
    name: string;
    serviceId: string;
    requestPath: string;
    requiresAuth: boolean;
    enabled: boolean;
    itemsPerPage: number;
    comments: string;
    options: string;
}

export class MrsSchemaDialog extends AwaitableValueEditDialog {
    protected get id(): string {
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
            if (mainSection) {
                if (!mainSection.values.name.value) {
                    result.messages.name = "The schema name must not be empty.";
                }
                if (!mainSection.values.requestPath.value) {
                    result.messages.requestPath = "The request path must not be empty.";
                } else {
                    const requestPath = mainSection.values.requestPath.value as string;
                    if (!requestPath.startsWith("/")) {
                        result.messages.requestPath = "The request path must start with /.";
                    }
                }
            }
        }

        return result;
    };

    private dialogValues(request: IDialogRequest, services: IMrsServiceData[]): IDialogValues {

        let selectedService = services.find((service) => {
            return service.isCurrent === 1;
        });

        if (services.length > 0 && !selectedService) {
            selectedService = services[0];
        }

        const mainSection: IDialogSection = {
            caption: request.title,
            values: {
                service: {
                    type: "choice",
                    caption: "REST Service Path",
                    value: selectedService?.hostCtx,
                    choices: services.map((service) => {
                        return service.hostCtx;
                    }),
                    horizontalSpan: 3,
                    description: "The path of the REST Service this REST Schema belongs to",
                },
                comments: {
                    type: "text",
                    caption: "Comments",
                    value: request.values?.comments as string,
                    horizontalSpan: 5,
                    description: "Comments to describe this REST Schema.",
                },
                requestPath: {
                    type: "text",
                    caption: "REST Schema Path",
                    value: request.values?.requestPath as string,
                    horizontalSpan: 3,
                    options: [CommonDialogValueOption.AutoFocus],
                    description: "The request path to access the schema, has to start with /",
                },
                name: {
                    type: "text",
                    caption: "Schema Name",
                    value: request.values?.name as string,
                    horizontalSpan: 3,
                    description: "The name of the corresponding database schema.",
                },
                itemsPerPage: {
                    type: "text",
                    caption: "Items per Page",
                    horizontalSpan: 2,
                    value: request.values?.itemsPerPage as string,
                },
                flagsTitle: {
                    type: "description",
                    caption: "Flags",
                    horizontalSpan: 3,
                    options: [
                        CommonDialogValueOption.Grouped,
                        CommonDialogValueOption.NewGroup,
                    ],
                },
                enabled: {
                    type: "boolean",
                    caption: "Enabled",
                    horizontalSpan: 3,
                    value: (request.values?.enabled ?? true) as boolean,
                    options: [CommonDialogValueOption.Grouped],
                },
                requiresAuth: {
                    type: "boolean",
                    caption: "Requires Authentication",
                    horizontalSpan: 3,
                    value: (request.values?.requiresAuth ?? true) as boolean,
                    options: [CommonDialogValueOption.Grouped],
                },
                options: {
                    type: "text",
                    caption: "Options",
                    value: request.values?.options as string,
                    horizontalSpan: 5,
                    multiLine: true,
                    description: "Additional options in JSON format",
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

    private processResults = (dialogValues: IDialogValues, services: IMrsServiceData[]): IDictionary => {
        const mainSection = dialogValues.sections.get("mainSection");
        if (mainSection) {
            const values: IMrsSchemaDialogData = {
                name: mainSection.values.name.value as string,
                serviceId: services.find((service) => {
                    return mainSection.values.service.value === service.hostCtx;
                })?.id ?? "",
                requestPath: mainSection.values.requestPath.value as string,
                requiresAuth: mainSection.values.requiresAuth.value as boolean,
                enabled: mainSection.values.enabled.value as boolean,
                itemsPerPage: mainSection.values.itemsPerPage.value as number,
                comments: mainSection.values.comments.value as string,
                options: mainSection.values.options.value as string,
            };

            return values;
        }

        return {};
    };

}
