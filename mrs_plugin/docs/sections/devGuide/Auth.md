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

# Authentication and Authorization

## Authentication Management

MRS currently supports the following authentication methods.

### MRS REST Service Specific Authentication

Authentication is handled my MRS against MRS REST Service specific accounts. Applications use SCRAM (Salted Challenge Response Authentication Mechanism) to securely authenticate a user.

### MySQL Internal Authentication

Authentication is handled my MRS against MySQL server user accounts. Applications use SCRAM (Salted Challenge Response Authentication Mechanism) to securely authenticate a user.

This authentication method is suitable for applications that are not exposed publicly.

### OAuth2 Authentication

Several OAuth2 services from 3rd-party vendors are supported by MRS; for example, sign in with FaceBook, Twitter, and Google. In order for a MRS service to authenticate against those vendors, one needs to be registered as a developer with those vendors and a vendor specific authentication apps need to be created. Then the OAuth2 specific settings - like access_token and app_id - need to be configured on the MRS side.

## Authorization Management

Access to a given REST resource can have several levels of restrictions when using MRS:

- Public access - no authorization is needed to access the REST resource and its data
- Full access - after authentication the user has full access to all data of the REST resource
- Limited access - after authentication the user has only access to a subset of the data of the REST resource

MRS has built-in support for several authorization models. These authorization models define which data of a given REST resource that end users can see and manipulate:

- User-ownership based - users can see their own data
- Privilege based, managed using roles
- User-hierarchy based
- Group based
- Group-hierarchy based

If the use case of a given project matches one of the offered authorization models, then a custom authorization does not need to be implemented.
