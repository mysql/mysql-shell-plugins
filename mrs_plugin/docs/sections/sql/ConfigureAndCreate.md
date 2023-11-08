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

# CONFIGURE and CREATE

## CONFIGURE REST METADATA

The CONFIGURE REST METADATA statement is used to perform the initial configuration of the MySQL REST Service on a MySQL Server instance or InnoDB Cluster/Set.

It will create the `mysql_rest_service_metadata` database schema.

Please note that the MySQL account used to execute the statement needs the required privileges to create database schemas.

**_Syntax_**

```antlr
configureRestMetadataStatement:
    CONFIGURE REST METADATA restMetadataOptions?
;

restMetadataOptions: (
        enabledDisabled
        | jsonOptions
        | updateIfAvailable
    )+
;
```

configureRestMetadataStatement ::=
![configureRestMetadataStatement](../../images/sql/configureRestMetadataStatement.svg "configureRestMetadataStatement")

restMetadataOptions ::=
![restMetadataOptions](../../images/sql/restMetadataOptions.svg "restMetadataOptions")

**_Example_**

```sql
CONFIGURE REST METADATA;
```

### Enable or Disable the MySQL REST Service

The enabledDisabled option specifies if the MySQL REST Service should be enabled or disabled after the configuration operation. The default is set to enable the MySQL REST Service.

```antlr
enabledDisabled:
    ENABLED
    | DISABLED
;
```

enabledDisabled ::=
![enabledDisabled](../../images/sql/enabledDisabled.svg "enabledDisabled")

**_Examples_**

The following example configures the MySQL REST Service and enables it and updates the metadata schema, if possible.

```sql
CONFIGURE REST METADATA
    ENABLED
    UPDATE IF AVAILABLE;
```

The following example configures the MySQL REST Service and enables the GTID cache and sets authentication options.

```sql
CONFIGURE REST METADATA
    ENABLED
    OPTIONS {
        "gtid": {
            "cache": {
                "enable": true,
                "refresh_rate": 5,
                "refresh_when_increases_by": 500
            }
        },
        "authentication": {
            "throttling": {
                "perAccount": {
                    "minimumTimeBetweenRequestsInMs": 1500,
                    "maximumAttemptsPerMinute": 5
                },
                "perHost": {
                    "minimumTimeBetweenRequestsInMs": 1500,
                    "maximumAttemptsPerMinute": 5
                },
                "blockWhenAttemptsExceededInSeconds": 120
            }
        }
    };
```

### REST Configuration Json Options

The jsonOptions allow to set a number of specific options for the service.

```antlr
jsonOptions:
    OPTIONS jsonValue
;
```

jsonOptions ::=
![jsonOptions](../../images/sql/jsonOptions.svg "jsonOptions")

These options can include the following JSON keys.

- `authentication`
  - Defines global authentication parameters valid for all MySQL Routers
  - `throttling`
    - Used to limit the authentication attempts to prevent brute force attacks on account information
    - `perAccount`
      - Settings that apply per MRS account
      - `minimumTimeBetweenRequestsInMs`
        - Sets the minimum time between connection attempts. If a client tries to authenticate faster than that the request will be rejected. The value is given in milliseconds.
      - `maximumAttemptsPerMinute`
        - Sets the maximum amount of attempts per minute. If a client tries to authenticate more often that that further attempts will be blocked for the amount of seconds specified in the `blockWhenAttemptsExceededInSeconds` value.
    - `perHost`
      - Settings that apply per host from where a client tries to connect
      - `minimumTimeBetweenRequestsInMs`
      - `maximumAttemptsPerMinute`
    - `blockWhenAttemptsExceededInSeconds`
      - Sets the amount of time the account or client host will be blocked from authentication. The value is given in seconds.
