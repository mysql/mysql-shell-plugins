/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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

import { Buffer } from "buffer";

import { Image } from "../ui/Image/Image.js";

import { DBDataType, DialogResponseClosure, IDialogRequest } from "../../app-logic/general-types.js";
import { AwaitableValueEditDialog } from "../Dialogs/AwaitableValueEditDialog.js";
import { IDialogSection, IDialogValidations, IDialogValues } from "../Dialogs/ValueEditDialog.js";
import { HexEditor, HexValueGrouping } from "../ui/HexEditor/HexEditor.js";

export interface IFieldEditorData extends IDictionary {
    /** The type of the data, expressed as database column data type. */
    dataType: DBDataType;

    /** Base64 encoded binary data. */
    value: string;
}

export class FieldEditor extends AwaitableValueEditDialog {
    static #typesWithImageData = new Set<DBDataType>([
        DBDataType.Blob,
        DBDataType.MediumBlob,
        DBDataType.LongBlob,
        DBDataType.Binary,
        DBDataType.Varbinary,
    ]);

    protected override get id(): string {
        return "fieldEditor";
    }

    public override async show(request: IDialogRequest): Promise<IFieldEditorData | DialogResponseClosure> {
        const data = request.parameters as IFieldEditorData;

        const dialogValues = this.dialogValues(request, data.dataType, data.value);
        const result = await this.doShow(() => {
            return dialogValues;
        }, { title: "Database Field Editor" });

        if (result.closure === DialogResponseClosure.Accept) {
            return {
                ...this.processResults(result.values),
                dataType: data.dataType,
            } as IFieldEditorData;
        }

        return DialogResponseClosure.Cancel;
    }

    protected override validateInput = (closing: boolean, values: IDialogValues): IDialogValidations => {
        const result: IDialogValidations = {
            messages: {},
            requiredContexts: [],
        };

        const mainSection = values.sections.get("mainSection");

        if (closing) {
            if (mainSection) {
                //
            }
        } else if (mainSection) {
            //
        }

        return result;
    };

    private dialogValues(request: IDialogRequest, dataType: DBDataType, data?: string | null): IDialogValues {
        // Content is stored as base64 encoded binary data. We need to decode it.
        let content = "";
        if (data) {
            const buffer = Buffer.from(data, "base64");
            content = buffer.toString();
        }

        const firstPart = content.substring(0, 10).toLowerCase();
        let imagePrefix = "";
        if (firstPart.indexOf("png") > -1) {
            imagePrefix = "data:image/png;base64,";
        } else if (firstPart.indexOf("jpg") > -1) {
            imagePrefix = "data:image/jpg;base64,";
        }

        const textSection: IDialogSection = {
            caption: "Text",
            groupName: "editorSections",
            expand: true,
            values: {
                value: {
                    type: "text",
                    caption: "Value",
                    multiLine: true,
                    value: content,
                    horizontalSpan: 8,
                },
            },
        };

        // Convert the content to a byte array.
        const encoder = new TextEncoder();
        const bytes = encoder.encode(content);
        const hexSection: IDialogSection = {
            caption: "Binary",
            groupName: "editorSections",
            expand: true,
            values: {
                value: {
                    type: "custom",
                    horizontalSpan: 8,
                    component: <HexEditor value={bytes.buffer} grouping={HexValueGrouping.Byte} />,
                },
            },
        };

        const imageSection: IDialogSection = {
            caption: "Image",
            groupName: "editorSections",
            expand: true,
            values: {
                value: {
                    type: "custom",
                    horizontalSpan: 8,
                    component: <Image src={`${imagePrefix}${data ?? ""}`} />,
                },
            },
        };

        const jsonSection: IDialogSection = {
            caption: "JSON",
            groupName: "editorSections",
            expand: true,
            values: {
                value: {
                    type: "text",
                    caption: "Value",
                    multiLine: true,
                    value: content,
                    horizontalSpan: 8,
                },
            },
        };

        const sections = new Map<string, IDialogSection>([
            ["textSection", textSection],
            ["hexSection", hexSection],
        ]);

        if (FieldEditor.#typesWithImageData.has(dataType) && imagePrefix.length > 0) {
            sections.set("imageSection", imageSection);
        }

        if (dataType === DBDataType.Json) {
            sections.set("jsonSection", jsonSection);
        }

        return {
            id: "mainSection",
            sections,
        };
    }

    private processResults = (dialogValues: IDialogValues): IDictionary => {
        const mainSection = dialogValues.sections.get("mainSection");

        if (mainSection) {
            const values = {
                dataType: mainSection.values.dataType.value as DBDataType,
                value: mainSection.values.value.value as string,
            };

            return values;
        }

        return {};
    };

}
