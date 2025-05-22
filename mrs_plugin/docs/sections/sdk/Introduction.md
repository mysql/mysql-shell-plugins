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

# Introduction to the MySQL REST Service Client SDK

The MySQL REST Service offers a Software Development Kit (SDK) that makes it easier to write client applications and interact with the REST service.

The SDK features a Client API that is specifically generated for each REST Service. This makes it possible to provide the best possible support for each REST project.

The SDK is generated for a specific development language. Right now, TypeScript and Python are supported. Support for other languages is planned. Each language-specific SDK has its own individual and independent version number. Versioning follows the rules specified by [Semantic Versioning 2.0.0](https://semver.org/).

Most of the examples in this guide are written in TypeScript. If you want more details about the SDK for a different language, check the API reference docs.

## SDK Cheat Sheet

| Scope | TypeScript | Python | Description
| ---: | :------ | :------ | ------------------------
| All | [getMetadata](#getmetadata-ts) | [get_metadata](#get_metadata-py) | Returns the metadata of a REST service, schema, view, function or procedure.
| Service | [getAuthApps](#service-getauthapps-ts) | [get_auth_apps](#service-get_auth_apps-py) | Used to authenticate with the REST service.
| | [authenticate](#service-deauthenticate-ts) | [authenticate](#service-authenticate-py) | Used to authenticate with the REST service.
| | [deauthenticate](#service-deauthenticate-ts) | [deauthenticate](#service-deauthenticate-py) | Used to close an authenticated session to the REST service.
| View | [create](#view-create-ts) | [create](#view-create-py) | Creates a new document on a given REST view endpoint.
| | [createMany](#view-createmany-ts) | [create_many](#view-create_many-py) | Creates a list of document on a given REST view endpoint.
| | [find](#view-find-ts) | [find](#view-find-py) | Reads the first page of documents of a search request and returns an iterator.
| | [findFirst](#view-findfirst-ts) | [find_first](#view-find_first-py) | Reads the first matching document of a search request.
| | [findFirstOrThrow](#view-findfirst-ts) | [find_first](#view-find_first-py) | Reads the first matching document of a search request and throws an error if not found.
| | [findUnique](#view-findunique-ts) | [find_unique](#view-find_first-py) | Reads the first matching document of a primary key lookup.
| | [findUniqueOrThrow](#view-finduniqueorthrow-ts) | [find_unique_or_throw](#view-find_unique_or_throw-py) | Reads the first matching document of a primary key lookup and throws if not found.
| | [delete](#view-delete-ts) | [delete](#view-delete-py) | Deletes a given document from a REST view endpoint.
| | [deleteMany](#view-deletemany-ts) | [delete_many](#view-delete_many-py) | Deletes several documents from a REST view endpoint.
| | [update](#view-update-ts) | [update](#view-update-py) | Updates a given document on a REST view endpoint.
| | [updateMany](#view-updatemany-ts) | [update_many](#view-update_many-py) | Updates several documents on a REST view endpoint.
| Document | [update](#document-update-ts) | [update](#document-update-py) | Updates a REST document that was fetched before.
| | [delete](#document-delete-ts) | [delete](#document-delete-py) | Deletes a REST document that was fetched before.
| Function | [call](#function-call-ts) | call | Calls a REST function.
| | [start](#function-start-ts) | start |  Calls an async REST function and returns a task.
| Procedure | [call](#procedure-call-ts) | call | Calls a REST procedure.
| | [start](#procedure-start-ts) | start |  Calls an async REST procedure and returns a task.
| Task | [watch](#task-watch-ts) | watch | Watches a Task for progress and result.
| | [kill](#task-kill-ts) | kill | Terminates an async REST function or REST procedure call.

: SDK Cheat Sheet

## Generation of SDK Files

Once a REST service has been defined, the corresponding SDK can be generated in the required development language.

Several different methods can be used to perform the actual generation process.

- Generating the SDK files from MySQL Shell for VS Code
  - When using [VS Code](https://code.visualstudio.com/) or [VSCodium](https://vscodium.com/) and the [MySQL Shell for VS Code extension](https://marketplace.visualstudio.com/items?itemName=Oracle.mysql-shell-for-vs-code), the SDK for a given REST service can be generated directly from the UI.
  - While using the MySQL Shell for VS Code extension, the SDK will be generated on the fly when using a DB Notebook to enabled instant prototyping of the SDK API calls.
- Generating the SDK Files from the Command Line
  - To integrate the SDK generation into an existing development process, it is possible to use the MySQL Shell on the command line to generate the SDK files.

An constructor/initializer for the client-side REST service instance is generated based on the conventions established for the selected programming language. It allows to optionally specify the base URL of that REST service, has deployed in the MySQL Router instance used by the MRS installation. This would override the base URL specified when the SDK is generated in the first place, using the MySQL Shell.

### Generating the SDK Files from MySQL Shell for VS Code

To generate the SDK files for a development project, right click on the MRS Service and select `Export REST Service SDK Files ...`. This will allow you to select a destination folder inside your development project the files will be placed in.

The following files will be placed in the selected folder.

### On the Fly Generation of TypeScript SDK in VS Code

The MySQL Shell for VS Code extension allows interactive execution of TypeScript code inside a DB Notebook. To make working with the MySQL REST Service easier, the TypeScript SDK for the current REST Service is made available directly within the DB Notebooks.

Whenever a REST DB Object has being edited, the TypeScript SDK is updated to allow instant prototyping of REST queries using the Client API.

This allows for adjusting and fine tuning the REST views and routines till they exactly meet the developer's requirements and to prototype Client API calls for a development project.

### Generating the SDK Files from the Command Line

To generate the SDK files on the command line, the MySQL Shell needs to be [downloaded](https://dev.mysql.com/downloads/shell/) and installed.

> When using the MySQL Shell for VS Code extension, the MySQL Shell executable is made available at `~/.mysqlsh-gui/mysqlsh` and a dedicated installation of the MySQL Shell is not required.

The following template shows how to call the `mrs.dump.sdk_service_files` plugin function to perform the SDK generation.

```sh
mysqlsh dba@localhost --py -e 'mrs.dump.sdk_service_files(directory="/path/to/project/sdk", options={"sdk_language": "TypeScript", "service_url":"https://example.com/myService"})'
```

The full list of parameters include the following.

```txt
\? mrs.dump.sdk_service_files
NAME
      sdk_service_files - Dumps the SDK service files for a REST Service

SYNTAX
      mrs.dump.sdk_service_files([kwargs])

WHERE
      kwargs: Dictionary - Options to determine what should be generated.

DESCRIPTION
      Returns:

          True on success

      The kwargs parameter accepts the following options:

      - directory: String - The directory to store the .mrs.sdk folder with the
        files.
      - options: Dictionary - Several options how the SDK should be created.
      - session: Object - The database session to use.

      The options option accepts the following options:

      - service_id: String - The ID of the service the SDK should be generated
        for. If not specified, the default service is used.
      - db_connection_uri: String - The dbConnectionUri that was used to export
        the SDK files.
      - sdk_language: String - The SDK language to generate.
      - add_app_base_class: String - The additional AppBaseClass file name.
      - service_url: String - The url of the service.
      - version: Integer - The version of the generated files.
      - generationDate: String - The generation date of the SDK files.
      - header: String - The header to use for the SDK files.
```

### Important Notes

The identifiers used to name each corresponding REST resource (services, schemas and/or objects) in the SDK are based on their corresponding request path segment.

These are generated using the most common convention for each language - TypeScript and Python - which means that the identifier generated for a request path such as `/myRequestPath` would be equivalent to the one generated for `/my_request_path`. To avoid a naming conflict in this case, the code generator keeps track of potential conflicts and appends a suffix to duplicate identifiers which corresponds to an increasing number based on the current total of duplicates. Following the sorting rules by omission in MySQL, under these circumstances, the snake_case version takes precedence over the camelCase version.

| Request Path        | TypeScript Class  | Python Class      | TypeScript Property | Python Property     |
|---------------------|-------------------|-------------------|---------------------|---------------------|
| `/my_request_path`  | `MyRequestPath`   | `MyRequestPath`   | `myRequestPath`     | `my_request_path`   |
| `/myRequestPath`    | `MyRequestPath1`  | `MyRequestPath1`  | `myRequestPath1`    | `my_request_path1`  |

Additionally, request paths with a leading numeric character are also perfectly valid, but without special handling, the resulting identifiers would lead to syntax errors in both languages. In this case, following the common convention, the generated identifier contains an extra leading `_`.