- `gtid`
  - Defines global settings for the MySQL GTID handling, using the following fields.
  - `cache`
    - Is used to configure the MySQL Router's GTID cache.
    - `enable`
      - If set to `true` GTIDs will be cached by the MySQL Router.
    - `refresh_rate`
      - Defines how often the GTID cache will be refreshed. Set seconds, e.g. 5.
    - `refresh_when_increases_by`
      - In addition to the time based refresh, the GTID cache can also be refreshed based on the number of transactions that happened since the last refresh. Set in number of transactions, e.g. 500.
- `defaultStaticContent`
  - Allows the definition of static content for the root path `/` that will be returned for file paths matching the given JSON keys. A JSON key `index.html` will be  served as `/index.html` by the MySQL Router. The file content needs to be Base64 encoded. If the same JSON key is used for `defaultStaticContent` as well as for `defaultRedirects`, the redirect is prioritized.
- `defaultRedirects`
  - Is used to define internal redirects performed by the MySQL Router. This can be used to expose content of a REST service on the root path `/`. A JSON key `index.html` holding the value `/myService/myContentSet/index.html` will exposed the corresponding file from the given path as `/index.html`.
- `directoryIndexDirective`
  - Holds an ordered list of files that should be returned when a directory path has been requested. The first matching file that is available will be returned. The `directoryIndexDirective` is recursively applies to all directory paths exposed by the MySQL Router. To change the `directoryIndexDirective` for a given REST service or REST static content set, the corresponding option needs to be set for those objects.

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

```antlr
updateIfAvailable:
    UPDATE (IF AVAILABLE)?
;
```

updateIfAvailable ::=
![updateIfAvailable](../../images/sql/updateIfAvailable.svg "updateIfAvailable")

## CREATE REST SERVICE

The CREATE REST SERVICE statement is used to create a new or replace an existing REST service.

The MySQL REST Service supports the creation of many individual REST services. It is good practice to create a separate REST service for each REST application.

Each REST service can have its own options, authentication apps and supports a different set of authentication users.

**_SYNTAX_**

```antlr
createRestServiceStatement:
    CREATE (OR REPLACE)? REST SERVICE serviceRequestPath
        restServiceOptions?
;

restServiceOptions: (
        enabledDisabled
        | restAuthentication
        | jsonOptions
        | comments
    )+
;
```

createRestServiceStatement ::=
![CREATE REST SERVICE Statement](../../images/sql/createRestServiceStatement.svg "CREATE REST SERVICE Statement")

restServiceOptions ::=
![restServiceOptions](../../images/sql/restServiceOptions.svg "restServiceOptions")

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
        "returnInternalErrorDetails": true,
        "includeLinksInResults": false
    };
```

### Enabling or Disabling a REST Service at Creation Time

The `enabledDisabled` option specifies whether the REST schema should be enabled or disabled after it has been created.

```antlr
enabledDisabled:
    ENABLED
    | DISABLED
;
```

enabledDisabled ::=
![enabledDisabled](../../images/sql/enabledDisabled.svg "enabledDisabled")

### REST Service Authentication Settings

Each REST service requires allows for specific authentication settings.

restAuthentication ::=
![restAuthentication](../../images/sql/restAuthentication.svg "restAuthentication")

- AUTHENTICATION PATH
  - The html path used for authentication handling for this REST service. Specified as a sub-path to the REST service path. If not explicitly set, the default is path is `/authentication` is used.
  - The following endpoints will be made available for `<service_path>/<auth_path>`
    - `/login`
    - `/status`
    - `/logout`
    - `/completed`
- AUTHENTICATION REDIRECTION
  - The authentication workflow will redirect to this URL after successful- or failed login. Specified as a sub-path to the REST service path. If this option is not set explicitly, the workflow will redirect to `<service_path>/<auth_path>/completed` if the `<service_path>/<auth_path>/login?onCompletionRedirect` parameter has not been set.
- AUTHENTICATION VALIDATION
  - A regular expression to validate the `<service_path>/<auth_path>/login?onCompletionRedirect` parameter. If set, this allows to limit the possible URLs an application can specify for this parameter.
- AUTHENTICATION PAGE CONTENT
  - If this option is set its content will replace the page content of the `<service_path>/<auth_path>/completed` page.

### REST Service Json Options

The jsonOptions allow to set a number of specific options for the service.

```antlr
jsonOptions:
    OPTIONS jsonValue
