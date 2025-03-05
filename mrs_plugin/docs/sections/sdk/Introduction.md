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

# Introduction to the MRS SDK

The MySQL REST Service offers a Software Development Kit (SDK) that simplifies the process of writing client applications and interacting with the REST service.

The SDK features a Client API that is specifically generated for each MRS REST Service and therefore offers the best possible support for each REST project.

Currently, support for TypeScript and Python is available. Support for other languages is planned.

Most of the usage examples present in this guide are written in TypeScript. For specific details about the SDK for a different language, please check the corresponding API reference docs.

## Generation of SDK Files

### On the Fly Generation of TypeScript SDK

The MySQL Shell for VS Code extension allows interactive execution of TypeScript code inside a DB Notebook. To make working with the MySQL REST Service easier, the TypeScript SDK for the current REST Service is made available directly within the DB Notebooks.

Whenever a REST DB Object has being edited the TypeScript SDK is updated to allow instant prototyping of REST queries using the Client API.

This allows for adjusting and fine tuning the REST DB Objects until they exactly meet the developer's requirements and to prototype Client API calls for a development project.

### Generating the SDK files for a Development Project

To generate the SDK files for a development project, right click on the MRS Service and select `Export REST Service SDK Files ...`. This will allow you to select a destination folder inside your development project the files will be placed in.

The following files will be placed in the selected folder.

__TypeScript__

- `MrsBaseClasses.ts` - A file that contains the MRS base classes used by the Client API
- `<RestServiceName>.ts` - The Client API for the specific REST Service using the service's name.
- `config.json` - A configuration file used for the SDK generation

To start using the Client API import the `<RestServiceName>.ts` file in your project.
