/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

import ts from "typescript";

import { DialogResponseClosure, IDialogRequest, IDictionary } from "../../app-logic/general-types.js";
import {
    ValueEditDialog, IDialogValues, IDialogSection, CommonDialogValueOption, IDialogValidations,
    IResourceDialogValue,
} from "./ValueEditDialog.js";
import { arrayBufferToBase64 } from "../../utilities/string-helpers.js";
import { AwaitableValueEditDialog } from "./AwaitableValueEditDialog.js";
import { loadFileAsText, loadFileBinary, convertErrorToString } from "../../utilities/helpers.js";

export interface ICreateLibraryDialogData extends IDictionary {
    schemaName: string;
    libraryName: string;
    language: string;
    comment: string;
    body: string;
}

const isValidESModule = (code: string): void => {
    const fileName = "input.js";
    const result = ts.transpileModule(code, {
        compilerOptions: {
            allowJs: true,
            checkJs: true,
            target: ts.ScriptTarget.ESNext,
            module: ts.ModuleKind.ESNext,
            esModuleInterop: true,
            isolatedModules: true,
        },
        reportDiagnostics: true,
        fileName,
    });

    if (result.diagnostics) {
        const issues = result.diagnostics.filter(
            (d) => {
                return d.category === ts.DiagnosticCategory.Error
                    || d.category === ts.DiagnosticCategory.Warning;
            },
        );

        if (issues.length > 0) {
            throw Error(`Not a valid ES module`);
        }
    }
};

export class CreateLibraryDialog extends AwaitableValueEditDialog {

    private selectedFile: File | undefined = undefined;
    private processedContent: string = "";
    private libraryNameIsSet: boolean = false;
    private commentIsSet: boolean = false;

    protected override get id(): string {
        return "createLibraryDialog";
    }

    public override async show(request: IDialogRequest): Promise<IDictionary | DialogResponseClosure> {
        let showComment = false;
        if (request.values && (request.values.serverVersion as number) >= 90400) {
            showComment = true;
        }
        const dialogValues = this.dialogValues(request, showComment);
        const contexts: string[] = ["localFile"];
        const result = await this.doShow(() => { return dialogValues; }, { title: "Create Library From", contexts });
        if (result.closure === DialogResponseClosure.Accept) {
            return this.processResults(result.values, showComment);
        }

        return DialogResponseClosure.Cancel;
    }

    protected override validateInput = async (closing: boolean, values: IDialogValues): Promise<IDialogValidations> => {
        const result: IDialogValidations = {
            messages: {},
            requiredContexts: [],
        };

        const mainSection = values.sections.get("mainSection");
        if (!mainSection) {
            return result;
        }

        if ((mainSection.values.schemaName.value as string).length === 0) {
            result.messages.schemaName = "Schema name is missing";
        }

        if ((mainSection.values.libraryName.value as string).length === 0) {
            result.messages.libraryName = "Library name is missing";
        }

        if (mainSection.values.loadFrom.value === "File") {
            const localFileSection = values.sections.get("localFileSection");

            if (!localFileSection) {
                return result;
            }

            const hasPath = localFileSection.values.localFilePath.value
                && ((localFileSection.values.localFilePath.value as string).length > 0);

            if (closing) {
                if (!hasPath) {
                    result.messages.localFilePath = "Please select a file";

                    return result;
                }
                try {
                    this.processedContent = await this.loadFile();
                } catch (error) {
                    result.messages.localFilePath = convertErrorToString(error);
                }
            }
        } else if (mainSection.values.loadFrom.value === "URL") {
            const urlSection = values.sections.get("urlSection");

            if (!urlSection) {
                return result;
            }

            const hasPath = urlSection.values.url.value
                && ((urlSection.values.url.value as string).length > 0);

            if (!hasPath && closing) {
                result.messages.url = "URL is missing";

                return result;
            }

            if (closing) {
                try {
                    this.processedContent = await this.downloadFromUrl(
                        urlSection.values.url.value as string,
                        mainSection.values.language.value as string);
                } catch (error) {
                    result.messages.url = convertErrorToString(error);
                }
            }
        }

        return result;
    };

