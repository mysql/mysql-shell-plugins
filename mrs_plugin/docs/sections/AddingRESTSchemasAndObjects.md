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

# Adding Database Schemas and Objects to a REST Service

Adding database schema objects (tables, views or procedures) to a REST Service allows them to be accessed through RESTful Web services. Before database schema object can be added, the database schema containing those objects has to be added to the REST Service first.

The following image shows the a REST Schema and its REST Objects.

![REST Schema and its Objects](../images/vsc-mrs-schema-and-objects.png "REST Schema and its Objects")

Note that adding a database schema is not equivalent to exposing all tables and views in the schema through the RESTful Web service. It just means making the MySQL REST Service aware that the schema exists and that it may have zero or more resources to expose to HTTP/S.

## Preconditions to adding Database Schemas and Objects

In order to add REST Schemas and Objects the following preconditions need to be met.

1. A REST Service has to be added first. Please see the [Adding a REST Service](#adding-a-rest-service) section of this manual.
2. The MySQL account used to connect to the targeting MySQL Solution needs to be granted the `mysql_rest_service_schema_admin` MySQL role or a superset of privileges.

To grant the `mysql_rest_service_schema_admin` MySQL role execute the following SQL statement.

```sql
GRANT 'mysql_rest_service_schema_admin' TO 'user_account'@'%';

-- Please ensure to include all roles in the next statement
-- that should become active when the user connects
ALTER USER 'user_account'@'%' DEFAULT ROLE 'mysql_rest_service_schema_admin';
```

## Adding a Database Schema

MySQL database schemas can be added either with MySQL Shell for VS Code through convenient UI dialogs or with MySQL Shell directly on the command line or with scripts.

### Adding a Schema with MySQL Shell for VS Code

To add a database schema to a REST Service, right click on the schema in the DATABASE CONNECTIONS view and select `Add Schema to REST Service`.

This will show a dialog that lets you set all REST Schema parameters. Press `OK` to add the schema.

![Adding a Database Schema](../images/vsc-mrs-add-schema.png "Adding a Database Schema")

### Adding a Schema with the MySQL Shell

To add a database schema to a REST Service call the `mrs.add.schema()` function.

When started without parameters, an interactive wizard will ask for the required parameters.

```bash
 MySQL > localhost:33060+ > JS > mrs.add.schema()
   1 information_schema
   2 performance_schema
   3 sys
   4 sakila
   5 test
   6 forum
   7 ortho
   8 mrs_notes

Please enter the name or index of a schema: 4
Please enter the request path for this schema [/sakila]: /sakila
Should the schema require authentication [y/N]: 
How many items should be listed per page [Schema Default]: 
Comments: 
Options: 

Service with path /sakila created successfully.
```

Execute the following command to get detailed help information about the `mrs.add.schema()` function.

```js
\? mrs.add.schema
```

### REST Schema Properties

Each REST Schema has the following properties.

| Option | Description |
| --- | ----- |
| MRS Service Path | The path of the REST Service this REST Schema belongs to |
| Comments | Comments to describe this MRS Schema |
| REST Schema Path | The request path to access the schema, has to start with / |
| Schema Name | The name of the corresponding database schema |
| Items per Page | The default amount of items to be returned when requesting a REST Objects of this schema |
| Enabled | Whether or not the REST Objects of this REST Schema are exposed through the REST interface |
| Requires Authentication | Whether or not authentication is required to access the REST Objects of this REST Schema |
| Options | Additional options in JSON format |

## Adding a Database Object

MySQL database schema objects (tables, views and stored procedures) can be added either with MySQL Shell for VS Code through convenient UI dialogs or with MySQL Shell directly on the command line or with scripts.

### Adding a Database Object with MySQL Shell for VS Code

To add a database schema object to a REST Schema, right click on the database object in the DATABASE CONNECTIONS view and select `Add Database Object to REST Service`.

This will show a dialog that lets you set all REST Schema parameters. Press `OK` to add the schema.

![Adding a Database Object](../images/vsc-mrs-add-db-object.png "Adding a Database Object")

### Adding a Database Object with the MySQL Shell

To add a database schema to a REST Service call the `mrs.add.dbObject()` function.

When started without parameters, an interactive wizard will ask for the required parameters.

```bash
MySQL > localhost:33060+ > JS > mrs.add.dbObject()
   1 mrs_notes
   2 sakila

Please enter the name or index of a schema: 2
   1 TABLE
   2 VIEW
   3 PROCEDURE

Please enter the name or index of a database object type [TABLE]: 
   1 actor
   2 address
   3 category
   4 city
   5 country
   6 customer
   7 film
   8 film_actor
   9 film_category
  10 film_text
  11 inventory
  12 language
  13 payment
  14 rental
  15 staff
  16 store

Please enter the name or index of an database object: 4
Please enter the request path for this object [/city]: 
   1 CREATE
   2 READ
   3 UPDATE
   4 DELETE

Please select the CRUD operations that should be supported, '*' for all [READ]: 
   1 FEED
   2 ITEM
   3 MEDIA

Please select the CRUD operation format [FEED]: 
Should the db_object require authentication [y/N]: 
Should row ownership be required when querying the object [y/N]: 
How many items should be listed per page [Schema Default]: 
Comments: 

Object added successfully.
```

Execute the following command to get detailed help information about the `mrs.add.dbObject()` function.

```js
\? mrs.add.dbObject
```
