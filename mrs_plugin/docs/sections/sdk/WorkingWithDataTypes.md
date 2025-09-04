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

# Working with Data Types

MySQL supports and extensive list of data types that cannot be directly mapped development language native datatypes in many cases. This section discusses how to handles those MySQL datatypes in the Client SDK. The conversion rules apply consistently across REST View fields, REST Procedure input and output parameters and REST function input parameters and results.

## Spatial Data Types

MySQL supports an extended SQL environment, based on the conventions established by the OpenGIS Geometry Model, that enables a set of spatial column data types to hold geometry values. Some of them hold single values:

- `POINT`
- `LINESTRING`
- `POLYGON`

On the other hand, there are spatial data types that are meant to hold collections of geometry values:

- `MULTIPOINT`
- `MULTILINESTRING`
- `MULTIPOLYGON`
- `GEOMETRYCOLLECTION`

`GEOMETRYCOLLECTION` can store a collection of objects of any type. The other collection types (`MULTIPOINT`, `MULTILINESTRING`, and `MULTIPOLYGON`) restrict collection members to those having a particular geometry type.

Additionally, there is a `GEOMETRY` data type that is meant to hold any kind of value for the data types described above.

### TypeScript SDK

MySQL Rest Service (MRS) TypeScript SDK expects a GeoJSON-like object for representing, operating on, or manipulating spatial data.

