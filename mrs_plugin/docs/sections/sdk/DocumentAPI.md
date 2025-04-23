<!-- Copyright (c) 2025, Oracle and/or its affiliates.

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

# Document API

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

These commands are only available if the corresponding REST View enables the "UPDATE" and/or "DELETE" CRUD operations, respectively and specifies the appropriate identifier fields (mapping to underlying database primary keys).

> In the TypeScript SDK, the identifier fields that are part o a REST Document are read-only. This is currently not the case on the Python SDK.

## TypeScript

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

## Python

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
