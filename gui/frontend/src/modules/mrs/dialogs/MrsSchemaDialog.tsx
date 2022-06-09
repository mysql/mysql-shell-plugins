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
import { IMrsServiceData } from "../../../communication";

import {
    IDialogSection, IDialogValidations, IDialogValues, ValueDialogBase, ValueEditDialog,
} from "../../../components/Dialogs";

export class MrsSchemaDialog extends ValueDialogBase {
    private dialogRef = React.createRef<ValueEditDialog>();

    public render(): React.ReactNode {
        return (
            <ValueEditDialog
                ref={this.dialogRef}
                id="mrsSchemaDialog"
                onClose={this.handleCloseDialog}
                onValidate={this.validateInput}
            />
        );
    }

    public show(request: IDialogRequest, title: string): void {
        const services = request.parameters?.services as IMrsServiceData[];

        this.dialogRef.current?.show(this.dialogValues(request, title, services), { title: "MySQL REST Service" },
            { services });
    }

    private dialogValues(request: IDialogRequest, title: string, services: IMrsServiceData[]): IDialogValues {

        let selectedService = services.find((service) => {
            return request.values?.serviceId === service.id;
        });

        if (services.length > 0 && !selectedService) {
            selectedService = services[0];
        }

        const mainSection: IDialogSection = {
            caption: title,
            values: {
                name: {
                    caption: "Schema Name",
                    value: request.values?.name as string,
                    span: 4,
                },
                service: {
                    caption: "MRS Service",
                    value: selectedService?.hostCtx,
                    choices: services.map((service) => {
                        return service.hostCtx;
                    }),
                    span: 4,
                },
                requestPath: {
                    caption: "Request Path",
                    value: request.values?.requestPath as string,
                    span: 4,
                },
                requiresAuth: {
                    caption: "Requires Authentication",
                    span: 4,
                    value: request.values?.requiresAuth as string,
                },
                itemsPerPage: {
                    caption: "Items per Page",
                    span: 4,
                    value: request.values?.itemsPerPage as string,
                },
                enabled: {
                    caption: "Enabled",
                    span: 4,
                    value: request.values?.enabled as string,
                },
                comments: {
                    caption: "Comments",
                    value: request.values?.comments as string,
                    span: 8,
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

    private handleCloseDialog = (closure: DialogResponseClosure, dialogValues: IDialogValues,
        data?: IDictionary): void => {
        const { onClose } = this.props;

        if (closure === DialogResponseClosure.Accept && data) {
            const services = data.services as IMrsServiceData[];
            const mainSection = dialogValues.sections.get("mainSection");
            if (mainSection) {
                const values: IDictionary = {};
                values.name = mainSection.values.name.value as string;
                values.serviceId = services.find((service) => {
                    return mainSection.values.service.value === service.hostCtx;
                })?.id;

                values.requestPath = mainSection.values.requestPath.value as string;
                values.requiresAuth = mainSection.values.requiresAuth.value as boolean;
                values.enabled = mainSection.values.enabled.value as boolean;
                values.itemsPerPage = mainSection.values.itemsPerPage.value as number;
                values.comments = mainSection.values.comments.value as string;

                onClose(closure, values);
            }
        } else {
            onClose(closure);
        }
    };

    private validateInput = (closing: boolean, values: IDialogValues): IDialogValidations => {
        const result: IDialogValidations = {
            messages: {},
        };

        if (closing) {
            const mainSection = values.sections.get("mainSection");
            if (mainSection) {
                if (!mainSection.values.name.value) {
                    result.messages.name = "The schema name must not be empty.";
                }
                if (!mainSection.values.requestPath.value) {
                    result.messages.requestPath = "The request path name must not be empty.";
                } else {
                    const requestPath = mainSection.values.requestPath.value as string;
                    if (!requestPath.startsWith("/")) {
                        result.messages.requestPath = "The request path name start with /.";
                    }
                }
            }
        }

        return result;
    };

}
