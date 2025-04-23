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

# TypeScript Client API Reference

## REST Service

### authenticate

`authenticate` is used to authenticate in a given service using a given authentication app.

#### Options (authenticate)

| Name | Type | Required | Description
|---|---|---|---
| username | string | Yes | Username in the scope of the authentication app.
| password | string | No | Password in the scope of the authentication app.
| authApp  | string | Yes | Name of the authentication app.

: REST Service Options for Authentication

#### Return Type (authenticate)

Nothing (void).

#### Reference (authenticate)

```TypeScript
async function authenticate (IAuthenticateOptions): Promise<IMrsLoginResult> {
    // ...
}

interface IAuthenticateOptions {
    username: string
    password: string
    app: string
    vendor?: string
}

interface IMrsLoginResult {
    authApp?: string
    jwt?: string
    errorCode?: number
    errorMessage?: string
}
```

#### Example (authenticate)

```TypeScript
import { MyService } from './myService.mrs.sdk/myService';

const myService = new MyService();

await myService.authenticate({ username: 'foo', password: 'bar', app: 'baz' });
await myService.authenticate({ username: 'foo', password: 'bar', app: 'baz', vendor: "0x30000000000000000000000000000000" });
```

### deauthenticate

`deauthenticate` is used for logging out a user from a given service.

#### Return Type (deauthenticate)

Nothing (void).

#### Reference (deauthenticate)

```TypeScript
async function deauthenticate (): Promise<void> {
    // ...
}

```

#### Example (deauthenticate)

```TypeScript
import { MyService } from './myService.mrs.sdk/myService';

const myService = new MyService();

await myService.deauthenticate();
```

### getMetadata

`getMetadata` is used to retrieve application-specific metadata attached to an MRS resource (REST Service, Schema and/or Object).

#### Return Type (getMetadata)

A JSON object containing the application-specific metadata attached to the resource.

#### Example (getMetadata)

```TypeScript
import { MyService } from './myService.mrs.sdk/myService';

const myService = new MyService();

await myService.getMetadata();
await myService.mrsNotes.getMetadata();
await myService.mrsNotes.note.getMetadata();
```

## REST View

### create

