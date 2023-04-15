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

import "./MrsObjectFieldEditor.css";

import { ComponentChild, createRef, render } from "preact";

import { IValueEditCustomProperties, ValueEditCustom } from "../../../components/Dialogs/ValueEditCustom";
import { Label } from "../../../components/ui/Label/Label";
import { ITreeGridOptions, TreeGrid } from "../../../components/ui/TreeGrid/TreeGrid";
import {
    IComponentState,
    SelectionType,
} from "../../../components/ui/Component/ComponentBase";
import {
    CellComponent, ColumnDefinition, EmptyCallback, RowComponent,
    ValueBooleanCallback, ValueVoidCallback,
} from "tabulator-tables";
import { ShellInterfaceSqlEditor } from "../../../supplement/ShellInterface/ShellInterfaceSqlEditor";
import { Dropdown } from "../../../components/ui/Dropdown/Dropdown";
import { Container, ContentAlignment, Orientation } from "../../../components/ui/Container/Container";
import { CheckState, Checkbox } from "../../../components/ui/Checkbox/Checkbox";
import { IMrsObject, IMrsObjectFieldWithReference, IMrsObjectReference } from "../../../communication/ProtocolMrs";
import { convertCamelToTitleCase, uuidBinary16Base64 } from "../../../utilities/helpers";
import { convertToPascalCase, snakeToCamelCase } from "../../../utilities/string-helpers";
import { Input } from "../../../components/ui/Input/Input";
import { Icon } from "../../../components/ui/Icon/Icon";
import { IDictionary } from "../../../app-logic/Types";

import tableIcon from "../../../assets/images/schemaTable.svg";
import columnIcon from "../../../assets/images/schemaTableColumn.svg";
import columnNnIcon from "../../../assets/images/schemaTableColumnNN.svg";
import columnPkIcon from "../../../assets/images/schemaTableColumnPK.svg";
import fkIcon1N from "../../../assets/images/schemaTableForeignKey1N.svg";
import fkIconN1 from "../../../assets/images/schemaTableForeignKeyN1.svg";
import fkIcon11 from "../../../assets/images/schemaTableForeignKey11.svg";
import arrowIcon from "../../../assets/images/arrow.svg";
import mrsObjectIcon from "../../../assets/images/mrsDbObject.svg";
import crudCActiveIcon from "../../../assets/images/switches/crudCActiveIcon.svg";
import crudCIcon from "../../../assets/images/switches/crudCIcon.svg";
import crudRActiveIcon from "../../../assets/images/switches/crudRActiveIcon.svg";
import crudRIcon from "../../../assets/images/switches/crudRIcon.svg";
import crudUActiveIcon from "../../../assets/images/switches/crudUActiveIcon.svg";
import crudUIcon from "../../../assets/images/switches/crudUIcon.svg";
import crudDActiveIcon from "../../../assets/images/switches/crudDActiveIcon.svg";
import crudDIcon from "../../../assets/images/switches/crudDIcon.svg";
import unnestActiveIcon from "../../../assets/images/switches/unnestActiveIcon.svg";
import unnestIcon from "../../../assets/images/switches/unnestIcon.svg";
import unnestedIcon from "../../../assets/images/unnest.svg";

export enum MrsObjectType {
    Table = "TABLE",
    View = "VIEW",
    Procedure = "PROCEDURE"
}

export enum MrsSdkLanguage {
    TypeScript
}

interface IMrsObjectListedTables {
    schemaName: string,
    tableName: string,
    pkColumns: string[],
}

export interface IMrsObjectFieldEditorData extends IDictionary {
    dbSchemaName: string;
    dbObjectName: string;
    dbObjectType: MrsObjectType;
    crudOperations: string[];
    mrsObjects: IMrsObject[];
    currentMrsObjectId: string;
    fieldTreeNodes: IMrsObjectFieldTreeEntry[];
    listedTables: IMrsObjectListedTables[];
    showSdkOptions?: MrsSdkLanguage;
}

export interface IMrsObjectFieldEditorProperties extends IValueEditCustomProperties {
    backend: ShellInterfaceSqlEditor;
}

interface IMrsObjectFieldEditorState extends IComponentState {
    dummy?: number
}

export enum MrsObjectFieldTreeEntryType {
    LoadPlaceholder,
    Table,
    Field,
    TableClose,
}

export interface IMrsObjectFieldUnnested {
    schemaTable: string;
    referenceFieldName: string;
}

