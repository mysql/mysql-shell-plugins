/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

// This file is exclusively focused on types. Never import any file with code in it (or enums)!

/* eslint-disable @typescript-eslint/naming-convention */

/** This is the preferred MySQL shell version for the app and associated tests. */
export const preferredShellVersion = [8, 2, 0];

/** This is the minimum MySQL shell version this app needs to work properly. */
export const minimumShellVersion = [8, 1];

// Types used in different places in the application (modules, parser, scripting etc.).

export interface IDictionary {
    [key: string]: unknown;
}

export type Resolver<T> = (value: T | undefined) => void;

/**
 * Types of columns in a table column definition, which we support in the application.
 * Also used for column affinities in SQLite(instead of column types).
 * TODO: check if we can switch to camel case for those DB data types that use snake case.
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
    Date,
    Time,
    Year,
    Timestamp,

    // Geometry types. All of them are just synonyms for GEOMETRY.
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

export const isNumericType = (type: DBDataType): boolean => {
    return type === DBDataType.TinyInt || type === DBDataType.SmallInt || type === DBDataType.MediumInt
        || type === DBDataType.Int || type === DBDataType.Bigint || type === DBDataType.UInteger
        || type === DBDataType.Float || type === DBDataType.Real || type === DBDataType.Double
        || type === DBDataType.Decimal || type === DBDataType.Numeric;
};

export const isTextType = (type: DBDataType): boolean => {
    return type === DBDataType.Char || type === DBDataType.Nchar || type === DBDataType.Varchar ||
        type === DBDataType.Nvarchar || type === DBDataType.String || type === DBDataType.TinyText ||
        type === DBDataType.Text || type === DBDataType.MediumText || type === DBDataType.LongText
        || type === DBDataType.Json || type === DBDataType.Enum || type === DBDataType.Set;
};

export const isBlobType = (type: DBDataType): boolean => {
    return type === DBDataType.TinyBlob || type === DBDataType.Blob || type === DBDataType.MediumBlob ||
        type === DBDataType.LongBlob;
};

export const isDateTimeType = (type: DBDataType): boolean => {
    return type === DBDataType.DateTime || type === DBDataType.Date ||
        type === DBDataType.Time || type === DBDataType.Year ||
        type === DBDataType.Timestamp;
};

export const isGeometryType = (type: DBDataType): boolean => {
    return type === DBDataType.Geometry || type === DBDataType.Point || type === DBDataType.LineString ||
        type === DBDataType.Polygon || type === DBDataType.GeometryCollection || type === DBDataType.MultiPoint ||
        type === DBDataType.MultiLineString || type === DBDataType.MultiPolygon;
};

/** Mappings from a DB type to its default value. */
export const defaultValues: { [key in DBDataType]?: number | string | boolean | Date; } = {
    [DBDataType.TinyInt]: 0,
    [DBDataType.SmallInt]: 0,
    [DBDataType.MediumInt]: 0,
    [DBDataType.Int]: 0,
    [DBDataType.Bigint]: 0,
    [DBDataType.UInteger]: 0,
    [DBDataType.Float]: 0,
    [DBDataType.Real]: 0,
    [DBDataType.Double]: 0,
    [DBDataType.Decimal]: 0,
    [DBDataType.Numeric]: 0,
    [DBDataType.Binary]: "",
    [DBDataType.Varbinary]: "",
    [DBDataType.Char]: "",
    [DBDataType.Nchar]: "",
    [DBDataType.Varchar]: "",
    [DBDataType.Nvarchar]: "",
    [DBDataType.String]: "",
    [DBDataType.TinyText]: "",
    [DBDataType.Text]: "",
    [DBDataType.MediumText]: "",
    [DBDataType.LongText]: "",
    [DBDataType.TinyBlob]: "",
    [DBDataType.Blob]: "",
    [DBDataType.MediumBlob]: "",
    [DBDataType.LongBlob]: "",
    [DBDataType.DateTime]: new Date(),
    [DBDataType.Date]: new Date(),
    [DBDataType.Time]: new Date(),
    [DBDataType.Year]: new Date(),
    [DBDataType.Timestamp]: new Date(),
    [DBDataType.Json]: "{}",
    [DBDataType.Bit]: "",
    [DBDataType.Boolean]: false,
    [DBDataType.Enum]: "",
    [DBDataType.Set]: "",
};

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
export const uriPattern
    = /((mysql(x)?):\/\/)?([\w.\-~!$&'()*+,;=%]+)(:([\w.\-~!$&'()*+,;=%]*))?(@)([\w.\-~!$&'()*+,;=]+)(:(\d+))?/g;

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

/** GUI related information about a table column. */
export interface IColumnInfo {
    /** The column's title shown in the UI. */
    title: string;

    /** The name of the field in the data, which contains the data for this column. */
    field: string;

    /** Note: SQLite has no column data types like other RDBMS-es. Instead we store column affinities here. */
    dataType: IDBDataTypeDetails;

    /** The column's width in characters. */
    width?: number;

    /** A flag to indicate right alignment. */
    rightAlign?: boolean;

    /** Is this column part of the primary key? */
    inPK: boolean;

    autoIncrement: boolean;

    /** Can values of this column be set to null? */
    nullable: boolean;

    /** The default value as defined in the table creation. */
    default?: unknown;

    /** The textual column data type definition, as defined in the table creation. */
    originalType?: string;
}

/**
 * Determines how text is rendered. The type corresponds to a specific CSS class.
 */
export enum MessageType {
    Error,
    Warning,
    Info,
    Text,
    Response,
    Success,
}

/** Details for a status message, usually used in result view status bars. */
export interface IStatusInfo {
    type?: MessageType;
    text: string;
}

/** Used for update statements in editing operations. */
export interface ISqlUpdateResult {
    /** The number of rows affected by the statement. */
    affectedRows: number;

    /** One entry for each sent SQL statement. If empty, no error came up. */
    errors: string[];
}

// Types for requesting a specific dialog and sending back the entered values.

/** Types for general dialogs. */
export enum DialogType {
    /** A simple prompt value dialog, requesting a single value from the user. */
    Prompt,

    /** Confirm a question (yes, no, alt). */
    Confirm,

    /** Select one entry from a list. */
    Select,

}

/** Types for MySQL REST dialogs. */
export enum MrsDialogType {
    /** A dialog to create or edit an MRS service. */
    MrsService = 10,

    /** A dialog to create or edit an MRS Authentication App */
    MrsAuthenticationApp,

    /** A dialog to create or edit an MRS User */
    MrsUser,

    /** A dialog to create or edit an MRS schema. */
    MrsSchema,

    /** A dialog to create or edit an MRS dbObject. */
    MrsDbObject,

    /** A dialog to create or edit an MRS contentSet. */
    MrsContentSet,

    /** A dialog to set the SDK export settings. */
    MrsSdkExport,
}

/** Types for MySQL Database Service (OCI) dialogs. */
export enum MdsDialogType {
    /** A dialog to create or edit a MySQL HeatWave cluster. */
    MdsHeatWaveCluster = 20,

    /** A dialog to load data to MySQL HeatWave cluster. */
    MdsHeatWaveLoadData,

    /** A dialog with MySQL HeatWave endpoint settings. */
    MdsEndpoint,
}

/** A set of values that describe a single modal dialog request. */
export interface IDialogRequest extends IDictionary {
    /** The type of the dialog to show. Used mostly to schedule dialog requests. */
    type: DialogType | MrsDialogType | MdsDialogType;

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
    type: DialogType | MdsDialogType;
    closure: DialogResponseClosure;

    values?: IDictionary;
    data?: IDictionary;
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

/** Accessibility information which controls screen reader behavior. */
export interface IAccessibilityInformation {
    /** Label to be read out by a screen reader once the item has focus. */
    readonly label: string;

    /**
     * Role of the widget which defines how a screen reader interacts with it.
     * The role should be set in special cases when for example a tree-like element behaves like a checkbox.
     * If role is not specified the editor will pick the appropriate role automatically.
     * More about aria roles can be found here https://w3c.github.io/aria/#widget_roles
     */
    readonly role?: string;
}

/** Make all entries in type T mutable. */
export type Mutable<T> = {
    -readonly [P in keyof T]: T[P]
};

/** Make all entries and their children (recursively) in type T mutable (except functions). */
export type DeepMutable<T> = T extends Function
    ? T
    : T extends object ? {
        - readonly [P in keyof T]: DeepMutable<T[P]>
    } : T;

/** Utility type to enforce only one member in a type can be used (no two or more). */
export type MutuallyExclusive<T> = {
    [K in keyof T]: Pick<T, K> & Partial<Record<Exclude<keyof T, K>, never>>;
}[keyof T];
