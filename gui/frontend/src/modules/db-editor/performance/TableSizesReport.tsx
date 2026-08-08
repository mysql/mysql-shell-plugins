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

import * as d3 from "d3";
import { ComponentChild, createRef } from "preact";

import {
    ComponentBase, IComponentProperties, IComponentState,
} from "../../../components/ui/Component/ComponentBase.js";
import { Button } from "../../../components/ui/Button/Button.js";
import { Container, ContentAlignment, Orientation } from "../../../components/ui/Container/Container.js";
import { ShellInterfaceSqlEditor } from "../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { convertErrorToString } from "../../../utilities/helpers.js";
import { formatBytes, formatInteger } from "../../../utilities/string-helpers.js";

interface ITableSizesReportProperties extends IComponentProperties {
    backend?: ShellInterfaceSqlEditor;
}

interface ITableSizeEntry {
    schema: string;
    table: string;
    dataBytes: number;
    indexBytes: number;
    totalBytes: number;
    rows?: number;
    engine?: string;
}

interface ISchemaSizeGroup {
    schema: string;
    dataBytes: number;
    indexBytes: number;
    totalBytes: number;
    tables: ITableSizeEntry[];
}

interface ITableSizesReportState extends IComponentState {
    loading: boolean;
    error?: string;
    schemaSizes: ISchemaSizeGroup[];
    treemapWidth: number;
    treemapHeight: number;
    selectedSchema?: string;
}

interface ITreemapDatum {
    name: string;
    schema?: ISchemaSizeGroup;
    table?: ITableSizeEntry;
    value?: number;
    children?: ITreemapDatum[];
}

type TreemapNode = d3.HierarchyRectangularNode<ITreemapDatum>;

const tableSizesQuery = `
select table_schema,
       table_name,
       coalesce(data_length, 0) as data_bytes,
       coalesce(index_length, 0) as index_bytes,
       coalesce(data_length, 0) + coalesce(index_length, 0) as total_bytes,
       table_rows,
       engine
  from information_schema.tables
 where table_type = 'BASE TABLE'
   and table_schema not in (
       'information_schema',
       'mysql',
       'mysql_innodb_cluster_metadata',
       'mysql_rest_service_metadata',
       'performance_schema',
       'sys'
   )
 order by table_schema, total_bytes desc, table_name`;

export class TableSizesReport extends ComponentBase<ITableSizesReportProperties, ITableSizesReportState> {

    private treemapHostRef = createRef<HTMLDivElement>();
    private resizeObserver?: ResizeObserver;
    private observedTreemapHost?: HTMLDivElement;
    private requestId = 0;

    public constructor(props: ITableSizesReportProperties) {
        super(props);

        this.state = {
            loading: false,
            schemaSizes: [],
            treemapWidth: 0,
            treemapHeight: 0,
        };

        this.addHandledProperties("backend");
    }

    public override componentDidMount(): void {
        this.startResizeObserver();
        void this.updateValues();
    }

    public refresh(): void {
        void this.updateValues();
    }

    public clearSchemaSelection = (): void => {
        if (!this.state.selectedSchema) {
            return;
        }

        this.setState({ selectedSchema: undefined });
    };

    public override componentDidUpdate(prevProps: ITableSizesReportProperties): void {
        const { backend } = this.props;

        this.startResizeObserver();

        if (backend !== prevProps.backend) {
            void this.updateValues();
        }
    }

    public override componentWillUnmount(): void {
        this.resizeObserver?.disconnect();
        this.observedTreemapHost = undefined;
    }

    public render(): ComponentChild {
        const className = this.getEffectiveClassNames(["mysqlInspector"]);

        return (
            <Container
                id="mysqlInspectorReport"
                className={className}
                orientation={Orientation.TopDown}
                mainAlignment={ContentAlignment.Start}
                crossAlignment={ContentAlignment.Stretch}
            >
                {this.tableSizesReport()}
            </Container>
        );
    }

