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

import _ from "lodash";

import { IPosition, IRange, languages } from "monaco-editor";
import { ScopedSymbol, Symbol, SymbolTable } from "antlr4-c3";

import { ICodeEditorModel } from "../../components/ui/CodeEditor/CodeEditor";
import { CompletionItem, CompletionList } from "../../components/ui/CodeEditor";
import { mapCompletionKind, SQLExecutionContext } from "../../script-execution";
import {
    ICompletionData, ICompletionObjectDetails, ILanguageWorkerResultData, ILanguageWorkerSuggestionData,
    ILanguageWorkerTaskData, LanguageCompletionKind, ServiceLanguage,
} from "../parser-common";

import {
    CharsetSymbol, SystemVariableSymbol, SystemFunctionSymbol, CollationSymbol, ColumnSymbol, EngineSymbol, EventSymbol,
    IndexSymbol, LabelSymbol, LogfileGroupSymbol, PluginSymbol, SchemaSymbol, StoredFunctionSymbol, ViewSymbol,
    StoredProcedureSymbol, TablespaceSymbol, TableSymbol, TriggerSymbol, UdfSymbol, UserSymbol, UserVariableSymbol,
    DBSymbolTable,
} from "../DBSymbolTable";
import { WorkerPool } from "../../supplement/WorkerPool";
import { settings } from "../../supplement/Settings/Settings";

// A string for lookup if schemas have been loaded already.
const schemaKey = "\u0010schemas\u0010";

// This class handles RDBMS specific language processing in the main (UI) thread.
export class RdbmsLanguageService {
    // A symbol table which combines 3 sources:
    //   - All global symbols, which are available for a specific RDBMS type (library functions etc.).
    //   - Symbols for a specific connection (schemas, tables etc.).
    //   - Symbols from a local parse run (e.g. in stored routines).
    protected readonly localSymbols: DBSymbolTable;

    // TODO: get options from outer context (SQL page, settings, sort keys).
    private readonly sortKeys = new Map<LanguageCompletionKind, string>([
        [LanguageCompletionKind.Keyword, "01."],
        [LanguageCompletionKind.Column, "02."],
        [LanguageCompletionKind.UserVariable, "03."],
        [LanguageCompletionKind.Label, "04."],
        [LanguageCompletionKind.Table, "05."],
        [LanguageCompletionKind.View, "06."],
        [LanguageCompletionKind.Schema, "07."],
        [LanguageCompletionKind.Function, "08."],
        [LanguageCompletionKind.Procedure, "09."],
        [LanguageCompletionKind.Udf, "10."],
        [LanguageCompletionKind.Trigger, "11."],
        [LanguageCompletionKind.Index, "12."],
        [LanguageCompletionKind.Event, "13."],
        [LanguageCompletionKind.User, "14."],
        [LanguageCompletionKind.Engine, "15."],
        [LanguageCompletionKind.Plugin, "16."],
        [LanguageCompletionKind.LogfileGroup, "17."],
        [LanguageCompletionKind.Tablespace, "18."],
        [LanguageCompletionKind.Charset, "19."],
        [LanguageCompletionKind.Collation, "20."],
        [LanguageCompletionKind.SystemFunction, "21."],
        [LanguageCompletionKind.SystemVariable, "22."],
    ]);

