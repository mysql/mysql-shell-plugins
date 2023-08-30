<!-- Copyright (c) 2023, Oracle and/or its affiliates.

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

# Querying Data Across Tables

MySQL supports foreign keys, which permit cross-referencing related data across tables, and foreign key constraints to help keep the related data consistent.

A foreign key relationship involves a parent table that holds the initial column values, and a child table with column values that reference the parent column values. A foreign key constraint is defined on the child table. Foreign keys enable establishing one-to-one, one-to-many or many-to-many relationships between rows in those tables.

With the MySQL REST Service, these relationships can be expanded to include related data from different tables embedded in the same result set with the JSON Relational duality feature available for each MRS database object. The client can then select which columns should be expanded using a specific HTTP query syntax to specify and navigate along the nesting path of columns on other tables that are referenced by a root column in the main (or parent) table.

A key feature of the MRS SDK is the ability to query these relations between two database objects and include or exclude specific columns from the query response.

This feature is available using the `select` option in the following API commands:

  - `findFirst()`
  - `findMany()`
  - `findUnique()`

By default, all the object fields (expanded or not) and their values are returned in the query response. Specific fields can be excluded from the query response using a plain object format in which the properties are the names of the fields to exclude and each value is `false`.

With a setup using the [Sakila Sample Database](https://dev.mysql.com/doc/sakila/en/) where the schema is available under a REST service called `myService` and the relationship between the city and country tables (one-to-one) is expanded via the JSON/Relational duality feature, the `lastUpdate` and `country.lastUpdate` fields can be excluded as follows:

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
