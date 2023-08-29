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

# MRS DDL Reference

## CONFIGURE REST METADATA

The CONFIGURE REST METADATA statement is used to perform the initial configuration of the MySQL REST Service on a MySQL Server instance or InnoDB Cluster/Set.

It will create the `mysql_rest_service_metadata` database schema.

Please note that the MySQL account used to execute the statement needs the required privileges to create database schemas.

**_Syntax_**

configureRestMetadataStatement ::=

![The CONFIGURE REST METADATA Statement](../images/ddl/configureRestMetadataStatement.svg "configureRestMetadataStatement")

restMetadataOptions ::=
![restMetadataOptions](../images/ddl/restMetadataOptions.svg "restMetadataOptions")

enabledDisabled ::=
![enabledDisabled](../images/ddl/enabledDisabled.svg "enabledDisabled")

jsonOptions ::=
![jsonOptions](../images/ddl/jsonOptions.svg "jsonOptions")

updateIfAvailable ::=
![updateIfAvailable](../images/ddl/updateIfAvailable.svg "updateIfAvailable")

**_Example_**

```sql
CONFIGURE REST METADATA UPDATE IF AVAILABLE;
```

### Enable or Disable the MySQL REST Service

The enabledDisabled option specifies if the MySQL REST Service should be enabled or disabled after the configuration operation. The default is set to enable the MySQL REST Service.

### MySQL REST Service Options

The jsonOptions allow to set a number of specific options for the service.

These options can include the following JSON keys.

- `defaultStaticContent` - Allows the definition of static content for the root path `/` that will be returned for file paths matching the given JSON keys. A JSON key `index.html` will be  served as `/index.html` by the MySQL Router. The file content needs to be Base64 encoded. If the same JSON key is used for `defaultStaticContent` as well as for `defaultRedirects`, the redirect is prioritized.
- `defaultRedirects` - Is used to define internal redirects performed by the MySQL Router. This can be used to expose content of a REST service on the root path `/`. A JSON key `index.html` holding the value `/myService/myContentSet/index.html` will exposed the corresponding file from the given path as `/index.html`.
- `directoryIndexDirective` - Holds an ordered list of files that should be returned when a directory path has been requested. The first matching file that is available will be returned. The `directoryIndexDirective` is recursively applies to all directory paths exposed by the MySQL Router. To change the `directoryIndexDirective` for a given REST service or REST static content set, the corresponding option needs to be set for those objects.

All other keys will be ignored and can be used to store custom metadata about the service. It is a good practice to include a unique prefix when adding custom keys to avoid them be overwritten by future MRS options.

**_Examples_**

The following JsonValue will define the static content for `/index.html`, `/favicon.ico` and `/favicon.svg`. It will also direct the MySQL Router to return the contents of `/index.html` if the root path `/` is requested, e.g. `https://my.domain.com/`

```json
{
    "defaultStaticContent": {
        "index.html": "PCFET0NUW...",
        "favicon.ico": "AAABAAMAM...",
        "favicon.svg": "PD94bWwmV..."
    },
    "directoryIndexDirective": [
        "index.html"
    ]
}
```

In this example an internal redirect of `/index.html` to `/myService/myContentSet/index.html` is performed, directly serving the `index.html` page of `/myService/myContentSet`. This overwrites the `index.html` definition in `defaultStaticContent`.

This is useful to directly serve a specific app on the root path `/`.

```json
{
    "defaultStaticContent": {
        "index.html": "PCFET0NUW...",
        "favicon.ico": "AAABAAMAM...",
        "favicon.svg": "PD94bWwmV..."
    },
    "defaultRedirects": {
        "index.html": "/myService/myContentSet/index.html"
    },
    "directoryIndexDirective": [
        "index.html"
    ]
}
```

### Updating the MySQL REST Service Metadata Schema

If the updateIfAvailable is defined, the configure operation will include an update of the `mysql_rest_service_metadata` database schema.

## CREATE REST SERVICE

The CREATE REST SERVICE statement is used to create a new or replace an existing REST service.