    private readonly descriptionMap = new Map<LanguageCompletionKind, string>([
        [LanguageCompletionKind.Keyword, "Keyword"],
        [LanguageCompletionKind.Column, "Column"],
        [LanguageCompletionKind.UserVariable, "User Variable"],
        [LanguageCompletionKind.Label, "Label"],
        [LanguageCompletionKind.Table, "Table"],
        [LanguageCompletionKind.View, "View"],
        [LanguageCompletionKind.Schema, "Schema"],
        [LanguageCompletionKind.Function, "Stored Function"],
        [LanguageCompletionKind.Procedure, "Stored Procedure"],
        [LanguageCompletionKind.Udf, "User Defined Function"],
        [LanguageCompletionKind.Trigger, "Trigger"],
        [LanguageCompletionKind.Index, "Index"],
        [LanguageCompletionKind.Event, "Event"],
        [LanguageCompletionKind.User, "Uer"],
        [LanguageCompletionKind.Engine, "Table Engine"],
        [LanguageCompletionKind.Plugin, "Server Plugin"],
        [LanguageCompletionKind.LogfileGroup, "Logfile Group"],
        [LanguageCompletionKind.Tablespace, "Tablespace"],
        [LanguageCompletionKind.Charset, "Charset"],
        [LanguageCompletionKind.Collation, "Collation"],
        [LanguageCompletionKind.SystemFunction, "System Function"],
        [LanguageCompletionKind.SystemVariable, "System Variable"],
    ]);

    private readonly loadedSchemaTables = new Set<string>();

    public constructor(
        private language: ServiceLanguage,
        protected pool: WorkerPool<ILanguageWorkerTaskData, ILanguageWorkerResultData>,
        private globalSymbols: SymbolTable) {

        this.localSymbols = new DBSymbolTable("local", { allowDuplicateSymbols: false });
        this.localSymbols.addDependencies(this.globalSymbols);
    }

    public async getCodeCompletionItems(context: SQLExecutionContext,
        position: IPosition): Promise<CompletionList | undefined> {
        const model = context.model as ICodeEditorModel;
        this.localSymbols.addDependencies(model.symbols);

        return new Promise((resolve, reject) => {
            const statement = context.getStatementAtPosition(position);
            if (!statement) {
                resolve(undefined);

                return;
            }

            const infoData: ILanguageWorkerSuggestionData = {
                api: "suggestion",
                language: this.language,
                version: context.dbVersion,
                sql: statement.text,
                offset: model.getOffsetAt(position) - statement.offset,
                line: position.lineNumber - statement.line + 1,
                column: position.column - 1, // Columns are zero-based in ANTLR4.
                currentSchema: context.currentSchema,
            };

            this.pool.runTask(infoData).then((taskId: number, result: ILanguageWorkerResultData): void => {
                if (!model.isDisposed() && result.completions) {
                    const info = model.getWordUntilPosition(position);
                    const replaceRange = context.fromLocal({
                        startLineNumber: position.lineNumber,
                        startColumn: info.startColumn,
                        endLineNumber: position.lineNumber,
                        endColumn: info.endColumn,
                    });

                    this.transformCompletionItems(result.completions, replaceRange).then((suggestions) => {
                        if (suggestions.length === 0) {
                            // Add a special item here if nothing was found.
                            // Otherwise we get some meaningless default suggestions.
                            suggestions.push({
                                label: "No Suggestions.",
                                kind: languages.CompletionItemKind.Text,
                                range: replaceRange,
                                insertText: "",
                            });

                        }

                        resolve({
                            incomplete: false,
                            suggestions,
                        });

                        this.localSymbols.removeDependency(model.symbols);
                    }).catch((reason) => {
                        reject(reason);
                    });
                } else {
                    resolve(undefined);
                }
            });

        });
    }

