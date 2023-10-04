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
"$asof": date
"$asof": "datechars"
"$asof": scn
"$asof": +int

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
"$eq" : string | number | date
"$ne" : string | number | date
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
"$like": string

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
```

Data type definitions include the following:

```txt
string 
      JSONString
number
      JSONNumber
date
      {"$date":"datechars"}
scn
      {"$scn": +int}
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
