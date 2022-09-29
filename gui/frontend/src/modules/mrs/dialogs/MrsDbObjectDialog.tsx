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
import { IMrsDbObjectParameterData, IMrsSchemaData, IMrsServiceData } from "../../../communication";

import {
    IDialogSection, IDialogValidations, IDialogValues, ValueDialogBase, ValueEditDialog,
    CommonDialogValueOption, IRelationDialogValue,
} from "../../../components/Dialogs";

export class MrsDbObjectDialog extends ValueDialogBase {
    private dialogRef = React.createRef<ValueEditDialog>();
    private objectType: string;

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
        const schemas = request.parameters?.schemas as IMrsSchemaData[];
        const rowOwnershipFields = request.parameters?.rowOwnershipFields as string[];
        this.objectType = request.values?.objectType as string;

        this.dialogRef.current?.show(
            this.dialogValues(request, title, services, schemas, rowOwnershipFields),
            { title: "MySQL REST Object" },
            { services, schemas, rowOwnershipFields });
    }

    private dialogValues(request: IDialogRequest, title: string,
        services: IMrsServiceData[], schemas: IMrsSchemaData[], rowOwnershipFields: string[]): IDialogValues {

        let selectedService = services.find((service) => {
            return request.values?.serviceId === service.id;
        });

        if (services.length > 0 && !selectedService) {
            selectedService = services[0];
        }

        const selectedSchema = schemas.find((schema) => {
            return request.values?.dbSchemaId === schema.id;
        });

        const mainSection: IDialogSection = {
            caption: title,
            values: {
                service: {
                    type: "choice",
                    caption: "MRS Service Path",
                    value: selectedService?.hostCtx,
                    choices: [selectedService?.hostCtx ?? ""],
                    horizontalSpan: 4,
                },
                schema: {
                    type: "choice",
                    caption: "MRS Schema Path",
                    value: selectedSchema?.requestPath,
                    choices: schemas.filter((schema) => {
                        return schema.name === selectedSchema?.name;
                    }).map((schema) => {
                        return schema.requestPath;
                    }),
                    horizontalSpan: 4,
                },
                name: {
                    type: "text",
                    caption: "Database Object Name",
                    value: request.values?.name as string,
                    horizontalSpan: 4,
                    options: [CommonDialogValueOption.AutoFocus],
                    description: "The name of the database object",
                },
                requestPath: {
                    type: "text",
                    caption: "Request Path",
                    value: request.values?.requestPath as string,
                    horizontalSpan: 4,
                    description: "The path to access the object, has to start with /",
                },
                crudOperations: {
                    type: "set",
                    caption: "CRUD Operations",
                    tagSet: (this.objectType !== "PROCEDURE") ? ["CREATE", "READ", "UPDATE", "DELETE"] :
                        ["READ", "UPDATE"],
                    value: request.values?.crudOperations as string[],
                    horizontalSpan: 4,
                    description: "The CURD operations allowed for this database object",
                },
                flags: {
                    type: "description",
                    caption: "Flags",
                    horizontalSpan: 4,
                    options: [
                        CommonDialogValueOption.Grouped,
                        CommonDialogValueOption.NewGroup,
                    ],
                },
                enabled: {
                    type: "boolean",
                    caption: "Enabled",
                    horizontalSpan: 4,
                    value: (request.values?.enabled ?? true) as boolean,
                    options: [
                        CommonDialogValueOption.Grouped,
                    ],
                },
                requiresAuth: {
                    type: "boolean",
                    caption: "Requires Authentication",
                    horizontalSpan: 4,
                    value: (request.values?.requiresAuth ?? true) as boolean,
                    options: [
                        CommonDialogValueOption.Grouped,
                    ],
                },
            },
        };

        const basicSection: IDialogSection = {
            caption: "Basic",
            groupName: "group1",
            values: {
                crudOperationFormat: {
                    type: "choice",
                    caption: "Result Format",
                    choices: ["FEED", "ITEM", "MEDIA"],
                    value: request.values?.crudOperationFormat as string,
                    horizontalSpan: 4,
                },
                itemsPerPage: {
                    type: "text",
                    caption: "Items per Page",
                    horizontalSpan: 4,
                    value: request.values?.itemsPerPage as string,
                },
                rowUserOwnershipColumn: {
                    type: "choice",
                    caption: "Ownership Field",
                    value: request.values?.rowUserOwnershipColumn as string,
                    choices: rowOwnershipFields,
                    horizontalSpan: 4,
                    optional: true,
                    description: "Field that holds the user ID that should be managed by MRS",
                },
                rowUserOwnershipEnforced: {
                    type: "boolean",
                    caption: "User Ownership",
                    label: "Enforce Row User Ownership",
                    horizontalSpan: 4,
                    value: (request.values?.rowUserOwnershipEnforced ?? true) as boolean,
                    description: "Enables the user ID management by MRS",
                },
                comments: {
                    type: "text",
                    caption: "Comments",
                    value: request.values?.comments as string,
                    horizontalSpan: 8,
                },
            },
        };

        const parameterSection: IDialogSection = {
            caption: "Parameters",
            groupName: "group1",
            values: {
                parameters: {
                    type: "relation",
                    caption: "Parameters:",
                    value: request.values?.parameters as IMrsDbObjectParameterData[],
                    listItemCaptionFields: ["name"],
                    listItemId: "id",
                    active: request.values?.parameters as IMrsDbObjectParameterData[]
                        && (request.values?.parameters as IMrsDbObjectParameterData[]).length > 0
                        ? String((request.values?.parameters as IMrsDbObjectParameterData[])[0].id)
                        : undefined,
                    horizontalSpan: 2,
                    verticalSpan: 3,
                    relations: {
                        position: "paramPosition",
                        name: "paramName",
                        bindColumnName: "paramBindColumnName",
                        mode: "paramMode",
                        datatype: "paramDatatype",
                        comments: "paramComments",
                    },
                },
                paramName: {
                    type: "text",
                    caption: "Name",
                    value: "" as string,
                    horizontalSpan: 3,
                    description: "The name of the parameter",
                },
                paramBindColumnName: {
                    type: "text",
                    caption: "Database Object Field",
                    value: "" as string,
                    horizontalSpan: 3,
                    description: "The name of the database object field",
                },
                paramPosition: {
                    type: "number",
                    caption: "Position",
                    value: 1,
                    horizontalSpan: 1,
                    description: "The position",
                },
                paramDatatype: {
                    type: "choice",
                    caption: "Datatype",
                    choices: ["STRING", "INT", "DOUBLE", "BOOLEAN", "LONG", "TIMESTAMP", "JSON"],
                    value: "" as string,
                    horizontalSpan: 3,
                    description: "The datatype of the parameter",
                },
                paramMode: {
                    type: "choice",
                    caption: "Mode",
                    // cSpell:ignore INOUT
                    choices: ["IN", "OUT", "INOUT"],
                    value: "" as string,
                    horizontalSpan: 2,
                    description: "The mode of the parameter",
                },
                paramComments: {
                    type: "text",
                    caption: "Comments",
                    value: "" as string,
                    multiLine: true,
                    horizontalSpan: 6,
                },
            },
        };

        const advancedSection: IDialogSection = {
            caption: "Advanced",
            groupName: "group1",
            values: {
                mediaType: {
                    type: "text",
                    caption: "Media Type",
                    horizontalSpan: 4,
                    value: request.values?.mediaType as string,
                    description: "The HTML MIME Type of the result",
                },
                autoDetectMediaType: {
                    type: "boolean",
                    caption: "Automatically Detect Media Type",
                    horizontalSpan: 4,
                    value: (request.values?.autoDetectMediaType ?? false) as boolean,
                },
                authStoredProcedure: {
                    type: "text",
                    caption: "Custom Stored Procedure used for Authentication",
                    horizontalSpan: 8,
                    value: request.values?.authStoredProcedure as string,
                },
            },
        };

        const optionsSection: IDialogSection = {
            caption: "Options",
            groupName: "group1",
            values: {
                options: {
                    type: "text",
                    caption: "Options in JSON Format:",
                    value: request.values?.options as string,
                    horizontalSpan: 8,
                    multiLine: true,
                },
            },
        };

        return {
            id: "mainSection",
            sections: new Map<string, IDialogSection>([
                ["mainSection", mainSection],
                ["basicSection", basicSection],
                ["parameterSection", parameterSection],
                ["advancedSection", advancedSection],
                ["optionsSection", optionsSection],
            ]),
        };
    }

    private handleCloseDialog = (closure: DialogResponseClosure, dialogValues: IDialogValues,
        data?: IDictionary): void => {
        const { onClose } = this.props;

        if (closure === DialogResponseClosure.Accept && data) {
            const schemas = data.schemas as IMrsSchemaData[];
            const mainSection = dialogValues.sections.get("mainSection");
            const basicSection = dialogValues.sections.get("basicSection");
            const advancedSection = dialogValues.sections.get("advancedSection");
            const optionsSection = dialogValues.sections.get("optionsSection");
            const parameterSection = dialogValues.sections.get("parameterSection");
            if (mainSection && basicSection && advancedSection && optionsSection && parameterSection) {
                const values: IDictionary = {};
                values.objectType = this.objectType;

                // mainSection
                values.name = mainSection.values.name.value as string;
                values.dbSchemaId = schemas.find((schema) => {
                    return mainSection.values.schema.value === schema.requestPath;
                })?.id;
                values.requestPath = mainSection.values.requestPath.value as string;
                values.crudOperations = mainSection.values.crudOperations.value as string[];
                values.requiresAuth = mainSection.values.requiresAuth.value as boolean;
                values.enabled = mainSection.values.enabled.value as boolean;

                // basicSection
                values.itemsPerPage = basicSection.values.itemsPerPage.value as number;
                values.comments = basicSection.values.comments.value as string;
                values.crudOperationFormat = basicSection.values.crudOperationFormat.value as string;
                values.rowUserOwnershipColumn = basicSection.values.rowUserOwnershipColumn.value as string;
                values.rowUserOwnershipEnforced = basicSection.values.rowUserOwnershipEnforced.value as boolean;

                // advancedSection
                values.mediaType = advancedSection.values.mediaType.value as string;
                values.autoDetectMediaType = advancedSection.values.autoDetectMediaType.value as boolean;
                values.authStoredProcedure = advancedSection.values.authStoredProcedure.value as string;

                // optionsSection
                values.options = optionsSection.values.options.value as string;

                // parameters
                values.parameters = parameterSection.values.parameters.value;

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
                if (!mainSection.values.name.value) {
                    result.messages.name = "The object name must not be empty.";
                }

                if (!mainSection.values.requestPath.value) {
                    result.messages.requestPath = "The request path must not be empty.";
                } else {
                    const requestPath = mainSection.values.requestPath.value as string;
                    if (!requestPath.startsWith("/")) {
                        result.messages.requestPath = "The request path must start with '/'.";
                    }
                }
            }
        } else {
            // Detect change of the <new> entry
            const parameterSection = values.sections.get("parameterSection");
            if (parameterSection && parameterSection.values.parameters) {
                const paramDlgValue = parameterSection.values.parameters as IRelationDialogValue;
                const parameters = paramDlgValue.value as IMrsDbObjectParameterData[];
                const newEntry = parameters.find((p) => {
                    return p.id === 0;
                });
                // Detect a change of the <new> entry
                if (newEntry && newEntry.name !== "<new>") {
                    // Update id and position
                    newEntry.id = parameters.length * -1;
                    newEntry.position = parameters.length;

                    paramDlgValue.active = newEntry.id;

                    // Add another <new> entry
                    parameters.push({
                        id: 0,
                        dbObjectId: 0,
                        position: 0,
                        name: "<new>",
                        bindColumnName: "",
                        datatype: "STRING",
                        mode: "IN",
                        comments: "",
                    });
                }
            }
        }

        return result;
    };

}
