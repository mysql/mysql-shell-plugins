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

# Python Client API Reference


## MRS Services

The MRS Python SDK exposes a type-safe programmable interface for the MySQL REST Service that unifies, under a set of contextual commands, the available HTTP operations to access and use database objects (tables, views and functions) exposed as REST resources.

The following MRS REST resources can be accessed from a service namespace:

* [Schemas](#mrs-schemas)

The following commands can be accessed from a service namespace:

* [authenticate](#authenticate)

### authenticate

`authenticate` is a service-level command that authenticates a user so he/she can work with restricted MySQL REST Services.

#### Options (authenticate)

| Name | Type | Required | Description
|---|---|---|---|
| app_name  | str | Yes | Name of the authentication application (as specified by the admin) |
| user  | str | Yes | User name |
| password  | str | No | If not provided, the empty string is assumed as the password
 |

The following authentication application names are supported:

* *MRS*

#### Return Type (authenticate)

`None`.

#### Example (authenticate)

```python
from sdk.python import MyService

my_service = MyService()

# `authenticate` will account for authentication
 await my_service.authenticate(
    app_name="${app_name}",
    user="Lucas",
    password="S3cr3t"
)

# Service is ready and tied database objects can be utilized
# E.g., calling a function
res = await my_service.sakila.hello_func(name="Rui")
# print(res) -> Hello, Rui!
```



## MRS Schemas

In the Python SDK, database objects such as tables and functions are grouped under namespaces that correspond to their schema. Applications can access and use those database objects via the API exposed by each one.

The following MRS REST resources can be accessed from the corresponding schema namespace:

* [Tables](#mrs-tables)
* [Records](#mrs-records)
* [Functions](#mrs-functions)



## MRS Tables


### create

`create` is used to insert a record in a given table. The record is represented as a typed dictionary object whose fields, or keys, should comply with the interface exposed by the type definition `INew${obj_class_name}` where `${obj_class_name}` is a variable which value depends on the *service, schema and table* names themselves.

> To insert multiple records, see [create_many](#create_many).

#### Options (create)

| Name | Type | Required | Description
|---|---|---|---|
| data  | TypedDict | Yes | Object containing the mapping between column names and values for the record to be inserted |

#### Return Type (create)

An MRS dataclass object representing the record that was inserted. For more details about MRS dataclass objects, see [MRS Records](#mrs-records).

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



### create_many

`create_many` is used to insert one or more records in a given table. A record is represented as a typed dictionary object whose fields, or keys, should comply with the interface exposed by the type definition `INew${obj_class_name}` where `${obj_class_name}` is a variable which value depends on the *service, schema and table* names themselves.

> To insert a single record, see [create](#create).

#### Options (create_many)

| Name | Type | Required | Description
|---|---|---|---|
| data  | Sequence of `TypedDict` - it can be any Python object supporting the iteration protocol, such as lists and tuples | Yes | List of objects containing the mapping between column names and values for the records to be inserted |

#### Return Type (create_many)

A list of MRS dataclass objects of each record that was inserted. For more details about MRS dataclass objects, see [MRS Records](#mrs-records).

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



### find_first

`find_first` is used to query the first record that matches a given optional filter. It returns `None` if no record is found.

> To raise an exception if there are no matches, use [find_first_or_throw](#find_first_or_throw) instead.

> To find multiple records, see [find_many](#find_many).

#### Options (find_first)

| Name | Type | Required | Description |
|---|---|---|---|
| select | dict or list | No | Specifies which properties to include or exclude on the returned record - works as a *field filter* |
| where | dict | No | Applies filtering conditions based on specific fields - works as a *record filter* |
| skip | int | No | Specifies how many records to skip before returning one of the matches |
| order_by | dict | No | Lets you customize the order (`ASC` or `DESC`) in which the records are returned based on specific fields|
| cursor | dict | No | Specifies the position of the first item to include in the result set. A cursor bookmarks a location in a result set and must be a column containing unique and sequential values. |
| read_own_writes | bool | No | Ensures read consistency for a cluster of servers - `False` is used by default |

> Cursor-based pagination takes precedence over offset-based pagination, which means that if a cursor is defined, the value of the offset property (`skip`) will be ignored.

#### Return Type (find_first)

If there is a match, an MRS dataclass object meeting the filter conditions, otherwise `None` is returned. For more details about MRS dataclass objects, see [MRS Records](#mrs-records).

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
# In this case, we would get records where the
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



### find_first_or_throw

`find_first_or_throw` is used to query the first record that matches a given optional filter in the same way as [find_first](#find_first) does. However, if the query does not find a record, it raises a `RecordNotFoundError` exception.

> To not raise an exception and get `None` if there are no matches, use [find_first](#find_first) instead.

> To find multiple records, see [find_many](#find_many).

#### Options (find_first_or_throw)

`find_first_or_throw` and `find_first` implement the very same options. For more details about these, see [Options (find_first)](#options-find_first).

#### Return Type (find_first_or_throw)

If there is a match, an MRS dataclass object meeting the filter conditions is returned, otherwise an exception `RecordNotFoundError` is raised. For more details about MRS dataclass objects, see [MRS Records](#mrs-records).

#### Example (find_first_or_throw)

Usage is similar to `find_first`, however, now you should account for a possible exception:

```Python
import warnings
from sdk.python.my_service import IMyServiceSakilaActor as Actor, MyService, RecordNotFoundError

my_service = MyService()

try:
    actor: Actor = await self.my_service.sakila.actor.find_first_or_throw(
        select={"last_name": False},
        where={"first_name": {"like": "%%ED%%"}},
    )
except RecordNotFoundError:
    warnings.warn("Ups, no matches found")
```

See [Example (find_first)](#example-find_first) for additional usage options.



### find_unique

`find_unique` is used to query a single, uniquely identified record by:

- Primary key column(s)
- Unique column(s)

It returns `None` if no record is found.

> To raise an exception if there are no matches, use [find_unique_or_throw](#find_unique_or_throw) instead.

#### Options (find_unique)

| Name | Type | Required | Description |
|---|---|---|---|
| select | dict or list | No | Specifies which properties to include or exclude on the returned record - works as a *field filter* |
| where | dict | Yes | Applies filtering conditions based on specific fields (must be unique) - works as a *record filter* |
| read_own_writes | bool | No | Ensures read consistency for a cluster of servers - `False` is used by default |

#### Return Type (find_unique)

If there is a match, an MRS dataclass object meeting the filter conditions, otherwise `None` is returned. For more details about MRS dataclass objects, see [MRS Records](#mrs-records).

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



### find_unique_or_throw

`find_unique_or_throw` is used to query a single, uniquely identified record by:

- Primary key column(s)
- Unique column(s)

If no record was found matching the given filter conditions, `RecordNotFoundError` is raised.

> To not raise an exception and get `None` if there are no matches, use [find_unique](#find_unique) instead.

#### Options (find_unique_or_throw)

`find_unique_or_throw` and `find_unique` implement the very same options. For more details about these, see [Options (find_unique)](#options-find_unique).

#### Return Type (find_unique_or_throw)

If there is a match, an MRS dataclass object meeting the filter conditions, otherwise `RecordNotFoundError` is raised. For more details about MRS dataclass objects, see [MRS Records](#mrs-records).

#### Example (find_unique_or_throw)

```Python
import warnings
from sdk.python.my_service import IMyServiceSakilaActor as Actor, MyService, RecordNotFoundError

my_service = MyService()

aid = 3
try:
    actor: Actor = await self.my_service.sakila.actor.find_unique_or_throw(
        where={"actor_id": aid}, select=["last_update"], read_own_writes=False
    )
except RecordNotFoundError:
    warnings.warn("Ups, no matches found")
```

See [Example (find_first)](#example-find_first) for additional usage options.



### find_many

`find_many` is used to query a subset of records in one or more pages, and optionally, those that match a given filter.

> To find all records see [find_all](#find_all).

#### Options (find_many)

| Name | Type | Required | Description |
|---|---|---|---|
| select | dict or list | No | Specifies which properties to include or exclude on the returned record - works as a *field filter* |
| where | dict | No | Applies filtering conditions based on specific fields - works as a *record filter* |
| skip | int | No | Specifies how many records to skip before returning one of the matches |
| order_by | dict | No | Lets you customize the order (`ASC` or `DESC`) in which the records are returned based on specific fields|
| cursor | dict | No | Specifies the position of the first item to include in the result set. A cursor bookmarks a location in a result set and must be a column containing unique and sequential values. |
| read_own_writes | bool | No | Ensures read consistency for a cluster of servers - `False` is used by default |
| take | int | No | Maximum number of records to return |
| iterator | bool | No | Enable or disable iterator behavior. It is used by the SDK to reset the internal iterator when consuming paginated data in order to avoid n + 1 requests, the internal iterator stops after the MySQL Router says there are no more items. Default value is `True` (enabled). |

> Cursor-based pagination takes precedence over offset-based pagination, which means that if a cursor is defined, the value of the offset property (`skip`) will be ignored.

#### Return Type (find_many)

A list of MRS dataclass objects representing the records that match the filter. For more details about MRS dataclass objects, see [MRS Records](#mrs-records).

#### Example (find_many)

```Python
from sdk.python.my_service import IMyServiceSakilaActor as Actor, MyService

my_service = MyService()

actors: list[Actor] = await self.my_service.sakila.actor.find_many(
    where={"first_name": "PENELOPE"},
    take=2,
    skip=2,
)

print(actors)
# [
#     IMyServiceSakilaActor(
#         actor_id=35000,
#         first_name='PENELOPE',
#         last_name='BAR',
#         last_update='2024-06-04 10:14:33.000000'
#     ),
#     IMyServiceSakilaActor(
#         actor_id=36000,
#         first_name='PENELOPE',
#         last_name='FOO',
#         last_update='2024-08-04 10:14:33.000000'
#     )
# ]
```

See [Example (find_first)](#example-find_first) for additional usage options.



### find_all

`find_all` is used to query every record, and optionally, all those that match a given filter.

> To get a paginated subset of records, see [find_many](#find_many).

#### Options (find_all)

| Name | Type | Required | Description |
|---|---|---|---|
| select | dict or list | No | Specifies which properties to include or exclude on the returned record - works as a *field filter* |
| where | dict | No | Applies filtering conditions based on specific fields - works as a *record filter* |
| skip | int | No | Specifies how many records to skip before returning one of the matches |
| order_by | dict | No | Lets you customize the order (`ASC` or `DESC`) in which the records are returned based on specific fields|
| cursor | dict | No | Specifies the position of the first item to include in the result set. A cursor bookmarks a location in a result set and must be a column containing unique and sequential values. |
| read_own_writes | bool | No | Ensures read consistency for a cluster of servers - `False` is used by default |
| progress | function | No | Specifies a function to be called back when reporting progress |

> Cursor-based pagination takes precedence over offset-based pagination, which means that if a cursor is defined, the value of the offset property (`skip`) will be ignored.


#### Return Type (find_all)

A list of MRS dataclass objects representing the records that match the filter. For more details about MRS dataclass objects, see [MRS Records](#mrs-records).

#### Example (find_all)

```Python
import time
from sdk.python.my_service import (
    IMyServiceSakilaActorData as ActorData,
    IMyServiceSakilaActor as Actor,
    MyService
)

my_service = MyService()

def my_progress(data: list[ActorData]) -> None:
    print("Test Progress Option")
    for i, item in enumerate(data):
        print(f"{i+1} of {len(data)}: actor_id={item["actor_id"]}")
        time.sleep(0.1)

# get all records that first name matches 'PENELOPE'
actors: list[Actor] = await self.my_service.sakila.actor.find_all(
    where={"first_name": "PENELOPE"}, progress=my_progress
)
```

See [Example (find_first)](#example-find_first) for additional usage options.



### delete

`delete` is used to delete a single, uniquely identified record by:

- Primary key column(s)
- Unique column(s)

> To delete multiple records, see [delete_many](#delete_many).

#### Options (delete)

| Name | Type | Required | Description |
|---|---|---|---|
| where | dict | Yes | Applies filtering conditions based on specific fields (must be unique) - works as a *record filter* |
| read_own_writes | bool | No | Ensures read consistency for a cluster of servers - `False` is used by default |

#### Return Type (delete)

`True` if the record was deleted successfully or `False` otherwise.

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
    print(f"Actor record with ID={aid} was deleted")
```



### delete_many

`delete_many` is used to delete all records that match a given filter. To delete a single record, see [delete](#delete).

#### Options (delete_many)

| Name | Type | Required | Description |
|---|---|---|---|
| where | dict | Yes | Applies filtering conditions based on specific fields - works as a *record filter* |
| read_own_writes | bool | No | Ensures read consistency for a cluster of servers - `False` is used by default |

#### Return Type (delete_many)

An integer indicating the number of deleted records.

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


### update

`update` is used to update a record with a given identifier or primary key.

> To update multiple records, see [update_many](#update_many).

#### Options (update)

| Name | Type | Required | Description |
|---|---|---|---|
| data | TypedDict | Yes | Set of fields and corresponding values to update. The identifier or primary key must be included |

#### Return Type (update)

An MRS dataclass object representing the up-to-date record. For more details about MRS dataclass objects, see [MRS Records](#mrs-records).

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




### update_many

`update_many` is used to update all records with matching identifiers or primary keys.

> To update a single record, see [update](#update).

#### Options (update_many)

| Name | Type | Required | Description |
|---|---|---|---|
| data | list of `TypedDict` | Yes | A list of set of fields and corresponding values to update. The identifier or primary key must be included for each "set of fields" (record)|

#### Return Type (update_many)

A list of MRS dataclass objects representing the up-to-date records. For more details about MRS dataclass objects, see [MRS Records](#mrs-records).

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



## MRS Records

An *MRS dataclass object* behaves as a [Python dataclass](https://docs.python.org/3/library/dataclasses.html) instance, and implements an extended interface which includes the `save` and `delete` methods.

### save

`save` creates or updates the record represented by the dataclass instance.

> If the specified primary key already exists, an *update* happens, otherwise a *create*.

After completing the operation, the dataclass instance fields are updated in-place.

#### Options (save)

No options are implemented because the data required to complete the operation is assumed to be already included in the data class instance itself.

#### Return Type (save)

`None`.

#### Example (save)

Showcasing a *create*.

```python
from sdk.python.my_service import IMyServiceSakilaActor as Actor, MyService

my_service = MyService()

# The `actor_id` and `last_update` columns from the `sakila` table on the
# sample [sakila database](https://dev.mysql.com/doc/sakila/en/) are
# automatically generated on each insert, which means they can be omitted.
actor = Actor(
    schema=self.my_service.sakila,
    data={
        "first_name": "CHARLY",
        "last_name": "BROWN"
    },
)
await actor.save()

print(actor)
# Actor(actor_id=6753, first_name='CHARLY', last_name='BROWN', last_update='2024-06-04 10:14:33.000000')
```

Showcasing an *update*.

```python
from sdk.python.my_service import IMyServiceSakilaActor as Actor, MyService

my_service = MyService()

actor: Optional[Actor] = await my_service.sakila.actor.find_first(
        where={"actor_id": 3}
    )
if actor is None:
    print("Ups, Invalid record ID")
    sys.exit()
print("Before:", actor)

actor.first_name = "RODOLFO"
actor.last_name = "CHASE"
actor.last_update = str(datetime.now())

await actor.save()

print(actor)

# Before: Actor(actor_id=3, first_name='ED', last_name='SMITH', last_update='2023-04-13 15:11:22.000000')
# After: Actor(actor_id=3, first_name='RODOLFO', last_name='CHASE', last_update='2024-06-04 10:14:33.000000')
```


### delete (record)

`delete` deletes the resource represented by the data class instance.

#### Options (delete - record)

No options are implemented because the data required to complete the operation is assumed to be already included in the data class instance itself.

#### Return Type (delete - record)

`None`.

#### Example (delete - record)

```python
from sdk.python.my_service import IMyServiceSakilaActor as Actor, MyService

my_service = MyService()

actor: Optional[Actor] = await my_service.sakila.actor.find_first(
        where={"actor_id": 3}
    )
if actor is None:
    print("Ups, no record found")
    sys.exit()

print(actor)
await actor.delete()

actor: Optional[Actor] = await my_service.sakila.actor.find_first(
        where={"actor_id": 3}
    )
print("deleted?", actor is None)

# Actor(actor_id=3, first_name='ED', last_name='SMITH', last_update='2023-04-13 15:11:22.000000')
# deleted? True
```


## MRS Functions

### Options (function)

The input arguments and respective types accepted and expected by `<func_name>(...)` depend on the MySQL function declaration. See [Example (function)](#examples-function) for an example.

> The input arguments must be provided as keyword arguments.

### Return Type (function)

The Python data type returned by `<func_name>(...)` depends on the data type returned by the MySQL function.

> For instance, the Python data type `int` must be expected for MySQL functions declared to return `TINYINT`, `SMALLINT`, `MEDIUMINT`, `INT` and `BIGINT`.

See [Example (function)](#examples-function) for an example.


### Example (function)

Calling an MRS function in the Python SDK is exactly like calling a local Python function.

```python
from sdk.python import MyService

my_service = MyService()

res = await my_service.sakila.hello_func(name="Rui")
# print(res) -> Hello, Rui!

res = await my_service.sakila.sum_func(a=3, b=2)
# print(res) -> 5

res = await my_service.sakila.my_birthday_func()
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
