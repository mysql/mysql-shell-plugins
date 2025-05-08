---
title: MySQL REST Service - Reference Manual
---

**MySQL REST Service - Developer's Guide**

This book explains how to install and configure the MySQL REST Service (MRS) as well as how to access the data through REST calls.

- [MRS Introduction](#introduction-to-the-mysql-rest-service)
- [MRS Deployment Architecture](#architecture)
- [MRS Configuration](#configuring-mysql-rest-service)
- [Adding REST Services and Database Objects](#adding-rest-services-and-database-objects)
- [GUI Interfaces for REST Service Configuration](#working-interactively-with-rest-services)
- [Authentication and Authorization](#authentication-and-authorization)
- [MRS Examples](#mrs-examples)
  - [MRS Notes Example](#mrs-notes-example)
  - [MRS Scripts Example](#mrs-scripts-example)

---

**MySQL REST Service DDL - SQL Extension Reference**

This document discusses the MySQL REST Service (MRS) DDL - SQL Extension. The MRS DDL - SQL Extension adds a set of MRS specific DDL statements to the MySQL Shell SQL handling in order to provide a familiar management interface to MySQL developers and DBAs.

- [Introduction to the MRS DDL Extension](#introduction)
- [MRS SQL Reference: CONFIGURE and CREATE](#configure-and-create)
- [MRS SQL Reference: ALTER](#alter)
- [MRS SQL Reference: DROP](#drop)
- [MRS SQL Reference: GRANT and REVOKE](#grant-and-revoke)
- [MRS SQL Reference: USE and SHOW](#use-and-show)

---

**MRS Core REST APIs**

This book provides examples of using the MySQL REST Service queries and other operations against tables and views after you have REST-enabled them.

- [About MRS RESTful Web Services](#about-mrs-restful-web-services)
- [Get Schema Metadata](#get-schema-metadata)
- [Get Object Metadata](#get-object-metadata)
- [Get Object Data](#get-object-data)
- [Insert Table Row](#insert-table-row)
- [Delete Using Filter](#delete-using-filter)
- [FilterObject Grammar](#filterobject-grammar)
- [Examples: FilterObject Specifications](#filterobject-grammar-examples)

---

**MySQL REST Service - SDK Reference**

This document explains how to work with the MRS Software Development Kit and discusses the Client API.

- [Introduction to the MRS SDK](#introduction-to-the-mrs-sdk)
- [Working with a REST Service](#working-with-a-rest-service)
- [Querying Data Across Tables](#querying-data-across-tables)
- [Functions And Procedures](#functions-and-procedures)
- [Contextual Fields and Parameters](#contextual-fields-and-parameters)
- [Read Your Writes Consistency](#read-your-writes-consistency)
- [Checking for NULL Column Values](#checking-for-null-column-values)
- [Working with Spatial Data Types](#working-with-spatial-data-types)
- [Working with Date and Time Data Types](#working-with-date-and-time-data-types)
- [Working with Vector Data Types](#working-with-vector-data-types)
- [Authentication](#authentication)
- [TypeScript Client API Reference](#typescript-client-api-reference)
- [Python Client API Reference](#python-client-api-reference)

---

**MySQL REST Service - Developer's Guide**

!include sections/devGuide/Introduction.md

!include sections/devGuide/Architecture.md

!include sections/devGuide/Configuration.md

!include sections/devGuide/AddingRESTServices.md

!include sections/devGuide/WorkingInteractively.md

!include sections/devGuide/RestViews.md

!include sections/devGuide/DialogReference.md

!include sections/devGuide/Auth.md

!include ../examples/readme.md

---

**MySQL REST Service DDL - SQL Extension Reference**

!include sections/sql/Introduction.md

!include sections/sql/ConfigureAndCreate.md

!include sections/sql/Alter.md

!include sections/sql/Drop.md

!include sections/sql/GrantAndRevoke.md

!include sections/sql/UseAndShow.md

---

**MRS Core REST APIs**

!include sections/restApi/About.md

!include sections/restApi/Queries.md

!include sections/restApi/FilterGrammar.md

!include sections/restApi/FilterGrammarExamples.md

---

**MySQL REST Service - SDK Reference**

!include sections/sdk/Introduction.md

!include sections/sdk/WorkingWithARESTService.md

!include sections/sdk/QueryingDataAcrossTables.md

!include sections/sdk/FunctionsAndProcedures.md

!include sections/sdk/ContextualFieldsAndParameters.md

!include sections/sdk/ReadYourWrites.md

!include sections/sdk/CheckingForNullColumnValues.md

!include sections/sdk/WorkingWithSpatialDataTypes.md

!include sections/sdk/WorkingWithDateAndTimeDataTypes.md

!include sections/sdk/WorkingWithVectorDataTypes.md

!include sections/sdk/Authentication.md

!include sections/sdk/ClientAPITypeScript.md

!include sections/sdk/PythonAPIRef.md

Copyright (c) 2022, 2025, Oracle and/or its affiliates.
