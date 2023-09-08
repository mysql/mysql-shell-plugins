<!-- Copyright (c) 2022, 2023, Oracle and/or its affiliates.

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License, version 2.0,
as published by the Free Software Foundation.

This program is also distributed with certain software (including
but not limited to OpenSSL) that is licensed under separate terms, as
designated in a particular file or component or in included license
documentation.  The authors of MySQL hereby grant you an additional
permission to link the program and your derivative works with the
separately licensed software that they have included with MySQL.
This program is distributed in the hope that it will be useful,  but
WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
the GNU General Public License, version 2.0, for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software Foundation, Inc.,
51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA -->

# MRS Core REST APIs

This section provides examples of using the MySQL REST Service queries and other operations against tables and views after you have REST-enabled them.

The examples in this section provide an insight into the direct, low-level REST API calls that can be made against the MySQL REST Service. They can be used to gain a deep understanding of how MRS works.

When developing an application with MRS, it is recommended to use a higher-level MRS Software Development Kit (SDK) instead. Please check if a [SDK](sdk.html) has already been made available for your programming language and platform.

## About MRS RESTful Web Services

MRS supports the creation of an unlimited amount of distinct RESTful Web Services. You can also refer to them as MRS services. Each of those MRS services usually maps to one (or more) web applications.

After you create a RESTful Web Service, you can access it by navigating to the following URL.

Pattern:

    https://<HOSTNAME:PORT>/<MRS_SERVICE_PATH>/<MRS_DATABASE_SCHEMA_PATH>/<MRS_DATABASE_OBJECT_PATH>/

- `HOSTNAME:PORT/MRS_SERVICE_PATH`: Specifies the address at which the given MRS service is running. You can also refer to it as the MRS service URI.
- `MRS_DATABASE_SCHEMA_PATH`: Specifies the path that you provided while REST-enabling your database schema. By default, it is the name of the schema.
- `MRS_DATABASE_OBJECT_PATH`: Specifies the path that you provided while REST-enabling your database object (TABLE, VIEW or PROCEDURE).

Together, these values comprise the MRS endpoint URL.

Example:

    https://localhost:8000/mrs/sakila/actor

## About Request Path Syntax Requirements

To prevent path-based attacks, MRS requires the syntax of the path element of each request URL to conform to the following rules:

- Is not empty or whitespace-only
- Does not contain any of the following characters: ?, #, ;, %
- Does not contain the null character (\u0000)
- Does not contain characters in the range: \u0001-\u0031
- Does not end with white space or a period (.)
- Does not contain double forward slash (//) or double back slash(\\)
- Does not contain two or more periods in sequence (.., ..., and so on)
- Total length is {@value #MAX_PATH_LENGTH} characters or less
- Does not match any of the following names (case insensitive), with or without file extensions: CON, PRN, AUX, CLOCK$, NUL, COM0, COM1, COM2, COM3, COM4, COM5, COM6, COM7, COM8, COM9, LPT0, LPT1, LPT2, LPT3, LPT4, LPT5, LPT6, LPT7, LPT8, LPT9

If you intend to enable REST endpoints for database objects, then avoid object names that do not comply with these requirements. For example, do not create a table named #EMPS. If you do want to auto-REST enable objects that have non-compliant names, then you must use an alias that complies with the requirements.

These requirements are applied to the URL decoded form of the URL, to prevent attempted circumvention of percent encodings.

## About cURL and Testing RESTful Services

Usually you can navigate to a URL of a RESTful service using a web browser. However, another way to test it is by using a command line tool like cURL.

cURL enables you to see and control what data is being sent to and received from a RESTful service.

    curl -i https://localhost:8000/mrs/sakila/actor/2

This example produces a response like the following:

    {
        "links": [
            {
                "rel": "self",
                "href": "http://localhost:8000/mrs/sakila/actor/2"
            }
        ],
        "actor_id": 2,
        "last_name": "WAHLBERG",
        "first_name": "NICK",
        "last_update": "2006-02-15 03:34:33.000000"
    }

The -i option tells cURL to display the HTTP headers returned by the server.
