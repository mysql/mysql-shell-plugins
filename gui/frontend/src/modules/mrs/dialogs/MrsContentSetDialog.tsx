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

import { DialogResponseClosure, IDialogRequest, IDictionary } from "../../../app-logic/Types.js";
import { IMrsServiceData } from "../../../communication/ProtocolMrs.js";
import { AwaitableValueEditDialog } from "../../../components/Dialogs/AwaitableValueEditDialog.js";
import {
    IDialogValues, IDialogSection, CommonDialogValueOption, IDialogValidations,
} from "../../../components/Dialogs/ValueEditDialog.js";

export interface IMrsContentSetDialogData extends IDictionary {
    serviceId: string;
    requestPath: string;
    requiresAuth: boolean;
    enabled: boolean;
    comments: string;
    options: string;
    directory: string;

}

export class MrsContentSetDialog extends AwaitableValueEditDialog {
    protected get id(): string {
        return "mrsContentSetDialog";
    }

    public override async show(request: IDialogRequest): Promise<IDictionary | DialogResponseClosure> {
        const services = request.parameters?.services as IMrsServiceData[];

        const dialogValues = this.dialogValues(request, services);
        const result = await this.doShow(() => { return dialogValues; }, { title: "MRS Content Set" });

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
            return request.values?.serviceId === service.id;
        });

        if (services.length > 0 && !selectedService) {
            selectedService = services[0];
        }

        const mainSection: IDialogSection = {
            caption: request.title,
            values: {
                requestPath: {
                    type: "text",
                    caption: "Request Path",
                    value: request.values?.requestPath as string,
                    horizontalSpan: 4,
                    options: [
                        CommonDialogValueOption.AutoFocus,
                    ],
                    description: "The request path to access the content, has to start with /",
                },
                service: {
                    type: "choice",
                    caption: "MRS Service",
                    value: selectedService?.hostCtx,
                    choices: services.map((service) => {
                        return service.hostCtx;
                    }),
                    horizontalSpan: 4,
                    description: "The MRS Service to hold the content",
                },
                directory: {
                    type: "resource",
                    caption: "Folder to upload",
                    value: request.values?.directory as string,
                    horizontalSpan: 8,
                    options: request.values?.directory ? [] : [CommonDialogValueOption.Hidden],
                    description: "The folder that should be uploaded, including all its files and sub-folders",
                },
                enabled: {
                    type: "boolean",
                    caption: "Enabled",
                    horizontalSpan: 4,
                    value: (request.values?.enabled ?? true) as boolean,
                    description: "Defines if the static content should be made available",
                },
                requiresAuth: {
                    type: "boolean",
                    caption: "Requires Authentication",
                    horizontalSpan: 4,
                    value: (request.values?.requiresAuth ?? true) as boolean,
                    description: "Only authenticated users can access the content if checked",
                },
                comments: {
                    type: "text",
                    caption: "Comments",
                    value: request.values?.comments as string,
                    horizontalSpan: 8,
                },
                options: {
                    type: "text",
                    caption: "Options",
                    value: request.values?.options as string,
                    horizontalSpan: 8,
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
            const values: IMrsContentSetDialogData = {
                serviceId: services.find((service) => {
                    return mainSection.values.service.value === service.hostCtx;
                })?.id ?? "",
                requestPath: mainSection.values.requestPath.value as string,
                requiresAuth: mainSection.values.requiresAuth.value as boolean,
                enabled: mainSection.values.enabled.value as boolean,
                comments: mainSection.values.comments.value as string,
                options: mainSection.values.options.value as string,
                directory: mainSection.values.directory.value as string,
            };

            return values;
        }

        return {};
    };

}
