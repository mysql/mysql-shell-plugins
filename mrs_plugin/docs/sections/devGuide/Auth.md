<!-- Copyright (c) 2022, 2024, Oracle and/or its affiliates.

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

# Authentication and Authorization

## Overview

As a HTTP REST service, MRS performs its own authentication and authorization checks separately from the MySQL server.

In general, anyone or anything that intends to access a MRS endpoint needs to first authenticate with it as a specific user account. That user must also have specific privileges to access that object and execute the desired HTTP method (GET, POST etc).

MRS defines 5 discrete types of users according to the type of activities they're allowed to perform in a MRS deployment. These users map to 5 MySQL roles created during MRS configuration, which can be granted in any combination to one or more MySQL user accounts.

All roles have the minimal set of MySQL privileges necessary, mostly restricted to internal MRS metadata tables. By default, they have no access to any other schemas or tables. However, some roles must be granted varying levels of access to user schemas, tables and other DB objects necessary for their purpose.

### MRS Administrative Users

Administrative tasks (configuration, creating and managing endpoints etc) are performed through MySQL Shell. The operations that a user is allowed to perform depend on the MySQL user that was used to connect MySQL Shell to MySQL (i.e. the Username that was set when the Connection was created in MySQL Shell for VSCode or passed in the command line of `mysqlsh`).

Note that any MySQL root or admin users that have full privileges to MySQL will also have full privileges to MRS instances. Therefore, it is recommended that MRS management is done using a dedicated MySQL user with minimal privileges.

#### Service Administrator (`mysql_rest_service_admin`)

A Service Administrator is allowed to:

* add, manage and remove MRS services
* add, manage and remove endpoint schemas
* add, manage and remove endpoints to tables, views and routines to MRS schemas
* add, manage and remove authentication apps
* add, manage and remove user accounts and roles
* add, manage and remove content sets and files (static files that can be served via HTTP)
* manage and monitor MySQL Router status and logs
* view the MRS audit log

Service administrators must have the `mysql_rest_service_admin` MySQL role.

#### Schema Administrator (`mysql_rest_schema_admin`)

The main purpose of a Schema Administrator is to create REST endpoint schemas, so that objects of that schema can be published as endpoints of a MRS service. They need access to both MRS metadata tables and user schemas

A Schema Administrator is allowed to:

* add, manage and remove endpoint schemas
* add, manage and remove endpoints to tables, views and routines to MRS schemas
* add, manage and remove content sets and files
* monitor MySQL Router status and logs
* view the MRS audit log

Schema administrators must have the `mysql_rest_schema_admin` MySQL role.
In addition to that role, Schema Administrator users must be able to view and grant all relevant privileges on objects that they wish to create endpoints for (e.g. `SELECT`, `INSERT`, `UPDATE`, `DELETE` on tables that will be published and updatable, `WITH GRANT OPTION`). These privileges will automatically be re-granted by MySQL Shell to the `mysql_rest_service_data_provider` role, so that MySQL Router can do whatever is required by the endpoint configuration.

#### Developer (`mysql_rest_service_dev`)

Developers have mostly the same privileges as Schema Administrators, except they cannot add new schemas to a service.

Developers are allowed to:

* use/reference existing endpoints schemas
* add, manage and remove endpoints to tables, views and routines to MRS schemas
* add, manage and remove content sets and files
* monitor MySQL Router status and logs
* view the MRS audit log

Developers must have the `mysql_rest_service_dev` MySQL role.
In addition to that role, Developer users must be able to grant all relevant privileges on objects that they wish to create endpoints for (e.g. `SELECT`, `INSERT`, `UPDATE`, `DELETE` on tables that will be published and updatable, `WITH GRANT OPTION`). These privileges will automatically be re-granted by MySQL Shell to the `mysql_rest_service_data_provider` role, so that MySQL Router can do whatever is required by the endpoint configuration.

### MRS Service User

When bootstrapping MySQL Router for MRS, a MySQL user account is automatically created for MRS.
That account has these 2 roles granted:

#### Data Access (`mysql_rest_service_data_provider`)

This is the MySQL role MySQL Router uses to execute SQL necessary to serve HTTP REST requests on behalf of MRS users.
This role must have grants on all MySQL objects that are exposed as REST endpoints.

The MySQL Shell automatically manages privileges granted to this role, as DB objects are added as REST endpoints.

Note that access control for MRS users is performed at REST endpoint level by MRS; but all REST requests, regardless of the MRS user they're originating from, will be executed through the same MySQL user. Care must be taken when exposing views and stored procedures to avoid granting access to objects to unintended users.

#### Metadata Access (`mysql_rest_service_meta_provider`)

The MySQL Router uses this role when querying the MRS metadata for endpoint configuration, MRS user account information etc.
This role only has access to internal metadata tables.

## Authentication Management

MRS currently supports the following authentication methods.

### MRS REST Service Specific Authentication

Authentication is handled my MRS against MRS REST Service specific accounts. Applications use SCRAM (Salted Challenge Response Authentication Mechanism) to securely authenticate a user.

### MySQL Internal Authentication

Authentication is handled my MRS against MySQL server user accounts. Applications use SCRAM (Salted Challenge Response Authentication Mechanism) to securely authenticate a user.

This authentication method is suitable for applications that are not exposed publicly.

### OAuth2 Authentication

Several OAuth2 services from 3rd-party vendors are supported by MRS; for example, sign in with FaceBook, Google or the OCI OAuth2 service. In order for a MRS service to authenticate against those vendors, one needs to be registered as a developer with those vendors and a vendor specific authentication apps need to be created. Then the OAuth2 specific settings - like APP ID and APP SECRET - need to be configured on the MRS side.

