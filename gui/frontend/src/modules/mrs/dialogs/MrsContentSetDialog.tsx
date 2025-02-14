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
import {
    IMrsServiceData, type IMrsScriptDefinitions, type IMrsScriptModuleFile,
} from "../../../communication/ProtocolMrs.js";
import { AwaitableValueEditDialog } from "../../../components/Dialogs/AwaitableValueEditDialog.js";
import {
    CommonDialogValueOption, IDialogSection, IDialogValidations, IDialogValues, ValueEditDialog,
} from "../../../components/Dialogs/ValueEditDialog.js";
import { StatusBar } from "../../../components/ui/Statusbar/Statusbar.js";
import { ShellInterfaceSqlEditor } from "../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { EnabledState, getEnabledState } from "../mrs-helpers.js";

export interface IMrsContentSetDialogData extends IDictionary {
    serviceId: string;
    requestPath: string;
    requiresAuth: boolean;
    enabled: number;
    comments: string;
    options: string;
    directory: string;
    ignoreList: string;
}

export class MrsContentSetDialog extends AwaitableValueEditDialog {
    #backend!: ShellInterfaceSqlEditor;
    #mrsScriptLanguage?: string;
    #mrsScriptDefinitions?: IMrsScriptDefinitions;
    #mrsScriptModuleFiles?: IMrsScriptModuleFile[];

    protected override get id(): string {
        return "mrsContentSetDialog";
    }

