<!-- Copyright (c) 2022, 2025, Oracle and/or its affiliates.

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

# Working with REST Routines

In its most basic form, a REST Function or Procedure can be executed with the MRS SDK using the `call()` command. The command must receive, as input, the SET of `IN` and/or `INOUT` parameters (and corresponding values) allowed by the database routine.

The examples assume a setup using the [Sakila Sample Database](https://dev.mysql.com/doc/sakila/en/) where the schema and the corresponding tables and routines are available under a REST service called `myService`.

Consider the following REST Function based on the `inventory_in_stock` function available in the [Sakila Sample Database](https://dev.mysql.com/doc/sakila/en/).

```sql
CREATE OR REPLACE REST FUNCTION /inventoryInStock
    ON SERVICE /myService SCHEMA /sakila
    AS sakila.inventory_in_stock
    PARAMETERS MyServiceSakilaInventoryInStockParams {
        pInventoryId: p_inventory_id @IN
    }
    RESULT MyServiceSakilaInventoryInStockResult {
        result: result @DATATYPE("bit(1)")
    }
    AUTHENTICATION NOT REQUIRED;
```

**_TypeScript_**

In the TypeScript SDK, the command accepts, as its first parameter, an object containing the set of `IN` and/or `INOUT` parameters (and corresponding values).

```TypeScript
myService.sakila.inventoryInStock.call({ pInventoryId: 1 });
// true
```

**_Python_**

In the Python SDK, the command accepts the same set of parameters and values as keyword arguments:

```py
my_service.sakila.inventory_in_stock.call(p_inventory_id=1)
# true
```

For Functions or Procedures, all fields (or input parameters in this case) should be considered optional because they cannot have `NOT NULL` constraints, which always makes them nullable by nature. Thus, an optional parameter is just a parameter where the value can be `NULL`.

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

**_TypeScript_**

```TypeScript
myService.myDb.myFunc.call() // null
myService.myDb.myFunc.call({ x: 3 }) // 3
myService.myDb.myFunc.call({ x: 3, y: 2 }) // 5
```

**_Python_**

```py
my_service.my_db.myFunc() # None
my_service.my_db.myFunc(x=3) # 3
my_service.my_db.myFunc(x=3, y=2) # 5
```

## Async Task Support

Long-running REST Functions/Procedures can use the MySQL Async Task framework to spawn a monitoring task which can be asynchronously checked for updates by the client, in order to avoid directly executing the routine and hit any existing HTTP request or MySQL Router handling timeouts.

Using the MRS TypeScript SDK, applications can either manually monitor tasks spawned for a given REST routine, or simply execute the routine without having to worry about those issues.

In this case, for REST routine with an associated Async Task, the SDK will produce the same compatible `call()` command, with support for an additional object that allows to specify a set of execution options, namely:

- `refreshRate` specifies the interval (ms) between each status update check
- `progress` specifies an asynchronous callback that is executed with the details of each status update report

As an example, consider the REST Function depicted above has an associated Async Task. Executing the task, whilst obtaining the status update reports generated by that task can be done, in TypeScript, as follows:

```TypeScript
myService.sakila.inventoryInStock.call({ pInventoryId: 1 }, { progress: (r) => console.log(r) });
```

Additionally, the SDK produces a `start()` command, which starts the task and allows to manually watch for status updates and/or kill the task (cancelling the execution of the actual routine). The command accepts, as its first an only argument, the same set of `IN` and/or `INOUT` parameters (and corresponding values) and returns back a `Task` object which provides the API for task-level actions (check the reference [API docs](ClientAPITypeScript.md#task) for more details).

Starting the task and cancelling it if takes longer than a specified amount of time to finish can be done, in TypeScript, as follows:

```TypeScript
const task = myService.sakila.inventoryInStock.start({ pInventoryId: 1 }, { timeout: 10000 });

for await (const report of task.watch()) {
  if (report.status === "TIMEOUT") {
    await task.kill();
  } else if (report.status === "CANCELLED") {
    // this block is executed after the task is killed
    console.log(report.message);
  }
}
```

Getting the actual result produced by the REST routine can be done as follows:

```TypeScript
const task = myService.sakila.inventoryInStock.start({ pInventoryId: 1 });

for await (const report of task.watch()) {
  if (report.status === "COMPLETED") {
    console.log(report.data); // true
  }
}
```
