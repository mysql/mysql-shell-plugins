/*
 * Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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

/* eslint-disable max-classes-per-file, @typescript-eslint/no-use-before-define */

import { ParserRuleContext } from "antlr4ts/ParserRuleContext";
import { ParseTree } from "antlr4ts/tree/ParseTree";
import { TerminalNode } from "antlr4ts/tree/TerminalNode";
import { Interval } from "antlr4ts/misc/Interval";

import { SymbolTable, Symbol, ScopedSymbol, RoutineSymbol, TypedSymbol, VariableSymbol } from "antlr4-c3";

import { SymbolKind, ISymbolInfo, ISymbolDefinition } from "./parser-common";

export class CatalogSymbol extends ScopedSymbol {
}

export class SchemaSymbol extends ScopedSymbol {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public async getAllSymbols<T extends Symbol>(t: new (...args: any[]) => T): Promise<T[]> {
        let existing = await super.getAllSymbols(t, true);
        if (existing.length === 0 && this.symbolTable instanceof DBSymbolTable) {
            const kind = DBSymbolTable.getKindFromSymbol(t);
            await this.symbolTable.loadSymbolsOfKind(this, kind);
            existing = await super.getAllSymbols(t, true);
        }

        return existing;
    }
}

export class TableSymbol extends ScopedSymbol {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public async getAllSymbols<T extends Symbol>(t: new (...args: any[]) => T): Promise<T[]> {
        let existing = await super.getAllSymbols(t, true);
        if (existing.length === 0 && this.symbolTable instanceof DBSymbolTable) {
            if (t.name === "ColumnSymbol") {
                await this.symbolTable.loadSymbolsOfKind(this, SymbolKind.Column);
                existing = await super.getAllSymbols(t, true);
            }
        }

        return existing;
    }
}

export class ViewSymbol extends ScopedSymbol { }
export class EventSymbol extends ScopedSymbol { }
export class ColumnSymbol extends TypedSymbol { }
export class UserSymbol extends TypedSymbol { }
export class IndexSymbol extends Symbol { } // Made of columns, but doesn't contain them. Hence not a scope.
export class ForeignKeySymbol extends Symbol { } // ditto
export class StoredProcedureSymbol extends RoutineSymbol { }
export class StoredFunctionSymbol extends RoutineSymbol { }
export class TriggerSymbol extends ScopedSymbol { }
export class UdfSymbol extends Symbol { } // No body nor parameter info.
export class EngineSymbol extends Symbol { }
export class LabelSymbol extends Symbol { }
export class PluginSymbol extends Symbol { }
export class TablespaceSymbol extends Symbol { }
export class LogfileGroupSymbol extends Symbol { }
export class CharsetSymbol extends Symbol { }
export class CollationSymbol extends Symbol { }
export class PrimaryKeySymbol extends Symbol { }
export class UserVariableSymbol extends VariableSymbol { }
export class SystemVariableSymbol extends Symbol {
    public constructor(name: string, public description: string[]) {
        super(name);
    }
}
export class SystemFunctionSymbol extends Symbol {
    public constructor(name: string, public description: string[]) {
        super(name);
    }
}

/** An enhanced symbol with additional database symbols. */
export class DBSymbolTable extends SymbolTable {

    private static symbolToKindMap: Map<typeof Symbol, SymbolKind> = new Map([
        [CatalogSymbol, SymbolKind.Catalog],
        [SchemaSymbol, SymbolKind.Schema],
        [TableSymbol, SymbolKind.Table],
        [ViewSymbol, SymbolKind.View],
        [EventSymbol, SymbolKind.Event],
        [ColumnSymbol, SymbolKind.Column],
        [IndexSymbol, SymbolKind.Index],
        [PrimaryKeySymbol, SymbolKind.PrimaryKey],
        [ForeignKeySymbol, SymbolKind.ForeignKey],
        [StoredProcedureSymbol.constructor as typeof Symbol, SymbolKind.Procedure],
        [StoredFunctionSymbol.constructor as typeof Symbol, SymbolKind.Function],
        [TriggerSymbol, SymbolKind.Trigger],
        [UdfSymbol, SymbolKind.Udf],
        [EngineSymbol, SymbolKind.Engine],
        [TablespaceSymbol, SymbolKind.Tablespace],
        [LogfileGroupSymbol, SymbolKind.LogfileGroup],
        [CharsetSymbol, SymbolKind.Charset],
        [CollationSymbol, SymbolKind.Collation],
        [UserVariableSymbol.constructor as typeof Symbol, SymbolKind.UserVariable],
        [PluginSymbol, SymbolKind.Plugin],
        [SystemVariableSymbol.constructor as typeof Symbol, SymbolKind.SystemVariable],
        [SystemFunctionSymbol.constructor as typeof Symbol, SymbolKind.SystemFunction],
    ]);

