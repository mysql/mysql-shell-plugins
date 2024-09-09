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

# MRS Metadata Schema

MySQL Workbench is used to design the MRS Metadata Schema and must be used to change the mrs_metadata_schema.mwb and generate the SQL CREATE script.

Please ensure to closely follow the process documented below to avoid manual changes to the SQL files being overwritten by the MySQL Workbench forward engineering function.

## Installing the Audit_Log_Triggers script in MySQL Workbench

MRS relies on a dedicated audit log table that tracks all changes to the MRS metadata. The audit log is implemented via triggers on each table that holds relevant data.

Instead of having to manually adjust the triggers for every change to the metadata schema, a MySQL Workbench script is used to generate the `Audit Log Triggers` SQL script instead that is later on added to the final `shell-plugins/mrs_plugin/db_schema/mrs_metadata_schema.sql` file.

Install the `./scripts/Audit_Log_Triggers_grt.py` script in `~/Library/Application Support/MySQL/Workbench/modules/Audit_Log_Triggers_grt.py` and in `~/Library/Application Support/MySQL/Workbench/scripts/` on MacOS. Use the corresponding paths on Linux and Windows.

## Generating the defaultStaticContent for config.data

In order to serve a welcome landing page when the root URI of a MySQL Router configured for MRS is accessed (e.g. https://localhost:8440), a list of static files are defined in the `defaultStaticContent` section of the configuration JSON options as well as the `directoryIndexDirective` is set to `index.html`.

These static files are stored in the `./default_static_content/` directory.

Whenever changes are made to any of those files, the `config` table default inserts in the MySQL Workbench model need to be updated with JSON data containing the minified and Base64-encoded content of those static files.

The script `../scripts/prepare_default_static_content.sh` and the corresponding NPM SCRIPTS entry can be used to generate a `./default_static_content/config.data.json` file that can be then used to populate the `config.data` column in the MySQL Workbench model. In addition, a `./default_static_content/insert.sql` script is generated that can be executed against a MySQL Server already configured for MRS. The latter is useful to test any modifications to the static files.

Please note, that the `../scripts/prepare_default_static_content.sh` script requires the installation of the following dependencies.

```sh
$ sudo npm install html-minifier-terser -g
$ brew install gettext
$ brew link --force gettext
```

## Process to update the MRS Metadata Schema

1. Open the `shell-plugins/mrs_plugin/db_schema/mrs_metadata_schema.mwb` file in MySQL Workbench, make the required changes to the model.
2. If a metadata schema table was changed that is included in the audit log triggers, select `Scripting > Run Script File > Audit_Log_Triggers_grt.py` to regenerate the embedded `Audit Log Triggers` SQL script.
3. Update the VIEW mrs_user_schema_version following the semantic versioning scheme if needed.
4. Update the SQL Script `4. Create Schema Version VIEW` and set the version of the `schema_version` VIEW to the new version using the semantic versioning scheme and apply changes.
5. Save the model.
6. Select `File > Export > Forward Engineer SQL CREATE Script...` and store in `shell-plugins/mrs_plugin/db_schema/mrs_metadata_schema_x.y.z.sql`.
7. Open the file in a text editor and replace and append the contents of the following SQL Scripts (available on Workbench) in this order:
   1. Replace the generated file header including the creation of the mysql_rest_service_metadata with `0. Script Header Replacement`
   2. Append `1. Additional SQL` at the end of the file
   3. Append `Audit Log Triggers` at the end of the file
   4. Append `3. Create Roles` at the end of the file
   5. Append `4. Create Schema Version VIEW` at the end of the file
8. Copy `shell-plugins/mrs_plugin/db_schema/mrs_metadata_schema_x.y.z.sql` to `shell-plugins/mrs_plugin/db_schema/mrs_metadata_schema.sql`
9. Create a `shell-plugins/mrs_plugin/db_schema/mrs_metadata_schema_a.b.c_to_x.y.z.sql` file and write all the ALTER statements required to get the latest metadata schema version a.b.c to the new state of x.y.z.
