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

# TypeScript Client API Reference

## findUnique

`findUnique` is used to query a single, uniquely identified record by

- Primary key column(s)
- Unique column(s)

If no record was found matching the given `where` condition, `undefined` is returned. To have an exception thrown in this case please see [findUniqueOrThrow](#finduniqueorthrow).

### Options (findUnique)

| Name | Example | Required | Description |
|---|---|---|---|
| where |  | Yes | Wraps all unique columns so that individual records can be selected. |
| select |  | No | Specifies which properties to include in the returned object. |

### Return Type (findUnique)

A JSON object representing the found record or `undefined` when the record was not found.

### Reference (findUnique)

```TypeScript
export interface IFindUniqueOptions {
    select?: ResultFields<C> | ColumnNames<C>,
    where: DataFilter<T>,
}
```

### Example (findUnique)

Get the note with id 4.

```TypeScript
const note = await myService.mrsNotes.note.findUnique({ where: { id: 4} });
```

## findUniqueOrThrow

`findUniqueOrThrow` retrieves a single data record in the same way as [findUnique](#findunique). However, if the query does not find a record, it throws a `NotFoundError`.

`findUniqueOrThrow` differs from `findUnique` as follows:

- Its return type is non-nullable. For example, myService.mrsNotes.note.findUnique() can return a note or undefined, but myService.mrsNotes.note.findUniqueOrThrow() always returns a note.
