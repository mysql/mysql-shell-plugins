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
import { AwaitableValueEditDialog } from "../../../components/Dialogs/AwaitableValueEditDialog.js";
import {
    CommonDialogValueOption, IDialogSection, IDialogValidations, IDialogValues,
} from "../../../components/Dialogs/ValueEditDialog.js";
import { appParameters } from "../../../supplement/Requisitions.js";

export interface IMrsSdkExportDialogData extends IDictionary {
    serviceId: string,
    sdkLanguage: string,
    directory?: string,
    serviceUrl: string,
    addAppBaseClass?: string,
}

export interface IMrsSdkAppClass {
    language: string,
    appBaseClasses: string[],
}

export class MrsSdkExportDialog extends AwaitableValueEditDialog {
    #serviceId = "";

    protected override get id(): string {
        return "mrsSdkExportDialog";
    }

    public override async show(request: IDialogRequest): Promise<IDictionary | DialogResponseClosure> {
        const languages = request.parameters?.languages as string[];
        const serviceName = request.parameters?.serviceName as string;
        const appBaseClasses = request.parameters?.appBaseClasses as IMrsSdkAppClass[];

        const dialogValues = this.dialogValues(request, languages, serviceName, appBaseClasses);
        const result = await this.doShow(() => { return dialogValues; },
            { title: `Export MRS SDK for ${serviceName}` });

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
                if (appParameters.embedded && !mainSection.values.directory.value) {
                    result.messages.directory = "Please specify a directory.";
                }
            }
        }

        return result;
    };

    private dialogValues(request: IDialogRequest, languages: string[], serviceName: string,
        appBaseClasses: IMrsSdkAppClass[]): IDialogValues {
        const data = (request.values as unknown) as IMrsSdkExportDialogData;

        this.#serviceId = data.serviceId;

        const langAppBaseClasses = (appBaseClasses.find((appBaseClass) => {
            return appBaseClass.language === (data.sdkLanguage ?? languages[0]);
        })?.appBaseClasses ?? []);

        const mainSection: IDialogSection = {
            caption: request.title,
            values: {
                directory: {
                    type: "resource",
                    caption: "Directory",
                    value: data.directory,
                    canSelectFolders: true,
                    canSelectFiles: false,
                    horizontalSpan: 8,
                    description: "The directory where the SDK files should be written",
                },
                serviceUrl: {
                    type: "text",
                    caption: "REST Service URL",
                    value: data.serviceUrl,
                    horizontalSpan: 8,
                    description: "The URL to access the REST Service",
                    options: [
                        CommonDialogValueOption.AutoFocus,
                    ],
                },
                sdkLanguage: {
                    type: "choice",
                    caption: "SDK Client API Language",
                    choices: languages,
                    value: data.sdkLanguage ?? languages[0],
                    horizontalSpan: 4,
                    description: "The development language that should be used for generation",
                },
                addAppBaseClass: {
                    type: "choice",
                    caption: "Include AppBaseClass",
                    choices: langAppBaseClasses,
                    value: data.addAppBaseClass,
                    optional: true,
                    horizontalSpan: 4,
                    description: "Add an application BaseClass with core MRS functionality.",
                },
                header: {
                    type: "text",
                    caption: "SDK File Header",
                    value: data.header as string ??
                        `/* Copyright (c) ${new Date().getFullYear()}, Oracle and/or its affiliates. */`,
                    horizontalSpan: 8,
                    description: "The header that should be applied to the generated SDK files.",
                    multiLine: true,
                    multiLineCount: 4,
                },
            },
        };

        if (!appParameters.embedded) {
            delete mainSection.values.directory;
        }

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
            const values: IMrsSdkExportDialogData = {
                serviceId: this.#serviceId,
                directory: appParameters.embedded ? mainSection.values.directory.value as string : undefined,
                sdkLanguage: mainSection.values.sdkLanguage.value as string,
                serviceUrl: mainSection.values.serviceUrl.value as string,
                addAppBaseClass: mainSection.values.addAppBaseClass.value as string,
            };

            return values;
        }

        return {};
    };
}
