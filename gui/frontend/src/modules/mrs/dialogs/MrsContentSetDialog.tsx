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
    ignoreList: string;
}

export class MrsContentSetDialog extends AwaitableValueEditDialog {
    protected override get id(): string {
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

                try {
                    if (mainSection.values.options.value) {
                        JSON.parse(mainSection.values.options.value as string);
                    }
                } catch (e) {
                    result.messages.options = `The options need to confirm to JSON format. (${String(e)})`;
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

        // Check if options.containsMrsScripts === true
        let newOptions = "";
        let containsMrsScripts = false;
        let buildFolder = "build/";
        if (request.values && request.values.options) {
            const options = JSON.parse(request.values.options as string);
            if ("containsMrsScripts" in options) {
                containsMrsScripts = options.containsMrsScripts === true;
                options.containsMrsScripts = undefined;
            }
            if ("buildFolder" in options) {
                buildFolder = options.buildFolder;
                options.buildFolder = undefined;
            }
            newOptions = JSON.stringify(options, undefined, 4);
            if (newOptions === "{}") {
                newOptions = "";
            }
        }

        const mainSection: IDialogSection = {
            caption: request.title,
            values: {
                requestPath: {
                    type: "text",
                    caption: "Request Path",
                    value: request.values?.requestPath as string,
                    horizontalSpan: 3,
                    options: [
                        CommonDialogValueOption.AutoFocus,
                    ],
                    description: "The request path to access the content, has to start with /",
                },
                service: {
                    type: "choice",
                    caption: "REST Service Path",
                    value: selectedService?.fullServicePath ?? "",
                    choices: services.map((service) => {
                        return service.fullServicePath ?? "";
                    }),
                    horizontalSpan: 3,
                    description: "The MRS Service to hold the content",
                },
                flags: {
                    type: "description",
                    caption: "MRS Object Flags",
                    horizontalSpan: 2,
                    options: [
                        CommonDialogValueOption.Grouped,
                        CommonDialogValueOption.NewGroup,
                    ],
                },
                enabled: {
                    type: "boolean",
                    caption: "Enabled",
                    horizontalSpan: 2,
                    value: (request.values?.enabled ?? true) as boolean,
                    options: [
                        CommonDialogValueOption.Grouped,
                    ],
                },
                requiresAuth: {
                    type: "boolean",
                    caption: "Requires Auth",
                    horizontalSpan: 2,
                    value: (request.values?.requiresAuth ?? true) as boolean,
                    options: [
                        CommonDialogValueOption.Grouped,
                    ],
                },
                directory: {
                    type: "resource",
                    caption: "Folder to upload",
                    value: request.values?.directory as string,
                    horizontalSpan: 5,
                    description: "The folder that should be uploaded, including all its files and sub-folders",
                },
                ignoreList: {
                    type: "text",
                    caption: "Files to ignore",
                    value: "*node_modules/*, */.*",
                    horizontalSpan: 3,
                    description: "A list of files to ignore, use * and ? for pattern matching",
                },
                containsMrsScripts: {
                    type: "boolean",
                    caption: "MRS Scripts",
                    label: "Contains MRS Scripts written in TypeScript",
                    horizontalSpan: 5,
                    value: containsMrsScripts,
                    description: "If checked, the MRS scripts and triggers will be loaded from this content set",
                },
                buildFolder: {
                    type: "text",
                    caption: "Javascript Build Folder",
                    value: buildFolder,
                    horizontalSpan: 3,
                    description: "The name of the JavaScript build folder",
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
                    value: newOptions,
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
            const options = JSON.parse(mainSection.values.options.value as string || "{}") ;
            options.containsMrsScripts = mainSection.values.containsMrsScripts.value as boolean;
            options.buildFolder = mainSection.values.buildFolder.value as string;
            const newOptions = JSON.stringify(options, undefined, 4);

            const values: IMrsContentSetDialogData = {
                serviceId: services.find((service) => {
                    return mainSection.values.service.value === service.fullServicePath;
                })?.id ?? "",
                requestPath: mainSection.values.requestPath.value as string,
                requiresAuth: mainSection.values.requiresAuth.value as boolean,
                enabled: mainSection.values.enabled.value as boolean,
                comments: mainSection.values.comments.value as string,
                options: newOptions,
                directory: mainSection.values.directory.value as string,
                ignoreList: mainSection.values.ignoreList.value as string,
            };

            return values;
        }

        return {};
    };

}
