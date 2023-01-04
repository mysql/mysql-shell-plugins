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

# Enabling of Schema Objects for REST Access

Enabling REST access to a database schema table, view or procedure allows it to be accessed through RESTful services.

Note that enabling a database schema is not equivalent to enabling all tables and views in the schema. It just means making the MySQL REST Service aware that the schema exists and that it may have zero or more resources to expose to HTTP/S.

If you are using MySQL Shell for VS Code, you can AUTOREST enable the database schema objects with convenient dialogs. The MySQL REST Service also provides a MySQL Shell plugin that can be used to enable objects for REST on the command line or via scripts.

## Accessing Objects Using RESTful Services

This section provides examples of using the MySQL REST Service queries and other operations against tables and views after you have REST-enabled them.

### Get Schema Metadata

This example retrieves a list of resources available through the specified schema alias. It shows RESTful services that are created by enabling a table, view or procedure.

This example retrieves a list of resources available through the specified schema alias.

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

- The link with relation describes points to the actual resource.
- The link with relation canonical describes the resource.

### Get Object Metadata

This example retrieves the metadata (which describes the object) of an individual object. The location of the metadata is indicated by the canonical link relation.

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
                "href": "http://mrs.zinner.org/mrs/sakila/metadata-catalog",
                "mediaType": "application/json"
            },
            {
                "rel": "canonical",
                "href": "http://mrs.zinner.org/mrs/sakila/metadata-catalog/actor"
            },
            {
                "rel": "describes",
                "href": "http://mrs.zinner.org/mrs/sakila/actor"
            }
        ]
    }

### Get Object Data

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
                        "href": "http://mrs.zinner.org/mrs/sakila/actor/1"
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
                        "href": "http://mrs.zinner.org/mrs/sakila/actor/2"
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
                        "href": "http://mrs.zinner.org/mrs/sakila/actor/3"
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

#### Get Table Data Using Paging

This example specifies the offset and limit parameters to control paging of result data.

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
                        "href": "http://mrs.zinner.org/mrs/sakila/actor/11"
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
                        "href": "http://mrs.zinner.org/mrs/sakila/actor/12"
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
                "href": "http://mrs.zinner.org/mrs/sakila/actor/"
            },
            {
                "rel": "next",
                "href": "http://mrs.zinner.org/mrs/sakila/actor/?offset=12&limit=2"
            },
            {
                "rel": "prev",
                "href": "http://mrs.zinner.org/mrs/sakila/actor/?offset=8&limit=2"
            },
            {
                "rel": "first",
                "href": "http://mrs.zinner.org/mrs/sakila/actor/?limit=2"
            }
        ]
    }

#### Get Table Data Using Query

This example specifies a filter clause to restrict objects returned.

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
                        "href": "http://mrs.zinner.org/mrs/sakila/actor/97"
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
                "href": "http://mrs.zinner.org/mrs/sakila/actor/"
            }
        ]
    }

#### Get Table Row Using Primary Key

This example retrieves an object by specifying its identifying key values.

Note: If a table does not have a primary key, then MRS uses the ROWID to uniquely address the rows.

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
                "href": "http://mrs.zinner.org/mrs/sakila/actor/53"
            }
        ],
        "actor_id": 53,
        "last_name": "TEMPLE",
        "first_name": "MENA",
        "last_update": "2006-02-15 03:34:33.000000"
    }

### Insert Table Row

This example inserts data into the object. The body data supplied with the request is a JSON object containing the data to be inserted.

If the object has a primary key, then the POST request can include the primary key value in the body. Or, if the table has an AUTO_INCREMENT column then the primary key column may be omitted.

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

### Update/Insert Table Row

This example inserts or updates (sometimes called an "upsert") data in the object. The body data supplied with the request is a JSON object containing the data to be inserted or updated.

Pattern:

    PUT http://<HOST>:<PORT>/<ServiceAlias>/<SchemaAlias>/<ObjectAlias>/<KeyValues>

Example:

    curl -i -H "Content-Type: application/json" -X PUT -d "{ \"last_name\" : \"FOLEY\", \"first_name\": \"JACK\" }" "https://localhost:8000/mrs/sakila/actor/201" Content-Type: application/json

Result:

    {
        "links": [
            {
                "rel": "self",
                "href": "http://mrs.zinner.org/mrs/sakila/actor/201"
            }
        ],
        "actor_id": 201,
        "last_name": "FOLEY",
        "first_name": "JACK",
        "last_update": "2022-11-29 15:45:10.000000"
    }

### Delete Using Filter

This example deletes object data specified by a filter clause.

Pattern:

    DELETE http://<HOST>:<PORT>/<ServiceAlias>/<SchemaAlias>/<ObjectAlias>/?q=<FilterClause>

