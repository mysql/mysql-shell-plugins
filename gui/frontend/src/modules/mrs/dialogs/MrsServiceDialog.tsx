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
import { IDialogRequest, IDictionary } from "../../../app-logic/Types";

import {
    DialogValueOption, IDialogSection, IDialogValidations, IDialogValues, ValueDialogBase, ValueEditDialog,
} from "../../../components/Dialogs";

export class MrsServiceDialog extends ValueDialogBase {
    private dialogRef = React.createRef<ValueEditDialog>();

    public render(): React.ReactNode {
        return (
            <ValueEditDialog
                ref={this.dialogRef}
                id="mrsServiceDialog"
                caption="MySQL REST Service"
                onClose={this.handleCloseDialog}
                onValidate={this.validateInput}
            />
        );
    }

    public show(request: IDialogRequest, title: string): void {
        this.dialogRef.current?.show(this.dialogValues(request, title), []);
    }

    private dialogValues(request: IDialogRequest, title: string): IDialogValues {
        const mainSection: IDialogSection = {
            caption: title,
            values: {
                serviceName: {
                    caption: "Service Name",
                    value: request.values?.serviceName as string,
                    span: 4,
                },
                comments: {
                    caption: "Comments",
                    value: request.values?.comments as string,
                    span: 4,
                },
                hostName: {
                    caption: "Host Name",
                    value: request.values?.hostName as string,
                    span: 8,
                },
                protocolsTitle: {
                    caption: "Supported Protocols",
                    span: 4,
                    options: [
                        DialogValueOption.Description,
                        DialogValueOption.Grouped,
                    ],
                },
            },
        };

        const setProtocols = (request.values?.protocols as string).split(",") ?? [];
        (request.parameters?.protocols as string[])?.forEach((value: string) => {
            mainSection.values["protocol" + value] = {
                caption: value,
                value: setProtocols.includes(value),
                span: 4,
                options: [
                    DialogValueOption.Grouped,
                ],
            };
        });

        mainSection.values.makeDefaultTitle = {
            caption: "MRS Service Flags",
            span: 4,
            options: [
                DialogValueOption.Description,
                DialogValueOption.Grouped,
                DialogValueOption.NewGroup,
            ],
        };

        mainSection.values.makeDefault = {
            caption: "Default",
            value: request.values?.isDefault as boolean || request.values?.isDefault !== undefined,
            span: 4,
            options: [
                DialogValueOption.Grouped,
            ],
        };

        mainSection.values.enabled = {
            caption: "Enabled",
            value: request.values?.enabled === 1 || request.values?.enabled === undefined,
            span: 4,
            options: [
                DialogValueOption.Grouped,
            ],
        };

        return {
            id: "mainSection",
            sections: new Map<string, IDialogSection>([
                ["mainSection", mainSection],
            ]),
        };
    }

    private handleCloseDialog = (accepted: boolean, dialogValues: IDialogValues): void => {
        const { onClose } = this.props;

        if (accepted) {
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

                onClose(true, values);
            }
        } else {
            onClose(false);
        }
    };

    private validateInput = (closing: boolean, values: IDialogValues): IDialogValidations => {
        const result: IDialogValidations = {
            messages: {},
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
