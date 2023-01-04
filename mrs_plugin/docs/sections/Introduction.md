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

# Introduction to the MySQL REST Service

This section provides an overview of the MySQL REST Service and its features.

## About the MySQL REST Service

The MySQL REST Service (MRS) offers HTTP REST access to selected MySQL schema objects. It is modelled after and supports a sub-set of the Oracle REST Data Services (ORDS).

See here for more details about [ORDS](https://docs.oracle.com/en/database/oracle/oracle-rest-data-services/22.2/orddg/introduction-to-Oracle-REST-Data-Services.html#GUID-A16BCCA2-8081-4062-A635-9F7C36FC394F/)

MRS consists of the following components:

- A MySQL Router plugin to serve the HTTP REST interface.
- A metadata schema `mysql_rest_service_metadata` that holds the MRS configuration
- A MySQL Shell plugin to configure and manage the MRS setup
- MySQL Shell for VS Code support for managing MRS through a graphical user interface (GUI)

**_About REST APIs_**

Representational State Transfer (REST) is a style of software architecture for distributed hypermedia systems such as the World Wide Web. An API is described as RESTful when it conforms to the tenets of REST. Although a full discussion of REST is outside the scope of this document, a REST API has the following characteristics:

- Data is modelled as a set of resources. Resources are identified by URIs.
- A small, uniform set of operations are used to manipulate resources (for example, PUT, POST, GET, DELETE).
- A resource can have multiple representations (for example, a blog might have an HTML representation and an RSS representation).
- Services are stateless and since it is likely that the client will want to access related resources, these should be identified in the representation returned, typically by providing hypertext links.

## Feature Overview

In contrast to the feature rich Oracle REST Data Services (ORDS) the MySQL REST Service (MRS) is focusing on exposing MySQL schema objects via a CRUD/REST interface - in many aspects similar to the AutoREST feature of ORDS.

See here for details on ORDS [AutoREST](https://docs.oracle.com/en/database/oracle/oracle-rest-data-services/22.2/orddg/developing-REST-applications.html#GUID-4CE630AA-2F06-41D9-96F6-DA77AB1E6395)

**_MRS AutoREST_**

Enabling REST access to a table, view or procedure allows it to be accessed through RESTful services. AutoREST is a quick and easy way to expose database tables as REST resources.

Note that enabling a schema is not equivalent to enabling all tables, views and procedures in the schema. It just means making MRS aware that the schema exists and that it may have zero or more resources to expose to HTTP. Those resources may be AutoREST resources or resource module resources.

**_Serving Static Content_**

In addition to serving dynamic content via AutoREST it is possible to upload static content, like HTML, CSS and image files. Note that this feature is not meant to replace dedicated HTTP servers that support features like server side programming. It can aid the quick deployments of prototypes and prove-of-concepts and help brining ideas to life.

**_End User Authentication_**

MRS currently supports the following authentication methods.

**_Simple MySQL Authentication_**

Authentication is performed against MySQL server user accounts. Since this authentication method does not need any external OAuth2 service it is preferred during prototyping.

**_OAuth2 Authentication_**

Several OAuth2 services from 3rd party vendors are supported by MRS, e.g. Sign in with FaceBook, Twitter and Google. In order for a MRS service to authenticate against those vendors, one needs to be registered as a developer with those vendors and a vendor specific authentication apps need to be created. Then the OAuth2 specific settings - like access_token and app_id - need to be configured on the MRS side.

**_End User Authorization_**

Access to a given REST resource can have several levels of restrictions when using MRS.

- Public access - no authorization is needed to access the REST resource and its data
- Full access - after authentication the user has full access to all data of the REST resource
- Limited access - after authentication the user has only access to a sub-set of the data of the REST resource

MRS has built-in support for several authorization models. These authorization models define which data of a given REST resource that end users can see and manipulate.

- User ownership based - users can see their own data
- Privilege based, managed via roles
- User hierarchy based
- Group based
- Group hierarchy based

If the use case of a given project matches one of the offered authorization models a custom authorization does not need to be implemented.
