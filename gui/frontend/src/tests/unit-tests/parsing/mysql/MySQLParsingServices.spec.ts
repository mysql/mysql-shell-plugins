/*
 * Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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

import * as fs from "fs";

import { MySQLParsingServices } from "../../../../parsing/mysql/MySQLParsingServices.js";
import { MySQLParseUnit } from "../../../../parsing/mysql/MySQLServiceTypes.js";
import { StatementFinishState } from "../../../../parsing/parser-common.js";
import { checkStatementVersion, fail } from "../../test-helpers.js";

interface ITestFile {
    name: string;
    initialDelimiter: string;
}

interface IDollarQuoteTestEntry {
    title: string;
    data: string;
    delimiter?: string;
    expectedResult: string[];
    finishState: StatementFinishState[];
    version: number;
}

const services = MySQLParsingServices.instance;

const runParserTests = () => {
    const testFiles: ITestFile[] = [
        // Large set of all possible query types in different combinations and versions.
        { name: "./data/statements.txt", initialDelimiter: "$$" },

        // Not so many, but some very long insert statements.
        { name: "./data/sakila-db/sakila-data.sql", initialDelimiter: ";" },
    ];

    testFiles.forEach((entry) => {
        const sql = fs.readFileSync(entry.name, { encoding: "utf-8" });

        const ranges = services.determineStatementRanges(sql, entry.initialDelimiter, 80100);
        ranges.forEach((range, index) => {
            // The delimiter is considered part of the statement (e.g. for editing purposes)
            // but must be ignored for parsing.
            const end = range.span.start + range.span.length - (range.delimiter?.length ?? 0);
            const statement = sql.substring(range.span.start, end).trim();

            // The parser only supports syntax from 8.0 onwards. So we expect errors for older statements.
            const checkResult = checkStatementVersion(statement, 90200);
            if (checkResult.matched) {
                const result = services.errorCheck(checkResult.statement, MySQLParseUnit.Generic,
                    checkResult.version, "ANSI_QUOTES");
                if (!result) {
                    const errors = services.errorsWithOffset(0);
                    const error = errors[0];
                    fail(`This query failed to parse (${index}: ${checkResult.version}):\n${statement}\n` +
                        `with error: ${error.message}, line: ${error.line - 1}, column: ${error.offset}`);
                }
            } else {
                // Ignore all other statements. Since we don't check for versions below 8.0 in the grammar they
                // may unexpectedly succeed.
            }
        });
    });
};

describe("MySQL Parsing Services Tests", () => {

    it("Statement splitter test", () => {
        const data = fs.readFileSync("./data/sakila-db/sakila-data.sql", { encoding: "utf-8" });
        expect(data.length).toBe(3231413);

        let ranges = services.determineStatementRanges(data, ";", 80100);
        expect(ranges.length).toBe(57);

        const r1 = ranges[0];

        // A range includes all whitespaces/comments before it. The file starts with a copyright notice so all of it
        // is part of the first range.
        expect(r1.contentStart - r1.span.start).toBe(1533);
        const s1 = data.substring(r1.contentStart, r1.span.start + r1.span.length);
        expect(s1).toBe("SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;");

        const r2 = ranges[56];
        const s2 = data.substring(r2.contentStart, r2.span.start + r2.span.length);
        expect(s2).toBe("SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;");

        const statement = fs.readFileSync("./data/sakila-db/single_statement.sql", { encoding: "utf-8" });
        expect(statement.length).toBe(30349);

        const r3 = ranges[30];
        const s3 = data.substring(r3.contentStart, r3.span.start + r3.span.length);
        expect(s3).toBe(statement);

        const schema = fs.readFileSync("./data/sakila-db/sakila-schema.sql", { encoding: "utf-8" });
        expect(schema.length).toBe(23219);

        ranges = services.determineStatementRanges(schema, ";", 80100);
        expect(ranges.length).toBe(56);

        const r4 = ranges[43];
        const s4 = schema.substring(r4.contentStart, r4.span.start + r4.span.length);
        expect(r4.state).toBe(StatementFinishState.DelimiterChange);
        expect(s4).toBe("DELIMITER $$");
        expect(r4.delimiter).toBe("$$");
    });

    it("Parse a number of files with various statements (cold run)", () => {
        runParserTests();
    });

    /* Enable for measurement purposes. Doesn't add anything to the test suite.
    it("Parse a number of files with various statements (warm run)", () => {
        runParserTests();
    }); */
});