    private transformCompletionItems = async (data: ICompletionData, range: IRange): Promise<CompletionItem[]> => {
        const result: CompletionItem[] = [];

        const uppercaseKeywords = settings.get("dbEditor.upperCaseKeywords", true);
        let sortKey = this.sortKeys.get(LanguageCompletionKind.Keyword)!;
        data.keywords.forEach((keyword) => {
            if (!uppercaseKeywords) {
                keyword = keyword.toLowerCase();
            }

            result.push({
                label: keyword,
                kind: mapCompletionKind.get(LanguageCompletionKind.Keyword)!,
                range,
                insertText: keyword,
                sortText: sortKey + keyword,
                documentation: "Keyword",
            });
        });

        sortKey = this.sortKeys.get(LanguageCompletionKind.Function)!;
        data.functions.forEach((functionName) => {
            functionName = functionName.toLowerCase();
            result.push({
                label: functionName,
                kind: mapCompletionKind.get(LanguageCompletionKind.Keyword)!,
                range,
                insertText: functionName,
                sortText: sortKey + functionName,
                documentation: "Function",
            });
        });

        // The DB objects list can contain duplicates, in the sense that it contains multiple entries for the same
        // parent objects. There's no sense in processing the same combination of completion kind, schemas + tables
        // more than once.
        // Keep in mind however that in the final list there can still be duplicate entries, for example
        // columns from different tables which have the same name.
        const handledKinds: ICompletionObjectDetails[] = [];
        const findHandledKind = (details: ICompletionObjectDetails): boolean => {
            const index = handledKinds.findIndex((candidate) => {
                return _.isEqual(candidate, details);
            });

            return index > -1;
        };

        // Sort the objects so that parent elements are handled before the sub elements (schema before tables etc.).
        // This way also all symbols of the same type are listed together.
        data.dbObjects.sort((lhs, rhs) => {
            return lhs.kind - rhs.kind;
        });

        for await (const entry of data.dbObjects) {
            switch (entry.kind) {
                case LanguageCompletionKind.Procedure:
                case LanguageCompletionKind.Function:
                case LanguageCompletionKind.Udf:
                case LanguageCompletionKind.Trigger:
                case LanguageCompletionKind.Table:
                case LanguageCompletionKind.View: {
                    if (entry.schemas) {
                        if (!findHandledKind(entry)) {
                            handledKinds.push(entry);
                            const list = await this.collectItemsFromSchemas(entry.kind, entry.schemas, range);
                            result.push(...list);
                        }
                    }

                    break;
                }

                case LanguageCompletionKind.Column: {
                    if (entry.schemas && entry.tables) {
                        if (!findHandledKind(entry)) {
                            handledKinds.push(entry);
                            const list = await this.collectColumns(entry.schemas, entry.tables, range);
                            result.push(...list);
                        }
                    }

                    break;
                }

                case LanguageCompletionKind.SystemFunction: {
                    if (!findHandledKind(entry)) {
                        // Special handling for system functions as we have individual descriptions for each of them.
                        handledKinds.push(entry);
                        const list = await this.collectSystemFunctions(range);
                        result.push(...list);
                    }

                    break;
                }

                case LanguageCompletionKind.UserVariable: {
                    if (!findHandledKind(entry)) {
                        handledKinds.push(entry);
                        const list = await this.collectUserVariables(range);
                        result.push(...list);
                    }

                    break;
                }

                case LanguageCompletionKind.SystemVariable: {
                    if (!findHandledKind(entry)) {
                        handledKinds.push(entry);
                        const list = await this.collectSystemVariables(range);
                        result.push(...list);
                    }

                    break;
                }

                default: {
                    if (!findHandledKind(entry)) {
                        handledKinds.push(entry);

                        const list = await this.collectItems(this.localSymbols, entry.kind, range);
                        result.push(...list);
                    }

                    break;
                }
            }
        }

        return result;
    };

    /**
     * Collects completion items of the specified type.
     *
     * @param parent The outer scope which contains the requested symbols.
     * @param kind The type of item to collect.
     * @param range The replacement range for the items.
     * @param documentation A string describing the item type.
     *
     * @returns The list of collected items.
     */
    private collectItems = async (parent: ScopedSymbol, kind: LanguageCompletionKind, range: IRange,
        documentation?: string): Promise<CompletionItem[]> => {
        const result: CompletionItem[] = [];

        const addParens = kind === LanguageCompletionKind.Procedure || kind === LanguageCompletionKind.Function
            || kind === LanguageCompletionKind.Udf;
        const sortKey = this.sortKeys.get(kind) || "";
        if (!documentation) {
            documentation = this.descriptionMap.get(kind) || "<no description available>";
        }

        const symbols = await this.getSymbolsOfKind(parent, kind);
        for (const symbol of symbols) {
            const text = symbol.name + (addParens ? "()" : "");
            result.push({
                label: text,
                kind: mapCompletionKind.get(kind)!,
                range,
                insertText: text,
                sortText: sortKey + text,
                documentation,
            });
        }

        return result;
    };

