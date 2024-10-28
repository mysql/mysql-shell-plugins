/*
 * Copyright (c) 2022, 2024, Oracle and/or its affiliates.
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

import { ComponentChild, createRef } from "preact";

import { DialogResponseClosure, IDialogRequest, IDictionary } from "../../../app-logic/general-types.js";
import { ValueDialogBase } from "../../../components/Dialogs/ValueDialogBase.js";
import {
    ValueEditDialog, IDialogValues, IDialogSection, CommonDialogValueOption, IDialogValidations,
} from "../../../components/Dialogs/ValueEditDialog.js";

export class MdsHWLoadDataDialog extends ValueDialogBase {
    private dialogRef = createRef<ValueEditDialog>();

    public override render(): ComponentChild {
        return (
            <ValueEditDialog
                ref={this.dialogRef}
                id="mdsHWLoadDataDialog"
                onClose={this.handleCloseDialog}
                onValidate={this.validateInput}
            />
        );
    }

    public show(request: IDialogRequest, title: string): void {
        this.dialogRef.current?.show(this.dialogValues(request, title), { title: "MySQL HeatWave Cluster" });
    }

    public handleCloseDialog = (closure: DialogResponseClosure, dialogValues: IDialogValues): void => {
        const { onClose } = this.props;

        if (closure === DialogResponseClosure.Accept) {
            const mainSection = dialogValues.sections.get("mainSection");
            if (mainSection) {
                const values: IDictionary = {};
                values.schemas = mainSection.values.schemas.value as string[];
                values.mode = mainSection.values.mode.value as string;
                values.output = mainSection.values.output.value as string;
                values.disableUnsupportedColumns = mainSection.values.disableUnsupportedColumns.value as boolean;
                values.optimizeLoadParallelism = mainSection.values.optimizeLoadParallelism.value as boolean;
                values.enableMemoryCheck = mainSection.values.enableMemoryCheck.value as boolean;
                values.sqlMode = mainSection.values.sqlMode.value as string;
                values.excludeList = mainSection.values.excludeList.value as string;

                onClose(closure, values);
            }
        } else {
            onClose(closure);
        }
    };

    public validateInput = (closing: boolean, values: IDialogValues): IDialogValidations => {
        const result: IDialogValidations = {
            messages: {},
            requiredContexts: [],
        };

        if (closing) {
            const mainSection = values.sections.get("mainSection");
            if (mainSection) {
                if ((mainSection.values.schemas.value as string[]).length < 1) {
                    result.messages.schemas = "At least one schema needs to be selected.";
                }

                const regEx = /^(".*?"\s*,\s*)*$/gm;
                const excludeList = mainSection.values.excludeList.value as string;

                if (excludeList !== "" && !regEx.test(excludeList + ",")) {
                    result.messages.excludeList =
                        "The Exclude List needs to contain a list of quoted object names, e.g."
                        + "\"mySchema.myTable\", \"myOtherSchema.myOtherTable\"";
                }
            }
        }

        return result;
    };

    private dialogValues(request: IDialogRequest, title: string): IDialogValues {

        const mainSection: IDialogSection = {
            caption: title,
            values: {
                schemas: {
                    type: "set",
                    caption: "Database Schemas to Load",
                    tagSet: request.values?.allSchemas as string[],
                    value: request.values?.selectedSchemas as string[],
                    horizontalSpan: 8,
                    options: [CommonDialogValueOption.AutoFocus],
                },
                mode: {
                    type: "choice",
                    caption: "Operational Mode",
                    value: "normal",
                    // cSpell:ignore dryrun
                    choices: ["normal", "dryrun"],
                    horizontalSpan: 4,
                },
                output: {
                    type: "choice",
                    caption: "Output",
                    value: "normal",
                    choices: ["normal", "compact", "silent", "help"],
                    horizontalSpan: 4,
                },
                optionsTitle: {
                    type: "description",
                    caption: "Options",
                    horizontalSpan: 4,
                    options: [CommonDialogValueOption.Grouped],
                },
                disableUnsupportedColumns: {
                    type: "boolean",
                    caption: "Disable unsupported columns",
                    value: true,
                    horizontalSpan: 4,
                    options: [CommonDialogValueOption.Grouped],
                },
                optimizeLoadParallelism: {
                    type: "boolean",
                    caption: "Optimize load parallelism",
                    value: true,
                    horizontalSpan: 4,
                    options: [CommonDialogValueOption.Grouped],
                },
                enableMemoryCheck: {
                    type: "boolean",
                    caption: "Enable memory check",
                    value: true,
                    horizontalSpan: 4,
                    options: [CommonDialogValueOption.Grouped],
                },
                sqlMode: {
                    type: "text",
                    caption: "SQL Mode",
                    value: "",
                    horizontalSpan: 4,
                    multiLine: true,
                },
                excludeList: {
                    type: "text",
                    caption: "Exclude List",
                    value: "",
                    horizontalSpan: 8,
                    multiLine: true,
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
}