    public override async show(request: IDialogRequest): Promise<IDictionary | DialogResponseClosure> {
        const payload = request.values?.payload as IDictionary;
        this.#backend = payload.backend as ShellInterfaceSqlEditor;

        const services = request.parameters?.services as IMrsServiceData[];

        let dialogValues = this.dialogValues(request, services);
        dialogValues = await this.updateMrsScriptSection(dialogValues);
        const contexts: string[] = [];

        if (dialogValues.sections.get("settingsSection")?.values.containsMrsScripts.value === true
            || dialogValues.sections.get("scriptErrorsSection")?.values.errors.value) {
            contexts.push("MrsScripts");
            if (dialogValues.sections.get("scriptErrorsSection")?.values.errors.value) {
                contexts.push("MrsScriptErrors");
            }
        }

        const result = await this.doShow(() => {
            return dialogValues;
        }, { title: "MRS Content Set", contexts });

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
            const optionsSection = values.sections.get("optionsSection");
            const settingsSection = values.sections.get("settingsSection");
            const scriptErrorsSection = values.sections.get("scriptErrorsSection");
            if (mainSection && optionsSection && settingsSection && scriptErrorsSection) {
                if (!mainSection.values.requestPath.value) {
                    result.messages.requestPath = "The request path must not be empty.";
                } else {
                    const requestPath = mainSection.values.requestPath.value as string;
                    if (!requestPath.startsWith("/")) {
                        result.messages.requestPath = "The request path must start with /.";
                    }
                }

                try {
                    if (optionsSection.values.options.value) {
                        JSON.parse(optionsSection.values.options.value as string);
                    }
                } catch (e) {
                    result.messages.options = `The options need to confirm to JSON format. (${String(e)})`;
                }

                if (settingsSection.values.containsMrsScripts.value === true
                    && scriptErrorsSection.values.errors.value !== "") {
                    result.messages.errors = `The MRS scripts errors need to be fixed before loading the content set.`;
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
        let containsMrsScripts = this.#mrsScriptLanguage !== undefined;
        let buildFolder = "build";
        let scriptingLanguage = "";
        let staticContentFolder = "";
        if (request.values && request.values.options) {
            const options = JSON.parse(request.values.options as string);
            if ("contains_mrs_scripts" in options) {
                containsMrsScripts = options.contains_mrs_scripts === true;
                options.containsMrsScripts = undefined;
            }
            if ("script_definitions" in options) {
                if ("build_folder" in options.script_definitions) {
                    buildFolder = options.script_definitions.build_folder;
                }
                if ("language" in options.script_definitions) {
                    scriptingLanguage = options.script_definitions.language;
                }
                if ("static_content_folder" in options.script_definitions) {
                    staticContentFolder = options.script_definitions.static_content_folder;
                }
                this.#mrsScriptDefinitions = options.script_definitions;
                options.script_definitions = undefined;
            }
            if ("script_module_files" in options) {
                this.#mrsScriptModuleFiles = options.scriptModuleFiles;
                options.scriptModuleFiles = undefined;
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
                    caption: "Access Control",
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
                    options: [
                        CommonDialogValueOption.Grouped,
                    ],
                },
                directory: {
                    type: "resource",
                    caption: "Folder to upload",
                    value: request.values?.directory as string,
                    horizontalSpan: 5,
                    canSelectFolders: true,
                    canSelectFiles: false,
                    description: "The folder that should be uploaded, including all its files and sub-folders",
                    onChange: this.onDirectoryChange,
                },
                ignoreList: {
                    type: "text",
                    caption: "Files to ignore",
                    value: "*node_modules/*, */.*",
                    horizontalSpan: 3,
                    description: "A list of files to ignore, use * and ? as wildcards",
                },
            },
        };

        const settingsSection: IDialogSection = {
            caption: "Settings",
            groupName: "group1",
            values: {
                comments: {
                    type: "text",
                    caption: "Comments",
                    value: request.values?.comments as string,
                    horizontalSpan: 8,
                    multiLine: true,
                    multiLineCount: 3,
                },
                containsMrsScripts: {
                    type: "boolean",
                    caption: "MRS Scripts",
                    label: "Enable MRS Scripts",
                    horizontalSpan: 4,
                    value: containsMrsScripts,
                    description: "Load and enabled the MRS scripts and triggers from this content set "
                        + "and create the corresponding endpoints",
                    options: this.#mrsScriptLanguage === undefined ? [CommonDialogValueOption.Hidden] : [],
                    onChange: (value, dialog) => {
                        if (value) {
                            dialog.updateActiveContexts({
                                add: ["MrsScripts"],
                            });
                        } else {
                            dialog.updateActiveContexts({
                                remove: ["MrsScripts"],
                            });
                        }
                    },
                },
            },
        };

        const scriptSection: IDialogSection = {
            caption: "MRS Scripts",
            groupName: "group1",
            contexts: ["MrsScripts"],
            values: {
                mrsScriptLanguage: {
                    type: "text",
                    caption: "Language",
                    value: scriptingLanguage,
                    horizontalSpan: 2,
                    description: "MRS Script language",
                    options: [CommonDialogValueOption.ReadOnly],
                },
                buildFolder: {
                    type: "text",
                    caption: "Build Folder",
                    value: buildFolder,
                    horizontalSpan: 3,
                    description: "Path of the build folder, for compiled languages",
                    options: [CommonDialogValueOption.ReadOnly],
                },
                staticContentFolder: {
                    type: "text",
                    caption: "Static Content Folder",
                    value: staticContentFolder,
                    horizontalSpan: 3,
                    description: "The path of the static files that should be served",
                    options: [CommonDialogValueOption.ReadOnly],
                },
                scriptModuleDefinitions: {
                    type: "text",
                    caption: "Module Definitions",
                    value: "",
                    horizontalSpan: 8,
                    multiLine: true,
                    multiLineCount: 10,
                    description: "A listing of the module and script definitions",
                    options: [CommonDialogValueOption.ReadOnly],
                },
            },
        };

        const scriptInterfacesSection: IDialogSection = {
            caption: "MRS Script Interfaces",
            groupName: "group1",
            contexts: ["MrsScripts"],
            values: {
                scriptInterfaceDefinitions: {
                    type: "text",
                    caption: "Interface Definitions",
                    value: "",
                    horizontalSpan: 8,
                    multiLine: true,
                    multiLineCount: 12,
                    options: [CommonDialogValueOption.ReadOnly],
                    description: "A listing of the interface definitions",
                },
            },
        };

        const scriptErrorsSection: IDialogSection = {
            caption: "MRS Scripts Errors",
            groupName: "group1",
            contexts: ["MrsScripts", "MrsScriptErrors"],
            values: {
                errors: {
                    type: "text",
                    caption: "MRS Script Errors",
                    value: "",
                    horizontalSpan: 8,
                    multiLine: true,
                    multiLineCount: 12,
                    options: [CommonDialogValueOption.ReadOnly],
                    description: "Errors that occurred while parsing the MRS Scripts",
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
                    value: newOptions,
                    horizontalSpan: 8,
                    multiLine: true,
                    multiLineCount: 10,
                    description: "Additional options in JSON format",
                },
            },
        };

        return {
            id: "mainSection",
            sections: new Map<string, IDialogSection>([
                ["mainSection", mainSection],
                ["settingsSection", settingsSection],
                ["scriptSection", scriptSection],
                ["scriptInterfacesSection", scriptInterfacesSection],
                ["scriptErrorsSection", scriptErrorsSection],
                ["optionsSection", optionsSection],
            ]),
        };
    }

    private onDirectoryChange = (_value: string, dialog: ValueEditDialog): void => {
        const values = dialog.getDialogValues();

        this.updateMrsScriptSection(values).then((values) => {
            dialog.setDialogValues(values);
        }).catch((_reason) => {
        });
    };

    private updateMrsScriptSection = async (dialogValues: IDialogValues): Promise<IDialogValues> => {
        const mainSection = dialogValues.sections.get("mainSection");
        const settingsSection = dialogValues.sections.get("settingsSection");
        const scriptSection = dialogValues.sections.get("scriptSection");
        const scriptInterfacesSection = dialogValues.sections.get("scriptInterfacesSection");
        const scriptErrorsSection = dialogValues.sections.get("scriptErrorsSection");

        if (mainSection && settingsSection && scriptSection && scriptInterfacesSection && scriptErrorsSection) {
            this.#mrsScriptLanguage = undefined;
            if (mainSection.values.directory.value) {
                this.#mrsScriptLanguage = await this.#backend.mrs.getFolderMrsScriptLanguage(
                    mainSection.values.directory.value as string,
                    mainSection.values.ignoreList.value as string);
            }

            if (this.#mrsScriptLanguage !== undefined) {
                scriptSection.values.mrsScriptLanguage.value = this.#mrsScriptLanguage;
                const dialogContexts = ["MrsScripts"];

                let mrsScriptDefinitions: IMrsScriptDefinitions | undefined;
                await this.#backend.mrs.getFolderMrsScriptDefinitions(mainSection.values.directory.value as string,
                    this.#mrsScriptLanguage, mainSection.values.ignoreList.value as string, (data) => {
                        if (data.result?.info) {
                            StatusBar.setStatusBarMessage(`$(loading~spin) ${data.result.info}`);
                        } else {
                            mrsScriptDefinitions = data.result;
                        }
                    });

                scriptSection.values.buildFolder.value = mrsScriptDefinitions?.buildFolder ?? "";
                scriptSection.values.staticContentFolder.value =
                    mrsScriptDefinitions?.staticContentFolders?.join(", ") ?? "";
                scriptSection.values.scriptModuleDefinitions.value = JSON.stringify(
                    mrsScriptDefinitions?.scriptModules ?? "", undefined, 4);
                scriptInterfacesSection.values.scriptInterfaceDefinitions.value = JSON.stringify(
                    mrsScriptDefinitions?.interfaces ?? "", undefined, 4);

                settingsSection.values.containsMrsScripts.value = true;
                settingsSection.values.containsMrsScripts.options = [];

                // If there are errors, list them
                if (mrsScriptDefinitions?.errors && mrsScriptDefinitions?.errors.length > 0) {
                    scriptErrorsSection.values.errors.value = mrsScriptDefinitions.errors.map((error) => {
                        if (error.script) {
                            return `SCRIPT ERROR: ${error.message} [${error.fileInfo?.relativeFileName ?? ""}: ` +
                                `Ln ${error.script.codePosition.lineNumberStart}++]`;
                        } else if (error.interface) {
                            return `INTERFACE ERROR: ${error.message} [${error.fileInfo?.relativeFileName ?? ""}: ` +
                                `Ln ${error.interface?.codePosition.lineNumberStart}++]`;
                        } else {
                            return `ERROR: ${error.message}`;
                        }
                    }).join("\n");
                    scriptErrorsSection.values.errors.options = [CommonDialogValueOption.ReadOnly];

                    dialogContexts.push("MrsScriptErrors");
                }

                this.dialog?.updateActiveContexts({
                    add: dialogContexts,
                });
            } else {
                settingsSection.values.containsMrsScripts.value = false;
                settingsSection.values.containsMrsScripts.options = [CommonDialogValueOption.Hidden];
                scriptSection.values.mrsScriptLanguage.value = "";
                scriptErrorsSection.values.errors.value = "";

                this.dialog?.updateActiveContexts({
                    remove: ["MrsScripts", "MrsScriptErrors"],
                });
            }
        }

        return dialogValues;
    };

    private processResults = (dialogValues: IDialogValues, services: IMrsServiceData[]): IDictionary => {
        const mainSection = dialogValues.sections.get("mainSection");
        const settingsSection = dialogValues.sections.get("settingsSection");
        const optionsSection = dialogValues.sections.get("optionsSection");
        const scriptSection = dialogValues.sections.get("scriptSection");

        if (mainSection && settingsSection && optionsSection && scriptSection) {
            const options = JSON.parse(optionsSection.values.options.value as string || "{}");
            options.contains_mrs_scripts = settingsSection.values.containsMrsScripts.value as boolean;
            if (options.contains_mrs_scripts) {
                options.mrs_scripting_language = this.#mrsScriptLanguage;
            }
            if (this.#mrsScriptDefinitions) {
                options.script_definitions = this.#mrsScriptDefinitions;
            }
            if (this.#mrsScriptModuleFiles) {
                options.script_module_files = this.#mrsScriptModuleFiles;
            }
            const newOptions = JSON.stringify(options, undefined, 4);

            const values: IMrsContentSetDialogData = {
                serviceId: services.find((service) => {
                    return mainSection.values.service.value === service.fullServicePath;
                })?.id ?? "",
                requestPath: mainSection.values.requestPath.value as string,
                requiresAuth: mainSection.values.requiresAuth.value as boolean,
                enabled: getEnabledState(mainSection.values.enabled.value as string),
                comments: settingsSection.values.comments.value as string,
                options: newOptions,
                directory: mainSection.values.directory.value as string,
                ignoreList: mainSection.values.ignoreList.value as string,
            };

            return values;
        }

        return {};
    };

}