For instance, with a setup using the [Sakila Sample Database](https://dev.mysql.com/doc/sakila/en/) where the schema is available under a REST service called `myService`, when inserting records into the `address` table, you can use a GeoJSON-like object to specify the value for the `location` column, which has a generic `GEOMETRY` data type, as described in the following sections.

**_Upstream Commands_**

#### Create

```TypeScript
// GeoJSON
myService.sakila.address.create({ data: {
  location: {
    type: "Point",
    coordinates: [11.11, 12.22]
  }
}})
```

#### Update

The same convention should also apply when updating records on the same table.

```TypeScript
// GeoJSON
myService.sakila.address.update({
  where: {
    address_id: 1
  }
  data: {
    location: {
      type: "Point",
      coordinates: [11.11, 12.22]
    }
  }
})

myService.sakila.address.updateMany({
  where: [{
    address_id: 1
  }, {
    address_id: 2
  }],
  data: {
    location: {
      type: "Point",
      coordinates: [11.11, 12.22]
    }
  }
})
```

#### Types Mismatch

If the column has a narrow data type such as `POINT`, instead of the more generic `GEOMETRY`, specifying an incompatible type on the client-side, should yield a compilation error. For example, assuming a table `mrs_tests`.`spatial_tests` created as follows:

```sql
CREATE DATABASE IF NOT EXISTS mrs_tests;
CREATE TABLE IF NOT EXISTS mrs_tests.spatial_tests (id INT AUTO_INCREMENT NOT NULL, ls LINESTRING, PRIMARY KEY (id));
```

With the table (and corresponding schema) available from the same `myService` REST service, trying to insert a `POINT` does not work, because the column only accepts a `LINESTRING`.

```TypeScript
myService.mrsTests.spatialTests.create({
  data: {
    ls: {
      type: "Point",
      coordinates: [0, 0]
    }
  }
})
```

A command like the one above yields a compilation error.

> Type 'Point' is not assignable to type 'LineString'.

In the same way, trying to insert or update multiple values for a single field when the column data type only allows a single value, or vice-versa, should also yield a compilation error. For, example, assuming the `mrs_tests.spatial_tests` table was created as follows:

```sql
CREATE TABLE IF NOT EXISTS mrs_tests.spatial_tests (id INT AUTO_INCREMENT NOT NULL, ls GEOMETRYCOLLECTION, PRIMARY KEY (id));
```

Trying to insert a `POINT` does not work, because the column only accepts either a `MULTIPOINT`, a `MULTILINESTRING` or a `MULTIPOLYGON`.

```TypeScript
myService.mrsTests.spatialTests.create({
  data: {
    ls: {
      type: "Point",
      coordinates: [0, 0]
    }
  }
})
```

In this case, the command yields the following compilation error:

> Type 'Point' is not assignable to type 'MultiPoint | MultiLineString | MultiPolygon'.

### Python SDK

MySQL Rest Service (MRS) Python SDK supports one format for representing, operating on, or manipulating spatial data:

- [GeoJSON](https://dev.mysql.com/doc/refman/9.1/en/opengis-geometry-model.html)

This format can be used when inserting or updating (upstream operations) a record that contains a field matching a column of a Spatial data type. Symmetrically, for downstream operations such as finding records having spatial fields, such fields are specified as GeoJSON types.

For instance, with a setup using the [Sakila Sample Database](https://dev.mysql.com/doc/sakila/en/) where the schema is available under a REST service called `myService`, when inserting records into the `address` table, you can work with the value for the `location` column, which has a generic `GEOMETRY` data type, as described in the following sections.

**_Upstream Commands_**

#### Create

Inserting a record into the address table in the Sakila sample database.

```py
from sdk.python import MyService, IMyServiceSakilaAddress as Address

my_service = MyService()

address: Address = await myService.sakila.address.create(
    {
        "location": {
            "type": "Point",
            "coordinates": [11.11, 12.22],
        }
    }
)
```

#### Update

Updating a record from the address table in the Sakila sample database.

```py
from sdk.python import MyService, IMyServiceSakilaAddress as Address

my_service = MyService()

address: Address = await myService.sakila.address.update(
    data={
        "address_id": 1,
        "location": {
            "type": "Point",
            "coordinates": [11.11, 12.22],
        }
    }
)
```

**_Downstream Commands_**

#### Find

Finding a record from the address table in the Sakila sample database.

```py
from sdk.python import MyService, IMyServiceSakilaAddress as Address, MrsDocumentNotFoundError

my_service = MyService()

doc_id = 1
try:
    address: Address = await myService.sakila.address.find_first_or_throw(
        where={"address_id": doc_id}
    )
except MrsDocumentNotFoundError:
    raise MrsDocumentNotFoundError(msg=f"No address document exists matching actor_id={doc_id}")

print(address.location)
# {"type": "Point", "coordinates": [11.11, 12.22]}
```

#### Types Mismatch

If the column has a narrow data type such as `POINT`, instead  of the more generic `GEOMETRY`, specifying an incompatible type on the client-side, should yield a mypy (typing system) error. For example, assuming a table `mrs_tests.spatial_tests` created as follows:

```sql
CREATE DATABASE IF NOT EXISTS mrs_tests;
CREATE TABLE IF NOT EXISTS mrs_tests.spatial_tests (id INT AUTO_INCREMENT NOT NULL, ls LINESTRING, PRIMARY KEY (id));
  ```

Trying to insert a `Point` triggers a typing error, because the column only accepts a `LineString`.

```py
from sdk.python.my_service import IMyServiceMrsTestsSpatialTests as SpatialTests


my_doc: SpatialTests = await myService.mrs_tests.spatial_tests.update(
    data={
        "id": 1,
        "ls": {
            "type": "Point",
            "coordinates": [0, 0],
        }
    }
)
```

> Type `Point` is not assignable to type `LineString`.

In the same way, trying to insert or update multiple values for a single field when the column data type only allows a single value, or vice-versa, should also yield a typing error. For example, assuming the table `mrs_tests.spatial_tests` was, instead, created as follows:

```sql
CREATE TABLE IF NOT EXISTS mrs_tests.spatial_tests (id INT AUTO_INCREMENT NOT NULL, ls GEOMETRYCOLLECTION, PRIMARY KEY (id));
```

Trying to insert a `Point` triggers a typing error, because the column only accepts either a `MultiPoint`, a `MultiLineString` or a `MultiPolygon`.

```py
from sdk.python.my_service import IMyServiceMrsTestsSpatialTests as SpatialTests


my_doc: SpatialTests = await myService.mrs_tests.spatial_tests.create(
    {
        "ls": {
            "type": "Point",
            "coordinates": [0, 0],
        }
    }
)
```

> Type `Point` is not assignable to type `MultiPoint`, `MultiLineString` or `MultiPolygon`.

## Working with Date and Time Data Types

MySQL supports date and time data types for representing temporal values:

- [TIMESTAMP](https://dev.mysql.com/doc/refman/8.4/en/datetime.html) - contain both date and time parts.
- [DATETIME](https://dev.mysql.com/doc/refman/8.4/en/datetime.html) - contain both date and time parts.
- [DATE](https://dev.mysql.com/doc/refman/8.4/en/datetime.html) - contain date part but no time part.
- [TIME](https://dev.mysql.com/doc/refman/8.4/en/time.html) - contain time but not date part.
- [YEAR](https://dev.mysql.com/doc/refman/8.4/en/year.html) - represent year values.

Visit the [official documentation](https://dev.mysql.com/doc/refman/8.4/en/date-and-time-types.html) to know more about these MySQL data types.

### Python SDK

MySQL Rest Service (MRS) Python SDK utilizes the following client-side data types for representing, operating on, or manipulating MySQL date and time data:

| MySQL data type  | MRS Python SDK data type |
| :--------: | :-------: |
| TIMESTAMP | [`datetime.datetime`](https://docs.python.org/3/library/datetime.html#datetime.datetime) |
| DATETIME | [`datetime.datetime`](https://docs.python.org/3/library/datetime.html#datetime.datetime) |
| DATE | [`datetime.date`](https://docs.python.org/3/library/datetime.html#datetime.date) |
| TIME | [`datetime.timedelta`](https://docs.python.org/3/library/datetime.html#datetime.timedelta) |
| YEAR | `int` |

: MRS Python SDK data type mapping

The MRS Python SDK data types shall be used when inserting or updating (upstream operations) a record that contains a field matching a column of a *date and time* data type. Symmetrically, for downstream operations such as finding records having *date and time* fields, such fields are specified with MRS Python SDK data types according to the above equivalences.

In the following sections, fictional but relevant examples are presented to showcase the usage of MySQL Date and Time data types via the MRS Python SDK.

> The examples assume a sample database named `mrs_tests` exists.

#### Example - View

Consider the following sample table:

```sql
/*
Sample table including a column for each date and time data type.
*/
DROP TABLE IF EXISTS mrs_tests.table_date_and_time;

CREATE TABLE mrs_tests.table_date_and_time (
    idx SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    dt DATETIME(6),
    d DATE,
    t TIME(6),
    y YEAR,
    PRIMARY KEY  (idx)
);

INSERT INTO  mrs_tests.table_date_and_time (dt, dt_shorter, d, t, y) VALUES
    ("2023-07-30 14:59:01", "2023-07-30 14:59:01", "1987-12-09", "119:10:0.100023", 1999),
    ("2025-02-27 09:41:25.000678", "2025-02-27 09:41:25.000678", "2010-01-01", "099:35:0.60003", 2005);
```

After you have added the corresponding schema (`mrs_tests`) and view (`table_date_and_time`) objects to the MRS service (let's say `my_service`), you can start using the MRS Python SDK.

**_Upstream Commands_**

##### Create

Inserting a record into the `table_date_and_time` table in the `mrs_tests` sample database.

```py
import datetime
from sdk.python import MyService

my_service = MyService()

doc = await my_service.mrs_tests.table_date_and_time.create(
    {
        "dt": datetime.datetime.now(),
        "d": datetime.date(2020, 10, 20),
        "t": datetime.timedelta(days=31, microseconds=202023),
        "y": 1976,
    }
)
```

> If you wanted field `d` to be `NULL`, for instance, you would have to use `None` instead of `datetime.date(...)`.

##### Update

Updating a record from the `table_date_and_time` table in the `mrs_tests` sample database.

```py
import datetime
from sdk.python import MyService

my_service = MyService()

doc = await my_service.mrs_tests.table_date_and_time.update(
    data={
        "idx": 1,
        "t": datetime.timedelta(days=4, hours=4, minutes=1, seconds=1),
    }
)
```

**_Downstream Commands_**

##### Find

Finding a record from the `table_date_and_time` table in the `mrs_tests` sample database.

```py
import datetime
from sdk.python import MyService

my_service = MyService()

doc = await my_service.mrs_tests.table_date_and_time.find_first(
    where={
        "AND": [
            {
                "dt": {
                    "lt": datetime.datetime.fromisoformat(
                        "2023-07-30 15:59:01"
                    )
                }
            },
            {"d": {"gte": datetime.date.fromisoformat("1987-12-09")}},
        ]
    }
)
```

#### Example - Function

Consider the following sample function:

```sql
/*
Sample functions using date and time data types.
*/
DROP FUNCTION IF EXISTS mrs_tests.func_date_and_time_ts;
CREATE FUNCTION mrs_tests.func_date_and_time_ts (ts TIMESTAMP(4))
    RETURNS TIMESTAMP(4) DETERMINISTIC
    RETURN TIMESTAMPADD(MONTH, 1, ts);
```

After you have added the corresponding schema (`mrs_tests`) and function (`func_date_and_time_ts`) objects to the MRS service (let's say `my_service`), you can start using the MRS Python SDK.

Calling the `func_date_and_time_ts` in the `mrs_tests` sample database:

```py
import datetime
from sdk.python import MyService

my_service = MyService()

# `ts` stands for timestamp
value = await self.my_service.mrs_tests.func_date_and_time_ts(ts=datetime.datetime.now())
```

#### Types Mismatch

If an unexpected data type is specified on the client-side for a certain field (column), the Python environment via mypy should yield a typing error.

## Working with Vector Data Types

MySQL supports the VECTOR data type for representing a structure that can hold up to a specified number of entries `N`, where each entry is a 4-byte (single-precision) floating-point value.

Visit the [official documentation](https://dev.mysql.com/doc/refman/9.0/en/vector.html) to know more about the MySQL VECTOR type.

### Python SDK

#### Client-Side Representation

MySQL Rest Service (MRS) Python SDK utilizes the following client-side data type for representing, operating on, or manipulating MySQL vector data:

| MySQL data type  | MRS Python SDK data type |
| :--------: | :-------: |
| VECTOR | [`list`](https://docs.python.org/3/tutorial/datastructures.html#more-on-lists) of [`floats`](https://docs.python.org/3/library/functions.html#float)|

: Client-Side Representation of Vector Datatype

The MRS Python SDK data type shall be used when inserting or updating (upstream operations) a record that contains a field matching a column of a *vector* data type. Symmetrically, for downstream operations such as finding records having *vector* fields, such fields are specified with MRS Python SDK data types according to the above mapping.

When a vector column has a `NULL` value, the Python SDK uses `None` on the client side to represent it.

#### Out of Bounds

As specified for the [MySQL Vector data](https://dev.mysql.com/doc/refman/9.0/en/vector.html) type, each entry must be a 4-byte (single-precision) floating-point value. Python lists can store a wider set of floating point values, in this regard, nothing stops the application from specifying entries that are out of bounds, such as a double-precision values.

This event may happen unintentionally, or not, however, in any case, the client does not carry on a verification, in other words, entries are sent to the server as they are, and the client lets the server handle it (an error should be expected).

#### Examples

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

##### Create

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

##### Update

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

##### Find

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

## Working with lossy numbers

TypeScript `number`s use a double precision 64-bit binary format as defined by the IEEE 754 standard. This means that it is not capable, without losing precision, of representing integers above 2^53-1 (which are valid in the 64-bit integer range) and also fixed-point arbitrary precision decimals. This is particularly important because the `BIGINT` data type in MySQL can represent numbers up to 2^64-1 and the `DECIMAL`/`NUMERIC` data type can represent fixed point numbers.

64-bit integers can still be represented using a `BigInt` type without losing precision, so the TypeScript SDK converts the raw JSON number into a corresponding instance of this type, if the value, in fact, looses precision. Otherwise it converts it to a regular `number` instance.

For example, consider a table as follows:

```sql
    CREATE TABLE IF NOT EXISTS my_db.my_table (small BIGINT UNSIGNED, large BIGINT UNSIGNED);
    INSERT INTO my_db.my_table (small, large) VALUES (1234, 18446744073709551615);
```

with a corresponding REST View created as follows:

```sql
    CREATE REST VIEW /myTable
        ON SERVICE /myService SCHEMA /myDb
        AS `my_db`.`my_table` {
            small: small,
            large: large,
        };
```

The document can be retrieved, using the TypeScript SDK, as follows:

```TypeScript
const doc = await myService.myDb.myTable.findFirst({ where: { large: 18446744073709551615n } })
console.log(doc.small) // 123
console.log(typeof doc.small) // number
console.log(doc.large) // 18446744073709551615n
console.log(typeof doc.large) // bigint
```

However, there is no similar construct for fixed-point decimals. In this case, the MRS TypeScript SDK handles these values as `string`s, if they, in fact, lose precision. For example, consider a table as follows:

```sql
    CREATE TABLE IF NOT EXISTS my_db.my_table (wide DECIMAL(18, 17) narrow DECIMAL(18, 17));
    INSERT INTO my_db.my_table (wide, narrow) VALUES (1.234, 1.23456789012345678);
```

with a corresponding REST View created as follows:

```sql
    CREATE REST VIEW /myTable
        ON SERVICE /myService SCHEMA /myDb
        AS `my_db`.`my_table` {
            wide: wide,
            narrow: narrow,
        };
```

The document can be retrieved, using the TypeScript SDK, as follows:

```TypeScript
const doc = await myService.myDb.myTable.findFirst({ where: { narrow: "1.23456789012345678" } })
console.log(doc.wide) // 123
console.log(typeof doc.wide) // number
console.log(doc.narrow) // 1.23456789012345678
console.log(typeof doc.narrow) // string
```
