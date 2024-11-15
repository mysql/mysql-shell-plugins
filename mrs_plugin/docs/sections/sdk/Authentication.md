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

# Authentication

When a REST object requires authentication, applications using the SDK should authenticate in the scope of the corresponding REST service beforehand. A client can be authenticated using an existing authentication app and providing a valid username and password.

Currently, the MRS SDK (both for TypeScript and Python) only supports MRS Native and MySQL Internal Authentication apps (more details [here](../devGuide/Auth.md)).

## MRS Native Authentication

With an authentication app created as follows:

```sql
CREATE REST AUTH APP baz ON SERVICE /myService VENDOR MRS;
```

and a REST user created as follows:

```sql
CREATE REST USER "foo"@"baz" IDENTIFIED BY "bar";
```

### TypeScript

```TypeScript
myService.authenticate({ username: "foo", password: "bar", authApp: "baz" })
```

### Python

```py
my_service.sakila.authenticate(username="foo", password="bar", auth_app="baz")
```

## MySQL Internal Authentication

In the same way, with an authentication app created as follows:

```sql
CREATE REST AUTH APP qux ON SERVICE /myService VENDOR MYSQL;
```

and, this time, an actual MySQL server account created as follows:

```sql
CREATE USER foo IDENTIFIED BY "bar";
```

the API is used in the exact same way.

### TypeScript

```TypeScript
myService.authenticate({ username: "foo", password: "bar", authApp: "qux" })
```

### Python

```py
my_service.sakila.authenticate(username="foo", password="bar", auth_app="baz")
```

After the authentication succeeds, every valid SDK command that executes on top of a REST object that requires authentication, should also succeed.
