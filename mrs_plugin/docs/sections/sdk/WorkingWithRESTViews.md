<!-- Copyright (c) 2023, 2025, Oracle and/or its affiliates.

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

# Working with REST Views

## Create a New Document

To insert a new document on a REST view, the `create` API method is used.

### Example of Inserting a New Document

Given the REST view `/actor` defined as follows, this example shows how to insert a new document.

```sql
CREATE REST SERVICE IF NOT EXISTS /myService;

CREATE REST SCHEMA IF NOT EXISTS /sakila ON SERVICE /myService FROM sakila;

CREATE OR REPLACE REST VIEW /actor
    ON SERVICE /myService SCHEMA /sakila
    AS sakila.actor CLASS MyServiceSakilaActor @INSERT @UPDATE @DELETE {
        actorId: actor_id @SORTABLE @KEY,
        firstName: first_name,
        lastName: last_name,
        lastUpdate: last_update
    }
    AUTHENTICATION REQUIRED;
```

> Inserting a new document in the `actor` table does not require either the `actorId` field or the `lastUpdate` field because the former is an auto-generated primary key (`AUTO_INCREMENT`) whereas the latter maps to a column with a default value `CURRENT_TIMESTAMP()`.

**_TypeScript_**

```TypeScript
myService.sakila.actor.create({ data: { firstName: "FOO", lastName: "BAR" } })
```

**_Python_**

```py
my_service.sakila.actor.create(data={"first_name": "FOO", "last_name": "BAR"})
```

## Read Documents

To fetch documents from a REST view the family of `find` API commands is used. Each of these commands covers a specific use case when looking for documents.

| API Command | Description
| --- | ---
| findFirst() | Fetches the first document that was found.
| findFirstOrThrow() | Same as findFirst() but throws when there was no document found.
| findUnique() | Fetches the first document that matches a unique key lookup.
| findUniqueOrThrow() | Same as findUnique() but throws when there was no document found.
| findMany() | Fetches a page of the list of documents that were found.
| findEach() | Returns an iterator on the list of documents that were found, using a local page cache.

: Family of `find` API Commands

> Please not that exact spelling of the API commands depends on the actual SDK language used, as its specific naming conventions (e.g. snake_case for Python) are honored.

### Querying Data Across Relational Tables

MySQL supports foreign keys, which permit cross-referencing related data across tables, and foreign key constraints to help keep the related data consistent.

A foreign key relationship involves a parent table that holds the initial column values, and a child table with column values that reference the parent column values. A foreign key constraint is defined on the child table. Foreign keys enable establishing one-to-one, one-to-many or many-to-many relationships between rows in those tables.

With the MySQL REST Service, these relationships can be expanded to include related data from different tables embedded in the same result set with the REST data mapping view feature available for each MRS database object. The client can then select which columns should be expanded using a specific HTTP query syntax to specify and navigate along the nesting path of columns on other tables that are referenced by a root column in the main (or parent) table.

A key feature of the MRS SDK is the ability to query these relations between two database objects and include or exclude specific columns from the query response.

This feature is available using the `select` option in the following API commands:

- `findFirst()`
- `findMany()`
- `findUnique()`

By default, all the object fields (expanded or not) and their values are returned in the query response. Specific fields can be excluded from the query response using a plain object format in which the properties are the names of the fields to exclude and each value is `false`.

