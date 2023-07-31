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

# Checking for NULL Column Values

MySQL supports `NOT NULL` constraints which ensure that the value in a given column cannot be NULL. By omission though, a column can hold `NULL` values. With the MySQL REST Service, records containing columns with NULL values can be included in or excluded from the result set using the `$null` or `$notnull` operators.

The TypeScript MRS SDK provides a special syntax for filtering records in a result set by a given field when it contains (or not) a `NULL` value. With a setup using the [Sakila Sample Database](https://dev.mysql.com/doc/sakila/en/) where the schema is available under a REST service called `myService`, filtering records by `NULL` column values can be done as follows:

```TypeScript
myService.sakila.address.findMany({ select: ["address", "address2"], where: { address2: null } })
{
  "items": [
    {
      "links": [
        {
          "rel": "self",
          "href": "/myService/sakila/address/1"
        }
      ],
      "address": "47 MySakila Drive",
      "address2": null,
      "_metadata": {
        "etag": "44EA44E1541A6A0A24135C4CC4F30E52AA2B4256181DE9BC1960C78A35F33B27"
      }
    },
    {
      "links": [
        {
          "rel": "self",
          "href": "/myService/sakila/address/2"
        }
      ],
      "address": "28 MySQL Boulevard",
      "address2": null,
      "_metadata": {
        "etag": "C5C68338EBF92980E1B8FDAE3FE7E3CE9507C4169C3DEC1BDB4E9AF2D961E00D"
      }
    },
    {
      "links": [
        {
          "rel": "self",
          "href": "/myService/sakila/address/3"
        }
      ],
      "address": "23 Workhaven Lane",
      "address2": null,
      "_metadata": {
        "etag": "7EF99DD02DF9071C8946B6180E74EB11D6B47FDD03A36C9B44B920F2A8D3684B"
      }
    },
    {
      "links": [
        {
          "rel": "self",
          "href": "/myService/sakila/address/4"
        }
      ],
      "address": "1411 Lillydale Drive",
      "address2": null,
      "_metadata": {
        "etag": "5F4F5E570F2AF2BB5E5A7AE41548CE4965F715F7C040A80B42D0DB79BB57336B"
      }
    }
  ],
  "limit": 25,
  "offset": 0,
  "hasMore": false,
  "count": 4,
  "links": [
    {
      "rel": "self",
      "href": "/myService/sakila/address/"
    }
  ]
}
```

In the same way, filtering records where a given column does not contain `NULL` can be done as follows:

```TypeScript
myService.sakila.actor.findFirst({ select: ["address", "address2"], where: { address2: { not: null } } })
{
  "links": [
    {
      "rel": "self",
      "href": "/myService/sakila/address/5"
    }
  ],
  "address": "1913 Hanoi Way",
  "address2": "",
  "_metadata": {
    "etag": "689439C1F6D1F101E9A146F8DE244F01F0CE40AEBFA92AE5CEABA119F9C1573E"
  }
}
```

Attempting to apply such a filter to a field that maps to a column with a `NOT NULL` constraint should yield a TypeScript compilation error:

```TypeScript
myService.sakila.actor.findFirst({ where: { address: null } })
```

```
Type 'null' is not assignable to type 'string | DataFilterField<IMyServiceSakilaAddressParams, string | undefined> | ComparisonOpExpr<string | undefined>[] | undefined'.
```
