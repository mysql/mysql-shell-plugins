<!-- Copyright (c) 2022, 2024, Oracle and/or its affiliates.

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

# TypeScript Client API Reference

## authenticate

`authenticate` is used to authenticate in a given service using a given authentication app.

## Options (authenticate)

| Name | Type | Required | Description
|---|---|---|---|
| username | string | Yes | Username in the scope of the authentication app. |
| password | string | No | Password in the scope of the authentication app. |
| authApp  | string | Yes | Name of the authentication app. |

## Return Type (authenticate)

Nothing (void).

## Reference (authenticate)

```TypeScript
async function authenticate (IAuthenticateOptions): Promise<void> {
    // ...
}

interface IAuthenticateOptions {
    username: string
    password: string
    authApp: string
}
```

## Example (authenticate)

```TypeScript
import { MyService } from './myService.mrs.sdk/myService';

const myService = new MyService();

myService.authenticate({ username: 'foo', password: 'bar', authApp: 'baz' });
```

## create

`create` is used to insert a record in a given table. The record is represented as a plain TypeScript/JavaScript object or, alternatively, as an instance of a particular class that encapsulates the data required to create a new record. To insert multiple records, see `createMany`[#createmany].

### Options (create)

| Name | Type | Required | Description
|---|---|---|---|
| data  | object | Yes | Object containing the mapping between column names and values for the record to be inserted. |

### Return Type (create)

A JSON object representing the inserted record.

### Reference (create)

```TypeScript
async function create (args: ICreateOptions<Type>): Promise<Type> {
    // ...
}

interface ICreateOptions<Type> {
    data: Type
}
```

### Example (create)

```TypeScript
import type { IMyServiceMrsNotesNote } from '/path/to/sdk/myService';
import { MyService } from './myService.mrs.sdk/myService';

const myService = new MyService();

// using a plain object
myService.mrsNotes.note.create({ data: { title: 'foo' } });

// using a custom class instance
class Note implements IMyServiceMrsNotesNote {
    // ...
}

const note = new Note();
note.title = 'foo';

myService.mrsNotes.note.create({ data: note });
```

## createMany

`createMany` inserts one or more records in a given table. The records are represented as plain TypeScript/JavaScript objects, or alternatively, as instances of a particular class that encapsulates the data required to create them.

### Options (create)

| Name | Type | Required | Description
|---|---|---|---|
| data  | object | Yes | Array of objects containing the mapping between column names and values for the records to be inserted. |

### Return Type (createMany)

An array of JSON objects representing the inserted records.

### Reference (createMany)

```TypeScript
async function createMany (args: ICreateOptions<Type[]>): Promise<Type[]> {
    // ...
}

interface ICreateOptions<Type> {
    data: Type
}
```

### Example (createMany)

```TypeScript
import type { IMyServiceMrsNotesNote } from '/path/to/sdk/myService';
import { MyService } from './myService.mrs.sdk/myService';

const myService = new MyService();

// using a plain object
myService.mrsNotes.note.createMany({ data: [{ title: 'foo' }, { title: 'bar' }] });

// using a custom class
class Note implements IMyServiceMrsNotesNote {
    // ...
}

const note1 = new Note();
note1.title = 'foo';

const note2 = new Note({ /* */ });
note1.title = 'bar';

myService.mrsNotes.note.createMany({ data: [note1, note2] });
```

## findFirst

`findFirst` is used to query the first record (**in no specific order**) that matches a given optional filter.

### Options (findFirst)

| Name | Type | Required | Description |
|---|---|---|---|
| where | object | No | Filtering conditions that apply to specific fields. |
| select | object | No | Specifies which properties to include in the returned object. |
| skip  | number | No | Specifies how many records to skip before returning one of the matches. |
| readOwnWrites | boolean | No | Ensures read consistency for a cluster of servers. |

### Return Type (findFirst)

A JSON object representing the first record that matches the filter or `undefined` when the record was not found.

### Reference (findFirst)

```TypeScript
async function findFirst (args?: IFindOptions<Selectable, Filterable>): Promise<Selectable | undefined> {
    // ...
}

export interface IFindOptions<Selectable, Filterable> {
    orderBy?: ColumnOrder<Filterable>;
    select?: BooleanFieldMapSelect<Selectable> | FieldNameSelect<Selectable>;
    skip?: number;
    where?: DataFilter<Filterable>;
    readOwnWrites?: boolean;
}
```

### Example (findFirst)

```TypeScript
import { MyService } from './myService.mrs.sdk/myService';

const myService = new MyService();

// get the first note, without any filter
await myService.mrsNotes.note.findFirst();
// get the last note, without any filter
await myService.mrsNotes.note.findFirst({ orderBy: { id: "DESC" } });
// get the second note, without any filter
await myService.mrsNotes.note.findFirst({ skip: 1 });
// get the title and shared fields of the second note
await myService.mrsNotes.note.findFirst({ select: { title: true, shared: true }, skip: 1 });
// get the title and shared fields of the first note
await myService.mrsNotes.note.findFirst({ select: ["title", "shared"] });
// get the first shared note
await myService.mrsNotes.note.findFirst({ where: { shared: true } });
// get the first note whose title includes the string "foo"
await myService.mrsNotes.note.findFirst({ where: { title: { $like: "%foo%" } } });
```

## findUnique

`findUnique` is used to query a single, uniquely identified record by:

- Primary key column(s)
- Unique column(s)

If no record was found matching the given `where` condition, `undefined` is returned. To have an exception thrown in this case, see [findUniqueOrThrow](#finduniqueorthrow).

### Options (findUnique)

| Name | Type | Required | Description |
|---|---|---|---|
| where | object | Yes | Wraps all unique columns so that individual records can be selected. |
| select | object | No | Specifies which properties to include in the returned object. |
| readOwnWrites | boolean | No | Ensures read consistency for a cluster of servers. |

### Return Type (findUnique)

A JSON object representing the specific record that matches the filter or `undefined` when the record was not found.

### Reference (findUnique)

```TypeScript
async function findUnique (args?: IFindUniqueOptions<Selectable, Filterable>): Promise<Selectable | undefined> {
    // ...
}

interface IFindUniqueOptions<Selectable, Filterable> {
    select?: BooleanFieldMapSelect<Selectable> | FieldNameSelect<Selectable>;
    where?: DataFilter<Filterable>;
    readOwnWrites?: boolean;
}
```

### Example (findUnique)

```TypeScript
import { MyService } from './myService.mrs.sdk/myService';

const myService = new MyService();

// Get the note with id 4.
// using implicit equality
await myService.mrsNotes.note.findUnique({ where: { id: 4 } });
// or using explicit equality
await myService.mrsNotes.note.findUnique({ where: { id: { $eq: 4 } } });
```

## findUniqueOrThrow

`findUniqueOrThrow` retrieves a single data record in the same way as [findUnique](#findunique). However, if the query does not find a record, it throws a `NotFoundError`.

`findUniqueOrThrow` differs from `findUnique` as follows:

- Its return type is non-nullable. For example, myService.mrsNotes.note.findUnique() can return a note or undefined, but myService.mrsNotes.note.findUniqueOrThrow() always returns a note.

## findMany

`findMany` is used to query a subset of records in one or more pages, and optionally, those that match a given filter. To find all records see [findAll](#findall).

### Options (findMany)

| Name | Type | Required | Description |
|---|---|---|---|
| cursor | object | No | Retrieve records using unique and sequential fields as cursor. |
| iterator | boolean | No | Enable or disable iterator behavior. |
| orderBy | object | No | Determines the sort order of specific fields. |
| select | object | No | Specifies which properties to include in the returned object. |
| skip  | number | No | How many records to skip before returning one of the matches. |
| where | object  | No | Filtering conditions that apply to specific fields. |
| take  | number | No | Maximum number of records to return. |
| readOwnWrites | boolean | No | Ensures read consistency for a cluster of servers. |

### Return Type (findMany)

An array of JSON objects representing the records that match the filter.

### Reference (findMany)

```TypeScript
async function findMany ({ cursor, iterator = true, orderBy, select, skip, take, where }: IFindManyOptions<Item, Filterable, Cursors>): Promise<Item[]> {
    // ...
}

interface IFindManyOptions<Item, Filterable, Iterable> {
    cursor?: Cursor<Iterable>;
    iterator?: boolean;
    orderBy?: ColumnOrder<Filterable>;
    select?: BooleanFieldMapSelect<Item> | FieldNameSelect<Item>;
    skip?: number;
    take?: number;
    where?: DataFilter<Filterable>;
    readOwnWrites?: boolean;
}
```

### Example (findMany)

```TypeScript
import { MyService } from './myService.mrs.sdk/myService';

const myService = new MyService();

// get all notes of the first page
await myService.mrsNotes.note.findMany();
// get the first 3 notes
await myService.mrsNotes.note.findMany({ take: 3 });
// get notes of then first page where the id is greater than 10
await myService.mrsNotes.note.findMany({ where: { id: { $gt: 10 } } });
```

## findAll

`findAll` is used to query every record, and optionally, all those that match a given filter. To get a paginated subset of records, see [findMany](#findmany).

### Options (findAll)

| Name | Type | Required | Description |
|---|---|---|---|
| cursor | object | No | Retrieve records using unique and sequential fields as cursor. |
| orderBy | object | No | Determines the sort order of specific fields. |
| progress | function | No | Specifies a function to be called back when reporting progress. |
| select | object | No | Specifies which properties to include in the returned object. |
| skip  | number | No | How many records to skip before returning one of the matches. |
| where | object  | No | Filtering conditions that apply to specific fields. |
| readOwnWrites | boolean | No | Ensures read consistency for a cluster of servers. |

### Return Type (findAll)

An array of JSON objects representing the records that match the filter.

### Reference (findAll)

```TypeScript
async function findAll (args?: IFindAllOptions<Item, Filterable>): Promise<Item[]> {
    // ...
}

interface IFindAllOptions<Item, Filterable> {
    cursor?: Cursor<Iterable>;
    orderBy?: ColumnOrder<Filterable>;
    progress?: progress?: (items: Item[]) => Promise<void>;
    select?: BooleanFieldMapSelect<Item> | FieldNameSelect<Item>;
    skip?: number;
    where?: DataFilter<Filterable>;
    readOwnWrites?: boolean;
}
```

### Example (findAll)

```TypeScript
import { MyService } from './myService.mrs.sdk/myService';

const myService = new MyService();

// get all notes
await myService.mrsNotes.note.findAll();
// get all notes after the first 10
await myService.mrsNotes.note.findAll({ skip: 10 });
// get all notes and report the progress
await myService.mrsNotes.note.findMany({ progress: (notes) => {
    console.log(`Retrieved ${notes.length} notes.`);
}});
```

## delete

`delete` is used to delete the first record that matches a given required filter.

### Options (delete)

| Name | Type | Required | Description |
|---|---|---|---|
| where | object | Yes | Filtering conditions that apply to specific fields. |
| readOwnWrites | boolean | No | Ensures read consistency for a cluster of servers. |

### Return Type (delete)

A JSON object containing the number of records that were deleted (always 1).

### Reference (delete)

```TypeScript
async function delete (args: IDeleteOptions<IMyServiceMrsNotesUserParams>): Promise<IMrsDeleteResult> {
    // ...
}

interface IDeleteOptions<Filterable> {
    where?: DataFilter<Filterable>;
    readOwnWrites?: boolean;
}

interface IMrsDeleteResult {
    itemsDeleted: 1;
}
```

### Example (delete)

```TypeScript
import { MyService } from './myService.mrs.sdk/myService';

const myService = new MyService();

// delete the first note whose title includes the string "foo"
await myService.mrsNotes.note.delete({ where: { title: { $like: "%foo%" } } });
```

## deleteMany

`delete` is used to delete all records that match a given filter.

### Options (deleteMany)

| Name | Type | Required | Description |
|---|---|---|---|
| where | object | No | Filtering conditions that apply to specific fields. |
| readOwnWrites | boolean | No | Ensures read consistency for a cluster of servers. |

### Return Type (deleteMany)

A JSON object containing the number of records that were deleted.

### Reference (deleteMany)

```TypeScript
async function deleteMany (args: IDeleteOptions<IMyServiceMrsNotesUserParams>): Promise<IMrsDeleteResult> {
    // ...
}

interface IDeleteOptions<Filterable> {
    where?: DataFilter<Filterable>;
    readOwnWrites: boolean;
}

interface IMrsDeleteResult {
    itemsDeleted: number;
}
```

### Example (deleteMany)

```TypeScript
import { MyService } from './myService.mrs.sdk/myService';

const myService = new MyService();

// delete all notes whose title includes the string "foo"
await myService.mrsNotes.note.deleteMany({ where: { title: { $like: "%foo%" } } });
// delete all shared notes
await myService.mrsNotes.note.deleteMany({ where: { shared: true } });
```

## update

`update` is used to update a record with a given identifier or primary key.

### Options (update)

| Name | Type | Required | Description |
|---|---|---|---|
| data | object | Yes | Set of fields and corresponding values to update. |

### Return Type (update)

A JSON object representing the up-to-date record.

### Reference (update)

```TypeScript
async function update (args: IUpdateOptions<UpdatableFields>): Promise<Data> {
    // ...
}

type IUpdateOptions<Type> = ICreateOptions<Type>;
```

### Example (update)

```TypeScript
import type { IMyServiceMrsNotesNote } from '/path/to/sdk/myService';
import { MyService } from './myService.mrs.sdk/myService';

const myService = new MyService();

// update the note with id is 1 using a plain object
await myService.mrsNotes.note.update({ data: { id: 1, title: 'bar' } });

// using a custom class instance
class Note implements IMyServiceMrsNotesNote {
    // ...
}

const note = new Note();
note.id = 1
note.shared = false;

// update the note with id 1
await myService.mrsNotes.note.update({ data: note });
```

## updateMany

`updateMany` is used to update all records with matching identifiers or primary keys.

### Options (updateMany)

| Name | Type | Required | Description |
|---|---|---|---|
| data | object | Yes | Set of fields and corresponding values to update. |

### Return Type (updateMany)

An array of JSON objects representing the up-to-date records.

### Reference (updateMany)

```TypeScript
async function updateMany (args: IUpdateOptions<UpdatableFields[]>): Promise<Data[]> {
    // ...
}

type IUpdateOptions<Type> = ICreateOptions<Type>;
```

### Example (updateMany)

```TypeScript
import type { IMyServiceMrsNotesNote } from '/path/to/sdk/myService';
import { MyService } from './myService.mrs.sdk/myService';

const myService = new MyService();

// update the notes with id 1 and 2 using a plain object
await myService.mrsNotes.note.update({ data: [{ id: 1, title: 'bar' }, { id: 2, title: 'bar' }] });

// using a custom class instance
class Note implements IMyServiceMrsNotesNote {
    // ...
}

const note1 = new Note();
note.id = 1;
note.shared = false;

const note2 = new Note();
note.id = 2;
note.shared = false;

// update the notes with id 1 and 2
await myService.mrsNotes.note.update({ data: [note1, note2] });
```