;
```

jsonOptions ::=
![jsonOptions](../../images/sql/jsonOptions.svg "jsonOptions")

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
- `includeLinksInResults` - If set to false, the results do not include navigation links.
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
    "returnInternalErrorDetails": true,
    "includeLinksInResults": false
}
```

### REST Service Comments

The comments can hold a description of the REST service. The maximal length is of the comments string is 512 characters.

```antlr
comments:
    COMMENTS quotedText
;
```

comments ::=
![comments](../../images/sql/comments.svg "comments")

## CREATE REST SCHEMA

The CREATE REST SCHEMA statement is used to create a new or replace an existing REST schema. Each REST schema directly maps to a database schema and allows the database schema objects (tables, views and stored procedures) to be exposed via REST endpoints.

> Note: Adding a REST schema to a REST service does not automatically expose any database schema objects via REST. The corresponding `CREATE REST TABLE`, `CREATE REST DUALITY VIEW`, `CREATE REST PROCEDURE` ddl commands need to be called to explicitly expose a database schema object.

Each REST schema belongs to a REST service, which has to be created first. One REST service can hold many REST schemas.

Each REST schema can have its own options, authentication apps and supports a different set of authentication users.

**_SYNTAX_**

```antlr
createRestSchemaStatement:
    CREATE (OR REPLACE)? REST DATABASE schemaRequestPath? (
        ON SERVICE? serviceRequestPath
    )? FROM schemaName restSchemaOptions?
;

restSchemaOptions: (
        enabledDisabled
        | authenticationRequired
        | itemsPerPage
        | jsonOptions
        | comments
    )+
;
```

createRestSchemaStatement ::=
![createRestSchemaStatement](../../images/sql/createRestSchemaStatement.svg "createRestSchemaStatement")

restSchemaOptions ::=
![restSchemaOptions](../../images/sql/restSchemaOptions.svg "restSchemaOptions")

**_Examples_**

The following example creates a REST schema `/sakila` on the REST service `/myService`.

```sql
CREATE OR REPLACE REST SCHEMA /sakila ON SERVICE /myService
    FROM `sakila`
    COMMENTS "The sakila schema";
```

### Enabling or Disabling a REST Schema at Creation Time

The `enabledDisabled` option specifies whether the REST schema should be enabled or disabled what it is created.

```antlr
enabledDisabled:
    ENABLED
    | DISABLED
;
```

enabledDisabled ::=
![enabledDisabled](../../images/sql/enabledDisabled.svg "enabledDisabled")

### Requiring Authentication for REST Schema Access

The `authenticationRequired` option specifies if a REST schema and its objects require authentication before accessing their REST endpoints.

```antlr
authenticationRequired:
    AUTHENTICATION NOT? REQUIRED
;
```

authenticationRequired ::=
![authenticationRequired](../../images/sql/authenticationRequired.svg "authenticationRequired")

### Specifying the Default Page Count

The `itemsPerPage` option can be used to specify the default number of items returned for queries run against this REST schema.

```antlr
itemsPerPage:
    ITEMS PER PAGE itemsPerPageNumber
;
```

itemsPerPage ::=
![itemsPerPage](../../images/sql/itemsPerPage.svg "itemsPerPage")

The number of items per page can also be specified for each REST object individually.

### REST Schema Json Options

The jsonOptions allow to set a number of specific options for the service.

```antlr
jsonOptions:
    OPTIONS jsonValue
;
```

jsonOptions ::=
![jsonOptions](../../images/sql/jsonOptions.svg "jsonOptions")

These options can include the following JSON keys.

