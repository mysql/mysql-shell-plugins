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

// TODO: check if we can switch to camel case for those DB data types that use snake case.

/* eslint-disable @typescript-eslint/naming-convention */

import * as codicon from "../components/ui/Codicon";

// Types used in different places in the application (modules, parser, scripting etc.).

export interface IDictionary {
    [key: string]: unknown;
}

/**
 * Types of columns in a table column definition, which we support in the application.
 * Also used for column affinities in SQLite(instead of column types).
 */
export enum DBDataType {
    Unknown,

    // Integer types.
    TinyInt,
    SmallInt,
    MediumInt,
    Int,                // Any integer like number type (numeric is essentially the same) in SQLite.
    Bigint,
    UInteger,           // Mapped type from the shell.

    // Float types.
    Float,
    Real,               // Any floating point type in SQLite.
    Double,
    Decimal,

    // Binary types.
    Binary,
    Varbinary,

    // Text types.
    Char,
    Nchar,
    Varchar,
    Nvarchar,

    String,             // Mapped type from the shell.
    TinyText,
    Text,               // Any text in SQLite.
    MediumText,
    LongText,

    // Blob types.
    TinyBlob,
    Blob,               // NULL or no (explicit) type in SQLite.
    MediumBlob,
    LongBlob,

    // Date and time types.
    DateTime,
    DateTime_f,
    Date,
    Time,
    Time_f,
    Year,
    Timestamp,
    Timestamp_f,

    // Geometry types.
    Geometry,
    Point,
    LineString,
    Polygon,
    GeometryCollection,
    MultiPoint,
    MultiLineString,
    MultiPolygon,

    // Special types.
    Numeric,            // SQLite only, similar to INTEGER.
    Json,
    Bit,
    Boolean,
    Enum,
    Set,
}

/**
 * Describes the number of parameters for a DB data type. It doesn't say anything about the parameter types, though.
 */
export enum ParameterFormatType {
    None = 0,
    One = 1,            // (n)
    OneOrZero = 2,      // [(n)]
    Two = 3,            // (m,n)
    TwoOrOne = 4,       // (m[,n])
    TwoOrZero = 5,      // [(m,n)]
    TwoOrOneOrZero = 6, // [(m[, n])]
    List = 10,          // (m, n, o, p ...)
}

/**
 * Expression to handle URI strings defined as [mysql[x]://]user[:password]@host[:port]
 * Considering the URI notation as specified in RFC3986
 * Grouping positions return:
 * 0 - Full Match
 * 2 - Scheme
 * 4 - User
 * 6 - Password
 * 8 - Host
 * 9 - Port
 */
// eslint-disable-next-line max-len
export const uriPattern = /((mysql(x)?):\/\/)?([\w.\-~!$&'()*+,;=%]+)(:([\w.\-~!$&'()*+,;=%]*))?(@)([\w.\-~!$&'()*+,;=]+)(:(\d+))?/g;

export interface IDBCharacterSet {
    collations: string[];
    defaultCollation: string;
    description: string;
}

/** Describes a data type in a database. */
export interface IDBDataTypeDetails {
    type: DBDataType;

    characterMaximumLength?: number;
    characterOctetLength?: number;
    dateTimePrecision?: number;
    flags?: string[];
    numericPrecision?: number;
    numericPrecisionRadix?: number;
    numericScale?: number;
    needsQuotes?: boolean;
    parameterFormatType?: ParameterFormatType;
    synonyms?: string[];
}

export interface IColumnInfo {
    /** The column's title shown in the UI. */
    title: string;

    /** The name of the field in the data, which contains the data for this column. */
    field: string;

    /** Note: SQLite has no column data types like other RDBMS-es. Instead we store column affinities here. */
    dataType: IDBDataTypeDetails;
}

export enum MessageType {
    Error,
    Warning,
    Info,
    Interactive,
    Response,
}

export interface IExecutionInfo {
    type?: MessageType;
    text: string;
}

// Types for requesting a specific dialog and sending back the entered values.

export enum DialogType {
    /** A simple prompt value dialog, requesting a single value from the user. */
    Prompt,

    /** Confirm a question (yes, no, alt). */
    Confirm,

    /** Select one entry from a list. */
    Select,

    /** A dialog to create or edit an MRS service. */
    MrsService,

    /** A dialog to create or edit an MRS schema. */
    MrsSchema,

    /** A dialog to create or edit a MySQL HeatWave cluster. */
    MdsHeatWaveCluster,
}

/** A set of values that describe a single modal dialog request. */
export interface IDialogRequest extends IDictionary {
    type: DialogType;

    /** An id to identify the invocation. */
    id: string;

    /** Optionally used to set a customized dialog title (where supported). */
    title?: string;

    /** A list of strings to be rendered before the actual prompt, each in an own paragraph. */
    description?: string[];

    /** Values to configure how the dialog looks like (available options in drop downs etc.). */
    parameters?: IDictionary;

    /** Values to pre-fill certain elements or additional data for captions, payload etc. */
    values?: IDictionary;

    /** Additional data for specific use cases. */
    data?: IDictionary;
}

/** What decision made the user to close a dialog. */
export enum DialogResponseClosure {
    Accept,
    Decline,
    Alternative,

    /** Set when no decision was made. */
    Cancel,
}

export interface IDialogResponse extends IDictionary {
    id: string;
    type: DialogType;
    closure: DialogResponseClosure;

    values?: IDictionary;
    data?: IDictionary;
}

export interface IStatusbarInfo {
    id: string;
    text?: string;
    icon?: string | codicon.Codicon;
    choices?: Array<{ label: string; data: IDictionary }>;
    visible?: boolean;
    standout?: boolean;
}

/**
 * Defines the structure for password requests sent by various access methods. Passwords are stored by the backend
 * using native OS methods.
 */
export interface IServicePasswordRequest {
    /** The id of the request that asked for the password. */
    requestId: string;

    /** The password dialog title. */
    caption?: string;

    /** A list of strings describing the circumstances of the password request. */
    description?: string[];

    /** A human readable string describing the service. */
    service?: string;

    /** The user name for which to get the password. */
    user?: string;

    /** Any other data the caller wants to pass over. */
    payload?: IDictionary;
}
