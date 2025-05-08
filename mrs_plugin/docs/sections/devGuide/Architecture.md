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

# Architecture

## Building Blocks

The MySQL REST Service consists of the following components:

- A MySQL Solution (Heatwave, MySQL InnoDB ClusterSet, a standalone MySQL Server, etc.)
  - Serving a metadata schema `mysql_rest_service_metadata` that holds the MRS configuration.
  - Serving the REST applications' data.
- MySQL Router
  - One or many MySQL Router instances to serve the HTTPS REST interface.
  - Either running in developer or production mode.
- MySQL Shell / MySQL Shell for VS Code
  - Support for the REST SQL extension, to configure and manage REST endpoints via REST SQL commands.
  - Support for managing MRS through a graphical user interface (GUI) embedded inside VS Code.
  - Generation of Client SDKs for given REST service.

## Development Setup

When working with the MySQL REST Service it is important to separate between two different types of setups.

1. A local development setup used to develop new REST services.
   - A local MySQL Shell installation to connect to and execute REST SQL extension commands.
   - A local MySQL Router installation, running in developer mode.
2. The production deployment that serves REST services that have been published.
   - The MySQL solution serving the metadata schema as well as the REST applications' data.
   - MySQL Router instance(s) running in production mode.

Each of those setups serves a different set of REST services, depending on the REST services' current [lifecycle](#rest-service-lifecycle-management) states.

The recommended way to configure a MySQL REST Service development setup is to use [VS Code](https://code.visualstudio.com/) or [VSCodium](https://vscodium.com/) with the [MySQL Shell for VS Code](https://marketplace.visualstudio.com/items?itemName=Oracle.mysql-shell-for-vs-code) extension installed. This will simplify things like HTTPS certificate installation and bootstrapping the MySQL Router in development mode.

## Production Deployments

MySQL REST Service (MRS) can be deployed in many different ways depending on the individual project requirements.

**_Deployments for Development_**

The smallest possible development environment consists of a single MySQL Server instance and a MySQL Router instance running on the same machine.

The recommended deployment for development consists of an InnoDB Cluster deployed with a minimum of three MySQL Server instances and two MySQL Router instances.

For cloud-based development, a MySQL Database Service instance with the high availability feature enabled and two compute instances with MySQL Router deployments should be used.

**_Production Deployments_**

In a production environment, an InnoDB Cluster set up with three or more MySQL Router instances should be used. It is recommended to use a load balancer to expose the HTTPS port of the MySQL Router instances to the public internet.

For cloud-based development in production, a MySQL Database Service instance with the high availability feature enabled and three or more compute instances with MySQL Router deployments should be used. It is recommended to use a load balancer to expose the HTTPS port of the MySQL Routers to the public internet.

![MySQL REST Service Architecture Diagram](../../images/mrs-architecture.svg "MySQL REST Service Architecture Diagram")