`create` is used to add a REST Document to a given REST View. The document is represented as a plain TypeScript/JavaScript object or, alternatively, as an instance of a particular class that encapsulates the data required to create a new document. To insert multiple documents, see `createMany`[#createmany].

#### Options (create)

| Name | Type | Required | Description
|---|---|---|---
| data  | object | Yes | Object containing the mapping between column names and values for the REST Document to be created.

: REST View Options (create)

#### Return Type (create)

A JSON object representing the created REST Documents.

#### Reference (create)

```TypeScript
async function create (args: ICreateOptions<Type>): Promise<Type> {
    // ...
}

interface ICreateOptions<Type> {
    data: Type
}
```

#### Example (create)

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

### createMany

`createMany` adds one or more REST Documents to a given REST View. The documents are represented as plain TypeScript/JavaScript objects, or alternatively, as instances of a particular class that encapsulates the data required to create them.

#### Options (createMany)

| Name | Type | Required | Description
|---|---|---|---
| data  | object | Yes | Array of objects containing the mapping between column names and values for the REST Documents to be created.

: REST View Options (createMany)

#### Return Type (createMany)

An array of JSON objects representing the created REST Documents.

#### Reference (createMany)

```TypeScript
async function createMany (args: ICreateOptions<Type[]>): Promise<Type[]> {
    // ...
}

interface ICreateOptions<Type> {
    data: Type
}
```

#### Example (createMany)

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

### findFirst

`findFirst` is used to query the first REST Document (**in no specific order**) that matches a given optional filter.

#### Options (findFirst)

| Name | Type | Required | Description
|---|---|---|---
| where | object | No | Filtering conditions that apply to specific fields.
| select | object | No | Specifies which properties to include in the returned object.
| skip  | number | No | Specifies how many documents to skip before returning one of the matches.
| readOwnWrites | boolean | No | Ensures read consistency for a cluster of servers.

: REST View Options (findFirst)

#### Return Type (findFirst)

A JSON object representing the first REST [Document](#rest-document) that matches the filter or `undefined` when the document was not found.

#### Reference (findFirst)

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

#### Example (findFirst)

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

### findUnique

`findUnique` is used to query a single, uniquely identified REST Document by:

- Primary key column(s)
- Unique column(s)

If no document was found matching the given `where` condition, `undefined` is returned. To have an exception thrown in this case, see [findUniqueOrThrow](#finduniqueorthrow).

#### Options (findUnique)

| Name | Type | Required | Description
|---|---|---|---
| where | object | Yes | Wraps all unique columns so that individual documents can be selected.
| select | object | No | Specifies which properties to include in the returned object.
| readOwnWrites | boolean | No | Ensures read consistency for a cluster of servers.

: REST View Options (findUnique)

#### Return Type (findUnique)

A JSON object representing the REST [Document](#rest-document) that matches the filter or `undefined` when the document was not found.

#### Reference (findUnique)

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

#### Example (findUnique)

```TypeScript
import { MyService } from './myService.mrs.sdk/myService';

const myService = new MyService();

// Get the note with id 4.
// using implicit equality
await myService.mrsNotes.note.findUnique({ where: { id: 4 } });
// or using explicit equality
await myService.mrsNotes.note.findUnique({ where: { id: { $eq: 4 } } });
```

### findUniqueOrThrow

`findUniqueOrThrow` retrieves a single REST [Document](#rest-document) in the same way as [findUnique](#findunique). However, if the query does not find a document, it throws a `NotFoundError`.

`findUniqueOrThrow` differs from `findUnique` as follows:

- Its return type is non-nullable. For example, myService.mrsNotes.note.findUnique() can return a note or undefined, but myService.mrsNotes.note.findUniqueOrThrow() always returns a note.

### findMany

`findMany` is used to query a subset of REST [Documents](#rest-document) in one or more pages, and optionally, those that match a given filter. To find all REST Documents see [findAll](#findall).

#### Options (findMany)

| Name | Type | Required | Description
|---|---|---|---
| cursor | object | No | Retrieve documents using unique and sequential fields as cursor.
| iterator | boolean | No | Enable or disable iterator behavior.
| orderBy | object | No | Determines the sort order of specific fields.
| select | object | No | Specifies which properties to include in the returned object.
| skip  | number | No | How many documents to skip before returning one of the matches.
| where | object  | No | Filtering conditions that apply to specific fields.
| take  | number | No | Maximum number of documents to return.
| readOwnWrites | boolean | No | Ensures read consistency for a cluster of servers.

: REST View Options (findMany)

#### Return Type (findMany)

An array of JSON objects representing the REST Documents that match the filter.

#### Reference (findMany)

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

#### Example (findMany)

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

### findAll

`findAll` is used to query every REST [Document](#rest-document), and optionally, all those that match a given filter. To get a paginated subset of documents, see [findMany](#findmany).

#### Options (findAll)

| Name | Type | Required | Description
|---|---|---|---
| cursor | object | No | Retrieve documents using unique and sequential fields as cursor.
| orderBy | object | No | Determines the sort order of specific fields.
| progress | function | No | Specifies a function to be called back when reporting progress.
| select | object | No | Specifies which properties to include in the returned object.
| skip  | number | No | How many documents to skip before returning one of the matches.
| where | object  | No | Filtering conditions that apply to specific fields.
| readOwnWrites | boolean | No | Ensures read consistency for a cluster of servers.

: REST View Options (findAll)

#### Return Type (findAll)

An array of JSON objects representing the REST Documents that match the filter.

#### Reference (findAll)

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

#### Example (findAll)

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

### delete

`delete` is used to delete the first REST Document that matches a given required filter.

#### Options (delete)

| Name | Type | Required | Description
|---|---|---|---
| where | object | Yes | Filtering conditions that apply to specific fields.
| readOwnWrites | boolean | No | Ensures read consistency for a cluster of servers.

: REST View Options (delete)

#### Return Type (delete)

A JSON object containing the number of REST Documents that were deleted (always 1).

#### Reference (delete)

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

#### Example (delete)

```TypeScript
import { MyService } from './myService.mrs.sdk/myService';

const myService = new MyService();

// delete the first note whose title includes the string "foo"
await myService.mrsNotes.note.delete({ where: { title: { $like: "%foo%" } } });
```

### deleteMany

`delete` is used to delete all REST Documents that match a given filter.

#### Options (deleteMany)

| Name | Type | Required | Description
|---|---|---|---
| where | object | No | Filtering conditions that apply to specific fields.
| readOwnWrites | boolean | No | Ensures read consistency for a cluster of servers.

: REST View Options (deleteMany)

#### Return Type (deleteMany)

A JSON object containing the number of REST Documents that were deleted.

#### Reference (deleteMany)

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

#### Example (deleteMany)

```TypeScript
import { MyService } from './myService.mrs.sdk/myService';

const myService = new MyService();

// delete all notes whose title includes the string "foo"
await myService.mrsNotes.note.deleteMany({ where: { title: { $like: "%foo%" } } });
// delete all shared notes
await myService.mrsNotes.note.deleteMany({ where: { shared: true } });
```

### update

`update` is used to update a REST Document with a given identifier or primary key.

#### Options (update)

| Name | Type | Required | Description
|---|---|---|---
| data | object | Yes | Set of fields and corresponding values to update.

: REST View Options (update)

#### Return Type (update)

A JSON object representing the up-to-date REST [Document](#rest-document).

#### Reference (update)

```TypeScript
async function update (args: IUpdateOptions<UpdatableFields>): Promise<Data> {
    // ...
}

type IUpdateOptions<Type> = ICreateOptions<Type>;
```

#### Example (update)

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

### updateMany

`updateMany` is used to update all REST Documents with matching identifiers or primary keys.

#### Options (updateMany)

| Name | Type | Required | Description
|---|---|---|---
| data | object | Yes | Set of fields and corresponding values to update.

: REST View Options (updateMany)

#### Return Type (updateMany)

An array of JSON objects representing the up-to-date REST [Documents](#rest-document).

#### Reference (updateMany)

```TypeScript
async function updateMany (args: IUpdateOptions<UpdatableFields[]>): Promise<Data[]> {
    // ...
}

type IUpdateOptions<Type> = ICreateOptions<Type>;
```

#### Example (updateMany)

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
## REST Document

### update

`update` is used to update a given REST document by committing the set of updates performed locally on the corresponding instance in the application.

> This function is only available if the REST View enables the "UPDATE" CRUD operation and specifies one or more identifier fields.

#### Reference (update)

```TypeScript
async function update(): Promise<IMyServiceSakilaActor> {
    // ...
}

interface IMyServiceSakilaActor {
    readonly actorId?: number;
    firstName?: string;
    lastName?: string;
    lastUpdate?: string;
}
```

#### Example (update)

```TypeScript
import { MyService } from './myService.mrs.sdk/myService';

const myService = new MyService();

const actor = await myService.sakila.actor.findFirst();
if (actor) {
    actor.lastName = "FOO";
    const modifiedActor = await actor.update();
    console.log(modifiedActor.lastName); // FOO
}
```

### delete

`delete` is used to delete a given REST document represented by a corresponding instance in the application.

> This function is only available if the REST View enables the "DELETE" CRUD operation and specifies one or more identifier fields.

#### Reference (delete)

```TypeScript
async function delete(): Promise<void> {
    // ...
}
```

#### Example (delete)

```TypeScript
import { MyService } from './myService.mrs.sdk/myService';

const myService = new MyService();

const actor = await myService.sakila.actor.findFirst();
if (actor) {
    await actor.delete();
}
```

## REST Function/Procedure

### call

`call` is used to execute a REST routine (`FUNCTION` or `PROCEDURE`). The first parameter of the command is an `object` containing the set of `IN`/`INOUT` parameters (and corresponding values) as specified by the database routine. The second parameter is an `object` with execution options which is only available if the REST routine has an associated Async Task.

#### Options (call)

| Name | Type | Required | Description
|---|---|---|---
| refreshRate | number (>=500) | No | Time (ms) to wait for retrieving the next progress report.
| progress | async function | No | Callback to be executed using the details of each progress report while the routine does not finish.

: REST Function/Procedure Options (call)

#### Return Type (call)

A JSON object containing the result produced by the routine (including `OUT`/`INOUT` parameters and result sets).

#### Reference (call)

```TypeScript
async function call (noteUpdateParams?: IMyServiceMrsNotesNoteUpdateParams, options?: IMrsTaskExecutionOptions<object, IMrsProcedureResult<IMyServiceMrsNotesNoteUpdateParamsOut, IMyServiceMrsNotesNoteUpdateResultSet>>): Promise<IMrsProcedureResult<IMyServiceMrsNotesNoteUpdateParamsOut, IMyServiceMrsNotesNoteUpdateResultSet>> {
    // ...
}

interface IMyServiceMrsNotesNoteUpdateParams {
    tags?: JsonValue;
    lockedDown?: boolean;
    noteId?: number;
    title?: string;
    content?: string;
    pinned?: boolean;
    userId?: string;
}

interface IMrsTaskWatchOptions {
    refreshRate?: number;
}

interface IMrsTaskExecutionOptions<MrsTaskStatusUpdate, MrsTaskResult> extends IMrsTaskWatchOptions {
    progress?: (report: IMrsRunningTaskReport<MrsTaskStatusUpdate, MrsTaskResult>) => Promise<void>;
}

interface IMrsRunningTaskReport<MrsTaskStatusUpdate, MrsTaskResult> {
    data: MrsTaskStatusUpdate;
    status: "RUNNING";
    message: string;
    progress: number;
}

type IMyServiceMrsNotesNoteUpdateParamsOut = never;

type IMyServiceMrsNotesNoteUpdateResultSet = JsonObject;

interface IMrsProcedureResult<OutParams, ResultSet> {
    outParameters?: OutParams;
    resultSets: ResultSet[];
}
```

#### Example (call)

```TypeScript
import { MyService } from './myService.mrs.sdk/myService';

const myService = new MyService();

try {
    // update the title of a note with a given id
    await myService.mrsNotes.noteUpdate.call({ noteId: note.id, title: "hello world" });
} catch (err) {
    // catch errors produced by the routine
}
```

### start

`start` is used to start a REST routine (`FUNCTION` or `PROCEDURE`) with an associated Async Task. The first and only parameter of the command is an `object` containing the set of `IN`/`INOUT` parameters (and corresponding values) as specified by the database routine.

#### Return Type (start)

A [Task](#task) instance.

#### Reference (start)

```TypeScript
async function start(params?: IMyServiceMrsNotesNoteUpdateParams): Promise<MrsTask<object, IMrsProcedureResult<IMyServiceMrsNotesNoteUpdateParamsOut, IMyServiceMrsNotesNoteUpdateResultSet>>> {
    // ...
}

interface IMyServiceMrsNotesNoteUpdateParams {
    tags?: JsonValue;
    lockedDown?: boolean;
    noteId?: number;
    title?: string;
    content?: string;
    pinned?: boolean;
    userId?: string;
}

type IMyServiceMrsNotesNoteUpdateParamsOut = never;

type IMyServiceMrsNotesNoteUpdateResultSet = JsonObject;

interface IMrsProcedureResult<OutParams, ResultSet> {
    outParameters?: OutParams;
    resultSets: ResultSet[];
}
```

#### Example (start)

```TypeScript
import { MyService } from './myService.mrs.sdk/myService';

const myService = new MyService();

// update the title of a note with a given id
const task = await myService.mrsNotes.noteUpdate.start({ noteId: note.id, title: "hello world" });
```

## Task

### watch

`watch` is used to monitor the status of a REST routine (`FUNCTION` or `PROCEDURE`) with an associated Async Task. The first and only parameter of the command is an `object` that contains customizable monitoring options.

#### Options (watch)

| Name | Type | Required | Description
|---|---|---|---
| refreshRate | number (>=500) | No | Time (ms) to wait for retrieving the next progress report.

: Task Options (watch)

#### Return Type (watch)

An [AsyncGenerator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator) instance which produces status update reports with details about the execution context of the REST routine.

#### Reference (watch)

```TypeScript
async function watch(params?: IMrsTaskWatchOptions): AsyncGenerator<
    IMrsTaskReport<object, IMrsProcedureResult<IMyServiceMrsNotesNoteUpdateParamsOut, IMyServiceMrsNotesNoteUpdateResultSet>>> {
    // ...
}

interface IMrsTaskWatchOptions {
    refreshRate?: number;
}

type IMyServiceMrsNotesNoteUpdateParamsOut = never;

type IMyServiceMrsNotesNoteUpdateResultSet = JsonObject;

interface IMrsProcedureResult<OutParams, ResultSet> {
    outParameters?: OutParams;
    resultSets: ResultSet[]
}

interface IMrsRunningTaskReport<MrsTaskStatusUpdate, MrsTaskResult> {
    data: MrsTaskStatusUpdate;
    status: "RUNNING";
    message: string;
    progress: number;
}

interface IMrsCompletedTaskReport<MrsTaskStatusUpdate, MrsTaskResult> {
    result: MrsTaskResult;
    status: "COMPLETED";
    message: string;
}

interface IMrsCancelledTaskReport<MrsTaskStatusUpdate, MrsTaskResult> {
    status: "CANCELLED";
    message: string;
}

type IMrsTaskReport<MrsTaskStatusUpdate, MrsTaskResult> = IMrsRunningTaskReport<MrsTaskStatusUpdate, MrsTaskResult> |
    IMrsCompletedTaskReport<MrsTaskStatusUpdate, MrsTaskResult> |
    IMrsCancelledTaskReport<MrsTaskStatusUpdate, MrsTaskResult>;
```

#### Example (watch)

```TypeScript
import { MyService } from './myService.mrs.sdk/myService';

const myService = new MyService();

// update the title of a note with a given id
const task = await myService.mrsNotes.noteUpdate.start({ noteId: note.id, title: "hello world" });

// assuming it is a long-running operation, watch for status updates
try {
    for await (const report of task.watch()) {
        if (report.status === "RUNNING") {
            console.log(report.progress);
        }
    }
} catch (err) {
    // catch errors produced by the task or by the routine itself
}
```

### kill

`kill` is used to kill the underlying Async Task of a REST routine (`FUNCTION` or `PROCEDURE`) and cancel its execution.

#### Reference (kill)

```TypeScript
async function kill(): Promise<void> {
    // ...
}
```

#### Example (kill)

```TypeScript
import { MyService } from './myService.mrs.sdk/myService';

const myService = new MyService();

// update the title of a note with a given id
const task = await myService.mrsNotes.noteUpdate.start({ noteId: note.id, title: "hello world" });
const startedAt = Date.now();

try {
    // assuming it is a long-running operation, kill the task if it takes more than 10 seconds to finish
    for await (const report of task.watch()) {
        if (report.status === "RUNNING" && Date.now() - startedAt > 10000) {
            await task.kill();
        } else if (report.status === "CANCELLED") {
            console.log(report.message);
        }
    }
} catch (err) {
    // stop the generator and catch errors produced by the task or by the routine itself
}
```