export interface IMrsObjectFieldTreeEntry {
    type: MrsObjectFieldTreeEntryType;
    expanded: boolean;     // Currently expanded?
    expandedOnce: boolean; // Was expanded before?
    firstItem?: boolean;
    lastItem?: boolean;

    unnested?: IMrsObjectFieldUnnested; // Set if this field is an unnested copy

    field: IMrsObjectFieldWithReference;

    children?: IMrsObjectFieldTreeEntry[];
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
        };

        if (data.fieldTreeNodes.length === 0) {
            void this.addTableColumnsToMrsObjectTreeList(
                data.dbSchemaName, data.dbObjectName, data.dbObjectType);
        }
    }

    public componentDidMount(): void {
        //
    }

    public render(): ComponentChild {
        const { values } = this.props;
        const data = values as IMrsObjectFieldEditorData;

        const treeItemList = data.fieldTreeNodes;

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
            title: "JSON",
            field: "json",
            resizable: true,
            hozAlign: "left",
            editable: false,
            editor: this.editorHost,
            formatter: this.treeGridJsonColumnFormatter,
            cellEdited: this.handleCellEdited,
            cellDblClick: this.handleCellDblClick,
        }, {
            title: "Relational",
            field: "relational",
            resizable: false,
            editable: false,
            editor: this.editorHost,
            hozAlign: "left",
            formatter: this.treeGridRelationalColumnFormatter,
        }];

        const sdkLang = (data.showSdkOptions !== undefined) ? String(MrsSdkLanguage[
            data.showSdkOptions]) : "";

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
                    crossAlignment={ContentAlignment.Start}
                >
                    <Container
                        className={"showSdkOptions"}
                        orientation={Orientation.LeftToRight}
                        crossAlignment={ContentAlignment.Center}
                    >
                        <Dropdown
                            id={"sdkLanguage"}
                            placeholder="SDK Options"
                            selection={sdkLang}
                            optional={true}
                            onSelect={(sel, _props) => {
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
                                    return <Dropdown.Item
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

                    {data.showSdkOptions !== undefined &&
                        <Container
                            className={"interface"}
                            orientation={Orientation.LeftToRight}
                            crossAlignment={ContentAlignment.Center}
                        >
                            <Label>Interface:</Label>
                            <Dropdown
                                id={"interfaceName"}
                                selection={data.mrsObjects.find((obj) => {
                                    return obj.id === data.currentMrsObjectId;
                                })?.name}
                            >
                                {data.mrsObjects.map((obj) => {
                                    return <Dropdown.Item
                                        caption={obj.name}
                                        key={obj.name}
                                        id={obj.name}
                                    />;
                                })}
                            </Dropdown>
                        </Container>
                    }
                </Container>
                <Container
                    className={"settingsRight"}
                    orientation={Orientation.LeftToRight}
                    crossAlignment={ContentAlignment.Start}
                >
                </Container>
            </Container>
            <TreeGrid
                className={this.getEffectiveClassNames(["mrsObjectTreeGrid"])}
                ref={this.tableRef}
                options={schemaTreeOptions}
                columns={schemaTreeColumns}
                tableData={treeItemList}

                onRowExpanded={this.handleRowExpanded}
                onRowCollapsed={this.handleRowCollapsed}
                isRowExpanded={this.isRowExpanded}
                onFormatRow={this.treeGridRowFormatter}
            />
        </Container>
        );
    }

    private updateStateData = (data: IMrsObjectFieldEditorData): void => {
        const { onDataChange } = this.props;

        // Call onDataChange callback
        onDataChange?.(data);
    };

    /**
     * -----------------------------------------------------------------------------------------------------------------
     * TreeGrid Building and Loading
     */

    private addTableColumnsToMrsObjectTreeList = async (
        dbSchemaName: string, dbObjectName: string, dbObjectType: string,
        parentRow?: RowComponent): Promise<void> => {
        const { values, backend } = this.props;
        const data = values as IMrsObjectFieldEditorData;

        const treeItemList = data.fieldTreeNodes;
        const objectId = data.currentMrsObjectId;

        const pkColumns: string[] = [];

        // If a parentRow was given, append to the children of that row
        let parentItem: IMrsObjectFieldTreeEntry | undefined;
        if (parentRow) {
            const id = (parentRow.getData() as IMrsObjectFieldTreeEntry).field.id;
            parentItem = this.findTreeEntryById(id, treeItemList);
            if (parentItem && !parentItem.expandedOnce) {
                parentItem.field.enabled = true;
            }
        }
        const addItemsTo = parentItem?.children ?? treeItemList;

        // Add row representing the table
        const tableField: IMrsObjectFieldWithReference = {
            id: uuidBinary16Base64(),
            objectId,
            representsReferenceId: undefined,
            parentReferenceId: undefined,
            name: snakeToCamelCase(dbObjectName),
            position: 0,
            dbColumn: undefined,
            enabled: false,
            allowFiltering: false,
            noCheck: false,
            sdkOptions: undefined,
            comments: undefined,
            objectReference: parentItem?.field.objectReference,
        };
        addItemsTo.push({
            type: MrsObjectFieldTreeEntryType.Table,
            expanded: false,
            expandedOnce: false,
            field: tableField,
        });

        try {
            const columns = await backend.mrs.getTableColumnsWithReferences(
                undefined, dbObjectName, undefined, undefined, dbSchemaName, dbObjectType);

            const columnNames: string[] = [];
            columns.forEach((column) => {
                let field: IMrsObjectFieldWithReference;
                let fieldName = snakeToCamelCase(column.name);
                // Check if field name is already taken, if so, append column.relColumnNames
                if (columnNames.includes(fieldName)) {
                    fieldName += convertToPascalCase(column.refColumnNames ?? "2");
                }
                columnNames.push(fieldName);

                // Check if this is a regular field
                if (!column.referenceMapping || column.referenceMapping === null) {
                    // This is a regular field
                    field = {
                        id: uuidBinary16Base64(),
                        objectId,
                        representsReferenceId: undefined,
                        parentReferenceId: parentItem?.field.representsReferenceId,
                        name: fieldName,
                        position: column.position,
                        dbColumn: column.dbColumn,
                        enabled: true,
                        allowFiltering: true,
                        noCheck: false,
                        sdkOptions: undefined,
                        comments: undefined,
                        objectReference: undefined,
                    };

                    if (field.dbColumn?.isPrimary) {
                        pkColumns.push(field.dbColumn.name);
                    }

                    addItemsTo.push({
                        type: MrsObjectFieldTreeEntryType.Field,
                        expanded: false,
                        expandedOnce: false,
                        field,
                    });
                } else {
                    // This is a reference
                    let tableAlreadyAdded = false;
                    data.listedTables.forEach((tbl) => {
                        if (tbl.schemaName === column.referenceMapping?.referencedSchema &&
                            tbl.tableName === column.referenceMapping?.referencedTable) {
                            let allColumnsMap = true;
                            // ToDo: Check if Object.values() or Object.keys() should be used here
                            const refCols = Object.values(column.referenceMapping?.columnMapping);
                            tbl.pkColumns.forEach((col) => {
                                if (allColumnsMap && refCols.includes(col)) {
                                    allColumnsMap = false;
                                }
                            });
                            if (!allColumnsMap) {
                                tableAlreadyAdded = true;
                            }
                        }
                    });

                    // Only add this reference if the table as not already listed
                    if (!tableAlreadyAdded) {
                        const objectReference: IMrsObjectReference = {
                            id: uuidBinary16Base64(),
                            reduceToValueOfFieldId: undefined,
                            referenceMapping: column.referenceMapping,
                            unnest: false,
                            crudOperations: "READ",
                            sdkOptions: undefined,
                            comments: undefined,
                        };

                        field = {
                            id: uuidBinary16Base64(),
                            objectId,
                            representsReferenceId: objectReference.id,
                            parentReferenceId: parentItem?.field.representsReferenceId,
                            name: fieldName,
                            position: column.position,
                            dbColumn: column.dbColumn,
                            enabled: false,
                            allowFiltering: true,
                            noCheck: false,
                            sdkOptions: undefined,
                            comments: undefined,
                            objectReference,
                        };

                        addItemsTo.push({
                            type: MrsObjectFieldTreeEntryType.Field,
                            expanded: false,
                            expandedOnce: false,
                            field,
                            children: (!column.referenceMapping || column.referenceMapping === null) ? undefined : [
                                this.newLoadingPlaceholderNode(field),
                            ],
                        });
                    }
                }
            });

            if (parentRow) {
                this.removeLoadingPlaceholderNode(parentRow);
            }

            if (addItemsTo.length > 0) {
                addItemsTo[0].firstItem = true;
                // addItemsTo[addItemsTo.length - 1].lastItem = true;
            }

            data.listedTables.push({
                schemaName: dbSchemaName,
                tableName: dbObjectName,
                pkColumns,
            });

            data.fieldTreeNodes = treeItemList;
            this.updateStateData(data);
        } catch (reason) {
            console.log(`Backend Error: ${String(reason)}`);
        }

        addItemsTo.push({
            type: MrsObjectFieldTreeEntryType.TableClose,
            expanded: false,
            expandedOnce: false,
            field: tableField,
            lastItem: true,
        });
    };

    private newLoadingPlaceholderNode = (field: IMrsObjectFieldWithReference): IMrsObjectFieldTreeEntry => {
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
                noCheck: false,
            },
        };
    };

    private removeLoadingPlaceholderNode = (row: RowComponent): void => {
        const children = row.getTreeChildren();
        if (children && children.length > 0) {
            const firstEntry = children[0].getData() as IMrsObjectFieldTreeEntry;
            if (firstEntry.type === MrsObjectFieldTreeEntryType.LoadPlaceholder) {
                void children[0].delete();
            }
        }
    };

    private loadMrsObjectFieldList = (): void => {
        const { backend } = this.props;

        backend.mrs.getObjectFieldsWithReferences("0x00000000000000000000000000000001").then((fields) => {
            fields.forEach((_field) => {
                /*treeItemList.push({
                    type: MrsObjectFieldTreeEntryType.Field,
                    expanded: false,
                    expandedOnce: false,
                    position: field.position,
                    caption: field.name,
                    details: null,
                });*/
            });
        }).catch((reason): void => {
            console.log(`Backend Error: ${String(reason)}`);
        });
    };

    private findTreeEntryById = (
        id: string | undefined, treeItemList: IMrsObjectFieldTreeEntry[]): IMrsObjectFieldTreeEntry | undefined => {
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
        let entry: IMrsObjectFieldTreeEntry | undefined;
        treeItemList.forEach((listEntry) => {
            if (listEntry.children && entry === undefined) {
                const subEntry = this.findTreeEntryById(id, listEntry.children);
                if (subEntry) {
                    entry = subEntry;
                }
            }
        });

        return entry;
    };

    /**
     * -----------------------------------------------------------------------------------------------------------------
     * TreeGrid Row / Column Formatter
     */

    private treeGridRowFormatter = (row: RowComponent): void => {
        const rowData = row.getData() as IMrsObjectFieldTreeEntry;

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
    };

    private treeGridJsonColumnFormatter = (cell: CellComponent): string | HTMLElement => {
        const { values } = this.props;
        const data = values as IMrsObjectFieldEditorData;
        const cellData = cell.getData() as IMrsObjectFieldTreeEntry;

        const host = document.createElement("div");
        if (cellData.type === MrsObjectFieldTreeEntryType.Field) {
            host.className = this.getEffectiveClassNames(["mrsObjectJsonFieldDiv",
                cellData.children ? "withChildren" : "withoutChildren"]);
        } else {
            host.className = "mrsObjectJsonFieldDiv";
        }

        let content;

        if (cellData.type === MrsObjectFieldTreeEntryType.Table) {
            // Handle the top table row
            if (!cell.getRow().getPrevRow()) {
                const mrsObject = data.mrsObjects.find((obj) => {
                    return obj.id === data.currentMrsObjectId;
                });

                content = <>
                    <Icon className="tableIcon" src={mrsObjectIcon} width={16} height={16} />
                    <Label className={data.showSdkOptions === undefined ? "tableName" : "datatype"}
                        caption={data.showSdkOptions === undefined
                            ? data.dbObjectName
                            : "I" + (mrsObject?.sdkOptions?.languageTs?.className ??
                                (mrsObject?.name ?? data.dbObjectName))} />
                    <Label className="tableName" caption={"{"} />
                </>;

                render(content, host);
            } else {
                content = <>
                    {(data.showSdkOptions !== undefined) &&
                        <Label className="datatype" caption={this.getJsonDatatype(cellData)} />
                    }
                    <Label className="bracket" caption={"{"} />
                </>;
            }
        } else if (cellData.type === MrsObjectFieldTreeEntryType.Field ||
            cellData.type === MrsObjectFieldTreeEntryType.LoadPlaceholder) {
            const unnested = cellData.field.objectReference !== undefined && cellData.field.objectReference.unnest;
            content = <>
                <Checkbox
                    className={cellData.children ? "withChildren" : "withoutChildren"}
                    checkState={cellData.field.enabled
                        ? (unnested ? CheckState.Indeterminate : CheckState.Checked)
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
                        <Label className="referenceFieldName" caption={`${cellData.unnested.referenceFieldName})`} />
                    </Container>
                }
                {(data.showSdkOptions !== undefined) &&
                    <>
                        <Label caption={":"} />
                        <Label className="datatype" caption={this.getJsonDatatype(cellData)} />
                    </>
                }
                {(cellData.field.objectReference && (
                    cellData.field.objectReference.referenceMapping.kind === "1:1" ||
                    cellData.field.objectReference.referenceMapping.kind === "n:1") &&
                    cellData.field.enabled &&
                    cellData.field.objectReference.reduceToValueOfFieldId === undefined) &&
                    <Container
                        className={"unnestIconDiv"}
                        orientation={Orientation.LeftToRight}
                        crossAlignment={ContentAlignment.Center}>
                        <img
                            alt="CREATE"
                            tabIndex={0}
                            key={cellData.field.id + "CBtn"}
                            data-tooltip="CREATE"
                            onClick={() => { this.handleIconClick(cell, "UNNEST", "UNNEST"); }}
                            onKeyPress={() => { this.handleIconClick(cell, "UNNEST", "UNNEST"); }}
                            width={70}
                            height={18}
                            src={cellData.field.objectReference?.unnest
                                ? unnestActiveIcon : unnestIcon}>
                        </img>
                    </Container >}
            </>;
        } else if (cellData.type === MrsObjectFieldTreeEntryType.TableClose) {
            content = <>
                <Label className="bracket" caption={"}"} />
            </>;
        }

        render(content, host);

        return host;
    };

    private treeGridRelationalColumnFormatter = (cell: CellComponent): string | HTMLElement => {
        const cellData = cell.getData() as IMrsObjectFieldTreeEntry;
        const { values } = this.props;
        const data = values as IMrsObjectFieldEditorData;

        const host = document.createElement("div");
        host.className = this.getEffectiveClassNames(["mrsObjectDbColumnFieldDiv"]);
        host.style.display = "flex";
        host.style.flexDirection = "row";
        host.style.alignItems = "center";
        host.style.gap = "8px";
        let content;

        const tableCrud = (!cell.getRow().getPrevRow())
            ? data.crudOperations : cellData.field.objectReference?.crudOperations.split(",") ?? [];

        const crudActiveIcons = {
            create: crudCActiveIcon,
            read: crudRActiveIcon,
            update: crudUActiveIcon,
            delete: crudDActiveIcon,
        };

        const crudIcons = {
            create: crudCIcon,
            read: crudRIcon,
            update: crudUIcon,
            delete: crudDIcon,
        };

        const crudDiv = <Container
            className={"crudIconsDiv"}
            orientation={Orientation.LeftToRight}
            crossAlignment={ContentAlignment.Center}>
            {["CREATE", "READ", "UPDATE", "DELETE"].map((op) => {
                return <img
                    alt={op}
                    tabIndex={0}
                    key={cellData.field.id + op}
                    data-tooltip={op}
                    onClick={() => { this.handleIconClick(cell, "CRUD", op); }}
                    onKeyPress={() => { this.handleIconClick(cell, "CRUD", op); }}
                    width={(op === "CREATE" || op === "DELETE") ? 22 : 21}
                    height={18}
                    src={tableCrud.includes(op)
                        ? crudActiveIcons[op.toLowerCase()] : crudIcons[op.toLowerCase()]}>
                </img>;
            })}
        </Container >;

        if (cellData.type === MrsObjectFieldTreeEntryType.Table) {
            let tableName;

            // Display the table name for the top table row
            if (cell.getRow().getPrevRow() && cellData.field.objectReference && data.showSdkOptions !== undefined) {
                tableName = cellData.field.objectReference.referenceMapping.referencedSchema + "." +
                    cellData.field.objectReference.referenceMapping.referencedTable;
            } else if (!cell.getRow().getPrevRow()) {
                tableName = `${data.dbSchemaName}.${data.dbObjectName}`;
            }

            content = <>
                {tableName &&
                    <>
                        <Icon className="tableIcon" src={tableIcon} width={16} height={16} />
                        <Label className="tableName" caption={tableName} />
                    </>
                }
                {!cell.getRow().getPrevRow() &&
                    crudDiv
                }
            </>;
        } else if (cellData.type === MrsObjectFieldTreeEntryType.Field) {
            let iconName = cellData.field.dbColumn?.isPrimary ? columnPkIcon :
                (cellData.field.dbColumn?.notNull ? columnNnIcon : columnIcon);

            if (cellData.field.objectReference) {
                switch (cellData.field.objectReference.referenceMapping.kind) {
                    case "1:1": {
                        iconName = fkIcon11;
                        break;
                    }
                    case "n:1": {
                        iconName = fkIconN1;
                        break;
                    }
                    default: {
                        iconName = fkIcon1N;
                    }
                }
            }
            if (!cellData.field.objectReference) {
                const dbColName = cellData.unnested === undefined
                    ? cellData.field.dbColumn?.name
                    : `${cellData.unnested.schemaTable}.${String(cellData.field.dbColumn?.name)}`;

                content = <>
                    <Icon src={arrowIcon} width={16} height={16} />
                    <Icon src={iconName} width={16} height={16} />
                    <Label className="columnName" caption={dbColName} />
                    {(data.showSdkOptions !== undefined) &&
                        <Label className="datatype" caption={cellData.field.dbColumn?.datatype.toUpperCase()} />
                    }
                </>;
            } else {
                const refTbl = cellData.field.objectReference.referenceMapping.referencedSchema + "." +
                    cellData.field.objectReference.referenceMapping.referencedTable;

                content = <>
                    <Icon src={arrowIcon} width={16} height={16} />
                    <Icon src={iconName} width={16} height={16} />
                    <Icon src={tableIcon} width={16} height={16} />
                    <Label className="tableName" caption={refTbl} />
                    {cellData.field.enabled && crudDiv}
                    {(/*cellData.field.objectReference.referenceMapping.kind !== "1:n" &&*/
                        cellData.children && cellData.children.length > 0 &&
                        cellData.children[0].type !== MrsObjectFieldTreeEntryType.LoadPlaceholder) &&
                        <Dropdown
                            className="reduceToDropdown"
                            placeholder="Reduce to ..."
                            id={cellData.field.id + "reduceToDropdown"}
                            key={cellData.field.id + "reduceToDropdown"}
                            multiSelect={false}
                            optional={true}
                            selection={cellData.children?.find((item) => {
                                return item.field.id ===
                                    cellData.field.objectReference?.reduceToValueOfFieldId;
                            })?.field.dbColumn?.name}
                            onSelect={(sel, _props) => {
                                // Update data
                                const treeItem = this.findTreeEntryById(cellData.field.id, data.fieldTreeNodes);
                                if (treeItem && treeItem.field && treeItem.field.objectReference) {
                                    const selVal = [...sel];
                                    let reduceToFieldId;
                                    if (selVal.length > 0) {
                                        reduceToFieldId = cellData.children?.find((item) => {
                                            return item.field.dbColumn?.name ===
                                                selVal[0];
                                        })?.field.id;

                                        // Clear checkboxes of child rows
                                        cellData.children?.forEach((child) => {
                                            const childTreeItem = this.findTreeEntryById(
                                                child.field.id, data.fieldTreeNodes);
                                            if (childTreeItem) {
                                                childTreeItem.field.enabled = false;
                                            }
                                        });

                                        treeItem.expanded = false;
                                    } else {
                                        reduceToFieldId = undefined;
                                    }

                                    treeItem.field.objectReference.reduceToValueOfFieldId = reduceToFieldId;

                                    // If this field is currently unnested, revert this
                                    if (treeItem.field.objectReference.unnest) {
                                        this.handleIconClick(cell, "UNNEST", "UNNEST");
                                    } else {
                                        this.updateStateData(data);
                                    }
                                }
                            }}
                            disabled={false}
                            autoFocus={false}
                        >
                            {cellData.children?.map((item, itemIndex) => {
                                return item.field.dbColumn?.name ? <Dropdown.Item
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

    private getJsonDatatype = (cellData: IMrsObjectFieldTreeEntry): string => {
        const { values } = this.props;
        const data = values as IMrsObjectFieldEditorData;

        let datatype = "";
        // Check if this is a regular field
        if (cellData.field.sdkOptions?.datatypeName) {
            datatype = cellData.field.sdkOptions?.datatypeName;
        } else if (!cellData.field.objectReference?.referenceMapping ||
            cellData.field.objectReference?.referenceMapping === null) {
            if (cellData.field.dbColumn) {
                if (cellData.field.dbColumn.datatype === "tinyint(1)") {
                    datatype = "boolean";
                } if (cellData.field.dbColumn.datatype.startsWith("tinyint") ||
                    cellData.field.dbColumn.datatype.startsWith("smallint") ||
                    cellData.field.dbColumn.datatype.startsWith("mediumint") ||
                    cellData.field.dbColumn.datatype.startsWith("int") ||
                    cellData.field.dbColumn.datatype.startsWith("bigint") ||
                    cellData.field.dbColumn.datatype.startsWith("decimal") ||
                    cellData.field.dbColumn.datatype.startsWith("numeric") ||
                    cellData.field.dbColumn.datatype.startsWith("float") ||
                    cellData.field.dbColumn.datatype.startsWith("double")) {
                    datatype = "number";
                } else {
                    datatype = "string";
                }
            } else {
                datatype = "string";
            }
        } else {
            const objName = data.mrsObjects.find((obj) => {
                return obj.id === data.currentMrsObjectId;
            })?.name ?? "";
            datatype = `I${objName}${convertCamelToTitleCase(cellData.field.name)}`;
        }

        return datatype;
    };

    /**
     * -----------------------------------------------------------------------------------------------------------------
     * TreeGrid Editors
     */

    private handleCellDblClick = (e: UIEvent, cell: CellComponent): void => {
        cell.edit(true);
    };


    private handleCellEdited = (cell: CellComponent): void => {
        const { values } = this.props;
        const data = values as IMrsObjectFieldEditorData;
        const cellData = cell.getData() as IMrsObjectFieldTreeEntry;
        const colDef = cell.getColumn().getDefinition();

        // Update data
        const treeItem = this.findTreeEntryById(cellData.field.id, data.fieldTreeNodes);
        if (treeItem && treeItem.field) {
            if (colDef.field === "json") {
                treeItem.field.name = cell.getValue();
            } else if (colDef.field === "sdk") {
                if (!treeItem.field.sdkOptions) {
                    treeItem.field.sdkOptions = {
                        datatypeName: cell.getValue(),
                    };
                } else {
                    treeItem.field.sdkOptions.datatypeName = cell.getValue();
                }
            }
        }
        this.updateStateData(data);
    };

    private handleIconClick = (cell: CellComponent, iconGroup: string, icon: string): void => {
        const cellData = cell.getData() as IMrsObjectFieldTreeEntry;
        const { values } = this.props;
        const data = values as IMrsObjectFieldEditorData;
        const treeItem = this.findTreeEntryById(cellData.field.id, data.fieldTreeNodes);

        if (treeItem && treeItem.field) {
            switch (iconGroup) {
                case "CRUD": {
                    let crudOps;
                    if (!cell.getRow().getPrevRow()) {
                        crudOps = data.crudOperations;
                    } else {
                        crudOps = treeItem.field.objectReference?.crudOperations.split(",") ?? [];
                    }
                    if (crudOps.includes(icon)) {
                        crudOps.splice(crudOps.indexOf(icon), 1);
                    } else {
                        crudOps.push(icon);
                    }

                    if (!cell.getRow().getPrevRow()) {
                        data.crudOperations = crudOps;
                    } else if (treeItem.field.objectReference) {
                        treeItem.field.objectReference.crudOperations = crudOps.join(",");
                    }

                    break;
                }
                case "UNNEST": {
                    if (treeItem.field.objectReference) {
                        let parentTreeChildren: IMrsObjectFieldTreeEntry[] | undefined;

                        // Get the children of the parent treeNode
                        const parentRow = cell.getRow().getTreeParent();
                        if (parentRow) {
                            const parentTreeEntry = parentRow.getData() as IMrsObjectFieldTreeEntry;
                            parentTreeChildren = this.findTreeEntryById(
                                parentTreeEntry.field.id, data.fieldTreeNodes)?.children;
                        } else {
                            // If there is no parent treeNode, use the root list
                            parentTreeChildren = data.fieldTreeNodes;
                        }

                        if (parentTreeChildren) {
                            if (!treeItem.field.objectReference.unnest) {
                                // When the user selects to unnest the fields of the referenced tables,
                                // create copies of these rows directly below the current row
                                const index = parentTreeChildren?.indexOf(treeItem);
                                if (index) {
                                    let pos = 1;
                                    // Copy the nested fields out one level, below the reference row
                                    treeItem.children?.forEach((c) => {
                                        if (c.type === MrsObjectFieldTreeEntryType.Field) {
                                            const refMap = treeItem.field.objectReference?.referenceMapping;
                                            if (refMap) {
                                                c.unnested = {
                                                    schemaTable: `${refMap.referencedSchema}.${refMap.referencedTable}`,
                                                    referenceFieldName: treeItem.field.name,
                                                };
                                            }

                                            parentTreeChildren?.splice(index + pos, 0, c);
                                            pos++;
                                        }
                                    });
                                }

                                treeItem.expanded = false;
                            } else {
                                // When the user reverts the unnest, delete the copied rows
                                for (let i = parentTreeChildren.length - 1; i >= 0; i--) {
                                    const c = parentTreeChildren[i];

                                    if (c.unnested !== undefined) {
                                        c.unnested = undefined;
                                        parentTreeChildren.splice(i, 1);
                                    }
                                }
                            }
                        }
                        treeItem.field.objectReference.unnest = !treeItem.field.objectReference.unnest;
                    }
                    break;
                }
                default: {
                    break;
                }
            }
            this.updateStateData(data);
        }
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
        host.classList.add("cellEditorHost");

        const cellData = cell.getData() as IMrsObjectFieldTreeEntry;
        const colDef = cell.getColumn().getDefinition();
        let val = "";
        if (colDef.field === "json") {
            val = cellData.field.name;
            this.renderCustomEditor(cell, onRendered, host, val, success, cancel);
        } else if (colDef.field === "sdk") {
            val = this.getJsonDatatype(cellData);
            this.renderCustomEditor(cell, onRendered, host, val, success, cancel);
        }

        return host;
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
        });
    };

    private treeGridToggleEnableState = (e: Event, cell: CellComponent): void => {
        const { values } = this.props;
        const data = values as IMrsObjectFieldEditorData;

        const cellData = cell.getData() as IMrsObjectFieldTreeEntry;

        const treeItem = this.findTreeEntryById(cellData.field.id, data.fieldTreeNodes);
        if (treeItem && treeItem.field) {
            treeItem.field.enabled = !treeItem.field.enabled;
            // Check if a reference has been unchecked, remove it's children and re-add the Loading ... node
            if (!treeItem.field.enabled && treeItem.field.objectReference) {
                treeItem.expanded = false;
                treeItem.expandedOnce = false;
                treeItem.children = [
                    this.newLoadingPlaceholderNode(treeItem.field),
                ];
            } else if (treeItem.field.enabled) {
                // Check if the parent was reduced to a single field, if so, reset the reduce state
                const parentRow = cell.getRow().getTreeParent();
                if (parentRow) {
                    const parentRowData = parentRow.getData() as IMrsObjectFieldTreeEntry;
                    const parentTreeItem = this.findTreeEntryById(parentRowData.field.id, data.fieldTreeNodes);
                    if (parentTreeItem?.field.objectReference?.reduceToValueOfFieldId !== undefined) {
                        parentTreeItem.field.objectReference.reduceToValueOfFieldId = undefined;
                    }
                }
            }
        }

        this.updateStateData(data);
    };


    /**
     * -----------------------------------------------------------------------------------------------------------------
     * TreeGrid Row Expanded/Collapsed
     */

    private handleRowExpanded = (row: RowComponent): void => {
        const data = row.getData() as IMrsObjectFieldTreeEntry;
        data.expanded = true;

        // If this is the first time the row gets expanded, load data
        if (!data.expandedOnce && data.field.objectReference) {
            void this.addTableColumnsToMrsObjectTreeList(
                data.field.objectReference.referenceMapping.referencedSchema,
                data.field.objectReference.referenceMapping.referencedTable,
                "TABLE",
                row);
        }

        if (data.expanded && !data.expandedOnce) {
            data.expandedOnce = true;
        }
    };

    private handleRowCollapsed = (row: RowComponent): void => {
        const entry = row.getData() as IMrsObjectFieldTreeEntry;
        entry.expanded = false;
    };

    private isRowExpanded = (row: RowComponent): boolean => {
        const entry = row.getData() as IMrsObjectFieldTreeEntry;

        return entry.expanded;
    };
}