Example:

    curl -i -X DELETE "https://localhost:8000/mrs/sakila/actor/?q=\{\"actor_id\":201\}"

Result:

    {
        "itemsDeleted": 1
    }

### FilterObject Grammar

The FilterObject must be a JSON object that complies with the following syntax:

    FilterObject { orderby , asof, wmembers }

The orderby, asof, and wmembers attributes are optional, and their definitions are as follows:

    orderby
    "$orderby": {orderByMembers}
    
    orderByMembers
        orderByProperty
        orderByProperty , orderByMembers
    
    orderByProperty
        columnName : sortingValue
    
    sortingValue
    "ASC"
    "DESC"
    "-1"
    "1"
    -1
    1
    
    asof
    "$asof": date
    "$asof": "datechars"
    "$asof": scn
    "$asof": +int
    
    wmembers
        wpair
        wpair , wmembers
    
    wpair
        columnProperty
        complexOperatorProperty
    
    columnProperty
        columnName : string
        columnName : number
        columnName : date
        columnName : simpleOperatorObject
    columnName : complexOperatorObject
        columnName : [complexValues]
    
    columnName
    "\p{Alpha}[[\p{Alpha}]]([[\p{Alnum}]#$_])*$"
    
    complexOperatorProperty
        complexKey : [complexValues]
        complexKey : simpleOperatorObject 
    
    complexKey
    "$and"
    "$or"
    
    complexValues
        complexValue , complexValues
    
    complexValue
        simpleOperatorObject
        complexOperatorObject
        columnObject
    
    columnObject
        {columnProperty}
    
    simpleOperatorObject
        {simpleOperatorProperty}
    
    complexOperatorObject
        {complexOperatorProperty}
    
    simpleOperatorProperty
    "$eq" : string | number | date
    "$ne" : string | number | date
    "$lt" :  number | date
    "$lte" : number | date
    "$gt" : number | date
    "$gte" : number | date
    "$instr" : string 
    "$ninstr" : string
    "$like" : string
    "$null" : null
    "$notnull" : null
    "$between" : betweenValue
    "$like": string
    
    betweenValue
        [null , betweenNotNull]
        [betweenNotNull , null]
        [betweenRegular , betweenRegular]
    
    betweenNotNull
        number
        date
        
    betweenRegular
        string
        number
        date

Data type definitions include the following:

       string 
              JSONString
       number
              JSONNumber
       date
              {"$date":"datechars"}
       scn
              {"$scn": +int}

Where:

    datechars is an RFC3339 date format in UTC (Z)
            
    
    JSONString
            ""
            " chars "
    chars
            char
            char chars
    char
            any-Unicode-character except-"-or-\-or-control-character
            \"
            \\
            \/
            \b
            \f
            \n
            \r
            \t
            \u four-hex-digits
    
    
    JSONNumber
        int
        int frac
        int exp
        int frac exp
    int
        digit
        digit1-9 digits 
        - digit
        - digit1-9 digits
    frac
        . digits
    exp
        e digits
    digits
        digit
        digit digits
    e
        e
        e+
        e-
        E
        E+
        E-

The FilterObject must be encoded according to Section 2.1 of RFC3986.

### Examples: FilterObject Specifications