    private tableSizesReport(): ComponentChild {
        const { error, loading, schemaSizes, selectedSchema } = this.state;
        const visibleSchemaSizes = selectedSchema
            ? schemaSizes.filter((schema) => {
                return schema.schema === selectedSchema;
            })
            : schemaSizes;

        return (
            <>
                {error && <div className="mysqlInspectorError">{error}</div>}
                {!error && loading && schemaSizes.length === 0 && <div className="mysqlInspectorEmpty">Loading...</div>}
                {!error && !loading && schemaSizes.length === 0 &&
                    <div className="mysqlInspectorEmpty">No user tables found.</div>}
                {!error && selectedSchema && <Container
                    className="tableSizesReportActions"
                    orientation={Orientation.LeftToRight}
                >
                    <Button
                        id="tableSizesBackButton"
                        caption="< Back"
                        onClick={this.clearSchemaSelection}
                    />
                </Container>}
                {!error && visibleSchemaSizes.length > 0 && this.tableSizesTreemap(visibleSchemaSizes, schemaSizes)}
            </>
        );
    }

    private tableSizesTreemap(
        schemaSizes: ISchemaSizeGroup[], allSchemaSizes: ISchemaSizeGroup[],
    ): ComponentChild {
        const { width, height } = this.treemapDimensions();
        const { schemaNodes, tableNodes } = this.treemapNodes(schemaSizes, width, height);
        const schemaColors = d3.scaleOrdinal<string, string>(
            allSchemaSizes.map((schema) => {
                return schema.schema;
            }),
            d3.schemeTableau10,
        );
        const tableNodesBySchema = new Map<string, TreemapNode[]>();
        tableNodes.forEach((node) => {
            const schema = node.data.table!.schema;
            const schemaNodes = tableNodesBySchema.get(schema) ?? [];
            schemaNodes.push(node);
            tableNodesBySchema.set(schema, schemaNodes);
        });

        return (
            <div className="mysqlInspectorTreemapContent mysqlInspectorTreemapHost" ref={this.treemapHostRef}>
                <svg
                    className="mysqlInspectorTreemap"
                    viewBox={`0 0 ${width} ${height}`}
                    role="img"
                    aria-label="Table sizes treemap"
                >
                    {schemaNodes.map((node) => {
                        const schema = node.data.schema;
                        const nodeWidth = this.nodeWidth(node);
                        const nodeHeight = this.nodeHeight(node);
                        const color = schemaColors(schema?.schema ?? node.data.name);

                        return (
                            <g
                                className={`mysqlInspectorSchemaNode${this.state.selectedSchema === node.data.name
                                    ? " mysqlInspectorSchemaNodeSelected" : ""}`}
                                data-testid={`mysqlInspectorSchema-${node.data.name}`}
                                key={node.data.name}
                                onClick={() => {
                                    this.selectSchema(node.data.name);
                                }}
                            >
                                <rect
                                    className="mysqlInspectorSchemaRect"
                                    data-tooltip={schema ? this.schemaTooltip(schema) : undefined}
                                    x={node.x0}
                                    y={node.y0}
                                    width={nodeWidth}
                                    height={nodeHeight}
                                    fill={color}
                                />
                                {nodeWidth > 90 && nodeHeight > 28 &&
                                        <text
                                            className="mysqlInspectorSchemaLabel"
                                            x={node.x0 + 8}
                                            y={node.y0 + 17}
                                        >
                                            {node.data.name}
                                        </text>}
                                {schema && nodeWidth > 170 && nodeHeight > 28 &&
                                        <text
                                            className="mysqlInspectorSchemaSize"
                                            x={node.x1 - 8}
                                            y={node.y0 + 17}
                                            text-anchor="end"
                                        >
                                            {formatBytes(schema.totalBytes)}
                                        </text>}
                                {tableNodesBySchema.get(schema?.schema ?? node.data.name)?.map((tableNode) => {
                                    const table = tableNode.data.table!;
                                    const tableKey = this.tableKey(table);
                                    const tableWidth = this.nodeWidth(tableNode);
                                    const tableHeight = this.nodeHeight(tableNode);
                                    const indexRatio = table.totalBytes > 0
                                        ? table.indexBytes / table.totalBytes
                                        : 0;
                                    const indexHeight = Math.max(0, Math.min(tableHeight,
                                        tableHeight * indexRatio));
                                    const tableColor = schemaColors(table.schema);
                                    const compositionColor = this.treemapTextColor(tableColor);
                                    const tooltip = this.tableTooltip(table);

                                    return <g
                                        key={tableKey}
                                        className="mysqlInspectorTableNode"
                                        data-testid={`mysqlInspectorTable-${tableKey}`}
                                    >
                                        <rect
                                            className="mysqlInspectorTableRect"
                                            data-tooltip={tooltip}
                                            x={tableNode.x0}
                                            y={tableNode.y0}
                                            width={tableWidth}
                                            height={tableHeight}
                                            fill={tableColor}
                                        />
                                        <rect
                                            className="mysqlInspectorIndexStripe"
                                            data-index-bytes={table.indexBytes}
                                            data-index-ratio={indexRatio}
                                            x={tableNode.x0}
                                            y={tableNode.y1 - indexHeight}
                                            width={tableWidth}
                                            height={indexHeight}
                                            fill={tableColor}
                                        />
                                        {tableWidth > 58 && tableHeight > 28 &&
                                                <text
                                                    className="mysqlInspectorTableLabel"
                                                    x={tableNode.x0 + 6}
                                                    y={tableNode.y0 + 16}
                                                >
                                                    {table.table}
                                                </text>}
                                        {tableWidth > 72 && tableHeight > 48 &&
                                                <text
                                                    className="mysqlInspectorTableSize"
                                                    x={tableNode.x0 + 6}
                                                    y={tableNode.y0 + 33}
                                                >
                                                    {formatBytes(table.totalBytes)}
                                                </text>}
                                        {tableWidth > 150 && tableHeight > 70 &&
                                                <text
                                                    className="mysqlInspectorTableComposition"
                                                    x={tableNode.x0 + 6}
                                                    y={tableNode.y0 + 50}
                                                    style={{ fill: compositionColor }}
                                                >
                                                    {`Data ${formatBytes(table.dataBytes)} / ` +
                                                        `Index ${formatBytes(table.indexBytes)}`}
                                                </text>}
                                    </g>;
                                })}
                            </g>
                        );
                    })}
                </svg>
            </div>
        );
    }

