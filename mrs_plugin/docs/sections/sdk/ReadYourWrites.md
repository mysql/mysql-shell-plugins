<!-- Copyright (c) 2024, Oracle and/or its affiliates.

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

# Read Your Writes Consistency

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
