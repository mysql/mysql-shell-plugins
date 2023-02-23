---
title: MRS Notes Example
---

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

## MRS Notes Examples

The MRS Notes example implements a simple note taking application as a [Progressive Web Apps (PWA)](https://en.wikipedia.org/wiki/Progressive_web_app) that allows for sharing notes between users.

![mrsNotes App running on a Mobile](../../docs/images/mrs-notes-ss-phone.png "mrsNotes App running on a Mobile")

### MRS Notes Developer Showcase

The following features are showcased in this example.

- Accessing MRS REST endpoints from JavaScript and TypeScript code.
- Using MRS service authentication REST endpoints to support user management
- Using [JSON Web Tokens (JWT)](https://jwt.io/) to manage user sessions

### MRS Notes Quick Guide

To quickly get the MRS Notes Examples working, please feel free to follow this guide. If you want to learn more about the examples, please continue reading the chapters below.

The following steps need to be taken to setup, build and deploy the MRS Notes example project on the MySQL REST Service.

1. Setup and Configure a MySQL REST Service deployment.
2. Create a new MRS service.
3. Deploy the mrsNotes MySQL database schema `examples/mrs_notes/db_schema/mrs_notes.sql`
4. Load the MRS schema dump into the MRS service `examples/mrs_notes/mrs_schema/mrsNotes.mrs.json`
5. Please select one of the example apps below and follow the steps to build and deploy the app.

#### Deploying the MrsNotesJS JavaScript Example

The MrsNotesJS project implements a minimal JavaScript demo app that allows each user to store his own notes.

1. Save the following project to disk and open it with VS Code `examples/mrs_notes/app_code/MrsNotesJS`
2. Right click on the `src` folder in the Folders view and select `Upload Folder to MySQL REST Service` from the popup menu.
3. Set the path the app should be using and click `Upload` to upload the files.
4. Open a web browser and access the path specified in the previous step to open the app.

#### Deploying the MrsNotesTS TypeScript Example

The MrsNotesTS project implements a full TypeScript demo app that allows sharing of notes between users.

1. Save the following project to disk and open it with VS Code `examples/mrs_notes/app_code/MrsNotesTS`
2. After the project folder has been opened in VS Code, set the focus to the TERMINAL tab and enter `npm install` to install the required node modules
3. In the NPM Script View, run the `package.json/build` command that will create a folder called `dist` that contains all files for deployment.
4. Right click on the `dist` folder in the Folders view and select `Upload Folder to MySQL REST Service` from the popup menu.
5. In the MRS Static Content Set dialog set the `Request Path` the app should be using, e.g. `/app` and click `Upload` to upload the files to the MRS service.
6. Open a web browser and access the full path specified in the previous step to open the app, e.g. `https://localhost:8443/myService/app/index.html`

### MRS Setup and Configuration for the MRS Notes Examples

Please refer to the MRS documentation on how to setup and configure a MRS service in detail.

If you are using a local MRS deployment deployment you can use these simplified steps.

### Deploy the mrsNotes MySQL database schema

The mrsNotes MySQL database schema is the center of the MRS project. It defines the structure of the data and its database tables store all the information the users enter while using the app.

To create the mrsNotes schema the corresponding SQL script file needs to be executed. This can be done via the MySQL Shell or directly within VS Code using the MySQL Shell for VS Code extension.

- If you are browsing this documentation within VS Code click the button next to the SQL script name `examples/mrs_notes/db_schema/mrs_notes.sql`
- If you want to use MySQL Shell on the command line, switch to the mrs_notes plugin directory and run the following command.

    mysqlsh dba@localhost --sql -f examples/mrs_notes/db_schema/mrs_notes.sql

#### mrsNotes EER Diagram

The following diagram shows all components of the mrsNotes schema.

![mrsNotes MySQL Database Schema](../../docs/images/examples-mrs_notes_schema.svg "mrsNotes MySQL Database Schema")

The most important database table is the `note` table. It stores all notes that are created by the users.

The `user` table holds the nickname of the user as well as the email address used for receiving invitation emails for shared notes.

The `userHasNote` is used to managed the sharing of notes with other users.

As soon as selected notes need to be shareable between users it is necessary to add an
abstraction layer. This layer then allows selective access to notes written by other users
after they accepted the invitation to participate on the shared note.

In this case the layer consists of one VIEW and four STORED PROCEDUREs.

- notesAll … a VIEW of all notes the user is allowed to see.
- noteShare … a STORED PROCEDURE to share a note with another user.
- noteAcceptShare … a STORED PROCEDURE to accept a shared note.
- noteUpdate ... a STORED PROCEDURE to update a shared note
- noteDelete ... a STORED PROCEDURE to delete a shared note