    /**
     * Like `collectItems` but for specific schemas only.
     *
     * @param kind The type of item to collect.
     * @param schemas A list of schemas to consider.
     * @param range The replacement range for the items.
     * @param documentation A string describing the item type.
     *
     * @returns The list of collected items.
     */
    private collectItemsFromSchemas = async (kind: LanguageCompletionKind, schemas: Set<string>,
        range: IRange, documentation?: string): Promise<CompletionItem[]> => {
        const result: CompletionItem[] = [];

        // Load the schema list if we haven't loaded it yet.
        if (!this.loadedSchemaTables.has(schemaKey)) {
            await this.getSymbolsOfKind(this.localSymbols, LanguageCompletionKind.Schema);
        }

        for (const schema of schemas) {
            const schemaSymbol = await this.localSymbols.resolve(schema, false);
            if (!schemaSymbol) {
                continue;
            }

            result.push(...await this.collectItems(schemaSymbol as ScopedSymbol, kind, range, documentation));
        }

        return result;
    };

    /**
     * Collects columns for the given tables in the given schemas.
     *
     * @param schemas The schemas from which the tables are determined.
     * @param tables The tables from which the columns are to be determined.
     * @param range The replacement range for the items.
     *
     * @returns A list of column items.
     */
    private collectColumns = async (schemas: Set<string>, tables: Set<string>,
        range: IRange): Promise<CompletionItem[]> => {
        const result: CompletionItem[] = [];

        // Load the schema list if we haven't loaded it yet.
        if (!this.loadedSchemaTables.has(schemaKey)) {
            await this.getSymbolsOfKind(this.localSymbols, LanguageCompletionKind.Schema);
        }

        for (const schema of schemas) {
            const schemaSymbol = await this.localSymbols.resolve(schema, false);
            if (!schemaSymbol) {
                continue;
            }

            // Load the table list if we haven't loaded it yet.
            if (!this.loadedSchemaTables.has(schema)) {
                await this.getSymbolsOfKind(this.localSymbols, LanguageCompletionKind.Table);
            }

            for (const table of tables) {
                const tableSymbol = await schemaSymbol.resolve(table, true);
                if (!tableSymbol) {
                    continue;
                }
                result.push(...await this.collectItems(tableSymbol as ScopedSymbol, LanguageCompletionKind.Column,
                    range));
            }
        }

        return result;
    };

    /**
     * Collects the system function items.
     *
     * @param range The replacement range for the items.
     *
     * @returns A list of column items.
     */
    private collectSystemFunctions = async (range: IRange): Promise<CompletionItem[]> => {
        const result: CompletionItem[] = [];

        const sortKey = this.sortKeys.get(LanguageCompletionKind.SystemFunction)!;
        const symbols = await this.localSymbols.getAllSymbols(SystemFunctionSymbol);
        for (const symbol of symbols) {
            const text = symbol.name + "()";
            result.push({
                label: text,
                kind: mapCompletionKind.get(LanguageCompletionKind.SystemFunction)!,
                range,
                insertText: text,
                sortText: sortKey + text,
                documentation: symbol.description[1],
            });
        }

        return result;
    };

    /**
     * Collects the user variable items.
     *
     * @param range The replacement range for the items.
     *
     * @returns A list of column items.
     */
    private collectUserVariables = async (range: IRange): Promise<CompletionItem[]> => {
        const result: CompletionItem[] = [];

        const symbols = await this.localSymbols.getAllSymbols(UserVariableSymbol);
        const sortKey = this.sortKeys.get(LanguageCompletionKind.UserVariable)!;
        for (const symbol of symbols) {
            const name = "@" + symbol.name;
            result.push({
                label: name,
                kind: mapCompletionKind.get(LanguageCompletionKind.UserVariable)!,
                range,
                insertText: name,
                sortText: sortKey + name,
                documentation: "User Variable",
            });
        }

        return result;
    };