    private async updateValues(): Promise<void> {
        const { backend } = this.props;
        if (!backend) {
            return;
        }

        const requestId = ++this.requestId;
        this.setState({ loading: true, error: undefined });

        try {
            const result = await backend.executeService(tableSizesQuery);
            const rows = (result?.rows ?? []) as unknown[][];
            const schemaSizes = this.groupTableSizes(rows);

            if (requestId !== this.requestId) {
                return;
            }

            this.setState({
                loading: false,
                schemaSizes,
                selectedSchema: schemaSizes.some((schema) => {
                    return schema.schema === this.state.selectedSchema;
                }) ? this.state.selectedSchema : undefined,
            });
        } catch (reason) {
            if (requestId !== this.requestId) {
                return;
            }

            this.setState({
                loading: false,
                error: convertErrorToString(reason),
                schemaSizes: [],
            });
        }
    }

    private groupTableSizes(rows: unknown[][]): ISchemaSizeGroup[] {
        const groups = new Map<string, ISchemaSizeGroup>();

        rows.forEach((row) => {
            const entry: ITableSizeEntry = {
                schema: String(row[0] ?? ""),
                table: String(row[1] ?? ""),
                dataBytes: this.toNumber(row[2]),
                indexBytes: this.toNumber(row[3]),
                totalBytes: this.toNumber(row[4]),
                rows: row[5] === null || row[5] === undefined ? undefined : this.toNumber(row[5]),
                engine: row[6] === null || row[6] === undefined ? undefined : String(row[6]),
            };
            const group = groups.get(entry.schema) ?? {
                schema: entry.schema,
                dataBytes: 0,
                indexBytes: 0,
                totalBytes: 0,
                tables: [],
            };

            group.dataBytes += entry.dataBytes;
            group.indexBytes += entry.indexBytes;
            group.totalBytes += entry.totalBytes;
            group.tables.push(entry);
            groups.set(entry.schema, group);
        });

        return [...groups.values()].sort((left, right) => {
            return right.totalBytes - left.totalBytes || left.schema.localeCompare(right.schema);
        });
    }

    private toNumber(value: unknown): number {
        const result = Number(value);

        return Number.isFinite(result) ? result : 0;
    }

