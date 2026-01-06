/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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

import "./SchemaFilterEditor.css";

import { ComponentChild, createRef } from "preact";
import {
    IMigrationFilters
} from "../../communication/ProtocolMigration.js";
import {
    CommonDialogValueOption,
    ICheckListDialogValue, IDialogSection, IDialogValues, ValueEditDialog
} from "../../components/Dialogs/ValueEditDialog.js";
import { CheckState, ICheckboxProperties } from "../../components/ui/Checkbox/Checkbox.js";
import { ComponentBase, IComponentProperties, IComponentState } from "../../components/ui/Component/ComponentBase.js";
import { DialogResponseClosure } from "../general-types.js";
import { MigrationFilterInfo } from "./MigrationFilterInfo.js";

export interface ISchemaFilterEditorProperties extends IComponentProperties {
    filterInfo: MigrationFilterInfo;
    onClose: (accepted: boolean, objectType: keyof IMigrationFilters, schemaName: string) => void;
}

interface ISchemaFilterEditorState extends IComponentState {
    objectType: keyof IMigrationFilters;
    schemaName: string;
    objects?: string[];

    selection: string[];
}

export class SchemaFilterEditor extends ComponentBase<ISchemaFilterEditorProperties, ISchemaFilterEditorState> {
    private editorRef = createRef<ValueEditDialog>();

    public constructor(props: ISchemaFilterEditorProperties) {
        super(props);

        this.state = {
            objectType: "tables",
            schemaName: "",
            objects: undefined,

            selection: []
        };
    }

    public render(): ComponentChild {
        return (
            <ValueEditDialog
                ref={this.editorRef}
                id="schemaFilterEditor"
                onClose={this.handleOptionsDialogClose}
            />);
    }

    public async show(objectType: keyof IMigrationFilters, schemaName: string) {
        const { filterInfo } = this.props;
        const objects = await filterInfo.fetchSchemaObjects(schemaName, objectType);

        if (objects) {
            this.setState({ objectType, schemaName, objects });

            if (this.editorRef.current) {
                this.editorRef.current.show(
                    this.generateEditorConfig(objectType, schemaName, objects),
                    {
                        title: "Select Objects to Migrate"
                    }
                );
            }
        }
    }

    private getFilteredSelection(objectType: keyof IMigrationFilters, schemaName: string, objects: string[])
        : ICheckboxProperties[] {
        const { filterInfo } = this.props;

        const checkboxes = objects.map((name) => {
            const result: ICheckboxProperties = {
                id: name,
                caption: name,
                checkState: filterInfo.isObjectExcluded(schemaName, objectType, name)
                    ? CheckState.Checked : CheckState.Unchecked,
            };

            return result;
        });

        return checkboxes;
    }

    private applyFilteredSelection(objectType: keyof IMigrationFilters, selection: string[]) {
        const { filterInfo } = this.props;
        const { schemaName } = this.state;

        filterInfo.setExcludeList(schemaName, objectType, selection);
    }

    private generateEditorConfig = (objectType: keyof IMigrationFilters, schemaName: string,
        objects: string[]): IDialogValues => {
        const { filterInfo } = this.props;

        this.setState({ selection: filterInfo.getExcludedObjects(schemaName, objectType) });

        if (objects.length > 0) {
            const selection = this.getFilteredSelection(objectType, schemaName, objects);
            let count = 0;
            const commonSection: IDialogSection = {
                values: {
                    caption: {
                        type: "description",
                        caption: "Select " + objectType + " from schema " + schemaName
                            + " to be excluded from the migration.",
                        horizontalSpan: 8,
                    },
                    filteredObjects: {
                        type: "checkList",
                        caption: objectType + ":",
                        checkList: selection.map((value) => {
                            if (value.checkState === CheckState.Checked) {
                                count += 1;
                            }

                            return { data: value };
                        }),
                        description: `${count} objects excluded`,
                        onChange: this.handleFilteredObjectChange,
                        horizontalSpan: 8,
                    }
                }
            };

            return {
                id: "schemaFilterEditor",
                sections: new Map<string, IDialogSection>([
                    ["common", commonSection]
                ]),
            };
        } else {
            const commonSection: IDialogSection = {
                values: {
                    caption: {
                        type: "description",
                        caption: "Select " + objectType + " from schema " + schemaName
                            + " to be excluded from the migration.",
                        horizontalSpan: 4,
                    },
                    filteredObjects: {
                        type: "checkList",
                        caption: objectType + ":",
                        checkList: [],
                        description: `There are no ${objectType} in this schema`,
                        onChange: this.handleFilteredObjectChange,
                        horizontalSpan: 8,
                    }
                }
            };

            return {
                id: "schemaFilterEditor",
                sections: new Map<string, IDialogSection>([
                    ["common", commonSection]
                ]),
            };
        }
    };

    private getSelectedObjects(): string[] {
        const dialogValues = this.editorRef.current?.getDialogValues();
        const filteredObjects = dialogValues?.sections.get("common")?.values.filteredObjects as ICheckListDialogValue;

        return filteredObjects.checkList.map((entry) => {
            return entry.data.checkState === CheckState.Checked ? entry.data.id : undefined;
        }).filter((name) => {
            return name !== undefined;
        });
    }

    private handleOptionsDialogClose = (closure: DialogResponseClosure, values: IDialogValues,
        data?: IDictionary) => {
        const { onClose } = this.props;
        const { objectType, schemaName, selection } = this.state;

        if (closure !== DialogResponseClosure.Accept) {
            onClose(false, objectType, schemaName);

            return;
        }

        this.applyFilteredSelection(objectType, selection);

        onClose(true, objectType, schemaName);
    };

    private handleFilteredObjectChange = (entry: ICheckboxProperties) => {
        const selection = this.getSelectedObjects();

        this.setState({ selection });
        this.updateDescription(selection);
    };

    private updateDescription(aSelection?: string[]) {
        const { selection } = this.state;

        this.editorRef.current?.updateInputDescription(
            `${aSelection ? aSelection.length : selection.length} objects excluded`,
            "filteredObjects");
    }
}