    /**
     * Collects the system variable items.
     *
     * @param range The replacement range for the items.
     *
     * @returns A list of column items.
     */
    private collectSystemVariables = async (range: IRange): Promise<CompletionItem[]> => {
        const result: CompletionItem[] = [];

        const symbols = await this.localSymbols.getAllSymbols(SystemVariableSymbol);
        const sortKey = this.sortKeys.get(LanguageCompletionKind.SystemVariable)!;
        for (const symbol of symbols) {
            const name = "@@" + symbol.name;

            result.push({
                label: name,
                kind: mapCompletionKind.get(LanguageCompletionKind.SystemVariable)!,
                range: {
                    startColumn: range.startColumn - 2,
                    startLineNumber: range.startLineNumber,
                    endColumn: range.endColumn,
                    endLineNumber: range.endLineNumber,
                },
                insertText: name,
                sortText: sortKey + name,
                documentation: (symbol).description[1],
            });
        }

        return result;
    };

    /**
     * Returns all symbols of the given kind from the symbol table.
     *
     * @param parent The outer scope which contains the requested symbols.
     * @param kind The kind of the symbols to return.
     *
     * @returns A set with the found symbols.
     */
    private getSymbolsOfKind(parent: ScopedSymbol, kind: LanguageCompletionKind): Promise<Symbol[]> {
        switch (kind) {
            case LanguageCompletionKind.Schema: {
                this.loadedSchemaTables.add(schemaKey);

                return parent.getAllSymbols(SchemaSymbol);
            }

            case LanguageCompletionKind.Table: {
                this.loadedSchemaTables.add(parent.name);

                return parent.getAllSymbols(TableSymbol);
            }

            case LanguageCompletionKind.Index: {
                return parent.getAllSymbols(IndexSymbol);
            }

            case LanguageCompletionKind.Column: {
                return parent.getAllSymbols(ColumnSymbol);
            }

            case LanguageCompletionKind.View: {
                return parent.getAllSymbols(ViewSymbol);
            }

            case LanguageCompletionKind.Label: {
                return parent.getAllSymbols(LabelSymbol);
            }

            case LanguageCompletionKind.SystemFunction: {
                return parent.getAllSymbols(SystemFunctionSymbol);
            }

            case LanguageCompletionKind.Function: {
                return parent.getAllSymbols(StoredFunctionSymbol);
            }

            case LanguageCompletionKind.Procedure: {
                return parent.getAllSymbols(StoredProcedureSymbol);
            }

            case LanguageCompletionKind.Udf: {
                return parent.getAllSymbols(UdfSymbol);
            }

            case LanguageCompletionKind.Engine: {
                return parent.getAllSymbols(EngineSymbol);
            }

            case LanguageCompletionKind.Tablespace: {
                return parent.getAllSymbols(TablespaceSymbol);
            }

            case LanguageCompletionKind.UserVariable: {
                return parent.getAllSymbols(UserVariableSymbol);
            }

            case LanguageCompletionKind.SystemVariable: {
                return parent.getAllSymbols(SystemVariableSymbol);
            }

            case LanguageCompletionKind.Charset: {
                return parent.getAllSymbols(CharsetSymbol);
            }

            case LanguageCompletionKind.Collation: {
                return parent.getAllSymbols(CollationSymbol);
            }

            case LanguageCompletionKind.Event: {
                return parent.getAllSymbols(EventSymbol);
            }

            case LanguageCompletionKind.User: {
                return parent.getAllSymbols(UserSymbol);
            }

            case LanguageCompletionKind.Trigger: {
                return parent.getAllSymbols(TriggerSymbol);
            }

            case LanguageCompletionKind.LogfileGroup: {
                return parent.getAllSymbols(LogfileGroupSymbol);
            }

            case LanguageCompletionKind.Plugin: {
                return parent.getAllSymbols(PluginSymbol);
            }

            default: {
                return Promise.resolve([]);
            }
        }
    }
}