    // TODO: set the tree actually.
    public tree: ParserRuleContext; // Set by the owning service context after each parse run.

    private symbolReferences: Map<string, number> = new Map();

    /**
     * Converts a symbol class to a symbol kind in a way that is compatible with minified class names.
     *
     * @param symbol The symbol class name.
     *
     * @returns The symbol kind.
     */
    public static getKindFromSymbol(symbol: typeof Symbol): SymbolKind {
        return this.symbolToKindMap.get(symbol) ?? SymbolKind.Unknown;
    }

    /**
     * Removes all content in this symbol table.
     */
    public clear(): void {
        this.symbolReferences.clear();
        super.clear();
    }

    /**
     * Checks if a specific symbol exists in this table.
     *
     * @param name The name of the symbol.
     * @param kind The kind of the symbol.
     * @param localOnly If true only search in this table, otherwise also search in all references.
     *
     * @returns True if the symbol was found, false otherwise.
     */
    public symbolExists(name: string, kind: SymbolKind, localOnly: boolean): boolean {
        return this.getSymbolOfKind(name, kind, localOnly) !== undefined;
    }

    /**
     * Find a symbol with a specific name and type and return the parser context (parse tree) for it, if found.
     *
     * @param symbolName The name of the symbol to search.
     * @param kind The symbol kind.
     * @param localOnly If true only search in this table, otherwise also search in all references.
     *
     * @returns The parse tree defining this symbol or undefined if the symbol could not be found.
     */
    public async contextForSymbol(symbolName: string, kind: SymbolKind,
        localOnly: boolean): Promise<ParseTree | undefined> {
        const symbol = await this.getSymbolOfKind(symbolName, kind, localOnly);
        if (!symbol) {
            return undefined;
        }

        return symbol.context;
    }

    /**
     * Returns informations about a given symbol.
     *
     * @param symbol The name of a symbol or a symbol instance.
     *
     * @returns Details about this symbol if it can be found, otherwise undefined.
     */
    public async getSymbolInfo(symbol: string | Symbol): Promise<ISymbolInfo | undefined> {
        if (!(symbol instanceof Symbol)) {
            const temp = await this.resolve(symbol);
            if (!temp) {
                return undefined;
            }
            symbol = temp;
        }

        const kind = DBSymbolTable.getKindFromSymbol(symbol.constructor as typeof Symbol);

        return {
            kind,
            name: symbol.name,
            source: "Embedded",
            definition: this.definitionForContext(symbol.context, true),
            description: "description" in symbol ? symbol.description as string[] : undefined,
        };
    }

    /**
     * Returns the definition info for the given rule context.
     *
     * @param ctx The context for which to return the definition.
     * @param keepQuotes A flag that indicates if quote chars around string items.
     *
     * @returns The requested definition or undefined if the given context wasn't specified.
     */
    public definitionForContext(ctx: ParseTree | undefined, keepQuotes: boolean): ISymbolDefinition | undefined {
        if (!ctx) {
            return undefined;
        }

        const result: ISymbolDefinition = {
            text: "",
            span: { start: 0, length: 0 },
        };

        if (ctx instanceof ParserRuleContext) {
            const span = Interval.of(ctx.start.startIndex, ctx.stop!.stopIndex);

            result.span = { start: ctx.start.startIndex, length: ctx.stop!.stopIndex - ctx.stop!.startIndex + 1 };
            result.text = ctx.start.tokenSource?.inputStream?.getText(span) || "";
        } else if (ctx instanceof TerminalNode) {
            result.text = ctx.text;

            result.span = { start: ctx.symbol.startIndex, length: ctx.symbol.stopIndex - ctx.symbol.startIndex + 1 };
        }

        if (keepQuotes || result.text.length < 2) { return result; }

        const quoteChar = result.text[0];
        if ((quoteChar === '"' || quoteChar === "`" || quoteChar === "'") &&
            quoteChar === result.text[result.text.length - 1]) {
            result.text = result.text.substr(1, result.text.length - 2);
        }

        return result;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public loadSymbolsOfKind(parent: ScopedSymbol, kind: SymbolKind): Promise<Set<Symbol>> {
        return Promise.resolve(new Set());
    }

    /**
     * Finds and returns the first symbol of a given kind that can be found.
     *
     * @param name The name of the symbol to find.
     * @param kind Its kind.
     * @param localOnly If true only search in this table, otherwise also search in all references.
     *
     * @returns The found symbol or undefined.
     */
    private getSymbolOfKind(name: string, kind: SymbolKind, localOnly: boolean): Promise<Symbol | undefined> {
        if (kind === SymbolKind.Unknown) {
            return Promise.resolve(undefined);
        }

        return this.resolve(name, localOnly);
    }
}