The MySQL REST Service supports the creation of many individual REST services. It is common to create a separate REST service for each REST application.

Each service can have its own options, authentication apps and supports a different set of authentication users.

**_SYNTAX_**

createRestServiceStatement ::=

![CREATE REST SERVICE Statement](../images/ddl/createRestServiceStatement.svg "CREATE REST SERVICE Statement")

restServiceOptions ::=
![restServiceOptions](../images/ddl/restServiceOptions.svg "restServiceOptions")

enabledDisabled ::=
![enabledDisabled](../images/ddl/enabledDisabled.svg "enabledDisabled")

restAuthentication ::=
![restAuthentication](../images/ddl/restAuthentication.svg "restAuthentication")

jsonOptions ::=
![jsonOptions](../images/ddl/jsonOptions.svg "jsonOptions")

comments ::=
![comments](../images/ddl/comments.svg "comments")

**_Examples_**

The following example creates a REST service `/myTestService` that can only be accessed from localhost.

```sql
CREATE OR REPLACE REST SERVICE /myService
    COMMENTS "A simple REST service";
```

The following example creates a REST service `/myTestService` that can only be accessed on localhost and is disabled after creation.

```sql
CREATE OR REPLACE REST SERVICE localhost/myTestService
    DISABLED
    COMMENTS "A REST service that can only be accessed on localhost";
```

```sql
CREATE OR REPLACE REST SERVICE localhost/myTestService
    COMMENTS "A simple REST service"
    AUTHENTICATION
        PATH "/authentication"
        REDIRECTION DEFAULT
        VALIDATION DEFAULT
        PAGE CONTENT DEFAULT
    USER MANAGEMENT SCHEMA DEFAULT
    OPTIONS {
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
    };
```

### Enabling or Disabling a REST Service at Creation Time

The enabledDisabled option specifies if the REST service should be enabled or disabled after the configuration operation.

### REST Service Options

The jsonOptions allow to set a number of specific options for the service.

These options can include the following JSON keys.

- `headers` - Allows the specification of HTTP headers. Please refer to the HTTP header documentation for details.
- `http`
  - `allowedOrigin` - The setting for Access-Control-Allow-Origin HTTP header. Can either be set to `*`, `null`, `<origin>` or `auto`. When set to `auto`, the MySQL Routers will return the origin of the specific client making the request.
- `logging`
  - `exceptions` - If exceptions should be logged.
  - `requests`
    - `body` - If the content of request bodies should be logged.
    - `headers` - If the content of request headers should be logged.
  - `response`
    - `body` - If the content of response bodies should be logged.
    - `headers` - If the content of response headers should be logged.
- `returnInternalErrorDetails` - If internal errors should be returned. This is useful for application development but should be turned off for production deployments.
- `defaultStaticContent` - Allows the definition of static content for `request path` of the REST service that will be returned for file paths matching the given JSON keys. A JSON key `index.html` will be served as `/myService/index.html` by the MySQL Router if the `request path` of the REST service has been set to `/myService`. The file content needs to be Base64 encoded. If the same JSON key is used for `defaultStaticContent` as well as for `defaultRedirects`, the redirect is prioritized.
- `defaultRedirects` - Is used to define internal redirects performed by the MySQL Router. This can be used to expose content on the `request path` of the of a REST service. A JSON key `index.html` holding the value `/myService/myContentSet/index.html` will exposed the corresponding file from the given path as `/myService/index.html` if the `request path` of the REST service has been set to `/myService`.
- `directoryIndexDirective` - Holds an ordered list of files that should be returned when a directory path has been requested. The first matching file that is available will be returned. The `directoryIndexDirective` is recursively applies to all directory paths exposed by the MySQL Router. To change the `directoryIndexDirective` for a given REST object, the corresponding option needs to be set for that object.

All other keys will be ignored and can be used to store custom metadata about the service. It is a good practice to include a unique prefix when adding custom keys to avoid them be overwritten by future MRS options.

**_Examples_**

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
