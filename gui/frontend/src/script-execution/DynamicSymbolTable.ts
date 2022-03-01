/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation. The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { Symbol, ScopedSymbol, SymbolTableOptions } from "antlr4-c3";

import { ShellInterfaceSqlEditor } from "../supplement/ShellInterface";
import {
    CharsetSymbol, CollationSymbol, ColumnSymbol, DBSymbolTable, EngineSymbol, ForeignKeySymbol, IndexSymbol,
    LogfileGroupSymbol, PluginSymbol, SchemaSymbol, StoredFunctionSymbol, StoredProcedureSymbol, TableSymbol,
    TriggerSymbol, UdfSymbol, UserSymbol, UserVariableSymbol, ViewSymbol,
} from "../parsing/DBSymbolTable";
import { SymbolKind } from "../parsing/parser-common";
import { ICommErrorEvent, ICommMetaDataEvent } from "../communication";
import { EventType, ListenerEntry } from "../supplement/Dispatch";

// An enhanced database symbol table, which is able to retrieve their content from a shell DB connection on demand.
export class DynamicSymbolTable extends DBSymbolTable {

    public constructor(
        private backend: ShellInterfaceSqlEditor | undefined,
        name: string,
        options: SymbolTableOptions) {
        super(name, options);
    }

    /**
     * Overwritten to provide dynamic loading of global symbols like schemas, engines, etc.
     *
     * @param t The symbol type to load.
     * @param localOnly Indicates the locality of the symbol search.
     *
     * @returns A set of found symbols.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public async getAllSymbols<T extends Symbol>(t: new (...args: any[]) => T, localOnly?: boolean): Promise<T[]> {
        let existing = await super.getAllSymbols(t, localOnly);
        if (existing.length === 0) {
            // Not yet loaded, so do it now.
            await this.loadSymbolsOfKind(this, DBSymbolTable.getKindFromSymbol(t.name));
            existing = await super.getAllSymbols(t, localOnly);
        }

        return existing;
    }

    /**
     * Sends a request to the backend to return certain object names and creates symbols for them.
     *
     * @param parent The parent symbol to fill new nodes in.
     * @param kind The type of symbol to retrieve.
     *
     * @returns The list of new symbols that have been added to this symbol table.
     */
    public loadSymbolsOfKind(parent: ScopedSymbol, kind: SymbolKind): Promise<Set<Symbol>> {
        return new Promise((resolve, reject) => {
            if (!this.backend) {
                return resolve(new Set());
            }

            switch (kind) {
                case SymbolKind.Schema: {
                    const listener = this.backend.getCatalogObjects("Schema");
                    this.handleResults(listener, parent, resolve, reject, SchemaSymbol);

                    break;
                }

                case SymbolKind.Table: {
                    const listener = this.backend.getSchemaObjects(parent.name, "Table");
                    this.handleResults(listener, parent, resolve, reject, TableSymbol);

                    break;
                }

                case SymbolKind.Column: {
                    if (parent.parent) {
                        const listener = this.backend.getSchemaTableColumns(parent.parent.name, parent.name);
                        this.handleResults(listener, parent, resolve, reject, ColumnSymbol);
                    }

                    break;
                }

                case SymbolKind.Procedure: {
                    const listener = this.backend.getSchemaObjects(parent.name, "Routine", "procedure");
                    this.handleResults(listener, parent, resolve, reject, StoredProcedureSymbol);

                    break;
                }

                case SymbolKind.Function: {
                    const listener = this.backend.getSchemaObjects(parent.name, "Routine", "function");
                    this.handleResults(listener, parent, resolve, reject, StoredFunctionSymbol);

                    break;
                }

                case SymbolKind.Udf: {
                    const listener = this.backend.getSchemaObjects(parent.name, "Routine");
                    this.handleResults(listener, parent, resolve, reject, UdfSymbol);

                    break;
                }

                case SymbolKind.View: {
                    const listener = this.backend.getSchemaObjects(parent.name, "View");
                    this.handleResults(listener, parent, resolve, reject, ViewSymbol);

                    break;
                }

                case SymbolKind.PrimaryKey: {
                    // TODO: fix table specifier.
                    const listener = this.backend.getTableObjects(parent.name, "", "Primary Key");
                    this.handleResults(listener, parent, resolve, reject, ForeignKeySymbol);

                    break;
                }

                case SymbolKind.ForeignKey: {
                    // TODO: fix table specifier.
                    const listener = this.backend.getTableObjects(parent.name, "", "Foreign Key");
                    this.handleResults(listener, parent, resolve, reject, ForeignKeySymbol);

                    break;
                }

                case SymbolKind.Operator: {

                    break;
                }

                case SymbolKind.Engine: {
                    const listener = this.backend.getCatalogObjects("Engine");
                    this.handleResults(listener, parent, resolve, reject, EngineSymbol);

                    break;
                }

                case SymbolKind.Trigger: {
                    const listener = this.backend.getSchemaObjects(parent.name, "Trigger");
                    this.handleResults(listener, parent, resolve, reject, TriggerSymbol);

                    break;
                }

                case SymbolKind.LogfileGroup: {
                    const listener = this.backend.getSchemaObjects(parent.name, "Routine");
                    this.handleResults(listener, parent, resolve, reject, LogfileGroupSymbol);

                    break;
                }

                case SymbolKind.UserVariable: {
                    const listener = this.backend.getCatalogObjects("User Variable");
                    this.handleResults(listener, parent, resolve, reject, UserVariableSymbol);

                    break;
                }

                case SymbolKind.Tablespace: {
                    const listener = this.backend.getSchemaObjects(parent.name, "Tablespace");
                    this.handleResults(listener, parent, resolve, reject, UdfSymbol);

                    break;
                }

                case SymbolKind.Event: {
                    const listener = this.backend.getSchemaObjects(parent.name, "Event");
                    this.handleResults(listener, parent, resolve, reject, UdfSymbol);

                    break;
                }

                case SymbolKind.Index: {
                    // TODO: fix table specifier.
                    const listener = this.backend.getTableObjects(parent.name, "", "Index");
                    this.handleResults(listener, parent, resolve, reject, IndexSymbol);

                    break;
                }

                case SymbolKind.User: {
                    const listener = this.backend.getCatalogObjects("User");
                    this.handleResults(listener, parent, resolve, reject, UserSymbol);

                    break;
                }

                case SymbolKind.Charset: {
                    const listener = this.backend.getCatalogObjects("Character Set");
                    this.handleResults(listener, parent, resolve, reject, CharsetSymbol);

                    break;
                }

                case SymbolKind.Collation: {
                    const listener = this.backend.getCatalogObjects("Collation");
                    this.handleResults(listener, parent, resolve, reject, CollationSymbol);

                    break;
                }

                case SymbolKind.Plugin: {
                    const listener = this.backend.getCatalogObjects("Plugin");
                    this.handleResults(listener, parent, resolve, reject, PluginSymbol);

                    break;
                }

                default: {
                    // Everything else can either not be loaded (e.g. catalog) or exists already somewhere else
                    // (e.g. system functions and keywords).
                    resolve(new Set());

                    break;
                }
            }
        });
    }

