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

# Python Client API Reference

## REST Resources

The MRS Python SDK exposes a type-safe programmable interface for the MySQL REST Service that unifies, under a set of contextual commands, the available HTTP operations to access and use database objects (schemas, tables, views, functions, etc.) exposed as REST resources.

The following `MRS Resources` exist as part of the MRS Python SDK:

- [REST Service](#rest-services)
  - [REST Schema](#rest-schemas)
    - [REST View](#rest-views), [Function](#rest-functions) and [Procedure](#rest-procedures)
      - [REST Document](#rest-documents)

MRS resources, as shown above, are grouped under service namespaces.

The following commands can be executed in the scope of a client-side representation of any MRS resource (except [REST Documents](#rest-documents)).

- [get_metadata()](#get_metadata)

### get_metadata (PY)

The MRS has a dedicated JSON field where users can store application specific metadata at different levels: service, schema and objects of the schema (such as Views or Functions).

`get_metadata()` is a command that enables users to access the underlying MRS metadata information from client REST objects.

#### Options (get_metadata)

`None`.

#### Return Type (get_metadata)

The metadata information is returned as a JSON-like object (`dict`). If there is no metadata specified for a given MRS resource, an empty JSON object (ultimately, a Python `dict`) is returned.

#### Example (get_metadata)

```py
from sdk.python import MyService

my_service = MyService()

print(await my_service.get_metadata())  # {"title": "My Service"}

print(await my_service.sakila.get_metadata())  # {"title": "Sakila Sample Database"}
```

## REST Services

In the Python SDK, schemas are grouped under service namespaces.

The following resources can be accessed from a service namespace:

- [REST Schemas](#rest-schemas)

The following options are supported when creating a service:

- [base_url](#base_url)
- [verify_tls_cert](#verify_tls_cert)

The following commands can be accessed from a service object:

- Properties
  - [tls_context](#tls_context)

- Methods
  - [get_auth_apps()](#get_auth_apps)
  - [authenticate()](#authenticate)
  - [deauthenticate()](#deauthenticate)

### base_url

`base_url` is a service constructor option that allows you to customize the service URL.

```py
from sdk.python import MyService

domain = "my_domain"
port = 8443

my_service = MyService(base_url=f"https://{domain}:{port}/myService")
```

By default, `base_url` corresponds to the URL specified when the Python SDK was exported/dumped.

### verify_tls_cert

`verify_tls_cert` is a service constructor option that allows you to customize the configuration of the TLS/SSL context that is created alongside the service. This option can be used to disable TLS/SSL CA certificate (cert) verification or specify what cert(s) should be loaded during the verification.

**TLS/SSL cert(s) verification is enabled by default**, in this regard, if `verify_tls_cert` is never set, or set as `True` explicitly, TLS/SSL cert verification is enabled and a set of default "certification authority" (CA) certificates from default locations are loaded (see [TLS/SSL default certs](https://docs.python.org/3/library/ssl.html#ssl.SSLContext.load_default_certs)).

```py
# default behavior

from sdk.python import MyService

my_service = MyService()
# print(my_service.tls_context.verify_mode)
# ------------------------------
# True
```

**To customize what CA certificates should be loaded**, instead of relying on the default behavior, `verify_tls_cert` must be specified as a path-like string (the string can be the path to a CA certificate file, or it can be the path to a folder containing several CA certificates). The file(s) referenced by the specified path-like string are loaded during TLS/SSL cert verification. Certificates should be in PEM format, following an [OpenSSL specific layout](https://docs.openssl.org/master/man3/SSL_CTX_load_verify_locations/).

```py
# customize what CA certificates should be loaded

from sdk.python import MyService

my_service = MyService(verify_tls_cert="/path/to/certfile")
# print(my_service.tls_context.verify_mode)
# ------------------------------
# True
```

Finally, **to disable TLS/SSL cert(s) verification**, `verify tls cert` must be specified as `False`.

```py
# disable TLS/SSL cert(s) verification

from sdk.python import MyService

my_service = MyService(verify_tls_cert=False)
# print(my_service.tls_context.verify_mode)
# ------------------------------
# False
```

### tls_context

`tls_context` is a service-level property that gets the TLS/SSL context configured for the service, which is used when executing HTTPS requests. The TLS/SSL context configuration depends on how `verify_tls_cert` is set when the service is created, see [verify_tls_cert](#verify_tls_cert).

#### Return Type (tls_context)

An `ssl.SSLContext` instance.

#### Example (tls_context)

```py
from sdk.python import MyService

my_service = MyService()

tls_context = my_service.tls_context

# print(tls_context.verify_mode)
# ------------------------------
# True
```

### Service.get_auth_apps (PY)

`get_auth_apps()` is a service-level command that enables users to get a list containing the authentication apps and vendor IDs registered for the given service.

#### Options (get_auth_apps)

This command expects no input from the calling application.

#### Return Type (get_auth_apps)

A list of dictionaries. Each element in the list is a *2-key* dictionary, where keys are `name` and `vendor_id`.

#### Example (get_auth_apps)

```py
from sdk.python import MyService

my_service = MyService()

auth_apps = await my_service.get_auth_apps()

# print(auth_apps)
# ----------------
# [
#     {"name": "MRS", "vendor_id": "0x30000000000000000000000000000000"},
#     {"name": "MySQL", "vendor_id": "0x31000000000000000000000000000000"}
# ]
```

### Service.authenticate (PY)

`authenticate` is a service-level command that authenticates a user so he/she can work with restricted MySQL REST Services.

#### Options (authenticate)

| Argument Name  | Data Type | Required | Default | Notes |
| :-------- | :------- | :------- | :------- |  :--------------------- |
| app | `str` | Yes | N/A | Name of the authentication application (as specified by the admin). |
| user | `str` | Yes |  N/A | User name |
| password | `str` | No | `""` | If not provided, the empty string is assumed as the password |
| vendor_id | `str` | No | `None` | ID of the underlying authentication mechanism. Specifying the vendor ID avoids an additional round-trip to the server |

: REST Service Options for Authentication

The following authentication app vendors are supported:

- *MRS*
- *MySQL Internal*

#### Return Type (authenticate)

This command returns nothing.

#### Raises (authenticate)

`AuthenticationError` if something goes wrong during the authentication workflow.

#### Example (authenticate)

```python
from sdk.python import MyService

my_service = MyService()

# `authenticate` will account for authentication
 await my_service.authenticate(
    app="MySQL",
    user="Lucas",
    password="S3cr3t",
    vendor_id="0x31000000000000000000000000000000"
)

# Service is ready and tied database objects can be utilized
# E.g., calling a function
res = await my_service.sakila.hello_func.call(name="Rui")
# print(res) -> Hello, Rui!
```

When `vendor_id` is not specified, a vendor ID lookup is performed. The vendor ID that matches the given `app` is picked and used down the road. If not a match takes place, an `AuthenticationError` exception is raised.

In the case the vendor ID is not specified, and a nonexisting app is provided, an `AuthenticationError` exception is raised.

Also, in the case the vendor ID is specified alongside a nonexisting app, there will not be a lookup. This means that if, by accident, or not, there is no authentication app from the specified `vendor_id` with the given `app`, an `AuthenticationError` exception is returned to the application.

### Service.deauthenticate (PY)

`deauthenticate` is a service-level command that logs you out from authenticated MySQL REST Services.

#### Options (deauthenticate)

This command expects no input from the calling application.

#### Return Type (deauthenticate)

This command returns nothing.

#### Raises (deauthenticate)

`DeauthenticationError` if no user is currently authenticated.

#### Example (deauthenticate)

```python
from sdk.python import MyService

my_service = MyService()

# Log in - `authenticate` will account for authentication
 await my_service.authenticate(
    app="MySQL",
    user="Lucas",
    password="S3cr3t"
)

# Call a function
res = await my_service.sakila.hello_func.call(name="Oscar")
# print(res) -> Hello, Oscar!

# Log out
await my_service.deauthenticate()

# Calling the function again - you should get an HTTP 401 (Unauthorized) error
res = await my_service.sakila.hello_func.call(name="Rui")

# Log out again - you should get an `ServiceNotAuthenticatedError` exception
await my_service.deauthenticate()
```

## REST Schemas

In the Python SDK, database objects such as tables and functions are grouped under namespaces that correspond to their schema. Applications can access and use those database objects via the API exposed by each one.

The following REST resources can be accessed from the corresponding schema namespace:

- [REST Views](#rest-views)
- [REST Documents](#rest-documents)
- [REST Functions](#rest-functions)
- [REST Procedures](#rest-procedures)

## REST Views

### View.create (PY)

`create` is used to insert a record (a REST document) into the database. The REST document is represented as a typed dictionary object whose fields, or keys, should comply with the interface exposed by the type definition `INew${obj_class_name}` where `${obj_class_name}` is a variable containing a string which is a fully-qualified name composed by the names of the *REST Service*, *REST Schema* and *REST View* themselves.

> To insert multiple documents, see [create_many](#create_many).

#### Options (create)

| Name | Type | Required | Description |
|---|---|---|---------------------|
| data  | TypedDict | Yes | Object containing the mapping between column names and values for the record to be inserted |

: REST Views Options (create)

#### Return Type (create)

A REST document data class object representing the record that was inserted. For more details about REST documents, check the [REST Documents](#rest-documents) section.

#### Example (create)

```Python
from sdk.python.my_service import IMyServiceSakilaActor as Actor, MyService

my_service = MyService()

actor: Actor = await my_service.sakila.actor.create(
    data={
        "first_name": "FOO",
        "last_name": "BAR",
    }
)

print(actor)
# IMyServiceSakilaActor(actor_id=35000, first_name='FOO', last_name='BAR', last_update='2024-06-04 10:14:33.000000')
```

The `actor_id` and `last_update` columns from the `sakila` table on the sample [sakila database](https://dev.mysql.com/doc/sakila/en/) are automatically generated on each insert, which means they can be omitted.

### View.create_many (PY)

`create_many` is used to insert one or more records (REST documents) into the database. A record is represented as a typed dictionary object whose fields, or keys, should comply with the interface exposed by the type definition `INew${obj_class_name}` where `${obj_class_name}` is a variable which value depends on the *service, schema and table* names themselves.

> To insert a single record, see [create](#create).

#### Options (create_many)

| Name | Type | Required | Description |
|---|---|---|---------------------|
| data  | Sequence of `TypedDict` - it can be any Python object supporting the iteration protocol, such as lists and tuples | Yes | List of objects containing the mapping between column names and values for the records to be inserted |

: REST Views Options (create_many)

#### Return Type (create_many)

A list of REST document data class objects representing each record that was inserted. For more details about REST documents, check the [REST Documents](#rest-documents) section.

#### Example (create_many)

```Python
from sdk.python.my_service import IMyServiceSakilaActor as Actor, MyService

my_service = MyService()

actors: list[Actor] = await my_service.sakila.actor.create_many(
    data=[
        {
            "first_name": "FOO",
            "last_name": "BAR",
        },
        {
            "first_name": "OOF",
            "last_name": "RAB",
        }
    ]
)

print(actors)
# [
#     IMyServiceSakilaActor(
#         actor_id=35000,
#         first_name='FOO',
#         last_name='BAR',
#         last_update='2024-06-04 10:14:33.000000'
#     ),
#     IMyServiceSakilaActor(
#         actor_id=36000,
#         first_name='OOF',
#         last_name='RAB',
#         last_update='2024-08-04 10:14:33.000000'
#     )
# ]
```

The `actor_id` and `last_update` columns from the `sakila` table on the sample [sakila database](https://dev.mysql.com/doc/sakila/en/) are automatically generated on each insert, which means they can be omitted.

### View.find_first (PY)

`find_first` is used to query the first REST document (**in no specific order**) that matches a given optional filter. It returns `None` if no document is found.

> To raise an exception if there are no matches, use [find_first_or_throw](#find_first_or_throw) instead.
>
> To find multiple REST documents, see [find](#find).

#### Options (find_first)

| Name | Type | Required | Description |
|---|---|---|---------------------|
| select | dict or list | No | Specifies which properties to include or exclude on the returned document - works as a *field filter* |
| where | dict | No | Applies filtering conditions based on specific fields - works as a *document filter* |
| skip | int | No | Specifies how many documents to skip before returning one of the matches |
| order_by | dict | No | Lets you customize the order (`ASC` or `DESC`) in which the documents are returned based on specific fields|
| cursor | dict | No | Specifies the position of the first item to include in the result set. A cursor bookmarks a location in a result set and must be a column containing unique and sequential values. |
| read_own_writes | bool | No | Ensures read consistency for a cluster of servers - `False` is used by default |

: REST Views Options (find_first)

> Cursor-based pagination takes precedence over offset-based pagination, which means that if a cursor is defined, the value of the offset property (`skip`) will be ignored.

#### Return Type (find_first)

If there is a match, a REST document data class object meeting the filter conditions, otherwise `None` is returned. For more details about REST documents, check the [REST Documents](#rest-documents) section.

#### Example (find_first)

Consider the following generic usage snippet of `find_first`:

```Python
from sdk.python.my_service import IMyServiceSakilaActor as Actor, MyService

my_service = MyService()

actor: Optional[Actor] = await self.my_service.sakila.actor.find_first(
    select={"last_name": False},
    where={"first_name": {"like": "%%ED%%"}},
    .
    .
)
```

In the following subsections, a small usage example is included for each option.

##### Select (find_first)

```Python
# Only include the fields specified (`list` use case)
select=["last_update"]

# Only include the fields specified (`dict` use case)
select={"last_name": True}

# Include all fields but the specified
select={"last_name": False}
```

##### Where (find_first)

```Python
# Equality - these two are equivalent
where={"actor_id": 3}
where={"actor_id": {"equals": 3}}

# Difference
where={"last_name": {"ne": "Pacheco"}}

# Greater than
where={"actor_id": {"gt": 3}}

# Greater than or equal
where={"actor_id": {"gte": 3}}

# Lower than
where={"actor_id": {"lt": 3}}

# Lower than or equal
where={"actor_id": {"lte": 3}}

# Leads to a match when the field is not NULL.
# In this case, we would get documents where the
# field `last_update` is not NULL.
where={"last_updated": {"not": None}}

# Pattern
where={"first_name": {"like": "%%ED%%"}}

# Union of conditions
where={
    "AND": [
        {"first_name": "PENELOPE"},
        {"actor_id": {"gte": 3}}
    ]
}

# Intersection of conditions
where={
    "OR": [
        {"first_name": "MICHAEL"},
        {"last_name": {"like": "%%AB%%"}}
    ]
}
```

##### Skip (find_first)

Offset-based pagination is non-inclusive, meaning that if the position marking the offset is a match, it will not be included in the result set.

Suppose the actor table contains a bunch of records as shown in [Cursor Example](#cursor-find_first). Then, the `skip` option can be used as follows:

```Python
actor: Optional[Actor] = await self.my_service.sakila.actor.find_first(
    where={"last_name": {"like": "%%HA%%"}}, skip=2
)

if actor is None:
    warnings.warn(f"Actor not found")
else:
    print(actor.actor_id)
```

The printed actor ID would be `32`.

##### Order By (find_first)

```Python
# Descending order
order_by={"first_name": "DESC"}

# Ascending order
order_by={"actor_id": "ASC"}
```

##### Cursor (find_first)

The position bookmarked by the cursor is non-inclusive, meaning that if the bookmarked position is a match, it will not be included in the result set.

Suppose the actor table contains a bunch of records. In the following snippet, only those records where `last_name` matches the pattern `%%HA%%` are shown:

```json
{
    "actorId": 1,
    "lastName": ...,
    "firstName": ...,
    "lastUpdate": ...,
},
...,
{
    "actorId": 3,
    "lastName": "CHASE",
    "firstName": "ED",
    "lastUpdate": "2006-02-15 04:34:33.000000",
},
...,
{
    "actorId": 8,
    "lastName": "JOHANSSON",
    "firstName": "MATTHEW",
    "lastUpdate": "2006-02-15 04:34:33.000000",
},
...,
{
    "actorId": 32,
    "lastName": "HACKMAN",
    "firstName": "TIM",
    "lastUpdate": "2006-02-15 04:34:33.000000",
}
```

The cursor option can be used as follows:

```Python
actor: Optional[Actor] = await self.my_service.sakila.actor.find_first(
    where={"last_name": {"like": "%%HA%%"}},
    cursor={"actor_id": 3},  # cursor is exclusive
)

if actor is None:
    warnings.warn(f"Actor not found")
else:
    print(actor.actor_id)
```

The printed actor ID would be `8`.

##### Read Own Writes (find_first)

```Python
# ON
read_own_writes=True

# OFF
read_own_writes=False
```

### View.find_first_or_throw (PY)

`find_first_or_throw` is used to retrieve the first REST document that matches a given optional filter in the same way as [find_first](#find_first) does. However, if the query does not find a document, it raises a `MrsDocumentNotFoundError` exception.

> To not raise an exception and get `None` if there are no matches, use [find_first](#find_first) instead.
>
> To find multiple REST documents, see [find](#find).

#### Options (find_first_or_throw)

`find_first_or_throw` and `find_first` implement the very same options. For more details about these, see [Options (find_first)](#options-find_first).

#### Return Type (find_first_or_throw)

If there is a match, a REST document data class object meeting the filter conditions is returned, otherwise an exception `MrsDocumentNotFoundError` is raised. For more details about REST documents, check the [REST Documents](#rest-documents) section.

#### Example (find_first_or_throw)

Usage is similar to `find_first`, however, now you should account for a possible exception:

```Python
import warnings
from sdk.python.my_service import IMyServiceSakilaActor as Actor, MyService, MrsDocumentNotFoundError

my_service = MyService()

try:
    actor: Actor = await self.my_service.sakila.actor.find_first_or_throw(
        select={"last_name": False},
        where={"first_name": {"like": "%%ED%%"}},
    )
except MrsDocumentNotFoundError:
    warnings.warn("Ups, no matches found")
```

See [Example (find_first)](#example-find_first) for additional usage options.

### View.find_unique (PY)

`find_unique` is used to query a single, uniquely identified REST document by:

- Primary key column(s)
- Unique column(s)

It returns `None` if no document is found.

> To raise an exception if there are no matches, use [find_unique_or_throw](#find_unique_or_throw) instead.

#### Options (find_unique)

| Name | Type | Required | Description |
|---|---|---|---------------------|
| select | dict or list | No | Specifies which properties to include or exclude on the returned document - works as a *field filter* |
| where | dict | Yes | Applies filtering conditions based on specific fields (must be unique) - works as a *document filter* |
| read_own_writes | bool | No | Ensures read consistency for a cluster of servers - `False` is used by default |

: REST Views Options (find_unique)

#### Return Type (find_unique)

If there is a match, a REST document data class object meeting the filter conditions, otherwise `None` is returned. For more details about REST documents, check the [REST Documents](#rest-documents) section.

#### Example (find_unique)

```Python
import warnings
from sdk.python.my_service import IMyServiceSakilaActor as Actor, MyService

my_service = MyService()

aid = 3
actor: Actor = await self.my_service.sakila.actor.find_unique(
    where={"actor_id": aid}, select=["last_update"], read_own_writes=False
)
if actor is None:
    warnings.warn(f"Actor with id={aid} not found")

assert actor.actor_id == aid
```

See [Example (find_first)](#example-find_first) for additional usage options.

### View.find_unique_or_throw (PY)

`find_unique_or_throw` is used to query a single, uniquely identified REST document by:

- Primary key column(s)
- Unique column(s)

If no document was found matching the given filter conditions, `MrsDocumentNotFoundError` is raised.

> To not raise an exception and get `None` if there are no matches, use [find_unique](#find_unique) instead.

#### Options (find_unique_or_throw)

`find_unique_or_throw` and `find_unique` implement the very same options. For more details about these, see [Options (find_unique)](#options-find_unique).

#### Return Type (find_unique_or_throw)

If there is a match, a REST document data class object meeting the filter conditions, otherwise `MrsDocumentNotFoundError` is raised. For more details about REST documents, check the [REST Documents](#rest-documents) section.

#### Example (find_unique_or_throw)

```Python
import warnings
from sdk.python.my_service import IMyServiceSakilaActor as Actor, MyService, MrsDocumentNotFoundError

my_service = MyService()

aid = 3
try:
    actor: Actor = await self.my_service.sakila.actor.find_unique_or_throw(
        where={"actor_id": aid}, select=["last_update"], read_own_writes=False
    )
except MrsDocumentNotFoundError:
    warnings.warn("Ups, no matches found")
```

See [Example (find_first)](#example-find_first) for additional usage options.

### View.find (PY)

`find` is used to query a subset of REST documents in one or more pages, and optionally, those that match a given filter.

#### Options (find)

| Name | Type | Required | Description |
|---|---|---|---------------------|
| select | dict or list | No | Specifies which properties to include or exclude on the returned document - works as a *field filter* |
| where | dict | No | Applies filtering conditions based on specific fields - works as a *document filter* |
| skip | int | No | Specifies how many documents to skip before returning one of the matches |
| order_by | dict | No | Lets you customize the order (`ASC` or `DESC`) in which the documents are returned based on specific fields|
| cursor | dict | No | Specifies the position of the first item to include in the result set. A cursor bookmarks a location in a result set and must be a column containing unique and sequential values. |
| read_own_writes | bool | No | Ensures read consistency for a cluster of servers - `False` is used by default |
| take | int | No | The maximum size of the page. |
in order to avoid n + 1 requests, the internal iterator stops after the MySQL Router says there are no more items. Default value is `True` (enabled). |

: REST Views Options (find)

> Cursor-based pagination takes precedence over offset-based pagination, which means that if a cursor is defined, the value of the offset property (`skip`) will be ignored.

#### Return Type (find)

A list of objects representing the first page of REST Documents matching the filter. If there are more matching REST Documents, the array contains an additional `has_more` truthy property and a `next()` async function that automatically retrieves the subsequent page of REST Documents.

#### Example (find)

```Python
from sdk.python.my_service import MyService

my_service = MyService()

actors = await self.my_service.sakila.countries.find()
print(actors)
# [
#   IMyServiceSakilaCountry(
#       country_id=1,
#       last_update=datetime.datetime(2006, 2, 15, 4, 44),
#       country='Afghanistan',
#   ),
#   IMyServiceSakilaCountry(
#       country_id=2,
#       last_update=datetime.datetime(2006, 2, 15, 4, 44),
#       country='Algeria',
#   ),
#   ...
#   IMyServiceSakilaCountry(
#       country_id=25,
#       last_update=datetime.datetime(2006, 2, 15, 4, 44),
#       country='Congo, The Democratic Republic of the',
#   )
# ]

if actors.has_more is True:
    actors = await actors.next()
    print(actors)
    # [
    #   IMyServiceSakilaCountry(
    #       country_id=26,
    #       last_update=datetime.datetime(2006, 2, 15, 4, 44),
    #       country='Czech Republic',
    #   ),
    #   IMyServiceSakilaCountry(
    #       country_id=27,
    #       last_update=datetime.datetime(2006, 2, 15, 4, 44),
    #       country='Dominican Republic',
    #   ),
    #   ...
    #   IMyServiceSakilaCountry(
    #       country_id=50,
    #       last_update=datetime.datetime(2006, 2, 15, 4, 44),
    #       country='Japan',
    #   )
```

> Due the way attributes work in Python, for the MyPy type checker to be able to correctly narrow the types returned by `next()`, `has_more` must be explicitly checked against `True`.

See [Example (find_first)](#example-find_first) for additional usage options.

### View.delete (PY)

`delete` is used to delete a single, uniquely identified REST document by:

- Primary key column(s)
- Unique column(s)

> To delete multiple documents, see [delete_many](#delete_many).

#### Options (delete)

| Name | Type | Required | Description |
|---|---|---|---------------------|
| where | dict | Yes | Applies filtering conditions based on specific fields (must be unique) - works as a *document filter* |
| read_own_writes | bool | No | Ensures read consistency for a cluster of servers - `False` is used by default |

: REST Views Options (delete)

#### Return Type (delete)

`True` if the document was deleted successfully or `False` otherwise.

#### Example (delete)

```Python
import warnings
from sdk.python.my_service import IMyServiceSakilaActor as Actor, MyService

my_service = MyService()

aid = 3
ans: bool = await self.my_service.sakila.actor.delete(
    where={"actor_id": aid}
)
if ans is False:
    warnings.warn(f"Actor not deleted - actor_id={aid} not found")
else:
    print(f"Actor document with ID={aid} was deleted")
```

### View.delete_many (PY)

`delete_many` is used to delete all REST documents that match a given filter. To delete a single document, see [delete](#delete).

#### Options (delete_many)

| Name | Type | Required | Description |
|---|---|---|---------------------|
| where | dict | Yes | Applies filtering conditions based on specific fields - works as a *document filter* |
| read_own_writes | bool | No | Ensures read consistency for a cluster of servers - `False` is used by default |

: REST Views Options (delete_many)

#### Return Type (delete_many)

An integer indicating the number of deleted documents.

#### Example (delete_many)

Suppose the actor table contains a bunch of records as shown in [Cursor Example](#cursor-find_first).

```Python
from sdk.python.my_service import IMyServiceSakilaActor as Actor, MyService

my_service = MyService()

num_items_removed = await self.my_service.sakila.actor.delete_many(
    where={"last_name": {"like": "%%HA%%"}}
)
print(num_items_removed)
# 3
```

### View.update (PY)

`update` is used to update a REST document with a given identifier or primary key.

> To update multiple documents, see [update_many](#update_many).

#### Options (update)

| Name | Type | Required | Description |
|---|---|---|---------------------|
| data | TypedDict | Yes | Set of fields and corresponding values to update. The identifier or primary key must be included |

: REST Views Options (update)

#### Return Type (update)

A REST document data class object representing the up-to-date record. For more details about REST documents, check the [REST Documents](#rest-documents) section.

#### Example (update)

```Python
from datetime import datetime
from sdk.python.my_service import IMyServiceSakilaActor as Actor, MyService

my_service = MyService()

# The `actor_id` and `last_update` columns from the `sakila` table on the
# sample [sakila database](https://dev.mysql.com/doc/sakila/en/) are
# automatically generated on each insert, which means they can be omitted.
actor: Actor = await self.my_service.sakila.actor.create(
    data={"first_name": "Foo", "last_name": "Bar", "actor_id": 345}
)

actor_updated: Actor = await self.my_service.sakila.actor.update(
    data={
            "actor_id": cast(int, actor.actor_id),
            "first_name": "Rodolfo",
            "last_name": "Smith",
            "last_update": str(datetime.now()),
        }
    )

assert actor_updated.first_name == "Rodolfo"
assert actor_updated.last_name == "Smith"
assert actor.actor_id == actor_updated.actor_id
```

### View.update_many (PY)

`update_many` is used to update all REST documents with matching identifiers or primary keys.

> To update a single document, see [update](#update).

#### Options (update_many)

| Name | Type | Required | Description |
|---|---|---|---------------------|
| data | list of `TypedDict` | Yes | A list of set of fields and corresponding values to update. The identifier or primary key must be included for each "set of fields" (document)|

: REST Views Options (update_many)

#### Return Type (update_many)

A list of REST document data class objects representing the up-to-date records. For more details about REST documents, check the [REST Documents](#rest-documents) section.

#### Example (update_many)

```Python
from datetime import datetime
from sdk.python.my_service import IMyServiceSakilaActor as Actor, MyService

my_service = MyService()

# The `actor_id` and `last_update` columns from the `sakila` table on the
# sample [sakila database](https://dev.mysql.com/doc/sakila/en/) are
# automatically generated on each insert, which means they can be omitted.
actors: Actor = await self.my_service.sakila.actor.create(
    data=[
        {"first_name": "Foo", "last_name": "Bar", "actor_id": 345},
        {"first_name": "Bruh", "last_name": "Baz", "actor_id": 346},
    ]
)

actors_updated: Actor = await self.my_service.sakila.actor.update(
    data=[
        {
            "actor_id": cast(int, actors[0].actor_id),
            "first_name": "Rodolfo",
            "last_name": "Smith",
            "last_update": str(datetime.now()),
        },
        {
            "actor_id": cast(int, actors[1].actor_id),
            "first_name": "Ma",
            "last_name": "Yeung",
            "last_update": str(datetime.now()),
        },

    ]
    )

assert actors_updated[0].first_name == "Rodolfo"
assert actors_updated[0].last_name == "Smith"

assert actors_updated[1].first_name == "Ma"
assert actors_updated[1].last_name == "Yeung"
```

## REST Documents

A *REST document* behaves like a [Python data class](https://docs.python.org/3/library/dataclasses.html) instance, and implements an extended interface which includes the `update` and `delete` methods.

> Python data classes defining REST documents are public elements of the Service module, however, we advise you to not produce (instantiate) REST documents directly. Instead, we recommend doing so indirectly; by calling specific Python SDK commands such as `find*()` or `create*()`. See [REST Views](#rest-views) to know more about these commands.

### Document.update (PY)

`update` updates the REST document represented by the data class instance.

#### Options (update - document)

No options are implemented because the data required to complete the operation is assumed to be already included in the data class instance itself.

#### Return Type (update - document)

`None`.

#### Example (update - document)

```python
import asyncio
from datetime import datetime
from typing import Optional
from sdk.python.my_service import (
    IMyServiceSakilaActor as Actor,
    MyService,
    MrsDocumentNotFoundError,
)


async def get_actor_document_by_id(service: MyService, doc_id: int) -> Actor:
    try:
        actor: Actor = await service.sakila.actor.find_first_or_throw(
                where={"actor_id": doc_id}
            )
    except MrsDocumentNotFoundError:
        raise MrsDocumentNotFoundError(msg=f"No actor document exists matching actor_id={doc_id}")
    return actor


async def main() -> None:
    # Create service
    my_service = MyService()

    # Get a document
    doc_id = 3
    actor = await get_actor_document_by_id(service=my_service, doc_id=doc_id)
    print("Before:", actor)

    # Modify the data class instance representing a REST document
    actor.first_name = "DESIRE"
    actor.last_name = "LEE"
    actor.last_update = str(datetime.now())

    # Commit an update
    await actor.update()

    # Peak the REST document to see if it was updated accordingly
    actor_after = await get_actor_document_by_id(service=my_service, doc_id=doc_id)
    print("After:", actor_after)

    # Before: IMyServiceSakilaActor(last_name='CHASE', last_update='2023-04-13 15:11:22.000000', first_name='ED', actor_id=3)
    # After: IMyServiceSakilaActor(last_name='LEE', last_update='2025-01-09 13:07:50.000000', first_name='DESIRE', actor_id=3)


if __name__ == "__main__":
    asyncio.run(main())
```

### Document.delete (PY)

`delete` deletes the resource represented by the data class instance.

#### Options (delete - document)

No options are implemented because the data required to complete the operation is assumed to be already included in the data class instance itself.

#### Return Type (delete - document)

`None`.

#### Example (delete - document)

```python
import asyncio
from typing import Optional, cast
from sdk.python.my_service import (
    IMyServiceSakilaActor as Actor,
    MyService,
)


async def main():
    # Create service
    my_service = MyService()

    # Create a document
    #
    # The `actor_id` and `last_update` columns from the `sakila`
    # table on the sample [sakila database](https://dev.mysql.com/doc/sakila/en/)
    # are automatically generated on each insert, which means they can be omitted.
    actor = await my_service.sakila.actor.create(
        {"first_name": "GRACO", "last_name": "WALKER"}
    )
    print(actor)

    # Commit a delete
    await actor.delete()

    actor_after: Optional[Actor] = await my_service.sakila.actor.find_first(
        where={"actor_id": cast(int, actor.actor_id)}
    )
    print("deleted?", actor_after is None)

    # IMyServiceSakilaActor(last_name='WALKER', last_update='2025-01-09 13:31:16.000000', first_name='GRACO', actor_id=37171)
    # deleted? True


if __name__ == "__main__":
    asyncio.run(main())
```

## REST Routines

### Function.call (PY)

`call` is used to execute a REST routine (`FUNCTION` or `PROCEDURE`). In the case of a `FUNCTION`, the set of parameters (and corresponding values) as specified by the database routine are provided as corresponding keyword arguments. If the REST routine has an associated Async Task, the first parameter is, instead, a positional argument that uses a Python `dict` to specify additional task-specific execution options.

> For the sake of avoiding conflict with keyword argument names, an arbitrary number of positional arguments are enabled. The recommended treat is to pass only one options dictionary, as the first positional argument. If you, intentionally or not, pass more than one positional argument, the option value from the later dictionary in the sequence takes precedence.

#### Options (call)

| Option Name  | Data Type | Required | Default | Notes |
|---|---|---|---|---------------------|
| refresh_rate | `float` | No | `2.0` | Rate at which the underlying implementation checks for status updates of the execution. Value in **seconds**. An exception is raised if `refresh_rate` is lower than 0.5 seconds |
| progress | `Callable[[IMrsRunningTaskReport], Awaitable[None]]` | No | `None` | Callback function that gets executed (with the details provided by the status update) while the status of the execution remains in `RUNNING` state. By default, no progress is carried on. |
| timeout | `float` | No | `None` | Maximum time to wait for the execution to complete. If this threshold is reached, the ongoing task execution is killed and `MrsTaskTimeOutError` exception is raised. By default, no timeout is enforced.

: REST Function/Procedure Options (call)

#### Return Type (call)

The Python data type returned by `<func_name>(...)` depends on the data type returned by the MySQL function.

> For instance, the Python data type `int` must be expected for MySQL functions declared to return `TINYINT`, `SMALLINT`, `MEDIUMINT`, `INT` and `BIGINT`.

#### Exceptions (call)

For REST routines with an associated asynchronous task, `call` can raise exceptions as follows:

| Exception  | Notes |
|---|---------------------|
| `MrsTaskExecutionError` | When the status update reports back an `ERROR` event. |
| `MrsTaskExecutionCancelledError` | When the status update reports back a `CANCELLED` event. |
| `MrsTaskTimeOutError` | When the specified `timeout` threshold is reached. |

#### Example (call)

```python
from sdk.python import MyService

my_service = MyService()

res = await my_service.sakila.hello_func.call(name="Rui")
# print(res) -> Hello, Rui!

res = await my_service.sakila.sum_func.call(a=3, b=2)
# print(res) -> 5

res = await my_service.sakila.my_birthday_func.call()
# print(res) -> 2024-07-18 00:00:00
```

where `hello_func`, `sum_func` and `my_birthday_func` are:

```sql
-- one input
mysql> CREATE FUNCTION hello_func (name CHAR(20))
> RETURNS CHAR(50) DETERMINISTIC
> RETURN CONCAT('Hello, ', name, '!');

-- many input
mysql> CREATE FUNCTION sum_func (a INT, b INT)
> RETURNS INT DETERMINISTIC
> RETURN a + b;

-- no input
mysql> CREATE FUNCTION my_birthday_func ()
> RETURNS DATETIME DETERMINISTIC
> RETURN CURDATE();
```

### Function.start (PY)

`start()` is used to start a REST routine (`FUNCTION` or `PROCEDURE`), with an associated Async Task, without waiting for it to finish.

#### Options (start)

`start()` accepts the same set of options as `call()`, see [Function.call](#functioncall-py) for more details.

#### Return Type (start)

A [Task](#async-tasks) instance.

#### Example (start)

```python
from sdk.python import MyService

my_service = MyService()

task = await my_service.sakila.delayed_hello_func.start({"refresh_rate": 5.0}, name="Rui")
```

where `delayed_hello_func` is:

```sql
mysql> DELIMITER $$
mysql> CREATE FUNCTION delayed_hello_func (name CHAR(20))
> RETURNS CHAR(50) DETERMINISTIC
> SQL SECURITY INVOKER
> BEGIN
>   DO SLEEP(5);
>   RETURN CONCAT('Hello, ', name, '!');
> END $$
```

### Procedure.call (PY)

`call` is used to execute a REST routine (`FUNCTION` or `PROCEDURE`). In the case of a `PROCEDURE`, the set of `IN`/`INOUT` parameters (and corresponding values) as specified by the database routine are provided as corresponding keyword arguments. If the REST routine has an associated Async Task, the first parameter is, instead, a positional argument that uses a Python `dict` to specify additional task-specific execution options.

> For the sake of avoiding conflict with keyword argument names, an arbitrary number of positional arguments are enabled. The recommended treat is to pass only one options dictionary, as the first positional argument. If you, intentionally or not, pass more than one positional argument, the option value from the later dictionary in the sequence takes precedence

#### Options (call)

Input parameters aren't mandatory, meaning you are free to not provide them.

In case of being provided, input parameters can also be assigned a null value when calling the procedure, in other words, you can set any parameters to `None`.

As for additional options, see [Function.call](#functioncall-py) for more details.

#### Return Type (call)

A data class object representing a REST result set. This object includes the following attributes:

- `out_parameters`: Dictionary with fields for each  `OUT`/`INOUT`  parameter declared as part of the MySQL procedure that produces an actual value. If a parameter is not used to return a value, the field will not be present in the dictionary.

- `result_sets`: List of result set types generated when executing one or more SELECT statements as part of the procedure body. Each result set type can include one or more items.

#### Example (call)

Consider the following dummy procedures:

```sql
-- Assuming the database `mrs_tests` exists
-- You can use the MySQL Client console to run this script

DELIMITER //

CREATE PROCEDURE mrs_tests.mirror_proc (INOUT channel CHAR(4))
BEGIN
    SELECT REVERSE(channel) INTO channel;
END//


CREATE PROCEDURE mrs_tests.twice_proc (IN number INT, OUT number_twice INT)
BEGIN
    SELECT number*2 INTO number_twice;
END//


CREATE PROCEDURE mrs_tests.sample_proc(
    IN arg1 CHAR(5), INOUT arg2 CHAR(5), OUT arg3 FLOAT
)
BEGIN
    SELECT "foo" as name, 42 as age;
    SELECT "bar" as something;
END//

DELIMITER ;
```

Use command `call()` to call a REST procedure in the Python SDK.

```python
from sdk.python import MyService

my_service = MyService()

procedure_result = await my_service.mrs_tests.mirror_proc.call(channel="roma")
print(procedure_result)
# IMrsProcedureResponse(
#     result_sets=[],
#     out_parameters={"channel": "amor"}
# )


procedure_result = await my_service.mrs_tests.twice_proc.call(number=13)
print(procedure_result)
# IMrsProcedureResponse(
#     result_sets=[],
#     out_parameters={"number_twice": 26}
# )


# Note how `arg1` is not provided, and `arg2` is set to null.
procedure_result = await my_service.mrs_tests.sample_proc.call(arg2=None)
print(procedure_result)
# IMrsProcedureResponse(
#     result_sets=[
#         MrsProcedureResultSet(
#             type="items0",
#             items=[{"name": "foo", "age": 42}],
#         ),
#         MrsProcedureResultSet(
#             type="items1",
#             items=[{"something": "bar"}],
#         ),
#     ],
#     out_parameters={'arg2': None, 'arg3': None}
# )
```

The first two procedures do not generate result sets, however the third one does. By omission, result sets are untyped meaning generic type names are used for the result sets.

If you want a typed result set, meaning you wish to specify a type, you can do so at the MRS procedure level via the MySQL Shell:

```sql
CREATE OR REPLACE REST PROCEDURE /sampleProc
    ON SERVICE /myService SCHEMA /mrsTests
    AS mrs_tests.sample_proc
    RESULT IMyServiceMrsTestsSampleProcResultSet1 {
        name: name @DATATYPE("CHAR(3)"),
        age: age @DATATYPE("TINYINT")
    }
    RESULT IMyServiceMrsTestsSampleProcResultSet2 {
        something: something @DATATYPE("CHAR(3)")
    };
```

Calling the REST procedure again from the Python SDK leads to:

```python
from sdk.python import MyService

my_service = MyService()


# Note how `arg1` is not provided, and `arg2` is set to null.
procedure_result = await my_service.mrs_tests.sample_proc.call(arg2=None)
# print(procedure_result.result_sets)
# [
#     MrsProcedureResultSet(
#         type="IMyServiceMrsTestsSampleProcResultSet1",
#         items=[{"name": "foo", "age": 42}],
#     ),
#     MrsProcedureResultSet(
#         type="IMyServiceMrsTestsSampleProcResultSet2",
#         items=[{"something": "bar"}],
#     ),
# ],
```

### Procedure.start (PY)

See [Function.start](#functionstart-py) for more details.

#### Options (start)

`start()` accepts the same set of options as `call()`, see [Procedure.call](#procedurecall-py) for more details.

#### Return Type (start)

A [Task](#async-tasks) instance.

#### Example (start)

```python
from sdk.python import MyService

my_service = MyService()

task = await my_service.sakila.delayed_hello_proc.start({"refresh_rate": 5.0}, name="Rui")
```

where `delayed_hello_proc` is:

```sql
mysql> DELIMITER $$
mysql> CREATE FUNCTION delayed_hello_proc (name CHAR(20), out salute CHAR(40))
> RETURNS CHAR(50) DETERMINISTIC
> SQL SECURITY INVOKER
> BEGIN
>   DO SLEEP(5);
>   SELECT CONCAT('Hello, ', name, '!') INTO salute;
> END $$
```

## Async Tasks

Asynchronous Tasks are an MRS construct used to manage the life-cycle of a long-running procedure which clients can poll to monitor for status updates. From the client-standpoint, a Task can produce the following type of events (status updates):

- `SCHEDULED` starting the routine schedules a new task
- `RUNNING` progress status updates whilst the procedure is running
- `COMPLETE` result produced by the routine after it finishes
- `TIMEOUT` if the routine does not produce a result before a given timeout
- `ERROR` runtime error whilst executing the routine
- `CANCELLED` when the associated asynchronous task is killed before the routine finishes

### Task.watch (PY)

`watch` is used to monitor the status of a REST routine (`FUNCTION` or `PROCEDURE`) with an associated Async Task.

#### Return Type (watch)

An [Asynchronous Generator](https://peps.python.org/pep-0525/) instance which produces status update reports with details about the execution context of the REST routine.

#### Example (watch)

```py
task = await my_service.my_db.delayed_hello_func.start({"refresh_rate": 3.0}, name="Rui")

async for report in task.watch():
    if report.status == "RUNNING":
        print(report.progress)
    elif report.status === "ERROR":
        print(report.message)
```

### Task.kill (PY)

`kill` is used to kill the underlying Async Task of a REST routine (`FUNCTION` or `PROCEDURE`) and cancel its execution.

#### Example (kill)

```py
task = await my_service.my_db.delayed_hello_func.start({ "timeout": 4 }, name="Rui")

async for report in task.watch():
    if report.status == "TIMEOUT":
        await task.kill()
    elif report.status === "CANCELLED":
        print(report.message)
```
