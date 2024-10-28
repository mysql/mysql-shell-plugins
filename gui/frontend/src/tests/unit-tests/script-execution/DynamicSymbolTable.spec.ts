/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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

import { BaseSymbol, SymbolTable } from "antlr4-c3";

import {
    CharsetSymbol, CollationSymbol, ColumnSymbol, EngineSymbol, EventSymbol, ForeignKeySymbol, IndexSymbol,
    PluginSymbol, PrimaryKeySymbol, SchemaSymbol, StoredFunctionSymbol,
    StoredProcedureSymbol, SystemFunctionSymbol, SystemVariableSymbol, TableSymbol, TablespaceSymbol, TriggerSymbol,
    UdfSymbol, UserSymbol, UserVariableSymbol, ViewSymbol,
} from "../../../parsing/DBSymbolTable.js";
import { DynamicSymbolTable } from "../../../script-execution/DynamicSymbolTable.js";
import { RoutineType, ShellInterfaceDb } from "../../../supplement/ShellInterface/ShellInterfaceDb.js";
import { nextProcessTick } from "../test-helpers.js";

class MockShellInterfaceDb extends ShellInterfaceDb {
    public override async getCatalogObjects(type: string, _filter?: string): Promise<string[]> {
        await nextProcessTick();

        switch (type) {
            case "Schema": {
                return ["schema1", "schema2"];
            }

            case "Engine": {
                return ["engine1", "engine2"];
            }

            case "User Variable": {
                return ["userVariable1", "userVariable2"];
            }

            case "User": {
                return ["user1", "user2"];
            }

            case "Character Set": {
                return ["characterSet1", "characterSet2"];
            }

            case "Collation": {
                return ["collation1", "collation2"];
            }

            case "Plugin": {
                return ["plugin1", "plugin2"];
            }

            case "System Variable": {
                return ["sysVariable1", "sysVariable2"];
            }

            case "System Function": {
                return ["sysFunction1", "sysFunction2"];
            }

            default: {
                return [];
            }
        }
    }

    public override async getSchemaObjects(schema: string, type: string, routineType?: RoutineType,
        _filter?: string): Promise<string[]> {
        await nextProcessTick();

        switch (type) {
            case "Table": {
                return ["table1", "table2"];
            }

            case "Routine": {
                if (routineType === "function") {
                    return ["function1", "function2"];
                } else if (routineType === "procedure") {
                    return ["procedure1", "procedure2"];
                } else {
                    return ["udf1", "udf2"];
                }
            }

            case "View": {
                return ["view1", "view2"];
            }

            case "Trigger": {
                return ["trigger1", "trigger2"];
            }

            case "Tablespace": {
                return ["tablespace1", "tablespace2"];
            }

            case "Event": {
                return ["event1", "event2"];
            }

            default: {
                return [];
            }
        }
    }

    public override async getTableObjectNames(schema: string, table: string, type: string): Promise<string[]> {
        await nextProcessTick();
        switch (type) {
            case "Column": {
                return ["column1", "column2"];
            }

            case "Primary Key": {
                return ["primaryKey1", "primaryKey2"];
            }

            case "Foreign Key": {
                return ["foreignKey1", "foreignKey2"];
            }

            case "Index": {
                return ["index1", "index2"];
            }

            default: {
                return [];
            }
        }
    }
}

describe("DynamicSymbolTable Tests", () => {
    const symbolTable = new DynamicSymbolTable(new MockShellInterfaceDb(), "test", { allowDuplicateSymbols: true });

    // Add a dependency for the main symbol table to test the flow between the two too.
    const systemSymbolTable = new SymbolTable("system", { allowDuplicateSymbols: true });
    systemSymbolTable.addNewSymbolOfType(SystemVariableSymbol, undefined, "sysVariable1", []);
    systemSymbolTable.addNewSymbolOfType(SystemVariableSymbol, undefined, "sysVariable2", []);
    systemSymbolTable.addNewSymbolOfType(SystemFunctionSymbol, undefined, "sysFunction1", []);
    systemSymbolTable.addNewSymbolOfType(SystemFunctionSymbol, undefined, "sysFunction2", []);
    symbolTable.addDependencies(systemSymbolTable);

    let schema: SchemaSymbol;

    beforeAll(() => {
        schema = symbolTable.addNewSymbolOfType(SchemaSymbol, undefined, "sakila");
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const testSymbols = async <T extends BaseSymbol>(useSchema: boolean, t: new (...args: any[]) => T,
        names: string[]) => {
        const symbols = useSchema ? await schema.getAllSymbols(t) : await symbolTable.getAllSymbols(t);
        expect(symbols).toHaveLength(names.length);
        for (let i = 0; i < symbols.length; i++) {
            expect(symbols[i].name).toEqual(names[i]);
        }
    };

    it("Get symbols", async () => {
        // This first call will not use the mock shell interface, as we explicitly added a schema symbol.
        await testSymbols(false, SchemaSymbol, ["sakila"]);
        await testSymbols(false, EngineSymbol, ["engine1", "engine2"]);
        await testSymbols(false, UserVariableSymbol, ["userVariable1", "userVariable2"]);
        await testSymbols(false, UserSymbol, ["user1", "user2"]);
        await testSymbols(false, CharsetSymbol, ["characterSet1", "characterSet2"]);
        await testSymbols(false, CollationSymbol, ["collation1", "collation2"]);
        await testSymbols(false, PluginSymbol, ["plugin1", "plugin2"]);

        await testSymbols(false, TableSymbol, ["table1", "table2"]);
        await testSymbols(false, StoredProcedureSymbol, ["procedure1", "procedure2"]);
        await testSymbols(false, StoredFunctionSymbol, ["function1", "function2"]);
        await testSymbols(false, UdfSymbol, ["udf1", "udf2"]);
        await testSymbols(false, ViewSymbol, ["view1", "view2"]);
        await testSymbols(false, TriggerSymbol, ["trigger1", "trigger2"]);
        await testSymbols(false, TablespaceSymbol, ["tablespace1", "tablespace2"]);
        await testSymbols(false, EventSymbol, ["event1", "event2"]);

        await testSymbols(true, ColumnSymbol, ["column1", "column2"]);
        await testSymbols(true, PrimaryKeySymbol, ["primaryKey1", "primaryKey2"]);
        await testSymbols(true, ForeignKeySymbol, ["foreignKey1", "foreignKey2"]);
        await testSymbols(true, IndexSymbol, ["index1", "index2"]);

        await testSymbols(false, SystemVariableSymbol, ["sysVariable1", "sysVariable2"]);
        await testSymbols(false, SystemFunctionSymbol, ["sysFunction1", "sysFunction2"]);
    });
});
