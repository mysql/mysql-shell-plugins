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

# Introduction to the MySQL REST Service

Welcome to the MySQL REST Service (MRS). It provides a fast and powerful way to serve data to client applications via a HTTPS REST interface.

To start with a hands-on approach, see the [MRS Notes Example](#mrs-notes-example) and follow the instructions for [Build and Deployment](#build-and-deployment) there.

This section provides an overview of the MySQL REST Service and its features.

**_About the MySQL REST Service_**

The MySQL REST Service (MRS) offers HTTPS REST access to selected MySQL schema objects. It is modelled after and supports a subset of the Oracle REST Data Services (ORDS).

For more information, see [ORDS](https://docs.oracle.com/en/database/oracle/oracle-rest-data-services/22.2/orddg/introduction-to-Oracle-REST-Data-Services.html#GUID-A16BCCA2-8081-4062-A635-9F7C36FC394F/)

MRS consists of the following components:

- A MySQL Solution (like MySQL Heatwave, MySQL InnoDB Cluster, a standalone MySQL Server, etc.)
  - Serving a metadata schema `mysql_rest_service_metadata` that holds the MRS configuration
  - Serving the application's data
- MySQL Router
  - One or many MySQL Router instances to serve the HTTPS REST interface on default port 8443
- MySQL Shell / MySQL Shell for VS Code
  - Support for managing MRS through a graphical user interface (GUI) embedded inside VS Code
  - MRS plugin to configure and manage the MRS setup on the terminal and using scripts

**_About REST APIs_**

Representational State Transfer (REST) is a style of software architecture for distributed hypermedia systems such as the World Wide Web. An API is described as RESTful when it conforms to the tenets of REST. Although a full discussion of REST is outside the scope of this document, a REST API has the following characteristics:

- Data is modelled as a set of resources. Resources are identified by URIs.
- A small, uniform set of operations are used to manipulate resources (for example, PUT, POST, GET, DELETE).
- A resource can have multiple representations (for example, a blog might have an HTML representation and an RSS representation).
- Services are stateless and because the client is likely to access related resources, these should be identified in the representation returned, typically by providing hypertext links.

**_Feature Overview_**

| Feature | Description
| --- | ----- |
| MRS AutoREST | Enabling REST access to a table, view, or procedure allows it to be accessed through RESTful services. AutoREST is a quick and easy way to expose database tables as REST resources.|
| REST data mapping Views | REST data mapping views combine the advantages of relational schemas with the ease-of-use of document databases. They give your data a conceptual and an operational duality as it is organized both relationally and hierarchically. |
| Serving Static Content | In addition to serving dynamic content using AutoREST it is possible to upload static content, like HTML, CSS, and image files. This feature is not meant to replace dedicated HTTP servers that support capabilities like server-side programming. It can aid the quick deployments of prototypes and proof-of-concept efforts that help bring ideas to life. |
| End User Authentication | MRS supports a number of authentication methods, including MRS REST service specific authentication, native MySQL authentication and OAuth2 authentication (Sign in with FaceBook and Google)
| End User Authorization | Built in support for row-level security, role based security, user-hierarchy based security, Group based security, Group-hierarchy based security as well as custom authorization support |
| REST Service SDK API Generation | Live SDK API updates for interactive prototyping using TypeScript, SDK API generation for application development |
