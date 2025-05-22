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

# Checking for NULL Column Values

MySQL supports `NOT NULL` constraints which ensure that the value in a given column cannot be NULL. By omission though, a column can hold `NULL` values. With the MySQL REST Service, records containing columns with NULL values can be included in or excluded from the result set using the `$null` or `$notnull` operators.

The TypeScript MRS SDK provides a special syntax for filtering records in a result set by a given field when it contains (or not) a `NULL` value. With a setup using the [Sakila Sample Database](https://dev.mysql.com/doc/sakila/en/) where the schema is available under a REST service called `myService`, filtering records by `NULL` column values can be done as follows:

```TypeScript
myService.sakila.address.find({ select: ["address", "address2"], where: { address2: null } })
[
    {
      "address": "47 MySakila Drive",
      "address2": null,
    },
    {
      "address": "28 MySQL Boulevard",
      "address2": null,
    },
    {
      "address": "23 Workhaven Lane",
      "address2": null,
    },
    {
      "address": "1411 Lillydale Drive",
      "address2": null,
    }
]
```

In the same way, filtering records where a given column does not contain `NULL` can be done as follows:

```TypeScript
myService.sakila.actor.findFirst({ select: ["address", "address2"], where: { address2: { not: null } } })
{
  "address": "1913 Hanoi Way",
  "address2": "",
}
```

Attempting to apply such a filter to a field that maps to a column with a `NOT NULL` constraint should yield a TypeScript compilation error:

```TypeScript
myService.sakila.actor.findFirst({ where: { address: null } })
```

```
Type 'null' is not assignable to type 'string | DataFilterField<IMyServiceSakilaAddressParams, string | undefined> | ComparisonOpExpr<string | undefined>[] | undefined'.
```
