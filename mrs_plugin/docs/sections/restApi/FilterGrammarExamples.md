<!-- Copyright (c) 2022, 2023, Oracle and/or its affiliates.

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License, version 2.0,
as published by the Free Software Foundation.

This program is also distributed with certain software (including
but not limited to OpenSSL) that is licensed under separate terms, as
designated in a particular file or component or in included license
documentation.  The authors of MySQL hereby grant you an additional
permission to link the program and your derivative works with the
separately licensed software that they have included with MySQL.
This program is distributed in the hope that it will be useful,  but
WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
the GNU General Public License, version 2.0, for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software Foundation, Inc.,
51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA -->

# FilterObject Grammar Examples

## ORDER BY property ($orderby)

```txt
Order by with literals

{
  "$orderby": {"SALARY":  "ASC","ENAME":"DESC"}
}

Order by with numbers

{
  "$orderby": {"SALARY":  -1,"ENAME":  1}
}
```

## ASOF property ($asof)

```txt
With SCN (Implicit)

{
  "$asof": 1273919
}

With SCN (Explicit)

{
  "$asof": {"$scn": "1273919"}
}

With Date (Implicit)

{
  "$asof": "2014-06-30T00:00:00Z"
}

With Date (Explicit)

{
  "$asof": {"$date": "2014-06-30T00:00:00Z"}
}
```

## EQUALS operator ($eq)

```txt
Implicit (Support String and Dates too)

{
  "SALARY": 1000
}

Explicit

{
  "SALARY": {"$eq": 1000}
}

Strings

{
  "ENAME": {"$eq":"SMITH"}
}

Dates

{
  "HIREDATE": {"$date": "1981-11-17T08:00:00Z"}
}
```

## NOT EQUALS operator ($ne)

```txt
Number

{
  "SALARY": {"$ne": 1000}
}

String

{
  "ENAME": {"$ne":"SMITH"}
}

Dates

{
  "HIREDATE": {"$ne": {"$date":"1981-11-17T08:00:00Z"}}
}
```

## LESS THAN operator ($lt)

(Supports dates and numbers only)

```txt
Numbers

{
  "SALARY": {"$lt": 10000}
}

Dates

{
  "SALARY": {"$lt": {"$date":"1999-12-17T08:00:00Z"}}
}
```

## LESS THAN OR EQUALS operator ($lte)

(Supports dates and numbers only)

```txt
Numbers

{
  "SALARY": {"$lte": 10000}
}

Dates

{
  "HIREDATE": {"$lte": {"$date":"1999-12-17T08:00:00Z"}}
}
```

## GREATER THAN operator ($gt)

(Supports dates and numbers only)

```txt
Numbers

{
  "SALARY": {"$gt": 10000}
}

Dates

{
  "SALARY": {"$gt": {"$date":"1999-12-17T08:00:00Z"}}
}
```

## GREATER THAN OR EQUALS operator ($gte)

(Supports dates and numbers only)

```txt
Numbers

{
  "SALARY": {"$gte": 10000}
}

Dates

{
  "HIREDATE": {"$gte": {"$date":"1999-12-17T08:00:00Z"}}
}
```

## In string operator ($instr)

(Supports strings only)

```txt
{
  "ENAME": {"$instr":"MC"}
}
```

## Not in string operator ($ninstr)

(Supports strings only)

```txt
{
  "ENAME": {"$ninstr":"MC"}
}
```

## LIKE operator ($like)

(Supports strings. Eescape character not supported to try to match expressions with _ or % characters.)

```txt
{
  "ENAME": {"$like":"AX%"}
}
```

## BETWEEN operator ($between)

(Supports string, dates, and numbers)

```txt
Numbers

{
  "SALARY": {"$between": [1000,2000]}
}

Dates

{
  "SALARY": {"$between": [{"$date":"1989-12-17T08:00:00Z"},{"$date":"1999-12-17T08:00:00Z"}]}
}

Strings

{
  "ENAME": {"$between": ["A","C"]}
}

Null Ranges ($lte equivalent)
(Supported by numbers and dates only)

{
  "SALARY": {"$between": [null,2000]}
}

Null Ranges ($gte equivalent)
(Supported by numbers and dates only)

{
  "SALARY": {"$between": [1000,null]}
}
```

## NULL operator ($null)

```json
{
  "ENAME": {"$null": null}
}
```

## NOT NULL operator ($notnull)

```json
{
  "ENAME": {"$notnull": null}
}
```

## AND operator ($and)

(Supports all operators, including $and and $or)

```txt
Column context delegation
(Operators inside $and will use the closest context defined in the JSON tree.)

{
  "SALARY": {"$and": [{"$gt": 1000},{"$lt":4000}]}
}

Column context override
(Example: salary greater than 1000 and name like S%)

{
  "SALARY": {"$and": [{"$gt": 1000},{"ENAME": {"$like":"S%"}} ] }
}

Implicit and in columns

{
  "SALARY": [{"$gt": 1000},{"$lt":4000}]
}
```

## High order AND

(All first columns and or high order operators -- $and and $ors -- defined at the first level of the JSON will be joined and an implicit AND)

```txt
(Example: Salary greater than 1000 and name starts with S or T)

{
  "SALARY": {"$gt": 1000},
  "ENAME": {"$or": [{"$like":"S%"}, {"$like":"T%"}]}
}

Invalid expression (operators $lt and $gt lack column context)

{
  "$and": [{"$lt": 5000},{"$gt": 1000}]
}

Valid alternatives for the previous invalid expression

{
  "$and": [{"SALARY": {"$lt": 5000}}, {"SALARY": {"$gt": 1000}}]
}

{
  "SALARY": [{"$lt": 5000},{"$gt": 1000}]
}

{
  "SALARY": {"$and": [{"$lt": 5000},{"$gt": 1000}]}
}
```

## OR operator ($or)

(Supports all operators including $and and $or)

```txt
Column context delegation
(Operators inside $or will use the closest context defined in the JSON tree)

{
  "ENAME": {"$or": [{"$eq":"SMITH"},{"$eq":"KING"}]}
}

Column context override
(Example: name starts with S or salary greater than 1000)

{
  "SALARY": {"$or": [{"$gt": 1000},{"ENAME": {"$like":"S%"}} ] }
}
```
