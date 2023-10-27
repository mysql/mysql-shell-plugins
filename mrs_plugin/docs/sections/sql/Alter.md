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

# ALTER

## ALTER REST SERVICE

An existing REST service can be altered by using the `ALTER REST SERVICE` statement. It uses the same `restServiceOptions` as used by the [`CREATE REST SERVICE`](#create-rest-service) statement. Please see the discussion of the options [there](#create-rest-service).

**_SYNTAX_**

```antlr
alterRestServiceStatement:
    ALTER REST SERVICE serviceRequestPath (
        NEW REQUEST PATH newServiceRequestPath
    )? restServiceOptions?
;

restServiceOptions: (
        enabledDisabled
        | restAuthentication
        | jsonOptions
        | comments
    )+
;
```

alterRestServiceStatement ::=
![alterRestServiceStatement](../../images/sql/alterRestServiceStatement.svg "alterRestServiceStatement")

restServiceOptions ::=
![restServiceOptions](../../images/sql/restServiceOptions.svg "restServiceOptions")

**_Examples_**

The following example alters a REST service `/myService` by setting a new comment.

```sql
ALTER REST SERVICE /myService
    COMMENTS "A simple, improved REST service";
```

## ALTER REST SCHEMA

An existing REST schema can be altered by using the `ALTER REST SCHEMA` statement. It uses the same `restSchemaOptions` as used by the [`CREATE REST SCHEMA`](#create-rest-schema) statement. Please see the discussion of the options there.

**_SYNTAX_**

```antlr
alterRestSchemaStatement:
    ALTER REST DATABASE schemaRequestPath? (
        ON SERVICE? serviceRequestPath
    )? (
        NEW REQUEST PATH newSchemaRequestPath
    )? (FROM schemaName)? restSchemaOptions?
;

restSchemaOptions: (
        enabledDisabled
        | authenticationRequired
        | itemsPerPage
        | jsonOptions
        | comments
    )+
;
```

alterRestSchemaStatement ::=
![alterRestSchemaStatement](../../images/sql/alterRestSchemaStatement.svg "alterRestSchemaStatement")

restSchemaOptions ::=
![restSchemaOptions](../../images/sql/restSchemaOptions.svg "restSchemaOptions")

**_Examples_**

The following example alters a REST schema `/myService` to use a new request path `/myPublicService`.

```sql
ALTER REST SCHEMA /sakila ON SERVICE /myService
    NEW REQUEST PATH /myPublicService;
```

## ALTER REST DUALITY VIEW

The `ALTER REST DUALITY VIEW` statement is used to alter existing REST duality views.

Please see the corresponding [GraphQL section](#defining-the-graphql-definition-for-a-rest-duality-view) about how to design the GraphQL definition for a REST duality view.

Please see the MRS Developer's Guide to learn more about [JSON duality views](index.html#json-duality-views).

**_SYNTAX_**

```antlr
alterRestViewStatement:
    ALTER REST JSON? RELATIONAL? DUALITY? VIEW
        viewRequestPath (ON serviceSchemaSelector)? (
        NEW REQUEST PATH newViewRequestPath
    )? (
        CLASS restObjectName graphQlCrudOptions? graphQlObj?
    )? restObjectOptions?
;

serviceSchemaSelector:
    (SERVICE serviceRequestPath)? DATABASE schemaRequestPath
;

restObjectOptions: (
        enabledDisabled
        | authenticationRequired
        | itemsPerPage
        | jsonOptions
        | comments
        | restViewMediaType
        | restViewFormat
        | restViewAuthenticationProcedure
    )+
;
```

alterRestViewStatement ::=
![alterRestViewStatement](../../images/sql/alterRestViewStatement.svg "alterRestViewStatement")

serviceSchemaSelector ::=
![serviceSchemaSelector](../../images/sql/serviceSchemaSelector.svg "serviceSchemaSelector")

restObjectOptions ::=
![restObjectOptions](../../images/sql/restObjectOptions.svg "restObjectOptions")

**_Examples_**

The following example alters a REST duality view for the `sakila.city` database schema table and sets a new list of fields.

```sql
ALTER REST DUALITY VIEW /city
ON SERVICE /myService SCHEMA /sakila
FROM `sakila`.`city` AS MyServiceSakilaCity {
    cityId: city_id @SORTABLE,
    city: city
};
```

## ALTER REST PROCEDURE

The `ALTER REST PROCEDURE` statement is used to alter REST endpoints for database schema stored procedures.

It uses the same [extended GraphQL syntax](#defining-the-graphql-definition-for-a-rest-duality-view) as defined for REST duality views to describe the REST procedure's parameters and result sets. Please make sure to study the [corresponding section](#defining-the-graphql-definition-for-a-rest-duality-view).

**_SYNTAX_**

```antlr
alterRestProcedureStatement:
    ALTER REST PROCEDURE procedureRequestPath (
        ON serviceSchemaSelector
    )? (
        NEW REQUEST PATH newProcedureRequestPath
    )? (PARAMETERS restObjectName? graphQlObj)? restProcedureResult* restObjectOptions?
;

serviceSchemaSelector:
    (SERVICE serviceRequestPath)? DATABASE schemaRequestPath
;

restObjectOptions: (
        enabledDisabled
        | authenticationRequired
        | itemsPerPage
        | jsonOptions
        | comments
        | restViewMediaType
        | restViewFormat
        | restViewAuthenticationProcedure
    )+
;
```

alterRestProcedureStatement ::=
![alterRestProcedureStatement](../../images/sql/alterRestProcedureStatement.svg "alterRestProcedureStatement")

serviceSchemaSelector ::=
![serviceSchemaSelector](../../images/sql/serviceSchemaSelector.svg "serviceSchemaSelector")

restObjectOptions ::=
![restObjectOptions](../../images/sql/restObjectOptions.svg "restObjectOptions")
