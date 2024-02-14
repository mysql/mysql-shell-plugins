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

import "./MrsDialogs.css";


import { DialogResponseClosure, IDialogRequest, IDictionary } from "../../../app-logic/Types.js";
import { IMrsDbObjectData, IMrsSchemaData, IMrsServiceData } from "../../../communication/ProtocolMrs.js";
import { AwaitableValueEditDialog } from "../../../components/Dialogs/AwaitableValueEditDialog.js";
import {
    CommonDialogValueOption, IDialogSection, IDialogValidations, IDialogValues,
} from "../../../components/Dialogs/ValueEditDialog.js";
import { ShellInterfaceSqlEditor } from "../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { convertToPascalCase } from "../../../utilities/string-helpers.js";
import { IMrsObjectFieldEditorData, MrsObjectFieldEditor } from "./MrsObjectFieldEditor.js";

export class MrsDbObjectDialog extends AwaitableValueEditDialog {
    private requestValue: IMrsDbObjectData;
    private objectType: string;
    private backend: ShellInterfaceSqlEditor;
    private createDbObject = false;
    private dialogValues?: IDialogValues;

    protected get id(): string {
        return "mrsDbObjectDialog";
    }

    public override async show(request: IDialogRequest, title?: string): Promise<IDictionary | DialogResponseClosure> {
        this.requestValue = request.values as IMrsDbObjectData;

        const services = request.parameters?.services as IMrsServiceData[];
        const schemas = request.parameters?.schemas as IMrsSchemaData[];
        const rowOwnershipFields = request.parameters?.rowOwnershipFields as string[];
        const payload = request.values?.payload as IDictionary;
        this.objectType = request.values?.objectType as string;
        this.backend = payload.backend as ShellInterfaceSqlEditor;
        this.createDbObject = payload.createObject as boolean;

        this.dialogValues = this.createDialogValues(request, services, schemas, rowOwnershipFields, title);
        const result = await this.doShow(() => { return this.dialogValues; },
            { title: "MySQL REST Object", autoResize: true });

        if (result.closure === DialogResponseClosure.Accept) {
            return this.processResults(schemas, result.values);
        }

        return DialogResponseClosure.Cancel;
    }

    /*public show(request: IDialogRequest, title?: string): void {
        this.requestValue = request.values as IMrsDbObjectData;

        const services = request.parameters?.services as IMrsServiceData[];
        const schemas = request.parameters?.schemas as IMrsSchemaData[];
        const rowOwnershipFields = request.parameters?.rowOwnershipFields as string[];
        const payload = request.values?.payload as IDictionary;
        this.objectType = request.values?.objectType as string;
        this.backend = payload.backend as ShellInterfaceSqlEditor;
        this.createDbObject = payload.createObject as boolean;

        this.dialogValues = this.createDialogValues(request, services, schemas, rowOwnershipFields, title);

        this.dialogRef.current?.show(
            this.dialogValues,
            { title: "MySQL REST Object", autoResize: true },
            { ...payload, services, schemas, rowOwnershipFields });
    }*/

