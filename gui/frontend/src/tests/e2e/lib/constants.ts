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

// TIMEOUTS
export const wait1second = 1000;
export const wait2seconds = 2000;
export const wait3seconds = 3000;
export const wait5seconds = 5000;
export const wait10seconds = 10000;
export const wait15seconds = 15000;
export const wait20seconds = 20000;
export const wait150MilliSeconds = 150;
export const wait250seconds = 250000;

// BUTTONS
export const execCaret = "Execute the statement at the caret position";
export const execFullBlockJs = "Execute everything in the current block and create a new block";
export const execFullBlockSql = "Execute the selection or everything in the current block and create a new block";
export const execAsText = "Execute the block and print the result as text";
export const execFullScript = "Execute full script";
export const autoCommit = "Auto commit DB changes";
export const rollback = "Rollback DB changes";
export const commit = "Commit DB changes";
export const saveNotebook = "Save this Notebook";

// RESULT GRID CONTEXT MENU
export const resultGridContextMenu = {
    capitalizeText: "Capitalize Text",
    convertTextToLowerCase: "Covert Text to Lower Case",
    convertTextToUpperCase: "Covert Text to Upper Case",
    toggleForDeletion: "Toggle Row Deletion Mark",
    copySingleRow: "Copy Single Row",
    copySingleRowContextMenu: {
        copyRow: "Copy Row",
        copyRowWithNames: "Copy Row With Names",
        copyRowUnquoted: "Copy Row Unquoted",
        copyRowWithNamesUnquoted: "Copy Row With Names, Unquoted",
        copyRowWithNamesTabSeparated: "Copy Row With Names, Tab Separated",
        copyRowTabSeparated: "Copy Row Tab Separated",
    },
    copyMultipleRows: "Copy Multiple Rows",
    copyMultipleRowsContextMenu: {
        copyAllRows: "Copy All Rows",
        copyAllRowsWithNames: "Copy All Rows With Names",
        copyAllRowsUnquoted: "Copy All Rows Unquoted",
        copyAllRowsWithNamesUnquoted: "Copy All Rows With Names, Unquoted",
        copyAllRowsWithNamesTabSeparated: "Copy All Rows With Names, Tab Separated",
        copyAllRowsTabSeparated: "Copy All Rows Tab Separated",
    },
    copyField: "Copy Field",
    copyFieldUnquoted: "Copy Field Unquoted",
    setFieldToNull: "Set Field to Null",
};

// DATABASE CONNECTION DIALOG
export const basicTab = "Basic";
export const sslTab = "SSL";
export const advancedTab = "Advanced";
export const sshTab = "SSH Tunnel";
export const mdsTab = "MDS/Bastion Service";

// DB CONNECTION OVERVIEW
export const editConnection = "Edit Connection";
export const dupConnection = "Duplicate Connection";
export const removeConnection = "Remove Connection";

// CELL ICONS
export const blob = "blob";
export const geometry = "geometry";
export const json = "json";
export const isNull = "null";