    /**
     * Common handling of object listing results from the backend.
     *
     * @param listener The listener that provides the data.
     * @param parent The parent symbol where to add new symbols.
     * @param resolve The resolve method to call for valid results.
     * @param reject The reject method to call for errors.
     * @param t The type of the symbol to add.
     */
    private handleResults<T extends Symbol>(listener: ListenerEntry, parent: ScopedSymbol,
        resolve: (resolve: Set<Symbol> | PromiseLike<Set<Symbol>>) => void,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reject: (reason?: unknown) => void, t: new (...args: any[]) => T): void {

        const symbolNames: string[] = [];

        listener.then((event: ICommMetaDataEvent) => {
            if (!event.data) {
                return;
            }

            switch (event.eventType) {
                case EventType.ErrorResponse: {
                    reject(event.message);

                    break;
                }

                case EventType.DataResponse: {
                    if (!Array.isArray(event.data.result)) {
                        if (event.data.result.columns) {
                            event.data.result.columns.forEach((item) => {
                                symbolNames.push(item);
                            });
                        }
                    } else if (event.data.result) {
                        event.data.result.forEach((item) => {
                            symbolNames.push(item);
                        });
                    }

                    break;
                }

                case EventType.FinalResponse: {
                    if (!Array.isArray(event.data.result)) {
                        if (event.data.result.columns) {
                            event.data.result.columns.forEach((item) => {
                                symbolNames.push(item);
                            });
                        }
                    } else if (event.data.result) {
                        event.data.result.forEach((item) => {
                            symbolNames.push(item);
                        });
                    }

                    const symbols: Set<T> = new Set();
                    symbolNames.forEach((symbolName) => {
                        symbols.add(this.addNewSymbolOfType(t, parent, symbolName));
                    });

                    resolve(symbols);

                    break;
                }

                default: {
                    break;
                }
            }
        }).catch((error: ICommErrorEvent) => {
            reject(error.message);
        });
    }
}
