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

# Configuration of the MySQL REST Service

To configure the MySQL REST Service (MRS), the following steps need to be taken.

1. Deployment of a MySQL solution
2. Configuration of the MRS metadata database schema
3. Bootstrapping and running one or more MySQL Router instances for MRS support

After these steps have been performed, the MySQL REST Service is fully configured.

The HTTPS endpoints can then be accessed as configured during the MySQL Router bootstrap process.

**_Deployment of a MySQL solution_**

The following MySQL solutions are supported.

- MySQL HeatWave
- MySQL InnoDB Cluster
- MySQL InnoDB ClusterSet
- MySQL InnoDB ReplicaSet
- MySQL Operator

For development purposes, a standalone MySQL Server setup is also supported. Please note that this setup should not be used in a production deployment since it does not offer any form of High Availability (HA).

- Standalone MySQL Server

Please refer to the corresponding documentation on how to deploy and configure the different MySQL solutions.

## Configuration of the MRS metadata schema

The MySQL REST Service stores its configuration in the `mysql_rest_service_metadata` database schema. To deploy the metadata schema, perform one of the following tasks.

Please note that the MySQL user that is used to connect to the MySQL Solution needs to have MySQL privileges to create database schemas and roles.

### MRS Configuration via MySQL Shell for VS Code

Start VS Code and install the MySQL Shell for VS Code extension, then add a connection to the MySQL setup.

Right click on the connection in the DATABASE CONNECTIONS view and select Configure Instance for MySQL REST Service Support.

![Configure Instance for MySQL REST Service Support](../images/vsc-mrs-configure.png "Configure Instance for MySQL REST Service Support")

The MRS metadata schema has now been configured.

### MRS Configuration via MySQL Shell

Open a terminal, start the MySQL Shell and connect to the MySQL setup.

```bash
mysqlsh dba@localhost
```

Configure the metadata schema via the MRS plugin by executing `mrs.configure()`.

```bash
MySQL> localhost:33060+> JS> mrs.configure()
MySQL Rest Data Service configuration.

Checking MRS metadata schema and version...
Creating MRS metadata schema...
The MRS metadata is well configured, no changes performed.
```

The MRS metadata schema has now been configured.

## Bootstrapping and running MySQL Routers with MRS support

MySQL Routers are an essential part of any MySQL solution and therefore often deployed in the same step as the MySQL Servers. Please see the MySQL Router documentation for more details.

A MySQL Router needs to be configured to support MRS. This is usually done by using the `mysqlrouter_bootstrap` command which will query the user for the necessary information.

### Using MySQL Shell for VS Code to Bootstrap and Run a MySQL Router

When working with a local development setup it is common to install the MySQL Router instance on the local development machine.

In this case MySQL Shell for VS Code can be used to simplify the bootstrap process and to launch the MySQL Router.

1. Download and install the MySQL Router package on your local development machine
   - When not using the DMG on macOS or MSI package on Windows to install MySQL Router, please make sure that the directory holding the MySQL Router binaries is in the system PATH
2. Inside MySQL Shell for VS Code expand a DB Connection in the DATABASE CONNECTIONS view and right click on the `MySQL REST Service` tree item and select `Start Local MySQL Router Instance`.
   - If the MySQL Router has not been configured yet the bootstrap operation will run in an integrated VS Code terminal, then start the MySQL Router
   - The MySQL Router debug output can then be inspected in the VS Code terminal
3. To shut down the MySQL Router, set the focus to the VS Code terminal showing the debug output and press `Ctrl` + `C`

Please note that this only works for classic MySQL connections that are not using the MySQL SSH tunneling or MDS tunneling feature.

![Bootstrap and Start MySQL Router](../images/vsc-mrs-start-mysql-router.png "Bootstrap and Start MySQL Router")

After the MySQL Router has been bootstrapped and started, the MRS is available at `https://localhost:8443/<service-name>`

You can then proceed and [add a REST Service](#adding-a-rest-service).

### Bootstrapping a MySQL Router on the Command Line

When deploying a new MySQL Router it is advised to use the `mysqlrouter_bootstrap` command to bootstrap and configure the router, including the MRS configuration. This is also true for the reconfiguring of an existing MySQL Router for MRS support.

```bash
mysqlrouter_bootstrap dba@127.0.0.1:3306 --mrs --directory ~/.mysqlrouter
```

Please follow the interactive steps on the command line to configure the router.

**_Manual Creation of MySQL User Account for MySQL Router access_**

When using the `mysqlrouter_bootstrap` command to configure the MySQL Router for MRS access the user accounts described in this section can be created automatically.

If you want to manually manage the required MySQL accounts for use access the following steps need to be performed.

1. Creation of the MySQL user account(s)
   - If only one account is specified, the MySQL Router will use it to access both the MRS metadata schema and application schema data. This account must have the `mysql_rest_service_meta_provider` and `mysql_rest_service_data_provider` roles.
   - If two accounts are used, the MySQL Router will use one for the MRS metadata schema access and the other one for the application schema data. Assign the `mysql_rest_service_meta_provider` role to one user and `mysql_rest_service_data_provider` to the other.
2. Bootstrapping the MySQL Routers using the created MySQL accounts via the following options
   - `--mrs-mysql-metadata-account` used by the router to access the MRS metadata schema
   - `--mrs-mysql-data-account` used by the router to access the application schema

As part of the MRS metadata schema creation, two SQL ROLEs have been created for MySQL Router to access MySQL.

- The 'mysql_rest_service_meta_provider' ROLE grants access to the required MRS metadata schema tables.
- The 'mysql_rest_service_data_provider' ROLE grants access to the served schema objects in the application database schemas.

To create the MySQL account, connect to the MySQL setup with the MySQL Shell or MySQL Shell for VS Code and execute the following SQL statements.

```sql
CREATE USER 'mysqlrouter_mrs_<router_name>'@'<router_host>' IDENTIFIED BY 'password';
GRANT 'mysql_rest_service_meta_provider', 'mysql_rest_service_data_provider' TO 'mysqlrouter_mrs_<router_name>'@'<router_host>';
```

The user name specified above can then be used when calling the `mysqlrouter_bootstrap` command.

| Option | Description
| --- | ----- |
| `--mrs-mysql-metadata-account=USER_NAME` | Setting the MRS metadata user |
| `--mrs-mysql-data-account=USER_NAME` | Setting the MRS data user |

**_Adding a MRS configuration to an existing MySQL Router configuration_**

In case your MySQL Routers have already been configured it is possible to add the MRS configuration later on.

To get the path of the existing configuration file, execute `mysqlrouter --help`. This will show the exact location of the router config file.

The following is an example when connecting to a single development server.

```cnf
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

The following parameters can be used to set the MRS configuration options.

| Option | Description
| --- | ----- |
| `--mrs` | Include MRS configuration |
| `--mrs-mysql-metadata-account=USER_NAME` | Setting the MRS metadata user |
| `--mrs-mysql-data-account=USER_NAME` | Setting the MRS data user |
| `--mrs-global-secret=SECRET` | The global JWT secret that has to be the same for every MySQL Router installation |

The following is an example when connecting to a single development server and serving the REST services via HTTP.

```cnf
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
