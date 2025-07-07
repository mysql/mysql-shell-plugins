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

# Configuring MySQL REST Service

To configure the MySQL REST Service (MRS), use these steps:

1. Deploy a MySQL solution.
2. [Configure](#configuring-the-mrs-metadata-schema) the MRS metadata database schema.
3. [Bootstrap](#bootstrapping-and-running-mysql-routers-with-mrs-support) and run one or more MySQL Router instances for MRS support.

After performing these steps, MySQL REST Service is fully configured.

The HTTP/S endpoints can then be accessed as configured during the MySQL Router bootstrap process.

**_Deployment of a MySQL solution_**

The following MySQL solutions are supported:

- MySQL HeatWave
- MySQL InnoDB Cluster
- MySQL InnoDB ClusterSet
- MySQL InnoDB ReplicaSet
- MySQL Operator

For development purposes, a standalone MySQL Server instance is also supported. Avoid using a standalone setup in a production deployment because it provides no form of High Availability (HA).

- Standalone MySQL Server

See the corresponding documentation about how to deploy and configure the different MySQL solutions.

## Configuring the MRS Metadata Schema

MySQL REST Service stores its configuration in the `mysql_rest_service_metadata` database schema. To deploy the metadata schema, perform one of the tasks described in this section.

Note: The MySQL user that is used to connect to the MySQL Solution must have MySQL privileges to create database schemas and roles.

### MRS Configuration Using MySQL Shell for VS Code

1. Start VS Code, install the MySQL Shell for VS Code extension, and then add a DB Connection to the MySQL solution that should be configured for the MySQL REST Service.

2. Right-click the connection in the DATABASE CONNECTIONS view and select Configure Instance for MySQL REST Service Support.

![Configure Instance for MySQL REST Service Support](../../images/vsc-mrs-configure.png "Configure Instance for MySQL REST Service Support")

The MRS metadata schema has now been configured.

### MRS Configuration Using MySQL Shell

The MySQL REST Service metadata schema can be configured from the MySQL Shell on the command line after connecting to the MySQL solution.

Please note that a MySQL user with `ALL PRIVILEGES` and `WITH GRANT OPTION` needs to be used to configure the MySQL REST Service metadata schema. It is common practice to use the `root` MySQL user or a dedicated `dba` MySQL user to perform this operation.

To configure the metadata schema the REST SQL extension [`CONFIGURE REST METADATA` statement](sql.html#configure-rest-metadata) is used.

**_Example_**

The following example connects to a local MySQL Server instance using a `dba` MySQL user account and configures the MySQL REST Service metadata schema.

```bash
$ mysqlsh dba@localhost
MySQL Shell 9.3.0

MySQL> localhost:3306> SQL> CONFIGURE REST METADATA;
Query OK, 0 rows affected (0.3998 sec)
REST metadata configured successfully.
```

After executing the `CONFIGURE REST METADATA` statement the MRS metadata schema has now been configured.

### Removing the MRS Metadata Schema

If the MySQL REST Service support should be removed, the MySQL REST Service metadata schema can be dropped using the `DROP SCHEMA mysql_rest_service_metadata;` statement.

Please note that a MySQL user account with required privileges to drop the `mysql_rest_service_metadata` has to be used.

**_Example_**

The following example connects to a local MySQL Server instance using a `dba` MySQL user account and drops the MySQL REST Service metadata schema.

```bash
$ mysqlsh dba@localhost
MySQL Shell 9.3.0

MySQL> localhost:3306> SQL> DROP SCHEMA mysql_rest_service_metadata;
Query OK, 38 rows affected (0.0770 sec)
```

## Granting Users Access to the MySQL REST Service

After the MySQL REST Service metadata schema has been configured, access to this schema needs to be granted to all MySQL users who should be able to work with the MySQL REST Service.

In addition, access to application data which should be exposed via REST endpoints needs to be granted to MRS data provider role. This will allow the MySQL REST Service to serve the required data.

### MRS User Roles

The MySQL REST Service supports a multi-tiered access model that allows the correct role to be assigned to each MySQL users working with the service.

The following MySQL roles can be assigned to MySQL user accounts.

| Access Level | MySQL Role Name | Description
| --- | --- | -----
| Root | - | MySQL Users with `ALL PRIVILEGES`, like the MySQL default `root` user, have full access to all features
| REST Service Admin | `mysql_rest_service_admin` | MySQL users that are granted the 'mysql_rest_service_admin' role have full access to all features
| REST Schema Admin | `mysql_rest_service_schema_admin` | The 'mysql_rest_service_schema_admin' role allows MySQL users to add new REST schemas and endpoints to an existing REST service
| REST Service Developer | `mysql_rest_service_dev` | REST Service Developers are allowed to define new REST endpoints for existing REST schemas
| REST Service User | `mysql_rest_service_user` | Any MySQL user that should be able to access REST endpoints needs to be granted the 'mysql_rest_service_user' role.

: MRS User Roles

The MySQL [GRANT](https://dev.mysql.com/doc/refman/en/grant.html) statement can be used to assign the given MySQL role to a MySQL user.

Please note that the MySQL role needs to be made active for the MySQL user's current session. This can be done by using the MySQL [SET ROLE](https://dev.mysql.com/doc/refman/en/set-role.html) statement. To properly work with the MySQL Shell for VS Code extension, the MySQL role needs to included in the MySQL user's DEFAULT roles, that can be set via the [SET DEFAULT ROLE](https://dev.mysql.com/doc/refman/en/set-default-role.html) statement.

**_Example_**

The following example [GRANTs](https://dev.mysql.com/doc/refman/en/grant.html) the `mysql_rest_service_admin` role to the `dba` MySQL user and ensures all MySQL roles, including the new `mysql_rest_service_admin` role, are made active when the MySQL user connects.

```bash
MySQL> localhost:3306> SQL> GRANT 'mysql_rest_service_admin' TO 'dba'@'%';
Query OK, 0 rows affected (0.0010 sec)
MySQL> localhost:3306> SQL> SET DEFAULT ROLE ALL TO 'dba'@'%';
Query OK, 0 rows affected (0.0012 sec)
```

### MRS Provider Roles

In addition to the MRS user roles outline above, two additional roles are part of the MySQL REST Service. They are used by the actual MySQL Router/Server MRS components to operate the MySQL REST Service.

| Access Level | MySQL Role Name | Description
| --- | --- | -----
| Metadata Schema Read-Only | `mysql_rest_service_meta_provider` | The metadata provide role is used by the MySQL Router/Server MRS component to identify the REST services that need to be served.
| Application Data Access | `mysql_rest_service_data_provider` | The data provide role is used by the MySQL Router/Server MRS component to read(/write) the application data that should be served by the REST services. This applies to all REST users authenticated via the 'MRS' `REST AUTH VENDOR` as well as all OAuth2 vendors. REST Users authenticated via the 'MySQL Internal' vendor use their own privileges.

: MRS Provider Roles

When a REST endpoint has been defined, it is essential to ensure the required privileges to access the database schema objects have been granted to the `mysql_rest_service_data_provider` role.

- For REST views exposing a database table or view, the required privileges are automatically granted.
- For REST procedures and REST functions the `EXECUTE` privilege is automatically granted. Should the database procedure access other procedures or schema objects, a manual GRANT statement for the `mysql_rest_service_data_provider` role needs to be executed.

**_Example_**

The following example shows how to expose a database procedure `test.my_procedure` that calls a nested database procedure `test.my_sub_procedure`.

The SQL script first creates the two procedures and then defines the `/myService/test/myProcedure` REST endpoint. The `EXECUTE` privilege on `test.my_procedure` is automatically assigned. But the REST endpoint would still raise an error as it misses the `EXECUTE` privilege on `test.my_sub_procedure`.

Finally, the `GRANT` statement assigns the `EXECUTE` privilege on the `test.my_sub_procedure` to the `mysql_rest_service_data_provider` role. Now, the REST endpoint is fully functional.

```sql
CREATE SCHEMA IF NOT EXISTS `test`;

DELIMITER %%
DROP PROCEDURE IF EXISTS `test`.`my_procedure`%%
CREATE PROCEDURE `test`.`my_procedure`(IN arg1 INTEGER, OUT arg2 INTEGER)
SQL SECURITY DEFINER
NOT DETERMINISTIC
BEGIN
    CALL `test`.`my_sub_procedure`(arg1, arg2);
END%%

DROP PROCEDURE IF EXISTS `test`.`my_sub_procedure`%%
CREATE PROCEDURE `test`.`my_sub_procedure`(IN arg1 INTEGER, OUT arg2 INTEGER)
SQL SECURITY DEFINER
NOT DETERMINISTIC
BEGIN
    SET arg2 = arg1 * 2;
END%%
DELIMITER ;

CREATE OR REPLACE REST SERVICE /myService;
CREATE REST SCHEMA /test ON SERVICE /myService FROM test;
CREATE REST PROCEDURE /myProcedure
    ON SERVICE /myService SCHEMA /test
    AS `test`.`my_procedure`;

GRANT EXECUTE ON PROCEDURE `test`.`my_sub_procedure` TO 'mysql_rest_service_data_provider';
```

## Bootstrapping and Running MySQL Routers with MRS Support

MySQL Router is an essential part of any MySQL solution and therefore often deployed in the same step as the MySQL Server instances. See the MySQL Router documentation for more details.

A MySQL Router instance needs to be configured to support MRS. This is usually done by using the `mysqlrouter_bootstrap` command, which queries the user account for the necessary information.

### Using MySQL Shell for VS Code to Bootstrap and Run MySQL Router

When working with a local development setup it is common to install the MySQL Router instance on the local development machine.

In this case, MySQL Shell for VS Code can be used to simplify the bootstrap process and to launch the MySQL Router instance as follows:

1. Download and install the MySQL Router package on your local development machine
   - When not using the DMG on macOS or MSI package on Windows to install MySQL Router, be sure that the directory containing the MySQL Router binaries is in the system PATH.
2. Inside MySQL Shell for VS Code,  expand a DB Connection in the DATABASE CONNECTIONS view, right-click the `MySQL REST Service` tree item,  and then select `Start Local MySQL Router Instance`.
   - If the MySQL Router has not been configured yet, the bootstrap operation runs in an integrated VS Code terminal and then starts MySQL Router.
   - MySQL Router debug output can then be inspected in the VS Code terminal.
3. To shut down MySQL Router, set the focus to the VS Code terminal showing the debug output and press `Ctrl` + `C.`

Note: The previous task only works for classic MySQL connections that are not using the MySQL SSH tunneling or MDS tunneling feature.

![Bootstrap and Start MySQL Router](../../images/vsc-mrs-start-mysql-router.png "Bootstrap and Start MySQL Router")

After the MySQL Router has been bootstrapped and started, MRS is available at `https://localhost:8443/<service-name>`.
You can then proceed and [add a REST service](#adding-rest-services-and-database-objects).

### Bootstrapping MySQL Router From the Command Line

When deploying a new MySQL Router instance, it is advised to use the `mysqlrouter_bootstrap` command to bootstrap and configure the router, including the MRS configuration. This is also true for reconfiguring an existing MySQL Router instance for MRS support.

```bash
mysqlrouter_bootstrap dba@127.0.0.1:3306 --mrs --directory ~/.mysqlrouter
```

Follow the interactive steps on the command line to configure the router.

**_Manual Creation of MySQL User Account for MySQL Router Access_**

When using the `mysqlrouter_bootstrap` command to configure MySQL Router for MRS, access the user accounts described in this section can be created automatically.

If you want to manage the required MySQL accounts manually, the following steps need to be performed:

1. Create the MySQL user account(or accounts)
   - If only one account is specified, MySQL Router uses it to access both the MRS metadata schema and application schema data. This account must have the `mysql_rest_service_meta_provider` and `mysql_rest_service_data_provider` roles.
   - If two accounts are used, MySQL Router, uses one for the MRS metadata schema access and the other one for the application schema data. Assign the `mysql_rest_service_meta_provider` role to one user and `mysql_rest_service_data_provider` to the other.
2. Bootstrap the MySQL Routers instance using the created MySQL accounts with the following options:
   - `--mrs-mysql-metadata-account` used by the router to access the MRS metadata schema
   - `--mrs-mysql-data-account` used by the router to access the application schema

As part of the MRS metadata schema creation, two SQL ROLEs have been created for MySQL Router to access MySQL:

- The 'mysql_rest_service_meta_provider' ROLE grants access to the required MRS metadata schema tables.
- The 'mysql_rest_service_data_provider' ROLE grants access to the served schema objects in the application database schemas.

To create the MySQL account, connect to the MySQL setup with MySQL Shell or MySQL Shell for VS Code and execute the following SQL statements:

```sql
CREATE USER 'mysqlrouter_mrs_<router_name>'@'<router_host>' IDENTIFIED BY 'password';
GRANT 'mysql_rest_service_meta_provider', 'mysql_rest_service_data_provider' TO 'mysqlrouter_mrs_<router_name>'@'<router_host>';
```

The user name specified for the account can then be used when calling the `mysqlrouter_bootstrap` command.

| Option | Description
| --- | -----
| `--mrs-mysql-metadata-account=USER_NAME` | Setting the MRS metadata user
| `--mrs-mysql-data-account=USER_NAME` | Setting the MRS data user

: MySQL Router MRS Bootstrap Account Options

**_Adding a MRS Configuration to an Existing MySQL Router Configuration_**

In case your MySQL Router instances are configured already, it is possible to add the MRS configuration later on.

To get the path of the existing configuration file, execute `mysqlrouter --help` to show the exact location of the router config file.

The following is an example when connecting to a single development server.

```ini
[DEFAULT]
logging_folder = /var/log/mysqlrouter
runtime_folder = /var/run/mysqlrouter
config_folder = /etc/mysqlrouter

[logger]
level = DEBUG

[routing:mrs_rw]
bind_address=0.0.0.0
bind_port=6446
destinations=10.0.1.135:3306
routing_strategy=round-robin
protocol=classic
```

To enable MRS support on the router, the configuration file needs to be extended with the [http_server] section and the [rest_mrs] section.

It is advised to use the `mysqlrouter_bootstrap` command to configure the router for MRS.

```bash
mysqlrouter_bootstrap dba@127.0.0.1:13000 --mrs --directory /export/mysql/src/mysql-trunk/boot
```

These parameters can be used to set the MRS configuration options.

| Option | Description
| --- | -----
| `--mrs` | Include MRS configuration
| `--mrs-mysql-metadata-account=USER_NAME` | Setting the MRS metadata user
| `--mrs-mysql-data-account=USER_NAME` | Setting the MRS data user
| `--mrs-global-secret=SECRET` | The global JWT secret that must be the same for every MySQL Router installation
| `--mrs-developer MYSQL_USER_NAME` | Switches the MySQL Router to developer mode
| `--mrs-developer-debug-port` DEBUG_PORT | The port used for local debugging of MRS Scripts

: MySQL Router Bootstrap options

The following example demonstrates connecting to a single development server and serving the REST services using HTTP.

```ini
[http_server]
port=8443
ssl=1
ssl_cert=/Users/myUser/.mysqlsh/plugin_data/gui_plugin/web_certs/server.crt
ssl_key=/Users/myUser/.mysqlsh/plugin_data/gui_plugin/web_certs/server.key

[mysql_rest_service]
mysql_read_only_route=bootstrap_ro
mysql_read_write_route=bootstrap_rw
mysql_user=mysql_router_mrs16_250ho3u15n
mysql_user_data_access=
router_id=16
```

## Installing the MRS Server Component

> Please note that the MRS Server Component is not available in production quality yet. Experimental packages of MySQL Server including the upcoming MySQL REST Service server component can be downloaded from [labs.mysql.com](https://labs.mysql.com).

The MySQL REST Service server component can be managed the same way as any other [server component](https://dev.mysql.com/doc/refman/en/components.html).

During installation, the MRS server component replaces the MySQL X Plugin to serve as the preferred MySQL Document Store solution. Rather than serving the MySQL X Protocol, the MySQL Server then enables clients to access MRS REST endpoints via the HTTPS protocol.

> Important: If any active clients are still using the MySQL X protocol, the MRS server component must not be installed before migrating these clients to the classic MySQL protocol. Alternatively, a MySQL Router instance can be deployed to serve the MRS REST endpoints.

The MRS server component can be installed before [configuring the MySQL instance for the MySQL REST Service support](#configuring-mysql-rest-service). In this case, the component will remain in a waiting state until MRS has been configured. No HTTP access is available during this time.

The following SQL command can be used to install the MRS server component.

```sql
INSTALL COMPONENT "file://component_mysql_rest_service";
```

**_Example_**

The following example installs the MRS server component and sets related MRS system variables at install time:

```sql
INSTALL COMPONENT "file://component_mysql_rest_service"
    SET GLOBAL component_mysql_rest_service.use_ssl = 0,
    GLOBAL component_mysql_rest_service.user = "miguel";
```

### Uninstalling the MRS Server Component

To uninstall the MRS server component, the following SQL command can be used.

1. `UNINSTALL COMPONENT "file://component_mysql_rest_service";`

If the MySQL X Plugin was available before, it will be loaded again when uninstalling the MRS server component.

### MRS Server Component Configuration

The following MySQL system variables are available to configure the MRS server component.

| System Variable | Description
| --- | --------
| component_mysql_rest_service.user | Defines the [REST Service User](#granting-users-access-to-the-mysql-rest-service). Automatically generated when component is installed and the SysVar has not been set at install time.
| component_mysql_rest_service.http_port | Rest Service HTTP Port. If the MySQL X Plugin is enabled on the server, the MySQL X Protocol port will be used and the plugin will be disabled. If the X Plugin is disabled, the default port is 8543.
| component_mysql_rest_service.use_ssl | Enables TLSv1.2 (or later) support. If the server has it enabled/supported, then it's enabled by default.
| component_mysql_rest_service.ssl_cert | SSL certificate filename. Uses Server default certificate if not specified.
| component_mysql_rest_service.ssl_key| SSL key filename. Uses Server default key if not specified.
| component_mysql_rest_service.developer | Rest Service Developer. Allows defining the developer username when the server is used in a development setup. If set, REST services that have not yet been published will be served, as well as REST services owned by the specified developer. Default is empty/disabled.

: MRS System Variables Overview

To check current values of all related MySQL system variables, execute the following SHOW statement.

```sql
SHOW variables LIKE '%mysql_rest_service%';
```

To set a related MySQL system variable, execute the following statements that set the variable and then restart the MRS server component.

```sql
SET PERSIST component_mysql_rest_service.developer = 'mike';
SELECT component_mysql_rest_service_restart();
```

> Please note that a restart of the MRS server component is required to activate the change.

### MRS Server Component Status Variables

The following MySQL status variables are available:

| Status Variable | Description
| --- | --------
| component_mysql_rest_service.http_port_source | Indicates how the HTTP port was configured. If set to `default` port 8543 is used. If set to `xplugin` the port was taken from the MySQL X Plugin. If set to `user` the port was individually configured by the user.
| component_mysql_rest_service.ssl_cert_source | Indicates how the SSL-certificate was configured. If set to `mysql` the MySQL Server configuration is used. If set to `user` the source was configured by the user.
| component_mysql_rest_service.ssl_key_source | Indicates how the SSL-key was configured. If set to `mysql` the MySQL Server configuration is used. If set to `user` the source was configured by the user.

: MRS Status Variables Overview

To query a MRS status variable use a SELECT statement like the following.

```sql
SELECT VARIABLE_VALUE FROM performance_schema.global_status
WHERE VARIABLE_NAME = 'component_mysql_rest_service.http_port_source';
```

### MRS Server Component UDFs

The following UDFs are available to control the MRS server component:

| UDF Call | Description
| --- | --------
| `SELECT component_mysql_rest_service_start();` | Starts the MRS server component after it has been stopped.
| `SELECT component_mysql_rest_service_stop();` | Stops the MRS server component.
| `SELECT component_mysql_rest_service_restart();` | Restarts the MRS server component.

: MRS server component UDF Overview
