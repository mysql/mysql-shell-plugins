<!-- Copyright (c) 2022, 2024, Oracle and/or its affiliates.

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

# Contextual fields and parameters

There are different requirements at play when inserting a new row or when updating an existing row in a Table or View using the MySQL REST Service. For starters, since there is currently no support for partial updates, this means that every time an application wants to update a row, it needs to provide a complete representation of the row as it will become. That representation can still determine potential columns which will be "unset" notwithstanding, at least for those cases where the columns do not impose a constraint that prevents such an action (this is in line with what happens on [ORDS](https://docs.oracle.com/en/database/oracle/oracle-rest-data-services/24.2/orddg/developing-REST-applications.html#GUID-A323AA4F-32BE-47B7-9CC2-C0F4C8F4DFBE)). On the other hand, even though there is no specific limitation for inserting new rows, an application should still be aware of the underlying column constraints to reduce the friction by requiring the minimum possible set of fields or alternatively, provide better user feedback (e.g. using the type checker) when it comes to missing fields required to perform the operation.

From the MRS SDK standpoint this means that the type definitions used to insert and update rows must be capable of making the distinction between required and optional fields. In practice, a field should always be required unless there is some specific circumstance that allows it to be optional such as the fact that it maps to an auto-generated primary key column, a foreign key column, a nullable column or a column with a default value. Whilst inserting a value, all of these circumstances are valid and should be accounted for, whereas whilst updating a value, due to the limitations described above, it only makes sense for a field to be optional when it maps to a nullable column or column with row ownership.

When it comes to Functions or Procedures, all fields (or input parameters in this case) should be considered optional because they cannot have `NOT NULL` constraints, which always makes them nullable by nature. Thus, an optional parameter is just a parameter where the value can be `NULL`.

The examples assume a setup using the [Sakila Sample Database](https://dev.mysql.com/doc/sakila/en/) where the schema and the corresponding tables and routines are available under a REST service called `myService`.

## Inserting a new row in a Table/View

Inserting a new row in the `actor` table does not require either the `actorId` field or the `lastUpdate` field because the former is an auto-generated primary key (`AUTO_INCREMENT`) whereas the latter maps to a column with a default value `CURRENT_TIMESTAMP()`.

### TypeScript

```TypeScript
myService.sakila.actor.create({ data: { firstName: "FOO", lastName: "BAR" } })
```

### Python

```py
my_service.sakila.actor.create(data={"first_name": "FOO", "last_name": "BAR"})
```

## Updating an existing row in a Table/View

Updating a row in the `actor` table requires all fields to be specified because neither `firstName` nor `lastName` are nullable. On the other hand, the `description` column in the `film_text` table is nullable.

### TypeScript

```TypeScript
myService.sakila.actor.update({ data: { id: 1, firstName: "PENELOPE", lastName: "CRUZ" } }) // Property 'lastUpdate' is missing in type '{ actorId: number; lastName: string; firstName: string; }' but required in type 'IUpdateMyServiceSakilaActor'.
myService.sakila.filmText.update({ data: { film_id: 1, title: "FOO" } })
```

### Python

```py
my_service.sakila.actor.update(data={"id": 1, "first_name": "PENELOPE", "last_name": "CRUZ"}) # Missing key "last_update" for TypedDict "IUpdateMyServiceSakilaActor"
my_service.sakila.film_text.update(data={"film_id": 1, "title": "FOO"})
```

## Calling a Function or Procedure

Calling a function or procedure does not require any field to be specified because input parameters are nullable by nature (there is no syntax to add `NOT NULL` constraints). It is expected that functions and procedures handle `NULL` values at runtime accordingly. For example, with MySQL Function as follows:

```sql
DELIMITER //
CREATE FUNCTION my_db.my_func (x INT, y INT)
RETURNS BIGINT DETERMINISTIC
BEGIN
  DECLARE sum_result BIGINT DEFAULT 0;
  IF y is NULL THEN
    SET sum_result = x;
  ELSE
    SET sum_result = x + y;
  END IF;
  RETURN sum_result;
END //
DELIMITER ;
```

where the corresponding REST object is created as follows:

```sql
CREATE OR REPLACE REST FUNCTION /myFunc ON SERVICE /myService SCHEMA /myDb AS my_db.my_func
  PARAMETERS IMyServiceMyDbMyFuncParams {
    x: x @IN,
    y: y @IN
  }
```

## TypeScript

```TypeScript
myService.myDb.myFunc.call() // null
myService.myDb.myFunc.call({ x: 3 }) // 3
myService.myDb.myFunc.call({ x: 3, y: 2 }) // 5
```

## Python

```py
my_service.my_db.myFunc() # None
my_service.my_db.myFunc(x=3) # 3
my_service.my_db.myFunc(x=3, y=2) # 5
```
