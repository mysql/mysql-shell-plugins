# Database Schema Project `mysql_tasks`

This project manages the development of the `mysql_tasks` database schema.

## Schema Development and Release Workflow

### Development

Database schema development takes place in an SQL script file `<schema_name>_next.sql`, which is placed in the `development' folder.

Instead of adding a specific version to the file, the `_next` suffix indicates that the next version of the database schema is being worked on.

This script is modified during the development process as database schema objects - such as TABLEs, VIEWs, PROCEDURES, etc. - are added to and removed from the script.

For more information on the development process, see the readme.md in the Documents folder.

### Preparing a Database Schema Release

Once all the changes for a release (or release candidate) have been applied to the SQL development file, a release can be prepared using a specific version number.

- This step takes a snapshot of the current SQL development file and places it in the `releases/versions` folder, using a filename that contains the specific version number for that release.
- An SQL update file is also created in the `releases/updates` folder. This SQL update file must be edited to contain the SQL statements required to update the database schema from the previously released version to the version to be released.

Please refer to the `releases/updates/readme.md` file for details of how to add the necessary SQL statements for the update.

### Generating a Deployment Script

Once the work on the SQL update file has been completed, a deployment, an SQL deployment script, can be generated.

This SQL deployment file will contain the full definition of the database schema as well as the update logic to update any previously released version of the database schema to the version of the SQL deployment file.

Copyright (c) 2025, Oracle and/or its affiliates.
