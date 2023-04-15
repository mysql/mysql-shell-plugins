/*
 * Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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

import { ComponentChild, createRef } from "preact";

import { DialogResponseClosure, IDialogRequest, IDictionary } from "../../../app-logic/Types";
import {
    IMrsServiceData, IMrsSchemaData, IMrsDbObjectFieldData,
    IMrsObjectFieldWithReference,
    IMrsDbObjectData,
} from "../../../communication/ProtocolMrs";
import { ValueDialogBase } from "../../../components/Dialogs/ValueDialogBase";
import {
    ValueEditDialog, IDialogValues, IDialogSection, CommonDialogValueOption, IDialogValidations,
    IRelationDialogValue,
} from "../../../components/Dialogs/ValueEditDialog";
import {
    IMrsObjectFieldEditorData, MrsObjectType, MrsObjectFieldEditor,
    IMrsObjectFieldTreeEntry,
    MrsObjectFieldTreeEntryType,
} from "./MrsObjectFieldEditor";
import { convertToPascalCase } from "../../../utilities/string-helpers";
import { uuidBinary16Base64 } from "../../../utilities/helpers";
import { ShellInterfaceSqlEditor } from "../../../supplement/ShellInterface/ShellInterfaceSqlEditor";

export class MrsDbObjectDialog extends ValueDialogBase {
    private dialogRef = createRef<ValueEditDialog>();
    private requestValue: IMrsDbObjectData;
    private objectType: string;
    private backend: ShellInterfaceSqlEditor;

    public render(): ComponentChild {
        return (
            <ValueEditDialog
                ref={this.dialogRef}
                id="mrsSchemaDialog"
                onClose={this.handleCloseDialog}
                onValidate={this.validateInput}
            />
        );
    }

    public show(request: IDialogRequest, title?: string): void {
        this.requestValue = request.values as IMrsDbObjectData;

        const services = request.parameters?.services as IMrsServiceData[];
        const schemas = request.parameters?.schemas as IMrsSchemaData[];
        const rowOwnershipFields = request.parameters?.rowOwnershipFields as string[];
        const payload = request.values?.payload as IDictionary;
        this.objectType = request.values?.objectType as string;
        this.backend = payload.backend as ShellInterfaceSqlEditor;

        this.dialogRef.current?.show(
            this.dialogValues(request, services, schemas, rowOwnershipFields, title),
            { title: "MySQL REST Object", autoResize: this.requestValue.objectType !== "PROCEDURE" },
            { ...payload, services, schemas, rowOwnershipFields });
    }

    private dialogValues(request: IDialogRequest,
        services: IMrsServiceData[], schemas: IMrsSchemaData[], rowOwnershipFields: string[],
        title?: string): IDialogValues {

        let selectedService = services.find((service) => {
            return service.isCurrent === 1;
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
                    caption: "REST Service Path",
                    value: selectedService?.hostCtx,
                    choices: services.map((service) => { return service.hostCtx; }),
                    horizontalSpan: this.requestValue.objectType !== "PROCEDURE" ? 2 : 3,
                    description: "The path of the REST Service",
                },
                schema: {
                    type: "choice",
                    caption: "REST Schema Path",
                    value: selectedSchema?.requestPath,
                    choices: schemas.map((schema) => {
                        return schema.requestPath;
                    }),
                    horizontalSpan: this.requestValue.objectType !== "PROCEDURE" ? 2 : 3,
                    description: "The path of the REST Schema",
                },
            },
        };

        if (this.requestValue.objectType !== "PROCEDURE") {
            mainSection.values.requestPath = {
                type: "text",
                caption: "REST Object Path",
                value: request.values?.requestPath as string,
                horizontalSpan: 2,
                description: "The path, has to starts with /",
                options: [CommonDialogValueOption.AutoFocus],
            };
        }
        mainSection.values.flags = {
            type: "description",
            caption: "Flags",
            horizontalSpan: 2,
            options: [
                CommonDialogValueOption.Grouped,
                CommonDialogValueOption.NewGroup,
            ],
        };

        mainSection.values.enabled = {
            type: "boolean",
            caption: "Enabled",
            horizontalSpan: 2,
            value: (request.values?.enabled ?? true) as boolean,
            options: [
                CommonDialogValueOption.Grouped,
            ],
        };

        mainSection.values.requiresAuth = {
            type: "boolean",
            caption: "Requires Auth",
            horizontalSpan: 2,
            value: (request.values?.requiresAuth ?? true) as boolean,
            options: [
                CommonDialogValueOption.Grouped,
            ],
        };

        if (this.requestValue.objectType === "PROCEDURE") {
            mainSection.values.requestPath = {
                type: "text",
                caption: "REST Object Path",
                value: request.values?.requestPath as string,
                horizontalSpan: 4,
                description: "The path, has to starts with /",
                options: [CommonDialogValueOption.AutoFocus],
            };

            mainSection.values.name = {
                type: "text",
                caption: "Schema Object Name",
                value: request.values?.name as string,
                horizontalSpan: 4,
                description: "The DB Schema Object name",
            };
        }

        // ---------------------------------------------------------------------
        // Add MrsRestObjectFieldEditor
        const mrsObjectId = uuidBinary16Base64();
        const customData: IMrsObjectFieldEditorData = {
            dbSchemaName: selectedSchema?.name ?? "",
            dbObjectName: this.requestValue.name,
            dbObjectType: MrsObjectType.Table,
            crudOperations: request.values?.crudOperations as string[],
            mrsObjects: [{
                id: mrsObjectId,
                dbObjectId: this.requestValue.id,
                name: convertToPascalCase(selectedService?.urlContextRoot ?? "") +
                    convertToPascalCase(selectedSchema?.requestPath ?? "") +
                    convertToPascalCase(this.requestValue.name),
                position: 1,
                sdkOptions: undefined,
                comments: undefined,
            }],
            fieldTreeNodes: [],
            listedTables: [],
            currentMrsObjectId: mrsObjectId,
        };

        const mrsObjectSection: IDialogSection = {
            caption: "JSON/Relational Duality",
            groupName: "group1",
            values: {
                tree: {
                    type: "custom",
                    value: customData,
                    component: <MrsObjectFieldEditor backend={this.backend} />,
                    horizontalSpan: 8,
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
                    horizontalSpan: 2,
                },
                itemsPerPage: {
                    type: "text",
                    caption: "Items per Page",
                    horizontalSpan: 2,
                    value: request.values?.itemsPerPage as string,
                },
                comments: {
                    type: "text",
                    caption: "Comments",
                    value: request.values?.comments as string,
                    horizontalSpan: 4,
                },
                rowUserOwnershipEnforced: {
                    type: "boolean",
                    caption: "Row Ownership",
                    label: "Enforce Row User Ownership",
                    horizontalSpan: 4,
                    value: (request.values?.rowUserOwnershipEnforced ?? true) as boolean,
                    description: "Enables the MRS row ownership management",
                },
                rowUserOwnershipColumn: {
                    type: "choice",
                    caption: "Row Ownership Field",
                    value: request.values?.rowUserOwnershipColumn as string,
                    choices: rowOwnershipFields,
                    horizontalSpan: 4,
                    optional: true,
                    description: "Field that holds the user ID that should be managed by MRS",
                },
            },
        };

        const objectData = request.values?.parameters as Array<IMrsDbObjectFieldData & IDictionary>;
        const parameterSection: IDialogSection = {
            caption: "Parameters",
            groupName: "group1",
            values: {
                parameters: {
                    type: "relation",
                    caption: "Parameters:",
                    value: objectData,
                    listItemCaptionFields: ["name"],
                    listItemId: "id",
                    active: objectData && objectData.length > 0 ? String(objectData[0].id) : undefined,
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
                    caption: "Options",
                    value: request.values?.options as string,
                    horizontalSpan: 8,
                    multiLine: true,
                    description: "Additional options in JSON format",
                },
            },
        };

        if (request.values?.objectType !== "PROCEDURE") {
            return {
                id: "mainSection",
                sections: new Map<string, IDialogSection>([
                    ["mainSection", mainSection],
                    ["mrsObject", mrsObjectSection],
                    ["basicSection", basicSection],
                    ["parameterSection", parameterSection],
                    ["advancedSection", advancedSection],
                    ["optionsSection", optionsSection],
                ]),
            };
        } else {
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

    }

    private handleCloseDialog = (closure: DialogResponseClosure, dialogValues: IDialogValues,
        payload?: IDictionary): void => {
        const { onClose } = this.props;

        if (closure === DialogResponseClosure.Accept && payload) {
            const schemas = payload.schemas as IMrsSchemaData[];
            const mainSection = dialogValues.sections.get("mainSection");
            const basicSection = dialogValues.sections.get("basicSection");
            const advancedSection = dialogValues.sections.get("advancedSection");
            const optionsSection = dialogValues.sections.get("optionsSection");
            const parameterSection = dialogValues.sections.get("parameterSection");
            const mrsObjectSection = dialogValues.sections.get("mrsObject");
            if (mainSection && basicSection && advancedSection && optionsSection && parameterSection) {
                const values: IDictionary = {};
                values.objectType = this.objectType;

                // mainSection
                values.servicePath = mainSection.values.service.value as string;
                values.dbSchemaPath = mainSection.values.schema.value as string;
                values.dbSchemaId = schemas.find((schema) => {
                    return mainSection.values.schema.value === schema.requestPath;
                })?.id;
                values.requestPath = mainSection.values.requestPath.value as string;
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

                // mrsObject - not available for PROCEDURES for now
                if (mrsObjectSection) {
                    const mrsObjectValue = mrsObjectSection.values.tree.value;
                    const mrsObjectData = (mrsObjectValue as unknown) as IMrsObjectFieldEditorData;

                    values.name = mrsObjectData.dbObjectName;
                    values.crudOperations = mrsObjectData.crudOperations;

                    const fieldList: IMrsObjectFieldWithReference[] = [];
                    const walk = (node: IMrsObjectFieldTreeEntry): void => {
                        if (node.children !== undefined) {
                            // Process the list of mrsObjectData.fieldTreeNodes backwards
                            for (let i = node.children.length - 1; i >= 0; i--) {
                                walk(node.children[i]);
                            }
                            /*node.children.forEach((child) => {
                                walk(child);
                            });*/
                        }
                        if (node.type === MrsObjectFieldTreeEntryType.Field) {
                            fieldList.push(node.field);
                        }
                    };

                    // Process the list of mrsObjectData.fieldTreeNodes backwards
                    for (let i = mrsObjectData.fieldTreeNodes.length - 1; i >= 0; i--) {
                        walk(mrsObjectData.fieldTreeNodes[i]);
                    }

                    mrsObjectData.mrsObjects[0].fields = fieldList;
                    values.mrsObject = mrsObjectData.mrsObjects[0];
                } else {
                    // Set back original values for PROCEDURES for now
                    values.name = mainSection.values.name?.value ?? this.requestValue.name;
                    values.crudOperations = this.requestValue.crudOperations;
                }

                values.payload = payload;
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
                if (!mainSection.values.requestPath.value) {
                    result.messages.requestPath = "The request path must not be empty.";
                } else {
                    const requestPath = mainSection.values.requestPath.value as string;
                    if (!requestPath.startsWith("/")) {
                        result.messages.requestPath = "The request path must start with '/'.";
                    }
                }
            }

            const mrsObjectSection = values.sections.get("mrsObject");
            if (mrsObjectSection) {
                // mrsObject
                const mrsObjectValue = mrsObjectSection.values.tree.value;
                const mrsObjectData = (mrsObjectValue as unknown) as IMrsObjectFieldEditorData;

                if (!mrsObjectData.dbObjectName) {
                    result.messages.name = "The object name must not be empty.";
                }
            }
        } else {
            // Detect change of the <new> entry
            const parameterSection = values.sections.get("parameterSection");
            if (parameterSection && parameterSection.values.parameters) {
                const paramDlgValue = parameterSection.values.parameters as IRelationDialogValue;
                const parameters = paramDlgValue.value as Array<IMrsDbObjectFieldData & IDictionary>;
                const newEntry = parameters.find((p) => {
                    return p.id === "";
                });
                // Detect a change of the <new> entry
                if (newEntry && newEntry.name !== "<new>") {
                    // Update id and position
                    newEntry.id = `${parameters.length * -1}`;
                    newEntry.position = parameters.length;

                    paramDlgValue.active = newEntry.id;

                    // Add another <new> entry
                    parameters.push({
                        id: "",
                        dbObjectId: "",
                        position: 0,
                        name: "<new>",
                        bindFieldName: "",
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
