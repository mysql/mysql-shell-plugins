<!-- Copyright (c) 2022, 2025, Oracle and/or its affiliates.

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License, version 2.0,
as published by the Free Software Foundation.

This program is designed to work with certain software (including
but not limited to OpenSSL) that is licensed under separate terms, as
designated in a particular file or component or in included license
documentation.  The authors of MySQL hereby grant you an additional
permission to link the program and your derivative works with the
separately licensed software that they have either included with
the program or referenced in the documentation.

This program is distributed in the hope that it will be useful,  but
WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
the GNU General Public License, version 2.0, for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software Foundation, Inc.,
51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA -->

# MRS REST Queries

A MRS REST service provides access to one or more schemas (and their metadata) as well as their comprising database objects such as tables, views and procedures (and their metadata).

## Get Schema Metadata

This example retrieves a list of resources available through the specified schema alias. It shows RESTful services that are created by enabling a table, view or procedure.

Pattern:

    GET http://<HOST>:<PORT>/<ServiceAlias>/<SchemaAlias>/metadata-catalog/

Example:

    GET http://localhost:8000/mrs/sakila/metadata-catalog/

Result:

    {
        "items": [
            {
                "name": "/actor",
                "links": [
                    {
                        "rel": "describes",
                        "href": "http://localhost:8000/mrs/sakila/actor"
                    },
                    {
                        "rel": "canonical",
                        "href": "http://localhost:8000/mrs/sakila/metadata-catalog/actor"
                    }
                ]
            },
            {
                "name": "/address",
                "links": [
                    {
                        "rel": "describes",
                        "href": "http://localhost:8000/mrs/sakila/address"
                    },
                    {
                        "rel": "canonical",
                        "href": "http://localhost:8000/mrs/sakila/metadata-catalog/address"
                    }
                ]
            }
        ],
        "limit": 25,
        "offset": 0,
        "hasMore": false,
        "count": 2,
        "links": [
            {
                "rel": "self",
                "href": "http://localhost:8000/mrs/sakila/metadata-catalog/"
            }
        ]
    }

Each available resource has two hyperlinks:

- The link with a "describes" relation points to the actual resource
- The link with a "canonical" relation points to the resource metadata

## Get Object Metadata

This example retrieves the metadata (which describes the object) of an individual object. The location of the metadata is specified by the canonical link relation.

Pattern:

    GET http://<HOST>:<PORT>/<ServiceAlias>/<SchemaAlias>/metadata-catalog/<ObjectAlias>/

Example:

    GET http://localhost:8000/mrs/sakila/metadata-catalog/actor/

Result:

    {
        "name": "/actor",
        "primaryKey": [
            "actor_id"
        ],
        "members": [
            {
                "name": "actor_id",
                "type": "null"
            },
            {
                "name": "first_name",
                "type": "null"
            },
            {
                "name": "last_name",
                "type": "null"
            },
            {
                "name": "last_update",
                "type": "string"
            }
        ],
        "links": [
            {
                "rel": "collection",
                "href": "http://mrs.example.com/mrs/sakila/metadata-catalog",
                "mediaType": "application/json"
            },
            {
                "rel": "canonical",
                "href": "http://mrs.example.com/mrs/sakila/metadata-catalog/actor"
            },
            {
                "rel": "describes",
                "href": "http://mrs.example.com/mrs/sakila/actor"
            }
        ]
    }

## Get Object Data

This example retrieves the data in the object. Each row in the object corresponds to a JSON object embedded within the JSON array

Pattern:

    GET http://<HOST>:<PORT>/<ServiceAlias>/<SchemaAlias>/<ObjectAlias>/

Example:

    GET http://localhost:8000/mrs/sakila/actor/

Result:

    {
        "items": [
            {
                "links": [
                    {
                        "rel": "self",
                        "href": "http://mrs.example.com/mrs/sakila/actor/1"
                    }
                ],
                "actor_id": 1,
                "last_name": "GUINESSS",
                "first_name": "PENELOPE",
                "last_update": "2021-09-28 20:18:53.000000"
            },
            {
                "links": [
                    {
                        "rel": "self",
                        "href": "http://mrs.example.com/mrs/sakila/actor/2"
                    }
                ],
                "actor_id": 2,
                "last_name": "WAHLBERG",
                "first_name": "NICK",
                "last_update": "2006-02-15 03:34:33.000000"
            },
            {
                "links": [
                    {
                        "rel": "self",
                        "href": "http://mrs.example.com/mrs/sakila/actor/3"
                    }
                ],
                "actor_id": 3,
                "last_name": "CHASE",
                "first_name": "ED",
                "last_update": "2006-02-15 03:34:33.000000"
            },
            ...
        ]
    }

### Get Table Data Using Pagination

We can specify offset and limit parameters which are used for result data pagination.

Pattern:

    GET http://<HOST>:<PORT>/<ServiceAlias>/<SchemaAlias>/<ObjectAlias>/?offset=<Offset>&limit=<Limit>

Example:

    GET http://localhost:8080/mrs/sakila/actor/?offset=10&limit=2