    protected validateInput = (closing: boolean, values: IDialogValues): IDialogValidations => {
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

                if (!mrsObjectData.dbObject.name) {
                    result.messages.name = "The object name must not be empty.";
                }
            }
        }

        return result;
    };

    private createDialogValues(request: IDialogRequest,
        services: IMrsServiceData[], schemas: IMrsSchemaData[], rowOwnershipFields: string[],
        title?: string): IDialogValues {

        let selectedService = services.find((service) => {
            return service.id === request.values?.serviceId;
        });

        if (selectedService === undefined) {
            selectedService = services.find((service) => {
                return service.isCurrent === 1;
            });
        }

        if (services.length > 0 && !selectedService) {
            selectedService = services[0];
        }

        const selectedSchema = schemas.find((schema) => {
            return request.values?.dbSchemaId === schema.id;
        });

        let updateDisabled;
        if (!this.createDbObject) {
            updateDisabled = [CommonDialogValueOption.Disabled];
        }

        const mainSection: IDialogSection = {
            caption: title,
            values: {
                service: {
                    type: "choice",
                    caption: "REST Service Path",
                    value: selectedService?.hostCtx,
                    choices: services.map((service) => { return service.hostCtx; }),
                    horizontalSpan: 2,
                    description: "The path of the REST Service",
                    options: updateDisabled,
                },
                schema: {
                    type: "choice",
                    caption: "REST Schema Path",
                    value: selectedSchema?.requestPath,
                    choices: schemas.map((schema) => {
                        return schema.requestPath;
                    }),
                    horizontalSpan: 2,
                    description: "The path of the REST Schema",
                    options: updateDisabled,
                },
                requestPath: {
                    type: "text",
                    caption: "REST Object Path",
                    value: request.values?.requestPath as string,
                    horizontalSpan: 2,
                    description: "The path, has to starts with /",
                    options: [CommonDialogValueOption.AutoFocus],
                },
                flags: {
                    type: "description",
                    caption: "MRS Object Flags",
                    horizontalSpan: 2,
                    options: [
                        CommonDialogValueOption.Grouped,
                        CommonDialogValueOption.NewGroup,
                    ],
                },
                enabled: {
                    type: "boolean",
                    caption: "Enabled",
                    horizontalSpan: 2,
                    value: (request.values?.enabled ?? true) as boolean,
                    options: [
                        CommonDialogValueOption.Grouped,
                    ],
                },
                requiresAuth: {
                    type: "boolean",
                    caption: "Requires Auth",
                    horizontalSpan: 2,
                    value: (request.values?.requiresAuth ?? true) as boolean,
                    options: [
                        CommonDialogValueOption.Grouped,
                    ],
                },
            },
        };

        // ---------------------------------------------------------------------
        // Add MrsRestObjectFieldEditor
        const customData: IMrsObjectFieldEditorData = {
            servicePath: selectedService?.urlContextRoot ?? "",
            dbSchemaName: selectedSchema?.name ?? "",
            dbSchemaPath: selectedSchema?.requestPath ?? "",
            dbObject: this.requestValue,
            defaultMrsObjectName: convertToPascalCase(selectedService?.urlContextRoot ?? "") +
                convertToPascalCase(selectedSchema?.requestPath ?? "") +
                convertToPascalCase(this.requestValue.name),
            crudOperations: request.values?.crudOperations as string[],
            mrsObjects: [],
            currentlyListedTables: [],
            currentMrsObjectId: undefined,
            currentTreeItems: [],
            createDbObject: this.createDbObject,
        };

        const mrsObjectSection: IDialogSection = {
            caption: (this.requestValue.objectType === "PROCEDURE" ||
                this.requestValue.objectType === "FUNCTION")
                ? "Parameters/Result Sets" : "JSON/Relational Duality",
            groupName: "group1",
            expand: true,
            values: {
                tree: {
                    type: "custom",
                    value: customData,
                    component: <MrsObjectFieldEditor
                        backend={this.backend}
                        dbObjectChange={this.handleDbObjectChange}
                        getCurrentDbObject={this.handleGetCurrentDbObject} />,
                    horizontalSpan: 8,
                },
            },
        };

        const settingsSection: IDialogSection = {
            caption: "Settings",
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
                    multiLineCount: 8,
                    description: "Additional options in JSON format",
                },
            },
        };

        const authorizationSection: IDialogSection = {
            caption: "Authorization",
            groupName: "group1",
            values: {
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
                authStoredProcedure: {
                    type: "text",
                    caption: "Custom Stored Procedure used for Authorization",
                    horizontalSpan: 8,
                    value: request.values?.authStoredProcedure as string,
                },
            },
        };

        return {
            id: "mainSection",
            sections: new Map<string, IDialogSection>([
                ["mainSection", mainSection],
                ["mrsObject", mrsObjectSection],
                ["settingsSection", settingsSection],
                ["authorizationSection", authorizationSection],
                ["optionsSection", optionsSection],
            ]),
        };
    }

    private processResults = (schemas: IMrsSchemaData[], dialogValues: IDialogValues): IDictionary => {
        const mainSection = dialogValues.sections.get("mainSection");
        const settingsSection = dialogValues.sections.get("settingsSection");
        const optionsSection = dialogValues.sections.get("optionsSection");
        const mrsObjectSection = dialogValues.sections.get("mrsObject");
        const authorizationSection = dialogValues.sections.get("authorizationSection");
        if (mainSection && optionsSection && mrsObjectSection && authorizationSection && settingsSection) {
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

            // settingsSection
            values.itemsPerPage = settingsSection.values.itemsPerPage.value as number;
            values.comments = settingsSection.values.comments.value as string;
            values.crudOperationFormat = settingsSection.values.crudOperationFormat.value as string;
            values.mediaType = settingsSection.values.mediaType.value as string;
            values.autoDetectMediaType = settingsSection.values.autoDetectMediaType.value as boolean;

            // authorizationSection
            values.rowUserOwnershipColumn = authorizationSection.values.rowUserOwnershipColumn.value as string;
            values.rowUserOwnershipEnforced = authorizationSection.values.rowUserOwnershipEnforced.value as boolean;
            values.authStoredProcedure = authorizationSection.values.authStoredProcedure.value as string;

            // optionsSection
            values.options = optionsSection.values.options.value as string;

            // mrsObject
            const mrsObjectValue = mrsObjectSection.values.tree.value;
            const mrsObjectData = (mrsObjectValue as unknown) as IMrsObjectFieldEditorData;

            values.name = mrsObjectData.dbObject.name;
            values.crudOperations = mrsObjectData.crudOperations;

            // Ensure the editor changes are applied to the object list
            MrsObjectFieldEditor.updateMrsObjectFields(mrsObjectData);

            // Clear the storedFields to avoid unnecessary data being transferred
            for (const obj of mrsObjectData.mrsObjects) {
                obj.storedFields = undefined;
            }
            values.objects = mrsObjectData.mrsObjects;

            return values;
        }

        return {};
    };

    private handleDbObjectChange = (): void => {
        const authorizationSection = this.dialogValues?.sections.get("authorizationSection");
        if (authorizationSection) {
            authorizationSection.values.rowUserOwnershipColumn.value =
                this.requestValue.rowUserOwnershipColumn;
            authorizationSection.values.rowUserOwnershipEnforced.value =
                this.requestValue.rowUserOwnershipEnforced ?? true;
        }
    };

    private handleGetCurrentDbObject = (): IMrsDbObjectData => {
        const mainSection = this.dialogValues?.sections.get("mainSection");
        if (mainSection) {
            this.requestValue.requestPath = mainSection.values.requestPath.value as string;
            this.requestValue.enabled = + (mainSection.values.enabled.value as boolean);
            this.requestValue.requiresAuth = + (mainSection.values.requiresAuth.value as boolean);
        }

        return this.requestValue;
    };
}
