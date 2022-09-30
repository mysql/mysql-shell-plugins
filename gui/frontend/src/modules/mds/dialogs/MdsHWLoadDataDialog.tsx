/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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

import React from "react";

import { DialogResponseClosure, IDialogRequest, IDictionary } from "../../../app-logic/Types";

import {
    IDialogSection, IDialogValidations, IDialogValues, ValueDialogBase, ValueEditDialog, DialogValueOption,
} from "../../../components/Dialogs";

export class MdsHWLoadDataDialog extends ValueDialogBase {
    private dialogRef = React.createRef<ValueEditDialog>();

    public render(): React.ReactNode {
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

    private dialogValues(request: IDialogRequest, title: string): IDialogValues {

        const mainSection: IDialogSection = {
            caption: title,
            values: {
                schemas: {
                    caption: "Database Schemas to Load",
                    set: request.values?.allSchemas as string[],
                    value: request.values?.selectedSchemas as string[],
                    span: 8,
                    options: [DialogValueOption.AutoFocus],
                },
                mode: {
                    caption: "Operational Mode",
                    value: "normal",
                    // cSpell:ignore dryrun
                    choices: ["normal", "dryrun"],
                    span: 4,
                },
                output: {
                    caption: "Output",
                    value: "normal",
                    choices: ["normal", "compact", "silent", "help"],
                    span: 4,
                },
                optionsTitle: {
                    caption: "Options",
                    span: 4,
                    options: [
                        DialogValueOption.Description,
                        DialogValueOption.Grouped,
                    ],
                },
                disableUnsupportedColumns: {
                    caption: "Disable unsupported columns",
                    value: true,
                    span: 4,
                    options: [
                        DialogValueOption.Grouped,
                    ],
                },
                optimizeLoadParallelism: {
                    caption: "Optimize load parallelism",
                    value: true,
                    span: 4,
                    options: [
                        DialogValueOption.Grouped,
                    ],
                },
                enableMemoryCheck: {
                    caption: "Enable memory check",
                    value: true,
                    span: 4,
                    options: [
                        DialogValueOption.Grouped,
                    ],
                },
                sqlMode: {
                    caption: "SQL Mode",
                    value: "",
                    span: 4,
                    options: [
                        DialogValueOption.MultiLine,
                    ],
                },
                excludeList: {
                    caption: "Exclude List",
                    value: "",
                    span: 8,
                    options: [
                        DialogValueOption.MultiLine,
                    ],
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

    private handleCloseDialog = (closure: DialogResponseClosure, dialogValues: IDialogValues): void => {
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

    private validateInput = (closing: boolean, values: IDialogValues): IDialogValidations => {
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

                if (excludeList !== "" && !regEx.test(excludeList + ",") ) {
                    result.messages.excludeList =
                        "The Exclude List needs to contain a list of quoted object names, e.g."
                        + "\"mySchema.myTable\", \"myOtherSchema.myOtherTable\"";
                }
            }
        }

        return result;
    };

}
