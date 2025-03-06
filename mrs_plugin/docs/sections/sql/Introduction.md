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

# Introduction

It has been an essential goal of the MySQL REST Service (MRS) to provide a management interface that feels familiar to MySQL developers and DBAs and integrates well into their existing processes.

For this purpose the MySQL REST Service plugins directly into the [MySQL Shell](https://dev.mysql.com/downloads/shell/) and [MySQL Shell for VS Code](https://marketplace.visualstudio.com/items?itemName=Oracle.mysql-shell-for-vs-code). It extends the available SQL commands to include DDL (Data Definition Language) statements that allow managing the MySQL REST Service in an easy and seamless way.

This makes the process of creating a MySQL REST Service for your application as easy as creating a database schema or table.

**_Example_**

The following script configures the MySQL REST Service, creates a new REST service `/myService` and adds a REST schema `/sakila` and a REST data mapping view `/actor` that lists all actors and their film titles.

```sql
CONFIGURE REST METADATA;

CREATE REST SERVICE /myService;
USE REST SERVICE /myService;

CREATE REST SCHEMA /sakila FROM `sakila`;
USE REST SCHEMA /sakila;

CREATE REST VIEW /actor
AS `sakila`.`actor` {
    actorId: actor_id @SORTABLE,
    firstName: first_name,
    lastName: last_name,
    lastUpdate: last_update,
    filmActor: sakila.film_actor @REDUCETO(title) {
        film: sakila.film @UNNEST {
            title: title
        }
    }
}
AUTHENTICATION REQUIRED;
```

> Note: Please ensure to install the [MySQL sakila example database schema](https://downloads.mysql.com/docs/sakila-db.zip) before running the MRS DDL script above.