The following are examples of operators in FilterObject specifications.

    ORDER BY property ($orderby)

    Order by with literals
    
    {
    "$orderby": {"SALARY":  "ASC","ENAME":"DESC"}
    }
    
    Order by with numbers
    
    {
    "$orderby": {"SALARY":  -1,"ENAME":  1}
    }
    

    ASOF property ($asof)
    
    With SCN (Implicit)
    
    {
      "$asof": 1273919
    }
    
    With SCN (Explicit)
    
    {
      "$asof": {"$scn": "1273919"}
    }
    
    With Date (Implicit)
    
    {
      "$asof": "2014-06-30T00:00:00Z"
    }
    
    With Date (Explicit)
    
    {
      "$asof": {"$date": "2014-06-30T00:00:00Z"}
    }
    
    
    EQUALS operator ($eq)
    
    (Implicit and explicit equality supported._
    
    Implicit (Support String and Dates too)
    
    {
    "SALARY": 1000
    }
    
    Explicit
    
    {
    "SALARY": {"$eq": 1000}
    }
    
    Strings
    
    {
    "ENAME": {"$eq":"SMITH"}
    }
    
    Dates
    
    {
      "HIREDATE": {"$date": "1981-11-17T08:00:00Z"}
    }
    
    
    NOT EQUALS operator ($ne)
    
    Number
    
    {
    "SALARY": {"$ne": 1000}
    }
    
    String
    
    {
    "ENAME": {"$ne":"SMITH"}
    }
    
    Dates
    
    {
      "HIREDATE": {"$ne": {"$date":"1981-11-17T08:00:00Z"}}
    }
    
    
    LESS THAN operator ($lt)
    (Supports dates and numbers only)
    
    Numbers
    
    {
      "SALARY": {"$lt": 10000}
    }
    
    Dates
    
    {
      "SALARY": {"$lt": {"$date":"1999-12-17T08:00:00Z"}}
    }
    
    LESS THAN OR EQUALS operator ($lte)
    (Supports dates and numbers only)
    
    Numbers
    
    {
      "SALARY": {"$lte": 10000}
    }
    
    Dates
    
    {
      "HIREDATE": {"$lte": {"$date":"1999-12-17T08:00:00Z"}}
    }
    
    GREATER THAN operator ($gt)
    (Supports dates and numbers only)
    
    Numbers
    
    {
      "SALARY": {"$gt": 10000}
    }
    
    Dates
    
    {
      "SALARY": {"$gt": {"$date":"1999-12-17T08:00:00Z"}}
    }
    
    
    GREATER THAN OR EQUALS operator ($gte)
    (Supports dates and numbers only)
    
    Numbers
    
    {
      "SALARY": {"$gte": 10000}
    }
    
    Dates
    
    {
      "HIREDATE": {"$gte": {"$date":"1999-12-17T08:00:00Z"}}
    }
    

    In string operator ($instr)
    (Supports strings only)
    
    {
      "ENAME": {"$instr":"MC"}
    }
    
    
    Not in string operator ($ninstr)
    (Supports strings only)
    
    {
      "ENAME": {"$ninstr":"MC"}
    }
    
    
    #### LIKE operator ($like)
    (Supports strings. Eescape character not supported to try to match expressions with _ or % characters.)
    
    {
      "ENAME": {"$like":"AX%"}
    }
    
    
    #### BETWEEN operator ($between)
    (Supports string, dates, and numbers)
    
    Numbers
    
    {
      "SALARY": {"$between": [1000,2000]}
    }
    
    Dates
    
    {
      "SALARY": {"$between": [{"$date":"1989-12-17T08:00:00Z"},{"$date":"1999-12-17T08:00:00Z"}]}
    }
    
    Strings
    
    {
      "ENAME": {"$between": ["A","C"]}
    }
    
    Null Ranges ($lte equivalent) 
    (Supported by numbers and dates only)

    {
      "SALARY": {"$between": [null,2000]}
    }
    
    Null Ranges ($gte equivalent)
    (Supported by numbers and dates only)

    {
      "SALARY": {"$between": [1000,null]}
    }
    
    
    #### NULL operator ($null)
    
    {
      "ENAME": {"$null": null}
    }
    
    #### NOT NULL operator ($notnull)
    
    {
      "ENAME": {"$notnull": null}
    }
    
    
    #### AND operator ($and)
    (Supports all operators, including $and and $or)
    
    Column context delegation
    (Operators inside $and will use the closest context defined in the JSON tree.)

    {
      "SALARY": {"$and": [{"$gt": 1000},{"$lt":4000}]}
    }
    
    Column context override
    (Example: salary greater than 1000 and name like S%) 

    {
      "SALARY": {"$and": [{"$gt": 1000},{"ENAME": {"$like":"S%"}} ] }
    }
    
    Implicit and in columns
    
    ```
    {
      "SALARY": [{"$gt": 1000},{"$lt":4000}] 
    }
    ```
    
    High order AND
    (All first columns and or high order operators -- $and and $ors -- defined at the first level of the JSON will be joined and an implicit AND)
    (Example: Salary greater than 1000 and name starts with S or T)
    
    {
      "SALARY": {"$gt": 1000}, 
      "ENAME": {"$or": [{"$like":"S%"}, {"$like":"T%"}]} 
    }
    
    Invalid expression (operators $lt and $gt lack column context)
    
    {
      "$and": [{"$lt": 5000},{"$gt": 1000}]
    }
    
    Valid alternatives for the previous invalid expression
    
    {
      "$and": [{"SALARY": {"$lt": 5000}}, {"SALARY": {"$gt": 1000}}]
    }
    
    {
      "SALARY": [{"$lt": 5000},{"$gt": 1000}]
    }
    
    {
      "SALARY": {"$and": [{"$lt": 5000},{"$gt": 1000}]}
    }


    OR operator ($or)
    (Supports all operators including $and and $or)
    
    Column context delegation
    (Operators inside $or will use the closest context defined in the JSON tree)

    {
      "ENAME": {"$or": [{"$eq":"SMITH"},{"$eq":"KING"}]}
    }
    
    Column context override
    (Example: name starts with S or salary greater than 1000)

    {
      "SALARY": {"$or": [{"$gt": 1000},{"ENAME": {"$like":"S%"}} ] }
    }
