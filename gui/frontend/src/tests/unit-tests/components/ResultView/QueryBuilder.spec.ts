/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

import { DBDataType } from "../../../../app-logic/general-types.js";
import { QueryBuilder } from "../../../../components/ResultView/QueryBuilder.js";

describe("QueryBuilder", () => {
    const columns = [
        {
            title: "Column1",
            dataType: { type: DBDataType.Float },
            field: "Column1",
            inPK: true,
            nullable: false,
            autoIncrement: false,
        },
        {
            title: "Column2",
            dataType: { type: DBDataType.Text, needsQuotes: true },
            field: "Column2",
            inPK: false,
            nullable: false,
            autoIncrement: false,
        },
        {
            title: "Column3",
            dataType: { type: DBDataType.Boolean },
            field: "Column3",
            inPK: true,
            nullable: false,
            autoIncrement: false,
        },
    ];
    const values = [3.142, "Value2", true];

    it("Column Names", () => {
        const builder = new QueryBuilder("table1", columns, false);
        const columnNames = builder.columnNames;

        expect(columnNames).toEqual(["Column1", "Column2", "Column3"]);
    });

    it("Insert Statement", () => {
        const builder = new QueryBuilder("table1", columns, false);
        const statement = builder.generateInsertStatement(values);

        expect(statement).toBe("insert into table1 (Column1, Column2, Column3) values (3.142, 'Value2', true)");
    });

    it("Update Statement", () => {
        const builder = new QueryBuilder("table1", columns, true);
        const changedColumns = ["Column1", "Column3"];

        let statement = builder.generateUpdateStatement([3.142, true], changedColumns, [null, true]);
        expect(statement).toBe("UPDATE table1 SET Column1 = 0, Column3 = true WHERE (Column1 = 3.142) AND " +
            "(Column3 = true)");

        statement = builder.generateUpdateStatement([3.142, true], ["Column2"], ["Lorem Ipsum"]);
        expect(statement).toBe("UPDATE table1 SET Column2 = 'Lorem Ipsum' WHERE (Column1 = 3.142) AND " +
            "(Column3 = true)");
    });

    it("Delete Statement", () => {
        const builder = new QueryBuilder("table1", columns, false);
        const statement = builder.generateDeleteStatement(values);

        expect(statement).toBe("delete from table1 where (Column1 = 3.142) and (Column3 = Value2)");
    });
});
