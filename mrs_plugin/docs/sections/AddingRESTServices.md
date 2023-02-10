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

# Adding REST Services

MRS supports the setup up of a large number individual REST Services.

Each REST Service has its own settings for URL path, host name, supported protocols, authentication options and other settings. It can expose a selected list of database schemas and objects.

This allows to perform an individual setup for each application and it is advised to setup an separate REST Service for each application.

## Preconditions to adding a REST Services

In order to setup a new REST Services the following preconditions need to be met.

1. The MySQL REST Service has to be configured on the targeting MySQL Solution. Please see the [Configuration](#configuration-of-the-mysql-rest-service) section of this manual.
2. The MySQL account used to connect to the targeting MySQL Solution needs to be granted the `mysql_rest_service_admin` MySQL role or a superset of privileges.

To grant the `mysql_rest_service_admin` MySQL role execute the following SQL statement.

```sql
GRANT 'mysql_rest_service_admin' TO 'user_account'@'%';

-- Please ensure to include all roles in the next statement 
-- that should become active when the user connects
ALTER USER 'user_account'@'%' DEFAULT ROLE 'mysql_rest_service_admin';
```

## Setting up a new REST Service

A new REST Service can be added in different ways, depending on the use case.

1. MySQL Shell for VS Code provides a GUI dialog to create the REST Service.
2. MySQL Shell offers the MRS plugin that can be used to create a REST Service interactively or via scripts on the terminal.
3. When writing a script or plugin for MySQL Shell the MRS plugin can be used to script the creation in Python or JavaScript.

### Adding a REST Service using MySQL Shell for VS Code

After configuring the MySQL REST Service on the target MySQL instance a new tree item `MySQL REST Service` is displayed when expanding the DB Connection in the DATABASE CONNECTIONS view.

Right click the tree item `MySQL REST Service` and select `Add REST Service...` from the popup menu. This will display the MySQL REST Service dialog.

Fill in the required parameters and click `OK` to add the new REST Service.

![Adding a REST Service](../images/vsc-mrs-add-service.png "Adding a REST Service")

### Adding a REST Service using MySQL Shell

When using the MySQL Shell, the `mrs` plugin is used to work with the MySQL REST Service. The `mrs.add.service()` function is used to add a new REST Service.

When started without parameters, an interactive wizard will ask for the required parameters.

```bash
MySQL > localhost:33060+ > Py > mrs.add.service()
Please enter the context path for this service [/mrs]: /myservice
Please enter the host name for this service (e.g. None or localhost) [None]: 
   1 HTTP
   2 HTTPS

Please select the protocol(s) the service should support [HTTP,HTTPS]: 2
Comments: 
   1 Default Service Options for Development
   2 No options
   3 Custom options

Please select how to initialize the options [Default Service Options for Development]: 

Service /myservice created successfully.
```

Execute the following command to get detailed help information about the `mrs.add.service()` function.

```js
\? mrs.add.service
```

### REST Service Properties

Each REST Service has the following properties.

| Option | Description |
| --- | ----- |
| MRS Service Path | The URL context root of this service |
| Comments | Comments to describe this service |
| Host Name | If specified, only requests for this host will served |
| Supported Protocols | The supported protocols. Default is HTTPS |
| Enabled | Specifies if the service is served by the MySQL Router |
| Options | Advanced options in JSON format |

### REST Service Advanced Options

The following advanced options can be set in JSON format.

- headers: Accepts a JSON object with one or more HTTP header names as key and it's setting as value.
- http:
  - allowedOrigin: If set to `auto` the MySQL Router will dynamically set the header `Access-Control-Allow-Origin` to the domain the request is coming from. Alternatively this can be set to a specific domain `https://mydomain.com` or a list of domains, e.g. `["https://mydomain.com", "https://myotherdomain.com"]`.
- logging:
  - exceptions: If set to `true` exceptions will be logged
  - requests:
    - body: If set to `true` the full body of all requests will be logged
    - headers: If set to `true` only the headers of all requests will be logged
  - response:
    - body: If set to `true` the full body of all responses will be logged
    - headers: If set to `true` only the headers of all responses will be logged
  - returnInternalErrorDetails: If set to `true` the reason of errors with code 500 will be sent to the client

#### Default REST Service options

The following options are used as default when deploying a new service.

Please note that they are only recommended for development development and must be changed for production usage.

By setting `allowedOrigin` to `auto` the MySQL Router will dynamically set the header `Access-Control-Allow-Origin` to the domain the request is coming from. This is done to work around Cross-origin resource sharing (CORS) checks of web browsers during development time.

```json
{
    "headers": {
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Origin, X-Auth-Token",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
    },
    "http": {
        "allowedOrigin": "auto"
    },
    "logging": {
        "exceptions": true,
        "request": {
            "body": true,
            "headers": true
        },
        "response": {
            "body": true,
            "headers": true
        }
    },
    "returnInternalErrorDetails": true
}
```

When deploying a REST Service in production, the following settings need to be changed.

- Change `allowedOrigin` to the domain(s) the REST service is running on, e.g. `"https://mydomain.com"` when deploying on a production server.
- Set `returnInternalErrorDetails` to `false`.
- Adjust the logging settings as needed.

### REST Service Definitions

#### About MRS AutoREST

AutoREST is a quick and easy way to expose database schema tables, views and procedures as REST resources.

#### REST APIs

Representational State Transfer (REST) is a style of software architecture for distributed hypermedia systems such as the World Wide Web. An API is described as RESTful when it conforms to the tenets of REST. Although a full discussion of REST is outside the scope of this document, a REST API has the following characteristics:

Data is modelled as a set of resources. Resources are identified by URIs.

A small, uniform set of operations are used to manipulate resources (for example, PUT, POST, GET, DELETE).

A resource can have multiple representations (for example, a blog might have an HTML representation and an RSS representation).

Services are stateless and since it is likely that the client will want to access related resources, these should be identified in the representation returned, typically by providing hypertext links.

#### RESTful Services Terminology

This section introduces some common terms that are used throughout this document:

- __RESTful service:__ An HTTP web service that conforms to the tenets of the RESTful architectural style.

- __Resource module:__ An organizational unit that is used to group related resource templates.

- __Resource template:__ An individual RESTful service that is able to service requests for some set of URIs (Universal Resource Identifiers). The set of URIs is defined by the URI Pattern of the Resource Template

- __URI pattern:__ A pattern for the resource template. Can be either a route pattern or a URI template, although you are encouraged to use route patterns.

- __Route pattern:__ A pattern that focuses on decomposing the path portion of a URI into its component parts. For example, a pattern of /:object/:id? will match /emp/101 (matches a request for the item in the emp resource with id of 101) and will also match /emp/ (matches a request for the emp resource, because the :id parameter is annotated with the ? modifier, which indicates that the id parameter is optional).

- __HTTP operation:__ HTTP (HyperText Transport Protocol) defines standard methods that can be performed on resources: GET (retrieve the resource contents), POST (store a new resource), PUT (update an existing resource), and DELETE (remove a resource).
