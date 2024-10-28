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
import { IMySQLDbSystemShapeSummary } from "../../../communication/Oci.js";
import { ValueDialogBase } from "../../../components/Dialogs/ValueDialogBase.js";
import {
    ValueEditDialog, IDialogValues, IDialogSection, CommonDialogValueOption, IDialogValidations,
} from "../../../components/Dialogs/ValueEditDialog.js";

export class MdsHWClusterDialog extends ValueDialogBase {
    private dialogRef = createRef<ValueEditDialog>();

    public override render(): ComponentChild {
        return (
            <ValueEditDialog
                ref={this.dialogRef}
                id="mdsHWClusterDialog"
                onClose={this.handleCloseDialog}
                onValidate={this.validateInput}
            />
        );
    }

    public show(request: IDialogRequest, title: string): void {
        const shapes = request.parameters?.shapes as IMySQLDbSystemShapeSummary[];

        this.dialogRef.current?.show(this.dialogValues(request, title, shapes), { title: "MySQL HeatWave Cluster" },
            { shapes });
    }

    public handleCloseDialog = (closure: DialogResponseClosure, dialogValues: IDialogValues,
        data?: IDictionary): void => {
        const { onClose } = this.props;

        if (closure === DialogResponseClosure.Accept && data) {
            const mainSection = dialogValues.sections.get("mainSection");
            if (mainSection) {
                const values: IDictionary = {};
                values.clusterSize = mainSection.values.clusterSize.value as number;
                values.shapeName = mainSection.values.shapeName.value as string;

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
                if (!mainSection.values.clusterSize.value) {
                    result.messages.name = "The cluster size must be specified.";
                }
            }
        }

        return result;
    };

    private dialogValues(request: IDialogRequest, title: string, shapes: IMySQLDbSystemShapeSummary[]): IDialogValues {

        let selectedShape = shapes.find((shape) => {
            return request.values?.shapeName === shape.name;
        });

        if (shapes.length > 0 && !selectedShape) {
            selectedShape = shapes[0];
        }

        const mainSection: IDialogSection = {
            caption: title,
            values: {
                clusterSize: {
                    type: "number",
                    caption: "Cluster Size",
                    value: request.values?.clusterSize as number,
                    horizontalSpan: 4,
                    options: [CommonDialogValueOption.AutoFocus],
                },
                shapeName: {
                    type: "choice",
                    caption: "Shape Name",
                    value: selectedShape?.name,
                    choices: shapes.map((shape) => {
                        return shape.name;
                    }),
                    horizontalSpan: 4,
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
