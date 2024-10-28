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

import { IConnectionDetails } from "../supplement/ShellInterface/index.js";

// Have to disable naming convention rule as we list a number of values here that cannot be
// changed to conform to our rules.

/* eslint-disable @typescript-eslint/naming-convention */

export enum MySQLConnectionScheme {
    MySQL = "mysql",
    MySQLx = "mysqlx",
}

export enum MySQLSslMode {
    Disabled = "DISABLED",
    Preferred = "PREFERRED",
    Required = "REQUIRED",
    VerifyCA = "VERIFY_CA",
    VerifyIdentity = "VERIFY_IDENTITY",
}

export enum MySQLAuthMethod {
    Auto = "AUTO",
    FromCapabilities = "FROM_CAPABILITIES",
    Fallback = "FALLBACK",
    MySQL41 = "MYSQL41",
    Plain = "PLAIN",
    SHA256 = "SHA256_MEMORY",
}

export enum MySQLSqlMode {
    Ansi = "ANSI",
    Traditional = "TRADITIONAL",
    AllowInvalidDates = "ALLOW_INVALID_DATES",
    AnsiQuotes = "ANSI_QUOTES",
    ErrorForDivisionByZero = "ERROR_FOR_DIVISION_BY_ZERO",
    HighNotPrecedence = "HIGH_NOT_PRECEDENCE",
    IgnoreSpace = "IGNORE_SPACE",
    NoAutoValueOnZero = "NO_AUTO_VALUE_ON_ZERO",
    NoUnsignedSubtraction = "NO_UNSIGNED_SUBTRACTION",
    NoZeroDate = "NO_ZERO_DATE",
    NoZeroInDate = "NO_ZERO_IN_DATE",
    OnlyFullGroupBy = "ONLY_FULL_GROUP_BY",
    PadCharToFullLength = "PAD_CHAR_TO_FULL_LENGTH",
    PipesAsConcat = "PIPES_AS_CONCAT",
    RealAsFloat = "REAL_AS_FLOAT",
    StrictAllTables = "STRICT_ALL_TABLES",
    StrictTransTables = "STRICT_TRANS_TABLES",
    TimeTruncateFractional = "TIME_TRUNCATE_FRACTIONAL",
}

export enum MySQLConnCompression {
    /** Connection will only be made when compression can be enabled. */
    Required = "REQUIRED",

    /** Compression is negotiated (default for X protocol). */
    Preferred = "PREFERRED",

    /** No compression (default for classic protocol). */
    Disabled = "DISABLED",
}

export interface IMySQLConnectionOptions {
    /** The protocol to be used on the connection. */
    scheme: MySQLConnectionScheme;

    /** The MySQL user name to be used on the connection. */
    user?: string;

    /** The password to be used on the connection. */
    password?: string;

    /** The hostname or IP address to be used on the connection. */
    host: string;

    /** The port to be used in a TCP connection. */
    port?: number;

    /** The socket file name for unix sockets or the pipe name for Windows pipes. */
    socket?: string;

    /** The schema to be selected once the connection is done. */
    schema?: string;

    "sql-mode"?: MySQLSqlMode[];

    /** The SSL mode to be used in the connection. */
    "ssl-mode"?: MySQLSslMode;

    /** The path to the X509 certificate authority file in PEM format. */
    "ssl-ca"?: string;

    /** Path to the directory that contains the X509 certificate authority files in PEM format. */
    "ssl-capath"?: string;

    /** The path to the SSL public key certificate file in PEM format. */
    "ssl-cert"?: string;

    /** The path to the SSL private key file in PEM format. */
    "ssl-key"?: string;

    /** The path to file that contains certificate revocation lists. */
    "ssl-crl"?: string;

    /** The path of directory that contains certificate revocation list files. */
    "ssl-crlpath"?: string;

    /**
     * The list of permissible encryption ciphers for connections that use TLS protocols up through TLSv1.2.
     * Colon-separated string. Example: "HIGH:!SSLv2:!RC4:!aNULL@STRENGTH".
     */
    "ssl-ciphersuites"?: string;

    "ssl-cipher"?: string;

    /** Comma separated list of protocols permitted for secure connections. */
    "tls-version"?: string;

    /** List of TLS v1.3 ciphers to use. Same format as for field sslCipher. */
    "tls-ciphers"?: string;

    /** Authentication method. */
    "auth-method"?: MySQLAuthMethod;

    /**
     * Request public key from the server required for RSA key pair-based password exchange. Use when connecting to
     * MySQL 8.0 servers with classic MySQL sessions with SSL mode DISABLED.
     */
    "get-server-public-key"?: boolean;

    /**
     * The path name to a file containing a client-side copy of the public key required by the server for RSA
     * key pair-based password exchange. Use when connecting to MySQL 8.0 servers with classic MySQL sessions with
     * SSL mode DISABLED.
     */
    "server-public-key-path"?: string;

    /**
     * The connection timeout in milliseconds. If not provided a default timeout of 10 seconds will be used.
     * Specifying a value of 0 disables the connection timeout.
     */
    "connect-timeout"?: number;

    /** Enable compression in client/server protocol. */
    compression?: MySQLConnCompression;

    /**
     * Use compression algorithm in server/client protocol.
     * Comma-separated list with these values: "zlib", "zstd", "lz" and/or "uncompressed".
     */
    "compression-algorithms"?: string;

    /**
     * Use this compression level in the client/server protocol.
     *   zstd: 1-22 (default 3)
     *   zlib: 1-9 (default 3), supported only by X protocol
     *   lz4: 0-16 (default 2), supported only by X protocol.
     */
    "compression-level"?: number;

    /** List of connection attributes to be registered at the PERFORMANCE_SCHEMA connection attributes tables. */
    "connection-attributes"?: { [key: string]: string; };

    /** Enable/disable LOAD DATA LOCAL INFILE. */
    "local-infile"?: boolean;

    /** An SSH URI. */
    "ssh"?: string;

    /** Password to be used on the ssh connection */
    "ssh-password"?: string;

    /** the ssh key file password */
    "ssh-identity-file"?: string;

    /** the key file to be used on the ssh connection */
    "ssh-identity-file-password"?: string;

    /** custom path for the ssh config file */
    "ssh-config-file"?: string;

    /** The SSH public key file password. */
    "ssh-public-identity-file"?: string;

    /** MDS db system id */
    "mysql-db-system-id"?: string;

    /** MDS profile name */
    "profile-name"?: string;

    /** mds bastion id */
    "bastion-id"?: string;

    /** disable HeatWave check */
    "disable-heat-wave-check"?: boolean;

    /** MRS service host for this connection */
    "mrs-service-host"?: string;
}

export const getMySQLDbConnectionUri = (details: IConnectionDetails): string => {
    const opt = details.options as IMySQLConnectionOptions;
    let dbConnectionUri = String(opt.scheme);

    if (details.useSSH) {
        dbConnectionUri += `+ssh://`;
    } else if (details.useMHS) {
        dbConnectionUri += `+mds://`;
    }

    if (opt.user) {
        dbConnectionUri += `${opt.user}@`;
    }

    dbConnectionUri += opt.host;

    if (opt.port) {
        dbConnectionUri += ":" + String(opt.port);
    }

    return dbConnectionUri;
};