#### Configuring OCI OAuth2

After logging into the OCI web console, select `Identity & Security` and then `Domains` from the `Navigation Menu` or directly go to [cloud.oracle.com/identity/domains](https://cloud.oracle.com/identity/domains).

Select the root compartment in the `List scope` and click on the `Default` domain.

##### Looking Up the URL Option

After the `Default` domain has been opened, take note of the `Domain URL` on the `Domain information` tab. This URL needs to be provided when creating the REST authentication app.

##### Creating an OCI OAuth2 Integrated Application

Click on the `Integrated applications` link on the left hand side, then click the `Add application` button at the top.

1. Select `Confidential Application` and confirm by clicking `Launch workflow` button.
2. Set a `Name` and `Description` for your REST application and press `Next`.
3. Choose `Configure this application as a resource server now`.
   * Set the `Primary audience` to `MySQL-REST-Service`.
4. Choose `Configure this application as a client now`
   * In the `Authorization` section, check the `Client credentials` and `Authorization code` checkboxes.
   * Enter the correct `Redirect URL` using the format `https://<router-address>/<rest-service>/authentication/login?authApp=<authAppName>&sessionType=<bearer | cookie>`.
     * Example: `https://rest.mydomain.com/myService/authentication/login?authApp=OCI&sessionType=cookie`
   * Ensure the `Client type` is set to `Confidential`.
   * In the `Allowed operations` sections check the `Introspect` checkbox.
   * Turn the `Bypass consent` on.
   * Set `Client IP address` to `Anywhere`.
   * Set `Authorized resourced` to `All`.
5. Select to `Skip` the `Web tier policy` and press `Finish`.

You will be taken to your new `Integrated Application`. In the `OAuth configuration / General Information` section the `Client ID` and the `Client secret` are show. These need to be provided when creating the REST authentication app.

Please see the [CREATE REST AUTH APP](sql.html#create-rest-auth-app) section how to create a REST authentication app using the `"OCI OAuth2"` vendor next.

#### Configuring the Redirection URL of a REST service

After configuring the OAuth2 vendor specific authentication app and creating the corresponding REST authentication app, the redirection URL of the REST service needs to be configured.

The redirection URL tells the MySQL Router which URL it should send the user to after the authentication process against the OAuth2 server has been completed for a specific REST service.

The redirection URL can be set using the [`ALTER REST SERVICE`](sql.html#alter-rest-service) command. Please see [REST service authentication settings](sql.html#rest-service-authentication-settings) for more details.

Alternatively the redirection URL can be set by opening the REST service dialog and switching to the `Authentication` tab sheet.

## Authorization Management

Access to a given REST resource can have several levels of restrictions when using MRS:

* Public access - no authorization is needed to access the REST resource and its data
* Full access - after authentication the user has full access to all data of the REST resource
* Limited access - after authentication the user has only access to a subset of the data of the REST resource

MRS has built-in support for several authorization models. These authorization models define which data of a given REST resource that end users can see and manipulate:

* User-ownership based - users can see their own data
* Privilege based, managed using roles
* User-hierarchy based
* Group based
* Group-hierarchy based

If the use case of a given project matches one of the offered authorization models, then a custom authorization does not need to be implemented.

From an endpoint's perspective, access to REST resources can be controlled at the following levels:

* Service
* Schema
* Object

That is, if a user has read access to a schema, then they will have read access to all objects in that schema of a service.

It is possible to grant CREATE, READ, UPDATE and DELETE privileges at any of these levels.

### MRS Roles

A MRS role encapsulates a set of privileges for REST endpoints which can be granted as a whole to individual MRS users of a service. Roles can also be organized hierarchically, or extended into new roles with additional privileges.

For example, in a simple blog application that has an endpoint for `/myService/blog/post`, we could have 3 roles:

* `reader`, who can only read posts;
* `poster`, who can create and update posts, besides reading them and
* `editor`, which has the same privileges as a `poster`, but can also delete them

The following snippet creates these 3 roles and grants them to three different user.

```sql
# This example assumes a MySQL database schema "blog" and a schema table "post" has been created before.
CREATE SCHEMA IF NOT EXISTS blog;
CREATE TABLE IF NOT EXISTS blog.post(id INT PRIMARY KEY AUTO_INCREMENT, message TEXT);

CREATE REST SERVICE /myTestService;
USE REST SERVICE /myTestService;

CREATE REST SCHEMA /blog FROM blog;
CREATE REST VIEW /post ON SCHEMA /blog AS blog.post;

CREATE REST ROLE "reader";
GRANT REST READ ON SCHEMA /blog OBJECT /post TO "reader";

CREATE REST ROLE "poster" EXTENDS "reader";
GRANT REST CREATE, UPDATE ON SCHEMA /blog OBJECT /post TO "poster";

CREATE REST ROLE "editor" EXTENDS "poster";
GRANT REST DELETE ON SCHEMA /blog OBJECT /post TO "editor";

SHOW REST ROLES;

CREATE REST AUTH APP "TestAuthApp" VENDOR MRS;

CREATE REST USER "ulf"@"TestAuthApp" IDENTIFIED BY "********";
GRANT REST ROLE "reader" TO "ulf"@"TestAuthApp";

CREATE REST USER "alfredo"@"TestAuthApp" IDENTIFIED BY "********";
GRANT REST ROLE "poster" TO "alfredo"@"TestAuthApp";

CREATE REST USER "mike"@"TestAuthApp" IDENTIFIED BY "********";
GRANT REST ROLE "editor" TO "mike"@"TestAuthApp";

# Now, these three users can login with the specified password via MRS authentication.
```
