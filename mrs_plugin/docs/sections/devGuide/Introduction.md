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

Welcome to the MySQL REST Service. This book features a detailed discussion of the MySQL REST Service, including architecture, configuration and deployment.

To start with a hands-on approach instead, please check out the [MRS Notes Example](#mrs-notes-example) and follow the instructions for [Build and Deployment](#build-and-deployment) there.

## What is the MySQL REST Service

The MySQL REST Service is a next-generation JSON Document Store solution, enabling fast and secure HTTPS access for data stored in MySQL, HeatWave, InnoDB ClusterSet and InnoDB ReplicaSet.

Being a fully integrated MySQL solution, it focuses on ease-of-use, support of standards and high performance.

The MySQL REST Service consists of four major building blocks, delivering an integrated solution for JSON Document-based application development.

1. RESTful Web Services
2. REST SQL Extension
3. Powerful Data Mapping
4. Client SDK Generation

![MySQL REST Service - Feature Overview](../../images/MrsFeatureOverview.svg "MySQL REST Service - Feature Overview")

**_Benefits_**

- Auto-REST endpoints for relational and document oriented data, that can be enable with a few clicks.
- Directly built into MySQL Router, removes need for additional middle-ware.
- High performance web server solution to serve RESTful Web Services as well as Progressive Web Apps (PWAs).
- Excellent vertical scaling (up scaling) and well as horizontal scaling (scaling out) through number of MySQL Routers.

**_Experience_**

- Direct VS Code Extension integration featuring point-and-click, WYSIWYG editors and live-querying of REST endpoints via TypeScript.
- Dedicated REST SQL extension support in MySQL Shell for scripting and development process integration.
- Client SDK generation support for popular languages to vastly simplify development process and project integration.
- Support for local development environment & debugging.

**_Features_**

- REST endpoints for database tables, views, procedures and function in addition to static data (e.g. PWAs) being served
- Powerful, built-in authentication, authorization (MySQL accounts, MRS accounts, OAuth2) and session management
- New REST SQL extension to be able to define REST services and endpoints directly in SQL scripts
- Client SDK generation with built-in features for authentication, document operations, read-own-write support in distributed MySQL solutions

## Application Use Cases

### Which applications should use the MySQL REST Service

The MySQL REST Service exposes RESTful Web Services for interacting with the data stored in MySQL solutions REST endpoints via HTTPS.

This makes the MySQL REST Service an excellent choice for the following use cases.

- Mobile applications, as well as Progressive Web Apps (PWAs), that need to access data across the public internet.
- All modern document-oriented applications that expect to work with JSON documents rather than relational data.
- Extending existing applications with micro-services.
- Offering data REST endpoints to serverless architecture deployments.

![MySQL App Development](../../images/MrsForAppDevelopment.svg "MySQL App Development")

### Which applications should use a MySQL Connector

Using the MySQL protocol via a MySQL Connector is an established way to build high-performance MySQL database applications. It should be preferred to use this type of MySQL connection for the following use cases.

- Applications that need direct SQL access to the MySQL database.
- Applications that need to work with relational tables rather than JSON documents.
- Applications that do not benefit from an optimistic, ETag based concurrency model.

## Feature Set Overview

| Feature | Description
| --- | -----
| REST Service Lifecycle Management | Shared development of new REST services, publishing of production-ready REST services
| AutoREST | Enabling REST access to a table, view, or procedure allows it to be accessed through RESTful services. AutoREST is a quick and easy way to expose database tables as REST resources, first introduced by [ORDS](https://docs.oracle.com/en/database/oracle/oracle-rest-data-services/22.2/orddg/introduction-to-Oracle-REST-Data-Services.html#GUID-A16BCCA2-8081-4062-A635-9F7C36FC394F/).
| REST data mapping Views | REST data mapping views combine the advantages of relational schemas with the ease-of-use of document databases. They give your data a conceptual and an operational duality as it is organized both relationally and hierarchically.
| Serving Static Content | In addition to serving dynamic content using AutoREST it is possible to upload static content, like HTML, CSS, and image files. This feature is not meant to replace dedicated HTTP servers that support capabilities like server-side programming. It can aid the quick deployments of prototypes and proof-of-concept efforts that help bring ideas to life.
| End User Authentication | MRS supports a number of authentication methods, including MRS REST service specific authentication, native MySQL authentication and OAuth2 authentication (Sign in with FaceBook and Google)
| End User Authorization | Built in support for row-level security, role based security, user-hierarchy based security, Group based security, Group-hierarchy based security as well as custom authorization support
| REST Service SDK API Generation | Live SDK API updates for interactive prototyping using TypeScript, SDK API generation for application development

: Feature Overview

**_About REST APIs_**

Representational State Transfer (REST) is a style of software architecture for distributed hypermedia systems such as the World Wide Web. An API is described as RESTful when it conforms to the tenets of REST. Although a full discussion of REST is outside the scope of this document, a REST API has the following characteristics:

- Data is modelled as a set of resources. Resources are identified by URIs.
- A small, uniform set of operations are used to manipulate resources (for example, PUT, POST, GET, DELETE).
- A resource can have multiple representations (for example, a blog might have an HTML representation and an RSS representation).
- Services are stateless and because the client is likely to access related resources, these should be identified in the representation returned, typically by providing hypertext links.
