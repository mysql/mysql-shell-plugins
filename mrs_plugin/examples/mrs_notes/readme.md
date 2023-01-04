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

### MRS Notes Build and Deployment

The following steps need to be taken to build and deploy the MRS Notes example project on the MySQL REST Service.

1. Setup and Configure a MySQL REST Service deployment.
2. Deploy the mrsNotes MySQL database schema `examples/mrs_notes/db_schema/mrs_notes.sql`
3. Load the MRS schema dump `examples/mrs_notes/mrs_schema/mrsNotes.mrs.json`
4. Build the PWA app from the application's source code.
    - The `./JavaScript` folder contains a JavaScript implementation that can be deployed directly without a build step
    - The `./TypeScript` folder contains a TypeScript implementation
5. Upload the build folder to the MySQL REST Service.

After these steps have been performed the MRS Example Project should be accessible from any web browser.

#### MRS Setup and Configure for MRS Notes

Please refer to the MRS documentation on how to setup and configure a MRS service in detail.

If you are using a local MRS deployment deployment you can use these simplified steps.

#### Deploy the mrsNotes MySQL database schema

The mrsNotes MySQL database schema is the center of the MRS project. It defines the structure of the data and its database tables store all the information the users enter while using the app.

To create the mrsNotes schema the corresponding SQL script file needs to be executed. This can be done via the MySQL Shell or directly within VS Code using the MySQL Shell for VS Code extension.

- If you are browsing this documentation within VS Code click the button next to the SQL script name `examples/mrs_notes/db_schema/mrs_notes.sql`
- If you want to use MySQL Shell on the command line, switch to the mrs_notes plugin directory and run the following command.

    mysqlsh dba@localhost --sql -f examples/mrs_notes/db_schema/mrs_notes.sql

##### mrsNotes EER Diagram

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
