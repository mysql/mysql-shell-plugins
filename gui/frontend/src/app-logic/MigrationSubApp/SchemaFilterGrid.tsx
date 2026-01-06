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

import {
    IMigrationFilters
} from "../../communication/ProtocolMigration.js";
import { Button } from "../../components/ui/Button/Button.js";
import { Checkbox, CheckState } from "../../components/ui/Checkbox/Checkbox.js";
import { Container, ContentAlignment, Orientation } from "../../components/ui/Container/Container.js";
import { AllObjectTypes, MigrationFilterInfo } from "./MigrationFilterInfo.js";
import { SchemaFilterEditor } from "./SchemaFilterEditor.js";
import "./SchemaFilterGrid.css";

import { Component, createRef, VNode } from "preact";

interface ISchemaFilterGridProps {
    schemas: string[];
    filterInfo: MigrationFilterInfo;
    onObjectTypeToggle: (objectType: keyof IMigrationFilters, enable: boolean) => void;
    onSchemaToggle: (schemaName: string, include: boolean) => void;
    onFilterInfoChange: () => void;
}

interface ISchemaObjectInfo {
    included: boolean;
    count?: number;
    excludeCount: number;
};

interface ISchemaFilterRow {
    name: string;
    included: boolean;

    size: number;

    contents: Record<string, ISchemaObjectInfo>;
}

interface ISchemaFilterGridState {
    rows: ISchemaFilterRow[];
}

export class SchemaFilterGrid extends Component<ISchemaFilterGridProps, ISchemaFilterGridState> {
    private editorRef = createRef<SchemaFilterEditor>();

    public constructor(props: ISchemaFilterGridProps) {
        super(props);

        this.state = { rows: [] };

        const rows = this.getUpdatedRows();

        this.state = { rows };
    }

    public override render(): VNode {
        const { rows } = this.state;
        const { filterInfo } = this.props;

        return (
            <div className="schema-filter-grid">
                <SchemaFilterEditor
                    ref={this.editorRef}
                    id="schemaFilterEditor"
                    filterInfo={filterInfo}
                    onClose={this.onCloseObjectSelector.bind(this)}
                />
                <table className="schema-filter-grid-table">
                    <thead>
                        <tr>
                            <th key="schema" className="schema-filter-grid-schema-column">Schema</th>
                            {AllObjectTypes.map((type) => {
                                const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
                                const enabled = filterInfo.isObjectTypeIncluded(type);

                                return (
                                    <th key={type} className="schema-filter-grid-object-column">
                                        {enabled === undefined ? capitalizedType :
                                            <Checkbox
                                                checkState={enabled ? CheckState.Checked : CheckState.Unchecked}
                                                onClick={this.props.onObjectTypeToggle.bind(this, type, !enabled)}
                                                caption={capitalizedType}
                                            />}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, rowIndex) => {
                            return (
                                <tr key={row.name}>
                                    <td className="schema-filter-grid-schema-column">
                                        <Container
                                            orientation={Orientation.LeftToRight}
                                            mainAlignment={ContentAlignment.SpaceBetween}>
                                            <Checkbox
                                                className="schema-filter-exclude-schema"
                                                data-tooltip="Exclude this schema"
                                                checkState={row.included ? CheckState.Checked : CheckState.Unchecked}
                                                onClick={this.onToggleSchema.bind(this, rowIndex, !row.included)}
                                                caption={row.name} />
                                        </Container>
                                    </td>
                                    {
                                        AllObjectTypes.map((type) => {
                                            const contents = row.contents[type];
                                            const count = contents.count;
                                            const excluded = contents.excludeCount;
                                            const objectEnabled = filterInfo.isObjectTypeIncluded(type);

                                            if (row.included && objectEnabled !== false) {
                                                return (
                                                    <td key={type} className="schema-filter-grid-object-column">
                                                        <Button
                                                            className="schema-filter-edit"
                                                            data-tooltip={"Click to select " +
                                                                type + " to include or exclude"}
                                                            focusOnClick={false}
                                                            tabIndex={-1}
                                                            onClick={() => {
                                                                void this.onOpenObjectSelector(type, row.name);
                                                            }}
                                                        >{
                                                                excluded > 0 && count !== undefined ?
                                                                    <span data-tooltip="inherit">
                                                                        {count - excluded} of {count}
                                                                    </span> :
                                                                    <span data-tooltip="inherit">all</span>
                                                            }
                                                        </Button>
                                                    </td>
                                                );
                                            } else {
                                                return (
                                                    <td key={type}>-</td>
                                                );
                                            }
                                        })
                                    }
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div >
        );
    }

    private getUpdatedRows() {
        const { schemas, filterInfo } = this.props;

        const rows = schemas.map((schema) => {
            const contents: Record<string, ISchemaObjectInfo> = {};

            AllObjectTypes.map((objectType) => {
                const schemaObjects = filterInfo.getSchemaObjects(schema, objectType);

                contents[objectType] = {
                    included: filterInfo.isObjectTypeIncluded(objectType) ?? true,
                    count: schemaObjects?.length,
                    excludeCount: schemaObjects?.map((name): number => {
                        return filterInfo.isObjectExcluded(schema, objectType, name) ? 1 : 0;
                    }).reduce((previous, current) => {
                        return previous + current;
                    }, 0) ?? 0
                };
            });

            return {
                name: schema,
                included: filterInfo.isSchemaIncluded(schema),
                size: 0,
                contents
            } as ISchemaFilterRow;
        });

        return rows;
    }

    private async onOpenObjectSelector(objectType: keyof IMigrationFilters, schemaName: string) {
        if (this.editorRef.current) {
            await this.editorRef.current.show(objectType, schemaName);
        }
    }

    private onCloseObjectSelector(accepted: boolean, objectType: keyof IMigrationFilters, schemaName: string) {
        if (accepted) {
            this.props.onFilterInfoChange();
            const rows = this.getUpdatedRows();

            this.setState({ rows });
        }
    }

    private onToggleSchema(rowIndex: number, include: boolean) {
        const { rows } = this.state;
        const schemaName = rows[rowIndex].name;

        this.props.onSchemaToggle(schemaName, include);

        this.setState({ rows: this.getUpdatedRows() });
    }
}
