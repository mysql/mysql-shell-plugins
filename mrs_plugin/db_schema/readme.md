<!-- Copyright (c) 2024, 2025, Oracle and/or its affiliates.

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

MySQL Workbench is used to design the MRS Metadata Schema and must be used to change the mrs_metadata_schema.mwb and generate the core SQL CREATE script.

Please ensure to closely follow the process documented below to avoid manual changes to the SQL files being overwritten by the MySQL Workbench forward engineering function.

## Installing the Audit_Log_Triggers script in MySQL Workbench

MRS relies on a dedicated audit log table that tracks all changes to the MRS metadata. The audit log is implemented via triggers on each table that holds relevant data.

Instead of having to manually adjust the triggers for every change to the metadata schema, a MySQL Workbench script is used to generate the `Audit Log Triggers` SQL script instead that is later on added to the final `shell-plugins/mrs_plugin/db_schema/mrs_metadata/mrs_metadata_schema.sql` file.

Install the `./scripts/Audit_Log_Triggers_grt.py` script in `~/Library/Application Support/MySQL/Workbench/modules/Audit_Log_Triggers_grt.py` and in `~/Library/Application Support/MySQL/Workbench/scripts/` on MacOS. Use the corresponding paths on Linux and Windows.

## Generating the defaultStaticContent for config.data

In order to serve a welcome landing page when the root URI of a MySQL Router configured for MRS is accessed (e.g. https://localhost:8440), a list of static files are defined in the `defaultStaticContent` section of the configuration JSON options as well as the `directoryIndexDirective` is set to `index.html`.

These static files are stored in the `./default_static_content/` directory.

Please Note: Whenever changes are made to any of those files the following script needs the be run.

The script `../scripts/prepare_default_static_content.sh` and the corresponding NPM SCRIPTS entry can be used to generate a `../script_sections/06_insert_default_static_content.sql` file.

Please note, that the `../scripts/prepare_default_static_content.sh` script requires the installation of the following dependencies.

```sh
$ sudo npm install html-minifier-terser -g
$ brew install gettext
$ brew link --force gettext
```

## Process to update the MRS Metadata Schema

1. Open the `shell-plugins/mrs_plugin/db_schema/mrs_metadata_schema.mwb` file in MySQL Workbench, make the required changes to the model.
2. If there are changes to a table tracked in the audit log (check the existing `TRIGGER`s), select `Scripting > Run Script File > Audit_Log_Triggers_grt.py` to re-generate the embedded `Audit Log Triggers` SQL script.
3. Save the model.
4. Select `File > Export > Forward Engineer SQL CREATE Script...` and store in `shell-plugins/mrs_plugin/db_schema/mrs_metadata/script_sections/02_mrs_metadata_schema.sql`.
5. Go to the MySQL Model tab sheet and open the `SQL Scripts` section. Double-click on the `Audit Log Triggers` script, select and copy the contents of that script. Open the `shell-plugins/mrs_plugin/db_schema/mrs_metadata/script_sections/04_audit_log_triggers.sql` file and replace its content with the one from the clipboard.
6. Run the `build-mrs-metadata-sql-scripts` NPM script and enter the new version string to build the MRS metadata SQL scripts.

The `DB_VERSION` constant in the `mrs_plugin/lib/general.py` will be updated to reflect the new version and the following two files will be created or overwritten.

- `shell-plugins/mrs_plugin/db_schema/mrs_metadata/mrs_metadata_schema.sql`
- `shell-plugins/mrs_plugin/db_schema/mrs_metadata/versions/mrs_metadata_schema_x.y.z.sql`

An update script will be created if it does not yet exist.

- `shell-plugins/mrs_plugin/db_schema/mrs_metadata/updates/mrs_metadata_schema_a.b.c_to_x.y.z.sql`

Please ensure to include all SQL statements to update the schemas from the previous version to the new version.
