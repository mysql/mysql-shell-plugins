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

# Setting up the MySQL REST Service

To get started with the MySQL REST Service, you must first deploy a MySQL solution. In this guide, we will use a local MySQL Server installation. If you have an existing MySQL server or InnoDB ClusterSet installed, you can use that setup instead. This is also true if you are working with a HeatWave instance.

## Setting up a local MySQL Server

Please go to the [MySQL download page](https://dev.mysql.com/downloads/mysql/) and select a MySQL Server version. It is recommended to download the latest MySQL Innovation or LTS release. Download the appropriate packages for your local operating system and perform the local installation either on [MacOS](https://dev.mysql.com/doc/mysql-installation-excerpt/en/macos-installation.html), [Linux](https://dev.mysql.com/doc/mysql-installation-excerpt/en/linux-installation.html) or [Windows](https://dev.mysql.com/doc/mysql-installation-excerpt/en/windows-installation.html).

After the MySQL Server has been installed, make sure that it is started up and that a database connection can be established, using the MySQL Shell for VS Code extension.

## Setting up VS Code

The recommended way to configure a MySQL REST Service development setup is to use [VS Code](https://code.visualstudio.com/) or [VSCodium](https://vscodium.com/) with the MySQL Shell for VS Code extension installed.

After downloading and installing VS Code, select the Extensions icon in the Activity Bar on the left hand side and enter MySQL Shell, then click the `Install` button.

When using VSCodium, please see here how to [enable the MS Marketplace](#enabling-ms-marketplace-on-vscodium) first. With the MS Marketplace enabled, select the Extensions icon in the Activity Bar on the left hand side, enter MySQL Shell and then click the `Install` button.

### MySQL Shell Welcome Wizard

When first launching the MySQL Shell VS Code extension, a Welcome Wizard will be shown. Please follow the required steps to configure the extension.

In case of an issue, the extension can be reset by bringing up the VS Code Command Palette and selecting the `Reset MySQL Shell for VS Code Extension` or by selecting the corresponding popup menu item of the `DATABASE CONNECTIONS` view in the Primary Side Bar.

### Adding a DB Connection

After successfully configuring the MySQL Shell VS Code extension, select its icon in the VS Code Activity Bar on the left hand side. Then click the `DB Connection Overview` entry in the `OPEN EDITORS` view in the Primary Side Bar.

On the `DB Connection Overview` page, click the `New Connection` tile in the `Database Connections` list. This will bring up the `Database Connection Configuration` dialog.

- Choose a `Caption` for the new DB Connection, e.g. `MRS Development`.
- Set the `User Name` to `root`
- Click `OK` to create the DB Connection.

A new DB Connection tile will show up in the `DB Connection Overview`, as well as a new DB Connection entry in the `DATABASE CONNECTIONS` view in the Primary Side Bar.

### Opening a DB Connection

Click the new tile to open the database connection. Enter the password and select whether to store it.

A new `DB Notebook` page will be opened, showing an SQL prompt.

## Configuring a MySQL Instance for MySQL REST Service Support

Support for the MySQL REST Service has to be explicitly configured on a given MySQL setup, before it can be used.

This configuration can either be performed directly in the MySQL Shell for VS Code extension or via the [REST SQL extension available](index.html#mrs-configuration-using-mysql-shell) in the MySQL Shell.

> When using a HeatWave setup on OCI, please browse the HeatWave documentation on how to enable REST service support for the given HeatWave instance.

### Configuring MRS in MySQL Shell for VS Code

Using the MySQL Shell for VS Code extension, locate the `DATABASE CONNECTIONS` view in the Primary Side Bar and right-click on the DB Connection entry `MRS Development` created above. This will bring up the popup menu.

Select `Configuring Instance for MySQL REST Service Support` in the DB Connection's popup menu, which will bring up the `MySQL REST Service` dialog.

![Configure Instance for MySQL REST Service Support](../../images/vsc-mrs-configure.png "Configure Instance for MySQL REST Service Support")

On the `MySQL REST Service` dialog provide a `REST User Name` and a `REST User Password`. Please note that the password has a minimum length of 8 characters and must contain a lower case character, and upper case character, a number and a special character. The REST user specified on this dialog can later be used to log into REST services.

Click `OK` to configure the instance for MySQL REST Service support. This process will create a dedicated metadata schema on the MySQL instance, which holds all metadata information about the REST services and endpoints.

After MySQL has been configured for MySQL REST Service support, a new `MySQL REST Service` child entry can be seen when expanding the DB Connection entry in the `DATABASE CONNECTIONS` view in the Primary Side Bar.

### Adding the MRS Authentication App for HeatWave

When you are working against a HeatWave instance, the REST user mentioned above needs to be created explicitly.

Open the `MySQL REST Service` child entry of the DB Connection, click on the `REST Authentication Apps` item with the right mouse button and select `Add New Authentication App`.

This will show the `REST Authentication App` dialog. Select the vendor `MRS` and click `OK` to have the new REST authentication app be created.

Expand the `REST Authentication Apps` item in the tree view and right click on the new `MRS` entry. Select `Add User` from the popup menu when clicking the `MRS` entry with the right mouse button.

Provide a `User Name` and a `User Password` and click `OK` to have the REST user created.

## Assigning REST User Privileges

When working with MySQL, it is recommended that the `root` account be used exclusively for configuration purposes. Create dedicated MySQL user accounts for general administrative and development tasks instead.

### DBA Account

> When working with HeatWave, a dedicated MySQL user account with administrative privileges was already created during HeatWave deployment. This MySQL user account can be used instead. Please proceed to

To create a database administrator account named `dba` the following SQL commands can be used.

This account will have full privileges on all database schemas. To adjust the list of schemas, modify the `GRANT ALL ON *.*` statement accordingly.

```sql
CREATE USER 'dba'@'%' IDENTIFIED BY '********';
GRANT ALL ON *.* TO 'dba'@'%' WITH GRANT OPTION;
```

After creating the new account, remember to update the DB Connection and replace the `User Name` `root` with `dba`. This can be done by clicking on the DB Connection entry with the right mouse button and selecting `Edit DB Connection`.

### Granting REST Service Admin Privileges

Any existing MySQL user account can be promoted to a REST service administrator by granting the `mysql_rest_service_admin` role. This role has to be added to the default MySQL roles that are assigned when a MySQL user connects.

The following two statements grant the required MySQL role and assign all roles to be loaded by default.

```sql
GRANT 'mysql_rest_service_admin' TO 'dba'@'%';
SET DEFAULT ROLE ALL TO 'dba'@'%';
```

> Please note that the `mysql_rest_service_admin` role is only available after configuring the MySQL instance for MySQL REST Service support.

The MySQL REST Service supports several MySQL roles to manage fine-grained access for administrators and developers. Please check the [MRS User Roles](index.html#mrs-user-roles) documentation for more details.

## Deploying a MySQL Router for Development

When developing REST services, it is highly recommended to deploy a local MySQL Router instance. This allows developers to locally test the REST services they are working on without publishing them on the production systems. Please see the [REST Service Lifecycle Management](index.html#rest-service-lifecycle-management) for details.

To bootstrap and start a local MySQL Router in development mode, select `Bootstrap Local MySQL Router Instance` from the `MySQL REST Service` items popup menu.

A terminal will appear.

- Enter the password of the MySQL user and hit the `return` key.
- Next, enter a JWT secret. Since this is a local development server, a simple secret like `1234` can be used. Please note that the same, strong JWT secret has to be used on all production routers.

Now, a local development instance of the MySQL Router has been bootstrapped.

Select `Start Local MySQL Router Instance` from the `MySQL REST Service` items popup menu to start up the router.

The terminal will display the MySQL Router log output in real time. This log output is very helpful when debugging REST endpoints.
