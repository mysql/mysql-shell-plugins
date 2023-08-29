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

# Introduction to the MRS DDL - SQL Extension

Providing a management interface that feels familiar to MySQL developers and DBAs and integrates well into their existing processes has been an essential part of the MySQL REST Service (MRS) design.

The MySQL REST Service Shell plugin registers a SQL rewrite extension that process a set of MRS DDL statements that allows these DDL statements to be used in regular SQL scripts that are processed by the MySQL Shell or [MySQL Shell for VS Code](https://marketplace.visualstudio.com/items?itemName=Oracle.mysql-shell-for-vs-code).

This makes developing REST services and managing the MySQL REST Service as easy as working with database schemas.

**_Example_**

The following example script configures the MySQL REST Service, creates a new REST service `/myService` and adds a REST schema `/sakila` and a REST DUALITY view `/actor` that lists all actors and their film titles.

```sql
CONFIGURE REST METADATA;

CREATE REST SERVICE /myService;
USE REST SERVICE /myService;

CREATE REST SCHEMA /sakila FROM `sakila`;
USE REST SCHEMA /sakila;

CREATE REST DUALITY VIEW /actor
FROM `sakila`.`actor` AS MyServiceSakilaActor {
    actorId: actor_id @SORTABLE,
    firstName: first_name,
    lastName: last_name,
    lastUpdate: last_update,
    filmActor: sakila.film_actor @REDUCETO(title) {
        film: sakila.film @UNNEST {
            title: title
        }
    }
};
```

> Note: Please ensure to install the [MySQL sakila example database schema](https://downloads.mysql.com/docs/sakila-db.zip) before running the MRS DDL script above.
