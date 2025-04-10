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

# Working with Vector Data Types

MySQL supports the VECTOR data type for representing a structure that can hold up to a specified number of entries `N`, where each entry is a 4-byte (single-precision) floating-point value.

Visit the [official documentation](https://dev.mysql.com/doc/refman/9.0/en/vector.html) to know more about the MySQL VECTOR type.


## MRS Python SDK

### Client-Side Representation

MySQL Rest Service (MRS) Python SDK utilizes the following client-side data type for representing, operating on, or manipulating MySQL vector data:

| MySQL data type  | MRS Python SDK data type |
| :--------: | :-------: |
| VECTOR | [`list`](https://docs.python.org/3/tutorial/datastructures.html#more-on-lists) of [`floats`](https://docs.python.org/3/library/functions.html#float)|

The MRS Python SDK data type shall be used when inserting or updating (upstream operations) a record that contains a field matching a column of a *vector* data type. Symmetrically, for downstream operations such as finding records having *vector* fields, such fields are specified with MRS Python SDK data types according to the above mapping.

When a vector column has a `NULL` value, the Python SDK uses `None` on the client side to represent it.


### Out of Bounds

As specified for the [MySQL Vector data](https://dev.mysql.com/doc/refman/9.0/en/vector.html) type, each entry must be a 4-byte (single-precision) floating-point value. Python lists can store a wider set of floating point values, in this regard, nothing stops the application from specifying entries that are out of bounds, such as a double-precision values.

This event may happen unintentionally, or not, however, in any case, the client does not carry on a verification, in other words, entries are sent to the server as they are, and the client lets the server handle it (an error should be expected).

### Examples

In the following sections, fictional but relevant examples are presented to showcase the usage of the MySQL Vector data type via the MRS Python SDK.

> The examples assume a sample database named `mrs_tests` exists.

Consider the following sample table:

```sql
/*
Sample table including a column for vector type.
*/
DROP TABLE IF EXISTS mrs_tests.table_vector;
CREATE TABLE mrs_tests.table_vector (
    idx SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    embedding VECTOR,
    PRIMARY KEY  (idx)
);
```

After you have added the corresponding schema (`mrs_tests`) and view (`table_vector`) objects to the MRS service (let's say `my_service`), you can start using the MRS Python SDK.

#### Create

Inserting a record into the `table_vector` table in the `mrs_tests` sample database.

```py
from sdk.python import MyService


async def main():
    my_service = MyService()

    data = [
        {
            "embedding": [
                3.1415159702301025,
                2.719064950942993,
                -87.53939819335938,
                44.11e+10,
            ]
        },
        {"embedding": [9.147116, -76.769115, -5.354053]},
        {"embedding": None},
    ]
    async for doc in my_service.mrs_tests.table_vector.create_many(data):
        print(doc.embedding)

    # ------STDOUT-------
    # [3.1415159702301025, 2.719064950942993, -87.53939819335938, 44.11e+10]
    # [9.147116, -76.769115, -5.354053]
    # None


if __name__ == "__main__":
    asyncio.run(main())
```

#### Update

Updating a record from the `table_vector` table in the `mrs_tests` sample database.

```py
from sdk.python import MyService


async def main():
    my_service = MyService()

    doc = await my_service.mrs_tests.table_vector.update(
        data={
            "idx": 1,
            "embedding": [-3.141516, 5.769005, -0.334013, 33.333, -12.76],
        }
    )


if __name__ == "__main__":
    asyncio.run(main())
```


#### Find

Finding a record from the `table_vector` table in the `mrs_tests` sample database.

```py
from sdk.python import MyService


async def main():
    my_service = MyService()

    doc_id = 2
    try:
        doc = await my_service.mrs_tests.table_vector.find_first_or_throw(
            where={"idx": doc_id}
        )
    except MrsDocumentNotFoundError:
        raise MrsDocumentNotFoundError(msg=f"No document exists matching idx={doc_id}")

    print(doc.embedding)

    # ------STDOUT-------
    # [9.147116, -76.769115, -5.354053]


if __name__ == "__main__":
    asyncio.run(main())
```
