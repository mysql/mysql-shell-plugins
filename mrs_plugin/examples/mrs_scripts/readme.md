---
title: MRS Scripts Example
---

<!-- Copyright (c) 2024, Oracle and/or its affiliates.

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

## MRS Scripts Example

The MRS Scripts Example project implements a set of simple MRS scripts, including two examples of how to perform Server Side Rendering with MRS.

### MRS Scripts Example Quick Guide

To quickly get the MRS Notes Examples working, please feel free to follow this guide. If you want to learn more about the examples, please continue reading the chapters below.

The following steps need to be taken to setup, build and deploy the MRS Scripts Example project on the MySQL REST Service.

1. Save the MRS Notes Example project to disk and open it with VS Code `VSCodeProject:examples/mrs_scripts`
2. [Configure](#configuring-mysql-rest-service) the MySQL REST Service.
3. Create a new MRS service (e.g. `/myService`).
4. Ensure a bootstrapped MySQL Router instance is running (if not, start it).
5. Build and deploy the MRS Scripts by following the steps below.

#### Deploying the MRS Script Examples

The MRS Script Examples are written in TypeScript and need to be built before they can be uploaded to MRS. Please follow these steps to deploy the examples.

1. If you have not done so in the previous section, save the following project to disk and open it with VS Code `VSCodeProject:examples/mrs_scripts`
2. After the project folder has been opened in VS Code, navigate to the `NPM SCRIPTS` View in the sidebar and right-click on `package.json` to select `Run Install`. Alternatively, set the focus to the TERMINAL tab and enter `npm install` to install the required node modules
3. In the `NPM SCRIPTS` View, run the `package.json/build` command that will create a folder called `build` that contains all files needed for deployment.
4. Right click on the background below the last file in the Folders view and select `Upload Folder to MySQL REST Service` from the popup menu.
5. In the REST Content Set dialog make sure that the `Enable MRS Scripts` checkbox is checked and click `OK` to upload the files to the MRS service.
6. Open a web browser and access the full path specified in the previous step to open the app, e.g. `https://localhost:8444/myService/testScripts/preactTestPage.html`
