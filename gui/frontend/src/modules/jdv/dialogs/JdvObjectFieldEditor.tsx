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

import { ComponentChild, createRef, render } from "preact";
import {
    CellComponent, ColumnDefinition, EmptyCallback, RowComponent, ValueBooleanCallback, ValueVoidCallback,
} from "tabulator-tables";

import { ui } from "../../../app-logic/UILayer.js";
import { IDictionary } from "../../../app-logic/general-types.js";
import {
    IJdvObject, IJdvObjectFieldWithReference,
    IJdvObjectOptions,
    IJdvTableReference,
    IJdvViewInfo,
} from "../../../communication/ProtocolGui.js";
import { IValueEditCustomProperties, ValueEditCustom } from "../../../components/Dialogs/ValueEditCustom.js";
import { Button } from "../../../components/ui/Button/Button.js";
import { CheckState, Checkbox } from "../../../components/ui/Checkbox/Checkbox.js";
import { CodeEditor } from "../../../components/ui/CodeEditor/CodeEditor.js";
import { Codicon } from "../../../components/ui/Codicon.js";
import { IComponentState, SelectionType } from "../../../components/ui/Component/ComponentBase.js";
import { Container, ContentAlignment, Orientation } from "../../../components/ui/Container/Container.js";
import { Dropdown } from "../../../components/ui/Dropdown/Dropdown.js";
import { DropdownItem } from "../../../components/ui/Dropdown/DropdownItem.js";
import { Icon } from "../../../components/ui/Icon/Icon.js";
import { Input } from "../../../components/ui/Input/Input.js";
import { Label } from "../../../components/ui/Label/Label.js";
import { ITreeGridOptions, TreeGrid } from "../../../components/ui/TreeGrid/TreeGrid.js";
import { Assets } from "../../../supplement/Assets.js";
import { requisitions } from "../../../supplement/Requisitions.js";
import { ShellInterfaceSqlEditor } from "../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { convertErrorToString, uuidBinary16Base64 } from "../../../utilities/helpers.js";
import { JdvObjectAddTableDialog } from "./JdvObjectAddTableDialog.js";

export interface IJdvObjectFieldEditorData extends IDictionary {
    jdvSchema: string;
    defaultJdvName: string;
    createView: boolean;
    jdvViewInfo: IJdvViewInfo;
    jdvObjects: IJdvObject[];
    rootJdvObjectId?: string;
    currentTreeItems: IJdvObjectFieldTreeItem[];
}

export interface IJdvObjectFieldEditorProperties extends IValueEditCustomProperties {
    backend: ShellInterfaceSqlEditor;
    schemasWithTables: Record<string, string[]>;
    getCurrentJdvInfo: () => IJdvViewInfo;
}

interface IJdvObjectFieldEditorState extends IComponentState {
    sqlPreview: boolean;
}

export enum JdvObjectFieldTreeEntryType {
    LoadPlaceholder,
    FieldListOpen,
    Field,
    FieldListClose,
}

export enum JdvObjectFieldValidatorType {
    Table,
    Column,
    JsonKeyName,
    ObjectReference,
}

export interface IJdvObjectFieldValidator {
    unsupported?: boolean;
    invalid?: boolean;
    message: string;
    additionalMessage?: string;
    kwargs?: IDictionary;
}

export interface IJdvObjectFieldTreeItem {
    type: JdvObjectFieldTreeEntryType;
    expanded: boolean;     // Currently expanded?
    expandedOnce: boolean; // Was expanded before?
    firstItem?: boolean;
    lastItem?: boolean;

    field: IJdvObjectFieldWithReference;

    parent?: IJdvObjectFieldTreeItem;
    children?: IJdvObjectFieldTreeItem[];

    validators: Map<JdvObjectFieldValidatorType, IJdvObjectFieldValidator>;
}

enum ActionIconName {
    Crud,
    CheckAll,
    CheckNone,
    DeleteTable,
    AddTable,
}