export const dbTables = [
    {
        name: "all_data_types_ints",
        columns: [
            `id`,
            `test_smallint`,
            `test_mediumint`,
            `test_integer`,
            `test_bigint`,
            `test_decimal`,
            `test_float`,
            `test_double`,
            `test_boolean`,
        ],
        columnRegexWithQuotes: [
            /(\d+)/, // id
            /(\d+)/, // smallint
            /(\d+)/, // med int
            /(\d+)/, // int
            /(\d+)/, // big int
            /'(\d+).(\d+)'/, // decimal
            /'(\d+).(\d+)'/, // float
            /'(\d+).(\d+)'/, // double
            /(\d+)/, // boolean
        ],
        columnRegex: [
            /(\d+)/, // id
            /(\d+)/, // smallint
            /(\d+)/, // med int
            /(\d+)/, // int
            /(\d+)/, // big int
            /(\d+).(\d+)/, // decimal
            /(\d+).(\d+)/, // float
            /(\d+).(\d+)/, // double
            /(\d+)/, // boolean
        ],
    },
    {
        name: "all_data_types_dates",
        columns: [
            `id`,
            `test_date`,
            `test_datetime`,
            `test_timestamp`,
            `test_time`,
            `test_year`,
        ],
        columnRegexWithQuotes: [
            /(\d+)/, // id
            /'(\d+)-(\d+)-(\d+)'/, // date
            /'(\d+)-(\d+)-(\d+) (\d+):(\d+):(\d+)'/, // date time
            /'(\d+)-(\d+)-(\d+) (\d+):(\d+):(\d+)'/, // timestamp
            /'(\d+):(\d+):(\d+)'/, // time
            /(\d+)/, // year
        ],
        columnRegex: [
            /(\d+)/, // id
            /(\d+)-(\d+)-(\d+)/, // date
            /(\d+)-(\d+)-(\d+) (\d+):(\d+):(\d+)/, // date time
            /(\d+)-(\d+)-(\d+) (\d+):(\d+):(\d+)/, // timestamp
            /(\d+):(\d+):(\d+)/, // time
            /(\d+)/, // year
        ],
    },
    {
        name: "all_data_types_chars",
        columns: [
            `id`,
            `test_char`,
            `test_varchar`,
            `test_tinytext`,
            `test_text`,
            `test_mediumtext`,
            `test_longtext`,
            `test_enum`,
            `test_set`,
            `test_json`,
        ],
        columnRegexWithQuotes: [
            /(\d+)/, // id
            /'.*'/, // char
            /'.*'/, // var char
            /'.*'/, // tiny text
            /'.*'/, // text
            /'.*'/, // med text
            /'.*'/, // long text
            /'.*'/, // enum
            /'.*'/, // set
            /\{".*": ".*"\}/, // json
        ],
        columnRegex: [
            /(\d+)/, // id
            /.*/, // char
            /.*/, // var char
            /.*/, // tiny text
            /.*/, // text
            /.*/, // med text
            /.*/, // long text
            /.*/, // enum
            /.*/, // set
            /\{".*": ".*"\}/, // json
        ],
    },
    {
        name: "all_data_types_blobs",
        columns: [
            `id`,
            `test_tinyblob`,
            `test_blob`,
            `test_mediumblob`,
            `test_longblob`,
            `test_binary`,
            `test_varbinary`,
        ],
        columnRegexWithQuotes: [
            /(\d+)/, // id
            /0x/, // tiny blob
            /0x/, // blob
            /0x/, // med blob
            /0x/, // long blob
            /0x/, // binary
            /0x/, // var binary
        ],
        columnRegex: [
            /(\d+)/, // id
            /0x/, // tiny blob
            /0x/, // blob
            /0x/, // med blob
            /0x/, // long blob
            /0x/, // binary
            /0x/, // var binary
        ],
    },
    {
        name: "all_data_types_geometries",
        columns: [
            `id`,
            `test_bit`,
            `test_point`,
            `test_linestring`,
            `test_polygon`,
            `test_multipoint`,
            `test_multilinestring`,
            `test_multipolygon`,
            `test_geometrycollection`,
        ],
        columnRegexWithQuotes: [
            /(\d+)/, // id
            /0x/, // tiny blob
            /0x/, // blob
            /0x/, // med blob
            /0x/, // long blob
            /'.*'/, // enum
            /'.*'/, // set
            /0x/, // binary
            /0x/, // var binary
            /\{".*": ".*"\}/, // json
        ],
        columnRegex: [
            /(\d+)/, // id
            /(\d+)/, // bit
            /\s/, // point
            /\s/, // linestring
            /\s/, // polygon
            /\s/, // multipoint
            /\s/, // multilinestring
            /\s/, // multipolygon
            /\s/, // geo collection
        ],
    },
    {
        name: "result_sets",
        columns: [
            "id",
            "text_field",
            "long_text_field",
            "bool_field",
            "date_field",
            "blob_field",
        ],
    },
    {
        name: "actor",
        columns: [
            "actor_id",
            "first_name",
            "last_name",
            "last_update",
        ],
        columnRegex: [
            /(\d+)/,
            /.*/,
            /.*/,
            /(\d+)-(\d+)-(\d+) (\d+):(\d+):(\d+)/,
        ],
        columnRegexWithQuotes: [
            /(\d+)/,
            /'.*'/,
            /'.*'/,
            /'(\d+)-(\d+)-(\d+) (\d+):(\d+):(\d+)'/,
        ],
    },
];