    private startResizeObserver(): void {
        const host = this.treemapHostRef.current;
        if (!host || this.observedTreemapHost === host) {
            return;
        }

        this.resizeObserver?.disconnect();
        this.resizeObserver = undefined;
        this.observedTreemapHost = host;

        const updateSize = (): void => {
            const rect = host.getBoundingClientRect();
            const treemapWidth = Math.floor(rect.width);
            const treemapHeight = Math.floor(rect.height);

            if (treemapWidth <= 0 || treemapHeight <= 0) {
                return;
            }

            if (treemapWidth !== this.state.treemapWidth || treemapHeight !== this.state.treemapHeight) {
                this.setState({ treemapWidth, treemapHeight });
            }
        };

        updateSize();

        /* istanbul ignore next */
        if (typeof ResizeObserver !== "undefined") {
            this.resizeObserver = new ResizeObserver(updateSize);
            this.resizeObserver.observe(host);
        }
    }

    private treemapDimensions(): { width: number; height: number } {
        const { treemapWidth, treemapHeight } = this.state;

        return {
            width: Math.max(360, treemapWidth || 920),
            height: Math.max(320, treemapHeight || 520),
        };
    }

    private treemapNodes(schemaSizes: ISchemaSizeGroup[], width: number, height: number): {
        schemaNodes: TreemapNode[];
        tableNodes: TreemapNode[];
    } {
        const rootData: ITreemapDatum = {
            name: "tableSizes",
            children: schemaSizes.map((schema) => {
                return {
                    name: schema.schema,
                    schema,
                    children: schema.tables.map((table) => {
                        return {
                            name: table.table,
                            table,
                            value: Math.max(table.totalBytes, 1),
                        };
                    }),
                };
            }),
        };
        const hierarchy = d3.hierarchy(rootData)
            .sum((datum) => {
                return datum.value ?? 0;
            })
            .sort((left, right) => {
                return (right.value ?? 0) - (left.value ?? 0) || left.data.name.localeCompare(right.data.name);
            });
        const root = d3.treemap<ITreemapDatum>()
            .size([width, height])
            .paddingOuter(8)
            .paddingTop(20)
            .paddingInner(2)
            .round(true)(hierarchy);

        return {
            schemaNodes: root.children ?? [],
            tableNodes: root.leaves().filter((node) => {
                return node.data.table !== undefined;
            }),
        };
    }

    private nodeWidth(node: TreemapNode): number {
        return Math.max(0, node.x1 - node.x0);
    }

    private nodeHeight(node: TreemapNode): number {
        return Math.max(0, node.y1 - node.y0);
    }

    private selectSchema(schema: string): void {
        if (this.state.selectedSchema === schema) {
            return;
        }

        this.setState({ selectedSchema: schema });
    }

    private treemapTextColor(color: string): string {
        const { r, g, b } = d3.rgb(color);
        const component = (value: number): number => {
            const normalized = value / 255;

            return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        };
        const luminance = (0.2126 * component(r)) + (0.7152 * component(g)) + (0.0722 * component(b));

        return luminance > 0.179 ? "#1D1C1D" : "#FFFFFF";
    }

    private tableTooltip(table: ITableSizeEntry): string {
        const details = [
            `Total: ${formatBytes(table.totalBytes)}`,
            `Data: ${formatBytes(table.dataBytes)}`,
            `Index: ${formatBytes(table.indexBytes)}`,
        ];
        if (table.rows !== undefined) {
            details.push(`Rows: ${formatInteger(table.rows)}`);
        }
        if (table.engine) {
            details.push(`Engine: ${table.engine}`);
        }

        return [`${table.schema}.${table.table}`, ...details].join("\n");
    }

    private schemaTooltip(schema: ISchemaSizeGroup): string {
        return [
            schema.schema,
            `Total: ${formatBytes(schema.totalBytes)}`,
            `Data: ${formatBytes(schema.dataBytes)}`,
            `Index: ${formatBytes(schema.indexBytes)}`,
            `Tables: ${formatInteger(schema.tables.length)}`,
        ].join("\n");
    }

    private tableKey(table: ITableSizeEntry): string {
        return `${table.schema}.${table.table}`;
    }
}
