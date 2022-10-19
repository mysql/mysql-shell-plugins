/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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
    CommonDialogValueOption, IDialogSection, IDialogValidations, IDialogValues, ValueDialogBase, ValueEditDialog,
} from "../../../components/Dialogs";

export class MrsServiceDialog extends ValueDialogBase {
    private dialogRef = React.createRef<ValueEditDialog>();

    public render(): React.ReactNode {
        return (
            <ValueEditDialog
                ref={this.dialogRef}
                id="mrsServiceDialog"
                onClose={this.handleCloseDialog}
                onValidate={this.validateInput}
            />
        );
    }

    public show(request: IDialogRequest, title: string): void {
        this.dialogRef.current?.show(this.dialogValues(request, title), { title: "MySQL REST Service" });
    }

    private dialogValues(request: IDialogRequest, title: string): IDialogValues {
        const mainSection: IDialogSection = {
            caption: title,
            values: {
                serviceName: {
                    type: "text",
                    caption: "Service Name",
                    value: request.values?.serviceName as string,
                    horizontalSpan: 4,
                },
                comments: {
                    type: "text",
                    caption: "Comments",
                    value: request.values?.comments as string,
                    horizontalSpan: 4,
                },
                hostName: {
                    type: "text",
                    caption: "Host Name",
                    value: request.values?.hostName as string,
                    horizontalSpan: 8,
                    options: [CommonDialogValueOption.AutoFocus],
                },
                protocolsTitle: {
                    type: "description",
                    caption: "Supported Protocols",
                    horizontalSpan: 4,
                    options: [CommonDialogValueOption.Grouped],
                },
            },
        };

        const setProtocols = (request.values?.protocols as string).split(",") ?? [];
        (request.parameters?.protocols as string[])?.forEach((value: string) => {
            mainSection.values["protocol" + value] = {
                type: "boolean",
                caption: value,
                value: setProtocols.includes(value),
                horizontalSpan: 4,
                options: [CommonDialogValueOption.Grouped],
            };
        });

        mainSection.values.makeDefaultTitle = {
            type: "description",
            caption: "MRS Service Flags",
            horizontalSpan: 4,
            options: [CommonDialogValueOption.Grouped, CommonDialogValueOption.NewGroup],
        };

        mainSection.values.makeDefault = {
            type: "boolean",
            caption: "Default",
            value: request.values?.isDefault as boolean ?? true,
            horizontalSpan: 4,
            options: [CommonDialogValueOption.Grouped],
        };

        mainSection.values.enabled = {
            type: "boolean",
            caption: "Enabled",
            value: request.values?.enabled as boolean ?? true,
            horizontalSpan: 4,
            options: [CommonDialogValueOption.Grouped],
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
                values.serviceName = mainSection.values.serviceName.value as string;
                values.comments = mainSection.values.comments.value as string;
                values.hostName = mainSection.values.hostName.value as string;
                values.isDefault = mainSection.values.makeDefault.value as boolean;
                values.enabled = mainSection.values.enabled.value as boolean;
                values.protocols = [];

                Object.getOwnPropertyNames(mainSection.values).forEach((property) => {
                    if (property.startsWith("protocol")) {
                        const enabled = mainSection.values[property].value as boolean;
                        if (enabled) {
                            (values.protocols as string[]).push(property.substring("protocol".length));
                        }
                    }
                });

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
                if (!mainSection.values.serviceName.value) {
                    result.messages.serviceName = "The service name must not be empty.";
                }
            }
        }

        return result;
    };

}
