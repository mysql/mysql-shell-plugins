<!-- Copyright (c) 2024, 2025, Oracle and/or its affiliates.

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

When a REST object requires authentication, applications using the SDK should authenticate in the scope of the corresponding REST service beforehand. A client can be authenticated using an existing authentication app, providing a valid username and password (and optionally, a vendor id).

If a vendor id is not specified, the SDK automatically looks up the appropriate vendor id for the corresponding authentication app (which results in an extra round-trip to the MRS backend). 

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
myService.authenticate({ username: "foo", password: "bar", app: "baz" })
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
myService.authenticate({ username: "foo", password: "bar", app: "qux" })
```

### Python

```py
my_service.sakila.authenticate(username="foo", password="bar", auth_app="baz")
```

After the authentication succeeds, every valid SDK command that executes on top of a REST object that requires authentication, should also succeed.

## Authentication Errors

In the case where a vendor id is not specified when calling the command, the client performs a vendor lookup in the backend using the name of the authentication app. If the authentication app does not exist, the command yields an error.

```TypeScript
try {
  await my_service.sakila.authenticate({ username: "foo", password: "bar", app: "<non_existing>" })
} catch (err) {
  console.log(err.message) // "Authentication failed. The authentication app does not exist."
}
```

In the case where a vendor id is specified when calling the command, the client does not perform any additional vendor lookup, which means that it assumes the command was provided with the name of an authentication app of that same vendor and simplify attempts to authenticate using the appropriate authentication mechanism. Ultimately the authentication will fail and the command will return an error.

```TypeScript
const result = await my_service.sakila.authenticate({
  username: "foo",
  password: "bar",
  app: "<app_from_different_vendor>",
  vendor: "<vendor_id>"
})

console.log(result.errorMessage) // Authentication failed. The authentication app is of a different vendor.
```

Additionally, the command will, as expected, also yield an error when the password does not match the given username.
