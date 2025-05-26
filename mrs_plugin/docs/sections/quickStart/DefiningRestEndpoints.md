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

# Defining REST Endpoints

After configuring a MySQL instance for MySQL REST Service support, you can define new REST services and endpoints. This can be done using the graphical user interface built into the MySQL Shell extension for Visual Studio Code or directly via the MySQL Shell REST SQL extension.

## Deploying the Sakila Schema

All further examples in the quickstart guide use the `Sakila` example database schema. To follow along, please install that schema.

1. Download the Sakila schema from [https://downloads.mysql.com/docs/sakila-db.zip](https://downloads.mysql.com/docs/sakila-db.zip)
2. Double-click the downloaded ZIP file to extract it. This will create a folder `sakila-db` containing two SQL scripts.
3. Using the MySQL Shell for VS Code extension, locate the `DATABASE CONNECTIONS` view in the Primary Side Bar and right-click on the DB Connection entry `MRS Development` created above. From the popup menu select `Load SQL Script from Disk...` and select the `sakila-schema.sql` script.
4. After the script has loaded, click the first lightning bolt in the toolbar to execute the full script. Monitor the output until the line `✓ SQL Script execution completed in ___s. 46 statements executed successfully.` is displayed.
5. Use `Load SQL Script from Disk...` again and select the `sakila-data.sql` script. Execute it and monitor the output for `✓ SQL Script execution completed in ___s. 62 statements executed successfully.`

The `sakila` schema should now be displayed in the `DATABASE CONNECTIONS` view in the Primary Side Bar as a child entry of the `MRS Development` connection.

## Creating a REST Service

To create a REST service, click with the right mouse button on the `MySQL REST Service` child entry of the `MRS Development` connection in the `DATABASE CONNECTIONS` view in the Primary Side Bar.

![Adding a REST Service](../../images/vsc-mrs-add-service.png "Adding a REST Service")

This will bring up the `MySQL REST Service` dialog. You can set a REST service path and a REST Service Name or accept the defaults of `/myService` for now.

The REST service will be created without being `Published` and the REST authentication app `MRS` will be linked by default. To also allow logins with MySQL user accounts, the REST authentication app `MySQL` can be linked as well.

Click `OK` to have the REST service created.

The new REST Service will now be displayed as a child to the `MySQL REST Service` item in the tree view.

### Creating a REST Service with REST SQL

Alternatively to using the graphical user interface the REST SQL extension can be used to create the REST service.

```sql
CREATE OR REPLACE REST SERVICE /myService
    ADD AUTH APP 'MRS';
```

## Adding a REST Endpoint

After a REST service has been created, a new REST endpoint can be added. It is possible to add database schema tables, views, procedures and functions, as well as static files.

On the `DATABASE CONNECTIONS` view in the Primary Side Bar, expand the `sakila` database schema tree item as well as the `Tables` item of the DB Connection entry.

Click the database schema table `city` using the right mouse button and select `Add Database Object to REST Service` from the popup menu.

![Adding a Database Object](../../images/vsc-mrs-add-db-object.png "Adding a Database Object")

A notification will be show on the lower right area of the window displaying the following question.

```txt
The database schema sakila has not been added to the REST service.
Do you want to add the schema now?
```

Before adding a database schema object as a REST endpoint, it is required to add their database schema as a REST schema first. Click `Yes` to add the database schema as a REST schema.

The `MySQL REST Object` dialog will be displayed.

![The MySQL REST Object Dialog](../../images/vsc-mrs-object-dialog.svg "The MySQL REST Object Dialog")

It shows the full request path that will be used for the REST endpoint, consisting of the parts `REST Service Path` `REST Schema Path` `REST Object Path`. In this case the path will be `/myService/sakila/city`.

> Since we want this REST endpoint to not require authentication, disable the `Auth. Required` option in the `Access Control` section, top right.

On the `Data Mapping` tab sheet, the mapping of JSON fields to database columns can be seen. It is possible to rename JSON fields or add referenced tables as nested JSON documents. See [Data Mapping Views](index.html#rest-data-mapping-views) for more details.

To enable write access on the REST endpoint, click the `INSERT` `UPDATE` `DELETE` buttons next to the database schema name.

Click `OK` to create the REST endpoint.

### Adding a REST Endpoint via REST SQL

The same operations as doing in the user interface above can also be done via the REST SQL extension.

In a first step, the database schema can be added to the REST service as a REST schema.

```sql
CREATE OR REPLACE REST SCHEMA /sakila ON SERVICE /myService
    FROM `sakila`;
```

Next, the `sakila.city` database schema table can be added.

```sql
CREATE OR REPLACE REST VIEW /city ON SERVICE /myService SCHEMA /sakila
    AS `sakila`.`city` @INSERT @UPDATE @DELETE
    AUTHENTICATION NOT REQUIRED;
```