    private loadFile = async (): Promise<string> => {
        if (!this.selectedFile) {
            throw new Error("Please select a file");
        }

        const isJS = this.selectedFile.name.endsWith(".js")
            || this.selectedFile.name.endsWith(".mjs");

        if (isJS) {
            // load & check if correct ES module
            const fileContent = await loadFileAsText(this.selectedFile);

            if (fileContent.length === 0) {
                throw new Error("File is empty");
            }
            // check if correct ES module
            isValidESModule(fileContent);

            return fileContent;
        } else if (this.selectedFile.name.endsWith(".wasm")) {
            // convert to base64 encoding
            const fileContent = await loadFileBinary(this.selectedFile);

            if (fileContent.byteLength === 0) {
                throw new Error("File is empty");
            }

            return arrayBufferToBase64(fileContent);
        }
        throw new Error("Unknown file extension");
    };

    private downloadFromUrl = async (url: string, language: string): Promise<string> => {
        const response = await fetch(url);


        if (!response.ok) {
            throw new Error(`Response status: ${response.status}: ${response.statusText}`);
        }

        if (language === "JavaScript") {
            const fileContent = await response.text();
            if (fileContent.length === 0) {
                throw new Error("URL returns empty content");
            }
            // check if correct ES module
            isValidESModule(fileContent);

            return fileContent;
        } else if (language === "WebAssembly") {
            const blob = await response.blob();

            if (blob.size === 0) {
                throw new Error("URL returns empty content");
            }
            const buffer = await blob.arrayBuffer();

            return arrayBufferToBase64(buffer);
        }
        throw new Error("Unknown language");
    };

    private resetState(): void {
        this.selectedFile = undefined;
        this.processedContent = "";
    }

    private dialogValues(request: IDialogRequest, showComment: boolean): IDialogValues {
        const commentOptions = [
            CommonDialogValueOption.NewGroup,
            CommonDialogValueOption.Grouped,
        ];
        if (!showComment) {
            commentOptions.push(CommonDialogValueOption.Hidden);
        }
        const mainSection: IDialogSection = {
            values: {
                schemaName: {
                    type: "text",
                    caption: "Schema Name",
                    value: request.values?.schemaName as string,
                    horizontalSpan: 2,
                },
                libraryName: {
                    type: "text",
                    caption: "Library Name",
                    value: "my_library",
                    horizontalSpan: 2,
                    onChange: (value: string): void => {
                        // If user erases the lbirary name, we can still take over the file name.
                        this.libraryNameIsSet = value.length > 0;
                    },
                },
                language: {
                    type: "choice",
                    caption: "Language",
                    value: "JavaScript",
                    choices: ["JavaScript", "WebAssembly"],
                    horizontalSpan: 2,
                    onChange: this.onLanguageChange,
                },
                loadFrom: {
                    type: "choice",
                    caption: "Load From",
                    value: "File",
                    choices: ["File", "URL"],
                    horizontalSpan: 2,
                    onChange: (value: string, dialog: ValueEditDialog): void => {
                        let toAdd;
                        let toRemove;
                        if (value === "File") {
                            toAdd = ["localFile"];
                            toRemove = ["url", "localProject"];
                        } else if (value === "URL") {
                            toAdd = ["url"];
                            toRemove = ["localFile", "localProject"];
                        }
                        const contexts = {
                            add: toAdd,
                            remove: toRemove,
                        };
                        this.resetState();
                        if (!this.commentIsSet) {
                            dialog.updateInputValue("", "comment");
                        }
                        dialog.updateActiveContexts(contexts);
                    },
                },
                comment: {
                    type: "text",
                    caption: showComment ? "Comment" : undefined,
                    horizontalSpan: 8,
                    multiLine: true,
                    multiLineCount: 3,
                    options: commentOptions,
                    onChange: (): void => {
                        // If user erases the comment, it mean he wants it empty, so dont override it anymore.
                        this.commentIsSet = true;
                    },
                },
            },
        };

        const localFileSection: IDialogSection = {
            caption: "Load From File",
            contexts: ["localFile"],
            values: {
                localFilePath: {
                    type: "resource",
                    caption: "Path",
                    placeholder: "<Select local JavaScript file>",
                    filters: { javaScript: ["js", "mjs"] },
                    multiSelection: false,
                    canSelectFiles: true,
                    canSelectFolders: false,
                    horizontalSpan: 8,
                    onChange: this.onFileChange,
                    doRead: true,
                },
            },
        };

        const urlSection: IDialogSection = {
            caption: "Download From URL",
            contexts: ["url"],
            values: {
                url: {
                    type: "text",
                    caption: "URL",
                    value: "",
                    horizontalSpan: 8,
                    onFocusLost: this.onUrlChange,
                },
            },
        };

        return {
            id: "mainSection",
            sections: new Map<string, IDialogSection>([
                ["mainSection", mainSection],
                ["localFileSection", localFileSection],
                ["urlSection", urlSection],
            ]),
        };
    }

