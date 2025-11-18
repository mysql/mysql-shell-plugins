/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

import "./JdvDialog.css";

import { DialogResponseClosure, IDialogRequest, IDictionary } from "../../../app-logic/general-types.js";
import { ui } from "../../../app-logic/UILayer.js";
import { IJdvViewInfo } from "../../../communication/ProtocolGui.js";
import { AwaitableValueEditDialog } from "../../../components/Dialogs/AwaitableValueEditDialog.js";
import {
    CommonDialogValueOption, IDialogSection, IDialogValidations, IDialogValues,
} from "../../../components/Dialogs/ValueEditDialog.js";
import { systemSchemas } from "../../../data-models/data-model-types.js";
import { ShellInterfaceSqlEditor } from "../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { IJdvObjectFieldEditorData, JdvObjectFieldEditor } from "./JdvObjectFieldEditor.js";

export class JdvObjectDialog extends AwaitableValueEditDialog {
    private requestValue!: IJdvViewInfo;
    private createView!: boolean;
    private backend!: ShellInterfaceSqlEditor;
    private schemasWithTables: Record<string, string[]> = {};
    private dialogValues!: IDialogValues;

    protected override get id(): string {
        return "jdvObjectDialog";
    }

    public override async show(request: IDialogRequest, title?: string): Promise<IDictionary | DialogResponseClosure> {
        const payload = request.values?.payload as IDictionary | undefined;

        if (payload?.jdvViewInfo && payload.createView !== undefined && payload.backend) {
            this.requestValue = payload.jdvViewInfo as IJdvViewInfo;
            this.createView = payload.createView as boolean;
            this.backend = payload.backend as ShellInterfaceSqlEditor;
        } else {
            void ui.showErrorMessage(`Cannot open dialog: invalid request received.`, {});

            return DialogResponseClosure.Cancel;
        }

        const schemas = await this.backend.getCatalogObjects("Schema");
        const nonUserSchemas = new Set([...systemSchemas, "performance_schema", "sys", "information_schema"]);
        for (const schema of schemas) {
            if (!nonUserSchemas.has(schema)) {
                const tables = await this.backend.getSchemaObjectNames(schema, "Table");
                this.schemasWithTables[schema] = tables;
            }
        }

        this.dialogValues = this.createDialogValues(title);
        const result = await this.doShow(() => {
            return this.dialogValues;
        }, { title: "Json Duality View Builder", autoResize: true });

        if (result.closure === DialogResponseClosure.Accept) {
            return this.processResults(result.values);
        }

        return DialogResponseClosure.Cancel;
    }

    protected override validateInput = (closing: boolean, values: IDialogValues): Promise<IDialogValidations> => {
        const result: IDialogValidations = {
            messages: {},
            requiredContexts: [],
        };

        // checks at the main section
        const mainSection = values.sections.get("mainSection");
        if (mainSection) {
            if (!mainSection.values.viewName.value) {
                result.messages.viewName = "Json duality view name must not be empty.";
            }
        }

        // checks for the TreeGrid
        const jdvEditSection = values.sections.get("jdvEditSection");
        if (jdvEditSection) {
            const jdvObjectValue = jdvEditSection.values.tree.value;
            const jdvObjectData = (jdvObjectValue as unknown) as IJdvObjectFieldEditorData;
            const messages = JdvObjectFieldEditor.validateJdvObjectFields(jdvObjectData);
            if (messages.length !== 0) {
                result.messages.tree = messages[0];
            }
        }

        return Promise.resolve(result);
    };

    private createDialogValues(title?: string): IDialogValues {

        const mainSection: IDialogSection = {
            caption: title,
            values: {
                viewSchema: {
                    type: "choice",
                    caption: "JSON Duality View Schema Name",
                    value: this.requestValue.schema,
                    choices: Object.keys(this.schemasWithTables),
                    horizontalSpan: 4,
                    description: "The schema where the duality view is created",
                },
                viewName: {
                    type: "text",
                    caption: "JSON Duality View Name",
                    value: this.requestValue.name,
                    horizontalSpan: 4,
                    options: [CommonDialogValueOption.AutoFocus],
                },
            },
        };

        // View name should be un-editable when editing a duality view.
        if (!this.createView) {
            mainSection.values.viewName.options?.push(CommonDialogValueOption.Disabled);
        }

        // Add JdvObjectFieldEditor
        const customData: IJdvObjectFieldEditorData = {
            jdvSchema: this.requestValue.schema,
            defaultJdvName: this.requestValue.name,
            createView: this.createView,
            jdvViewInfo: this.requestValue,
            jdvObjects: [],
            rootJdvObjectId: undefined,
            currentTreeItems: [],
        };

        const jdvEditSection: IDialogSection = {
            caption: "Select View Mapping",
            groupName: "group1",
            expand: true,
            values: {
                tree: {
                    type: "custom",
                    value: customData,
                    component: <JdvObjectFieldEditor
                        backend={this.backend}
                        schemasWithTables={this.schemasWithTables}
                        getCurrentJdvInfo={this.handleGetCurrentJdvInfo} />,
                    horizontalSpan: 8,
                },
            },
        };

        return {
            id: "mainSection",
            sections: new Map<string, IDialogSection>([
                ["mainSection", mainSection],
                ["jdvEditSection", jdvEditSection],
            ]),
        };
    }

    private processResults = (dialogValues: IDialogValues): IDictionary => {
        const mainSection = dialogValues.sections.get("mainSection");
        const jdvEditSection = dialogValues.sections.get("jdvEditSection");
        if (mainSection && jdvEditSection) {
            const values: IDictionary = {};

            // mainSection
            values.name = mainSection.values.viewName.value;
            values.schema = mainSection.values.viewSchema.value;

            // jdvEditSection
            const jdvObjectValue = jdvEditSection.values.tree.value;
            const jdvObjectData = (jdvObjectValue as unknown) as IJdvObjectFieldEditorData;
            values.sql = JdvObjectFieldEditor.buildDataMappingViewSql(jdvObjectData);

            return values;
        }

        return {};
    };

    private handleGetCurrentJdvInfo = (): IJdvViewInfo => {
        const mainSection = this.dialogValues.sections.get("mainSection");
        if (mainSection) {
            this.requestValue.name = (mainSection.values.viewName.value as string);
            this.requestValue.schema = (mainSection.values.viewSchema.value as string);
        }

        return this.requestValue;
    };
}
