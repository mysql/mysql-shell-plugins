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

import { ui } from "../app-logic/UILayer.js"

export interface IScriptDetails {
    /** The name of the script. */
    name: string;

    /** The sql of the script. */
    sql: string
};

/**
 * Creates a new snippet for a script based on the given type, resolving the name 
 * prompting to the user.
 *
 * @param type The type of script being created
 * @param schemaName The name of the schema where the script will be created.
 * @param placeHolder An initial name for the script
 */
export const resolveNewSqlScript = async (type: string, schemaName: string, placeHolder: string): Promise<IScriptDetails | undefined> => {
    let name: string | undefined = "";
    let sql = "";

    if (type ==="LibraryJs") {
        name = await ui.showInputBox(
            `New Library on Schema \`${schemaName}\``,
            placeHolder,
            "Please enter a name for the new library:",
        );
    } else {
        name = await ui.showInputBox(
            `New Routine on Schema \`${schemaName}\``,
            placeHolder,
            "Please enter a name for the new routine:",
        );
    }

    if (name === undefined) {
        return;
    }

    if (name === "") {
        name = placeHolder;
    }

    switch (type) {
        case "Procedure": {
            sql = `DELIMITER %%\nDROP PROCEDURE IF EXISTS \`${schemaName}\`.\`${name}\`%%\n`
                + `/* Add or remove procedure IN/OUT/INOUT parameters as needed. */\n`
                + `CREATE PROCEDURE \`${schemaName}\`.\`${name}\`(IN arg1 INTEGER, OUT arg2 INTEGER)\n`
                + `SQL SECURITY DEFINER\nNOT DETERMINISTIC\nBEGIN\n`
                + `    /* Insert the procedure code here. */\n    SET arg2 = arg1 * 2;\n`
                + `END%%\nDELIMITER ;\n\n`
                + `CALL \`${schemaName}\`.\`${name}\`(1, @arg2);\nSELECT @arg2;`;
            break;
        }

        case "Function": {
            sql = `DELIMITER %%\nDROP FUNCTION IF EXISTS \`${schemaName}\`.\`${name}\`%%\n`
                + `/* Add or remove function parameters as needed. */\n`
                + `CREATE FUNCTION \`${schemaName}\`.\`${name}\`(arg1 INTEGER)\nRETURNS INTEGER\n`
                + `SQL SECURITY DEFINER\nDETERMINISTIC\nBEGIN\n`
                + `    /* Insert the function code here. */\n    return arg1;\nEND%%\nDELIMITER ;`
                + `\n\nSELECT \`${schemaName}\`.\`${name}\`(1);`;
            break;
        }

        case "FunctionJs": {
            sql = `DROP FUNCTION IF EXISTS \`${schemaName}\`.\`${name}\`;\n`
                + `/* Add or remove function parameters as needed. */\n`
                + `CREATE FUNCTION \`${schemaName}\`.\`${name}\`(arg1 INTEGER)\n`
                + `RETURNS INTEGER\n`
                + `/* USING (\`${schemaName}\`.\`library1\` AS lib1, \`other_schema\`.\`library2\` AS lib2) */\n`
                + `SQL SECURITY DEFINER\n`
                + `DETERMINISTIC LANGUAGE JAVASCRIPT\nAS $$\n`
                + `    /* Insert the function code here. */\n`
                + `    console.log("Hello World!");\n`
                + `    console.log('{"info": "This is Javascript"}');\n`
                + `    /* console.log("Imported function: ", lib1.f()); */\n`
                + `    /* throw("Custom Error"); */\n`
                + `    return arg1;\n`
                + `$$;\n`
                + `SELECT \`${schemaName}\`.\`${name}\`(1);`;
            break;
        }

        case "LibraryJs": {
            sql = `DROP LIBRARY IF EXISTS \`${schemaName}\`.\`${name}\`;\n`
                + `CREATE LIBRARY \`${schemaName}\`.\`${name}\`\n`
                + `LANGUAGE JAVASCRIPT\nAS $$\n`
                + `    /* Insert the library code here. */\n`
                + `    export function f(x) {\n`
                + `        return x + 1;\n`
                + `    }\n`
                + `    export class MyRectangle {\n`
                + `        /* your class implementation */\n`
                + `    }\n`
                + `    export const myConst = 7;\n`
                + `$$;\n`;
            break;
        }

        case "ProcedureJs": {
            sql = `DROP PROCEDURE IF EXISTS \`${schemaName}\`.\`${name}\`;\n`
                + `/* Add or remove procedure parameters as needed. */\n`
                + `CREATE PROCEDURE \`${schemaName}\`.\`${name}\`(IN arg1 INTEGER, OUT arg2 INTEGER)\n`
                + `/* USING (\`${schemaName}\`.\`library1\` AS lib1, \`other_schema\`.\`library2\` AS lib2) */\n`
                + `DETERMINISTIC LANGUAGE JAVASCRIPT\nAS $$\n`
                + `    /* Insert the procedure code here. */\n`
                + `    console.log("Hello World!");\n`
                + `    const sql_query = session.prepare('SELECT ?');\n`
                + `    const query_result = sql_query.bind(arg1).execute().fetchOne();\n`
                + `    arg2 = query_result[0];\n`
                + `    /* console.log("Imported function: ", lib1.f()); */\n`
                + `$$;\n`
                + `CALL\`${schemaName}\`.\`${name}\`(42, @out);\n`
                + `SELECT @out;`;
            break;
        }

        default:
    }

    return {name, sql};
}