    private onLanguageChange = (value: string, dialog: ValueEditDialog): void => {
        const values = dialog.getDialogValues();
        dialog.updateInputValue(value, "language");
        const localFileSection = values.sections.get("localFileSection");
        if (localFileSection) {
            const localFilePath = localFileSection.values.localFilePath as IResourceDialogValue;
            if (value === "JavaScript") {
                localFilePath.value = undefined;
                localFilePath.filters = { javaScript: ["js", "mjs"] };
                localFilePath.placeholder = "<Select local JavaScript file>";
                localFilePath.description = "Select a new JavaScript file";
            } else if (value === "WebAssembly") {
                localFilePath.value = undefined;
                localFilePath.filters = { webAssembly: ["wasm"] };
                localFilePath.placeholder = "<Select local WebAssembly file>";
                localFilePath.description = "Select a new WebAssembly file";
            }
        }
        this.resetState();
        dialog.setDialogValues(values);
        if (!this.commentIsSet) {
            dialog.updateInputValue("", "comment");
        }
    };

    private onFileChange = (_value: File | null, dialog: ValueEditDialog): void => {
        const values = dialog.getDialogValues();
        const localFileSection = values.sections.get("localFileSection");
        const mainSection = values.sections.get("mainSection");

        if (!localFileSection) {
            return;
        }

        if (!_value || _value.name.length === 0) {
            this.selectedFile = undefined;
        } else {
            this.selectedFile = _value;

            if (mainSection && !this.commentIsSet) {
                dialog.updateInputValue(`Loaded from ${this.selectedFile.name}`, "comment");
            }
            if (mainSection && !this.libraryNameIsSet) {
                // Split by both forward and backward slashes to handle different OS
                const parts = this.selectedFile.name.split(/[/\\]/);
                const fileName = parts[parts.length - 1];
                dialog.updateInputValue(fileName, "libraryName");
            }
        }
    };

    private onUrlChange = (_value: string, dialog: ValueEditDialog): void => {
        const values = dialog.getDialogValues();
        const mainSection = values.sections.get("mainSection");

        if (mainSection && !this.commentIsSet) {
            dialog.updateInputValue(`Downloaded from ${_value}`, "comment");
        }
        dialog.setDialogValues(values);
    };

    private processResults = (dialogValues: IDialogValues, showComment: boolean): IDictionary => {
        const mainSection = dialogValues.sections.get("mainSection");
        if (!mainSection) { return {}; }
        const lang = mainSection.values.language.value as string;
        const c = mainSection.values.comment.value && showComment ? mainSection.values.comment.value as string : "";

        const values: ICreateLibraryDialogData = {
            schemaName: mainSection.values.schemaName.value as string,
            libraryName: mainSection.values.libraryName.value as string,
            language: lang,
            comment: c,
            body: this.processedContent,
        };

        return values;
    };
}
