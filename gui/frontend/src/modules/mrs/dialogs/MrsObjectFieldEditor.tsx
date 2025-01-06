/*
 * Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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

import allowSortingIcon from "../../../assets/images/allowSorting.svg";
import arrowIcon from "../../../assets/images/arrow.svg";
import checkAllIcon from "../../../assets/images/checkAll.svg";
import checkNoneIcon from "../../../assets/images/checkNone.svg";
import closeIcon from "../../../assets/images/close2.svg";
import inIcon from "../../../assets/images/in.svg";
import inOutIcon from "../../../assets/images/inOut.svg";
import keyIcon from "../../../assets/images/isKey.svg";
import mrsObjectIcon from "../../../assets/images/mrsDbObject.svg";
import noCheckIcon from "../../../assets/images/noCheck.svg";
import noFilterIcon from "../../../assets/images/noFilter.svg";
import noUpdateIcon from "../../../assets/images/noUpdate.svg";
import outIcon from "../../../assets/images/out.svg";
import addIcon from "../../../assets/images/plus.svg";
import rowOwnershipIcon from "../../../assets/images/rowOwnership.svg";
import functionIcon from "../../../assets/images/schemaFunction.svg";
import procedureIcon from "../../../assets/images/schemaProcedure.svg";
import tableIcon from "../../../assets/images/schemaTable.svg";
import columnIcon from "../../../assets/images/schemaTableColumn.svg";
import columnNnIcon from "../../../assets/images/schemaTableColumnNN.svg";
import columnPkIcon from "../../../assets/images/schemaTableColumnPK.svg";
import fkIcon11 from "../../../assets/images/schemaTableForeignKey11.svg";
import fkIcon1N from "../../../assets/images/schemaTableForeignKey1N.svg";
import fkIconN1 from "../../../assets/images/schemaTableForeignKeyN1.svg";
import viewIcon from "../../../assets/images/schemaView.svg";
import unnestedIcon from "../../../assets/images/unnest.svg";

import "./MrsObjectFieldEditor.css";

import { ComponentChild, createRef, render } from "preact";
import {
    CellComponent, ColumnDefinition, EmptyCallback, RowComponent, ValueBooleanCallback, ValueVoidCallback,
} from "tabulator-tables";

import { IDictionary } from "../../../app-logic/general-types.js";
import {
    IMrsDbObjectData, IMrsObject, IMrsObjectFieldWithReference, IMrsObjectReference,
    IMrsTableColumn,
} from "../../../communication/ProtocolMrs.js";
import { IValueEditCustomProperties, ValueEditCustom } from "../../../components/Dialogs/ValueEditCustom.js";
import { Button } from "../../../components/ui/Button/Button.js";
import { CheckState, Checkbox } from "../../../components/ui/Checkbox/Checkbox.js";
import { CodeEditor } from "../../../components/ui/CodeEditor/CodeEditor.js";
import { Codicon } from "../../../components/ui/Codicon.js";
import {
    IComponentProperties, IComponentState, SelectionType,
} from "../../../components/ui/Component/ComponentBase.js";
import { Container, ContentAlignment, Orientation } from "../../../components/ui/Container/Container.js";
import { Dropdown } from "../../../components/ui/Dropdown/Dropdown.js";
import { DropdownItem } from "../../../components/ui/Dropdown/DropdownItem.js";
import { Icon } from "../../../components/ui/Icon/Icon.js";
import { IInputChangeProperties, Input } from "../../../components/ui/Input/Input.js";
import { Label } from "../../../components/ui/Label/Label.js";
import { ITreeGridOptions, TreeGrid } from "../../../components/ui/TreeGrid/TreeGrid.js";
import { requisitions } from "../../../supplement/Requisitions.js";
import { ShellInterfaceSqlEditor } from "../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { uuidBinary16Base64 } from "../../../utilities/helpers.js";
import {
    convertCamelToSnakeCase, convertCamelToTitleCase, convertSnakeToCamelCase, convertToPascalCase,
} from "../../../utilities/string-helpers.js";
import { MrsDbObjectType, MrsObjectKind, MrsSdkLanguage } from "../types.js";
import { ui } from "../../../app-logic/UILayer.js";

export interface IMrsObjectFieldEditorData extends IDictionary {
    servicePath: string;
    dbSchemaName: string;
    dbSchemaPath: string;
    dbObject: IMrsDbObjectData;
    crudOperations: string[];
    createDbObject: boolean;
    defaultMrsObjectName: string;
    mrsObjects: IMrsObject[];
    showSdkOptions?: MrsSdkLanguage;
    currentMrsObjectId?: string;
    currentTreeItems: IMrsObjectFieldTreeItem[];
}

export interface IMrsObjectFieldEditorProperties extends IValueEditCustomProperties {
    backend: ShellInterfaceSqlEditor;
    dbObjectChange: () => void;
    getCurrentDbObject: () => IMrsDbObjectData;
}

interface IMrsObjectFieldEditorState extends IComponentState {
    sqlPreview: boolean;
}

export enum MrsObjectFieldTreeEntryType {
    LoadPlaceholder,
    FieldListOpen,
    Field,
    DeletedField,
    FieldListClose,
}

export interface IMrsObjectFieldUnnested {
    schemaTable: string;
    referenceFieldName: string;
    originalFieldName: string;
}

export interface IMrsObjectFieldTreeItem {
    type: MrsObjectFieldTreeEntryType;
    expanded: boolean;     // Currently expanded?
    expandedOnce: boolean; // Was expanded before?
    firstItem?: boolean;
    lastItem?: boolean;

    unnested?: IMrsObjectFieldUnnested; // Set if this field is an unnested copy

    field: IMrsObjectFieldWithReference;

    parent?: IMrsObjectFieldTreeItem;
    children?: IMrsObjectFieldTreeItem[];
}

enum ActionIconName {
    Crud,
    Unnest,
    Ownership,
    Filtering,
    Sorting,
    Update,
    Check,
    CheckAll,
    CheckNone,
    Delete,
    IncludeInKey,
}

export class MrsObjectFieldEditor extends ValueEditCustom<
    IMrsObjectFieldEditorProperties, IMrsObjectFieldEditorState> {
    private tableRef = createRef<TreeGrid>();

    public constructor(props: IMrsObjectFieldEditorProperties) {
        super(props);

        const data = props.values as IMrsObjectFieldEditorData;

        // Ensure that data is set
        if (!data) {
            throw new Error("The value of the MrsRestObjectFieldEditor custom control needs to be initialized.");
        }

        this.state = {
            sqlPreview: false,
        };

        // Load existing MRS Objects and their fields or create a new one if there is not one yet
        void this.initMrsObjects();
    }

    public static updateMrsObjectFields = (data: IMrsObjectFieldEditorData): void => {
        const fieldList: IMrsObjectFieldWithReference[] = [];
        const walk = (node: IMrsObjectFieldTreeItem): void => {
            if (node.children !== undefined) {
                for (const item of node.children) {
                    walk(item);
                }
            }
            if (node.type === MrsObjectFieldTreeEntryType.Field) {
                // Merge local state.
                node.field.dbColumn = {
                    ...node.field.dbColumn,
                    ...node.field.storedDbColumn as IMrsTableColumn,
                };

                // Ensure not to add unnested fields twice
                if (!fieldList.includes(node.field)) {
                    fieldList.push(node.field);
                }
            }
        };

        for (const item of data.currentTreeItems) {
            walk(item);
        }

        const mrsObject = data.mrsObjects.find((obj) => {
            return obj.id === data.currentMrsObjectId;
        });

        if (mrsObject) {
            mrsObject.fields = fieldList;
        }
    };

    public static buildDataMappingViewSql = (data: IMrsObjectFieldEditorData): string | undefined => {
        const cutLastComma = (fields: string): string => {
            // Cut the last , away if present
            if (fields.endsWith(",\n")) {
                return fields.slice(0, -2);
            }

            // Otherwise, just cut the last \n
            return fields.slice(0, -1);
        };

        const walk = (fields: IMrsObjectFieldWithReference[],
            parentId?: string, level?: number, addDataType?: boolean,
            currentObject?: IMrsObject | IMrsObjectReference): string => {
            let s = "";
            const reduceToFieldIds = fields.filter((f) => {
                return f.objectReference?.reduceToValueOfFieldId !== undefined;
            }).map((f) => {
                return f.objectReference?.reduceToValueOfFieldId ?? "";
            });

            for (const field of fields) {
                if (field.parentReferenceId === parentId ||
                    (field.parentReferenceId === null && parentId === undefined)) {
                    const indent = " ".repeat((level ?? 1) * 4);
                    if (!field.objectReference && (field.enabled || reduceToFieldIds.includes(field.id))) {
                        s += `${indent}${field.name}: ${String(field.dbColumn?.name)}`;
                        if (field.dbColumn?.in && !field.dbColumn?.out) { s += ` @IN`; }
                        if (!field.dbColumn?.in && field.dbColumn?.out) { s += ` @OUT`; }
                        if (field.dbColumn?.in && field.dbColumn?.out) { s += ` @INOUT`; }
                        // cSpell:ignore nocheck nofiltering rowownership
                        if (field.noCheck) { s += ` @NOCHECK`; }
                        if (field.noUpdate) { s += ` @NOUPDATE`; }
                        if (field.allowSorting) { s += ` @SORTABLE`; }
                        if (!field.allowFiltering) { s += ` @NOFILTERING`; }
                        if (field.id === currentObject?.rowOwnershipFieldId) { s += ` @ROWOWNERSHIP`; }
                        if (field.dbColumn?.isPrimary) { s += ` @KEY`; }
                        if (addDataType && field.dbColumn && field.dbColumn.datatype) {
                            s += ` @DATATYPE("${field.dbColumn.datatype}")`;
                        }
                        s += ",\n";
                    } else if (field.objectReference !== undefined && (field.enabled || field.objectReference.unnest)) {
                        const c = cutLastComma(walk(
                            fields, field.representsReferenceId, (level ?? 1) + 1, addDataType, field.objectReference));
                        let refTable = field.objectReference.referenceMapping.referencedSchema;
                        refTable += field.objectReference.referenceMapping.referencedTable ? "." +
                            field.objectReference.referenceMapping.referencedTable : "";
                        s += `${indent}${field.name}: ${refTable}`;
                        if (field.objectReference.options?.dualityViewInsert) { s += ` @INSERT`; }
                        if (field.objectReference.options?.dualityViewUpdate) { s += ` @UPDATE`; }
                        if (field.objectReference.options?.dualityViewDelete) { s += ` @DELETE`; }
                        if (field.objectReference.options?.dualityViewNoCheck) { s += ` @NOCHECK`; }
                        if (field.objectReference.unnest ||
                            field.objectReference.reduceToValueOfFieldId !== undefined) { s += ` @UNNEST`; }
                        s += ` {\n${c}\n${indent}},\n`;
                    }
                }
            }

            return s;
        };

        const addOptions = (dbObject: IMrsDbObjectData) => {
            let s = "";

            if (dbObject.enabled === 2) {
                s += "\n    PRIVATE";
            } else if (!dbObject.enabled) {
                s += "\n    DISABLED";
            }
            if (dbObject.requiresAuth) {
                s += "\n    AUTHENTICATION REQUIRED";
            }
            if (dbObject.itemsPerPage && dbObject.itemsPerPage !== 25) {
                s += `\n    ITEMS PER PAGE ${dbObject.itemsPerPage}`;
            }
            if (dbObject.comments) {
                s += `\n    COMMENTS "${dbObject.comments}"`;
            }
            if (dbObject.mediaType) {
                s += `\n    MEDIA TYPE ${dbObject.mediaType}`;
            }
            if (dbObject.crudOperationFormat !== "FEED") {
                s += `\n    FORMAT ${dbObject.crudOperationFormat}`;
            }
            if (dbObject.authStoredProcedure) {
                s += `\n    AUTHENTICATION PROCEDURE ${dbObject.authStoredProcedure}`;
            }
            if (dbObject.metadata) {
                const metadata = JSON.stringify(dbObject.metadata, undefined, 4);
                const indentString = (str: string, count: number, indent = " ") => {
                    return str.replace(/^/gm, indent.repeat(count));
                };

                s += `\n    METADATA ${indentString(metadata, 4).substring(4)}`;
            }

            return s;
        };

        let view;
        // Handle tables and views
        if (data.dbObject.objectType !== MrsDbObjectType.Procedure &&
            data.dbObject.objectType !== MrsDbObjectType.Function &&
            data.dbObject.objectType !== MrsDbObjectType.Script) {
            const mrsObject = data.mrsObjects.find((obj) => {
                return obj.id === data.currentMrsObjectId;
            });

            if (mrsObject) {
                view = `CREATE OR REPLACE REST VIEW ${data.dbObject.requestPath}\n` +
                    `    ON SERVICE ${data.servicePath} SCHEMA ${data.dbSchemaPath}\n` +
                    `    AS ${data.dbSchemaName}.${data.dbObject.name} CLASS ${mrsObject.name}`;

                if (mrsObject.options?.dualityViewInsert) {
                    view += ` @INSERT`;
                }
                if (mrsObject.options?.dualityViewUpdate) {
                    view += ` @UPDATE`;
                }
                if (mrsObject.options?.dualityViewDelete) {
                    view += ` @DELETE`;
                }
                if (mrsObject.options?.dualityViewNoCheck) {
                    view += ` @NOCHECK`;
                }

                if (mrsObject.fields) {
                    view += ` {\n${cutLastComma(walk(mrsObject?.fields, undefined, 2, undefined, mrsObject))}\n    }`;
                }

                view += addOptions(data.dbObject) + ";";
            }
        } else {
            // Handle procedures
            const mrsObject = data.mrsObjects.find((obj) => {
                return obj.kind === MrsObjectKind.Parameters;
            });

            if (mrsObject) {
                view = `CREATE OR REPLACE REST ${data.dbObject.objectType} ${data.dbObject.requestPath}\n` +
                    `    ON SERVICE ${data.servicePath} SCHEMA ${data.dbSchemaPath}\n` +
                    `    AS ${data.dbSchemaName}.${data.dbObject.name}`;

                if (mrsObject.fields) {
                    view += `\n    PARAMETERS ${mrsObject.name} {\n` +
                        walk(mrsObject?.fields, undefined, 2, undefined, mrsObject).slice(0, -2) + "\n    }";
                }

                for (const obj of data.mrsObjects) {
                    if (obj.kind !== MrsObjectKind.Parameters) {
                        if (obj.fields) {
                            view += `\n    RESULT ${obj.name} {\n`
                                + walk(obj.fields, undefined, 2, true, obj).slice(0, -2) + "\n    }";
                        }
                    }
                }

                view += addOptions(data.dbObject) + ";";
            }
        }

        return view;
    };

    public override render(): ComponentChild {
        const { values, getCurrentDbObject } = this.props;
        const { sqlPreview } = this.state;
        const data = values as IMrsObjectFieldEditorData;

        const schemaTreeOptions: ITreeGridOptions = {
            treeColumn: "json",
            treeChildIndent: -6,
            selectionType: SelectionType.None,
            showHeader: false,
            layout: "fitColumns",
            verticalGridLines: false,
            horizontalGridLines: false,
        };

        const schemaTreeColumns: ColumnDefinition[] = [{
            title: "Json",
            field: "json",
            resizable: true,
            hozAlign: "left",
            editable: true,
            widthGrow: 2,
            editor: this.editorHost,
            formatter: this.treeGridJsonColumnFormatter,
            cellEdited: this.handleCellEdited,
            cellDblClick: this.handleCellDblClick,
        }, {
            title: "Relational",
            field: "relational",
            resizable: false,
            hozAlign: "left",
            editable: true,
            widthGrow: 3,
            editor: this.editorHost,
            formatter: this.treeGridRelationalColumnFormatter,
            cellEdited: this.handleCellEdited,
            cellDblClick: this.handleCellDblClick,
        }];

        const sdkLang = (data.showSdkOptions !== undefined) ? String(MrsSdkLanguage[
            data.showSdkOptions]) : "";

        let sql = "";

        if (sqlPreview === true) {
            MrsObjectFieldEditor.updateMrsObjectFields(data);

            // Update the local DB Object reference if the DB Object has been updated by the main editor
            data.dbObject = getCurrentDbObject();
            // Build the SQL DDL statement
            sql = MrsObjectFieldEditor.buildDataMappingViewSql(data) ?? "";
        }

        const mrsObject = this.findMrsObjectById(data.currentMrsObjectId);

        let mrsObjectSelectionCaption;
        if (data.showSdkOptions === undefined) {
            if (mrsObject?.kind === MrsObjectKind.Parameters) {
                mrsObjectSelectionCaption = "Parameters";
            } else {
                mrsObjectSelectionCaption = `Result ${String(mrsObject?.position)}`;
            }
        } else {
            mrsObjectSelectionCaption = mrsObject?.name;
        }

        return (<Container
            className={this.getEffectiveClassNames(["mrsObjectFieldEditor",
                (data.showSdkOptions !== undefined) ? "showSdkOptions" : undefined])}
            orientation={Orientation.TopDown}
        >
            <Container
                className={"settings"}
                orientation={Orientation.LeftToRight}
                crossAlignment={ContentAlignment.Start}
            >
                <Container
                    className={"settingsMain"}
                    orientation={Orientation.LeftToRight}
                    crossAlignment={ContentAlignment.Center}
                >
                    <Container
                        className={"labelWithInput"}
                        orientation={Orientation.LeftToRight}
                        crossAlignment={ContentAlignment.Center}
                    >
                        <Label>DB Object:</Label>
                        <Input id="dbObject" value={data.dbObject.name} onChange={this.dbObjectNameChanged} />
                    </Container>
                    {(data.dbObject.objectType === MrsDbObjectType.Procedure ||
                        data.dbObject.objectType === MrsDbObjectType.Function ||
                        data.dbObject.objectType === MrsDbObjectType.Script) &&
                        <Container
                            className={"mrsObject"}
                            orientation={Orientation.LeftToRight}
                            crossAlignment={ContentAlignment.Center}
                        >
                            <Dropdown
                                id={"mrsObjectName"}
                                selection={mrsObjectSelectionCaption}
                                onSelect={(accept: boolean, sel) => {
                                    const val = [...sel];

                                    if (val.length > 0 && val[0] !== "") {
                                        let newMrsObject;
                                        // Either MrsObject kind + index entries are listed when showSdkOptions is not
                                        // enabled
                                        if (data.showSdkOptions === undefined) {
                                            if (val[0] === "Parameters") {
                                                newMrsObject = data.mrsObjects.find((obj) => {
                                                    return obj.kind = MrsObjectKind.Parameters;
                                                });
                                            } else {
                                                newMrsObject = data.mrsObjects.find((obj) => {
                                                    return val[0] === `Result ${String(obj?.position)}`;
                                                });
                                            }
                                        } else {
                                            // Or the actual MrsObject names
                                            newMrsObject = data.mrsObjects.find((obj) => {
                                                return val[0] === obj.name;
                                            });
                                        }

                                        void this.setCurrentMrsObject(newMrsObject);
                                    }
                                }}
                            >
                                {data.mrsObjects.map((obj) => {
                                    let itemName;
                                    // MrsObject kind + index entries are listed when showSdkOptions is not enabled
                                    if (data.showSdkOptions === undefined) {
                                        if (obj.kind === MrsObjectKind.Parameters) {
                                            itemName = "Parameters";
                                        } else {
                                            itemName = `Result ${String(obj?.position)}`;
                                        }
                                    } else {
                                        // Or the actual MrsObject names
                                        itemName = obj.name;
                                    }

                                    return <DropdownItem
                                        caption={itemName}
                                        key={itemName}
                                        id={itemName}
                                    />;
                                })}
                            </Dropdown>
                            {(data.dbObject.objectType === MrsDbObjectType.Procedure
                                && mrsObject?.kind !== MrsObjectKind.Parameters) &&
                                <Button onClick={this.removeCurrentMrsObject} imageOnly={true}
                                    data-tooltip="Remove the current result set definition">
                                    <Icon src={Codicon.Remove} width={11} height={11} />
                                </Button>
                            }
                            {data.dbObject.objectType === MrsDbObjectType.Procedure &&
                                <Button className="addMrsObjectBtn" onClick={this.addMrsObject}
                                    data-tooltip="Add a result set definition returned by this stored procedure">
                                    <Icon src={Codicon.Add} width={11} height={11} />
                                    <Label caption="Add Result" />
                                </Button>
                            }
                        </Container>
                    }
                </Container>
                <Container
                    className={"settingsRight"}
                    orientation={Orientation.RightToLeft}
                    crossAlignment={ContentAlignment.Center}
                >
                    {data.dbObject.objectType !== MrsDbObjectType.Script &&
                        <>
                            <Button
                                className="sqlCopyBtn"
                                key="sqlCopyBtn"
                                data-tooltip="Copy SQL to Clipboard"
                                onClick={this.copySqlToClipboard}
                                imageOnly={true}
                            >
                                <Icon src={Codicon.Copy} width={11} height={11} data-tooltip="inherit" />
                            </Button>
                            <Button
                                className={this.getEffectiveClassNames(
                                    ["sqlPreviewBtn", sqlPreview ? "buttonActivated" : undefined])}
                                key="sqlPreviewBtn"
                                data-tooltip="Toggle MRS SQL Preview"
                                onClick={this.toggleSqlPreview}
                                imageOnly={true}
                            >
                                <Icon src={Codicon.Search} width={11} height={11} data-tooltip="inherit" />
                                <Label caption="SQL Preview" data-tooltip="inherit" />
                            </Button>
                        </>
                    }
                    <div className="divider" />
                    {!sqlPreview &&
                        <>
                            <Container
                                className={"labelWithInput"}
                                orientation={Orientation.LeftToRight}
                                crossAlignment={ContentAlignment.Center}
                            >
                                <Dropdown
                                    id={"sdkLanguage"}
                                    placeholder="SDK Language"
                                    data-tooltip={"Select a SDK language to display the specific interface " +
                                        "names and datatypes"}
                                    selection={sdkLang}
                                    optional={true}
                                    onSelect={(accept: boolean, sel) => {
                                        const val = [...sel];
                                        if (val.length > 0 && val[0] !== "") {
                                            const lang: MrsSdkLanguage = MrsSdkLanguage[
                                                val[0] as keyof typeof MrsSdkLanguage];
                                            data.showSdkOptions = lang;
                                        } else {
                                            data.showSdkOptions = undefined;
                                        }
                                        this.updateStateData(data);
                                    }}
                                >
                                    {Object.values(MrsSdkLanguage).map((lang) => {
                                        if (!(Number(lang) >= 0)) {
                                            return <DropdownItem
                                                caption={String(lang)}
                                                key={String(lang)}
                                                id={String(lang)}
                                            />;
                                        } else {
                                            return undefined;
                                        }
                                    })}
                                </Dropdown>
                            </Container>
                            <div className="divider" />
                        </>
                    }
                </Container>
            </Container>
            {sqlPreview === false &&
                <TreeGrid
                    className={this.getEffectiveClassNames(["mrsObjectTreeGrid"])}
                    ref={this.tableRef}
                    options={schemaTreeOptions}
                    columns={schemaTreeColumns}
                    tableData={data.currentTreeItems}

                    onRowExpanded={this.handleRowExpanded}
                    onRowCollapsed={this.handleRowCollapsed}
                    isRowExpanded={this.isRowExpanded}
                    onFormatRow={this.treeGridRowFormatter}
                />
            }
            {sqlPreview === true &&
                <Container className="sqlPreview"
                    orientation={Orientation.LeftToRight}
                    crossAlignment={ContentAlignment.Start}
                >
                    <CodeEditor initialContent={sql}
                        language="mysql" readonly={true}
                        lineNumbers={"off"}
                        font={{
                            fontFamily: "var(--msg-monospace-font-family)",
                            fontSize: 12,
                            lineHeight: 18,
                        }}
                        minimap={{
                            enabled: false,
                        }}
                        scrollbar={{
                            useShadows: true,
                            verticalHasArrows: false,
                            horizontalHasArrows: false,
                            vertical: "auto",
                            horizontal: "auto",

                            verticalScrollbarSize: 8,
                            horizontalScrollbarSize: 8,
                        }}
                    />
                </Container>
            }
        </Container>
        );
    }

    private updateStateData = (data: IMrsObjectFieldEditorData, callback?: () => void): void => {
        const { onDataChange } = this.props;

        // Call onDataChange callback
        onDataChange?.(data, callback);
    };

    private toggleSqlPreview = (): void => {
        const { sqlPreview } = this.state;

        this.setState({
            sqlPreview: !sqlPreview,
        });
    };

    private copySqlToClipboard = (): void => {
        const { values, getCurrentDbObject } = this.props;
        const data = values as IMrsObjectFieldEditorData;

        MrsObjectFieldEditor.updateMrsObjectFields(data);

        // Update the local DB Object reference if the DB Object has been updated by the main editor
        data.dbObject = getCurrentDbObject();

        const text = MrsObjectFieldEditor.buildDataMappingViewSql(data) ?? "";
        requisitions.writeToClipboard(text);
    };

    /**
     * -----------------------------------------------------------------------------------------------------------------
     * TreeGrid Row / Column Formatter
     */

    private treeGridRowFormatter = (row: RowComponent): void => {
        const rowData = row.getData() as IMrsObjectFieldTreeItem;

        if (rowData.field.objectReference) {
            row.getElement().classList.add("referenceRow");

            if (rowData.field.objectReference) {
                let fkKind;
                switch (rowData.field.objectReference.referenceMapping.kind) {
                    case "1:1": {
                        fkKind = "fk11";
                        break;
                    }
                    case "n:1": {
                        fkKind = "fkN1";
                        break;
                    }
                    default: {
                        fkKind = "fk1N";
                    }
                }

                row.getElement().classList.add(fkKind);
            }

            if (rowData.expanded) {
                row.getElement().classList.add("expanded");
            } else {
                row.getElement().classList.remove("expanded");
            }
        } else {
            row.getElement().classList.remove("referenceRow");
        }

        if (rowData.firstItem) {
            row.getElement().classList.add("firstItem");
        }

        if (rowData.lastItem) {
            row.getElement().classList.add("lastItem");
        }

        if (rowData.type === MrsObjectFieldTreeEntryType.DeletedField) {
            row.getElement().classList.add("deleted");
        }
    };

    private treeGridJsonColumnFormatter = (cell: CellComponent): string | HTMLElement => {
        const { values } = this.props;
        const data = values as IMrsObjectFieldEditorData;
        const cellData = cell.getData() as IMrsObjectFieldTreeItem;

        const host = document.createElement("div");
        if (cellData.type === MrsObjectFieldTreeEntryType.Field
            || cellData.type === MrsObjectFieldTreeEntryType.DeletedField) {
            host.className = this.getEffectiveClassNames(["mrsObjectJsonFieldDiv",
                cellData.children ? "withChildren" : "withoutChildren"]);
        } else {
            host.className = "mrsObjectJsonFieldDiv";
        }

        const mrsObject = this.findMrsObjectById(data.currentMrsObjectId);
        const mrsObjectReference = cellData.parent?.field.objectReference;
        let content;

        const showFieldListOpenActionIcons = !(
            (data.dbObject.objectType === MrsDbObjectType.Procedure ||
                data.dbObject.objectType === MrsDbObjectType.Function)
            && mrsObject?.kind === MrsObjectKind.Result);
        const showFieldActionIcons = cellData.field.objectReference === undefined &&
            !((data.dbObject.objectType === MrsDbObjectType.Procedure ||
                data.dbObject.objectType === MrsDbObjectType.Function ||
                data.dbObject.objectType === MrsDbObjectType.Script)
                && mrsObject?.kind === MrsObjectKind.Result);

        if (cellData.type === MrsObjectFieldTreeEntryType.FieldListOpen) {
            // Handle the top table row
            if (!cell.getRow().getPrevRow()) {
                content = <>
                    <Container
                        className="fieldInfo"
                        orientation={Orientation.LeftToRight}
                        crossAlignment={ContentAlignment.Center}
                    >
                        <Icon className="tableIcon" src={mrsObjectIcon} width={16} height={16} />
                        <Label className={data.showSdkOptions === undefined ? "tableName" : "datatype"}
                            caption={data.showSdkOptions === undefined
                                ? mrsObject?.name : this.getMrsObjectName(cellData)} />
                        <Label className="tableName" caption={"{"} />
                    </Container>
                    <Container
                        className={"fieldOptions"}
                        orientation={Orientation.LeftToRight}
                        crossAlignment={ContentAlignment.Center}
                    >
                        {showFieldListOpenActionIcons && data.dbObject.objectType !== MrsDbObjectType.Script &&
                            <Icon className={mrsObject?.options?.dualityViewNoCheck
                                ? "selected" : "notSelected"} src={noCheckIcon} width={16} height={16}
                                onClick={() => { this.handleIconClick(cell, ActionIconName.Check); }}
                                data-tooltip="Disable ETAG calculations for this table." />
                        }
                        {data.dbObject.objectType !== MrsDbObjectType.Script &&
                            <>
                                <Icon className="action"
                                    src={checkAllIcon} width={16} height={16}
                                    onClick={() => { this.handleIconClick(cell, ActionIconName.CheckAll); }} />
                                <Icon className="action"
                                    src={checkNoneIcon} width={16} height={16}
                                    onClick={() => { this.handleIconClick(cell, ActionIconName.CheckNone); }} />
                                <Label caption="…" />
                            </>
                        }
                    </Container>
                </>;
            } else {
                content = <>
                    {(data.showSdkOptions !== undefined) &&
                        <Label className="datatype" caption={this.getJsonFieldDatatype(cellData)} />
                    }
                    <Label className="bracket" caption={
                        `${cellData.field.objectReference?.referenceMapping.kind === "1:n" ? "[ " : ""}{`} />
                </>;
            }
        } else if (cellData.type === MrsObjectFieldTreeEntryType.Field
            || cellData.type === MrsObjectFieldTreeEntryType.DeletedField
            || cellData.type === MrsObjectFieldTreeEntryType.LoadPlaceholder) {
            const unnested = cellData.field.objectReference?.unnest ?? false;
            content = <>
                <Container
                    className="fieldInfo"
                    orientation={Orientation.LeftToRight}
                    crossAlignment={ContentAlignment.Center}
                >
                    <Checkbox
                        id={cellData.field.id}
                        className={cellData.children ? "withChildren" : "withoutChildren"}
                        checkState={
                            unnested ? CheckState.Indeterminate
                                : cellData.field.enabled ? CheckState.Checked
                                    : CheckState.Unchecked}
                        onClick={(e) => { this.treeGridToggleEnableState(e, cell); }}
                        disabled={unnested}
                    />
                    <Label className={(unnested || !cellData.field.enabled)
                        ? "jsonFieldDisabled" : "jsonField"} caption={cellData.field.name} />
                    {cellData.unnested !== undefined &&
                        <Container
                            className={"unnestedDiv"}
                            orientation={Orientation.LeftToRight}
                            crossAlignment={ContentAlignment.Center}>
                            <Label className="referenceFieldName" caption={`(`} />
                            <Icon className="unnestedIcon" src={unnestedIcon} width={16} height={16} />
                            <Label className="referenceFieldName" caption={
                                `${cellData.unnested.referenceFieldName})`} />
                        </Container>
                    }
                    {(data.showSdkOptions !== undefined) &&
                        <>
                            <Label className="dot" caption={":"} />
                            <Label className="datatype" caption={
                                // Reverse order because of CSS {direction: rtl;} setting
                                `${cellData.field.dbColumn?.isArray ? "[ ]" : ""}${this.getJsonFieldDatatype(cellData)}`
                            } />
                        </>
                    }
                </Container>
                <Container
                    className={"fieldOptions"}
                    orientation={Orientation.LeftToRight}
                    crossAlignment={ContentAlignment.Center}
                >
                    {showFieldActionIcons &&
                        <>
                            {(cellData.parent === undefined || cellData.field.objectReference === undefined) &&
                                <Icon className={
                                    (cellData.field.id === mrsObject?.rowOwnershipFieldId ||
                                        cellData.field.id === mrsObjectReference?.rowOwnershipFieldId)
                                        ? "selected" : "notSelected"}
                                    src={rowOwnershipIcon} width={16} height={16}
                                    onClick={() => { this.handleIconClick(cell, ActionIconName.Ownership); }}
                                    data-tooltip="Set as row ownership field" />
                            }
                            {(data.dbObject.objectType !== MrsDbObjectType.Procedure &&
                                data.dbObject.objectType !== MrsDbObjectType.Function &&
                                data.dbObject.objectType !== MrsDbObjectType.Script) &&
                                <>
                                    <Icon className={cellData.field.storedDbColumn?.isPrimary
                                        ? "selected" : "notSelected"} src={keyIcon} width={16} height={16}
                                        onClick={() => { this.handleIconClick(cell, ActionIconName.IncludeInKey); }}
                                        data-tooltip="Include field in object composite key" />
                                    <Icon className={cellData.field.allowSorting
                                        ? "selected" : "notSelected"} src={allowSortingIcon} width={16} height={16}
                                        onClick={() => { this.handleIconClick(cell, ActionIconName.Sorting); }}
                                        data-tooltip="Allow sorting operations using this field" />
                                    <Icon className={!cellData.field.allowFiltering
                                        ? "selected" : "notSelected"} src={noFilterIcon} width={16} height={16}
                                        onClick={() => { this.handleIconClick(cell, ActionIconName.Filtering); }}
                                        data-tooltip="Prevent filtering operations on this field" />
                                    <Icon className={cellData.field.noUpdate
                                        ? "selected" : "notSelected"} src={noUpdateIcon} width={16} height={16}
                                        onClick={() => { this.handleIconClick(cell, ActionIconName.Update); }}
                                        data-tooltip="Prevent updates on this field" />
                                    <Icon className={cellData.field.noCheck
                                        ? "selected" : "notSelected"} src={noCheckIcon} width={16} height={16}
                                        onClick={() => { this.handleIconClick(cell, ActionIconName.Check); }}
                                        data-tooltip="Exclude this field from ETAG calculations" />
                                </>
                            }
                            {(mrsObject?.kind === MrsObjectKind.Parameters &&
                                data.dbObject.objectType !== MrsDbObjectType.Function) &&
                                <Icon className={"selected"} src={
                                    cellData.field.dbColumn?.in && cellData.field.dbColumn?.out
                                        ? inOutIcon : (cellData.field.dbColumn?.out ? outIcon : inIcon)}
                                    width={16} height={16}
                                    data-tooltip={cellData.field.dbColumn?.in && cellData.field.dbColumn?.out
                                        ? "INOUT parameter"
                                        : (cellData.field.dbColumn?.out
                                            ? "OUT parameter"
                                            : "IN parameter")} />
                            }
                        </>
                    }
                    {cellData.field.objectReference &&
                        <>
                            <Icon className={cellData.field.objectReference.options?.dualityViewNoCheck
                                ? "selected" : "notSelected"} src={noCheckIcon} width={16} height={16}
                                onClick={() => { this.handleIconClick(cell, ActionIconName.Check); }}
                                data-tooltip="Disable ETAG calculations for this table." />
                            <Icon className="action notSelected"
                                src={checkAllIcon} width={16} height={16}
                                onClick={() => { this.handleIconClick(cell, ActionIconName.CheckAll); }}
                                data-tooltip="Select all fields" />
                            <Icon className="action notSelected"
                                src={checkNoneIcon} width={16} height={16}
                                onClick={() => { this.handleIconClick(cell, ActionIconName.CheckNone); }}
                                data-tooltip="Deselect all fields" />
                        </>
                    }
                    {((data.dbObject.objectType === MrsDbObjectType.Procedure ||
                        data.dbObject.objectType === MrsDbObjectType.Function)
                        && mrsObject?.kind === MrsObjectKind.Result) &&
                        <>
                            <Icon className="action"
                                src={closeIcon} width={16} height={16}
                                onClick={() => { this.handleIconClick(cell, ActionIconName.Delete); }}
                                data-tooltip="Delete field" />
                        </>
                    }
                    {(!(cellData.field.objectReference === undefined
                        && !((data.dbObject.objectType === MrsDbObjectType.Procedure ||
                            data.dbObject.objectType === MrsDbObjectType.Function ||
                            data.dbObject.objectType === MrsDbObjectType.Script)
                            && mrsObject?.kind === MrsObjectKind.Result) &&
                        (cellData.field.id === mrsObject?.rowOwnershipFieldId ||
                            cellData.field.id === mrsObjectReference?.rowOwnershipFieldId)
                    )
                        || !((cellData.field.objectReference === undefined
                            && (data.dbObject.objectType !== MrsDbObjectType.Procedure &&
                                data.dbObject.objectType !== MrsDbObjectType.Function &&
                                data.dbObject.objectType !== MrsDbObjectType.Script) &&
                            (cellData.field.id === mrsObject?.rowOwnershipFieldId ||
                                cellData.field.id === mrsObjectReference?.rowOwnershipFieldId)
                        )
                            && !cellData.field.allowFiltering
                            && cellData.field.allowSorting
                            && cellData.field.noUpdate
                            && cellData.field.noCheck)
                        || cellData.field.objectReference) &&
                        <Label caption="…" />
                    }
                </Container>
                {(cellData.field.objectReference && (
                    cellData.field.objectReference.referenceMapping.kind === "1:1" ||
                    cellData.field.objectReference.referenceMapping.kind === "n:1") &&
                    cellData.field.objectReference.reduceToValueOfFieldId === undefined) &&
                    <Container
                        className={this.getEffectiveClassNames(["unnestDiv",
                            cellData.field.objectReference?.unnest ? "unnested" : "notUnnested"])}
                        orientation={Orientation.LeftToRight}
                        crossAlignment={ContentAlignment.Center}
                        onClick={() => { this.handleIconClick(cell, ActionIconName.Unnest); }}
                        onKeyPress={() => { this.handleIconClick(cell, ActionIconName.Unnest); }}
                        data-tooltip="Merge columns of the referenced table into this JSON object"
                    >
                        <Icon
                            tabIndex={0}
                            key={cellData.field.id + "CBtn"}
                            data-tooltip="inherit"
                            width={16}
                            height={16}
                            src={unnestedIcon} />
                        <Label data-tooltip="inherit">
                            Unnest
                        </Label>
                    </Container>
                }
            </>;
        } else if (cellData.type === MrsObjectFieldTreeEntryType.FieldListClose) {
            content = <>
                {data.dbObject.objectType === MrsDbObjectType.Procedure &&
                    mrsObject?.kind === MrsObjectKind.Result &&
                    <Icon className="addField" width="11px" height="11px"
                        src={addIcon} onClick={() => { this.addNewField(cell.getRow()); }} />
                }
                <Label className="bracket" caption={
                    `}${cellData.field.objectReference?.referenceMapping.kind === "1:n" ? ", ... ]" : ""}`} />
            </>;
        }

        render(content, host);

        return host;
    };

    private treeGridRelationalColumnFormatter = (cell: CellComponent): string | HTMLElement => {
        const cellData = cell.getData() as IMrsObjectFieldTreeItem;
        const { values } = this.props;
        const data = values as IMrsObjectFieldEditorData;
        const mrsObject = this.findMrsObjectById(data.currentMrsObjectId);

        const host = document.createElement("div");
        host.className = this.getEffectiveClassNames(["mrsObjectDbColumnFieldDiv"]);
        let content;

        // Get the options, either from the MRS object or from the object reference
        const options = !cell.getRow().getPrevRow() ? mrsObject?.options : cellData.field.objectReference?.options;

        let availableCrud = ["INSERT", "UPDATE", "DELETE"];
        if (cellData.field.objectReference?.referenceMapping.kind === "n:1") {
            availableCrud = ["UPDATE"];
        }


        const tableCrud: string[] = [];
        if (options) {
            if (options.dualityViewInsert) {
                tableCrud.push("INSERT");
            }
            if (options.dualityViewUpdate) {
                tableCrud.push("UPDATE");
            }
            if (options.dualityViewDelete) {
                tableCrud.push("DELETE");
            }
        }

        const crudDiv = <Container
            className={this.getEffectiveClassNames(["crudDiv", availableCrud.length > 1 ? "multiItems" : undefined])}
            orientation={Orientation.LeftToRight}
            crossAlignment={ContentAlignment.Center}>
            {availableCrud.map((op) => {
                return <Container
                    className={this.getEffectiveClassNames([
                        tableCrud.includes(op) ? "activated" : "deactivated",
                        cellData.field.objectReference?.reduceToValueOfFieldId === undefined ? "enabled" : "disabled",
                    ])}
                    orientation={Orientation.LeftToRight}
                    crossAlignment={ContentAlignment.Center}
                    onClick={() => { this.handleIconClick(cell, ActionIconName.Crud, op); }}
                    onKeyPress={() => { this.handleIconClick(cell, ActionIconName.Crud, op); }}
                    key={cellData.field.id + op}
                    data-tooltip={`Allow ${op} operations on this object`}
                >
                    <Label data-tooltip="inherit">{!cell.getRow().getPrevRow() || availableCrud.length === 1
                        ? op : op.substring(0, 3)}</Label>
                </Container>;
            })}
        </Container >;

        const dbColumn = cellData.field.dbColumn;

        if (cellData.type === MrsObjectFieldTreeEntryType.FieldListOpen) {
            let dbObjName;

            // Display the table name for the top table row
            if (cell.getRow().getPrevRow() && cellData.field.objectReference && data.showSdkOptions !== undefined) {
                dbObjName = cellData.field.objectReference.referenceMapping.referencedSchema + "." +
                    cellData.field.objectReference.referenceMapping.referencedTable;
            } else if (!cell.getRow().getPrevRow()) {
                dbObjName = `${data.dbSchemaName}.${data.dbObject.name}`;
            }

            let dbObjIcon;
            switch (data.dbObject.objectType) {
                case MrsDbObjectType.View:
                    dbObjIcon = viewIcon;
                    break;
                case MrsDbObjectType.Procedure:
                    dbObjIcon = procedureIcon;
                    break;
                case MrsDbObjectType.Function:
                case MrsDbObjectType.Script:
                    dbObjIcon = functionIcon;
                    break;
                default:
                    dbObjIcon = tableIcon;
                    break;
            }

            content = <>
                {dbObjName &&
                    <>
                        <Icon className="tableIcon" src={dbObjIcon} width={16} height={16} />
                        <Label className="tableName" caption={dbObjName}
                            data-tooltip="Database schema table" />
                    </>
                }
                {(!cell.getRow().getPrevRow() && data.dbObject.objectType !== MrsDbObjectType.Procedure &&
                    data.dbObject.objectType !== MrsDbObjectType.Function &&
                    data.dbObject.objectType !== MrsDbObjectType.Script) &&
                    crudDiv
                }
            </>;
        } else if (cellData.type === MrsObjectFieldTreeEntryType.Field
            || cellData.type === MrsObjectFieldTreeEntryType.DeletedField) {
            let iconName = dbColumn?.isPrimary ? columnPkIcon :
                (dbColumn?.notNull ? columnNnIcon : columnIcon);
            let tooltip = dbColumn?.isPrimary ? "Primary key column" :
                (dbColumn?.notNull ? "Table column that must not be NULL" : "Table column");

            if (cellData.field.objectReference) {
                switch (cellData.field.objectReference.referenceMapping.kind) {
                    case "1:1": {
                        iconName = fkIcon11;
                        tooltip = "Table with a 1:1 relationship";
                        break;
                    }
                    case "n:1": {
                        iconName = fkIconN1;
                        tooltip = "Table with a n:1 relationship";
                        break;
                    }
                    default: {
                        iconName = fkIcon1N;
                        tooltip = "Table with a 1:n relationship";
                    }
                }
            }
            if (!cellData.field.objectReference) {
                const dbColName = cellData.unnested === undefined
                    ? dbColumn?.name
                    : `${cellData.unnested.schemaTable}.${String(dbColumn?.name)}`;

                content = <>
                    <Icon src={arrowIcon} width={16} height={16} />
                    <Icon src={iconName} width={16} height={16}
                        data-tooltip={tooltip} />
                    <Label className="columnName" caption={dbColName} />
                    {data.showSdkOptions !== undefined &&
                        <Label className="datatype" caption={
                            `${dbColumn?.datatype.toUpperCase()}${dbColumn?.isArray ? "[ ]" : ""}`} />
                    }
                </>;
            } else {
                let refTbl = cellData.field.objectReference.referenceMapping.referencedSchema;
                if (cellData.field.objectReference.referenceMapping.referencedTable !== undefined &&
                    cellData.field.objectReference.referenceMapping.referencedTable !== "") {
                    refTbl += "." + cellData.field.objectReference.referenceMapping.referencedTable;
                }

                content = <>
                    <Icon src={arrowIcon} width={16} height={16} />
                    <Icon src={iconName} width={16} height={16}
                        data-tooltip={tooltip} />
                    <Icon src={tableIcon} width={16} height={16} />
                    <Label className="tableName" caption={refTbl} />
                    {cellData.field.enabled && data.dbObject.objectType !== MrsDbObjectType.Script &&
                        crudDiv}
                    {(cellData.field.objectReference.referenceMapping.kind === "1:n" &&
                        cellData.children && cellData.children.length > 0 &&
                        cellData.children[0].type !== MrsObjectFieldTreeEntryType.LoadPlaceholder) &&
                        <Dropdown
                            className="reduceToDropdown"
                            placeholder="Unnest field ..."
                            data-tooltip="Display selected field instead of the object. Updates will be disabled"
                            id={cellData.field.id + "reduceToDropdown"}
                            key={cellData.field.id + "reduceToDropdown"}
                            multiSelect={false}
                            optional={true}
                            selection={cellData.children?.find((item) => {
                                return item.field.id ===
                                    cellData.field.objectReference?.reduceToValueOfFieldId;
                            })?.field.name}
                            onSelect={(accept: boolean, sel) => {
                                // Update data
                                const treeItem = this.findTreeItemById(cellData.field.id, data.currentTreeItems);
                                if (treeItem && treeItem.field.objectReference) {
                                    const selVal = [...sel];
                                    let reduceToFieldId: string | undefined;
                                    if (selVal.length > 0) {
                                        reduceToFieldId = cellData.children?.find((item) => {
                                            return item.field.name === selVal[0] && !item.firstItem;
                                        })?.field.id;

                                        // Clear checkboxes of child rows, except the selected one and references
                                        if (reduceToFieldId) {
                                            cellData.children?.forEach((child) => {
                                                const childTreeItem = this.findTreeItemById(
                                                    child.field.id, data.currentTreeItems);
                                                if (childTreeItem && childTreeItem.field.id !== reduceToFieldId
                                                    && !childTreeItem.field.objectReference
                                                ) {
                                                    childTreeItem.field.enabled = false;
                                                } else if (childTreeItem &&
                                                    childTreeItem.field.id === reduceToFieldId) {
                                                    childTreeItem.field.enabled = true;
                                                }
                                            });
                                        }

                                        treeItem.expanded = false;
                                    } else {
                                        reduceToFieldId = undefined;
                                    }

                                    treeItem.field.objectReference.reduceToValueOfFieldId = reduceToFieldId;

                                    if (reduceToFieldId === undefined &&
                                        treeItem.field.objectReference.unnest === true) {
                                        this.handleIconClick(cell, ActionIconName.Unnest);
                                    }

                                    if (reduceToFieldId !== undefined) {
                                        treeItem.field.objectReference.unnest = true;
                                        this.updateStateData(data);
                                    }
                                }
                            }}
                            disabled={false}
                            autoFocus={false}
                        >
                            {cellData.children?.map((item, itemIndex) => {
                                return item.field.dbColumn?.name ? <DropdownItem
                                    caption={item.field.dbColumn?.name}
                                    key={itemIndex}
                                    id={item.field.dbColumn?.name}
                                /> : undefined;
                            })}
                        </Dropdown>
                    }
                </>;
            }
        }

        render(content, host);

        return host;
    };

    private getMrsObjectName = (cellData: IMrsObjectFieldTreeItem): string => {
        const { values } = this.props;
        const data = values as IMrsObjectFieldEditorData;
        const mrsObject = this.findMrsObjectById(data.currentMrsObjectId);

        // Get the right language options for the selected SDK language
        const mrsObjectSdkLangOptions = mrsObject?.sdkOptions?.languageOptions?.find((opts) => {
            return opts.language === data.showSdkOptions;
        });

        if (mrsObject !== undefined && cellData.type === MrsObjectFieldTreeEntryType.FieldListOpen) {
            return data.showSdkOptions
                ? mrsObjectSdkLangOptions?.className ? mrsObjectSdkLangOptions?.className : "I" + mrsObject.name
                : mrsObjectSdkLangOptions?.className ?? mrsObject.name;
        }

        return "Not defined";
    };

    private getJsonDatatype = (dbDatatype: string): string => {

        if (dbDatatype.startsWith("tinyint(1)") || dbDatatype.startsWith("bit(1)")) {
            return "boolean";
        }

        if (dbDatatype.startsWith("tinyint") ||
            dbDatatype.startsWith("smallint") ||
            dbDatatype.startsWith("mediumint") ||
            dbDatatype.startsWith("int") ||
            dbDatatype.startsWith("bigint") ||
            dbDatatype.startsWith("decimal") ||
            dbDatatype.startsWith("numeric") ||
            dbDatatype.startsWith("float") ||
            dbDatatype.startsWith("double")) {
            return "number";
        }

        if (dbDatatype.startsWith("json")) {
            return "unknown";
        }

        if (dbDatatype.startsWith("geometry")) {
            return "object";
        }

        return "string";
    };

    private getJsonFieldDatatype = (cellData: IMrsObjectFieldTreeItem): string => {
        const { values } = this.props;
        const data = values as IMrsObjectFieldEditorData;
        const mrsObject = this.findMrsObjectById(data.currentMrsObjectId);
        if (mrsObject === undefined) {
            return "mrsObject undefined";
        }

        let datatype = "";
        if (cellData.field.sdkOptions?.datatypeName) {
            datatype = cellData.field.sdkOptions?.datatypeName;
        } else if (cellData.field.objectReference?.referenceMapping?.referencedSchema !== undefined &&
            cellData.field.objectReference?.referenceMapping?.referencedTable === ""
        ) {
            datatype = cellData.field.objectReference?.referenceMapping?.referencedSchema;
        } else if (!cellData.field.objectReference?.referenceMapping ||
            cellData.field.objectReference?.referenceMapping === null) {
            datatype = this.getJsonDatatype(cellData.field.dbColumn?.datatype ?? "");
        } else {
            datatype = `I${mrsObject.name}${convertCamelToTitleCase(cellData.field.name)}`;
        }

        return datatype;
    };

    /**
     * -----------------------------------------------------------------------------------------------------------------
     * TreeGrid Building and Loading
     */

    private addFieldsToMrsObjectTreeList = async (
        dbSchemaName: string, dbObjectName: string, dbObjectType: MrsDbObjectType,
        parentTreeItem?: IMrsObjectFieldTreeItem,
        initTreeItemsToUnnest?: IMrsObjectFieldTreeItem[],
        initTreeItemsToReduce?: IMrsObjectFieldTreeItem[]): Promise<void> => {
        const { values } = this.props;
        const data = values as IMrsObjectFieldEditorData;

        // Get the current object and return immediately if it is not set
        const currentObject = this.findMrsObjectById(data.currentMrsObjectId);
        if (currentObject === undefined) {
            return;
        }

        // If a parentItem was given, append to the children of that item. If not, use the tree's root list
        const parentTreeItemList = parentTreeItem?.children ?? data.currentTreeItems;

        // Get list of stored fields for this table
        let storedFields: IMrsObjectFieldWithReference[] = [];
        storedFields = currentObject.storedFields?.filter((field) => {
            // If there is no parentItem, get all fields with level 1. Otherwise get all fields that have the
            // parentItem as parent
            if (parentTreeItem === undefined) {
                return field.lev === 1;
            }

            return field.parentReferenceId === parentTreeItem.field.representsReferenceId;
        }) ?? [];

        // The list of TreeEntries that should be loaded right after this one
        const referredTreeItemsToLoad: IMrsObjectFieldTreeItem[] = [];

        // Add a tree list item representing the field list
        const fieldListField: IMrsObjectFieldWithReference = {
            id: uuidBinary16Base64(),
            objectId: currentObject.id,
            representsReferenceId: undefined,
            parentReferenceId: undefined,
            name: convertSnakeToCamelCase(dbObjectName),
            position: 0,
            dbColumn: undefined,
            enabled: false,
            allowFiltering: false,
            allowSorting: false,
            noCheck: false,
            noUpdate: false,
            sdkOptions: undefined,
            comments: undefined,
            objectReference: parentTreeItem?.field.objectReference,
        };
        parentTreeItemList.push({
            type: MrsObjectFieldTreeEntryType.FieldListOpen,
            expanded: false,
            expandedOnce: false,
            field: fieldListField,
            parent: parentTreeItem,
        });

        try {
            if (dbObjectType === MrsDbObjectType.Procedure
                || dbObjectType === MrsDbObjectType.Function) {
                if (currentObject.kind === MrsObjectKind.Parameters) {
                    await this.addParametersAsFields(dbObjectName, dbSchemaName,
                        dbObjectType, storedFields,
                        currentObject, parentTreeItemList,
                        referredTreeItemsToLoad,
                        parentTreeItem);
                } else {
                    this.addFields(dbObjectType, currentObject, parentTreeItemList,
                        referredTreeItemsToLoad,
                        parentTreeItem);
                }
            } else if (dbObjectType === MrsDbObjectType.Script) {
                this.addScriptFields(dbObjectType, currentObject, parentTreeItemList,
                    referredTreeItemsToLoad,
                    parentTreeItem);
            } else {
                await this.addColumnsAsFields(dbObjectName, dbSchemaName,
                    dbObjectType, storedFields,
                    currentObject, parentTreeItemList,
                    referredTreeItemsToLoad,
                    parentTreeItem,
                    initTreeItemsToUnnest,
                    initTreeItemsToReduce);
            }
        } catch (reason) {
            void ui.showErrorNotification(`Backend Error: ${String(reason)}`);
        }

        // Add at tree item that represents the closing of the table
        parentTreeItemList.push({
            type: MrsObjectFieldTreeEntryType.FieldListClose,
            expanded: false,
            expandedOnce: false,
            field: fieldListField,
            lastItem: true,
            parent: parentTreeItem,
        });

        if (parentTreeItem && parentTreeItem.children &&
            parentTreeItem.children[0]?.type === MrsObjectFieldTreeEntryType.LoadPlaceholder) {
            parentTreeItem.children.splice(0, 1);
        }

        // Mark the first item to enabled the correct styling
        if (parentTreeItemList.length > 0) {
            parentTreeItemList[0].firstItem = true;
            // addItemsTo[addItemsTo.length - 1].lastItem = true;
        }

        for (const item of referredTreeItemsToLoad) {
            const objectReferenceMapping = item.field.objectReference?.referenceMapping;
            if (objectReferenceMapping) {
                await this.addFieldsToMrsObjectTreeList(
                    objectReferenceMapping.referencedSchema,
                    objectReferenceMapping.referencedTable,
                    dbObjectType, item,
                    initTreeItemsToUnnest,
                    initTreeItemsToReduce);
            }
        }
    };

    private addColumnsAsFields = async (dbObjectName: string, dbSchemaName: string,
        dbObjectType: string, storedFields: IMrsObjectFieldWithReference[],
        currentObject: IMrsObject, parentTreeItemList: IMrsObjectFieldTreeItem[],
        referredTreeItemsToLoad: IMrsObjectFieldTreeItem[],
        parentTreeItem?: IMrsObjectFieldTreeItem,
        initTreeItemsToUnnest?: IMrsObjectFieldTreeItem[],
        initTreeItemsToReduce?: IMrsObjectFieldTreeItem[]): Promise<void> => {
        const { values, backend } = this.props;
        const data = values as IMrsObjectFieldEditorData;

        // Get the actual database schema table columns and references
        const columns = await backend.mrs.getTableColumnsWithReferences(
            undefined, dbObjectName, undefined, undefined, dbSchemaName, dbObjectType);

        // A list collecting all used field names to avoid duplicates
        const usedFieldNames: string[] = [];
        // A list collecting all primary key columns of the table
        const pkColumns: string[] = [];

        columns.forEach((column) => {
            let field: IMrsObjectFieldWithReference;

            // Lookup the DB column in the list of stored fields, if available
            const storedField = storedFields?.find((f) => {
                return f.dbColumn?.name === column.name;
            });

            let fieldName = storedField?.name ?? convertSnakeToCamelCase(column.name);
            // Check if field name is already taken, if so, append column.relColumnNames or and increasing number
            // at the end
            if (usedFieldNames.includes(fieldName)) {
                fieldName += convertToPascalCase(column.refColumnNames ?? "");

                let i = 1;
                while (usedFieldNames.includes(fieldName)) {
                    fieldName = fieldName.slice(0, String(i).length * -1) + String(i++);
                }
            }
            usedFieldNames.push(fieldName);

            // Check if this is a regular field
            if (!column.referenceMapping || column.referenceMapping === null) {
                // This is a regular field
                field = {
                    id: storedField?.id ?? uuidBinary16Base64(),
                    objectId: currentObject.id,
                    representsReferenceId: undefined,
                    parentReferenceId: storedField?.representsReferenceId
                        ?? parentTreeItem?.field.representsReferenceId,
                    name: fieldName,
                    position: storedField?.position ?? column.position,
                    dbColumn: column.dbColumn,
                    storedDbColumn: storedField?.dbColumn,
                    enabled: storedField?.enabled ?? true,
                    allowFiltering: storedField?.allowFiltering ?? true,
                    allowSorting: storedField?.allowSorting ??
                        ((column.dbColumn?.isPrimary || column.dbColumn?.isUnique) || false),
                    noCheck: storedField?.noCheck ?? false,
                    noUpdate: storedField?.noUpdate ?? false,
                    sdkOptions: storedField?.sdkOptions,
                    comments: storedField?.comments,
                    objectReference: undefined,
                };

                if (field.dbColumn?.isPrimary) {
                    pkColumns.push(field.dbColumn.name);
                }

                parentTreeItemList.push({
                    type: MrsObjectFieldTreeEntryType.Field,
                    expanded: false,
                    expandedOnce: false,
                    field,
                    parent: parentTreeItem,
                });
            } else {
                // This is a reference

                let addTableReference = true;
                // Do not add the db_object itself as a reference
                if (data.dbSchemaName === column.referenceMapping?.referencedSchema &&
                    data.dbObject.name === column.referenceMapping?.referencedTable) {
                    addTableReference = false;
                }
                // Do not add the back-reference of a n:m table (the parent.parent reference)
                if (parentTreeItem?.parent?.field.objectReference?.referenceMapping.referencedSchema ===
                    column.referenceMapping?.referencedSchema &&
                    parentTreeItem?.parent?.field.objectReference?.referenceMapping.referencedTable ===
                    column.referenceMapping?.referencedTable) {
                    addTableReference = false;
                }

                // Only add this reference if the table as not already listed
                if (addTableReference) {
                    // Lookup the reference in the list of stored fields, if available
                    const existingField = storedFields?.find((f) => {
                        return JSON.stringify(f.objectReference?.referenceMapping) ===
                            JSON.stringify(column.referenceMapping);
                    });

                    // If there is an existing field, copy the object reference values from there
                    const objectReference: IMrsObjectReference = {
                        id: existingField?.representsReferenceId ?? uuidBinary16Base64(),
                        reduceToValueOfFieldId: existingField?.objectReference?.reduceToValueOfFieldId,
                        rowOwnershipFieldId: existingField?.objectReference?.rowOwnershipFieldId,
                        referenceMapping: existingField?.objectReference?.referenceMapping
                            ? { ...existingField?.objectReference?.referenceMapping }
                            : column.referenceMapping,
                        unnest: existingField?.objectReference?.unnest ?? false,
                        options: existingField?.objectReference?.options,
                        sdkOptions: existingField?.objectReference?.sdkOptions,
                        comments: existingField?.objectReference?.comments,
                    };

                    field = {
                        id: existingField?.id ?? uuidBinary16Base64(),
                        objectId: currentObject.id,
                        representsReferenceId: objectReference.id,
                        parentReferenceId: parentTreeItem?.field.representsReferenceId,
                        name: fieldName,
                        position: existingField?.position ?? column.position,
                        dbColumn: column.dbColumn,
                        enabled: existingField?.enabled ?? false,
                        allowFiltering: existingField?.allowFiltering ?? true,
                        allowSorting: storedField?.allowSorting ?? false,
                        noCheck: existingField?.noCheck ?? false,
                        noUpdate: existingField?.noUpdate ?? false,
                        sdkOptions: existingField?.sdkOptions,
                        comments: existingField?.comments,
                        objectReference,
                    };

                    const treeItem = {
                        type: MrsObjectFieldTreeEntryType.Field,
                        expanded: field.enabled,
                        expandedOnce: field.enabled,
                        field,
                        // If the reference mapping is defined correctly, add the Loading ... child.
                        children: (!column.referenceMapping || column.referenceMapping === null)
                            ? undefined
                            : [this.newLoadingPlaceholderNode(field)],
                        parent: parentTreeItem,
                    };
                    parentTreeItemList.push(treeItem);

                    // If this reference field was enabled, or it is unnested, make sure to load the
                    // referred table right after this
                    if (field.enabled || field.objectReference?.unnest === true) {
                        referredTreeItemsToLoad.push(treeItem);
                    }

                    // If this reference field had unnest set, make sure to unnest it after everything was loaded
                    // but only if the reduceToValueOfFieldId is not set - since we show this unnest as a dropdown
                    if (field.objectReference?.unnest === true && !field.objectReference?.reduceToValueOfFieldId) {
                        initTreeItemsToUnnest?.push(treeItem);
                    }
                    // If this reference field had reduceToValueOfFieldId set, make sure to unnest it after
                    // everything was loaded
                    if (field.objectReference?.reduceToValueOfFieldId) {
                        initTreeItemsToReduce?.push(treeItem);
                    }
                }
            }
        });
    };

    private addParametersAsFields = async (dbObjectName: string, dbSchemaName: string,
        dbObjectType: string, storedFields: IMrsObjectFieldWithReference[],
        currentObject: IMrsObject, parentTreeItemList: IMrsObjectFieldTreeItem[],
        referredTreeItemsToLoad: IMrsObjectFieldTreeItem[],
        parentTreeItem?: IMrsObjectFieldTreeItem): Promise<void> => {
        const { backend } = this.props;

        // Get the actual database stored procedure parameters
        const params = await backend.mrs.getDbObjectParameters(dbObjectName, dbSchemaName, undefined,
            dbObjectType);

        params.forEach((param) => {
            // Lookup the DB column in the list of stored fields, if available
            const storedField = storedFields?.find((f) => {
                return f.dbColumn?.name === param.name;
            });

            const fieldName = storedField?.name ?? convertSnakeToCamelCase(param.name);

            // This is a regular field
            const field: IMrsObjectFieldWithReference = {
                id: storedField?.id ?? uuidBinary16Base64(),
                objectId: currentObject.id,
                representsReferenceId: undefined,
                parentReferenceId: storedField?.representsReferenceId
                    ?? parentTreeItem?.field.representsReferenceId,
                name: fieldName,
                position: storedField?.position ?? param.position,
                dbColumn: {
                    name: param.name,
                    in: param.mode.includes("IN"),
                    out: param.mode.includes("OUT"),
                    datatype: param.datatype,
                    // FUNCTION and PROCEDURE input parameters are nullable by nature
                    notNull: false,
                    isGenerated: false,
                    isPrimary: false,
                    isUnique: false,
                    charset: param.charset,
                    collation: param.collation,
                },
                storedDbColumn: storedField?.dbColumn,
                enabled: storedField?.enabled ?? true,
                allowFiltering: storedField?.allowFiltering ?? true,
                allowSorting: storedField?.allowSorting ?? false,
                noCheck: storedField?.noCheck ?? false,
                noUpdate: storedField?.noUpdate ?? false,
                sdkOptions: storedField?.sdkOptions,
                comments: storedField?.comments,
                objectReference: undefined,
            };

            parentTreeItemList.push({
                type: MrsObjectFieldTreeEntryType.Field,
                expanded: false,
                expandedOnce: false,
                field,
                parent: parentTreeItem,
            });
        });
    };

    private addFields = (
        dbObjectType: MrsDbObjectType,
        currentObject: IMrsObject, parentTreeItemList: IMrsObjectFieldTreeItem[],
        referredTreeItemsToLoad: IMrsObjectFieldTreeItem[],
        parentTreeItem?: IMrsObjectFieldTreeItem,
    ): void => {

        currentObject.fields?.forEach((field) => {
            parentTreeItemList.push({
                type: MrsObjectFieldTreeEntryType.Field,
                expanded: false,
                expandedOnce: false,
                field,
                parent: parentTreeItem,
            });
        });

        currentObject.storedFields?.forEach((field) => {
            const addedField = currentObject.fields?.find((f) => {
                return f.id === field.id;
            });

            // If there is a stored field that is not part of the fields list, it has been deleted. Still add it
            // as a deleted field.
            if (addedField === undefined) {
                parentTreeItemList.push({
                    type: MrsObjectFieldTreeEntryType.DeletedField,
                    expanded: false,
                    expandedOnce: false,
                    field,
                    parent: parentTreeItem,
                });
            }
        });
    };

    private addScriptFields = (
        dbObjectType: MrsDbObjectType,
        currentObject: IMrsObject, parentTreeItemList: IMrsObjectFieldTreeItem[],
        referredTreeItemsToLoad: IMrsObjectFieldTreeItem[],
        parentTreeItem?: IMrsObjectFieldTreeItem,
    ): void => {
        currentObject.storedFields?.forEach((field) => {
            if (!field.parentReferenceId) {
                parentTreeItemList.push({
                    type: MrsObjectFieldTreeEntryType.Field,
                    expanded: false,
                    expandedOnce: false,
                    field,
                    parent: parentTreeItem,
                });
            }
        });
    };


    private newLoadingPlaceholderNode = (field: IMrsObjectFieldWithReference): IMrsObjectFieldTreeItem => {
        return {
            type: MrsObjectFieldTreeEntryType.LoadPlaceholder,
            expanded: false,
            expandedOnce: false,
            field: {
                id: field.id + "Loading",
                objectId: "",
                name: "Loading...",
                position: 1,
                enabled: false,
                allowFiltering: true,
                allowSorting: false,
                noCheck: false,
                noUpdate: false,
            },
        };
    };

    private initMrsObjects = async (): Promise<void> => {
        const { values, backend } = this.props;
        const data = values as IMrsObjectFieldEditorData;

        // If the mrsObjects have not been loaded or initialized yet
        if (data.mrsObjects.length === 0) {
            try {
                // If a dbObject.id was provided
                if (data.dbObject.id !== "") {
                    // Get the list of MRS object from the metadata
                    const mrsObjects = await backend.mrs.getObjects(data.dbObject.id);

                    // If there are already MRS Objects for this DB Object
                    if (mrsObjects.length > 0) {
                        // Initialize the data and set the current object to the first
                        data.mrsObjects = mrsObjects;
                        data.currentMrsObjectId = mrsObjects[0].id;

                        // Get all stored fields
                        for (const obj of data.mrsObjects) {
                            obj.storedFields = await backend.mrs.getObjectFieldsWithReferences(obj.id);

                            // For Procedures, initialize the fields with the storedFields
                            if ((data.dbObject.objectType === MrsDbObjectType.Procedure ||
                                data.dbObject.objectType === MrsDbObjectType.Function ||
                                data.dbObject.objectType === MrsDbObjectType.Script) &&
                                obj.kind === MrsObjectKind.Result && obj.storedFields.length > 0) {
                                // The new structuredClone is faster than JSON.parse(JSON.stringify(obj.storedFields));
                                obj.fields = structuredClone(obj.storedFields);
                            }
                        }
                    }
                }

                // If no dbObject.id was provided or there are no mrsObjects for this DbObject yet, create one
                if (data.dbObject.id === "" || data.mrsObjects.length === 0) {
                    const mrsObjectId = uuidBinary16Base64();

                    data.mrsObjects = [{
                        id: mrsObjectId,
                        dbObjectId: data.dbObject.id,
                        name: data.defaultMrsObjectName +
                            ((data.dbObject.objectType === MrsDbObjectType.Procedure ||
                                data.dbObject.objectType === MrsDbObjectType.Function ||
                                data.dbObject.objectType === MrsDbObjectType.Script) ? "Params" : ""),
                        position: 0,
                        kind: (data.dbObject.objectType === MrsDbObjectType.Procedure ||
                            data.dbObject.objectType === MrsDbObjectType.Function ||
                            data.dbObject.objectType === MrsDbObjectType.Script)
                            ? MrsObjectKind.Parameters : MrsObjectKind.Result,
                        sdkOptions: undefined,
                        comments: undefined,
                    }];
                    data.currentMrsObjectId = mrsObjectId;

                    // If this dbObject represents a function, add result object
                    if (data.dbObject.objectType === MrsDbObjectType.Function) {
                        const returnDataType = await backend.mrs.getDbFunctionReturnType(
                            data.dbObject.name, data.dbSchemaName);

                        const mrsObjectId = uuidBinary16Base64();
                        data.mrsObjects.push({
                            id: mrsObjectId,
                            dbObjectId: data.dbObject.id,
                            name: data.defaultMrsObjectName + "Result",
                            position: 1,
                            kind: MrsObjectKind.Result,
                            sdkOptions: undefined,
                            comments: undefined,
                            fields: [{
                                id: uuidBinary16Base64(),
                                objectId: mrsObjectId,
                                name: "result",
                                position: 0,
                                enabled: true,
                                allowFiltering: true,
                                allowSorting: false,
                                noCheck: false,
                                noUpdate: false,
                                dbColumn: {
                                    name: "result",
                                    datatype: returnDataType,
                                    notNull: false,
                                    isGenerated: false,
                                    isPrimary: false,
                                    isUnique: false,
                                },
                            }],
                        });
                    }
                }
            } catch (reason) {
                void ui.showErrorNotification(`Backend Error: ${String(reason)}`);
            }

            await this.fillTreeBasedOnMrsObjectFields();
        }

        // Trigger re-render
        this.updateStateData(data);
    };

    private fillTreeBasedOnMrsObjectFields = async (): Promise<void> => {
        const { values } = this.props;
        const data = values as IMrsObjectFieldEditorData;

        // Lists used for init tracking
        const initTreeItemsToUnnest: IMrsObjectFieldTreeItem[] = [];
        const initTreeItemsToReduce: IMrsObjectFieldTreeItem[] = [];

        // Fill the Tree List
        await this.addFieldsToMrsObjectTreeList(
            data.dbObject.schemaName!, data.dbObject.name, data.dbObject.objectType,
            undefined,
            initTreeItemsToUnnest, initTreeItemsToReduce);

        // Perform all required unnest operations. This needs to be performed backwards and the simplest way
        // to do this is to use reduceRight(). null needs to be returned in that case to make it work as
        // expected.
        for (let i = initTreeItemsToUnnest.length - 1; i >= 0; i--) {
            const treeItem = initTreeItemsToUnnest[i];
            await this.performTreeItemUnnestChange(treeItem, true);
        }

        // Collapse all reduced fields. This needs to be performed backwards and the simplest way
        // to do this is to use reduceRight(). null needs to be returned in that case to make it work as
        // expected.
        for (let i = initTreeItemsToReduce.length - 1; i >= 0; i--) {
            const treeItem = initTreeItemsToReduce[i];

            treeItem.expanded = false;
        }
    };

    private findMrsObjectById = (objectId: string | undefined): IMrsObject | undefined => {
        const { values } = this.props;
        const data = values as IMrsObjectFieldEditorData;

        if (objectId === undefined) {
            return undefined;
        }

        return data.mrsObjects.find((obj) => {
            return obj.id === objectId;
        });
    };

    private findTreeItemById = (
        id: string | undefined, treeItemList: IMrsObjectFieldTreeItem[]): IMrsObjectFieldTreeItem | undefined => {
        if (!id || !treeItemList) {
            return undefined;
        }

        // Search all neighbors
        const topLevelEntry = treeItemList.find((item): boolean => {
            return item.field.id === id;
        });
        if (topLevelEntry) {
            return topLevelEntry;
        }

        // Check all children
        let entry: IMrsObjectFieldTreeItem | undefined;
        treeItemList.forEach((listEntry) => {
            if (listEntry.children && entry === undefined) {
                const subEntry = this.findTreeItemById(id, listEntry.children);
                if (subEntry) {
                    entry = subEntry;
                }
            }
        });

        return entry;
    };

    /**
     * -----------------------------------------------------------------------------------------------------------------
     * TreeGrid Editors
     */

    private handleCellDblClick = (e: UIEvent, cell: CellComponent): void => {
        cell.edit(true);
    };

    /**
     * Main entry point for editing operations in the result view. It takes a column's data type and renders one of
     * our UI elements for the given cell.
     *
     * @param cell The cell component for the editable cell.
     * @param onRendered Used to specify a function to be called when the editor actually has been rendered in the DOM.
     * @param success Function to call when editing was done successfully (passing in the new value).
     * @param cancel Function to call when editing was cancelled.
     *
     * @returns The new editor HTML element.
     */
    private editorHost = (cell: CellComponent, onRendered: EmptyCallback, success: ValueBooleanCallback,
        cancel: ValueVoidCallback): HTMLElement | false => {
        const { values } = this.props;
        const data = values as IMrsObjectFieldEditorData;

        const host = document.createElement("div");

        const cellData = cell.getData() as IMrsObjectFieldTreeItem;
        const { title, field } = cell.getColumn().getDefinition();
        let val = "";

        host.classList.add("cellEditorHost" + title);

        if (field === "json") {
            if (cellData.type === MrsObjectFieldTreeEntryType.FieldListOpen && !cell.getRow().getPrevRow()) {
                val = this.getMrsObjectName(cellData);
            } else if (data.showSdkOptions === undefined) {
                val = cellData.field.name;
            } else {
                val = cellData.field.name;
                if (cellData.field.sdkOptions && cellData.field.sdkOptions?.datatypeName) {
                    val += `: ${cellData.field.sdkOptions.datatypeName}`;
                } else {
                    val += `: ${this.getJsonFieldDatatype(cellData)}`;
                }
            }
            this.renderCustomEditor(cell, onRendered, host, val, success, cancel);

            return host;
        }

        if (field === "relational" && cellData.field.dbColumn) {
            val = `${cellData.field.dbColumn.name}: ${cellData.field.dbColumn.datatype}`;
            this.renderCustomEditor(cell, onRendered, host, val, success, cancel);

            return host;
        }

        return false;
    };

    /**
     * Renders one of our UI elements as a cell editor, if there's no built-in editor already or we need different
     * functionality. This function is also called for each change in the editor it creates, because we use controlled
     * components.
     *
     * @param cell The cell being edited.
     * @param onRendered Used to specify a function to be called when the editor actually has been rendered in the DOM.
     * @param host The HTML element that will host our UI component.
     * @param value The value to set.
     * @param success A callback to be called when the edit operation was successfully finished.
     * @param cancel A callback to be called when the user cancelled the editor operation.
     */
    private renderCustomEditor = (cell: CellComponent, onRendered: EmptyCallback, host: HTMLDivElement, value: unknown,
        success: ValueBooleanCallback, cancel: ValueVoidCallback): void => {
        const ref = createRef<HTMLInputElement>();
        const element = <Input
            innerRef={ref}
            className="fieldEditor"
            value={value as string ?? ""}
            onConfirm={(_e, props): void => {
                cell.setValue(props.value);
                success(props.value);
            }}
            onCancel={(e): void => {
                e.stopPropagation();
                cancel(undefined);
            }}
        />;

        if (element) {
            render(element, host);
        }

        onRendered(() => {
            ref.current?.focus();
            if (ref.current && typeof value === "string") {
                // If this is a new field, select all text
                if (value.startsWith("newField") || value.startsWith("new_field")) {
                    return ref.current.select();
                }

                const datatypeSep = value.indexOf(":");
                // If there is a datatype, place cursor before the datatype separator, so the field name can be
                // edited more easily
                if (datatypeSep >= 0) {
                    ref.current.selectionStart = datatypeSep;
                    ref.current.selectionEnd = datatypeSep;
                }
            }
        });
    };

    private handleCellEdited = (cell: CellComponent): void => {
        const { values } = this.props;
        const data = values as IMrsObjectFieldEditorData;
        const cellData = cell.getData() as IMrsObjectFieldTreeItem;
        const treeItem = this.findTreeItemById(cellData.field.id, data.currentTreeItems);
        const colDef = cell.getColumn().getDefinition();

        // Update data
        if (colDef.field === "json") {
            if (cellData.type === MrsObjectFieldTreeEntryType.FieldListOpen && !cell.getRow().getPrevRow()) {
                const originalVal = this.getMrsObjectName(cellData);

                if (originalVal !== cell.getValue()) {
                    const mrsObject = this.findMrsObjectById(data.currentMrsObjectId);
                    if (mrsObject === undefined) {
                        return;
                    }

                    if (data.showSdkOptions) {
                        // Get the right language options for the selected SDK language
                        let mrsObjectSdkLangOptions = mrsObject?.sdkOptions?.languageOptions?.find((opts) => {
                            return opts.language === data.showSdkOptions;
                        });

                        // Check if the mrsObjectSdkLangOptions have been defined yet. If not, create them
                        if (mrsObjectSdkLangOptions === undefined) {
                            if (mrsObject.sdkOptions === undefined) {
                                mrsObject.sdkOptions = {
                                    languageOptions: [],
                                };
                            }
                            if (mrsObject.sdkOptions.languageOptions === undefined) {
                                mrsObject.sdkOptions.languageOptions = [];
                            }
                            mrsObjectSdkLangOptions = {
                                language: data.showSdkOptions,
                                className: cell.getValue(),
                            };
                            mrsObject.sdkOptions.languageOptions.push(mrsObjectSdkLangOptions);
                        } else {
                            mrsObjectSdkLangOptions.className = cell.getValue();
                        }
                    } else {
                        mrsObject.name = cell.getValue();
                    }
                }
            } else if (treeItem?.field) {
                const editVal = String(cell.getValue());
                const datatypeSep = editVal.indexOf(":");
                let datatypeName = "";

                // Check if the user has entered a datatype, if so set the explicit sdkOptions
                if (datatypeSep >= 0) {
                    treeItem.field.name = editVal.slice(0, datatypeSep).trim();
                    datatypeName = editVal.slice(datatypeSep + 1).trim().toLowerCase();

                    // If the user entered a datatype different to the standard conversion of the DB datatype
                    if (datatypeName.toLowerCase() !== this.getJsonDatatype(treeItem.field.dbColumn?.datatype ?? "")) {
                        if (!treeItem.field.sdkOptions) {
                            treeItem.field.sdkOptions = { datatypeName };
                        } else {
                            treeItem.field.sdkOptions.datatypeName = datatypeName;
                        }
                    }

                } else {
                    treeItem.field.name = editVal;
                }

                // If this is a new field, initialize the dbColumn and datatype
                if (treeItem.field.dbColumn?.name === "new_field") {
                    treeItem.field.dbColumn.name = convertCamelToSnakeCase(treeItem.field.name);

                    switch (datatypeName) {
                        case "number":
                            treeItem.field.dbColumn.datatype = "integer";
                            break;
                        case "boolean":
                            treeItem.field.dbColumn.datatype = "tinyint(1)";
                            break;
                        case "object":
                        case "unknown":
                            treeItem.field.dbColumn.datatype = "json";
                            break;

                        default:
                            treeItem.field.dbColumn.datatype = "varchar(255)";
                            break;
                    }
                }
            }

            this.updateStateData(data);
        } else if (colDef.field === "relational") {
            if (treeItem?.field.dbColumn) {
                const editVal = String(cell.getValue());
                const datatypeSep = editVal.indexOf(":");

                // If the user entered a datatype separated by : as well, assign name and datatype to correct attributes
                // e.g. my_col: INTEGER
                if (datatypeSep >= 0) {
                    treeItem.field.dbColumn.name = editVal.slice(0, datatypeSep).trim();
                    treeItem.field.dbColumn.datatype = editVal.slice(datatypeSep + 1).trim().toLowerCase();
                } else {
                    treeItem.field.dbColumn.name = editVal;
                }

                if (treeItem.field.name === "newField") {
                    treeItem.field.name = convertSnakeToCamelCase(treeItem.field.dbColumn.name);
                }
            }

            this.updateStateData(data);
        }
    };

    private performTreeItemUnnestChange = async (treeItem: IMrsObjectFieldTreeItem,
        setToUnnested: boolean): Promise<void> => {
        const { values } = this.props;
        const data = values as IMrsObjectFieldEditorData;

        if (treeItem.field.objectReference) {
            // Get the children of the parent treeNode or the root list
            const parentTreeChildren = (treeItem.parent !== undefined)
                ? treeItem.parent.children : data.currentTreeItems;

            if (parentTreeChildren) {
                if (setToUnnested) {
                    // Check if the children have been loaded yet. If not, load them
                    if (treeItem.children && treeItem.children.length > 0 &&
                        treeItem.children[0].type === MrsObjectFieldTreeEntryType.LoadPlaceholder) {
                        await this.addFieldsToMrsObjectTreeList(
                            treeItem.field.objectReference.referenceMapping.referencedSchema,
                            treeItem.field.objectReference.referenceMapping.referencedTable,
                            data.dbObject.objectType,
                            treeItem);
                    }

                    // When the user selects to unnest the fields of the referenced tables,
                    // add references of these rows directly below the current row
                    const index = parentTreeChildren?.indexOf(treeItem);
                    if (index) {
                        let pos = 1;

                        // Fill list of used field names to avoid duplicate names later
                        const usedFieldNames: string[] = [];
                        parentTreeChildren.forEach((c) => {
                            if (c.field !== treeItem.field) {
                                usedFieldNames.push(c.field.name);
                            }
                        });

                        // Copy the nested fields out one level, below the reference row
                        treeItem.children?.forEach((c) => {
                            if (c.type === MrsObjectFieldTreeEntryType.Field) {
                                const refMap = treeItem.field.objectReference?.referenceMapping;
                                if (refMap) {
                                    c.unnested = {
                                        schemaTable: `${refMap.referencedSchema}.${refMap.referencedTable}`,
                                        referenceFieldName: treeItem.field.name,
                                        // Create a copy of the original field name (and not use a reference)
                                        originalFieldName: (" " + c.field.name).slice(1),
                                    };

                                    // Ensure the field name is unique by adding a number if needed
                                    if (usedFieldNames.includes(c.field.name)) {
                                        c.field.name += "2";
                                        let i = 3;
                                        while (usedFieldNames.includes(c.field.name)) {
                                            c.field.name = c.field.name.slice(0, String(i).length * -1) + String(i++);
                                        }
                                    }
                                    usedFieldNames.push(c.field.name);
                                }

                                parentTreeChildren?.splice(index + pos, 0, c);
                                pos++;
                            }
                        });
                    }

                    treeItem.expanded = false;
                } else {
                    // When the user reverts the unnest, delete the referenced rows
                    for (let i = parentTreeChildren.length - 1; i >= 0; i--) {
                        const c = parentTreeChildren[i];

                        if (c.unnested !== undefined) {
                            // Rename the field back if it was renamed for the nesting operation
                            c.field.name = c.unnested.originalFieldName;
                            c.field.enabled = true;

                            c.unnested = undefined;
                            parentTreeChildren.splice(i, 1);
                        }
                    }

                    treeItem.expanded = true;
                    treeItem.field.enabled = true;
                }
            }
            treeItem.field.objectReference.unnest = setToUnnested;
        }
    };

    private updateDbObjectCrudOperations = (): void => {
        const { values } = this.props;
        const data = values as IMrsObjectFieldEditorData;
        const mrsObject = this.findMrsObjectById(data.currentMrsObjectId);
        const crudOps: string[] = [];

        if (data.dbObject.objectType === MrsDbObjectType.Procedure
            || data.dbObject.objectType === MrsDbObjectType.Function) {
            crudOps.push("UPDATE");
        } else {
            crudOps.push("READ");
        }

        // Consider the settings of the mrsObject first
        if (mrsObject?.options?.dualityViewInsert) {
            crudOps.push("INSERT");
        }
        if (mrsObject?.options?.dualityViewUpdate) {
            crudOps.push("UPDATE");
        }
        if (mrsObject?.options?.dualityViewDelete) {
            crudOps.push("DELETE");
        }

        // Loop over all fields and check if an object reference has a CRUD operation set. If so, the mrsObject
        // needs to be updatable as well
        if (!crudOps.includes("UPDATE")) {
            mrsObject?.fields?.forEach((field) => {
                if (field.objectReference?.options && crudOps.length < 4) {
                    if (!crudOps.includes("UPDATE")
                        && (field.objectReference?.options.dualityViewInsert
                            || field.objectReference?.options.dualityViewUpdate
                            || field.objectReference?.options.dualityViewDelete)) {
                        crudOps.push("UPDATE");
                    }
                }
            });
        }

        data.crudOperations = crudOps;
    };

    private performIconClick = async (treeItem: IMrsObjectFieldTreeItem, iconGroup: ActionIconName,
        icon?: string): Promise<void> => {
        const { values, dbObjectChange } = this.props;
        const data = values as IMrsObjectFieldEditorData;
        const mrsObject = this.findMrsObjectById(data.currentMrsObjectId);

        if (treeItem && treeItem.field && mrsObject) {
            switch (iconGroup) {
                case ActionIconName.Crud: {
                    if (icon && (treeItem.field.objectReference?.reduceToValueOfFieldId === undefined
                        || treeItem.field.objectReference?.reduceToValueOfFieldId === null)) {
                        // Get the right options, either from mrsObject or from objectReference and initialize if needed
                        let options;
                        if (treeItem.field.representsReferenceId === undefined) {
                            if (!mrsObject.options) {
                                mrsObject.options = {};
                            }
                            options = mrsObject.options;
                        } else if (treeItem.field.objectReference) {
                            if (!treeItem.field.objectReference.options) {
                                treeItem.field.objectReference.options = {};
                            }
                            options = treeItem.field.objectReference.options;
                        } else {
                            return;
                        }

                        // If the individual flag is not set or false, set to true - otherwise false
                        if (icon === "INSERT") {
                            options.dualityViewInsert =
                                !options.dualityViewInsert ? true : false;
                        }
                        if (icon === "UPDATE") {
                            options.dualityViewUpdate =
                                !options.dualityViewUpdate ? true : false;
                        }
                        if (icon === "DELETE") {
                            options.dualityViewDelete =
                                !options.dualityViewDelete ? true : false;
                        }

                        // Update the DBObject's CRUD operations
                        this.updateDbObjectCrudOperations();
                    }

                    break;
                }
                case ActionIconName.Unnest: {
                    if (treeItem.field.objectReference) {
                        await this.performTreeItemUnnestChange(treeItem, !treeItem.field.objectReference.unnest);
                    }
                    break;
                }
                case ActionIconName.Filtering: {
                    treeItem.field.allowFiltering = !treeItem.field.allowFiltering;
                    break;
                }
                case ActionIconName.Sorting: {
                    treeItem.field.allowSorting = !treeItem.field.allowSorting;
                    break;
                }
                case ActionIconName.Update: {
                    treeItem.field.noUpdate = !treeItem.field.noUpdate;
                    break;
                }
                case ActionIconName.Check: {
                    // Get the right options, either from mrsObject or from objectReference and initialize if needed
                    let options;
                    if (treeItem.field.dbColumn === undefined) {
                        if (!mrsObject.options) {
                            mrsObject.options = {};
                        }
                        options = mrsObject.options;
                    } else if (treeItem.field.objectReference) {
                        if (!treeItem.field.objectReference.options) {
                            treeItem.field.objectReference.options = {};
                        }
                        options = treeItem.field.objectReference.options;
                    } else {
                        treeItem.field.noCheck = !treeItem.field.noCheck;

                        return;
                    }

                    options.dualityViewNoCheck = !options.dualityViewNoCheck ? true : false;

                    break;
                }
                case ActionIconName.Ownership: {
                    const mrsObject = this.findMrsObjectById(data.currentMrsObjectId);
                    const mrsObjectReference = treeItem.parent?.field.objectReference;

                    if (mrsObjectReference === undefined) {
                        if (mrsObject) {
                            if (mrsObject.rowOwnershipFieldId !== treeItem.field.id) {
                                mrsObject.rowOwnershipFieldId = treeItem.field.id;
                            } else {
                                mrsObject.rowOwnershipFieldId = undefined;
                            }
                        }
                    } else {
                        if (mrsObjectReference.rowOwnershipFieldId !== treeItem.field.id) {
                            mrsObjectReference.rowOwnershipFieldId = treeItem.field.id;
                        } else {
                            mrsObjectReference.rowOwnershipFieldId = undefined;
                        }
                    }

                    if (dbObjectChange) {
                        dbObjectChange();
                    }

                    break;
                }
                case ActionIconName.CheckAll:
                case ActionIconName.CheckNone: {
                    let itemList: IMrsObjectFieldTreeItem[] | undefined;
                    // Either take the treeItem children or the root treeItems for the top level row
                    if (treeItem.children && treeItem.expanded) {
                        itemList = treeItem.children;
                    } else if (treeItem.parent === undefined && treeItem.field.objectReference === undefined) {
                        itemList = data.currentTreeItems;
                    }

                    if (itemList) {
                        for (const child of itemList) {
                            if (child.field.objectReference === undefined) {
                                child.field.enabled = iconGroup === ActionIconName.CheckAll;
                            }
                        }
                    }
                    break;
                }
                case ActionIconName.Delete: {
                    const mrsObject = this.findMrsObjectById(data.currentMrsObjectId);
                    if (mrsObject) {
                        mrsObject.fields = mrsObject.fields?.filter((field) => {
                            return field.id !== treeItem.field.id;
                        });
                        data.currentTreeItems = data.currentTreeItems.filter((item) => {
                            return item.field.id !== treeItem.field.id;
                        });
                    }
                    break;
                }
                case ActionIconName.IncludeInKey: {
                    if (treeItem.field.storedDbColumn !== undefined) {
                        treeItem.field.storedDbColumn.isPrimary = !treeItem.field.storedDbColumn.isPrimary;
                    }
                    break;
                }
                default: {
                    break;
                }
            }
        }
    };

    private handleIconClick = (cell: CellComponent, iconGroup: ActionIconName, icon?: string): void => {
        const { values } = this.props;
        const data = values as IMrsObjectFieldEditorData;

        const cellData = cell.getData() as IMrsObjectFieldTreeItem;
        const treeItem = this.findTreeItemById(cellData.field.id, data.currentTreeItems);

        if (treeItem) {
            this.performIconClick(treeItem, iconGroup, icon).then(() => {
                this.updateStateData(data);
            }).catch((e) => {
                void ui.showErrorNotification(`An error occurred during execution: ${String(e)}`);
            });
        }
    };

    private treeGridToggleEnableState = (e: Event, cell: CellComponent): void => {
        const { values } = this.props;
        const data = values as IMrsObjectFieldEditorData;

        const cellData = cell.getData() as IMrsObjectFieldTreeItem;

        const treeItem = this.findTreeItemById(cellData.field.id, data.currentTreeItems);

        // Check if one of the parent items was reduced to a single field, if so, reset the reduce state
        if (!treeItem?.field?.enabled) {
            let parentRow = cell.getRow().getTreeParent();
            while (parentRow) {
                const parentRowData = parentRow.getData() as IMrsObjectFieldTreeItem;
                const parentTreeItem = this.findTreeItemById(parentRowData.field.id, data.currentTreeItems);
                if (parentTreeItem?.field.objectReference?.reduceToValueOfFieldId !== undefined) {
                    parentTreeItem.field.objectReference.reduceToValueOfFieldId = undefined;
                }

                parentRow = parentRow.getTreeParent();
            }
        }

        // Automatically expand fields that represent an objectReference, which will also enabled them
        if (treeItem?.field?.objectReference && treeItem.field.objectReference.reduceToValueOfFieldId === undefined &&
            !treeItem.expanded) {
            cell.getRow().treeExpand();
        } else if (treeItem?.field) {
            // Toggle the enabled state
            treeItem.field.enabled = !treeItem.field.enabled;

            // Check if a reference has been unchecked, remove it's children and re-add the Loading ... node
            if (!treeItem.field.enabled && treeItem.field.objectReference) {
                treeItem.expanded = false;
                treeItem.expandedOnce = false;
                treeItem.children = [
                    this.newLoadingPlaceholderNode(treeItem.field),
                ];
            }

            this.updateStateData(data);
        }
    };


    /**
     * -----------------------------------------------------------------------------------------------------------------
     * TreeGrid Row Expanded/Collapsed
     */

    private handleRowExpanded = (row: RowComponent): void => {
        const { values } = this.props;
        const data = values as IMrsObjectFieldEditorData;

        const treeItem = row.getData() as IMrsObjectFieldTreeItem;
        // Prevent expansion of unnested references
        if (treeItem.field.objectReference?.unnest !== true) {
            treeItem.expanded = true;

            // If this is the first time the row gets expanded, load data
            if (!treeItem.expandedOnce && treeItem.field.objectReference) {
                treeItem.field.enabled = true;
                void this.addFieldsToMrsObjectTreeList(
                    treeItem.field.objectReference.referenceMapping.referencedSchema,
                    treeItem.field.objectReference.referenceMapping.referencedTable,
                    data.dbObject.objectType,
                    treeItem).then(() => {
                        treeItem.expandedOnce = true;

                        // Trigger re-render
                        this.updateStateData(data);
                    }).catch();
            }
        } else {
            row.treeCollapse();
        }
    };

    private handleRowCollapsed = (row: RowComponent): void => {
        const data = row.getData() as IMrsObjectFieldTreeItem;
        data.expanded = false;
    };

    private isRowExpanded = (row: RowComponent): boolean => {
        const data = row.getData() as IMrsObjectFieldTreeItem;

        const doExpand = data.expanded;

        if (doExpand) {
            this.handleRowExpanded(row);
        }

        return doExpand;
    };

    private setCurrentMrsObject = async (mrsObject: IMrsObject | undefined): Promise<void> => {
        const { values } = this.props;
        const data = values as IMrsObjectFieldEditorData;

        // Make sure the current editor values are saved
        MrsObjectFieldEditor.updateMrsObjectFields(data);

        data.currentTreeItems = [];
        data.currentlyListedTables = [];

        if (mrsObject) {
            data.currentMrsObjectId = mrsObject.id;

            await this.fillTreeBasedOnMrsObjectFields();
        } else {
            data.currentMrsObjectId = undefined;
        }

        // Trigger re-render
        this.updateStateData(data);
    };

    private addMrsObject = (_e: MouseEvent | KeyboardEvent, _props: Readonly<IComponentProperties>): void => {
        const { values } = this.props;
        const data = values as IMrsObjectFieldEditorData;

        const mrsObjectId = uuidBinary16Base64();

        let name = data.defaultMrsObjectName;
        if (data.mrsObjects.length > 1) {
            name += String(data.mrsObjects.length);
        }

        const mrsObject: IMrsObject = {
            id: mrsObjectId,
            dbObjectId: data.dbObject.id,
            name,
            position: data.mrsObjects.length,
            kind: MrsObjectKind.Result,
            sdkOptions: undefined,
            comments: undefined,
        };

        data.mrsObjects.push(mrsObject);

        void this.setCurrentMrsObject(mrsObject);
    };

    private removeCurrentMrsObject = (_e: MouseEvent | KeyboardEvent, _props: Readonly<IComponentProperties>): void => {
        const { values } = this.props;
        const data = values as IMrsObjectFieldEditorData;

        // Delete current MRS object
        const currentObj = this.findMrsObjectById(data.currentMrsObjectId);
        if (currentObj !== undefined) {
            const currentObjIndex = data.mrsObjects.indexOf(currentObj);
            data.mrsObjects.splice(currentObjIndex, 1);

            // Move the position of all other objects
            for (let i = currentObjIndex; i < data.mrsObjects.length; i++) {
                data.mrsObjects[i].position--;
            }
        }

        // Switch to the parameters once a result object is being deleted
        const mrsObject = data.mrsObjects.find((obj) => {
            return obj.kind === MrsObjectKind.Parameters;
        });
        void this.setCurrentMrsObject(mrsObject);
    };

    private addNewField = (row: RowComponent | boolean): void => {
        if (typeof row === "boolean") {
            return;
        }

        const { values } = this.props;
        const data = values as IMrsObjectFieldEditorData;

        const itemList = (row.getData() as IMrsObjectFieldTreeItem).parent?.children ?? data.currentTreeItems;

        const fieldId = uuidBinary16Base64();

        itemList?.splice(-1, 0, {
            type: MrsObjectFieldTreeEntryType.Field,
            expanded: false,
            expandedOnce: false,
            field: {
                id: fieldId,
                objectId: data.currentMrsObjectId ?? "",
                name: "newField",
                position: itemList.length,
                enabled: true,
                allowFiltering: true,
                allowSorting: false,
                noCheck: false,
                noUpdate: false,
                dbColumn: {
                    name: "new_field",
                    datatype: "VARCHAR(255)",
                    notNull: false,
                    isPrimary: false,
                    isUnique: false,
                    isGenerated: false,
                },
            },
        });

        // Trigger re-render
        this.updateStateData(data, () => {
            const rows = this.tableRef.current?.getRows() ?? [];
            for (const row of rows) {
                const rowData = row.getData() as IMrsObjectFieldTreeItem;
                if (rowData.field.id === fieldId) {
                    const cells = row.getCells();
                    if (cells.length > 0) {
                        // ToDo: Figure out why this does not display the inline editor
                        cells[1].edit(true);
                    }

                    break;
                }
            }
        });
    };

    private dbObjectNameChanged = (e: InputEvent, props: IInputChangeProperties): void => {
        const { values } = this.props;
        const data = values as IMrsObjectFieldEditorData;

        data.dbObject.name = props.value;

        this.forceUpdate();
    };
}