With a setup using the [Sakila Sample Database](https://dev.mysql.com/doc/sakila/en/) where the schema is available under a REST service called `myService` and the relationship between the city and country tables (one-to-one) is expanded via the REST data mapping view feature, the `lastUpdate` and `country.lastUpdate` fields can be excluded as follows:

```TypeScript
myService.sakila.city.findFirst({ select: { lastUpdate: false, country: { lastUpdate: false } } })
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
    "countryId": 87
  },
  "countryId": 87
}
```

In the same way, if the relationship between the `actor` and `film` tables (many-to-many) is expanded, the following command excludes the identifiers on each nested object:

```TypeScript
myService.sakila.actor.findFirst({ select: { filmActor: { actorId: false, film: { filmId: false, languageId: false, originalLanguageId: false } } } })
{
  {
  "links": [
    {
      "rel": "self",
      "href": "/myService/sakila/actor/58"
    }
  ],
  "actorId": 58,
  "lastName": "AKROYD",
  "filmActor": [
    {
      "film": {
        "title": "BACKLASH UNDEFEATED",
        "length": 118,
        "rating": "PG-13",
        "lastUpdate": "2006-02-15 05:03:42.000000",
        "rentalRate": 4.99,
        "description": "A Stunning Character Study of a Mad Scientist And a Mad Cow who must Kill a Car in A Monastery",
        "releaseYear": 2006,
        "rentalDuration": 3,
        "replacementCost": 24.99,
        "specialFeatures": "Trailers,Behind the Scenes"
      },
      "filmId": 48,
      "lastUpdate": "2006-02-15 05:05:03.000000"
    },
    // ...
  ],
  "firstName": "CHRISTIAN",
  "lastUpdate": "2006-02-15 04:34:33.000000"
}
```

On the other hand, fields can be cherry-picked and included in the query response by using either the same object format and setting the value to `true`, or alternatively, using a list of field names to include.

In the same way, this is possible for one-to-one relationships:

```TypeScript
myService.sakila.city.findFirst({ select: { city: true, country: { country: true } } })
{
  "city": "A Coruña (La Coruña)",
  "links": [
    {
      "rel": "self",
      "href": "/myService/sakila/city/1"
    }
  ],
  "country": {
    "country": "Spain",
  }
}
```

And also for many-to-many relationships:

```TypeScript
myService.sakila.actor.findFirst({ select: ['filmActor.film.title'] })
{
  {
  "links": [
    {
      "rel": "self",
      "href": "/myService/sakila/actor/58"
    }
  ],
  "filmActor": [
    {
      "film": {
        "title": "BACKLASH UNDEFEATED"
      }
    },
    {
      "film": {
        "title": "BETRAYED REAR"
      }
    }
    // ...
  ]
}
```

## Updating A Document

The SDK offers two different methods of how to update an existing document on a REST view.

1. Using the REST view `update` method.
   - REST view class exposes an `update` API method that can be called with the new document data. In this case, all fields, including the primary key fields need to be specified explicitly.
2. Using the Document API.
   - When a MRS document has been fetched before using the `find` API methods, the updates can be applied directly to the fields of that document. After all changes have been performed, the `update` method of the document object can be called. Please see the [Document API](#document-api-for-updates-and-deletes) section for more details.

### Updating a Document Using the REST View update Method

Updating a document on the REST view requires all fields to be specified if they are not nullable.

In the following example, neither `firstName` nor `lastName` are nullable and have to be specified. On the other hand, the `description` column in the `film_text` table is nullable.

**_TypeScript_**

```TypeScript
myService.sakila.actor.update({ data: { id: 1, firstName: "PENELOPE", lastName: "CRUZ" } }) // Property 'lastUpdate' is missing in type '{ actorId: number; lastName: string; firstName: string; }' but required in type 'IUpdateMyServiceSakilaActor'.
myService.sakila.filmText.update({ data: { film_id: 1, title: "FOO" } })
```

**_Python_**

```py
my_service.sakila.actor.update(data={"id": 1, "first_name": "PENELOPE", "last_name": "CRUZ"}) # Missing key "last_update" for TypedDict "IUpdateMyServiceSakilaActor"
my_service.sakila.film_text.update(data={"film_id": 1, "title": "FOO"})
```

### Updating a Document using the Document API

When fetching documents from REST view endpoints, the SDK offers a convenient API to work with those objects in a object-oriented way, by using `update` and `delete` methods that can be directly called on the document.

The `update` and `delete` methods are only available if the corresponding REST View enables the "UPDATE" and/or "DELETE" CRUD operations, respectively and specifies the appropriate identifier fields (mapping to underlying database primary keys).

> In the TypeScript SDK, the identifier fields that are part of a REST Document are read-only. This is currently not the case on the Python SDK.

**_TypeScript_**

```TypeScript
let actor = await my_service.sakila.actor.find_first()
if (actor) {
    console.log(actor.actorId) // 1
    console.log(actor.lastName) // "GUINESS"
    actor.lastName = "NOGUINESS"
    await actor.update()
}

actor = await my_service.sakila.actor.find_first()
if (actor) {
    console.log(actor.lastName) // "NOGUINESS"
    await actor.delete()
}

actor = await my_service.sakila.actor.find_first()
if (actor) {
    console.log(actor.actorId) // 2
}
```

**_Python_**

```py
actor = await my_service.sakila.actor.find_first()
if actor:
    print(actor.actor_id) # 1
    print(actor.last_name) # "GUINESS"
    actor.last_name = "NOGUINESS"
    await actor.update()

actor = await my_service.sakila.actor.find_first()
if actor:
    print(actor.last_name) # "NOGUINESS"
    await actor.delete()

actor = await my_service.sakila.actor.find_first()
if actor:
    print(actor.actor_id) # 2
```

### Language Specific Implementation Details

All MRS SDK commands that return back to the application one or more instances of REST documents perform some internal plumbing to simplify the client-side data structure, by ensuring that SDK-specific details such as protocol resource metadata (which includes things like ETags and GTIDs) or HATEOAS-specific properties (such as links and pagination control fields) are not exposed but are still able to be tracked at runtime. This is important because, even though those details are not supposed to be handled by an application, they can still determine specific behaviors when the application executes an SDK command.

For instance, when updating a REST document, the corresponding [ETag](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag) must be sent to the MySQL Router, in order to detect [mid-air collisions](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag#avoiding_mid-air_collisions) and make sure that changes happened in the document, after it was retrieved by the application in the first place, are not overridden. In the same way, a command executed by the application that can write data (`INSERT` or `UPDATE`) will spawn a server-side transaction that can generate a [GTID](https://dev.mysql.com/doc/refman/8.4/en/replication-gtids.html) which must also be sent to the MySQL Router if the application requires [read consistency](#read-your-writes-consistency) in a setup consisting of multiple server instances.

Hiding and locking these details involves either wrapping the actual data responses sent by the MySQL Router or applying specific access control constraints on top of the details available on those responses. In TypeScript, this is done by wrapping a client-side instance in a [`Proxy`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) object. In Python, this is done by wrapping it in a [`dataclass`](https://docs.python.org/3/library/dataclasses.html).

This results in something as follows:

```TypeScript
const actor = await myService.sakila.actor.findFirst()

try {
    delete actor._metadata
} catch (err) {
    console.log(err.message) // The "_metadata" property cannot be deleted.
}

try {
    actor._metadata = { foo: "bar" }
} catch (err) {
    console.log(err.message) // The "_metadata" property cannot be changed.
}
```

Additionally, these wrappers allow to augment the object representation of a REST Document with a small contextual API which contains utility commands (`update()` and `delete()`, names are self-describing) that operate directly in the scope of each particular document.

### Contextual fields and parameters

There are different requirements at play when inserting a new document or when updating an existing document in a Table or View using the MySQL REST Service. For starters, since there is currently no support for partial updates, this means that every time an application wants to update a row, it needs to provide a complete representation of the row as it will become. That representation can still determine potential columns which will be "unset" notwithstanding, at least for those cases where the columns do not impose a constraint that prevents such an action (this is in line with what happens on [ORDS](https://docs.oracle.com/en/database/oracle/oracle-rest-data-services/24.2/orddg/developing-REST-applications.html#GUID-A323AA4F-32BE-47B7-9CC2-C0F4C8F4DFBE)). On the other hand, even though there is no specific limitation for inserting new rows, an application should still be aware of the underlying column constraints to reduce the friction by requiring the minimum possible set of fields or alternatively, provide better user feedback (e.g. using the type checker) when it comes to missing fields required to perform the operation.

From the MRS SDK standpoint this means that the type definitions used to insert and update rows must be capable of making the distinction between required and optional fields. In practice, a field should always be required unless there is some specific circumstance that allows it to be optional such as the fact that it maps to an auto-generated primary key column, a foreign key column, a nullable column or a column with a default value. Whilst inserting a value, all of these circumstances are valid and should be accounted for, whereas whilst updating a value, due to the limitations described above, it only makes sense for a field to be optional when it maps to a nullable column or column with row ownership.

## Deleting A Document

Similar to updating a document, deleting a document can be done using either the REST view `delete` method or the Document API `delete` method called directly on the object.

Please see above to learn how to delete a document via the Document API.

## Read Your Writes Consistency

With multiple MySQL server instances running as an InnoDB Cluster/ClusterSet, data read from one instance might be dependent on data written on a different instance, which might not have been yet replicated to the server where the data is being read from. This is a classical concern on distributed systems which alludes to the consistency of the data and the problem has been formalized as a concept called [Read Your Writes](https://jepsen.io/consistency/models/read-your-writes).

To solve this issue, and ensure an application is always able to read its own writes, MySQL uses a Global Transaction ID (GTID), whose definition, according to the official [documentation](https://dev.mysql.com/doc/refman/8.4/en/replication-gtids-concepts.html), is:

A global transaction identifier (GTID) is a unique identifier created and associated with each transaction committed on the server of origin (the source). This identifier is unique not only to the server on which it originated, but is unique across all servers in a given replication topology.

It is, in essence, and in layman's terms, an identifier that is provided to a client for each "write" operation, which the client can then provide back to the MySQL server cluster which can use it to ensure any subsequent read accounts for all the data written up until the operation that generated that GTID. This usually carries a cost, and for that reason, is a behavior that needs to be explicitly enabled by the end user depending on what kind of topology an application is using.

In the MySQL REST Service, it is possible to ensure an application is able to read its own writes consistently in a cluster of MySQL instances only when retrieving resources or deleting resources. Using the TypeScript SDK, this can be done with the `readOwnWrites` option available for the following commands:

  - `findFirst()`
  - `findFirstOrThrow()`
  - `findUnique()`
  - `findUniqueOrThrow()`
  - `findMany()`
  - `findAll()`
  - `delete()`
  - `deleteMany()`

```TypeScript
myService.sakila.actor.findFirst({ readOwnWrites: true })
```

This option is only relevant when the application is running on top of a MySQL instance cluster where the GTID infrastructure is specifically configured and enabled, otherwise the option will be ignored.