export class JdvObjectFieldEditor extends ValueEditCustom<
    IJdvObjectFieldEditorProperties, IJdvObjectFieldEditorState> {
    private tableRef = createRef<TreeGrid>();
    private jdvAddTableDialogRef = createRef<JdvObjectAddTableDialog>();

    // constants
    private maxTreeGridDepth = 10;
    private unsupportedColumnDataTypes = [
        "json", "vector", "geometry", "point", "linestring", "polygon",
        "multipoint", "multilinestring", "multipolygon", "geometrycollection",
    ];

    // stores the FieldListOpen tree item of difference instances of the same table
    private jdvTblInstancesCache: Record<string, IJdvObjectFieldTreeItem[]> = {};

    public constructor(props: IJdvObjectFieldEditorProperties) {
        super(props);

        // Ensure props has values.
        if (!props.values) {
            throw new Error("The value of the JdvObjectFieldEditor custom control needs to be initialized.");
        }

        this.state = {
            sqlPreview: false,
        };

        // Load existing Jdv Objects and their fields or create a new one if there is not one yet
        void this.initJdvObjects();
    }

    public static validateJdvObjectFields = (data: IJdvObjectFieldEditorData): string[] => {
        const messages: string[] = [];
        const walk = (node: IJdvObjectFieldTreeItem): void => {
            if (node.children !== undefined) {
                for (const item of node.children) {
                    walk(item);
                }
            }

            if ((node.type === JdvObjectFieldTreeEntryType.FieldListOpen)
                || (node.type === JdvObjectFieldTreeEntryType.Field && node.field.selected)) {
                for (const val of node.validators.values()) {
                    if (val.invalid) {
                        messages.push((val.additionalMessage ?? "") + val.message);
                    }
                }
            }
        };

        for (const item of data.currentTreeItems) {
            walk(item);
        }

        return messages;
    };

    public static buildDataMappingViewSql = (data: IJdvObjectFieldEditorData): string | undefined => {
        const buildOptionsClause = (options: IJdvObjectOptions | undefined): string => {
            let optionClause = "";
            if (options) {
                const crudOps = [];
                if (options.dataMappingViewInsert) {
                    crudOps.push(["INSERT"]);
                }
                if (options.dataMappingViewUpdate) {
                    crudOps.push(["UPDATE"]);
                }
                if (options.dataMappingViewDelete) {
                    crudOps.push(["DELETE"]);
                }

                if (crudOps.length > 0) {
                    optionClause = `WITH(` + crudOps.join(`, `) + `)\n`;
                }
            }

            return optionClause;
        };
        const walk = (treeItems: IJdvObjectFieldTreeItem[], indentation: string,
            projectedTablesCount: Record<string, number>,
            parentTreeItem?: IJdvObjectFieldTreeItem): string => {
            const indent = indentation + ` `.repeat(2);

            const parentObjRef = parentTreeItem?.field.objectReference;
            const parentTblStr = (parentObjRef) ?
                (parentTreeItem.field.aliasName ?? `${parentObjRef.referencedSchema}.${parentObjRef.referencedTable}`) :
                `${data.jdvViewInfo.rootTableSchema}.${data.jdvViewInfo.rootTableName}`;

            const sql = treeItems.filter((item) => {
                return item.field.selected;
            }).map((item) => {
                if (!item.field.objectReference) {
                    return `${indent}'${item.field.jsonKeyname}'\t: ${item.field.dbName}`;
                } else {
                    const field = item.field;
                    const objReference = field.objectReference;

                    const isNested = (objReference?.kind === "1:n");
                    const subIndent = indent + ` `.repeat(isNested ? 4 : 2);

                    const nestedOpen = isNested ? `JSON_ARRAYAGG(\n${subIndent}` : ``;
                    const nestedClose = isNested ? `${subIndent}) ABSENT ON NULL\n` : ``;

                    const optionClause = (field.options) ? `${subIndent}${buildOptionsClause(field.options)}` : ``;

                    const childTblStr = `${objReference?.referencedSchema}.${objReference?.referencedTable}`;
                    if (projectedTablesCount[childTblStr]) {
                        projectedTablesCount[childTblStr] = projectedTablesCount[childTblStr] + 1;
                        field.aliasName = `${objReference?.referencedTable}${projectedTablesCount[childTblStr]}`;
                    } else {
                        projectedTablesCount[childTblStr] = 1;
                    }

                    const whereClause = `${parentTblStr}.${objReference?.baseColumn} = ` +
                        `${field.aliasName ?? childTblStr}.${objReference?.referencedColumn}`;

                    return `${indent}'${field.jsonKeyname}'\t: (\n` +
                        `${indent}  SELECT ${nestedOpen}JSON_DUALITY_OBJECT(\n` +
                        optionClause +
                        walk(item.children ?? [], subIndent, projectedTablesCount, item) +
                        nestedClose +
                        `${indent}  )\n` +
                        `${indent}  FROM ${childTblStr}` + (field.aliasName ? ` AS ${field.aliasName}\n` : `\n`) +
                        `${indent}  WHERE ${whereClause}\n` +
                        `${indent})`;
                }
            }).join(",\n") + `\n`;

            return sql;
        };

        const jdvViewInfo = data.jdvViewInfo;
        const projectedTablesCount: Record<string, number> = {};
        projectedTablesCount[`${jdvViewInfo.rootTableSchema}.${jdvViewInfo.rootTableName}`] = 1;

        const options = data.jdvObjects.find((obj) => {
            return obj.id === data.rootJdvObjectId;
        })?.options;

        const view = `CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW ${jdvViewInfo.schema}.${jdvViewInfo.name} AS\n` +
            `SELECT\n` +
            `JSON_DUALITY_OBJECT(\n` +
            ((options) ? buildOptionsClause(options) : ``) +
            walk(data.currentTreeItems, ``, projectedTablesCount) +
            `)\n` +
            `FROM ${jdvViewInfo.rootTableSchema}.${jdvViewInfo.rootTableName};`;

        return view;
    };

    public override render(): ComponentChild {
        const { values, schemasWithTables, getCurrentJdvInfo } = this.props;
        const { sqlPreview } = this.state;
        const data = values as IJdvObjectFieldEditorData;

        const dbSchemas = Object.keys(schemasWithTables);
        const schemaTables = schemasWithTables[data.jdvViewInfo.rootTableSchema] ?? [];

        const validations = JdvObjectFieldEditor.validateJdvObjectFields(data);

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
            widthGrow: 3,
            formatter: this.treeGridJsonColumnFormatter,
            editor: this.editorHost,
            cellEdited: this.handleCellEdited,
            cellDblClick: this.handleCellDblClick,
        }, {
            title: "Relational",
            field: "relational",
            resizable: false,
            hozAlign: "left",
            editable: true, // setting it to false creates a bug when clicking on a referenceRow
            widthGrow: 3,
            formatter: this.treeGridRelationalColumnFormatter,
            editor: undefined,
            cellEdited: undefined,
            cellDblClick: () => {
                return;
            },
        }];

        // Applies updates to JDV info (e.g., JDV name or schema) by the main editor
        data.jdvViewInfo = getCurrentJdvInfo();

        let sql = "";

        if (sqlPreview) {
            // Build the SQL DDL statement
            sql = JdvObjectFieldEditor.buildDataMappingViewSql(data) ?? "";
        }

        return (
            <Container
                className={this.getEffectiveClassNames(["jdvObjectFieldEditor", undefined])}
                orientation={Orientation.TopDown}
            >
                <JdvObjectAddTableDialog ref={this.jdvAddTableDialogRef} schemasWithTables={schemasWithTables} />
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
                            <Label>Root Table Schema Name:</Label>
                            <Dropdown
                                id={"rootTableSchema"}
                                placeholder={data.jdvViewInfo.rootTableSchema}
                                selection={data.jdvViewInfo.rootTableSchema}
                                onSelect={this.handleRootTableSchemaSelected}
                            >
                                {dbSchemas.map((schema) => {
                                    return <DropdownItem
                                        caption={schema}
                                        id={schema}
                                    />;
                                })}
                            </Dropdown>
                        </Container>
                        <Container
                            className={"labelWithInput"}
                            orientation={Orientation.LeftToRight}
                            crossAlignment={ContentAlignment.Center}
                        >
                            <Label>Root Table Name:</Label>
                            <Dropdown
                                id={"rootTableName"}
                                placeholder={data.jdvViewInfo.rootTableName}
                                selection={data.jdvViewInfo.rootTableName}
                                onSelect={this.handleRootTableNameSelected}
                            >
                                {schemaTables.map((table) => {
                                    return <DropdownItem
                                        caption={table}
                                        id={table}
                                    />;
                                })}
                            </Dropdown>
                        </Container>
                    </Container>
                    <div className="divider" />
                    <Container
                        className={"settingsRight"}
                        orientation={Orientation.RightToLeft}
                        crossAlignment={ContentAlignment.Center}
                    >
                        <>
                            <Button
                                className="sqlCopyBtn"
                                key="sqlCopyBtn"
                                data-tooltip="Copy SQL to Clipboard"
                                onClick={this.copySqlToClipboard}
                                disabled={Object.keys(validations).length > 0}
                                imageOnly={true}
                            >
                                <Icon src={Codicon.Copy} width={11} height={11} data-tooltip="inherit" />
                            </Button>
                            <Button
                                className={this.getEffectiveClassNames(
                                    ["sqlPreviewBtn", sqlPreview ? "buttonActivated" : undefined])}
                                key="sqlPreviewBtn"
                                data-tooltip="Toggle SQL Preview"
                                onClick={this.toggleSqlPreview}
                                disabled={Object.keys(validations).length > 0}
                                imageOnly={true}
                            >
                                <Icon src={Codicon.Search} width={11} height={11} data-tooltip="inherit" />
                                <Label caption="SQL Preview" data-tooltip="inherit" />
                            </Button>
                        </>
                    </Container>
                </Container>
                {!sqlPreview && /* Show the TreeGrid */
                    <TreeGrid
                        className={this.getEffectiveClassNames(["jdvObjectTreeGrid"])}
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
                {sqlPreview && /* replace the TreeGrid with code editor for clicking SQL Preview */
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

    private updateStateData = (data: IJdvObjectFieldEditorData, callback?: () => void): void => {
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
        const { values } = this.props;
        const data = values as IJdvObjectFieldEditorData;

        const text = JdvObjectFieldEditor.buildDataMappingViewSql(data) ?? "";
        requisitions.writeToClipboard(text);
    };

    /**
     * -----------------------------------------------------------------------------------------------------------------
     * TreeGrid Row / Column Formatter
     */

    private treeGridRowFormatter = (row: RowComponent): void => {
        const rowData = row.getData() as IJdvObjectFieldTreeItem;

        if (rowData.field.objectReference) {
            row.getElement().classList.add("referenceRow");

            let fkKind;
            switch (rowData.field.objectReference.kind) {
                case "1:1": {
                    fkKind = "fk11";
                    break;
                }
                case "n:1": {
                    fkKind = "fkN1";
                    break;
                }
                case "1:n": {
                    fkKind = "fk1N";
                    break;
                }
                default: {
                    fkKind = "fk11";
                    break;
                }
            }
            row.getElement().classList.add(fkKind);

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
    };

    private treeGridJsonColumnFormatter = (cell: CellComponent): string | HTMLElement => {
        const cellData = cell.getData() as IJdvObjectFieldTreeItem;
        const { values } = this.props;
        const data = values as IJdvObjectFieldEditorData;

        const host = document.createElement("div");
        if (cellData.type === JdvObjectFieldTreeEntryType.Field) {
            host.className = this.getEffectiveClassNames(["jdvObjectJsonFieldDiv",
                cellData.children ? "withChildren" : "withoutChildren"]);
        } else {
            host.className = "jdvObjectJsonFieldDiv";
        }

        let content;

        if (cellData.type === JdvObjectFieldTreeEntryType.FieldListOpen) {
            if (!cell.getRow().getPrevRow()) { // i.e., root table
                const tblValidator = cellData.validators.get(JdvObjectFieldValidatorType.Table);
                const jdvObjectName = data.jdvViewInfo.name;
                const jdvObjectIcon = Assets.db.jsonObjectIcon;
                content = <>
                    {jdvObjectName &&
                        <>
                            <Container
                                className="fieldInfo"
                                orientation={Orientation.LeftToRight}
                                crossAlignment={ContentAlignment.Center}
                            >
                                <Icon className="jdvIcon" src={jdvObjectIcon} width={16} height={16} />
                                <Label
                                    className={this.getEffectiveClassNames([
                                        "jdvName", (tblValidator) ? "invalid" : "",
                                    ])}
                                    caption={jdvObjectName}
                                    data-tooltip={(tblValidator?.invalid) ? tblValidator.message : ""} />
                                {!tblValidator?.invalid && <Label className="bracket" caption="{" />}
                            </Container>
                        </>
                    }
                    {!tblValidator?.invalid &&
                        <Container
                            className={"fieldOptions"}
                            orientation={Orientation.LeftToRight}
                            crossAlignment={ContentAlignment.Center}
                        >
                            <Icon className="action"
                                src={Assets.misc.checkAllIcon} width={16} height={16}
                                onClick={() => {
                                    this.handleIconClick(cell, ActionIconName.CheckAll);
                                }} />
                            <Icon className="action"
                                src={Assets.misc.checkNoneIcon} width={16} height={16}
                                onClick={() => {
                                    this.handleIconClick(cell, ActionIconName.CheckNone);
                                }} />
                            <Icon className="action"
                                src={Assets.misc.addIcon} width={16} height={16}
                                onClick={() => {
                                    this.handleIconClick(cell, ActionIconName.AddTable);
                                }}
                                data-tooltip="Add table" />
                            <Label caption="…" />
                        </Container>
                    }
                </>;
            } else { // i.e., valid child table
                const childTreeItem = cellData.parent;
                const parentTreeItem = childTreeItem?.parent;
                const getColNames = (treeItemList: IJdvObjectFieldTreeItem[]) => {
                    return treeItemList.filter((it) => {
                        return it.type === JdvObjectFieldTreeEntryType.Field && it.field.objectReference === undefined;
                    }).map((elt) => {
                        return elt.field.dbColumn!.dbName;
                    });
                };

                const objReference = childTreeItem?.field.objectReference;
                const objRefValidator = childTreeItem?.validators.get(JdvObjectFieldValidatorType.ObjectReference);
                const updateObjReference = () => {
                    if (objReference) {
                        const childField = childTreeItem.children?.find((f) => {
                            return f.field.dbColumn?.dbName === objReference.referencedColumn;
                        });
                        objReference.kind = childField?.field.dbColumn?.isPrimary ? "1:1" : "1:n";
                        void this.validateJdvObjectFieldTreeItem(
                            childTreeItem, [JdvObjectFieldValidatorType.ObjectReference]
                        ).then(() => {
                            this.updateStateData(data);
                        });
                    }
                };

                content = <>
                    <Dropdown
                        id={objRefValidator?.invalid ? "invalidDropdown" : "objectReference"}
                        placeholder={objReference?.baseColumn ?? ""}
                        data-tooltip={objRefValidator?.invalid ? objRefValidator.message : "Columns of parent table"}
                        selection={objReference?.baseColumn ?? ""}
                        onSelect={(accept: boolean, sel) => {
                            if (objReference) {
                                objReference.baseColumn = [...sel][0];
                                updateObjReference();
                            }
                        }}
                    >
                        {getColNames(parentTreeItem?.children ?? data.currentTreeItems).map((col) => {
                            return <DropdownItem
                                caption={col}
                                id={col}
                            />;
                        })}
                    </Dropdown>
                    <Icon
                        src={objReference?.kind === "1:n" ?
                            Assets.db.schemaTableForeignKey1NIcon : Assets.db.schemaTableForeignKey11Icon}
                        width={16} height={16} />
                    <Dropdown
                        id={objRefValidator?.invalid ? "invalidDropdown" : "objectReference"}
                        placeholder={objReference?.referencedColumn ?? ""}
                        data-tooltip={objRefValidator?.invalid ? objRefValidator.message : "Columns of child table"}
                        selection={objReference?.referencedColumn ?? ""}
                        onSelect={(accept: boolean, sel) => {
                            if (objReference) {
                                objReference.referencedColumn = [...sel][0];
                                updateObjReference();
                            }
                        }}
                    >
                        {getColNames(childTreeItem?.children ?? []).map((col) => {
                            return <DropdownItem
                                caption={col}
                                id={col}
                            />;
                        })}
                    </Dropdown>
                    <Label
                        className="bracket"
                        caption={objReference?.kind === "" ? "" : (objReference?.kind === "1:n" ? "[ {" : "{")}
                    />
                </>;
            }
        } else if (cellData.type === JdvObjectFieldTreeEntryType.Field
            || cellData.type === JdvObjectFieldTreeEntryType.LoadPlaceholder) {
            const keyValidator = cellData.validators.get(JdvObjectFieldValidatorType.JsonKeyName);

            if (!cellData.field.objectReference) { // i.e., regular field
                const colValidator = cellData.validators.get(JdvObjectFieldValidatorType.Column);
                content = <>
                    <Container
                        className="fieldInfo"
                        orientation={Orientation.LeftToRight}
                        crossAlignment={ContentAlignment.Center}
                    >
                        <Checkbox
                            id={cellData.field.fieldId}
                            className={"withoutChildren"}
                            checkState={cellData.field.selected ? CheckState.Checked : CheckState.Unchecked}
                            disabled={colValidator?.unsupported}
                            title={colValidator?.unsupported ? colValidator.message : ""}
                            onClick={(e) => {
                                this.treeGridToggleSelectedState(e, cell);
                            }}
                        />
                        <Label
                            className={this.getEffectiveClassNames([
                                cellData.field.selected ? "jsonFieldSelected" : "jsonField",
                                (keyValidator?.invalid) ? "invalid" : "",
                            ])}
                            caption={(cellData.field.jsonKeyname === "") ? "\u00A0" : cellData.field.jsonKeyname}
                            data-tooltip={keyValidator?.invalid ? keyValidator.message : ""} />
                    </Container>
                </>;
            } else { // i.e., table reference
                const tblValidator = cellData.validators.get(JdvObjectFieldValidatorType.Table);
                content = <>
                    <Container
                        className="fieldInfo"
                        orientation={Orientation.LeftToRight}
                        crossAlignment={ContentAlignment.Center}
                    >
                        <Checkbox
                            id={cellData.field.fieldId}
                            className={cellData.children ? "withChildren" : "withoutChildren"}
                            checkState={cellData.field.selected ? CheckState.Checked : CheckState.Unchecked}
                            disabled={tblValidator !== undefined}
                            onClick={(e) => {
                                this.treeGridToggleSelectedState(e, cell);
                            }}
                        />
                        <Label
                            className={this.getEffectiveClassNames([
                                cellData.field.selected ? "jsonFieldSelected" : "jsonField",
                                (tblValidator?.invalid || keyValidator?.invalid) ? "invalid" : "",
                            ])}
                            caption={(cellData.field.jsonKeyname === "") ? "\u00A0" : cellData.field.jsonKeyname}
                            data-tooltip={keyValidator?.invalid ?
                                keyValidator.message :
                                (tblValidator?.invalid ? tblValidator.message : "")} />
                    </Container>
                    {cellData.field.selected &&
                        <Container
                            className={"fieldOptions"}
                            orientation={Orientation.LeftToRight}
                            crossAlignment={ContentAlignment.Center}
                        >
                            <>
                                <Icon
                                    className="action notSelected"
                                    src={Assets.misc.checkAllIcon}
                                    width={16}
                                    height={16}
                                    onClick={() => {
                                        this.handleIconClick(cell, ActionIconName.CheckAll);
                                    }}
                                    data-tooltip="Select all fields" />
                                <Icon className="action notSelected"
                                    src={Assets.misc.checkNoneIcon}
                                    width={16}
                                    height={16}
                                    onClick={() => {
                                        this.handleIconClick(cell, ActionIconName.CheckNone);
                                    }}
                                    data-tooltip="Deselect all fields" />
                                <Icon className="action"
                                    src={Assets.misc.addIcon}
                                    width={16}
                                    height={16}
                                    onClick={() => {
                                        this.handleIconClick(cell, ActionIconName.AddTable);
                                    }}
                                    data-tooltip="Add table" />
                                <Icon className="action"
                                    src={Assets.misc.removeIcon}
                                    width={16}
                                    height={16}
                                    onClick={() => {
                                        this.handleIconClick(cell, ActionIconName.DeleteTable);
                                    }}
                                    data-tooltip="Delete table" />
                                <Label caption="…" />
                            </>
                        </Container>
                    }
                    {!cellData.field.selected &&
                        <Container
                            className={"fieldOptions"}
                            orientation={Orientation.LeftToRight}
                            crossAlignment={ContentAlignment.Center}
                        >
                            <>
                                <Icon className="action"
                                    src={Assets.misc.removeIcon}
                                    width={16}
                                    height={16}
                                    onClick={() => {
                                        this.handleIconClick(cell, ActionIconName.DeleteTable);
                                    }}
                                    data-tooltip="Delete table" />
                                <Label caption="…" />
                            </>
                        </Container>
                    }
                </>;
            }
        } else { //  cellData.type === JdvObjectFieldTreeEntryType.FieldListClose
            if (cellData.field.objectReference?.kind !== "") {
                content = <>
                    <Label className="bracket"
                        caption={
                            `}${cellData.field.objectReference?.kind === "1:n" ? ", ... ]" : ""}`}
                    />
                </>;
            }
        }

        render(content, host);

        return host;
    };

    private treeGridRelationalColumnFormatter = (cell: CellComponent): string | HTMLElement => {
        const cellData = cell.getData() as IJdvObjectFieldTreeItem;
        const { values } = this.props;
        const data = values as IJdvObjectFieldEditorData;

        const host = document.createElement("div");
        host.className = "jdvObjectDbColumnFieldDiv";
        let content;

        // Get the options, either from the JDV object or from the object reference
        const rootJdvObject = this.findJdvObjectById(data.rootJdvObjectId);
        const options = cellData.field.objectReferenceId ? cellData.field.options : rootJdvObject?.options;
        const availableCrud = this.getAvailableCrudOp(cellData);
        const tableCrud = [
            { name: "INSERT", selected: options?.dataMappingViewInsert, enabled: availableCrud.includes("INSERT") },
            { name: "UPDATE", selected: options?.dataMappingViewUpdate, enabled: availableCrud.includes("UPDATE") },
            { name: "DELETE", selected: options?.dataMappingViewDelete, enabled: availableCrud.includes("DELETE") }];

        const crudDiv = <Container
            className={this.getEffectiveClassNames(["crudDiv", tableCrud.length > 1 ? "multiItems" : undefined])}
            orientation={Orientation.LeftToRight}
            crossAlignment={ContentAlignment.Center}>
            {tableCrud.map((op) => {
                return <Container
                    className={this.getEffectiveClassNames([
                        op.selected ? "activated" : "deactivated",
                        op.enabled ? "" : "disabled",
                    ])}
                    orientation={Orientation.RightToLeft}
                    crossAlignment={ContentAlignment.Center}
                    onClick={() => {
                        this.handleIconClick(cell, ActionIconName.Crud, op.name);
                    }}
                    onKeyPress={() => {
                        this.handleIconClick(cell, ActionIconName.Crud, op.name);
                    }}
                    key={cellData.field.fieldId + op.name}
                    disabled={!op.enabled}
                    data-tooltip={op.enabled ?
                        `Allow ${op.name} operations on this object` :
                        `${op.name} operation not supported for this object`}
                >
                    <Label data-tooltip="inherit">{!cell.getRow().getPrevRow() || tableCrud.length === 1
                        ? op.name : op.name.substring(0, 3)}</Label>
                </Container>;
            })}
        </Container >;

        if (cellData.type === JdvObjectFieldTreeEntryType.FieldListOpen) {
            if (!cell.getRow().getPrevRow()) { // i.e., root table
                const tblValidator = cellData.validators.get(JdvObjectFieldValidatorType.Table);

                // Display the table name for the top table row
                const jdvRootTableName = `${data.jdvViewInfo.rootTableSchema}.${data.jdvViewInfo.rootTableName}`;
                const rootTableIcon = Assets.db.tableIcon;

                content = <>
                    {jdvRootTableName &&
                        <>
                            <Icon className="tableIcon" src={rootTableIcon} width={16} height={16} />
                            <Label
                                className={this.getEffectiveClassNames([
                                    "tableName", (tblValidator?.invalid) ? "invalid" : "",
                                ])}
                                caption={jdvRootTableName}
                                data-tooltip={(tblValidator?.invalid) ? tblValidator.message : ""} />
                        </>
                    }
                    {!tblValidator?.invalid && crudDiv}
                </>;
            }
        } else if (cellData.type === JdvObjectFieldTreeEntryType.Field) {
            let iconName = cellData.field.dbColumn?.isPrimary ? Assets.db.columnPkIcon :
                (cellData.field.dbColumn?.notNull ? Assets.db.columnNotNullIcon : Assets.db.columnNullableIcon);
            let tooltip = cellData.field.dbColumn?.isPrimary ? "Primary key column" :
                (cellData.field.dbColumn?.notNull ? "Table column that must not be NULL" : "Table column");

            if (cellData.field.objectReference) {
                switch (cellData.field.objectReference.kind) {
                    case "1:1": {
                        iconName = Assets.db.schemaTableForeignKey11Icon;
                        tooltip = "Table with a 1:1 relationship";

                        break;
                    }

                    case "n:1": {
                        iconName = Assets.db.schemaTableForeignKey1NIcon;
                        tooltip = "Table with a n:1 relationship";

                        break;
                    }

                    case "1:n": {
                        iconName = Assets.db.schemaTableForeignKey1NIcon;
                        tooltip = "Table with a 1:n relationship";

                        break;
                    }

                    default: {
                        iconName = Assets.db.schemaTableForeignKey11Icon;
                        tooltip = "Table with no PK-FK relationship";
                    }
                }
            }

            if (!cellData.field.objectReference) { // i.e., regular field
                content = <>
                    <Container
                        className="fieldInfo"
                        orientation={Orientation.LeftToRight}
                        crossAlignment={ContentAlignment.Center}
                    >
                        <Icon src={Assets.misc.arrowIcon} width={16} height={16} />
                        <Icon src={iconName} width={16} height={16} data-tooltip={tooltip} />
                        <Label className="columnName" caption={cellData.field.dbColumn?.dbName} />
                    </Container>
                </>;
            } else { // i.e., a table reference
                let refTbl = cellData.field.objectReference.referencedSchema;
                if (cellData.field.objectReference.referencedTable &&
                    cellData.field.objectReference.referencedTable !== "") {
                    refTbl += "." + cellData.field.objectReference.referencedTable;
                }
                const tblValidator = cellData.validators.get(JdvObjectFieldValidatorType.Table);

                content = <>
                    <Icon src={Assets.misc.arrowIcon} width={16} height={16} />
                    <Icon src={iconName} width={16} height={16} data-tooltip={tooltip} />
                    <Icon src={Assets.db.tableIcon} width={16} height={16} />
                    <Label
                        className={this.getEffectiveClassNames([
                            "tableName", (tblValidator?.invalid) ? "invalid" : "",
                        ])}
                        caption={refTbl}
                        data-tooltip={(tblValidator?.invalid) ? tblValidator.message : ""} />
                    {cellData.field.selected && crudDiv}
                </>;
            }
        }

        render(content, host);

        return host;
    };

    /**
     * -----------------------------------------------------------------------------------------------------------------
     * TreeGrid Building and Loading
     */

    private addFieldsToJdvObjectTreeList = async (schema: string, table: string,
        parentTreeItem?: IJdvObjectFieldTreeItem): Promise<void> => {
        const { values } = this.props;
        const data = values as IJdvObjectFieldEditorData;

        // check if parentTreeItem (to be expanded) is valid
        if (parentTreeItem) {
            await this.validateJdvObjectFieldTreeItem(parentTreeItem, [JdvObjectFieldValidatorType.Table]);
            if (parentTreeItem.validators.get(JdvObjectFieldValidatorType.Table)?.invalid) {
                return;
            }
        }

        // If a parentItem was given, append to the children of that item. If not, use the tree's root list
        const parentTreeItemList = parentTreeItem?.children ?? data.currentTreeItems;
        const treeLevel = parentTreeItem ? parentTreeItem.field.lev + 1 : 1;

        // The list of TreeEntries that should be loaded right after this one
        const referredTreeItemsToLoad: IJdvObjectFieldTreeItem[] = [];

        // Create the field that represent the table
        const tableField: IJdvObjectFieldWithReference = {
            fieldId: uuidBinary16Base64(),
            parentReferenceId: undefined,
            jsonKeyname: table,
            dbName: `${schema}.${table}`,
            position: 0,
            dbColumn: undefined,
            objectReferenceId: parentTreeItem?.field.objectReferenceId,
            objectReference: parentTreeItem?.field.objectReference,
            dbReference: parentTreeItem?.field.dbReference,
            lev: treeLevel,
            selected: false,
        };
        const openTreeItem: IJdvObjectFieldTreeItem = {
            type: JdvObjectFieldTreeEntryType.FieldListOpen,
            expanded: false,
            expandedOnce: false,
            field: tableField,
            parent: parentTreeItem,
            validators: new Map(),
        };
        parentTreeItemList.push(openTreeItem);
        await this.validateJdvObjectFieldTreeItem(openTreeItem, [JdvObjectFieldValidatorType.Table]);

        // If table is invalid do not add the columns or FieldListClose
        const validator = openTreeItem.validators.get(JdvObjectFieldValidatorType.Table);
        if (!validator?.invalid) {
            // Add table's column to parentTreeItemList as fieldTreeItem
            try {
                await this.addColumnsAsFields(schema, table, parentTreeItemList,
                    referredTreeItemsToLoad, parentTreeItem);
            } catch (reason) {
                const message = convertErrorToString(reason);
                void ui.showErrorMessage(`Backend Error: ${message}`, {});
            }

            // Add at tree item that represents the closing of the table
            const closeTreeItem: IJdvObjectFieldTreeItem = {
                type: JdvObjectFieldTreeEntryType.FieldListClose,
                expanded: false,
                expandedOnce: false,
                field: tableField,
                parent: parentTreeItem,
                validators: openTreeItem.validators,
            };
            parentTreeItemList.push(closeTreeItem);

            // add the fieldListOpen tree item to cache for connecting instances of same table
            this.addJdvTblInstanceToCache(openTreeItem);
        }

        // remove the placeholder and validate that this expanded table has valid link with parentTreeItem
        if (parentTreeItem?.children &&
            parentTreeItem.children[0]?.type === JdvObjectFieldTreeEntryType.LoadPlaceholder) {
            parentTreeItem.children.splice(0, 1);
            void this.validateJdvObjectFieldTreeItem(
                parentTreeItem, [JdvObjectFieldValidatorType.ObjectReference]
            ).then(() => {
                this.updateStateData(data);
            });
        }

        // check if there is any referredTreeItems to load
        for (const item of referredTreeItemsToLoad) {
            const objectReferenceMapping = item.field.objectReference;
            if (objectReferenceMapping) {
                await this.addFieldsToJdvObjectTreeList(
                    objectReferenceMapping.referencedSchema,
                    objectReferenceMapping.referencedTable,
                    item);
            }
        }

        // Mark the first and last item to enable the correct styling
        if (parentTreeItemList.length > 0) {
            parentTreeItemList[0].firstItem = true;
            parentTreeItemList[parentTreeItemList.length - 1].lastItem = true;
        }
    };

    private addColumnsAsFields = async (schema: string, table: string, parentTreeItemList: IJdvObjectFieldTreeItem[],
        referredTreeItemsToLoad: IJdvObjectFieldTreeItem[],
        parentTreeItem?: IJdvObjectFieldTreeItem): Promise<void> => {
        const { values, backend } = this.props;
        const data = values as IJdvObjectFieldEditorData;

        // load table columns and references from the database
        const columns = (await backend.getJdvTableColumnsWithReferences(schema, table)).sort(
            (col1, col2) => {
                return col1.position - col2.position;
            },
        );

        // Get list of stored fields
        let storedFields: IJdvObjectFieldWithReference[] = [];
        const parentJdvObject = this.findJdvObjectById(parentTreeItem?.field.objectReferenceId ?? data.rootJdvObjectId);
        if (parentJdvObject && !data.createView) {
            storedFields = parentJdvObject.storedFields ?? await backend.getJdvObjectFieldsWithReferences(
                data.jdvSchema, data.defaultJdvName, parentJdvObject.id);
        }

        // check if there exists another instance of this table
        let otherTblInstance;
        if (Object.keys(this.jdvTblInstancesCache).includes(`${schema}.${table}`)
            && this.jdvTblInstancesCache[`${schema}.${table}`].length > 0) {
            otherTblInstance = this.jdvTblInstancesCache[`${schema}.${table}`][0];
        }

        for (const column of columns) {
            if (!column.referenceMapping) {
                // This is a regular field representing table column

                // Lookup the DB column in the list of stored fields, if available
                const existingColField = storedFields.find((f) => {
                    return f.dbName === column.name;
                });

                let selected = false;
                if (existingColField) {
                    selected = true;
                }

                // different instances of same table should have same columns selected
                if (otherTblInstance) {
                    const colInstance = (otherTblInstance.children ?? data.currentTreeItems).filter((col) => {
                        return col.field.dbName === column.name;
                    });
                    selected = colInstance.at(0)?.field.selected ?? false;
                }

                const colField: IJdvObjectFieldWithReference = {
                    fieldId: uuidBinary16Base64(),
                    parentReferenceId: existingColField?.parentReferenceId
                        ?? parentTreeItem?.field.objectReferenceId,
                    jsonKeyname: existingColField?.jsonKeyname ?? column.name,
                    dbName: column.name,
                    position: column.position,
                    dbColumn: column.dbColumn,
                    lev: parentTreeItem ? parentTreeItem.field.lev + 1 : 1,
                    selected,
                };
                const colTreeItem: IJdvObjectFieldTreeItem = {
                    type: JdvObjectFieldTreeEntryType.Field,
                    expanded: false,
                    expandedOnce: false,
                    field: colField,
                    parent: parentTreeItem,
                    validators: new Map(),
                };
                await this.validateJdvObjectFieldTreeItem(colTreeItem,
                    [JdvObjectFieldValidatorType.Column, JdvObjectFieldValidatorType.JsonKeyName]);
                parentTreeItemList.push(colTreeItem);
            } else {
                // This field represent a table reference

                // Lookup the reference in the list of stored fields, if available
                const existingRefField = storedFields.find((f) => {
                    return f.objectReference?.referencedSchema === column.referenceMapping?.referencedSchema
                        && f.objectReference?.referencedTable === column.referenceMapping?.referencedTable;
                });

                // If there is an existing field, copy the object reference values from there
                const refField: IJdvObjectFieldWithReference = {
                    fieldId: uuidBinary16Base64(),
                    parentReferenceId: existingRefField?.parentReferenceId ??
                        parentTreeItem?.field.objectReferenceId,
                    jsonKeyname: existingRefField?.jsonKeyname ?? column.name,
                    dbName: existingRefField?.dbName ??
                        `${column.referenceMapping.referencedSchema}.${column.referenceMapping.referencedTable}`,
                    position: column.position,
                    objectReferenceId: existingRefField?.objectReferenceId ?? uuidBinary16Base64(),
                    objectReference: existingRefField?.objectReference ?? column.referenceMapping,
                    dbReference: column.referenceMapping,
                    options: existingRefField?.options,
                    lev: parentTreeItem ? parentTreeItem.field.lev + 1 : 1,
                    selected: existingRefField !== undefined,
                };
                const refTreeItem: IJdvObjectFieldTreeItem = {
                    type: JdvObjectFieldTreeEntryType.Field,
                    expanded: refField.selected,
                    expandedOnce: refField.selected,
                    field: refField,
                    children: [this.newLoadingPlaceholderNode(refField)],
                    parent: parentTreeItem,
                    validators: new Map(),
                };
                await this.validateJdvObjectFieldTreeItem(refTreeItem,
                    [JdvObjectFieldValidatorType.Table, JdvObjectFieldValidatorType.JsonKeyName]);
                parentTreeItemList.push(refTreeItem);
                if (refTreeItem.field.selected) {
                    referredTreeItemsToLoad.push(refTreeItem);
                }
            }
        }

        // Lookup for stored fields that have no PK-FK relationship with parent
        // (i.e., were not listed in parentTreeItemList)
        const refToStr = (f: IJdvObjectFieldWithReference) => {
            return JSON.stringify(f.objectReference) + f.jsonKeyname;
        };
        const treeItemReferences = parentTreeItemList.map((f) => {
            return refToStr(f.field);
        });
        for (const field of storedFields) {
            // check if field is a table reference that has not been listed by parentTreeItemList
            if (field.objectReference && !treeItemReferences.includes(refToStr(field))) {
                const refTreeItem: IJdvObjectFieldTreeItem = {
                    type: JdvObjectFieldTreeEntryType.Field,
                    expanded: field.selected,
                    expandedOnce: field.selected,
                    field,
                    children: [this.newLoadingPlaceholderNode(field)],
                    parent: parentTreeItem,
                    validators: new Map(),
                };
                await this.validateJdvObjectFieldTreeItem(refTreeItem,
                    [JdvObjectFieldValidatorType.Table, JdvObjectFieldValidatorType.JsonKeyName]);
                parentTreeItemList.push(refTreeItem);
                referredTreeItemsToLoad.push(refTreeItem);
            }
        }
    };

    private addTableAsFieldToJdvObject = async (schema: string, table: string, parentTreeItem: IJdvObjectFieldTreeItem,
        storedField?: IJdvObjectFieldWithReference): Promise<void> => {
        const { values, backend } = this.props;
        const data = values as IJdvObjectFieldEditorData;

        // If parentItem was not root, append to the children of that item.
        // Else, use the tree's root list
        const parentTreeItemList = parentTreeItem.children ?? data.currentTreeItems;

        // build the reference mapping
        let referenceMapping: IJdvTableReference = {
            kind: "",
            baseColumn: "",
            referencedColumn: "",
            referencedSchema: schema,
            referencedTable: table,
        };
        if (storedField?.objectReference) {
            referenceMapping = { ...storedField.objectReference };
        } else {
            // Check if the child table has PK-FK relationship with parent
            const { schema: parentTblSchema, table: parentTblName } = this.getJdvFieldTreeItemTableInfo(parentTreeItem);
            const parentCols = await backend.getJdvTableColumnsWithReferences(parentTblSchema, parentTblName);
            const existingRefCol = parentCols.find((f) => {
                return f.referenceMapping
                    && f.referenceMapping.referencedSchema === schema
                    && f.referenceMapping.referencedTable === table;
            });
            if (existingRefCol?.referenceMapping) {
                referenceMapping = existingRefCol.referenceMapping;
            }
        }
        const childField: IJdvObjectFieldWithReference = {
            fieldId: uuidBinary16Base64(),
            parentReferenceId: storedField?.parentReferenceId ??
                parentTreeItem.field.objectReferenceId,
            jsonKeyname: storedField?.jsonKeyname ?? table,
            dbName: storedField?.dbName ?? `${schema}.${table}`,
            position: parentTreeItemList.length - 1,
            objectReferenceId: storedField?.objectReferenceId ?? uuidBinary16Base64(),
            objectReference: referenceMapping,
            dbReference: (referenceMapping.kind !== "") ? referenceMapping : undefined,
            lev: (parentTreeItem.type === JdvObjectFieldTreeEntryType.FieldListOpen) ? 1 : parentTreeItem.field.lev + 1,
            selected: true,
        };
        const childTreeItem: IJdvObjectFieldTreeItem = {
            type: JdvObjectFieldTreeEntryType.Field,
            expanded: childField.selected,
            expandedOnce: childField.selected,
            field: childField,
            children: [this.newLoadingPlaceholderNode(childField)],
            parent: parentTreeItem,
            validators: new Map(),
        };

        // add as child to the parentTreeItemList
        parentTreeItemList.splice(parentTreeItemList.length - 1, 0, childTreeItem);

        await this.validateJdvObjectFieldTreeItem(childTreeItem,
            [JdvObjectFieldValidatorType.Table, JdvObjectFieldValidatorType.JsonKeyName]);

        // expand parent table (expandedOnce is already set)
        parentTreeItem.expanded = true;

        // load items of added table
        await this.addFieldsToJdvObjectTreeList(schema, table, childTreeItem).then(() => {
            this.updateStateData(data);
        });
    };

    private newLoadingPlaceholderNode = (field: IJdvObjectFieldWithReference): IJdvObjectFieldTreeItem => {
        return {
            type: JdvObjectFieldTreeEntryType.LoadPlaceholder,
            expanded: false,
            expandedOnce: false,
            field: {
                fieldId: field.fieldId + "Loading",
                jsonKeyname: "Loading...",
                dbName: "",
                position: 1,
                lev: 0,
                selected: false,
            },
            validators: new Map(),
        };
    };

    private initJdvObjects = async (): Promise<void> => {
        const { values } = this.props;
        const data = values as IJdvObjectFieldEditorData;

        // If the jdvObjects have not been loaded or initialized yet
        if (data.jdvObjects.length === 0) {
            try {
                // case editing an existing Jdv object
                if (!data.createView) {
                    const jdvObjects = data.jdvViewInfo.objects ?? [];
                    if (jdvObjects.length > 0) {
                        data.jdvObjects = jdvObjects;
                        for (const obj of data.jdvObjects) {
                            if (obj.isRoot) {
                                data.rootJdvObjectId = obj.id;
                            }
                        }
                    }
                }
                // case jdv objects is empty
                if (data.jdvObjects.length === 0) {
                    data.jdvObjects = [{
                        id: uuidBinary16Base64(),
                        table: data.jdvViewInfo.rootTableName,
                        schema: data.jdvViewInfo.rootTableSchema,
                        isRoot: true,
                    }];
                    data.rootJdvObjectId = data.jdvObjects[0].id;
                }
            } catch (reason) {
                const message = convertErrorToString(reason);
                void ui.showErrorMessage(`Backend Error: ${message}`, {});
            }

            await this.fillTreeBasedOnJdvObjectFields();
        }

        // Trigger re-render
        this.updateStateData(data);
    };

    private fillTreeBasedOnJdvObjectFields = async (): Promise<void> => {
        const { values } = this.props;
        const data = values as IJdvObjectFieldEditorData;

        // Fill the Tree List
        data.currentTreeItems = [];
        await this.addFieldsToJdvObjectTreeList(
            data.jdvViewInfo.rootTableSchema, data.jdvViewInfo.rootTableName, undefined);
    };

    private findJdvObjectById = (objectId: string | undefined): IJdvObject | undefined => {
        const { values } = this.props;
        const data = values as IJdvObjectFieldEditorData;

        if (objectId === undefined) {
            return undefined;
        }

        return data.jdvObjects.find((obj) => {
            return obj.id === objectId;
        });
    };

    private findTreeItemById = (id: string | undefined,
        treeItemList: IJdvObjectFieldTreeItem[]): IJdvObjectFieldTreeItem | undefined => {
        if (!id) {
            return undefined;
        }

        // Search all neighbors
        const topLevelEntry = treeItemList.find((item): boolean => {
            return item.field.fieldId === id;
        });
        if (topLevelEntry) {
            return topLevelEntry;
        }

        // Check all children
        let entry: IJdvObjectFieldTreeItem | undefined;
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

    private addJdvTblInstanceToCache = (fieldListOpenTreeItem: IJdvObjectFieldTreeItem) => {
        const { schema, table } = this.getJdvFieldTreeItemTableInfo(fieldListOpenTreeItem.parent);
        const tblFullName = `${schema}.${table}`;

        if (!Object.keys(this.jdvTblInstancesCache).includes(tblFullName)) {
            this.jdvTblInstancesCache[tblFullName] = [];
        }
        this.jdvTblInstancesCache[tblFullName].push(fieldListOpenTreeItem);
    };

    private removeJdvTblInstanceFromCache = (fieldListOpenTreeItem: IJdvObjectFieldTreeItem) => {
        const { values } = this.props;
        const data = values as IJdvObjectFieldEditorData;

        const { schema, table } = this.getJdvFieldTreeItemTableInfo(fieldListOpenTreeItem.parent);
        const tblFullName = `${schema}.${table}`;

        if (Object.keys(this.jdvTblInstancesCache).includes(tblFullName)) {
            const itemIndex = this.jdvTblInstancesCache[tblFullName].indexOf(fieldListOpenTreeItem);
            if (itemIndex !== -1) {
                this.jdvTblInstancesCache[tblFullName].splice(itemIndex, 1);
            }
            if (this.jdvTblInstancesCache[tblFullName].length === 0) {
                delete this.jdvTblInstancesCache[tblFullName];
            }
        }

        const childrenList = fieldListOpenTreeItem.parent ?
            fieldListOpenTreeItem.parent.children : data.currentTreeItems;
        childrenList?.forEach((childItem) => {
            if (childItem.field.objectReference && childItem.field.selected
                && childItem.children && childItem.children.length > 0) {
                this.removeJdvTblInstanceFromCache(childItem.children[0]);
            }
        });
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
        const host = document.createElement("div");

        const cellData = cell.getData() as IJdvObjectFieldTreeItem;
        const { title, field } = cell.getColumn().getDefinition();
        let val = "";

        host.classList.add("cellEditorHost" + title);

        if (field === "json" && cellData.field.selected) {
            // first row which belong to root table name should be non-editable
            if (cellData.type === JdvObjectFieldTreeEntryType.FieldListOpen && !cell.getRow().getPrevRow()) {
                return false;
            }

            // the primary key of the root table should be non-editable
            if (cellData.field.dbColumn?.isPrimary && cellData.parent === undefined) {
                return false;
            }

            val = cellData.field.jsonKeyname;
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
            value={value ? value as string : ""}
            onConfirm={(_e, props): void => {
                cell.setValue(props.value);
                success(props.value);
            }}
            onCancel={(e): void => {
                e.stopPropagation();
                cancel(undefined);
            }}
        />;

        render(element, host);

        onRendered(() => {
            ref.current?.focus();
        });
    };

    private handleCellEdited = (cell: CellComponent): void => {
        const { values } = this.props;
        const data = values as IJdvObjectFieldEditorData;
        const cellData = cell.getData() as IJdvObjectFieldTreeItem;
        const treeItem = this.findTreeItemById(cellData.field.fieldId, data.currentTreeItems);
        const colDef = cell.getColumn().getDefinition();

        // Update data
        if (colDef.field === "json") {
            if (treeItem?.field) {
                const editVal = String(cell.getValue()).trim();
                treeItem.field.jsonKeyname = editVal;
                void this.validateJdvObjectFieldTreeItem(
                    treeItem, [JdvObjectFieldValidatorType.JsonKeyName]
                ).then(() => {
                    this.updateStateData(data);
                });
            }
        }
    };

    private handleIconClick = (cell: CellComponent, iconGroup: ActionIconName, icon?: string): void => {
        const { values } = this.props;
        const data = values as IJdvObjectFieldEditorData;

        const cellData = cell.getData() as IJdvObjectFieldTreeItem;
        const treeItem = this.findTreeItemById(cellData.field.fieldId, data.currentTreeItems);

        if (treeItem) {
            this.performIconClick(treeItem, iconGroup, icon).then(() => {
                this.updateStateData(data);
            }).catch((e: unknown) => {
                const message = convertErrorToString(e);
                void ui.showErrorMessage(`An error occurred during execution: ${message}`, {});
            });
        }
    };

    private performIconClick = async (treeItem: IJdvObjectFieldTreeItem, iconGroup: ActionIconName,
        icon?: string): Promise<void> => {
        const { values } = this.props;
        const data = values as IJdvObjectFieldEditorData;

        switch (iconGroup) {
            case ActionIconName.Crud: {
                if (icon) {
                    // Get the right options, either from root or from objectReference and initialize if needed
                    let options;
                    const rootJdvObject = this.findJdvObjectById(data.rootJdvObjectId);
                    if (!treeItem.field.objectReferenceId && rootJdvObject) {
                        rootJdvObject.options ??= {};
                        options = rootJdvObject.options;
                    } else if (treeItem.field.objectReference) {
                        treeItem.field.options ??= {};
                        options = treeItem.field.options;
                    } else {
                        return;
                    }

                    let tableCrud;
                    if (icon === "INSERT") {
                        tableCrud = this.getAvailableCrudOp(treeItem);
                    } else if (icon === "UPDATE") {
                        tableCrud = this.getAvailableCrudOp(treeItem);
                    } else if (icon === "DELETE") {
                        tableCrud = this.getAvailableCrudOp(treeItem);
                    }

                    // If the flag is not set or false, set to true - otherwise false
                    if (tableCrud?.includes("INSERT")) {
                        options.dataMappingViewInsert =
                            !options.dataMappingViewInsert ? true : false;
                    }
                    if (tableCrud?.includes("UPDATE")) {
                        options.dataMappingViewUpdate =
                            !options.dataMappingViewUpdate ? true : false;
                    }
                    if (tableCrud?.includes("DELETE")) {
                        options.dataMappingViewDelete =
                            !options.dataMappingViewDelete ? true : false;
                    }
                }

                break;
            }
            case ActionIconName.CheckAll:
            case ActionIconName.CheckNone: {
                let itemList: IJdvObjectFieldTreeItem[] | undefined;
                // Either take the treeItem children or the root treeItems for the top level row
                if (treeItem.children && treeItem.expanded) {
                    itemList = treeItem.children;
                } else if (treeItem.parent === undefined && treeItem.field.objectReference === undefined) {
                    itemList = data.currentTreeItems;
                }

                if (itemList) {
                    for (const child of itemList) {
                        if (child.field.objectReference === undefined
                            && !child.validators.get(JdvObjectFieldValidatorType.Column)?.unsupported) {
                            child.field.selected = iconGroup === ActionIconName.CheckAll;
                        }
                    }
                }
                break;
            }
            case ActionIconName.DeleteTable: {
                const jdvObject = this.findJdvObjectById(data.rootJdvObjectId);
                if (jdvObject) {
                    jdvObject.fields = jdvObject.fields?.filter((field) => {
                        return field.fieldId !== treeItem.field.fieldId;
                    });

                    const delTreeItemFromTreeGrid = (nodes: IJdvObjectFieldTreeItem[] | undefined):
                        IJdvObjectFieldTreeItem[] | undefined => {
                        if (nodes === undefined) {
                            return undefined;
                        }

                        const filteredNodes = [];
                        for (const item of nodes) {
                            if (item.field.fieldId === treeItem.field.fieldId) {
                                if (item.children && item.children.length > 0) {
                                    this.removeJdvTblInstanceFromCache(item.children[0]);
                                }
                            } else {
                                item.children = delTreeItemFromTreeGrid(item.children);
                                filteredNodes.push(item);
                            }
                        }

                        return filteredNodes;
                    };
                    data.currentTreeItems = delTreeItemFromTreeGrid(data.currentTreeItems) ?? [];
                }
                break;
            }
            case ActionIconName.AddTable: {
                if (this.jdvAddTableDialogRef.current) {
                    const result = await this.jdvAddTableDialogRef.current.show();
                    const { tableSchema: tableSchemaName, tableName } = result!;

                    void this.addTableAsFieldToJdvObject(tableSchemaName, tableName, treeItem);
                }

                break;
            }
            default: {
                break;
            }
        }
    };

    private treeGridToggleSelectedState = (e: Event, cell: CellComponent): void => {
        const { values } = this.props;
        const data = values as IJdvObjectFieldEditorData;

        const cellData = cell.getData() as IJdvObjectFieldTreeItem;

        const treeItem = this.findTreeItemById(cellData.field.fieldId, data.currentTreeItems);

        // Automatically expand fields that represent an objectReference, which will also enabled them
        if (treeItem?.field.objectReference && !treeItem.expanded) {
            cell.getRow().treeExpand();
        } else if (treeItem?.field) {
            // Toggle the selected state
            treeItem.field.selected = !treeItem.field.selected;

            // update the selected state of the column in all instances of that table
            if (!treeItem.field.objectReference) {
                const { schema, table } = this.getJdvFieldTreeItemTableInfo(cellData.parent);
                if (Object.keys(this.jdvTblInstancesCache).includes(`${schema}.${table}`)) {
                    this.jdvTblInstancesCache[`${schema}.${table}`].forEach((it) => {
                        (it.parent?.children ?? data.currentTreeItems).filter((col) => {
                            return col.field.dbName === treeItem.field.dbName;
                        }).forEach((colTreeItem) => {
                            colTreeItem.field.selected = treeItem.field.selected;
                        });
                    });
                }
            }

            // Check if a reference has been unchecked, remove it's children and re-add the Loading ... node
            if (!treeItem.field.selected && treeItem.field.objectReference) {
                if (treeItem.children && treeItem.children.length > 0) {
                    this.removeJdvTblInstanceFromCache(treeItem.children[0]);
                }
                treeItem.expanded = false;
                treeItem.expandedOnce = false;
                treeItem.children = [this.newLoadingPlaceholderNode(treeItem.field)];
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
        const data = values as IJdvObjectFieldEditorData;

        const treeItem = row.getData() as IJdvObjectFieldTreeItem;

        treeItem.expanded = true;

        // If this is the first time the row gets expanded, load data
        if (!treeItem.expandedOnce && treeItem.field.objectReference) {
            treeItem.field.selected = true;
            void this.addFieldsToJdvObjectTreeList(
                treeItem.field.objectReference.referencedSchema,
                treeItem.field.objectReference.referencedTable,
                treeItem
            ).then(() => {
                treeItem.expandedOnce = true;
                // Trigger re-render
                this.updateStateData(data);
            }).catch();
        }
    };

    private handleRowCollapsed = (row: RowComponent): void => {
        const data = row.getData() as IJdvObjectFieldTreeItem;
        data.expanded = false;
    };

    private isRowExpanded = (row: RowComponent): boolean => {
        const data = row.getData() as IJdvObjectFieldTreeItem;

        const doExpand = data.expanded;

        if (doExpand) {
            this.handleRowExpanded(row);
        }

        return doExpand;
    };

    /**
     * -----------------------------------------------------------------------------------------------------------------
     * Root Table Change
     */

    private handleRootTableSchemaSelected = (accept: boolean, selection: Set<string>): void => {
        this.updateJdvObjectRootTable([...selection][0], undefined);
    };

    private handleRootTableNameSelected = (accept: boolean, selection: Set<string>): void => {
        this.updateJdvObjectRootTable(undefined, [...selection][0]);
    };

    private updateJdvObjectRootTable = (schema?: string, table?: string): void => {
        const { values } = this.props;
        const data = values as IJdvObjectFieldEditorData;

        if (schema) {
            data.jdvViewInfo.rootTableSchema = schema;
            // void this.loadSchemaTables();
        }
        if (table) {
            data.jdvViewInfo.rootTableName = table;
        }

        data.rootJdvObjectId = "";
        data.jdvObjects = [];
        data.jdvViewInfo.objects = [];
        data.createView = true;
        data.currentTreeItems = [];

        void this.initJdvObjects();
    };

    /**
     * -----------------------------------------------------------------------------------------------------------------
     * JDV Validation
     */

    private validateJdvObjectFieldTreeItem = async (treeItem: IJdvObjectFieldTreeItem,
        validationTypes?: JdvObjectFieldValidatorType[]): Promise<void> => {
        const { values } = this.props;
        const data = values as IJdvObjectFieldEditorData;

        const validatorTypeList = validationTypes ?? Object.values(JdvObjectFieldValidatorType);
        for (const validatorType of validatorTypeList) {
            switch (validatorType) {
                case JdvObjectFieldValidatorType.Table: {
                    // check if root table
                    if (treeItem.type === JdvObjectFieldTreeEntryType.FieldListOpen && treeItem.field.lev === 1) {
                        const { schema, table } = this.getJdvFieldTreeItemTableInfo(treeItem);
                        const isTableInvalid = await this.isTableInvalid(schema, table);
                        if (isTableInvalid) {
                            treeItem.validators.set(JdvObjectFieldValidatorType.Table, {
                                invalid: true,
                                message: isTableInvalid,
                                additionalMessage: `Table ${schema}.${table} is not valid: `,
                            });
                        }
                    } else if (treeItem.type === JdvObjectFieldTreeEntryType.Field
                        && treeItem.field.objectReference && treeItem.field.selected) { // check if selected child table
                        const { schema, table } = this.getJdvFieldTreeItemTableInfo(treeItem);
                        if (treeItem.field.lev > this.maxTreeGridDepth) {
                            treeItem.field.selected = false;
                            treeItem.expanded = false;
                            treeItem.children = undefined;
                            treeItem.validators.set(JdvObjectFieldValidatorType.Table, {
                                invalid: true,
                                message: `Cannot expand the tree beyond ${this.maxTreeGridDepth} descendants.`,
                            });
                        } else {
                            const isTableInvalid = await this.isTableInvalid(schema, table);
                            if (isTableInvalid) {
                                treeItem.field.selected = false;
                                treeItem.expanded = false;
                                treeItem.children = undefined;
                                treeItem.validators.set(JdvObjectFieldValidatorType.Table, {
                                    invalid: true,
                                    message: isTableInvalid,
                                    additionalMessage: `Table ${schema}.${table} is not valid: `,
                                });
                            }
                        }
                    }

                    break;
                }
                case JdvObjectFieldValidatorType.Column: {
                    // check if regular column
                    if (treeItem.type === JdvObjectFieldTreeEntryType.Field && treeItem.field.dbColumn) {
                        const dbColumn = treeItem.field.dbColumn;

                        // all primary keys must be selected
                        if (dbColumn.isPrimary) {
                            treeItem.field.selected = true;
                            if (treeItem.parent === undefined) {
                                treeItem.field.jsonKeyname = "_id";
                            }
                            treeItem.validators.set(JdvObjectFieldValidatorType.Column, {
                                unsupported: true,
                                message: "Primary key should always be selected.",
                            });
                        }

                        // JDV do no support certain field types
                        if (dbColumn.isGenerated) {
                            treeItem.field.selected = false;
                            treeItem.validators.set(JdvObjectFieldValidatorType.Column, {
                                unsupported: true,
                                message: `Generated columns are not supported.`,
                            });
                        } else if (this.unsupportedColumnDataTypes.includes(dbColumn.datatype)) {
                            treeItem.field.selected = false;
                            treeItem.validators.set(JdvObjectFieldValidatorType.Column, {
                                unsupported: true,
                                message: `Column datatype '${dbColumn.datatype}' is not supported.`,
                            });
                        }
                    }

                    break;
                }
                case JdvObjectFieldValidatorType.JsonKeyName: {
                    // check all regular and reference field except the primary key of root table
                    if (treeItem.type === JdvObjectFieldTreeEntryType.Field
                        && !(treeItem.field.dbColumn?.isPrimary && treeItem.field.lev === 1)) {

                        // check for duplicate tree items
                        const tblTreeItems = treeItem.field.lev === 1 ?
                            data.currentTreeItems : treeItem.parent?.children;
                        const dupTreeItems = tblTreeItems?.filter((it) => {
                            return it.type === JdvObjectFieldTreeEntryType.Field
                                && it.field.jsonKeyname === treeItem.field.jsonKeyname;
                        });

                        // check if the json keyname value is valid
                        const isJsonKeyNameInvalid = this.isJsonKeynameInvalid(treeItem.field.jsonKeyname);

                        // remove old validator if exists
                        if (treeItem.validators.has(validatorType)) {
                            const validator = treeItem.validators.get(validatorType);

                            // in case of duplicate JSON keys, remove the validator for other duplicate
                            if (validator?.kwargs?.dupKeyname) {
                                const otherTreeItems = tblTreeItems?.filter((it) => {
                                    return it.field.jsonKeyname === validator.kwargs?.dupKeyname;
                                });
                                if (otherTreeItems && otherTreeItems.length <= 1) { // table no longer has duplicates
                                    for (const dupItem of otherTreeItems) {
                                        dupItem.validators.delete(validatorType);
                                    }
                                }
                            }

                            treeItem.validators.delete(validatorType); // JsonKeyName was updated to a valid value
                        }

                        if (isJsonKeyNameInvalid) {
                            let colName;
                            if (treeItem.field.objectReference) { // i.e., child table json keyname
                                const { schema, table } = this.getJdvFieldTreeItemTableInfo(treeItem);
                                colName = `${schema}.${table}`;
                            } else if (treeItem.field.dbColumn) { // i.e., column json keyname
                                const { schema, table } = this.getJdvFieldTreeItemTableInfo(treeItem.parent);
                                colName = `${schema}.${table}.${treeItem.field.dbColumn.dbName}`;
                            }
                            treeItem.validators.set(JdvObjectFieldValidatorType.JsonKeyName, {
                                invalid: true,
                                message: isJsonKeyNameInvalid,
                                additionalMessage: `Json keyname for ${colName} is not valid: `,
                            });
                        } else if (dupTreeItems && dupTreeItems.length > 1) {
                            for (const dupItem of dupTreeItems) {
                                let colName;
                                if (dupItem.field.objectReference) { // i.e., child table json keyname
                                    const { schema, table } = this.getJdvFieldTreeItemTableInfo(dupItem);
                                    colName = `${schema}.${table}`;
                                } else if (dupItem.field.dbColumn) { // i.e., column json keyname
                                    const { schema, table } = this.getJdvFieldTreeItemTableInfo(dupItem.parent);
                                    colName = `${schema}.${table}.${dupItem.field.dbColumn.dbName}`;
                                }
                                dupItem.validators.set(JdvObjectFieldValidatorType.JsonKeyName, {
                                    invalid: true,
                                    message: `Cannot use duplicate json keys in the same table.`,
                                    additionalMessage: `Json keyname for ${colName} is not valid: `,
                                    kwargs: { dupKeyname: treeItem.field.jsonKeyname },
                                });
                            }
                        }
                    }
                    break;
                }
                case JdvObjectFieldValidatorType.ObjectReference: {
                    // check reference between parent table and expanded child table
                    if (treeItem.type === JdvObjectFieldTreeEntryType.Field
                        && treeItem.field.objectReference
                        && treeItem.children
                        && treeItem.children[0].type !== JdvObjectFieldTreeEntryType.LoadPlaceholder) {
                        const link = treeItem.field.objectReference;
                        const childItem = treeItem.children.find((f) => {
                            return f.field.dbColumn?.dbName === link.referencedColumn;
                        });
                        const childTblName = `${link.referencedSchema}.${link.referencedTable}`;
                        const parentItem = (treeItem.parent?.children ?? data.currentTreeItems).find((f) => {
                            return f.field.dbColumn?.dbName === link.baseColumn;
                        });
                        const { schema: parentSchema, table: parentTbl } = this.getJdvFieldTreeItemTableInfo(
                            treeItem.parent);
                        const parentTblName = `${parentSchema}.${parentTbl}`;

                        if (!parentItem || !childItem) {
                            link.kind = "";
                            treeItem.validators.set(JdvObjectFieldValidatorType.ObjectReference, {
                                invalid: true,
                                message: "Parent and child columns must be selected.",
                                additionalMessage: `Link between ${parentTblName} and ${childTblName} is not valid: `,
                            });
                        } else if (!parentItem.field.dbColumn?.isPrimary && !childItem.field.dbColumn?.isPrimary) {
                            link.kind = "";
                            treeItem.validators.set(JdvObjectFieldValidatorType.ObjectReference, {
                                invalid: true,
                                message: "The primary key for at least one of the two tables must be selected.",
                                additionalMessage: `Link between ${parentTblName} and ${childTblName} is not valid: `,
                            });
                        } else if (treeItem.validators.has(validatorType)) {
                            treeItem.validators.delete(validatorType); // Link was updated to a valid one
                        }
                    }
                    break;
                }
                default: {
                    break;
                }
            }
        }
    };

    private isTableInvalid = async (tableSchema: string, tableName: string): Promise<string | undefined> => {
        const { backend, schemasWithTables } = this.props;

        const views = await backend.getSchemaObjectNames(tableSchema, "View");
        if (views.includes(tableName)) {
            return "Using views are not permitted in JSON Duality views.";
        }

        const tables = schemasWithTables[tableSchema] ?? [];
        if (!tables.includes(tableName)) {
            return "Table does not exist.";
        }

        const pkCols = await backend.getTableObjectNames(tableSchema, tableName, "Primary Key");
        if (pkCols.length === 0) {
            return "Table has no primary key.";
        }
        if (pkCols.length > 1) {
            return "Table has composite primary key.";
        }

        return undefined;
    };

    private isJsonKeynameInvalid = (keyName: string): string | undefined => {
        const invalidKeyNames = ["_id", "_metadata"];
        if (invalidKeyNames.includes(keyName)) {
            return `Cannot use ${keyName} as json key.`;
        }

        if (keyName === "") {
            return `Key name cannot be empty.`;
        }

        return undefined;
    };

    /**
     * -----------------------------------------------------------------------------------------------------------------
     * Helper Functions
     */

    private getAvailableCrudOp = (table: IJdvObjectFieldTreeItem): string[] => {
        if (table.field.dbReference?.kind === "n:1") {
            return ["INSERT", "UPDATE"];
        }

        return ["INSERT", "UPDATE", "DELETE"];
    };

    private getJdvFieldTreeItemTableInfo = (item: IJdvObjectFieldTreeItem | undefined): {
        schema: string, table: string;
    } => {
        const { values } = this.props;
        const data = values as IJdvObjectFieldEditorData;

        if (item?.field.objectReference) { // i.e., item has reference to child table
            return {
                schema: item.field.objectReference.referencedSchema,
                table: item.field.objectReference.referencedTable,
            };
        }

        return { // i.e., root table
            schema: data.jdvViewInfo.rootTableSchema,
            table: data.jdvViewInfo.rootTableName,
        };
    };
}