Result:

    {
        "items": [
            {
                "links": [
                    {
                        "rel": "self",
                        "href": "http://mrs.example.com/mrs/sakila/actor/11"
                    }
                ],
                "actor_id": 11,
                "last_name": "CAGE",
                "first_name": "ZERO",
                "last_update": "2006-02-15 03:34:33.000000"
            },
            {
                "links": [
                    {
                        "rel": "self",
                        "href": "http://mrs.example.com/mrs/sakila/actor/12"
                    }
                ],
                "actor_id": 12,
                "last_name": "BERRY",
                "first_name": "KARL",
                "last_update": "2006-02-15 03:34:33.000000"
            }
        ],
        "limit": 2,
        "offset": 10,
        "hasMore": true,
        "count": 2,
        "links": [
            {
                "rel": "self",
                "href": "http://mrs.example.com/mrs/sakila/actor/"
            },
            {
                "rel": "next",
                "href": "http://mrs.example.com/mrs/sakila/actor/?offset=12&limit=2"
            },
            {
                "rel": "prev",
                "href": "http://mrs.example.com/mrs/sakila/actor/?offset=8&limit=2"
            },
            {
                "rel": "first",
                "href": "http://mrs.example.com/mrs/sakila/actor/?limit=2"
            }
        ]
    }

### Get Table Data Using Query

We can use a filter clause to restrict the set of objects that are returned.

Pattern:

    GET http://<HOST>:<PORT>/<ServiceAlias>/<SchemaAlias>/<ObjectAlias>/?q=<FilterClause>

Example:

    GET http://localhost:8080/mrs/sakila/actor/?q={"last_name":{"$like":"WAW%"}}

Result:

    {
        "items": [
            {
                "links": [
                    {
                        "rel": "self",
                        "href": "http://mrs.example.com/mrs/sakila/actor/97"
                    }
                ],
                "actor_id": 97,
                "last_name": "HAWKE",
                "first_name": "MEG",
                "last_update": "2006-02-15 03:34:33.000000"
            }
        ],
        "limit": 25,
        "offset": 0,
        "hasMore": false,
        "count": 1,
        "links": [
            {
                "rel": "self",
                "href": "http://mrs.example.com/mrs/sakila/actor/"
            }
        ]
    }

### Get Table Row Using Primary Key

This example retrieves an object by specifying its identifying key values.

Note: A table requires a primary key to be part of a REST service.

Pattern:

    GET http://<HOST>:<PORT>/<ServiceAlias>/<SchemaAlias>/<ObjectAlias>/<KeyValues>

Where `<KeyValues>` is a comma-separated list of key values (in key order).

Example:

    GET http://localhost:8000/mrs/sakila/actor/53

Result:

    {
        "links": [
            {
                "rel": "self",
                "href": "http://mrs.example.com/mrs/sakila/actor/53"
            }
        ],
        "actor_id": 53,
        "last_name": "TEMPLE",
        "first_name": "MENA",
        "last_update": "2006-02-15 03:34:33.000000"
    }

## Insert Table Row

To insert data into a table, the request body should be a JSON object that contains the data to be inserted.

If the object has a primary key, then the POST request can include the primary key value in the body. If the table has an AUTO_INCREMENT column then the primary key column may be omitted.

Pattern:

    POST http://<HOST>:<PORT>/<ServiceAlias>/<SchemaAlias>/<ObjectAlias>/

Example:

    curl -i -H "Content-Type: application/json" -X POST -d "{ \"last_name\" : \"FOLEY\", \"first_name\": \"MIKE\" }" "http://localhost:8000/mrs/sakila/actor/" Content-Type: application/json

Result:

    {
        "links": [
            {
                "rel": "self",
                "href": "http://localhost:8000/mrs/sakila/actor/201"
            }
        ],
        "actor_id": 201,
        "last_name": "FOLEY",
        "first_name": "MIKE",
        "last_update": "2022-11-29 15:35:17.000000"
    }

## Update/Insert Table Row

To insert, update or "upsert" (update if exists, insert if not) data into a table, we can send a request where the body contains a JSON object with the data to insert or update.

Pattern:

    PUT http://<HOST>:<PORT>/<ServiceAlias>/<SchemaAlias>/<ObjectAlias>/<KeyValues>

Example:

    curl -i -H "Content-Type: application/json" -X PUT -d "{ \"last_name\" : \"FOLEY\", \"first_name\": \"JACK\" }" "https://localhost:8000/mrs/sakila/actor/201" Content-Type: application/json

Result:

    {
        "links": [
            {
                "rel": "self",
                "href": "http://mrs.example.com/mrs/sakila/actor/201"
            }
        ],
        "actor_id": 201,
        "last_name": "FOLEY",
        "first_name": "JACK",
        "last_update": "2022-11-29 15:45:10.000000"
    }

## Delete Using Filter

Deleting a object or other database object can be done by specifying a filter clause that identifies the object to delete.

Pattern:

    DELETE http://<HOST>:<PORT>/<ServiceAlias>/<SchemaAlias>/<ObjectAlias>/?q=<FilterClause>

Example:

    curl -i -X DELETE "https://localhost:8000/mrs/sakila/actor/?q=\{\"actor_id\":201\}"

Result:

    {
        "itemsDeleted": 1
    }
