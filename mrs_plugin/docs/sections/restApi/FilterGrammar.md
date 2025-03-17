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

# FilterObject Grammar

The FilterObject must be a JSON object that complies with the following syntax:

```txt
    FilterObject { orderby , asof, wmembers }
```

The orderby, asof, and wmembers attributes are optional, and their definitions are as follows:

```txt
orderby
    "$orderby": {orderByMembers}

orderByMembers
    orderByProperty
    orderByProperty , orderByMembers

orderByProperty
    columnName : sortingValue

sortingValue
    "ASC"
    "DESC"
    "-1"
    "1"
    -1
    1

asof
    "$asof": gtid

wmembers
    wpair
    wpair , wmembers

wpair
    columnProperty
    complexOperatorProperty

columnProperty
    columnName : string
    columnName : number
    columnName : date
    columnName : geo
    columnName : vector
    columnName : boolean
    columnName : simpleOperatorObject
    columnName : complexOperatorObject
    columnName : [complexValues]

columnName
"\p{Alpha}[[\p{Alpha}]]([[\p{Alnum}]#$_])*$"

complexOperatorProperty
    complexKey : [complexValues]
    complexKey : simpleOperatorObject

complexKey
    "$and"
    "$or"

complexValues
    complexValue , complexValues

complexValue
    simpleOperatorObject
    complexOperatorObject
    columnObject

columnObject
    {columnProperty}

simpleOperatorObject
    {simpleOperatorProperty}

complexOperatorObject
    {complexOperatorProperty}

simpleOperatorProperty
    "$eq" : string | number | date | geo | vector | boolean
    "$ne" : string | number | date | geo | vector | boolean
    "$lt" :  number | date
    "$lte" : number | date
    "$gt" : number | date
    "$gte" : number | date
    "$instr" : string
    "$ninstr" : string
    "$like" : string
    "$null" : null
    "$notnull" : null
    "$between" : betweenValue
    "$match": fullTextSearch

betweenValue
    [null , betweenNotNull]
    [betweenNotNull , null]
    [betweenRegular , betweenRegular]

betweenNotNull
    number
    date

betweenRegular
    string
    number
    date

fullTextSearch
    {"$params":[fieldList], "$against":{"$expr":fullTextExpr}}
    {"$params":[fieldList], "$against":{"$expr":fullTextExpr, "$modifier":fullTextMod}}
```

Data type definitions include the following:

```txt
string
    JSONString

number
    JSONNumber

date
      {"$date":"datechars"}

gtid
    JSONString

geo
    https://en.wikipedia.org/wiki/GeoJSON

vector
    [numberList]

numberList
    number, numberList

fieldList
    fieldName, fieldList

fieldName: JSONString

fullTextExpr: JSONString

fullTextMod:
    "IN NATURAL LANGUAGE MODE"
    "IN NATURAL LANGUAGE MODE WITH QUERY EXPANSION"
    "IN BOOLEAN MODE"
    "WITH QUERY EXPANSION"
```

Where:

```txt
datechars is an RFC3339 date format in UTC (Z)


JSONString
        ""
        " chars "
chars
        char
        char chars
char
        any-Unicode-character except-"-or-\-or-control-character
        \"
        \\
        \/
        \b
        \f
        \n
        \r
        \t
        \u four-hex-digits


JSONNumber
    int
    int frac
    int exp
    int frac exp
int
    digit
    digit1-9 digits
    - digit
    - digit1-9 digits
frac
    . digits
exp
    e digits
digits
    digit
    digit digits
e
    e
    e+
    e-
    E
    E+
    E-
```

The FilterObject must be encoded according to Section 2.1 of RFC3986.
