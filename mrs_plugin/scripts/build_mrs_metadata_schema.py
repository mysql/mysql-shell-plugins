# Copyright (c) 2025, Oracle and/or its affiliates.

# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is designed to work with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms, as
# designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have either included with
# the program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

from pathlib import Path
import os
import re
import shutil
from datetime import datetime

ROOT_PATH = Path(f"{os.path.dirname(__file__)}/../").resolve().as_posix()
DB_VERSION_DEFINITION_PATH = os.path.join(ROOT_PATH, "lib", "general.py")
VERSION_STRING_REGEX = r"(\d+).(\d+).(\d+)"
PY_DB_VERSION_REGEX = r"\[\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\]"

SCRIPT_SECTION_PATH = os.path.join(ROOT_PATH, "db_schema", "mrs_metadata", "script_sections")
MYSQL_TASKS_SCHEMA_PATH = os.path.join(ROOT_PATH, "db_schema", "mysql_tasks", "mysql_tasks_schema.sql")

SQL_FILE_TARGET = os.path.join(ROOT_PATH, "db_schema", "mrs_metadata_schema.sql")

def get_current_version():
    with open(DB_VERSION_DEFINITION_PATH) as f:
        for line in f:
            if line.strip().startswith("DB_VERSION"):
                matches = re.findall(PY_DB_VERSION_REGEX, line, re.DOTALL)
                if len(matches) > 0:
                    match = list(matches[0])
                    return ".".join(match)


def update_version(version):
    lines = []
    with open(DB_VERSION_DEFINITION_PATH) as file:
        lines = file.readlines()

    for index in range(len(lines)):
        if lines[index].startswith("DB_VERSION"):
            matches = re.findall(VERSION_STRING_REGEX, version, re.DOTALL)
            if len(matches) > 0:
                match = list(matches[0])
                lines[index] = f'DB_VERSION = [{", ".join(match)}]\n'
            else:
                raise ValueError(f"Invalid version format: {version}")
            break

    with (open(DB_VERSION_DEFINITION_PATH, 'w')) as file:
        file.write(''.join(lines))


def get_next_version(caption, current_version):
    target_version = input(f'{caption} [{current_version}] : ')
    if target_version == "":
        target_version = current_version

    matches = re.findall(VERSION_STRING_REGEX, target_version, re.DOTALL)
    if len(matches) == 0:
        print("Invalid version format. Please use the format 'x.y.z'")
        return get_next_version(caption, current_version)

    return target_version


def update_version_view_version_in_lines(lines, view_name, version):
    view_sql = f"VIEW {view_name}"
    for index in range(len(lines)):
        if view_sql in lines[index]:
            matches = re.findall(VERSION_STRING_REGEX, version, re.DOTALL)
            if len(matches) > 0:
                match = list(matches[0])
                lines[index] = f'CREATE OR REPLACE SQL SECURITY INVOKER VIEW {view_name} (major, minor, patch) AS SELECT {", ".join(match)};\n'
            else:
                raise ValueError(f"Invalid version format: {version}")
            break


def check_and_add_copyright_header(file_path):
    with open(file_path) as file:
        lines = file.readlines()

    # Add the copyright header if it's missing
    if len(lines) > 0 and not lines[0].startswith("-- Copyright"):
        lines[0] = f"-- Copyright (c) {datetime.now().year}, Oracle and/or its affiliates.\n"
        with open(file_path, 'w') as file:
            file.write(''.join(lines))


def append_mrs_metadata_schema(version, mrs_script_path, target_path):
    with open(mrs_script_path) as file:
        lines = file.readlines()

    while len(lines) > 0 and not lines[0].startswith("USE `mysql_rest_service_metadata`"):
        lines.pop(0)
    if len(lines) > 0:
        lines.pop(0)

    update_version_view_version_in_lines(lines, "mrs_user_schema_version", version)

    with open(target_path, 'a') as file:
        file.write(''.join(lines))


def append_mrs_version_view(version, version_view_path, target_path):
    with open(version_view_path) as file:
        lines = file.readlines()

    # Remove copyright header
    if len(lines) > 0 and lines[0].startswith("-- Copyright"):
        lines.pop(0)

    update_version_view_version_in_lines(lines, "msm_schema_version", version)

    with open(target_path, 'a') as file:
        file.write(''.join(lines))


def append_files(source_path, target_path):
    with open(source_path, 'r') as source_file:
        lines = source_file.readlines()

        # Remove copyright header
        if len(lines) > 0 and lines[0].startswith("-- Copyright"):
            lines.pop(0)

        with open(target_path, 'a') as target_file:
            target_file.write(''.join(lines))


current_version = get_current_version()
target_version = get_next_version(
    "New MRS metadata schema version", current_version)

# Update the DB_VERSION in the Python source
print(f"\nIncrementing MRS metadata schema version from {current_version} to {target_version}...")
update_version(target_version)

# Add the copyright header if it's missing
check_and_add_copyright_header(os.path.join(SCRIPT_SECTION_PATH, "02_mrs_metadata_schema.sql"))
check_and_add_copyright_header(os.path.join(SCRIPT_SECTION_PATH, "04_audit_log_triggers.sql"))

# Generate the new MRS metadata schema files
print(f"\nGenerating new MRS metadata schema version {target_version}...")

# Start with mysql_tasks schema
shutil.copyfile(MYSQL_TASKS_SCHEMA_PATH, SQL_FILE_TARGET)

# Append header section
append_files(os.path.join(SCRIPT_SECTION_PATH, "01_header.sql"), SQL_FILE_TARGET)

# Append the new MRS metadata schema with updated version
append_mrs_metadata_schema(
    target_version, os.path.join(SCRIPT_SECTION_PATH, "02_mrs_metadata_schema.sql"), SQL_FILE_TARGET)

# Append the next sections
append_files(os.path.join(SCRIPT_SECTION_PATH, "03_additional_alters_and_creates.sql"), SQL_FILE_TARGET)
append_files(os.path.join(SCRIPT_SECTION_PATH, "04_audit_log_triggers.sql"), SQL_FILE_TARGET)
append_files(os.path.join(SCRIPT_SECTION_PATH, "05_roles.sql"), SQL_FILE_TARGET)
append_files(os.path.join(SCRIPT_SECTION_PATH, "06_insert_default_static_content.sql"), SQL_FILE_TARGET)
append_mrs_version_view(
    target_version, os.path.join(SCRIPT_SECTION_PATH, "07_schema_version_view.sql"), SQL_FILE_TARGET)

# Copy the final file to the version directory
sql_versioned_file_path = os.path.join(
    ROOT_PATH, "db_schema", "mrs_metadata", "versions", f"mrs_metadata_schema_{target_version}.sql")
shutil.copyfile(SQL_FILE_TARGET, sql_versioned_file_path)

print(f"\nThe following SQL scripts have been written:\n- {SQL_FILE_TARGET}\n- {sql_versioned_file_path}\n")

# Check the update script exists, if not create it
if current_version != target_version:
    update_script_path = os.path.join(
        ROOT_PATH, "db_schema", "mrs_metadata", "updates",
        f"mrs_metadata_schema_{current_version}_to_{target_version}.sql")

    update_script_file = Path("/path/to/file")
    if not update_script_file.is_file():
        shutil.copyfile(os.path.join(SCRIPT_SECTION_PATH, "00_update_script.sql"), update_script_path)
        print(f"- {update_script_path}\n")

