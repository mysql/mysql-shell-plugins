<!-- Copyright (c) 2025, Oracle and/or its affiliates.

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

# Working with Date and Time Data Types

MySQL supports date and time data types for representing temporal values:

- [TIMESTAMP](https://dev.mysql.com/doc/refman/8.4/en/datetime.html) - contain both date and time parts.
- [DATETIME](https://dev.mysql.com/doc/refman/8.4/en/datetime.html) - contain both date and time parts.
- [DATE](https://dev.mysql.com/doc/refman/8.4/en/datetime.html) - contain date part but no time part.
- [TIME](https://dev.mysql.com/doc/refman/8.4/en/time.html) - contain time but not date part.
- [YEAR](https://dev.mysql.com/doc/refman/8.4/en/year.html) - represent year values.

Visit the [official documentation](https://dev.mysql.com/doc/refman/8.4/en/date-and-time-types.html) to know more about these MySQL data types.


## MRS Python SDK

MySQL Rest Service (MRS) Python SDK utilizes the following client-side data types for representing, operating on, or manipulating MySQL date and time data:

| MySQL data type  | MRS Python SDK data type |
| :--------: | :-------: |
| TIMESTAMP | [`datetime.datetime`](https://docs.python.org/3/library/datetime.html#datetime.datetime) |
| DATETIME | [`datetime.datetime`](https://docs.python.org/3/library/datetime.html#datetime.datetime) |
| DATE | [`datetime.date`](https://docs.python.org/3/library/datetime.html#datetime.date) |
| TIME | [`datetime.timedelta`](https://docs.python.org/3/library/datetime.html#datetime.timedelta) |
| YEAR | `int` |

The MRS Python SDK data types shall be used when inserting or updating (upstream operations) a record that contains a field matching a column of a *date and time* data type. Symmetrically, for downstream operations such as finding records having *date and time* fields, such fields are specified with MRS Python SDK data types according to the above equivalences.

In the following sections, fictional but relevant examples are presented to showcase the usage of MySQL Date and Time data types via the MRS Python SDK.

> The examples assume a sample database named `mrs_tests` exists.

### Example - View

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

#### Upstream Commands

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

#### Downstream Commands

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

### Example - Function

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

### Types Mismatch

If an unexpected data type is specified on the client-side for a certain field (column), the Python environment via mypy should yield a typing error.