/*
 * Copyright (c) 2023, 2025 Oracle and/or its affiliates.
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
 * separately licensed software that they have included with
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

import { expect } from "chai";
import { Key, until } from "vscode-extension-tester";
import clipboard from "clipboardy";
import { driver, Misc } from "../lib/Misc";
import { E2ENotebook } from "../lib/WebViews/E2ENotebook";
import { E2EAccordionSection } from "../lib/SideBar/E2EAccordionSection";
import { DatabaseConnectionOverview } from "../lib/WebViews/DatabaseConnectionOverview";
import { Os } from "../lib/Os";
import { Workbench } from "../lib/Workbench";
import * as constants from "../lib/constants";
import * as interfaces from "../lib/interfaces";
import * as locator from "../lib/locators";
import * as errors from "../lib/errors";
import { TestQueue } from "../lib/TestQueue";

describe("RESULT GRIDS", () => {

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: "e2eGlobalDBConnection",
        description: "Local connection",
        basic: {
            hostname: "localhost",
            username: String(process.env.DBUSERNAME2),
            port: parseInt(process.env.MYSQL_PORT, 10),
            schema: "sakila",
            password: String(process.env.DBPASSWORD2),
        },
    };
    const anotherConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: "e2eAnotherDBConnection",
        description: "Local connection",
        basic: {
            hostname: "localhost",
            username: String(process.env.DBUSERNAME1),
            port: parseInt(process.env.MYSQL_PORT, 10),
            schema: "sakila",
            password: String(process.env.DBPASSWORD1),
        },
    };

    const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
    const notebook = new E2ENotebook();

    before(async function () {
        await Misc.loadDriver();
        try {
            await driver.wait(Workbench.untilExtensionIsReady(), constants.wait1minute * 2);

            if (process.env.PARALLEL) {
                await driver.wait(Misc.untilSchemaExists(constants.restServiceMetadataSchema),
                    constants.wait1minute * 2);
            }

            await Workbench.toggleBottomBar(false);
            await dbTreeSection.createDatabaseConnection(globalConn);
            await dbTreeSection.createDatabaseConnection(anotherConn);
            await driver.wait(dbTreeSection.tree.untilExists(anotherConn.caption), constants.wait5seconds);
            await driver.wait(dbTreeSection.tree.untilExists(globalConn.caption), constants.wait5seconds);
            await (await new DatabaseConnectionOverview().getConnection(globalConn.caption)).click();
            await driver.wait(notebook.untilIsOpened(globalConn), constants.wait10seconds);
            await notebook.codeEditor.create();
            await dbTreeSection.focus();
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    after(async function () {
        try {
            await Os.prepareExtensionLogsForExport(process.env.TEST_SUITE);
            Misc.removeDatabaseConnections();
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    describe("MySQL", () => {

        let cleanEditor = false;
        let existsInQueue = false;

        before(async function () {
            try {
                await Workbench.toggleSideBar(false);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        beforeEach(async function () {
            await Os.appendToExtensionLog(String(this.currentTest.title) ?? process.env.TEST_SUITE);
        });

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                await Misc.processFailure(this);
                await notebook.codeEditor.loadCommandResults();
            }

            if (existsInQueue) {
                await TestQueue.pop(this.currentTest.title);
                existsInQueue = false;
            }

            if (cleanEditor) {
                await notebook.codeEditor.clean();
                cleanEditor = false;
            }
        });

        after(async function () {
            try {
                await Workbench.openMySQLShellForVSCode();
                const treeGlobalConn = await dbTreeSection.tree.getElement(globalConn.caption);
                await treeGlobalConn.collapse();
                await Workbench.closeAllEditors();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Verify mysql data types - integer columns", async () => {

            await Workbench.toggleSideBar(false);
            const result = await notebook.codeEditor.execute("SELECT * from sakila.all_data_types_ints;");
            expect(result.toolbar.status).to.match(/OK/);
            const row = 0;
            const smallIntField = await result.grid.getCellValue(row, "test_smallint");
            const mediumIntField = await result.grid.getCellValue(row, "test_mediumint");
            const intField = await result.grid.getCellValue(row, "test_integer");
            const bigIntField = await result.grid.getCellValue(row, "test_bigint");
            const decimalField = await result.grid.getCellValue(row, "test_decimal");
            const floatFIeld = await result.grid.getCellValue(row, "test_float");
            const doubleField = await result.grid.getCellValue(row, "test_double");
            const booleanCell = await result.grid.getCellValue(row, "test_boolean");

            expect(smallIntField, errors.incorrectCellValue("SMALLINT")).to.match(/(\d+)/);
            expect(mediumIntField, errors.incorrectCellValue("MEDIUMINT")).to.match(/(\d+)/);
            expect(intField, errors.incorrectCellValue("INT")).to.match(/(\d+)/);
            expect(bigIntField, errors.incorrectCellValue("BIGINT")).to.match(/(\d+)/);
            expect(decimalField, errors.incorrectCellValue("DECIMAL")).to.match(/(\d+).(\d+)/);
            expect(floatFIeld, errors.incorrectCellValue("FLOAT")).to.match(/(\d+).(\d+)/);
            expect(doubleField, errors.incorrectCellValue("DOUBLE")).to.match(/(\d+).(\d+)/);
            expect(booleanCell, "The cell should have a select list").to.match(/(true|false)/);

        });

        it("Verify mysql data types - date columns", async () => {
            const result = await notebook.codeEditor.execute("SELECT * from sakila.all_data_types_dates;");
            expect(result.toolbar.status).to.match(/OK/);

            const row = 0;
            const dateField = await result.grid.getCellValue(row, "test_date");
            const dateTimeField = await result.grid.getCellValue(row, "test_datetime");
            const timeStampField = await result.grid.getCellValue(row, "test_timestamp");
            const timeField = await result.grid.getCellValue(row, "test_time");
            const yearField = await result.grid.getCellValue(row, "test_year");

            expect(dateField, errors.incorrectCellValue("DATE")).to.match(/(\d+)\/(\d+)\/(\d+)/);
            expect(dateTimeField, errors.incorrectCellValue("DATETIME")).to.match(/(\d+)\/(\d+)\/(\d+)/);
            expect(timeStampField, errors.incorrectCellValue("TIMESTAMP")).to.match(/(\d+)\/(\d+)\/(\d+)/);
            expect(timeField, errors.incorrectCellValue("TIME")).to.match(/(\d+):(\d+):(\d+)/);
            expect(yearField, errors.incorrectCellValue("YEAR")).to.match(/(\d+)/);
        });

        it("Verify mysql data types - char columns", async () => {
            const result = await notebook.codeEditor.execute("SELECT * from sakila.all_data_types_chars;");
            expect(result.toolbar.status).to.match(/OK/);

            const row = 0;
            const charField = await result.grid.getCellValue(row, "test_char");
            const varCharField = await result.grid.getCellValue(row, "test_varchar");
            const tinyTextField = await result.grid.getCellValue(row, "test_tinytext");
            const textField = await result.grid.getCellValue(row, "test_text");
            const mediumTextField = await result.grid.getCellValue(row, "test_mediumtext");
            const longTextField = await result.grid.getCellValue(row, "test_longtext");
            const enumField = await result.grid.getCellValue(row, "test_enum");
            const setFIeld = await result.grid.getCellValue(row, "test_set");
            const jsonField = await result.grid.getCellValue(row, "test_json");

            expect(charField, errors.incorrectCellValue("CHAR")).to.match(/([a-z]|[A-Z])/);
            expect(varCharField, errors.incorrectCellValue("VARCHAR")).to.match(/([a-z]|[A-Z])/);
            expect(tinyTextField, errors.incorrectCellValue("TINYTEXT")).to.match(/([a-z]|[A-Z])/);
            expect(textField, errors.incorrectCellValue("TEXT")).to.match(/([a-z]|[A-Z])/);
            expect(mediumTextField, errors.incorrectCellValue("MEDIUMTEXT")).to.match(/([a-z]|[A-Z])/);
            expect(longTextField, errors.incorrectCellValue("LONGTEXT")).to.match(/([a-z]|[A-Z])/);
            expect(enumField, errors.incorrectCellValue("ENUM")).to.match(/([a-z]|[A-Z])/);
            expect(setFIeld, errors.incorrectCellValue("SET")).to.match(/([a-z]|[A-Z])/);
            expect(jsonField).to.match(/\{.*\}/);
        });

        it("Verify mysql data types - blob columns", async () => {
            const result = await notebook.codeEditor.execute("SELECT * from sakila.all_data_types_blobs;");
            expect(result.toolbar.status).to.match(/OK/);

            const row = 0;
            const binaryField = await result.grid.getCellValue(row, "test_binary");
            const varBinaryField = await result.grid.getCellValue(row, "test_varbinary");

            expect(await result.grid.getCellIconType(row, "test_tinyblob")).to.equals(constants.blob);
            expect(await result.grid.getCellIconType(row, "test_blob")).to.equals(constants.blob);
            expect(await result.grid.getCellIconType(row, "test_mediumblob")).to.equals(constants.blob);
            expect(await result.grid.getCellIconType(row, "test_longblob")).to.equals(constants.blob);
            expect(binaryField, errors.incorrectCellValue("BINARY")).to.match(/0x/);
            expect(varBinaryField, errors.incorrectCellValue("BINARY")).to.match(/0x/);
        });

        it("Verify mysql data types - geometry columns", async () => {
            const result = await notebook.codeEditor.execute("SELECT * from sakila.all_data_types_geometries;");
            expect(result.toolbar.status).to.match(/OK/);

            const row = 0;
            const bitCell = await result.grid.getCellValue(row, "test_bit");
            expect(await result.grid.getCellIconType(row, "test_point"), "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(await result.grid.getCellIconType(row, "test_linestring"),
                "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(await result.grid.getCellIconType(row, "test_polygon"), "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(await result.grid.getCellIconType(row, "test_multipoint"),
                "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(await result.grid.getCellIconType(row, "test_multilinestring"),
                "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(await result.grid.getCellIconType(row, "test_multipolygon"),
                "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(await result.grid.getCellIconType(row, "test_geometrycollection"),
                "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(bitCell, errors.incorrectCellValue("BIT")).to.match(/(\d+)/);
        });

        it("Edit a result grid, verify query preview and commit - integer columns", async () => {

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.all_data_types_ints;");
            expect(result.toolbar.status).to.match(/OK/);

            const booleanEdited = false;
            const smallIntEdited = "32761";
            const mediumIntEdited = "8388601";
            const intEdited = "2147483611";
            const bigIntEdited = "4294967291";
            const decimalEdited = "300.70509";
            const floatEdited = "10.767";
            const doubleEdited = "500.72123";

            const rowToEdit = 0;
            const cellsToEdit: interfaces.IResultGridCell[] = [
                { rowNumber: rowToEdit, columnName: "test_smallint", value: smallIntEdited },
                { rowNumber: rowToEdit, columnName: "test_mediumint", value: mediumIntEdited },
                { rowNumber: rowToEdit, columnName: "test_integer", value: intEdited },
                { rowNumber: rowToEdit, columnName: "test_bigint", value: bigIntEdited },
                { rowNumber: rowToEdit, columnName: "test_decimal", value: decimalEdited },
                { rowNumber: rowToEdit, columnName: "test_float", value: floatEdited },
                { rowNumber: rowToEdit, columnName: "test_double", value: doubleEdited },
                { rowNumber: rowToEdit, columnName: "test_boolean", value: booleanEdited },
            ];

            await result.grid.editCells(cellsToEdit, constants.doubleClick);
            const booleanField = booleanEdited ? 1 : 0;
            const expectedSqlPreview = [
                /UPDATE sakila.all_data_types_ints SET/,
                new RegExp(`test_smallint = ${smallIntEdited}`),
                new RegExp(`test_mediumint = ${mediumIntEdited}`),
                new RegExp(`test_integer = ${intEdited}`),
                new RegExp(`test_bigint = ${bigIntEdited}`),
                new RegExp(`test_decimal = ${decimalEdited}`),
                new RegExp(`test_float = ${floatEdited}`),
                new RegExp(`test_double = ${doubleEdited}`),
                new RegExp(`test_boolean = ${booleanField}`),
                /WHERE id = 1;/,
            ];

            await result.toolbar.selectSqlPreview();
            for (let i = 0; i <= expectedSqlPreview.length - 1; i++) {
                expect(result.preview.text).to.match(expectedSqlPreview[i]);
            }

            await result.clickSqlPreviewContent();
            await driver.wait(result.grid.untilRowIsHighlighted(rowToEdit), constants.wait5seconds);

            await result.toolbar.applyChanges();
            await driver.wait(result.toolbar.untilStatusMatches(/(\d+).*updated/), constants.wait5seconds);

            const result1 = await notebook.codeEditor.execute("select * from sakila.all_data_types_ints where id = 1;");
            expect(result1.toolbar.status).to.match(/OK/);
            const testBoolean = await result1.grid.getCellValue(rowToEdit, "test_boolean");
            expect(testBoolean, errors.incorrectCellValue("BOOLEAN")).to.equals(booleanEdited.toString());
            const testSmallInt = await result1.grid.getCellValue(rowToEdit, "test_smallint");
            expect(testSmallInt, errors.incorrectCellValue("SMALLINT")).to.equals(smallIntEdited);
            const testMediumInt = await result1.grid.getCellValue(rowToEdit, "test_mediumint");
            expect(testMediumInt, errors.incorrectCellValue("MEDIUMINT")).to.equals(mediumIntEdited);
            const testInteger = await result1.grid.getCellValue(rowToEdit, "test_integer");
            expect(testInteger, errors.incorrectCellValue("INT")).to.equals(intEdited);
            const testBigInt = await result1.grid.getCellValue(rowToEdit, "test_bigint");
            expect(testBigInt, errors.incorrectCellValue("BIGINT")).to.equals(bigIntEdited);
            const testDecimal = await result1.grid.getCellValue(rowToEdit, "test_decimal");
            expect(testDecimal, errors.incorrectCellValue("DECIMAL")).to.equals(decimalEdited);
            const testFloat = await result1.grid.getCellValue(rowToEdit, "test_float");
            expect(testFloat, errors.incorrectCellValue("FLOAT")).to.equals(floatEdited);
            const testDouble = await result1.grid.getCellValue(rowToEdit, "test_double");
            expect(testDouble, errors.incorrectCellValue("DOUBLE")).to.equals(doubleEdited);

        });

        it("Edit a result grid, verify query preview and commit - date columns", async () => {

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.all_data_types_dates;");
            expect(result.toolbar.status).to.match(/OK/);

            const dateEdited = "2024-01-01";
            const dateTimeEdited = "2024-01-01 15:00";
            const timeStampEdited = "2024-01-01 15:00";
            const timeEdited = "23:59";
            const yearEdited = "2030";

            const rowToEdit = 0;
            const cellsToEdit: interfaces.IResultGridCell[] = [
                { rowNumber: rowToEdit, columnName: "test_date", value: dateEdited },
                { rowNumber: rowToEdit, columnName: "test_datetime", value: dateTimeEdited },
                { rowNumber: rowToEdit, columnName: "test_timestamp", value: timeStampEdited },
                { rowNumber: rowToEdit, columnName: "test_time", value: timeEdited },
                { rowNumber: rowToEdit, columnName: "test_year", value: yearEdited },
            ];
            await result.grid.editCells(cellsToEdit, constants.doubleClick);
            const dateTimeToISO = Misc.convertDateToISO(dateTimeEdited);
            const timeStampToISO = Misc.convertDateToISO(timeStampEdited);
            const timeTransformed = Misc.convertTimeTo12H(timeEdited);

            const expectedSqlPreview = [
                /UPDATE sakila.all_data_types_dates SET/,
                new RegExp(`test_date = '${dateEdited}'`),
                new RegExp(`test_datetime = '(${dateTimeEdited}:00|${dateTimeToISO}:00)'`),
                new RegExp(`test_timestamp = '(${timeStampEdited}:00|${timeStampToISO}:00)'`),
                new RegExp(`test_time = '(${timeEdited}|${timeTransformed})'`),
                new RegExp(`test_year = ${yearEdited}`),
                /WHERE id = 1;/,
            ];

            await result.toolbar.selectSqlPreview();
            for (let i = 0; i <= expectedSqlPreview.length - 1; i++) {
                expect(result.preview.text).to.match(expectedSqlPreview[i]);
            }

            await result.clickSqlPreviewContent();
            await driver.wait(result.grid.untilRowIsHighlighted(rowToEdit), constants.wait5seconds);
            await result.toolbar.applyChanges();
            await driver.wait(result.toolbar.untilStatusMatches(/(\d+).*updated/), constants.wait5seconds);

            const result1 = await notebook.codeEditor
                .execute("select * from sakila.all_data_types_dates where id = 1;");
            expect(result1.toolbar.status).to.match(/OK/);

            const testDate = await result1.grid.getCellValue(rowToEdit, "test_date");
            expect(testDate, errors.incorrectCellValue("DATE")).to.equals("01/01/2024");
            const testDateTime = await result1.grid.getCellValue(rowToEdit, "test_datetime");
            expect(testDateTime, errors.incorrectCellValue("DATETIME")).to.equals("01/01/2024");
            const testTimeStamp = await result1.grid.getCellValue(rowToEdit, "test_timestamp");
            expect(testTimeStamp, errors.incorrectCellValue("TIMESTAMP")).to.equals("01/01/2024");
            const testTime = await result1.grid.getCellValue(rowToEdit, "test_time");
            const convertedTime = Misc.convertTimeTo12H(timeEdited);
            expect(testTime === `${timeEdited}:00` || testTime === convertedTime,
                errors.incorrectCellValue("TIME")).to.equals(true);
            const testYear = await result1.grid.getCellValue(rowToEdit, "test_year");
            expect(testYear, errors.incorrectCellValue("YEAR")).to.equals(yearEdited);

        });

        it("Edit a result grid, verify query preview and commit - char columns", async () => {

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.all_data_types_chars where id = 2;");
            expect(result.toolbar.status).to.match(/OK/);

            const charEdited = "test_char_edited";
            const varCharEdited = "test_varchar_edited";
            const tinyTextEdited = "test_tiny_edited";
            const textEdited = "test_text_edited";
            const textMediumEdited = "test_med_edited";
            const longTextEdited = "test_long_edited";
            const enumEdited = "value2_dummy_dummy_dummy";
            const setEdited = "value2_dummy_dummy_dummy";
            const jsonEdited = '{"test": "2"}';

            const rowToEdit = 0;
            const cellsToEdit: interfaces.IResultGridCell[] = [
                { rowNumber: rowToEdit, columnName: "test_char", value: charEdited },
                { rowNumber: rowToEdit, columnName: "test_varchar", value: varCharEdited },
                { rowNumber: rowToEdit, columnName: "test_tinytext", value: tinyTextEdited },
                { rowNumber: rowToEdit, columnName: "test_text", value: textEdited },
                { rowNumber: rowToEdit, columnName: "test_mediumtext", value: textMediumEdited },
                { rowNumber: rowToEdit, columnName: "test_longtext", value: longTextEdited },
                { rowNumber: rowToEdit, columnName: "test_enum", value: enumEdited },
                { rowNumber: rowToEdit, columnName: "test_set", value: setEdited },
                { rowNumber: rowToEdit, columnName: "test_json", value: jsonEdited },
            ];
            await result.grid.editCells(cellsToEdit, constants.doubleClick);

            const expectedSqlPreview = [
                /UPDATE sakila.all_data_types_chars SET/,
                new RegExp(`test_char = '${charEdited}'`),
                new RegExp(`test_varchar = '${varCharEdited}'`),
                new RegExp(`test_tinytext = '${tinyTextEdited}'`),
                new RegExp(`test_text = '${textEdited}'`),
                new RegExp(`test_mediumtext = '${textMediumEdited}'`),
                new RegExp(`test_longtext = '${longTextEdited}'`),
                new RegExp(`test_enum = '${enumEdited}'`),
                new RegExp(`test_set = '${setEdited}'`),
                Misc.transformToMatch(`test_json = '${jsonEdited}'`),
                /WHERE id = 2;/,
            ];

            await result.toolbar.selectSqlPreview();
            for (let i = 0; i <= expectedSqlPreview.length - 1; i++) {
                expect(result.preview.text).to.match(expectedSqlPreview[i]);
            }

            await result.clickSqlPreviewContent();
            await driver.wait(result.grid.untilRowIsHighlighted(rowToEdit), constants.wait5seconds);
            await result.toolbar.applyChanges();
            await driver.wait(result.toolbar.untilStatusMatches(/(\d+).*updated/), constants.wait5seconds);

            const result1 = await notebook.codeEditor
                .execute("select * from sakila.all_data_types_chars where id = 2;");
            expect(result1.toolbar.status).to.match(/OK/);
            const testChar = await result1.grid.getCellValue(rowToEdit, "test_char");
            expect(testChar, errors.incorrectCellValue("CHAR")).to.equals(charEdited);
            const testVarChar = await result1.grid.getCellValue(rowToEdit, "test_varchar");
            expect(testVarChar, errors.incorrectCellValue("VARCHAR")).to.equals(varCharEdited);
            const testTinyText = await result1.grid.getCellValue(rowToEdit, "test_tinytext");
            expect(testTinyText, errors.incorrectCellValue("TINYTEXT")).to.equals(tinyTextEdited);
            const testText = await result1.grid.getCellValue(rowToEdit, "test_text");
            expect(testText, errors.incorrectCellValue("TINYTEXT")).to.equals(textEdited);
            const testMediumText = await result1.grid.getCellValue(rowToEdit, "test_mediumtext");
            expect(testMediumText, errors.incorrectCellValue("MEDIUMTEXT")).to.equals(textMediumEdited);
            const testLongText = await result1.grid.getCellValue(rowToEdit, "test_longtext");
            expect(testLongText, errors.incorrectCellValue("LONGTEXT")).to.equals(longTextEdited);
            const testEnum = await result1.grid.getCellValue(rowToEdit, "test_enum");
            expect(testEnum, errors.incorrectCellValue("ENUM")).to.equals(enumEdited);
            const testSet = await result1.grid.getCellValue(rowToEdit, "test_set");
            expect(testSet, errors.incorrectCellValue("SET")).to.equals(setEdited);
            const testJson = await result1.grid.getCellValue(rowToEdit, "test_json");
            expect(testJson, errors.incorrectCellValue("JSON")).to.equals(jsonEdited);

        });

        it("Edit a result grid, verify query preview and commit - geometry columns", async () => {

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.all_data_types_geometries;");
            expect(result.toolbar.status).to.match(/OK/);

            const pointEdited = "ST_GeomFromText('POINT(1 2)')";
            const lineStringEdited = "ST_LineStringFromText('LINESTRING(0 0,1 1,2 1)')";
            const polygonEdited = "ST_GeomFromText('POLYGON((0 0,11 0,10 10,0 10,0 0),(5 5,7 5,7 7,5 7, 5 5))')";
            const multiPointEdited = "ST_GeomFromText('MULTIPOINT(0 1, 20 20, 60 60)')";
            const multiLineStrEdited = "ST_GeomFromText('MultiLineString((2 1,2 2,3 3),(4 4,5 5))')";
            const multiPoly = "ST_GeomFromText('MULTIPOLYGON(((0 0,11 0,12 11,0 9,0 0)),((3 5,7 4,4 7,7 7,3 5)))')";
            const geoCollEd = "ST_GeomFromText('GEOMETRYCOLLECTION(POINT(1 2),LINESTRING(0 0,1 1,2 2,3 3,4 4))')";
            const bitEdited = "11111111111111";
            const rowToEdit = 0;

            const cellsToEdit: interfaces.IResultGridCell[] = [
                { rowNumber: rowToEdit, columnName: "test_point", value: pointEdited },
                { rowNumber: rowToEdit, columnName: "test_bit", value: bitEdited },
                { rowNumber: rowToEdit, columnName: "test_linestring", value: lineStringEdited },
                { rowNumber: rowToEdit, columnName: "test_polygon", value: polygonEdited },
                { rowNumber: rowToEdit, columnName: "test_multipoint", value: multiPointEdited },
                { rowNumber: rowToEdit, columnName: "test_multilinestring", value: multiLineStrEdited },
                { rowNumber: rowToEdit, columnName: "test_multipolygon", value: multiPoly },
                { rowNumber: rowToEdit, columnName: "test_geometrycollection", value: geoCollEd },
            ];
            await result.grid.editCells(cellsToEdit, constants.doubleClick);

            const expectedSqlPreview = [
                /UPDATE sakila.all_data_types_geometries SET/,
                new RegExp(`test_bit = b'${bitEdited}'`),
                Misc.transformToMatch(`test_point = ${pointEdited}`),
                Misc.transformToMatch(`test_linestring = ${lineStringEdited}`),
                Misc.transformToMatch(`test_polygon = ${polygonEdited}`),
                Misc.transformToMatch(`test_multipoint = ${multiPointEdited}`),
                Misc.transformToMatch(`test_multilinestring = ${multiLineStrEdited}`),
                Misc.transformToMatch(`test_multipolygon = ${multiPoly}`),
                Misc.transformToMatch(`test_geometrycollection = ${geoCollEd}`),
                new RegExp(`WHERE id = 1;`),
            ];

            await result.toolbar.selectSqlPreview();
            for (let i = 0; i <= expectedSqlPreview.length - 1; i++) {
                expect(result.preview.text).to.match(expectedSqlPreview[i]);
            }

            await result.clickSqlPreviewContent();
            await driver.wait(result.grid.untilRowIsHighlighted(rowToEdit), constants.wait5seconds);
            await result.toolbar.applyChanges();
            await driver.wait(result.toolbar.untilStatusMatches(/(\d+).*updated/), constants.wait5seconds);

            const result1 = await notebook.codeEditor
                .execute("select * from sakila.all_data_types_geometries where id = 1;");
            expect(result1.toolbar.status).to.match(/OK/);

            const testPoint = await result1.grid.getCellValue(rowToEdit, "test_point");
            expect(testPoint, errors.incorrectCellValue("GEOMETRY")).to.equals(constants.geometry);
            const testLineString = await result1.grid.getCellValue(rowToEdit, "test_linestring");
            expect(testLineString, errors.incorrectCellValue("LINESTRING")).to.equals(constants.geometry);
            const testPolygon = await result1.grid.getCellValue(rowToEdit, "test_polygon");
            expect(testPolygon, errors.incorrectCellValue("POLYGON")).to.equals(constants.geometry);
            const testMultiPoint = await result1.grid.getCellValue(rowToEdit, "test_multipoint");
            expect(testMultiPoint, errors.incorrectCellValue("MULTIPOINT")).to.equals(constants.geometry);
            const testMultiLineString = await result1.grid.getCellValue(rowToEdit,
                "test_multilinestring");
            expect(testMultiLineString, errors.incorrectCellValue("MULTILINESTRING")).to.equals(constants.geometry);
            const testMultiPolygon = await result1.grid.getCellValue(rowToEdit,
                "test_multipolygon");
            expect(testMultiPolygon, errors.incorrectCellValue("MULTIPOLYGON")).to.equals(constants.geometry);
            const testGeomCollection = await result1.grid.getCellValue(rowToEdit,
                "test_geometrycollection");
            expect(testGeomCollection, errors.incorrectCellValue("GEOMCOLLECTION")).to.equals(constants.geometry);
            const testBit = await result.grid.getCellValue(rowToEdit, "test_bit");
            expect(testBit, errors.incorrectCellValue("BIT")).to.equals("16383");
        });

        it("Result grid context menu - Capitalize, Convert to lower, upper case and mark for deletion", async () => {

            await notebook.toolbar.editorSelector.selectEditor(new RegExp(constants.openEditorsDBNotebook),
                globalConn.caption);
            await Workbench.toggleSideBar(false);
            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.result_sets;");
            expect(result.toolbar.status).to.match(/OK/);
            const rowNumber = 0;
            const rowColumn = "text_field";

            const originalCellValue = await result.grid.getCellValue(rowNumber, rowColumn);
            await result.grid.openCellContextMenuAndSelect(0, rowColumn,
                constants.resultGridContextMenu.capitalizeText);
            await driver.wait(result.grid.untilCellsWereChanged(1), constants.wait5seconds);

            const capitalizedCellValue = await result.grid.getCellValue(rowNumber, rowColumn);
            expect(capitalizedCellValue,
                `The cell value was not capitalized`).to.equals(`${originalCellValue.charAt(0)
                    .toUpperCase()
                    }${originalCellValue.slice(1)}`);

            await result.grid.openCellContextMenuAndSelect(0, rowColumn,
                constants.resultGridContextMenu.convertTextToLowerCase);

            const lowerCaseCellValue = await result.grid.getCellValue(rowNumber, rowColumn);
            expect(lowerCaseCellValue, "The cell value was not converted to lower case")
                .to.equals(capitalizedCellValue.toLowerCase());

            await result.grid.openCellContextMenuAndSelect(0, rowColumn,
                constants.resultGridContextMenu.convertTextToUpperCase);

            const upperCaseCellValue = await result.grid.getCellValue(rowNumber, rowColumn);
            expect(upperCaseCellValue, "The cell value was not converted to upper case")
                .to.equals(lowerCaseCellValue.toUpperCase());

            await result.grid.openCellContextMenuAndSelect(0, rowColumn,
                constants.resultGridContextMenu.toggleForDeletion);
            await driver.wait(result.grid.untilRowIsMarkedForDeletion(rowNumber), constants.wait5seconds);
            await result.toolbar.rollbackChanges();
        });

        it("Result grid context menu - Copy single row", async function () {

            await TestQueue.push(this.test.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test.title), constants.queuePollTimeout);

            const result = await notebook.codeEditor.execute("select * from sakila.actor limit 1;");
            expect(result.toolbar.status).to.match(/OK/);

            const row = 0;
            const column = "first_name";

            // Copy row.
            await driver.wait(async () => {
                const copy = await result.grid.copyRow(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy row failed`);

            // Copy row with names.
            await driver.wait(async () => {
                const copy = await result.grid.copyRowWithNames(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy row with names failed`);

            // Copy row unquoted.
            await driver.wait(async () => {
                const copy = await result.grid.copyRowUnquoted(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy row unquoted failed`);

            // Copy row with names, unquoted.
            await driver.wait(async () => {
                const copy = await result.grid.copyRowWithNamesUnquoted(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy row with names, unquoted failed`);

            // Copy row with names, tab separated.
            await driver.wait(async () => {
                const copy = await result.grid.copyRowWithNamesTabSeparated(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy row with names, tab separated failed`);

            // Copy row, tab separated.
            await driver.wait(async () => {
                const copy = await result.grid.copyRowTabSeparated(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy row, tab separated failed`);

        });

        it("Result grid context menu - Copy multiple rows", async function () {

            await TestQueue.push(this.test.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test.title), constants.queuePollTimeout);

            const maxRows = 2;
            const result = await notebook.codeEditor
                .execute(`select * from sakila.actor limit ${maxRows};`);
            expect(result.toolbar.status).to.match(/OK/);

            const row = 0;
            const column = "first_name";

            // Copy all rows.
            await driver.wait(async () => {
                const copy = await result.grid.copyAllRows(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy all rows failed`);

            // Copy all rows with names.
            await driver.wait(async () => {
                const copy = await result.grid.copyAllRowsWithNames(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy all rows with names failed`);

            // Copy all rows unquoted.
            await driver.wait(async () => {
                const copy = await result.grid.copyAllRowsUnquoted(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy all rows unquoted failed`);

            // Copy all rows with names unquoted.
            await driver.wait(async () => {
                const copy = await result.grid.copyAllRowsWithNamesUnquoted(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy all rows with names unquoted failed`);

            // Copy all rows with names tab separated.
            await driver.wait(async () => {
                const copy = await result.grid.copyAllRowsWithNamesTabSeparated(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy all rows with names tab separated failed`);

        });

        it("Result grid context menu - Copy field, copy field unquoted, set field to null", async function () {

            await TestQueue.push(this.test.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test.title), constants.queuePollTimeout);

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.result_sets;");
            expect(result.toolbar.status).to.match(/OK/);

            const row = 0;
            const allColumns = Array.from(result.grid.columnsMap.keys());

            for (let i = 1; i <= allColumns.length - 1; i++) {

                await driver.wait(async () => {
                    const copy = await result.grid.copyField(row, String(allColumns[i]));
                    const clip = clipboard.readSync();

                    if (copy.toString().match(new RegExp(clip.toString()))) {
                        return true;
                    } else {
                        console.log(`expected: ${copy.toString()}. Got from clipboard: ${clip.toString()}`);
                    }
                }, constants.wait10seconds, "Copy field failed");

                await driver.wait(async () => {
                    const copy = await result.grid.copyFieldUnquoted(row, String(allColumns[i]));
                    const clip = clipboard.readSync();

                    if (copy.toString() === clip.toString()) {
                        return true;
                    } else {
                        console.log(`expected: ${copy.toString()}. Got from clipboard: ${clip.toString()}`);
                    }
                }, constants.wait10seconds, "Copy field unquoted failed");

                await result.grid.openCellContextMenuAndSelect(row, String(allColumns[i]),
                    constants.resultGridContextMenu.setFieldToNull);
                expect(await result.grid.getCellValue(row, String(allColumns[i])),
                    `Set field to null (${String(allColumns[i])})`)
                    .to.equals(constants.isNull);
            }

            await result.toolbar.rollbackChanges();

        });

        it("Select a Result Grid View", async () => {

            const result = await notebook.codeEditor.execute("select * from sakila.actor;");
            expect(result.toolbar.status).to.match(/OK/);
            await result.grid.editCells([{
                rowNumber: 0,
                columnName: "first_name",
                value: "changed",
            }], constants.doubleClick);

            await result.toolbar.selectView(constants.previewView);
            expect(result.preview).to.exist;
            await result.toolbar.selectView(constants.gridView);
            expect(result.preview).to.not.exist;
            expect(result.grid).to.exist;
            await result.toolbar?.rollbackChanges();

        });

        it("Edit a result grid using the keyboard", async () => {

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.result_sets;");
            expect(result.toolbar.status).to.match(/OK/);

            await result.grid.startFocus();
            await result.grid.editCells([
                { rowNumber: 0, columnName: "text_field", value: "edited" },
            ], constants.pressEnter);

            const refKey = Os.isMacOs() ? Key.COMMAND : Key.META;

            await driver.actions()
                .keyDown(refKey)
                .keyDown(Key.ALT)
                .pause(300)
                .keyDown(Key.ENTER)
                .keyUp(Key.ENTER)
                .keyUp(refKey)
                .keyUp(Key.ALT)
                .perform();

            await driver.wait(Workbench.untilNotificationExists("Changes committed successfully", true),
                constants.wait2seconds);

            await Misc.switchToFrame();
            await result.grid.startFocus();

            await result.grid.editCells([
                { rowNumber: 0, columnName: "int_field", value: "25" },
            ], constants.pressEnter);

            const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
            await textArea.sendKeys(Key.chord(refKey, Key.ALT, Key.ESCAPE));

            const confirmDialog = await driver.wait(Workbench.untilConfirmationDialogExists("for rollback"),
                constants.wait2seconds);
            await confirmDialog.findElement(locator.confirmDialog.accept).click();

        });

        it("Edit a result grid using the Start Editing button", async () => {

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.result_sets;");
            expect(result.toolbar.status).to.match(/OK/);

            await result.grid.editCells([
                { rowNumber: 0, columnName: "text_field", value: "other edited" },
                { rowNumber: 0, columnName: "int_field", value: "30" },
            ], constants.editButton);

            const refKey = Os.isMacOs() ? Key.COMMAND : Key.META;

            await driver.actions()
                .keyDown(refKey)
                .keyDown(Key.ALT)
                .pause(300)
                .keyDown(Key.ENTER)
                .keyUp(Key.ENTER)
                .keyUp(refKey)
                .keyUp(Key.ALT)
                .perform();

            await driver.wait(Workbench.untilNotificationExists("Changes committed successfully", true),
                constants.wait2seconds);

        });

        it("Result grid cell tooltips - integer columns", async () => {

            const rowNumber = 0;
            const tableColumns: string[] = [];

            await notebook.toolbar.editorSelector.selectEditor(new RegExp(constants.openEditorsDBNotebook),
                globalConn.caption);
            await Workbench.toggleSideBar(false);
            await notebook.codeEditor.clean();
            await notebook.codeEditor.execute("\\about");
            const result = await notebook.codeEditor.execute("SELECT * from sakila.all_data_types_ints limit 1;");
            expect(result.toolbar.status).to.match(/OK/);

            for (const key of result.grid.columnsMap.keys()) {
                tableColumns.push(key);
            }

            for (let i = 1; i <= tableColumns.length - 1; i++) {
                if (i === tableColumns.length - 1) {
                    await result.grid.reduceCellWidth(rowNumber, tableColumns[i], "js");
                } else {
                    await result.grid.reduceCellWidth(rowNumber, tableColumns[i]);
                }
                const cellText = await result.grid.getCellValue(rowNumber, tableColumns[i]);
                await driver.wait(result.grid.untilCellTooltipIs(rowNumber, tableColumns[i], cellText),
                    constants.wait3seconds);
            }

        });

        it("Result grid cell tooltips - date columns", async () => {

            const rowNumber = 0;
            await notebook.codeEditor.clean();
            await notebook.codeEditor.execute("\\about");
            const result = await notebook.codeEditor.execute("SELECT * from sakila.all_data_types_dates where id = 1;");
            expect(result.toolbar.status).to.match(/OK/);

            const tableColumns: string[] = [];
            for (const key of result.grid.columnsMap.keys()) {
                tableColumns.push(key);
            }

            for (let i = 1; i <= tableColumns.length - 1; i++) {
                if (i === tableColumns.length - 1) {
                    await result.grid.reduceCellWidth(rowNumber, tableColumns[i], "js");
                } else {
                    await result.grid.reduceCellWidth(rowNumber, tableColumns[i]);
                }

                const cellText = await result.grid.getCellValue(rowNumber, tableColumns[i]);
                await driver.wait(result.grid.untilCellTooltipIs(rowNumber, tableColumns[i], cellText),
                    constants.wait3seconds);
            }

        });

        it("Result grid cell tooltips - char columns", async () => {

            const rowNumber = 0;
            await notebook.codeEditor.clean();
            await notebook.codeEditor.execute("\\about");
            const result = await notebook.codeEditor.execute("SELECT * from sakila.all_data_types_chars where id = 1;");
            expect(result.toolbar.status).to.match(/OK/);

            const tableColumns: string[] = [];
            for (const key of result.grid.columnsMap.keys()) {
                tableColumns.push(key);
            }

            for (let i = 1; i <= tableColumns.length - 1; i++) {
                await result.grid.reduceCellWidth(rowNumber, tableColumns[i]);

                const cellText = await result.grid.getCellValue(rowNumber, tableColumns[i]);
                await driver.wait(result.grid.untilCellTooltipIs(rowNumber, tableColumns[i], cellText),
                    constants.wait3seconds);
            }

        });

        it("Result grid cell tooltips - binary and varbinary columns", async () => {

            const rowNumber = 0;
            await notebook.codeEditor.clean();
            await notebook.codeEditor.execute("\\about");
            const result = await notebook.codeEditor.execute("SELECT * from sakila.all_data_types_blobs limit 1;");
            expect(result.toolbar.status).to.match(/OK/);

            const tableColumns: string[] = [];
            for (const key of result.grid.columnsMap.keys()) {
                tableColumns.push(key);
            }

            for (let i = 5; i <= tableColumns.length - 1; i++) {
                if (i === tableColumns.length - 1) {
                    await result.grid.reduceCellWidth(rowNumber, tableColumns[i], "js");
                } else {
                    await result.grid.reduceCellWidth(rowNumber, tableColumns[i]);
                }

                const cellText = await result.grid.getCellValue(rowNumber, tableColumns[i]);
                await driver.wait(result.grid.untilCellTooltipIs(rowNumber, tableColumns[i], cellText),
                    constants.wait3seconds);

            }

        });

        it("Result grid cell tooltips - bit column", async () => {

            const rowNumber = 0;
            await notebook.codeEditor.clean();
            await notebook.codeEditor.execute("\\about");
            const result = await notebook.codeEditor.execute("SELECT * from sakila.all_data_types_geometries;");
            expect(result.toolbar.status).to.match(/OK/);

            const column = "test_bit";
            await result.grid.reduceCellWidth(rowNumber, column);
            const cellText = await result.grid.getCellValue(rowNumber, column);
            await driver.wait(result.grid.untilCellTooltipIs(rowNumber, column, cellText), constants.wait3seconds);

        });

        it("Edit a result grid and rollback", async () => {
            const modifiedText = "56";
            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.all_data_types_ints;");
            expect(result.toolbar.status).to.match(/OK/);
            await result.grid.editCells(
                [{
                    rowNumber: 0,
                    columnName: "test_integer",
                    value: modifiedText,
                }], constants.doubleClick);

            await result.toolbar.rollbackChanges();
            expect((await result.grid.content.getAttribute("innerHTML")).match(/rollbackTest/) === null,
                `${modifiedText} should not exist on the cell`).to.be.true;

        });

        it("Verify not editable result grids", async () => {

            const queries = [
                "select count(address_id) from sakila.address GROUP by city_id having count(address_id) > 0;",
                "SELECT actor_id FROM sakila.actor INNER JOIN sakila.address ON actor.actor_id = address.address_id;",
                "select first_name from sakila.actor UNION SELECT address_id from sakila.address;",
                "select actor_id from sakila.actor INTERSECT select address_id from sakila.address;",
                "select first_name from sakila.actor EXCEPT select address from sakila.address;",
                "SELECT COUNT(*) FROM DUAL;",
                `select * from sakila.actor where actor_id =
                                (select address_id from sakila.address where address_id = 1) for update;`,
                "select (actor_id*2), first_name as calculated from sakila.actor;",
            ];
            await notebook.codeEditor.clean();
            for (const query of queries) {
                const result = await notebook.codeEditor.execute(query);
                expect(result.toolbar.status).to.match(/OK/);
                const editBtn = await result.toolbar.getEditButton();
                expect(await editBtn.getAttribute("data-tooltip"),
                    `'${query}' should not be editable`).to.equal("Data not editable");
            }

        });

        it("Add new row on result grid - integer columns", async () => {

            await Workbench.toggleSideBar(false);
            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.all_data_types_ints;");
            expect(result.toolbar.status).to.match(/OK/);
            const booleanEdited = true;
            const smallIntEdited = "32761";
            const mediumIntEdited = "8388601";
            const intEdited = "3";
            const bigIntEdited = "4294967291";
            const decimalEdited = "1.12345";
            const floatEdited = "10.767";
            const doubleEdited = "5.72";

            const rowToAdd: interfaces.IResultGridCell[] = [
                { columnName: "test_smallint", value: smallIntEdited },
                { columnName: "test_mediumint", value: mediumIntEdited },
                { columnName: "test_integer", value: intEdited },
                { columnName: "test_bigint", value: bigIntEdited },
                { columnName: "test_decimal", value: decimalEdited },
                { columnName: "test_float", value: floatEdited },
                { columnName: "test_double", value: doubleEdited },
                { columnName: "test_boolean", value: booleanEdited },
            ];

            await result.grid.addRow(rowToAdd);
            await result.toolbar.applyChanges();

            await driver.wait(result.toolbar.untilStatusMatches(/(\d+).*updated/), constants.wait5seconds);
            const result1 = await notebook.codeEditor
                // eslint-disable-next-line max-len
                .execute("select * from sakila.all_data_types_ints where id = (select max(id) from sakila.all_data_types_ints);");
            expect(result1.toolbar.status).to.match(/OK/);

            const row = 0;

            const testBoolean = await result1.grid.getCellValue(row, "test_boolean");
            expect(testBoolean, errors.incorrectCellValue("BOOLEAN")).to.equals(booleanEdited.toString());
            const testSmallInt = await result1.grid.getCellValue(row, "test_smallint");
            expect(testSmallInt, errors.incorrectCellValue("SMALLINT")).to.equals(smallIntEdited);
            const testMediumInt = await result1.grid.getCellValue(row, "test_mediumint");
            expect(testMediumInt, errors.incorrectCellValue("MEDIUMINT")).to.equals(mediumIntEdited);
            const testInteger = await result1.grid.getCellValue(row, "test_integer");
            expect(testInteger, errors.incorrectCellValue("INT")).to.equals(intEdited);
            const testBigInt = await result1.grid.getCellValue(row, "test_bigint");
            expect(testBigInt, errors.incorrectCellValue("BIGINT")).to.equals(bigIntEdited);
            const testDecimal = await result1.grid.getCellValue(row, "test_decimal");
            expect(testDecimal, errors.incorrectCellValue("DECIMAL")).to.equals(decimalEdited);
            const testFloat = await result1.grid.getCellValue(row, "test_float");
            expect(testFloat, errors.incorrectCellValue("FLOAT")).to.equals(floatEdited);
            const testDouble = await result1.grid.getCellValue(row, "test_double");
            expect(testDouble, errors.incorrectCellValue("DOUBLE")).to.equals(doubleEdited);

        });

        it("Add new row on result grid - date columns", async () => {

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.all_data_types_dates;");
            expect(result.toolbar.status).to.match(/OK/);
            const dateEdited = "2024-01-01";
            const dateTimeEdited = "2024-01-01 15:00";
            const timeStampEdited = "2024-01-01 15:00";
            const timeEdited = "23:59";
            const yearEdited = "2024";

            const rowToAdd: interfaces.IResultGridCell[] = [
                { columnName: "test_date", value: dateEdited },
                { columnName: "test_datetime", value: dateTimeEdited },
                { columnName: "test_timestamp", value: timeStampEdited },
                { columnName: "test_time", value: timeEdited },
                { columnName: "test_year", value: yearEdited },
            ];

            await result.grid.addRow(rowToAdd);
            await result.toolbar.applyChanges();
            await driver.wait(result.toolbar.untilStatusMatches(/(\d+).*updated/), constants.wait5seconds);

            const result1 = await notebook.codeEditor
                // eslint-disable-next-line max-len
                .execute("select * from sakila.all_data_types_dates where id = (select max(id) from sakila.all_data_types_dates);");
            expect(result1.toolbar.status).to.match(/OK/);
            const row = 0;
            const testDate = await result1.grid.getCellValue(row, "test_date");
            expect(testDate, errors.incorrectCellValue("DATE")).to.equals("01/01/2024");
            const testDateTime = await result1.grid.getCellValue(row, "test_datetime");
            expect(testDateTime, errors.incorrectCellValue("DATETIME")).to.equals("01/01/2024");
            const testTimeStamp = await result1.grid.getCellValue(row, "test_timestamp");
            expect(testTimeStamp, errors.incorrectCellValue("TIMESTAMP")).to.equals("01/01/2024");
            const testTime = await result1.grid.getCellValue(row, "test_time");
            const convertedTime = Misc.convertTimeTo12H(timeEdited);
            expect(testTime === `${timeEdited}:00` || testTime === convertedTime,
                errors.incorrectCellValue("TIME")).to.equals(true);
            const testYear = await result1.grid.getCellValue(row, "test_year");
            expect(testYear, errors.incorrectCellValue("YEAR")).to.equals(yearEdited);

        });

        it("Add new row on result grid - char columns", async () => {

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.all_data_types_chars;");
            expect(result.toolbar.status).to.match(/OK/);

            const charEdited = "test_char_edited";
            const varCharEdited = "test_varchar_edited";
            const tinyTextEdited = "test_tiny_edited";
            const textEdited = "test_text_edited";
            const textMediumEdited = "test_med_edited";
            const longTextEdited = "test_long_edited";
            const enumEdited = "value4_dummy_dummy_dummy";
            const setEdited = "value4_dummy_dummy_dummy";
            const jsonEdited = '{"test": "2"}';

            const rowToAdd: interfaces.IResultGridCell[] = [
                { columnName: "test_char", value: charEdited },
                { columnName: "test_varchar", value: varCharEdited },
                { columnName: "test_tinytext", value: tinyTextEdited },
                { columnName: "test_text", value: textEdited },
                { columnName: "test_mediumtext", value: textMediumEdited },
                { columnName: "test_longtext", value: longTextEdited },
                { columnName: "test_enum", value: enumEdited },
                { columnName: "test_set", value: setEdited },
                { columnName: "test_json", value: jsonEdited },
            ];

            await result.grid.addRow(rowToAdd);
            await result.toolbar.applyChanges();

            await driver.wait(result.toolbar.untilStatusMatches(/(\d+).*updated/), constants.wait5seconds);
            const result1 = await notebook.codeEditor
                // eslint-disable-next-line max-len
                .execute("select * from sakila.all_data_types_chars where id = (select max(id) from sakila.all_data_types_chars);");
            expect(result1.toolbar.status).to.match(/OK/);

            const row = 0;
            const testChar = await result1.grid.getCellValue(row, "test_char");
            expect(testChar, errors.incorrectCellValue("CHAR")).to.equals(charEdited);
            const testVarChar = await result1.grid.getCellValue(row, "test_varchar");
            expect(testVarChar, errors.incorrectCellValue("VARCHAR")).to.equals(varCharEdited);
            const testTinyText = await result1.grid.getCellValue(row, "test_tinytext");
            expect(testTinyText, errors.incorrectCellValue("TINYTEXT")).to.equals(tinyTextEdited);
            const testText = await result1.grid.getCellValue(row, "test_text");
            expect(testText, errors.incorrectCellValue("TINYTEXT")).to.equals(textEdited);
            const testMediumText = await result1.grid.getCellValue(row, "test_mediumtext");
            expect(testMediumText, errors.incorrectCellValue("MEDIUMTEXT")).to.equals(textMediumEdited);
            const testLongText = await result1.grid.getCellValue(row, "test_longtext");
            expect(testLongText, errors.incorrectCellValue("LONGTEXT")).to.equals(longTextEdited);
            const testEnum = await result1.grid.getCellValue(row, "test_enum");
            expect(testEnum, errors.incorrectCellValue("ENUM")).to.equals(enumEdited);
            const testSet = await result1.grid.getCellValue(row, "test_set");
            expect(testSet, errors.incorrectCellValue("SET")).to.equals(setEdited);
            const testJson = await result1.grid.getCellValue(row, "test_json");
            expect(testJson, errors.incorrectCellValue("JSON")).to.equals(jsonEdited);

        });

        it("Add new row on result grid - geometry columns", async () => {

            await notebook.codeEditor.clean();
            let result = await notebook.codeEditor.execute("select * from sakila.all_data_types_geometries;");
            expect(result.toolbar.status).to.match(/OK/);

            const pointEdited = "ST_GeomFromText('POINT(1 2)')";
            const lineStringEdited = "ST_LineStringFromText('LINESTRING(0 0,1 1,2 1)')";
            const polygonEdited = "ST_GeomFromText('POLYGON((0 0,11 0,10 10,0 10,0 0),(5 5,7 5,7 7,5 7, 5 5))')";
            const multiPointEdited = "ST_GeomFromText('MULTIPOINT(0 1, 20 20, 60 60)')";
            const multiLineStrEdited = "ST_GeomFromText('MultiLineString((2 1,2 2,3 3),(4 4,5 5))')";
            const multiPolyEd = "ST_GeomFromText('MULTIPOLYGON(((0 0,11 0,12 11,0 9,0 0)),((3 5,7 4,4 7,7 7,3 5)))')";
            const geoCollEdited = "ST_GeomFromText('GEOMETRYCOLLECTION(POINT(1 2),LINESTRING(0 0,1 1,2 2,3 3,4 4))')";
            const bitEdited = "11111011111111";

            const rowToAdd: interfaces.IResultGridCell[] = [
                { columnName: "test_bit", value: bitEdited },
                { columnName: "test_point", value: pointEdited },
                { columnName: "test_linestring", value: lineStringEdited },
                { columnName: "test_polygon", value: polygonEdited },
                { columnName: "test_multipoint", value: multiPointEdited },
                { columnName: "test_multilinestring", value: multiLineStrEdited },
                { columnName: "test_multipolygon", value: multiPolyEd },
                { columnName: "test_geometrycollection", value: geoCollEdited },
            ];

            await result.grid.addRow(rowToAdd);
            await result.toolbar.applyChanges();

            await driver.wait(result.toolbar.untilStatusMatches(/(\d+).*updated/), constants.wait5seconds);
            result = await notebook.codeEditor
                // eslint-disable-next-line max-len
                .execute("select * from sakila.all_data_types_geometries where id = (select max(id) from sakila.all_data_types_geometries);");
            expect(result.toolbar.status).to.match(/OK/);
            const row = 0;
            const testPoint = await result.grid.getCellValue(row, "test_point");
            expect(testPoint, errors.incorrectCellValue("GEOMETRY")).to.equals(constants.geometry);
            const testLineString = await result.grid.getCellValue(row, "test_linestring");
            expect(testLineString, errors.incorrectCellValue("LINESTRING")).to.equals(constants.geometry);
            const testPolygon = await result.grid.getCellValue(row, "test_polygon");
            expect(testPolygon, errors.incorrectCellValue("POLYGON")).to.equals(constants.geometry);
            const testMultiPoint = await result.grid.getCellValue(row, "test_multipoint");
            expect(testMultiPoint, errors.incorrectCellValue("MULTIPOINT")).to.equals(constants.geometry);
            const testMultiLineString = await result.grid.getCellValue(row, "test_multilinestring");
            expect(testMultiLineString, errors.incorrectCellValue("MULTILINESTRING")).to.equals(constants.geometry);
            const testMultiPolygon = await result.grid.getCellValue(row, "test_multipolygon");
            expect(testMultiPolygon, errors.incorrectCellValue("MULTIPOLYGON")).to.equals(constants.geometry);
            const testGeomCollection = await result.grid.getCellValue(row, "test_geometrycollection");
            expect(testGeomCollection, errors.incorrectCellValue("GEOMCOLLECTION")).to.equals(constants.geometry);
            const testBit = await result.grid.getCellValue(row, "test_bit");
            expect(testBit, errors.incorrectCellValue("BIT")).to.equals("16127");

        });

        it("Close a result set", async () => {

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.actor limit 1;");
            expect(result.toolbar.status).to.match(/OK/);

            const id = result.id;
            await result.toolbar.closeResultSet();

            await driver.wait(async () => {
                return (await driver.findElements(locator.notebook.codeEditor.editor.result.existsById(id)))
                    .length === 0;
            }, constants.wait5seconds, `The result set was not closed`);
            await notebook.codeEditor.clean();

        });

        it("Unsaved changes dialog on result grid", async () => {

            await Workbench.openMySQLShellForVSCode();
            const openEditorsSection = new E2EAccordionSection(constants.openEditorsTreeSection);
            await openEditorsSection.expand();
            await Workbench.dismissNotifications();
            const openEditorsGlobalConn = await openEditorsSection.tree.getElement(globalConn.caption);
            await (await openEditorsGlobalConn.getActionButton(constants.newMySQLScript)).click();
            const anotherConnection = await dbTreeSection.tree
                .getElement(anotherConn.caption);
            await dbTreeSection.tree.openContextMenuAndSelect(anotherConnection, constants.openNewConnection);
            const anotherConnNotebook = new E2ENotebook();
            await driver.wait(anotherConnNotebook.untilIsOpened(anotherConn), constants.wait5seconds);
            const treeConn = await dbTreeSection.tree.getElement(globalConn.caption);
            await dbTreeSection.tree.expandDatabaseConnection(treeConn,
                (globalConn.basic as interfaces.IConnBasicMySQL).password);
            await dbTreeSection.tree.expandElement([new RegExp(constants.mysqlAdmin)]);
            await notebook.toolbar.editorSelector.selectEditor(new RegExp(constants.openEditorsDBNotebook),
                globalConn.caption);
            await driver.wait(anotherConnNotebook.untilIsOpened(anotherConn), constants.wait5seconds);
            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor
                .execute("select * from sakila.all_data_types_ints where id = 1;",
                    (parseInt(notebook.codeEditor.resultIds[notebook.codeEditor.resultIds.length - 1],
                        10) - 2) as unknown as string);
            expect(result.toolbar.status).to.match(/OK/);
            const cellsToEdit: interfaces.IResultGridCell[] = [
                {
                    rowNumber: 0,
                    columnName: "test_smallint",
                    value: "32751",
                }];
            await result.grid.editCells(cellsToEdit, constants.doubleClick);

            await (await dbTreeSection.tree.getElement(constants.serverStatus)).click();
            let dialog = await driver
                .wait(Workbench.untilConfirmationDialogExists(" after switching to Server Status page")
                    , constants.wait5seconds);
            expect(await (await dialog.findElement(locator.confirmDialog.msg))
                .getText())
                .to.match(/is currently being edited, do you want to commit or rollback the changes before continuing/);
            await dialog.findElement(locator.confirmDialog.cancel).click();
            await driver.wait(until.stalenessOf(dialog), constants.wait3seconds, "The dialog was not closed");
            await driver.wait(Workbench.untilCurrentEditorIs(new RegExp(constants.openEditorsDBNotebook)),
                constants.wait5seconds);
            await (await dbTreeSection.tree.getElement(constants.clientConns)).click();
            dialog = await driver.wait(Workbench
                .untilConfirmationDialogExists(" after switching to Client Connections page"), constants.wait5seconds);
            expect(await (await dialog.findElement(locator.confirmDialog.msg))
                .getText())
                .to.match(/is currently being edited, do you want to commit or rollback the changes before continuing/);
            await dialog.findElement(locator.confirmDialog.cancel).click();
            await driver.wait(until.stalenessOf(dialog), constants.wait3seconds, "The dialog was not closed");
            await driver.wait(Workbench.untilCurrentEditorIs(new RegExp(constants.openEditorsDBNotebook)),
                constants.wait5seconds);

            await (await dbTreeSection.tree.getElement(constants.perfDash)).click();
            dialog = await driver.wait(Workbench
                .untilConfirmationDialogExists(" after switching to Performance Dashboard page"),
                constants.wait5seconds);
            expect(await (await dialog.findElement(locator.confirmDialog.msg))
                .getText())
                .to.match(/is currently being edited, do you want to commit or rollback the changes before continuing/);
            await dialog.findElement(locator.confirmDialog.cancel).click();
            await driver.wait(until.stalenessOf(dialog), constants.wait3seconds, "The dialog was not closed");
            await driver.wait(Workbench.untilCurrentEditorIs(new RegExp(constants.openEditorsDBNotebook)),
                constants.wait5seconds);

            await notebook.toolbar.editorSelector.selectEditor(/DB Connection Overview/);
            dialog = await driver.wait(Workbench
                .untilConfirmationDialogExists(" after switching to DB Connections Overview page"),
                constants.wait5seconds);
            expect(await (await dialog.findElement(locator.confirmDialog.msg))
                .getText())
                .to.match(/is currently being edited, do you want to commit or rollback the changes before continuing/);
            await dialog.findElement(locator.confirmDialog.cancel).click();
            await driver.wait(until.stalenessOf(dialog), constants.wait3seconds, "The dialog was not closed");

            await notebook.toolbar.editorSelector.selectEditor(/Untitled-(\d+)/, globalConn.caption);
            dialog = await driver.wait(Workbench.untilConfirmationDialogExists(" after switching to a script page"),
                constants.wait5seconds);
            expect(await (await dialog.findElement(locator.confirmDialog.msg))
                .getText())
                .to.match(/is currently being edited, do you want to commit or rollback the changes before continuing/);
            await dialog.findElement(locator.confirmDialog.refuse).click();
            await driver.wait(until.stalenessOf(dialog), constants.wait3seconds, "The dialog was not closed");

        });

    });

});
