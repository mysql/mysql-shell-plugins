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

# Working with Spatial Data Types

MySQL supports an extended SQL environment, based on the conventions established by the OpenGIS Geometry Model, that enables a set of spatial column data types to hold geometry values. Some of them hold single values:

- `GEOMETRY`
- `POINT`
- `LINESTRING`
- `POLYGON`

`GEOMETRY` can store geometry values of any type. The other single-value types (`POINT`, `LINESTRING`, and `POLYGON`) restrict their values to a particular geometry type.

On the other hand, there are spatial data types that are meant to hold collections of geometry values:

- `MULTIPOINT`
- `MULTILINESTRING`
- `MULTIPOLYGON`
- `GEOMETRYCOLLECTION`

`GEOMETRYCOLLECTION` can store a collection of objects of any type. The other collection types (`MULTIPOINT`, `MULTILINESTRING`, and `MULTIPOLYGON`) restrict collection members to those having a particular geometry type.


## MRS TypeScript SDK

MySQL Rest Service (MRS) TypeScript SDK supports two formats for representing, operating on, or manipulating spatial data:

- Well-Known Text (WKT)
- GeoJSON

Both these formats can be used when inserting or updating a record that contains a field matching a column of a Spatial data type.

For instance, with a setup using the [Sakila Sample Database](https://dev.mysql.com/doc/sakila/en/) where the schema is available under a REST service called `myService`, when inserting records into the `address` table, you can specify the value for the `location` column, which has a generic `GEOMETRY` data type, as described in the following sections.

### Upstream Commands

#### Create

```TypeScript
// WKT
myService.sakila.address.create({ data: { location: "Point(11.11 12.22)" }})

myService.sakila.address.createMany([{
  data: {
    location: "Point(0 0)"
  }
}, {
  data: {
    location: "Point(11.11 12.22)"
  }
}])

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
// WKT
myService.sakila.address.update({
  where: {
    address_id: 1
  }
  data: {
    location: "Point(11.11 12.22)"
  }
})

myService.sakila.address.updateMany({
  where: [{
    address_id: 1
  }, {
    address_id: 2
  }],
  data: {
    location: "Point(11.11 12.22)"
  }
})

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

### Types Mismatch

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


## MRS Python SDK

MySQL Rest Service (MRS) Python SDK supports one format for representing, operating on, or manipulating spatial data:

- [GeoJSON](https://dev.mysql.com/doc/refman/9.1/en/opengis-geometry-model.html)

This format can be used when inserting or updating (upstream operations) a record that contains a field matching a column of a Spatial data type. Symmetrically, for downstream operations such as finding records having spatial fields, such fields are specified as GeoJSON types.

For instance, with a setup using the [Sakila Sample Database](https://dev.mysql.com/doc/sakila/en/) where the schema is available under a REST service called `myService`, when inserting records into the `address` table, you can work with the value for the `location` column, which has a generic `GEOMETRY` data type, as described in the following sections.

### Upstream Commands

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

### Downstream Commands

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

### Types Mismatch

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