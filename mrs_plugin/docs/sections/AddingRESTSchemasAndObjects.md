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

# Adding Schemas and Objects to a REST Service

Adding database schema objects (tables, views or procedures) to a REST Service allows them to be accessed through RESTful Web services. Before database schema object can be added, the database schema containing those objects has to be added to the REST Service first.

The following image shows the a REST Schema and its REST Objects.

![REST Schema and its Objects](../images/vsc-mrs-schema-and-objects.png "REST Schema and its Objects")

Note that adding a database schema is not equivalent to exposing all tables and views in the schema through the RESTful Web service. It just means making the MySQL REST Service aware that the schema exists and that it may have zero or more resources to expose to HTTP/S.

## Preconditions to adding a REST Schemas and Objects

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

## Adding a Schema

If you are using MySQL Shell for VS Code, you can add database schemas and schema objects with convenient UI dialogs. The MySQL REST Service also provides a MySQL Shell plugin that can be used to enable objects for REST on the command line or via scripts.

### Adding a Schema with MySQL Shell for VS Code

To add a database schema to a REST Service, right click on the schema in the DATABASE CONNECTIONS view and select `Add Schema to REST Service`.

This will show a dialog that lets you set all REST Schema parameters. Press `OK` to add the schema.

![Adding a REST Schema](../images/vsc-mrs-add-schema.png "Adding a REST Schema")

## Adding a Schema Object with the MySQL Shell

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

## Definitions

### About MRS AutoREST

AutoREST is a quick and easy way to expose database schema tables, views and procedures as REST resources.

### REST APIs

Representational State Transfer (REST) is a style of software architecture for distributed hypermedia systems such as the World Wide Web. An API is described as RESTful when it conforms to the tenets of REST. Although a full discussion of REST is outside the scope of this document, a REST API has the following characteristics:

Data is modelled as a set of resources. Resources are identified by URIs.

A small, uniform set of operations are used to manipulate resources (for example, PUT, POST, GET, DELETE).

A resource can have multiple representations (for example, a blog might have an HTML representation and an RSS representation).

Services are stateless and since it is likely that the client will want to access related resources, these should be identified in the representation returned, typically by providing hypertext links.

### RESTful Services Terminology

This section introduces some common terms that are used throughout this document:

- __RESTful service:__ An HTTP web service that conforms to the tenets of the RESTful architectural style.

- __Resource module:__ An organizational unit that is used to group related resource templates.

- __Resource template:__ An individual RESTful service that is able to service requests for some set of URIs (Universal Resource Identifiers). The set of URIs is defined by the URI Pattern of the Resource Template

- __URI pattern:__ A pattern for the resource template. Can be either a route pattern or a URI template, although you are encouraged to use route patterns.

- __Route pattern:__ A pattern that focuses on decomposing the path portion of a URI into its component parts. For example, a pattern of /:object/:id? will match /emp/101 (matches a request for the item in the emp resource with id of 101) and will also match /emp/ (matches a request for the emp resource, because the :id parameter is annotated with the ? modifier, which indicates that the id parameter is optional).

- __HTTP operation:__ HTTP (HyperText Transport Protocol) defines standard methods that can be performed on resources: GET (retrieve the resource contents), POST (store a new resource), PUT (update an existing resource), and DELETE (remove a resource).
