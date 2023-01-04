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

# MySQL REST Service (MRS) Examples

The MRS Shell Plugin ships with a set of example projects that showcase the possibilities of the MySQL REST Service.

They are implemented as simple [Progressive Web Apps (PWA)](https://en.wikipedia.org/wiki/Progressive_web_app) to showcase the features offered by MRS.

## MRS Example Project structure

Each MRS example project consists of three components.

1. The MySQL database schema that will hold the application data (`db_schema`).
2. The MRS schema dump that exposes selected database objects of the applications MySQL database schema .(`mrs_schema`) via REST endpoints.
3. The Progressive Web App's (PWA) application source code (`app_code`) that makes REST calls against the REST endpoints to implement the application logic.

## Build and Deploy a MRS Example Project

The following steps need to be taken to build and deploy an MRS example on the MySQL REST Service.

1. Setup and Configure a MySQL REST Service deployment.
2. Deploy the MySQL database schema.
3. Load the MRS schema dump.
4. Build the PWA app from the application's source code.
5. Upload the build folder to the MySQL REST Service.

After these steps have been performed the MRS Example Project should be accessible from any web browser.

!include mrs_notes/readme.md