- `defaultStaticContent` - This option serves the same purpose as described in the [REST Configuration Json Options](#rest-configuration-json-options).
- `defaultRedirects` - This option serves the same purpose as described in the [REST Configuration Json Options](#rest-configuration-json-options).
- `directoryIndexDirective` - This option serves the same purpose as described in the [REST Configuration Json Options](#rest-configuration-json-options).

All other keys will be ignored and can be used to store custom metadata about the schema. It is a good practice to include a unique prefix when adding custom keys to avoid them be overwritten by future MRS options.

### REST Schema Comments

The comments can hold a description of the REST schema. The maximal length is of the comments string is 512 characters.

```antlr
comments:
    COMMENTS quotedText
;
```

comments ::=
![comments](../../images/sql/comments.svg "comments")

## CREATE REST DUALITY VIEW

The `CREATE REST DUALITY VIEW` statement is used to add REST endpoints for database schema tables or views. They will be served as JSON duality views.

The structure of the served JSON documents is defined using an [extended GraphQL syntax](#defining-the-graphql-definition-for-a-rest-duality-view). This allows to define even complex REST duality views in a simple and human readable way. Please see the corresponding [GraphQL section](#defining-the-graphql-definition-for-a-rest-duality-view) about how to design the GraphQL definition for a REST duality view.

Please see the MRS Developer's Guide to learn more about [JSON duality views](index.html#json-duality-views).

**_SYNTAX_**

```antlr
createRestViewStatement:
    CREATE (OR REPLACE)? REST JSON? RELATIONAL?
        DUALITY? VIEW viewRequestPath (
        ON serviceSchemaSelector
    )? AS qualifiedIdentifier (
        CLASS restObjectName
    )? graphQlCrudOptions? graphQlObj? restObjectOptions?
;

serviceSchemaSelector:
    (SERVICE serviceRequestPath)? DATABASE schemaRequestPath
;

restObjectOptions: (
        enabledDisabled
        | authenticationRequired
        | itemsPerPage
        | jsonOptions
        | comments
        | restViewMediaType
        | restViewFormat
        | restViewAuthenticationProcedure
    )+
;
```

createRestViewStatement ::=
![createRestViewStatement](../../images/sql/createRestViewStatement.svg "createRestViewStatement")

serviceSchemaSelector ::=
![serviceSchemaSelector](../../images/sql/serviceSchemaSelector.svg "serviceSchemaSelector")

restObjectOptions ::=
![restObjectOptions](../../images/sql/restObjectOptions.svg "restObjectOptions")

**_Examples_**

The following example adds a REST duality view for the `sakila.city` database schema table.

```sql
CREATE REST DUALITY VIEW /city
ON SERVICE /myService SCHEMA /sakila
AS `sakila`.`city` {
    cityId: city_id @SORTABLE,
    city: city,
    countryId: country_id,
    lastUpdate: last_update
}
AUTHENTICATION REQUIRED;
```

Querying the REST duality view using the TypeScript SDK returns the following JSON document.

```ts
ts> myService.sakila.city.findFirst();
{
   "city": "A Corua (La Corua)",
   "links": [
      {
         "rel": "self",
         "href": "/myService/sakila/city/1"
      }
   ],
   "cityId": 1,
   "countryId": 87,
   "lastUpdate": "2006-02-15 04:45:25.000000",
   "_metadata": {
      "etag": "EE93452B41984F3F5BBB0395CCB2CED00F5C748FEEA4A36CCD749CC3F85B7CEA"
   }
}
```

The next example adds the referenced table `sakila.country` to the REST duality view.

```sql
CREATE OR REPLACE REST DUALITY VIEW /city
ON SERVICE /myService SCHEMA /sakila
AS `sakila`.`city` {
    cityId: city_id @SORTABLE,
    city: city,
    countryId: country_id,
    lastUpdate: last_update,
    country: sakila.country {
        countryId: country_id @SORTABLE,
        country: country,
        lastUpdate: last_update
    }
}
AUTHENTICATION REQUIRED;
```

This is what the REST duality view looks like in the interactive MySQL REST Object Dialog in the MySQL Shell for VS Code extension.

![Adding a Referenced Table](../../images/vsc-mrs-json-relational-editor-2-referenced-table.png "Adding a Referenced Table")

Running a TypeScript SDK query against this new REST endpoint returns the following JSON Document.

```ts
ts> myService.sakila.city.findFirst();
{
    "city": "A Corua (La Corua)",
    "links": [
        {
            "rel": "self",
            "href": "/myService/sakila/city/1"
        }
    ],
    "cityId": 1,
    "country": {
        "country": "Spain",
        "countryId": 87,
        "lastUpdate": "2006-02-15 04:44:00.000000"
    },
    "countryId": 87,
    "lastUpdate": "2006-02-15 04:45:25.000000",
    "_metadata": {
        "etag": "FFA2187AD4B98DF48EC40B3E807E0561A71D02C2F4F5A3B953AA6CB6E41CAD16"
    }
}
```

### Preconditions

You define a REST duality view against a set of tables related by primary key (PK), foreign key (FK) or unique key constraints (UK). The following rules apply:

- The constraints must be declared in the database.
- The relationships type can be 1-to-1, 1-to-N and N-to-M (using a mapping table with two FKs). The N-to-M relationship can be thought of as the combination of 1-to-N and 1-to-1 relationship
- Columns of two or more tables with 1-to-1 or N-to-1 relationships can be merged into the same JSON object via UNNEST. Otherwise a nested JSON object is created.
- Tables with a 1-to-N relationship create a nested JSON array.
- Each item in the duality view is one JSON object, which is typically a hierarchy of nested objects and arrays.
- Each application object is built from values originating from one or multiple rows from the underlying tables of that view. Typically, each table contributes to one (nested) JSON object.

### Enabling or Disabling a REST Duality View at Creation Time

The `enabledDisabled` option specifies whether the REST duality view should be enabled or disabled when it is created.

```antlr
enabledDisabled:
    ENABLED
    | DISABLED
;
```

enabledDisabled ::=
![enabledDisabled](../../images/sql/enabledDisabled.svg "enabledDisabled")

### Requiring Authentication for REST Duality Views

The `authenticationRequired` option specifies if a REST duality view requires authentication before accessing its REST endpoints.

```antlr
authenticationRequired:
    AUTHENTICATION NOT? REQUIRED
;
```

authenticationRequired ::=
![authenticationRequired](../../images/sql/authenticationRequired.svg "authenticationRequired")

### Specifying the Page Count for REST Duality Views

The `itemsPerPage` option can be used to specify the number of items returned for queries run against the REST duality view.

```antlr
itemsPerPage:
    ITEMS PER PAGE itemsPerPageNumber
;
```

itemsPerPage ::=
![itemsPerPage](../../images/sql/itemsPerPage.svg "itemsPerPage")

The number of items per page can also be specified for each REST object individually.

### Setting the Media Type for REST Duality Views

If this REST duality view returns a specific MIME type it can be set via the `restViewMediaType` option. If MRS should try to automatically detect the file type based on the content of the file the `AUTODETECT` option can be used.

```antlr
restViewMediaType:
    MEDIA TYPE (quotedText | AUTODETECT)
;
```

restViewMediaType ::=
![restViewMediaType](../../images/sql/restViewMediaType.svg "restViewMediaType")

### Setting the Result Format for REST Duality Views

A REST duality view can return one of the following formats which can be set with the `restViewFormat` option.

- FEED: A list of result JSON objects
- ITEM: A single result item
- MEDIA: A single blob item. The `restViewMediaType` option is used to set the corresponding MIME type in this case.

```antlr
restViewFormat:
    FORMAT (FEED | ITEM | MEDIA)
;
```

restViewFormat ::=
![restViewFormat](../../images/sql/restViewFormat.svg "restViewFormat")

### Using a Custom Authentication Procedure for a REST Duality View

In case the built in authentication handling does not cover the specific use case for a REST duality view, a custom MySQL stored procedure can be used to handle the authentication check for the given user and the requested CRUD operation.

The referenced MySQL stored procedure has to be in the same schema as the database schema object and it has to accept the following parameters: `(IN user_id BINARY(16), IN schema VARCHAR(255), IN object VARCHAR(255), IN crud_operation VARCHAR(4))`.  It needs to returns `true` or `false`.

restViewAuthenticationProcedure ::=
![restViewAuthenticationProcedure](../../images/sql/restViewAuthenticationProcedure.svg "restViewAuthenticationProcedure")

### Defining the GraphQL definition for a REST Duality View

```antlr
graphQlObj:
    OPEN_CURLY graphQlPair (COMMA graphQlPair)* CLOSE_CURLY
    | OPEN_CURLY CLOSE_CURLY
;

graphQlCrudOptions: (
        AT_SELECT
        | AT_NOSELECT
        | AT_INSERT
        | AT_NOINSERT
        | AT_UPDATE
        | AT_NOUPDATE
        | AT_DELETE
        | AT_NODELETE
    )+
;

graphQlPair:
    graphKeyValue COLON qualifiedIdentifier (
        AT_IN
        | AT_OUT
        | AT_INOUT
        | AT_NOCHECK
        | AT_SORTABLE
        | AT_NOFILTERING
        | AT_ROWOWNERSHIP
        | AT_UNNEST
        | AT_DATATYPE OPEN_PAR graphQlDatatypeValue CLOSE_PAR
        | graphQlCrudOptions
    )? graphQlObj?
;

graphQlValue:
    qualifiedIdentifier
    | graphQlObj
;
```

graphQlObj ::=
![graphQlObj](../../images/sql/graphQlObj.svg "graphQlObj")

graphQlCrudOptions ::=
![graphQlCrudOptions](../../images/sql/graphQlCrudOptions.svg "graphQlCrudOptions")

graphQlPair ::=
![graphQlPair](../../images/sql/graphQlPair.svg "graphQlPair")

graphQlValue ::=
![graphQlValue](../../images/sql/graphQlValue.svg "graphQlValue")

## CREATE REST PROCEDURE

The `CREATE REST PROCEDURE` statement is used to add REST endpoints for database schema stored procedures. It uses the same [extended GraphQL syntax](#defining-the-graphql-definition-for-a-rest-duality-view) as defined for REST duality views to describe the REST procedure's parameters and result sets. Please make sure to study the [corresponding section](#defining-the-graphql-definition-for-a-rest-duality-view).

**_SYNTAX_**

```antlr
createRestProcedureStatement:
    CREATE (OR REPLACE)? REST PROCEDURE procedureRequestPath (
        ON serviceSchemaSelector
    )? AS qualifiedIdentifier (PARAMETERS restObjectName? graphQlObj)?
        restProcedureResult* restObjectOptions?
;

serviceSchemaSelector:
    (SERVICE serviceRequestPath)? DATABASE schemaRequestPath
;

restObjectOptions: (
        enabledDisabled
        | authenticationRequired
        | itemsPerPage
        | jsonOptions
        | comments
        | restViewMediaType
        | restViewFormat
        | restViewAuthenticationProcedure
    )+
;

restProcedureResult:
    RESULT restResultName? graphQlObj
;
```

createRestProcedureStatement ::=
![createRestProcedureStatement](../../images/sql/createRestProcedureStatement.svg "createRestProcedureStatement")

serviceSchemaSelector ::=
![serviceSchemaSelector](../../images/sql/serviceSchemaSelector.svg "serviceSchemaSelector")

restObjectOptions ::=
![restObjectOptions](../../images/sql/restObjectOptions.svg "restObjectOptions")

restProcedureResult ::=
![restProcedureResult](../../images/sql/restProcedureResult.svg "restProcedureResult")

## CREATE REST FUNCTION

The `CREATE REST FUNCTION` statement is used to add REST endpoints for database schema stored function. It uses the same [extended GraphQL syntax](#defining-the-graphql-definition-for-a-rest-duality-view) as defined for REST duality views to describe the REST functions's parameters and result. Please make sure to study the [corresponding section](#defining-the-graphql-definition-for-a-rest-duality-view).

**_SYNTAX_**

```antlr
createRestFunctionStatement:
    CREATE (OR REPLACE)? REST FUNCTION functionRequestPath (
        ON serviceSchemaSelector
    )? AS qualifiedIdentifier (PARAMETERS restObjectName? graphQlObj)?
        restFunctionResult? restObjectOptions?
;

serviceSchemaSelector:
    (SERVICE serviceRequestPath)? DATABASE schemaRequestPath
;

restObjectOptions: (
        enabledDisabled
        | authenticationRequired
        | itemsPerPage
        | jsonOptions
        | comments
        | restViewMediaType
        | restViewFormat
        | restViewAuthenticationProcedure
    )+
;

restFunctionResult:
    RESULT restResultName? graphQlObj
;
```

createRestFunctionStatement ::=
![createRestFunctionStatement](../../images/sql/createRestFunctionStatement.svg "createRestFunctionStatement")

serviceSchemaSelector ::=
![serviceSchemaSelector](../../images/sql/serviceSchemaSelector.svg "serviceSchemaSelector")

restObjectOptions ::=
![restObjectOptions](../../images/sql/restObjectOptions.svg "restObjectOptions")

restFunctionResult ::=
![restFunctionResult](../../images/sql/restFunctionResult.svg "restFunctionResult")

## CREATE REST CONTENT SET

The `CREATE REST CONTENT SET` statement is used to add REST endpoints for static content.

**_SYNTAX_**

```antlr
createRestContentSetStatement:
    CREATE (OR REPLACE)? REST CONTENT SET
        contentSetRequestPath (
        ON SERVICE? serviceRequestPath
    )? (FROM directoryFilePath)? restContentSetOptions?
;

restContentSetOptions: (
        enabledDisabled
        | authenticationRequired
        | jsonOptions
        | comments
    )+
;
```

createRestContentSetStatement ::=
![createRestContentSetStatement](../../images/sql/createRestContentSetStatement.svg "createRestContentSetStatement")

restContentSetOptions ::=
![restContentSetOptions](../../images/sql/restContentSetOptions.svg "restContentSetOptions")

## CREATE REST AUTH APP

The `CREATE REST AUTH APP` statement is used to add REST authentication app to a REST service.

**_SYNTAX_**

```antlr
createRestAuthAppStatement:
    CREATE (OR REPLACE)? REST (
        AUTH
        | AUTHENTICATION
    ) APP authAppName (
        ON SERVICE? serviceRequestPath
    )? VENDOR (MRS | MYSQL | vendorName) restAuthAppOptions?
;

restAuthAppOptions: (
        enabledDisabled
        | comments
        | allowNewUsersToRegister
        | defaultRole
    )+
;

allowNewUsersToRegister:
    ALLOW NEW USERS (TO REGISTER)?
;

defaultRole:
    DEFAULT ROLE quotedText
;
```

createRestAuthAppStatement ::=
![createRestAuthAppStatement](../../images/sql/createRestAuthAppStatement.svg "createRestAuthAppStatement")

restAuthAppOptions ::=
![restAuthAppOptions](../../images/sql/restAuthAppOptions.svg "restAuthAppOptions")

allowNewUsersToRegister ::=
![allowNewUsersToRegister](../../images/sql/allowNewUsersToRegister.svg "allowNewUsersToRegister")

defaultRole ::=
![defaultRole](../../images/sql/defaultRole.svg "defaultRole")

## CREATE REST USER

The `CREATE REST USER` statement is used to add REST user to a REST authentication app.

**_SYNTAX_**

```antlr
createRestUserStatement:
    CREATE (OR REPLACE)? REST USER userName AT_SIGN
        authAppName (
        ON SERVICE? serviceRequestPath
    )? IDENTIFIED BY userPassword
;
```

createRestUserStatement ::=
![createRestUserStatement](../../images/sql/createRestUserStatement.svg "createRestUserStatement")
