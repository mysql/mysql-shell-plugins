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

# JSON-Relational Duality Views

## Introduction to Duality Views

Duality views combine the advantages of relational schemas with the ease-of-use of document databases. They give your data a conceptual and an operational duality as it is organized both relationally and hierarchically. You can base different duality views on data stored in one or more of the same tables, providing different JSON hierarchies over the same, shared data. This means that applications can access (create, query, modify) the same data as a collection of JSON documents or as a set of related tables and columns, and both approaches can be employed at the same time.

### Use Cases

The MySQL REST Service offers full support for duality views. They are used to cover both, the relational use case (1) as well as the document centric use case (2).

1. Make a single relational table or view available via a REST endpoint
    - Exposes the rows of a table as a set of **flat** JSON documents
    - Allows the application to use a traditional relational approach when needed
2. Create a single REST endpoint for a set of related database schema tables
    - Exposes the related tables as **nested** JSON objects inside a set of JSON documents
    - Allows the application to take an document oriented approach

The following figure visualizes these two use cases.

![JSON Relational Duality - Use Cases](../../images/json-relational-duality-use-cases.svg "JSON Relational Duality - Use Cases")

### REST Duality View Workflow

In the scope of the MySQL REST Service, JSON-Relational duality views are exposed as REST duality views. These can be created using the [CREATE REST DUALITY VIEW](sql.html#create-rest-duality-view) MRS DDL statement or [interactively using the MRS Object Dialog](#interactive-duality-view-design) of the MySQL Shell for VS Code extension.

Once a REST duality view has been created, it is extremely simple to access it using REST. The following workflow applies.

- GET a document from the REST duality view
- Make any changes needed to the document, including changes to the nested JSON objects
- PUT the document back into the REST duality view

The next figure shows a typical JSON document update cycle.

![JSON Relational Duality - Update Cycle](../../images/json-relational-duality-update-cycle.svg "JSON Relational Duality - Update Cycle")

The database automatically detects the changes in the new document and modifies the underlying rows, including all nested tables. All duality views that share the same data immediately reflect this change. This drastically simplifies application development since developers no longer have to worry about inconsistencies, compared to using traditional document databases.

## Lock-Free Optimistic Concurrency Control

Duality Views can be safely updated concurrently without the use of locks. Objects fetched from the database have a checksum computed, which is called ETag and is included in the returned object, in the `_metadata.etag` field.

When that object is submitted back to MRS to be updated (via PUT), the ETag of the original object is compared to the current version of the ETag. If the rows corresponding to the object have changed since it was first fetched, the ETag would not match. In that case, the request fails with HTTP status code 412. The client must then fetch the object again and re-submit its update request based on an up-to-date version of the object.

The object checksum includes all fields of the source row as well as any rows joined/included, even filtered fields. Fields can be explicitly excluded using the `@nocheck` attribute.

**_Example_**

If at first, `GET /myService/sakila/city/1` returns the following JSON document to the client.

```json
{
    "city": "A Corua (La Corua)",
    "links": [
        {
            "rel": "self",
            "href": "/myService/sakila/city/1"
        }
    ],
    "cityId": 1,
    "country": {
        "country": "Spain",
        "countryId": 87,
        "lastUpdate": "2006-02-15 04:44:00.000000"
    },
    "countryId": 87,
    "lastUpdate": "2006-02-15 04:45:25.000000",
    "_metadata": {
        "etag": "FFA2187AD4B98DF48EC40B3E807E0561A71D02C2F4F5A3B953AA6CB6E41CAD16"
    }
}
```

Next, the client updates the object and changes the city name to `A Coruña (La Coruña)` and submits it by calling `PUT /myService/sakila/city/1`.

```json
{
    "city": "A Coruña (La Coruña)",
    "links": [
        {
            "rel": "self",
            "href": "/myService/sakila/city/1"
        }
    ],
    "cityId": 1,
    "country": {
        "country": "Spain",
        "countryId": 87,
        "lastUpdate": "2006-02-15 04:44:00.000000"
    },
    "countryId": 87,
    "lastUpdate": "2006-02-15 04:45:25.000000",
    "_metadata": {
        "etag": "FFA2187AD4B98DF48EC40B3E807E0561A71D02C2F4F5A3B953AA6CB6E41CAD16"
    }
}
```

If the target object has been changed (e.g. by another user) between the `GET` and the `PUT` requests, the ETag check would fail and the PUT would result in error `412 Precondition Failed`.

## Interactive Duality View Design

While REST duality views can be created by manually writing [CREATE REST DUALITY VIEW](sql.html#create-rest-duality-view) MRS DDL statements, it is often much easier to design REST duality views in a visual editor.

[MySQL Shell for VS Code](https://marketplace.visualstudio.com/items?itemName=Oracle.mysql-shell-for-vs-code) includes the MySQL REST Object dialog which features an advanced `JSON/Relational Duality` designer. Using this designer it is possible to create even complex, nested REST duality views within seconds.

The `DDL Preview` button allows to preview the corresponding MRS DDL statement while interactively designing the REST duality view.

### Building a JSON/Relational Duality View

Building a REST duality view for a single relational table (or view) is straight forward. Using MySQL Shell for VS Code to [add the database schema table](adding-a-schema-object-with-mysql-shell-for-vs-code-ui) automatically creates the corresponding REST duality view containing all columns of the table in a **flat** JSON object.

![JSON Relational Editor](../../images/vsc-mrs-json-relational-editor.svg "JSON Relational Editor")

Adding the database schema table via VS Code is equal to calling the [CREATE REST DUALITY VIEW](sql.html#create-rest-duality-view) MRS DDL statement without a `graphQlObj` definition, which also adds all columns of the table as a **flat** JSON object.

```sql
CREATE OR REPLACE REST DUALITY VIEW /city
AS `sakila`.`city`
AUTHENTICATION REQUIRED;

SHOW CREATE REST VIEW /city;
```

```txt
+-----------------------------------------------+
| CREATE REST DUALITY VIEW                      |
+-----------------------------------------------+
| CREATE OR REPLACE REST DUALITY VIEW /city     |
|     ON SERVICE /myTestService SCHEMA /sakila  |
|     AS sakila.city {                          |
|         cityId: city_id,                      |
|         city: city,                           |
|         countryId: country_id,                |
|         lastUpdate: last_update               |
|     }                                         |
|     AUTHENTICATION REQUIRED;                  |
+-----------------------------------------------+
```

> Note: In order to be able to access the REST object without authentication, the `Requires Auth` checkbox needs to be unchecked in the MySQL REST Object dialog or the `AUTHENTICATION NOT REQUIRED` clause needs to be added to the MRS DDL statement. This should only be done during development time or when a REST endpoint should be publicly available.

#### Enabling CRUD Operations

Since only the `READ` CRUD operation is enabled by default (see the `R` being highlighted next to the relational object), only read commands will be allowed on the REST object. To change this, toggle each `CRUD` letter (`C` - Create, `R` - Read, `U` - Update and `D` - Delete) to enable or disable the corresponding functionality in the MySQL REST Object dialog.

The same can be achieved by using annotations in the MRS DDL statement.

```sql
CREATE OR REPLACE REST DUALITY VIEW /city
AS `sakila`.`city` @INSERT @UPDATE @DELETE
AUTHENTICATION REQUIRED;
```

The following table shows the mapping between CRUD operations and SQL operations.

| Letter | CRUD Operation | SQL Operation |
|---|---|---|
| C | CREATE | CREATE |
| R | READ | SELECT |
| U | UPDATE | UPDATE |
| D | DELETE | DELETE |

### Creating a Nested JSON/Relational Duality View

By enabling a referenced table, the columns of that table are included as a nested entry in the JSON result. Please note that this works with 1:1 and 1:n relationships.

![Adding a Referenced Table](../../images/vsc-mrs-json-relational-editor-2-referenced-table.png "Adding a Referenced Table")

This leads to the following result.

```js
myService.sakila.city.findFirst();
```

```json
{
    "city": "A Corua (La Corua)",
    "links": [
        {
            "rel": "self",
            "href": "/myService/sakila/city/1"
        }
    ],
    "cityId": 1,
    "country": {
        "country": "Spain",
        "countryId": 87,
        "lastUpdate": "2006-02-15 04:44:00.000000"
    },
    "countryId": 87,
    "lastUpdate": "2006-02-15 04:45:25.000000",
    "_metadata": {
        "etag": "FFA2187AD4B98DF48EC40B3E807E0561A71D02C2F4F5A3B953AA6CB6E41CAD16"
    }
}
```

### Creating a JSON/Relational Duality View with an Unnested Referenced Table

If the columns of the referenced table should be added to the level above, the `Unnest` option can be enabled.

![Unnest a Referenced Table](../../images/vsc-mrs-json-relational-editor-3-referenced-table-unnested.png "Unnest a Referenced Table")

This leads to the following result.

```js
myService.sakila.city.findFirst();
```

```json
{
    "city": "A Corua (La Corua)",
    "links": [
        {
            "rel": "self",
            "href": "/myService/sakila/city/1"
        }
    ],
    "cityId": 1,
    "country": "Spain",
    "countryId": 87,
    "lastUpdate": "2006-02-15 04:45:25.000000",
    "_metadata": {
        "etag": "48889BABCBBA1491D25DFE0D7A270FA3FDF8A16DA8E44E42C61759DE1F0D6E35"
    }
}
```

### Creating a JSON/Relational Duality View with a Reduced Referenced Table

Instead of having all columns unnested and disabling all columns that are not wanted, the `Reduce to...` dropdown can be used to select the column that should be selected for the reduce operation.

![A Reduced Referenced Table](../../images/vsc-mrs-json-relational-editor-4-referenced-table-reduced.png "A Reduced Referenced Table")

This leads to the same result as the query above.

```js
myService.sakila.city.findFirst();
```

```json
{
    "city": "A Corua (La Corua)",
    "links": [
        {
            "rel": "self",
            "href": "/myService/sakila/city/1"
        }
    ],
    "cityId": 1,
    "country": "Spain",
    "countryId": 87,
    "lastUpdate": "2006-02-15 04:45:25.000000",
    "_metadata": {
        "etag": "48889BABCBBA1491D25DFE0D7A270FA3FDF8A16DA8E44E42C61759DE1F0D6E35"
    }
}
```
