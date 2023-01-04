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

# About MRS AutoREST

AutoREST is a quick and easy way to expose database tables, views and procedures as REST resources.

## REST APIs

Representational State Transfer (REST) is a style of software architecture for distributed hypermedia systems such as the World Wide Web. An API is described as RESTful when it conforms to the tenets of REST. Although a full discussion of REST is outside the scope of this document, a REST API has the following characteristics:

Data is modelled as a set of resources. Resources are identified by URIs.

A small, uniform set of operations are used to manipulate resources (for example, PUT, POST, GET, DELETE).

A resource can have multiple representations (for example, a blog might have an HTML representation and an RSS representation).

Services are stateless and since it is likely that the client will want to access related resources, these should be identified in the representation returned, typically by providing hypertext links.

## RESTful Services Terminology

This section introduces some common terms that are used throughout this document:

- __RESTful service:__ An HTTP web service that conforms to the tenets of the RESTful architectural style.

- __Resource module:__ An organizational unit that is used to group related resource templates.

- __Resource template:__ An individual RESTful service that is able to service requests for some set of URIs (Universal Resource Identifiers). The set of URIs is defined by the URI Pattern of the Resource Template

- __URI pattern:__ A pattern for the resource template. Can be either a route pattern or a URI template, although you are encouraged to use route patterns.

- __Route pattern:__ A pattern that focuses on decomposing the path portion of a URI into its component parts. For example, a pattern of /:object/:id? will match /emp/101 (matches a request for the item in the emp resource with id of 101) and will also match /emp/ (matches a request for the emp resource, because the :id parameter is annotated with the ? modifier, which indicates that the id parameter is optional).

- __HTTP operation:__ HTTP (HyperText Transport Protocol) defines standard methods that can be performed on resources: GET (retrieve the resource contents), POST (store a new resource), PUT (update an existing resource), and DELETE (remove a resource).

## MRS RESTful Web Services

MRS supports the creation of an unlimited amount of distinct RESTful Web Services. You can also refer to them as MRS Services. Each of those MRS Services usually maps to one (or more) web applications.

After you create a RESTful Web Service, you can access it by entering the following URL in your browser:

    https://<HOSTNAME:PORT>/<MRS_SERVICE_PATH>/<MRS_DATABASE_SCHEMA_PATH>/<MRS_DATABASE_OBJECT_PATH>/

Where:

- `HOSTNAME:PORT/MRS_SERVICE_PATH`: Specifies the address at which the given MRS Service is running. You can also refer to it as the MRS Service URI.
- `MRS_DATABASE_SCHEMA_PATH`: Specifies the path that you provided while REST-enabling your database schema. By default, it is the name of the schema.
- `MRS_DATABASE_OBJECT_PATH`: Specifies the path that you provided while REST-enabling your database object (TABLE, VIEW or PROCEDURE).

Together, these values comprise the MRS Endpoint URL.

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

If you intend to auto-REST enable objects, then avoid object names that do not comply with these requirements. For example, do not create a table named #EMPS. If you do want to auto-REST enable objects that have non-compliant names, then you must use an alias that complies with the requirements.

These requirements are applied to the URL decoded form of the URL, to prevent attempted circumvention of percent encodings.

## About cURL and Testing RESTful Services

Other sections show the testing of RESTful Services using a web browser. However, another useful way to test RESTful Services is using the command line tool named cURL.

This powerful tool is available for most platforms, and enables you to see and control what data is being sent to and received from a RESTful service.

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