describe("MySQL Parsing Service test for dollar quote", () => {
    const queryStart = "CREATE PROCEDURE my_proc() DETERMINISTIC LANGUAGE JAVASCRIPT AS ";

    const testEntries: IDollarQuoteTestEntry[] = [{
        title: "Statement splitter for $$",
        data: queryStart + "$$ console.log('mle'); $$;",
        expectedResult: [queryStart + "$$ console.log('mle'); $$;"],
        finishState: [StatementFinishState.Complete],
        version: 80100,
    },
    {
        title: "Statement splitter for $string$",
        data: queryStart + "$mle$ console.log('mle'); $mle$;",
        expectedResult: [queryStart + "$mle$ console.log('mle'); $mle$;"],
        finishState: [StatementFinishState.Complete],
        version: 80100,
    },
    {
        title: "Statement splitter for $$ in the start and $string$ in the sql body",
        data: queryStart + "$$ console.log('mle $js$ $test$'); $$;",
        expectedResult: [queryStart + "$$ console.log('mle $js$ $test$'); $$;"],
        finishState: [StatementFinishState.Complete],
        version: 80100,
    },
    {
        title: "Statement splitter for $string$ in the start and $$ in the sql body",
        data: queryStart + "$mle$ console.log('mle $$'); $mle$;",
        expectedResult: [queryStart + "$mle$ console.log('mle $$'); $mle$;"],
        finishState: [StatementFinishState.Complete],
        version: 80100,
    },
    {
        title: "Statement splitter for $$ in start and $$ in the sql body",
        data: queryStart + "$$ console.log('$$'); $$;",
        expectedResult: [queryStart + "$$ console.log('$$'); $$;"],
        finishState: [StatementFinishState.OpenString],
        version: 80100,
    },
    {
        title: "Statement splitter for $string$ in the start and $string$ in the sql body are different",
        data: queryStart + "$mle$ console.log('mle $test$'); $mle$;",
        expectedResult: [queryStart + "$mle$ console.log('mle $test$'); $mle$;"],
        finishState: [StatementFinishState.Complete],
        version: 80100,
    },
    {
        title: "Statement splitter for $string$ in the start and $string$ in the end is different",
        data: queryStart + "$xyz$ console.log('mle'); $abc$;",
        expectedResult: [queryStart + "$xyz$ console.log('mle'); $abc$;"],
        finishState: [StatementFinishState.OpenString],
        version: 80100,
    },
    {
        title: "Statement splitter for $string$ in the start and $string$ in the sql body are same",
        data: queryStart + "$mle$ console.log('mle $mle$'); $mle$;",
        expectedResult: [queryStart + "$mle$ console.log('mle $mle$'); $mle$;"],
        finishState: [StatementFinishState.OpenString],
        version: 80100,
    },
    {
        title: "Statement splitter for $$ in start and no $$",
        data: queryStart + '$$ console.log("mle $$"); ;',
        expectedResult: [queryStart + '$$ console.log("mle $$"); ;'],
        finishState: [StatementFinishState.OpenString],
        version: 80100,
    },
    {
        title: `Statement splitter for " in start, sql body and in end`,
        data: `CREATE PROCEDURE my_proc() DETERMINISTIC LANGUAGE JAVASCRIPT AS " console.log('mle " "'); ";`,
        expectedResult: [queryStart + `" console.log('mle " "'); ";`],
        finishState: [StatementFinishState.Complete],
        version: 80100,
    },
    {
        title: "Statement splitter for $string in the start",
        data: queryStart + "$mle console.log('mle'); $mle$;",
        expectedResult: [queryStart + "$mle console.log('mle'); $mle$;"],
        finishState: [StatementFinishState.OpenString],
        version: 80100,
    },
    {
        title: "Statement splitter for $string in the start and delimiter in the body",
        data: queryStart + "$mle$ console.log('$mle$;'); $mle$;",
        expectedResult: [queryStart + "$mle$ console.log('$mle$;", "'); $mle$;"],
        finishState: [StatementFinishState.Complete, StatementFinishState.OpenString],
        version: 80100,
    },
    {
        title: "Statement splitter for $$, version 8.0",
        data: queryStart + "$$ console.log('mle'); $$;",
        expectedResult: [
            queryStart + "$$ console.log('mle');",
            "$$;",
        ],
        finishState: [StatementFinishState.Complete, StatementFinishState.Complete],
        version: 80000,
    },
    {
        title: "Statement splitter for $string$, version 8.0",
        data: queryStart + "$mle$ console.log('js'); $mle$;",
        expectedResult: [
            queryStart + "$mle$ console.log('js');",
            "$mle$;",
        ],
        finishState: [StatementFinishState.Complete, StatementFinishState.Complete],
        version: 80000,
    },
    {
        title: "Multiple statements mixed, version 9.2",
        delimiter: "$$",
        data: `
            select *, "ABC" into outfile with parameters '{ value: true}' fields empty as 'null'$$
            create library if not exists 'myLibrary' language 'typescript' as $TS$console.log("done");$TS$ $$
            create procedure 'myProc' () using ('myOtherLibrary' as MOL, 'lodash' lodash)$$\n`,
        expectedResult: [
            "select *, \"ABC\" into outfile with parameters '{ value: true}' fields empty as 'null'$$",
            "create library if not exists 'myLibrary' language 'typescript' as $TS$console.log(\"done\");$TS$ $$",
            "create procedure 'myProc' () using ('myOtherLibrary' as MOL, 'lodash' lodash)$$",
            "\n",
        ],
        finishState: [
            StatementFinishState.Complete,
            StatementFinishState.Complete,
            StatementFinishState.Complete,
            StatementFinishState.NoDelimiter,
        ],
        version: 90200,
    }];

    testEntries.forEach((entry) => {
        it(entry.title, () => {
            const data = entry.data;

            // Code to be measured check the number of statement ranges.
            const ranges = services.determineStatementRanges(data, entry.delimiter ?? ";", entry.version);
            expect(ranges.length).toBe(entry.expectedResult.length);

            ranges.forEach((range, index) => {
                if (range.state === StatementFinishState.Complete) {
                    const s = data.substring(range.contentStart, range.span.start + range.span.length);
                    expect(s).toBe(entry.expectedResult[index]);
                } else {
                    const s = data.substring(range.span.start, range.span.start + range.span.length);
                    expect(s).toBe(entry.expectedResult[index]);
                }
                expect(range.state).toBe(entry.finishState[index]);
            });
        });
    });
});
