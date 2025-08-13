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

import * as ts from "typescript";

import { DialogResponseClosure, IDialogRequest, IDictionary } from "../../app-logic/general-types.js";
import { loadFileAsText, loadFileBinary } from "../../utilities/helpers.js";
import { AwaitableValueEditDialog } from "./AwaitableValueEditDialog.js";
import {
    CommonDialogValueOption, IDialogSection, IDialogValidations, IDialogValues, ValueEditDialog,
    type IResourceDialogValue,
} from "./ValueEditDialog.js";

export interface ICreateLibraryDialogData extends IDictionary {
    schemaName: string;
    libraryName: string;
    language: string;
    comment: string;
    body: string;
}

/**
 * Format bytes as human-readable text.
 *
 * @param bytes Number of bytes.
 * @param si True to use metric (SI) units, aka powers of 1000. False to use
 *           binary (IEC), aka powers of 1024.
 * @param dp Number of decimal places to display.
 *
 * @returns Formatted string.
 */
const humanFileSize = (bytes: number, si = false, dp = 1) => {
    const thresh = si ? 1000 : 1024;

    if (Math.abs(bytes) < thresh) {
        return `${bytes} B`;
    }

    const units = si
        ? ["kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
        : ["KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];
    let u = -1;
    const r = 10 ** dp;

    do {
        bytes /= thresh;
        ++u;
    } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);

    return bytes.toFixed(dp) + " " + units[u];
};

const isValidESModule = (code: string): boolean => {
    const result = ts.transpileModule(code, {
        compilerOptions: {
            allowJs: true,
            checkJs: true,
            target: ts.ScriptTarget.ESNext,
            module: ts.ModuleKind.ESNext,
        },
        reportDiagnostics: true,
    });

    if (!result.diagnostics || result.diagnostics.length === 0) {
        return true;
    }
    const errors = result.diagnostics.filter((d) => {
        return d.category === ts.DiagnosticCategory.Error;
    });

    return errors.length === 0;
};

export class CreateLibraryDialog extends AwaitableValueEditDialog {

    private selectedFile: File | undefined = undefined;
    private selectedFileContent?: Promise<string>;

    protected override get id(): string {
        return "createLibraryDialog";
    }

    public override async show(request: IDialogRequest): Promise<IDictionary | DialogResponseClosure> {
        const dialogValues = this.dialogValues(request);
        const result = await this.doShow(() => {
            return dialogValues;
        }, { title: "Create Library From" });
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
        if (mainSection) {
            if ((mainSection.values.schemaName.value as string).length === 0) {
                result.messages.schemaName = "Schema name is missing";
            }
            if ((mainSection.values.libraryName.value as string).length === 0) {
                result.messages.libraryName = "Library name is missing";
            }
            const pathMissing = !mainSection.values.localFilePath.value ||
                (mainSection.values.localFilePath.value as string).length === 0;
            if (pathMissing) {
                result.messages.localFilePath = "Path is missing";
                // because only validateInput is called on every change, reset it here
                this.selectedFile = undefined;
            }

            if (closing) {
                if (pathMissing) {
                    return result;
                }
                if (!this.selectedFile) {
                    result.messages.localFilePath = "File NOT selected";

                    return result;
                }
                if (this.selectedFile.size === 0) {
                    result.messages.localFilePath = "File is empty";

                    return result;
                }
                const lang = mainSection.values.language.value as string;
                let correctExt = false;
                if (lang === "JavaScript" && (
                    this.selectedFile.name.endsWith(".js") || this.selectedFile.name.endsWith(".mjs"))) {
                    correctExt = true;
                    // load & check if correct ES module
                    this.selectedFileContent = loadFileAsText(this.selectedFile).then(
                        (txt) => {
                            if (isValidESModule(txt)) {
                                return txt;
                            }
                            throw Error("Selected file is not a valid ES module");
                        });
                }
                if (lang === "WebAssembly" && this.selectedFile.name.endsWith(".wasm")) {
                    correctExt = true;
                    // convert to base64 encoding
                    this.selectedFileContent = loadFileBinary(this.selectedFile).then(
                        (arrayBuffer) => {
                            const uint8Array = new Uint8Array(arrayBuffer);
                            const chunkSize = 65535; // Maximum number of arguments that can be handled
                            let binaryString = "";

                            for (let i = 0; i < uint8Array.length; i += chunkSize) {
                                const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
                                binaryString += String.fromCharCode(...chunk);
                            }

                            return btoa(binaryString);
                        },
                    );
                }
                if (!correctExt) {
                    result.messages.localFilePath = `Unsupported file extension for ${lang}`;

                    return result;
                }
            }
        }

        return result;
    };

    private dialogValues(request: IDialogRequest): IDialogValues {
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
                    options: [CommonDialogValueOption.AutoFocus],
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
                    choices: ["File"],
                    horizontalSpan: 2,
                },
                comment: {
                    type: "text",
                    caption: "Comment",
                    horizontalSpan: 8,
                    multiLine: true,
                    multiLineCount: 3,
                    options: [
                        CommonDialogValueOption.NewGroup,
                        CommonDialogValueOption.Grouped,
                    ],
                },
                localFilePath: {
                    type: "resource",
                    caption: "Path",
                    placeholder: "<Select JavaScript file>",
                    filters: { javaScript: ["js", "mjs"] },
                    multiSelection: false,
                    canSelectFiles: true,
                    canSelectFolders: false,
                    horizontalSpan: 6,
                    onChange: this.onFileChange,
                    doRead: true,
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

    private onLanguageChange = (value: string, dialog: ValueEditDialog): void => {
        const values = dialog.getDialogValues();
        dialog.updateInputValue(value, "language");
        const mainSection = values.sections.get("mainSection");
        if (mainSection) {
            const localFilePath = mainSection.values.localFilePath as IResourceDialogValue;
            if (value === "JavaScript") {
                localFilePath.value = undefined;
                localFilePath.filters = { javaScript: ["js", "mjs"] };
                localFilePath.placeholder = "<Select JavaScript file>";
                localFilePath.description = "Select a new JavaScript file";
                this.selectedFile = undefined;
            } else if (value === "WebAssembly") {
                localFilePath.value = undefined;
                localFilePath.filters = { webAssembly: ["wasm"] };
                localFilePath.placeholder = "<Select WebAssembly file>";
                localFilePath.description = "Select a new WebAssembly file";
                this.selectedFile = undefined;
            }
        }
        dialog.setDialogValues(values);
    };

    private onFileChange = (value: File | null, dialog: ValueEditDialog): void => {
        const values = dialog.getDialogValues();
        const mainSection = values.sections.get("mainSection");

        if (mainSection) {
            if (!value || value.name.length === 0) {
                this.selectedFile = undefined;
                mainSection.values.localFilePath.description = undefined;
            } else {
                this.selectedFile = value;
                mainSection.values.localFilePath.description = `File size: ${humanFileSize(value.size)}`;
            }
        }
        dialog.setDialogValues(values);
    };

    private processResults = async (dialogValues: IDialogValues): Promise<IDictionary> => {
        const mainSection = dialogValues.sections.get("mainSection");
        if (mainSection) {
            const c = mainSection.values.comment.value ? mainSection.values.comment.value as string : "";
            const values: ICreateLibraryDialogData = {
                schemaName: mainSection.values.schemaName.value as string,
                libraryName: mainSection.values.libraryName.value as string,
                language: mainSection.values.language.value as string,
                comment: c,
                body: this.selectedFileContent ? await this.selectedFileContent : "",
            };

            return values;
        }

        return {};
    };
}
